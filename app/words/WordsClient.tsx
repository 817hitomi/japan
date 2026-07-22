"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteFooter from "../SiteFooter";
import { readingsToSpeechText, renderInlineRuby, renderWordRuby, shouldShowStandaloneKana, splitStandaloneReading } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import { kanaRows, KanaRowKey } from "./kanaRows";
import { WordCardRecord } from "./wordTypes";
import styles from "./Words.module.scss";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "/quiz", children: [{ label: "文字．語彙", href: "/quiz/vocabulary" }] },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "/admin" }
];

const japaneseSpeechRate = 0.8;
const preferredJapaneseVoiceName = "Google 日本語";
const adInsertAfterCards = 6;
const maxVisiblePageButtons = 10;

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

function getRandomIndex(length: number, currentIndex: number) {
  if (length <= 1) {
    return 0;
  }

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
}

function getSpeechText(word: WordCardRecord, mode: "word" | "example") {
  if (mode === "example") {
    return readingsToSpeechText(word.exampleJapanese || word.japanese);
  }

  const standaloneReading = splitStandaloneReading(word.japanese);
  return word.kana.trim() || standaloneReading?.kana || readingsToSpeechText(word.japanese);
}

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === preferredJapaneseVoiceName) ?? voices.find((voice) => voice.lang.startsWith("ja")) ?? null;
}

function speakWord(word: WordCardRecord, mode: "word" | "example" = "word") {
  const audioUrl = mode === "example" ? word.backAudioUrl : word.frontAudioUrl || word.audioUrl;

  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => undefined);
    return;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const text = getSpeechText(word, mode);
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getJapaneseVoice();
    utterance.lang = "ja-JP";
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = japaneseSpeechRate;
    window.speechSynthesis.speak(utterance);
  }
}

function SpeakerButton({ mode = "word", word }: { mode?: "word" | "example"; word: WordCardRecord }) {
  return (
    <button
      className={styles.speakerButton}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        speakWord(word, mode);
      }}
      aria-label="播放單字音檔"
    >
      <img src="/brand/muc.png" alt="" />
    </button>
  );
}

function WordFace({ side, word }: { side: "front" | "back"; word: WordCardRecord }) {
  const shouldShowKana = side === "front" && shouldShowStandaloneKana(word.japanese, word.kana);

  return (
    <div className={`${styles.cardFace} ${side === "back" ? styles.cardBack : ""}`}>
      <SpeakerButton mode={side === "back" ? "example" : "word"} word={word} />
      {side === "front" ? (
        <div className={styles.wordMain}>
          {shouldShowKana ? <span>{word.kana}</span> : null}
          <strong dangerouslySetInnerHTML={{ __html: renderWordRuby(word.japanese, word.kana) }} />
          <hr />
          <small>{word.chinese}</small>
        </div>
      ) : (
        <div className={`${styles.wordMain} ${styles.exampleMain}`}>
          <p dangerouslySetInnerHTML={{ __html: renderInlineRuby(word.exampleJapanese || word.japanese) }} />
          <hr />
          <small>{word.exampleChinese || word.chinese}</small>
        </div>
      )}
    </div>
  );
}

