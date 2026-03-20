import crypto from "crypto";
import { Conversation, ConversationMessage } from "@vantum/shared";

const HOST_SYSTEM_PROMPT = `You are the host agent for a Vantum conversation. Your role is to guide a structured dialogue on the assigned topic, ask thoughtful questions, and keep the conversation productive.

Guidelines:
- Stay on topic
- Ask open-ended questions to draw out the guest agent's perspective
- Summarize key points periodically
- Keep responses concise and focused (2-4 sentences per turn)`;

/** Maximum conversation turns (host + guest messages). */
const MAX_TURNS = 10;
const EVASION_LIMIT = 3;

export interface OrchestrationCallbacks {
  onHostMessage: (conversationId: string, message: ConversationMessage) => void;
  onConversationEnd: (conversationId: string, reason: string, synthesis?: string) => void;
  onError: (conversationId: string, error: string) => void;
}

interface ConversationState {
  conversation: Conversation;
  evasionCount: number;
  turnCount: number;
  waitingForGuest: boolean;
  guestResponseResolve: ((content: string) => void) | null;
  guestResponseReject: ((err: Error) => void) | null;
  concluded: boolean;
}

type LLMProvider = (
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
) => Promise<string>;

export class Orchestrator {
  private conversations = new Map<string, ConversationState>();
  private callbacks: OrchestrationCallbacks;
  private llm: LLMProvider;

  constructor(callbacks: OrchestrationCallbacks, llm?: LLMProvider) {
    this.callbacks = callbacks;
    this.llm = llm ?? Orchestrator.defaultLLM();
  }

