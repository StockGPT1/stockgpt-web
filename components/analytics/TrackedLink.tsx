"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { trackClientEvent } from "@/lib/analytics/client-events";

type Props = ComponentProps<typeof Link> & {
  eventName: string;
  eventProperties?: Record<string, string | number | boolean | null>;
};

export function TrackedLink({
  eventName,
  eventProperties,
  onClick,
  ...props
}: Props) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    trackClientEvent(eventName, eventProperties);
    onClick?.(event);
  }

  return <Link {...props} onClick={handleClick} />;
}
