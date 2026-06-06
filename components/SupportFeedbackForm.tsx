"use client";

import { useState } from "react";

const categories = [
  ["wrong_data", "Wrong data"],
  ["confusing_ai_answer", "Confusing AI answer"],
  ["billing_issue", "Billing issue"],
  ["bug", "Bug"],
  ["feature_request", "Feature request"],
  ["other", "Other"],
] as const;

export function SupportFeedbackForm() {
  const [category, setCategory] = useState<(typeof categories)[number][0]>("bug");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();

    if (trimmed.length < 8) {
      setStatus("Please add a little more detail.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/support/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          pagePath: window.location.pathname,
          userAgent: window.navigator.userAgent,
        }),
      });

      if (!response.ok) {
        setStatus("Could not send feedback. Email sales@stockgpt.pro if urgent.");
        return;
      }

      setMessage("");
      setStatus("Feedback sent. Thank you — it has been saved for review.");
    } catch {
      setStatus("Could not connect. Email sales@stockgpt.pro if urgent.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitFeedback} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
          Feedback type
        </span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as typeof category)}
          className="h-11 rounded-xl border border-[#072116]/10 bg-white px-3 text-[12px] font-bold text-[#072116] outline-none focus:border-[#ddb159]"
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#072116]/45">
          Message
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Tell us what happened, what looked wrong, or what would make StockGPT better."
          className="resize-none rounded-xl border border-[#072116]/10 bg-white px-3 py-3 text-[12px] font-semibold leading-5 text-[#072116] outline-none placeholder:text-[#072116]/30 focus:border-[#ddb159]"
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-semibold leading-5 text-[#072116]/45">
          For urgent billing or account issues, email sales@stockgpt.pro.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="h-10 shrink-0 rounded-full bg-[#072116] px-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#ddb159] transition hover:opacity-90 disabled:opacity-55"
        >
          {saving ? "Sending…" : "Send feedback"}
        </button>
      </div>

      {status && (
        <p className="text-[10px] font-bold leading-5 text-[#072116]/58">{status}</p>
      )}
    </form>
  );
}
