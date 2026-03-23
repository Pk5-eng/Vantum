import { NextResponse } from "next/server";
import { getConversation } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = getConversation(id);
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const transcript = {
    conversationId: conversation.id,
    topic: conversation.topic,
    startedAt: conversation.createdAt,
    completedAt: conversation.completedAt,
    synthesis: conversation.synthesis,
    messages: conversation.messages.map((m) => ({
      role: m.role,
      agentName: m.agentName,
      content: m.content,
      timestamp: m.timestamp,
    })),
  };

  return new NextResponse(JSON.stringify(transcript, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vantum-transcript-${conversation.id}.json"`,
    },
  });
}
