"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import styles from "../notes/AdminNotes.module.scss";

type ContentReport = {
  id: number;
  message: string;
  pageUrl: string;
  screenshotUrl: string;
  userAgent: string;
  createdAt: string;
};

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei"
  }).format(new Date(value));
}

export default function AdminReportsClient() {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("正在載入勘誤回報。");

  async function loadReports(active = true) {
    try {
      const response = await fetch("/api/content-reports", { cache: "no-store" });
      const payload = (await response.json()) as { reports?: ContentReport[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "讀取回報失敗。");
      }

      if (active) {
        setReports(payload.reports ?? []);
        setSelectedIds([]);
        setMessage((payload.reports?.length ?? 0) > 0 ? `已載入 ${payload.reports?.length ?? 0} 筆勘誤回報。` : "目前還沒有勘誤回報。");
      }
    } catch (error) {
      if (active) {
        setReports([]);
        setSelectedIds([]);
        setMessage(error instanceof Error ? error.message : "讀取回報失敗。");
      }
    }
  }

  useEffect(() => {
    let active = true;
    loadReports();

    return () => {
      active = false;
    };
  }, []);

  const allSelected = reports.length > 0 && selectedIds.length === reports.length;

  function toggleSelected(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : reports.map((report) => report.id));
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      setMessage("請先勾選要刪除的回報。");
      return;
    }

    const shouldDelete = window.confirm(`確定刪除 ${selectedIds.length} 筆勘誤回報嗎？`);

    if (!shouldDelete) {
      return;
    }

    setMessage("正在刪除已選回報。");

    try {
      const response = await fetch("/api/content-reports", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const payload = (await response.json()) as { deleted?: number; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "刪除失敗。");
      }

      const deletedIds = new Set(selectedIds);
      setReports((current) => current.filter((report) => !deletedIds.has(report.id)));
      setSelectedIds([]);
      setMessage(`已刪除 ${payload.deleted ?? selectedIds.length} 筆回報。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刪除失敗。");
    }
  }

  return (
    <AdminShell>
      <section className={styles.reportsPanel} aria-label="內容勘誤回報">
        <div className={styles.analyticsHeader}>
          <div>
            <p>內容勘誤</p>
            <h1>客人回報訊息</h1>
          </div>
          <span>最新 100 筆</span>
        </div>

        <div className={styles.reportTools}>
          <label>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>全選</span>
          </label>
          <button type="button" disabled={selectedIds.length === 0} onClick={deleteSelected}>
            刪除已選
          </button>
          <span>已選 {selectedIds.length} 筆</span>
        </div>

        <p className={styles.statusMessage}>{message}</p>

        <div className={styles.reportList}>
          {reports.map((report) => (
            <article key={report.id} className={`${styles.reportCard} ${selectedIds.includes(report.id) ? styles.reportCardSelected : ""}`}>
              <div className={styles.reportCardHeader}>
                <label className={styles.reportSelect}>
                  <input type="checkbox" checked={selectedIds.includes(report.id)} onChange={() => toggleSelected(report.id)} />
                  <strong>#{report.id}</strong>
                </label>
                <time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time>
              </div>
              <p>{report.message}</p>
              {report.pageUrl ? (
                <a href={report.pageUrl} target="_blank" rel="noreferrer">
                  {report.pageUrl}
                </a>
              ) : null}
              {report.screenshotUrl ? (
                <a className={styles.reportScreenshot} href={report.screenshotUrl} target="_blank" rel="noreferrer">
                  <img src={report.screenshotUrl} alt="勘誤回報截圖" />
                </a>
              ) : (
                <span className={styles.reportMeta}>沒有附截圖</span>
              )}
              {report.userAgent ? <small>{report.userAgent}</small> : null}
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
