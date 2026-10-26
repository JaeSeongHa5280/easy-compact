# Changelog

All notable changes to easy-compact. Versions follow [Semantic Versioning](https://semver.org/). [한국어](CHANGELOG.ko.md)

**Update:** send Claude `Update this plugin: easy-compact (claude plugin marketplace update easy-compact, then claude plugin update easy-compact@easy-compact)`, or run those two lines in a shell, then restart Claude — see [Update](README.md#update).

## [1.1.2] — 2026-10-27

### Fixed
- **The size right after a compact read low** — before the first request after a compact, *Context ~N just compacted* is an estimate: the conversation Claude Code kept plus the base load (system prompt, tools, instruction files). The base load came from the `/context` categories, which estimate by character count and put Korean instruction files at about 40% of their real size. It now uses this session's first request, which is measured — e.g. *~74k* (−30%) → *~100k* (−6%) against a real 105,823. A forked session still uses the categories, since its first request carries the parent's conversation.
- **The compact summary in the Resident split read low** — in *Resident = base load + compact summary*, the summary was the kept size Claude Code reports (characters ÷ 4), which puts a Korean summary at under half. It's now what's left after the base load measured on the first request after the compact (cache read + instruction files + skill list) — e.g. *base load 95k + summary 27k* → *69k + 53k*. The compact effects' *incl. N summary* uses the same value, and before that first request the split uses the base load last measured on this computer, so it doesn't jump afterwards.
- **"Next request" right after a compact read 4–5× low** — the first request after a compact writes the conversation cache anew, but the pane's *Next request* and the bar's *Per request* priced the whole context as cache reads (e.g. *~$0.06* against a real $0.29 of input). Until that request, they now price the shared prefix (system prompt, tools) as read and the rest as written, plus the usual per-request extra.
- **"After that" in a forked session** — the parent's conversation cache that the fork's first request read was taken as the shared prefix, so a cold cache was still priced almost as reads (*~$0.04* when it should be about $1.07). A fork's first request no longer sets the shared prefix, and while a session doesn't know its own, it uses the one another session measured on this computer (before, everything was priced as rewritten — about 2× high).

## [1.1.1] — 2026-10-24

### Changed
- **Cache lifetime "set by" wording** — Settings shows *automatic (1 h or 5 min, by how you sign in and your usage)*. It used to say *1 h on a subscription, 5 min on an API key or over the plan*, which misread plans billed at API rates that still get the 1-hour cache when you sign in with a Claude account. The value itself is still measured from your session.

### Fixed
- **[Check for updates] couldn't find Claude Code with the new desktop app** — the Claude desktop app (Windows Store build) moved its data folder from `%APPDATA%\Claude` to `%LOCALAPPDATA%\Claude-Data\claude_<install id>`, leaving only a marker file behind. On a computer without `claude` on PATH the update buttons found no Claude Code to run. easy-compact now looks where the app says its data lives (`Claude-Data`, `Claude-3p` or `Claude`), newest first, and the **Auto** language reads the app's language there too.
- **Easy Auto kept waiting through a cold cache** — while it waits for text in your prompt box, it now looks again each time: if the cache went cold (or the model changed) it turns Easy Auto off as it does elsewhere, and if Claude Code compacted the idle conversation by itself (Claude Code 2.1.290 or later), it stops waiting. Before, clearing the box sent the summary message even to a conversation that was already small.

## [1.1.0] — 2026-10-23

### Added
- **Amounts in won** — Settings **General** tab → **Currency**: Dollar ($) (the default, whatever the language) or Won (₩). Won reads like *1.4만원* · *132만원* on a Korean screen (under ₩10,000 to the nearest ₩10, e.g. *3,370원*) and *₩13,990* on an English one. The bar, the pane, the answer chip, the line below the input and the amount thresholds in Settings all switch (the math stays in dollars).
- **Exchange rate fetched only when today's is missing** — with won on, easy-compact fetches the European Central Bank's USD→KRW reference rate (71 bytes) from frankfurter.app. The ECB publishes around 16:00 CET, so it's often the previous day's rate, shown with its date in the **Rate (per $1)** row. If it can't fetch, it keeps the last rate (or the built-in ₩1,320) and tries again an hour later. With dollars it never goes online.

### Changed
- **Easy Auto range is per session** — a new session starts at **400k–500k** (on a model with a smaller context window, the highest range below Claude Code's auto-compact line), and a range you pick stays in that session — marked *This session*. It used to start from your compact range and be shared by all sessions.

## [1.0.5] — 2026-10-22

### Changed
- **Question highlight covers the whole answer** — hover a question-cost chip or its row in the pane and every block of that answer (text, tool rows, results, grouped tool lines) gets a blue bar on its left. 1.0.2 outlined only the last block, where the chip sits. After the app restarts, earlier questions mark only that last block (Settings **Answer chip** tab → **Highlight**, off at first).
- **Output marked "(incl. thinking)", split by effort** — open a finished question in cost per question and its output reads *output $0.33 (incl. thinking)*, so the number itself says thinking tokens are in it; if the effort changed partway through, *output $0.33 (incl. thinking — Extra $0.03 · Max $0.30)*. The split shows for questions from this version on.
- **The Slim line's limit % dims under 70%** — like the bar (bright white read like a cost). Orange from 70% and red from 90% stay.
- **Darker section-title icons on light themes** — the gray had 2.6:1 contrast on white; now 3.7:1.

### Fixed
- **Desktop Settings' "Line below the input" switch didn't save** — it was back as it was when you reopened Settings (the terminal worked).
- **The folded bar's ✕ tip** — with auto-open off, a folded bar doesn't open again on its own, yet the ✕ in the confirm opened from the Easy Auto chip said it would. It now says *Fold · reopen: […] below the input*.

## [1.0.4] — 2026-10-21

### Changed
- **Clearer change text** — cost per question now shows changes as *🔄 effort change from this question: Extra → Max* and *🔄 effort change from request 5: …*, saying what it's compared with and splitting old → new. Model changes use the same form (*model change: …*). 1.0.3's Korean wording read as if the effort were Extra; in Korean the label is now 생각 깊이 (thinking depth), and the note at the bottom of the pane ties it to the app's menu name.
- **Ultracode as an effort level** — a question where you picked Ultracode in the app's effort menu shows a purple *Ultracode* instead of Extra, and changes read *Max → Ultracode* · *Ultracode → Max*. 1.0.3 showed the Extra that Claude Code runs Ultracode at, so a *Max → Extra* change you never made appeared.
- **Shown while the question runs** — Ultracode is detected at the question's first request rather than after it ends, so the running row shows it too. When there's a change, the running row no longer repeats the same value.

## [1.0.3] — 2026-10-21

### Changed
- **Model and effort changes partway through a question** — in the Easy Compact pane's cost per question, if the model or effort changes during a question, its row shows something like *🔄 effort Extra → Max from request 5*, and the open step list shows the same text at the end of the first request that used the new value. Before, only each question's last request was kept, so changes partway through were lost. A change from the previous question still shows as *🔄 effort High → Max*, now compared with the question's first request.
- **Questions that ran with Ultracode** — a question that ran with Ultracode on shows *Ultracode* in its row, in the same purple the Claude app and Claude Code use. It's read from the Ultracode on/off marks in the session record.
- **Effort levels in the app's words** — Low · Medium · High · Extra · Max instead of the raw *max*. The note at the bottom of the pane says higher effort uses more thinking tokens, so output costs more, and that this is already in the amounts.

## [1.0.2] — 2026-10-21

### Changed
- **Easy Auto starts off in every new session** — it's on or off per session. In 1.0 a new session started with the value you last picked, so once you turned it on, sessions where you never did had it on too. Restarting the app keeps each session's own value.
- **Turn Easy Auto off while Claude is working** — pressing the bar's blue *Auto* chip during an answer turns Easy Auto off in that session right away (it couldn't be pressed before).
- **Easy Auto waits for text in your prompt box** — if your prompt box holds text you haven't sent, Easy Auto doesn't send its summary or compact and waits (bar chip *Auto · waiting for your text*). Send it and Easy Auto runs after that answer; clear it and it goes on. After a compact with text in the box, it doesn't send its *continue* message. We had a report of text being lost when Easy Auto sent its message. It only checks whether the box has text — it neither keeps nor sends it.
- **Question highlight is a blue outline** — hover a chip or a question row in the pane and the answer and the row get a blue outline while the chip's border turns bold. The gray fill showed as a white block on dark themes and made the answer hard to read.
- **[Open folder] · [Copy path] for a saved diagnostics file** — after **[Save as file]** in the diagnostics card, two buttons appear under the saved path. **[Open folder]** shows the file in your file manager (Finder on macOS); **[Copy path]** puts the path on the clipboard — text in the pane can't be selected by dragging. Windows paths show with `\`.
- **How compacts were caught, in the diagnostics file** — for each compact in this session, which way it was detected (Claude Code's notice · the compact marker in the session record · the next request's size), plus this run's decision lines (including the ones it filtered out as false). If a compact shows up late, attach this file to your report.

### Fixed
- **The bar kept the size from before the compact** — on some computers Claude Code doesn't tell easy-compact about a compact, so from 1.0.1 the bar changed only after your next request (*Context 340k · Compact overdue* stayed). It now checks the compact marker in the session record and shows *just compacted* with the smaller size as soon as the compact ends. A blank with no marker (the false compacts fixed in 1.0.1) is still left out.

## [1.0.1] — 2026-10-20

### Changed
- **Easy Auto range in the Overview tab** — the Compact timing card (Simple and Detailed views) now has the **Easy Auto range** dropdown right below the compact range. It is the same value as Settings → **Compact**.

### Fixed
- **"Compacting now would cost more than it saves" while overdue** — a moment when Claude Code briefly had no context size (after a safety stop, or several idle sessions at once) was counted as a compact the hook missed. The next request (say 490k) then became the size right after that compact, so *Resident* showed 490k and the bar said compacting would save almost nothing. Now such a moment counts as a compact only if the next request is clearly smaller (under 80% of the size before). Records like this saved by 0.9.1 – 1.0.0 are dropped when read, along with their compact line in **Cost per question**.

## [1.0.0] — 2026-10-19

### Added
- **Easy Auto compact** — leave it on and easy-compact saves and compacts by itself when the context passes a range you set. If an answer ends past the front of the range, it saves → compacts; if a long task runs past the back of the range, it stops that turn, saves → compacts → picks the work back up. Turn it on or off per session with the **Easy Auto** switch at the top right of the popup the bar's compact button opens (new sessions start with the value you last picked; in the terminal it's 4 in the popup). While it's on, the bar's compact button becomes a blue *Auto 200k* chip, and with the bar folded or on Slim the line below the input shows *🔄 Auto 200k*. Set the range in Settings → **Compact** → **Easy Auto range** (it starts at your compact range). Typing doesn't turn it off; if the cache expires or the model changes, it turns off in that session only (with a one-line note). If compacting doesn't bring the context below the range, or it passes again within 3 requests, it shows *Auto stopped*; when compacting would cost more than it saves (cold cache · little to save) it skips that one time.
- **Slim screen** — the smallest screen, for when you know your way around. Normally there's just one button below the input (*🟦 120k*); a single alert line appears above the input only at Time to compact, when Overdue, or when a cold cache makes a plain compact cheaper (**[Easy Compact]** · ✕). Press the button for a one-line summary. In the terminal it's one line where the bar was.
- **Screen preset [Slim | Simple | Detailed | Custom]** — one row at the top of Settings. **Custom** lets you pick the bar layout (Button below · One row · Three rows) and [Off | When needed | Always] for each row of **Shown at the input** (*When needed* = once that cell takes a color). On a set preset the same rows show dimmed, and **Start from** begins Custom from a preset's values. Today, This month and the limits are screen values now, so on a set preset you change them through Custom. Your old settings carry over as they looked.
- **Running question strip** — while an answer runs, one line right above the input shows this question's cost and request count (a laptop bug works away; an agent picture when agents run). It goes away when the answer ends and the answer chip takes over. The bar's third row is now the **Last question row** — the two turn on and off separately. The desktop app's own working line is left as the app draws it.
- **Agent characters** — while agents run, a lead bug waves with a blue "!" and small bugs hop along (up to three, then *+N*). When they're all done: a DONE banner and *N agents done*.
- **A flash when a value goes up** — when the context, session cost, per-request cost or cache-expiry text climbs to the next color, and when you enter a session, its background flashes three times (1.8 s). It rests while the gauge is moving; with Settings **Animations** off you get the color only.
- **Colors for Today · This month** — Settings **Numbers · colors** has thresholds for Today and This month (to start: Today $50 · $100 · $200, This month $1,000 · $1,500 · $2,000). The bar, Slim and the pane's All sessions row get the color only — no flashing.
- **[Clear] asks once more** — **[Clear]** in the compact popup no longer clears right away: the same spot asks *Clear the conversation?* with how many questions and how much context Claude forgets, and **[← Back]** (main button) · **[Clear]**. Terminal: 1 Clear · 2 Back.
- **Pick the compact message in the popup** — the popup has a [Normal | Long-session handoff | Wrap-up | Write my own] toolbar; with **Write my own**, type into two boxes and it saves with that text. The cold-cache popup has the same toolbar. The message card in the Compact settings tab is now a one-line note.
- **Cost per question [Full text]** — one **[Full text ▾]** per question that has cut-off action rows. Tool names are colored by kind, app tools get plain names (update_plan → *Task list* and so on), and a main request that started agents reads *Start agent*.

### Changed
- **The gauge is the side pane's door** — on every screen, press the gauge to open the side pane (Overview) and press it again to close it. The summary card the gauge used to open on the regular screens is gone. Slim's button shows ▸ while the Overview pane is open — press it to close the pane.
- **Question totals cover the whole session** — the question log still keeps 60, but questions pushed out are counted and summed separately (logs from before 1.0 are estimated from the transcript). Requests in the total that no question caught show as *Outside questions $X*.
- **A forked session counts only its own share** — cost, questions and the context flow count only the requests after the fork. Today and This month no longer count the copied rows of the session it came from twice, and reopening a session no longer counts the cost the engine restores twice. A deleted session's share stays in This month until the month ends.
- **Right after a compact = the first request after it** — the size the engine reports after a compact counts only the kept conversation (no system prompt, tools or memory), so the size right after compacting read too small (18k in one session vs. 106k for real). It now uses the first request's size, which also corrects the base load, the formula best point and Compact effect; old logs are corrected when read.
- **Number formats** — the context cell reads *645k (64%) / 1M* (tick labels match), the overdue line *past 300k (30%) · now 577k (58%)*, and anything under a cent shows *under $0.01*. On the Detailed bar each limit keeps its reset time with it as one group.
- **5-hour and 7-day limits** — chosen as separate rows again (*5-hour limit* · *7-day limit*), and sessions share the most recent values (a session the engine gives no limits to uses what another session got).
- **Wording and names** — descriptions in Settings, Overview and around the input are short sentences now instead of dash-and-equals fragments. *Screen type* → **Screen preset**, and the tabs below sit under **Detailed settings (chosen screen)**.

### Fixed
- **Flicker while working** — every request used to redraw the whole app screen; now only the cells that read the state redraw (desktop).
- **Other plugins above the input** — another plugin's content above the input was hidden behind our bar. It's now drawn above the bar.
- **Answer chip · question names** — a turn that ends with a wrap-up tool gets its chip too (under the last answer that had text). Question names drop hidden tags, and a question that sent only images reads *🖼 N images*.

## [0.9.5] — 2026-10-17

### Changed
- **The steps gauge is easy to spot again** — at *Time to compact* every lit step is orange, and when *Overdue* all four steps are red and blink, as before 0.9.4. The 0.9.4 level meter (each step in the color of its place, only the red step blinking) left just one orange or red step, which was easy to miss. The step count still follows the stage (Room left 1–2 · Time to compact 3 · Overdue 4), and while compacting the steps still light up from the far end. Steps and Vertical steps both.

## [0.9.4] — 2026-10-17

### Changed
- **The bar lines up** — the Detailed bar's rows are regrouped: row 2 is the money so far (Session · Today · This month), row 3 the values right now (Per request · Context · Compact range · Cache) followed by this question and the Compact button. Before, row 2 crowded six cells and row 3 held only the question. When the bar is wide enough, every cell starts in the same column on all three rows (no " · " between cells); when it isn't, the rows wrap between cells as before.
- **Quieter numbers on the bar** — plan-limit percentages stay gray until 70% (orange) and 90% (red) — they no longer stand out like an amount; *Context* keeps its name gray and colors only the number; amounts get thousands separators ($2,636.86).
- **The steps gauge is a level meter** — lit steps take the color of their place (steps 1–2 white, 3 orange, 4 red) and the count follows the stage (Room left 1–2 · Time to compact 3 · Overdue 4); only the red step blinks when overdue; while compacting, the steps light up from the far end — emptying, not charging (it read like a battery charging). Steps and Vertical steps both; the other shapes are unchanged.
- **Compact timing card** — *Compact now* and *Deferral cost* line up as name and value (the compact's own cost says *one compact*, not *cost*); the Detailed view drops the chosen-range line and the *Not advised* row (the table's bordered and red rows say the same — which ranges are not advised is in the table's **?**); *★ Suggested … · has the best size (…)* and **[Use this range]** sit on one line; the row of your current size gets a blue ● and a lighter tint.
- **The Easy Compact mark in Cost per question** — the old 🗜 on the save turn, compact steps and the chip details is now your chosen gauge shape, drawn still in blue (it doesn't show your current context).

### Fixed
- **No more diagnostic lines in the conversation** — a compact the hook didn't see printed *easy-compact: compact the hook did not see…* into the chat; diagnostic lines go to the debug log only.
- **The input box no longer flickers** when you close or reopen the bar, or when Claude Code shows a quick survey (1: Yes …) above the input (desktop).
- **Bar part name** — *Cache minutes left* is now *Cache time left*.
- **Anthropic directory check** — one callback used the name `h`, which the directory's automated check can't follow, so 0.9.2 and 0.9.3 weren't published there; renamed, with a check that keeps it from coming back.

## [0.9.3] — 2026-10-16

### Fixed
- **Each request uses the rates of the Claude Code version that sent it** — 0.9.2 fixed the Sonnet 5.5 cache-read cut ($0.20 → $0.10) to October 15 (UTC), but Claude's usage page prices a request by the rate table of the Claude Code version that sent it, not by date (2.1.295 = $0.20, 2.1.299 = $0.10). Machines move to 2.1.299 at different times, so a fixed date is off on some of them — on the machine we compared (2.1.299 from October 16 00:29 UTC), this month was $928.96 vs the usage page's $944.34: one day of the cut. Now the rate comes from the Claude Code version recorded on each line of the session record — for today, this month, cost per question rebuilt from the record, the context flow, compact savings and the requests you make now (about $944 on that machine). Records without a version count from October 16.
- **The rate line at the bottom of the pane** — *cache read 0.20 → 0.10 (from Claude Code 2.1.299 · on this PC Oct 16 — the price list says Oct 7)* and "each request uses the rates of the Claude Code version that sent it". The date for this PC shows only when this month has requests from both the old and the new version.
- The first today / this month measurement reads this month's records once more (the cache now splits them by version).

## [0.9.2] — 2026-10-16

### Added
- **Gauge shape "Vertical steps"** — the steps gauge stood up (four steps from the bottom), in the Settings **Bar** tab → **Gauge shape**. The default stays Steps (horizontal).
- **Rate changes in the rate line at the bottom of the pane** — e.g. *cache read 0.20 → 0.10 (from Oct 15 — matched to Claude's usage page; the price list says Oct 7)*: what changed, from when, and why.

### Changed
- **Amounts match Claude's usage page** — 0.9.1 counted the Sonnet 5.5 cache-read cut ($0.20 → $0.10) from October 7, as the price list says, but the usage page applies it only from about October 15 (UTC), so this month came out over $140 lower than the usage page. Now $0.20 through October 14 and $0.10 from the 15th — about $919 vs the usage page's $920 on the machine we compared.
- **Older records use the rate of their day** — cost per question rebuilt from the session record, the context flow, compact savings, the deferred cost and "the same questions on another model" all used today's rate, so older records of a model whose rate changed (Sonnet 5.5) came out too low. Now each request uses the rate of its day (a rate history — the next rate change is one more row).
- **A battery frame on the steps gauges** — Steps and Vertical steps both show four steps inside a frame (one look for both — the vertical steps alone looked like a menu icon ≡). Colors, the compacting motion and the post-compact shrink stay the same.
- **The key under Cost by size** — *Blue row = now · border = applied range* read as two "current" things, so it wasn't clear which one was your context. Now *Blue row = context now · border = the compact range you picked*.
- **Highlight is off at first** — the question highlight (hover the chip under an answer, or its row in the pane, and that answer turns gray) is now off by default. Turn it on in Settings **Answer chip** tab → **Highlight**. If you've saved settings before, your value stays.

### Fixed
- **Update check stuck at "Checking…"** — pressing it several times quickly ran several marketplace updates at once and they blocked each other; with no response it tried the next claude executable, staying on "Checking…" for minutes; and if the plugin reloaded meanwhile, only the "Checking… · Updating…" text was left and the buttons never came back. Now one command at a time; if it doesn't finish in 90 seconds (150 for the update) you get *No response, so it stopped* with **[Try again]**, and a leftover state clears when you press the version button again.

## [0.9.1] — 2026-10-16

### Added
- **Show diagnostics before you share** — **[Show diagnostics]** under **Report a problem** (in the version drawer and the Settings **General** tab) opens a card right below with what's inside and the first 40 lines (20 in a terminal). Your questions, answer endings, step names (file names, commands) and custom texts are left out from the start as *(removed · N chars)* — turn the switch off and your own text going out shows in yellow — then **[Copy]** (clipboard), **[Save as file]** or **[Open an issue ↗]**, exactly what you saw. Replaces 0.9.0's [Diagnose] (which wrote the file at once). The diagnostics start with the version and install kind.

### Changed
- **Settings previews look like previews** — a preview had the same border as the settings card around it and read as a card in a card. Now a light gray well with a blue **Preview** chip instead of a border; the whole-bar preview sits above a mock input, the way it shows above yours (a label band in a terminal).
- **The gauge in the preview** — the compact spot in the whole-bar and question-row previews shows the gauge in your shape (it was missing, so changing the gauge shape changed nothing in the preview). A four-step sample under **Gauge shape** (normal · time to compact · overdue · compacting).
- **Bar size one line · keep folded · line below the input show in the preview** — the whole-bar preview turns into the one-line bar, the folded look (the reopen button) or the line below the input.
- **The gauge moves while compacting** — while compacting or saving, the gauge on the bar and the pane header moves in progress blue, per shape (horizontal and vertical bars breathe · the ring spins an arc · steps light in turn), then shrinks from blue to the new size. The blinking dot on the desktop bar is gone (the gauge does it). With *Animations* off it stays still in blue.
- **Steps gauge by default** — the horizontal bar looked like the plan-limit bars (5h · 7d) next to it. A shape you picked stays.
- **The version button is always there** — the version button at the right of the tab row shows on a folder-loaded copy too (*v0.9.1 dev*). With a new version out it reads **Update 0.9.1**; the drawer says **Version 0.9.1 is available** · **Up to date**.
- **Terminal: no Animations row in General** — nothing moves in a terminal.

### Fixed
- **Context stuck at the pre-compact size after a compact** — when Claude Code didn't tell easy-compact about a compact (one started from the bar button, for one), the compact went unrecorded: the bar kept the size from before and the pane said *0 compacts · No compacts yet* until the next request. Now it is recorded within 1.5 seconds without the notice, the bar shows the *just compacted* size, and it lands in the flow chart and the compact log.
- **Sonnet 5.5 cache-read price** — Anthropic cut it from $0.20 to $0.10 on October 7 (same as Claude Code 2.1.299's price table). Requests since then use the new price; older records (today · this month · the estimated compacts) keep the old one.
- **Terminal: the issue link in the diagnostics card printed twice.**

## [0.9.0] — 2026-10-16

### Added
- **Diagnostics file · reporting a problem** — the drawer under the pane's version button (`v0.9.0` at the right of the tab row) has **[Diagnose]**. It saves this session's settings, pane state, usage and question history to one `debug-<session id>.json` and shows the path in the drawer and a notice (nothing goes into the conversation, nothing is sent anywhere). If something goes wrong, open a [GitHub issue](https://github.com/JaeSeongHa5280/easy-compact/issues) with what happened, how to reproduce it, which screen (desktop/terminal), the version, and this file — it contains your questions and costs, so look it over before you post it.
- **A line below the input** (Settings **Bar** tab, off by default) — while the app shows its "next step" box at the end of a turn (the one asking with buttons), the app takes the bar away for a moment (that is the app; a plugin can't stop it). Turn this on to keep the gist of the bar in the footer below the input, e.g. *🟦 Easy Compact · Context 140k · compact range 200k~250k · Session $8.40* (with *Time to compact* · *Compact overdue* when orange · red, and *Compacting…* during a compact).

### Changed
- **Settings in tabs · a preview per card** — Settings had grown too long to keep a preview and the options that change it on one screen. Under **Screen type** there are now tabs **Bar · Answer chip · Pane · Compact · General**, and the Bar tab has a card each for **Whole bar · Limits row · Cost row · Question row**, each previewing only its own row (a row that isn't on the current screen says why). The folding sections from 0.7.0 give way to the tabs.
- **The ? beside a name gets its one-space gap back** (desktop) — in 0.8.0 the bordered chip sat right against the name, which looked cramped.
- **The compact timing bar fills from the left edge** — the gray part in front (what stays after a compact) read like a fixed offset, so the fill looked detached. The whole current size is now one state color (what stays is shown on the Context card above).
- **The Overview bars move while compacting** — before, they sat still during a compact and jumped when it ended. Now the Context and Compact timing bars breathe slowly with **Compacting…** in their header, then shrink from the old size to the new one like the bar gauge. With *Animations* off you get the text only.
- **Pick the gauge shape — a horizontal bar by default** — the ring gauge looked exactly like the app's own context ring next to the input. **Gauge shape** in the Settings **Bar** tab offers **Bar** (default) · **Ring** (as before) · **Vertical bar** · **Steps**; the bar, the pane header and the compact card change together, and the fill, colors, pulse and post-compact shrink stay the same.
- **Compact card: Easy Compact · Clear · Cancel** — *Save & compact* is now **Easy Compact**, and *Compact now* gives its place to **Clear** (/clear — start over with an empty conversation, no summary). When the cache is cold the card has no save question (no text picker): **▶ Plain compact** (Claude's /compact) · **Clear** · **Cancel**, and it shows the text a plain compact adds after /compact. The bar's *Compact now advised* reads **Plain compact advised**. Terminal numbers: **1** Easy/Plain compact · **2** Clear · **3** Cancel.
- **The folded-bar button below the input is one colored square** — the old **🔽 Easy Compact ⇱** had two arrows pointing different ways. It is now **🟦 Easy Compact**, and the square follows the current size step (🟦 room · 🟧 time to compact · 🟥 late). A bar you closed still reads grey "closed".
- **Terminal: the button that reopens a folded bar sits in the bar's place** — the keyboard can't reach the line below the input, so reopening a folded bar took a command. While folded, the terminal now shows one **[⇱ Easy Compact]** line where the bar was — reach it with `ctrl+x tab`, then Enter. The fold notice also says how to reopen first (a terminal notice is one line, and its end got cut off).
- **Context numbers (size · % · both) now reach the Overview compact card** — before, only the bar followed them. The compact timing line ("Time to compact from 25% · 15% to go"), the bar labels, the range dropdown, ★ Suggested and Cost by size use the same form (with both, the table keeps sizes only — the columns would overflow).
- **Cost by size marks where you are now** — the range holding the current context gets a light blue row (the applied range keeps its border), with a one-line key under the table. Below the first range it says "Now 98k — below the first range (100k)" above the table.

### Removed
- **The `/easy-compact` command** — showing and folding the bar is the bar's **✕** and the folded-bar button (below the input on the desktop, in the bar's place in a terminal), and the diagnostics file is **[Diagnose]** in the version drawer. It leaves the slash-command list.

### Fixed
- **This month came out a little below Claude's settings page** — compacts from before easy-compact measured them (before 0.8.0, or older questions) were missing. Their cost is now estimated from each compact's size in the session records and shown at the end of the pane's "All sessions" row as **+$X est. compacts not included** — it is not added to today · this month yet (to be decided after comparing with the settings page). The summary length is matched to the compacts measured on this computer. Claude Code's own background requests from that time leave no record, so they still can't be counted.
- **Switching between Overview and Settings didn't take the pane back to the top** — coming from a long Overview, Settings could open scrolled past its content (the move to the top was always being refused). The pane now goes to the top of the tab you open.

## [0.8.0] — 2026-10-15

### Changed
- **The gauge opens the pane** — on the desktop, click the ring gauge before **Compact** to open or close the Easy Compact pane, like the app's own context ring. The small **◔** button is gone (it looked like the gauge but did something else), so the top right of the bar holds only **—** and **✕**. Hovering the gauge shows the context and your compact range; hovering **Compact** shows the state and what to do — the two used to show the same chip. A one-time notice on the desktop says so. The terminal keeps **[Pane ▸]**.
- **Terminal: value lists are buttons in a row** — a dropdown in a terminal opened as soon as it got the focus and kept the arrow keys (← → did nothing, ↑ ↓ went round its list), so the buttons after it were hard to reach. Compact text, language, cost order, the cache warning, the compact range and the confirm card's text are now buttons in a row; session-cost colors are **[ − ] $10 [ + ]**. The desktop keeps its dropdowns.
- **Terminal: numbered confirm card** — **1** Save & compact · **2** Compact now · **3** Cancel, on the rows and the buttons. Typing the number in an empty prompt presses it.
- **The ? beside a name is a small bordered chip right after the name** (desktop).

### Fixed
- **Today · this month came out a little low** — compact summaries and Claude Code's own background requests (next-prompt suggestions, memory upkeep, compact precompute) aren't in the session records. easy-compact already measured them per question; now each session keeps them by day and they're added to today · this month (earlier days come from the cost-per-question history). Use on other computers and on the web still can't be counted.
- **The gauge blinked when the bar changed size** — shrinking the bar to one line and back redrew the gauge in a new frame each time. The gauge is now a plain picture while it isn't moving.
- **Terminal: Compact now didn't respond to Enter** — the focus got stuck in the text dropdown above it (see the terminal changes above).

## [0.7.0] — 2026-10-15

### Added
- **Version button · what changed in each version** — a version button at the right of the pane's tab row (normally a dim `v0.7.0`; *New N* when there is a new version; *What's new in N* on the first start after updating). Press it and the changes of every version above yours open under the tab row (the latest 6), with **[Check for updates]** and **[Update]** — you can check again after updating. The update row at the top of Settings, the new-version card at the top of Overview and the dot (•) on the Settings tab are folded into this button.
- **Folding settings** — like the app's new side panel, each section folds with the **⌄** / **›** beside its title. Only **Screen** is open at first, and a folded section shows its current value beside the title (*Full · Animations on*, *1 h cache · Cache expires in 30 min* and so on). Overview's *This session*, *Cost per question* and *Compact* use the same headers.
- **Context number format** — Settings → Bar — every screen → **Context numbers** [Size | % | Both]. The bar's context and compact range, and the gauge chip, show `281k`, `28%` (of the max context — the same as the app's context ring) or both.
- **Agent character** — on the desktop, a small pixel bug takes the 🤖's place. It walks only while that agent is running and stands still when it's done (always still with **Animations** off or your OS's reduce-motion on). The terminal keeps 🤖.

### Changed
- **Hovering the gauge or compact button shows the range too** — the chip's first line reads *Context 140k · compact range 200k~250k* (in the number format you picked).
- **Animations switch** — Settings' *Motion [System | Reduce]* is now an **Animations** on/off switch. Even when on, your OS's reduce-motion setting stops them.
- **Screen section · Bar — every screen** — the **Screen** section holds only the screen type, the preview and what that screen decides (answer chip details · cost row · question row); what doesn't depend on it (limits row · All sessions · session-cost colors · cost order · context numbers · bar size · animations) moved to **Bar — every screen**, so it's clear what follows the screen type.
- **? works everywhere** — hover the **?** next to a name for its explanation, press it to keep it open. The **?** in Overview's Compact card can be pressed now (it couldn't before).

### Fixed
- **The bar's session cost started over from $0 after restarting the app** — each session's cost is kept in the data folder on this PC and counting continues. Older sessions with no kept value start from the sum of their question costs.
- **The compact button's chip covered the ◔ above it** — a chip such as *Compact now advised* floated over the button and blocked the ◔ button right above. The chip now opens outside, to the left of the gauge and button.
- **"N downloaded — restart the app to apply" stayed after updating** — after restarting, that line stayed and there was no [Check for updates]. Now it returns to *Up to date* once the versions match, and you can check again any time.
- **Korean left on the English screen** — the pane title opened by an older version (*사용량*), the change list after switching language, and recorded step names (*답변 작성* · *하위 에이전트*) now show in the current language.

### Removed
- **Changing the cache lifetime** — the Custom screen's [Automatic · 1 hour · 5 min] edited `promptCacheTtl` in your Claude Code user settings file. That wasn't intended, so it's gone, and easy-compact no longer writes Claude Code's settings. The current lifetime, what sets it and the 1-hour vs 5-minute trade-off are still shown under Settings → **Cache**. A lifetime you picked with an earlier version stays as the `promptCacheTtl` line in your Claude Code user settings (`~/.claude/settings.json`) — delete that line to go back to automatic.
- **The hook on agent launches** — agent names are now read from Claude Code's agent list. Nothing looks different.

## [0.6.1] — 2026-10-15

### Fixed
- **The bar right after a compact** — from the end of a compact until the next request, the bar kept the size from before the compact (say 255k), said *Compact overdue* and still showed the last-question line. Now it shows the size the engine reports after the compact with *just compacted*, and hovering the button says *Just compacted · 255k → 18k · saves ~$0.28 per question*. The gauge stays at the smaller size too (on 0.6.0 it drained and then filled back up).

## [0.6.0] — 2026-10-15

### Added
- **Context gauge** — the icon in front of the bar's compact button is now a gauge (desktop), a ring like the app's own context ring. How full it is shows the current context; its color shows the stage (not yet: dim · *Time to compact*: orange · *Compact overdue*: red), and the sizes where the color changes follow your compact range. When compacting is overdue and the button can be pressed it pulses (faster the deeper into red, under 3 times a second), and when a compact finishes it visibly drains. The pane's tab row and confirm-card titles use the same gauge. Turn the motion off in Settings → Screen → **Motion** [System|Reduce] (your OS's reduce-motion setting is followed too). The terminal keeps no icon.
- **Two compact texts** — Settings → Compact text: **① Text sent before compacting** (the save turn of [Save & compact]) and **② Text after /compact** (what the summary should keep — also added for [Compact now]). Picking from the dropdown (Normal · Long-session handoff · Wrap-up) fills both boxes; saving an edited box switches to *Write my own*. The lost-information check and the [Compact go] marker are still added by the mod around your text. Text you wrote in the old *Custom* box is kept in box ①.
- **New-version card** — when the marketplace copy already downloaded on this PC has a newer version, the top of the Overview tab shows *New version N* **[What changed ▸] [Update] [Close]**. The copy is re-read every time you open the pane (no network — Claude Code downloads the copy). Close it and that version is not announced again. Installed from Anthropic's directory (claude.ai)? Then the update row has no buttons and says *Claude Code picks up new versions by itself when it starts*.
- **Question costs in reopened sessions** — each session's question list is saved to a file (last 60), so per-question costs show up after restarting the app or opening an older session. Older sessions with no such file are rebuilt from the transcript (*rebuilt from the transcript* — the app's own requests are left out).
- **Stopped questions** — a question you stop mid-answer now keeps its row, marked *⏹ stopped*. Interrupted requests and the app's own requests in between count toward it (before, a stopped question with no finished request vanished with them).
- **Unknown-model notice** — when a new model isn't in the mod's price table yet, it is priced with its family's rates, and a ⚠ next to the bar's session amount (hover for why) and a note line in Overview say *prices may be off — to be fixed in a later version*. With a context window over 1M, the compact range list and the cap on a size you enter grow with the window.

### Changed
- **Settings look like the app's settings** — instead of gray folding bands: bold section titles and one *name …… control* row each, with a faint line between rows. A row's explanation shows when you hover the **?** next to its name (in the terminal, press [ ? ] to unfold it); on/off rows are blue switches (dimmed when the screen type locks them), pick-one rows are segmented buttons and value lists are dropdowns. Settings show the same amount of text whatever the screen type, and the preview is always there. The update row moved to the top (it was hard to find at the bottom).
- **Compact timing lives in the Overview tab** — moved from Settings. The Simple view puts the range dropdown in the *This session* card with one line under it (verdict · one read · one question · cold-cache cost); the Detailed view puts it in the Compact card with the suggested and not-advised ranges and a colored **Cost by size** table (the picked range is outlined). Picking applies to all sessions at once (no Apply · Cancel), and **Enter a size…** at the end of the dropdown sets a single size by number (Enter).
- **Cost order** — Settings → Screen, under the bar preview: six orders of Session · Today · This month. The preview and the bar change right away.
- **Pane name "Easy Compact" · first tab "Overview"** — *📊 Usage* didn't match what it holds. The bar's pane button 📊 is now **◔**. Overview's [Simple|Detailed] remembers your pick (changing the screen type in Settings resets it to that screen's view), and whether the chip under each answer shows details is the **Answer chip details** switch (the old *Detail level* — changed on the Custom screen). Card title bands are gone (desktop), and folding is the small **▾ ▸** chip in front of each title.
- **The bar's compact button** — reads **Compact** while idle; opening the confirm card keeps the name and adds **▾** (it used to show ✕, easy to mix up with the window ✕ right above it). The gauge is the only status picture — the pulsing dot is gone. The ✕ that folds the bar is drawn as the app's close button.
- **"Good time to compact" → "Time to compact", range color yellow → orange** — on the bar, chips, pane, settings and the flow graph's reference lines. A single compact size now says *Compact soon* · *Compact advised*. The yellow of usage-limit and cache warnings stays.
- **Confirm card** — the text is a dropdown, and what the chosen text does is two lines (*Save* · *Reply*). With a cold cache the cost line is red; when compacting now costs more, the title says *Compacting now would cost more than it saves*. Title icons are all gauges.
- **Newest step on top** — for the running question and finished ones alike, the latest steps are on top and the rest fold into one *N earlier steps* line at the bottom (finished questions used to show their 20 most expensive steps). The chip under each answer does the same. Question costs [All] shows up to 20 questions and compact effects [All] up to 10 — what the pane can draw at once.
- **Text colors follow the app theme** — warning, error and success text use the app's theme colors, so they stay readable in the light theme (before, fixed colors put yellow text on white at 1.4:1). One orange. Usage-limit bars use the app's usage-bar colors (blue, red at 100%).
- **Terminal** — Settings section bands are less bright, the picked button shows ✓, text inputs have a border, and on/off rows are [Off | On] (both dimmed when locked). On a narrow bar the status name (*Time to compact* and so on) is never shortened; the cost line splits into two lines instead — the terminal has no gauge, so the name is the status.

### Fixed
- **This month's amount came out low** — when a subagent transcript wrote one response over several lines, only the first line's output was counted (on the author's PC a month lost about 2.59M output tokens ≈ $52). The largest value of the response is counted now — this month is recounted on first start. Days are cut at UTC, and the amounts lose the tilde (~); the pane line is named *All sessions (est.)* instead.
- **The bar said "overdue" while the confirm card said "loss"** — the size right after a compact was taken from the first request after it (with the new question and tool results already in), so it came out too big. The compact result Claude Code reports is used now.
- **The same error line repeated when node is missing** — after a failed measurement it waits 10 minutes before trying again (turning the option on retries at once).
- **Wrapped lines started with "·"** — on the bar, the settings preview and Overview, an overflowing line now breaks between cells with no dot at the start of the new line, and a single word such as *break even* or *★ Best* no longer drops to a line of its own.

## [0.5.1] — 2026-10-14

### Added
- **"All sessions" line at the top of the usage pane** — `All sessions  Today ~$65 · This month ~$788` (every session on this PC, API list prices), paired with the *This session · Total $* card right below it. The Detailed view (detail level Everything) always shows it, whatever the option says; the Simple view (Minimal) shows only what you turned on (today, this month or both) — and nothing, as before, if you turned neither on. The *This session* card holds this session's context, compact verdict and cost, so the all-session totals get their own line above it. While measuring for the first time it reads *Measuring…*; if it can't measure it says *Not measured* and why (needs Node 14.8+).

### Changed
- **Settings row "All sessions"** — All screens → *All usage* [Today] [This month] is now **All sessions**. When on, the amounts also show on the bar's cost row and in the Simple pane (the Detailed pane always shows them).
- **When other sessions' transcripts are read** — only while that option is on or the usage pane is open in the Detailed view (before: only with the option on). Nothing is read while you're not looking at the pane. Only token counts are read; still no network and no tokens used.
- **Korean UI** — the bar's first label is now **세션** (Session), like the English one, so it lines up with the labels next to it and a narrow bar keeps one more cell. The pane's first card keeps **이 세션** (This session).

## [0.5.0] — 2026-10-14

### Added
- **Check for updates** — an *easy-compact* section at the bottom of the Settings tab: **[Check for updates]** → if there is a new version, **[What changed ▸]** · **[Update]** → *restart the app to use it*. Only when you press it does Claude Code fetch the marketplace from GitHub (`claude plugin marketplace update` · `claude plugin update` — easy-compact itself never goes online). If the marketplace copy already on this PC is newer at startup, the Settings tab gets a dot (**⚙ Settings •**); the first time you start after updating, the usage pane opens with one line, *Updated to 0.5.0* (close it and it stays gone). No automatic checks. Marketplace installs only.
- **Today · this month** (option, off by default) — Settings → Screen → Details → All screens → **All usage** [Today] [This month]. When on, the bar's cost row shows `Today ~$65 · This month ~$788` after *This session*: every session on this PC (subagents included) at API list prices — not your subscription bill or limits; app-internal requests are not in the transcripts, hence `~`. The first time it reads this month's transcripts once (a few seconds), after that only changed files — when an answer ends and every 5 minutes. Needs Node.js.
- **Icons** — the glyphs on card titles, the bar's compact button, confirm cards, hold and cold cache (💰 🧾 🗜 🧊 🔄 ⏸) are now one set of line icons (desktop). Emoji looked different on every OS and font, so one screen mixed styles. Text inside buttons and the terminal are unchanged.

### Changed
- **Fits the pane and the window** — desktop column math now follows the app's own renderer (1 column = one character of the body font). Cards fill the pane and bars and graphs grow to the card width (they stopped at 320px, leaving wide panes empty on the right). When space runs out nothing breaks mid-word; the least important cells go first — bar: compact range → per request → shorter cache → this month → today; question row: agents → request count; if it still does not fit the button reads *Compact*. Settings cost table: vs optimum → if the cache goes cold → one question → one read.
- **Name column** — in name–value rows the name column fits the longest name in that card; when the values get too narrow they move below the names.
- **One meaning per color** — card titles in the normal text color (teal on the gray title band was hard to read), progress (saving · compacting) blue, a single yellow, net loss red, ★ optimum green, and the cache-expired / model-changed dot red. The color legend line at the bottom of the pane is gone.
- **One pick button** — tabs, choices, views, prompts and language all use the same button; the picked one is filled. No ✓ on desktop (it widened only the picked button and pushed its neighbor), ✓ in the terminal.
- **Names** — bar size *Max · Min* → **Full · One line**, and the first card is **This session** in both views (running total next to the title). The view switch sits at the right end of the pane's tab row: `View [Simple][Detailed]`.
- **"Now" in the simple view is one decision line** — state + one number + what to do (room left · good time · overdue · cache expired · little to save). The separate verdict line is gone.
- **The cold-cache bar shows the state only** — 🧊 cache expired · context (🔄 if the model changed), and the button reads *Compact now advised*. The money part (next request ~$ · compacting now costs ~$ less or more) lives in the tooltip, the confirm card and the pane.
- **Cost per question starts folded** — when the usage pane opens, This session and Compact are open.
- **The applied value sits in the card's title band** — the *Applied* cell at the end of the settings cost table shrank to one character and stood on end when narrow. Compact timing labels sit outside, next to their own tick.
- Screen descriptions in Settings are one line each.
- **No tooltips on terminal buttons** — a bright chip covered the button and made it hard to click. The pane button always uses its short form.
- **Easy Compact dims while an answer runs** — same name, so its width stays put.

### Fixed
- **A finished question's cost changed when you sent the next one** — requests the app sends on its own after an answer (titles, summaries…) count toward that question for 30 seconds only, then it is fixed; anything later goes to the next question's ⚙ line.
- The bar size description listed the wrong cells for the one-line bar.
- In a narrow settings preview, the limits row's reset text overlapped the window buttons.

## [0.4.1] — 2026-10-13

### Changed
- **Three screens — Simple · Detailed · Custom** (0.4.0's Basic is gone: its bar matched Detailed and only the pane view differed). Settings say who each one is for.
  - **Simple** — for newcomers, anyone for whom tokens and caching are unfamiliar, or who wants only the essentials. Less is the rule: a one-line bar (session cost · context · cache · Easy Compact; no limits row, no [—]), the simple pane (no model comparison), compact timing as size ranges and the verdict only, no cache section, and the compact prompt as a choice only.
  - **Detailed** — for people who know how AI costs work (tokens, caching, requests). Everything easy-compact has: limits, per request, compact range, the question row, the detailed pane and the full cost table.
  - **Custom** — pick the bar's parts and the **Detail level** (Minimal · Everything) yourself. The detail level sets the pane's starting view (Simple · Detailed) and how much Settings, the line under answers and the working line say — 0.4.0's *Pane view* detail is folded into it.
- **New installs and updates start on Simple** — too much at first is off-putting. 0.4.0's Basic and pre-0.4.0 settings with every part on become Simple; a chosen Detailed, Custom or parts you turned off stay.
- **The limits row and session-cost colors apply to all screens** — under Screen → Details (after a gap), changeable on any screen. If a session has finished a request and still has no plan limits, the limits row option is left out (not assumed to be an API key — it stays until the first answer).
- **Cache shows as `cache expires in 42m`** — `42/60m` didn't read at a glance.
- **No compacting at a loss** — when the cache is cold and continuing is cheaper (compacting now costs more), or there is little to save, the Easy Compact card shows *Keep working* and **✓ OK · keep working** with no compact buttons (save or direct). Before, Save & compact stayed available at a loss, and with a cold cache the save question carried no payoff numbers, so the session looked only at information (*everything is saved to memory, nothing to lose*) and went on to compact — continuing would only have re-warmed the cache.
- **The save question asks only about lost information** — easy-compact makes the money call with numbers (no buttons at a loss), and the session only checks whether information would be lost. Payoff numbers are no longer passed. Step ① in Settings → compact prompt is now *Check* (lost information).
- **Cost per question**: the simple view drops ▸ and shows `N requests · 🤖 N agents` per question (agent requests included); the detailed view says `1 agent $3.56 included` and opens into *main N requests $* and *🤖 N agents · N requests $* (a bare 🤖 $ next to the total was confusing). The line under answers, the bar's question row and the working line follow the same form.
- **The question cost after each answer (`This question $X · N requests`) stands out** — it was dim grey and got lost between answers. On the desktop it's a rounded blue-bordered chip (🧾), all text blue with the amount in bold; in a terminal the same blue line without a border (a border adds two lines per answer). No colors by amount — a big task isn't a bad one. Only the *cache rewrite* warning stays yellow. It sits one line below the answer, and at detail level **Everything**, **▸ Details** at the end of the chip opens that question's main · 🤖 agent · app breakdown and per-step costs like an opened question in the detailed Usage pane (closed at first. The top ` - ` lines — main · 🤖 · 🗜 · ⚙ — add up to the question's cost; step lines sit further in under main and split its cost — the 10 costliest, the rest on one line). The first line keeps just the total and request count — app requests and compacts are in the opened lines (in a terminal, "… incl." on the line). The terminal keeps the one line.
- **Question highlight** — hover the question-cost chip after an answer, or that question's row in the Usage pane, and the chip, the row and the answer in the chat turn gray together, so you see which answer a cost belongs to. Hovering the answer text itself does nothing, and the chat doesn't scroll. The chip in the Settings preview lights the same way. Desktop only; Settings → Screen → Details → All screens → **Highlight** (on by default).
- **Tidier Settings** — Details now starts with the **Detail level** (the broad switch for the pane, Settings and the answer chip), then the bar parts, then All screens. The terminal's Settings tab leaves out the options it can't use (Highlight, Pane sync). Question titles in the Usage pane are plain text — the ▸ button on the left opens and closes them.
- **`Question (10 req assumed)` in the cost table** — one question is fixed at 10 requests. Counting this session's average made big tasks look ever pricier, so it was no reference point. The line below shows *10 requests assumed*, this session's average request count and the 100k–1M range at that count, in color.
- **Simple · Detailed** at the top of the pane is a quick look — closing the pane or visiting Settings returns to your detail level.
- Settings sections: Screen and its Details start open. Switching between Usage and Settings with the pane open keeps what you opened; closing the pane resets it.
- Language: *Auto* when unknown, *Auto (English)* when known.
- In a narrow terminal (the CLI with the pane open) the pane button is shortened to `Usage ✕` — it squeezed the one-line bar's text.
- The plugin description's *Tested on Windows* became *Requires Claude Code 2.1.295+*. The README gains **Requirements** (checking and updating the engine, git, where it shows, Node.js), **Bar not showing?**, and macOS · Linux install commands.

### Added
- **A preview in Settings → Screen** — the bar above the input and the question-cost chip after each answer (sample: the last question, or labelled example values in a new session), as the chosen screen and detail level draw them. Checkmarks alone didn't show what would change.
- **Old-engine notice** — on Claude Code older than 2.1.295 (Homebrew's stable channel, for one), where it can start, easy-compact draws a one-line update notice instead of the bar and pane, and doesn't open the pane by itself. If the version can't be read, it runs as usual.
- Without `node` to read a record over 4 MB, it says *install Node.js 14.8+ and restart the app*.

### Removed
- The bar's *question average* part — it took room, and the pane's cost summary already has *per question*.
- The *🤖 under answers* option — it follows the screen (detail level).

### Fixed
- Text after *This session $X ·* on the cost row sat one line high on the desktop.
- The Simple screen's bar took two lines (Easy Compact alone on an empty left) — now one. When the full bar is already one line, the minimized bar matches it (it used to just hide the cache part, acting like a cache toggle).
- The one-line bar's hold ⏸ went to the terminal as a picture glyph.
- Step names showed the whole path for Windows backslash paths instead of the file name.
- In a session with many questions, choosing **All** in cost per question left the Usage pane blank ("Nothing to show yet", dead buttons) — the drawing was larger than the desktop takes at once. Past 30 questions the buttons read **Last 5 · Last 30**, with the earlier questions' count and total on one line under the 30 (the header total still covers all). Compact results likewise draw **Last 15** past 15 compacts. An opened question likewise draws its 20 costliest steps as rows (in order) and the rest as one `N more steps $X` line — opening a question with many requests came close to the limit (the answer chip's line now says "more in the Usage pane"). If drawing the pane ever fails, it shows the reason in red instead of a blank pane.

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
