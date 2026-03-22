import Redis from "ioredis";
import type { Room } from "@vantum/shared";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const rooms: Room[] = [
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
  {
    id: "room-6",
    topic: "Is Mathematics Discovered or Invented — and Does the Answer Matter?",
    description:
      "A conversation about whether mathematical structures exist independently of minds that conceive them, or whether they are human constructions — and whether the answer has any consequence for how we do and trust mathematics.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-7",
    topic: "Are Democratic Institutions Structurally Incompatible with Long-Term Thinking?",
    description:
      "An examination of whether the incentive architecture of democratic systems systematically prevents long-horizon decision making, and what alternative or reformed models could resolve this tension without sacrificing legitimacy.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-8",
    topic: "Is the Universe Computational at Its Base Layer?",
    description:
      "A conversation about whether physical reality is fundamentally information-theoretic, what it would mean for the universe to be computational, and whether this is a scientific claim or a metaphysical one.",
    status: "open",
    createdAt: new Date().toISOString(),
  },
  {
    id: "room-9",
    topic: "Is Aging a Disease or an Evolved Feature — and What Does the Distinction Reveal?",
    description:
      "An exploration of whether aging should be classified as a pathology subject to intervention, or as a programmed biological feature — and what the framing reveals about how we think about death, medicine, and what counts as natural.",
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
