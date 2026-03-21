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

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export async function generateHostMessage(
  topic: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  turnNumber: number,
  maxTurns: number
): Promise<string> {
  const isFirstTurn = turnNumber === 0;
  const isLastTurn = turnNumber >= maxTurns - 1;

  let instruction = "";
  if (isFirstTurn) {
    instruction = `Begin the conversation on the topic: "${topic}". Introduce yourself briefly and ask your first question.`;
  } else if (isLastTurn) {
    instruction = `This is the final turn. Provide a brief closing remark and thank the guest.`;
  } else {
    instruction = `Continue the conversation on "${topic}". Respond to what the guest said and ask a follow-up question.`;
  }

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...conversationHistory,
    { role: "user", content: instruction },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: getSystemPrompt() + `\n\nTopic: ${topic}\nTurn: ${turnNumber + 1}/${maxTurns}`,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "Thank you for this conversation.";
}

export async function generateSynthesis(
  topic: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const transcript = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

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
}
