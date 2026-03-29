import { useCallback, useState } from "react";
import * as api from "../lib/api";
import type { ChatMessage } from "../lib/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const res = await api.sendChat(text, conversationId);
        setConversationId(res.conversation_id);

        const aiMsg: ChatMessage = {
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          follow_ups: res.follow_ups,
          confidence: res.confidence,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (e: unknown) {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: `Sorry, something went wrong: ${e instanceof Error ? e.message : "unknown error"}`,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return { messages, loading, sendMessage, reset, conversationId };
}
