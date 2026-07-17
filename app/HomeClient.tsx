"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import AdSlot from "./ads/AdSlot";
import { getAdSlotFromLabel } from "./ads/adTypes";
import SiteFooter from "./SiteFooter";
import { renderInlineRuby } from "../lib/japaneseText";
import NotesFrontClient from "./notes/NotesFrontClient";
import { getNotePath, getNotePreviewImage, PublicNoteRecord, readNotesWithFallback } from "./notes/noteStorage";
import { readWordCardsWithFallback } from "./words/wordStorage";
import { WordCardRecord } from "./words/wordTypes";
import { getOrCreateVisitorId } from "../lib/siteVisitor";
import { defaultQuotes, QuoteRecord } from "./quotes/quoteTypes";
import styles from "./page.module.scss";

export type HomeLearningStats = {
  currentLevel: string;
  learningDays: number;
  wordCount: number;
};

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "#" },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const publicSiteUrl = "https://japan-note.com";

const parallaxBalls = [
  { className: styles.ballTopLeft, y: -0.1, x: 0.035 },
  { className: styles.ballHeroRight, y: 0.08, x: -0.03 },
  { className: styles.ballLeftLarge, y: -0.16, x: 0.055 },
  { className: styles.ballHeroPink, y: 0.12, x: -0.05 },
  { className: styles.ballArticleTop, y: 0.18, x: -0.07 },
  { className: styles.ballSideGreen, y: -0.14, x: 0.06 },
  { className: styles.ballContent, y: 0.11, x: 0.04 },
  { className: styles.ballBottomLeft, y: -0.2, x: 0.075 },
  { className: styles.ballBottomPink, y: 0.16, x: -0.065 },
  { className: styles.ballFooterGold, y: -0.12, x: 0.05 },
  { className: styles.ballFooterGreen, y: 0.14, x: -0.055 }
];

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").trim();
}

