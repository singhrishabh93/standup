// Renders a standup as plain text, Slack or Markdown. With more than one repo,
// items are grouped under the repo name.

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const STYLES = {
  text: {
    title: (t, color) => (color ? `\x1b[1m${t}\x1b[0m` : t),
    repo: (r, color) => (color ? `  \x1b[36m${r}\x1b[0m` : `  ${r}`),
    item: (t, nested) => `${nested ? "    " : "  "}• ${t}`,
  },
  slack: {
    title: (t) => `*${cap(t)}*`,
    repo: (r) => `\`${r}\``,
    item: (t) => `• ${t}`,
  },
  md: {
    title: (t) => `**${cap(t)}**`,
    repo: (r) => `- **${r}**`,
    item: (t, nested) => `${nested ? "  " : ""}- ${t}`,
  },
};

function groupByRepo(items) {
  const groups = new Map();
  for (const { repo, text } of items) {
    if (!groups.has(repo)) groups.set(repo, []);
    groups.get(repo).push(text);
  }
  return groups;
}

export function render(standup, period, { format = "text", color = false } = {}) {
  const style = STYLES[format] ?? STYLES.text;
  const multi = new Set([...standup.done, ...standup.next].map((i) => i.repo)).size > 1;

  const section = (title, items) => {
    const lines = [style.title(title, color)];
    if (!multi) {
      lines.push(...items.map((i) => style.item(i.text ?? i, false)));
    } else {
      for (const [repo, texts] of groupByRepo(items)) {
        lines.push(style.repo(repo, color), ...texts.map((t) => style.item(t, true)));
      }
    }
    return lines.join("\n");
  };

  const out = [];
  if (standup.done.length) out.push(section(period.label, standup.done));
  if (standup.next.length) out.push(section(period.next, standup.next));
  const blockers = standup.blockers.length ? standup.blockers : ["none"];
  out.push([style.title("blockers", color), ...blockers.map((b) => style.item(b, false))].join("\n"));
  return out.join("\n\n");
}
