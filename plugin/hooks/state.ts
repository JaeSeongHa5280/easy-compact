import { SESSION_TEXT, sessionColorOf } from './cost'
import type { PaneView, Settings, UpdateState, Usage } from '../types'

export const SEEN_VERSION_KEY = 'seenVersion'

export const CHECK_TOTAL_MS = 90_000

export const APPLY_TOTAL_MS = 150_000

export const UPDATE_GRACE_MS = 30_000

export const SPEND_RETRY_MS = 10 * 60_000

export const PANE = 'easy-compact'

export const AFTER_KEY = 'afterCompactTokens'

export const MIX_KEY = 'compactMix'

export const SUMMARY_KEY = 'compactSummaryTokens'

export const KEPT_KEY = 'compactKeptTokens'

export const OUTPUT_KEY = 'compactOutputTokens'

export const SAVE_KEEP = 5

export const SETTINGS_OPEN_DEFAULT: Record<string, boolean> = {}

export const DIAG_CLOSED = { open: false, where: 'drawer' as 'drawer' | 'gen', redact: true, copiedLines: null as number | null, savedPath: null as string | null }

export const CARDS_OPEN_DEFAULT = { now: true, history: false, compact: true }

export const UPDATE_IDLE: UpdateState = { phase: 'idle', own: null, market: null, marketAt: null }

export const PANE_MODE_KEY = 'paneModeChoice'

export const READ_LIMIT = 4 * 1024 * 1024 - 64 * 1024

export const PANE_EVENT_KEY = 'paneEvent'

export const PANE_AUTO_KEY = 'paneAutoOpened'

export const PANE_AUTO_KEEP = 200

export type PaneEvent = { view: PaneView | null; at: number; from: string }

export const paneLog: string[] = []

export const OLD_DEFAULT_RANGE = { rangeStart: 250_000, rangeEnd: 300_000 }

export const GAUGE_NOTE_KEY = 'gaugeDoorNoted'

export const GAUGE_NOTE_MS = 12_000

export const PER_Q_WINDOW = 10

export const PER_Q_MIN = 3

export function spendColors(s: Settings, today: number | null, month: number | null): { todayColor?: string; monthColor?: string } {
  const todayColor = today !== null ? sessionColorOf(today, s.todayColors) : undefined
  const monthColor = month !== null ? sessionColorOf(month, s.monthColors) : undefined
  return { ...(todayColor ? { todayColor } : {}), ...(monthColor ? { monthColor } : {}) }
}

export const GAUGE_SHRINK_MS = 1800

export const CTX_RANK = { ok: 0, warn: 1, cut: 2 } as const

export const sessRankOf = (color: string | undefined): number => (color === undefined ? 0 : (SESSION_TEXT as readonly string[]).indexOf(color) + 1)

export const agentInfo = new Map<string, { label: string; turnId: string | null; tries?: number }>()

export const listedAgents = new Set<string>()

export const AGENT_QUIET_MS = 2 * 60_000

export const AGENT_LIST_TRIES = 3

export const APP_FIX_MS = 30_000

export const LEDGER_COMPACTS_MAX = 300

export type Urgency = 'ok' | 'warn' | 'cut' | 'cold'

export const URGENCY_RANK: Record<string, number> = { ok: 0, warn: 1, cut: 2, cold: 3 }

export type SharedLimits = { at: number; rateLimits: Usage['rateLimits'] }

export const LIMITS_FILE = 'limits.json'

export function parseSharedLimits(raw: unknown): SharedLimits | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as { at?: unknown; rateLimits?: unknown }
  if (typeof r.at !== 'number' || !Array.isArray(r.rateLimits)) return null
  const rateLimits = r.rateLimits.filter(
    (x): x is Usage['rateLimits'][number] => typeof x === 'object' && x !== null && typeof x.kind === 'string' && typeof x.percentUsed === 'number',
  )
  return rateLimits.length > 0 ? { at: r.at, rateLimits } : null
}

export function freshestLimits(own: Usage['rateLimits'], ownAt: number | null, shared: SharedLimits | null, nowMs: number): { rateLimits: Usage['rateLimits']; isOwn: boolean } {
  const isOwn = own.length > 0 && (shared === null || (ownAt !== null && ownAt >= shared.at))
  const picked = isOwn || shared === null ? own : shared.rateLimits
  const live = picked.filter(r => !r.resetsAt || !(Date.parse(r.resetsAt) <= nowMs))
  return { rateLimits: live, isOwn }
}
