"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const starterQuestions = [
  "What are the strongest stocks in the current rankings?",
  "Why is the top ranked stock scoring highly?",
  "Summarise today’s market news for my rankings.",
  "Which ranked stocks look weakest right now?",
];

export function AskStockGPTButton() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about the live StockGPT rankings, latest market news, sectors, scores, or why a stock is ranked where it is.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendQuestion(nextQuestion?: string) {
    const text = (nextQuestion ?? question).trim();

    if (!text || loading) return;

    setQuestion("");
    setLoading(true);

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const res = await fetch("/api/ask-stockgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: text }),
      });

      const data = (await res.json().catch(() => null)) as {
        answer?: string;
      } | null;

      const answer =
        data?.answer ??
        "Ask StockGPT could not return an answer. Please try again.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "Ask StockGPT could not connect to the server. Check your deployment logs and API route.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendQuestion();
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#ddb159]/70 bg-[#ddb159] px-4 text-[12px] font-black text-[#072116] shadow-[0_8px_22px_rgba(221,177,89,0.16)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_12px_30px_rgba(221,177,89,0.28)]"
      >
        <span>✦</span>
        <span>Ask StockGPT</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/45 p-3 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close Ask StockGPT overlay"
            onClick={handleClose}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative ml-auto flex h-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-[#ddb159]/35 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="relative shrink-0 border-b border-[#ddb159]/18 bg-[radial-gradient(circle_at_80%_0%,rgba(221,177,89,0.18),transparent_38%),linear-gradient(135deg,#0d3420,#061b12)] p-4">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close Ask StockGPT"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-[#ddb159]/30 text-[#ddb159] transition hover:bg-[#ddb159]/10"
              >
                ×
              </button>

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                ✦ AI Assistant
              </p>

              <h2 className="mt-1 text-[24px] font-black tracking-[-0.05em]">
                Ask StockGPT
              </h2>

              <p className="mt-2 max-w-[330px] text-[12px] font-medium leading-relaxed text-[#faf6f0]/65">
                Answers use your live StockGPT rankings and latest saved market
                news. No fake prices, scores, or rankings.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={[
                      "rounded-2xl px-3 py-2.5 text-[12px] font-medium leading-relaxed",
                      message.role === "user"
                        ? "ml-8 bg-[#ddb159] text-[#072116]"
                        : "mr-8 border border-[#ddb159]/18 bg-[#faf6f0] text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.14)]",
                    ].join(" ")}
                  >
                    {message.content}
                  </div>
                ))}

                {loading && (
                  <div className="mr-8 rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0] px-3 py-2.5 text-[12px] font-semibold text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.14)]">
                    Thinking through the live StockGPT data…
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {messages.length === 1 && (
              <div className="shrink-0 border-t border-[#ddb159]/12 px-4 py-3">
                <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#ddb159]/80">
                  Try asking
                </p>

                <div className="grid gap-2">
                  {starterQuestions.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => void sendQuestion(starter)}
                      className="rounded-2xl border border-[#ddb159]/20 bg-[#faf6f0]/[0.035] px-3 py-2 text-left text-[11px] font-bold text-[#faf6f0]/78 transition hover:border-[#ddb159]/50 hover:bg-[#ddb159]/10"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-[#ddb159]/18 bg-[#04180f] p-3"
            >
              <div className="rounded-2xl border border-[#ddb159]/25 bg-[#072116] p-2">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendQuestion();
                    }
                  }}
                  placeholder="Ask about rankings, stocks, sectors, news..."
                  rows={3}
                  className="max-h-28 min-h-[64px] w-full resize-none bg-transparent px-2 py-1 text-[12px] font-medium leading-relaxed text-[#faf6f0] outline-none placeholder:text-[#faf6f0]/35"
                />

                <div className="flex items-center justify-between gap-2 px-1 pb-1">
                  <p className="text-[9px] font-semibold text-[#faf6f0]/35">
                    Press Enter to send
                  </p>

                  <button
                    type="submit"
                    disabled={!question.trim() || loading}
                    className="rounded-full bg-[#ddb159] px-4 py-2 text-[11px] font-black text-[#072116] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {loading ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <Link
                  href="/rankings"
                  onClick={handleClose}
                  className="text-[10px] font-bold text-[#ddb159]/75 transition hover:text-[#ddb159]"
                >
                  Rankings →
                </Link>

                <Link
                  href="/world-news"
                  onClick={handleClose}
                  className="text-[10px] font-bold text-[#ddb159]/75 transition hover:text-[#ddb159]"
                >
                  News →
                </Link>

                <Link
                  href="/portfolio"
                  onClick={handleClose}
                  className="text-[10px] font-bold text-[#ddb159]/75 transition hover:text-[#ddb159]"
                >
                  Portfolio →
                </Link>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
