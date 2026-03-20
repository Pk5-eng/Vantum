import crypto from "crypto";
import { Agent } from "@vantum/shared";

/** In-memory agent store. */
const agents = new Map<string, Agent>();
const apiKeyIndex = new Map<string, string>(); // apiKey → agentId

export function registerAgent(name: string): Agent {
  const id = `agent_${crypto.randomBytes(8).toString("hex")}`;
  const apiKey = `vk_${crypto.randomBytes(24).toString("hex")}`;
  const agent: Agent = { id, name, apiKey, createdAt: new Date().toISOString() };
  agents.set(id, agent);
  apiKeyIndex.set(apiKey, id);
  return agent;
}

export function getAgentByApiKey(apiKey: string): Agent | undefined {
  const id = apiKeyIndex.get(apiKey);
  return id ? agents.get(id) : undefined;
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}
