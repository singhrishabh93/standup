import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { copy } from "./clipboard.js";
import { render } from "./format.js";
import { collect, expandHome } from "./git.js";
import { startMcp } from "./mcp.js";
import { resolvePeriod } from "./period.js";
import { DEFAULT_MODEL, aiStandup, rawStandup } from "./summary.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

const HELP = `standup ${version} — your daily standup, written from your git commits

usage
  standup [folders...] [options]
  standup mcp [folders...]          run as an MCP server for Claude, Cursor...

options
  -s, --since <when>   yesterday (default, Friday on Mondays), today, week,
                       or any git date: "3 days ago", 2026-10-01
  -w, --week           same as --since week
  -t, --today          same as --since today
  -a, --author <who>   whose commits (default: your git email; "all" for everyone)
  -d, --depth <n>      how deep to look for repos (default 3)
      --slack          format for Slack
      --md             format as Markdown
      --json           raw data and the standup as JSON
      --raw            skip AI, list the commits as they are
  -c, --copy           copy the result to the clipboard
      --model <name>   Gemini model (default ${DEFAULT_MODEL})
  -h, --help
  -v, --version

folders default to $STANDUP_DIRS (separated by "${path.delimiter}") or the current folder.
set GEMINI_API_KEY for an AI-written summary: https://aistudio.google.com/apikey

examples
  standup ~/code
  standup --week --slack --copy
  standup ~/work ~/side-projects --since "2 days ago"`;

function defaultDirs(positionals) {
  if (positionals.length) return positionals.map(expandHome);
  const env = process.env.STANDUP_DIRS;
  if (env) return env.split(path.delimiter).filter(Boolean).map(expandHome);
  return [process.cwd()];
}

export async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      since: { type: "string", short: "s" },
      week: { type: "boolean", short: "w" },
      today: { type: "boolean", short: "t" },
      author: { type: "string", short: "a" },
      depth: { type: "string", short: "d" },
      slack: { type: "boolean" },
      md: { type: "boolean" },
      json: { type: "boolean" },
      raw: { type: "boolean" },
      copy: { type: "boolean", short: "c" },
      model: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  if (values.help) return console.log(HELP);
  if (values.version) return console.log(version);

  const depth = values.depth ? Number(values.depth) : 3;
  if (!Number.isInteger(depth) || depth < 0) throw new Error("--depth must be a whole number");

  if (positionals[0] === "mcp") {
    return startMcp({ dirs: defaultDirs(positionals.slice(1)), depth, version });
  }

  const dirs = defaultDirs(positionals);
  const period = resolvePeriod(values.week ? "week" : values.today ? "today" : values.since);
  const { scanned, repos } = await collect({ dirs, since: period.since, author: values.author, depth });

  const where = dirs.map((d) => d.replace(os.homedir(), "~")).join(", ");
  if (!scanned) throw new Error(`no git repos found in ${where} (try a parent folder or --depth)`);
  if (!repos.length) {
    console.log(`no commits ${period.label} in ${scanned} repo${scanned === 1 ? "" : "s"} under ${where}`);
    return;
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = values.model || process.env.STANDUP_MODEL || DEFAULT_MODEL;
  const useAi = Boolean(key) && !values.raw;
  let standup;
  if (useAi) {
    try {
      standup = await aiStandup(repos, { label: period.label, key, model });
    } catch (err) {
      console.error(`standup: AI summary failed, listing commits instead (${err.message})`);
      standup = rawStandup(repos);
    }
  } else {
    standup = rawStandup(repos);
  }

  const format = values.slack ? "slack" : values.md ? "md" : "text";
  const color = format === "text" && process.stdout.isTTY && !process.env.NO_COLOR;
  const output = values.json
    ? JSON.stringify({ period: period.label, since: period.since, repos, standup }, null, 2)
    : render(standup, period, { format });
  console.log(color ? render(standup, period, { format, color }) : output);

  if (values.copy) {
    const ok = await copy(output);
    console.error(ok ? "\ncopied to clipboard" : "\ncouldn't reach the clipboard");
  }

  if (process.stderr.isTTY && !values.json) {
    const commits = repos.reduce((n, r) => n + r.commits.length, 0);
    const how = useAi ? model : "no AI (set GEMINI_API_KEY for a written summary)";
    console.error(`\x1b[2m\n${repos.length} of ${scanned} repos · ${commits} commits · ${how}\x1b[0m`);
  }
}
