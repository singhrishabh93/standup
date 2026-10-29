import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { render } from "../src/format.js";
import { collect, findRepos } from "../src/git.js";
import { resolvePeriod } from "../src/period.js";
import { aiStandup, rawStandup } from "../src/summary.js";

test("yesterday reaches back to friday on a monday", () => {
  const monday = new Date(2026, 9, 26, 10);
  const p = resolvePeriod("yesterday", monday);
  assert.equal(p.label, "since friday");
  assert.equal(p.since.getDate(), 23);

  const tuesday = new Date(2026, 9, 27, 10);
  assert.equal(resolvePeriod(undefined, tuesday).since.getDate(), 26);
  assert.equal(resolvePeriod("yesterday", new Date(2026, 9, 25)).since.getDate(), 23); // sunday
});

test("custom periods pass through to git", () => {
  assert.deepEqual(resolvePeriod("3 days ago"), { since: "3 days ago", label: "since 3 days ago", next: "next" });
});

test("render groups by repo only when there are several", () => {
  const period = { label: "yesterday", next: "today" };
  const one = render({ done: [{ repo: "a", text: "did x" }], next: [], blockers: [] }, period);
  assert.equal(one, "yesterday\n  • did x\n\nblockers\n  • none");

  const two = render(
    { done: [{ repo: "a", text: "did x" }, { repo: "b", text: "did y" }], next: [], blockers: ["waiting on api"] },
    period,
    { format: "slack" }
  );
  assert.equal(two, "*Yesterday*\n`a`\n• did x\n`b`\n• did y\n\n*Blockers*\n• waiting on api");
});

test("raw standup lists commits and fresh uncommitted work", () => {
  const s = rawStandup([
    { name: "app", branch: "feat/login", commits: [{ subject: "add login" }], uncommitted: ["a.js", "b.js"] },
  ]);
  assert.deepEqual(s.done, [{ repo: "app", text: "add login" }]);
  assert.deepEqual(s.next, [{ repo: "app", text: "uncommitted changes in 2 files on feat/login" }]);
});

test("ai standup reads gemini's json reply", async (t) => {
  const reply = { done: [{ repo: "app", text: "Shipped login" }], next: [], blockers: [] };
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /gemini-2\.5-flash:generateContent$/);
    assert.equal(init.headers["x-goog-api-key"], "test-key");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] }));
  });
  const repos = [{ name: "app", branch: "main", commits: [{ date: "2026-10-28T10:00:00+05:30", subject: "add login", body: "" }], uncommitted: [] }];
  assert.deepEqual(await aiStandup(repos, { label: "yesterday", key: "test-key" }), reply);
});

test("collects only your commits from repos in a folder", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "standup-"));
  const repo = path.join(root, "work", "app");
  mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
  git("init", "-q");
  git("config", "user.email", "me@example.com");
  git("config", "user.name", "Me");
  git("config", "commit.gpgsign", "false");
  writeFileSync(path.join(repo, "a.txt"), "a");
  git("add", ".");
  git("commit", "-qm", "feat: mine");
  git("-c", "user.email=someone@example.com", "commit", "-q", "--allow-empty", "-m", "feat: theirs");
  writeFileSync(path.join(repo, "b.txt"), "b");

  return Promise.all([findRepos([root]), collect({ dirs: [root], since: resolvePeriod("today").since })]).then(
    ([repos, { scanned, repos: active }]) => {
      assert.deepEqual(repos, [repo]);
      assert.equal(scanned, 1);
      assert.deepEqual(active[0].commits.map((c) => c.subject), ["feat: mine"]);
      assert.deepEqual(active[0].uncommitted, ["b.txt"]);
    }
  );
});
