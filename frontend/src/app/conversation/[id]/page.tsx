"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ConversationMessage {
  id: string;
  role: "host" | "guest";
  content: string;
  timestamp: string;
}

interface ActRange {
  name: string;
  actNumber: number;
  startTurn: number;
  endTurn: number;
}

interface ConversationData {
  id: string;
  topic: string;
  domain: string;
  status: "waiting" | "active" | "completed";
  acts: ActRange[];
  concludingSynthesis: string;
  createdAt: string;
  messages: ConversationMessage[];
}

type ExportFormat = "markdown" | "plaintext";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<ConversationData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/conversations/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load conversation");
        return res.json();
      })
      .then((data: ConversationData) => {
        setConversation(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setDropdownOpen(false);
      try {
        const res = await fetch(
          `${API_URL}/api/conversations/${params.id}/export?format=${format}`
        );
        if (!res.ok) throw new Error("Export failed");

        const disposition = res.headers.get("Content-Disposition") || "";
        const filenameMatch = disposition.match(/filename="(.+?)"/);
        const filename = filenameMatch ? filenameMatch[1] : `transcript.${format === "markdown" ? "md" : "txt"}`;

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        alert("Failed to export transcript. Please try again.");
      }
    },
    [params.id]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-500">Loading conversation...</p>
      </main>
    );
  }

  if (error || !conversation) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-500">{error || "Not found"}</p>
      </main>
    );
  }

  const isCompleted = conversation.status === "completed";

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {conversation.topic}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {conversation.domain} &middot;{" "}
              {new Date(conversation.createdAt).toLocaleDateString()} &middot;{" "}
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  isCompleted
                    ? "bg-green-100 text-green-800"
                    : conversation.status === "active"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {conversation.status}
              </span>
            </p>
          </div>

          {/* Export dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              disabled={!isCompleted}
              onClick={() => setDropdownOpen((o) => !o)}
              className={`rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition ${
                isCompleted
                  ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                  : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              Export Transcript
            </button>

            {dropdownOpen && isCompleted && (
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => handleExport("markdown")}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Markdown (.md)
                </button>
                <button
                  onClick={() => handleExport("plaintext")}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Plain Text (.txt)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Acts overview */}
        {conversation.acts.length > 0 && (
          <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Acts
            </h2>
            <ul className="space-y-1 text-sm text-gray-700">
              {conversation.acts.map((act) => (
                <li key={act.actNumber}>
                  <span className="font-medium">{act.name}</span> (Act{" "}
                  {act.actNumber}): turns {act.startTurn}–{act.endTurn}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-4">
          {conversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-4 ${
                msg.role === "host"
                  ? "bg-blue-50 border border-blue-100"
                  : "bg-white border border-gray-200"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {msg.role}
              </p>
              <p className="text-gray-800 leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Concluding synthesis */}
        {isCompleted && conversation.concludingSynthesis && (
          <div className="mt-8 rounded-md border border-gray-300 bg-gray-100 p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Concluding Synthesis
            </h2>
            <p className="text-gray-800 leading-relaxed">
              {conversation.concludingSynthesis}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
