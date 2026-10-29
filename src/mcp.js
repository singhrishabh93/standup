// A small MCP server over stdio (JSON-RPC, one message per line), so Claude,
// Cursor and other MCP clients can read your git activity and write the
// update themselves. No API key needed in this mode.

import { createInterface } from "node:readline";
import { collect, findRepos } from "./git.js";
import { resolvePeriod } from "./period.js";
import { describeActivity } from "./summary.js";

const PERIOD_HELP =
  'yesterday (default, Friday on Mondays), today, week, or any git date such as "3 days ago" or "2026-10-01"';

const TOOLS = [
  {
    name: "get_activity",
    description:
      "Get the user's git commits and uncommitted work across their local repos for a time window. " +
      "Use it to write a standup or weekly update, or to answer questions like 'what did I ship this week?'.",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: PERIOD_HELP },
        author: { type: "string", description: 'Whose commits. Defaults to the git user.email of each repo; "all" for everyone.' },
        dirs: { type: "array", items: { type: "string" }, description: "Folders to scan. Defaults to the folders the server was started with." },
      },
    },
  },
  {
    name: "list_repos",
    description: "List the git repos the standup server can see.",
    inputSchema: {
      type: "object",
      properties: { dirs: { type: "array", items: { type: "string" } } },
    },
  },
];

const PROMPTS = [
  {
    name: "standup",
    description: "Write my standup from my git commits",
    arguments: [{ name: "since", description: PERIOD_HELP, required: false }],
  },
];

export function startMcp({ dirs, depth, version }) {
  const send = (msg) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);
  const text = (t) => ({ content: [{ type: "text", text: t }] });

  async function callTool(name, args = {}) {
    const scan = args.dirs?.length ? args.dirs : dirs;
    if (name === "list_repos") {
      const repos = await findRepos(scan, depth);
      return text(repos.length ? repos.join("\n") : `No git repos found under ${scan.join(", ")}`);
    }
    if (name === "get_activity") {
      const period = resolvePeriod(args.since || "yesterday");
      const { scanned, repos } = await collect({ dirs: scan, since: period.since, author: args.author, depth });
      if (!repos.length) return text(`No commits ${period.label} in ${scanned} repos under ${scan.join(", ")}.`);
      return text(describeActivity(repos, period.label));
    }
    return { ...text(`Unknown tool: ${name}`), isError: true };
  }

  async function handle(msg) {
    const { id, method, params } = msg;
    switch (method) {
      case "initialize":
        return {
          protocolVersion: params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {}, prompts: {} },
          serverInfo: { name: "standup", version },
        };
      case "ping":
        return {};
      case "tools/list":
        return { tools: TOOLS };
      case "tools/call":
        try {
          return await callTool(params?.name, params?.arguments);
        } catch (err) {
          return { ...text(String(err?.message ?? err)), isError: true };
        }
      case "prompts/list":
        return { prompts: PROMPTS };
      case "prompts/get": {
        const since = params?.arguments?.since || "yesterday";
        return {
          description: "Write my standup",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text:
                  `Call get_activity with since="${since}" and write my standup from it: what I did, ` +
                  "what I'm doing next and any blockers. Short bullets, plain language, grouped by project, no commit hashes.",
              },
            },
          ],
        };
      }
      default:
        if (id === undefined) return undefined; // a notification
        throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
    }
  }

  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    try {
      const result = await handle(msg);
      if (msg.id !== undefined && result !== undefined) send({ id: msg.id, result });
    } catch (err) {
      if (msg.id !== undefined) send({ id: msg.id, error: { code: err.code ?? -32603, message: err.message } });
    }
  });
  console.error(`standup MCP server ${version} ready, scanning ${dirs.join(", ")}`);
}
