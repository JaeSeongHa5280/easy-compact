# easy-compact

easy-compact shows what your Claude Code session costs while you work, and tells you when to compact. It adds an **Easy Compact bar** above the chat input and an **Easy Compact pane**.

- **Bar**: this session's cost, context size, cache time left and plan limits, with one button that says when it's time to compact.
- **Pane**: what each question and request cost, the context over time, the compact range that costs least for this session, and what earlier compacts saved.
- **Easy Compact**: one click asks Claude to save what isn't written down yet, then runs `/compact`. When the cache has gone cold, **Plain compact** runs `/compact` straight away. **Clear** runs `/clear` after you confirm.
- **Easy Auto** (off until you turn it on, per session): when the context passes that session's range (a new session starts at 400k–500k), it does the Easy Compact steps by itself — and if a long task was running, it stops that turn between requests, compacts, then asks Claude to carry on.
- **Optional**: today's and this month's usage across all your sessions, and amounts in won instead of dollars.

Costs are estimates from Anthropic's published API prices, worked out on your computer.

easy-compact is a Claude Code mod (`modules` in `hooks/hooks.json`), so it runs only in Claude Code: the desktop app's Code tab and the terminal. It needs Claude Code 2.1.295 or later.

## What it reads

- Claude Code's session records on this computer (`~/.claude/projects`), to count tokens and costs, and to see which questions ran with Ultracode (Claude Code's on/off mark in this session's record). Other sessions' records (token counts only) are read only while the today and this month option is on or the pane's Detailed view is open.
- Claude Code's context breakdown (the categories `/context` shows: system prompt, tools, instruction files, skills), to estimate how much of the context stays after a compact. Once after each compact, it also reads the instruction files that breakdown lists (your `CLAUDE.md` and memory files) only to count their tokens; the text is not kept, shown or sent.
- Claude Code's settings, only two values: the prompt-cache lifetime (`promptCacheTtl`), to show in Settings what sets it, and the language (`language`), while easy-compact's language is **Auto**. It never changes your Claude Code settings.
- The Claude desktop app's settings file (`config.json` in the app's data folder), only its display language (`locale`), while easy-compact's language is **Auto** and Claude Code's settings name none.
- Claude Code's list of this session's subagents (task name and whether it's still running), so a subagent's cost is added to the question that started it.
- Environment variables, only these: where Claude Code's folders are, including the copy of Claude Code inside the desktop app (`HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `CLAUDE_CONFIG_DIR`), the language (`EASY_COMPACT_LANG`, `LANG`, `LC_ALL`, `LC_MESSAGES`), the prompt-cache lifetime (`CLAUDE_CODE_PROMPT_CACHE_TTL`, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`) and, for its own tests only, `EASY_COMPACT_FAKE_INSTALL` (lets the test suite treat a development copy as installed; unset in normal use). It reads no keys or login tokens.
- Claude Code's plugin records (`~/.claude/plugins`), to show its own version, whether a newer one has been downloaded, and what changed in the newer versions (their `CHANGELOG.md`).
- Your prompt box, only in a session where you turned Easy Auto on and only right before Easy Auto would send its message, run `/compact` or stop a turn: whether it holds text you haven't sent. If it does, Easy Auto waits instead, so it doesn't send over what you're writing. The text itself is not kept, shown or sent.

## What it runs, and why

- **Node.js**, with four scripts from this plugin's `tools/` folder, for session records over 4 MB (Claude Code's file reader for plugins stops there):
  - `node tools/scan-transcript.mjs <session record>` prints, one line each, every request's token counts, every compact, and the first 200 characters of each of your questions (to rebuild the cost-per-question list).
  - `node tools/scan-transcript.mjs <session record> --ultra <byte>` prints `on`, `off` or `none` — whether Claude Code's Ultracode on/off mark last said on or off from that byte of the record to its end — after each question, to mark the questions that ran with Ultracode. It starts where it last stopped, so each run reads only the new part. Smaller records are read the same way inside the plugin.
  - `node tools/last-ttl.mjs <session record>` prints the cache lifetime of the last request (5 or 60 minutes).
  - `node tools/last-compact.mjs <session record> <session id> <time>` prints the last compact marker after that time (its time and sizes), only right after its own `/compact` or when Claude Code's context size goes empty — to tell a real compact from a brief blank.
  - `node tools/scan-spend.mjs <~/.claude/projects> <its cache file> <start of this month> <its data folder>` prints token totals by day and model for today and this month, plus the cost by day of requests that aren't in the session records (compact summaries, Claude Code's own background requests) from its own data folder, and the size of each compact in the session records that easy-compact didn't measure (so their cost can be estimated), and keeps that cache file in its data folder.

  Their arguments are only those file paths, the session id, those times and that byte position. They read files on this computer, print back to easy-compact, and don't connect anywhere. They need Node.js 14.8 or later. Without it those parts are skipped, and the pane says so.
