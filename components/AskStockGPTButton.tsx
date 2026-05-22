"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AskStockGPTButtonProps = {
  canUseAskStockGPT?: boolean;
  isAuthenticated?: boolean;
};

type StarterPrompt = {
  label: string;
  prompt: string;
  eyebrow: string;
};

const starterPrompts: StarterPrompt[] = [
  {
    eyebrow: "Portfolio coach",
    label: "Find my weakest holding",
    prompt: "What is my weakest holding and what should I do about it?",
  },
  {
    eyebrow: "Action plan",
    label: "Trim, hold, or buy more",
    prompt: "Which stocks in my portfolio should I trim, hold, sell, or buy more?",
  },
  {
    eyebrow: "Risk control",
    label: "Stop-loss and take-profit levels",
    prompt: "What are the key stop-loss and take-profit levels in my portfolio?",
  },
  {
    eyebrow: "Rankings",
    label: "Explain today’s strongest stocks",
    prompt: "Which stocks are ranking strongest right now and why?",
  },
  {
    eyebrow: "Learning",
    label: "Teach me a trading concept",
    prompt: "Explain risk/reward and position sizing like a market coach.",
  },
  {
    eyebrow: "Account",
    label: "Membership help",
    prompt: "How do I manage my StockGPT membership or billing?",
  },
];

const mobileStarterPrompts = starterPrompts.slice(0, 4);

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={`${part}-${index}`} className="font-black text-inherit">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderMessageContent(content: string) {
  const lines = content
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd());

  const blocks: ReactNode[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (bulletBuffer.length === 0) return;

    blocks.push(
      <ul
        key={`bullets-${blocks.length}`}
        className="mt-2 grid gap-1.5 pl-4"
      >
        {bulletBuffer.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="list-disc text-[13px] leading-relaxed sm:text-[13.5px]"
          >
            {renderInlineMarkdown(item)}
          </li>
        ))}
      </ul>,
    );

    bulletBuffer = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      bulletBuffer.push(trimmed.replace(/^[-•]\s+/, ""));
      return;
    }

    flushBullets();

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <p
          key={`heading-${index}`}
          className="mt-3 text-[13px] font-black uppercase tracking-[0.14em] text-[#ddb159]"
        >
          {trimmed.replace(/^###\s+/, "")}
        </p>,
      );
      return;
    }

    blocks.push(
      <p
        key={`paragraph-${index}`}
        className="mt-2 text-[13px] leading-relaxed sm:text-[13.5px]"
      >
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushBullets();

  return <>{blocks}</>;
}

function PremiumOrb() {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#ddb159]/40 bg-[#092418] shadow-[0_10px_35px_rgba(221,177,89,0.18)]">
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),transparent_24%),radial-gradient(circle_at_70%_80%,rgba(221,177,89,0.22),transparent_42%)]" />
      <span className="relative text-[15px] font-black text-[#ddb159]">S</span>
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "max-w-[92%] rounded-[26px] px-4 py-3 text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[78%]",
          isUser
            ? "rounded-br-md bg-[#ddb159] text-[#07170f]"
            : "rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] text-[#07170f]",
        ].join(" ")}
      >
        {!isUser && (
          <div className="mb-1.5 flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">
              S
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">
              StockGPT Coach
            </span>
          </div>
        )}

        <div className="[&>p:first-child]:mt-0">
          {renderMessageContent(message.content)}
        </div>
      </div>
    </div>
  );
}