function WordCard({ compact = false, word }: { compact?: boolean; word: WordCardRecord }) {
  return (
    <article className={`${styles.wordCard} ${compact ? styles.compactCard : ""}`}>
      <WordFace side="front" word={word} />
    </article>
  );
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

type WordsClientProps = {
  initialCategories?: string[];
  initialCategory?: string;
  initialFilteredTotal?: number;
  initialKanaCounts?: Record<KanaRowKey, number>;
  initialKanaRow?: KanaRowKey | "";
  initialPage?: number;
  initialPageSize?: number;
  initialSiteTotal?: number;
  initialTotal?: number;
  initialWords?: WordCardRecord[];
};

function getWordsPageHref(page: number, category = "", kanaRow = "") {
  const pathname = page <= 1 ? "/words" : `/words/${page}`;
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (kanaRow) {
    params.set("kana", kanaRow);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function WordsClient({
  initialCategories = [],
  initialCategory = "",
  initialFilteredTotal = 0,
  initialKanaCounts,
  initialKanaRow = "",
  initialPage = 1,
  initialPageSize = 12,
  initialSiteTotal,
  initialTotal,
  initialWords = []
}: WordsClientProps) {
  const words = initialWords;
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const categories = initialCategories;
  const displayPage = initialPage;
  const totalWordListItems = initialTotal ?? words.length;
  const totalWordListPages = Math.max(1, Math.ceil(totalWordListItems / initialPageSize));
  const visibleWordListPages = getVisiblePageNumbers(displayPage, totalWordListPages);
  const wordListBeforeAd = words.slice(0, adInsertAfterCards);
  const wordListAfterAd = words.slice(adInsertAfterCards);
  const wordListCounts = kanaRows.map((row) => ({ ...row, count: initialKanaCounts?.[row.key] ?? 0 }));

  const activeWord = words[activeIndex] ?? words[0];

  function showRandomCardFromWords(nextWords: WordCardRecord[]) {
    if (nextWords.length === 0) {
      setActiveIndex(0);
      setFlipped(false);
      return;
    }

    setActiveIndex(Math.floor(Math.random() * nextWords.length));
    setFlipped(false);
  }

  function showRandomCard() {
    if (words.length === 0) {
      return;
    }

    setActiveIndex((current) => getRandomIndex(words.length, current));
    setFlipped(false);
  }

  useEffect(() => {
    showRandomCardFromWords(words);
  }, [initialPage, initialCategory, initialKanaRow]);

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
              <div className={homeStyles.navItem} key={item.label}>
                <a className={`${item.children ? homeStyles.navParent : ""} ${item.label === "單字卡" ? homeStyles.activeNav : ""}`} href={item.href}>
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
            <h1>單字卡</h1>
            <p className={homeStyles.heroLead}>點卡片翻面，左右鍵隨機換一張</p>
            <div className={`${homeStyles.stats} ${styles.wordStats}`} aria-label="單字卡統計">
              <div>
                <strong>{(initialSiteTotal ?? initialTotal ?? words.length).toLocaleString("en-US")}</strong>
                <span>已收錄單字</span>
              </div>
              <div>
                <strong>{categories.length.toLocaleString("en-US")}</strong>
                <span>分類</span>
              </div>
              <div>
                <strong>{categories[0] ?? "N5"}</strong>
                <span>目前程度</span>
              </div>
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="單字卡插圖" width={420} height={420} priority />
            <div className={homeStyles.speech}>有 {(initialSiteTotal ?? initialTotal ?? words.length).toLocaleString("en-US")} 個單字了喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <section className={styles.flashSection} aria-label="單字卡翻面練習">
        <div className={styles.filterPills}>
          <a className={!initialCategory ? styles.activePill : ""} href={getWordsPageHref(1, "", initialKanaRow)}>
            全部
          </a>
          {categories.map((category) => (
            <a
              key={category}
              className={initialCategory === category ? styles.activePill : ""}
              href={getWordsPageHref(1, category, initialKanaRow)}
            >
              {category}
            </a>
          ))}
        </div>

        {activeWord ? (
          <div className={styles.practiceRow}>
            <button className={styles.arrowButton} type="button" onClick={showRandomCard} aria-label="隨機上一張">
              <span>◀</span>
            </button>
            <button
              className={`${styles.flipCard} ${flipped ? styles.flipped : ""}`}
              type="button"
              onClick={() => setFlipped((current) => !current)}
              aria-label="翻面"
            >
              <WordFace side="front" word={activeWord} />
              <WordFace side="back" word={activeWord} />
            </button>
            <button className={styles.arrowButton} type="button" onClick={showRandomCard} aria-label="隨機下一張">
              <span>▶</span>
            </button>
          </div>
        ) : (
          <p className={styles.emptyText}>目前沒有單字卡。</p>
        )}
      </section>

      <AdSlot slot="article-bottom" className={homeStyles.adWide} />

      <section className={styles.wordListSection}>
        <h2>單字卡</h2>
        <div className={styles.kanaRowTabs} aria-label="單字行分類">
          <a
            className={!initialKanaRow ? styles.activeKanaRow : ""}
            href={getWordsPageHref(1, initialCategory)}
          >
            <strong>全部</strong>
            <span>{initialFilteredTotal}</span>
          </a>
          {wordListCounts.map((row) => (
            <a
              key={row.key}
              className={initialKanaRow === row.key ? styles.activeKanaRow : ""}
              href={getWordsPageHref(1, initialCategory, row.key)}
            >
              <strong>{row.label}</strong>
              <span>{row.count}</span>
            </a>
          ))}
        </div>
        <div className={styles.cardGrid}>
          {wordListBeforeAd.map((word) => (
            <WordCard compact key={word.id} word={word} />
          ))}
          {wordListAfterAd.length > 0 ? <AdSlot slot="top-banner" className={styles.wordListAd} /> : null}
          {wordListAfterAd.map((word) => (
            <WordCard compact key={word.id} word={word} />
          ))}
        </div>
        {words.length === 0 ? <p className={styles.emptyText}>目前沒有這一行的單字。</p> : null}
        {totalWordListPages > 1 ? (
          <nav className={styles.pagination} aria-label="單字列表頁碼">
            {totalWordListPages > maxVisiblePageButtons ? (
              <a
                className={styles.pageArrow}
                href={getWordsPageHref(Math.max(1, displayPage - 1), initialCategory, initialKanaRow)}
                aria-disabled={displayPage === 1}
                aria-label="上一頁"
              >
                ‹
              </a>
            ) : null}
            {visibleWordListPages.map((page) => (
              <a
                key={page}
                className={displayPage === page ? styles.activePage : ""}
                href={getWordsPageHref(page, initialCategory, initialKanaRow)}
              >
                {page}
              </a>
            ))}
            {totalWordListPages > maxVisiblePageButtons ? (
              <a
                className={styles.pageArrow}
                href={getWordsPageHref(Math.min(totalWordListPages, displayPage + 1), initialCategory, initialKanaRow)}
                aria-disabled={displayPage === totalWordListPages}
                aria-label="下一頁"
              >
                ›
              </a>
            ) : null}
          </nav>
        ) : null}
      </section>

      <SiteFooter />
    </main>
  );
}
