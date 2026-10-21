import type { CostParts, LiveTurn, StepDetail, StepSwitch, Tokens, TurnsOlder, TurnSummary } from '../types'
import { costOf, dayOf, engineOfLine, modelKey } from './cost'
import type { FlowRecord } from './flow'
import { L } from './i18n'
import { agentSum, promptHead } from './text'

export const TURNS_V = 1

export const TURNS_KEEP = 60

export const NO_OLDER: TurnsOlder = { count: 0, usd: 0, agentUsd: 0, appUsd: 0 }

export function serializeTurns(list: readonly TurnSummary[], older: TurnsOlder | null = null): string {
  return JSON.stringify({ v: TURNS_V, turns: list, ...(older ? { older } : {}) })
}

export function parseTurnsOlder(text: string): TurnsOlder | null {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return null
  }
  const o = (j as { older?: Partial<TurnsOlder> } | null)?.older
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (!o || !isNum(o.count) || !isNum(o.usd) || !isNum(o.agentUsd) || !isNum(o.appUsd)) return null
  return { count: o.count, usd: o.usd, agentUsd: o.agentUsd, appUsd: o.appUsd, ...(o.rebuilt === true ? { rebuilt: true as const } : {}) }
}

export function foldOlder(older: TurnsOlder, dropped: readonly TurnSummary[]): TurnsOlder {
  return dropped.reduce<TurnsOlder>(
    (o, t) => ({
      count: o.count + 1,
      usd: o.usd + t.cost.usd,
      agentUsd: o.agentUsd + (agentSum(t.details)?.usd ?? 0),
      appUsd: o.appUsd + (t.appUsd ?? 0),
      ...(o.rebuilt || t.rebuilt ? { rebuilt: true as const } : {}),
    }),
    older,
  )
}

export function olderFromRebuilt(rebuilt: readonly TurnSummary[], kept: readonly TurnSummary[]): TurnsOlder | null {
  const first = kept[0]
  if (!first) return null
  const cut = rebuilt.findLastIndex(t => t.atMs <= first.atMs + 2_000)
  return cut < 0 ? null : foldOlder(NO_OLDER, rebuilt.slice(0, cut))
}

export function parseTurnsFile(text: string): TurnSummary[] | null {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return null
  }
  const o = j as { v?: unknown; turns?: unknown } | null
  if (!o || o.v !== TURNS_V || !Array.isArray(o.turns)) return null
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  return (o.turns as unknown[]).filter((t): t is TurnSummary => {
    const s = t as Partial<TurnSummary> | null
    return !!s && typeof s.prompt === 'string' && isNum(s.steps) && isNum(s.atMs) && !!s.cost && isNum(s.cost.usd)
  })
}

const ZERO: CostParts = { read: 0, write: 0, output: 0, input: 0, usd: 0 }

