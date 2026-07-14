"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const visitorIdStorageKey = "japannote-visitor-id";
const siteStatsEventName = "japannote-site-stats";

export function FrontendInteractionGuard() {
  const pathname = usePathname();
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPage) {
      return;
    }

    function preventContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, [isAdminPage]);

  useEffect(() => {
    if (isAdminPage) {
      return;
    }

    async function recordSiteVisit() {
      try {
        let visitorId = window.localStorage.getItem(visitorIdStorageKey);

        if (!visitorId) {
          visitorId = window.crypto.randomUUID();
          window.localStorage.setItem(visitorIdStorageKey, visitorId);
        }

        const response = await fetch("/api/site-stats", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: `${window.location.pathname}${window.location.search}`, visitorId })
        });
        const payload = await response.json();

        window.dispatchEvent(new CustomEvent(siteStatsEventName, { detail: payload }));
      } catch {
        // Visit stats should never block the page.
      }
    }

    recordSiteVisit();
  }, [isAdminPage, pathname]);

  return null;
}
