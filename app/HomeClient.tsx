"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import AdSlot from "./ads/AdSlot";
import { getAdSlotFromLabel } from "./ads/adTypes";
import { renderInlineRuby } from "../lib/japaneseText";
import NotesFrontClient from "./notes/NotesFrontClient";
import { PublicNoteRecord, readNotesWithFallback } from "./notes/noteStorage";
import { readWordCardsWithFallback } from "./words/wordStorage";
import { WordCardRecord } from "./words/wordTypes";
import styles from "./page.module.scss";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "#" },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const socialLinks = [
  { label: "YouTube", color: "#ff0000", href: "https://www.youtube.com/@japanNote" },
  { label: "Instagram", color: "#e4405f", href: "#" },
  { label: "Facebook", color: "#1877f2", href: "https://facebook.com/17japanNote" }
];

const publicSiteUrl = "https://japan-note.com";
const siteStatsEventName = "japannote-site-stats";

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
  const imageBlock = note.blocks.find((block) => block.type === "image" && block.imageUrl);
  return note.coverUrl || imageBlock?.imageUrl || "";
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

function ArticleShareList({ imageUrl, noteId, summary, title }: { imageUrl: string; noteId?: number; summary: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    if (!noteId) {
      return window.location.href;
    }

    const params = new URLSearchParams({
      note: String(noteId),
      title,
      summary: summary.slice(0, 240)
    });

    if (imageUrl) {
      params.set("image", imageUrl);
    }

    return `${publicSiteUrl}/?${params.toString()}`;
  };

  const encodedShareText = encodeURIComponent([title, summary].filter(Boolean).join("\n"));
  const getFacebookShareUrl = () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getShareUrl())}&quote=${encodedShareText}`;
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

export default function Home() {
  const [notes, setNotes] = useState<PublicNoteRecord[]>([]);
  const [words, setWords] = useState<WordCardRecord[]>([]);
  const [currentNote, setCurrentNote] = useState<PublicNoteRecord | null>(null);
  const [hasSelectedNote, setHasSelectedNote] = useState<boolean | null>(null);
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

      setNotes(storedNotes);
      setWords(storedWords);
      const rawNoteId = new URLSearchParams(window.location.search).get("note");
      const noteId = Number(rawNoteId);
      const selectedNote = rawNoteId && Number.isFinite(noteId) ? storedNotes.find((note) => note.id === noteId) : undefined;
      setCurrentNote(selectedNote ?? null);
      setHasSelectedNote(Boolean(selectedNote));
    }

    loadHomeData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    function updateSiteCount(payload: { visitorCount?: number }) {
      if (active) {
        setSiteCount(Number.isFinite(payload.visitorCount) ? Number(payload.visitorCount) : 0);
      }
    }

    function handleSiteStats(event: Event) {
      updateSiteCount((event as CustomEvent<{ visitorCount?: number }>).detail ?? {});
    }

    async function loadSiteCount() {
      try {
        const response = await fetch("/api/site-stats", { cache: "no-store" });
        const payload = (await response.json()) as { visitorCount?: number };
        updateSiteCount(payload);
      } catch {
        if (active) {
          setSiteCount(0);
        }
      }
    }

    window.addEventListener(siteStatsEventName, handleSiteStats);
    loadSiteCount();

    return () => {
      active = false;
      window.removeEventListener(siteStatsEventName, handleSiteStats);
    };
  }, []);

  const publishedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.status === "已發布")
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [notes]
  );

  const learningStats = useMemo(() => {
    const learningDays = new Set(publishedNotes.map((note) => note.date).filter(Boolean)).size;

    return {
      wordCount: words.length,
      learningDays,
      currentLevel: getCurrentLevel(publishedNotes),
      siteCount
    };
  }, [publishedNotes, siteCount, words.length]);

  const statItems = useMemo(
    () => [
      [learningStats.wordCount.toLocaleString("en-US"), "已收錄單字"],
      [learningStats.learningDays.toLocaleString("en-US"), "已經學習天數"],
      [learningStats.currentLevel, "目前程度"]
    ],
    [learningStats]
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
    return <NotesFrontClient siteCount={learningStats.siteCount} />;
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
            <div className={styles.speech}>有 {learningStats.siteCount.toLocaleString("en-US")} 位一起學了喔</div>
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
            <ArticleShareList imageUrl={articleImage} noteId={currentNote?.id} title={currentNote?.title ?? "JapanNote"} summary={currentNote?.summary ?? ""} />
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
                      <a key={note.id} href={`/?note=${note.id}`}>
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
                    <a key={note.id} href={`/?note=${note.id}`}>
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

      <footer className={styles.footer}>
        <Image src="/brand/logo.png" alt="" width={72} height={72} />
        <div className={styles.footerLinks}>
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ backgroundColor: link.color }}
              aria-label={link.label}
              target={link.href === "#" ? undefined : "_blank"}
              rel={link.href === "#" ? undefined : "noreferrer"}
            >
              {link.label}
            </a>
          ))}
        </div>
        <p>Copyright © 2026 by japanNote All Rights Reserved</p>
      </footer>
    </main>
  );
}
