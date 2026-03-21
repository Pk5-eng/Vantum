import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { URL } from "url";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = express();
app.use(cors());
app.use(express.json());

// --- In-memory state ---

interface ConversationState {
  id: string;
  roomId: string;
  status: "waiting" | "active" | "completed";
  messages: Array<{
    id: string;
    conversationId: string;
    role: "host" | "guest";
    content: string;
    timestamp: string;
  }>;
  act: number;
  turnCount: number;
}

const conversations = new Map<string, ConversationState>();
// Map conversationId -> Set of observer WebSockets
const observers = new Map<string, Set<WebSocket>>();
// Map conversationId -> guest agent WebSocket
const guestAgents = new Map<string, WebSocket>();
// Map agentId -> agent info
const registeredAgents = new Map<
  string,
  { name: string; apiKey: string }
>();

// Rooms data
const rooms = [
  { id: "room-1", topic: "The Future of AI Agents", domain: "AI & ML" },
  { id: "room-2", topic: "Developer Experience in 2026", domain: "DevTools" },
  { id: "room-3", topic: "Building for Scale", domain: "Infrastructure" },
  { id: "room-4", topic: "Open Source Sustainability", domain: "Community" },
  { id: "room-5", topic: "Security in the AI Era", domain: "Security" },
];

// --- HTTP routes ---

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/rooms", (_req, res) => {
  const roomData = rooms.map((r) => {
    const activeConv = Array.from(conversations.values()).find(
      (c) => c.roomId === r.id && c.status !== "completed"
    );
    return {
      ...r,
      activeConversationId: activeConv?.id || null,
      conversationCount: Array.from(conversations.values()).filter(
        (c) => c.roomId === r.id
      ).length,
    };
  });
  res.json(roomData);
});

app.post("/agents/register", (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const agentId = `agent-${crypto.randomUUID().slice(0, 8)}`;
  const apiKey = `vntm_${crypto.randomUUID().replace(/-/g, "")}`;
  registeredAgents.set(agentId, { name, apiKey });
  res.json({ agentId, apiKey, name });
});

app.get("/conversations/:id", (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(conv);
});

// --- Helper: broadcast to conversation observers ---

function broadcast(conversationId: string, event: object) {
  const subs = observers.get(conversationId);
  if (!subs) return;
  const data = JSON.stringify(event);
  for (const ws of subs) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// --- WebSocket server ---

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const conversationId = url.searchParams.get("conversationId");
  const agentId = url.searchParams.get("agentId");
  const roomId = url.searchParams.get("room");

  console.log("WebSocket client connected", {
    conversationId,
    agentId,
    roomId,
  });

  // --- Observer mode: subscribe to a conversation ---
  if (conversationId) {
    if (!observers.has(conversationId)) {
      observers.set(conversationId, new Set());
    }
    observers.get(conversationId)!.add(ws);

    // Send current state
    const conv = conversations.get(conversationId);
    if (conv) {
      // Replay existing messages
      for (const msg of conv.messages) {
        ws.send(
          JSON.stringify({
            type: "conversation:message",
            payload: msg,
            timestamp: msg.timestamp,
          })
        );
      }
      // Send current status
      if (conv.status === "active") {
        ws.send(
          JSON.stringify({
            type: "conversation:start",
            payload: { conversationId: conv.id, act: conv.act },
            timestamp: new Date().toISOString(),
          })
        );
      }
    }

    ws.on("message", (raw) => {
      try {
        const event = JSON.parse(raw.toString());
        // Handle subscription messages (no-op, already subscribed)
        if (event.type === "conversation:subscribe") return;
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      observers.get(conversationId)?.delete(ws);
    });
    return;
  }

  // --- Agent mode: connect as guest agent to a room ---
  if (agentId && roomId) {
    // Create or find conversation for this room
    let conv = Array.from(conversations.values()).find(
      (c) => c.roomId === roomId && c.status !== "completed"
    );

    if (!conv) {
      const id = `conv-${crypto.randomUUID().slice(0, 8)}`;
      conv = {
        id,
        roomId,
        status: "waiting",
        messages: [],
        act: 1,
        turnCount: 0,
      };
      conversations.set(id, conv);
    }

    guestAgents.set(conv.id, ws);

    // Start conversation
    conv.status = "active";
    broadcast(conv.id, {
      type: "conversation:start",
      payload: { conversationId: conv.id, act: 1 },
      timestamp: new Date().toISOString(),
    });

    // Send start event to agent too
    ws.send(
      JSON.stringify({
        type: "conversation:start",
        payload: { conversationId: conv.id, roomId, act: 1 },
        timestamp: new Date().toISOString(),
      })
    );

    const currentConvId = conv.id;

    ws.on("message", (raw) => {
      try {
        const event = JSON.parse(raw.toString());
        if (event.type === "conversation:message") {
          const c = conversations.get(currentConvId);
          if (!c) return;

          const msg = {
            id: `msg-${crypto.randomUUID().slice(0, 8)}`,
            conversationId: currentConvId,
            role: (event.payload.role as "host" | "guest") || "guest",
            content: event.payload.content as string,
            timestamp: event.timestamp || new Date().toISOString(),
          };

          c.messages.push(msg);
          c.turnCount++;

          // Update act based on turn count
          if (c.turnCount > 8) c.act = 3;
          else if (c.turnCount > 4) c.act = 2;

          // Broadcast to observers
          broadcast(currentConvId, {
            type: "conversation:message",
            payload: { ...msg, act: c.act },
            timestamp: msg.timestamp,
          });
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => {
      guestAgents.delete(currentConvId);
      console.log(`Agent disconnected from conversation ${currentConvId}`);
      broadcast(currentConvId, {
        type: "agent:disconnect",
        payload: { agentId, conversationId: currentConvId },
        timestamp: new Date().toISOString(),
      });
    });
    return;
  }

  // --- Generic connection (no specific role) ---
  ws.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString());
      if (event.type === "conversation:subscribe" && event.payload?.conversationId) {
        const cid = event.payload.conversationId as string;
        if (!observers.has(cid)) {
          observers.set(cid, new Set());
        }
        observers.get(cid)!.add(ws);
      }
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
    // Clean up from all observer sets
    for (const [, subs] of observers) {
      subs.delete(ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Vantum backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
});
