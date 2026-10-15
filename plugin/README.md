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
- Claude Code's settings, only the prompt-cache lifetime (`promptCacheTtl`), to show in Settings what sets it. It never changes your Claude Code settings.
- Claude Code's list of this session's subagents (task name and whether it's still running), so a subagent's cost is added to the question that started it.
- Environment variables, only these: where Claude Code's folders are, including the copy of Claude Code inside the desktop app (`HOME`, `USERPROFILE`, `APPDATA`, `CLAUDE_CONFIG_DIR`), the language (`EASY_COMPACT_LANG`, `LANG`, `LC_ALL`, `LC_MESSAGES`), the prompt-cache lifetime (`CLAUDE_CODE_PROMPT_CACHE_TTL`, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`) and, for its own tests only, `EASY_COMPACT_FAKE_INSTALL` (lets the test suite treat a development copy as installed; unset in normal use). It reads no keys or login tokens.
- Claude Code's plugin records (`~/.claude/plugins`), to show its own version, whether a newer one has been downloaded, and what changed in the newer versions (their `CHANGELOG.md`).

## What it runs, and why

- **Node.js**, with three scripts from this plugin's `tools/` folder, for session records over 4 MB (Claude Code's file reader for plugins stops there):
  - `node tools/scan-transcript.mjs <session record>` prints, one line each, every request's token counts, every compact, and the first 200 characters of each of your questions (to rebuild the cost-per-question list).
  - `node tools/last-ttl.mjs <session record>` prints the cache lifetime of the last request (5 or 60 minutes).
  - `node tools/scan-spend.mjs <~/.claude/projects> <its cache file> <start of this month>` prints token totals by day and model for today and this month, and keeps that cache file in its data folder.

  Their arguments are only those file paths and that time. They read files on this computer, print back to easy-compact, and don't connect anywhere. They need Node.js 14.8 or later. Without it those parts are skipped, and the pane says so.
- **Claude Code's own `claude` command** — the one on your PATH, or else the copy inside the Claude desktop app — and only these two, written as fixed text in the code: `claude plugin marketplace update easy-compact` when you press **Check for updates**, and `claude plugin update easy-compact@easy-compact` when you press **Update**. Claude Code then fetches this repository from GitHub. These buttons don't appear when you installed from Anthropic's directory.
- **`/compact`**, in your session, only when you press **Save & compact** (after Claude answers the save message) or **Compact now**.

## What it sends

- easy-compact itself sends nothing over the network: no telemetry and no requests of its own. Everything it measures stays on your computer.
- **Save & compact** sends one message to Claude in your session, as part of your normal conversation. The message asks Claude to check what compacting would lose, to save decisions, progress and next steps that aren't in files yet (memory, work notes), and to reply with what to do next. It includes the text you set in Settings under Compact text. Nothing else goes into it: no text from your conversation or files, and no costs. The text you set for "after /compact" is added to the `/compact` command as instructions for the summary.

## What it writes

- Its settings, to Claude Code's plugin store on this computer.
- Each session's question history (question text, cost, the end of each answer), each session's running cost (so it survives an app restart) and its own small caches, to its data folder under `~/.claude/plugins/data`.
- A troubleshooting file, `debug-<session>.json` in that same folder (this session's pane state and question history), only when you type `/easy-compact dump`.

## What its hooks do

The hooks watch and draw. They never change Claude's permissions, your prompts, tool calls or tool results.

- `session.start`, `turn.start`, `turn.step`, `turn.complete`, `session.measure` and `session.compact`: read token counts and timings to keep the costs and the context size up to date.
- `prompt.suggest`: notes that Claude Code made its own suggestion request, so that cost is labelled. Passed on unchanged.
- `ui.render`, `ui.message`, `ui.close`: draw the bar, the pane, the cost chip under answers, the running cost next to the working indicator and the folded bar's button, and handle their buttons.
- `command.run` for `/easy-compact`: its own command only (show or hide the bar, open the pane, change settings by name, `recent` · `all` for the cost-per-question list, `dump` for the troubleshooting file above, and re-reading the session record when typed alone).

In the code, "tokens" always means model tokens (context size and request counts), never credentials, and `http://www.w3.org/2000/svg` is the SVG namespace name inside drawn icons, not an address it contacts.

## Install

Add it from Anthropic's directory on claude.ai, and Claude Code picks it up the next time it starts. Or install it in Claude Code from the repository's own marketplace:

```
/plugin install easy-compact --marketplace JaeSeongHa5280/easy-compact
```

Screenshots and every setting: <https://github.com/JaeSeongHa5280/easy-compact>. 한국어 설명: <https://github.com/JaeSeongHa5280/easy-compact/blob/main/README.ko.md>
