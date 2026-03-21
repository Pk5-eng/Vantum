import type { Conversation, ConversationMessage } from "@vantum/shared";

/** In-memory store for conversations and messages. */
const conversations = new Map<string, Conversation>();
const messages = new Map<string, ConversationMessage[]>();

export function getConversation(id: string): Conversation | undefined {
  return conversations.get(id);
}

export function getMessages(conversationId: string): ConversationMessage[] {
  return messages.get(conversationId) ?? [];
}

export function setConversation(conv: Conversation): void {
  conversations.set(conv.id, conv);
}

export function addMessage(msg: ConversationMessage): void {
  const existing = messages.get(msg.conversationId) ?? [];
  existing.push(msg);
  messages.set(msg.conversationId, existing);
}

export function getAllConversations(): Conversation[] {
  return Array.from(conversations.values());
}

/** Seed sample data for development / testing. */
export function seedSampleData(): void {
  const convId = "conv-sample-001";

  const conversation: Conversation = {
    id: convId,
    topic: "The Future of AI-Assisted Software Development",
    domain: "Technology",
    status: "completed",
    acts: [
      { name: "Calibration", actNumber: 1, startTurn: 1, endTurn: 3 },
      { name: "Depth Navigation", actNumber: 2, startTurn: 4, endTurn: 7 },
      { name: "Boundary Exploration", actNumber: 3, startTurn: 8, endTurn: 10 },
    ],
    concludingSynthesis:
      "Today we explored how AI-assisted development is reshaping the software engineering landscape. " +
      "We discussed the shift from AI as autocomplete to AI as a collaborative partner, examined the " +
      "implications for developer skill development, and probed the boundaries where human judgment " +
      "remains irreplaceable. The guest offered a compelling vision of augmented engineering — where " +
      "AI handles routine complexity while humans focus on architecture, ethics, and user empathy.",
    createdAt: "2026-03-21T10:00:00Z",
  };

  const sampleMessages: ConversationMessage[] = [
    {
      id: "msg-001",
      conversationId: convId,
      role: "host",
      content:
        "Welcome to Vantum. Today we're exploring the future of AI-assisted software development. " +
        "To start, I'd love to understand your current experience — how has AI tooling changed your " +
        "day-to-day workflow as a developer?",
      timestamp: "2026-03-21T10:01:00Z",
    },
    {
      id: "msg-002",
      conversationId: convId,
      role: "guest",
      content:
        "Thanks for having me. The shift has been dramatic. Two years ago, AI assistance was mostly " +
        "autocomplete — suggesting the next line of code. Now it's become a genuine collaborator. " +
        "I find myself describing intent at a higher level and iterating on architecture rather than syntax.",
      timestamp: "2026-03-21T10:02:00Z",
    },
    {
      id: "msg-003",
      conversationId: convId,
      role: "host",
      content:
        "That's a significant shift in abstraction level. When you say you're working at the " +
        "architecture level now, does that mean the nature of developer expertise is changing? " +
        "What skills matter more — or less — than they did before?",
      timestamp: "2026-03-21T10:03:00Z",
    },
    {
      id: "msg-004",
      conversationId: convId,
      role: "guest",
      content:
        "Absolutely. Pattern recognition in code is less valuable when AI handles it. What matters " +
        "more now is system thinking — understanding how components interact, anticipating failure " +
        "modes, and making tradeoff decisions that require context AI doesn't have. The skill " +
        "floor has risen, but the ceiling has gone higher too.",
      timestamp: "2026-03-21T10:04:00Z",
    },
    {
      id: "msg-005",
      conversationId: convId,
      role: "host",
      content:
        "Interesting framing — the floor rising while the ceiling goes higher. Let's dig into " +
        "that. For developers early in their career, is there a risk that AI assistance prevents " +
        "them from building foundational understanding?",
      timestamp: "2026-03-21T10:05:00Z",
    },
    {
      id: "msg-006",
      conversationId: convId,
      role: "guest",
      content:
        "It's a real concern. There's a difference between using AI to accelerate learning and " +
        "using it to bypass learning. The best junior developers I've seen use AI as a tutor — " +
        "asking it to explain generated code, challenging its suggestions. The risk is when " +
        "developers accept output without understanding it.",
      timestamp: "2026-03-21T10:06:00Z",
    },
    {
      id: "msg-007",
      conversationId: convId,
      role: "host",
      content:
        "So the developer's relationship with AI tooling becomes a metacognitive skill in itself. " +
        "Let me push toward a boundary: are there categories of software decisions where you believe " +
        "AI should explicitly not be the decision-maker?",
      timestamp: "2026-03-21T10:07:00Z",
    },
    {
      id: "msg-008",
      conversationId: convId,
      role: "guest",
      content:
        "Yes — anything involving ethical tradeoffs, user privacy boundaries, and accessibility " +
        "requirements. AI can surface options and implications, but the value judgments need to " +
        "stay human. Security-critical decisions too — AI can audit, but humans must own the " +
        "threat model and accept the residual risk.",
      timestamp: "2026-03-21T10:08:00Z",
    },
    {
      id: "msg-009",
      conversationId: convId,
      role: "host",
      content:
        "That's a clear delineation. As we wrap up, I'm curious about your vision five years out. " +
        "What does the ideal human-AI development partnership look like?",
      timestamp: "2026-03-21T10:09:00Z",
    },
    {
      id: "msg-010",
      conversationId: convId,
      role: "guest",
      content:
        "I see augmented engineering — where AI handles routine complexity, boilerplate, and " +
        "consistency checks, freeing developers to focus on what humans do best: creative " +
        "architecture, empathetic design, and the judgment calls that require understanding " +
        "real-world context. The best code will come from partnerships, not replacements.",
      timestamp: "2026-03-21T10:10:00Z",
    },
  ];

  setConversation(conversation);
  for (const msg of sampleMessages) {
    addMessage(msg);
  }
}
