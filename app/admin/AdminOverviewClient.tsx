"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./notes/AdminNotesClient";
import styles from "./notes/AdminNotes.module.scss";

type SiteVisitOverview = {
  firstSeenAt: string | null;
  lastPath: string;
  lastSeenAt: string | null;
  visitCount: number;
};

type SiteStatsOverview = {
  latestVisitAt: string | null;
  recentVisits: SiteVisitOverview[];
  visitCount: number;
  visitorCount: number;
};

function formatVisitTime(value: string | null) {
  if (!value) {
    return "尚無紀錄";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "尚無紀錄";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatVisitPath(path: string) {
  if (!path || path === "/") {
    return "首頁";
  }

  if (path.startsWith("/words")) {
    return "單字卡";
  }

  if (path.startsWith("/notes")) {
    return "學習筆記";
  }

  if (path.startsWith("/?note=")) {
    return `文章 ${path.replace("/?", "?")}`;
  }

  return path;
}

export default function AdminOverviewClient() {
  const [siteStats, setSiteStats] = useState<SiteStatsOverview | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/site-stats", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: SiteStatsOverview | null) => {
        if (active && payload) {
          setSiteStats(payload);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell>
      <section className={styles.overviewPanel} aria-label="網站總覽">
        <div className={styles.overviewStats}>
          <div>
            <span>訪客</span>
            <strong>{(siteStats?.visitorCount ?? 0).toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>造訪</span>
            <strong>{(siteStats?.visitCount ?? 0).toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>最近來訪</span>
            <strong>{formatVisitTime(siteStats?.latestVisitAt ?? null)}</strong>
          </div>
        </div>
        <div className={styles.recentVisits}>
          {(siteStats?.recentVisits ?? []).length > 0 ? (
            siteStats?.recentVisits.map((visit, index) => (
              <div key={`${visit.lastSeenAt}-${index}`}>
                <span>{formatVisitTime(visit.lastSeenAt)}</span>
                <small>{formatVisitPath(visit.lastPath)}</small>
                <small>{visit.visitCount.toLocaleString("en-US")} 次</small>
              </div>
            ))
          ) : (
            <p>尚無來訪紀錄</p>
          )}
        </div>
      </section>
    </AdminShell>
  );
}
