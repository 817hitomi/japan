import assert from "node:assert/strict";
import { normalizeQuizEditorHtml } from "../app/quiz/quizEditorHtml.ts";

assert.equal(
  normalizeQuizEditorHtml("<ul><li>第一行</li><li><strong>第二行</strong></li></ul>"),
  "第一行<br><strong>第二行</strong>"
);
assert.equal(
  normalizeQuizEditorHtml('<ol class="pasted-list"><li><span style="color: #c28080">備註</span></li></ol>'),
  '<span style="color: #c28080">備註</span>'
);
assert.equal(normalizeQuizEditorHtml("<strong>一般文字</strong><br>下一行"), "<strong>一般文字</strong><br>下一行");

console.log("Quiz editor HTML assertions passed.");