- **Not run by the plugin:** `tools/rate-fit.mjs` is a manual check for maintainers — `node tools/rate-fit.mjs --usage <this month on Claude's usage page>` reruns `scan-spend.mjs` on this computer's session records and prints this month's total for each date a changed rate could take effect from, to find the date that matches Claude's usage page. It only reads local files and prints to the terminal.
- **Claude Code's own `claude` command** — the one on your PATH, or else the copy inside the Claude desktop app — and only these two, written as fixed text in the code: `claude plugin marketplace update easy-compact` when you press **Check for updates**, and `claude plugin update easy-compact@easy-compact` when you press **Update**. Claude Code then fetches this repository from GitHub. These buttons don't appear when you installed from Anthropic's directory.
- **Your file manager**, only when you press **Open folder** next to a diagnostics file you saved: on Windows `cmd.exe /d /c start "" explorer.exe /select, <that file>` (Claude Code starts plugin commands with their windows hidden, so `start` is what lets the Explorer window show; a path with `&`, `^`, `%`, `!` or a comma is not opened — use **Copy path**), `open -R <that file>` on macOS, otherwise `xdg-open <its folder>`.
- **`/compact`**, in your session, only when you press **Easy Compact** (after Claude answers the save message) or **Plain compact**, or — in a session where you turned Easy Auto on — when the context passes the Easy Auto range (after Claude answers Easy Auto's save message); **`/clear`** only when you press **Clear** and confirm.
- **Stopping a turn**, only in a session where you turned Easy Auto on, when a long task passes the end of the Easy Auto range: it stops the running turn between two requests (as the stop button does), so the save message can go next.

## What it sends

- easy-compact itself sends nothing over the network: no telemetry and no requests of its own, with one exception you opt into. Everything it measures stays on your computer.
- **Exchange rate, only when you show amounts in won** (Settings → General → Currency; the default is dollars): a plain GET to `https://api.frankfurter.app/latest?from=USD&to=KRW` through Claude Code's `$.http.fetch`, at most once a day — when today's rate hasn't been fetched yet (an hour later if a try fails). It returns the European Central Bank's USD→KRW reference rate (about 71 bytes). The request carries nothing of yours: no session data, no costs, no credentials (no `auth`), only an `accept: application/json` header. With dollars it makes no request. The diagnostics card's **Open an issue** is a plain link that opens this repository's new-issue page in your browser; nothing is attached to it.
- **Easy Compact** sends one message to Claude in your session, as part of your normal conversation. The message asks Claude to check what compacting would lose, to save decisions, progress and next steps that aren't in files yet (memory, work notes), and to reply with what to do next. It includes the message you picked in the compact popup (one of the presets, or your own text). Nothing else goes into it: no text from your conversation or files, and no costs. The text for "after /compact" is added to the `/compact` command as instructions for the summary.
- **Easy Auto**, only in a session where you turned it on, sends two kinds of messages to Claude in that session, as part of your normal conversation: `[Easy Auto · summary]` followed by the same save message as Easy Compact's Normal preset (with the range it passed — nothing from your conversation or files, no costs), and, only after it stopped a long task and compacted, `[Easy Auto · continue] Compacting is done. Please continue what you were doing.`

## What it writes

- Its settings, to Claude Code's plugin store on this computer — including the currency, the last exchange rate fetched (rate, its date and the day it was fetched) and, for each session, whether Easy Auto is on, its range and which step of its save → compact → continue chain it is at. The same store keeps a few token counts it measured, so other sessions on this computer can estimate before they measure their own: the last compact's sizes (after it, the summary, the base load, the summarizer's output) and the cached prompt prefix shared across sessions, per model. Numbers only — no text.
- Each session's question history (question text, cost, the end of each answer), each session's running cost (so it survives an app restart), each session's cost by day of requests that aren't in the session records (compact summaries, Claude Code's own background requests — so today and this month include them) with the size and cost of each compact it measured, and its own small caches, to its data folder under `~/.claude/plugins/data`.
- A diagnostics file, `debug-<session>.json` in that same folder (version, this session's settings, pane state, usage and question history, and how each compact was detected), only when you press **Save as file** in the diagnostics card (**Report a problem** → **Show diagnostics** — in the pane's version drawer or the Settings General tab). The card shows the content first; question text, answer endings, step names and custom texts are left out unless you turn that off. It stays on your computer; you attach it to a bug report yourself.
- The same diagnostics text to your clipboard, only when you press **Copy** in that card, and the saved file's path, only when you press **Copy path**.

## What its hooks do

The hooks watch and draw. Apart from Easy Auto stopping a turn (above), they never change Claude's permissions, your prompts, tool calls or tool results.

- `session.start`, `turn.start`, `turn.step`, `turn.complete`, `session.measure` and `session.compact`: read token counts and timings to keep the costs and the context size up to date. With Easy Auto on, `turn.step` is where it sees a long task pass the range and stops the turn.
- `prompt.submit`: notes where a prompt came from (you, another session or a notification — so Easy Auto waits for you), and its text and number of images, to name the question. Passed on unchanged.
- `prompt.suggest`: notes that Claude Code made its own suggestion request, so that cost is labelled. Passed on unchanged.
- `tool.call`: notes the id of each tool call in the main conversation (the id only, not its input or result), so that hovering a question's cost chip can mark that question's tool rows too. Passed on unchanged.
- `session.attach`, `session.detach`: when you switch into a session, the bar's values flash once; leaving clears that.
- `ui.render`, `ui.message`, `ui.close`: draw the bar, the pane, the cost chip under answers (with Question highlight on, also a hidden bar beside each block and tool row of that answer, shown while you hover its chip or pane row), the running question strip above the input, the running cost next to the terminal's working indicator and the folded bar's button, and handle their buttons.

It adds no slash command. With **Line below the input** turned on in Settings, it also keeps one line of text (the gist of the bar) in the footer below the input.

In the code, "tokens" always means model tokens (context size and request counts), never credentials, and `http://www.w3.org/2000/svg` is the SVG namespace name inside drawn icons, not an address it contacts.

## Install

Add it from Anthropic's directory on claude.ai, and Claude Code picks it up the next time it starts. Or install it in Claude Code from the repository's own marketplace:

```
/plugin install easy-compact --marketplace JaeSeongHa5280/easy-compact
```

Screenshots and every setting: <https://github.com/JaeSeongHa5280/easy-compact>. 한국어 설명: <https://github.com/JaeSeongHa5280/easy-compact/blob/main/README.ko.md>
