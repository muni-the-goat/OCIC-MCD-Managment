import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports }, {
    filename: fileURLToPath(new URL(relativePath, import.meta.url)),
  });
  return exports;
}

const { swapMonthAmounts } = load("../src/lib/budget-months.ts");

// vm.runInNewContext gives the module its own realm, so an array built inside
// it has that realm's Array.prototype and deepStrictEqual refuses to compare it
// with one built out here. Nothing to do with the code under test — this puts
// both sides on the same prototype before comparing.
const plain = (array) => Array.from(array);

// Twelve months, August (index 7) holding the money — the shape the real
// report was in when its month was corrected to July.
const august = () => {
  const amounts = Array(12).fill("");
  amounts[7] = "171.49";
  return amounts;
};

test("the figures follow the month they are filed under", () => {
  const moved = swapMonthAmounts(august(), 8, 7);
  assert.equal(moved[6], "171.49");
  assert.equal(moved[7], "");
});

test("switching back puts everything exactly where it was", () => {
  const before = august();
  const there = swapMonthAmounts(before, 8, 7);
  assert.deepEqual(plain(swapMonthAmounts(there, 7, 8)), plain(before));
});

test("a month that already holds a figure is not overwritten, it changes places", () => {
  const amounts = Array(12).fill("");
  amounts[6] = "100";
  amounts[7] = "200";
  const swapped = swapMonthAmounts(amounts, 8, 7);
  assert.equal(swapped[6], "200");
  assert.equal(swapped[7], "100");
});

test("picking the month it is already on changes nothing", () => {
  const before = august();
  assert.equal(swapMonthAmounts(before, 8, 8), before);
});

test("the original array is never mutated", () => {
  const before = august();
  swapMonthAmounts(before, 8, 7);
  assert.equal(before[7], "171.49");
  assert.equal(before[6], "");
});

test("a month outside the year is refused rather than punching a hole", () => {
  const before = august();
  assert.equal(swapMonthAmounts(before, 8, 13), before);
  assert.equal(swapMonthAmounts(before, 0, 7), before);
});
