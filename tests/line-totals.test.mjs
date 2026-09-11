import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function load(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    Intl,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    },
  }, { filename: fileURLToPath(new URL(relativePath, import.meta.url)) });
  return exports;
}

const types = load("../src/lib/types.ts");
const { lineTotals, reportedMonths } = load("../src/lib/project-reports.ts", {
  "@/lib/types": types,
});

// One row with a figure and a unit count in each named month.
function row(byMonth) {
  const item = { name: "Row", category: "Land" };
  for (let m = 1; m <= 12; m++) {
    const key = `m${String(m).padStart(2, "0")}`;
    const ukey = `u${String(m).padStart(2, "0")}`;
    item[key] = byMonth[m] ?? 0;
    item[ukey] = byMonth[m] ? 1 : 0;
  }
  return item;
}

// Chroy Changvar Bay's sales, as they stood on the morning of 2026-09-11:
// 2026 filed to August, 2025 filed only to June.
const AHEAD = row({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100, 7: 50, 8: 50 });
const BEHIND = row({ 1: 90, 2: 90, 3: 90, 4: 90, 5: 90, 6: 90 });

const JAN_TO_JUN = [0, 1, 2, 3, 4, 5];
const JAN_TO_AUG = [0, 1, 2, 3, 4, 5, 6, 7];

test("the total covers the months it was asked for, not the whole year", () => {
  const { cells, total } = lineTotals([AHEAD], JAN_TO_JUN);
  assert.equal(total.amount, 600, "January to June is 600, not the year's 700");
  assert.equal(
    cells.reduce((sum, c) => sum + c.amount, 0),
    total.amount,
    "the total must be the sum of the cells beside it"
  );
});

test("units follow the same window as the amounts", () => {
  const { cells, total } = lineTotals([AHEAD], JAN_TO_JUN);
  assert.equal(total.units, 6);
  assert.equal(cells.reduce((sum, c) => sum + c.units, 0), total.units);
});

test("a year-on-year pair totals the same window for both years", () => {
  // The shared window is what the comparison table is handed.
  const shared = JAN_TO_JUN;
  const current = lineTotals([AHEAD], shared);
  const previous = lineTotals([BEHIND], shared);
  assert.equal(current.total.amount, 600);
  assert.equal(previous.total.amount, 540);
  // The change a reader computes from the Total column must equal the one they
  // get by adding the Change row across.
  const fromTotals = current.total.amount - previous.total.amount;
  const acrossCells = current.cells.reduce(
    (sum, c, i) => sum + (c.amount - previous.cells[i].amount),
    0
  );
  assert.equal(fromTotals, acrossCells);
});

test("asking for every reported month still gives the year's total", () => {
  // The case every other caller is in — nothing changes for them.
  const { total } = lineTotals([AHEAD], JAN_TO_AUG);
  assert.equal(total.amount, 700);
  assert.equal(total.units, 8);
});

test("reportedMonths and lineTotals agree, which is what kept this hidden", () => {
  const months = reportedMonths([AHEAD]);
  const { cells, total } = lineTotals([AHEAD], months);
  assert.equal(total.amount, cells.reduce((s, c) => s + c.amount, 0));
  assert.equal(total.amount, 700);
});

test("several rows add up across the window", () => {
  const { total } = lineTotals([AHEAD, BEHIND], JAN_TO_JUN);
  assert.equal(total.amount, 600 + 540);
});

test("no months asked for is a total of nothing", () => {
  const { cells, total } = lineTotals([AHEAD], []);
  assert.equal(cells.length, 0);
  assert.equal(total.amount, 0);
  assert.equal(total.units, 0);
});
