import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import {
  GuestAuth,
  GuestResponse,
  GuestMessageStart,
  GuestMessageHost,
  GuestMessageEnd,
  AuthResult,
  ObserverSubscribe,
  ObserverEvent,
  WSEventType,
  Conversation,
  ConversationMessage,
} from "@vantum/shared";
import { getAgentByApiKey } from "../agents/store";
import {
  createConversation,
  getOrchestrator,
  removeOrchestrator,
  ConversationOrchestrator,
  OrchestrationCallbacks,
  OrchestrationConfig,
} from "../orchestration";

// --- Connection tracking ---

interface GuestConnection {
  ws: WebSocket;
  agentId: string;
  conversationId: string | null;
}

interface ObserverConnection {
  ws: WebSocket;
  conversationId: string;
}

/** Map of agentId -> GuestConnection */
const guestConnections = new Map<string, GuestConnection>();

/** Map of conversationId -> Set of ObserverConnections */
const observerRooms = new Map<string, Set<ObserverConnection>>();

/** Map of conversationId -> reconnect timer */
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Pending conversations waiting for a guest agent to connect. agentId -> { topic, config } */
const pendingConversations = new Map<string, { topic: string; config?: Partial<OrchestrationConfig> }>();

// --- WebSocket Server Setup ---

export function createWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const role = url.searchParams.get("role");

    if (role === "observer") {
      handleObserverConnection(ws);
    } else {
      // Default: guest agent connection
      handleGuestConnection(ws);
    }
  });

  return wss;
}

// --- Guest Agent Connection ---

function handleGuestConnection(ws: WebSocket): void {
  let authenticated = false;
  let agentId: string | null = null;

  console.log("[WS] New guest agent connection, awaiting auth...");

  // Auth timeout — disconnect if not authenticated within 10 seconds
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      send(ws, { type: "auth_result", success: false, error: "Auth timeout" } as AuthResult);
      ws.close(4001, "Auth timeout");
    }
  }, 10_000);

  ws.on("message", (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      console.warn("[WS] Malformed message from guest (not JSON)");
      if (authenticated && agentId) {
        handleMalformedMessage(agentId);
      }
      return;
    }

    const msg = parsed as Record<string, unknown>;

    if (!authenticated) {
      // Expect auth message
      if (msg.type === "auth") {
        clearTimeout(authTimeout);
        const authMsg = msg as unknown as GuestAuth;
        const agent = getAgentByApiKey(authMsg.apiKey);

        if (!agent) {
          send(ws, { type: "auth_result", success: false, error: "Invalid API key" } as AuthResult);
          ws.close(4003, "Invalid API key");
          return;
        }

        authenticated = true;
        agentId = agent.id;

        const conn: GuestConnection = { ws, agentId: agent.id, conversationId: null };
        guestConnections.set(agent.id, conn);

        send(ws, { type: "auth_result", success: true, agentId: agent.id } as AuthResult);
        console.log(`[WS] Guest agent authenticated: ${agent.name} (${agent.id})`);

        // Check for reconnect
        handlePossibleReconnect(agent.id, ws);

        // Check for pending conversation
        const pending = pendingConversations.get(agent.id);
        if (pending) {
          pendingConversations.delete(agent.id);
          startConversationForAgent(agent.id, pending.topic, pending.config);
        }
      } else {
        send(ws, { type: "auth_result", success: false, error: "Must authenticate first" } as AuthResult);
      }
      return;
    }

    // Authenticated — handle agent_response
    if (msg.type === "agent_response") {
      const response = msg as unknown as GuestResponse;
      if (!response.content || typeof response.content !== "string") {
        console.warn("[WS] Malformed agent_response: missing content");
        if (agentId) handleMalformedMessage(agentId);
        return;
      }
      if (agentId) {
        handleGuestResponse(agentId, response);
      }
    } else {
      console.warn(`[WS] Unexpected message type from guest: ${msg.type}`);
      if (agentId) handleMalformedMessage(agentId);
    }
  });

  ws.on("close", () => {
    clearTimeout(authTimeout);
    if (agentId) {
      console.log(`[WS] Guest agent disconnected: ${agentId}`);
      handleGuestDisconnect(agentId);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] Guest connection error:", err.message);
  });
}

