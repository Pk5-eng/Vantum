const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
    : "ws://localhost:4000/ws");

export { API_URL, WS_URL };

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
