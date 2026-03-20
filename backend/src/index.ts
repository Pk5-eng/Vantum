import express from "express";
import http from "http";
import cors from "cors";
import agentRoutes from "./agents/routes";
import { createWebSocketServer, startConversationForAgent } from "./websocket";
import { getAgent } from "./agents/store";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Agent registration
app.use("/api/agents", agentRoutes);

// Start a conversation (called by platform / test script)
app.post("/api/conversations/start", (req, res) => {
  const { agentId, topic } = req.body;
  if (!agentId || !topic) {
    res.status(400).json({ error: "agentId and topic are required" });
    return;
  }
  const agent = getAgent(agentId);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const conversationId = startConversationForAgent(agentId, topic);
  res.status(201).json({
    conversationId,
    status: conversationId ? "started" : "pending_agent_connection",
  });
});

const server = http.createServer(app);

// Set up WebSocket server
createWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Vantum backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`Agent registration: POST http://localhost:${PORT}/api/agents/register`);
  console.log(`Start conversation: POST http://localhost:${PORT}/api/conversations/start`);
});
