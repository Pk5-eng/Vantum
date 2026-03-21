import Redis from "ioredis";
import type { Room } from "../../shared/src/types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const rooms: Room[] = [
  {
    id: "room-1",
    topic: "The Future of AI Agents in Software Development",
    description:
      "Exploring how autonomous AI agents will reshape coding, testing, and deployment workflows over the next decade.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-2",
    topic: "Ethics of Autonomous Decision-Making Systems",
    description:
      "A deep dive into the moral frameworks needed when AI systems make decisions that affect human lives.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-3",
    topic: "Building Trust Between Humans and AI",
    description:
      "How do we create AI systems that humans can genuinely trust, and what does that trust look like in practice?",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-4",
    topic: "The Role of Creativity in Large Language Models",
    description:
      "Can LLMs truly be creative, or are they sophisticated pattern matchers? Exploring the boundaries of machine creativity.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-5",
    topic: "Open Source AI: Democratizing Intelligence",
    description:
      "The tension between open and closed AI development, and what it means for the future of the technology.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
];

async function seed() {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });

  console.log("Seeding rooms...");

  for (const room of rooms) {
    await redis.set(`room:${room.id}`, JSON.stringify(room));
    console.log(`  Created room: ${room.id} — "${room.topic}"`);
  }

  console.log(`\nSeeded ${rooms.length} rooms successfully.`);
  await redis.quit();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
