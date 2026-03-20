import crypto from "crypto";
import { AgentRecord } from "@vantum/shared";

/** In-memory agent store. Replace with Redis/DB in production. */
const agents = new Map<string, AgentRecord>();
const apiKeyIndex = new Map<string, string>(); // apiKey -> agentId

export function registerAgent(name: string): AgentRecord {
  const id = crypto.randomUUID();
  const apiKey = `vantum_${crypto.randomBytes(24).toString("hex")}`;
  const record: AgentRecord = {
    id,
    name,
    apiKey,
    createdAt: new Date().toISOString(),
  };
  agents.set(id, record);
  apiKeyIndex.set(apiKey, id);
  return record;
}

export function getAgentByApiKey(apiKey: string): AgentRecord | undefined {
  const id = apiKeyIndex.get(apiKey);
  return id ? agents.get(id) : undefined;
}

export function getAgent(id: string): AgentRecord | undefined {
  return agents.get(id);
}
