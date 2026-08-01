"use client";

import { renderInlineRuby } from "../../lib/japaneseText";
import AdSlot from "../ads/AdSlot";
import { getAdSlotFromLabel } from "../ads/adTypes";
import styles from "../page.module.scss";
import type { NoteContentBlock } from "./noteTypes";

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

function NoteContent({ html }: { html: string }) {
  const lines = getPlainLines(html);
  const items: string[][] = [];
  for (let index = 0; index < lines.length; index += 2) items.push(lines.slice(index, index + 2));

  return <div className={styles.exampleBox}>{items.map((item, index) => <div className={styles.noteItem} key={`${item.join("-")}-${index}`}>{item.map((line) => <p className={/[ぁ-ゖァ-ヺ]/.test(line) ? styles.noteJapaneseLine : styles.noteChineseLine} dangerouslySetInnerHTML={{ __html: renderInlineRuby(line) }} key={line} />)}</div>)}</div>;
}

function getYouTubeEmbedUrl(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return `https://www.youtube.com/embed/${watchId}`;
      const [type, id] = parsed.pathname.split("/").filter(Boolean);
      if ((type === "embed" || type === "shorts") && id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {
    return "";
  }
  return "";
}

function isDirectVideoUrl(url: string) {
  try {
    return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export default function NoteBlocksContent({ blocks, emptyFallback = false, idPrefix = "article-section" }: { blocks: NoteContentBlock[]; emptyFallback?: boolean; idPrefix?: string }) {
  if (blocks.length === 0) {
    return emptyFallback ? <section className={styles.contentBlock}><h3>小標題</h3><div className={styles.poemCard}>文章內容</div></section> : null;
  }

  return <>{blocks.map((block, index) => {
    const sectionId = `${idPrefix}-${index}`;
    if (block.type === "image") return <section className={styles.contentBlock} id={sectionId} key={block.id}>{block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}<div className={styles.imagePlaceholder}>{block.imageUrl ? <img src={block.imageUrl} alt="" /> : null}</div></section>;
    if (block.type === "video") {
      const videoUrl = block.videoUrl?.trim() ?? "";
      const embedUrl = getYouTubeEmbedUrl(videoUrl);
      return <section className={styles.contentBlock} id={sectionId} key={block.id}>{block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}<div className={styles.videoBox}>{embedUrl ? <iframe src={embedUrl} title={block.caption || block.heading || "影片"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : isDirectVideoUrl(videoUrl) ? <video controls src={videoUrl}>你的瀏覽器不支援影片播放。</video> : videoUrl ? <a href={videoUrl} target="_blank" rel="noreferrer">開啟影片連結</a> : block.caption || "影片連結"}</div>{block.caption ? <p className={styles.videoCaption}>{block.caption}</p> : null}</section>;
    }
    if (block.type === "ad") return <AdSlot slot={getAdSlotFromLabel(block.adSlot)} className={styles.adWideSmall} fallbackLabel={block.adSlot || "AD 廣告"} key={block.id} />;
    return <section className={styles.contentBlock} id={sectionId} key={block.id}>{block.heading?.trim() ? <h3>{block.heading.trim()}</h3> : null}{block.type === "note" ? <NoteContent html={block.html} /> : <div className={styles.poemCard} dangerouslySetInnerHTML={{ __html: renderInlineRuby(block.html) }} />}</section>;
  })}</>;
}
