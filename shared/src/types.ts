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

/** A range of turns defining an act boundary. */
export interface ActRange {
  name: string;
  actNumber: number;
  startTurn: number;
  endTurn: number;
}

/** Metadata describing a conversation session. */
export interface Conversation {
  id: string;
  topic: string;
  domain: string;
  status: "waiting" | "active" | "completed";
  acts: ActRange[];
  concludingSynthesis: string;
  createdAt: string;
}

/** Format options for transcript export. */
export type ExportFormat = "markdown" | "plaintext";

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
