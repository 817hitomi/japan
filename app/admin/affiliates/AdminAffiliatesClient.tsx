"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "../AdminShell";
import { deleteAffiliates, fetchAffiliate, saveAffiliate } from "../../affiliates/affiliateStorage";
import {
  AffiliateListItem,
  AffiliateRecord,
  affiliateStatusLabels,
  defaultAffiliateCategories,
  normalizeAffiliate
} from "../../affiliates/affiliateTypes";
import styles from "../notes/AdminNotes.module.scss";

const emptyAffiliate = normalizeAffiliate({
  id: Date.now(),
  category: defaultAffiliateCategories[0],
  title: "",
  summary: "",
  status: "draft",
  date: new Date().toISOString().slice(0, 10),
  slug: "",
  tags: "",
  imageUrl: "",
  linkUrl: "",
  html: ""
});

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

type AdminAffiliatesClientProps = {
  affiliates: AffiliateListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    q: string;
    category: string;
    status: "" | "published" | "draft";
  };
};

function buildPageHref(
  filters: AdminAffiliatesClientProps["filters"],
  page: number,
  patch: Partial<AdminAffiliatesClientProps["filters"]> = {}
) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.status) params.set("status", next.status);
  const query = params.toString();
  return query ? `/admin/affiliates?${query}` : "/admin/affiliates";
}

