"use client";

import Image from "next/image";
import { DragEvent, useEffect, useState } from "react";
import AdSlot from "../../ads/AdSlot";
import SiteFooter from "../../SiteFooter";
import SiteHeader from "../../SiteHeader";
import { readingsToSpeechText, renderInlineRuby } from "../../../lib/japaneseText";
import homeStyles from "../../page.module.scss";
import { readQuizQuestionsWithSource } from "../quizStorage";
import {
  normalizeWordOrderAnswer,
  QuizLevel,
  QuizQuestionRecord,
  wordOrderQuestionType
} from "../quizTypes";
import styles from "./GrammarPractice.module.scss";

type WordOrderSegment = { id: string; text: string };
type DraggedSegment = { id: string; source: "available" | "arranged" };

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

function ParallaxBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => { setScrollY(window.scrollY); ticking = false; };
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
          style={{ transform: `translate3d(${scrollY * ball.x + Math.sin(scrollY / 220 + index) * 12}px, ${scrollY * ball.y}px, 0)` }}
        />
      ))}
    </div>
  );
}

function shuffle<T>(items: T[]) {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }
  return nextItems;
}

function createSegments(question: QuizQuestionRecord) {
  return shuffle(question.options.map((text, index) => ({ id: `${question.id}-${index}`, text })));
}

function getAnswerSegmentIds(question: QuizQuestionRecord) {
  const target = normalizeWordOrderAnswer(question.answer);
  const options = question.options.map((text, index) => ({
    id: `${question.id}-${index}`,
    text: normalizeWordOrderAnswer(text)
  }));

  function findSequence(position: number, usedIds: Set<string>): string[] | null {
    if (position === target.length) return [];

    for (const option of options) {
      if (!option.text || usedIds.has(option.id) || !target.startsWith(option.text, position)) continue;
      const rest = findSequence(position + option.text.length, new Set(usedIds).add(option.id));
      if (rest) return [option.id, ...rest];
    }

    return null;
  }

  return target ? findSequence(0, new Set()) : null;
}

function getJapaneseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === preferredJapaneseVoiceName) ?? voices.find((voice) => voice.lang.startsWith("ja")) ?? null;
}

