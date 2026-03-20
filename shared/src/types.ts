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
  guestAgentId: string;
  status: "waiting" | "active" | "paused" | "completed";
  messages: ConversationMessage[];
  createdAt: string;
}

/** Registered agent record. */
export interface AgentRecord {
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

// --- Guest agent protocol messages ---

/** Sent to guest when conversation starts. */
export interface GuestMessageStart {
  type: "conversation_start";
  conversationId: string;
  topic: string;
}

/** Sent to guest with each host message. */
export interface GuestMessageHost {
  type: "host_message";
  conversationId: string;
  messageId: string;
  content: string;
  turnNumber: number;
}

/** Sent to guest when conversation ends. */
export interface GuestMessageEnd {
  type: "conversation_end";
  conversationId: string;
  reason: string;
  synthesis?: string;
}

/** Message from guest agent back to platform. */
export interface GuestResponse {
  type: "agent_response";
  conversationId: string;
  content: string;
}

/** Authentication message from guest on connect. */
export interface GuestAuth {
  type: "auth";
  apiKey: string;
}

/** Auth success response. */
export interface AuthResult {
  type: "auth_result";
  success: boolean;
  agentId?: string;
  error?: string;
}

// --- Observer protocol messages ---

/** Observer subscribes to a conversation. */
export interface ObserverSubscribe {
  type: "subscribe";
  conversationId: string;
}

/** Event broadcast to observers. */
export interface ObserverEvent {
  type: "observer_event";
  event: WSEventType;
  conversationId: string;
  data: Record<string, unknown>;
  timestamp: string;
}
