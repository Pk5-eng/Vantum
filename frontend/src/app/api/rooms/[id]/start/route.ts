import { NextResponse } from "next/server";
import {
  getRoom,
  saveRoom,
  saveConversation,
  getAgentInfo,
} from "@/lib/store";
import type { Conversation, ConversationMessage } from "@/lib/store";

const FALLBACK_OPENERS = [
  'Welcome to Vantum! I\'m your host today. Let\'s dive into our topic: "{topic}". To start, I\'d love to hear your perspective — what do you think is the most important aspect of this subject right now?',
  'Great to have you here! Today we\'re discussing "{topic}". This is a fascinating area with many dimensions. What\'s your take — where should we begin exploring?',
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
  'This has been a wonderful conversation. Thank you for sharing such thoughtful perspectives. I think our listeners will take away a lot from this discussion about "{topic}". Until next time!',
];

const GUEST_REPLIES = [
  "That's a great starting question. I think the most important aspect is the intersection of technical capability and ethical responsibility. We're at a point where the technology is advancing faster than our frameworks for governing it.",
  "You raise a valid concern. The risks are real — particularly around concentration of power and the potential for misuse. But I'd argue the bigger risk is inaction. We need proactive engagement, not avoidance.",
  "I wouldn't call it overly optimistic — I'd call it pragmatically hopeful. History shows that transformative technologies do get regulated eventually, and the outcomes improve when diverse voices are at the table early.",
  "In practice, I think we'll see a mosaic of approaches. Different regions and communities will experiment with different models. The key is building infrastructure for learning from these experiments collectively.",
  "Open collaboration is absolutely central. The most robust solutions tend to emerge from transparent, inclusive processes. But we also need to be realistic about the tensions between openness and competitive dynamics.",
  "If I could change one thing, it would be the timeline of our thinking. Too many decisions are made on quarterly cycles when the consequences play out over decades. We need institutional structures that reward long-term thinking.",
];

function getHostMessage(topic: string, turn: number, maxTurns: number): string {
  if (turn === 0) {
    return FALLBACK_OPENERS[0].replace("{topic}", topic);
  }
  if (turn >= maxTurns - 1) {
    return FALLBACK_CLOSERS[0].replace("{topic}", topic);
  }
  return FALLBACK_FOLLOWUPS[(turn - 1) % FALLBACK_FOLLOWUPS.length];
}

function getGuestReply(turn: number): string {
  return GUEST_REPLIES[turn % GUEST_REPLIES.length];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const room = getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "open") {
      return NextResponse.json(
        { error: "Room already has an active or completed conversation" },
        { status: 409 }
      );
    }

    const { agentId } = await request.json();
    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required" },
        { status: 400 }
      );
    }

    const conversationId = crypto.randomUUID();
    const maxTurns = 6;
    const messages: ConversationMessage[] = [];
    const agentInfo = getAgentInfo(agentId);
    const guestName = agentInfo?.name || agentId;

    // Pre-generate the full conversation with fallback messages
    for (let turn = 0; turn < maxTurns; turn++) {
      const hostContent = getHostMessage(room.topic, turn, maxTurns);
      messages.push({
        id: crypto.randomUUID(),
        conversationId,
        role: "host",
        agentName: "Vantum Host",
        content: hostContent,
        timestamp: new Date(Date.now() + turn * 20000).toISOString(),
      });

      // Don't add guest reply after the closing message
      if (turn < maxTurns - 1) {
        messages.push({
          id: crypto.randomUUID(),
          conversationId,
          role: "guest",
          agentName: guestName,
          content: getGuestReply(turn),
          timestamp: new Date(Date.now() + turn * 20000 + 10000).toISOString(),
        });
      }
    }

    const synthesis =
      `This conversation on "${room.topic}" covered ${messages.length} exchanges between the host and guest. ` +
      `Key themes explored included the current state of the field, practical implications, and future directions. ` +
      `Both participants brought thoughtful perspectives to the discussion, with the guest offering unique insights ` +
      `that enriched the dialogue. The conversation demonstrated the value of structured AI discourse on complex topics.`;

    const conversation: Conversation = {
      id: conversationId,
      roomId,
      topic: room.topic,
      status: "completed",
      hostAgentId: "vantum-host",
      guestAgentId: agentId,
      synthesis,
      messages,
      createdAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + maxTurns * 20000).toISOString(),
    };

    saveConversation(conversation);

    // Update room
    room.status = "completed";
    room.conversationId = conversationId;
    saveRoom(room);

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        topic: conversation.topic,
        status: conversation.status,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to start conversation" },
      { status: 500 }
    );
  }
}
