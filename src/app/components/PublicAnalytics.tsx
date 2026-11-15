"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ID = "G-4G2HDKPMTF";
const ORIGIN = "https://gobibi.art";
// Navigation counts only: never load on accounts, readers or personal activities.
const PUBLIC_PATHS = new Set(["/", "/exhibition", "/privacy", "/terms"]);
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; "ga-disable-G-4G2HDKPMTF"?: boolean; };

export default function PublicAnalytics() {
  const pathname = usePathname();
  const lastPage = useRef<string | null>(null);
  useLayoutEffect(() => {
    const analytics = window as AnalyticsWindow;
    const allowed = window.location.origin === ORIGIN && PUBLIC_PATHS.has(pathname);
    analytics["ga-disable-G-4G2HDKPMTF"] = !allowed;
    if (!allowed) { lastPage.current = null; return; }
    const canonical = ORIGIN + pathname;
    analytics.dataLayer ??= [];
    analytics.gtag ??= function (...args: unknown[]) { analytics.dataLayer?.push(arguments); void args; };
    const gtag = analytics.gtag;
    if (!document.getElementById("gobibi-ga4")) {
      gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      gtag("js", new Date());
      gtag("config", ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_location: canonical, page_referrer: "", page_title: "GOBIBI" });
      const script = document.createElement("script");
      script.id = "gobibi-ga4"; script.async = true; script.referrerPolicy = "no-referrer";
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
      document.head.appendChild(script);
    }
    if (lastPage.current !== canonical) {
      gtag("set", { page_location: canonical, page_referrer: "", page_title: "GOBIBI" });
      gtag("event", "page_view", { send_to: ID, page_location: canonical, page_referrer: "", page_title: "GOBIBI" });
      lastPage.current = canonical;
    }
    return () => { analytics["ga-disable-G-4G2HDKPMTF"] = true; };
  }, [pathname]);
  // Clarity is intentionally absent because this site has child-facing experiences.
  return null;
}
