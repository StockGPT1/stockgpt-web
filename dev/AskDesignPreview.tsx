"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { StockIcon } from "@/components/StockIcon";
import { nativeHaptic } from "@/lib/ios-native";
import { ElasticBubble } from "./LiquidNavigation";
import { StockGPTFlame } from "./StockGPTFlame";
import styles from "./AskDesignPreview.module.css";

type Mode = "portfolio" | "rankings" | "learn" | "account";
type Message = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; when: string; mode: Mode; messages: Message[] };

const contexts: Array<{ key: Mode; label: string }> = [
  { key: "portfolio", label: "My portfolio" },
  { key: "rankings", label: "Stock rankings" },
  { key: "learn", label: "Learn something" },
  { key: "account", label: "Account help" },
];
const suggestions: Record<Mode, string[]> = {
  portfolio: ["How is my portfolio looking?", "Where am I most exposed?", "Explain my latest changes"],
  rankings: ["What makes a strong ranking?", "Compare two stocks", "Explain the model factors"],
  learn: ["Explain risk and reward", "How does diversification work?", "Help me read a chart"],
  account: ["Manage my membership", "Help with my account", "How do I contact support?"],
};
const sampleConversations: Conversation[] = [
  {
    id: "sample-portfolio", title: "A closer look at my portfolio", when: "Today", mode: "portfolio",
    messages: [
      { role: "user", content: "Where am I most exposed?" },
      { role: "assistant", content: "In this example, technology is your largest sector. Several holdings can react to the same earnings and spending trends, even when they are different companies.\n\nLooking at sector exposure alongside your largest individual positions gives you a clearer picture of concentration. The live conversation would use your actual holdings and current portfolio data." },
    ],
  },
  {
    id: "sample-rankings", title: "Understanding the StockGPT score", when: "Yesterday", mode: "rankings",
    messages: [
      { role: "user", content: "What goes into a stock’s ranking?" },
      { role: "assistant", content: "The model brings together company quality, growth, valuation, market trends, risk and income. A strong result in one area can be balanced by a weaker result elsewhere.\n\nThe useful part is seeing which factors support the rank, which hold it back, and how complete the underlying data is. A score is a starting point for research." },
    ],
  },
];

function sampleReply(mode: Mode, question: string) {
  if (mode === "rankings" || /rank|score|compare/i.test(question)) {
    return "A useful comparison looks beyond the headline score. Company quality, valuation and growth explain the business, while momentum and risk show a different part of the picture.\n\nIn the live app, I’d bring those factors together with the latest available data and explain what is helping or holding back each stock. This reply is a design example.";
  }
  if (mode === "learn") {
    return "Start with what could change the outcome, how much uncertainty you’re comfortable with, and how the idea fits alongside your other investments.\n\nI can break the concept into plain language, then walk through a small example. This preview demonstrates the conversation style; it isn’t running a live analysis.";
  }
  if (mode === "account") {
    return "Your membership and account preferences are available in Settings. You can also find the available support options there.\n\nThis is a sample conversation, so no account settings have been changed.";
  }
  if (/expos|risk|concentrat/i.test(question)) return sampleConversations[0].messages[1].content;
  return "I’d start with what has changed, which positions contribute most to the overall result, and whether your portfolio still matches your goals.\n\nA rising balance alone doesn’t tell the whole story. Sector exposure, position size and the latest company data add context. In the live app, this conversation would use your actual portfolio.\n\nWhat would you like to look at first?";
}

function NewChatIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6" /><path d="m16 4 4 4M10 14l1-4 7-7a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-7 7-4 1Z" /></svg>;
}