export default function AdminAffiliatesClient({
  affiliates: initialAffiliates,
  total,
  page,
  pageSize,
  filters
}: AdminAffiliatesClientProps) {
  const router = useRouter();
  const [affiliates, setAffiliates] = useState<AffiliateListItem[]>(initialAffiliates);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState(filters.q);
  const [editing, setEditing] = useState<AffiliateRecord | null>(null);
  const [message, setMessage] = useState(`已載入 ${initialAffiliates.length} 筆，本次查詢共 ${total} 筆。`);

  useEffect(() => {
    setAffiliates(initialAffiliates);
    setSearch(filters.q);
    setSelectedIds([]);
    setMessage(`已載入 ${initialAffiliates.length} 筆，本次查詢共 ${total} 筆。`);
  }, [filters.q, initialAffiliates, total]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const categoryOptions =
    filters.category && !defaultAffiliateCategories.includes(filters.category)
      ? [filters.category, ...defaultAffiliateCategories]
      : defaultAffiliateCategories;

  function toggleSelected(id: number) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function openNew() {
    setEditing({ ...emptyAffiliate, id: Date.now(), date: new Date().toISOString().slice(0, 10) });
    setMessage("正在新增聯盟行銷 LP。");
  }

  async function openEdit() {
    if (selectedIds.length !== 1) {
      setMessage("請先勾選一筆內容再編輯。");
      return;
    }

    const target = affiliates.find((item) => item.id === selectedIds[0]);
    if (!target) return;

    setMessage(`正在讀取「${target.title}」的完整內容。`);
    try {
      const fullAffiliate = await fetchAffiliate(target.id);
      setEditing(fullAffiliate);
      setMessage(`正在編輯「${fullAffiliate.title}」。`);
    } catch (error) {
      setMessage(`讀取完整內容失敗。${error instanceof Error ? error.message : ""}`);
    }
  }

  async function removeSelected() {
    if (selectedIds.length === 0) {
      setMessage("請先勾選要刪除的內容。");
      return;
    }

    const nextAffiliates = affiliates.filter((item) => !selectedIds.includes(item.id));
    setAffiliates(nextAffiliates);
    setSelectedIds([]);
    setEditing(null);

    try {
      await deleteAffiliates(selectedIds);
      setMessage(`已刪除 ${selectedIds.length} 筆聯盟行銷內容。`);
      router.refresh();
    } catch (error) {
      setAffiliates(initialAffiliates);
      setMessage(`資料庫刪除失敗。${error instanceof Error ? error.message : ""}`);
    }
  }

  async function submitAffiliate(event: FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }

    const mode = affiliates.some((item) => item.id === editing.id) ? "update" : "create";
    const optimisticAffiliate = normalizeAffiliate(editing);
    const optimisticList =
      mode === "update"
        ? affiliates.map((item) => (item.id === optimisticAffiliate.id ? optimisticAffiliate : item))
        : [optimisticAffiliate, ...affiliates];

    setAffiliates(optimisticList);
    setMessage("正在儲存聯盟行銷內容。");

    try {
      const saved = await saveAffiliate(optimisticAffiliate, mode);
      setAffiliates((current) => (mode === "update" ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current.filter((item) => item.id !== optimisticAffiliate.id)]));
      setSelectedIds([saved.id]);
      setEditing(saved);
      setMessage(`已儲存「${saved.title}」。`);
      router.refresh();
    } catch (error) {
      setAffiliates(initialAffiliates);
      setMessage(`資料庫儲存失敗。${error instanceof Error ? error.message : ""}`);
    }
  }

  function patchEditing(patch: Partial<AffiliateRecord>) {
    setEditing((current) => (current ? { ...current, ...patch } : current));
  }

  return (
    <AdminShell>
      <form
        className={styles.listTools}
        onSubmit={(event) => {
          event.preventDefault();
          router.push(buildPageHref(filters, 1, { q: search }));
        }}
      >
        <input
          value={search}
          maxLength={100}
          placeholder="搜尋標題"
          aria-label="搜尋聯盟標題"
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          value={filters.category}
          onChange={(event) => router.push(buildPageHref(filters, 1, { category: event.target.value }))}
          aria-label="分類篩選"
        >
          <option value="">全部分類</option>
          {categoryOptions.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(event) =>
            router.push(
              buildPageHref(filters, 1, {
                status: event.target.value === "published" || event.target.value === "draft" ? event.target.value : ""
              })
            )
          }
          aria-label="狀態篩選"
        >
          <option value="">全部狀態</option>
          <option value="published">已發布</option>
          <option value="draft">草稿</option>
        </select>
        <button className={styles.ghostButton} type="submit">
          搜尋
        </button>
        <button className={styles.ghostButton} type="button" onClick={openEdit}>
          編輯
        </button>
        <button type="button" onClick={removeSelected}>
          刪除
        </button>
        <div className={styles.toolSpacer} />
        <button type="button" onClick={openNew}>
          新增產品
        </button>
      </form>

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
            {affiliates.map((affiliate) => (
              <tr key={affiliate.id} className={selectedIds.includes(affiliate.id) ? styles.selectedRow : undefined}>
                <td>
                  <input checked={selectedIds.includes(affiliate.id)} type="checkbox" onChange={() => toggleSelected(affiliate.id)} aria-label={`選取 ${affiliate.title}`} />
                </td>
                <td>{affiliate.category}</td>
                <td>{affiliate.title}</td>
                <td>{affiliateStatusLabels[affiliate.status]}</td>
                <td>{affiliate.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label="聯盟內容分頁">
        {page > 1 ? (
          <Link href={buildPageHref(filters, page - 1)} prefetch={false}>
            上一頁
          </Link>
        ) : null}
        <span>
          第 {page}／{pageCount} 頁
        </span>
        {page < pageCount ? (
          <Link href={buildPageHref(filters, page + 1)} prefetch={false}>
            下一頁
          </Link>
        ) : null}
      </nav>

      {editing ? (
        <form className={styles.editorForm} onSubmit={submitAffiliate}>
          <label className={styles.field}>
            <span>文章標題</span>
            <input value={editing.title} onChange={(event) => patchEditing({ title: event.target.value })} />
          </label>
          <label className={styles.field}>
            <span>文章摘要（SEO 描述）</span>
            <textarea value={editing.summary} onChange={(event) => patchEditing({ summary: event.target.value })} />
          </label>
          <div className={styles.articleSettings}>
            <label>
              <span>分類</span>
              <input value={editing.category} onChange={(event) => patchEditing({ category: event.target.value })} />
            </label>
            <label>
              <span>日期</span>
              <input type="date" value={editing.date} onChange={(event) => patchEditing({ date: event.target.value })} />
            </label>
            <label>
              <span>網址代稱</span>
              <input value={editing.slug} onChange={(event) => patchEditing({ slug: event.target.value })} />
            </label>
          </div>
          <div className={styles.articleSettings}>
            <label>
              <span>狀態</span>
              <select value={editing.status} onChange={(event) => patchEditing({ status: event.target.value === "published" ? "published" : "draft" })}>
                <option value="draft">草稿</option>
                <option value="published">已發布</option>
              </select>
            </label>
            <label>
              <span>導購連結</span>
              <input value={editing.linkUrl} onChange={(event) => patchEditing({ linkUrl: event.target.value })} />
            </label>
            <label>
              <span>首圖網址</span>
              <input value={editing.imageUrl} onChange={(event) => patchEditing({ imageUrl: event.target.value })} />
            </label>
          </div>
          <label className={styles.field}>
            <span>可以編輯的 HTML（聯盟行銷 LP）</span>
            <textarea value={editing.html} onChange={(event) => patchEditing({ html: event.target.value })} />
          </label>
          <div className={styles.bottomGrid}>
            <label className={styles.tagBox}>
              <span>TAG（SEO）</span>
              <textarea value={editing.tags} onChange={(event) => patchEditing({ tags: event.target.value })} />
            </label>
            <section className={styles.coverBox}>
              <h2>首圖／分享圖</h2>
              <div>{editing.imageUrl ? <img src={editing.imageUrl} alt="" /> : null}</div>
              <div className={styles.coverActions}>
                <button className={styles.ghostButton} type="button" onClick={() => patchEditing({ imageUrl: "" })}>
                  移除
                </button>
                <label className={styles.coverUpload}>
                  上傳
                  <input type="file" accept="image/*" onChange={(event) => readFileAsDataUrl(event, (url) => patchEditing({ imageUrl: url }))} />
                </label>
              </div>
            </section>
          </div>
          <div className={styles.formActions}>
            <a className={styles.primaryLink} href="/affiliates" target="_blank" rel="noreferrer">
              預覽
            </a>
            <button type="submit">{affiliates.some((item) => item.id === editing.id) ? "儲存文章" : "新增文章"}</button>
          </div>
        </form>
      ) : null}
    </AdminShell>
  );
}
