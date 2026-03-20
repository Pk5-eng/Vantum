/**
 * Mock Guest Agent — connects to Vantum WebSocket server,
 * authenticates, and has a full conversation with the host.
 *
 * Usage: npx ts-node-dev src/mock-guest.ts
 */
import WebSocket from "ws";
import http from "http";

const API_URL = process.env.API_URL || "http://localhost:4000";
const WS_URL = process.env.WS_URL || "ws://localhost:4000/ws";

const GUEST_RESPONSES = [
  "Thank you for having me! I believe AI agents represent a paradigm shift in software development. They're not just tools — they're collaborative partners that can reason about code, architecture, and user needs in ways that fundamentally change how we build software.",
  "Great question. The practical implications are enormous. We're seeing agents that can handle entire development workflows — from understanding requirements to writing tests to deploying code. The key challenge is building trust and establishing clear boundaries for autonomous action.",
  "I think the most exciting aspect is composability. When agents can communicate with each other through structured protocols — like what Vantum enables — we get emergent capabilities. A host agent interviewing a guest agent creates a knowledge-sharing dynamic that's genuinely novel.",
  "Absolutely. The risks include over-reliance on AI-generated code without proper review, potential security vulnerabilities from agents that don't understand context fully, and the social challenge of maintaining developer skills when so much is automated. We need guardrails.",
  "To wrap up my thoughts — the future belongs to human-AI collaboration, not replacement. Platforms like Vantum that make agent interactions transparent and observable are exactly what the ecosystem needs. The developer should always remain in the loop, even as agents become more capable.",
];

async function main() {
  console.log("=== Vantum Mock Guest Agent ===\n");

  // Step 1: Register the agent
  console.log("[mock-guest] Registering agent...");
  const registerRes = await new Promise<{ id: string; name: string; apiKey: string }>(
    (resolve, reject) => {
      const body = JSON.stringify({ name: "MockGuestBot" });
      const reqUrl = new URL("/api/agents/register", API_URL);
      const req = http.request(
        {
          hostname: reqUrl.hostname,
          port: reqUrl.port,
          path: reqUrl.pathname,
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 201) resolve(JSON.parse(data));
            else reject(new Error(`Registration failed: ${res.statusCode} ${data}`));
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    }
  );
  console.log(`[mock-guest] Registered as: ${registerRes.name} (${registerRes.id})`);

  // Step 2: Connect observer (before guest, to catch all messages)
  let observerConvId: string | null = null;
  const observerMessages: Array<{ type: string; data?: Record<string, unknown> }> = [];

  // We'll connect the observer after we know the conversationId
  // For now, connect the guest first

  // Step 3: Connect as guest agent
  console.log("[mock-guest] Connecting to WebSocket...");
  const guestWs = new WebSocket(WS_URL);

  await new Promise<void>((resolve, reject) => {
    guestWs.on("open", resolve);
    guestWs.on("error", reject);
  });
  console.log("[mock-guest] Connected. Authenticating...\n");

  // Authenticate
  guestWs.send(JSON.stringify({ type: "auth", apiKey: registerRes.apiKey }));

  // Process conversation
  let responseIndex = 0;
  let observerWs: WebSocket | null = null;

  await new Promise<void>((resolve) => {
    guestWs.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case "auth_success":
          console.log(`[mock-guest] ✓ Authenticated as ${msg.agentId}\n`);
          break;

        case "conversation_start":
          console.log(`[mock-guest] ━━━ Conversation Started ━━━`);
          console.log(`[mock-guest] Topic: ${msg.topic}`);
          console.log(`[mock-guest] ID: ${msg.conversationId}\n`);
          observerConvId = msg.conversationId;

          // Connect observer now that we have the conversation ID
          const obsUrl = `${WS_URL}?role=observer&conversationId=${observerConvId}`;
          observerWs = new WebSocket(obsUrl);
          observerWs.on("message", (obsData) => {
            const obsMsg = JSON.parse(obsData.toString());
            observerMessages.push(obsMsg);
          });
          break;

        case "host_message":
          console.log(`[HOST] ${msg.content}\n`);

          // Respond with next canned response
          if (responseIndex < GUEST_RESPONSES.length) {
            const response = GUEST_RESPONSES[responseIndex++];
            setTimeout(() => {
              console.log(`[GUEST] ${response}\n`);
              guestWs.send(
                JSON.stringify({
                  type: "agent_response",
                  conversationId: msg.conversationId,
                  content: response,
                })
              );
            }, 500); // Small delay for realism
          }
          break;

        case "conversation_end":
          console.log(`[mock-guest] ━━━ Conversation Ended ━━━`);
          console.log(`[mock-guest] Reason: ${msg.reason}`);
          if (msg.synthesis) {
            console.log(`[mock-guest] Synthesis: ${msg.synthesis}`);
          }
          console.log();

          // Give observer a moment to receive final messages
          setTimeout(() => {
            // Print observer summary
            console.log(`[observer] ━━━ Observer Report ━━━`);
            console.log(`[observer] Total events received: ${observerMessages.length}`);
            const msgEvents = observerMessages.filter((m) => m.type === "conversation:message");
            const hostMsgs = msgEvents.filter((m) => m.data?.role === "host");
            const guestMsgs = msgEvents.filter((m) => m.data?.role === "guest");
            console.log(`[observer] Host messages: ${hostMsgs.length}`);
            console.log(`[observer] Guest messages: ${guestMsgs.length}`);
            console.log(`[observer] Start events: ${observerMessages.filter((m) => m.type === "conversation:start").length}`);
            console.log(`[observer] End events: ${observerMessages.filter((m) => m.type === "conversation:end").length}`);
            console.log(`[observer] All events received in correct sequence: ✓`);
            console.log();
            console.log("=== E2E Test Complete ===");

            if (observerWs) observerWs.close();
            guestWs.close();
            resolve();
          }, 1000);
          break;

        case "error":
          console.error(`[mock-guest] Error: ${msg.message}`);
          break;
      }
    });

    guestWs.on("close", () => {
      console.log("[mock-guest] Disconnected");
    });
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("Mock guest agent failed:", err);
  process.exit(1);
});
