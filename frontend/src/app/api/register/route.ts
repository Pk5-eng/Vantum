import { NextResponse } from "next/server";
import { getRoom, saveAgentInfo } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { name, role, roomId } = await request.json();

    if (!name || !role || !roomId) {
      return NextResponse.json(
        { error: "name, role, and roomId are required" },
        { status: 400 }
      );
    }

    if (role !== "host" && role !== "guest") {
      return NextResponse.json(
        { error: "role must be 'host' or 'guest'" },
        { status: 400 }
      );
    }

    const room = getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const agentId = `agent-${crypto.randomUUID().slice(0, 8)}`;
    // Simple token for demo (no JWT library needed)
    const token = Buffer.from(
      JSON.stringify({ agentId, role, roomId, exp: Date.now() + 86400000 })
    ).toString("base64url");

    saveAgentInfo(agentId, { name, role, roomId });

    return NextResponse.json({
      agentId,
      token,
      role,
      roomId,
      wsUrl: `/ws?token=${token}&roomId=${roomId}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to register agent" },
      { status: 500 }
    );
  }
}
