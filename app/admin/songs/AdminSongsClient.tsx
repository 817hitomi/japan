"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../AdminShell";
import { ArticleRichEditor, ArticleRichEditorHandle } from "../notes/ArticleRichEditor";
import { deleteSongs, fetchSong, fetchSongs, saveSong } from "../../songs/songStorage";
import { getYouTubeVideoUrl, normalizeSong, normalizeYouTubeVideoId, seedSong, SongListItem, SongRecord, songLyricsToLrc, songStatusLabels } from "../../songs/songTypes";
import { parseLyricImport } from "./lyricImport";
import styles from "./AdminSongs.module.scss";

function readFileAsDataUrl(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result));
  reader.readAsDataURL(file);
}

function newSong(): SongRecord {
  return normalizeSong({
    id: Date.now(), title: "", slug: "", artist: "", description: "", tags: "", coverUrl: "", eyebrow: "同步歌詞",
    status: "draft", level: "N5", videoId: "", durationSeconds: 0,
    publishedDate: new Date().toISOString().slice(0, 10),
    lyricsLrc: "", lyrics: [],
    noteBlocks: [{ id: `song-note-${Date.now()}`, type: "text", title: "文章內容", html: "", collapsed: false }], vocabulary: []
  });
}

export default function AdminSongsClient() {
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<SongRecord | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [mode, setMode] = useState<"create" | "update">("create");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("正在載入歌曲資料庫。");
  const articleEditorRef = useRef<ArticleRichEditorHandle | null>(null);
  const lyricPreview = useMemo(
    () => parseLyricImport(editing?.lyricsLrc ?? "", editing?.durationSeconds ?? 0),
    [editing?.durationSeconds, editing?.lyricsLrc]
  );

  async function reload() {
    setLoading(true);
    try {
      const records = await fetchSongs();
      setSongs(records);
      setMessage(records.length ? `已載入 ${records.length} 首歌曲。` : "目前沒有歌曲，請按新增歌曲建立第一首。");
    } catch (error) {
      setMessage(`歌曲資料庫讀取失敗：${error instanceof Error ? error.message : "請確認 Supabase songs 資料表。"}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);
  function patch(value: Partial<SongRecord>) { setEditing((current) => current ? { ...current, ...value } : current); }

  async function openEdit() {
    if (!selectedId) return setMessage("請先選擇一首歌曲再編輯。");
    setMessage("正在讀取完整歌曲內容。");
    try { const song = await fetchSong(selectedId); setEditing(song); setVideoUrl(getYouTubeVideoUrl(song.videoId)); setMode("update"); setMessage(`正在編輯「${song.title}」。`); }
    catch (error) { setMessage(`讀取失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
  }

  async function removeSelected() {
    if (!selectedId) return setMessage("請先選擇要刪除的歌曲。");
    const target = songs.find((song) => song.id === selectedId);
    if (!window.confirm(`確定刪除「${target?.title ?? "這首歌曲"}」嗎？`)) return;
    try { await deleteSongs([selectedId]); setEditing(null); setSelectedId(null); await reload(); setMessage("歌曲已刪除。"); }
    catch (error) { setMessage(`刪除失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editing.title.trim() || !editing.slug.trim()) return setMessage("歌名與網址代稱為必填欄位。");
    const videoId = normalizeYouTubeVideoId(videoUrl);
    if (!videoUrl.startsWith("https://") || !videoId || videoId === videoUrl.trim()) return setMessage("請貼上完整的 YouTube 影片網址。");
    const hasLrc = editing.lyricsLrc.trim().length > 0;
    if (hasLrc && lyricPreview.lines.length === 0) return setMessage("同步歌詞沒有可儲存的 LRC 時間碼，請檢查格式。");
    if (lyricPreview.errors.length > 0) return setMessage(`同步歌詞有 ${lyricPreview.errors.length} 行格式錯誤，請修正後再儲存。`);
    setMessage("正在儲存歌曲。");
    const nextSong = {
      ...editing,
      videoId,
      lyrics: hasLrc ? lyricPreview.lines : [],
      noteBlocks: articleEditorRef.current?.getBlocks() ?? editing.noteBlocks
    };
    try { const saved = await saveSong(nextSong, mode); setEditing(saved); setVideoUrl(getYouTubeVideoUrl(saved.videoId)); setMode("update"); setSelectedId(saved.id); await reload(); setMessage(`已儲存「${saved.title}」。`); }
    catch (error) { setMessage(`儲存失敗：${error instanceof Error ? error.message : "未知錯誤"}`); }
  }

  const updateWord = (index: number, value: Partial<SongRecord["vocabulary"][number]>) => patch({ vocabulary: editing!.vocabulary.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) });

  return <AdminShell>
    <div className={styles.toolbar}>
      <button className={styles.ghostButton} type="button" onClick={() => void openEdit()}>編輯</button>
      <button type="button" onClick={() => void removeSelected()}>刪除</button><span />
      <button type="button" onClick={() => { setEditing(newSong()); setVideoUrl(""); setMode("create"); setSelectedId(null); setMessage("正在新增歌曲。"); }}>新增歌曲</button>
      {songs.length === 0 ? <button className={styles.ghostButton} type="button" onClick={() => { setEditing({ ...seedSong, id: Date.now(), lyricsLrc: songLyricsToLrc(seedSong.lyrics) }); setVideoUrl(getYouTubeVideoUrl(seedSong.videoId)); setMode("create"); setMessage("已載入現有歌曲內容，儲存後會寫入資料庫。"); }}>匯入現有歌曲</button> : null}
    </div>
    <p className={styles.message}>{message}</p>
    {!editing ? <div className={styles.tableWrap}><table><thead><tr><th /><th>歌名</th><th>演出者</th><th>網址</th><th>狀態</th><th>發布日期</th><th>預覽</th></tr></thead><tbody>
      {songs.map((song) => <tr className={selectedId === song.id ? styles.selected : undefined} key={song.id} onClick={() => setSelectedId(song.id)}><td><input type="radio" checked={selectedId === song.id} onChange={() => setSelectedId(song.id)} aria-label={`選取 ${song.title}`} /></td><td>{song.title}</td><td>{song.artist}</td><td>/songs/{song.slug}</td><td>{songStatusLabels[song.status]}</td><td>{song.publishedDate}</td><td><Link href={`/admin/songs/preview/${song.id}`} target="_blank">預覽</Link></td></tr>)}
      {!loading && songs.length === 0 ? <tr><td colSpan={7}>目前沒有歌曲資料。</td></tr> : null}
    </tbody></table></div> : <form className={styles.editor} onSubmit={(event) => void submit(event)}>
      <div className={styles.editorHeader}><div><p>歌曲後台</p><h1>{mode === "create" ? "新增歌曲" : `編輯：${editing.title}`}</h1></div><button className={styles.ghostButton} type="button" onClick={() => setEditing(null)}>返回列表</button>{mode === "update" ? <Link className={styles.previewLink} href={`/admin/songs/preview/${editing.id}`} target="_blank">預覽頁面</Link> : null}<button type="submit">儲存歌曲</button></div>
      <section className={styles.formSection}><h2>基本資料</h2><div className={styles.grid}>
        <label><span>歌名</span><input required value={editing.title} onChange={(event) => patch({ title: event.target.value })} /></label>
        <label><span>網址代稱</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={editing.slug} onChange={(event) => patch({ slug: event.target.value.toLowerCase() })} /></label>
        <label><span>演出者／來源</span><input value={editing.artist} onChange={(event) => patch({ artist: event.target.value })} /></label>
        <label><span>頁面標籤</span><input value={editing.eyebrow} onChange={(event) => patch({ eyebrow: event.target.value })} /></label>
        <label><span>程度</span><select value={editing.level} onChange={(event) => patch({ level: event.target.value })}>{["N5","N4","N3","N2","N1"].map((level) => <option key={level}>{level}</option>)}</select></label>
        <label><span>狀態</span><select value={editing.status} onChange={(event) => patch({ status: event.target.value === "published" ? "published" : "draft" })}><option value="draft">草稿</option><option value="published">已發布</option></select></label>
        <label><span>發布日期</span><input type="date" value={editing.publishedDate} onChange={(event) => patch({ publishedDate: event.target.value })} /></label>
        <label><span>YouTube 影片網址</span><input required type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>
        <label><span>歌曲秒數</span><input min="0" type="number" value={editing.durationSeconds} onChange={(event) => patch({ durationSeconds: Number(event.target.value) })} /></label>
        <label className={styles.full}><span>SEO／歌曲說明</span><textarea value={editing.description} onChange={(event) => patch({ description: event.target.value })} /></label>
      </div></section>
      <section className={styles.formSection}>
        <div className={styles.lyricEditorHeading}>
          <div><h2>同步歌詞</h2><p>直接貼上或編輯整份 LRC。日文與中文翻譯之間使用 Tab 分隔。</p></div>
          <span className={lyricPreview.errors.length > 0 ? styles.lyricStatusError : styles.lyricStatus}>{lyricPreview.errors.length > 0 ? `${lyricPreview.errors.length} 行錯誤` : `${lyricPreview.lines.length} 句`}</span>
        </div>
        <textarea
          className={styles.lyricSourceEditor}
          aria-label="LRC 同步歌詞"
          spellCheck={false}
          value={editing.lyricsLrc}
          onChange={(event) => patch({ lyricsLrc: event.target.value })}
          placeholder={'[Verse]\n[00:05.00]朝(あさ)の光(ひかり)\t在晨光中，打開窗戶\n[00:14.00]小(ちい)さな夢(ゆめ)\t將小小的夢想抱在心中'}
        />
        {lyricPreview.errors.length > 0 ? <ul className={styles.lyricErrors}>{lyricPreview.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul> : null}
      </section>
      <section className={styles.articleContentSection}><h2>文章內容</h2><ArticleRichEditor key={`${mode}-${editing.id}`} ref={articleEditorRef} initialBlocks={editing.noteBlocks} onMessage={setMessage} /></section>
      <section className={styles.formSection}><div className={styles.sectionTitle}><h2>重要單字</h2><button type="button" onClick={() => patch({ vocabulary: [...editing.vocabulary, { partOfSpeech: "", japanese: "", translation: "" }] })}>新增單字</button></div><div className={styles.rows}>
        {editing.vocabulary.map((word, index) => <div className={styles.wordRow} key={index}><input placeholder="詞性" value={word.partOfSpeech} onChange={(event) => updateWord(index, { partOfSpeech: event.target.value })} /><input placeholder="日文（可使用 漢字(かな)）" value={word.japanese} onChange={(event) => updateWord(index, { japanese: event.target.value })} /><input placeholder="繁體中文" value={word.translation} onChange={(event) => updateWord(index, { translation: event.target.value })} /><button type="button" onClick={() => patch({ vocabulary: editing.vocabulary.filter((_, itemIndex) => itemIndex !== index) })}>移除</button></div>)}
      </div></section>
      <div className={styles.bottomGrid}>
        <label className={styles.tagBox}>
          <span>TAG（SEO）</span>
          <textarea value={editing.tags} onChange={(event) => patch({ tags: event.target.value })} />
        </label>
        <section className={styles.coverBox}>
          <h2>首圖／分享圖</h2>
          <div>{editing.coverUrl ? <img src={editing.coverUrl} alt="" /> : null}</div>
          <div className={styles.coverActions}>
            <button className={styles.ghostButton} type="button" onClick={() => patch({ coverUrl: "" })}>移除</button>
            <label className={styles.coverUpload}>
              上傳
              <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, (coverUrl) => patch({ coverUrl }))} />
            </label>
          </div>
        </section>
      </div>
      <div className={styles.saveBar}><button className={styles.ghostButton} type="button" onClick={() => setEditing(null)}>取消</button><button type="submit">儲存歌曲</button></div>
    </form>}
  </AdminShell>;
}
