"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { deleteQuotes, readQuotesWithSource, saveQuote, saveRandomQuotePool } from "../../quotes/quoteStorage";
import { QuoteRecord } from "../../quotes/quoteTypes";
import { uploadMediaFile } from "../../notes/noteStorage";
import { AdminShell } from "../AdminShell";
import styles from "../notes/AdminNotes.module.scss";

const emptyBoardItem: QuoteRecord = {
  id: 0,
  category: "首頁白版",
  japanese: "",
  kana: "",
  chinese: "",
  frontAudioUrl: "",
  isRandomPool: false
};

export default function AdminQuotesClient() {
  const [items, setItems] = useState<QuoteRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuoteRecord>(emptyBoardItem);
  const [showEditor, setShowEditor] = useState(false);
  const [message, setMessage] = useState("首頁白版會儲存在資料庫。");
  const [storageSource, setStorageSource] = useState<"database" | "local">("database");
  const [savingPool, setSavingPool] = useState(false);
  const [randomPoolAvailable, setRandomPoolAvailable] = useState(true);

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    readQuotesWithSource(true)
      .then((result) => {
        setItems(result.quotes);
        setStorageSource(result.source);
        setRandomPoolAvailable(result.randomPoolAvailable);
        setMessage(
          result.source === "database"
            ? result.randomPoolAvailable
              ? "已載入資料庫首頁白版資料。"
              : "資料仍在，已用相容模式載入。套用 migration 後即可勾選首頁隨機池。"
            : `資料庫無法同步：${result.error ?? "請先確認 word_cards 資料表。"}`
        );
      })
      .catch(() => {
        setStorageSource("local");
        setMessage("資料庫讀取失敗，請先確認 word_cards 資料表。");
      });
  }, []);

  function persist(nextItems: QuoteRecord[], nextMessage: string) {
    setItems(nextItems);
    setMessage(nextMessage);
  }

  function openItemEditor(item: QuoteRecord) {
    setSelectedId(item.id);
    setDraft(item);
    setShowEditor(true);
    setMessage(`正在編輯「${item.japanese || item.chinese}」。`);
  }

  function resetDraft() {
    setSelectedId(null);
    setDraft({ ...emptyBoardItem, id: Date.now() });
    setShowEditor(true);
    setMessage("正在新增首頁白版資料。");
  }

  async function uploadAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMessage("正在上傳音檔。");

    try {
      const url = await uploadMediaFile(file, "audio");
      setDraft((current) => ({ ...current, frontAudioUrl: url }));
      setMessage("已上傳正面音檔。");
    } catch {
      setMessage("音檔上傳失敗，請確認 Supabase Storage 設定與 note-media bucket。");
    } finally {
      event.target.value = "";
    }
  }

  async function saveBoardItem(event: FormEvent) {
    event.preventDefault();

    const nextItem = {
      ...draft,
      id: selectedId ?? (draft.id || Date.now()),
      category: draft.category.trim() || "首頁白版",
      japanese: draft.japanese.trim(),
      kana: draft.kana.trim(),
      chinese: draft.chinese.trim(),
      frontAudioUrl: draft.frontAudioUrl.trim()
    };

    if (!nextItem.japanese || !nextItem.chinese) {
      setMessage("請至少輸入日文與中譯。");
      return;
    }

    setMessage(selectedId ? "正在更新首頁白版資料。" : "正在新增首頁白版資料。");

    if (storageSource === "local") {
      setMessage("資料庫尚未連線，未儲存。請先確認 word_cards 資料表。");
      return;
    }

    try {
      const savedItem = await saveQuote(nextItem, selectedId ? "update" : "create");
      const nextItems = selectedId
        ? items.map((item) => (item.id === selectedId ? savedItem : item))
        : [savedItem, ...items];

      persist(nextItems, selectedId ? "已更新首頁白版資料。" : "已新增首頁白版資料。");
      setSelectedId(savedItem.id);
      setDraft(savedItem);
      setShowEditor(false);
    } catch (error) {
      setMessage(`資料庫儲存失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與 site_quotes 資料表。"}`);
    }
  }

  async function deleteSelected() {
    if (!selectedItem) {
      setMessage("請先選取一筆首頁白版資料。");
      return;
    }

    setMessage("正在刪除首頁白版資料。");

    if (storageSource === "local") {
      setMessage("資料庫尚未連線，未刪除。請先確認 word_cards 資料表。");
      return;
    }

    try {
      await deleteQuotes([selectedItem.id]);
      const nextItems = items.filter((item) => item.id !== selectedItem.id);
      persist(nextItems, "已刪除首頁白版資料。");
      setSelectedId(null);
      setDraft(emptyBoardItem);
      setShowEditor(false);
    } catch (error) {
      setMessage(`資料庫刪除失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與 site_quotes 資料表。"}`);
    }
  }

  async function toggleRandomPool(item: QuoteRecord) {
    if (savingPool || storageSource === "local") {
      return;
    }

    if (!randomPoolAvailable) {
      setMessage("資料仍在，但資料庫尚未套用首頁隨機池 migration，目前不能儲存勾選。");
      return;
    }

    const selectedIds = items.filter((entry) => entry.isRandomPool).map((entry) => entry.id);
    const nextIds = item.isRandomPool ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id];

    if (nextIds.length > 10) {
      setMessage("首頁隨機池最多只能勾選 10 筆。");
      return;
    }

    setSavingPool(true);
    setMessage("正在更新首頁隨機池……");

    try {
      const nextItems = await saveRandomQuotePool(nextIds);
      setItems(nextItems);
      setMessage(`已儲存首頁隨機池，目前勾選 ${nextIds.length}／10 筆。`);
    } catch (error) {
      setMessage(`首頁隨機池儲存失敗：${error instanceof Error ? error.message : "請確認資料庫 migration 已套用。"}`);
    } finally {
      setSavingPool(false);
    }
  }

  return (
    <AdminShell>
      <div className={styles.listTools}>
        {showEditor ? (
          <button className={styles.ghostButton} type="button" onClick={() => setShowEditor(false)}>
            回列表
          </button>
        ) : (
          <button type="button" onClick={resetDraft}>
            新增白版
          </button>
        )}
        <div className={styles.toolSpacer} />
        <a className={styles.primaryLink} href="/" target="_blank" rel="noreferrer">
          看前台
        </a>
      </div>

      <p className={styles.statusMessage}>{message}</p>
      {!showEditor ? (
        <p className={styles.statusMessage}>
          {randomPoolAvailable
            ? `首頁只會讀取下方勾選的資料，再隨機顯示其中 1 筆。目前已勾選 ${items.filter((item) => item.isRandomPool).length}／10 筆。`
            : "目前使用相容模式：首頁暫時只讀最新 10 筆。套用 migration 後即可自行勾選隨機池。"}
        </p>
      ) : null}

      {showEditor ? (
        <form className={`${styles.editorForm} ${styles.wordEditorForm}`} onSubmit={saveBoardItem}>
          <div className={styles.wordCategoryRow}>
            <label>
              <span>分類</span>
              <input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
            </label>
          </div>

          <section className={styles.wordSidePanel}>
            <h2>正面</h2>
            <div className={`${styles.wordFrontRow} ${styles.quoteFrontRow}`}>
              <label>
                <span>日文</span>
                <textarea
                  value={draft.japanese}
                  placeholder="例：今日"
                  onChange={(event) => setDraft((current) => ({ ...current, japanese: event.target.value }))}
                />
              </label>
              <label>
                <span>中譯</span>
                <textarea value={draft.chinese} placeholder="例：今天" onChange={(event) => setDraft((current) => ({ ...current, chinese: event.target.value }))} />
              </label>
            </div>
            <div className={styles.wordAudioRow}>
              <label>
                <span>正面音檔</span>
                <input
                  value={draft.frontAudioUrl}
                  placeholder="可貼 URL，或直接上傳"
                  onChange={(event) => setDraft((current) => ({ ...current, frontAudioUrl: event.target.value }))}
                />
              </label>
              <label className={styles.uploadButton}>
                上傳
                <input type="file" accept="audio/*" onChange={uploadAudio} />
              </label>
            </div>
          </section>

          <div className={styles.formActions}>
            {selectedId ? (
              <button className={styles.ghostButton} type="button" onClick={deleteSelected}>
                刪除
              </button>
            ) : null}
            <button className={styles.ghostButton} type="button" onClick={() => setShowEditor(false)}>
              取消
            </button>
            <button type="submit">{selectedId ? "確認修改" : "新增白版"}</button>
          </div>
        </form>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.noteTable}>
            <thead>
              <tr>
                <th>首頁隨機（最多 10 筆）</th>
                <th>分類名稱</th>
                <th>日文</th>
                <th>中譯</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={selectedId === item.id ? styles.selectedRow : undefined}
                  onClick={() => openItemEditor(item)}
                >
                  <td>
                    <input
                      checked={item.isRandomPool}
                      disabled={savingPool || !randomPoolAvailable}
                      type="checkbox"
                      aria-label={`加入首頁隨機池 ${item.japanese || item.chinese}`}
                      onChange={() => toggleRandomPool(item)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td>{item.category}</td>
                  <td>{item.japanese}</td>
                  <td>{item.chinese}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4}>目前沒有首頁白版資料。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
