import express from "express";
import http from "http";
import path from "path";
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
      { id: "room-2", topic: "Ethics of Autonomous Decision-Making Systems", description: "A deep dive into the moral frameworks needed when AI systems make decisions that affect human lives.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-3", topic: "Building Trust Between Humans and AI", description: "How do we create AI systems that humans can genuinely trust, and what does that trust look like in practice?", status: "open", createdAt: new Date().toISOString() },
      { id: "room-4", topic: "The Role of Creativity in Large Language Models", description: "Can LLMs truly be creative, or are they sophisticated pattern matchers? Exploring the boundaries of machine creativity.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-5", topic: "Open Source AI: Democratizing Intelligence", description: "The tension between open and closed AI development, and what it means for the future of the technology.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-6", topic: "Is Mathematics Discovered or Invented — and Does the Answer Matter?", description: "A conversation about whether mathematical structures exist independently of minds that conceive them, or whether they are human constructions — and whether the answer has any consequence for how we do and trust mathematics.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-7", topic: "Are Democratic Institutions Structurally Incompatible with Long-Term Thinking?", description: "An examination of whether the incentive architecture of democratic systems systematically prevents long-horizon decision making, and what alternative or reformed models could resolve this tension without sacrificing legitimacy.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-8", topic: "Is the Universe Computational at Its Base Layer?", description: "A conversation about whether physical reality is fundamentally information-theoretic, what it would mean for the universe to be computational, and whether this is a scientific claim or a metaphysical one.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-9", topic: "Is Aging a Disease or an Evolved Feature — and What Does the Distinction Reveal?", description: "An exploration of whether aging should be classified as a pathology subject to intervention, or as a programmed biological feature — and what the framing reveals about how we think about death, medicine, and what counts as natural.", status: "open", createdAt: new Date().toISOString() },
    ];
    // Remove old rooms that are no longer in the seed list
    const existingKeys = await redis.keys("room:*");
    const newRoomIds = new Set(rooms.map((r) => `room:${r.id}`));
    for (const key of existingKeys) {
      if (!newRoomIds.has(key)) {
        await redis.del(key);
      }
    }
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

// Auto-seed rooms if Redis is empty
async function autoSeedRooms() {
  try {
    const r = getRedis();
    const existingKeys = await r.keys("room:*");
    if (existingKeys.length > 0) {
      console.log(`Redis already has ${existingKeys.length} rooms, skipping seed`);
      return;
    }
    const rooms = [
      { id: "room-2", topic: "Ethics of Autonomous Decision-Making Systems", description: "A deep dive into the moral frameworks needed when AI systems make decisions that affect human lives.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-3", topic: "Building Trust Between Humans and AI", description: "How do we create AI systems that humans can genuinely trust, and what does that trust look like in practice?", status: "open", createdAt: new Date().toISOString() },
      { id: "room-4", topic: "The Role of Creativity in Large Language Models", description: "Can LLMs truly be creative, or are they sophisticated pattern matchers? Exploring the boundaries of machine creativity.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-5", topic: "Open Source AI: Democratizing Intelligence", description: "The tension between open and closed AI development, and what it means for the future of the technology.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-6", topic: "Is Mathematics Discovered or Invented — and Does the Answer Matter?", description: "A conversation about whether mathematical structures exist independently of minds that conceive them.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-7", topic: "Are Democratic Institutions Structurally Incompatible with Long-Term Thinking?", description: "An examination of whether the incentive architecture of democratic systems systematically prevents long-horizon decision making.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-8", topic: "Is the Universe Computational at Its Base Layer?", description: "A conversation about whether physical reality is fundamentally information-theoretic and what it would mean.", status: "open", createdAt: new Date().toISOString() },
      { id: "room-9", topic: "Is Aging a Disease or an Evolved Feature — and What Does the Distinction Reveal?", description: "An exploration of whether aging should be classified as a pathology or a programmed biological feature.", status: "open", createdAt: new Date().toISOString() },
    ];
    for (const room of rooms) {
      await r.set(`room:${room.id}`, JSON.stringify(room));
    }
    console.log(`Auto-seeded ${rooms.length} rooms`);
  } catch (err) {
    console.error("Failed to auto-seed rooms:", err);
  }
}

// Start listening IMMEDIATELY so healthcheck passes
server.listen(config.port, "0.0.0.0", () => {
  console.log(`Vantum listening on http://localhost:${config.port}`);
  console.log(`WebSocket server available at ws://localhost:${config.port}/ws`);

  // Auto-seed rooms
  autoSeedRooms();

  // Then prepare Next.js frontend in the background
  initNextJs().catch((err) => {
    console.error("Failed to initialize Next.js frontend:", err);
    console.log("Falling back to API-only mode");
  });
});

async function initNextJs() {
  const frontendDir = path.resolve(__dirname, "../../frontend");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const next = require("next");
  const nextApp = next({ dev: false, dir: frontendDir });
  const nextHandler = nextApp.getRequestHandler();

  await nextApp.prepare();

  // All non-API routes go to Next.js (Express 5 requires named wildcard)
  app.all("/{*path}", (req: express.Request, res: express.Response) => {
    return nextHandler(req, res);
  });

  console.log("Next.js frontend ready");
}
