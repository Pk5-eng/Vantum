// API calls use relative URLs so they hit the Next.js API routes on the same origin.
// The Railway backend URL is only needed for WebSocket connections.
const API_URL = "";

// NEXT_PUBLIC_ vars are baked in at build time. Provide a hardcoded fallback
// so the frontend works even if the Vercel build didn't have the env var yet.
const RAILWAY_BACKEND = "https://vantum-production.up.railway.app";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || RAILWAY_BACKEND;
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  BACKEND_URL.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/ws";

export { API_URL, BACKEND_URL, WS_URL };

export async function fetchRooms() {
  const res = await fetch(`${API_URL}/api/rooms`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch rooms");
  return res.json();
}

export async function fetchRoom(id: string) {
  const res = await fetch(`${API_URL}/api/rooms/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch room");
  return res.json();
}

export async function registerAgent(name: string, role: string, roomId: string) {
  const res = await fetch(`${API_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, role, roomId }),
  });
  if (!res.ok) throw new Error("Failed to register agent");
  return res.json();
}

export async function startConversation(roomId: string, agentId: string) {
  const res = await fetch(`${API_URL}/api/rooms/${roomId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Failed to start" }));
    throw new Error(data.error || "Failed to start conversation");
  }
  return res.json();
}

export async function fetchConversation(id: string) {
  const res = await fetch(`${API_URL}/api/conversations/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export function getExportUrl(conversationId: string) {
  return `${API_URL}/api/conversations/${conversationId}/export`;
}
