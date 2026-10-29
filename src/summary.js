// Builds the standup: done / next / blockers. With a Gemini key the commits
// are rewritten into plain language; without one they're listed as they are.

export const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_COMMITS = 400;

const SYSTEM = `You write a software developer's standup update from their git activity.

- done: what they got done, as a few plain-language items per repo. Merge related commits into one item (five "fix lint" commits are one item). Describe what changed for the product or the team, not file names. No commit hashes.
- next: what they are likely working on next, only from evidence in the data: uncommitted files, the current branch name, WIP or TODO commits. Return an empty list if there is no evidence.
- blockers: only when commits clearly point to one (a revert, "blocked", "waiting on", a flaky test). Otherwise an empty list.

Each item is one short sentence, under 15 words, no emoji, no trailing period. Never invent work that is not in the data.`;

const ITEM = {
  type: "OBJECT",
  properties: { repo: { type: "STRING" }, text: { type: "STRING" } },
  required: ["repo", "text"],
};

const SCHEMA = {
  type: "OBJECT",
  properties: {
    done: { type: "ARRAY", items: ITEM },
    next: { type: "ARRAY", items: ITEM },
    blockers: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["done", "next", "blockers"],
};

// Plain-text view of the activity. Also what the MCP server hands to Claude.
export function describeActivity(repos, label) {
  let budget = MAX_COMMITS;
  const parts = [`period: ${label}`];
  for (const r of repos) {
    parts.push(`\n## ${r.name}${r.branch ? ` (on branch ${r.branch})` : ""}`);
    for (const c of r.commits) {
      if (budget-- <= 0) break;
      parts.push(`- ${c.date.slice(0, 16).replace("T", " ")} ${c.subject}`);
      if (c.body) parts.push(`  ${c.body.replace(/\s*\n\s*/g, " / ")}`);
    }
    if (r.uncommitted.length) {
      const shown = r.uncommitted.slice(0, 8).join(", ");
      const more = r.uncommitted.length > 8 ? ` and ${r.uncommitted.length - 8} more` : "";
      parts.push(`- uncommitted changes: ${shown}${more}`);
    }
  }
  return parts.join("\n");
}

export function rawStandup(repos) {
  const done = [];
  const next = [];
  for (const r of repos) {
    for (const c of r.commits) done.push({ repo: r.name, text: c.subject });
    if (r.uncommitted.length) {
      const files = r.uncommitted.length === 1 ? "1 file" : `${r.uncommitted.length} files`;
      const on = r.branch ? ` on ${r.branch}` : "";
      next.push({ repo: r.name, text: `uncommitted changes in ${files}${on}` });
    }
  }
  return { done, next, blockers: [] };
}

export async function aiStandup(repos, { label, key, model = DEFAULT_MODEL }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: describeActivity(repos, label) }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let detail = body.slice(0, 200);
    try {
      detail = JSON.parse(body).error?.message?.split(". ")[0] ?? detail;
    } catch {
      // not JSON, keep the raw text
    }
    throw new Error(`Gemini returned HTTP ${res.status}: ${detail}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const parsed = JSON.parse(text);
  return {
    done: parsed.done ?? [],
    next: parsed.next ?? [],
    blockers: parsed.blockers ?? [],
  };
}
