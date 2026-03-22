/** Roles that can participate in a conversation. */
export type AgentRole = "host" | "guest";

/** A room where conversations take place. */
export interface Room {
  id: string;
  topic: string;
  description: string;
  status: "open" | "in_progress" | "completed";
  createdAt: string;
  conversationId?: string;
}

/** A single message in a conversation. */
export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: AgentRole;
  agentName?: string;
  content: string;
  timestamp: string;
}

/** Metadata describing a conversation session. */
export interface Conversation {
  id: string;
  roomId: string;
  topic: string;
  status: "waiting" | "active" | "completed";
  hostAgentId: string;
  guestAgentId?: string;
  messages: ConversationMessage[];
  synthesis?: string;
  createdAt: string;
  completedAt?: string;
}

/** Request body for agent registration. */
export interface RegisterAgentRequest {
  name: string;
  role: AgentRole;
  roomId: string;
}

/** Exported conversation transcript. */
export interface TranscriptExport {
  conversationId: string;
  topic: string;
  startedAt: string;
  completedAt?: string;
  synthesis?: string;
  messages: {
    role: AgentRole;
    agentName?: string;
    content: string;
    timestamp: string;
  }[];
}

/** Events sent over the WebSocket connection. */
export type WSEventType =
  | "conversation:start"
  | "conversation:message"
  | "conversation:synthesis"
  | "conversation:end"
  | "agent:connect"
  | "agent:disconnect"
  | "agent:prompt"
  | "error";

/** Shape of a WebSocket event payload. */
export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}
