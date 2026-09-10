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
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    },
  }, { filename: fileURLToPath(new URL(relativePath, import.meta.url)) });
  return exports;
}

const { progressFromDecisions, summaryCopy } = load("../src/lib/report-progress.ts");

const NOW = new Date("2026-09-10T09:00:00Z");
const daysAgo = (n) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

// PostgREST hands these back newest decision first, so the fixtures do too.
function decision({ id, status, reviewedAt, reviewer = { full_name: "Kosal Phal" } }) {
  return {
    id,
    title: `Report ${id}`,
    type: "monthly",
    budget_period: "annual",
    status,
    period_month: 8,
    period_year: 2026,
    reviewed_at: reviewedAt,
    reviewer,
  };
}

test("an approval stops being news after a fortnight", () => {
  const rows = [
    decision({ id: "fresh", status: "reviewed", reviewedAt: daysAgo(13) }),
    decision({ id: "stale", status: "reviewed", reviewedAt: daysAgo(15) }),
  ];
  assert.deepEqual(
    progressFromDecisions(rows, NOW).map((r) => r.id),
    ["fresh"]
  );
});

test("a rejection never goes stale — it is work still waiting", () => {
  const rows = [decision({ id: "old", status: "rejected", reviewedAt: daysAgo(90) })];
  assert.equal(progressFromDecisions(rows, NOW).length, 1);
});

test("rejections come first, and recency survives inside each group", () => {
  const rows = [
    decision({ id: "approved-new", status: "reviewed", reviewedAt: daysAgo(1) }),
    decision({ id: "sent-back-new", status: "rejected", reviewedAt: daysAgo(2) }),
    decision({ id: "approved-old", status: "reviewed", reviewedAt: daysAgo(3) }),
    decision({ id: "sent-back-old", status: "rejected", reviewedAt: daysAgo(4) }),
  ];
  assert.deepEqual(
    progressFromDecisions(rows, NOW).map((r) => r.id),
    ["sent-back-new", "sent-back-old", "approved-new", "approved-old"]
  );
});

test("a decision outlives the profile of whoever made it", () => {
  const rows = [
    decision({ id: "a", status: "rejected", reviewedAt: daysAgo(1), reviewer: null }),
  ];
  assert.equal(progressFromDecisions(rows, NOW)[0].decidedBy, "a reviewer");
});

test("database naming does not reach the component", () => {
  const [row] = progressFromDecisions(
    [decision({ id: "a", status: "rejected", reviewedAt: daysAgo(1) })],
    NOW
  );
  assert.deepEqual(Object.keys(row).sort(), [
    "budgetPeriod", "decidedBy", "id", "month", "status", "title", "type", "year",
  ]);
});

const progress = (statuses) =>
  progressFromDecisions(
    statuses.map((status, index) =>
      decision({ id: `r${index}`, status, reviewedAt: daysAgo(1) })
    ),
    NOW
  );

test("one rejection is spoken about in the singular", () => {
  const { tone, title, description } = summaryCopy(progress(["rejected"]));
  assert.equal(tone, "sent-back");
  assert.equal(title, "A report has been sent back to you");
  assert.match(description, /edit it and submit it again/);
});

test("several rejections are counted in the heading", () => {
  const { title } = summaryCopy(progress(["rejected", "rejected", "rejected"]));
  assert.equal(title, "3 reports have been sent back to you");
});

test("a rejection outranks approvals sitting beside it", () => {
  const { tone, title } = summaryCopy(progress(["reviewed", "rejected", "reviewed"]));
  assert.equal(tone, "sent-back");
  assert.equal(title, "A report has been sent back to you");
});

test("approvals alone are told as good news, and agree in number", () => {
  const one = summaryCopy(progress(["reviewed"]));
  assert.equal(one.tone, "approved");
  assert.equal(one.title, "Your report was approved");
  assert.match(one.description, /it has been counted/);

  const two = summaryCopy(progress(["reviewed", "reviewed"]));
  assert.equal(two.title, "Your reports were approved");
  assert.match(two.description, /they have been counted/);
});
