// Turns "yesterday", "today", "week" or any git date ("3 days ago",
// "2026-10-01") into the start of the window and the heading to show for it.

const startOfDay = (d, back = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);

export function resolvePeriod(when = "yesterday", now = new Date()) {
  switch (when) {
    case "today":
      return { since: startOfDay(now), label: "today", next: "next" };
    case "yesterday": {
      // On a Monday (or over the weekend) the last working day was Friday.
      const day = now.getDay();
      const back = day === 1 ? 3 : day === 0 ? 2 : 1;
      return {
        since: startOfDay(now, back),
        label: back === 1 ? "yesterday" : "since friday",
        next: "today",
      };
    }
    case "week":
      return { since: startOfDay(now, 7), label: "this week", next: "next" };
    default:
      return { since: when, label: `since ${when}`, next: "next" };
  }
}

// git accepts both an ISO date and its own relative formats.
export const gitDate = (since) => (since instanceof Date ? since.toISOString() : since);
