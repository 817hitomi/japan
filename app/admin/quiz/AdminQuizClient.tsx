"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AdminShell } from "../AdminShell";
import {
  createQuizCategory,
  deleteQuizQuestions,
  readQuizCategoriesWithFallback,
  readQuizQuestionsWithSource,
  saveQuizQuestion,
  writeStoredQuizQuestions
} from "../../quiz/quizStorage";
import { generateQuizDistractors } from "../../quiz/quizDistractors";
import { normalizeQuizEditorHtml } from "../../quiz/quizEditorHtml";
import {
  QuizCategoryRecord,
  QuizLevel,
  QuizQuestionRecord,
  QuizQuestionType,
  isWordOrderQuestionType,
  parseWordOrderSegments,
  quizLevels,
  quizQuestionTypes,
  seedQuizCategories,
  wordOrderQuestionType
} from "../../quiz/quizTypes";
import styles from "../notes/AdminNotes.module.scss";

const emptyQuestion: QuizQuestionRecord = {
  id: 0,
  level: "N5",
  category: "文字．語彙",
  questionType: "漢字讀法",
  theme: "",
  prompt: "",
  note: "",
  answer: "",
  options: ["", "", "", ""]
};
const quizTextColors = ["#7D7D7D", "#C28080", "#D6C09E", "#8CB993"] as const;
const quizQuestionsPerPage = 10;
const maxVisiblePageButtons = 10;
const quizSearchDebounceMs = 250;
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
  if (isWordOrderQuestionType(question.questionType)) {
    return {
      ...question,
      note: normalizeQuizEditorHtml(question.note),
      options: question.options
    };
  }

  const generatedOptions = generateQuizDistractors(question.answer, relatedQuestions, question.options);

  return {
    ...question,
    note: normalizeQuizEditorHtml(question.note),
    options: getEditorOptions(generatedOptions, question.answer)
  };
}

