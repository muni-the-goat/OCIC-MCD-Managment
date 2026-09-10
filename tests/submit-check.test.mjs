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
const { buildSubmitCheck } = load("../src/lib/submit-check.ts", {
  "@/lib/types": types,
});

const filed = (over = {}) => ({
  id: "existing",
  title: "Digital — July 2026",
  type: "budget",
  budget_period: "monthly",
  period_month: 8,
  period_year: 2026,
  ...over,
});

const check = (over = {}) =>
  buildSubmitCheck({
    type: "budget",
    budgetPeriod: "monthly",
    month: 8,
    year: 2026,
    title: "Digital — August 2026",
    monthTotal: 2193.99,
    filed: [],
    currentReportId: null,
    locked: true,
    ...over,
  });

test("the month it will be filed under is stated, not the title's month", () => {
  const result = check({ title: "Digital — July 2026", month: 8 });
  assert.equal(result.period, "August 2026");
  assert.equal(result.title, "Digital — July 2026");
});

test("the month's figure is shown as money", () => {
  assert.equal(check().amount, "$2,193.99");
});

test("an activity report has no figure to show", () => {
  assert.equal(check({ type: "monthly", monthTotal: null }).amount, null);
});

test("a month already used by this author is flagged", () => {
  const result = check({ filed: [filed()] });
  assert.equal(result.duplicate?.title, "Digital — July 2026");
});

test("editing a report is not a duplicate of itself", () => {
  const result = check({ filed: [filed({ id: "me" })], currentReportId: "me" });
  assert.equal(result.duplicate, null);
});

test("a different month, year, or kind of report is not a duplicate", () => {
  assert.equal(check({ filed: [filed({ period_month: 7 })] }).duplicate, null);
  assert.equal(check({ filed: [filed({ period_year: 2025 })] }).duplicate, null);
  assert.equal(check({ filed: [filed({ type: "monthly" })] }).duplicate, null);
});

test("an annual budget report is matched on its year alone", () => {
  // period_month is parked at 1 for an annual report, so comparing months
  // would make every annual report a duplicate of every other.
  const result = check({
    budgetPeriod: "annual",
    month: 1,
    filed: [filed({ budget_period: "annual", period_month: 1 })],
  });
  assert.equal(result.period, "FY 2026");
  assert.equal(result.duplicate?.id, "existing");
});

test("a report of nothing at all is worth a second look", () => {
  assert.equal(check({ monthTotal: 0 }).empty, true);
  assert.equal(check({ monthTotal: 0.01 }).empty, false);
  // An activity report carries no figures, so it is never "empty" this way.
  assert.equal(check({ type: "monthly", monthTotal: null }).empty, false);
});

test("the lock warning follows the author's own permission", () => {
  assert.equal(check({ locked: false }).locked, false);
  assert.equal(check().locked, true);
});
