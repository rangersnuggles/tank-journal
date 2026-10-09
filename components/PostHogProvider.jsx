"use client";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { initAnalytics, sanitizeUrl } from "@/lib/analytics";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // initAnalytics() is idempotent; calling it here (child effects run before the
    // provider's) means the very first page view is captured too.
    if (pathname && initAnalytics()) {
      let url = window.location.origin + pathname;
      if (searchParams.toString()) url += "?" + searchParams.toString();
      posthog.capture("$pageview", { $current_url: sanitizeUrl(url) });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function PostHogProvider({ children }) {
  useEffect(() => {
    // Config (respect_dnt, URL masking, identified-only profiles) lives in lib/analytics.js.
    initAnalytics();
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
