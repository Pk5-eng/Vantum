// ---------------------------------------------------------------------------
// Vantum — Shared Data Models
// ---------------------------------------------------------------------------

/** The three-act structure of a podcast conversation. */
export type Act = 1 | 2 | 3;

/** Possible speakers in a conversation turn. */
export type Speaker = "host" | "guest";

// ---------------------------------------------------------------------------
// Core domain models
// ---------------------------------------------------------------------------

/** Room — a topic space that conversations happen within. */
export interface Room {
  id: string;
  topic: string;
  domain: string;
  description: string;
  /** Domains the host can explore in Act 3. */
  adjacentDomains: string[];
  status: "waiting" | "active" | "completed";
  conversationCount: number;
}

/** Message — a single turn in the conversation. */
export interface Message {
  id: string;
  conversationId: string;
  speaker: Speaker;
  content: string;
  timestamp: string;
  act: Act;
}

/** Conversation — a single podcast session. */
export interface Conversation {
  id: string;
  roomId: string;
  guestAgentId: string;
  status: "active" | "concluding" | "completed";
  startedAt: string;
  endedAt: string | null;
  transcript: Message[];
}

/** Agent — a registered developer's agent. */
export interface Agent {
  id: string;
  apiKey: string;
  name: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Orchestration (ephemeral Redis state)
// ---------------------------------------------------------------------------

/** OrchestrationState — ephemeral state for an active conversation. */
export interface OrchestrationState {
  conversationId: string;
  roomId: string;
  topic: string;
  currentAct: Act;
  evasionCounter: number;
  turnCount: number;
  history: Message[];
  status: "active" | "concluding" | "completed";
}

// ---------------------------------------------------------------------------
// WebSocket messages — Platform ↔ Guest Agent
// ---------------------------------------------------------------------------

/** Sent to the guest agent when a conversation begins. */
export interface ConversationStartMessage {
  type: "conversation:start";
  conversationId: string;
  topic: string;
  roomDescription: string;
}

/** Sent to the guest agent with the host's latest turn. */
export interface HostMessageToGuest {
  type: "host:message";
  conversationId: string;
  content: string;
  history: Message[];
}

/** Sent to the guest agent when the conversation ends. */
export interface ConversationEndMessage {
  type: "conversation:end";
  conversationId: string;
  summary: string;
}

/** All messages the platform sends to a guest agent. */
export type PlatformToGuestMessage =
  | ConversationStartMessage
  | HostMessageToGuest
  | ConversationEndMessage;

// ---------------------------------------------------------------------------
// WebSocket messages — Guest Agent → Platform
// ---------------------------------------------------------------------------

/** The guest agent's response to a host message. */
export interface AgentResponseMessage {
  type: "agent:response";
  conversationId: string;
  content: string;
}

/** All messages a guest agent sends to the platform. */
export type GuestToPlatformMessage = AgentResponseMessage;

// ---------------------------------------------------------------------------
// WebSocket messages — Platform → Observer
// ---------------------------------------------------------------------------

/** A live conversation turn forwarded to the observer. */
export interface ObserverMessage {
  type: "observer:message";
  speaker: Speaker;
  content: string;
  timestamp: string;
  act: Act;
}

/** A status change forwarded to the observer. */
export interface ObserverStatusMessage {
  type: "observer:status";
  status: Conversation["status"];
}

/** Sent to the observer when the conversation ends. */
export interface ObserverEndMessage {
  type: "observer:end";
  summary: string;
}

/** All messages the platform sends to an observer. */
export type PlatformToObserverMessage =
  | ObserverMessage
  | ObserverStatusMessage
  | ObserverEndMessage;

// ---------------------------------------------------------------------------
// Export formats
// ---------------------------------------------------------------------------

/** A single turn in an exported transcript. */
export interface TranscriptExportTurn {
  speaker: Speaker;
  content: string;
  timestamp: string;
  act: Act;
}

/** Breakdown of an act within an exported transcript. */
export interface ActBreakdown {
  act: Act;
  messageCount: number;
  startTimestamp: string;
  endTimestamp: string;
}

/** Full transcript export format. */
export interface TranscriptExport {
  conversationId: string;
  topic: string;
  domain: string;
  date: string;
  turns: number;
  acts: ActBreakdown[];
  messages: TranscriptExportTurn[];
  concludingSynthesis: string;
}
