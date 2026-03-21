"use client";

import { useParams } from "next/navigation";
import { useConversationSocket } from "@/lib/websocket";
import { useRef, useEffect } from "react";
import { ConversationMessage } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    connecting: { label: "Connecting", color: "text-text-muted" },
    waiting: { label: "Waiting for agent", color: "text-warning" },
    active: { label: "In conversation", color: "text-success" },
    concluding: { label: "Concluding", color: "text-warning" },
    completed: { label: "Complete", color: "text-text-muted" },
    error: { label: "Connection error", color: "text-red-400" },
  };

  const { label, color } = config[status] || config.connecting;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "active" ? "bg-success animate-pulse-dot" : "bg-text-subtle"
        }`}
      />
      <span className={`text-xs ${color}`}>{label}</span>
    </div>
  );
}

function ActIndicator({ currentAct }: { currentAct: number }) {
  return (
    <div className="flex items-center gap-3">
      {[1, 2, 3].map((act) => (
        <span
          key={act}
          className={`text-xs ${
            act === currentAct
              ? "text-text font-medium"
              : act < currentAct
              ? "text-text-muted"
              : "text-text-subtle"
          }`}
        >
          Act {act}
        </span>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isHost = message.role === "host";
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex animate-message-in ${isHost ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[70%] ${
          isHost ? "items-start" : "items-end"
        } flex flex-col`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[11px] font-medium ${
              isHost ? "text-host" : "text-guest"
            }`}
          >
            {isHost ? "Host" : "Guest"}
          </span>
          <span className="text-[10px] text-text-subtle">{time}</span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            isHost
              ? "bg-host/8 border border-host/15"
              : "bg-guest/8 border border-guest/15"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function StreamingBubble({
  content,
  role,
}: {
  content: string;
  role: "host" | "guest";
}) {
  const isHost = role === "host";

  return (
    <div
      className={`flex animate-message-in ${isHost ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[70%] ${
          isHost ? "items-start" : "items-end"
        } flex flex-col`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[11px] font-medium ${
              isHost ? "text-host" : "text-guest"
            }`}
          >
            {isHost ? "Host" : "Guest"}
          </span>
        </div>
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            isHost
              ? "bg-host/8 border border-host/15"
              : "bg-guest/8 border border-guest/15"
          }`}
        >
          {content}
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-text-muted animate-cursor align-text-bottom" />
        </div>
      </div>
    </div>
  );
}

function ExportButton({ messages }: { messages: ConversationMessage[] }) {
  const handleExport = () => {
    const transcript = messages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleTimeString();
        return `[${time}] ${m.role.toUpperCase()}: ${m.content}`;
      })
      .join("\n\n");

    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vantum-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="text-xs px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text hover:border-text-muted transition-colors cursor-pointer"
    >
      Export Transcript
    </button>
  );
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const { messages, status, currentAct, turnCount, streamingContent, streamingRole, connected } =
    useConversationSocket({ conversationId });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-4 shrink-0">
        <div className="flex items-center gap-6">
          <StatusBadge status={status} />
          <ActIndicator currentAct={currentAct} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-subtle">
            Turn {turnCount}
          </span>
          {!connected && status !== "completed" && (
            <span className="text-[10px] text-red-400">Disconnected</span>
          )}
          {status === "completed" && <ExportButton messages={messages} />}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && status !== "completed" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-text-muted text-sm">
                {status === "connecting"
                  ? "Connecting to conversation..."
                  : status === "waiting"
                  ? "Waiting for agents to join..."
                  : "Loading..."}
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {streamingContent && streamingRole && (
          <StreamingBubble content={streamingContent} role={streamingRole} />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