function speakAnswer(answer: string) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(readingsToSpeechText(answer));
  const voice = getJapaneseVoice();
  utterance.lang = "ja-JP";
  utterance.rate = japaneseSpeechRate;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function pickRandomQuestion(questions: QuizQuestionRecord[], currentId?: number) {
  const candidates = questions.length > 1 ? questions.filter((question) => question.id !== currentId) : questions;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function GrammarPracticeClient({ level }: { level: QuizLevel }) {
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<QuizQuestionRecord | null>(null);
  const [availableSegments, setAvailableSegments] = useState<WordOrderSegment[]>([]);
  const [arrangedSegments, setArrangedSegments] = useState<WordOrderSegment[]>([]);
  const [draggedSegment, setDraggedSegment] = useState<DraggedSegment | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadQuestions() {
      const result = await readQuizQuestionsWithSource({
        level,
        questionType: wordOrderQuestionType,
        pageSize: 500
      });
      if (!active) return;

      const nextQuestions = result.questions.filter((question) => question.options.length >= 2);
      const nextQuestion = pickRandomQuestion(nextQuestions);
      setQuestions(nextQuestions);
      setActiveQuestion(nextQuestion ?? null);
      setAvailableSegments(nextQuestion ? createSegments(nextQuestion) : []);
      setArrangedSegments([]);
      setIsSubmitted(false);
      setLoadError(nextQuestions.length === 0 && result.error ? result.error : "");
      setIsLoading(false);
    }

    void loadQuestions();
    return () => { active = false; };
  }, [level]);

  const arrangedAnswer = arrangedSegments.map((segment) => segment.text).join("");
  const isCorrect = Boolean(
    isSubmitted && activeQuestion &&
    normalizeWordOrderAnswer(arrangedAnswer) === normalizeWordOrderAnswer(activeQuestion.answer)
  );
  const answerSegmentIds = activeQuestion ? getAnswerSegmentIds(activeQuestion) : null;

  function resetQuestion(question: QuizQuestionRecord) {
    setActiveQuestion(question);
    setAvailableSegments(createSegments(question));
    setArrangedSegments([]);
    setDraggedSegment(null);
    setIsSubmitted(false);
  }

  function showRandomQuestion() {
    const nextQuestion = pickRandomQuestion(questions, activeQuestion?.id);
    if (nextQuestion) resetQuestion(nextQuestion);
  }

  function addToArrangement(segment: WordOrderSegment) {
    if (isSubmitted) return;
    setAvailableSegments((current) => current.filter((item) => item.id !== segment.id));
    setArrangedSegments((current) => [...current, segment]);
  }

  function returnToBank(segment: WordOrderSegment) {
    if (isSubmitted) return;
    setArrangedSegments((current) => current.filter((item) => item.id !== segment.id));
    setAvailableSegments((current) => [...current, segment]);
  }

  function startDragging(event: DragEvent<HTMLButtonElement>, segment: WordOrderSegment, source: DraggedSegment["source"]) {
    if (isSubmitted) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", segment.id);
    setDraggedSegment({ id: segment.id, source });
  }

  function dropAtArrangementEnd(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!draggedSegment || isSubmitted) return;
    if (draggedSegment.source === "available") {
      const segment = availableSegments.find((item) => item.id === draggedSegment.id);
      if (segment) addToArrangement(segment);
    } else {
      setArrangedSegments((current) => {
        const segment = current.find((item) => item.id === draggedSegment.id);
        return segment ? [...current.filter((item) => item.id !== draggedSegment.id), segment] : current;
      });
    }
    setDraggedSegment(null);
  }

  function dropBeforeSegment(event: DragEvent<HTMLButtonElement>, targetId: string) {
    event.preventDefault();
    event.stopPropagation();
    if (!draggedSegment || isSubmitted || draggedSegment.id === targetId) return;
    const sourceItems = draggedSegment.source === "available" ? availableSegments : arrangedSegments;
    const dragged = sourceItems.find((item) => item.id === draggedSegment.id);
    if (!dragged) return;

    setAvailableSegments((current) => current.filter((item) => item.id !== dragged.id));
    setArrangedSegments((current) => {
      const withoutDragged = current.filter((item) => item.id !== dragged.id);
      const targetIndex = withoutDragged.findIndex((item) => item.id === targetId);
      return targetIndex < 0
        ? [...withoutDragged, dragged]
        : [...withoutDragged.slice(0, targetIndex), dragged, ...withoutDragged.slice(targetIndex)];
    });
    setDraggedSegment(null);
  }

  function dropBackToBank(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!draggedSegment || draggedSegment.source !== "arranged" || isSubmitted) return;
    const segment = arrangedSegments.find((item) => item.id === draggedSegment.id);
    if (segment) returnToBank(segment);
    setDraggedSegment(null);
  }

  function resetArrangement() {
    if (!activeQuestion || isSubmitted) return;
    setAvailableSegments(createSegments(activeQuestion));
    setArrangedSegments([]);
  }

  return (
    <main className={homeStyles.page}>
      <ParallaxBackground />
      <SiteHeader activeLabel="實力挑戰" />
      <section className={homeStyles.hero}>
        <div className={homeStyles.heroInner}>
          <div className={homeStyles.heroCopy}>
            <h1>文法練習</h1>
            <p className={homeStyles.heroLead}>把語塊排成正確的日文句子</p>
            <div className={`${homeStyles.stats} ${styles.practiceStats}`} aria-label="文法練習統計">
              <div><strong>{questions.length.toLocaleString("en-US")}</strong><span>排句題庫</span></div>
              <div><strong>1</strong><span>每次一題</span></div>
              <div><strong>{level}</strong><span>目前程度</span></div>
            </div>
          </div>
          <div className={homeStyles.heroArt}>
            <div className={homeStyles.dotGrid} aria-hidden="true" />
            <Image src="/brand/01.png" alt="文法練習插圖" width={420} height={420} priority />
            <div className={homeStyles.speech}>排好之後再看詳解喔</div>
          </div>
        </div>
      </section>

      <AdSlot slot="top-banner" className={homeStyles.adWide} />
      <section className={styles.practiceSection} aria-label="排排看文法練習">
        <div className={styles.practiceHeading}>
          <div><strong>排一排・小練習</strong><p>先完成句子並送出答案，詳解會在下方獨立顯示。</p></div>
          <span>{level}</span>
        </div>

        {isLoading ? <p className={styles.statusText}>正在讀取排句題庫……</p> : null}
        {!isLoading && activeQuestion ? (
          <div className={styles.practiceRow}>
            <button className={styles.arrowButton} type="button" onClick={showRandomQuestion} aria-label="隨機換一題">◀</button>
            <article className={styles.practiceCard}>
              <header>
                <span className={styles.questionEyebrow}>語序排列</span>
                <div className={styles.questionPrompt}>請排成正確的日文句子</div>
                <span>可僅使用部分語塊</span>
              </header>
              <section className={styles.boardSection}>
                <div className={styles.sectionLabel}><h2>你的答案</h2><span>{arrangedSegments.length} 個語塊</span></div>
                <div className={`${styles.segmentBoard} ${arrangedSegments.length === 0 ? styles.emptyBoard : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={dropAtArrangementEnd}>
                  {arrangedSegments.map((segment, index) => (
                    <button
                      type="button"
                      className={isSubmitted && !isCorrect && answerSegmentIds && answerSegmentIds[index] !== segment.id ? styles.incorrectSegment : undefined}
                      draggable={!isSubmitted}
                      onDragStart={(event) => startDragging(event, segment, "arranged")}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropBeforeSegment(event, segment.id)}
                      onClick={() => returnToBank(segment)}
                      key={segment.id}
                      disabled={isSubmitted}
                    >
                      <span className={styles.segmentIndex}>{index + 1}.</span>
                      <span className={styles.segmentText} dangerouslySetInnerHTML={{ __html: renderInlineRuby(segment.text) }} />
                    </button>
                  ))}
                </div>
              </section>
              <section className={styles.bankSection}>
                <div className={styles.sectionLabel}><h2>待選語塊</h2><span>尚有 {availableSegments.length} 個</span></div>
                <div className={styles.segmentBank} onDragOver={(event) => event.preventDefault()} onDrop={dropBackToBank}>
                  {availableSegments.map((segment) => (
                    <button type="button" draggable={!isSubmitted} onDragStart={(event) => startDragging(event, segment, "available")} onClick={() => addToArrangement(segment)} key={segment.id} disabled={isSubmitted}>
                      <span className={styles.segmentText} dangerouslySetInnerHTML={{ __html: renderInlineRuby(segment.text) }} />
                    </button>
                  ))}
                </div>
              </section>
              <footer className={styles.practiceActions}>
                <button type="button" className={styles.resetButton} onClick={resetArrangement} disabled={isSubmitted || arrangedSegments.length === 0}>↺ 重排</button>
                {isSubmitted ? <strong className={isCorrect ? styles.correctResult : styles.wrongResult}>{isCorrect ? "答對了" : "答錯了"}</strong> : <span />}
                <button type="button" className={styles.confirmButton} onClick={() => setIsSubmitted(true)} disabled={isSubmitted || arrangedSegments.length === 0}>決定</button>
              </footer>
            </article>
            <button className={styles.arrowButton} type="button" onClick={showRandomQuestion} aria-label="隨機換一題">▶</button>
          </div>
        ) : null}

        {!isLoading && !activeQuestion ? <p className={styles.statusText}>目前沒有 {level} 語序排列題目。{loadError ? `（${loadError}）` : ""}</p> : null}
        {isSubmitted && activeQuestion ? (
          <section className={styles.explanationPanel} aria-live="polite">
            <p className={styles.explanationEyebrow}>作答結果</p>
            <div className={styles.explanationHeader}>
              <strong>{isCorrect ? "答對了！" : "正確答案"}</strong>
              <p className={styles.answerContent} dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeQuestion.answer) }} />
              <button
                className={styles.speakAnswerButton}
                type="button"
                onClick={() => speakAnswer(activeQuestion.answer)}
                aria-label="播放正確答案"
                title="播放正確答案"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.1-3.8v7.6a4.5 4.5 0 0 0 2.1-3.8Zm-2.1-8v2.1a7 7 0 0 1 0 11.8V20a9 9 0 0 0 0-16Z" />
                </svg>
              </button>
            </div>
            <div className={styles.explanationBody}>
              <h2>詳解</h2>
              {activeQuestion.note ? <div className={styles.explanationContent} dangerouslySetInnerHTML={{ __html: renderInlineRuby(activeQuestion.note) }} /> : <p>本題尚未提供補充詳解。</p>}
            </div>
          </section>
        ) : null}
      </section>
      <AdSlot slot="article-bottom" className={homeStyles.adWide} />
      <SiteFooter />
    </main>
  );
}
