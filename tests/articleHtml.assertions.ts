import assert from "node:assert/strict";
import { hasMeaningfulArticleHtml, trimBoundaryEmptyBlocks } from "../lib/articleHtml.ts";

assert.equal(
  trimBoundaryEmptyBlocks("<p><br></p><p>&nbsp;</p><p>「なれる」是「なる」的可能形</p>"),
  "<p>「なれる」是「なる」的可能形</p>"
);

assert.equal(hasMeaningfulArticleHtml("<p><br></p><p>&nbsp;</p>"), false);
assert.equal(hasMeaningfulArticleHtml("<p>表示「即使……也……」</p>"), true);

assert.equal(
  trimBoundaryEmptyBlocks("<p>第一段</p><p><br></p><p>第二段</p>"),
  "<p>第一段</p><p><br></p><p>第二段</p>"
);

assert.equal(
  trimBoundaryEmptyBlocks("<div class=\"empty\"><br></div><p>內容</p><div>&#160;</div>"),
  "<p>內容</p>"
);

console.log("article HTML boundary-empty-block assertions passed");
