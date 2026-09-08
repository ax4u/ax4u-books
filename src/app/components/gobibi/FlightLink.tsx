"use client";
import Link from "next/link";
import type { ComponentProps } from "react";

/** Fullscreen must be requested in the original click, not after async navigation. */
export default function FlightLink({ children, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href">) {
  return <Link {...props} href="/whale-flight" prefetch={false} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try { sessionStorage.setItem("gobibi.flight.enter", "1"); } catch { /* private browsing */ }
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => { /* CSS cinema mode remains available. */ });
    }
  }}>{children}</Link>;
}
