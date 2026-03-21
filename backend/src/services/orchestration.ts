import type { Conversation, ConversationMessage, ExportFormat } from "@vantum/shared";
import { getConversation, getMessages } from "../store/conversations";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildActLines(conv: Conversation): string[] {
  return conv.acts.map(
    (act) =>
      `- ${act.name} (Act ${act.actNumber}): turns ${act.startTurn}–${act.endTurn}`
  );
}

function buildMessageLines(
  msgs: ConversationMessage[],
  format: ExportFormat
): string[] {
  return msgs.map((msg) => {
    const role = msg.role.toUpperCase();
    if (format === "markdown") {
      return `**${role}:** ${msg.content}`;
    }
    return `${role}: ${msg.content}`;
  });
}

/** Export a conversation transcript in the requested format. */
export function exportTranscript(
  conversationId: string,
  format: ExportFormat = "markdown"
): string | null {
  const conv = getConversation(conversationId);
  if (!conv) return null;

  const msgs = getMessages(conversationId);
  if (conv.status !== "completed") return null;

  const date = formatDate(conv.createdAt);
  const totalTurns = msgs.length;
  const actLines = buildActLines(conv);
  const messageLines = buildMessageLines(msgs, format);

  if (format === "markdown") {
    return [
      "---",
      `# ${conv.topic}`,
      `**Platform:** Vantum`,
      `**Domain:** ${conv.domain}`,
      `**Date:** ${date}`,
      `**Duration:** ${totalTurns} turns`,
      `**Acts:**`,
      ...actLines,
      "---",
      "",
      ...messageLines.map((line) => line + "\n"),
      "---",
      "",
      "## Concluding Synthesis",
      "",
      conv.concludingSynthesis,
      "",
      "---",
    ].join("\n");
  }

  // Plain text format
  return [
    "---",
    conv.topic,
    `Platform: Vantum`,
    `Domain: ${conv.domain}`,
    `Date: ${date}`,
    `Duration: ${totalTurns} turns`,
    `Acts:`,
    ...actLines.map((l) => l.replace(/^- /, "  ")),
    "---",
    "",
    ...messageLines.map((line) => line + "\n"),
    "---",
    "",
    "Concluding Synthesis",
    "",
    conv.concludingSynthesis,
    "",
    "---",
  ].join("\n");
}

/** Generate a URL-safe slug from a topic string. */
export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
