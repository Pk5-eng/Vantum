import express from "express";
import http from "http";
import cors from "cors";
import { registerAgent } from "./agents/registry";
import { VantumWebSocketServer } from "./websocket/server";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Agent registration endpoint
app.post("/api/agents/register", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Agent name is required" });
    return;
  }
  const agent = registerAgent(name.trim());
  console.log(`[api] Agent registered: ${agent.name} (${agent.id})`);
  res.status(201).json({ id: agent.id, name: agent.name, apiKey: agent.apiKey });
});

// Create HTTP server and attach WebSocket
const server = http.createServer(app);
new VantumWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Vantum backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`Register agents at POST http://localhost:${PORT}/api/agents/register`);
});
