"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WSEvent, ConversationMessage } from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws";

interface UseConversationSocketOptions {
  conversationId: string;
}

interface ConversationState {
  messages: ConversationMessage[];
  status: "connecting" | "waiting" | "active" | "concluding" | "completed" | "error";
  currentAct: number;
  turnCount: number;
  streamingContent: string | null;
  streamingRole: "host" | "guest" | null;
  connected: boolean;
}

export function useConversationSocket({ conversationId }: UseConversationSocketOptions) {
  const [state, setState] = useState<ConversationState>({
    messages: [],
    status: "connecting",
    currentAct: 1,
    turnCount: 0,
    streamingContent: null,
    streamingRole: null,
    connected: false,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}?conversationId=${conversationId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, connected: true, status: "waiting" }));

      // Subscribe to conversation
      ws.send(
        JSON.stringify({
          type: "conversation:subscribe",
          payload: { conversationId },
          timestamp: new Date().toISOString(),
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const wsEvent: WSEvent = JSON.parse(event.data);
        handleEvent(wsEvent);
      } catch {
        // Handle raw text streaming
        setState((prev) => {
          if (prev.streamingRole) {
            return {
              ...prev,
              streamingContent: (prev.streamingContent || "") + event.data,
            };
          }
          return prev;
        });
      }
    };

    ws.onclose = () => {
      setState((prev) => ({ ...prev, connected: false }));
      // Reconnect after 3s unless conversation is completed
      setState((prev) => {
        if (prev.status !== "completed") {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
        return prev;
      });
    };

    ws.onerror = () => {
      setState((prev) => ({ ...prev, status: "error" }));
    };
  }, [conversationId]);

  const handleEvent = useCallback((event: WSEvent) => {
    switch (event.type) {
      case "conversation:start":
        setState((prev) => ({
          ...prev,
          status: "active",
          currentAct: (event.payload.act as number) || 1,
        }));
        break;

      case "conversation:message": {
        const msg = event.payload as unknown as ConversationMessage;

        // If we were streaming, finalize the streamed message
        setState((prev) => {
          const newMessages = [...prev.messages];

          // Add finalized message
          newMessages.push({
            id: msg.id || `msg-${Date.now()}`,
            conversationId: msg.conversationId || "",
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || event.timestamp,
          });

          return {
            ...prev,
            messages: newMessages,
            turnCount: prev.turnCount + 1,
            currentAct: (event.payload.act as number) || prev.currentAct,
            streamingContent: null,
            streamingRole: null,
          };
        });
        break;
      }

      case "conversation:end":
        setState((prev) => ({
          ...prev,
          status: "completed",
          streamingContent: null,
          streamingRole: null,
        }));
        break;

      case "agent:connect":
        setState((prev) => ({
          ...prev,
          status: prev.status === "connecting" ? "waiting" : prev.status,
        }));
        break;

      case "agent:disconnect":
        // Keep conversation state, just note the disconnection
        break;

      case "error":
        setState((prev) => ({ ...prev, status: "error" }));
        break;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return state;
}
