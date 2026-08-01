"use client";

import { ChangeEvent, ClipboardEvent, forwardRef, KeyboardEvent, MouseEvent, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NoteContentBlock, uploadMediaFile } from "../../notes/noteStorage";
import styles from "./AdminNotes.module.scss";

const fixedColors = ["#7D7D7D", "#C28080", "#D6C09E", "#8CB993"] as const;
const blockSelector = '[data-note-editor-block="true"]';

export type ArticleRichEditorHandle = {
  getBlocks: () => NoteContentBlock[];
};

type ArticleRichEditorProps = {
  initialBlocks: NoteContentBlock[];
  onMessage: (message: string) => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createBlockId(type: NoteContentBlock["type"]) {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fragmentToHtml(fragment: DocumentFragment) {
  const container = document.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

function hasMeaningfulHtml(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return Boolean(container.textContent?.trim() || container.querySelector("img, video, iframe, hr, li"));
}

function blockToEditorHtml(block: NoteContentBlock) {
  const type = block.type ?? "text";
  const attributes = [
    'data-note-editor-block="true"',
    `data-block-id="${escapeHtml(block.id || createBlockId(type))}"`,
    `data-block-type="${escapeHtml(type)}"`,
    `data-block-title="${escapeHtml(block.title || "文章內容")}"`
  ].join(" ");
  const heading = block.heading?.trim()
    ? `<h3 data-note-heading="true">${escapeHtml(block.heading.trim())}</h3>`
    : "";

  if (type === "image") {
    return `<figure ${attributes} data-image-url="${escapeHtml(block.imageUrl ?? "")}" data-link-url="${escapeHtml(block.linkUrl ?? "")}" contenteditable="false">${heading}<div class="${styles.articleMediaPreview}">${block.imageUrl ? `<img src="${escapeHtml(block.imageUrl)}" alt="">` : "<span>尚未設定圖片</span>"}</div><button type="button" data-remove-editor-block="true">移除圖片</button></figure>`;
  }

  if (type === "video") {
    const label = block.caption?.trim() || block.videoUrl?.trim() || "影片";
    return `<figure ${attributes} data-video-url="${escapeHtml(block.videoUrl ?? "")}" data-caption="${escapeHtml(block.caption ?? "")}" contenteditable="false">${heading}<div class="${styles.articleVideoPreview}"><strong>影片</strong><span>${escapeHtml(label)}</span></div><button type="button" data-remove-editor-block="true">移除影片</button></figure>`;
  }

  if (type === "ad") {
    return `<div ${attributes} data-ad-slot="${escapeHtml(block.adSlot ?? "")}" contenteditable="false"><div class="${styles.articleLegacyAd}">${escapeHtml(block.adSlot || "文章廣告版位")}</div></div>`;
  }

  const html = block.html?.trim() ? block.html : "<p><br></p>";
  return `<section ${attributes}>${heading}<div data-note-content="true">${html}</div></section>`;
}

function blocksToEditorHtml(blocks: NoteContentBlock[]) {
  const source = blocks.length > 0
    ? blocks
    : [{ id: createBlockId("text"), type: "text" as const, title: "文章內容", html: "", collapsed: false }];
  return source.map(blockToEditorHtml).join("");
}

function elementToBlock(element: HTMLElement, index: number): NoteContentBlock {
  const rawType = element.dataset.blockType;
  const type: NoteContentBlock["type"] =
    rawType === "image" || rawType === "video" || rawType === "note" || rawType === "ad" ? rawType : "text";
  const headingElement = Array.from(element.children).find((child) => child instanceof HTMLElement && child.dataset.noteHeading === "true");
  const content = Array.from(element.children).find((child) => child instanceof HTMLElement && child.dataset.noteContent === "true");

  return {
    id: element.dataset.blockId || `article-block-${index}`,
    type,
    title: element.dataset.blockTitle || (type === "note" ? "NOTE" : "文章內容"),
    heading: headingElement?.textContent?.trim() ?? "",
    html: content instanceof HTMLElement ? content.innerHTML : "",
    collapsed: false,
    imageUrl: element.dataset.imageUrl ?? "",
    linkUrl: element.dataset.linkUrl ?? "",
    videoUrl: element.dataset.videoUrl ?? "",
    caption: element.dataset.caption ?? "",
    adSlot: element.dataset.adSlot ?? ""
  };
}

function editorToBlocks(editor: HTMLDivElement | null): NoteContentBlock[] {
  if (!editor) return [];

  const blocks: NoteContentBlock[] = [];
  const looseNodes: Node[] = [];

  function flushLooseNodes() {
    if (looseNodes.length === 0) return;
    const container = document.createElement("div");
    looseNodes.splice(0).forEach((node) => container.append(node.cloneNode(true)));
    if (container.textContent?.trim() || container.querySelector("img, video, iframe, hr, br")) {
      blocks.push({
        id: createBlockId("text"),
        type: "text",
        title: "文章內容",
        html: container.innerHTML,
        collapsed: false
      });
    }
  }

  Array.from(editor.childNodes).forEach((node) => {
    if (node instanceof HTMLElement && node.matches(blockSelector)) {
      flushLooseNodes();
      blocks.push(elementToBlock(node, blocks.length));
      return;
    }
    looseNodes.push(node);
  });
  flushLooseNodes();

  return blocks.length > 0
    ? blocks
    : [{ id: createBlockId("text"), type: "text", title: "文章內容", html: "", collapsed: false }];
}

export const ArticleRichEditor = forwardRef<ArticleRichEditorHandle, ArticleRichEditorProps>(function ArticleRichEditor(
  { initialBlocks, onMessage },
  ref
) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const selectionRangeRef = useRef<Range | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<"image" | "video" | null>(null);
  const initialHtml = useMemo(() => blocksToEditorHtml(initialBlocks), [initialBlocks]);

  useLayoutEffect(() => {
    if (!editorRef.current || initializedRef.current) return;
    editorRef.current.innerHTML = initialHtml;
    initializedRef.current = true;
  }, [initialHtml]);

  useImperativeHandle(ref, () => ({
    getBlocks: () => editorToBlocks(editorRef.current)
  }));

  function rememberSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRangeRef.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const range = selectionRangeRef.current;
    const selection = window.getSelection();
    if (!range || !selection || !editorRef.current?.contains(range.commonAncestorContainer)) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  function runCommand(command: string, value?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    rememberSelection();
  }

  function keepSelection(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    rememberSelection();
  }

  function moveCaretToStart(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    selectionRangeRef.current = range.cloneRange();
    editorRef.current?.focus();
  }

  function exitNoteAtEnd(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const anchor = range.startContainer;
    const anchorElement = anchor instanceof Element ? anchor : anchor.parentElement;
    const noteBlock = anchorElement?.closest<HTMLElement>('[data-block-type="note"]');
    const noteContent = noteBlock?.querySelector<HTMLElement>('[data-note-content="true"]');
    if (!noteBlock || !noteContent || !editor.contains(noteBlock) || !noteContent.contains(anchor)) return;

    const remainderRange = document.createRange();
    remainderRange.selectNodeContents(noteContent);
    remainderRange.setStart(range.startContainer, range.startOffset);
    const remainder = document.createElement("div");
    remainder.append(remainderRange.cloneContents());
    if (remainder.textContent?.trim() || remainder.querySelector("img, video, iframe, hr")) return;

    event.preventDefault();

    const nextBlock = noteBlock.nextElementSibling;
    let target = nextBlock?.matches('[data-note-editor-block="true"][data-block-type="text"]')
      ? nextBlock.querySelector<HTMLElement>('[data-note-content="true"]')
      : null;

    if (!target) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = blockToEditorHtml({
        id: createBlockId("text"),
        type: "text",
        title: "文章內容",
        html: "",
        collapsed: false
      });
      const textBlock = wrapper.firstElementChild;
      target = textBlock?.querySelector<HTMLElement>('[data-note-content="true"]') ?? null;
      if (textBlock) noteBlock.after(textBlock);
    }

    if (target) {
      moveCaretToStart(target);
      target.scrollIntoView({ block: "nearest" });
    }
  }

  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    const pastedText = event.clipboardData.getData("text/plain");
    if (!pastedText) return;

    event.preventDefault();
    const normalizedText = pastedText.replace(/\r\n?/g, "\n").replaceAll("\u00a0", " ");
    const plainHtml = escapeHtml(normalizedText).replaceAll("\n", "<br>");
    document.execCommand("insertHTML", false, plainHtml);
    rememberSelection();
    onMessage("已貼上純文字，Notion 的字型、顏色、背景與其他來源樣式已清除。");
  }

  function insertBlock(block: NoteContentBlock) {
    const editor = editorRef.current;
    if (!editor) return;

    restoreSelection();
    const selection = window.getSelection();
    const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const anchor = activeRange?.startContainer ?? null;
    const anchorElement = anchor instanceof Element ? anchor : anchor?.parentElement;
    const currentBlock = anchorElement?.closest(blockSelector);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = blockToEditorHtml(block);
    const nextBlock = wrapper.firstElementChild;
    if (!nextBlock) return;

    const currentContent = currentBlock?.querySelector<HTMLElement>('[data-note-content="true"]');
    let trailingBlock: Element | null = null;

    if (
      activeRange &&
      currentBlock &&
      currentContent &&
      editor.contains(currentBlock) &&
      currentContent.contains(activeRange.startContainer) &&
      currentContent.contains(activeRange.endContainer)
    ) {
      activeRange.deleteContents();
      activeRange.collapse(true);

      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(currentContent);
      beforeRange.setEnd(activeRange.startContainer, activeRange.startOffset);
      const beforeHtml = fragmentToHtml(beforeRange.cloneContents());

      const afterRange = document.createRange();
      afterRange.selectNodeContents(currentContent);
      afterRange.setStart(activeRange.startContainer, activeRange.startOffset);
      const afterHtml = fragmentToHtml(afterRange.cloneContents());
      const hasBefore = hasMeaningfulHtml(beforeHtml);
      const hasAfter = hasMeaningfulHtml(afterHtml);

      if (hasBefore) {
        currentContent.innerHTML = beforeHtml;
        currentBlock.after(nextBlock);

        if (hasAfter) {
          const currentData = elementToBlock(currentBlock as HTMLElement, 0);
          const remainderWrapper = document.createElement("div");
          remainderWrapper.innerHTML = blockToEditorHtml({
            ...currentData,
            id: createBlockId(currentData.type),
            heading: "",
            html: afterHtml
          });
          trailingBlock = remainderWrapper.firstElementChild;
          if (trailingBlock) nextBlock.after(trailingBlock);
        }
      } else {
        currentBlock.before(nextBlock);
        currentContent.innerHTML = hasAfter ? afterHtml : "<p><br></p>";
        trailingBlock = currentBlock;
      }

      if (!trailingBlock && (block.type === "image" || block.type === "video")) {
        const trailingWrapper = document.createElement("div");
        trailingWrapper.innerHTML = blockToEditorHtml({
          id: createBlockId("text"),
          type: "text",
          title: "文章內容",
          html: "",
          collapsed: false
        });
        trailingBlock = trailingWrapper.firstElementChild;
        if (trailingBlock) nextBlock.after(trailingBlock);
      }
    } else if (currentBlock && editor.contains(currentBlock)) {
      currentBlock.after(nextBlock);
    } else {
      editor.append(nextBlock);
    }

    const editableTarget = nextBlock.querySelector<HTMLElement>('[data-note-content="true"]');
    const trailingTarget = trailingBlock?.querySelector<HTMLElement>('[data-note-content="true"]');
    const caretTarget = editableTarget ?? trailingTarget;
    if (caretTarget) {
      const range = document.createRange();
      range.selectNodeContents(caretTarget);
      range.collapse(!editableTarget);
      const nextSelection = window.getSelection();
      nextSelection?.removeAllRanges();
      nextSelection?.addRange(range);
      selectionRangeRef.current = range.cloneRange();
      editor.focus();
    }
  }

  function insertHeading() {
    const heading = window.prompt("請輸入小標題");
    if (!heading?.trim()) return;
    insertBlock({
      id: createBlockId("text"),
      type: "text",
      title: "文章內容",
      heading: heading.trim(),
      html: "",
      collapsed: false
    });
    onMessage("已在游標位置插入小標題，可直接在下方繼續輸入。");
  }

  function insertNoteStyle() {
    insertBlock({
      id: createBlockId("note"),
      type: "note",
      title: "NOTE",
      html: "<p>日文例句</p><p>中文說明</p>",
      collapsed: false
    });
    onMessage("已在游標位置插入 NOTE 預設樣式，例句與說明可直接改寫。");
  }

  function insertVideoUrl() {
    const videoUrl = window.prompt("請輸入 YouTube、MP4 或其他影片網址");
    if (!videoUrl?.trim()) return;
    const caption = window.prompt("影片說明（可留白）")?.trim() ?? "";
    insertBlock({
      id: createBlockId("video"),
      type: "video",
      title: "影片",
      html: "",
      videoUrl: videoUrl.trim(),
      caption,
      collapsed: false
    });
    onMessage("已在游標位置插入影片。");
  }

  async function uploadAndInsert(event: ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(type);
    onMessage(type === "image" ? "圖片上傳中。" : "影片上傳中。");
    try {
      const url = await uploadMediaFile(file, type);
      insertBlock({
        id: createBlockId(type),
        type,
        title: type === "image" ? "圖片" : "影片",
        html: "",
        imageUrl: type === "image" ? url : "",
        videoUrl: type === "video" ? url : "",
        caption: type === "video" ? file.name : "",
        collapsed: false
      });
      onMessage(type === "image" ? "圖片已插入游標位置。" : "影片已插入游標位置。");
    } catch (error) {
      onMessage(`${type === "image" ? "圖片" : "影片"}上傳失敗：${error instanceof Error ? error.message : "請稍後再試。"}`);
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className={styles.articleEditorShell}>
      <div className={styles.articleToolbar} aria-label="文章編輯工具列">
        <button type="button" className={styles.boldButton} onMouseDown={keepSelection} onClick={() => runCommand("bold")}>
          B
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => runCommand("foreColor", "#7D7D7D")}>
          預設
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => runCommand("insertHTML", "<hr><p><br></p>")}>
          分隔線
        </button>
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => {
            const url = window.prompt("請輸入連結網址");
            if (url?.trim()) runCommand("createLink", url.trim());
          }}
        >
          起連結
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={() => runCommand("insertUnorderedList")}>
          清單
        </button>
        {fixedColors.map((color) => (
          <button
            key={color}
            type="button"
            className={styles.colorSwatch}
            style={{ backgroundColor: color }}
            onMouseDown={keepSelection}
            onClick={() => runCommand("foreColor", color)}
            aria-label={`套用 ${color}`}
          />
        ))}
        <span className={styles.toolbarDivider} />
        <button type="button" onMouseDown={keepSelection} onClick={insertHeading}>
          小標題
        </button>
        <button type="button" className={styles.notePresetButton} onMouseDown={keepSelection} onClick={insertNoteStyle}>
          NOTE 樣式
        </button>
        <button
          type="button"
          disabled={uploading !== null}
          onMouseDown={(event) => {
            keepSelection(event);
            imageInputRef.current?.click();
          }}
        >
          {uploading === "image" ? "圖片上傳中" : "插入圖片"}
        </button>
        <button
          type="button"
          disabled={uploading !== null}
          onMouseDown={(event) => {
            keepSelection(event);
            videoInputRef.current?.click();
          }}
        >
          {uploading === "video" ? "影片上傳中" : "上傳影片"}
        </button>
        <button type="button" onMouseDown={keepSelection} onClick={insertVideoUrl}>
          影片網址
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => void uploadAndInsert(event, "image")} />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/ogg,video/quicktime"
          hidden
          onChange={(event) => void uploadAndInsert(event, "video")}
        />
      </div>

      <div
        ref={editorRef}
        className={styles.articleCanvas}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="從這裡開始撰寫完整文章……"
        onInput={rememberSelection}
        onKeyDown={exitNoteAtEnd}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onFocus={rememberSelection}
        onPaste={pastePlainText}
        onClick={(event) => {
          const removeButton = (event.target as HTMLElement).closest<HTMLElement>('[data-remove-editor-block="true"]');
          if (!removeButton) return;
          removeButton.closest(blockSelector)?.remove();
          onMessage("已從文章中移除媒體。");
        }}
      />
    </div>
  );
});
