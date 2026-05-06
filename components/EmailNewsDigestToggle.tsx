"use client";

import { useState } from "react";

export function EmailNewsDigestToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function updatePreference(nextValue: boolean) {
    setEnabled(nextValue);
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings/email-news-digest", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: nextValue }),
      });

      if (!res.ok) {
        setEnabled(!nextValue);
        setMessage("Could not save. Please try again.");
        return;
      }

      setMessage(nextValue ? "Daily digest enabled." : "Daily digest disabled.");
    } catch {
      setEnabled(!nextValue);
      setMessage("Could not connect. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#072116]/10 px-4 py-3 transition hover:border-[#ddb159]/40">
      <div>
        <p className="text-[13px] font-bold">Email news digests</p>
        <p className="mt-0.5 text-[11px] font-semibold text-[#072116]/50">
          Receive a daily 8am AI summary of the last 24 hours and what to watch
          next.
        </p>

        {message && (
          <p
            className={[
              "mt-1 text-[10px] font-bold",
              message.includes("Could not")
                ? "text-red-600"
                : "text-emerald-700",
            ].join(" ")}
          >
            {message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {saving && (
          <span className="text-[10px] font-bold text-[#072116]/40">
            Saving…
          </span>
        )}

        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void updatePreference(e.target.checked)}
          className="h-5 w-5 accent-[#ddb159]"
        />
      </div>
    </label>
  );
}
