import type { CostParts, EffortOutput, LiveTurn, QuestionCells, StepDetail, StepSwitch, Tokens, TurnsOlder, TurnSummary } from '../types'
import { costOf, dayOf, engineOfLine, modelKey, tailOf } from './cost'
import { advisorTokensOf } from './flow'
import type { AdvisorCall, FlowRecord } from './flow'
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
  const models = addModelCounts(undefined, o.advisorModels)
  const advisor = isNum(o.advisorUsd) && o.advisorUsd > 0 ? { advisorUsd: o.advisorUsd, advisorCalls: isNum(o.advisorCalls) ? o.advisorCalls : 0, ...(models ? { advisorModels: models } : {}) } : {}
  return { count: o.count, usd: o.usd, agentUsd: o.agentUsd, appUsd: o.appUsd, ...advisor, ...(o.rebuilt === true ? { rebuilt: true as const } : {}) }
}

export function addModelCounts(a: Readonly<Record<string, number>> | undefined, b: unknown): Record<string, number> | undefined {
  const out: Record<string, number> = { ...(a ?? {}) }
  if (b && typeof b === 'object') {
    for (const [m, n] of Object.entries(b as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[m] = (out[m] ?? 0) + n
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function foldOlder(older: TurnsOlder, dropped: readonly TurnSummary[]): TurnsOlder {
  return dropped.reduce<TurnsOlder>((o, t) => {
    const advisorUsd = (o.advisorUsd ?? 0) + (t.advisorUsd ?? 0)
    const advisorCalls = (o.advisorCalls ?? 0) + (t.advisorCalls ?? 0)
    const advisorModels = addModelCounts(o.advisorModels, t.details?.find(d => d.advisor)?.advisorModels)
    return {
      count: o.count + 1,
      usd: o.usd + t.cost.usd,
      agentUsd: o.agentUsd + (agentSum(t.details)?.usd ?? 0),
      appUsd: o.appUsd + (t.appUsd ?? 0),
      ...(advisorUsd > 0 ? { advisorUsd, advisorCalls, ...(advisorModels ? { advisorModels } : {}) } : {}),
      ...(o.rebuilt || t.rebuilt ? { rebuilt: true as const } : {}),
    }
  }, older)
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

export type AgentRun = { id: string; firstAtMs: number; lastAtMs: number; steps: number; byModel: Record<string, Tokens>; engine?: string; advisor?: { model: string; tokens: Tokens }[] }

export function agentRunFromText(id: string, text: string, own: string | null = null): AgentRun | null {
  const seen = new Map<string, Tokens>()
  const byModel: Record<string, Tokens> = {}
  const advised = new Set<string>()
  const advisor: { model: string; tokens: Tokens }[] = []
  const addAdvisor = (msgId: string, u: Record<string, unknown>) => {
    if (advised.has(msgId)) return
    const list = advisorTokensOf(u)
    if (list.length === 0) return
    advised.add(msgId)
    advisor.push(...list)
  }
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
      addAdvisor(m.id, u)
      continue
    }
    addAdvisor(m.id, u)
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
  return steps > 0 ? { id, firstAtMs, lastAtMs, steps, byModel, ...(engine ? { engine } : {}), ...(advisor.length > 0 ? { advisor } : {}) } : null
}

export function turnsFromRecords(records: readonly FlowRecord[], agents: readonly AgentRun[] = []): TurnSummary[] {
  type Q = { startMs: number; endMs: number; prompt: string; steps: number; cost: CostParts; ctx: number | null; model?: string; details: StepDetail[]; advisorUsd: number; advisorCalls: number }
  const qs: Q[] = []
  let cur: Q | null = null
  const open = (atMs: number, text: string): Q => {
    const q: Q = { startMs: atMs, endMs: atMs, prompt: promptHead(text), steps: 0, cost: ZERO, ctx: null, details: [], advisorUsd: 0, advisorCalls: 0 }
    qs.push(q)
    return q
  }
  const addAdvisor = (q: Q, tokens: Tokens, model: string, atMs: number, engine: string | null) => {
    const usd = costOf(tokens, model, undefined, dayOf(atMs), engine)?.usd ?? 0
    q.cost = { ...q.cost, usd: q.cost.usd + usd }
    q.advisorUsd += usd
    q.advisorCalls++
    q.details = withAdvisorStep(q.details, usd, 1, model !== '?' ? { [model]: 1 } : undefined)
  }
  for (const r of records) {
    if (r.kind === 'q') cur = open(r.atMs, r.text ?? '')
    else if (r.kind === 'a') addAdvisor(cur ?? (cur = open(r.atMs, '')), r.tokens, r.model, r.atMs, r.engine ?? null)
    else if (r.kind === 'p') {
      const q = cur ?? (cur = open(r.atMs, ''))
      q.steps++
      q.cost = addCost(q.cost, costOf(r.tokens, r.model, undefined, dayOf(r.atMs), r.engine ?? null))
      q.ctx = r.ctx ?? r.tokens.input_tokens + r.tokens.cache_read_input_tokens + r.tokens.cache_creation_input_tokens
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
    for (const x of a.advisor ?? []) addAdvisor(target, x.tokens, x.model, a.firstAtMs, a.engine ?? null)
  }
  return qs
    .filter(q => q.steps > 0)
    .map((q, i) => ({
      tail: '',
      steps: q.steps,
      cost: q.cost,
      ...(q.advisorCalls > 0 ? { advisorUsd: q.advisorUsd, advisorCalls: q.advisorCalls } : {}),
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

export const CELLS_TOOLS_MAX = 500
export const CELLS_TAILS_MAX = 200
export const CELL_SCOPES_MAX = 5000

export function nextQuestionCells(cells: QuestionCells, add: { tool?: string; answer?: string }): QuestionCells {
  const tool = add.tool ?? ''
  const tail = add.answer ? tailOf(add.answer) : ''
  const tools = tool && !cells.tools.includes(tool) && cells.tools.length < CELLS_TOOLS_MAX ? [...cells.tools, tool] : cells.tools
  const tails = tail && !cells.tails.includes(tail) && cells.tails.length < CELLS_TAILS_MAX ? [...cells.tails, tail] : cells.tails
  return tools === cells.tools && tails === cells.tails ? cells : { ...cells, tools, tails }
}

export function withCellScopes(prev: Readonly<Record<string, string>>, cells: QuestionCells, scope: string): Record<string, string> {
  const add = [...cells.tools.map(id => `t:${id}`), ...cells.tails.map(t => `m:${t}`)]
  if (add.length === 0) return { ...prev }
  const fresh = new Set(add)
  const kept = Object.entries(prev).filter(([k]) => !fresh.has(k))
  return Object.fromEntries([...kept, ...add.map(k => [k, scope] as const)].slice(-CELL_SCOPES_MAX))
}

export function cellScopeOf(scopes: Readonly<Record<string, string>>, cell: { toolIds?: readonly (string | undefined)[]; text?: string }): string | null {
  for (const id of cell.toolIds ?? []) {
    const hit = id ? scopes[`t:${id}`] : undefined
    if (hit) return hit
  }
  if (cell.text === undefined) return null
  const exact = scopes[`m:${tailOf(cell.text)}`]
  if (exact) return exact
  const block = cell.text.replace(/\s+/g, ' ').trim()
  if (!block) return null
  let found: string | null = null
  for (const [key, scope] of Object.entries(scopes)) {
    if (!key.startsWith('m:')) continue
    const tail = key.slice(2)
    if (block.endsWith(tail) || (block.length >= 20 && tail.endsWith(block))) found = scope
  }
  return found
}

export function nextEffortOutput(prev: readonly EffortOutput[] | undefined, effort: string | undefined, usd: number): EffortOutput[] {
  const key = effort ?? ''
  const list = prev ?? []
  const i = list.findIndex(e => e.effort === key)
  if (i < 0) return [...list, { effort: key, usd }]
  return list.map((e, j) => (j === i ? { ...e, usd: e.usd + usd } : e))
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

export function withAdvisorStep(details: readonly StepDetail[], usd: number, calls: number, models?: Readonly<Record<string, number>>): StepDetail[] {
  const i = details.findIndex(d => d.advisor)
  if (i < 0) {
    const added = addModelCounts(undefined, models)
    return calls > 0 ? [...details, { label: 'advisor', usd, advisor: calls, ...(added ? { advisorModels: added } : {}) }] : [...details]
  }
  return details.map((d, j) => {
    if (j !== i) return d
    const merged = addModelCounts(d.advisorModels, models)
    return { ...d, usd: Math.max(0, d.usd + usd), advisor: (d.advisor ?? 0) + calls, ...(merged ? { advisorModels: merged } : {}) }
  })
}

export function trimDetails(details: readonly StepDetail[], max: number): StepDetail[] {
  if (details.length <= max) return [...details]
  const advisor = details.findIndex(d => d.advisor)
  const cut = details.slice(-max)
  return advisor < 0 || advisor >= details.length - max ? cut : [details[advisor]!, ...cut.slice(1)]
}

export function advisorModelSum(details: readonly StepDetail[] | undefined): number {
  return Object.values(details?.find(d => d.advisor)?.advisorModels ?? {}).reduce((s, n) => s + n, 0)
}

export function withAdvisorModelsUpTo(details: readonly StepDetail[], calls: number, models: Readonly<Record<string, number>>): StepDetail[] {
  return calls > 0 && advisorModelSum(details) >= calls ? [...details] : withAdvisorStep(details, 0, 0, models)
}

export function setAdvisorModels(details: readonly StepDetail[], models: Readonly<Record<string, number>>): StepDetail[] {
  const i = details.findIndex(d => d.advisor)
  return details.map((d, j) => (j === i ? { ...d, advisorModels: { ...models } } : d))
}

export function fillAdvisorModels(
  list: readonly TurnSummary[],
  calls: readonly AdvisorCall[],
  skip: ReadonlySet<string>,
  hasOlder: boolean,
): { list: TurnSummary[]; seen: number; filled: number; why: Record<string, number> } {
  const done = calls.filter((c): c is AdvisorCall & { atMs: number } => c.isDone && c.atMs !== null)
  const why: Record<string, number> = {}
  let seen = 0
  let filled = 0
  const out = list.map((t, i) => {
    const n = t.advisorCalls ?? 0
    if (n <= 0 || advisorModelSum(t.details) >= n) return t
    seen++
    const lo = i > 0 ? list[i - 1]!.atMs : -Infinity
    const found = done.filter(c => c.atMs > lo && c.atMs <= t.atMs)
    const miss =
      t.turnId !== undefined && skip.has(t.turnId)
        ? 'pending'
        : i === 0 && hasOlder
          ? 'first'
          : !t.details?.some(d => d.advisor)
            ? 'noLine'
            : found.length !== n
              ? 'count'
              : found.some(c => !c.model)
                ? 'model'
                : null
    if (miss) {
      why[miss] = (why[miss] ?? 0) + 1
      return t
    }
    const models: Record<string, number> = {}
    for (const c of found) models[c.model!] = (models[c.model!] ?? 0) + 1
    filled++
    return { ...t, details: setAdvisorModels(t.details ?? [], models) }
  })
  return { list: out, seen, filled, why }
}

export function advisorCallsOf(uses: readonly { name: string; endedAt?: number }[] | undefined): number {
  return (uses ?? []).filter(u => u.name === 'advisor' && u.endedAt !== undefined).length
}

export function olderOf(fileOlder: TurnsOlder | null, list: readonly TurnSummary[]): TurnsOlder | null {
  return fileOlder ?? (list.length < TURNS_KEEP ? NO_OLDER : null)
}
