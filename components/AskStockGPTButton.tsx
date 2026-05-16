"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AskStockGPTButtonProps = {
  canUseAskStockGPT?: boolean;
  isAuthenticated?: boolean;
};

const starterQuestions = [
  "What should I do with my weakest holding?",
  "Which stocks in my portfolio should I trim, hold, or sell?",
  "What are the key stop-loss and take-profit levels in my portfolio?",
  "Which holdings need reviewing soon, and why?",
  "Where is my portfolio overexposed by sector or position size?",
];

function renderMessageContent(content: string): ReactNode[] {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-black">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

export function AskStockGPTButton({
  canUseAskStockGPT = false,
  isAuthenticated = false,
}: AskStockGPTButtonProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about your portfolio, holdings, alerts, P&L, rankings, stop-losses, take-profit levels, review dates, sector exposure, or what to do next.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const locked = !canUseAskStockGPT;

  useEffect(() => {
    if (!open || locked) return;

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [open, locked]);

  useEffect(() => {
    if (locked) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, locked]);

  async function sendQuestion(nextQuestion?: string) {
    if (locked) return;

    const text = (nextQuestion ?? question).trim();

    if (!text || loading) return;

    setQuestion("");
    setLoading(true);

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/ask-stockgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: text,
          messages: nextMessages.slice(-8),
        }),
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
        className={[
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[12px] font-black shadow-[0_8px_22px_rgba(221,177,89,0.16)] transition duration-300 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_12px_30px_rgba(221,177,89,0.28)]",
          locked
            ? "border-[#ddb159]/45 bg-[#ddb159]/15 text-[#ddb159]"
            : "border-[#ddb159]/70 bg-[#ddb159] text-[#072116]",
        ].join(" ")}
      >
        <span>{locked ? "🔒" : "✦"}</span>
        <span>Ask StockGPT</span>
      </button>

      {open && locked && (
        <div className="fixed inset-0 z-[70] bg-black/45 p-3 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close Ask StockGPT access overlay"
            onClick={handleClose}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative ml-auto flex h-full max-w-[440px] flex-col justify-between overflow-hidden rounded-3xl border border-[#ddb159]/35 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="relative border-b border-[#ddb159]/18 bg-[radial-gradient(circle_at_80%_0%,rgba(221,177,89,0.18),transparent_38%),linear-gradient(135deg,#0d3420,#061b12)] p-5">
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close Ask StockGPT"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-[#ddb159]/30 text-[#ddb159] transition hover:bg-[#ddb159]/10"
              >
                ×
              </button>

              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]">
                ✦ Subscriber Feature
              </p>

              <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em]">
                Ask StockGPT is locked.
              </h2>

              <p className="mt-3 max-w-[360px] text-[13px] font-medium leading-6 text-[#faf6f0]/65">
                Ask StockGPT uses your saved portfolio, rankings, alerts,
                stop-loss/take-profit plans, sector exposure and recent market
                news. It is only available to active subscribers.
              </p>
            </div>

            <div className="grid gap-3 p-5">
              <div className="rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0]/[0.035] p-4">
                <p className="text-[12px] font-black text-[#faf6f0]">
                  What unlocks:
                </p>
                <ul className="mt-3 grid gap-2 text-[12px] font-semibold leading-5 text-[#faf6f0]/62">
                  <li>✓ Portfolio-specific answers</li>
                  <li>✓ Ranking and AI score context</li>
                  <li>✓ Stop-loss and take-profit explanations</li>
                  <li>✓ Market/news interpretation</li>
                </ul>
              </div>

              <Link
                href={isAuthenticated ? "/subscription" : "/login"}
                onClick={handleClose}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#072116] transition hover:brightness-105"
              >
                {isAuthenticated ? "Upgrade Access →" : "Log In →"}
              </Link>

              <Link
                href="/landing"
                onClick={handleClose}
                className="text-center text-[11px] font-bold text-[#ddb159]/75 transition hover:text-[#ddb159]"
              >
                View what StockGPT includes
              </Link>
            </div>
          </div>
        </div>
      )}

      {open && !locked && (
        <div className="fixed inset-0 z-[70] bg-black/45 p-3 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close Ask StockGPT overlay"
            onClick={handleClose}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative ml-auto flex h-full max-w-[440px] flex-col overflow-hidden rounded-3xl border border-[#ddb159]/35 bg-[#061b12] text-[#faf6f0] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
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
                ✦ Portfolio Intelligence
              </p>

              <h2 className="mt-1 text-[24px] font-black tracking-[-0.05em]">
                Ask StockGPT
              </h2>

              <p className="mt-2 max-w-[360px] text-[12px] font-medium leading-relaxed text-[#faf6f0]/65">
                Answers use your saved portfolio, live rankings, alerts, P&amp;L,
                stop-loss/take-profit plans, sector exposure, and recent market news.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={[
                      "whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-[12px] font-medium leading-relaxed",
                      message.role === "user"
                        ? "ml-8 bg-[#ddb159] text-[#072116]"
                        : "mr-8 border border-[#ddb159]/18 bg-[#faf6f0] text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.14)]",
                    ].join(" ")}
                  >
                    {renderMessageContent(message.content)}
                  </div>
                ))}

                {loading && (
                  <div className="mr-8 rounded-2xl border border-[#ddb159]/18 bg-[#faf6f0] px-3 py-2.5 text-[12px] font-semibold text-[#072116] shadow-[0_10px_26px_rgba(0,0,0,0.14)]">
                    Analysing your portfolio, alerts, rankings, and action plan…
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
                  placeholder="Ask about your portfolio, a holding, stop-loss, take-profit, or review date..."
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
