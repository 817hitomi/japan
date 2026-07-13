"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  PublicNoteRecord,
  deleteNotes,
  hasImportedStoredNotes,
  importStoredNotesToDatabase,
  markStoredNotesImported,
  moveNotesCategory,
  readNotesWithFallback,
  saveNote as saveNoteToDatabase,
  uploadMediaFile
} from "../../notes/noteStorage";
import styles from "./AdminNotes.module.scss";

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
const fixedColors = ["#7D7D7D", "#C28080", "#D6C09E", "#8CB993"] as const;
const defaultCategories = ["N5", "N4", "會話", "文法"];

const blockOptions: { value: BlockType; label: string }[] = [
  { value: "text", label: "文字區塊" },
  { value: "image", label: "圖片" },
  { value: "video", label: "影片連結" },
  { value: "note", label: "NOTE" },
  { value: "ad", label: "廣告版位" }
];

const initialBlocks: ContentBlock[] = [
  {
    id: "block-text",
    type: "text",
    title: "文字區塊",
    html: "",
    collapsed: false
  },
  {
    id: "block-image",
    type: "image",
    title: "圖片",
    html: "",
    collapsed: false
  },
  {
    id: "block-video",
    type: "video",
    title: "影片連結",
    html: "",
    collapsed: false
  },
  {
    id: "block-note",
    type: "note",
    title: "NOTE",
    html: "",
    collapsed: false
  },
  {
    id: "block-ad",
    type: "ad",
    title: "廣告版位",
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

function readFileAsDataUrl(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result));
  reader.readAsDataURL(file);
}

async function uploadVideoFile(event: ChangeEvent<HTMLInputElement>, callback: (url: string) => void) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const url = await uploadMediaFile(file, "video");
  callback(url);
  event.target.value = "";
}

function Sidebar() {
  const pathname = usePathname();
  const navItems = [
    { label: "總覽", href: "/admin/notes" },
    { label: "單字卡", href: "/admin/words" },
    { label: "模擬測驗", href: "/admin/notes" },
    { label: "學習筆記", href: "/admin/notes" },
    { label: "通路管理", href: "/admin/settings" },
    { label: "設定", href: "/admin/settings" }
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandMark}>
        <Image src="/brand/logo.png" alt="" width={86} height={86} priority />
      </div>
      <div className={styles.badge}>
        <span className={styles.playIcon}>▶</span>
        <span>JapanNote</span>
      </div>
      <nav className={styles.sideNav} aria-label="後台功能">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className={pathname === item.href && (item.label === "單字卡" || item.label === "學習筆記" || item.label === "設定") ? styles.active : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <button className={styles.logoutButton} type="button">
        登出
      </button>
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.adminPage}>
      <header className={styles.topbar}>
        <Link href="/">回前台</Link>
        <strong>後台管理</strong>
      </header>
      <div className={styles.adminBody}>
        <Sidebar />
        <section className={styles.workspace}>{children}</section>
      </div>
    </main>
  );
}

function NotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [storedCategories, setStoredCategories] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("全部分類");
  const [message, setMessage] = useState("可完整測試：新增文章、回列表、勾選編輯、刪除與分頁。");
  const [categoryModal, setCategoryModal] = useState<"add" | "delete" | null>(null);
  const [draftCategory, setDraftCategory] = useState("");
  const [deleteCategoryName, setDeleteCategoryName] = useState("");
  const perPage = 10;

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      let nextNotes = await readNotesWithFallback("all");

      if (nextNotes.length === 0 && !hasImportedStoredNotes()) {
        try {
          nextNotes = await importStoredNotesToDatabase();
          markStoredNotesImported();
        } catch {
          setMessage("資料庫目前是空的，本機資料匯入失敗，請確認 Supabase API 權限。");
        }
      }

      if (active) {
        setNotes(nextNotes);
        if (nextNotes.length > 0) {
          setMessage(`已載入 ${nextNotes.length} 篇學習筆記。`);
        }
      }
    }

    loadNotes();
    setStoredCategories(readCategories());

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set([...storedCategories, ...notes.map((note) => note.category).filter(Boolean)])),
    [notes, storedCategories]
  );
  const filtered = category === "全部分類" ? notes : notes.filter((note) => note.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const visibleNotes = filtered.slice((page - 1) * perPage, page * perPage);
  const deleteCount = notes.filter((note) => note.category === deleteCategoryName).length;

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
      if (deleteCount > 0) {
        await moveNotesCategory(deleteCategoryName, "未分類");
      }

      setMessage(deleteCount > 0 ? `已刪除「${deleteCategoryName}」，${deleteCount} 篇文章已移到「未分類」。` : `已刪除「${deleteCategoryName}」。`);
      setSelectedIds([]);
      setCategory("全部分類");
      setPage(1);
      setCategoryModal(null);
    } catch {
      setNotes(await readNotesWithFallback("all"));
      setMessage("分類已保存在本機，但同步資料庫失敗，請確認 Supabase 設定與資料表。");
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
      setPage(1);
    } catch {
      setNotes(await readNotesWithFallback("all"));
      setMessage("刪除失敗，請確認 Supabase 設定與資料表。");
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

      <nav className={styles.pagination} aria-label="文章頁碼">
        {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
          <button
            key={item}
            className={item === page ? styles.currentPage : undefined}
            type="button"
            onClick={() => {
              setPage(item);
              setMessage(`已切換到第 ${item} 頁。`);
            }}
          >
            {item}
          </button>
        ))}
      </nav>

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

function BlockBody({
  block,
  editorRef,
  onCommit,
  onPatch
}: {
  block: ContentBlock;
  editorRef: (element: HTMLDivElement | null) => void;
  onCommit: (html: string) => void;
  onPatch: (patch: Partial<ContentBlock>) => void;
}) {
  if (block.collapsed) {
    return <p className={styles.collapsedText}>區塊已收合，按「展開」可繼續編輯。</p>;
  }

  if (block.type === "image") {
    return (
      <>
        <div className={styles.uploadBox}>{block.imageUrl ? <img src={block.imageUrl} alt="" /> : null}</div>
        <div className={styles.uploadActions}>
          <label className={styles.uploadButton}>
            上傳
            <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, (url) => onPatch({ imageUrl: url }))} />
          </label>
          <button className={styles.ghostButton} type="button" onClick={() => onPatch({ imageUrl: "" })}>
            移除
          </button>
        </div>
        <label className={styles.inlineField}>
          <span>加入連結</span>
          <input value={block.linkUrl ?? ""} onChange={(event) => onPatch({ linkUrl: event.target.value })} />
        </label>
      </>
    );
  }

  if (block.type === "video") {
    return (
      <div className={styles.videoFields}>
        {block.videoUrl ? (
          <div className={styles.videoPreview}>
            <span>目前影片</span>
            <a href={block.videoUrl} target="_blank" rel="noreferrer">
              開啟影片
            </a>
          </div>
        ) : null}
        <div className={styles.uploadActions}>
          <label className={styles.uploadButton}>
            上傳影片
            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={(event) => {
                uploadVideoFile(event, (url) => onPatch({ videoUrl: url })).catch(() => {
                  onPatch({ caption: block.caption || "影片上傳失敗，請稍後再試。" });
                });
              }}
            />
          </label>
          <button className={styles.ghostButton} type="button" onClick={() => onPatch({ videoUrl: "" })}>
            移除影片
          </button>
        </div>
        <label>
          <span>影片說明</span>
          <input
            value={block.caption ?? ""}
            placeholder="可放影片標題或補充說明"
            onChange={(event) => onPatch({ caption: event.target.value })}
          />
        </label>
        <label>
          <span>影片連結</span>
          <input
            value={block.videoUrl ?? ""}
            placeholder="可放 YouTube、MP4 或其他影片網址"
            onChange={(event) => onPatch({ videoUrl: event.target.value })}
          />
        </label>
      </div>
    );
  }

  if (block.type === "ad") {
    return (
      <select className={styles.fullSelect} value={block.adSlot ?? ""} onChange={(event) => onPatch({ adSlot: event.target.value })}>
        <option value="">下拉選單</option>
        <option value="文章中段廣告">文章中段廣告</option>
        <option value="文章結尾廣告">文章結尾廣告</option>
      </select>
    );
  }

  return (
    <div
      ref={editorRef}
      className={styles.editable}
      contentEditable
      draggable={false}
      suppressContentEditableWarning
      dangerouslySetInnerHTML={{ __html: block.html }}
      onDragStart={(event) => event.preventDefault()}
      onBlur={(event) => onCommit(event.currentTarget.innerHTML)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        document.execCommand("insertLineBreak");
      }}
    />
  );
}

