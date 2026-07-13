"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import homeStyles from "../page.module.scss";
import { readWordCardsWithFallback } from "./wordStorage";
import { WordCardRecord } from "./wordTypes";
import styles from "./Words.module.scss";

const navItems = [
  { label: "單字卡", href: "/words" },
  { label: "模擬測驗", href: "#" },
  { label: "學習筆記", href: "/notes" },
  { label: "登入", href: "#" }
];

const socialLinks = [
  { label: "YouTube", color: "#ff0000", href: "https://www.youtube.com/@japanNote" },
  { label: "Instagram", color: "#e4405f", href: "#" },
  { label: "Facebook", color: "#1877f2", href: "https://facebook.com/17japanNote" }
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

function renderTextRuby(text: string) {
  if (!text || text.includes("<ruby")) {
    return text;
  }

  return text
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) {
        return part;
      }

      return part.replace(/([一-龯々〆ヵヶ]+)\(([ぁ-ゖァ-ヺー]+)\)/g, "<ruby>$1<rt>$2</rt></ruby>");
    })
    .join("");
}

function hasInlineReading(text: string) {
  return /[一-龯々〆ヵヶ]+\([ぁ-ゖァ-ヺー]+\)/.test(text);
}

function getSpeechText(text: string) {
  return text.replace(/([一-龯々〆ヵヶ]+)\(([ぁ-ゖァ-ヺー]+)\)/g, "$1");
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
    utterance.lang = "ja-JP";
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
  const shouldShowKana = side === "front" && word.kana && !hasInlineReading(word.japanese);

  return (
    <div className={`${styles.cardFace} ${side === "back" ? styles.cardBack : ""}`}>
      <SpeakerButton mode={side === "back" ? "example" : "word"} word={word} />
      {side === "front" ? (
        <div className={styles.wordMain}>
          {shouldShowKana ? <span>{word.kana}</span> : null}
          <strong dangerouslySetInnerHTML={{ __html: renderTextRuby(word.japanese) }} />
          <hr />
          <small>{word.chinese}</small>
        </div>
      ) : (
        <div className={`${styles.wordMain} ${styles.exampleMain}`}>
          <p dangerouslySetInnerHTML={{ __html: renderTextRuby(word.exampleJapanese || word.japanese) }} />
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

export default function WordsClient() {
  const [words, setWords] = useState<WordCardRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

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
  }, [selectedCategory]);

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />

      <header className={homeStyles.header}>
        <div className={homeStyles.headerInner}>
          <a className={homeStyles.logoMark} href="/" aria-label="JapanNote">
            <Image src="/brand/logo.png" alt="" width={52} height={52} priority />
          </a>
          <a className={homeStyles.badge} href="/" aria-label="JapanNote YouTube">
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
        <div className={styles.cardGrid}>
          {filteredWords.map((word) => (
            <WordCard compact key={word.id} word={word} />
          ))}
        </div>
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
