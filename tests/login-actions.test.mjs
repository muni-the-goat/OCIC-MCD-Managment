import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Execute the actual action with only its external boundaries replaced. No
// test signs in against Supabase or writes to the office's throttle table.
function load(relativePath, imports) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    crypto: globalThis.crypto,
    require: (name) => {
      if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
      return imports[name];
    },
  }, { filename: fileURLToPath(new URL(relativePath, import.meta.url)) });
  return exports;
}

const rules = load("../src/lib/login-rules.ts", {});

function setup({ failures = 0, response, throws = false } = {}) {
  const calls = { signIn: 0, recorded: 0, cleared: 0 };
  const action = load("../src/app/login/actions.ts", {
    "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
    zod: require("zod"),
    "@/lib/login-rules": rules,
    "@/lib/login-throttle": {
      MAX_FAILURES: 8,
      LOCKED_MESSAGE: "Wait 15 minutes or ask for a reset.",
      attemptKey: async (email) => ({ email, ip: "test" }),
      recentFailures: async () => failures + calls.recorded,
      recordFailure: async () => { calls.recorded++; },
      clearFailures: async () => { calls.cleared++; },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({ auth: {
        signInWithPassword: async () => {
          calls.signIn++;
          if (throws) throw new Error("Private network diagnostic");
          return response ?? {
            data: { user: { id: "test-user" }, session: { access_token: "not-for-the-client" } },
            error: null,
          };
        },
      } }),
    },
  });
  return { login: action.login, calls };
}

function form({ email = "preview@ocic.com.kh", password = "test-only", next } = {}) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  if (next !== undefined) data.set("next", next);
  return data;
}

test("invalid input is rejected before authentication", async () => {
  for (const input of [
    { email: "" }, { password: "" }, { email: "not-an-email" }, { email: "preview@example.com" },
  ]) {
    const { login, calls } = setup();
    const result = await login(form(input));
    assert.equal(result.status, "error");
    assert.equal(calls.signIn, 0);
  }
});

test("incorrect credentials give retryable feedback and each attempt gets a new id", async () => {
  const { login, calls } = setup({ response: { data: {}, error: { status: 400, message: "Invalid login credentials" } } });
  const first = await login(form());
  const second = await login(form());
  assert.equal(first.status, "error");
  assert.equal(first.field, "credentials");
  assert.match(first.message, /email or password is incorrect/);
  assert.notEqual(first.id, second.id);
  assert.equal(calls.recorded, 2);
  assert.equal(calls.cleared, 0);
});

test("locked attempts stop before Auth and the eighth failure changes the message", async () => {
  const locked = setup({ failures: 8 });
  assert.match((await locked.login(form())).message, /Wait 15 minutes/);
  assert.equal(locked.calls.signIn, 0);
  const eighth = setup({ failures: 7, response: { data: {}, error: { status: 400 } } });
  assert.match((await eighth.login(form())).message, /Wait 15 minutes/);
});

test("Auth rate limiting is not described as incorrect credentials", async () => {
  const { login } = setup({ response: { data: {}, error: { status: 429 } } });
  assert.match((await login(form())).message, /Wait 15 minutes/);
});

test("service errors and exceptions never report success or expose diagnostics", async () => {
  for (const options of [
    { throws: true },
    { response: { data: {}, error: { status: 503, message: "Private diagnostic" } } },
  ]) {
    const { login, calls } = setup(options);
    const result = await login(form());
    assert.equal(result.status, "error");
    assert.doesNotMatch(result.message, /Private/);
    assert.equal(calls.recorded, 0);
    assert.equal(calls.cleared, 0);
  }
});

test("success requires both the authenticated user and session", async () => {
  for (const data of [{ user: null, session: {} }, { user: {}, session: null }]) {
    const { login, calls } = setup({ response: { data, error: null } });
    assert.equal((await login(form())).status, "error");
    assert.equal(calls.cleared, 0);
  }
});

test("success preserves safe destinations, clears failures, and returns no credentials", async () => {
  const { login, calls } = setup();
  const result = await login(form({ next: "/reports?status=submitted" }));
  assert.equal(result.status, "success");
  assert.equal(result.next, "/reports?status=submitted");
  assert.equal(calls.cleared, 1);
  assert.deepEqual(Object.keys(result).sort(), ["id", "next", "status"]);
});

test("unsafe next destinations fall back to the role-aware dashboard", async () => {
  for (const next of ["//example.com", "/\\example.com", "https://example.com", "javascript:alert(1)"]) {
    const { login } = setup();
    assert.equal((await login(form({ next }))).next, "/dashboard");
  }
});
