"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteFooter from "../SiteFooter";
import { PublicNoteRecord, readNotesWithFallback } from "./noteStorage";
import { getDisplayTags, getNotePath } from "./noteTypes";
import { readWordCardsWithFallback } from "../words/wordStorage";
import { WordCardRecord } from "../words/wordTypes";
import { defaultQuotes, QuoteRecord } from "../quotes/quoteTypes";
import { readQuotesWithFallback } from "../quotes/quoteStorage";
import { readingsToSpeechText, renderWordRuby, shouldShowStandaloneKana, stripInlineReadings } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import styles from "./NotesFront.module.scss";

const publishedStatus = "已發布";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "#" },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const japaneseSpeechRate = 0.8;
const preferredJapaneseVoiceName = "Google 日本語";

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
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function getNoteExcerpt(note: PublicNoteRecord) {
  const firstText = note.blocks.find((block) => block.type === "text" || block.type === "note");
  const text = firstText ? stripHtml(firstText.html) : "";
  return note.summary || text || "日文學習筆記";
}

function getNoteImage(note: PublicNoteRecord) {
  const imageBlock = note.blocks.find((block) => block.type === "image" && block.imageUrl);
  return note.coverUrl || imageBlock?.imageUrl || "";
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className={styles.sectionTitle}>
      <span />
      <h2>{title}</h2>
    </div>
  );
}

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === preferredJapaneseVoiceName) ?? voices.find((voice) => voice.lang.startsWith("ja")) ?? null;
}

function getWordSpeechText(word: Pick<WordCardRecord, "japanese" | "kana">) {
  return word.kana.trim() || readingsToSpeechText(word.japanese);
}

function NoteCard({ note }: { note: PublicNoteRecord }) {
  const image = getNoteImage(note);
  const tags = getDisplayTags(note.tags);

  return (
    <a className={styles.card} href={getNotePath(note)}>
      <div className={styles.cover}>
        {image ? <img className={styles.coverImage} src={image} alt="" /> : <div className={styles.coverFallback}>{note.category || "N5"}</div>}
        {note.category ? <span className={styles.categoryPill}>{note.category}</span> : null}
      </div>
      <div className={styles.cardBody}>
        <h3>{note.title || "未命名筆記"}</h3>
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
}

function speakWord(word: WordCardRecord) {
  const audioUrl = word.frontAudioUrl || word.audioUrl;

  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => undefined);
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(getWordSpeechText(word));
    const voice = getJapaneseVoice();
    utterance.lang = "ja-JP";
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = japaneseSpeechRate;
    window.speechSynthesis.speak(utterance);
  }
}

function WordCard({ word }: { word: WordCardRecord }) {
  const shouldShowKana = shouldShowStandaloneKana(word.japanese, word.kana);

  return (
    <article className={styles.wordCard}>
      <button
        className={styles.audioMark}
        type="button"
        onClick={() => speakWord(word)}
        aria-label={`播放 ${stripInlineReadings(word.japanese)}`}
      >
        <img src="/brand/muc.png" alt="" />
      </button>
      <div className={styles.wordCardTop}>
        {shouldShowKana ? <small>{word.kana}</small> : <small>{word.category}</small>}
        <strong dangerouslySetInnerHTML={{ __html: renderWordRuby(word.japanese, word.kana) }} />
      </div>
      <div className={styles.wordCardBottom}>{word.chinese}</div>
    </article>
  );
}

function speakBoardItem(item: QuoteRecord) {
  if (item.frontAudioUrl) {
    new Audio(item.frontAudioUrl).play().catch(() => undefined);
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(getWordSpeechText(item));
    const voice = getJapaneseVoice();
    utterance.lang = "ja-JP";
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = japaneseSpeechRate;
    window.speechSynthesis.speak(utterance);
  }
}

