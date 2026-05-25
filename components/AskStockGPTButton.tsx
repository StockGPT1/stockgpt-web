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

type Mode = "portfolio" | "rankings" | "learn" | "account";

type StarterPrompt = {
  label: string;
  prompt: string;
  eyebrow: string;
  mode: Mode;
};

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content:
    "I’m your StockGPT coach. Ask me about your portfolio, rankings, alerts, market news, stop-losses, take-profit levels, trading concepts, membership questions, or even something slightly messy. I’ll work out what you mean and keep the conversation flowing.",
};

const modeOptions: Array<{
  mode: Mode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    mode: "portfolio",
    label: "Portfolio",
    shortLabel: "Portfolio",
    description: "Holdings, alerts, P&L",
  },
  {
    mode: "rankings",
    label: "Rankings",
    shortLabel: "Rank",
    description: "Scores, sectors, leaders",
  },
  {
    mode: "learn",
    label: "Learn",
    shortLabel: "Learn",
    description: "Trading concepts",
  },
  {
    mode: "account",
    label: "Account",
    shortLabel: "Account",
    description: "Membership and billing",
  },
];

const starterPrompts: StarterPrompt[] = [
  {
    eyebrow: "Portfolio coach",
    label: "Find weakest holding",
    prompt: "What is my weakest holding and what should I do about it?",
    mode: "portfolio",
  },
  {
    eyebrow: "Action plan",
    label: "Trim, hold, sell, or buy more",
    prompt:
      "Which stocks in my portfolio should I trim, hold, sell, or buy more?",
    mode: "portfolio",
  },
  {
    eyebrow: "Risk control",
    label: "Stop-loss and take-profit",
    prompt: "What are the key stop-loss and take-profit levels in my portfolio?",
    mode: "portfolio",
  },
  {
    eyebrow: "Rankings",
    label: "Strongest stocks today",
    prompt: "Which stocks are ranking strongest right now and why?",
    mode: "rankings",
  },
  {
    eyebrow: "Rankings",
    label: "Compare my holdings",
    prompt: "How do my current holdings compare to the top-ranked stocks?",
    mode: "rankings",
  },
  {
    eyebrow: "Learning",
    label: "Risk/reward and sizing",
    prompt: "Explain risk/reward and position sizing like a market coach.",
    mode: "learn",
  },
  {
    eyebrow: "Learning",
    label: "Stop-loss theory",
    prompt:
      "Explain how stop-losses should be used without getting shaken out too early.",
    mode: "learn",
  },
  {
    eyebrow: "Account",
    label: "Membership and billing",
    prompt: "How do I manage my StockGPT membership or billing?",
    mode: "account",
  },
  {
    eyebrow: "Account",
    label: "Subscription help",
    prompt:
      "Who should I contact if I have a StockGPT subscription or payment issue?",
    mode: "account",
  },
];

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
      <ul key={`bullets-${blocks.length}`} className="mt-2 grid gap-1.5 pl-4">
        {bulletBuffer.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="list-disc text-[13px] leading-relaxed"
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
          className="mt-3 text-[12px] font-black uppercase tracking-[0.14em] text-[#ddb159]"
        >
          {trimmed.replace(/^###\s+/, "")}
        </p>,
      );
      return;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="mt-2 text-[13px] leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushBullets();

  return <>{blocks}</>;
}

function PremiumOrb({ small = false }: { small?: boolean }) {
  return (
    <span
      className={[
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#ddb159]/40 bg-[#092418] shadow-[0_10px_35px_rgba(221,177,89,0.18)]",
        small ? "size-8" : "size-9",
      ].join(" ")}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.28),transparent_24%),radial-gradient(circle_at_70%_80%,rgba(221,177,89,0.22),transparent_42%)]" />
      <span
        className={[
          "relative font-black text-[#ddb159]",
          small ? "text-[13px]" : "text-[15px]",
        ].join(" ")}
      >
        S
      </span>
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={[
        "flex w-full min-w-0",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <div
        className={[
          "min-w-0 max-w-[88%] overflow-hidden break-words rounded-[22px] px-3.5 py-3 text-[13px] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[82%] md:max-w-[76%]",
          "[overflow-wrap:anywhere]",
          isUser
            ? "rounded-br-md bg-[#ddb159] text-[#07170f]"
            : "rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] text-[#07170f]",
        ].join(" ")}
      >
        {!isUser && (
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">
              S
            </span>
            <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">
              StockGPT Coach
            </span>
          </div>
        )}

        <div className="min-w-0 [&>p:first-child]:mt-0">
          {renderMessageContent(message.content)}
        </div>
      </div>
    </div>
  );
}

