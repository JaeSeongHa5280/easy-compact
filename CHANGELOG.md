# Changelog

All notable changes to easy-compact. Versions follow [Semantic Versioning](https://semver.org/) (0.x: anything may still change). [한국어](CHANGELOG.ko.md)

**Update:** `claude plugin marketplace update easy-compact`, then `claude plugin update easy-compact@easy-compact`, then restart Claude — see [Update](README.md#update).

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

[0.3.0]: https://github.com/JaeSeongHa5280/easy-compact/releases/tag/v0.3.0
[0.2.0]: https://github.com/JaeSeongHa5280/easy-compact/tree/v0.2.0
[0.1.0]: https://github.com/JaeSeongHa5280/easy-compact/tree/v0.1.0
