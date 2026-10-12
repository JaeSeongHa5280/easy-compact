# Changelog

All notable changes to easy-compact. Versions follow [Semantic Versioning](https://semver.org/) (0.x: anything may still change). [한국어](CHANGELOG.ko.md)

**Update:** send Claude `Update this plugin: easy-compact (claude plugin marketplace update easy-compact, then claude plugin update easy-compact@easy-compact)`, or run those two lines in a shell, then restart Claude — see [Update](README.md#update).

## [0.4.0] — 2026-10-13

### Added
- **This session's cost, always on the bar** — first on the cost row in both sizes (and in front of the cold-cache warning). It turns yellow · orange · red at $10 · $50 · $100; the Usage pane's *Session total* uses the same colors.
- **Subagent cost on its own (🤖).** The bar's question line and the line under answers show `🤖 $1.93 · 6 requests · running`; the working line shows `🤖 $X`. A background agent still running after the answer stays *running* until it ends. Opening a question in the Usage pane splits it into main / 🤖 agents / 🗜 compact / ⚙ app's own requests, and agent lines show their name and *running · done*.
- **Simple Usage pane.** A cost summary (this session · questions and average · main / 🤖 / ⚙ · a "now" line · the compact call) plus cost per question. **Simple · Detailed** at the top of the pane switches the view for this session.
- **Four screens at the top of Settings.** **Simple** for people just getting started (session cost, context and the Easy Compact button — no limits, per request, range, cache or question row; no 🤖 line under answers), **Basic** (the bar as designed · simple pane), **Detailed** (every figure, plus the question average · detailed pane) and **Custom**. Presets show their details read-only; Custom chooses the bar parts, the session-cost colors, the pane view, the 🤖 line and the cache lifetime. New installs start on Basic; existing users keep Detailed (or Custom, if they had hidden parts). There are no presets for the compact size.
- **Costs that show the model difference.** A **per question** column in the cost table (this session's question shape × the current model's rates, agents included), and *the same N questions on Sonnet 5.5 ~$X · now Opus 5.5 $Y* in the pane.
- The limits row turns off as a whole (**All limits**) or part by part (5h · 7d · reset time).

### Changed
- **✕ folds the bar, and it opens by itself when it's time to compact** — Settings → **Bar · pane** → *Open by itself* (on by default). The ⇲ auto-hide button is gone: it did the same as ✕. With the option off, a folded bar waits for you (the old *Hidden*). Folding a bar that opened by itself keeps it folded until things get more urgent (red · cache expired).
- **Per request is the real cost** (reading the current size + this session's typical new writes and output). Counting reads alone made Opus 5.5 and Sonnet 5.5 look the same. The read-only column in the cost table is now **One read**.
- **New installs start at 200k–250k** (was 250k–300k). Counting compacts correctly moved the best size down (about 220k on Opus 5.5 and 190k on Sonnet 5.5 for a 94k post-compact size). Existing users keep their range; Settings marks the suggestion with ★.
- **Cache minutes always show** — also right after a compact (counted from the compact). 0.3.1's *no cache yet (the next request writes it)* is gone.
- **API-key sessions** (no plan limits) move the cost line up to the top row with the window buttons.
- The working line drops *output Nk* (🤖 takes its place).
- The pane body no longer repeats *Total cost* — it's the same as *Session total* on the card title.

### Fixed
- **Cache lifetime is read from the session, not assumed.** Claude Code picks it per request — 1 hour on a subscription within its limits, 5 minutes on an API key, a cloud provider or over the plan, or whatever `promptCacheTtl` says — and records it in the transcript. Minutes left show as `42/60m`; the warning is set per lifetime (10 min for 1 h, 2 min for 5 min); the cost of re-sending a cold cache uses that lifetime's write rate. Everything used to be priced as 1-hour writes, 1.6× too high on 5-minute sessions. Until the first request is measured the value is marked *est.* Custom can change `promptCacheTtl` in your user settings.
- **The cache timer restarts with every request.** It was only reset when an answer finished, so a long answer counted down — and could show *Cache expired* while still working.
- **A cold cache always opens the Cache expired card** (main button ▶ Compact now). When compacting now cost more, the regular card used to appear and *Save & compact* re-sent everything first. It now says *continuing as is is cheaper*, and picking Save & compact yourself still works. A card opened while compacting isn't advised keeps a grey 🗜 / 🧊.
- **Cold-cache math counts the shared prefix**: the system prompt and tools other sessions keep warm are reads (e.g. Sonnet 5.5 at 150k with a 1-hour cache: continuing $0.60 → $0.42).
- **Compact cost follows the cache state**: a warm compact reads the conversation cache (98.6% measured). Past compacts known only from the transcript and *compact now* were priced about 7× too high.
- **Summary size** is measured as what the first request after a compact newly wrote — it used to come out tiny (*incl. 1k summary*).
- Switching models updates Settings and the cards right away instead of at the next request.
- Compact-timing labels no longer overlap in a narrow pane (*250k good300k late*) — they sit at both ends of the bar.
- The limits row no longer breaks into vertical letters in a narrow terminal.
- Agents showing only as *subagent* — they now take the task name from the engine's agent list.

## [0.3.1] — 2026-10-12

### Changed
- **Only two commands are listed: `/easy-compact show` · `hide`.** The rest are gone from the slash menu, the help and the README — size, auto-hide, the pane and settings are on the bar's buttons and the ⚙ Settings tab (buttons leave nothing in the conversation, so they cost no tokens). The old commands still work if you type them.
- New README GIF and feature images for the 0.3.0 screens (window buttons, fold button, grey / blue 🗜), plus a picture of how to turn the bar back on.

## [0.3.0] — 2026-10-12

### Added
- **Window buttons on the Easy Compact bar** (top right): **📊** Usage pane · **⇲** auto-hide · **— / □** one line / full · **✕** turn the bar off. Hover any of them for a one-line hint (desktop app).
- **Fold button below the input:** while the bar is folded by auto-hide or turned off, **🔽 Easy Compact ⇱** brings it back. It turns grey (*closed*) when the bar is off.
- **Turning the bar off tells you the way back** — press the button below the input or type `/easy-compact show`. Off is meant as a pause; uninstalling is a separate command.
- **Shortcut commands:** `/easy-compact show` · `hide` · `auto on|off` · `min` · `max` · `panel`. Korean words work too.
- **Usage pane options** (Settings → *Usage pane*, or `panel auto` / `panel share`): open the pane by itself in new sessions (off by default), and open or close it together across desktop sessions (on by default).
- The one-line bar keeps the Easy Compact button and its *Compact now?* card.
- Settings sections start folded, with the current value on each title.

### Changed
- The band is now called the **Easy Compact bar**. 0.2.0's three views became a size (full · one line), auto-hide, and off.
- The bar shows its state with a pulsing dot and a highlighted button. Its 🗜 icon is blue when compacting is worth it or under way, and grey otherwise.
- **When compacting isn't advised** — before your compact range, right after a compact, or when the cache has expired but compacting would still cost more — the 🗜 turns grey, with the reason on hover. Pressing the button still opens the card with the full numbers. It is also grey while an answer is running (the button can't be pressed then).

### Fixed
- **Cache expiry is timed from the last request.** Reopening or renaming a session no longer makes an expired cache look fresh, so *Cache expired · compact now advised* shows up when it should.
- Right after a compact, the bar shows the estimated size instead of *Context 0*, and *no cache yet* instead of a countdown. The last-question row from before the compact is hidden until the next request.
- The *Compact now?* card's cold-cache line uses the same math as the bar. It used to show only the rewrite share, in green, which read as a saving next to the bar's *loss*.
- Sessions whose records are over 4 MB are read again — 0.2.0's package was missing the helper script.
- Hover hints no longer stay up after a click. Unknown commands get a one-line answer.

## [0.2.0] — 2026-10-12

### Added
- Band views: Full · Minimized · Only when compacting.
- *UI layout details*: turn single parts of the full band on or off (5h / 7d limits, reset times, per-request cost, context, range, cache, the question row).

## [0.1.0] — 2026-10-11

First public release: the band above the input (plan usage, per-request cost, context, compact range, cache), the Usage pane (cost per question and step, context flow, compact effect), compact timing from a cost table, and one-click *Save & compact*.

[0.4.0]: https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.4.0
[0.3.1]: https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.3.1
[0.3.0]: https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.3.0
[0.2.0]: https://github.com/JaeSeongHa5280/easy-compact/tree/v0.2.0
[0.1.0]: https://github.com/JaeSeongHa5280/easy-compact/tree/v0.1.0
