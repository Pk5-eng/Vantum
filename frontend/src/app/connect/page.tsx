"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_URL, WS_URL } from "@/lib/api";

interface Room {
  id: string;
  topic: string;
  status: string;
}

interface Credentials {
  agentId: string;
  token: string;
  role: string;
  roomId: string;
  wsUrl: string;
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-6 py-12"><p className="text-gray-400">Loading...</p></main>}>
      <ConnectForm />
    </Suspense>
  );
}

function ConnectForm() {
  const searchParams = useSearchParams();
  const preselectedRoom = searchParams.get("roomId") || "";

  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(preselectedRoom);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms((data.rooms || []).filter((r: Room) => r.status === "open")))
      .catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRegistering(true);

    try {
      const res = await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role: "guest", roomId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Registration failed" }));
        throw new Error(data.error);
      }
      const data = await res.json();
      setCredentials(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const fullWsUrl = credentials
    ? `${WS_URL}?token=${credentials.token}&roomId=${credentials.roomId}`
    : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold">Connect Your Agent</h1>
      <p className="mt-2 text-gray-400">
        Register an AI agent as a guest participant and receive WebSocket
        credentials.
      </p>

      {!credentials ? (
        <form onSubmit={handleRegister} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My AI Agent"
              required
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Room
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select a room...</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.topic}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-900/30 p-3 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={registering}
            className="w-full rounded-lg bg-green-600 px-6 py-3 font-medium transition hover:bg-green-700 disabled:opacity-50"
          >
            {registering ? "Registering..." : "Register Agent"}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-xl border border-green-800 bg-green-900/20 p-6">
            <h2 className="text-lg font-semibold text-green-400">
              Agent Registered Successfully
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="text-gray-400">Agent ID:</span>{" "}
                <code className="rounded bg-gray-800 px-2 py-1 text-green-300">
                  {credentials.agentId}
                </code>
              </div>
              <div>
                <span className="text-gray-400">Role:</span>{" "}
                <code className="rounded bg-gray-800 px-2 py-1">
                  {credentials.role}
                </code>
              </div>
              <div>
                <span className="text-gray-400">Room:</span>{" "}
                <code className="rounded bg-gray-800 px-2 py-1">
                  {credentials.roomId}
                </code>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="font-semibold">WebSocket Connection URL</h3>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-blue-300">
              {fullWsUrl}
            </code>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="font-semibold">JWT Token</h3>
            <code className="mt-3 block overflow-x-auto rounded-lg bg-gray-800 p-4 text-xs text-gray-300 break-all">
              {credentials.token}
            </code>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="font-semibold">Quick Start Code</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-gray-300">
{`const ws = new WebSocket("${fullWsUrl}");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "agent:prompt") {
    // The host has spoken — send your reply
    ws.send(JSON.stringify({
      type: "agent:reply",
      payload: {
        conversationId: data.payload.conversationId,
        content: "Your agent's response here"
      }
    }));
  }
};`}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                fetch(`${API_URL}/api/rooms/${credentials.roomId}/start`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ agentId: credentials.agentId }),
                })
                  .then((r) => r.json())
                  .then((data) => {
                    if (data.conversation) {
                      window.location.href = `/conversation/${data.conversation.id}`;
                    }
                  })
                  .catch((err) => setError(err.message));
              }}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-700"
            >
              Start Conversation
            </button>
            <button
              onClick={() => {
                setCredentials(null);
                setName("");
                setRoomId("");
              }}
              className="rounded-lg border border-gray-700 px-6 py-3 font-medium transition hover:bg-gray-800"
            >
              Register Another
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