  /** Default LLM using Anthropic SDK, with mock fallback. */
  private static defaultLLM(): LLMProvider {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Anthropic = require("@anthropic-ai/sdk").default;
      const client = new Anthropic({ apiKey });
      return async (systemPrompt, messages) => {
        const resp = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: systemPrompt,
          messages,
        });
        const block = resp.content[0];
        return block.type === "text" ? block.text : "";
      };
    }
    // Mock LLM for testing without API key
    console.log("[orchestrator] No ANTHROPIC_API_KEY — using mock host LLM");
    return async (_sys, messages) => {
      // No messages yet = opening
      if (messages.length === 0) {
        return "Welcome to Vantum! Today we're exploring an exciting topic. To start, could you introduce yourself and share your perspective on this subject?";
      }
      const lastGuest = messages.filter((m) => m.role === "user").pop();
      const guestContent = lastGuest?.content || "";
      // System asking for concluding synthesis
      if (guestContent.includes("[System: Please provide a concluding synthesis")) {
        return "To summarize our conversation: we explored how AI agents are reshaping software development through collaborative partnerships, discussed the practical implications of agent-driven workflows, examined the power of composable agent protocols, and acknowledged the risks that require guardrails. The future lies in human-AI collaboration with transparency at its core. Thank you for this insightful discussion!";
      }
      // Timeout nudge
      if (guestContent.includes("[The guest did not respond in time]")) {
        return "It seems we may have lost our guest for a moment. Let me rephrase — what's your take on the current state of AI agent development?";
      }
      // Normal follow-up
      const snippet = guestContent.slice(0, 50);
      return `That's a fascinating point about "${snippet}..." — let me follow up: what do you see as the biggest challenge or risk in this space?`;
    };
  }

  /** Start a new conversation. Returns the conversation object. */
  async startConversation(topic: string, guestAgentId: string): Promise<Conversation> {
    const id = `conv_${crypto.randomBytes(8).toString("hex")}`;
    const conversation: Conversation = {
      id,
      topic,
      status: "active",
      guestAgentId,
      messages: [],
      createdAt: new Date().toISOString(),
    };
    const state: ConversationState = {
      conversation,
      evasionCount: 0,
      turnCount: 0,
      waitingForGuest: false,
      guestResponseResolve: null,
      guestResponseReject: null,
      concluded: false,
    };
    this.conversations.set(id, state);

    // Run the conversation loop in background
    this.runConversation(state).catch((err) => {
      console.error(`[orchestrator] conversation ${id} error:`, err);
      this.callbacks.onError(id, String(err));
    });

    return conversation;
  }

  /** Called when the guest agent sends a response. */
  receiveGuestResponse(conversationId: string, content: string): boolean {
    const state = this.conversations.get(conversationId);
    if (!state || !state.waitingForGuest || state.concluded) return false;
    if (state.guestResponseResolve) {
      state.guestResponseResolve(content);
      state.guestResponseResolve = null;
      state.guestResponseReject = null;
    }
    return true;
  }

  /** Handle guest disconnect — give reconnect window then conclude. */
  handleGuestDisconnect(conversationId: string, reconnectWindowMs = 30_000): void {
    const state = this.conversations.get(conversationId);
    if (!state || state.concluded) return;
    console.log(`[orchestrator] Guest disconnected from ${conversationId}, waiting ${reconnectWindowMs}ms for reconnect`);
    setTimeout(() => {
      const s = this.conversations.get(conversationId);
      if (s && !s.concluded && s.waitingForGuest) {
        console.log(`[orchestrator] No reconnect for ${conversationId}, concluding`);
        if (s.guestResponseReject) {
          s.guestResponseReject(new Error("guest_disconnected"));
          s.guestResponseResolve = null;
          s.guestResponseReject = null;
        }
      }
    }, reconnectWindowMs);
  }

  /** Check if a conversation exists and is active. */
  isActive(conversationId: string): boolean {
    const s = this.conversations.get(conversationId);
    return !!s && !s.concluded;
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this.conversations.get(conversationId)?.conversation;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async runConversation(state: ConversationState): Promise<void> {
    const { conversation } = state;
    const llmMessages: { role: "user" | "assistant"; content: string }[] = [];
    const systemPrompt = `${HOST_SYSTEM_PROMPT}\n\nToday's topic: ${conversation.topic}`;

    // Brief delay so the WS server can send conversation_start to guest first
    await this.delay(500);

    // Host opening message
    const opening = await this.llm(systemPrompt, llmMessages);
    const openingMsg = this.addMessage(state, "host", opening);
    llmMessages.push({ role: "assistant", content: opening });
    this.callbacks.onHostMessage(conversation.id, openingMsg);

    // Turn loop
    while (state.turnCount < MAX_TURNS && state.evasionCount < EVASION_LIMIT && !state.concluded) {
      // Wait for guest response
      let guestContent: string;
      try {
        guestContent = await this.waitForGuest(state, 60_000);
      } catch {
        // Timeout or disconnect
        if (state.concluded) break;
        state.evasionCount++;
        console.log(`[orchestrator] Guest timeout/evasion #${state.evasionCount} in ${conversation.id}`);
        if (state.evasionCount >= EVASION_LIMIT) {
          break; // Will conclude below
        }
        // Generate a prompt nudge from host
        llmMessages.push({ role: "user", content: "[The guest did not respond in time]" });
        const nudge = await this.llm(systemPrompt, llmMessages);
        const nudgeMsg = this.addMessage(state, "host", nudge);
        llmMessages.push({ role: "assistant", content: nudge });
        this.callbacks.onHostMessage(conversation.id, nudgeMsg);
        continue;
      }

      // Validate guest response
      if (!guestContent || guestContent.trim().length === 0) {
        state.evasionCount++;
        console.log(`[orchestrator] Malformed/empty guest message in ${conversation.id}`);
        continue;
      }

      // Record guest message
      const guestMsg = this.addMessage(state, "guest", guestContent);
      llmMessages.push({ role: "user", content: guestContent });
      // Broadcast guest message via the same callback pattern
      this.callbacks.onHostMessage(conversation.id, guestMsg);
      state.turnCount++;

      // Check if we should end
      if (state.turnCount >= MAX_TURNS / 2) {
        // Let orchestrator decide — for now, end after MAX_TURNS/2 full exchanges
        if (state.turnCount >= MAX_TURNS / 2) {
          // Generate concluding synthesis
          llmMessages.push({
            role: "user",
            content: "[System: Please provide a concluding synthesis of this conversation]",
          });
          const synthesis = await this.llm(systemPrompt, llmMessages);
          const synthMsg = this.addMessage(state, "host", synthesis);
          this.callbacks.onHostMessage(conversation.id, synthMsg);
          state.concluded = true;
          conversation.status = "completed";
          this.callbacks.onConversationEnd(conversation.id, "completed", synthesis);
          return;
        }
      }

      // Host generates next turn
      const hostReply = await this.llm(systemPrompt, llmMessages);
      const hostMsg = this.addMessage(state, "host", hostReply);
      llmMessages.push({ role: "assistant", content: hostReply });
      this.callbacks.onHostMessage(conversation.id, hostMsg);
    }

    // Conclude
    if (!state.concluded) {
      state.concluded = true;
      conversation.status = "completed";
      const reason =
        state.evasionCount >= EVASION_LIMIT
          ? "Guest agent exceeded evasion limit"
          : "Maximum turns reached";
      this.callbacks.onConversationEnd(conversation.id, reason);
    }
  }

  private waitForGuest(state: ConversationState, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      state.waitingForGuest = true;
      state.guestResponseResolve = resolve;
      state.guestResponseReject = reject;

      setTimeout(() => {
        if (state.waitingForGuest && state.guestResponseResolve) {
          state.waitingForGuest = false;
          state.guestResponseResolve = null;
          const rej = state.guestResponseReject;
          state.guestResponseReject = null;
          rej?.(new Error("timeout"));
        }
      }, timeoutMs);
    }).finally(() => {
      state.waitingForGuest = false;
    });
  }

  private addMessage(
    state: ConversationState,
    role: "host" | "guest",
    content: string
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: `msg_${crypto.randomBytes(6).toString("hex")}`,
      conversationId: state.conversation.id,
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    state.conversation.messages.push(msg);
    return msg;
  }
}
