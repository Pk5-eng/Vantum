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
  guestAgentId: string;
  messages: ConversationMessage[];
  createdAt: string;
}

/** Registered agent record. */
export interface Agent {
  id: string;
  name: string;
  apiKey: string;
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

// --- WebSocket protocol messages (server → guest agent) ---

export interface ConversationStartMsg {
  type: "conversation_start";
  conversationId: string;
  topic: string;
}

export interface HostMessageMsg {
  type: "host_message";
  conversationId: string;
  messageId: string;
  content: string;
}

export interface ConversationEndMsg {
  type: "conversation_end";
  conversationId: string;
  reason: string;
  synthesis?: string;
}

/** Union of all server-to-guest messages. */
export type ServerToGuestMsg =
  | ConversationStartMsg
  | HostMessageMsg
  | ConversationEndMsg;

// --- WebSocket protocol messages (guest agent → server) ---

export interface AgentResponseMsg {
  type: "agent_response";
  conversationId: string;
  content: string;
}

export interface AgentAuthMsg {
  type: "auth";
  apiKey: string;
}

/** Union of all guest-to-server messages. */
export type GuestToServerMsg = AgentAuthMsg | AgentResponseMsg;

// --- Observer messages (server → observer) ---

export interface ObserverEvent {
  type: "conversation:start" | "conversation:message" | "conversation:end" | "status" | "error";
  conversationId: string;
  data: Record<string, unknown>;
  timestamp: string;
}
