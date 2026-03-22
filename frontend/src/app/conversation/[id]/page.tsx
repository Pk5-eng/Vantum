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

type Status = "loading" | "waiting" | "active" | "concluding" | "completed";

function StatusBadge({ status, connected }: { status: Status; connected: boolean }) {
  const config: Record<Status, { label: string; dotClass: string; textClass: string }> = {
    loading: { label: "Loading", dotClass: "bg-[var(--text-muted)]", textClass: "text-[var(--text-muted)]" },
    waiting: { label: "Waiting for agent", dotClass: "bg-[var(--warning)] animate-pulse", textClass: "text-[var(--warning)]" },
    active: { label: "In conversation", dotClass: "bg-[var(--success)] animate-pulse", textClass: "text-[var(--success)]" },
    concluding: { label: "Concluding", dotClass: "bg-[var(--warning)]", textClass: "text-[var(--warning)]" },
    completed: { label: "Complete", dotClass: "bg-[var(--text-muted)]", textClass: "text-[var(--text-muted)]" },
  };
  const { label, dotClass, textClass } = config[status];

  return (
    <div className="flex items-center gap-3">
      <span className={`flex items-center gap-1.5 text-xs ${textClass}`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
        {label}
      </span>
      {connected && status !== "completed" && (
        <span className="flex items-center gap-1 text-xs text-[var(--success)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          live
        </span>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isHost = msg.role === "host";
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isHost ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-3 ${
          isHost
            ? "bg-indigo-950/40 border border-indigo-900/50"
            : "bg-blue-950/40 border border-blue-900/50"
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className={`text-xs font-medium ${isHost ? "text-indigo-400" : "text-blue-400"}`}>
            {msg.agentName || (isHost ? "Host" : "Guest")}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">{time}</span>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
    </div>
  );
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAct, setCurrentAct] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const turnCount = messages.length;

  // Update act based on turn count (rough heuristic: 3 acts over conversation)
  useEffect(() => {
    if (turnCount <= 4) setCurrentAct(1);
    else if (turnCount <= 8) setCurrentAct(2);
    else setCurrentAct(3);
  }, [turnCount]);

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
        setStatus(conv.status as Status);
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
    ws.onclose = () => {
      setConnected(false);
      // Reconnect if not completed
      if (status !== "completed") {
        setTimeout(() => {
          if (wsRef.current === ws) {
            // re-trigger by setting conversation
            setConversation((c) => c ? { ...c } : c);
          }
        }, 3000);
      }
    };
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
          setStatus("concluding");
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
  }, [conversation, status]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, synthesis]);

  const handleExport = () => {
    const transcript = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.role.toUpperCase()} (${m.agentName || m.role}): ${m.content}`
      )
      .join("\n\n");

    if (synthesis) {
      const full = transcript + "\n\n--- SYNTHESIS ---\n\n" + synthesis;
      downloadText(full);
    } else {
      downloadText(transcript);
    }
  };

  if (error) {
    return (
      <div className="py-12">
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="py-12">
        <p className="text-sm text-[var(--text-muted)]">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col py-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-4">
          <StatusBadge status={status} connected={connected} />
          <div className="flex gap-1 text-xs text-[var(--text-muted)]">
            {[1, 2, 3].map((act) => (
              <span
                key={act}
                className={`rounded px-2 py-0.5 ${
                  act === currentAct
                    ? "bg-[var(--accent)] text-white"
                    : act < currentAct
                    ? "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                }`}
              >
                Act {act}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--text-muted)]">Turn {turnCount}</span>
          {status === "completed" && (
            <button
              onClick={handleExport}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Export Transcript
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-[var(--text-muted)]">
              {status === "waiting"
                ? "Waiting for agents to connect..."
                : "Conversation starting..."}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {status === "active" && messages.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)] animate-pulse-dot" />
              <span className="text-xs text-[var(--text-muted)]">Waiting for next message...</span>
            </div>
          )}

          {synthesis && (
            <div className="rounded-lg border border-purple-900/40 bg-purple-950/30 p-5">
              <h3 className="text-sm font-semibold text-purple-400">Concluding Synthesis</h3>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                {synthesis}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function downloadText(text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vantum-transcript-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
