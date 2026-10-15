# easy-compact

easy-compact shows what your Claude Code session costs while you work, and tells you when to compact. It adds an **Easy Compact bar** above the chat input and an **Easy Compact pane**.

- **Bar**: this session's cost, context size, cache time left and plan limits, with one button that says when it's time to compact.
- **Pane**: what each question and request cost, the context over time, the compact range that costs least for this session, and what earlier compacts saved.
- **Save & compact**: one click asks Claude to save what isn't written down yet, then runs `/compact`. **Compact now** runs `/compact` straight away.
- **Optional**: today's and this month's usage across all your sessions.

Costs are estimates from Anthropic's published API prices, worked out on your computer.

easy-compact is a Claude Code mod (`modules` in `hooks/hooks.json`), so it runs only in Claude Code: the desktop app's Code tab and the terminal. It needs Claude Code 2.1.295 or later.

## What it reads

- Claude Code's session records on this computer (`~/.claude/projects`), to count tokens and costs. Other sessions' records (token counts only) are read only while the today and this month option is on or the pane's Detailed view is open.
- Claude Code's settings files, only for the prompt-cache lifetime (`promptCacheTtl`).
- Environment variables, only these: where Claude Code's folders are (`HOME`, `USERPROFILE`, `APPDATA`, `CLAUDE_CONFIG_DIR`), the language (`EASY_COMPACT_LANG`, `LANG`, `LC_ALL`, `LC_MESSAGES`), where Claude Code's own command is (`CLAUDE_CODE_EXECPATH`) and the prompt-cache lifetime (`CLAUDE_CODE_PROMPT_CACHE_TTL`, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`). It reads no keys or login tokens.
- Claude Code's plugin records (`~/.claude/plugins`), to show its own version and whether a newer one has been downloaded.

## What it runs, and why

- **Node.js**, with three scripts from this plugin's `tools/` folder: `scan-transcript.mjs` reads session records too large to load whole, `last-ttl.mjs` measures the cache lifetime from the end of a record, and `scan-spend.mjs` adds up today and this month. They read files on this computer and print numbers; they don't connect anywhere. They need Node.js 14.8 or later. Without it those parts are skipped, and the pane says so.
- **Claude Code's own `claude` command**, only when you press **Check for updates** (`claude plugin marketplace update easy-compact`) or **Update** (`claude plugin update easy-compact@easy-compact`). Claude Code then fetches this repository from GitHub. These buttons don't appear when you installed from Anthropic's directory.
- **`/compact`**, in your session, only when you press **Save & compact** (after Claude answers the save message) or **Compact now**.

## What it sends

- easy-compact itself sends nothing over the network: no telemetry and no requests of its own. Everything it measures stays on your computer.
- **Save & compact** sends one message to Claude in your session, as part of your normal conversation. The message asks Claude to check what compacting would lose, to save decisions, progress and next steps that aren't in files yet (memory, work notes), and to reply with what to do next. It includes the text you set in Settings under Compact text. The text you set for "after /compact" is added to the `/compact` command as instructions for the summary.

## What it writes

- Its settings, to Claude Code's plugin store on this computer.
- Each session's question history (question text, cost, the end of each answer) and its own small caches, to its data folder under `~/.claude/plugins/data`.
- The `promptCacheTtl` line in your Claude Code user settings, only when you pick a cache lifetime yourself in Settings (Custom screen). Nothing else in your settings.

## What its hooks do

The hooks watch and draw. They never change Claude's permissions, your prompts, tool calls or tool results.

- `session.start`, `turn.start`, `turn.step`, `turn.complete`, `session.measure` and `session.compact`: read token counts and timings to keep the costs and the context size up to date.
- `agent.spawn`: notes a subagent's task name so its cost is added to the question that started it. The launch is passed on unchanged.
- `prompt.suggest`: notes that Claude Code made its own suggestion request, so that cost is labelled. Passed on unchanged.
- `ui.render`, `ui.message`, `ui.close`: draw the bar, the pane, the cost chip under answers, the running cost next to the working indicator and the folded bar's button, and handle their buttons.
- `command.run` for `/easy-compact`: its own command (open the pane, show or hide the bar, settings).

In the code, "tokens" always means model tokens (context size and request counts), never credentials, and `http://www.w3.org/2000/svg` is the SVG namespace name inside drawn icons, not an address it contacts.

## Install

Add it from Anthropic's directory on claude.ai, and Claude Code picks it up the next time it starts. Or install it in Claude Code from the repository's own marketplace:

```
/plugin install easy-compact --marketplace JaeSeongHa5280/easy-compact
```

Screenshots and every setting: <https://github.com/JaeSeongHa5280/easy-compact>. 한국어 설명: <https://github.com/JaeSeongHa5280/easy-compact/blob/main/README.ko.md>
