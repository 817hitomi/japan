"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdSlot from "../ads/AdSlot";
import SiteFooter from "../SiteFooter";
import SiteHeader from "../SiteHeader";
import { renderInlineRuby } from "../../lib/japaneseText";
import homeStyles from "../page.module.scss";
import { readWordCardsWithFallback } from "../words/wordStorage";
import { WordCardRecord } from "../words/wordTypes";
import { generateQuizDistractors } from "./quizDistractors";
import { readQuizCategoriesWithFallback, readQuizQuestionsWithSource } from "./quizStorage";
import { normalizeQuizQuestions, QuizCategoryRecord, QuizLevel, QuizQuestionRecord, seedQuizCategories } from "./quizTypes";
import styles from "./RandomQuiz.module.scss";

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

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function splitAnswerNote(note: string) {
  return note
    .replace(/<br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:div|p|li|section|article|h[1-6])\s*>/gi, "\n")
    .replace(/<(?:div|p|li|section|article|h[1-6])\b[^>]*>/gi, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getCurrentLevel(words: WordCardRecord[], questions: QuizQuestionRecord[]) {
  const wordLevel = words.map((word) => word.category).find((category) => /\bN[1-5]\b/i.test(category));
  const questionLevel = questions.find((question) => /\bN[1-5]\b/i.test(question.level))?.level;
  return (wordLevel ?? questionLevel ?? "N5").toUpperCase();
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

function getQuestionResult(question: QuizQuestionRecord, selectedAnswer: string | undefined) {
  return selectedAnswer?.trim() === question.answer.trim();
}

export default function RandomQuizClient({
  questionCount,
  initialCategory = "文字．語彙",
  initialLevel = "N5",
  initialQuestions = [],
  initialWordTotal = 0,
  initialWords = []
}: {
  questionCount: 10 | 20;
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
  const [examQuestions, setExamQuestions] = useState<QuizQuestionRecord[]>([]);
  const [optionMap, setOptionMap] = useState<Record<number, string[]>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  const displayedWordCount = Math.max(words.length, initialWordTotal);
  const displayedQuestionCount = questions.filter(
    (question) => question.level === selectedLevel && question.category === selectedCategory
  ).length;
  const currentLevel = selectedLevel || getCurrentLevel(words, questions);
  const currentLevelCategories = categories.filter((category) => category.level === selectedLevel);

  const filteredQuestions = useMemo(
    () => questions.filter((question) => question.level === selectedLevel && question.category === selectedCategory),
    [questions, selectedCategory, selectedLevel]
  );

  useEffect(() => {
    const nextQuestions = shuffle(filteredQuestions).slice(0, questionCount);
    setExamQuestions(nextQuestions);
    setOptionMap(
      Object.fromEntries(nextQuestions.map((question) => [question.id, getDisplayOptions(question, filteredQuestions)]))
    );
    setAnswers({});
    setIsSubmitted(false);
  }, [filteredQuestions, questionCount]);

  const answeredCount = examQuestions.filter((question) => answers[question.id]).length;
  const missingCount = Math.max(examQuestions.length - answeredCount, 0);
  const score = examQuestions.filter((question) => getQuestionResult(question, answers[question.id])).length;

  function selectAnswer(questionId: number, answer: string) {
    if (isSubmitted) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [questionId]: answer
    }));
  }

  function switchCategory(category: string) {
    setSelectedCategory(category);
  }

  function restartQuiz() {
    const nextQuestions = shuffle(filteredQuestions).slice(0, questionCount);
    setExamQuestions(nextQuestions);
    setOptionMap(
      Object.fromEntries(nextQuestions.map((question) => [question.id, getDisplayOptions(question, filteredQuestions)]))
    );
    setAnswers({});
    setIsSubmitted(false);
  }

  function confirmAnswers() {
    if (examQuestions.length === 0 || missingCount > 0) {
      return;
    }

    setIsSubmitted(true);
  }

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />

      <SiteHeader activeLabel="模擬測驗" />

      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>模擬測驗</h1>
            <p className={homeStyles.heroLead}>隨機 {questionCount} 題</p>
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
            <div className={homeStyles.speech}>答完再一起看結果喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />

      <section className={styles.quizSection} aria-label={`隨機 ${questionCount} 題測驗`}>
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

        {examQuestions.length > 0 ? (
          <div className={styles.examPanel}>
            <div className={styles.examHeader}>
              <strong>隨機 {questionCount} 題</strong>
              <span>
                {isSubmitted ? `答對 ${score} / ${examQuestions.length} 題` : `已作答 ${answeredCount} / ${examQuestions.length} 題`}
              </span>
            </div>

            <div className={styles.questionList}>
              {examQuestions.map((question, questionIndex) => {
                const selected = answers[question.id];
                const isCorrect = getQuestionResult(question, selected);
                const resultClass = isSubmitted ? (isCorrect ? styles.correctQuestion : styles.wrongQuestion) : "";
                const answerNoteLines = splitAnswerNote(question.note);

                return (
                  <article className={`${styles.listQuestion} ${resultClass}`} key={question.id}>
                    <div className={styles.choiceNumbers} aria-label={`第 ${questionIndex + 1} 題選項`}>
                      {(optionMap[question.id] ?? []).map((option, optionIndex) => (
                        <button
                          key={option}
                          className={selected === option ? styles.selectedChoiceNumber : ""}
                          type="button"
                          onClick={() => selectAnswer(question.id, option)}
                          aria-label={`第 ${questionIndex + 1} 題選項 ${optionIndex + 1}：${option}`}
                        >
                          {optionIndex + 1}
                        </button>
                      ))}
                    </div>

                    <div className={styles.questionBody}>
                      <h2 dangerouslySetInnerHTML={{ __html: renderInlineRuby(question.prompt) }} />
                      <div className={styles.inlineOptions}>
                        {(optionMap[question.id] ?? []).map((option, optionIndex) => (
                          <button
                            key={option}
                            className={selected === option ? styles.selectedInlineOption : ""}
                            type="button"
                            onClick={() => selectAnswer(question.id, option)}
                          >
                            <span>{optionIndex + 1}.</span>
                            {option}
                          </button>
                        ))}
                      </div>

                      {isSubmitted ? (
                        <div className={isCorrect ? styles.correctMessage : styles.wrongMessage}>
                          {isCorrect ? "答對了" : `正確答案：${question.answer}`}
                        </div>
                      ) : null}

                      {isSubmitted && !isCorrect && question.note ? (
                        <div className={styles.answerNote}>
                          <p>
                            {answerNoteLines.map((line, lineIndex) => (
                              <span
                                className={lineIndex > 0 ? styles.answerTranslation : undefined}
                                dangerouslySetInnerHTML={{ __html: renderInlineRuby(line) }}
                                key={`${question.id}-${lineIndex}`}
                              />
                            ))}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.submitRow}>
              <span>{!isSubmitted && missingCount > 0 ? `尚有 ${missingCount} 題未作答` : ""}</span>
              <div className={styles.submitActions}>
                <button type="button" onClick={confirmAnswers} disabled={isSubmitted || missingCount > 0}>
                  確認答題
                </button>
                {isSubmitted ? (
                  <button type="button" onClick={restartQuiz}>
                    重新出題
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.emptyText}>目前沒有{selectedCategory}題目。</p>
        )}
      </section>

      <AdSlot slot="article-bottom" className={homeStyles.adWide} />

      <SiteFooter />
    </main>
  );
}
