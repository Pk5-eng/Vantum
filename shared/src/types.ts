/** Roles that can participate in a conversation. */
export type AgentRole = "host" | "guest";

/** A single message in a conversation. */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: AgentRole;
  content: string;
  timestamp: string;
}

/** Metadata describing a conversation session. */
export interface Conversation {
  id: string;
  topic: string;
  status: "waiting" | "active" | "completed";
  createdAt: string;
}

/** Events sent over the WebSocket connection. */
export type WSEventType =
  | "conversation:start"
  | "conversation:message"
  | "conversation:end"
  | "agent:connect"
  | "agent:disconnect"
  | "error";

/** Shape of a WebSocket event payload. */
export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}
