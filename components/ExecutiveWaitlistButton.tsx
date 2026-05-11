"use client";

import { useState, useTransition } from "react";

export function ExecutiveWaitlistButton({
  initialJoined,
  disabled = false,
}: {
  initialJoined: boolean;
  disabled?: boolean;
}) {
  const [joined, setJoined] = useState(initialJoined);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function joinWaitlist() {
    if (joined || disabled || isPending) return;

    startTransition(async () => {
      setMessage("");

      try {
        const response = await fetch("/api/executive-waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

        if (!response.ok || !result.ok) {
          setMessage(result.message ?? "Unable to join waitlist.");
          return;
        }

        setJoined(true);
        setMessage(result.message ?? "You have joined the Executive waitlist.");
      } catch {
        setMessage("Unable to join waitlist. Please try again.");
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={joinWaitlist}
        disabled={joined || disabled || isPending}
        className={`flex h-12 w-full items-center justify-center rounded-2xl px-5 text-[12px] font-black uppercase tracking-[0.14em] transition ${
          joined || disabled
            ? "cursor-default border border-[#ddb159]/24 bg-[#ddb159]/12 text-[#ddb159]"
            : "bg-[#ddb159] text-[#061b12] hover:brightness-110"
        }`}
      >
        {disabled
          ? "Already Executive"
          : joined
            ? "Joined waitlist"
            : isPending
              ? "Joining..."
              : "Join Executive waitlist"}
      </button>

      {message && (
        <p className="mt-2 text-center text-[10px] font-bold text-[#ddb159]/80">
          {message}
        </p>
      )}
    </div>
  );
}
