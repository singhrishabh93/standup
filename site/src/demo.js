// Sample runs for the terminal demo. Each line is [style, text].

export const RUNS = [
  {
    tab: "standup",
    command: "npx standup-ai ~/code",
    lines: [
      ["h", "since friday"],
      ["repo", "  shop-app"],
      ["", "    • Checkout remembers the last UPI app you paid with"],
      ["", "    • Fixed the cart badge not updating after login"],
      ["repo", "  api"],
      ["", "    • Rate limiting on the OTP endpoint"],
      ["", "    • Order emails now go through a queue and retry on failure"],
      ["", ""],
      ["h", "today"],
      ["repo", "  shop-app"],
      ["", "    • Finishing the order history screen on feat/order-history"],
      ["", ""],
      ["h", "blockers"],
      ["", "  • none"],
      ["", ""],
      ["dim", "2 of 14 repos · 11 commits · gemini-2.5-flash"],
    ],
  },
  {
    tab: "--week",
    command: "npx standup-ai ~/code --week",
    lines: [
      ["h", "this week"],
      ["repo", "  shop-app"],
      ["", "    • Shipped UPI checkout with saved payment apps"],
      ["", "    • New onboarding with phone login and OTP autofill"],
      ["", "    • Crash reporting through Crashlytics"],
      ["repo", "  api"],
      ["", "    • Rate limiting and audit logs for auth endpoints"],
      ["", "    • Moved order emails to a retrying queue"],
      ["repo", "  landing"],
      ["", "    • Pricing page and store badges"],
      ["", ""],
      ["h", "next"],
      ["repo", "  shop-app"],
      ["", "    • Order history screen, 6 files in progress"],
      ["", ""],
      ["h", "blockers"],
      ["", "  • Waiting on Razorpay live keys for the payments release"],
      ["", ""],
      ["dim", "3 of 14 repos · 38 commits · gemini-2.5-flash"],
    ],
  },
  {
    tab: "--slack",
    command: "npx standup-ai ~/code --slack --copy",
    lines: [
      ["", "*Since friday*"],
      ["", "`shop-app`"],
      ["", "• Checkout remembers the last UPI app you paid with"],
      ["", "• Fixed the cart badge not updating after login"],
      ["", "`api`"],
      ["", "• Rate limiting on the OTP endpoint"],
      ["", ""],
      ["", "*Today*"],
      ["", "• Finishing the order history screen on feat/order-history"],
      ["", ""],
      ["", "*Blockers*"],
      ["", "• none"],
      ["", ""],
      ["ok", "copied to clipboard"],
    ],
  },
];

export const MCP_SETUPS = [
  {
    tab: "Claude Code",
    hint: "run once in your terminal",
    code: "claude mcp add standup -- npx -y standup-ai mcp ~/code",
  },
  {
    tab: "Claude Desktop",
    hint: "Settings → Developer → Edit config",
    code: `{
  "mcpServers": {
    "standup": {
      "command": "npx",
      "args": ["-y", "standup-ai", "mcp", "~/code"]
    }
  }
}`,
  },
  {
    tab: "Cursor",
    hint: "~/.cursor/mcp.json",
    code: `{
  "mcpServers": {
    "standup": {
      "command": "npx",
      "args": ["-y", "standup-ai", "mcp", "~/code"]
    }
  }
}`,
  },
];

export const OPTIONS = [
  ["-s, --since <when>", "yesterday (default, Friday on Mondays), today, week, or any git date like \"3 days ago\""],
  ["-w, --week", "the last 7 days"],
  ["-t, --today", "just today"],
  ["-a, --author <who>", "whose commits. Your git email by default, \"all\" for everyone"],
  ["--slack, --md, --json", "output for Slack, Markdown, or scripts"],
  ["-c, --copy", "copy the result to your clipboard"],
  ["--raw", "skip AI and list the commits as they are"],
  ["-d, --depth <n>", "how deep to look for repos (default 3)"],
];
