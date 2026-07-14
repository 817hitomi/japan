"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { deleteQuotes, readQuotesWithSource, saveQuote, writeStoredQuotes } from "../../quotes/quoteStorage";
import { QuoteRecord } from "../../quotes/quoteTypes";
import { uploadMediaFile } from "../../notes/noteStorage";
import { AdminShell } from "../notes/AdminNotesClient";
import styles from "../notes/AdminNotes.module.scss";

const emptyBoardItem: QuoteRecord = {
  id: 0,
  category: "首頁白版",
  japanese: "",
  kana: "",
  chinese: "",
  frontAudioUrl: ""
};

export default function AdminQuotesClient() {
  const [items, setItems] = useState<QuoteRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuoteRecord>(emptyBoardItem);
  const [showEditor, setShowEditor] = useState(false);
  const [message, setMessage] = useState("首頁白版會儲存在資料庫。");
  const [storageSource, setStorageSource] = useState<"database" | "local">("database");

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  useEffect(() => {
    readQuotesWithSource()
      .then((result) => {
        setItems(result.quotes);
        setStorageSource(result.source);
        setMessage(
          result.source === "database"
            ? "已載入資料庫首頁白版資料。"
            : "資料庫尚未建立首頁白版資料表，暫時使用本機資料。"
        );
      })
      .catch(() => {
        setStorageSource("local");
        setMessage("資料庫讀取失敗，暫時顯示本機資料。");
      });
  }, []);

  function persist(nextItems: QuoteRecord[], nextMessage: string) {
    setItems(nextItems);
    writeStoredQuotes(nextItems);
    setMessage(nextMessage);
  }

  function selectItem(item: QuoteRecord) {
    setSelectedId(item.id);
    setDraft(item);
    setMessage(`已選取「${item.japanese || item.chinese}」。`);
  }

  function resetDraft() {
    setSelectedId(null);
    setDraft({ ...emptyBoardItem, id: Date.now() });
    setShowEditor(true);
    setMessage("正在新增首頁白版資料。");
  }

  function editSelected() {
    if (!selectedItem) {
      setMessage("請先選取一筆首頁白版資料。");
      return;
    }

    setDraft(selectedItem);
    setShowEditor(true);
    setMessage("正在編輯首頁白版資料。");
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
      const savedItem = { ...nextItem, id: selectedId ?? nextItem.id };
      const nextItems = selectedId
        ? items.map((item) => (item.id === selectedId ? savedItem : item))
        : [savedItem, ...items];

      persist(nextItems, selectedId ? "已更新本機首頁白版資料。" : "已新增本機首頁白版資料。");
      setSelectedId(savedItem.id);
      setDraft(savedItem);
      setShowEditor(false);
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
      const nextItems = items.filter((item) => item.id !== selectedItem.id);
      persist(nextItems, "已刪除本機首頁白版資料。");
      setSelectedId(null);
      setDraft(emptyBoardItem);
      setShowEditor(false);
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

  return (
    <AdminShell>
      <div className={styles.listTools}>
        {showEditor ? (
          <button className={styles.ghostButton} type="button" onClick={() => setShowEditor(false)}>
            回列表
          </button>
        ) : (
          <>
            <button className={styles.ghostButton} type="button" onClick={editSelected}>
              編輯
            </button>
            <button className={styles.ghostButton} type="button" onClick={deleteSelected}>
              刪除
            </button>
            <button type="button" onClick={resetDraft}>
              新增白版
            </button>
          </>
        )}
        <div className={styles.toolSpacer} />
        <a className={styles.primaryLink} href="/" target="_blank" rel="noreferrer">
          看前台
        </a>
      </div>

      <p className={styles.statusMessage}>{message}</p>

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
            <div className={styles.wordFrontRow}>
              <label>
                <span>日文</span>
                <input
                  value={draft.japanese}
                  placeholder="例：今日"
                  onChange={(event) => setDraft((current) => ({ ...current, japanese: event.target.value }))}
                />
              </label>
              <label>
                <span>假名</span>
                <input
                  value={draft.kana}
                  placeholder="例：きょう"
                  onChange={(event) => setDraft((current) => ({ ...current, kana: event.target.value }))}
                />
              </label>
              <label>
                <span>中譯</span>
                <input value={draft.chinese} placeholder="例：今天" onChange={(event) => setDraft((current) => ({ ...current, chinese: event.target.value }))} />
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
                <th aria-label="選取" />
                <th>分類名稱</th>
                <th>日文</th>
                <th>中譯</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? styles.selectedRow : undefined} onClick={() => selectItem(item)}>
                  <td>
                    <input checked={selectedId === item.id} readOnly type="checkbox" aria-label={`選取 ${item.japanese || item.chinese}`} />
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
