import assert from "node:assert/strict";
import { getElapsedLearningDays, getTaipeiDateKey } from "../lib/learningDays.ts";

assert.equal(getTaipeiDateKey(new Date("2026-08-01T15:59:59Z")), "2026-08-01");
assert.equal(getTaipeiDateKey(new Date("2026-08-01T16:00:00Z")), "2026-08-02");
assert.equal(getElapsedLearningDays("2026-07-16", "2026-08-02"), 18);
assert.equal(getElapsedLearningDays("2026-08-02", "2026-08-02"), 1);
assert.equal(getElapsedLearningDays(null, "2026-08-02"), 0);
assert.equal(getElapsedLearningDays("invalid", "2026-08-02"), 0);

console.log("learning day assertions passed");
