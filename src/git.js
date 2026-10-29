// Finds git repos under a few folders and reads what you did in each: your
// commits in the window, the branch you're on and any uncommitted work.

import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { gitDate } from "./period.js";

const run = promisify(execFile);

const SKIP = new Set(["node_modules", "build", "dist", "out", "target", "vendor", "Pods", ".dart_tool"]);
const FIELD = "\x1f";
const RECORD = "\x1e";
const MAX_BODY = 400;

async function git(repo, args) {
  const { stdout } = await run("git", ["-C", repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
  return stdout;
}

async function tryGit(repo, args) {
  try {
    return (await git(repo, args)).trim();
  } catch {
    return "";
  }
}

export const expandHome = (p) => (p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p);

export async function findRepos(roots, depth = 3) {
  const found = new Set();

  async function walk(dir, level) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.name === ".git")) {
      found.add(dir);
      return;
    }
    if (level >= depth) return;
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !SKIP.has(e.name));
    await Promise.all(dirs.map((e) => walk(path.join(dir, e.name), level + 1)));
  }

  for (const root of roots) {
    const abs = path.resolve(expandHome(root));
    const before = found.size;
    await walk(abs, 0);
    // Run from inside a repo's subfolder: use the repo it belongs to.
    if (found.size === before) {
      const top = await tryGit(abs, ["rev-parse", "--show-toplevel"]);
      if (top) found.add(top);
    }
  }
  return [...found].sort();
}

// Uncommitted paths, newest edit first, so "next" can mention fresh work only.
async function dirtyFiles(repo) {
  const out = await tryGit(repo, ["status", "--porcelain"]);
  if (!out) return [];
  const files = out.split("\n").map((line) => {
    const name = line.slice(3).split(" -> ").pop().replace(/^"|"$/g, "");
    return name;
  });
  const withTimes = await Promise.all(
    files.slice(0, 200).map(async (name) => {
      try {
        return { name, mtime: (await stat(path.join(repo, name))).mtime };
      } catch {
        return { name, mtime: new Date(0) }; // deleted file
      }
    })
  );
  return withTimes.sort((a, b) => b.mtime - a.mtime);
}

export async function repoActivity(repo, { since, author }) {
  const email = author ? "" : await tryGit(repo, ["config", "user.email"]);
  const args = [
    "log", "--all", "--no-merges", `--since=${gitDate(since)}`,
    `--pretty=format:%h${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`,
  ];
  if (author && author !== "all") args.push(`--author=${author}`);
  if (email) args.push("--fixed-strings", `--author=${email}`);

  const [log, branch, dirty] = await Promise.all([
    tryGit(repo, args),
    tryGit(repo, ["branch", "--show-current"]),
    dirtyFiles(repo),
  ]);

  const commits = log
    .split(RECORD)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [hash, date, subject, body = ""] = r.split(FIELD);
      return { hash, date, subject, body: body.trim().slice(0, MAX_BODY) };
    });

  // Uncommitted changes only count when something was touched in the window,
  // so a repo left dirty for months doesn't show up as "today".
  const cutoff = since instanceof Date ? since : null;
  const fresh = cutoff ? dirty.filter((f) => f.mtime >= cutoff) : commits.length ? dirty : [];

  return {
    name: path.basename(repo),
    path: repo,
    branch,
    commits,
    uncommitted: fresh.map((f) => f.name),
  };
}

export async function collect({ dirs, since, author, depth }) {
  const repos = await findRepos(dirs, depth);
  const all = await Promise.all(repos.map((r) => repoActivity(r, { since, author })));
  return {
    scanned: repos.length,
    repos: all.filter((r) => r.commits.length || r.uncommitted.length),
  };
}