function getPlainLines(html: string) {
  return html
    .replace(/<\/(div|p|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getNoteItems(html: string) {
  const lines = getPlainLines(html);
  const items: string[][] = [];

  for (let index = 0; index < lines.length; index += 2) {
    items.push(lines.slice(index, index + 2));
  }

  return items;
}

function NoteContent({ html }: { html: string }) {
  const items = getNoteItems(html);

  return (
    <div className={styles.exampleBox}>
      {items.map((item, index) => (
        <div className={styles.noteItem} key={`${item.join("-")}-${index}`}>
          {item.map((line) => {
            const isJapaneseLine = /[ぁ-ゖァ-ヺ]/.test(line);

            return (
              <p
                className={isJapaneseLine ? styles.noteJapaneseLine : styles.noteChineseLine}
                dangerouslySetInnerHTML={{ __html: renderInlineRuby(line) }}
                key={line}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function getNoteImage(note: PublicNoteRecord) {
  return getNotePreviewImage(note);
}

function getPublicNoteShareUrl(note: PublicNoteRecord) {
  const origin = typeof window === "undefined" ? publicSiteUrl : window.location.origin;
  const url = new URL(getNotePath(note), origin);
  const version = [note.id, note.date.replace(/[^\d]/g, "")].filter(Boolean).join("-");
  url.searchParams.set("share", version || String(note.id));
  return url.toString();
}

function getYouTubeEmbedUrl(url: string) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = parsed.searchParams.get("v");

      if (watchId) {
        return `https://www.youtube.com/embed/${watchId}`;
      }

      const [type, id] = parsed.pathname.split("/").filter(Boolean);
      if ((type === "embed" || type === "shorts") && id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
  } catch {
    return "";
  }

  return "";
}

function getCurrentLevel(notes: PublicNoteRecord[]) {
  for (const note of notes) {
    const level = `${note.category} ${note.tags} ${note.title}`.match(/\bN[1-5]\b/i)?.[0];

    if (level) {
      return level.toUpperCase();
    }
  }

  return "-";
}

function getCurrentWordLevel(words: WordCardRecord[]) {
  for (const word of words) {
    const level = word.category.match(/\bN[1-5]\b/i)?.[0];

    if (level) {
      return level.toUpperCase();
    }
  }

  return "-";
}

function getCalendarDayStart(dateText: string) {
  const [year, month, day] = dateText.slice(0, 10).split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function getLearningDays(notes: PublicNoteRecord[]) {
  const dates = notes.map((note) => note.date).filter(Boolean).sort();
  const start = dates[0] ? getCalendarDayStart(dates[0]) : null;

  if (start === null) {
    return 0;
  }

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const elapsedDays = Math.floor((today - start) / 86_400_000) + 1;

  return Math.max(elapsedDays, 1);
}

function getFallbackLearningStats(notes: PublicNoteRecord[], words: WordCardRecord[]): HomeLearningStats {
  const publishedNotes = notes.filter((note) => note.status === "已發布");

  return {
    currentLevel: getCurrentLevel(publishedNotes) === "-" ? getCurrentWordLevel(words) : getCurrentLevel(publishedNotes),
    learningDays: getLearningDays(publishedNotes),
    wordCount: words.length
  };
}

function isDirectVideoUrl(url: string) {
  try {
    const parsed = new URL(url);
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
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
    <div className={styles.parallax} aria-hidden="true">
      {parallaxBalls.map((ball, index) => (
        <span
          key={ball.className}
          className={`${styles.ball} ${ball.className}`}
          style={{
            transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)`
          }}
        />
      ))}
    </div>
  );
}

function ArticleToc({
  className,
  items
}: {
  className?: string;
  items?: { label: string; id: string }[];
}) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav className={`${styles.toc} ${className ?? ""}`} aria-label="文章內容">
      <strong>文章內容</strong>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
  return Promise.resolve();
}

function ArticleShareList({ note, summary, title }: { note?: PublicNoteRecord | null; summary: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    if (!note) {
      return window.location.href;
    }

    return getPublicNoteShareUrl(note);
  };

  const encodedShareText = encodeURIComponent([title, summary].filter(Boolean).join("\n"));
  const getFacebookShareUrl = () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}`;
  const getLineShareUrl = () => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(getShareUrl())}&text=${encodedShareText}`;

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=640");
  };

  const shareToFacebook = () => {
    openShareWindow(getFacebookShareUrl());
  };

  const shareToLine = () => {
    openShareWindow(getLineShareUrl());
  };

  const copyShareUrl = async () => {
    const currentShareUrl = getShareUrl();

    if (!currentShareUrl) {
      return;
    }

    try {
      await copyToClipboard(currentShareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const shareToInstagram = async () => {
    const currentShareUrl = getShareUrl();

    if (!currentShareUrl) {
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title, text: summary, url: currentShareUrl });
        return;
      } catch {
        return;
      }
    }

    await copyShareUrl();
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.shareList} aria-label="分享列">
      <button type="button" onClick={shareToFacebook} style={{ backgroundColor: "#1877f2" }} aria-label="分享到 Facebook">
        FB
      </button>
      <button type="button" onClick={shareToInstagram} style={{ backgroundColor: "#e4405f" }} aria-label="分享到 Instagram">
        IG
      </button>
      <button type="button" onClick={shareToLine} style={{ backgroundColor: "#06c755" }} aria-label="分享到 LINE">
        LINE
      </button>
      <button type="button" onClick={copyShareUrl} style={{ backgroundColor: "#7d7d7d" }} aria-label="複製網址">
        {copied ? "已複製" : "複製網址"}
      </button>
    </div>
  );
}

export default function Home({
  initialLearningStats,
  initialNotes = [],
  initialQuotes = defaultQuotes,
  initialSelectedNoteId,
  initialSelectedNoteSlug,
  initialWords = []
}: {
  initialLearningStats?: HomeLearningStats;
  initialNotes?: PublicNoteRecord[];
  initialQuotes?: QuoteRecord[];
  initialSelectedNoteId?: string;
  initialSelectedNoteSlug?: string;
  initialWords?: WordCardRecord[];
}) {
  const initialNoteId = Number(initialSelectedNoteId);
  const initialSelectedNote =
    initialSelectedNoteSlug
      ? initialNotes.find((note) => note.slug === initialSelectedNoteSlug || String(note.id) === initialSelectedNoteSlug) ?? null
      : initialSelectedNoteId && Number.isFinite(initialNoteId)
        ? initialNotes.find((note) => note.id === initialNoteId) ?? null
        : null;
  const [notes, setNotes] = useState<PublicNoteRecord[]>(initialNotes);
  const [words, setWords] = useState<WordCardRecord[]>(initialWords);
  const [learningStats, setLearningStats] = useState<HomeLearningStats>(
    initialLearningStats ?? getFallbackLearningStats(initialNotes, initialWords)
  );
  const [currentNote, setCurrentNote] = useState<PublicNoteRecord | null>(initialSelectedNote);
  const [hasSelectedNote, setHasSelectedNote] = useState<boolean | null>(
    initialSelectedNoteId || initialSelectedNoteSlug ? Boolean(initialSelectedNote) : false
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [siteCount, setSiteCount] = useState(0);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarStickyRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarFixed, setIsSidebarFixed] = useState(false);
  const [sidebarBox, setSidebarBox] = useState({ height: 0, left: 0, top: 88, width: 0 });

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      const [storedNotes, storedWords] = await Promise.all([
        readNotesWithFallback("published"),
        readWordCardsWithFallback()
      ]);

      if (!active) {
        return;
      }

      const nextNotes = storedNotes.length > 0 || initialNotes.length === 0 ? storedNotes : initialNotes;
      const nextWords = storedWords.length > 0 || initialWords.length === 0 ? storedWords : initialWords;
      setNotes(nextNotes);
      setWords(nextWords);
      const rawNoteId = initialSelectedNoteSlug ?? new URLSearchParams(window.location.search).get("note");
      const noteId = Number(rawNoteId);
      const selectedNote = rawNoteId
        ? nextNotes.find((note) => note.slug === rawNoteId || (Number.isFinite(noteId) && note.id === noteId))
        : undefined;
      const hydratedSelectedNote =
        selectedNote && selectedNote.blocks.length > 0 ? selectedNote : initialSelectedNote ?? selectedNote;
      setCurrentNote(hydratedSelectedNote ?? null);
      setHasSelectedNote(Boolean(hydratedSelectedNote));
    }

    loadHomeData();

    return () => {
      active = false;
    };
  }, [initialNotes, initialSelectedNote, initialSelectedNoteSlug, initialWords]);

  useEffect(() => {
    let active = true;

    async function loadLearningStats() {
      try {
        const response = await fetch("/api/home-stats", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as Partial<HomeLearningStats>;

        if (!active) {
          return;
        }

        setLearningStats({
          currentLevel: typeof payload.currentLevel === "string" ? payload.currentLevel : "-",
          learningDays: Number.isFinite(payload.learningDays) ? Number(payload.learningDays) : 0,
          wordCount: words.length || (Number.isFinite(payload.wordCount) ? Number(payload.wordCount) : 0)
        });
      } catch {
        if (active) {
          setLearningStats(getFallbackLearningStats(notes, words));
        }
      }
    }

    loadLearningStats();

    return () => {
      active = false;
    };
  }, [notes, words]);

  useEffect(() => {
    let active = true;

    async function recordSiteVisit() {
      try {
        const visitorId = getOrCreateVisitorId();
        const response = await fetch("/api/site-stats", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId })
        });
        const payload = (await response.json()) as { visitorCount?: number };

        if (active) {
          setSiteCount(Number.isFinite(payload.visitorCount) ? Number(payload.visitorCount) : 0);
        }
      } catch {
        if (active) {
          setSiteCount(0);
        }
      }
    }

    recordSiteVisit();

    return () => {
      active = false;
    };
  }, []);

  const publishedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.status === "已發布")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [notes]
  );

  const displayedWordCount = words.length || learningStats.wordCount;

  const statItems = useMemo(
    () => [
      [displayedWordCount.toLocaleString("en-US"), "已收錄單字"],
      [learningStats.learningDays.toLocaleString("en-US"), "已經學習天數"],
      [learningStats.currentLevel, "目前程度"]
    ],
    [displayedWordCount, learningStats]
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    publishedNotes.forEach((note) => {
      const category = note.category?.trim();

      if (!category) {
        return;
      }

      counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort(([first], [second]) => first.localeCompare(second, "zh-Hant"));
  }, [publishedNotes]);

  const popularNotes = useMemo(() => publishedNotes.slice(0, 5), [publishedNotes]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();

    publishedNotes.forEach((note) => {
      note.tags
        .split(/[,，、\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return Array.from(counts.entries()).sort(([, firstCount], [, secondCount]) => secondCount - firstCount).slice(0, 12);
  }, [publishedNotes]);

  const searchResults = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return [];
    }

    return publishedNotes
      .filter((note) =>
        [note.title, note.summary, note.category, note.tags].some((value) => value.toLowerCase().includes(keyword))
      )
      .slice(0, 5);
  }, [publishedNotes, searchQuery]);

  const articleImage = currentNote ? getNoteImage(currentNote) : "";
  const articleBlocks = currentNote?.blocks ?? [];
  const tocItems = articleBlocks
    .map((block, index) => ({ label: block.heading?.trim() ?? "", id: `article-section-${index}` }))
    .filter((item) => item.label);

  useEffect(() => {
    let frameId = 0;

    const updateSidebarPosition = () => {
      frameId = 0;

      const sidebar = sidebarRef.current;
      const sidebarSticky = sidebarStickyRef.current;

      if (!sidebar || !sidebarSticky) {
        return;
      }

      const isDesktop = !window.matchMedia("(max-width: 820px)").matches;
      const fixedTop = 88;
      const sidebarRect = sidebar.getBoundingClientRect();
      const stickyRect = sidebarSticky.getBoundingClientRect();
      const sidebarTop = sidebarRect.top + window.scrollY;
      const shouldFix = isDesktop && window.scrollY >= sidebarTop - fixedTop;

      setIsSidebarFixed(shouldFix);
      setSidebarBox({
        height: stickyRect.height,
        left: sidebarRect.left,
        top: fixedTop,
        width: sidebarRect.width
      });
    };

    const scheduleUpdate = () => {
      if (frameId) {
        return;
      }

      frameId = window.requestAnimationFrame(updateSidebarPosition);
    };

    updateSidebarPosition();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [categories.length, popularNotes.length, searchResults.length, tags.length, tocItems.length]);

  if (hasSelectedNote !== true) {
    return <NotesFrontClient initialBoardItems={initialQuotes} initialNotes={initialNotes} initialWords={initialWords} siteCount={siteCount} />;
  }

  return (
    <main className={styles.page}>
      <ParallaxBackground />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.logoMark} href="/" aria-label="JapanNote">
            <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
          </a>
          <a className={styles.badge} href="https://www.youtube.com/@japanNote" aria-label="JapanNote YouTube" target="_blank" rel="noreferrer">
            <Image src="/brand/japannote-badge.png" alt="JapanNote" width={204} height={47} priority />
          </a>
          <nav className={styles.nav} aria-label="主要選單">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className={item.label === "學習筆記" ? styles.activeNav : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <h1>日文筆記</h1>
            <p className={styles.heroLead}>零基礎養成一起開始，每天一起練習日文吧</p>
            <div className={styles.stats} aria-label="學習統計">
              {statItems.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.heroArt}>
            <div className={styles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="日文筆記角色" width={420} height={420} priority />
            {siteCount > 0 ? <div className={styles.speech}>有 {siteCount.toLocaleString("en-US")} 位一起學了喔</div> : null}
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={styles.adWide} />

      <div className={styles.layout}>
        <article className={styles.article}>
          <div className={styles.videoBox}>{articleImage ? <img src={articleImage} alt="" /> : "yt/封面"}</div>

          <div className={styles.titleRow}>
            <span className={styles.titleBar} />
            <div>
              <h2>{currentNote?.title ?? "標題"}</h2>
              <p>{currentNote ? `${currentNote.category}　${currentNote.date}` : "觀看 0 次"}</p>
            </div>
            <ArticleShareList note={currentNote} title={currentNote?.title ?? "JapanNote"} summary={currentNote?.summary ?? ""} />
          </div>

          <section className={styles.summary}>{currentNote?.summary || "文章摘要"}</section>
          <ArticleToc className={styles.mobileToc} items={tocItems} />

          {articleBlocks.length > 0 ? (
            articleBlocks.map((block, index) => {
              const sectionId = `article-section-${index}`;

              if (block.type === "image") {
                return (
                  <section className={styles.contentBlock} id={sectionId} key={block.id}>
                    {block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}
                    <div className={styles.imagePlaceholder}>
                      {block.imageUrl ? <img src={block.imageUrl} alt="" /> : null}
                    </div>
                  </section>
                );
              }

              if (block.type === "video") {
                const videoUrl = block.videoUrl?.trim() ?? "";
                const embedUrl = getYouTubeEmbedUrl(videoUrl);
                const isDirectVideo = isDirectVideoUrl(videoUrl);

                return (
                  <section className={styles.contentBlock} id={sectionId} key={block.id}>
                    {block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}
                    <div className={styles.videoBox}>
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          title={block.caption || block.heading || "影片"}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : isDirectVideo ? (
                        <video controls src={videoUrl}>
                          你的瀏覽器不支援影片播放。
                        </video>
                      ) : videoUrl ? (
                        <a href={videoUrl} target="_blank" rel="noreferrer">
                          開啟影片連結
                        </a>
                      ) : (
                        block.caption || "影片連結"
                      )}
                    </div>
                    {block.caption ? <p className={styles.videoCaption}>{block.caption}</p> : null}
                  </section>
                );
              }

              if (block.type === "ad") {
                return <AdSlot slot={getAdSlotFromLabel(block.adSlot)} className={styles.adWideSmall} fallbackLabel={block.adSlot || "AD 廣告"} key={block.id} />;
              }

              return (
                <section className={styles.contentBlock} id={sectionId} key={block.id}>
                  {block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}
                  {block.type === "note" ? (
                    <NoteContent html={block.html} />
                  ) : (
                    <div className={styles.poemCard} dangerouslySetInnerHTML={{ __html: block.type === "text" ? renderInlineRuby(block.html) : block.html }} />
                  )}
                </section>
              );
            })
          ) : (
            <section className={styles.contentBlock}>
              <h3>小標題</h3>
              <div className={styles.poemCard}>文章內容</div>
            </section>
          )}
        </article>

        <aside className={styles.sidebar} ref={sidebarRef} style={{ minHeight: sidebarBox.height || undefined }}>
          <div
            className={`${styles.sidebarSticky} ${isSidebarFixed ? styles.sidebarFixed : ""}`}
            ref={sidebarStickyRef}
            style={
              isSidebarFixed
                ? ({
                    "--sidebar-fixed-top": `${sidebarBox.top}px`,
                    left: sidebarBox.left,
                    width: sidebarBox.width
                  } as CSSProperties)
                : undefined
            }
          >
            <label>
              <span>我想要找...</span>
              <input
                aria-label="搜尋文章"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            {searchQuery.trim() ? (
              <section>
                <h2>搜尋結果</h2>
                {searchResults.length > 0 ? (
                  <div className={styles.sidebarLinkList}>
                    {searchResults.map((note) => (
                      <a key={note.id} href={getNotePath(note)}>
                        <strong>{note.title}</strong>
                        <span>{note.category}　{note.date}</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptySidebarText}>沒有符合的文章</p>
                )}
              </section>
            ) : null}
            <section>
              <h2>文章分類</h2>
              {categories.length > 0 ? (
                <div className={styles.categoryList}>
                  {categories.map(([category, count]) => (
                    <a key={category} href={`/notes?category=${encodeURIComponent(category)}`}>
                      <span>{category}</span>
                      <strong>{count}</strong>
                    </a>
                  ))}
                </div>
              ) : (
                <p className={styles.emptySidebarText}>尚無分類</p>
              )}
            </section>
            <section>
              <h2>熱門文章</h2>
              {popularNotes.length > 0 ? (
                <div className={styles.sidebarLinkList}>
                  {popularNotes.map((note) => (
                    <a key={note.id} href={getNotePath(note)}>
                      <strong>{note.title}</strong>
                      <span>{note.category}　{note.date}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className={styles.emptySidebarText}>尚無熱門文章</p>
              )}
            </section>
            <section>
              <h2>tag</h2>
              {tags.length > 0 ? (
                <div className={styles.tagList}>
                  {tags.map(([tag, count]) => (
                    <button key={tag} type="button" onClick={() => setSearchQuery(tag)}>
                      <span>{tag}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.emptySidebarText}>尚無 tag</p>
              )}
            </section>
            <AdSlot slot="sidebar-square" className={styles.adSquare} />
            <ArticleToc className={styles.sidebarToc} items={tocItems} />
          </div>
        </aside>
      </div>

      <SiteFooter />
    </main>
  );
}
