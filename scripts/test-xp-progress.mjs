import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/utils/xpProgress.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(exports,module){${output}})(module.exports,module);`, { module });
const { calculateXpProgress, getXpSegmentFill, XP_SEGMENT_COUNT } = module.exports;

assert.equal(XP_SEGMENT_COUNT, 12);
assert.equal(calculateXpProgress(undefined, 0), null);
assert.equal(calculateXpProgress(null, 0), null);
assert.equal(calculateXpProgress(1, null), null);
assert.equal(calculateXpProgress(1, -1), null);
assert.deepEqual({ ...calculateXpProgress(0, 0) }, { level: 0, totalXp: 0, currentXp: 0, requiredXp: 100, remainingXp: 100, progress: 0 });
assert.deepEqual({ ...calculateXpProgress(1, 100) }, { level: 1, totalXp: 100, currentXp: 0, requiredXp: 300, remainingXp: 300, progress: 0 });
assert.deepEqual({ ...calculateXpProgress(1, 250) }, { level: 1, totalXp: 250, currentXp: 150, requiredXp: 300, remainingXp: 150, progress: 0.5 });
assert.deepEqual({ ...calculateXpProgress(1, 400) }, { level: 1, totalXp: 400, currentXp: 300, requiredXp: 300, remainingXp: 0, progress: 1 });
assert.equal(getXpSegmentFill(0.5, 5), 1);
assert.equal(getXpSegmentFill(0.5, 6), 0);
assert.equal(getXpSegmentFill(0.125, 1), 0.5);
assert.equal(getXpSegmentFill(2, 11), 1);
assert.equal(getXpSegmentFill(-1, 0), 0);
console.log("retro XP progress regression: PASS (14 assertions)");
