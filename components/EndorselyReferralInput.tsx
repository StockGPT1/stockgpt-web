"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    endorsely_referral?: string;
  }
}

export function EndorselyReferralInput() {
  const [referral, setReferral] = useState("");

  useEffect(() => {
    function readReferral() {
      if (typeof window !== "undefined" && window.endorsely_referral) {
        setReferral(window.endorsely_referral);
      }
    }

    readReferral();

    const interval = window.setInterval(readReferral, 500);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <input
      type="hidden"
      name="endorsely_referral"
      value={referral}
      readOnly
    />
  );
}
