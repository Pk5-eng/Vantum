import { Router } from "express";
import type { ExportFormat } from "@vantum/shared";
import { getConversation, getAllConversations, getMessages } from "../store/conversations";
import { exportTranscript, topicSlug } from "../services/orchestration";

const router = Router();

/** GET /api/conversations — list all conversations. */
router.get("/", (_req, res) => {
  res.json(getAllConversations());
});

/** GET /api/conversations/:id — get single conversation with messages. */
router.get("/:id", (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = getMessages(req.params.id);
  res.json({ ...conv, messages: msgs });
});

/** GET /api/conversations/:id/export — download transcript. */
router.get("/:id/export", (req, res) => {
  const conv = getConversation(req.params.id);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (conv.status !== "completed") {
    res.status(400).json({ error: "Conversation is not yet completed" });
    return;
  }

  const format = (req.query.format as ExportFormat) || "markdown";
  if (format !== "markdown" && format !== "plaintext") {
    res.status(400).json({ error: "Invalid format. Use 'markdown' or 'plaintext'" });
    return;
  }

  const transcript = exportTranscript(req.params.id, format);
  if (!transcript) {
    res.status(500).json({ error: "Failed to generate transcript" });
    return;
  }

  const date = new Date(conv.createdAt).toISOString().split("T")[0];
  const slug = topicSlug(conv.topic);
  const ext = format === "markdown" ? "md" : "txt";
  const filename = `vantum-${slug}-${date}.${ext}`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(transcript);
});

export default router;
