import crypto from "node:crypto";
import { Router } from "express";
import * as redis from "./redis";
import { signToken } from "./auth";
import { startConversation } from "./conversation-engine";
import type { RegisterAgentRequest, TranscriptExport } from "@vantum/shared";

function uuid(): string {
  return crypto.randomUUID();
}

const router = Router();

// List all rooms
router.get("/api/rooms", async (_req, res) => {
  try {
    const rooms = await redis.getAllRooms();
    rooms.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ rooms });
  } catch (err) {
    console.error("Error fetching rooms:", err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Get a single room
router.get("/api/rooms/:id", async (req, res) => {
  try {
    const room = await redis.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ room });
  } catch (err) {
    console.error("Error fetching room:", err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Register an agent and get credentials
router.post("/api/register", async (req, res) => {
  try {
    const { name, role, roomId } = req.body as RegisterAgentRequest;

    if (!name || !role || !roomId) {
      res.status(400).json({ error: "name, role, and roomId are required" });
      return;
    }

    if (role !== "host" && role !== "guest") {
      res.status(400).json({ error: "role must be 'host' or 'guest'" });
      return;
    }

    const room = await redis.getRoom(roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const agentId = `agent-${uuid().slice(0, 8)}`;
    const token = signToken({ agentId, role, roomId });

    await redis.saveAgentInfo(agentId, { name, role, roomId });

    res.json({
      agentId,
      token,
      role,
      roomId,
      wsUrl: `/ws?token=${token}&roomId=${roomId}`,
    });
  } catch (err) {
    console.error("Error registering agent:", err);
    res.status(500).json({ error: "Failed to register agent" });
  }
});

// Start a conversation in a room (guest agent triggers this)
router.post("/api/rooms/:id/start", async (req, res) => {
  try {
    const room = await redis.getRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (room.status !== "open") {
      res.status(409).json({ error: "Room already has an active or completed conversation" });
      return;
    }

    const { agentId } = req.body as { agentId: string };
    if (!agentId) {
      res.status(400).json({ error: "agentId is required" });
      return;
    }

    const conversation = await startConversation(room.id, room.topic, agentId);
    res.json({ conversation: { id: conversation.id, topic: conversation.topic, status: conversation.status } });
  } catch (err) {
    console.error("Error starting conversation:", err);
    res.status(500).json({ error: "Failed to start conversation" });
  }
});

// Get conversation details
router.get("/api/conversations/:id", async (req, res) => {
  try {
    const conversation = await redis.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await redis.getMessages(req.params.id);
    conversation.messages = messages;

    res.json({ conversation });
  } catch (err) {
    console.error("Error fetching conversation:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Export conversation transcript
router.get("/api/conversations/:id/export", async (req, res) => {
  try {
    const conversation = await redis.getConversation(req.params.id);
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    const messages = await redis.getMessages(req.params.id);

    const transcript: TranscriptExport = {
      conversationId: conversation.id,
      topic: conversation.topic,
      startedAt: conversation.createdAt,
      completedAt: conversation.completedAt,
      synthesis: conversation.synthesis,
      messages: messages.map((m) => ({
        role: m.role,
        agentName: m.agentName,
        content: m.content,
        timestamp: m.timestamp,
      })),
    };

    res.setHeader("Content-Disposition", `attachment; filename="vantum-transcript-${conversation.id}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(transcript);
  } catch (err) {
    console.error("Error exporting transcript:", err);
    res.status(500).json({ error: "Failed to export transcript" });
  }
});

export default router;