function handleGuestResponse(agentId: string, response: GuestResponse): void {
  const conn = guestConnections.get(agentId);
  if (!conn?.conversationId) return;

  const orch = getOrchestrator(conn.conversationId);
  if (!orch) return;

  console.log(`[WS] Guest response received for conversation ${conn.conversationId}`);

  // Broadcast to observers
  broadcastToObservers(conn.conversationId, "conversation:message", {
    role: "guest",
    content: response.content,
    agentId,
  });

  // Feed to orchestrator
  orch.receiveGuestResponse(response.content);
}

function handleMalformedMessage(agentId: string): void {
  const conn = guestConnections.get(agentId);
  if (!conn?.conversationId) return;

  console.warn(`[WS] Malformed message from agent ${agentId}, treating as evasion`);

  const orch = getOrchestrator(conn.conversationId);
  if (orch) {
    // Treat as empty/evasion — send empty response to trigger timeout logic
    orch.receiveGuestResponse("");
  }
}

function handleGuestDisconnect(agentId: string): void {
  const conn = guestConnections.get(agentId);
  if (!conn?.conversationId) {
    guestConnections.delete(agentId);
    return;
  }

  const conversationId = conn.conversationId;
  const orch = getOrchestrator(conversationId);

  // Broadcast disconnect to observers
  broadcastToObservers(conversationId, "agent:disconnect", { agentId });

  // Keep the connection record for reconnect (without the ws)
  conn.ws = null as unknown as WebSocket;

  // Start 30-second reconnect window
  console.log(`[WS] Starting 30s reconnect window for agent ${agentId} on conversation ${conversationId}`);
  const timer = setTimeout(() => {
    reconnectTimers.delete(conversationId);
    console.log(`[WS] Reconnect window expired for conversation ${conversationId}`);

    // Notify orchestrator to conclude
    if (orch) {
      orch.handleGuestDisconnect();
    }
    guestConnections.delete(agentId);
  }, 30_000);

  reconnectTimers.set(conversationId, timer);
}

function handlePossibleReconnect(agentId: string, ws: WebSocket): void {
  const conn = guestConnections.get(agentId);
  if (!conn?.conversationId) return;

  const conversationId = conn.conversationId;
  const timer = reconnectTimers.get(conversationId);

  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(conversationId);
    conn.ws = ws;
    console.log(`[WS] Agent ${agentId} reconnected to conversation ${conversationId}`);

    broadcastToObservers(conversationId, "agent:connect", { agentId, reconnected: true });
  }
}

// --- Observer Connection ---

function handleObserverConnection(ws: WebSocket): void {
  let subscribed = false;
  let observerConn: ObserverConnection | null = null;

  console.log("[WS] New observer connection, awaiting subscription...");

  ws.on("message", (data) => {
    if (subscribed) return; // Read-only after subscribe

    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      send(ws, { type: "error", error: "Invalid JSON" });
      return;
    }

    const msg = parsed as Record<string, unknown>;

    if (msg.type === "subscribe") {
      const sub = msg as unknown as ObserverSubscribe;
      if (!sub.conversationId) {
        send(ws, { type: "error", error: "conversationId required" });
        return;
      }

      observerConn = { ws, conversationId: sub.conversationId };
      let room = observerRooms.get(sub.conversationId);
      if (!room) {
        room = new Set();
        observerRooms.set(sub.conversationId, room);
      }
      room.add(observerConn);
      subscribed = true;

      send(ws, {
        type: "observer_event",
        event: "agent:connect",
        conversationId: sub.conversationId,
        data: { message: "Subscribed to conversation" },
        timestamp: new Date().toISOString(),
      } as ObserverEvent);

      console.log(`[WS] Observer subscribed to conversation ${sub.conversationId}`);

      // Send existing messages if conversation is already in progress
      const orch = getOrchestrator(sub.conversationId);
      if (orch) {
        for (const msg of orch.state.messages) {
          send(ws, {
            type: "observer_event",
            event: "conversation:message",
            conversationId: sub.conversationId,
            data: { role: msg.role, content: msg.content, messageId: msg.id },
            timestamp: msg.timestamp,
          } as ObserverEvent);
        }
      }
    }
  });

  ws.on("close", () => {
    if (observerConn) {
      const room = observerRooms.get(observerConn.conversationId);
      if (room) {
        room.delete(observerConn);
        if (room.size === 0) {
          observerRooms.delete(observerConn.conversationId);
        }
      }
      console.log(`[WS] Observer disconnected from conversation ${observerConn.conversationId}`);
    }
  });

  ws.on("error", (err) => {
    console.error("[WS] Observer connection error:", err.message);
  });
}