export function AskDesignPreview({ onBack, initialPrompt }: { onBack: () => void; initialPrompt?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>(sampleConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("portfolio");
  const [question, setQuestion] = useState(initialPrompt ?? "");
  const [historyOpen, setHistoryOpen] = useState(false);
  const dialogId = useId();
  const sequence = useRef(0);
  const dialog = useRef<HTMLElement>(null);
  const chatButton = useRef<HTMLButtonElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const active = conversations.find((conversation) => conversation.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => {
    const input = textarea.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [question]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "instant" });
  }, [activeId, messages.length]);

  useEffect(() => {
    if (!historyOpen) return;
    const returnFocus = chatButton.current;
    const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("button")?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setHistoryOpen(false);
      }
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus();
    };
  }, [historyOpen]);

  function newConversation() {
    nativeHaptic("light");
    setActiveId(null);
    setQuestion("");
    setHistoryOpen(false);
  }

  function send(prompt = question) {
    const text = prompt.trim();
    if (!text) return;
    nativeHaptic("light");
    const id = activeId ?? `preview-conversation-${++sequence.current}`;
    const additions: Message[] = [{ role: "user", content: text }, { role: "assistant", content: sampleReply(mode, text) }];
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === id);
      const updated: Conversation = existing
        ? { ...existing, when: "Just now", mode, messages: [...existing.messages, ...additions] }
        : { id, title: text.length > 45 ? `${text.slice(0, 42)}…` : text, when: "Just now", mode, messages: additions };
      return [updated, ...current.filter((conversation) => conversation.id !== id)];
    });
    setActiveId(id);
    setQuestion("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  return (
    <section className={styles.workspace} aria-label="Ask StockGPT design preview">
      <div className={styles.page} inert={historyOpen}>
        <header className={styles.header}>
          <ElasticBubble className={styles.chatsBubble}>
            <button ref={chatButton} type="button" className={styles.chatsButton} aria-haspopup="dialog" aria-expanded={historyOpen} aria-controls={dialogId} onClick={() => { nativeHaptic("light"); setHistoryOpen(true); }}>Chats</button>
          </ElasticBubble>
          <div className={styles.headerTitle}>
            <strong>Ask StockGPT</strong>
            <label className={styles.context}>
              <span className={styles.visuallyHidden}>Conversation context</span>
              <span aria-hidden="true">{contexts.find((context) => context.key === mode)?.label}</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>{contexts.map((context) => <option key={context.key} value={context.key}>{context.label}</option>)}</select>
              <StockIcon name="chevron-down" className={styles.contextChevron} />
            </label>
          </div>
          <ElasticBubble className={styles.toolsBubble}>
            <button type="button" className={styles.iconButton} aria-label="New chat" onClick={newConversation}><NewChatIcon /></button>
            <span className={styles.divider} aria-hidden="true" />
            <button type="button" className={styles.iconButton} aria-label="Back to home" onClick={() => { nativeHaptic("light"); onBack(); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
          </ElasticBubble>
        </header>

        <main ref={scroller} className={styles.conversation} tabIndex={-1}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <StockGPTFlame className={styles.welcomeFlame} />
              <h1>What’s on your mind?</h1>
              <p>Your portfolio. The market. A little clarity.</p>
              <div className={styles.suggestions} aria-label="Suggested questions">
                {suggestions[mode].map((prompt) => <ElasticBubble key={prompt} className={styles.promptBubble}><button type="button" onClick={() => send(prompt)}>{prompt}<span aria-hidden="true">↗</span></button></ElasticBubble>)}
              </div>
            </div>
          ) : (
            <div className={styles.messageList} role="log" aria-label="Sample conversation" aria-live="polite" aria-relevant="additions">
              {messages.map((message, index) => (
                <article key={`${activeId}-${index}`} className={message.role === "user" ? styles.userMessage : styles.assistantMessage} aria-label={message.role === "user" ? "You" : "StockGPT sample reply"}>
                  {message.role === "assistant" && <div className={styles.assistantIdentity}><StockGPTFlame className={styles.replyFlame} /><span>StockGPT</span><small>EXAMPLE</small></div>}
                  <div className={message.role === "user" ? styles.userBubble : styles.answer}>{message.content.split("\n\n").map((paragraph, part) => <p key={part}>{paragraph}</p>)}</div>
                </article>
              ))}
            </div>
          )}
        </main>

        <footer className={styles.composerArea}>
          <form onSubmit={submit} className={styles.composer}>
            <button type="button" className={styles.plusButton} aria-label="Use a suggested question" onClick={() => { setQuestion(suggestions[mode][0]); textarea.current?.focus(); }}><StockIcon name="expand" className={styles.plusIcon} /></button>
            <textarea ref={textarea} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && window.matchMedia("(pointer: fine)").matches) { event.preventDefault(); send(); } }} placeholder="Ask anything…" rows={1} aria-label="Your question" />
            <ElasticBubble className={styles.sendBubble}><button type="submit" className={styles.sendButton} disabled={!question.trim()} aria-label="Send sample question"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 11 6-6 6 6M12 5v14" /></svg></button></ElasticBubble>
          </form>
          <p className={styles.previewLabel}>Design preview · Sample replies, no live analysis</p>
        </footer>
      </div>

      {historyOpen && <div className={styles.historyLayer}>
        <button type="button" tabIndex={-1} className={styles.scrim} aria-label="Close chats" onClick={() => setHistoryOpen(false)} />
        <aside ref={dialog} id={dialogId} className={styles.history} role="dialog" aria-modal="true" aria-label="Sample chat history">
          <div className={styles.historyHeader}><div><h2>Chats</h2><p>Sample conversations</p></div><ElasticBubble className={styles.closeBubble}><button type="button" className={styles.iconButton} aria-label="Close chat history" onClick={() => setHistoryOpen(false)}><StockIcon name="close" /></button></ElasticBubble></div>
          <ElasticBubble className={styles.newChatBubble}><button type="button" onClick={newConversation}><NewChatIcon />New chat</button></ElasticBubble>
          <div className={styles.historyList}>
            {conversations.length === 0 && <p className={styles.emptyHistory}>Your next conversation starts here.</p>}
            {conversations.map((conversation) => <button type="button" key={conversation.id} className={styles.historyItem} aria-current={activeId === conversation.id ? "true" : undefined} onClick={() => { setActiveId(conversation.id); setMode(conversation.mode); setQuestion(""); setHistoryOpen(false); nativeHaptic("light"); }}><span>{conversation.title}</span><small>{conversation.when}</small></button>)}
          </div>
          <div className={styles.historyFooter}><span>Only saved in this preview.</span><button type="button" onClick={() => { setConversations([]); setActiveId(null); setQuestion(""); }} aria-label="Clear sample conversations">Clear history</button></div>
        </aside>
      </div>}
    </section>
  );
}
