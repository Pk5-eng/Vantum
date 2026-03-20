import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import url from "url";
import { ConversationMessage, ObserverEvent, ServerToGuestMsg } from "@vantum/shared";
import { getAgentByApiKey } from "../agents/registry";
import { Orchestrator } from "../orchestration/orchestrator";

/** Authenticated guest connection. */
interface GuestConnection {
  ws: WebSocket;
  agentId: string;
  conversationId: string | null;
}

/** Observer connection watching a conversation. */
interface ObserverConnection {
  ws: WebSocket;
  conversationId: string;
}

const DEFAULT_TOPIC = "The future of AI agents and autonomous software development";

export class VantumWebSocketServer {
  private wss: WebSocketServer;
  private orchestrator: Orchestrator;

  // Connection tracking
  private guestConnections = new Map<string, GuestConnection>(); // agentId → connection
  private observerRooms = new Map<string, Set<ObserverConnection>>(); // conversationId → observers
  private pendingAuth = new Set<WebSocket>(); // connections awaiting auth

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.orchestrator = new Orchestrator({
      onHostMessage: (convId, msg) => this.handleOrchestratorMessage(convId, msg),
      onConversationEnd: (convId, reason, synthesis) =>
        this.handleConversationEnd(convId, reason, synthesis),
      onError: (convId, error) => this.handleOrchestratorError(convId, error),
    });

