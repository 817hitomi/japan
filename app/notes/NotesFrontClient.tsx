"use client";

import Image from "next/image";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteFooter from "../SiteFooter";
import { PublicNoteRecord, readNotesWithFallback } from "./noteStorage";
import { getDisplayTags, getNotePath, getNotePreviewImage } from "./noteTypes";
import { readWordCardsWithFallback } from "../words/wordStorage";
import { WordCardRecord } from "../words/wordTypes";
import {
  getMillisecondsUntilNextTaipeiReset,
  getTaipeiDailySelectionKey,
  selectDailyItems
} from "../dailySelection";
import { defaultQuotes, QuoteRecord } from "../quotes/quoteTypes";
import { readQuotesWithFallback } from "../quotes/quoteStorage";
import HomeRuntimeErrorBoundary from "../HomeRuntimeErrorBoundary";
import HomeQuizCard from "./HomeQuizCard";
import { QuizQuestionRecord } from "../quiz/quizTypes";
import { parseSongTags, SongRelatedItem } from "../songs/songTypes";
import { readingsToSpeechText, renderWordRuby, shouldShowStandaloneKana, stripInlineReadings } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import styles from "./NotesFront.module.scss";

const publishedStatus = "已發布";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "實力挑戰", href: "/quiz", children: [{ label: "文字．語彙", href: "/quiz/vocabulary" }, { label: "文法", href: "/quiz?category=文法" }] },
  { label: "學習筆記", href: "/notes" },
  { label: "留音室", href: "/songs" },
  { label: "登入", href: "/admin" }
];

const japaneseSpeechRate = 0.9;
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
  return getNotePreviewImage(note);
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

function formatSongDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function SongCard({ song }: { song: SongRelatedItem }) {
  const cover = song.coverUrl || (song.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(song.videoId)}/hqdefault.jpg` : "");
  const tags = parseSongTags(song.tags).slice(0, 3);

  return (
    <a className={styles.card} href={`/songs/${encodeURIComponent(song.slug)}`}>
      <div className={styles.cover}>
        {cover ? <img className={styles.coverImage} src={cover} alt="" /> : <div className={`${styles.coverFallback} ${styles.songCoverFallback}`}>♪</div>}
        <span className={styles.categoryPill}>{song.level || "日文歌曲"}</span>
        <span className={styles.songPlayButton} aria-hidden="true">▶</span>
        {song.durationSeconds > 0 ? <span className={styles.songDuration}>{formatSongDuration(song.durationSeconds)}</span> : null}
      </div>
      <div className={styles.cardBody}>
        <h3>{song.title}</h3>
        <p>{song.description || song.artist || "跟著同步歌詞，一句一句聽懂日文。"}</p>
        <div className={styles.cardMeta}>
          <span>{song.publishedDate}{song.artist ? `　${song.artist}` : ""}</span>
          {tags.map((tag) => <strong key={tag}>#{tag}</strong>)}
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

function pickRandomBoardItem(items: QuoteRecord[]) {
  const candidates = items.length > 0 ? items : defaultQuotes;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? defaultQuotes[0];
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
  initialDailySelectionKey = getTaipeiDailySelectionKey(),
  initialNotes = [],
  initialQuizQuestions = [],
  initialSongs = [],
  initialWords = [],
  siteCount
}: {
  initialBoardItems?: QuoteRecord[];
  initialDailySelectionKey?: string;
  initialNotes?: PublicNoteRecord[];
  initialQuizQuestions?: QuizQuestionRecord[];
  initialSongs?: SongRelatedItem[];
  initialWords?: WordCardRecord[];
  siteCount: number;
}) {
  const [dailySelectionKey, setDailySelectionKey] = useState(initialDailySelectionKey);
  const hasInitialBoardItems = Array.isArray(initialBoardItems) && initialBoardItems.length > 0;
  const safeInitialBoardItems = useMemo(
    () => (Array.isArray(initialBoardItems) && initialBoardItems.length > 0 ? initialBoardItems : defaultQuotes),
    [initialBoardItems]
  );
  const safeInitialNotes = useMemo(() => (Array.isArray(initialNotes) ? initialNotes : []), [initialNotes]);
  const safeInitialWords = useMemo(() => (Array.isArray(initialWords) ? initialWords : []), [initialWords]);
  const [notes, setNotes] = useState<PublicNoteRecord[]>(safeInitialNotes);
  const [words, setWords] = useState<WordCardRecord[]>(safeInitialWords);
  const [boardItems, setBoardItems] = useState<QuoteRecord[]>(safeInitialBoardItems);
  const [randomBoardItem, setRandomBoardItem] = useState<QuoteRecord>(() =>
    pickRandomBoardItem(safeInitialBoardItems)
  );

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout>;

    const syncDailySelection = () => {
      setDailySelectionKey(getTaipeiDailySelectionKey());
      resetTimer = setTimeout(syncDailySelection, getMillisecondsUntilNextTaipeiReset() + 1000);
    };

    syncDailySelection();

    return () => clearTimeout(resetTimer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      const [nextNotes, nextWords, nextQuotes] = await Promise.all([
        safeInitialNotes.length > 0 ? Promise.resolve(safeInitialNotes) : readNotesWithFallback("published"),
        safeInitialWords.length > 0 ? Promise.resolve(safeInitialWords) : readWordCardsWithFallback(),
        hasInitialBoardItems ? Promise.resolve(safeInitialBoardItems) : readQuotesWithFallback()
      ]);

      if (!active) {
        return;
      }

      const resolvedBoardItems = Array.isArray(nextQuotes) && nextQuotes.length > 0 ? nextQuotes : safeInitialBoardItems;
      const resolvedNotes = Array.isArray(nextNotes) ? nextNotes : [];
      const resolvedWords = Array.isArray(nextWords) ? nextWords : [];

      setNotes(resolvedNotes.length > 0 || safeInitialNotes.length === 0 ? resolvedNotes : safeInitialNotes);
      setWords(resolvedWords.length > 0 || safeInitialWords.length === 0 ? resolvedWords : safeInitialWords);
      setBoardItems(resolvedBoardItems);
      setRandomBoardItem((current) =>
        resolvedBoardItems.some((item) => item.id === current.id) ? current : pickRandomBoardItem(resolvedBoardItems)
      );
    }

    loadHomeData();

    return () => {
      active = false;
    };
  }, [dailySelectionKey, hasInitialBoardItems, safeInitialBoardItems, safeInitialNotes, safeInitialWords]);

  const publishedNotes = useMemo(
    () =>
      notes
        .filter((note) => note.status === publishedStatus)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [notes]
  );

  const latestNotes = useMemo(() => publishedNotes.slice(0, 2), [publishedNotes]);
  const recommendedNotes = useMemo(
    () => selectDailyItems(publishedNotes, 4, dailySelectionKey, "recommended-notes"),
    [dailySelectionKey, publishedNotes]
  );
  const randomWords = useMemo(
    () => selectDailyItems(words, 4, dailySelectionKey, "word-cards"),
    [dailySelectionKey, words]
  );
  const displayedBoardItem = randomBoardItem ?? boardItems[0] ?? defaultQuotes[0];

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
              <div className={homeStyles.navItem} key={item.label}>
                <a className={item.children ? homeStyles.navParent : undefined} href={item.href}>
                  {item.label}
                </a>
                {item.children ? (
                  <div className={homeStyles.subNav} aria-label={`${item.label}子選單`}>
                    {item.children.map((child) => (
                      <a key={child.label} href={child.href}>
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </div>
      </header>

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>日文筆記</h1>
            <p className={homeStyles.heroLead}>每天學習一點點</p>
            <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>今日句子暫時無法顯示。</p>}>
              <HeroBoardCard item={displayedBoardItem} />
            </HomeRuntimeErrorBoundary>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="JapanNote 角色" width={420} height={420} priority />
            {siteCount > 0 ? <div className={homeStyles.speech}>有 {siteCount.toLocaleString("en-US")} 位一起學了喔</div> : null}
          </div>
        </div>
      </section>

      <HomeRuntimeErrorBoundary fallback={null}>
        <AdSlot slot="top-banner" className={homeStyles.adWide} />
      </HomeRuntimeErrorBoundary>

      <div className={styles.notesLayout}>
        <section className={styles.homeSection}>
          <SectionTitle title="最新筆記" />
          {latestNotes.length > 0 ? (
            <div className={styles.grid}>
              {latestNotes.map((note) => (
                <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>文章卡片暫時無法顯示。</p>} key={note.id}>
                  <NoteCard note={note} />
                </HomeRuntimeErrorBoundary>
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
                <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>單字卡片暫時無法顯示。</p>} key={word.id}>
                  <WordCard word={word} />
                </HomeRuntimeErrorBoundary>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有單字卡。</p>
          )}
        </section>

        <HomeRuntimeErrorBoundary fallback={null}>
          <AdSlot slot="article-mid" className={homeStyles.adWide} />
        </HomeRuntimeErrorBoundary>

        <section className={styles.homeSection}>
          <SectionTitle title="推薦筆記" />
          {recommendedNotes.length > 0 ? (
            <div className={styles.grid}>
              {recommendedNotes.map((note) => (
                <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>文章卡片暫時無法顯示。</p>} key={note.id}>
                  <NoteCard note={note} />
                </HomeRuntimeErrorBoundary>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有推薦筆記。</p>
          )}
        </section>

        <section className={styles.homeSection}>
          <SectionTitle title="小試身手" />
          <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>測驗卡片暫時無法顯示。</p>}>
            <HomeQuizCard initialQuestions={initialQuizQuestions} />
          </HomeRuntimeErrorBoundary>
        </section>

        <section className={styles.homeSection}>
          <SectionTitle title="最新留音室" />
          {initialSongs.length > 0 ? (
            <div className={styles.grid}>
              {initialSongs.slice(0, 2).map((song) => (
                <HomeRuntimeErrorBoundary fallback={<p className={styles.empty}>留音室卡片暫時無法顯示。</p>} key={song.id}>
                  <SongCard song={song} />
                </HomeRuntimeErrorBoundary>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>還沒有已發布的留音室文章。</p>
          )}
        </section>

        <HomeRuntimeErrorBoundary fallback={null}>
          <AdSlot slot="article-bottom" className={homeStyles.adWide} />
        </HomeRuntimeErrorBoundary>
      </div>

      <SiteFooter />
    </main>
  );
}
