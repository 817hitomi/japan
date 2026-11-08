import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const noteBlocksContent = readFileSync(new URL("../app/notes/NoteBlocksContent.tsx", import.meta.url), "utf8");
const articleStyles = readFileSync(new URL("../app/page.module.scss", import.meta.url), "utf8");

assert.match(noteBlocksContent, /preferredJapaneseVoiceName = "Google 日本語"/);
assert.match(noteBlocksContent, /new SpeechSynthesisUtterance\(readingsToSpeechText\(text\)\)/);
assert.match(noteBlocksContent, /utterance\.rate = japaneseSpeechRate/);
assert.match(noteBlocksContent, /onClick=\{\(\) => speakExample\(japaneseLine\)\}/);
assert.match(noteBlocksContent, /const japaneseLine = item\[0\]/);
assert.match(noteBlocksContent, /src="\/brand\/muc\.png"/);
assert.match(noteBlocksContent, /aria-label=\{`播放例句：\$\{readingsToSpeechText\(japaneseLine\)\}`\}/);
assert.match(articleStyles, /\.noteSpeakerButton\s*\{/);
assert.match(articleStyles, /background: #9bc0a8/);

console.log("note example speech assertions passed");
