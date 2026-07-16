"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateVisitorId } from "../lib/siteVisitor";

export function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPage) {
      return;
    }

    const visitorId = getOrCreateVisitorId();
    const pagePath = `${window.location.pathname}${window.location.search}`;

    fetch("/api/site-page-view", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId,
        pagePath,
        pageTitle: document.title,
        referrer: document.referrer
      })
    }).catch(() => {
      // Analytics should never block the public page.
    });
  }, [isAdminPage, pathname]);

  return null;
}
