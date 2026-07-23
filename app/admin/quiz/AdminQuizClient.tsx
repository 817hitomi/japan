"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../AdminShell";
import {
  deleteQuizQuestions,
  readQuizCategoriesWithFallback,
  readQuizQuestionsWithSource,
  saveQuizQuestion,
  writeStoredQuizQuestions
} from "../../quiz/quizStorage";
import { generateQuizDistractors } from "../../quiz/quizDistractors";
import { QuizCategoryRecord, QuizLevel, QuizQuestionRecord, quizLevels, seedQuizCategories } from "../../quiz/quizTypes";
import styles from "../notes/AdminNotes.module.scss";

const emptyQuestion: QuizQuestionRecord = {
  id: 0,
  level: "N5",
  category: "文字．語彙",
  theme: "",
  prompt: "",
  note: "",
  answer: "",
  options: ["", "", "", ""]
};
const quizTextColors = ["#7D7D7D", "#C28080", "#D6C09E", "#8CB993"] as const;
const quizQuestionsPerPage = 10;
const maxVisiblePageButtons = 10;
type QuizEditableField = "prompt" | "note";

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normalizeOptions(options: string[], answer: string) {
  const normalizedAnswer = answer.trim();
  const nextOptions = options.map((option) => option.trim()).filter((option) => option && option !== normalizedAnswer);

  return nextOptions.slice(0, 3);
}

function getEditorOptions(options: string[], answer: string) {
  const normalizedAnswer = answer.trim();
  const nextOptions = options.map((option) => option.trim()).filter((option) => option && option !== normalizedAnswer);

  return [...nextOptions, "", "", ""].slice(0, 3);
}

function getDraftForEditor(question: QuizQuestionRecord, relatedQuestions: QuizQuestionRecord[] = []) {
  const generatedOptions = generateQuizDistractors(question.answer, relatedQuestions, question.options);

  return {
    ...question,
    options: getEditorOptions(generatedOptions, question.answer)
  };
}