function HeroBoardCard({ item }: { item: QuoteRecord }) {
  const shouldShowKana = shouldShowStandaloneKana(item.japanese, item.kana);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      speakBoardItem(item);
    }
  };

  return (
    <article
      className={styles.heroBoardCard}
      role="button"
      tabIndex={0}
      onClick={() => speakBoardItem(item)}
      onKeyDown={handleKeyDown}
      aria-label={`播放 ${stripInlineReadings(item.japanese)}`}
    >
      <div className={styles.heroBoardContent}>
        {shouldShowKana ? <small>{item.kana}</small> : null}
        <strong dangerouslySetInnerHTML={{ __html: renderWordRuby(item.japanese, item.kana) }} />
        <span>{item.chinese}</span>
      </div>
    </article>
  );
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

export default function NotesFrontClient({
  initialBoardItems = defaultQuotes,
  initialNotes = [],
  initialWords = [],
  siteCount
}: {
  initialBoardItems?: QuoteRecord[];
  initialNotes?: PublicNoteRecord[];
  initialWords?: WordCardRecord[];
  siteCount: number;
}) {
  const [notes, setNotes] = useState<PublicNoteRecord[]>(initialNotes);
  const [words, setWords] = useState<WordCardRecord[]>(initialWords);
  const [boardItems, setBoardItems] = useState<QuoteRecord[]>(initialBoardItems.length > 0 ? initialBoardItems : defaultQuotes);

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      const [nextNotes, nextWords, nextQuotes] = await Promise.all([
        readNotesWithFallback("published"),
        readWordCardsWithFallback(),
        readQuotesWithFallback()
      ]);

      if (!active) {
        return;
      }

      setNotes(nextNotes.length > 0 || initialNotes.length === 0 ? nextNotes : initialNotes);
      setWords(nextWords.length > 0 || initialWords.length === 0 ? nextWords : initialWords);
      setBoardItems(nextQuotes.length > 0 ? nextQuotes : initialBoardItems.length > 0 ? initialBoardItems : defaultQuotes);
    }

    loadHomeData();

    return () => {
      active = false;
    };
  }, [initialBoardItems, initialNotes, initialWords]);

  const publishedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.status === publishedStatus)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [notes]
  );

  const latestNotes = useMemo(() => publishedNotes.slice(0, 2), [publishedNotes]);
  const recommendedNotes = useMemo(() => publishedNotes.slice(0, 4), [publishedNotes]);
  const randomWords = useMemo(() => words.slice(0, 4), [words]);
  const randomBoardItem = useMemo(() => boardItems[0] ?? defaultQuotes[0], [boardItems]);

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
          <nav className={homeStyles.nav} aria-label="主選單">
            {navItems.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>日文筆記</h1>
            <p className={homeStyles.heroLead}>每天學習一點點</p>
            <HeroBoardCard item={randomBoardItem} />
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="JapanNote 角色" width={420} height={420} priority />
            <div className={homeStyles.speech}>有 {siteCount.toLocaleString("en-US")} 位一起學了喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <div className={styles.notesLayout}>
        <section className={styles.homeSection}>
          <SectionTitle title="最新筆記" />
          {latestNotes.length > 0 ? (
            <div className={styles.grid}>
              {latestNotes.map((note) => (
                <NoteCard note={note} key={note.id} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有已發布的筆記。</p>
          )}
        </section>

        <section className={styles.homeSection}>
          <SectionTitle title="單字卡" />
          {randomWords.length > 0 ? (
            <div className={styles.wordGrid}>
              {randomWords.map((word) => (
                <WordCard word={word} key={word.id} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有單字卡。</p>
          )}
        </section>

        <AdSlot slot="article-mid" className={homeStyles.adWide} />

        <section className={styles.homeSection}>
          <SectionTitle title="推薦筆記" />
          {recommendedNotes.length > 0 ? (
            <div className={styles.grid}>
              {recommendedNotes.map((note) => (
                <NoteCard note={note} key={note.id} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有推薦筆記。</p>
          )}
        </section>

        <AdSlot slot="article-bottom" className={homeStyles.adWide} />
      </div>

      <SiteFooter />
    </main>
  );
}
