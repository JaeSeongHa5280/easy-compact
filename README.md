<p align="center">
  <img src="docs/demo.gif" width="900" alt="easy-compact: the Easy Compact bar above the Claude Code input, then one-click Save &amp; compact">
</p>

<h1 align="center">easy-compact</h1>

<p align="center">
  <b>See what every request costs. Know when to compact. Compact in one click — without losing your place.</b><br>
  Claude Code plugin · desktop app and terminal · Claude Code 2.1.295+
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.1-4c9be8" alt="Version 0.5.1">
  <img src="https://img.shields.io/badge/Claude_Code-plugin-D97757" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/requires-Claude_Code_2.1.295%2B-4c9be8" alt="Requires Claude Code 2.1.295 or later">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license">
</p>

<p align="center">
  <b>English</b> · <a href="README.ko.md">한국어</a>
  &nbsp;|&nbsp;
  <a href="#requirements">Requirements</a> · <a href="#install">Install</a> · <a href="#update">Update</a> · <a href="#whats-new-in-050">What's new</a> · <a href="#features">Features</a> · <a href="#hide-fold-bring-it-back">Hide · bring back</a> · <a href="#bar-not-showing">Bar not showing?</a>
</p>

---

## Requirements

| | |
|---|---|
| **Claude Code** | **2.1.295 or later.** Desktop app: in a Code tab session type `/status` and read the **Claude Code** row (not the app version in About). Terminal: `claude --version`. An older engine may not draw the bar at all; where easy-compact can still start, it shows a one-line update notice instead. |
| **To update** | Desktop app: **Claude → Check for Updates** (macOS) or **Help → Check for Updates** (Windows), then start a new session. Terminal: `claude update`. Homebrew's `claude-code` follows the slower stable channel and is still too old — use `brew install --cask claude-code@latest`. |
| **git** | Needed to add the marketplace from GitHub — `git --version` should print a version. macOS: if a developer-tools prompt opens, install them. Windows: [Git for Windows](https://git-scm.com/downloads/win). |
| **Where it shows** | The Claude desktop app (Code tab) and `claude` in a terminal. Not in the VS Code extension's chat panel, `claude -p`, cloud sessions or WSL sessions. |
| **Optional** | Node.js 14.8+ — draws the early part of very long sessions (records over 4 MB) that began before you installed, and counts today · this month (the pane's All sessions line and the bar option). |
| **Tested on** | Windows 11, desktop app and terminal. Nothing in the code is OS-specific, but macOS and Linux haven't been tried on real machines yet — reports welcome. |

## Install

**First time only.** The desktop app and the terminal share the same settings, so installing once works in both.

**Easiest — send this one line to Claude** (in the desktop app's Code tab or a terminal session):

```
Install this plugin: github.com/JaeSeongHa5280/easy-compact (claude plugin marketplace add JaeSeongHa5280/easy-compact, then claude plugin install easy-compact@easy-compact)
```

Then quit the Claude app completely and open it again (or start a new `claude` session). The Easy Compact bar appears above the input.

<details>
<summary><b>Type it yourself</b></summary>

**In Claude's input box — send each line on its own.** Send the second line after the first one finishes. Pasting both lines in one message doesn't install.

```
/plugin marketplace add JaeSeongHa5280/easy-compact
```

```
/plugin install easy-compact@easy-compact
```

- **Desktop app:** the first line opens **Add marketplace** — click **Sync**. The red warning there is the standard notice for any marketplace Anthropic doesn't run. The second line opens easy-compact in the plugin list — install it.
- **Terminal session:** the second line opens the plugin's details — choose **Install for you**.

**In a terminal (macOS Terminal · Windows PowerShell):**

```
claude plugin marketplace add JaeSeongHa5280/easy-compact
claude plugin install easy-compact@easy-compact
```

No `claude` command (usual if you only use the desktop app)? Send the one line above to Claude.

</details>

> **Note for Claude:** first check the engine is 2.1.295 or later (`<engine> --version`); if it is older, don't install — point the user to the update steps in [Requirements](#requirements). If `claude` is not on PATH (usual in the desktop app), run the running engine — its path is `CLAUDE_CODE_EXECPATH`, or else the executable of `CLAUDE_PID`. macOS · Linux: `"$CLAUDE_CODE_EXECPATH" plugin marketplace add JaeSeongHa5280/easy-compact`, then `"$CLAUDE_CODE_EXECPATH" plugin install easy-compact@easy-compact`. Windows PowerShell: `& $env:CLAUDE_CODE_EXECPATH plugin marketplace add JaeSeongHa5280/easy-compact`, then `& $env:CLAUDE_CODE_EXECPATH plugin install easy-compact@easy-compact` (without the variable, `(Get-Process -Id $env:CLAUDE_PID).Path`). If adding the marketplace fails because `git` is missing, help the user install git (on macOS, `xcode-select --install`). To update an existing install, run `plugin marketplace update easy-compact` first, then `plugin update easy-compact@easy-compact` (same engine path) — without the first step it reports the old version as the latest. Check `plugin list` shows `easy-compact@easy-compact` enabled, then ask the user to quit and reopen the app. Don't clone this repository or edit `settings.json`.

## Update

**From 0.5.0, inside the app:** **📊** on the bar → the **⚙ Settings** tab → the **easy-compact** section at the bottom → **[Check for updates]** → **[Update]** if there is a new version → restart Claude. Only when you press it does Claude Code fetch the marketplace from GitHub. When a new version is already downloaded, the Settings tab shows a dot (•).

**On 0.4.1 or earlier, or to do it yourself, send this one line to Claude**, then restart Claude:

```
Update this plugin: easy-compact (claude plugin marketplace update easy-compact, then claude plugin update easy-compact@easy-compact)
```

To do it yourself in a shell, these two lines:

```
claude plugin marketplace update easy-compact
claude plugin update easy-compact@easy-compact
```

- Typing the install lines again only says *already installed*, and `plugin update` alone reports the old version as the latest — the first line fetches the new list.
- Your settings (compact range, chosen screen and so on) stay as they were. The 0.4.0 **Basic** screen is gone and becomes **Simple**.
- **Get new versions automatically:** in a terminal session, `/plugin` → **Marketplaces** → **easy-compact** → **Enable auto-update**. It is off for marketplaces Anthropic doesn't run ([Claude Code docs](https://code.claude.com/docs/en/plugins/install)).
- Your version: `claude plugin list`. What changed: [CHANGELOG](CHANGELOG.md) · [releases](https://github.com/JaeSeongHa5280/easy-compact/releases).

<details>
<summary><b>Remove</b></summary>

```
claude plugin uninstall easy-compact@easy-compact
```

No cloning into `~/.claude` and no `settings.json` edits are involved. Just want a break? [Turn the bar off](#hide-fold-bring-it-back) instead.

</details>

## What's new in 0.5.1

- **"All sessions" at the top of the usage pane** — `All sessions  Today ~$65 · This month ~$788` (every session on this PC, API list prices), right above **This session · Total $**. The Detailed view always shows it, whatever the option says; the Simple view shows only what you turned on.
- **Settings row "All sessions"** — All screens → *All usage* is now **All sessions**. When on, today · this month also show on the bar and in the Simple pane.
- **Korean UI** — the bar's first label is now **세션** (Session), like the English one; the pane's first card keeps **이 세션** (This session).

A 17-second tour is on the [v0.5.1 release page](https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.5.1). Full list: [CHANGELOG](CHANGELOG.md).

<details>
<summary><b>What's new in 0.5.0</b></summary>

- **Fits the pane and the window** — cards fill the pane and bars and graphs grow to the card width. When space runs out nothing breaks mid-word; the least important cells go first (the bar and the settings cost table).
- **One set of icons, one meaning per color** — line icons replace the glyphs on card titles, the bar and the confirm cards (desktop). Progress is blue, caution a single yellow, loss · overdue · cache expired red, ★ optimum green.
- **Today · this month** (option, off by default) — Settings → Screen → Details → All screens → **All usage** (**All sessions** from 0.5.1). When on, the bar shows `Today ~$65 · This month ~$788` (every session on this PC, API list prices).
- **Update from inside the app** — **[Check for updates]** → **[Update]** at the bottom of the Settings tab. A downloaded new version puts a dot on the Settings tab, and the first start after updating opens the pane with *Updated to 0.5.0 · What changed ▸*.
- **"Now" in the simple view is one decision line** — state + one number + what to do. Names are tidied too: bar size **Full · One line**, first card **This session**.
- **Fixed** — a finished question's cost changed when you sent the next one (the app's own requests after an answer now count for 30 seconds only).

A 33-second tour is on the [v0.5.0 release page](https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.5.0).

</details>

<details>
<summary><b>What's new in 0.4.1</b></summary>

- **Three screens — Simple · Detailed · Custom.** **Simple** is for newcomers and anyone for whom tokens and caching are unfamiliar: a one-line bar (session cost · context · cache · Easy Compact) and only the essentials in the pane and Settings. **Detailed** is for people who know how AI costs work: plan limits, per request, compact range, the question row, graphs and the full cost table. **Custom** lets you pick the bar's parts and the **Detail level** (Minimal · Everything). New installs and updates start on Simple.
- **A preview in Settings → Screen** — see how the bar and the question-cost chip after each answer will look as you choose.
- **The question cost after each answer is a blue chip** — `🧾 This question $0.61 · 6 requests · 🤖 1 agent $0.24 included`. On the Detailed screen, **▸ Details** opens it in place: main · 🤖 agents · 🗜 compact · ⚙ app's own requests, and the priciest main steps.
- **Question highlight** — hover the question-cost chip or its row in the Usage pane and the answer it priced turns gray with them (desktop, can be turned off).
- **For all screens: the limits row and session-cost colors** — under Screen → Details, changeable on any screen. If a session has finished a request and still has no plan limits, the limits row option is left out.
- **Cache shows as `cache expires in 42m`** — easier to read than `42/60m`.
- **No compacting at a loss** — when the cache is cold and continuing is cheaper, or there is little to save, the Easy Compact card shows *Keep working* and no compact buttons. easy-compact makes the money call with numbers; the session asked to save only checks whether it would lose information (it used to go ahead with a losing compact because "everything is saved to memory").
- **Clearer cost per question** — the simple view shows `N requests · 🤖 N agents` per question; the detailed view says `1 agent $3.56 included` and opens into main and agent parts.
- **`Question (10 req assumed)` in the cost table** — one question is fixed at 10 requests so the figure doesn't swing, with this session's average request count and its range in color below.
- **Simple · Detailed** at the top of the pane is a quick look — closing the pane or visiting Settings returns to your detail level. Opened Settings sections also reset when the pane closes (Screen and its Details open).
- **Ready for macOS** — "Windows" is gone from the descriptions and [Requirements](#requirements) lists what you need. On an engine older than 2.1.295 (Homebrew's stable channel, for one) it shows a one-line update notice where it can start, and when `node` is missing for a long record it says so.
- Removed: the question-average part, the separate "🤖 under answers" option (it follows the screen) and the 0.4.0 **Basic** screen (now Simple).

A 35-second tour of these is on the [v0.4.1 release page](https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.4.1).

</details>

## Why

Claude Code re-reads the whole context on every request — a session at 300k pays for 300k on every step, and nothing on screen tells you.

| Without | With easy-compact |
|---|---|
| Typing `/context` again and again | Context and cost **always on screen** |
| *"What did that cost?"* | Cost per **request, question and step** |
| *"Compact now or later?"* | 🟡 **Good time** · 🔴 **Overdue** · grey 🗜 = not yet |
| *"Where were we?"* after a compact | **Next steps kept** in the summary |

## Demo · 60 s

https://github.com/user-attachments/assets/0926dba9-ce9f-42fe-a3c0-fef808131a56

## Features

### 1. Live cost, right above the input

<img src="docs/img/band.png" width="900" alt="The Easy Compact bar: plan usage, per-request cost, context, compact range, cache, and this question's cost">

**Context, next-request cost and this question's cost — updated after every request.**
Also on the bar: this session's cost so far (yellow · orange · red at $10 · $50 · $100 — change them in Settings), your 5-hour and 7-day plan usage, minutes left on the prompt cache (`cache expires in 42m`), the **Easy Compact** button, and the window buttons (top right). It starts on the **Simple** screen: one line with the session cost, context, cache and Easy Compact. Turn on today · this month in Settings to add every session on this PC — the Detailed usage pane always shows them at the top. For everything, pick **Detailed** under Settings → **Screen**; to choose single parts, **Custom** → **Details** — the bar preview follows as you choose. Still too much? Shrink the bar to one line or fold it until it's time to compact — see [Hide, fold, bring it back](#hide-fold-bring-it-back). Subagent spending shows up as `1 agent $X included`.

<img src="docs/img/screen.png" width="520" alt="Settings → Screen: Simple · Detailed · Custom, who each is for, and a preview of the bar and the question-cost chip">

**Settings → Screen: Simple, Detailed or Custom.** The preview shows the bar and the question-cost chip as you choose, with this session's values. **Detail level** (Minimal · Everything) sets how much the pane, Settings and the chip show.

### 2. Cost per question, step by step

<img src="docs/img/live.png" width="760" alt="A running question with one line and one price per step">

**While Claude works, every step gets its own line and price.**

<img src="docs/img/history.png" width="760" alt="A finished question opened: read, write and output split, then each step">

**Open any finished question** (detailed view): main (read / write / output) · 🤖 agents · 🗜 compact · ⚙ app's own requests, then each step. `(+42k)` is how much context that question added. The simple view doesn't open questions — each shows its total and `N requests · 🤖 N agents`.

<img src="docs/img/question-cost.png" width="900" alt="The blue question-cost chip under an answer, opened into main requests, agents and steps; hovering it highlights the answer and its row in the Usage pane">

**Every answer ends with a blue chip: what that question cost.** On the Detailed screen, **▸ Details** opens it in place — main · 🤖 agents · 🗜 compact · ⚙ app's own requests, with the priciest main steps. **Hover** the chip or the question's row in the Usage pane and the answer, the chip and the row turn gray together (desktop; Settings → Screen → Details → **Highlight**).

### 3. Know when to compact

<img src="docs/img/settings.png" width="640" alt="Settings: a cost table per compact size with the best range starred">

**Pick a compact range from a cost table.** Each size shows one read and one question (10 requests assumed × the current model's rates — this session's average request count is on the line below); a wider pane adds the cost when the cache has gone cold and how far it is from the cheapest size (★) — a narrow one drops the least important columns first. The Simple screen shows only the size ranges and the verdict.

| Next to 🗜 | Means |
|---|---|
| Grey 🗜 · plain **Easy Compact** | Not now — before your range, right after a compact, or compacting would cost more. Hover for the reason |
| 🟡 *Good time to compact* | Inside your range |
| 🔴 *Compact overdue* | Past your range |
| 🔴 🧊 *Cache expired* · **Compact now advised** | The cache went cold, and compacting now is cheaper than re-sending everything |

### 4. Save & compact — one click

<img src="docs/img/confirm.png" width="860" alt="Compact now? card: context 312k to 82k, savings per question, Save &amp; compact or Compact now">

<img src="docs/img/keep-working.png" width="860" alt="The cache has expired and compacting now would cost more: the card says Keep working, with only an OK button">

**"Compact now?" shows what you save per question and what the compact costs.** With a cold cache it's the 🧊 *Cache expired* card — continuing vs compacting now, with ▶ Compact now as the main button (a save question would first re-send everything). **When compacting now would cost more** (a cold cache where continuing is cheaper, or little to save), the card has no compact buttons, just *Keep working* — easy-compact decides the money side with numbers and doesn't leave it to the session. Pressing **Save & compact**:

```mermaid
flowchart LR
  A["▶ Save & compact<br/>(offered only when it pays)"] --> B{"Session: would compacting<br/>lose anything it needs?"}
  B -- yes --> H["Hold — nothing changes"]
  B -- no --> C["Save decisions,<br/>progress, to-dos"]
  C --> D["Write next steps<br/>in 3–5 lines"]
  D --> E["/compact keeps<br/>that answer"]
  E --> F["Pick up from<br/>the summary"]
```

<img src="docs/img/summary.png" width="860" alt="After the compact: next steps in the summary card, context back to about 82k">

**After the compact, the next steps are in the summary — and every request costs less.** *Compact now* skips the save step.

### 5. Usage pane

<img src="docs/img/simple.png" width="900" alt="The Simple screen: a one-line bar and the Simple Usage pane with This session and cost per question">

Open it with **📊** on the bar. **Simple** (detail level Minimal — the Simple screen): **This session** — running total, questions, main / 🤖 / ⚙ and one *now* line (state · one number · what to do) — plus cost per question. **Detailed** (detail level Everything — the Detailed screen): also what another model would have cost, the context bar, compact timing, context flow and what each compact saved. The Detailed pane starts with an **All sessions** line (today · this month for every session on this PC) whatever the option says; the Simple pane shows only what you turned on. **View [Simple][Detailed]** at the right of the tab row switches for a quick look — closing the pane or visiting Settings returns to your detail level. Cost per question starts folded. By default it opens and closes together across your open desktop sessions, and doesn't open by itself in new sessions — both are in Settings → **Bar · pane**.

### 6. Terminal too

<img src="docs/img/terminal.png" width="900" alt="The same bar and Usage pane in the Claude Code terminal">

**The same bar and Usage pane in the CLI.** To press the bar's buttons, press ctrl+x tab to move into the bar (or click, in fullscreen mode).

## Hide, fold, bring it back

The window buttons sit at the top right of the bar. Every choice applies to all sessions and stays after a restart.

| Button | What it does | How it comes back |
|---|---|---|
| **—** / **□** | One line / full | Press it again |
| **✕** fold | Folds the bar below the input in every session | By itself when it's time to compact (yellow · cache expired) — or press **🔽 Easy Compact ⇱** below the input, or type `/easy-compact show` |
| **📊** | Opens or closes the Usage pane | Press it again |

Whether a folded bar opens by itself is **Open by itself** under Settings → **Bar · pane** (on by default). Turn it off and the bar stays folded — the button below the input turns grey (*closed*) — until you press it: a pause before you decide to uninstall. Folding an opened-by-itself bar again keeps it folded until things get more urgent (red · cache expired).

<img src="docs/img/fold.png" width="900" alt="After folding the bar: a note that it opens by itself when it is time to compact, and the Easy Compact button below the input">

**There are only two commands: `/easy-compact show` · `hide`** — use `show` to open a folded bar. Everything else is on the bar's buttons and the **⚙ Settings** tab of the 📊 pane. Settings open with only the **Screen** section (Simple · Detailed · Custom) and its Details; the others are folded, with the current value on each title. **All screens**, under Details, holds the limits row, the session-cost colors, All sessions (today · this month) and Highlight. The **easy-compact** section at the bottom checks for new versions. The cache lifetime itself (`promptCacheTtl` in your settings file) can be changed only under **Custom** — choosing it without knowing the trade-off just costs more.

**Buttons cost nothing.** Typed commands don't call the model either, but the command and its one-line answer stay in the conversation, so they are re-sent with your next request.

## Bar not showing?

1. **Version** — easy-compact needs 2.1.295 or later. An older engine shows a one-line update notice where it can, or nothing at all — check and update the version as in [Requirements](#requirements).
2. **Installed?** — in a terminal, `claude plugin list` should show `easy-compact@easy-compact` enabled. If adding the marketplace failed, `git` is usually missing.
3. **Restart** — quit the desktop app completely (not just the window), open it and start a new session. In a terminal, start a new `claude` session.
4. **Managed work machines** — if an administrator has blocked plugins or mods, it won't show.

Still stuck? Open an [issue](https://github.com/JaeSeongHa5280/easy-compact/issues) with your OS, the Claude Code version from `/status` and the exact error.

## Good to know

- **Amounts are API list-price estimates.** On a subscription they show how heavy a session is, not what you are billed.
- **Everything stays on your machine.** easy-compact reads your local session records and never goes online by itself. Only when you press **[Check for updates]** · **[Update]** in Settings does Claude Code (the `claude plugin` commands) fetch the marketplace from GitHub.
- **Platforms:** built and tested on Windows 11. Nothing in the code is OS-specific, but macOS and Linux haven't been tried on real machines yet — reports welcome.
- **Desktop app:** right after the pane opens, the first click inside it only moves focus — click once more.
- Records over 4 MB are read with Node.js (14.8+). Without `node`, a very long session is drawn from when you installed, and the pane says so. Today · this month are counted with Node.js too — without it those bar cells don't appear and the pane's **All sessions** line says *Not measured* and why. Other sessions' transcripts (token counts only) are read only while that option is on or the usage pane is open in the Detailed view.

## License

[MIT](LICENSE)