    this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    console.log("[ws] Vantum WebSocket server initialized");
  }

  get orchestratorInstance(): Orchestrator {
    return this.orchestrator;
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    const parsed = url.parse(req.url || "", true);
    const role = parsed.query.role as string | undefined;

    if (role === "observer") {
      this.handleObserverConnection(ws, parsed.query);
    } else {
      // Guest agent connection — needs authentication
      this.handleGuestConnection(ws);
    }
  }

  // --- Guest Agent Connection ---

  private handleGuestConnection(ws: WebSocket) {
    console.log("[ws] New guest agent connection — awaiting auth");
    this.pendingAuth.add(ws);

    // Auth timeout: 10 seconds
    const authTimer = setTimeout(() => {
      if (this.pendingAuth.has(ws)) {
        this.pendingAuth.delete(ws);
        this.sendJson(ws, { type: "error", message: "Authentication timeout" });
        ws.close(4001, "Auth timeout");
      }
    }, 10_000);

    ws.on("message", (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        console.log("[ws] Malformed message from guest");
        return;
      }

      if (this.pendingAuth.has(ws)) {
        // Expect auth message
        if (msg.type === "auth" && typeof msg.apiKey === "string") {
          clearTimeout(authTimer);
          this.authenticateGuest(ws, msg.apiKey);
        } else {
          this.sendJson(ws, { type: "error", message: "Send auth message first" });
        }
        return;
      }

      // Authenticated — handle agent_response
      this.handleGuestMessage(ws, msg);
    });

    ws.on("close", () => {
      clearTimeout(authTimer);
      this.pendingAuth.delete(ws);
      this.handleGuestDisconnect(ws);
    });
  }

  private authenticateGuest(ws: WebSocket, apiKey: string) {
    const agent = getAgentByApiKey(apiKey);
    if (!agent) {
      this.sendJson(ws, { type: "error", message: "Invalid API key" });
      ws.close(4003, "Invalid API key");
      this.pendingAuth.delete(ws);
      return;
    }

    this.pendingAuth.delete(ws);
    const conn: GuestConnection = { ws, agentId: agent.id, conversationId: null };
    this.guestConnections.set(agent.id, conn);
    this.sendJson(ws, { type: "auth_success", agentId: agent.id });
    console.log(`[ws] Guest agent authenticated: ${agent.name} (${agent.id})`);

    // Start a conversation for this agent
    this.startConversationForGuest(conn);
  }

  private async startConversationForGuest(conn: GuestConnection) {
    try {
      const conversation = await this.orchestrator.startConversation(DEFAULT_TOPIC, conn.agentId);
      conn.conversationId = conversation.id;
      console.log(`[ws] Conversation started: ${conversation.id} for agent ${conn.agentId}`);

      // Send conversation_start to guest
      const startMsg: ServerToGuestMsg = {
        type: "conversation_start",
        conversationId: conversation.id,
        topic: conversation.topic,
      };
      this.sendJson(conn.ws, startMsg);

      // Notify observers
      this.broadcastToObservers(conversation.id, {
        type: "conversation:start",
        conversationId: conversation.id,
        data: { topic: conversation.topic, guestAgentId: conn.agentId },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[ws] Failed to start conversation:", err);
      this.sendJson(conn.ws, { type: "error", message: "Failed to start conversation" });
    }
  }

  private handleGuestMessage(ws: WebSocket, msg: Record<string, unknown>) {
    // Find the guest connection
    let conn: GuestConnection | undefined;
    for (const c of this.guestConnections.values()) {
      if (c.ws === ws) { conn = c; break; }
    }
    if (!conn || !conn.conversationId) {
      this.sendJson(ws, { type: "error", message: "Not in a conversation" });
      return;
    }

    if (msg.type === "agent_response" && typeof msg.content === "string") {
      const accepted = this.orchestrator.receiveGuestResponse(conn.conversationId, msg.content);
      if (!accepted) {
        this.sendJson(ws, { type: "error", message: "Response not expected at this time" });
      }
    } else {
      console.log(`[ws] Malformed guest message in ${conn.conversationId}:`, msg);
      // Treat as evasion — the orchestrator timeout will handle it
    }
  }

  private handleGuestDisconnect(ws: WebSocket) {
    for (const [agentId, conn] of this.guestConnections.entries()) {
      if (conn.ws === ws) {
        console.log(`[ws] Guest agent disconnected: ${agentId}`);
        if (conn.conversationId && this.orchestrator.isActive(conn.conversationId)) {
          this.orchestrator.handleGuestDisconnect(conn.conversationId);

          // Notify observers
          this.broadcastToObservers(conn.conversationId, {
            type: "status",
            conversationId: conn.conversationId,
            data: { status: "guest_disconnected", reconnectWindowMs: 30_000 },
            timestamp: new Date().toISOString(),
          });
        }
        this.guestConnections.delete(agentId);
        break;
      }
    }
  }

  // --- Observer Connection ---

  private handleObserverConnection(ws: WebSocket, query: Record<string, string | string[] | undefined>) {
    const conversationId = query.conversationId as string | undefined;
    if (!conversationId) {
      this.sendJson(ws, { type: "error", message: "conversationId required for observer" });
      ws.close(4000, "Missing conversationId");
      return;
    }

    const observer: ObserverConnection = { ws, conversationId };
    if (!this.observerRooms.has(conversationId)) {
      this.observerRooms.set(conversationId, new Set());
    }
    this.observerRooms.get(conversationId)!.add(observer);
    console.log(`[ws] Observer joined conversation ${conversationId} (${this.observerRooms.get(conversationId)!.size} total)`);

    this.sendJson(ws, { type: "observer_joined", conversationId });

    // Send existing messages if conversation already has history
    const conv = this.orchestrator.getConversation(conversationId);
    if (conv) {
      for (const msg of conv.messages) {
        this.sendJson(ws, {
          type: "conversation:message",
          conversationId,
          data: { role: msg.role, content: msg.content, messageId: msg.id },
          timestamp: msg.timestamp,
        });
      }
    }

    ws.on("close", () => {
      const room = this.observerRooms.get(conversationId);
      if (room) {
        room.delete(observer);
        if (room.size === 0) this.observerRooms.delete(conversationId);
      }
      console.log(`[ws] Observer left conversation ${conversationId}`);
    });

    // Observers are read-only — ignore any messages
    ws.on("message", () => {
      this.sendJson(ws, { type: "error", message: "Observers are read-only" });
    });
  }

  // --- Orchestration callbacks ---

  private handleOrchestratorMessage(conversationId: string, message: ConversationMessage) {
    // Send to guest agent
    if (message.role === "host") {
      const guestConn = this.findGuestByConversation(conversationId);
      if (guestConn) {
        const hostMsg: ServerToGuestMsg = {
          type: "host_message",
          conversationId,
          messageId: message.id,
          content: message.content,
        };
        this.sendJson(guestConn.ws, hostMsg);
      }
    }

    // Broadcast to observers
    this.broadcastToObservers(conversationId, {
      type: "conversation:message",
      conversationId,
      data: {
        role: message.role,
        content: message.content,
        messageId: message.id,
      },
      timestamp: message.timestamp,
    });
  }

  private handleConversationEnd(conversationId: string, reason: string, synthesis?: string) {
    console.log(`[ws] Conversation ended: ${conversationId} — ${reason}`);

    // Send to guest agent
    const guestConn = this.findGuestByConversation(conversationId);
    if (guestConn) {
      const endMsg: ServerToGuestMsg = {
        type: "conversation_end",
        conversationId,
        reason,
        synthesis,
      };
      this.sendJson(guestConn.ws, endMsg);
    }

    // Broadcast to observers
    this.broadcastToObservers(conversationId, {
      type: "conversation:end",
      conversationId,
      data: { reason, synthesis },
      timestamp: new Date().toISOString(),
    });
  }

  private handleOrchestratorError(conversationId: string, error: string) {
    console.error(`[ws] Orchestration error in ${conversationId}: ${error}`);
    this.broadcastToObservers(conversationId, {
      type: "error",
      conversationId,
      data: { error },
      timestamp: new Date().toISOString(),
    });
  }

  // --- Helpers ---

  private findGuestByConversation(conversationId: string): GuestConnection | undefined {
    for (const conn of this.guestConnections.values()) {
      if (conn.conversationId === conversationId) return conn;
    }
    return undefined;
  }

  private broadcastToObservers(conversationId: string, event: ObserverEvent) {
    const room = this.observerRooms.get(conversationId);
    if (!room) return;
    const data = JSON.stringify(event);
    for (const obs of room) {
      if (obs.ws.readyState === WebSocket.OPEN) {
        obs.ws.send(data);
      }
    }
  }

  private sendJson(ws: WebSocket, data: unknown) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}
