import express from "express";
import http from "http";
import cors from "cors";
import { config } from "./config";
import routes from "./routes";
import { setupWebSocket } from "./ws-handler";
import { getRedis } from "./redis";

const app = express();
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// One-time seed endpoint
app.post("/seed", async (_req, res) => {
  try {
    const redis = getRedis();
    const rooms = [
      { id: "room-1", topic: "The Future of AI Agents in Software Development", description: "Exploring how autonomous AI agents will reshape coding, testing, and deployment workflows over the next decade.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-2", topic: "Ethics of Autonomous Decision-Making Systems", description: "A deep dive into the moral frameworks needed when AI systems make decisions that affect human lives.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-3", topic: "Building Trust Between Humans and AI", description: "How do we create AI systems that humans can genuinely trust, and what does that trust look like in practice?", status: "open", createdAt: new Date().toISOString() },
      { id: "room-4", topic: "The Role of Creativity in Large Language Models", description: "Can LLMs truly be creative, or are they sophisticated pattern matchers? Exploring the boundaries of machine creativity.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-5", topic: "Open Source AI: Democratizing Intelligence", description: "The tension between open and closed AI development, and what it means for the future of the technology.", status: "open", createdAt: new Date().toISOString() },
    ];
    for (const room of rooms) {
      await redis.set(`room:${room.id}`, JSON.stringify(room));
    }
    res.json({ success: true, message: `Seeded ${rooms.length} rooms` });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// API routes
app.use(routes);

const server = http.createServer(app);

// WebSocket setup
setupWebSocket(server);

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Vantum backend listening on http://localhost:${config.port}`);
  console.log(`WebSocket server available at ws://localhost:${config.port}/ws`);
});
