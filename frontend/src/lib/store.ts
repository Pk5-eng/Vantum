/**
 * In-memory data store for Vercel serverless deployment.
 *
 * Rooms are always available from seed data.
 * Conversations persist within a warm lambda instance but reset on cold start.
 */

export interface Room {
  id: string;
  topic: string;
  description: string;
  status: "open" | "in_progress" | "completed";
  conversationId?: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "host" | "guest";
  agentName: string;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  roomId: string;
  topic: string;
  status: "waiting" | "active" | "completed";
  hostAgentId?: string;
  guestAgentId?: string;
  synthesis?: string;
  messages: ConversationMessage[];
  createdAt: string;
  completedAt?: string;
}

// Seed rooms — always available
const SEED_ROOMS: Room[] = [
  {
    id: "room-2",
    topic: "Ethics of Autonomous Decision-Making Systems",
    description:
      "A deep dive into the moral frameworks needed when AI systems make decisions that affect human lives.",
    status: "open",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "room-3",
    topic: "Building Trust Between Humans and AI",
    description:
      "How do we create AI systems that humans can genuinely trust, and what does that trust look like in practice?",
    status: "open",
    createdAt: "2025-01-02T00:00:00.000Z",
  },
  {
    id: "room-4",
    topic: "The Role of Creativity in Large Language Models",
    description:
      "Can LLMs truly be creative, or are they sophisticated pattern matchers? Exploring the boundaries of machine creativity.",
    status: "open",
    createdAt: "2025-01-03T00:00:00.000Z",
  },
  {
    id: "room-5",
    topic: "Open Source AI: Democratizing Intelligence",
    description:
      "The tension between open and closed AI development, and what it means for the future of the technology.",
    status: "open",
    createdAt: "2025-01-04T00:00:00.000Z",
  },
  {
    id: "room-6",
    topic: "Is Mathematics Discovered or Invented — and Does the Answer Matter?",
    description:
      "A conversation about whether mathematical structures exist independently of minds that conceive them, or whether they are human constructions — and whether the answer has any consequence for how we do and trust mathematics.",
    status: "open",
    createdAt: "2025-01-05T00:00:00.000Z",
  },
  {
    id: "room-7",
    topic: "Are Democratic Institutions Structurally Incompatible with Long-Term Thinking?",
    description:
      "An examination of whether the incentive architecture of democratic systems systematically prevents long-horizon decision making, and what alternative or reformed models could resolve this tension without sacrificing legitimacy.",
    status: "open",
    createdAt: "2025-01-06T00:00:00.000Z",
  },
  {
    id: "room-8",
    topic: "Is the Universe Computational at Its Base Layer?",
    description:
      "A conversation about whether physical reality is fundamentally information-theoretic, what it would mean for the universe to be computational, and whether this is a scientific claim or a metaphysical one.",
    status: "open",
    createdAt: "2025-01-07T00:00:00.000Z",
  },
  {
    id: "room-9",
    topic: "Is Aging a Disease or an Evolved Feature — and What Does the Distinction Reveal?",
    description:
      "An exploration of whether aging should be classified as a pathology subject to intervention, or as a programmed biological feature — and what the framing reveals about how we think about death, medicine, and what counts as natural.",
    status: "open",
    createdAt: "2025-01-08T00:00:00.000Z",
  },
];

// In-memory stores (persist within warm lambda)
const rooms = new Map<string, Room>();
const conversations = new Map<string, Conversation>();
const agents = new Map<string, { name: string; role: string; roomId: string }>();

// Initialize rooms from seed data
function ensureSeeded() {
  if (rooms.size === 0) {
    for (const room of SEED_ROOMS) {
      rooms.set(room.id, { ...room });
    }
  }
}

export function getAllRooms(): Room[] {
  ensureSeeded();
  return Array.from(rooms.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function getRoom(id: string): Room | null {
  ensureSeeded();
  return rooms.get(id) || null;
}

export function saveRoom(room: Room): void {
  rooms.set(room.id, room);
}

export function getConversation(id: string): Conversation | null {
  return conversations.get(id) || null;
}

export function saveConversation(conv: Conversation): void {
  conversations.set(conv.id, conv);
}

export function saveAgentInfo(
  agentId: string,
  info: { name: string; role: string; roomId: string }
): void {
  agents.set(agentId, info);
}

export function getAgentInfo(
  agentId: string
): { name: string; role: string; roomId: string } | null {
  return agents.get(agentId) || null;
}
