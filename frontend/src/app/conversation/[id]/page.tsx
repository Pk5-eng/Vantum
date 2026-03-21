"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL, WS_URL } from "@/lib/api";

interface Message {
  id: string;
  role: "host" | "guest";
  agentName: string;
  content: string;
  timestamp: string;
}

interface ConversationData {
  id: string;
  roomId: string;
  topic: string;
  status: "waiting" | "active" | "completed";
  synthesis?: string;
  messages: Message[];
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load initial conversation data
  useEffect(() => {
    fetch(`${API_URL}/api/conversations/${conversationId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Conversation not found");
        return res.json();
      })
      .then((data) => {
        const conv = data.conversation;
        setConversation(conv);
        setMessages(conv.messages || []);
        setStatus(conv.status);
        if (conv.synthesis) setSynthesis(conv.synthesis);
      })
      .catch((err) => setError(err.message));
  }, [conversationId]);

  // Connect WebSocket for live updates
  useEffect(() => {
    if (!conversation) return;

    const wsUrl = `${WS_URL}?roomId=${conversation.roomId}&observer=true`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "conversation:message":
          setMessages((prev) => [...prev, data.payload.message]);
          setStatus("active");
          break;
        case "conversation:synthesis":
          setSynthesis(data.payload.synthesis);
          break;
        case "conversation:end":
          setStatus("completed");
          break;
        case "conversation:start":
          setStatus("active");
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [conversation]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, synthesis]);

  const handleExport = () => {
    window.open(
      `${API_URL}/api/conversations/${conversationId}/export`,
      "_blank"
    );
  };

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-red-400">Error: {error}</p>
      </main>
    );
  }

  if (!conversation) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-gray-400">Loading conversation...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{conversation.topic}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-gray-400">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                status === "active"
                  ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-400"
                  : status === "completed"
                    ? "border-blue-400/20 bg-blue-400/10 text-blue-400"
                    : "border-gray-600 bg-gray-800 text-gray-400"
              }`}
            >
              {status === "active" && (
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse-dot" />
              )}
              {status}
            </span>
            {connected && (
              <span className="inline-flex items-center gap-1.5 text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                live
              </span>
            )}
          </div>
        </div>
        {status === "completed" && (
          <button
            onClick={handleExport}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition hover:bg-gray-800"
          >
            Export Transcript
          </button>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-xl p-5 ${
              msg.role === "host"
                ? "border border-blue-900/40 bg-blue-950/30"
                : "border border-green-900/40 bg-green-950/30"
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`font-semibold ${
                  msg.role === "host" ? "text-blue-400" : "text-green-400"
                }`}
              >
                {msg.role === "host" ? "Host" : "Guest"}
              </span>
              <span className="text-gray-600">&middot;</span>
              <span className="text-gray-500">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-2 text-gray-200 leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>
          </div>
        ))}

        {status === "active" && messages.length > 0 && (
          <div className="flex items-center gap-2 py-4 text-gray-500">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse-dot" />
            <span className="text-sm">Waiting for next message...</span>
          </div>
        )}

        {synthesis && (
          <div className="rounded-xl border border-purple-900/40 bg-purple-950/30 p-6">
            <h3 className="text-lg font-semibold text-purple-400">
              Concluding Synthesis
            </h3>
            <p className="mt-3 text-gray-200 leading-relaxed whitespace-pre-wrap">
              {synthesis}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </main>
  );
}