function LockedExperience({
  isAuthenticated,
  onClose,
}: {
  isAuthenticated: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/55 p-3 backdrop-blur-md sm:p-5">
      <button
        type="button"
        aria-label="Close Ask StockGPT"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative mx-auto flex h-[min(820px,calc(100dvh-1.5rem))] max-w-5xl overflow-hidden rounded-[34px] border border-[#ddb159]/35 bg-[#06140d] text-[#fbf4e5] shadow-[0_35px_110px_rgba(0,0,0,0.72)] sm:h-[min(820px,calc(100dvh-2.5rem))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.18),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(72,140,94,0.18),transparent_35%),linear-gradient(135deg,#06140d,#0b2417_48%,#06140d)]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask StockGPT"
          className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-[#ddb159]/30 bg-[#06140d]/70 text-xl text-[#ddb159] transition hover:bg-[#ddb159]/10"
        >
          ×
        </button>

        <div className="relative grid w-full gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-between p-6 sm:p-8 lg:p-10">
            <div>
              <div className="flex items-center gap-3">
                <PremiumOrb />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    Premium intelligence
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold text-[#fbf4e5]/45">
                    Portfolio-aware AI coach
                  </p>
                </div>
              </div>

              <h2 className="mt-8 max-w-xl text-[42px] font-black leading-[0.94] tracking-[-0.06em] text-[#fbf4e5] sm:text-[58px]">
                Ask StockGPT is a subscriber feature.
              </h2>

              <p className="mt-5 max-w-xl text-[15px] font-medium leading-7 text-[#fbf4e5]/64">
                Unlock a premium market coach that can explain your portfolio,
                alerts, rankings, stop-loss levels, take-profit zones, news
                impact and trading concepts in plain English.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <Link
                href={isAuthenticated ? "/subscription" : "/login"}
                onClick={onClose}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[#ddb159] px-6 text-[12px] font-black uppercase tracking-[0.16em] text-[#07170f] transition hover:-translate-y-0.5 hover:brightness-105"
              >
                {isAuthenticated ? "Upgrade access" : "Log in"}
              </Link>

              <a
                href="mailto:sales@stockgpt.pro"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#ddb159]/35 px-6 text-[12px] font-black uppercase tracking-[0.16em] text-[#ddb159] transition hover:-translate-y-0.5 hover:bg-[#ddb159]/10"
              >
                Contact sales
              </a>
            </div>
          </section>

          <aside className="hidden border-l border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] p-8 lg:block">
            <div className="rounded-[28px] border border-[#ddb159]/25 bg-[#06140d]/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ddb159]">
                What it answers
              </p>

              <div className="mt-5 grid gap-3">
                {[
                  "What should I do with my weakest holding?",
                  "Which stocks are worth adding to?",
                  "Where am I overexposed?",
                  "Why did an alert appear?",
                  "What does this trading concept mean?",
                  "How do I manage billing or membership?",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#ddb159]/16 bg-[#fbf4e5]/[0.04] px-4 py-3 text-[13px] font-bold leading-relaxed text-[#fbf4e5]/72"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-[12px] font-medium leading-6 text-[#fbf4e5]/42">
              For account-specific billing, refunds, or anything not shown in
              the app, users are directed to{" "}
              <span className="font-black text-[#ddb159]">
                sales@stockgpt.pro
              </span>
              .
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
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
        "I’m your StockGPT coach. Ask me about your portfolio, rankings, alerts, market news, stop-losses, take-profit levels, trading concepts, or membership questions. I’ll start with the practical conclusion, then explain the evidence.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<
    "portfolio" | "rankings" | "learn" | "account"
  >("portfolio");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = !canUseAskStockGPT;

  const visibleStarters = useMemo(() => {
    if (activeMode === "portfolio") return starterPrompts.slice(0, 3);
    if (activeMode === "rankings") {
      return starterPrompts.filter((prompt) =>
        ["Rankings", "Action plan"].includes(prompt.eyebrow),
      );
    }
    if (activeMode === "learn") {
      return starterPrompts.filter((prompt) => prompt.eyebrow === "Learning");
    }
    return starterPrompts.filter((prompt) => prompt.eyebrow === "Account");
  }, [activeMode]);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || locked) return;

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);

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
      const response = await fetch("/api/ask-stockgpt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: text,
          messages: nextMessages.slice(-10),
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        answer?: string;
      } | null;

      const answer =
        data?.answer ??
        "I could not return an answer from Ask StockGPT. Try again, or email sales@stockgpt.pro if this relates to membership or billing.";

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
            "I could not connect to the StockGPT coach. Check the deployment logs and API route. For membership or billing questions, contact sales@stockgpt.pro.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          "group relative inline-flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full border px-4 text-[12px] font-black shadow-[0_10px_30px_rgba(221,177,89,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(221,177,89,0.3)]",
          locked
            ? "border-[#ddb159]/45 bg-[#ddb159]/12 text-[#ddb159]"
            : "border-[#ddb159]/70 bg-[#ddb159] text-[#07170f]",
        ].join(" ")}
      >
        <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/30 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
        <span className="relative">{locked ? "🔒" : "✦"}</span>
        <span className="relative">Ask StockGPT</span>
      </button>

      {open && locked && (
        <LockedExperience
          isAuthenticated={isAuthenticated}
          onClose={handleClose}
        />
      )}

      {open && !locked && (
        <div className="fixed inset-0 z-[90] overflow-hidden bg-black/55 p-2 backdrop-blur-md sm:p-5">
          <button
            type="button"
            aria-label="Close Ask StockGPT"
            onClick={handleClose}
            className="absolute inset-0 cursor-default"
          />

          <div className="relative mx-auto flex h-[calc(100dvh-1rem)] max-w-6xl overflow-hidden rounded-[28px] border border-[#ddb159]/35 bg-[#06140d] text-[#fbf4e5] shadow-[0_35px_110px_rgba(0,0,0,0.72)] sm:h-[min(860px,calc(100dvh-2.5rem))] sm:rounded-[36px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(221,177,89,0.18),transparent_30%),radial-gradient(circle_at_92%_14%,rgba(80,160,108,0.16),transparent_34%),linear-gradient(135deg,#06140d,#0a2015_48%,#06140d)]" />

            <div className="relative grid w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
              <aside className="hidden border-r border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] p-5 lg:flex lg:flex-col">
                <div className="flex items-center gap-3">
                  <PremiumOrb />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
                      StockGPT Coach
                    </p>
                    <p className="mt-0.5 text-[12px] font-semibold text-[#fbf4e5]/45">
                      Portfolio intelligence
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-[26px] border border-[#ddb159]/18 bg-[#06140d]/60 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                    Mode
                  </p>

                  <div className="mt-3 grid gap-2">
                    {[
                      ["portfolio", "Portfolio", "Holdings, alerts, P&L"],
                      ["rankings", "Rankings", "Scores, sectors, leaders"],
                      ["learn", "Learn", "Trading concepts"],
                      ["account", "Account", "Membership and billing"],
                    ].map(([mode, label, description]) => {
                      const selected = activeMode === mode;

                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            setActiveMode(
                              mode as
                                | "portfolio"
                                | "rankings"
                                | "learn"
                                | "account",
                            )
                          }
                          className={[
                            "rounded-2xl border px-3 py-3 text-left transition",
                            selected
                              ? "border-[#ddb159]/55 bg-[#ddb159]/14"
                              : "border-[#ddb159]/12 bg-[#fbf4e5]/[0.025] hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8",
                          ].join(" ")}
                        >
                          <p className="text-[13px] font-black text-[#fbf4e5]">
                            {label}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#fbf4e5]/42">
                            {description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[26px] border border-[#ddb159]/18 bg-[#06140d]/45 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                    Suggested prompts
                  </p>

                  <div className="mt-3 grid gap-2">
                    {visibleStarters.map((starter) => (
                      <button
                        key={starter.prompt}
                        type="button"
                        onClick={() => void sendQuestion(starter.prompt)}
                        className="rounded-2xl border border-[#ddb159]/16 bg-[#fbf4e5]/[0.035] px-3 py-3 text-left transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10"
                      >
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
                          {starter.eyebrow}
                        </p>
                        <p className="mt-1 text-[12px] font-bold leading-snug text-[#fbf4e5]/76">
                          {starter.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-[11px] font-medium leading-5 text-[#fbf4e5]/38">
                  Uses live StockGPT app context where available. For billing,
                  refunds or unclear account queries, use sales@stockgpt.pro.
                </p>
              </aside>

              <section className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
                <header className="relative border-b border-[#ddb159]/14 px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close Ask StockGPT"
                    className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-[#ddb159]/30 bg-[#06140d]/75 text-xl text-[#ddb159] transition hover:bg-[#ddb159]/10"
                  >
                    ×
                  </button>

                  <div className="flex items-center gap-3 pr-12 lg:hidden">
                    <PremiumOrb />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
                        Ask StockGPT
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-[#fbf4e5]/45">
                        Portfolio intelligence coach
                      </p>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                      ✦ Portfolio intelligence
                    </p>
                    <h2 className="mt-1 text-[30px] font-black leading-none tracking-[-0.05em] text-[#fbf4e5]">
                      Ask StockGPT
                    </h2>
                  </div>

                  <p className="mt-3 max-w-3xl text-[12px] font-medium leading-5 text-[#fbf4e5]/52 sm:text-[13px]">
                    A premium market coach for your portfolio, rankings, news,
                    alerts, trading concepts and membership questions.
                  </p>

                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                    {mobileStarterPrompts.map((starter) => (
                      <button
                        key={starter.prompt}
                        type="button"
                        onClick={() => void sendQuestion(starter.prompt)}
                        className="shrink-0 rounded-full border border-[#ddb159]/20 bg-[#fbf4e5]/[0.035] px-3 py-2 text-[11px] font-bold text-[#fbf4e5]/75"
                      >
                        {starter.label}
                      </button>
                    ))}
                  </div>
                </header>

                <main className="min-h-0 overflow-y-auto px-3 py-4 sm:px-5">
                  <div className="mx-auto grid max-w-3xl gap-3">
                    {messages.map((message, index) => (
                      <MessageBubble
                        key={`${message.role}-${index}`}
                        message={message}
                      />
                    ))}

                    {loading && (
                      <div className="flex justify-start">
                        <div className="max-w-[88%] rounded-[26px] rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] px-4 py-3 text-[#07170f] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[74%]">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="grid size-5 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">
                              S
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">
                              Analysing
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#07170f]/72">
                            <span>Reviewing rankings, portfolio and news</span>
                            <span className="flex gap-1">
                              <span className="size-1.5 animate-bounce rounded-full bg-[#07170f]/45 [animation-delay:0ms]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-[#07170f]/45 [animation-delay:120ms]" />
                              <span className="size-1.5 animate-bounce rounded-full bg-[#07170f]/45 [animation-delay:240ms]" />
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={bottomRef} />
                  </div>
                </main>

                <form
                  onSubmit={handleSubmit}
                  className="border-t border-[#ddb159]/14 bg-[#04140c]/92 p-3 sm:p-4"
                >
                  <div className="mx-auto max-w-3xl rounded-[26px] border border-[#ddb159]/28 bg-[#071b12] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_55px_rgba(0,0,0,0.3)]">
                    <textarea
                      ref={textareaRef}
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void sendQuestion();
                        }
                      }}
                      placeholder="Ask about your portfolio, rankings, market news, trading theory, alerts, membership..."
                      rows={2}
                      className="max-h-32 min-h-[58px] w-full resize-none bg-transparent px-3 py-2 text-[14px] font-medium leading-relaxed text-[#fbf4e5] outline-none placeholder:text-[#fbf4e5]/34"
                    />

                    <div className="flex items-center justify-between gap-2 px-2 pb-1">
                      <p className="hidden text-[10px] font-semibold text-[#fbf4e5]/35 sm:block">
                        Enter to send · Shift Enter for a new line
                      </p>

                      <div className="flex flex-1 items-center justify-end gap-2">
                        <Link
                          href="/portfolio"
                          onClick={handleClose}
                          className="hidden rounded-full border border-[#ddb159]/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/75 transition hover:bg-[#ddb159]/10 sm:inline-flex"
                        >
                          Portfolio
                        </Link>

                        <button
                          type="submit"
                          disabled={!question.trim() || loading}
                          className="inline-flex h-10 items-center justify-center rounded-full bg-[#ddb159] px-5 text-[12px] font-black uppercase tracking-[0.14em] text-[#07170f] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                        >
                          {loading ? "Thinking" : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
