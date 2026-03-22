import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";
import * as fs from "fs";
import * as path from "path";

let systemPrompt: string;

function getSystemPrompt(): string {
  if (!systemPrompt) {
    try {
      systemPrompt = fs.readFileSync(
        path.join(__dirname, "../../prompts/host-system.md"),
        "utf-8"
      );
    } catch {
      systemPrompt = `You are the host agent for a Vantum conversation. Your role is to guide a structured dialogue on the assigned topic, ask thoughtful questions, and keep the conversation productive.

## Guidelines
- Stay on topic
- Ask open-ended questions to draw out the guest agent's perspective
- Summarize key points periodically
- Keep responses concise and focused`;
    }
  }
  return systemPrompt;
}

const hasApiKey = !!config.anthropicApiKey;
const client = hasApiKey ? new Anthropic({ apiKey: config.anthropicApiKey }) : null;

// Fallback host messages when no API key is configured
const FALLBACK_OPENERS = [
  "Welcome to Vantum! I'm your host today. Let's dive into our topic: \"{topic}\". To start, I'd love to hear your perspective — what do you think is the most important aspect of this subject right now?",
  "Great to have you here! Today we're discussing \"{topic}\". This is a fascinating area with many dimensions. What's your take — where should we begin exploring?",
];

const FALLBACK_FOLLOWUPS = [
  "That's a really interesting point. I think there's a lot of depth there. Can you expand on how that connects to the broader picture?",
  "I appreciate that perspective. It raises an important question: what do you think are the potential risks or downsides of that approach?",
  "Fascinating. Let me push back a little — some might argue the opposite. How would you respond to the criticism that this view is too optimistic?",
  "That resonates with me. I'm curious about the practical side: how do you see this actually playing out in the real world over the next few years?",
  "Well said. Building on that thought, what role do you think open collaboration plays in addressing these challenges?",
  "Interesting framing. Let me ask this: if you could change one thing about how the industry approaches this topic, what would it be?",
];

const FALLBACK_CLOSERS = [
  "This has been a wonderful conversation. Thank you for sharing such thoughtful perspectives. I think our listeners will take away a lot from this discussion about \"{topic}\". Until next time!",
];

function getFallbackMessage(
  topic: string,
  turnNumber: number,
  maxTurns: number
): string {
  if (turnNumber === 0) {
    return FALLBACK_OPENERS[turnNumber % FALLBACK_OPENERS.length].replace("{topic}", topic);
  }
  if (turnNumber >= maxTurns - 1) {
    return FALLBACK_CLOSERS[0].replace("{topic}", topic);
  }
  return FALLBACK_FOLLOWUPS[(turnNumber - 1) % FALLBACK_FOLLOWUPS.length];
}

function getFallbackSynthesis(
  topic: string,
  messages: { role: string; content: string }[]
): string {
  const turnCount = messages.length;
  return `This conversation on "${topic}" covered ${turnCount} exchanges between the host and guest. ` +
    `Key themes explored included the current state of the field, practical implications, and future directions. ` +
    `Both participants brought thoughtful perspectives to the discussion, with the guest offering unique insights ` +
    `that enriched the dialogue. The conversation demonstrated the value of structured AI discourse on complex topics.`;
}

export async function generateHostMessage(
  topic: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  turnNumber: number,
  maxTurns: number
): Promise<string> {
  // Use fallback if no API key
  if (!client) {
    console.log(`[Host Agent] No API key — using fallback message for turn ${turnNumber + 1}/${maxTurns}`);
    return getFallbackMessage(topic, turnNumber, maxTurns);
  }

  const isFirstTurn = turnNumber === 0;
  const isLastTurn = turnNumber >= maxTurns - 1;

  const instruction = isFirstTurn
    ? `Begin the conversation on the topic: "${topic}". Introduce yourself briefly and ask your first question.`
    : isLastTurn
      ? `This is the final turn. Provide a brief closing remark and thank the guest.`
      : `Continue the conversation on "${topic}". Respond to what the guest said and ask a follow-up question.`;

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory,
    { role: "user", content: instruction },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: getSystemPrompt() + `\n\nTopic: ${topic}\nTurn: ${turnNumber + 1}/${maxTurns}`,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "Thank you for this conversation.";
  } catch (err) {
    console.error("[Host Agent] API error, using fallback:", err);
    return getFallbackMessage(topic, turnNumber, maxTurns);
  }
}

export async function generateSynthesis(
  topic: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (!client) {
    return getFallbackSynthesis(topic, messages);
  }

  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are an expert summarizer. Provide a concluding synthesis of the following conversation, highlighting key insights, areas of agreement, and notable perspectives shared.",
      messages: [
        {
          role: "user",
          content: `Topic: ${topic}\n\nTranscript:\n${transcript}\n\nProvide a concluding synthesis.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "Conversation concluded.";
  } catch (err) {
    console.error("[Host Agent] Synthesis API error, using fallback:", err);
    return getFallbackSynthesis(topic, messages);
  }
}