function addCost(a: CostParts, b: CostParts | null): CostParts {
  return b ? { read: a.read + b.read, write: a.write + b.write, output: a.output + b.output, input: a.input + b.input, usd: a.usd + b.usd } : a
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export type AgentRun = { id: string; firstAtMs: number; lastAtMs: number; steps: number; byModel: Record<string, Tokens>; engine?: string }

export function agentRunFromText(id: string, text: string, own: string | null = null): AgentRun | null {
  const seen = new Map<string, Tokens>()
  const byModel: Record<string, Tokens> = {}
  let firstAtMs = 0
  let lastAtMs = 0
  let steps = 0
  let engine: string | undefined
  for (const line of text.split('\n')) {
    if (!line.includes('"usage"')) continue
    let r: { type?: unknown; timestamp?: unknown; version?: unknown; sessionId?: unknown; message?: { id?: unknown; model?: unknown; usage?: Record<string, unknown> } }
    try {
      r = JSON.parse(line) as typeof r
    } catch {
      continue
    }
    if (own !== null && typeof r.sessionId === 'string' && r.sessionId !== own) continue
    const m = r.message
    if (r.type !== 'assistant' || !m?.usage || typeof m.id !== 'string') continue
    const u = m.usage
    const prev = seen.get(m.id)
    if (prev) {
      const out = num(u.output_tokens)
      if (out > prev.output_tokens) {
        const model = typeof m.model === 'string' ? m.model : '?'
        const t = byModel[model]
        if (t) t.output_tokens += out - prev.output_tokens
        prev.output_tokens = out
      }
      continue
    }
    const cc = (typeof u.cache_creation === 'object' && u.cache_creation !== null ? u.cache_creation : null) as Record<string, unknown> | null
    const tokens: Tokens = {
      input_tokens: num(u.input_tokens),
      output_tokens: num(u.output_tokens),
      cache_read_input_tokens: num(u.cache_read_input_tokens),
      cache_creation_input_tokens: num(u.cache_creation_input_tokens),
      ...(cc ? { cache_creation_5m: num(cc.ephemeral_5m_input_tokens), cache_creation_1h: num(cc.ephemeral_1h_input_tokens) } : {}),
    }
    seen.set(m.id, { ...tokens })
    const model = typeof m.model === 'string' ? m.model : '?'
    const t = byModel[model]
    if (t) {
      t.input_tokens += tokens.input_tokens
      t.output_tokens += tokens.output_tokens
      t.cache_read_input_tokens += tokens.cache_read_input_tokens
      t.cache_creation_input_tokens += tokens.cache_creation_input_tokens
      if (tokens.cache_creation_5m !== undefined || tokens.cache_creation_1h !== undefined) {
        t.cache_creation_5m = (t.cache_creation_5m ?? 0) + (tokens.cache_creation_5m ?? 0)
        t.cache_creation_1h = (t.cache_creation_1h ?? 0) + (tokens.cache_creation_1h ?? 0)
      }
    } else byModel[model] = { ...tokens }
    const at = Date.parse(String(r.timestamp ?? '')) || 0
    if (at > 0 && (firstAtMs === 0 || at < firstAtMs)) firstAtMs = at
    if (at > lastAtMs) lastAtMs = at
    if (engine === undefined) engine = engineOfLine(r.version)
    steps++
  }
  return steps > 0 ? { id, firstAtMs, lastAtMs, steps, byModel, ...(engine ? { engine } : {}) } : null
}

export function turnsFromRecords(records: readonly FlowRecord[], agents: readonly AgentRun[] = []): TurnSummary[] {
  type Q = { startMs: number; endMs: number; prompt: string; steps: number; cost: CostParts; ctx: number | null; model?: string; details: StepDetail[] }
  const qs: Q[] = []
  let cur: Q | null = null
  const open = (atMs: number, text: string): Q => {
    const q: Q = { startMs: atMs, endMs: atMs, prompt: promptHead(text), steps: 0, cost: ZERO, ctx: null, details: [] }
    qs.push(q)
    return q
  }
  for (const r of records) {
    if (r.kind === 'q') cur = open(r.atMs, r.text ?? '')
    else if (r.kind === 'p') {
      const q = cur ?? (cur = open(r.atMs, ''))
      q.steps++
      q.cost = addCost(q.cost, costOf(r.tokens, r.model, undefined, dayOf(r.atMs), r.engine ?? null))
      q.ctx = r.tokens.input_tokens + r.tokens.cache_read_input_tokens + r.tokens.cache_creation_input_tokens
      q.model = r.model
      q.endMs = Math.max(q.endMs, r.atMs)
    }
  }
  for (const a of agents) {
    let target: Q | undefined = qs[0]
    for (const q of qs) if (q.startMs <= a.firstAtMs) target = q
    if (!target) continue
    let c = ZERO
    let model = ''
    for (const [m, t] of Object.entries(a.byModel)) {
      c = addCost(c, costOf(t, m, 5, dayOf(a.firstAtMs), a.engine ?? null))
      model = m
    }
    target.cost = addCost(target.cost, c)
    target.details.push({ label: L('하위 에이전트', 'subagent'), usd: c.usd, write: c.write, read: c.read, output: c.output, input: c.input, agent: a.id, steps: a.steps, model, done: true, at: a.lastAtMs })
  }
  return qs
    .filter(q => q.steps > 0)
    .map((q, i) => ({
      tail: '',
      steps: q.steps,
      cost: q.cost,
      prompt: q.prompt,
      atMs: q.endMs,
      contextTokens: q.ctx,
      details: q.details,
      ...(q.model ? { model: q.model } : {}),
      turnId: `rebuilt-${i}`,
      rebuilt: true as const,
    }))
}

export const SWITCHES_KEEP = 20

export function nextSwitches(prev: LiveTurn, model: string, effort: string | undefined): StepSwitch[] | undefined {
  if (prev.steps === 0) return prev.switches
  const at = prev.steps + 1
  const add: StepSwitch[] = []
  if (prev.model && modelKey(prev.model) !== modelKey(model)) add.push({ at, kind: 'model', from: prev.model, to: model })
  if (prev.effort !== undefined && effort !== undefined && prev.effort !== effort) add.push({ at, kind: 'effort', from: prev.effort, to: effort })
  if (add.length === 0) return prev.switches
  return [...(prev.switches ?? []), ...add].slice(-SWITCHES_KEEP)
}

export function withAgentStep(details: readonly StepDetail[], agentId: string, label: string, cost: CostParts, model: string, atMs: number): StepDetail[] {
  const i = details.findIndex(d => d.agent === agentId)
  if (i < 0) return [...details, { label, usd: cost.usd, write: cost.write, read: cost.read, output: cost.output, input: cost.input, agent: agentId, steps: 1, model, done: false, at: atMs }]
  const d = details[i]!
  const merged = {
    ...d,
    label,
    usd: d.usd + cost.usd,
    write: (d.write ?? 0) + cost.write,
    read: (d.read ?? 0) + cost.read,
    output: (d.output ?? 0) + cost.output,
    input: (d.input ?? 0) + cost.input,
    steps: (d.steps ?? 0) + 1,
    model,
    at: atMs,
  }
  return [...details.slice(0, i), merged, ...details.slice(i + 1)]
}

export function withAppStep(details: readonly StepDetail[], label: string, usd: number): StepDetail[] {
  const i = details.findIndex(d => d.app && d.label === label)
  if (i < 0) return [...details, { label, usd, app: true }]
  return details.map((d, j) => (j === i ? { ...d, usd: d.usd + usd } : d))
}

export function olderOf(fileOlder: TurnsOlder | null, list: readonly TurnSummary[]): TurnsOlder | null {
  return fileOlder ?? (list.length < TURNS_KEEP ? NO_OLDER : null)
}