function NoteEditor({ mode, noteId }: { mode: "new" | "edit"; noteId?: number }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(mode === "new");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"已發布" | "草稿">("已發布");
  const [date, setDate] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>(cloneBlocks(initialBlocks));
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [message, setMessage] = useState("可選取文字後按色票，也可拖曳區塊排序。");
  const [previewOpen, setPreviewOpen] = useState(false);
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;

    async function loadNote() {
      const allNotes = await readNotesWithFallback("all");

      if (!active) {
        return;
      }

      setCategories(Array.from(new Set([...readCategories(), ...allNotes.map((item) => item.category).filter(Boolean)])));

      if (mode === "new") {
        setDate(new Date().toISOString().slice(0, 10));
        return;
      }

      const note = allNotes.find((item) => item.id === noteId);
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

  const blockCount = useMemo(() => blocks.filter((block) => !block.collapsed).length, [blocks]);

  function syncEditableBlocks(sourceBlocks = blocks) {
    return sourceBlocks.map((block) => {
      const editor = editorRefs.current[block.id];
      return editor ? { ...block, html: editor.innerHTML } : block;
    });
  }

  function applyColor(blockId: string, color: string) {
    const editor = editorRefs.current[blockId];
    if (!editor) {
      setMessage("這個區塊不是文字區塊，無法套用文字色碼。");
      return;
    }

    editor.focus();
    document.execCommand("foreColor", false, color);
    setBlocks((current) => syncEditableBlocks(current));
    setMessage(`已套用文字色碼 ${color}。`);
  }

  function toggleBold(blockId: string) {
    const editor = editorRefs.current[blockId];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("bold");
    setBlocks((current) => syncEditableBlocks(current));
    setMessage("已套用粗體。");
  }

  function insertDivider(blockId: string) {
    const editor = editorRefs.current[blockId];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("insertHTML", false, "<hr><br>");
    setBlocks((current) => syncEditableBlocks(current));
    setMessage("已插入分隔線。");
  }

  function insertLink(blockId: string) {
    const editor = editorRefs.current[blockId];
    if (!editor) {
      return;
    }

    const url = window.prompt("請輸入連結網址");
    if (!url) {
      return;
    }

    editor.focus();
    document.execCommand("createLink", false, url);
    editor.querySelectorAll(`a[href="${CSS.escape(url)}"]`).forEach((link) => {
      link.setAttribute("style", "color: #7f6d4f; font-weight: 700;");
    });
    setBlocks((current) => syncEditableBlocks(current));
    setMessage("已套用超連結。");
  }

  function toggleList(blockId: string) {
    const editor = editorRefs.current[blockId];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("insertUnorderedList");
    setBlocks((current) => syncEditableBlocks(current));
    setMessage("已套用清單。");
  }

  function updateBlock(blockId: string, patch: Partial<ContentBlock>) {
    setBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function addBlockAfter(blockId: string, type: BlockType = "text") {
    const source = blockOptions.find((option) => option.value === type);
    const nextBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      title: source?.label ?? "文字區塊",
      html: "",
      collapsed: false
    };

    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === blockId);
      const next = [...current];
      next.splice(index + 1, 0, nextBlock);
      return next;
    });
    setMessage("已向下新增一個區塊。");
  }

  function removeBlock(blockId: string) {
    if (blocks.length === 1) {
      setMessage("至少需要保留一個內容區塊。");
      return;
    }

    setBlocks((current) => current.filter((block) => block.id !== blockId));
    setMessage("已刪除區塊。");
  }

  function reorder(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      return;
    }

    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === draggingId);
      const to = current.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();

    const id = mode === "edit" && noteId ? noteId : Date.now();
    const syncedBlocks = syncEditableBlocks();
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
      setMessage(`${mode === "edit" ? "已更新文章" : "已新增文章"}，目前有 ${syncedBlocks.length} 個區塊，其中 ${blockCount} 個展開。`);
      router.push("/admin/notes");
    } catch {
      setMessage("儲存失敗，請確認 Supabase 設定與 learning_notes 資料表。");
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
          <div className={styles.blockStack}>
            {blocks.map((block) => (
              <article
                key={block.id}
                className={`${styles.editorBlock} ${draggingId === block.id ? styles.dragging : ""}`}
                onDragOver={(event) => {
                  if (!draggingId) {
                    return;
                  }

                  event.preventDefault();
                  reorder(block.id);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setMessage("已更新區塊順序。");
                }}
              >
                <div className={styles.blockHeader}>
                  <button
                    className={styles.dragHandle}
                    type="button"
                    title="拖曳排序"
                    aria-label="拖曳排序"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingId(block.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setMessage("已更新區塊順序。");
                    }}
                  >
                    ⋮⋮
                  </button>
                  <select
                    value={block.type}
                    onChange={(event) => {
                      const nextType = event.target.value as BlockType;
                      const nextTitle = blockOptions.find((option) => option.value === nextType)?.label ?? block.title;
                      updateBlock(block.id, { type: nextType, title: nextTitle });
                      setMessage(`已切換為「${nextTitle}」。`);
                    }}
                    aria-label="區塊類型"
                  >
                    {blockOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  {(block.type === "text" || block.type === "note") && (
                    <div className={styles.styleToolbar} aria-label="文字樣式設定">
                      <button type="button" className={styles.boldButton} onMouseDown={(event) => event.preventDefault()} onClick={() => toggleBold(block.id)}>
                        B
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(block.id, "#7D7D7D")}>
                        預設
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertDivider(block.id)}>
                        分隔線
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertLink(block.id)}>
                        起連結
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleList(block.id)}>
                        清單
                      </button>
                      {fixedColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={styles.colorSwatch}
                          style={{ backgroundColor: color }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyColor(block.id, color)}
                          aria-label={`套用 ${color}`}
                        />
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={() => updateBlock(block.id, { collapsed: !block.collapsed })}>
                    {block.collapsed ? "展開" : "收合"}
                  </button>
                  <button type="button" onClick={() => removeBlock(block.id)}>
                    刪除區塊
                  </button>
                </div>

                <label className={styles.blockTitleField}>
                  <span>小標題</span>
                  <input
                    value={block.heading ?? ""}
                    placeholder="小標題"
                    onChange={(event) => updateBlock(block.id, { heading: event.target.value })}
                  />
                </label>

                <BlockBody
                  block={block}
                  editorRef={(element) => {
                    editorRefs.current[block.id] = element;
                  }}
                  onCommit={(html) => updateBlock(block.id, { html })}
                  onPatch={(patch) => updateBlock(block.id, patch)}
                />

                <button className={styles.addBlockButton} type="button" onClick={() => addBlockAfter(block.id)}>
                  向下新增區塊
                </button>
              </article>
            ))}
          </div>
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
              setBlocks((current) => syncEditableBlocks(current));
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
            {blocks.map((block) => (
              <div key={block.id} className={styles.previewBlock}>
                <strong>{block.title}</strong>
                {block.type === "image" && block.imageUrl ? <img src={block.imageUrl} alt="" /> : null}
                {(block.type === "text" || block.type === "note") && <div dangerouslySetInnerHTML={{ __html: block.html }} />}
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

export default function AdminNotesClient({ initialMode, noteId }: { initialMode: Mode; noteId?: number }) {
  if (initialMode === "new") {
    return <NoteEditor mode="new" />;
  }

  if (initialMode === "edit") {
    return <NoteEditor mode="edit" noteId={noteId} />;
  }

  return <NotesList />;
}
