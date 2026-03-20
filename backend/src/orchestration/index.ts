import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Conversation, ConversationMessage } from "@vantum/shared";
import fs from "fs";
import path from "path";

// Load host system prompt
const HOST_PROMPT_PATH = path.resolve(__dirname, "../../../prompts/host-system.md");
let hostSystemPrompt = "You are the host agent for a Vantum podcast conversation. Guide a structured dialogue on the assigned topic, ask thoughtful questions, and keep the conversation productive.";
try {
  hostSystemPrompt = fs.readFileSync(HOST_PROMPT_PATH, "utf-8");
} catch {
  console.warn("Could not load host system prompt, using default");
}

export interface OrchestrationCallbacks {
  onHostMessage: (conversation: Conversation, message: ConversationMessage) => void;
  onConversationEnd: (conversation: Conversation, reason: string, synthesis?: string) => void;
  onError: (conversation: Conversation, error: string) => void;
}

export interface OrchestrationConfig {
  maxTurns: number;
  responseTimeoutMs: number;
  maxEvasions: number;
  anthropicApiKey?: string;
}

const DEFAULT_CONFIG: OrchestrationConfig = {
  maxTurns: 6,
  responseTimeoutMs: 60_000,
  maxEvasions: 3,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
};

/** Manages a single conversation's lifecycle. */
export class ConversationOrchestrator {
  private conversation: Conversation;
  private callbacks: OrchestrationCallbacks;
  private config: OrchestrationConfig;
  private anthropic: Anthropic | null = null;
  private turnNumber = 0;
  private evasionCount = 0;
  private pendingResponseResolve: ((content: string) => void) | null = null;
  private responseTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    topic: string,
    guestAgentId: string,
    callbacks: OrchestrationCallbacks,
    config?: Partial<OrchestrationConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.conversation = {
      id: crypto.randomUUID(),
      topic,
      guestAgentId,
      status: "waiting",
      messages: [],
      createdAt: new Date().toISOString(),
    };

