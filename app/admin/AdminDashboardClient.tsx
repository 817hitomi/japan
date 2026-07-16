"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./notes/AdminNotesClient";
import styles from "./notes/AdminNotes.module.scss";

type SiteAnalyticsHour = {
  label: string;
  visitors: number;
  views: number;
};

type SiteAnalyticsPage = {
  path: string;
  title: string;
  visitors: number;
  views: number;
  lastSeenAt: string;
};

type SiteAnalyticsSource = {
  source: string;
  visitors: number;
  views: number;
};

type SiteAnalytics = {
  totalVisitors: number;
  trackedVisitors: number;
  totalViews: number;
  hourly: SiteAnalyticsHour[];
  pages: SiteAnalyticsPage[];
  sources: SiteAnalyticsSource[];
};

export default function AdminDashboardClient() {
  const [analytics, setAnalytics] = useState<SiteAnalytics | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/admin/site-analytics", { cache: "no-store" });
        const payload = (await response.json()) as SiteAnalytics;

        if (active) {
          setAnalytics(payload);
        }
      } catch {
        if (active) {
          setAnalytics(null);
        }
      }
    }

    loadAnalytics();

    return () => {
      active = false;
    };
  }, []);

  const maxHourlyViews = Math.max(1, ...(analytics?.hourly.map((item) => item.views) ?? [0]));
  const hasHourlyData = (analytics?.hourly.length ?? 0) > 0;

  return (
    <AdminShell>
      <section className={styles.analyticsPanel} aria-label="網站瀏覽統計">
        <div className={styles.analyticsHeader}>
          <div>
            <p>網站統計</p>
            <h1>訪客與頁面瀏覽</h1>
          </div>
          <span>最近 24 小時</span>
        </div>

        <div className={styles.analyticsCards}>
          <div>
            <span>總訪客</span>
            <strong>{(analytics?.totalVisitors ?? 0).toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>有頁面紀錄的訪客</span>
            <strong>{(analytics?.trackedVisitors ?? 0).toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>頁面瀏覽</span>
            <strong>{(analytics?.totalViews ?? 0).toLocaleString("en-US")}</strong>
          </div>
        </div>

        <div className={styles.analyticsGrid}>
          {hasHourlyData ? (
            <div className={styles.hourlyChart}>
              {(analytics?.hourly ?? []).map((item) => (
                <div key={item.label} className={styles.hourlyBar}>
                  <span>{item.views}</span>
                  <div style={{ height: `${Math.max(8, (item.views / maxHourlyViews) * 100)}%` }} />
                  <small>{item.label.slice(-5)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.analyticsEmpty}>
              <strong>目前沒有瀏覽紀錄</strong>
              <span>開始有人瀏覽前台頁面後，這裡會顯示最近 24 小時的時間分布。</span>
            </div>
          )}

          <div className={styles.pageStats}>
            <h2>熱門頁面</h2>
            {(analytics?.pages.length ?? 0) > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>頁面</th>
                    <th>訪客</th>
                    <th>瀏覽</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.pages.map((page) => (
                    <tr key={page.path}>
                      <td>
                        <strong>{page.title}</strong>
                        <span>{page.path}</span>
                      </td>
                      <td>{page.visitors}</td>
                      <td>{page.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>尚未累積頁面瀏覽紀錄。</p>
            )}
          </div>
          <div className={styles.sourceStats}>
            <h2>訪客來源</h2>
            {(analytics?.sources.length ?? 0) > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>來源</th>
                    <th>訪客</th>
                    <th>瀏覽</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.sources.map((source) => (
                    <tr key={source.source}>
                      <td>
                        <strong>{source.source}</strong>
                      </td>
                      <td>{source.visitors}</td>
                      <td>{source.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>目前還沒有可辨識的來源資料。</p>
            )}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