// --- Broadcasting ---

function broadcastToObservers(
  conversationId: string,
  event: WSEventType,
  data: Record<string, unknown>,
): void {
  const room = observerRooms.get(conversationId);
  if (!room) return;

  const payload: ObserverEvent = {
    type: "observer_event",
    event,
    conversationId,
    data,
    timestamp: new Date().toISOString(),
  };

  for (const observer of room) {
    send(observer.ws, payload);
  }
}

// --- Conversation Lifecycle ---

export function startConversationForAgent(
  agentId: string,
  topic: string,
  config?: Partial<OrchestrationConfig>,
): string | null {
  const conn = guestConnections.get(agentId);
  if (!conn || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
    // Agent not connected yet — store pending
    pendingConversations.set(agentId, { topic, config });
    console.log(`[WS] Conversation pending for agent ${agentId} (not connected yet)`);
    return null;
  }

  const callbacks: OrchestrationCallbacks = {
    onHostMessage: (conversation: Conversation, message: ConversationMessage) => {
      const guestConn = guestConnections.get(agentId);
      if (guestConn?.ws && guestConn.ws.readyState === WebSocket.OPEN) {
        const turnNumber = conversation.messages.filter((m) => m.role === "host").length;
        send(guestConn.ws, {
          type: "host_message",
          conversationId: conversation.id,
          messageId: message.id,
          content: message.content,
          turnNumber,
        } as GuestMessageHost);
      }

      // Broadcast to observers
      broadcastToObservers(conversation.id, "conversation:message", {
        role: "host",
        content: message.content,
        messageId: message.id,
      });
    },

    onConversationEnd: (conversation: Conversation, reason: string, synthesis?: string) => {
      const guestConn = guestConnections.get(agentId);
      if (guestConn?.ws && guestConn.ws.readyState === WebSocket.OPEN) {
        send(guestConn.ws, {
          type: "conversation_end",
          conversationId: conversation.id,
          reason,
          synthesis,
        } as GuestMessageEnd);
      }

      broadcastToObservers(conversation.id, "conversation:end", {
        reason,
        synthesis,
        messageCount: conversation.messages.length,
      });

      // Cleanup
      if (guestConn) guestConn.conversationId = null;
      removeOrchestrator(conversation.id);
      console.log(`[WS] Conversation ${conversation.id} ended: ${reason}`);
    },

    onError: (conversation: Conversation, error: string) => {
      broadcastToObservers(conversation.id, "error", { error });
    },
  };

  const orch = createConversation(topic, agentId, callbacks, config);
  conn.conversationId = orch.conversationId;

  // Send conversation_start to guest
  send(conn.ws, {
    type: "conversation_start",
    conversationId: orch.conversationId,
    topic,
  } as GuestMessageStart);

  // Notify observers
  broadcastToObservers(orch.conversationId, "conversation:start", { topic, agentId });

  console.log(`[WS] Conversation ${orch.conversationId} started: "${topic}" with agent ${agentId}`);

  // Start orchestration (async, runs in background)
  orch.start().catch((err) => {
    console.error(`[WS] Orchestration error for ${orch.conversationId}:`, err);
  });

  return orch.conversationId;
}

// --- Helpers ---

function send(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
