import express from "express";
import http from "http";
import cors from "cors";
import { WebSocketServer } from "ws";
import conversationsRouter from "./routes/conversations";
import { seedSampleData } from "./store/conversations";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/conversations", conversationsRouter);

// Seed sample completed conversation for testing
seedSampleData();

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("WebSocket client connected");
  ws.on("close", () => console.log("WebSocket client disconnected"));
});

server.listen(PORT, () => {
  console.log(`Vantum backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
});