function getNewQuestionDraft(level: QuizLevel, category: string, questionType?: QuizQuestionType) {
  const nextQuestionType = questionType ?? emptyQuestion.questionType;

  return {
    ...emptyQuestion,
    id: Date.now(),
    level,
    category,
    questionType: nextQuestionType,
    options: isWordOrderQuestionType(nextQuestionType) ? [] : getEditorOptions(emptyQuestion.options, emptyQuestion.answer)
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

function getAdminQuizPageHref({
  level,
  category,
  questionType,
  query,
  page
}: {
  level: QuizLevel;
  category: string;
  questionType?: QuizQuestionType;
  query: string;
  page: number;
}) {
  const params = new URLSearchParams({ level });
  if (category.trim()) params.set("category", category.trim());
  if (questionType) params.set("type", questionType);
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  return `/admin/quiz?${params.toString()}`;
}

export default function AdminQuizClient({
  initialCategory = "",
  initialLevel = "N5",
  initialPage = 1,
  initialQuestionType,
  initialSearchText = ""
}: {
  initialCategory?: string;
  initialLevel?: QuizLevel;
  initialPage?: number;
  initialQuestionType?: QuizQuestionType;
  initialSearchText?: string;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [categories, setCategories] = useState<QuizCategoryRecord[]>(seedQuizCategories);
  const [selectedLevel, setSelectedLevel] = useState<QuizLevel>(initialLevel);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuizQuestionType | undefined>(initialQuestionType);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuizQuestionRecord>({ ...emptyQuestion, id: Date.now() });
  const [wordOrderInput, setWordOrderInput] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [searchText, setSearchText] = useState(initialSearchText);
  const [searchQuery, setSearchQuery] = useState(initialSearchText);
  const [page, setPage] = useState(initialPage);
  const [message, setMessage] = useState("請選擇題目，或新增文字．語彙題型。");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const editorRefs = useRef<Record<QuizEditableField, HTMLDivElement | null>>({ prompt: null, note: null });
  const activeEditorRef = useRef<QuizEditableField>("prompt");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchText.trim()), quizSearchDebounceMs);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    let active = true;

    async function loadQuizData() {
      const [questionsResult, storedCategories] = await Promise.all([
        readQuizQuestionsWithSource({
          level: selectedLevel,
          category: selectedCategory,
          questionType: selectedQuestionType,
          query: searchQuery,
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
      if (
        selectedCategory &&
        !storedCategories.some((category) => category.level === selectedLevel && category.name === selectedCategory)
      ) {
        const firstCategory = storedCategories.find((category) => category.level === selectedLevel);
        setSelectedCategory(firstCategory?.name ?? "");
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
  }, [page, searchQuery, selectedCategory, selectedLevel, selectedQuestionType]);

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
    if (!selectedCategory) {
      setMessage(`請先替 ${selectedLevel} 新增分類。`);
      setShowCategoryForm(true);
      return;
    }
    setSelectedId(null);
    const nextDraft = getNewQuestionDraft(selectedLevel, selectedCategory, selectedQuestionType);
    setDraft(nextDraft);
    setWordOrderInput(nextDraft.options.join("｜"));
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
    const nextDraft = getDraftForEditor(question, relatedQuestions);
    setDraft(nextDraft);
    setWordOrderInput(isWordOrderQuestionType(nextDraft.questionType) ? nextDraft.options.join("｜") : "");
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
    const noteHtml = normalizeQuizEditorHtml(editorRefs.current.note?.innerHTML ?? draft.note);
    const promptText = stripHtml(promptHtml);
    const answer = draft.answer.trim();
    const isWordOrderQuestion = isWordOrderQuestionType(draft.questionType);
    const manualOptions = isWordOrderQuestion
      ? parseWordOrderSegments(wordOrderInput)
      : normalizeOptions(draft.options, answer);
    const options = isWordOrderQuestion
      ? manualOptions
      : generateQuizDistractors(answer, questions, manualOptions);
    const nextQuestion: QuizQuestionRecord = {
      ...draft,
      id: (selectedId ?? draft.id) || Date.now(),
      level: selectedLevel,
      category: selectedCategory,
      theme: draft.theme.trim() || promptText || answer,
      prompt: promptHtml.trim(),
      note: noteHtml.trim(),
      answer,
      options
    };

    if (!nextQuestion.answer || (!isWordOrderQuestion && !promptText)) {
      setMessage(isWordOrderQuestion ? "請填入正確解答。" : "請填入主題與正確解答。");
      return;
    }

    if (isWordOrderQuestion && nextQuestion.options.length < 2) {
      setMessage("語序排列至少需要兩個語塊，請使用 ｜、| 或換行分隔。");
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
      setWordOrderInput(isWordOrderQuestionType(savedQuestion.questionType) ? savedQuestion.options.join("｜") : "");
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
      setWordOrderInput("");
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

  function changeDraftQuestionType(questionType: QuizQuestionType) {
    setDraft((current) => ({
      ...current,
      questionType,
      options: isWordOrderQuestionType(questionType)
        ? parseWordOrderSegments(wordOrderInput || current.options.join("｜"))
        : getEditorOptions(current.options, current.answer)
    }));

    if (isWordOrderQuestionType(questionType) && !wordOrderInput) {
      setWordOrderInput(draft.options.join("｜"));
    }
  }

  function commitEditableField(field: QuizEditableField, html: string) {
    const normalizedHtml = field === "note" ? normalizeQuizEditorHtml(html) : html;

    setDraft((current) => ({
      ...current,
      [field]: normalizedHtml,
      ...(field === "prompt" ? { theme: stripHtml(normalizedHtml) } : {})
    }));
  }

  function handleEditableBlur(field: QuizEditableField, editor: HTMLDivElement) {
    const normalizedHtml = field === "note" ? normalizeQuizEditorHtml(editor.innerHTML) : editor.innerHTML;

    if (editor.innerHTML !== normalizedHtml) {
      editor.innerHTML = normalizedHtml;
    }

    commitEditableField(field, normalizedHtml);
  }

  function handleEditablePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const plainText = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, plainText);
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
  }

  function toggleTextBold() {
    const field = activeEditorRef.current;
    const editor = editorRefs.current[field];
    if (!editor) {
      return;
    }

    editor.focus();
    document.execCommand("bold");
  }

  function changeCategory(category: string) {
    setSelectedCategory(category);
    setSelectedQuestionType(undefined);
    setSelectedId(null);
    setDraft((current) => ({ ...current, category }));
    setShowEditor(false);
    setPage(1);
    router.replace(getAdminQuizPageHref({ level: selectedLevel, category, query: searchQuery, page: 1 }));
    setMessage(`目前分類：${category}`);
  }

  function changeLevel(level: QuizLevel) {
    setSelectedLevel(level);
    setSelectedCategory("");
    setSelectedQuestionType(undefined);
    setSelectedId(null);
    setDraft((current) => ({ ...current, level, category: "" }));
    setShowEditor(false);
    setPage(1);
    router.replace(getAdminQuizPageHref({ level, category: "", query: searchQuery, page: 1 }));
    setMessage(`目前程度：${level}`);
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      setMessage("請輸入分類名稱。");
      return;
    }

    setIsSavingCategory(true);
    setMessage(`正在新增 ${selectedLevel} 分類。`);
    try {
      const category = await createQuizCategory(selectedLevel, name);
      setCategories((current) =>
        [...current.filter((item) => item.id !== category.id), category].sort(
          (left, right) => quizLevels.indexOf(left.level) - quizLevels.indexOf(right.level) || left.name.localeCompare(right.name)
        )
      );
      setSelectedCategory(category.name);
      setNewCategoryName("");
      setShowCategoryForm(false);
      setPage(1);
      router.replace(getAdminQuizPageHref({ level: selectedLevel, category: category.name, query: "", page: 1 }));
      window.dispatchEvent(new Event("quiz-categories-updated"));
      setMessage(`已新增 ${selectedLevel}／${category.name} 分類。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增分類失敗。");
    } finally {
      setIsSavingCategory(false);
    }
  }

  function changeQuestionType(questionType?: QuizQuestionType) {
    setSelectedQuestionType(questionType);
    setSelectedId(null);
    setShowEditor(false);
    setPage(1);
    router.replace(
      getAdminQuizPageHref({
        level: selectedLevel,
        category: selectedCategory,
        questionType,
        query: searchQuery,
        page: 1
      })
    );
    setMessage(questionType ? `目前題型：${questionType}` : "目前顯示全部題型。");
  }

  function searchQuestions(event: FormEvent) {
    event.preventDefault();
    setSelectedId(null);
    setPage(1);
    const query = searchText.trim();
    setSearchQuery(query);
    router.replace(
      getAdminQuizPageHref({
        level: selectedLevel,
        category: selectedCategory,
        questionType: selectedQuestionType,
        query,
        page: 1
      })
    );
  }

  return (
    <AdminShell>
      <div className={styles.listTools}>
        <select value={selectedLevel} onChange={(event) => changeLevel(event.target.value as QuizLevel)}>
          {quizLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
        <button className={styles.ghostButton} type="button" onClick={() => setShowCategoryForm((current) => !current)}>
          新增分類
        </button>
        <select value={selectedCategory} onChange={(event) => changeCategory(event.target.value)} disabled={currentLevelCategories.length === 0}>
          <option value="">全部分類</option>
          {currentLevelCategories.map((category) => (
            <option key={category.id}>{category.name}</option>
          ))}
        </select>
        <button type="button" onClick={resetDraft}>
          新增題型
        </button>
        <div className={styles.toolSpacer} />
        <a
          className={styles.primaryLink}
          href={
            selectedQuestionType === wordOrderQuestionType
              ? `/quiz/grammar-practice?level=${selectedLevel}`
              : `/quiz?level=${selectedLevel}&category=${encodeURIComponent(selectedCategory)}`
          }
          target="_blank"
          rel="noreferrer"
        >
          前台預覽
        </a>
      </div>

      {showCategoryForm ? (
        <form className={styles.categoryCreateBar} onSubmit={addCategory}>
          <div>
            <strong>新增 {selectedLevel} 分類</strong>
            <span>建立後會立即出現在左側分類選單。</span>
          </div>
          <input
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="例如：文法、讀解"
            maxLength={80}
            autoFocus
          />
          <button type="submit" disabled={isSavingCategory}>
            {isSavingCategory ? "儲存中" : "儲存分類"}
          </button>
          <button
            className={styles.ghostButton}
            type="button"
            onClick={() => {
              setShowCategoryForm(false);
              setNewCategoryName("");
            }}
          >
            取消
          </button>
        </form>
      ) : null}

      <p className={`${styles.statusMessage} ${styles.quizStatusMessage}`}>{message}</p>

      {showEditor ? (
        <form className={`${styles.editorForm} ${styles.quizEditorForm}`} onSubmit={saveQuestion}>
          <section className={styles.quizPanel}>
            <span className={styles.quizFieldLabel}>題型</span>
            <select
              className={styles.quizTypeSelect}
              value={draft.questionType}
              onChange={(event) => changeDraftQuestionType(event.target.value as QuizQuestionType)}
            >
              {quizQuestionTypes.map((questionType) => (
                <option key={questionType}>{questionType}</option>
              ))}
            </select>
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
              {isWordOrderQuestionType(draft.questionType) ? "題目提示" : "主題"}
              <small>{isWordOrderQuestionType(draft.questionType) ? "可選，不會顯示正確答案" : "前台顯示"}</small>
            </span>
            <div
              ref={(element) => {
                editorRefs.current.prompt = element;
              }}
              className={`${styles.quizEditableField} ${styles.quizPromptField}`}
              contentEditable
              suppressContentEditableWarning
              data-placeholder={isWordOrderQuestionType(draft.questionType) ? "例如：請排成正確的日文句子" : "あしたは雨ですか"}
              dangerouslySetInnerHTML={{ __html: draft.prompt }}
              onFocus={() => {
                activeEditorRef.current = "prompt";
              }}
              onBlur={(event) => handleEditableBlur("prompt", event.currentTarget)}
              onKeyDown={handleEditableKeyDown}
            />
            <span className={styles.quizFieldLabel}>
              {isWordOrderQuestionType(draft.questionType) ? "答題詳解" : "備註"}
              <small>{isWordOrderQuestionType(draft.questionType) ? "答題後前台顯示" : "僅做後台個人備註"}</small>
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
              onBlur={(event) => handleEditableBlur("note", event.currentTarget)}
              onKeyDown={handleEditableKeyDown}
              onPaste={handleEditablePaste}
            />
            <span className={styles.quizFieldLabel}>正確解答</span>
            <input
              className={styles.quizAnswerField}
              value={draft.answer}
              onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))}
            />
            <span className={styles.quizFieldLabel}>
              {isWordOrderQuestionType(draft.questionType) ? "排列語塊" : "干擾選項"}
            </span>
            {isWordOrderQuestionType(draft.questionType) ? (
              <div className={styles.quizOptionGroup}>
                <textarea
                  className={styles.quizSegmentField}
                  value={wordOrderInput}
                  onChange={(event) => setWordOrderInput(event.target.value)}
                  placeholder="海賊王に｜俺は｜なる｜海賊王は｜俺が"
                />
                <small>請使用全形 ｜、半形 | 或換行分隔；可加入不需要使用的干擾語塊。</small>
              </div>
            ) : (
              <div className={styles.quizOptionGroup}>
                <div className={styles.quizOptionRow}>
                  {draft.options.map((option, index) => (
                    <input key={index} value={option} onChange={(event) => updateOption(index, event.target.value)} />
                  ))}
                </div>
                <small>可手動填入；空白時儲存會自動補齊讀音型干擾選項。</small>
              </div>
            )}
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
          {selectedCategory ? (
            <nav className={styles.quizTypeTabs} aria-label={`${selectedCategory}題型`}>
              <button
                className={!selectedQuestionType ? styles.activeQuizType : undefined}
                type="button"
                onClick={() => changeQuestionType()}
              >
                全部
              </button>
              {(selectedCategory === "文字．語彙"
                ? quizQuestionTypes.filter((questionType) => questionType !== wordOrderQuestionType)
                : [wordOrderQuestionType]
              ).map((questionType) => (
                <button
                  key={questionType}
                  className={selectedQuestionType === questionType ? styles.activeQuizType : undefined}
                  type="button"
                  onClick={() => changeQuestionType(questionType)}
                >
                  {questionType}
                </button>
              ))}
            </nav>
          ) : null}
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
                    <td>{question.questionType}</td>
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
                <Link
                  href={getAdminQuizPageHref({
                    level: selectedLevel,
                    category: selectedCategory,
                    questionType: selectedQuestionType,
                    query: searchQuery,
                    page: Math.max(1, page - 1)
                  })}
                  prefetch={false}
                  aria-disabled={page === 1}
                  aria-label="上一頁"
                >
                  ‹
                </Link>
              ) : null}
              {visiblePages.map((item) => (
                <Link
                  key={item}
                  className={item === page ? styles.currentPage : undefined}
                  href={getAdminQuizPageHref({
                    level: selectedLevel,
                    category: selectedCategory,
                    questionType: selectedQuestionType,
                    query: searchQuery,
                    page: item
                  })}
                  prefetch={false}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </Link>
              ))}
              {pageCount > maxVisiblePageButtons ? (
                <Link
                  href={getAdminQuizPageHref({
                    level: selectedLevel,
                    category: selectedCategory,
                    questionType: selectedQuestionType,
                    query: searchQuery,
                    page: Math.min(pageCount, page + 1)
                  })}
                  prefetch={false}
                  aria-disabled={page === pageCount}
                  aria-label="下一頁"
                >
                  ›
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
