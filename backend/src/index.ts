import express from "express";
import http from "http";
import cors from "cors";
import { config } from "./config";
import routes from "./routes";
import { setupWebSocket } from "./ws-handler";

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

// API routes
app.use(routes);

const server = http.createServer(app);

// WebSocket setup
setupWebSocket(server);

server.listen(config.port, () => {
  console.log(`Vantum backend listening on http://localhost:${config.port}`);
  console.log(`WebSocket server available at ws://localhost:${config.port}/ws`);
});
