import { Router, Request, Response } from "express";
import { registerAgent } from "./store";

const router = Router();

router.post("/register", (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Agent name is required" });
    return;
  }
  const agent = registerAgent(name.trim());
  res.status(201).json({
    agentId: agent.id,
    apiKey: agent.apiKey,
    name: agent.name,
  });
});

export default router;
