"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  PublicNoteRecord,
  deleteNotes,
  hasImportedStoredNotes,
  importStoredNotesToDatabase,
  markStoredNotesImported,
  moveNotesCategory,
  readNoteWithSource,
  readNotesWithSource,
  readNotesWithFallback,
  saveNote as saveNoteToDatabase
} from "../../notes/noteStorage";
import styles from "./AdminNotes.module.scss";
import { AdminShell } from "../AdminShell";
import { ArticleRichEditor, ArticleRichEditorHandle } from "./ArticleRichEditor";

type Mode = "list" | "new" | "edit";
type BlockType = "text" | "image" | "video" | "note" | "ad";

type ContentBlock = {
  id: string;
  type: BlockType;
  title: string;
  heading?: string;
  html: string;
  collapsed: boolean;
  imageUrl?: string;
  linkUrl?: string;
  videoUrl?: string;
  caption?: string;
  adSlot?: string;
};

type NoteRecord = PublicNoteRecord;

const categoryStorageKey = "japannote-admin-note-categories";
const notesPerPage = 10;
const maxVisiblePageButtons = 10;
const defaultCategories = ["N5", "N4", "會話", "文法"];

const initialBlocks: ContentBlock[] = [
  {
    id: "block-text",
    type: "text",
    title: "文章內容",
    html: "",
    collapsed: false
  }
];

function cloneBlocks(blocks: ContentBlock[]) {
  return blocks.map((block) => ({ ...block, id: `${block.id}-${Date.now()}-${Math.random().toString(16).slice(2)}` }));
}

function readCategories() {
  if (typeof window === "undefined") {
    return defaultCategories;
  }

  const raw = window.localStorage.getItem(categoryStorageKey);
  if (!raw) {
    window.localStorage.setItem(categoryStorageKey, JSON.stringify(defaultCategories));
    return defaultCategories;
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : defaultCategories;
  } catch {
    return defaultCategories;
  }
}

function writeCategories(categories: string[]) {
  window.localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= maxVisiblePageButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisiblePageButtons / 2);
  const lastStartPage = totalPages - maxVisiblePageButtons + 1;
  const startPage = Math.max(1, Math.min(currentPage - halfWindow + 1, lastStartPage));

  return Array.from({ length: maxVisiblePageButtons }, (_, index) => startPage + index);
}

function getAdminNotesPageHref(page: number) {
  return page <= 1 ? "/admin/notes" : `/admin/notes?page=${page}`;
}

function readFileAsDataUrl(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result));
  reader.readAsDataURL(file);
}

