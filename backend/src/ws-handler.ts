import { WebSocketServer, WebSocket } from "ws";
import type http from "http";
import { verifyToken } from "./auth";
import { submitGuestReply } from "./conversation-engine";
import type { WSEvent } from "../../shared/src/types";

interface ConnectedClient {
  ws: WebSocket;
  agentId?: string;
  role?: string;
  roomId?: string;
  isObserver: boolean;
}

const clients = new Set<ConnectedClient>();

export function setupWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const roomId = url.searchParams.get("roomId");
    const observer = url.searchParams.get("observer") === "true";

    const client: ConnectedClient = {
      ws,
      roomId: roomId || undefined,
      isObserver: observer,
    };

    // Authenticate agent connections
    if (token && !observer) {
      const payload = verifyToken(token);
      if (!payload) {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Invalid token" },
            timestamp: new Date().toISOString(),
          })
        );
        ws.close(4001, "Invalid token");
        return;
      }
      client.agentId = payload.agentId;
      client.role = payload.role;
      client.roomId = payload.roomId;

      broadcast(payload.roomId, {
        type: "agent:connect",
        payload: {
          agentId: payload.agentId,
          role: payload.role,
          roomId: payload.roomId,
        },
        timestamp: new Date().toISOString(),
      });
    }

    clients.add(client);
    console.log(
      `WebSocket client connected: ${observer ? "observer" : client.agentId || "anonymous"} (room: ${client.roomId})`
    );

    ws.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        handleMessage(client, event);
      } catch {
        ws.send(
          JSON.stringify({
            type: "error",
            payload: { message: "Invalid message format" },
            timestamp: new Date().toISOString(),
          })
        );
      }
    });

    ws.on("close", () => {
      clients.delete(client);
      if (client.roomId && client.agentId) {
        broadcast(client.roomId, {
          type: "agent:disconnect",
          payload: { agentId: client.agentId, role: client.role },
          timestamp: new Date().toISOString(),
        });
      }
      console.log(`WebSocket client disconnected: ${client.agentId || "anonymous"}`);
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });
  });

  // Heartbeat to keep connections alive
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  return wss;
}

function handleMessage(client: ConnectedClient, event: { type: string; payload?: Record<string, unknown> }): void {
  switch (event.type) {
    case "agent:reply": {
      const conversationId = event.payload?.conversationId as string;
      const content = event.payload?.content as string;
      if (conversationId && content && client.role === "guest") {
        const accepted = submitGuestReply(conversationId, content);
        if (!accepted) {
          client.ws.send(
            JSON.stringify({
              type: "error",
              payload: { message: "No pending prompt for this conversation" },
              timestamp: new Date().toISOString(),
            })
          );
        }
      }
      break;
    }
    default:
      break;
  }
}

export function broadcast(roomId: string, event: WSEvent): void {
  const message = JSON.stringify(event);
  clients.forEach((client) => {
    if (
      client.ws.readyState === WebSocket.OPEN &&
      client.roomId === roomId
    ) {
      client.ws.send(message);
    }
  });
}
