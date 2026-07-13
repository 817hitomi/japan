"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AdSetting, AdSlotId, defaultAdSettings } from "../../ads/adTypes";
import { readAdsWithSource, saveAdSettings, writeStoredAds } from "../../ads/adStorage";
import { AdminShell } from "../notes/AdminNotesClient";
import styles from "../notes/AdminNotes.module.scss";

function readFileAsDataUrl(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result));
  reader.readAsDataURL(file);
  event.target.value = "";
}

export default function AdminSettingsClient() {
  const [ads, setAds] = useState<AdSetting[]>(defaultAdSettings);
  const [activeSlot, setActiveSlot] = useState<AdSlotId>("top-banner");
  const [message, setMessage] = useState("可先使用通路王的圖片連結或完整貼碼，之後再切換成 Google AdSense。");
  const activeAd = ads.find((item) => item.slot === activeSlot) ?? ads[0];

  useEffect(() => {
    let active = true;

    readAdsWithSource().then((result) => {
      if (active) {
        setAds(result.ads);
        setMessage(
          result.source === "database"
            ? "已載入資料庫廣告設定。"
            : `資料庫讀取失敗，暫時顯示本機廣告設定：${result.error ?? "請確認 Supabase site_ads 資料表與環境變數。"}`
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function updateAd(slot: AdSlotId, patch: Partial<AdSetting>) {
    setAds((current) => current.map((item) => (item.slot === slot ? { ...item, ...patch } : item)));
  }

  async function saveAds(event: FormEvent) {
    event.preventDefault();
    setMessage("正在儲存廣告設定。");

    try {
      const saved = await saveAdSettings(ads);
      setAds(saved);
      setMessage("已儲存廣告設定，前台重新整理後會套用。");
    } catch (error) {
      writeStoredAds(ads);
      setMessage(`資料庫儲存失敗，已先保存在本機瀏覽器：${error instanceof Error ? error.message : "請確認 Supabase site_ads 資料表與環境變數。"}`);
    }
  }

  return (
    <AdminShell>
      <form className={styles.settingsForm} onSubmit={saveAds}>
        <section className={styles.settingsHero}>
          <div>
            <span>廣告設定</span>
            <h1>通路王／AdSense 版位</h1>
          </div>
          <button type="submit">確認修改</button>
        </section>

        <p className={styles.statusMessage}>{message}</p>

        <div className={styles.adTabs} role="tablist" aria-label="廣告版位">
          {ads.map((ad) => (
            <button
              key={ad.slot}
              className={ad.slot === activeSlot ? styles.currentAdTab : undefined}
              type="button"
              onClick={() => setActiveSlot(ad.slot)}
            >
              {ad.label}
            </button>
          ))}
        </div>

        <section className={styles.adSettingsPanel}>
          <div className={styles.adPreview}>
            {activeAd.channel === "html" && activeAd.htmlCode.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: activeAd.htmlCode }} />
            ) : activeAd.imageUrl ? (
              <img src={activeAd.imageUrl} alt="" />
            ) : (
              <span>{activeAd.label}</span>
            )}
          </div>

          <div className={styles.adControlGrid}>
            <label className={styles.checkField}>
              <input
                type="checkbox"
                checked={activeAd.enabled}
                onChange={(event) => updateAd(activeAd.slot, { enabled: event.target.checked })}
              />
              <span>啟用</span>
            </label>

            <label>
              <span>模式</span>
              <select value={activeAd.channel} onChange={(event) => updateAd(activeAd.slot, { channel: event.target.value === "html" ? "html" : "affiliate" })}>
                <option value="affiliate">通路王圖片連結</option>
                <option value="html">完整 HTML／script 貼碼</option>
              </select>
            </label>

            {activeAd.channel === "affiliate" ? (
              <>
                <label>
                  <span>連結</span>
                  <input
                    value={activeAd.linkUrl}
                    placeholder="貼上通路王追蹤連結"
                    onChange={(event) => updateAd(activeAd.slot, { linkUrl: event.target.value })}
                  />
                </label>
                <label>
                  <span>圖片網址</span>
                  <input
                    value={activeAd.imageUrl}
                    placeholder="貼上 banner 圖片網址，或使用下方上傳"
                    onChange={(event) => updateAd(activeAd.slot, { imageUrl: event.target.value })}
                  />
                </label>
                <label>
                  <span>圖片說明</span>
                  <input
                    value={activeAd.altText}
                    placeholder="廣告圖片替代文字"
                    onChange={(event) => updateAd(activeAd.slot, { altText: event.target.value })}
                  />
                </label>
                <div className={styles.uploadActions}>
                  <label className={styles.uploadButton}>
                    上傳圖片
                    <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, (url) => updateAd(activeAd.slot, { imageUrl: url }))} />
                  </label>
                  <button className={styles.ghostButton} type="button" onClick={() => updateAd(activeAd.slot, { imageUrl: "" })}>
                    移除圖片
                  </button>
                </div>
              </>
            ) : (
              <label className={styles.htmlCodeField}>
                <span>貼碼</span>
                <textarea
                  value={activeAd.htmlCode}
                  placeholder="貼上通路王或日後 AdSense 提供的完整 HTML／script"
                  onChange={(event) => updateAd(activeAd.slot, { htmlCode: event.target.value })}
                />
              </label>
            )}
          </div>
        </section>
      </form>
    </AdminShell>
  );
}
