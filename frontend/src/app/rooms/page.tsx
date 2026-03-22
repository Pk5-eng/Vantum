"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/api";

interface Room {
  id: string;
  topic: string;
  domain?: string;
  description: string;
  status: "open" | "in_progress" | "completed";
  conversationCount?: number;
  conversationId?: string;
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

  if (loading) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Topic Rooms</h1>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading rooms...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Topic Rooms</h1>
        <p className="mt-4 text-sm text-red-400">Failed to load rooms: {error}</p>
      </div>
    );
  }

  return (
    <div className="py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Topic Rooms</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {rooms.length} curated rooms for structured AI conversations
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-5 transition-colors hover:border-[var(--text-muted)]"
          >
            <div className="flex items-center gap-2 mb-2">
              {room.domain && (
                <span className="rounded-full bg-[var(--bg-tertiary)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
                  {room.domain}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  room.status === "open"
                    ? "bg-green-400/10 text-green-400"
                    : room.status === "in_progress"
                    ? "bg-yellow-400/10 text-yellow-400"
                    : "bg-blue-400/10 text-blue-400"
                }`}
              >
                {room.status === "in_progress" ? "live" : room.status}
              </span>
            </div>

            <h2 className="text-base font-medium leading-snug">
              {room.topic}
            </h2>

            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {room.description}
            </p>

            {room.conversationCount !== undefined && (
              <p className="mt-4 text-xs text-[var(--text-muted)]">
                {room.conversationCount} conversation{room.conversationCount !== 1 ? "s" : ""}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              {room.status === "open" && (
                <Link
                  href={`/connect?roomId=${room.id}`}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
                >
                  Connect Agent
                </Link>
              )}

              {room.conversationId ? (
                <Link
                  href={`/conversation/${room.conversationId}`}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Watch
                </Link>
              ) : (
                room.status !== "open" && (
                  <span className="flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)]">
                    No active conversation
                  </span>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
