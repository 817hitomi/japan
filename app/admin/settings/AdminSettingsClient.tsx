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
  const [activeSlot, setActiveSlot] = useState<AdSlotId>("global-head");
  const [message, setMessage] = useState("正在載入設定。");
  const activeAd = ads.find((item) => item.slot === activeSlot) ?? ads[0];
  const isGlobalHeadSlot = activeAd.slot === "global-head";

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      const adsResult = await readAdsWithSource();

      if (!active) {
        return;
      }

      setAds(adsResult.ads);

      if (adsResult.source === "database") {
        setMessage("已載入廣告設定。");
        return;
      }

      setMessage(`廣告設定暫時使用本機備援。${adsResult.error ?? ""}`.trim());
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  function updateAd(slot: AdSlotId, patch: Partial<AdSetting>) {
    setAds((current) =>
      current.map((item) => {
        if (item.slot !== slot) {
          return item;
        }

        const nextItem = { ...item, ...patch };
        return item.slot === "global-head" ? { ...nextItem, channel: "html" } : nextItem;
      })
    );
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setMessage("正在儲存設定。");

    try {
      const savedAds = await saveAdSettings(ads);
      setAds(savedAds);
      setMessage("已儲存廣告設定，前台重新整理後會套用。");
    } catch (error) {
      writeStoredAds(ads);
      setMessage(`資料庫儲存失敗，已先暫存到本機。${error instanceof Error ? error.message : "請確認 Supabase 資料表與環境變數。"}`);
    }
  }

  return (
    <AdminShell>
      <form className={styles.settingsForm} onSubmit={saveSettings}>
        <section className={styles.settingsHero}>
          <div>
            <span>網站設定</span>
            <h1>通路王／AdSense 版位</h1>
          </div>
          <button type="submit">確認修改</button>
        </section>

        <p className={styles.statusMessage}>{message}</p>

        <section className={styles.settingsSection}>
          <h2>廣告設定</h2>
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
            <div className={isGlobalHeadSlot ? styles.adHeadPreview : styles.adPreview}>
              {isGlobalHeadSlot ? (
                <code>{activeAd.htmlCode.trim() || "尚未設定全站 AdSense 驗證碼"}</code>
              ) : activeAd.channel === "html" && activeAd.htmlCode.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: activeAd.htmlCode }} />
              ) : activeAd.imageUrl ? (
                <img src={activeAd.imageUrl} alt="" />
              ) : null}
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
                  <option value="html">AdSense HTML／Script</option>
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
                      placeholder="貼上 banner 圖片網址，或直接上傳圖片"
                      onChange={(event) => updateAd(activeAd.slot, { imageUrl: event.target.value })}
                    />
                  </label>
                  <label>
                    <span>圖片說明</span>
                    <input
                      value={activeAd.altText}
                      placeholder="廣告圖片說明"
                      onChange={(event) => updateAd(activeAd.slot, { altText: event.target.value })}
                    />
                  </label>
                  <div className={styles.uploadActions}>
                    <label className={styles.uploadButton}>
                      上傳圖片
                      <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, (url) => updateAd(activeAd.slot, { enabled: true, imageUrl: url }))} />
                    </label>
                    <button className={styles.ghostButton} type="button" onClick={() => updateAd(activeAd.slot, { imageUrl: "" })}>
                      移除圖片
                    </button>
                  </div>
                </>
              ) : (
                <label className={styles.htmlCodeField}>
                  <span>程式碼</span>
                  <textarea
                    value={activeAd.htmlCode}
                    placeholder="貼上 AdSense 提供的 HTML／Script"
                    onChange={(event) => updateAd(activeAd.slot, { htmlCode: event.target.value })}
                  />
                </label>
              )}
            </div>
          </section>
        </section>

      </form>
    </AdminShell>
  );
}
