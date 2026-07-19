"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import { readWordCardsWithFallback } from "../words/wordStorage";
import { WordCardRecord } from "../words/wordTypes";
import { renderInlineRuby } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import { generateQuizDistractors } from "./quizDistractors";
import { readQuizCategoriesWithFallback, readQuizQuestionsWithSource } from "./quizStorage";
import { normalizeQuizQuestions, QuizCategoryRecord, QuizLevel, QuizQuestionRecord, seedQuizCategories } from "./quizTypes";
import styles from "./Quiz.module.scss";

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

function getCurrentLevel(words: WordCardRecord[], questions: QuizQuestionRecord[]) {
  const wordLevel = words.map((word) => word.category).find((category) => /\bN[1-5]\b/i.test(category));
  const questionLevel = questions.find((question) => /\bN[1-5]\b/i.test(question.level))?.level;
  return (wordLevel ?? questionLevel ?? "N5").toUpperCase();
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function getDisplayOptions(activeQuestion: QuizQuestionRecord, questions: QuizQuestionRecord[]) {
  const answer = activeQuestion.answer.trim();
  const relatedQuestions = questions.filter(
    (question) =>
      question.id !== activeQuestion.id &&
      question.level === activeQuestion.level &&
      question.category === activeQuestion.category
  );
  const distractors = generateQuizDistractors(answer, relatedQuestions, activeQuestion.options);

  return shuffle([answer, ...distractors].slice(0, 4));
}

export default function QuizClient({
  initialCategory = "文字．語彙",
  initialLevel = "N5",
  initialQuestions = [],
  initialWordTotal = 0,
  initialWords = []
}: {
  initialCategory?: string;
  initialLevel?: QuizLevel;
  initialQuestions?: QuizQuestionRecord[];
  initialWordTotal?: number;
  initialWords?: WordCardRecord[];
}) {
  const [words, setWords] = useState(initialWords);
  const [questions, setQuestions] = useState(() => normalizeQuizQuestions(initialQuestions));
  const [categories, setCategories] = useState<QuizCategoryRecord[]>(seedQuizCategories);
  const [selectedLevel] = useState<QuizLevel>(initialLevel);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [modeCount, setModeCount] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [nextWords, questionsResult, storedCategories] = await Promise.all([
        readWordCardsWithFallback(),
        readQuizQuestionsWithSource({ level: selectedLevel, category: selectedCategory, pageSize: 500 }),
        readQuizCategoriesWithFallback()
      ]);

      if (!active) {
        return;
      }

      setWords(nextWords.length > 0 || initialWords.length === 0 ? nextWords : initialWords);
      setQuestions(questionsResult.questions.length > 0 ? questionsResult.questions : normalizeQuizQuestions(initialQuestions));
      setCategories(storedCategories);
    }

    loadData();

    return () => {
      active = false;
    };
  }, [initialQuestions, initialWords, selectedCategory, selectedLevel]);

  const visibleQuestions = useMemo(
    () =>
      questions
        .filter((question) => question.level === selectedLevel && question.category === selectedCategory)
        .slice(0, modeCount),
    [modeCount, questions, selectedCategory, selectedLevel]
  );
  const activeQuestion = visibleQuestions[activeIndex] ?? visibleQuestions[0];
  const displayedWordCount = Math.max(words.length, initialWordTotal);
  const displayedQuestionCount = questions.filter(
    (question) => question.level === selectedLevel && question.category === selectedCategory
  ).length;
  const currentLevel = selectedLevel || getCurrentLevel(words, questions);
  const isCorrect = selectedAnswer && activeQuestion ? selectedAnswer === activeQuestion.answer : false;
  const activeOptions = useMemo(
    () => (activeQuestion ? getDisplayOptions(activeQuestion, questions) : []),
    [activeQuestion, questions]
  );

  function nextQuestion() {
    if (visibleQuestions.length === 0) {
      return;
    }

    setActiveIndex((current) => (current + 1) % visibleQuestions.length);
    setSelectedAnswer("");
  }

  function randomizeQuestions(count: number) {
    setModeCount(count);
    setQuestions((current) => shuffle(current));
    setActiveIndex(0);
    setSelectedAnswer("");
  }

  function switchCategory(category: string) {
    setSelectedCategory(category);
    setModeCount(10);
    setActiveIndex(0);
    setSelectedAnswer("");
  }

  const currentLevelCategories = categories.filter((category) => category.level === selectedLevel);

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />

      <SiteHeader activeLabel="模擬測驗" />

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>模擬測驗</h1>
            <p className={homeStyles.heroLead}>{selectedCategory}</p>
            <div className={`${homeStyles.stats} ${styles.quizStats}`} aria-label="模擬測驗統計">
              <div>
                <strong>{displayedWordCount.toLocaleString("en-US")}</strong>
                <span>已收錄的單字</span>
              </div>
              <div>
                <strong>{displayedQuestionCount.toLocaleString("en-US")}</strong>
                <span>已收錄題庫</span>
              </div>
              <div>
                <strong>{currentLevel}</strong>
                <span>目前程度</span>
              </div>
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="模擬測驗插圖" width={420} height={420} priority />
            <div className={homeStyles.speech}>先從文字．語彙一起練喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <section className={styles.quizSection} aria-label={`${selectedCategory}練習`}>
        <div className={styles.filterPills}>
          <span>全部</span>
          {currentLevelCategories.map((category) => (
            <button
              key={category.id}
              className={selectedCategory === category.name ? styles.activeCategoryPill : ""}
              type="button"
              onClick={() => switchCategory(category.name)}
            >
              {category.name}
            </button>
          ))}
          <span>{selectedLevel}</span>
        </div>

        {activeQuestion ? (
          <div className={styles.practiceRow}>
            <button className={styles.arrowButton} type="button" onClick={nextQuestion} aria-label="上一題">
              ◀
            </button>
            <article className={styles.questionCard}>
              <p dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeQuestion.prompt) }} />
              <div className={styles.optionGrid}>
                {activeOptions.map((option) => (
                  <button
                    key={option}
                    className={selectedAnswer === option ? styles.selectedOption : ""}
                    type="button"
                    onClick={() => setSelectedAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {selectedAnswer ? (
                <div className={isCorrect ? styles.correctMessage : styles.wrongMessage}>
                  {isCorrect ? "答對了" : `正確答案：${activeQuestion.answer}`}
                </div>
              ) : null}
            </article>
            <button className={styles.arrowButton} type="button" onClick={nextQuestion} aria-label="下一題">
              ▶
            </button>
          </div>
        ) : (
          <p className={styles.emptyText}>目前沒有{selectedCategory}題目。</p>
        )}

      </section>

      <AdSlot slot="article-bottom" className={homeStyles.adWide} />

      <section className={styles.quizModeSection} aria-label="測驗模式">
        <div className={styles.modeGrid}>
          <button type="button" onClick={() => randomizeQuestions(10)}>
            隨機 10 題
          </button>
          <button type="button" onClick={() => randomizeQuestions(20)}>
            隨機 20 題
          </button>
          <button type="button" onClick={() => randomizeQuestions(displayedQuestionCount)}>
            完整測驗
          </button>
          <button type="button" onClick={() => switchCategory("文法")}>
            文法練習
          </button>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
