// Public-navigation statistics only; Clarity is deliberately not installed.
"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ID = "G-4G2HDKPMTF";
const ORIGIN = "https://gobibi.art";
const PUBLIC_PATHS = new Set(["/", "/exhibition", "/privacy", "/terms"]);
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; "ga-disable-G-4G2HDKPMTF"?: boolean; };

export default function PublicAnalytics() {
  const pathname = usePathname();
    const lastPage = useRef<string | null>(null);
      useLayoutEffect(() => {
          const analytics = window as AnalyticsWindow;
              const safeUrl = (url: URL) => url.origin === ORIGIN && PUBLIC_PATHS.has(url.pathname) && !url.search && !url.hash;
                  const referrerSafe = (() => {
                        if (!document.referrer) return true;
                              try { return safeUrl(new URL(document.referrer)); } catch { return false; }
                                  })();
                                      const safeTarget = (url?: string | URL | null) => {
                                            try { return referrerSafe && safeUrl(new URL(url ?? window.location.href, window.location.href)); } catch { return false; }
                                                };
                                                    const sync = () => {
                                                          const allowed = safeTarget();
                                                                analytics["ga-disable-G-4G2HDKPMTF"] = !allowed;
                                                                      if (!allowed) { lastPage.current = null; return; }
                                                                            const canonical = ORIGIN + window.location.pathname;
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
                                                                                                                                                                                                          };
                                                                                                                                                                                                              // Disable before router/history observers can see an unsafe destination.
                                                                                                                                                                                                                  const originalPush = window.history.pushState;
                                                                                                                                                                                                                      const originalReplace = window.history.replaceState;
                                                                                                                                                                                                                          const guard = (original: History["pushState"]): History["pushState"] => function (data, unused, url) {
                                                                                                                                                                                                                                analytics["ga-disable-G-4G2HDKPMTF"] = !safeTarget(url);
                                                                                                                                                                                                                                      original.call(window.history, data, unused, url);
                                                                                                                                                                                                                                            sync();
                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                    const guardedPush = guard(originalPush);
                                                                                                                                                                                                                                                        const guardedReplace = guard(originalReplace);
                                                                                                                                                                                                                                                            window.history.pushState = guardedPush;
                                                                                                                                                                                                                                                                window.history.replaceState = guardedReplace;
                                                                                                                                                                                                                                                                    window.addEventListener("popstate", sync);
                                                                                                                                                                                                                                                                        window.addEventListener("hashchange", sync);
                                                                                                                                                                                                                                                                            sync();
                                                                                                                                                                                                                                                                                return () => {
                                                                                                                                                                                                                                                                                      analytics["ga-disable-G-4G2HDKPMTF"] = true;
                                                                                                                                                                                                                                                                                            window.removeEventListener("popstate", sync);
                                                                                                                                                                                                                                                                                                  window.removeEventListener("hashchange", sync);
                                                                                                                                                                                                                                                                                                        if (window.history.pushState === guardedPush) window.history.pushState = originalPush;
                                                                                                                                                                                                                                                                                                              if (window.history.replaceState === guardedReplace) window.history.replaceState = originalReplace;
                                                                                                                                                                                                                                                                                                                  };
                                                                                                                                                                                                                                                                                                                    }, [pathname]);
                                                                                                                                                                                                                                                                                                                      return null;
                                                                                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                                                                                      