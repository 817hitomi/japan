"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { splitStandaloneReading } from "../../../lib/japaneseText";
import { AdminShell } from "../notes/AdminNotesClient";
import { uploadMediaFile } from "../../notes/noteStorage";
import { deleteWordCards, readWordCardsWithSource, saveWordCard, writeStoredWordCards } from "../../words/wordStorage";
import { WordCardRecord } from "../../words/wordTypes";
import styles from "../notes/AdminNotes.module.scss";

const emptyWord: WordCardRecord = {
  id: 0,
  category: "N5",
  kana: "",
  japanese: "",
  chinese: "",
  exampleJapanese: "",
  exampleChinese: "",
  audioUrl: "",
  frontAudioUrl: "",
  backAudioUrl: ""
};

function getWordDuplicateKey(word: Pick<WordCardRecord, "japanese" | "kana">) {
  return `${word.japanese.trim()}\n${word.kana.trim()}`;
}

export default function AdminWordsClient() {
  const [words, setWords] = useState<WordCardRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<WordCardRecord>(emptyWord);
  const [showEditor, setShowEditor] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [message, setMessage] = useState("單字卡會儲存在資料庫。");

  const filteredWords = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) {
      return words;
    }

    return words.filter((word) =>
      [word.category, word.japanese, word.kana, word.chinese, word.exampleJapanese, word.exampleChinese]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [searchText, words]);

  useEffect(() => {
    readWordCardsWithSource()
      .then((result) => {
        setWords(result.words);
        setMessage(
          result.source === "database"
            ? "已載入資料庫單字。"
            : `資料庫讀取失敗，暫時顯示本機資料：${result.error ?? "請確認 Supabase 設定與 word_cards 資料表。"}`
        );
      })
      .catch(() => {
        setMessage("資料庫讀取失敗，暫時顯示本機資料。");
      });
  }, []);

  function persist(nextWords: WordCardRecord[], nextMessage: string) {
    setWords(nextWords);
    writeStoredWordCards(nextWords);
    setMessage(nextMessage);
  }

  function selectWord(word: WordCardRecord) {
    setSelectedId(word.id);
    setDraft(word);
    setMessage(`已選取「${word.japanese}」。`);
  }

  function resetDraft() {
    setSelectedId(null);
    setDraft({ ...emptyWord, id: Date.now() });
    setShowEditor(true);
    setMessage("正在新增單字。");
  }

  function editSelected() {
    if (!selectedId) {
      setMessage("請先選取一張單字卡。");
      return;
    }

    setShowEditor(true);
    setMessage("正在編輯單字。");
  }

  async function saveWord(event: FormEvent) {
    event.preventDefault();

    const standaloneReading = splitStandaloneReading(draft.japanese);
    const nextWord = {
      ...draft,
      id: selectedId ?? (draft.id || Date.now()),
      category: draft.category.trim() || "N5",
      japanese: standaloneReading?.japanese ?? draft.japanese.trim(),
      kana: draft.kana.trim() || standaloneReading?.kana || "",
      chinese: draft.chinese.trim(),
      exampleJapanese: draft.exampleJapanese.trim(),
      exampleChinese: draft.exampleChinese.trim(),
      audioUrl: draft.audioUrl.trim(),
      frontAudioUrl: draft.frontAudioUrl.trim() || draft.audioUrl.trim(),
      backAudioUrl: draft.backAudioUrl.trim()
    };

    if (!nextWord.japanese || !nextWord.chinese) {
      setMessage("請至少輸入日文與中文。");
      return;
    }

    const nextWordDuplicateKey = getWordDuplicateKey(nextWord);
    const duplicatedWord = words.find((word) => word.id !== nextWord.id && getWordDuplicateKey(word) === nextWordDuplicateKey);

    if (duplicatedWord) {
      setMessage(`「${nextWord.japanese}」已經存在，沒有新增重複單字。`);
      return;
    }

    setMessage(selectedId ? "正在更新單字卡。" : "正在新增單字卡。");

    try {
      const savedWord = await saveWordCard(nextWord, selectedId ? "update" : "create");
      const nextWords = selectedId
        ? words.map((word) => (word.id === selectedId ? savedWord : word))
        : [savedWord, ...words];

      persist(nextWords, selectedId ? "已更新單字卡。" : "已新增單字卡。");
      setSelectedId(savedWord.id);
      setDraft(savedWord);
      setShowEditor(false);
    } catch (error) {
      if (error instanceof Error && error.name === "DuplicatedWordError") {
        setMessage(`「${nextWord.japanese}」已經存在，沒有新增重複單字。`);
        return;
      }

      setMessage(`資料庫儲存失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與 word_cards 資料表。"}`);
    }
  }

  async function deleteSelected() {
    if (!selectedId) {
      setMessage("請先選取一張單字卡。");
      return;
    }

    setMessage("正在刪除單字卡。");

    try {
      await deleteWordCards([selectedId]);
      const nextWords = words.filter((word) => word.id !== selectedId);
      persist(nextWords, "已刪除單字卡。");
      setSelectedId(null);
      setDraft(emptyWord);
      setShowEditor(false);
    } catch (error) {
      setMessage(`資料庫刪除失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與 word_cards 資料表。"}`);
    }
  }

  async function uploadAudio(event: ChangeEvent<HTMLInputElement>, side: "front" | "back") {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setMessage("正在上傳音檔。");

    try {
      const url = await uploadMediaFile(file, "audio");
      setDraft((current) =>
        side === "front"
          ? { ...current, audioUrl: url, frontAudioUrl: url }
          : { ...current, backAudioUrl: url }
      );
      setMessage(side === "front" ? "已上傳正面音檔。" : "已上傳背面音檔。");
    } catch {
      setMessage("音檔上傳失敗，請確認 Supabase Storage 設定與 note-media bucket。");
    } finally {
      event.target.value = "";
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
              新增單字
            </button>
          </>
        )}
        <div className={styles.toolSpacer} />
        <a className={styles.primaryLink} href="/words" target="_blank" rel="noreferrer">
          看前台
        </a>
      </div>

      <p className={styles.statusMessage}>{message}</p>

      {showEditor ? (
        <form className={`${styles.editorForm} ${styles.wordEditorForm}`} onSubmit={saveWord}>
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
                  placeholder="例：水"
                  onChange={(event) => setDraft((current) => ({ ...current, japanese: event.target.value }))}
                />
              </label>
              <label>
                <span>假名</span>
                <input value={draft.kana} placeholder="例：みず" onChange={(event) => setDraft((current) => ({ ...current, kana: event.target.value }))} />
              </label>
              <label>
                <span>中譯</span>
                <input value={draft.chinese} onChange={(event) => setDraft((current) => ({ ...current, chinese: event.target.value }))} />
              </label>
            </div>
            <div className={styles.wordAudioRow}>
              <label>
                <span>正面音檔</span>
                <input value={draft.frontAudioUrl || draft.audioUrl} placeholder="可貼 URL，或直接上傳" onChange={(event) => setDraft((current) => ({ ...current, frontAudioUrl: event.target.value, audioUrl: event.target.value }))} />
              </label>
              <label className={styles.uploadButton}>
                上傳
                <input type="file" accept="audio/*" onChange={(event) => uploadAudio(event, "front")} />
              </label>
            </div>
          </section>

          <section className={styles.wordSidePanel}>
            <h2>背面</h2>
            <label className={styles.wordFullField}>
              <span>例句（日文）</span>
              <input
                value={draft.exampleJapanese}
                placeholder="例：水(みず)を飲(の)みます。"
                onChange={(event) => setDraft((current) => ({ ...current, exampleJapanese: event.target.value }))}
              />
            </label>
            <label className={styles.wordFullField}>
              <span>例句中譯</span>
              <input
                value={draft.exampleChinese}
                placeholder="例：我喝水。"
                onChange={(event) => setDraft((current) => ({ ...current, exampleChinese: event.target.value }))}
              />
            </label>
            <div className={styles.wordAudioRow}>
              <label>
                <span>背面音檔</span>
                <input value={draft.backAudioUrl} placeholder="可貼 URL，或直接上傳" onChange={(event) => setDraft((current) => ({ ...current, backAudioUrl: event.target.value }))} />
              </label>
              <label className={styles.uploadButton}>
                上傳
                <input type="file" accept="audio/*" onChange={(event) => uploadAudio(event, "back")} />
              </label>
            </div>
          </section>

          <div className={styles.formActions}>
            <button className={styles.ghostButton} type="button" onClick={() => setShowEditor(false)}>
              取消
            </button>
            <button type="submit">{selectedId ? "確認修改" : "新增單字"}</button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.wordSearchBar}>
            <label>
              <span>搜尋</span>
              <input
                value={searchText}
                placeholder="輸入日文、假名、中文或分類"
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.noteTable}>
              <thead>
                <tr>
                  <th aria-label="選取" />
                  <th>分類名稱</th>
                  <th>單字</th>
                  <th>中文</th>
                </tr>
              </thead>
              <tbody>
                {filteredWords.map((word) => (
                  <tr key={word.id} className={selectedId === word.id ? styles.selectedRow : undefined} onClick={() => selectWord(word)}>
                    <td>
                      <input checked={selectedId === word.id} readOnly type="checkbox" aria-label={`選取 ${word.japanese}`} />
                    </td>
                    <td>{word.category}</td>
                    <td>{word.japanese}</td>
                    <td>{word.chinese}</td>
                  </tr>
                ))}
                {filteredWords.length === 0 ? (
                  <tr>
                    <td colSpan={4}>找不到符合的單字。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
