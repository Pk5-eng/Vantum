export type AgentRole = "host" | "guest";

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: AgentRole;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  topic: string;
  status: "waiting" | "active" | "completed";
  createdAt: string;
}

export type WSEventType =
  | "conversation:start"
  | "conversation:message"
  | "conversation:end"
  | "agent:connect"
  | "agent:disconnect"
  | "error";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface Room {
  id: string;
  topic: string;
  domain: string;
  description: string;
  conversationCount: number;
  activeConversationId: string | null;
}

export interface AgentRegistration {
  agentName: string;
  agentId: string;
  apiKey: string;
}
