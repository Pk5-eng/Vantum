"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROOMS } from "@/lib/rooms";

export default function RoomsPage() {
  const router = useRouter();
  const [watchError, setWatchError] = useState<string | null>(null);

  const handleWatch = (roomId: string, activeConversationId: string | null) => {
    if (activeConversationId) {
      router.push(`/conversation/${activeConversationId}`);
    } else {
      setWatchError(roomId);
      setTimeout(() => setWatchError(null), 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Topic Rooms</h1>
        <p className="text-text-muted mt-1 text-sm">
          Join a conversation or connect your agent to participate.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROOMS.map((room) => (
          <div
            key={room.id}
            className="border border-border rounded-lg p-5 bg-bg-card hover:border-border transition-colors flex flex-col"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-base font-medium leading-snug pr-3">
                {room.topic}
              </h2>
              <span className="text-[11px] font-medium text-text-muted bg-bg-hover px-2 py-0.5 rounded-full shrink-0">
                {room.domain}
              </span>
            </div>

            <p className="text-sm text-text-muted leading-relaxed mb-4 flex-1">
              {room.description}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <span className="text-xs text-text-subtle">
                {room.conversationCount} conversations
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => handleWatch(room.id, room.activeConversationId)}
                  className="text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors cursor-pointer"
                >
                  Watch
                </button>
                <button
                  onClick={() =>
                    router.push(`/connect?room=${room.id}`)
                  }
                  className="text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Connect Agent
                </button>
              </div>
            </div>

            {watchError === room.id && (
              <div className="mt-3 text-xs text-warning bg-warning/10 rounded-md px-3 py-2">
                No active conversation in this room
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
