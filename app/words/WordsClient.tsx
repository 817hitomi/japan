"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import { renderInlineRuby, renderWordRuby, shouldShowStandaloneKana, splitStandaloneReading, stripInlineReadings } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import { readWordCardsWithFallback } from "./wordStorage";
import { WordCardRecord } from "./wordTypes";
import styles from "./Words.module.scss";

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

const japaneseSpeechRate = 0.8;
const preferredJapaneseVoiceName = "Google 日本語";
const wordListPageSize = 12;
const adInsertAfterCards = 6;

const kanaRows = [
  { key: "a", label: "あ", kana: ["あ", "い", "う", "え", "お"] },
  { key: "ka", label: "か", kana: ["か", "き", "く", "け", "こ", "が", "ぎ", "ぐ", "げ", "ご"] },
  { key: "sa", label: "さ", kana: ["さ", "し", "す", "せ", "そ", "ざ", "じ", "ず", "ぜ", "ぞ"] },
  { key: "ta", label: "た", kana: ["た", "ち", "つ", "て", "と", "だ", "ぢ", "づ", "で", "ど"] },
  { key: "na", label: "な", kana: ["な", "に", "ぬ", "ね", "の"] },
  { key: "ha", label: "は", kana: ["は", "ひ", "ふ", "へ", "ほ", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ"] },
  { key: "ma", label: "ま", kana: ["ま", "み", "む", "め", "も"] },
  { key: "ya", label: "や", kana: ["や", "ゆ", "よ", "ゃ", "ゅ", "ょ"] },
  { key: "ra", label: "ら", kana: ["ら", "り", "る", "れ", "ろ"] },
  { key: "wa", label: "わ", kana: ["わ", "を", "ん"] }
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

function getSpeechText(text: string) {
  return stripInlineReadings(text);
}

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function getFirstKana(text: string) {
  const normalized = toHiragana(text);
  return normalized.match(/[ぁ-ん]/)?.[0] ?? "";
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
    const text = getSpeechText(mode === "example" ? word.exampleJapanese || word.japanese : word.japanese);
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

function getWordListKana(word: WordCardRecord) {
  const kana = getFirstKana(word.kana.trim());
  if (kana) {
    return kana;
  }

  const standaloneReading = splitStandaloneReading(word.japanese);
  const standaloneKana = getFirstKana(standaloneReading?.kana ?? "");
  if (standaloneKana) {
    return standaloneKana;
  }

  return getFirstKana(word.japanese);
}

function getKanaRowKey(word: WordCardRecord) {
  const firstKana = getWordListKana(word);
  return kanaRows.find((row) => row.kana.includes(firstKana))?.key ?? "";
}

export default function WordsClient() {
  const [words, setWords] = useState<WordCardRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedKanaRow, setSelectedKanaRow] = useState("a");
  const [wordListPage, setWordListPage] = useState(1);

  useEffect(() => {
    readWordCardsWithFallback().then(setWords).catch(() => undefined);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(words.map((word) => word.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-Hant")),
    [words]
  );

  const filteredWords = useMemo(
    () => words.filter((word) => !selectedCategory || word.category === selectedCategory),
    [selectedCategory, words]
  );

  const wordListCounts = useMemo(
    () =>
      kanaRows.map((row) => ({
        ...row,
        count: filteredWords.filter((word) => getKanaRowKey(word) === row.key).length
      })),
    [filteredWords]
  );

  const selectedRowWords = useMemo(
    () => filteredWords.filter((word) => getKanaRowKey(word) === selectedKanaRow),
    [filteredWords, selectedKanaRow]
  );

  const totalWordListPages = Math.max(1, Math.ceil(selectedRowWords.length / wordListPageSize));
  const pagedWordList = selectedRowWords.slice((wordListPage - 1) * wordListPageSize, wordListPage * wordListPageSize);
  const wordListBeforeAd = pagedWordList.slice(0, adInsertAfterCards);
  const wordListAfterAd = pagedWordList.slice(adInsertAfterCards);

  const activeWord = filteredWords[activeIndex] ?? filteredWords[0] ?? words[0];

  function showRandomCard() {
    if (filteredWords.length === 0) {
      return;
    }

    setActiveIndex((current) => getRandomIndex(filteredWords.length, current));
    setFlipped(false);
  }

  useEffect(() => {
    setActiveIndex(0);
    setFlipped(false);
    setSelectedKanaRow("a");
  }, [selectedCategory]);

  useEffect(() => {
    setWordListPage(1);
  }, [selectedKanaRow]);

  useEffect(() => {
    setWordListPage((current) => Math.min(current, totalWordListPages));
  }, [totalWordListPages]);

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
              <a key={item.label} href={item.href} className={item.label === "單字卡" ? homeStyles.activeNav : undefined}>
                {item.label}
              </a>
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
                <strong>{words.length.toLocaleString("en-US")}</strong>
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
            <div className={homeStyles.speech}>有 {words.length.toLocaleString("en-US")} 個單字了喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <section className={styles.flashSection} aria-label="單字卡翻面練習">
        <div className={styles.filterPills}>
          <button className={!selectedCategory ? styles.activePill : ""} type="button" onClick={() => setSelectedCategory("")}>
            全部
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={selectedCategory === category ? styles.activePill : ""}
              type="button"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
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
          {wordListCounts.map((row) => (
            <button
              key={row.key}
              className={selectedKanaRow === row.key ? styles.activeKanaRow : ""}
              type="button"
              onClick={() => setSelectedKanaRow(row.key)}
            >
              <strong>{row.label}</strong>
              <span>{row.count}</span>
            </button>
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
        {selectedRowWords.length === 0 ? <p className={styles.emptyText}>目前沒有這一行的單字。</p> : null}
        {totalWordListPages > 1 ? (
          <nav className={styles.pagination} aria-label="單字列表頁碼">
            {Array.from({ length: totalWordListPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                className={wordListPage === page ? styles.activePage : ""}
                type="button"
                onClick={() => setWordListPage(page)}
              >
                {page}
              </button>
            ))}
          </nav>
        ) : null}
      </section>

      <footer className={homeStyles.footer}>
        <Image src="/brand/logo.png" alt="" width={72} height={72} />
        <div className={homeStyles.footerLinks}>
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
