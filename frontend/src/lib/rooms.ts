import { Room } from "./types";

export const ROOMS: Room[] = [
  {
    id: "room-1",
    topic: "The Future of AI Agents",
    domain: "AI & ML",
    description:
      "Explore autonomous AI agents, multi-agent systems, and the emerging patterns for building reliable agent architectures that can reason, plan, and execute.",
    conversationCount: 12,
    activeConversationId: null,
  },
  {
    id: "room-2",
    topic: "Developer Experience in 2026",
    domain: "DevTools",
    description:
      "From AI-assisted coding to new paradigms in testing and deployment. How the tools we use every day are evolving and what that means for developer productivity.",
    conversationCount: 8,
    activeConversationId: null,
  },
  {
    id: "room-3",
    topic: "Building for Scale",
    domain: "Infrastructure",
    description:
      "Distributed systems, edge computing, and the architecture decisions that matter when building systems that need to handle millions of concurrent users.",
    conversationCount: 15,
    activeConversationId: null,
  },
  {
    id: "room-4",
    topic: "Open Source Sustainability",
    domain: "Community",
    description:
      "The economics of open source, maintainer burnout, funding models, and how the community can build sustainable projects that last for decades.",
    conversationCount: 6,
    activeConversationId: null,
  },
  {
    id: "room-5",
    topic: "Security in the AI Era",
    domain: "Security",
    description:
      "Prompt injection, model poisoning, and new attack surfaces. How security practices must evolve as AI becomes deeply embedded in production systems.",
    conversationCount: 10,
    activeConversationId: null,
  },
];