function getNewQuestionDraft(level: QuizLevel, category: string) {
  return {
    ...emptyQuestion,
    id: Date.now(),
    level,
    category,
    options: getEditorOptions(emptyQuestion.options, emptyQuestion.answer)
  };
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

export default function AdminQuizClient({
  initialCategory = "文字．語彙",
  initialLevel = "N5"
}: {
  initialCategory?: string;
  initialLevel?: QuizLevel;
}) {
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [categories, setCategories] = useState<QuizCategoryRecord[]>(seedQuizCategories);
  const [selectedLevel, setSelectedLevel] = useState<QuizLevel>(initialLevel);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuizQuestionRecord>({ ...emptyQuestion, id: Date.now() });
  const [showEditor, setShowEditor] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("請選擇題目，或新增文字．語彙題型。");
  const editorRefs = useRef<Record<QuizEditableField, HTMLDivElement | null>>({ prompt: null, note: null });
  const activeEditorRef = useRef<QuizEditableField>("prompt");

  useEffect(() => {
    let active = true;

    async function loadQuizData() {
      const [questionsResult, storedCategories] = await Promise.all([
        readQuizQuestionsWithSource({
          level: selectedLevel,
          category: selectedCategory,
          query: searchText,
          page,
          pageSize: quizQuestionsPerPage
        }),
        readQuizCategoriesWithFallback()
      ]);

      if (!active) {
        return;
      }

      setQuestions(questionsResult.questions);
      setTotalQuestions(questionsResult.total);
      setCategories(storedCategories);
      if (!storedCategories.some((category) => category.level === selectedLevel && category.name === selectedCategory)) {
        const firstCategory = storedCategories.find((category) => category.level === selectedLevel) ?? storedCategories[0];
        setSelectedLevel(firstCategory?.level ?? "N5");
        setSelectedCategory(firstCategory?.name ?? "文字．語彙");
      }
      setMessage(
        questionsResult.source === "database"
          ? "已讀取資料庫題庫。"
          : `資料庫讀取失敗，暫時顯示本機題庫：${questionsResult.error ?? "請確認 Supabase quiz_questions 資料表。"}`
      );
    }

    loadQuizData();

    return () => {
      active = false;
    };
  }, [page, searchText, selectedCategory, selectedLevel]);

  const visibleQuestions = questions;
  const pageCount = Math.max(1, Math.ceil(totalQuestions / quizQuestionsPerPage));
  const visiblePages = getVisiblePageNumbers(page, pageCount);

  const currentLevelCategories = useMemo(
    () => categories.filter((category) => category.level === selectedLevel),
    [categories, selectedLevel]
  );

  function persist(nextQuestions: QuizQuestionRecord[], nextMessage: string) {
    setQuestions(nextQuestions);
    writeStoredQuizQuestions(nextQuestions);
    setMessage(nextMessage);
  }

  function resetDraft() {
    setSelectedId(null);
    setDraft(getNewQuestionDraft(selectedLevel, selectedCategory));
    setShowEditor(true);
    setMessage(`正在新增${selectedCategory}題型。`);
  }

  function selectQuestion(question: QuizQuestionRecord) {
    const relatedQuestions = questions.filter(
      (candidate) =>
        candidate.id !== question.id &&
        candidate.level === question.level &&
        candidate.category === question.category
    );

    setSelectedId(question.id);
    setDraft(getDraftForEditor(question, relatedQuestions));
    setMessage(`已選擇「${question.theme || stripHtml(question.prompt)}」。`);
  }

  function editSelected() {
    if (!selectedId) {
      setMessage("請先選擇一題。");
      return;
    }

    setShowEditor(true);
    setMessage("正在編輯題型。");
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();

    const promptHtml = editorRefs.current.prompt?.innerHTML ?? draft.prompt;
    const noteHtml = editorRefs.current.note?.innerHTML ?? draft.note;
    const promptText = stripHtml(promptHtml);
    const answer = draft.answer.trim();
    const manualOptions = normalizeOptions(draft.options, answer);
    const options = generateQuizDistractors(answer, questions, manualOptions);
    const nextQuestion: QuizQuestionRecord = {
      ...draft,
      id: (selectedId ?? draft.id) || Date.now(),
      level: selectedLevel,
      category: selectedCategory,
      theme: draft.theme.trim() || promptText,
      prompt: promptHtml.trim(),
      note: noteHtml.trim(),
      answer,
      options
    };

    if (!promptText || !nextQuestion.answer) {
      setMessage("請填入主題與正確解答。");
      return;
    }

    setMessage(selectedId ? "正在同步更新題庫。" : "正在同步新增題庫。");

    try {
      const savedQuestion = await saveQuizQuestion(nextQuestion, selectedId ? "update" : "create");
      const nextQuestions = selectedId
        ? questions.map((question) => (question.id === selectedId ? savedQuestion : question))
        : [savedQuestion, ...questions];

      persist(nextQuestions, selectedId ? "已更新資料庫題庫，並自動補齊干擾選項。" : "已新增資料庫題庫，並自動補齊干擾選項。");
      if (!selectedId) {
        setTotalQuestions((current) => current + 1);
      }
      setSelectedId(savedQuestion.id);
      setDraft(getDraftForEditor(savedQuestion));
      setShowEditor(false);
    } catch (error) {
      setMessage(`資料庫儲存失敗：${error instanceof Error ? error.message : "請確認 Supabase quiz_questions 資料表。"}`);
    }
  }

  async function deleteSelected() {
    if (!selectedId) {
      setMessage("請先選擇一題。");
      return;
    }

    setMessage("正在同步刪除題目。");

    try {
      await deleteQuizQuestions([selectedId]);
      persist(questions.filter((question) => question.id !== selectedId), "已從資料庫刪除題目。");
      setTotalQuestions((current) => Math.max(0, current - 1));
      setSelectedId(null);
      setDraft({ ...emptyQuestion, id: Date.now() });
      setShowEditor(false);
    } catch (error) {
      setMessage(`資料庫刪除失敗：${error instanceof Error ? error.message : "請確認 Supabase quiz_questions 資料表。"}`);
    }
  }

  function updateOption(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (optionIndex === index ? value : option))
    }));
  }

  function commitEditableField(field: QuizEditableField, html: string) {
    setDraft((current) => ({
      ...current,
      [field]: html,
      ...(field === "prompt" ? { theme: stripHtml(html) } : {})
    }));
  }

  function handleEditableKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    document.execCommand("insertLineBreak");
  }

  function applyTextColor(color: string) {
    const field = activeEditorRef.current;
    const editor = editorRefs.current[field];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("foreColor", false, color);
    commitEditableField(field, editor.innerHTML);
    setMessage(`已套用文字色彩 ${color}。`);
  }

  function toggleTextBold() {
    const field = activeEditorRef.current;
    const editor = editorRefs.current[field];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("bold");
    commitEditableField(field, editor.innerHTML);
    setMessage("已套用粗體。");
  }

  function changeCategory(category: string) {
    setSelectedCategory(category);
    setSelectedId(null);
    setDraft((current) => ({ ...current, category }));
    setShowEditor(false);
    setPage(1);
    setMessage(`目前分類：${category}`);
  }

  function changeLevel(level: QuizLevel) {
    const firstCategory = categories.find((category) => category.level === level)?.name ?? "文字．語彙";
    setSelectedLevel(level);
    setSelectedCategory(firstCategory);
    setSelectedId(null);
    setDraft((current) => ({ ...current, level, category: firstCategory }));
    setShowEditor(false);
    setPage(1);
    setMessage(`目前程度：${level}`);
  }

  function searchQuestions(event: FormEvent) {
    event.preventDefault();
    setSelectedId(null);
    setPage(1);
  }

  function changePage(nextPage: number) {
    const normalizedPage = Math.max(1, Math.min(pageCount, nextPage));

    if (normalizedPage === page) {
      return;
    }

    setSelectedId(null);
    setPage(normalizedPage);
  }

  return (
    <AdminShell>
      <div className={styles.listTools}>
        <select value={selectedLevel} onChange={(event) => changeLevel(event.target.value as QuizLevel)}>
          {quizLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
        <button className={styles.ghostButton} type="button">
          新增分類
        </button>
        <select value={selectedCategory} onChange={(event) => changeCategory(event.target.value)}>
          {currentLevelCategories.map((category) => (
            <option key={category.id}>{category.name}</option>
          ))}
        </select>
        <button type="button" onClick={resetDraft}>
          新增題型
        </button>
        <div className={styles.toolSpacer} />
        <a className={styles.primaryLink} href={`/quiz?level=${selectedLevel}&category=${encodeURIComponent(selectedCategory)}`} target="_blank" rel="noreferrer">
          新增測驗
        </a>
      </div>

      <p className={`${styles.statusMessage} ${styles.quizStatusMessage}`}>{message}</p>

      {showEditor ? (
        <form className={`${styles.editorForm} ${styles.quizEditorForm}`} onSubmit={saveQuestion}>
          <section className={styles.quizPanel}>
            <div className={styles.quizColorTools} aria-label="文字色彩">
              <button className={styles.quizBoldButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={toggleTextBold}>
                B
              </button>
              <button className={styles.quizPresetButton} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextColor("#7D7D7D")}>
                預設
              </button>
              {quizTextColors.map((color) => (
                <button
                  key={color}
                  className={styles.quizColorDot}
                  type="button"
                  style={{ backgroundColor: color }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyTextColor(color)}
                  aria-label={`套用 ${color}`}
                />
              ))}
            </div>
            <span className={styles.quizFieldLabel}>
              主題
              <small>前台顯示</small>
            </span>
            <div
              ref={(element) => {
                editorRefs.current.prompt = element;
              }}
              className={`${styles.quizEditableField} ${styles.quizPromptField}`}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="あしたは雨ですか"
              dangerouslySetInnerHTML={{ __html: draft.prompt }}
              onFocus={() => {
                activeEditorRef.current = "prompt";
              }}
              onBlur={(event) => commitEditableField("prompt", event.currentTarget.innerHTML)}
              onKeyDown={handleEditableKeyDown}
            />
            <span className={styles.quizFieldLabel}>
              備註
              <small>僅做後台個人備註</small>
            </span>
            <div
              ref={(element) => {
                editorRefs.current.note = element;
              }}
              className={`${styles.quizEditableField} ${styles.quizNoteField}`}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={"あしたは雨(あめ)ですか\n明天下雨嗎"}
              dangerouslySetInnerHTML={{ __html: draft.note }}
              onFocus={() => {
                activeEditorRef.current = "note";
              }}
              onBlur={(event) => commitEditableField("note", event.currentTarget.innerHTML)}
              onKeyDown={handleEditableKeyDown}
            />
            <span className={styles.quizFieldLabel}>正確解答</span>
            <input
              className={styles.quizAnswerField}
              value={draft.answer}
              onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))}
            />
            <span className={styles.quizFieldLabel}>干擾選項</span>
            <div className={styles.quizOptionGroup}>
              <div className={styles.quizOptionRow}>
                {draft.options.map((option, index) => (
                  <input key={index} value={option} onChange={(event) => updateOption(index, event.target.value)} />
                ))}
              </div>
              <small>可手動填入；空白時儲存會自動補齊讀音型干擾選項。</small>
            </div>
            <div className={styles.quizPanelActions}>
              <button className={styles.ghostButton} type="button" onClick={() => setShowEditor(false)}>
                取消
              </button>
              <button type="submit">確認</button>
            </div>
          </section>
        </form>
      ) : (
        <>
          <form className={styles.wordSearchBar} onSubmit={searchQuestions}>
            <label>
              <span>搜尋列</span>
              <input
                value={searchText}
                placeholder="搜尋分類或主題"
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </form>
          <div className={styles.tableWrap}>
            <table className={styles.noteTable}>
              <thead>
                <tr>
                  <th aria-label="選取" />
                  <th>分類名稱</th>
                  <th>主題</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuestions.map((question) => (
                  <tr key={question.id} className={selectedId === question.id ? styles.selectedRow : undefined} onClick={() => selectQuestion(question)}>
                    <td>
                      <input checked={selectedId === question.id} readOnly type="checkbox" aria-label={`選取 ${question.theme || question.prompt}`} />
                    </td>
                    <td>{question.category}</td>
                    <td>{question.theme || question.prompt}</td>
                  </tr>
                ))}
                {visibleQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={3}>目前沒有{selectedCategory}題目。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className={styles.formActions}>
            <button className={styles.ghostButton} type="button" onClick={editSelected}>
              編輯
            </button>
            <button className={styles.ghostButton} type="button" onClick={deleteSelected}>
              刪除
            </button>
          </div>
          {pageCount > 1 ? (
            <nav className={styles.pagination} aria-label="模擬測驗列表頁碼">
              {pageCount > maxVisiblePageButtons ? (
                <button
                  type="button"
                  onClick={() => changePage(page - 1)}
                  disabled={page === 1}
                  aria-label="上一頁"
                >
                  上
                </button>
              ) : null}
              {visiblePages.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === page ? styles.currentPage : undefined}
                  onClick={() => changePage(item)}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </button>
              ))}
              {pageCount > maxVisiblePageButtons ? (
                <button
                  type="button"
                  onClick={() => changePage(page + 1)}
                  disabled={page === pageCount}
                  aria-label="下一頁"
                >
                  下
                </button>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
