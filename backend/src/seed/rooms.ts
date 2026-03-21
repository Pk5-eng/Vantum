import crypto from "crypto";
import Redis from "ioredis";
import type { Room } from "@vantum/shared";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ROOMS_KEY = "rooms";

function roomKey(id: string): string {
  return `room:${id}`;
}

function makeRoom(fields: Omit<Room, "id" | "status" | "createdAt">): Room {
  return {
    id: crypto.randomUUID(),
    status: "waiting",
    createdAt: new Date().toISOString(),
    ...fields,
  };
}

const seedRooms: Room[] = [
  makeRoom({
    topic: "The limits of large language model reasoning",
    domain: "Artificial Intelligence",
    description:
      "An exploration of where LLM reasoning succeeds, where it fails, and what those boundaries reveal about the nature of machine intelligence.",
    adjacentDomains: ["Philosophy of mind", "Cognitive science", "Mathematics"],
  }),
  makeRoom({
    topic: "Quantum computing's path to practical advantage",
    domain: "Physics and Computing",
    description:
      "A conversation about the current state of quantum computing, the gap between theoretical and practical advantage, and what genuine progress looks like.",
    adjacentDomains: ["Materials science", "Cryptography", "Complexity theory"],
  }),
  makeRoom({
    topic: "How energy infrastructure constrains AI progress",
    domain: "Energy and Systems",
    description:
      "An examination of the physical and infrastructural limits that determine how far and how fast AI can scale.",
    adjacentDomains: ["Economics", "Electrical engineering", "Climate science"],
  }),
  makeRoom({
    topic: "The epistemology of scientific consensus",
    domain: "Philosophy of Science",
    description:
      "A conversation about how scientific consensus forms, when it should be trusted, when it should be questioned, and what distinguishes good from bad scientific reasoning.",
    adjacentDomains: ["History of science", "Sociology", "Statistics"],
  }),
  makeRoom({
    topic: "Emergence in complex systems",
    domain: "Systems Theory",
    description:
      "An exploration of how complex behavior arises from simple rules, what emergence means rigorously, and where the concept breaks down.",
    adjacentDomains: ["Biology", "Economics", "Physics"],
  }),
];

async function seed(): Promise<void> {
  const redis = new Redis(REDIS_URL);

  try {
    // Clear any existing room data
    const existingIds = await redis.smembers(ROOMS_KEY);
    if (existingIds.length > 0) {
      const pipeline = redis.pipeline();
      for (const id of existingIds) {
        pipeline.del(roomKey(id));
      }
      pipeline.del(ROOMS_KEY);
      await pipeline.exec();
      console.log(`Cleared ${existingIds.length} existing room(s).`);
    }

    // Insert seed rooms
    const pipeline = redis.pipeline();
    for (const room of seedRooms) {
      pipeline.set(roomKey(room.id), JSON.stringify(room));
      pipeline.sadd(ROOMS_KEY, room.id);
    }
    await pipeline.exec();
    console.log(`Seeded ${seedRooms.length} rooms.\n`);

    // Verify all rooms are stored and retrievable
    const storedIds = await redis.smembers(ROOMS_KEY);
    console.log(`Verification: ${storedIds.length} room(s) in index.\n`);

    for (const id of storedIds) {
      const raw = await redis.get(roomKey(id));
      if (!raw) {
        throw new Error(`Room ${id} missing from store`);
      }
      const room: Room = JSON.parse(raw);
      console.log(`  [${room.domain}] ${room.topic}`);
      console.log(`    ID: ${room.id}`);
      console.log(`    Status: ${room.status}`);
      console.log(`    Adjacent: ${room.adjacentDomains.join(", ")}`);
      console.log();
    }

    console.log("All rooms seeded and verified successfully.");
  } finally {
    await redis.quit();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
