"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteFooter from "../SiteFooter";
import { readQuotesWithFallback } from "../quotes/quoteStorage";
import { QuoteRecord } from "../quotes/quoteTypes";
import { getDisplayTags, getNotePath } from "./noteTypes";
import { PublicNoteRecord, readNotesWithFallback } from "./noteStorage";
import homeStyles from "../page.module.scss";
import styles from "./NotesList.module.scss";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "#" },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const parallaxBalls = [
  { className: homeStyles.ballTopLeft, y: -0.1, x: 0.035 },
  { className: homeStyles.ballHeroRight, y: 0.08, x: -0.03 },
  { className: homeStyles.ballLeftLarge, y: -0.16, x: 0.055 },
  { className: homeStyles.ballHeroPink, y: 0.12, x: -0.05 },
  { className: homeStyles.ballArticleTop, y: 0.18, x: -0.07 },
  { className: homeStyles.ballSideGreen, y: -0.14, x: 0.06 },
  { className: homeStyles.ballContent, y: 0.11, x: 0.04 },
  { className: homeStyles.ballBottomLeft, y: -0.2, x: 0.075 },
  { className: homeStyles.ballBottomPink, y: 0.16, x: -0.065 },
  { className: homeStyles.ballFooterGold, y: -0.12, x: 0.05 },
  { className: homeStyles.ballFooterGreen, y: 0.14, x: -0.055 }
];

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function getNoteExcerpt(note: PublicNoteRecord) {
  const firstText = note.blocks.find((block) => block.type === "text" || block.type === "note");
  const text = firstText ? stripHtml(firstText.html) : "";
  return note.summary || text || "日文學習筆記。";
}

function getNoteImage(note: PublicNoteRecord) {
  const imageBlock = note.blocks.find((block) => block.type === "image" && block.imageUrl);
  return note.coverUrl || imageBlock?.imageUrl || "";
}

function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      setScrollY(window.scrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={homeStyles.parallax} aria-hidden="true">
      {parallaxBalls.map((ball, index) => (
        <span
          key={ball.className}
          className={`${homeStyles.ball} ${ball.className}`}
          style={{
            transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)`
          }}
        />
      ))}
    </div>
  );
}

export default function NotesListClient({
  initialBoardItems = [],
  initialCategory = "",
  initialNotes = []
}: {
  initialBoardItems?: QuoteRecord[];
  initialCategory?: string;
  initialNotes?: PublicNoteRecord[];
}) {
  const [notes, setNotes] = useState<PublicNoteRecord[]>(initialNotes);
  const [boardItems, setBoardItems] = useState<QuoteRecord[]>(initialBoardItems);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function loadNotesPageData() {
      const [nextNotes, nextBoardItems] = await Promise.all([
        readNotesWithFallback("published"),
        readQuotesWithFallback()
      ]);

      if (active) {
        setNotes(nextNotes);
        setBoardItems(nextBoardItems);
      }
    }

    loadNotesPageData();
    setSelectedCategory(new URLSearchParams(window.location.search).get("category") ?? initialCategory);

    return () => {
      active = false;
    };
  }, [initialCategory]);

  const categories = useMemo(() => {
    const names = notes
      .filter((note) => note.status === "已發布")
      .map((note) => note.category.trim())
      .filter(Boolean);

    return Array.from(new Set(names)).sort((first, second) => first.localeCompare(second, "zh-Hant"));
  }, [notes]);

  const publishedNotes = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    return notes
      .filter((note) => note.status === "已發布")
      .filter((note) => !selectedCategory || note.category === selectedCategory)
      .filter((note) => {
        if (!keyword) {
          return true;
        }

        return [note.title, note.summary, note.category, note.tags].some((value) => value.toLowerCase().includes(keyword));
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [notes, searchQuery, selectedCategory]);

  const statItems = useMemo(
    () => [
      [boardItems.length.toLocaleString("en-US"), "學習例句"],
      [publishedNotes.length.toLocaleString("en-US"), "已收錄文章"],
      ["N5", "目前等級"]
    ],
    [boardItems.length, publishedNotes.length]
  );

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />

      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <a className={homeStyles.logoMark} href="/" aria-label="JapanNote">
            <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
          </a>
          <a className={homeStyles.badge} href="https://www.youtube.com/@japanNote" aria-label="JapanNote YouTube" target="_blank" rel="noreferrer">
            <Image src="/brand/japannote-badge.png" alt="JapanNote" width={204} height={47} priority />
          </a>
          <nav className={homeStyles.nav} aria-label="主要選單">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className={item.label === "學習筆記" ? homeStyles.activeNav : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>{selectedCategory || "學習筆記"}</h1>
            <p className={homeStyles.heroLead}>整理日文學習文章、例句筆記與主題分類</p>
            <div className={homeStyles.stats} aria-label="學習筆記統計">
              {statItems.map(([value, label], index) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="學習筆記插圖" width={420} height={420} priority />
            <div className={homeStyles.speech}>每日 10 分鐘學日文</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <div className={styles.notesLayout}>
        <section className={styles.filterBar} aria-label="文章篩選">
          <label>
            <span>搜尋文章</span>
            <input
              type="search"
              value={searchQuery}
              placeholder="輸入標題、摘要或 tag"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
          <label>
            <span>分類</span>
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
              <option value="">全部分類</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className={styles.grid} aria-label="已發布文章">
          {publishedNotes.map((note) => {
            const image = getNoteImage(note);
            const tags = getDisplayTags(note.tags);

            return (
              <a className={styles.card} href={getNotePath(note)} key={note.id}>
                <div className={styles.cover}>
                  {image ? <img className={styles.coverImage} src={image} alt="" /> : <div className={styles.coverFallback}>{note.category}</div>}
                  {note.category ? <span className={styles.categoryPill}>{note.category}</span> : null}
                </div>
                <div className={styles.cardBody}>
                  <h2>{note.title}</h2>
                  <p>{getNoteExcerpt(note)}</p>
                  <div className={styles.cardMeta}>
                    <span>{note.date}</span>
                    {tags.map((tag) => (
                      <strong key={tag}>#{tag}</strong>
                    ))}
                  </div>
                </div>
              </a>
            );
          })}
        </section>

        {publishedNotes.length === 0 && <p className={styles.empty}>目前沒有已發布文章。</p>}
      </div>

      <SiteFooter />
    </main>
  );
}