function DesktopPromptCard({
  starter,
  onClick,
}: {
  starter: StarterPrompt;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border border-[#ddb159]/16 bg-[#fbf4e5]/[0.035] px-3 py-2.5 text-left transition hover:border-[#ddb159]/45 hover:bg-[#ddb159]/10"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ddb159]/75">
            {starter.eyebrow}
          </p>
          <p className="mt-1 text-[12px] font-bold leading-snug text-[#fbf4e5]/78">
            {starter.label}
          </p>
        </div>

        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-[#ddb159]/18 text-[11px] font-black text-[#ddb159]/60 transition group-hover:border-[#ddb159]/45 group-hover:text-[#ddb159]">
          →
        </span>
      </div>
    </button>
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
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black/60 p-0 backdrop-blur-md sm:p-3 lg:p-5">
      <button
        type="button"
        aria-label="Close Ask StockGPT"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative mx-auto grid h-[100dvh] w-[100dvw] max-w-[100dvw] overflow-hidden rounded-none bg-[#06140d] text-[#fbf4e5] shadow-[0_35px_110px_rgba(0,0,0,0.72)] sm:h-[calc(100dvh-1.5rem)] sm:max-w-5xl sm:rounded-[34px] sm:border sm:border-[#ddb159]/25 lg:h-[min(820px,calc(100dvh-2.5rem))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(221,177,89,0.18),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(72,140,94,0.18),transparent_35%),linear-gradient(135deg,#06140d,#0b2417_48%,#06140d)]" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Ask StockGPT"
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full border border-[#ddb159]/30 bg-[#06140d]/70 text-xl text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:right-4 sm:top-4"
        >
          ×
        </button>

        <div className="relative grid min-h-0 w-full max-w-full lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex min-h-0 min-w-0 flex-col justify-between overflow-y-auto p-5 pt-16 sm:p-8 sm:pt-20 lg:p-10">
            <div>
              <div className="flex min-w-0 items-center gap-3">
                <PremiumOrb />
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159]">
                    Premium intelligence
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-semibold text-[#fbf4e5]/45">
                    Portfolio-aware AI coach
                  </p>
                </div>
              </div>

              <h2 className="mt-7 max-w-xl text-[38px] font-black leading-[0.94] tracking-[-0.06em] text-[#fbf4e5] sm:text-[52px] lg:text-[58px]">
                Ask StockGPT is a subscriber feature.
              </h2>

              <p className="mt-5 max-w-xl text-[14px] font-medium leading-7 text-[#fbf4e5]/64 sm:text-[15px]">
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

          <aside className="hidden min-h-0 overflow-y-auto border-l border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] p-8 lg:block">
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
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<Mode>("portfolio");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locked = !canUseAskStockGPT;

  const visibleStarters = useMemo(() => {
    return starterPrompts.filter((prompt) => prompt.mode === activeMode);
  }, [activeMode]);

  const mobileStarters = useMemo(() => {
    return visibleStarters.slice(0, 2);
  }, [visibleStarters]);

  const showStarterCards = messages.length <= 1 && !loading && !historyLoading;

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscrollBehavior;
    };
  }, [open]);

  useEffect(() => {
    if (!open || locked) return;

    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);

      try {
        const response = await fetch("/api/ask-stockgpt", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const data = (await response.json().catch(() => null)) as {
          messages?: ChatMessage[];
        } | null;

        if (cancelled) return;

        const savedMessages = Array.isArray(data?.messages)
          ? data.messages.filter(
              (message): message is ChatMessage =>
                message !== null &&
                typeof message === "object" &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string" &&
                message.content.trim().length > 0,
            )
          : [];

        setMessages(savedMessages.length > 0 ? savedMessages : [welcomeMessage]);
      } catch {
        if (!cancelled) setMessages([welcomeMessage]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [open, locked]);

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
  }, [messages, loading, historyLoading, locked]);

  async function clearHistory() {
    setMessages([welcomeMessage]);

    try {
      await fetch("/api/ask-stockgpt", {
        method: "DELETE",
      });
    } catch {
      // Keep local clear even if the server request fails.
    }
  }

  async function sendQuestion(nextQuestion?: string) {
    if (locked) return;

    const text = (nextQuestion ?? question).trim();
    if (!text || loading || historyLoading) return;

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
          messages: nextMessages.slice(-14),
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
        <div className="fixed inset-0 z-[90] h-[100dvh] w-[100dvw] max-w-[100dvw] overflow-hidden bg-black/60 p-0 backdrop-blur-md sm:p-3 xl:p-5">
          <button
            type="button"
            aria-label="Close Ask StockGPT"
            onClick={handleClose}
            className="absolute inset-0 hidden cursor-default sm:block"
          />

          <div className="relative mx-auto grid h-[100dvh] w-[100dvw] max-w-[100dvw] overflow-hidden rounded-none bg-[#06140d] text-[#fbf4e5] shadow-[0_35px_110px_rgba(0,0,0,0.72)] sm:h-[calc(100dvh-1.5rem)] sm:w-full sm:rounded-[30px] sm:border sm:border-[#ddb159]/25 xl:h-[min(860px,calc(100dvh-2.5rem))] xl:max-w-6xl xl:rounded-[36px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(221,177,89,0.18),transparent_30%),radial-gradient(circle_at_92%_14%,rgba(80,160,108,0.16),transparent_34%),linear-gradient(135deg,#06140d,#0a2015_48%,#06140d)]" />

            <div className="relative grid h-full min-h-0 w-full min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 border-r border-[#ddb159]/14 bg-[#fbf4e5]/[0.035] lg:grid lg:grid-rows-[auto_minmax(0,1fr)_auto]">
                <div className="shrink-0 px-5 pb-4 pt-5 xl:px-6 xl:pt-6">
                  <div className="flex items-center gap-3">
                    <PremiumOrb />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ddb159]">
                        StockGPT Coach
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold text-[#fbf4e5]/45">
                        Portfolio intelligence
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto px-5 pb-4 xl:px-6">
                  <div className="rounded-[24px] border border-[#ddb159]/18 bg-[#06140d]/60 p-3.5 xl:p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                      Mode
                    </p>

                    <div className="mt-3 grid gap-2">
                      {modeOptions.map((option) => {
                        const selected = activeMode === option.mode;

                        return (
                          <button
                            key={option.mode}
                            type="button"
                            onClick={() => setActiveMode(option.mode)}
                            className={[
                              "rounded-2xl border px-3 py-2.5 text-left transition",
                              selected
                                ? "border-[#ddb159]/55 bg-[#ddb159]/14"
                                : "border-[#ddb159]/12 bg-[#fbf4e5]/[0.025] hover:border-[#ddb159]/35 hover:bg-[#ddb159]/8",
                            ].join(" ")}
                          >
                            <p className="text-[13px] font-black leading-tight text-[#fbf4e5]">
                              {option.label}
                            </p>
                            <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#fbf4e5]/42">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-[#ddb159]/18 bg-[#06140d]/45 p-3.5 xl:p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159]">
                      Suggested prompts
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-[#fbf4e5]/42">
                      Tailored to the selected mode.
                    </p>

                    <div className="mt-3 grid gap-2">
                      {visibleStarters.slice(0, 3).map((starter) => (
                        <DesktopPromptCard
                          key={starter.prompt}
                          starter={starter}
                          onClick={() => void sendQuestion(starter.prompt)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-[#ddb159]/12 px-5 py-3 xl:px-6 xl:py-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ddb159]/70">
                      Chat log
                    </p>
                    <button
                      type="button"
                      onClick={() => void clearHistory()}
                      className="rounded-full border border-[#ddb159]/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#ddb159]/70 transition hover:bg-[#ddb159]/10 hover:text-[#ddb159]"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[10.5px] font-medium leading-5 text-[#fbf4e5]/38">
                    Last 7 days are saved. For billing, refunds or unclear
                    account queries, use{" "}
                    <span className="font-bold text-[#ddb159]/75">
                      sales@stockgpt.pro
                    </span>
                    .
                  </p>
                </div>
              </aside>

              <section className="grid min-h-0 min-w-0 max-w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:col-start-2">
                <header className="relative shrink-0 border-b border-[#ddb159]/14 px-4 pb-4 pt-5 sm:px-4 lg:px-5 lg:py-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <PremiumOrb small />
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[#ddb159] lg:hidden">
                          Ask StockGPT
                        </p>
                        <p className="hidden text-[10px] font-black uppercase tracking-[0.24em] text-[#ddb159] lg:block">
                          ✦ Portfolio intelligence
                        </p>
                        <h2 className="hidden text-[28px] font-black leading-none tracking-[-0.05em] text-[#fbf4e5] lg:mt-1 lg:block xl:text-[30px]">
                          Ask StockGPT
                        </h2>
                        <p className="mt-0.5 truncate text-[12px] font-semibold text-[#fbf4e5]/45 lg:hidden">
                          Portfolio intelligence coach
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void clearHistory()}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-[#ddb159]/25 bg-[#06140d]/65 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#ddb159]/80 transition hover:bg-[#ddb159]/10"
                        aria-label="Clear Ask StockGPT chat log"
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close Ask StockGPT"
                        className="grid size-9 place-items-center rounded-full border border-[#ddb159]/30 bg-[#06140d]/75 text-xl text-[#ddb159] transition hover:bg-[#ddb159]/10 sm:size-10"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 max-w-full text-[12px] font-medium leading-5 text-[#fbf4e5]/52 sm:text-[13px]">
                    A premium market coach for your portfolio, rankings, news,
                    alerts, trading concepts and membership questions.
                  </p>

                  <div className="mt-4 grid grid-cols-4 gap-1.5 lg:hidden">
                    {modeOptions.map((option) => {
                      const selected = activeMode === option.mode;

                      return (
                        <button
                          key={option.mode}
                          type="button"
                          onClick={() => setActiveMode(option.mode)}
                          className={[
                            "min-w-0 rounded-full border px-1.5 py-2 text-center text-[10px] font-black transition",
                            selected
                              ? "border-[#ddb159]/70 bg-[#ddb159] text-[#07170f]"
                              : "border-[#ddb159]/20 bg-[#fbf4e5]/[0.035] text-[#fbf4e5]/72",
                          ].join(" ")}
                        >
                          <span className="block truncate">
                            {option.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {showStarterCards && (
                    <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
                      {mobileStarters.map((starter) => (
                        <button
                          key={starter.prompt}
                          type="button"
                          onClick={() => void sendQuestion(starter.prompt)}
                          className="min-h-[66px] min-w-0 rounded-2xl border border-[#ddb159]/18 bg-[#fbf4e5]/[0.04] px-3 py-2.5 text-left text-[11px] font-bold leading-snug text-[#fbf4e5]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                        >
                          <span className="block truncate text-[8px] font-black uppercase tracking-[0.13em] text-[#ddb159]/72">
                            {starter.eyebrow}
                          </span>
                          <span className="mt-1 block line-clamp-2">
                            {starter.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </header>

                <main className="min-h-0 max-w-full overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
                  <div className="mx-auto grid max-w-3xl gap-3">
                    {historyLoading && (
                      <div className="flex justify-center">
                        <div className="rounded-full border border-[#ddb159]/18 bg-[#fbf4e5]/[0.045] px-4 py-2 text-[11px] font-bold text-[#fbf4e5]/58">
                          Loading your 7-day chat log…
                        </div>
                      </div>
                    )}

                    {messages.map((message, index) => (
                      <MessageBubble
                        key={`${message.role}-${index}`}
                        message={message}
                      />
                    ))}

                    {loading && (
                      <div className="flex justify-start">
                        <div className="max-w-[88%] overflow-hidden break-words rounded-[22px] rounded-bl-md border border-[#ddb159]/20 bg-[#fbf4e5] px-3.5 py-3 text-[#07170f] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:max-w-[82%] md:max-w-[76%]">
                          <div className="mb-1.5 flex min-w-0 items-center gap-2">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#07170f] text-[9px] font-black text-[#ddb159]">
                              S
                            </span>
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[#07170f]/45">
                              Analysing
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#07170f]/72">
                            <span>Reading the conversation and app context</span>
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
                  className="shrink-0 border-t border-[#ddb159]/14 bg-[#04140c]/95 p-3 sm:p-3 lg:p-4"
                >
                  <div className="mx-auto max-w-3xl rounded-[24px] border border-[#ddb159]/28 bg-[#071b12] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_55px_rgba(0,0,0,0.3)] sm:rounded-[26px]">
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
                      placeholder="Ask naturally. Imperfect grammar is fine..."
                      rows={2}
                      className="max-h-28 min-h-[54px] w-full resize-none bg-transparent px-3 py-2 text-[13px] font-medium leading-relaxed text-[#fbf4e5] outline-none placeholder:text-[#fbf4e5]/34 sm:min-h-[58px] sm:text-[14px]"
                    />

                    <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-1">
                      <p className="hidden truncate text-[10px] font-semibold text-[#fbf4e5]/35 sm:block">
                        Enter to send · Shift Enter for a new line · 7-day log
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
                          disabled={!question.trim() || loading || historyLoading}
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