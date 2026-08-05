"use client";

import { useEffect, useMemo, useState } from "react";
import { renderInlineRuby } from "../../lib/japaneseText";
import { generateQuizDistractors } from "../quiz/quizDistractors";
import {
  grammarQuizCategory,
  normalizeQuizQuestions,
  QuizQuestionRecord,
  vocabularyQuizCategory
} from "../quiz/quizTypes";
import styles from "./NotesFront.module.scss";

const storedQuestionIdKey = "japannote-home-quiz-question-id";
const storedQuestionPoolKey = "japannote-home-quiz-question-pool";

function readQuestionPool() {
  try {
    const storedPool = window.sessionStorage.getItem(storedQuestionPoolKey);
    return normalizeQuizQuestions(storedPool ? JSON.parse(storedPool) : [], true);
  } catch {
    return [];
  }
}

function storeQuestionPool(questions: QuizQuestionRecord[]) {
  try {
    window.sessionStorage.setItem(storedQuestionPoolKey, JSON.stringify(questions));
  } catch {
    // Storage can be unavailable in strict privacy modes; the card still works for this page load.
  }
}

function readStoredQuestionId() {
  try {
    return Number(window.localStorage.getItem(storedQuestionIdKey));
  } catch {
    return Number.NaN;
  }
}

function storeQuestionId(questionId: number) {
  try {
    window.localStorage.setItem(storedQuestionIdKey, String(questionId));
  } catch {
    // Keep the in-memory question usable even if browser storage is unavailable.
  }
}

function seededRandom(seed: number) {
  let state = seed || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number) {
  const shuffled = [...items];
  const random = seededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled;
}

function getDisplayOptions(question: QuizQuestionRecord, questions: QuizQuestionRecord[], optionSeed: number) {
  const relatedQuestions = questions.filter(
    (candidate) =>
      candidate.id !== question.id &&
      candidate.level === question.level &&
      candidate.category === question.category
  );
  const distractors = generateQuizDistractors(question.answer, relatedQuestions, question.options);
  const fallbackOptions = relatedQuestions.flatMap((candidate) => [candidate.answer, ...candidate.options]);
  const uniqueDistractors = Array.from(
    new Set([...distractors, ...fallbackOptions].map((option) => option.trim()).filter(Boolean))
  ).filter((option) => option !== question.answer);

  return shuffle([question.answer, ...uniqueDistractors.slice(0, 3)], question.id ^ optionSeed);
}

function pickRandomQuestion(questions: QuizQuestionRecord[], currentId?: number) {
  const candidates = questions.filter((question) => question.id !== currentId);
  const pool = candidates.length > 0 ? candidates : questions;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export default function HomeQuizCard({ initialQuestions = [] }: { initialQuestions?: QuizQuestionRecord[] }) {
  const safeInitialQuestions = useMemo(
    () =>
      normalizeQuizQuestions(initialQuestions, true).filter(
        (question) =>
          question.category === vocabularyQuizCategory || question.category === grammarQuizCategory
      ),
    [initialQuestions]
  );
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>(safeInitialQuestions);
  const [activeQuestion, setActiveQuestion] = useState<QuizQuestionRecord | null>(safeInitialQuestions[0] ?? null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [optionSeed, setOptionSeed] = useState(0);

  useEffect(() => {
    const cachedQuestions = readQuestionPool();
    const nextQuestions = cachedQuestions.length > 0 ? cachedQuestions : safeInitialQuestions;
    const storedId = readStoredQuestionId();
    const storedQuestion = Number.isFinite(storedId)
      ? nextQuestions.find((question) => question.id === storedId) ?? null
      : null;
    const nextQuestion = storedQuestion ?? nextQuestions[0] ?? null;

    if (cachedQuestions.length === 0 && safeInitialQuestions.length > 0) {
      storeQuestionPool(safeInitialQuestions);
    }
    setQuestions(nextQuestions);
    setActiveQuestion(nextQuestion);
    if (nextQuestion) {
      storeQuestionId(nextQuestion.id);
    }
  }, [safeInitialQuestions]);

  const options = useMemo(
    () => (activeQuestion ? getDisplayOptions(activeQuestion, questions, optionSeed) : []),
    [activeQuestion, optionSeed, questions]
  );

  function drawQuestion() {
    const nextQuestion = pickRandomQuestion(questions, activeQuestion?.id);

    if (!nextQuestion) {
      return;
    }

    setActiveQuestion(nextQuestion);
    setSelectedAnswer("");
    setOptionSeed(Math.floor(Math.random() * 2147483647));
    storeQuestionId(nextQuestion.id);
  }

  if (!activeQuestion) {
    return <div className={styles.homeQuizStatus}>目前沒有可顯示的測驗題目。</div>;
  }

  const isCorrect = selectedAnswer === activeQuestion.answer;

  return (
    <div className={styles.homeQuizRow}>
      <button className={styles.homeQuizArrow} type="button" onClick={drawQuestion} aria-label="隨機抽一題">
        <span aria-hidden="true">&#10094;</span>
      </button>
      <article className={styles.homeQuizCard}>
        <div className={styles.homeQuizMeta}>
          <span>{activeQuestion.category}</span>
          <strong>{activeQuestion.level}</strong>
          <small>{activeQuestion.questionType}</small>
        </div>
        <p dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeQuestion.prompt) }} />
        <div className={styles.homeQuizOptions}>
          {options.map((option) => (
            <button
              className={selectedAnswer === option ? styles.homeQuizOptionSelected : undefined}
              type="button"
              key={option}
              onClick={() => setSelectedAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {selectedAnswer ? (
          <div className={isCorrect ? styles.homeQuizCorrect : styles.homeQuizWrong} aria-live="polite">
            {isCorrect ? "答對了" : `正確答案：${activeQuestion.answer}`}
          </div>
        ) : (
          <div className={styles.homeQuizHint}>選擇答案，或按左右箭頭隨機抽題</div>
        )}
      </article>
      <button className={styles.homeQuizArrow} type="button" onClick={drawQuestion} aria-label="隨機抽一題">
        <span aria-hidden="true">&#10095;</span>
      </button>
    </div>
  );
}
