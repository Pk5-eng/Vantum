import type { Conversation, ConversationMessage } from "@vantum/shared";
import * as redis from "./redis";
import { generateHostMessage, generateSynthesis } from "./host-agent";
import { config } from "./config";
import { broadcast } from "./ws-handler";

function uuid(): string {
  return crypto.randomUUID();
}

// Active conversations waiting for guest replies
const pendingReplies = new Map<
  string,
  { resolve: (content: string) => void; timeout: NodeJS.Timeout }
>();

export function submitGuestReply(conversationId: string, content: string): boolean {
  const pending = pendingReplies.get(conversationId);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingReplies.delete(conversationId);
  pending.resolve(content);
  return true;
}

function waitForGuestReply(conversationId: string, timeoutMs = 60000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingReplies.delete(conversationId);
      reject(new Error("Guest reply timeout"));
    }, timeoutMs);
    pendingReplies.set(conversationId, { resolve, timeout });
  });
}

export async function startConversation(
  roomId: string,
  topic: string,
  guestAgentId: string
): Promise<Conversation> {
  const conversationId = uuid();

  const conversation: Conversation = {
    id: conversationId,
    roomId,
    topic,
    status: "active",
    hostAgentId: "vantum-host",
    guestAgentId,
    messages: [],
    createdAt: new Date().toISOString(),
  };

  await redis.saveConversation(conversation);

  // Update room status
  const room = await redis.getRoom(roomId);
  if (room) {
    room.status = "in_progress";
    room.conversationId = conversationId;
    await redis.saveRoom(room);
  }

  broadcast(roomId, {
    type: "conversation:start",
    payload: { conversationId, topic, roomId },
    timestamp: new Date().toISOString(),
  });

  // Run conversation loop asynchronously
  runConversationLoop(conversation).catch((err) =>
    console.error("Conversation loop error:", err)
  );

  return conversation;
}

async function runConversationLoop(conversation: Conversation): Promise<void> {
  const { id: conversationId, topic, roomId } = conversation;
  const maxTurns = config.maxTurns;
  const history: { role: "user" | "assistant"; content: string }[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    // Host generates a message
    const hostContent = await generateHostMessage(topic, history, turn, maxTurns);

    const hostMessage: ConversationMessage = {
      id: uuid(),
      conversationId,
      role: "host",
      agentName: "Vantum Host",
      content: hostContent,
      timestamp: new Date().toISOString(),
    };

    await redis.addMessage(conversationId, hostMessage);
    history.push({ role: "assistant", content: hostContent });

    broadcast(roomId, {
      type: "conversation:message",
      payload: { message: hostMessage },
      timestamp: new Date().toISOString(),
    });

    // Prompt the guest agent for a reply
    broadcast(roomId, {
      type: "agent:prompt",
      payload: {
        conversationId,
        turn: turn + 1,
        maxTurns,
        hostMessage: hostContent,
      },
      timestamp: new Date().toISOString(),
    });

    // Wait for the guest's reply
    let guestContent: string;
    try {
      guestContent = await waitForGuestReply(conversationId, 120000);
    } catch {
      guestContent =
        "I appreciate the discussion so far. Let me reflect on that point.";
    }

    // Resolve registered agent name
    const agentInfo = await redis.getAgentInfo(conversation.guestAgentId || "");
    const guestDisplayName = agentInfo?.name || conversation.guestAgentId || "Guest Agent";

    const guestMessage: ConversationMessage = {
      id: uuid(),
      conversationId,
      role: "guest",
      agentName: guestDisplayName,
      content: guestContent,
      timestamp: new Date().toISOString(),
    };

    await redis.addMessage(conversationId, guestMessage);
    history.push({ role: "user", content: guestContent });

    broadcast(roomId, {
      type: "conversation:message",
      payload: { message: guestMessage },
      timestamp: new Date().toISOString(),
    });
  }

  // Generate synthesis
  const allMessages = await redis.getMessages(conversationId);
  const synthesis = await generateSynthesis(
    topic,
    allMessages.map((m) => ({ role: m.role, content: m.content }))
  );

  // Update conversation
  const conv = await redis.getConversation(conversationId);
  if (conv) {
    conv.status = "completed";
    conv.synthesis = synthesis;
    conv.completedAt = new Date().toISOString();
    conv.messages = allMessages;
    await redis.saveConversation(conv);
  }

  // Update room
  const room = await redis.getRoom(roomId);
  if (room) {
    room.status = "completed";
    await redis.saveRoom(room);
  }

  broadcast(roomId, {
    type: "conversation:synthesis",
    payload: { conversationId, synthesis },
    timestamp: new Date().toISOString(),
  });

  broadcast(roomId, {
    type: "conversation:end",
    payload: { conversationId },
    timestamp: new Date().toISOString(),
  });
}
