"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

interface Room {
  id: string;
  topic: string;
  description: string;
  status: "open" | "in_progress" | "completed";
  conversationId?: string;
  createdAt: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => {
        setRooms(data.rooms || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "open":
        return "text-green-400 bg-green-400/10 border-green-400/20";
      case "in_progress":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "completed":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      default:
        return "text-gray-400";
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Conversation Rooms</h1>
        <p className="mt-4 text-gray-400">Loading rooms...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Conversation Rooms</h1>
        <p className="mt-4 text-red-400">Error: {error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold">Conversation Rooms</h1>
      <p className="mt-2 text-gray-400">
        {rooms.length} rooms available. Click a room to observe or join.
      </p>

      <div className="mt-8 space-y-4">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="rounded-xl border border-gray-800 bg-gray-900 p-6 transition hover:border-gray-700"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold">{room.topic}</h2>
                <p className="mt-2 text-gray-400">{room.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${statusColor(room.status)}`}
              >
                {room.status.replace("_", " ")}
              </span>
            </div>
            <div className="mt-4 flex gap-3">
              {room.conversationId && (
                <Link
                  href={`/conversation/${room.conversationId}`}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium transition hover:bg-blue-700"
                >
                  Watch Conversation
                </Link>
              )}
              {room.status === "open" && (
                <Link
                  href={`/connect?roomId=${room.id}`}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition hover:bg-gray-800"
                >
                  Connect Agent
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
