/**
 * End-to-end test: registers an agent, connects guest + observer via WebSocket,
 * and runs a full conversation to completion.
 *
 * Usage: npx ts-node src/test-e2e.ts
 */

import WebSocket from "ws";
import http from "http";

const BASE_URL = "http://localhost:4000";
const WS_URL = "ws://localhost:4000/ws";

const GUEST_RESPONSES = [
  "That's a great question! I believe the most important aspect of AI safety is alignment — ensuring AI systems do what we actually want them to do, not just what we literally ask. The gap between intention and instruction is where the biggest risks lie.",
  "Absolutely. I see AI safety evolving in a few key directions. First, we'll see more robust interpretability tools that let us understand what models are actually doing internally. Second, I think collaborative safety research between labs will become standard practice. And third, regulatory frameworks will mature alongside the technology.",
  "I think the most overlooked challenge is the coordination problem. Even if one lab solves alignment perfectly, we need the entire ecosystem to maintain safety standards. It's similar to climate agreements — individual action matters, but systemic coordination is essential.",
];

let guestResponseIndex = 0;

// --- Helpers ---

function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main Test ---

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  VANTUM E2E TEST — Full Conversation Flow");
  console.log("=".repeat(60));
  console.log();

  // Step 1: Register agent
  console.log("[TEST] Step 1: Registering guest agent...");
  const registration = await post("/api/agents/register", { name: "TestGuestBot" });
  const agentId = registration.agentId as string;
  const apiKey = registration.apiKey as string;
  console.log(`[TEST] Agent registered: ${registration.name} (${agentId})`);
  console.log(`[TEST] API key: ${apiKey.slice(0, 20)}...`);
  console.log();

  // Step 2: Connect guest agent via WebSocket
  console.log("[TEST] Step 2: Connecting guest agent via WebSocket...");
  const guestWs = new WebSocket(WS_URL);
  let conversationId: string | null = null;

  const observerMessages: Array<{ event: string; data: Record<string, unknown>; timestamp: string }> = [];
  let conversationComplete = false;

  const done = new Promise<void>((resolve) => {
    guestWs.on("open", () => {
      console.log("[GUEST] Connected, sending auth...");
      guestWs.send(JSON.stringify({ type: "auth", apiKey }));
    });

    guestWs.on("message", async (data) => {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "auth_result":
          if (msg.success) {
            console.log("[GUEST] Authenticated successfully");
            console.log();

            // Step 3: Start conversation via REST
            console.log("[TEST] Step 3: Starting conversation...");
            const convResult = await post("/api/conversations/start", {
              agentId,
              topic: "The Future of AI Safety",
            });
            console.log(`[TEST] Conversation status: ${convResult.status}`);
            if (convResult.conversationId) {
              conversationId = convResult.conversationId as string;
              console.log(`[TEST] Conversation ID: ${conversationId}`);

              // Step 4: Connect observer
              console.log();
              console.log("[TEST] Step 4: Connecting observer...");
              connectObserver(conversationId, observerMessages);
            }
            console.log();
          } else {
            console.error("[GUEST] Auth failed:", msg.error);
            resolve();
          }
          break;

        case "conversation_start":
          conversationId = msg.conversationId;
          console.log(`[GUEST] Conversation started: "${msg.topic}"`);
          console.log(`[GUEST] Conversation ID: ${msg.conversationId}`);
          console.log();
          break;

        case "host_message":
          console.log("-".repeat(60));
          console.log(`[HOST] Turn ${msg.turnNumber}:`);
          console.log(msg.content);
          console.log();

          // Respond after a brief "thinking" delay
          await sleep(500);
          const response = GUEST_RESPONSES[guestResponseIndex % GUEST_RESPONSES.length];
          guestResponseIndex++;

          console.log(`[GUEST] Responding:`);
          console.log(response);
          console.log();

          guestWs.send(
            JSON.stringify({
              type: "agent_response",
              conversationId: msg.conversationId,
              content: response,
            }),
          );
          break;

        case "conversation_end":
          console.log("=".repeat(60));
          console.log("[GUEST] Conversation ended");
          console.log(`[GUEST] Reason: ${msg.reason}`);
          if (msg.synthesis) {
            console.log(`[GUEST] Synthesis: ${msg.synthesis}`);
          }
          console.log();
          conversationComplete = true;

          // Give observer a moment to receive final events
          await sleep(1000);
          resolve();
          break;
      }
    });

    guestWs.on("error", (err) => {
      console.error("[GUEST] WebSocket error:", err.message);
      resolve();
    });

    guestWs.on("close", () => {
      console.log("[GUEST] Disconnected");
      if (!conversationComplete) resolve();
    });
  });

  await done;

  // Print observer summary
  console.log("=".repeat(60));
  console.log("  OBSERVER MESSAGE LOG");
  console.log("=".repeat(60));
  console.log(`[OBSERVER] Total events received: ${observerMessages.length}`);
  console.log();
  for (const msg of observerMessages) {
    console.log(`  [${msg.event}] ${JSON.stringify(msg.data)}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("  TEST RESULT: " + (conversationComplete ? "PASS ✓" : "FAIL ✗"));
  console.log("=".repeat(60));

  // Cleanup
  guestWs.close();
  process.exit(conversationComplete ? 0 : 1);
}

function connectObserver(
  conversationId: string,
  messages: Array<{ event: string; data: Record<string, unknown>; timestamp: string }>,
): void {
  const observerWs = new WebSocket(`${WS_URL}?role=observer`);

  observerWs.on("open", () => {
    console.log("[OBSERVER] Connected, subscribing to conversation...");
    observerWs.send(JSON.stringify({ type: "subscribe", conversationId }));
  });

  observerWs.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === "observer_event") {
      messages.push({ event: msg.event, data: msg.data, timestamp: msg.timestamp });

      // Print select observer events in real time
      if (msg.event === "conversation:message") {
        const role = msg.data.role as string;
        console.log(`[OBSERVER] 📡 ${role.toUpperCase()} message received`);
      } else if (msg.event === "conversation:end") {
        console.log(`[OBSERVER] 📡 Conversation ended: ${msg.data.reason}`);
      } else if (msg.event === "conversation:start") {
        console.log(`[OBSERVER] 📡 Conversation started: "${msg.data.topic}"`);
      }
    }
  });

  observerWs.on("error", (err) => {
    console.error("[OBSERVER] Error:", err.message);
  });
}

main().catch((err) => {
  console.error("E2E Test failed:", err);
  process.exit(1);
});
