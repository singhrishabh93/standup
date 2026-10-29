# standup

your daily standup, written from your git commits.

```sh
npx standup-ai ~/code
```

```
since friday
  shop-app
    • Checkout remembers the last UPI app you paid with
    • Fixed the cart badge not updating after login
  api
    • Rate limiting on the OTP endpoint

today
  shop-app
    • Finishing the order history screen on feat/order-history

blockers
  • none
```

- finds every git repo in the folders you give it (3 levels deep)
- reads only your commits (matched by each repo's `user.email`), the branch you're on and fresh uncommitted changes
- on Mondays "yesterday" means since Friday
- with `GEMINI_API_KEY` set, Gemini rewrites the commits into plain sentences; without it you get a clean list of commits
- zero dependencies, node 18+

## options

```
standup [folders...] [options]

-s, --since <when>   yesterday (default), today, week, or any git date: "3 days ago", 2026-10-01
-w, --week           same as --since week
-t, --today          same as --since today
-a, --author <who>   whose commits (default: your git email; "all" for everyone)
-d, --depth <n>      how deep to look for repos (default 3)
    --slack          format for Slack
    --md             format as Markdown
    --json           raw data and the standup as JSON
    --raw            skip AI, list the commits as they are
-c, --copy           copy the result to the clipboard
    --model <name>   Gemini model (default gemini-2.5-flash)
```

Folders default to `$STANDUP_DIRS` (separated by `:`) or the current folder. Get a Gemini key at https://aistudio.google.com/apikey.

## use it from Claude, Cursor or any MCP client

`standup mcp` runs an MCP server over stdio with two tools, `get_activity` and `list_repos`, and a `standup` prompt. Your assistant reads the activity and writes the update itself, so no API key is needed.

Claude Code:

```sh
claude mcp add standup -- npx -y standup-ai mcp ~/code
```

Claude Desktop (`claude_desktop_config.json`) or Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "standup": {
      "command": "npx",
      "args": ["-y", "standup-ai", "mcp", "~/code"]
    }
  }
}
```

Then ask "what did I ship this week?" or "write my standup".

## privacy

Everything runs on your machine. Only commit messages and changed file names are sent, and only to Gemini when you set a key. `--raw` and the MCP server send nothing anywhere.

## develop

```sh
npm test                 # cli tests
node bin/standup.js ~/code --raw
cd site && npm install && npm run dev   # landing page
```

built by Rishabh Singh — https://www.rishabhsingh.tech