function NotesList({ initialPage }: { initialPage: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const [databaseCategories, setDatabaseCategories] = useState<string[]>([]);
  const [storedCategories, setStoredCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(initialPage);
  const [refreshKey, setRefreshKey] = useState(0);
  const [category, setCategory] = useState("全部分類");
  const [message, setMessage] = useState("可完整測試：新增文章、回列表、勾選編輯、刪除與分頁。");
  const [categoryModal, setCategoryModal] = useState<"add" | "delete" | null>(null);
  const [draftCategory, setDraftCategory] = useState("");
  const [deleteCategoryName, setDeleteCategoryName] = useState("");

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      const result = await readNotesWithSource("all", {
        page,
        pageSize: notesPerPage,
        category: category === "全部分類" ? undefined : category,
        includeCategories: true
      });
      let nextNotes = result.notes;

      if (result.source === "local") {
        setMessage(`資料庫讀取失敗，暫時顯示本機文章：${result.error ?? "請確認 Supabase learning_notes 資料表與環境變數。"}`);
      } else if (nextNotes.length === 0 && !hasImportedStoredNotes()) {
        try {
          nextNotes = await importStoredNotesToDatabase();
          markStoredNotesImported();
          const refreshed = await readNotesWithSource("all", {
            page: 1,
            pageSize: notesPerPage,
            category: category === "全部分類" ? undefined : category,
            includeCategories: true
          });
          nextNotes = refreshed.notes;
          result.total = refreshed.total;
          result.categories = refreshed.categories;
        } catch (error) {
          setMessage(`資料庫目前是空的，本機資料匯入失敗：${error instanceof Error ? error.message : "請確認 Supabase API 權限。"}`);
        }
      }

      if (active) {
        setNotes(nextNotes);
        setTotalNotes(result.total);
        setDatabaseCategories(result.categories);
        if (result.source === "database" && nextNotes.length > 0) {
          setMessage(`已載入第 ${result.page} 頁，共 ${result.total} 篇學習筆記。`);
        }
      }
    }

    loadNotes();
    setStoredCategories(readCategories());

    return () => {
      active = false;
    };
  }, [category, page, refreshKey]);

  const categories = useMemo(
    () => Array.from(new Set([...storedCategories, ...databaseCategories, ...notes.map((note) => note.category).filter(Boolean)])),
    [databaseCategories, notes, storedCategories]
  );
  const pageCount = Math.max(1, Math.ceil(totalNotes / notesPerPage));
  const visiblePages = getVisiblePageNumbers(page, pageCount);
  const visibleNotes = notes;
  const deleteCount = category === deleteCategoryName ? totalNotes : notes.filter((note) => note.category === deleteCategoryName).length;

  function persist(nextNotes: NoteRecord[], nextMessage: string) {
    setNotes(nextNotes);
    setMessage(nextMessage);
  }

  function changeCategory(nextCategory: string) {
    setCategory(nextCategory);
    setPage(1);
    setSelectedIds([]);
    setMessage(`已切換到「${nextCategory}」。`);
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function openAddCategory() {
    setDraftCategory("");
    setCategoryModal("add");
  }

  function openDeleteCategory() {
    const fallback = category !== "全部分類" ? category : categories[0] ?? "";
    setDeleteCategoryName(fallback);
    setCategoryModal("delete");
  }

  function addCategory(event: FormEvent) {
    event.preventDefault();

    const nextName = draftCategory.trim();
    if (!nextName) {
      setMessage("請輸入分類名稱。");
      return;
    }

    if (categories.includes(nextName)) {
      setMessage(`「${nextName}」已存在。`);
      return;
    }

    const nextCategories = [...storedCategories, nextName];
    setStoredCategories(nextCategories);
    writeCategories(nextCategories);
    setCategory(nextName);
    setPage(1);
    setCategoryModal(null);
    setMessage(`已新增分類「${nextName}」。`);
  }

  async function deleteCategory(event: FormEvent) {
    event.preventDefault();

    if (!deleteCategoryName) {
      setMessage("請先選擇要刪除的分類。");
      return;
    }

    const nextCategories = storedCategories.filter((item) => item !== deleteCategoryName);
    const nextNotes = notes.map((note) => (note.category === deleteCategoryName ? { ...note, category: "未分類" } : note));
    const shouldAddUncategorized = nextNotes.some((note) => note.category === "未分類") && !nextCategories.includes("未分類");
    const finalCategories = shouldAddUncategorized ? ["未分類", ...nextCategories] : nextCategories;

    setStoredCategories(finalCategories);
    writeCategories(finalCategories);
    persist(nextNotes, "正在同步分類變更到資料庫。");

    try {
      await moveNotesCategory(deleteCategoryName, "未分類");

      setMessage(deleteCount > 0 ? `已刪除「${deleteCategoryName}」，${deleteCount} 篇文章已移到「未分類」。` : `已刪除「${deleteCategoryName}」。`);
      setSelectedIds([]);
      setCategory("全部分類");
      setPage(1);
      setRefreshKey((current) => current + 1);
      setCategoryModal(null);
    } catch (error) {
      setNotes(await readNotesWithFallback("all"));
      setMessage(`分類已保存在本機，但同步資料庫失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與資料表。"}`);
    }
  }

  function editSelected() {
    if (selectedIds.length !== 1) {
      setMessage("請勾選一篇文章再按編輯。");
      return;
    }

    router.push(`/admin/notes/${selectedIds[0]}`);
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) {
      setMessage("請先勾選文章再刪除。");
      return;
    }

    const nextNotes = notes.filter((note) => !selectedIds.includes(note.id));
    persist(nextNotes, "正在刪除資料庫文章。");

    try {
      await deleteNotes(selectedIds);
      setMessage(`已刪除 ${selectedIds.length} 篇文章。`);
      setSelectedIds([]);
      setTotalNotes((current) => Math.max(0, current - selectedIds.length));
      setPage(1);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setNotes(await readNotesWithFallback("all"));
      setMessage(`刪除失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與資料表。"}`);
    }
  }

  return (
    <AdminShell>
      <div className={styles.listTools}>
        <select value={category} onChange={(event) => changeCategory(event.target.value)} aria-label="選擇文章分類">
          <option>全部分類</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button type="button" onClick={openAddCategory}>
          新增分類
        </button>
        <button className={styles.ghostButton} type="button" onClick={openDeleteCategory}>
          刪除分類
        </button>
        <div className={styles.toolSpacer} />
        <button className={styles.ghostButton} type="button" onClick={editSelected}>
          編輯
        </button>
        <button type="button" onClick={deleteSelected}>
          刪除
        </button>
        <Link className={styles.primaryLink} href="/admin/notes/new">
          新增文章
        </Link>
      </div>

      <p className={styles.statusMessage}>{message}</p>

      <div className={styles.tableWrap}>
        <table className={styles.noteTable}>
          <thead>
            <tr>
              <th aria-label="選取" />
              <th>分類名稱</th>
              <th>標題</th>
              <th>狀態</th>
              <th>日期</th>
            </tr>
          </thead>
          <tbody>
            {visibleNotes.map((note) => (
              <tr key={note.id} className={selectedIds.includes(note.id) ? styles.selectedRow : undefined}>
                <td>
                  <input
                    checked={selectedIds.includes(note.id)}
                    type="checkbox"
                    onChange={() => toggleSelected(note.id)}
                    aria-label={`選取 ${note.title}`}
                  />
                </td>
                <td>{note.category}</td>
                <td>
                  <Link className={styles.titleLink} href={`/admin/notes/${note.id}`}>
                    {note.title}
                  </Link>
                </td>
                <td>{note.status}</td>
                <td>{note.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="文章頁碼">
          <Link
            href={getAdminNotesPageHref(Math.max(1, page - 1))}
            prefetch={false}
            aria-disabled={page === 1}
            aria-label="上一頁"
          >
            ‹
          </Link>
          {visiblePages.map((item) => (
            <Link
              key={item}
              className={item === page ? styles.currentPage : undefined}
              href={getAdminNotesPageHref(item)}
              prefetch={false}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          ))}
          <Link
            href={getAdminNotesPageHref(Math.min(pageCount, page + 1))}
            prefetch={false}
            aria-disabled={page === pageCount}
            aria-label="下一頁"
          >
            ›
          </Link>
        </nav>
      ) : null}

      {categoryModal === "add" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <form className={styles.categoryDialog} onSubmit={addCategory}>
            <label>
              <span>分類名稱</span>
              <input value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} autoFocus />
            </label>
            <div className={styles.dialogActions}>
              <button className={styles.ghostButton} type="button" onClick={() => setCategoryModal(null)}>
                取消
              </button>
              <button type="submit">新增</button>
            </div>
          </form>
        </div>
      )}

      {categoryModal === "delete" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <form className={styles.categoryDialog} onSubmit={deleteCategory}>
            <label>
              <span>分類名稱</span>
              <select value={deleteCategoryName} onChange={(event) => setDeleteCategoryName(event.target.value)}>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            {deleteCategoryName && deleteCount > 0 ? (
              <p className={styles.warningText}>此分類內有 {deleteCount} 篇文章，確認刪除分類後，文章會移到「未分類」。</p>
            ) : (
              <p className={styles.warningText}>此分類目前沒有文章，可以直接刪除。</p>
            )}
            <div className={styles.dialogActions}>
              <button className={styles.ghostButton} type="button" onClick={() => setCategoryModal(null)}>
                取消
              </button>
              <button type="submit">確認刪除</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

function NoteEditor({ mode, noteId }: { mode: "new" | "edit"; noteId?: number }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"已發布" | "草稿">("已發布");
  const [date, setDate] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>(initialBlocks);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [message, setMessage] = useState("可在同一個文章區域內編輯，並從上方工具列插入小標題、NOTE、圖片與影片。");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlocks, setPreviewBlocks] = useState<ContentBlock[]>([]);
  const articleEditorRef = useRef<ArticleRichEditorHandle | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNote() {
      const [result, noteResult] = await Promise.all([
        readNotesWithSource("all", { page: 1, pageSize: 1, includeCategories: true }),
        mode === "edit" && noteId ? readNoteWithSource(noteId) : Promise.resolve(null)
      ]);
      if (!active) {
        return;
      }

      setCategories(Array.from(new Set([...readCategories(), ...result.categories])));
      if (result.source === "local") {
        setMessage(`資料庫讀取失敗，暫時顯示本機文章：${result.error ?? "請確認 Supabase learning_notes 資料表與環境變數。"}`);
      }

      if (mode === "new") {
        setTitle("");
        setSummary("");
        setCategory("");
        setDate(new Date().toISOString().slice(0, 10));
        setSlug("");
        setTags("");
        setCoverUrl("");
        setBlocks(cloneBlocks(initialBlocks));
        setLoaded(true);
        return;
      }

      const note = noteResult?.note ?? null;
      if (!note) {
        setMessage("找不到這篇文章，可返回列表重新選擇。");
        setLoaded(true);
        return;
      }

      setTitle(note.title);
      setSummary(note.summary);
      setCategory(note.category);
      setStatus(note.status);
      setDate(note.date);
      setSlug(note.slug);
      setTags(note.tags);
      setCoverUrl(note.coverUrl);
      setBlocks(note.blocks.length > 0 ? note.blocks : cloneBlocks(initialBlocks));
      setLoaded(true);
    }

    loadNote();

    return () => {
      active = false;
    };
  }, [mode, noteId]);

  async function saveNote(event: FormEvent) {
    event.preventDefault();

    const id = mode === "edit" && noteId ? noteId : Date.now();
    const syncedBlocks = articleEditorRef.current?.getBlocks() ?? blocks;
    const nextNote: NoteRecord = {
      id,
      title: title.trim() || "未命名文章",
      summary,
      category: category || "N5",
      status,
      date: date || new Date().toISOString().slice(0, 10),
      slug: slug.trim(),
      tags,
      coverUrl,
      blocks: syncedBlocks
    };

    setMessage("正在同步文章到資料庫。");

    try {
      await saveNoteToDatabase(nextNote, mode === "edit" ? "update" : "create");
      setMessage(`${mode === "edit" ? "已更新文章" : "已新增文章"}。`);
      router.push("/admin/notes");
    } catch (error) {
      setMessage(`儲存失敗：${error instanceof Error ? error.message : "請確認 Supabase 設定與 learning_notes 資料表。"}`);
    }
  }

  if (!loaded) {
    return (
      <AdminShell>
        <p className={styles.statusMessage}>載入文章中。</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <form className={styles.editorForm} onSubmit={saveNote}>
        <label className={styles.field}>
          <span>文章標題</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>文章摘要（SEO 描述）</span>
          <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>

        <div className={styles.articleSettings}>
          <label>
            <span>分類</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">下拉分類選單</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span>日期</span>
            <input type="date" value={date} placeholder="預設當天" onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            <span>網址代稱</span>
            <input value={slug} placeholder="預設日期" onChange={(event) => setSlug(event.target.value)} />
          </label>
        </div>

        <div className={`${styles.articleSettings} ${styles.articleSettingsStatus}`}>
          <label>
            <span>狀態</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as "已發布" | "草稿")}>
              <option>已發布</option>
              <option>草稿</option>
            </select>
          </label>
        </div>

        <p className={styles.statusMessage}>{message}</p>

        <section className={styles.contentSection}>
          <h2>文章內容</h2>
          <ArticleRichEditor ref={articleEditorRef} initialBlocks={blocks} onMessage={setMessage} />
        </section>

        <div className={styles.bottomGrid}>
          <label className={styles.tagBox}>
            <span>TAG（SEO）</span>
            <textarea value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
          <section className={styles.coverBox}>
            <h2>首圖／分享圖</h2>
            <div>{coverUrl ? <img src={coverUrl} alt="" /> : null}</div>
            <div className={styles.coverActions}>
              <button className={styles.ghostButton} type="button" onClick={() => setCoverUrl("")}>
                移除
              </button>
              <label className={styles.coverUpload}>
                上傳
                <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, setCoverUrl)} />
              </label>
            </div>
          </section>
        </div>

        <div className={styles.formActions}>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={() => {
              setPreviewBlocks(articleEditorRef.current?.getBlocks() ?? blocks);
              setPreviewOpen(true);
            }}
          >
            預覽
          </button>
          <button type="submit">{mode === "edit" ? "更新文章" : "新增文章"}</button>
        </div>
      </form>

      {previewOpen && (
        <div className={styles.previewBackdrop} role="dialog" aria-modal="true">
          <section className={styles.previewPanel}>
            <button type="button" onClick={() => setPreviewOpen(false)}>
              關閉
            </button>
            <h2>{title || "未命名文章"}</h2>
            <p>{summary || "尚未輸入摘要。"}</p>
            {previewBlocks.map((block) => (
              <div key={block.id} className={styles.previewBlock}>
                {block.heading ? <h3>{block.heading}</h3> : null}
                {block.type === "image" && block.imageUrl ? <img src={block.imageUrl} alt="" /> : null}
                {block.type === "text" && <div dangerouslySetInnerHTML={{ __html: block.html }} />}
                {block.type === "note" && <div className={styles.previewNote} dangerouslySetInnerHTML={{ __html: block.html }} />}
                {block.type === "video" && <span>{block.videoUrl || "尚未輸入影片連結"}</span>}
                {block.type === "ad" && <span>{block.adSlot || "尚未選擇廣告版位"}</span>}
              </div>
            ))}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

export default function AdminNotesClient({
  initialMode,
  noteId,
  initialPage = 1
}: {
  initialMode: Mode;
  noteId?: number;
  initialPage?: number;
}) {
  if (initialMode === "new") {
    return <NoteEditor mode="new" />;
  }

  if (initialMode === "edit") {
    return <NoteEditor mode="edit" noteId={noteId} />;
  }

  return <NotesList initialPage={initialPage} />;
}