    if (this.config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: this.config.anthropicApiKey });
    }
  }

  get conversationId(): string {
    return this.conversation.id;
  }

  get state(): Conversation {
    return this.conversation;
  }

  /** Start the conversation loop. */
  async start(): Promise<void> {
    this.running = true;
    this.conversation.status = "active";

    try {
      // Host generates opening message
      const opening = await this.generateHostMessage(
        `Begin a podcast conversation about: "${this.conversation.topic}". Introduce the topic and ask your first question to the guest.`,
      );
      this.emitHostMessage(opening);

      // Turn loop
      while (this.running && this.turnNumber < this.config.maxTurns) {
        const guestContent = await this.waitForGuestResponse();

        if (!this.running) break;

        if (guestContent === null) {
          // Timeout — treat as evasion
          this.evasionCount++;
          if (this.evasionCount >= this.config.maxEvasions) {
            await this.conclude("Guest agent exceeded maximum evasions");
            return;
          }
          const nudge = await this.generateHostMessage(
            "The guest did not respond in time. Acknowledge this briefly and ask your question again or move on.",
          );
          this.emitHostMessage(nudge);
          continue;
        }

        // Record guest message
        this.addMessage("guest", guestContent);

        // Check if we should end
        if (this.turnNumber >= this.config.maxTurns - 1) {
          await this.conclude("Maximum turns reached");
          return;
        }

        // Host responds to guest
        const hostReply = await this.generateHostMessage(
          "Continue the conversation. Respond to what the guest said and ask a follow-up question.",
        );
        this.emitHostMessage(hostReply);
      }

      if (this.running) {
        await this.conclude("Conversation completed");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Orchestration error:", errorMsg);
      this.callbacks.onError(this.conversation, errorMsg);
      await this.conclude(`Error: ${errorMsg}`);
    }
  }

  /** Feed a guest response into the conversation. */
  receiveGuestResponse(content: string): void {
    if (this.pendingResponseResolve) {
      if (this.responseTimer) {
        clearTimeout(this.responseTimer);
        this.responseTimer = null;
      }
      const resolve = this.pendingResponseResolve;
      this.pendingResponseResolve = null;
      resolve(content);
    }
  }

  /** Handle guest disconnect — pause and wait for reconnect. */
  handleGuestDisconnect(): void {
    // If waiting for response, resolve with null to trigger evasion
    if (this.pendingResponseResolve) {
      if (this.responseTimer) {
        clearTimeout(this.responseTimer);
        this.responseTimer = null;
      }
      const resolve = this.pendingResponseResolve;
      this.pendingResponseResolve = null;
      resolve(null as unknown as string);
    }
  }

  /** Stop the orchestrator. */
  stop(): void {
    this.running = false;
    if (this.responseTimer) {
      clearTimeout(this.responseTimer);
      this.responseTimer = null;
    }
    if (this.pendingResponseResolve) {
      const resolve = this.pendingResponseResolve;
      this.pendingResponseResolve = null;
      resolve(null as unknown as string);
    }
  }

  private waitForGuestResponse(): Promise<string | null> {
    return new Promise((resolve) => {
      this.pendingResponseResolve = resolve as (content: string) => void;
      this.responseTimer = setTimeout(() => {
        this.responseTimer = null;
        if (this.pendingResponseResolve) {
          const r = this.pendingResponseResolve;
          this.pendingResponseResolve = null;
          r(null as unknown as string);
        }
      }, this.config.responseTimeoutMs);
    });
  }

  private async generateHostMessage(instruction: string): Promise<string> {
    if (!this.anthropic) {
      // Mock mode for testing without API key
      return this.mockHostResponse(instruction);
    }

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Build conversation history for context
    for (const msg of this.conversation.messages) {
      messages.push({
        role: msg.role === "host" ? "assistant" : "user",
        content: msg.content,
      });
    }

    // Add instruction as the latest user message
    messages.push({ role: "user", content: instruction });

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: `${hostSystemPrompt}\n\nTopic: ${this.conversation.topic}`,
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock ? textBlock.text : "I'd like to continue our discussion.";
    } catch (err) {
      // Retry once on API failure
      console.warn("Anthropic API error, retrying once:", err);
      try {
        const response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: `${hostSystemPrompt}\n\nTopic: ${this.conversation.topic}`,
          messages,
        });
        const textBlock = response.content.find((b) => b.type === "text");
        return textBlock ? textBlock.text : "I'd like to continue our discussion.";
      } catch (retryErr) {
        throw new Error(`Anthropic API failed after retry: ${retryErr}`);
      }
    }
  }

  private mockHostResponse(instruction: string): string {
    this.turnNumber; // reference for context
    if (instruction.includes("Begin a podcast")) {
      return `Welcome to the Vantum Podcast! Today we're discussing "${this.conversation.topic}". I'm excited to dive into this topic with our guest. To get us started — what's your perspective on the most important aspects of ${this.conversation.topic}?`;
    }
    if (instruction.includes("did not respond")) {
      return `It seems we had a brief pause there. No worries! Let me rephrase — what are your thoughts on ${this.conversation.topic}?`;
    }
    if (instruction.includes("concluding synthesis")) {
      const msgCount = this.conversation.messages.length;
      return `What a fascinating conversation! We covered ${msgCount} exchanges on "${this.conversation.topic}". Thank you to our guest for sharing their insights. Until next time on Vantum Podcast!`;
    }
    return `That's a great point! I'd love to explore that further. How do you see ${this.conversation.topic} evolving in the near future?`;
  }

  private emitHostMessage(content: string): void {
    const message = this.addMessage("host", content);
    this.turnNumber++;
    this.callbacks.onHostMessage(this.conversation, message);
  }

  private addMessage(role: "host" | "guest", content: string): ConversationMessage {
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      conversationId: this.conversation.id,
      role,
      content,
      timestamp: new Date().toISOString(),
    };
    this.conversation.messages.push(message);
    return message;
  }

  private async conclude(reason: string): Promise<void> {
    this.running = false;
    let synthesis: string | undefined;

    try {
      synthesis = await this.generateHostMessage(
        "Generate a concluding synthesis of the conversation. Summarize the key points discussed and thank the guest.",
      );
      this.addMessage("host", synthesis);
    } catch {
      synthesis = "Thank you for the conversation.";
    }

    this.conversation.status = "completed";
    this.callbacks.onConversationEnd(this.conversation, reason, synthesis);
  }
}

/** Active conversations registry. */
const activeConversations = new Map<string, ConversationOrchestrator>();

export function createConversation(
  topic: string,
  guestAgentId: string,
  callbacks: OrchestrationCallbacks,
  config?: Partial<OrchestrationConfig>,
): ConversationOrchestrator {
  const orch = new ConversationOrchestrator(topic, guestAgentId, callbacks, config);
  activeConversations.set(orch.conversationId, orch);
  return orch;
}

export function getOrchestrator(conversationId: string): ConversationOrchestrator | undefined {
  return activeConversations.get(conversationId);
}

export function removeOrchestrator(conversationId: string): void {
  activeConversations.delete(conversationId);
}
