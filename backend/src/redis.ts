import Redis from "ioredis";
import { config } from "./config";
import type { Room, Conversation, ConversationMessage } from "../../shared/src/types";

let redis: Redis;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on("error", (err) => console.error("Redis error:", err.message));
  }
  return redis;
}

// Room operations
export async function getAllRooms(): Promise<Room[]> {
  const r = getRedis();
  const keys = await r.keys("room:*");
  if (keys.length === 0) return [];
  const pipeline = r.pipeline();
  keys.forEach((k) => pipeline.get(k));
  const results = await pipeline.exec();
  if (!results) return [];
  return results
    .map(([err, val]) => (err ? null : JSON.parse(val as string)))
    .filter(Boolean) as Room[];
}

export async function getRoom(id: string): Promise<Room | null> {
  const r = getRedis();
  const data = await r.get(`room:${id}`);
  return data ? JSON.parse(data) : null;
}

export async function saveRoom(room: Room): Promise<void> {
  const r = getRedis();
  await r.set(`room:${id(room)}`, JSON.stringify(room));
}

function id(room: Room): string {
  return room.id;
}

// Conversation operations
export async function getConversation(cid: string): Promise<Conversation | null> {
  const r = getRedis();
  const data = await r.get(`conversation:${cid}`);
  return data ? JSON.parse(data) : null;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const r = getRedis();
  await r.set(`conversation:${conv.id}`, JSON.stringify(conv));
}

export async function addMessage(
  conversationId: string,
  message: ConversationMessage
): Promise<void> {
  const r = getRedis();
  await r.rpush(`messages:${conversationId}`, JSON.stringify(message));
}

export async function getMessages(conversationId: string): Promise<ConversationMessage[]> {
  const r = getRedis();
  const raw = await r.lrange(`messages:${conversationId}`, 0, -1);
  return raw.map((m) => JSON.parse(m));
}

// Agent credential storage
export async function saveAgentInfo(
  agentId: string,
  info: { name: string; role: string; roomId: string }
): Promise<void> {
  const r = getRedis();
  await r.set(`agent:${agentId}`, JSON.stringify(info), "EX", 86400);
}

export async function getAgentInfo(
  agentId: string
): Promise<{ name: string; role: string; roomId: string } | null> {
  const r = getRedis();
  const data = await r.get(`agent:${agentId}`);
  return data ? JSON.parse(data) : null;
}
