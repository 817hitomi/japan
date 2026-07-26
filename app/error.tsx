"use client";

import { useEffect } from "react";
import { readSessionStorage, writeSessionStorage } from "../lib/browserStorage";

const chunkRecoveryKey = "japannote-chunk-recovery";
const chunkRecoveryCooldownMs = 60_000;

export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route runtime failed", error);

    const isChunkLoadError =
      error.name === "ChunkLoadError" ||
      /Loading (?:CSS )?chunk \d+ failed|Failed to fetch dynamically imported module/i.test(error.message);

    if (!isChunkLoadError) {
      return;
    }

    const lastRecovery = Number(readSessionStorage(chunkRecoveryKey) ?? 0);
    if (Date.now() - lastRecovery < chunkRecoveryCooldownMs) {
      return;
    }

    writeSessionStorage(chunkRecoveryKey, String(Date.now()));
    window.location.reload();
  }, [error]);

  return (
    <main style={{ margin: "0 auto", maxWidth: 720, padding: "64px 24px", textAlign: "center" }}>
      <h1>頁面暫時無法顯示</h1>
      <p>載入內容時發生錯誤，請稍後再試。</p>
      <button type="button" onClick={reset}>
        再試一次
      </button>
    </main>
  );
}
