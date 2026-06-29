"use client";

import { useMemo, useState } from "react";

import type { GeneratedSlide } from "../../../lib/slide-generator";
import type { SlideChatMessage } from "../../../lib/slide-chat";

type Props = {
  deckId: string;
  topic: string;
  currentSlideIndex: number;
  slide: GeneratedSlide;
};

const QUICK_PROMPTS = [
  "What is dynamic programming?",
  "Explain with an example",
  "Show C++ code",
  "Make it easier",
  "Translate to Hindi",
];

export default function SlideAiChat({ deckId, topic, currentSlideIndex, slide }: Props) {
  const [messages, setMessages] = useState<SlideChatMessage[]>([
    {
      role: "assistant",
      content: "Ask me anything about the topic or the slide you are viewing. I can explain the idea, give examples, code, or translate it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasConversation = messages.length > 1;

  const slideSummary = useMemo(() => {
    const bullets = slide.bullets.filter(Boolean);
    return [
      slide.title,
      slide.subtitle ? slide.subtitle : "",
      bullets.length ? bullets.join(" | ") : "",
    ].filter(Boolean).join(" ");
  }, [slide.bullets, slide.subtitle, slide.title]);

  async function sendMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);

    const nextMessages: SlideChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch(`/api/decks/${deckId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentSlideIndex,
          message: trimmed,
          messages: nextMessages,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Chat request failed (${response.status})`);
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI response");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I could not generate a response just now. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="flex w-full flex-col rounded-3xl border border-white/10 bg-white/5 shadow-2xl lg:w-[380px]">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">AI Chat</p>
        <h2 className="mt-2 text-xl font-bold text-white">Topic Tutor</h2>
        <p className="mt-1 text-sm text-slate-400">
          Current slide: {currentSlideIndex + 1} | Context: {slideSummary || topic}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 py-4">
        {/* {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={isSending}
            className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
          >
            {prompt}
          </button>
        ))} */}
      </div>

      <div className="max-h-[32rem] flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-fuchsia-500 text-white"
                  : "border border-white/10 bg-slate-950/70 text-slate-200"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {!hasConversation && (
          <p className="text-sm text-slate-500">
            Try one of the prompt chips or ask a follow-up question about the topic.
          </p>
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        {error ? <p className="mb-3 text-xs text-red-300">{error}</p> : null}
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask AI about the topic..."
          rows={3}
          className="w-full resize-none rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">AI uses the current slide as context, but can explain the topic more broadly.</span>
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={isSending || !input.trim()}
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:from-cyan-400 hover:to-blue-400 disabled:opacity-60"
          >
            {isSending ? "Thinking..." : "Ask AI"}
          </button>
        </div>
      </div>
    </aside>
  );
}
