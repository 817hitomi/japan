"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import styles from "./page.module.scss";

type SubmitState = "idle" | "sending" | "sent" | "error";

export default function ContentReportDialog() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [statusText, setStatusText] = useState("請描述你看到的錯誤內容。");

  function resetForm() {
    setMessage("");
    setScreenshot(null);
    setSubmitState("idle");
    setStatusText("請描述你看到的錯誤內容。");
  }

  function closeDialog() {
    setOpen(false);
    resetForm();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setScreenshot(file);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!message.trim()) {
      setSubmitState("error");
      setStatusText("請先輸入想回報的內容。");
      return;
    }

    const formData = new FormData();
    formData.append("message", message.trim());
    formData.append("pageUrl", window.location.href);
    formData.append("userAgent", window.navigator.userAgent);

    if (screenshot) {
      formData.append("screenshot", screenshot);
    }

    setSubmitState("sending");
    setStatusText("正在送出回報。");

    try {
      const response = await fetch("/api/content-reports", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "送出失敗，請稍後再試。");
      }

      setSubmitState("sent");
      setStatusText("已收到回報，謝謝你幫忙修正內容。");
      setMessage("");
      setScreenshot(null);
      form.reset();
    } catch (error) {
      setSubmitState("error");
      setStatusText(error instanceof Error ? error.message : "送出失敗，請稍後再試。");
    }
  }

  return (
    <>
      <button className={styles.footerTextButton} type="button" onClick={() => setOpen(true)}>
        勘誤回報
      </button>

      {open ? (
        <div className={styles.reportBackdrop} role="dialog" aria-modal="true" aria-labelledby="content-report-title">
          <form className={styles.reportDialog} onSubmit={submitReport}>
            <div className={styles.reportHeader}>
              <div>
                <p>Content Report</p>
                <h2 id="content-report-title">內容勘誤回報</h2>
              </div>
              <button type="button" aria-label="關閉回報視窗" onClick={closeDialog}>
                ×
              </button>
            </div>

            <label className={styles.reportField}>
              <span>留言</span>
              <textarea
                value={message}
                placeholder="請告訴我哪裡有錯，例如單字、翻譯、例句或頁面位置。"
                rows={5}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <label className={styles.reportUpload}>
              <span>截圖畫面</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
              <small>{screenshot ? screenshot.name : "可選擇 PNG、JPG、WebP 或 GIF 圖片。"}</small>
            </label>

            <p className={submitState === "error" ? styles.reportError : styles.reportStatus}>{statusText}</p>

            <div className={styles.reportActions}>
              <button type="button" onClick={closeDialog}>
                取消
              </button>
              <button type="submit" disabled={submitState === "sending"}>
                {submitState === "sending" ? "送出中" : "送出回報"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
