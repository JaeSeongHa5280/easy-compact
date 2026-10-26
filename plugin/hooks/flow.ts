import type { CompactEvent, CtxPoint, StepDetail } from '../types'
import { barAnimCss, CACHE_TTL_MIN, costOf, dayOf, engineOfLine, fmtTokens, LEVEL_HEX, levelOf, modelKey, ratesFor, thresholds, ttlOfTokens, writeRate } from './cost'
import type { Tokens } from './cost'
import { L } from './i18n'

export type Flow = { points: CtxPoint[]; compactions: CompactEvent[]; questions?: number[]; shared?: Record<string, number>; inherited?: boolean }

export const MAX_POINTS = 5000

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export type FlowRecord =
  | { kind: 'p'; atMs: number; tokens: Tokens; model: string; engine?: string }
  | { kind: 'c'; atMs: number; trigger: string; pre: number; post?: number }
  | { kind: 'q'; atMs: number; text?: string }
  | { kind: 'i' }

export function promptTextOf(content: unknown): string {
  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    const b = (content as { type?: unknown; text?: unknown }[]).find(x => x && x.type === 'text' && typeof x.text === 'string')
    text = typeof b?.text === 'string' ? b.text : ''
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

const PROMPT_ID = /"promptId":"([^"]+)"/

export const ULTRA_ON = '"attachment":{"type":"ultra_effort_enter"'
export const ULTRA_OFF = '"attachment":{"type":"ultra_effort_exit"'

export function ultraStateOf(text: string): boolean | null {
  const on = text.lastIndexOf(ULTRA_ON)
  const off = text.lastIndexOf(ULTRA_OFF)
  if (on < 0 && off < 0) return null
  return on > off
}

export function recordsFromTranscript(text: string, own: string | null = null): FlowRecord[] {
  const out: FlowRecord[] = []
  const seen = new Map<string, Tokens>()
  const seenBoundary = new Set<string>()
  const seenPrompt = new Set<string>()
  let carry: string | undefined
  let isOwnAsked = false
  let isOwnSeen = false
  let isInherited = false
  for (const line of text.split('\n')) {
    const isBoundary = line.includes('"compact_boundary"')
    const promptId = PROMPT_ID.exec(line)?.[1]
    const isNewPrompt = promptId !== undefined && !seenPrompt.has(promptId)
    if (!isBoundary && !isNewPrompt && !line.includes('"usage"')) continue
    let r: Record<string, unknown>
    try {
      r = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (r.isSidechain === true) continue
    if (own !== null && typeof r.sessionId === 'string' && r.sessionId !== own) {
      if (!isOwnSeen && !isInherited) {
        isInherited = true
        out.push({ kind: 'i' })
      }
      if (isNewPrompt && r.type === 'user') {
        seenPrompt.add(promptId)
        carry = promptTextOf((r.message as { content?: unknown } | undefined)?.content)
      }
      continue
    }
    isOwnSeen = true
    const atMs = Date.parse(String(r.timestamp ?? '')) || 0
    if (isNewPrompt && r.type === 'user') {
      seenPrompt.add(promptId)
      isOwnAsked = true
      const text = promptTextOf((r.message as { content?: unknown } | undefined)?.content)
      out.push(text ? { kind: 'q', atMs, text } : { kind: 'q', atMs })
      continue
    }
    if (r.type === 'system' && r.subtype === 'compact_boundary') {
      const meta = (r.compactMetadata ?? {}) as Record<string, unknown>
      const key = `${atMs}:${num(meta.preTokens)}`
      if (seenBoundary.has(key)) continue
      seenBoundary.add(key)
      const post = num(meta.postTokens)
      out.push({ kind: 'c', atMs, trigger: typeof meta.trigger === 'string' ? meta.trigger : 'manual', pre: num(meta.preTokens), ...(post > 0 ? { post } : {}) })
      continue
    }
    const m = r.message as { id?: string; model?: string; usage?: Record<string, unknown> } | undefined
    if (r.type !== 'assistant' || !m?.usage || !m.id) continue
    const prev = seen.get(m.id)
    if (prev) {
      const outNow = num(m.usage.output_tokens)
      if (outNow > prev.output_tokens) prev.output_tokens = outNow
      continue
    }
    const tokens = tokensOfUsage(m.usage)
    seen.set(m.id, tokens)
    if (carry !== undefined && !isOwnAsked) {
      isOwnAsked = true
      out.push(carry ? { kind: 'q', atMs, text: carry } : { kind: 'q', atMs })
    }
    const engine = engineOfLine(r.version)
    out.push({ kind: 'p', atMs, model: m.model ?? '?', tokens, ...(engine ? { engine } : {}) })
  }
  return out
}

export function tokensOfUsage(u: Record<string, unknown>): Tokens {
  const cc = (typeof u.cache_creation === 'object' && u.cache_creation !== null ? u.cache_creation : null) as Record<string, unknown> | null
  return {
    input_tokens: num(u.input_tokens),
    output_tokens: num(u.output_tokens),
    cache_read_input_tokens: num(u.cache_read_input_tokens),
    cache_creation_input_tokens: num(u.cache_creation_input_tokens),
    ...(cc ? { cache_creation_5m: num(cc.ephemeral_5m_input_tokens), cache_creation_1h: num(cc.ephemeral_1h_input_tokens) } : {}),
  }
}

export function lastMainTtl(text: string): number | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"cache_creation"') || !line.includes('"assistant"')) continue
    let r: Record<string, unknown>
    try {
      r = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (r.isSidechain === true || r.type !== 'assistant') continue
    const u = (r.message as { usage?: Record<string, unknown> } | undefined)?.usage
    const ttl = u ? ttlOfTokens(tokensOfUsage(u)) : null
    if (ttl !== null) return ttl
  }
  return null
}

export type Boundary = { atMs: number; trigger: string; pre: number; post?: number }

export function lastBoundaryAfter(text: string, own: string | null, sinceMs: number): Boundary | null {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!
    if (!line.includes('"compact_boundary"')) continue
    let r: Record<string, unknown>
    try {
      r = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (r.type !== 'system' || r.subtype !== 'compact_boundary' || r.isSidechain === true) continue
    if (own !== null && typeof r.sessionId === 'string' && r.sessionId !== own) continue
    const atMs = Date.parse(String(r.timestamp ?? '')) || 0
    if (atMs <= sinceMs) return null
    const meta = (r.compactMetadata ?? {}) as Record<string, unknown>
    const post = num(meta.postTokens)
    return { atMs, trigger: typeof meta.trigger === 'string' ? meta.trigger : 'manual', pre: num(meta.preTokens), ...(post > 0 ? { post } : {}) }
  }
  return null
}

export function recordsFromLines(text: string): FlowRecord[] {
  const out: FlowRecord[] = []
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f[0] === 'p' && f.length >= 7) {
      const [, at, input, output, read, write, model, w5, w1, ver] = f
      const engine = engineOfLine(ver)
      out.push({
        kind: 'p',
        atMs: Number(at) || 0,
        model: model!,
        ...(engine ? { engine } : {}),
        tokens: {
          input_tokens: Number(input) || 0,
          output_tokens: Number(output) || 0,
          cache_read_input_tokens: Number(read) || 0,
          cache_creation_input_tokens: Number(write) || 0,
          ...(w5 !== undefined && w1 !== undefined ? { cache_creation_5m: Number(w5) || 0, cache_creation_1h: Number(w1) || 0 } : {}),
        },
      })
    } else if (f[0] === 'c' && f.length >= 4) {
      const post = Number(f[4]) || 0
      out.push({ kind: 'c', atMs: Number(f[1]) || 0, trigger: f[2]!, pre: Number(f[3]) || 0, ...(post > 0 ? { post } : {}) })
    } else if (f[0] === 'q' && f.length >= 2) {
      const text = f.slice(2).join(' ')
      out.push(text ? { kind: 'q', atMs: Number(f[1]) || 0, text } : { kind: 'q', atMs: Number(f[1]) || 0 })
    } else if (f[0] === 'i' && f.length === 1) {
      out.push({ kind: 'i' })
    }
  }
  return out
}

export type CostScan = { isFork: boolean; inherited: number; states: number[] }

const SESSION_ID = /"sessionId":"([^"]+)"/

export function costScanOf(text: string, own: string): CostScan {
  let isOwnSeen = false
  let leaf: string | null = null
  const states = new Map<string, number>()
  const before = new Map<string, number>()
  for (const line of text.split('\n')) {
    if (line.startsWith('{"type":"cost-state"')) {
      let r: Record<string, unknown>
      try {
        r = JSON.parse(line) as Record<string, unknown>
      } catch {
        continue
      }
      const usd = r.totalCostUSD
      if (typeof r.sessionId !== 'string' || typeof usd !== 'number' || !Number.isFinite(usd)) continue
      states.set(r.sessionId, usd)
      if (!isOwnSeen) before.set(r.sessionId, usd)
      continue
    }
    if (isOwnSeen || !line.includes('"uuid":"')) continue
    const id = SESSION_ID.exec(line)?.[1]
    if (id === undefined) continue
    if (id === own) isOwnSeen = true
    else leaf = id
  }
  return { isFork: leaf !== null, inherited: leaf === null ? 0 : (before.get(leaf) ?? 0), states: [...states.values()] }
}

export function costScanFromLines(text: string): CostScan | null {
  let scan: CostScan | null = null
  const states: number[] = []
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f[0] === 'f' && f.length >= 3) scan = { isFork: f[1] === '1', inherited: Number(f[2]) || 0, states }
    else if (f[0] === 's' && Number.isFinite(Number(f[1]))) states.push(Number(f[1]))
  }
  return scan
}

export function restoredOf(states: readonly number[], engine: number): number {
  let best = 0
  for (const v of states) if (v > best && v <= engine + 1e-6) best = v
  return best
}

export function coldGapMs(ttl: number = CACHE_TTL_MIN): number {
  return (ttl + (ttl >= 60 ? 5 : 1)) * 60_000
}

const ttlAt = (p: CtxPoint | undefined) => (p?.ttl === 5 ? 5 : CACHE_TTL_MIN)

export function isColdStart(flow: Flow, atMs: number, model: string): boolean {
  const last = flow.points[flow.points.length - 1]
  if (!last) return flow.compactions.length === 0
  const lastC = flow.compactions[flow.compactions.length - 1]
  const prevAt = Math.max(last.atMs, lastC?.atMs ?? 0)
  if (prevAt > 0 && atMs - prevAt > coldGapMs(ttlAt(last))) return true
  const isAfterCompact = lastC !== undefined && lastC.index >= flow.points.length
  return !isAfterCompact && last.model !== undefined && model !== '?' && modelKey(last.model) !== modelKey(model)
}

export function noteShared(flow: Flow, atMs: number, model: string, read: number): void {
  if (!model || model === '?') return
  const key = modelKey(model)
  const v = Math.max(0, read)
  if (isColdStart(flow, atMs, model)) {
    if (flow.inherited === true && flow.points.length === 0) return
    flow.shared = { ...flow.shared, [key]: v }
    return
  }
  if (compactSince(flow) === null) return
  const known = flow.shared?.[key]
  flow.shared = { ...flow.shared, [key]: known === undefined ? v : Math.min(known, v) }
}

export const PER_CALL_MIN = 3
const PER_CALL_WINDOW = 20

function median(values: readonly number[]): number {
  const v = [...values].sort((a, b) => a - b)
  const h = Math.floor(v.length / 2)
  return v.length % 2 === 1 ? v[h]! : (v[h - 1]! + v[h]!) / 2
}

function recentPointsOf(flow: Flow, model: string): CtxPoint[] {
  return flow.points.filter(p => p.model !== undefined && modelKey(p.model) === modelKey(model)).slice(-PER_CALL_WINDOW)
}

export function extraPerCall(flow: Flow, model: string): number | null {
  const pts = recentPointsOf(flow, model)
  if (pts.length < PER_CALL_MIN) return null
  const r = ratesFor(model, 0)
  if (!r) return null
  return median(pts.map(p => Math.max(0, p.usd - ((ratesFor(model, p.ctx) ?? r).read * p.ctx) / 1e6)))
}

export function sharedFor(flow: Pick<Flow, 'shared'>, model: string, pc: Readonly<Record<string, number>> = {}): number {
  const key = modelKey(model)
  return flow.shared?.[key] ?? pc[key] ?? 0
}

export function flowFromRecords(records: readonly FlowRecord[]): Flow {
  const flow: Flow = { points: [], compactions: [], questions: [], shared: {}, inherited: false }
  for (const r of records) {
    if (r.kind === 'i') {
      flow.inherited = true
      continue
    }
    if (r.kind === 'q') {
      flow.questions!.push(r.atMs)
      continue
    }
    if (r.kind === 'c') {
      if (flow.compactions.some(c => c.atMs === r.atMs && c.before === r.pre)) continue
      const last = flow.points[flow.points.length - 1]
      flow.compactions.push({ atMs: r.atMs, trigger: r.trigger, before: r.pre || (last ? last.ctx : 0), after: null, costUsd: null, index: flow.points.length, ...(r.post ? { kept: r.post } : {}) })
      continue
    }
    const t = r.tokens
    const ctx = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
    if (ctx <= 0) continue
    noteShared(flow, r.atMs, r.model, t.cache_read_input_tokens)
    const ttl = ttlOfTokens(t) ?? ttlAt(flow.points[flow.points.length - 1])
    addPoint(
      flow,
      {
        atMs: r.atMs,
        ctx,
        usd: costOf(t, r.model, ttl, dayOf(r.atMs), r.engine ?? null)?.usd ?? 0,
        ...(r.model && r.model !== '?' ? { model: r.model } : {}),
        ...(ttlOfTokens(t) !== null ? { ttl: ttlOfTokens(t)! } : {}),
        ...(r.engine ? { engine: r.engine } : {}),
      },
      t.input_tokens + t.cache_creation_input_tokens,
    )
  }
  return trim(flow)
}

export function scanTranscript(text: string, own: string | null = null): Flow {
  return flowFromRecords(recordsFromTranscript(text, own))
}

export function serializeFlow(flow: Flow): string {
  const tableOf = (list: string[]) => (name: string | undefined) => {
    if (!name) return -1
    const at = list.indexOf(name)
    if (at >= 0) return at
    list.push(name)
    return list.length - 1
  }
  const models: string[] = []
  const engines: string[] = []
  const idOf = tableOf(models)
  const engineIdOf = tableOf(engines)
  const p = flow.points.map(pt => {
    const row = [pt.atMs, pt.ctx, Math.round(pt.usd * 1e6) / 1e6, idOf(pt.model)]
    const ttl = pt.ttl === 5 || pt.ttl === 60 ? pt.ttl : 0
    const ei = engineIdOf(pt.engine)
    return ei >= 0 ? [...row, ttl, ei] : ttl ? [...row, ttl] : row
  })
  return JSON.stringify({
    v: 5,
    m: models,
    ...(engines.length > 0 ? { e: engines } : {}),
    p,
    c: flow.compactions,
    ...(flow.questions ? { q: flow.questions } : {}),
    ...(flow.shared ? { s: flow.shared } : {}),
    ...(flow.inherited !== undefined ? { i: flow.inherited ? 1 : 0 } : {}),
  })
}

export function parseFlowFile(text: string): Flow | null {
  try {
    const raw = JSON.parse(text) as { v?: number; m?: unknown; e?: unknown; p?: unknown; c?: unknown; q?: unknown; s?: unknown; i?: unknown }
    if ((raw.v !== 1 && raw.v !== 2 && raw.v !== 3 && raw.v !== 4 && raw.v !== 5) || !Array.isArray(raw.p) || !Array.isArray(raw.c)) return null
    const names = (list: unknown) => (Array.isArray(list) ? (list as unknown[]).map(x => (typeof x === 'string' ? x : '')) : [])
    const models = names(raw.m)
    const engines = names(raw.e)
    const points = (raw.p as unknown[])
      .filter((x): x is number[] => Array.isArray(x) && x.length >= 3)
      .map(([atMs, ctx, usd, mi, ttl, ei]) => {
        const model = typeof mi === 'number' && mi >= 0 ? models[mi] : undefined
        const engine = typeof ei === 'number' && ei >= 0 ? engines[ei] : undefined
        return { atMs: num(atMs), ctx: num(ctx), usd: num(usd), ...(model ? { model } : {}), ...(ttl === 5 || ttl === 60 ? { ttl } : {}), ...(engine ? { engine } : {}) }
      })
    const compactions = (raw.c as Partial<CompactEvent>[])
      .filter(c => c && typeof c.index === 'number' && typeof c.before === 'number')
      .map(c => ({
        atMs: num(c.atMs),
        trigger: typeof c.trigger === 'string' ? c.trigger : 'manual',
        before: num(c.before),
        after: typeof c.after === 'number' ? c.after : null,
        costUsd: typeof c.costUsd === 'number' ? c.costUsd : null,
        index: num(c.index),
        ...(typeof c.summary === 'number' ? { summary: c.summary } : {}),
        ...(typeof c.kept === 'number' && c.kept > 0 ? { kept: c.kept } : {}),
        ...(typeof c.fixed === 'number' && c.fixed > 0 ? { fixed: c.fixed } : {}),
        ...(typeof c.via === 'string' ? { via: c.via } : {}),
      }))
      .filter((c, i, all) => all.findIndex(o => o.atMs === c.atMs && o.before === c.before) === i)
    const questions = Array.isArray(raw.q) ? (raw.q as unknown[]).map(num) : undefined
    const shared =
      raw.v === 5 && raw.s !== null && typeof raw.s === 'object' && !Array.isArray(raw.s)
        ? Object.fromEntries(Object.entries(raw.s as Record<string, unknown>).map(([k, v]) => [k, num(v)]))
        : undefined
    const inherited = raw.i === 1 ? true : raw.i === 0 ? false : undefined
    return fixAfters(dropFalseCompacts({ points, compactions, ...(questions ? { questions } : {}), ...(shared ? { shared } : {}), ...(inherited !== undefined ? { inherited } : {}) }))
  } catch {
    return null
  }
}

export const COMPACT_SHRINK = 0.8

export function isNotShrunk(before: number, after: number): boolean {
  return before > 0 && after >= before * COMPACT_SHRINK
}

export type CompactResultLike = { tokensBefore?: number; tokensAfter?: number; usage?: Tokens }

export type JudgeState = {
  suspect: { before: number; atMs: number; since: number; checks: number } | null
  engineHadTokens: boolean
  startedAtSeen: number | null
  missed: { trigger: string; result: CompactResultLike } | null
}

export function judgeMeasure(
  st: JudgeState,
  f: { engineTokens: number | undefined; startedAt: number; isBusy: boolean; last: { atMs: number; ctx: number } | null; hasCompactSince: boolean },
): { st: JudgeState; next: { do: 'none' } | { do: 'missed'; missed: NonNullable<JudgeState['missed']> } | { do: 'look'; since: number; before: number } } {
  const isClear = st.startedAtSeen !== null && f.startedAt !== st.startedAtSeen
  const st1: JudgeState = { ...st, startedAtSeen: f.startedAt, suspect: isClear ? null : st.suspect }
  if (st1.missed !== null) return { st: { ...st1, missed: null }, next: { do: 'missed', missed: st1.missed } }
  if (typeof f.engineTokens === 'number' && f.engineTokens > 0) return { st: { ...st1, engineHadTokens: true }, next: { do: 'none' } }
  if (!st1.engineHadTokens || f.isBusy) return { st: st1, next: { do: 'none' } }
  const st2: JudgeState = { ...st1, engineHadTokens: false }
  if (isClear || !f.last || f.last.ctx <= 0 || f.hasCompactSince) return { st: st2, next: { do: 'none' } }
  return { st: st2, next: { do: 'look', since: f.last.atMs, before: f.last.ctx } }
}

export function judgeRequest(suspect: JudgeState['suspect'], isRecording: boolean, ctx: number): 'none' | 'not-shrunk' | 'shrink' {
  if (suspect === null || isRecording) return 'none'
  return isNotShrunk(suspect.before, ctx) ? 'not-shrunk' : 'shrink'
}

export function judgeOwn(hasBoundary: boolean, suspect: JudgeState['suspect']): 'boundary' | 'empty' | 'none' {
  return hasBoundary ? 'boundary' : suspect !== null ? 'empty' : 'none'
}

function isUnconfirmed(c: CompactEvent): boolean {
  return c.kept === undefined && c.costUsd === null
}

export function dropFalseCompacts(flow: Flow): Flow {
  const n = flow.points.length
  const compactions = flow.compactions.filter((c, i) => {
    if (!isUnconfirmed(c)) return true
    const later = flow.compactions[i + 1]
    const first = later?.index !== c.index && !(c.index === 0 && n >= MAX_POINTS) ? flow.points[c.index] : undefined
    return first === undefined || !isNotShrunk(c.before, first.ctx)
  })
  return compactions.length === flow.compactions.length ? flow : { ...flow, compactions }
}

export function fixAfters(flow: Flow): Flow {
  const n = flow.points.length
  const compactions = flow.compactions.map((c, i) => {
    if (c.kept !== undefined || c.after === null) return c
    const later = flow.compactions[i + 1]
    const first = c.index < n && later?.index !== c.index && !(c.index === 0 && n >= MAX_POINTS) ? flow.points[c.index] : undefined
    if (first === undefined) return c.index >= n && !later ? { ...c, after: null, kept: c.after } : { ...c, after: null }
    if (c.after === first.ctx) return c
    return c.after < first.ctx ? { ...c, after: first.ctx, kept: c.after } : { ...c, after: first.ctx }
  })
  return { ...flow, compactions }
}

export function syncCompactAfter(details: StepDetail[], compactions: readonly CompactEvent[]): StepDetail[] {
  let isChanged = false
  const out = details.flatMap(d => {
    if (!d.compact) return [d]
    const before = d.compact.before
    const c = [...compactions].reverse().find(o => o.before === before)
    if (!c && d.usd === 0 && (d.compact.after === null || isNotShrunk(before, d.compact.after))) {
      isChanged = true
      return []
    }
    const after = !c ? d.compact.after : c.after !== null ? c.after : c.kept !== undefined && d.compact.after === c.kept ? null : d.compact.after
    if (after === d.compact.after) return [d]
    isChanged = true
    return [{ ...d, compact: { ...d.compact, after } }]
  })
  return isChanged ? out : details
}

export function lacksModels(flow: Flow): boolean {
  return flow.points.length > 0 && flow.points.every(p => p.model === undefined)
}

export function modelSwitches(points: readonly CtxPoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.model
    const b = points[i]!.model
    if (a && b && modelKey(a) !== modelKey(b)) out.push(i)
  }
  return out
}

export const FLOW_RECENT = 40

export function recentStart(points: readonly CtxPoint[], questionStarts: readonly number[], count: number): number {
  if (questionStarts.length <= count) return 0
  const from = questionStarts[questionStarts.length - count]!
  const i = points.findIndex(p => p.atMs >= from)
  return i < 0 ? 0 : i
}

export function withQuestion(flow: Flow, atMs: number): Flow {
  return { ...flow, questions: [...(flow.questions ?? []), atMs] }
}

export function addPoint(flow: Flow, p: CtxPoint, fresh?: number): void {
  flow.points.push(p)
  const last = flow.compactions[flow.compactions.length - 1]
  if (last && last.index === flow.points.length - 1 && last.summary === undefined) {
    if (last.after === null) last.after = p.ctx
    const lastQ = flow.questions?.[flow.questions.length - 1]
    const isNewQuestion = lastQ !== undefined && lastQ >= last.atMs
    if (fresh !== undefined && isNewQuestion && p.atMs - last.atMs <= coldGapMs(ttlAt(p))) last.summary = Math.min(fresh, last.after)
  }
}

export function pendingCompact(flow: Flow): CompactEvent | null {
  const last = flow.compactions[flow.compactions.length - 1]
  return last && last.after === null && last.index === flow.points.length ? last : null
}

export function compactSince(flow: Flow): CompactEvent | null {
  const last = flow.compactions[flow.compactions.length - 1]
  return last && last.index >= flow.points.length ? last : null
}

export function lastCtxOf(flow: Flow): number | null {
  const last = flow.points[flow.points.length - 1]
  if (!last) return null
  return flow.compactions.some(c => c.index >= flow.points.length) ? null : last.ctx
}

export function withPoint(flow: Flow, p: CtxPoint, t?: Tokens, isWhole = true): Flow {
  const next: Flow = { ...flow, points: [...flow.points], compactions: flow.compactions.map(c => ({ ...c })) }
  if (t && p.model && isWhole) noteShared(next, p.atMs, p.model, t.cache_read_input_tokens)
  addPoint(next, p, t ? t.input_tokens + t.cache_creation_input_tokens : undefined)
  return trim(dropFalseCompacts(next))
}

function trim(flow: Flow): Flow {
  const drop = flow.points.length - MAX_POINTS
  if (drop <= 0) return flow
  return {
    ...flow,
    points: flow.points.slice(drop),
    compactions: flow.compactions.map(c => ({ ...c, index: Math.max(0, c.index - drop) })),
  }
}

export function mergeMeasured(fresh: readonly CompactEvent[], old: readonly CompactEvent[]): CompactEvent[] {
  return fresh.map(c => {
    const near = (o: CompactEvent) => Math.abs(o.atMs - c.atMs) < 10 * 60_000
    const same = old.find(o => o.costUsd !== null && near(o))
    const kept = c.kept ?? old.find(o => o.kept !== undefined && near(o))?.kept
    const fixed = c.fixed ?? old.find(o => o.fixed !== undefined && near(o))?.fixed
    return same || kept !== c.kept || fixed !== c.fixed
      ? { ...c, ...(same ? { costUsd: same.costUsd } : {}), ...(kept !== undefined ? { kept } : {}), ...(fixed !== undefined ? { fixed } : {}) }
      : c
  })
}

export type CompactEffect = {
  event: CompactEvent
  model: string
  removed: number
  costUsd: number
  isEstimated: boolean
  requestsAfter: number
  savedUsd: number
  netUsd: number
  breakEvenLeft: number | null
}

export function compactEffects(
  flow: Flow,
  model: string,
  est: { output: number; summaryOf: (c: CompactEvent) => number },
): CompactEffect[] {
  return flow.compactions.map((event, i) => {
    const atModel = flow.points[event.index - 1]?.model ?? flow.points[event.index]?.model ?? model
    const atEngine = flow.points[event.index - 1]?.engine ?? flow.points[event.index]?.engine ?? null
    const r = ratesFor(atModel, event.before, dayOf(event.atMs), atEngine)
    const after = event.after ?? event.before
    const removed = Math.max(0, event.before - after)
    const nextIndex = Math.min(flow.compactions[i + 1]?.index ?? flow.points.length, flow.points.length)
    const requestsAfter = event.after === null ? 0 : Math.max(0, nextIndex - event.index)
    if (!r) {
      return { event, model: atModel, removed, costUsd: event.costUsd ?? 0, isEstimated: event.costUsd === null, requestsAfter, savedUsd: 0, netUsd: 0, breakEvenLeft: null }
    }
    const prevAt = Math.max(flow.points[event.index - 1]?.atMs ?? 0, i > 0 ? flow.compactions[i - 1]!.atMs : 0)
    const isWarm = prevAt > 0 && event.atMs - prevAt <= coldGapMs(ttlAt(flow.points[event.index - 1]))
    const s = isWarm ? event.before : Math.min(sharedFor(flow, atModel), event.before)
    const request = event.costUsd ?? ((event.before - s) * r.input + s * r.read + est.output * r.output) / 1e6
    const summaryTtl = flow.points[event.index]?.ttl ?? ttlAt(flow.points[event.index - 1])
    const costUsd = request + (Math.min(est.summaryOf(event), after) * writeRate(r, summaryTtl)) / 1e6
    const readOf = (p: CtxPoint | undefined) => (ratesFor(p?.model ?? atModel, p?.ctx ?? after, dayOf(p?.atMs), p?.engine ?? null) ?? r).read
    let savedUsd = 0
    for (let j = event.index; j < event.index + requestsAfter; j++) savedUsd += (removed * readOf(flow.points[j])) / 1e6
    const perRequest = (removed * readOf(flow.points[nextIndex - 1])) / 1e6
    const netUsd = savedUsd - costUsd
    const breakEvenLeft = netUsd >= 0 ? null : perRequest > 0 ? Math.ceil(-netUsd / perRequest) : null
    return { event, model: atModel, removed, costUsd, isEstimated: event.costUsd === null, requestsAfter, savedUsd, netUsd, breakEvenLeft }
  })
}

export function fmtClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return L('시각 모름', 'time unknown')
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`
}

export const TIMING_H = 30

export function timingSvg(
  ctx: number,
  marks: { warn: number; cut: number; warnName: string; cutName: string },
  hex: string,
  width: number,
  anim: { pulse?: boolean; fromCtx?: number; fromHex?: string } | null = null,
): string {
  const barY = 4
  const barH = 8
  const top = Math.max(marks.cut * 1.25, ctx * 1.04)
  const x = (v: number) => Math.max(0, Math.min(width, (v / top) * width))
  let body = `<clipPath id="timing-clip"><rect x="0" y="${barY}" width="${width}" height="${barH}" rx="4"/></clipPath><g clip-path="url(#timing-clip)">`
  body += `<rect x="0" y="${barY}" width="${width}" height="${barH}" fill="#888888" fill-opacity="0.25"/>`
  const nowX = x(ctx)
  const fromX = anim?.fromCtx !== undefined ? x(anim.fromCtx) : null
  const shrink = fromX !== null && fromX > nowX + 0.5 ? `@keyframes cs{from{width:${fromX.toFixed(1)}px${anim?.fromHex ? `;fill:${anim.fromHex}` : ''}}}` : ''
  const cls = [anim?.pulse ? 'fl' : '', shrink ? 'sh' : ''].filter(Boolean).join(' ')
  body += barAnimCss(anim?.pulse === true, shrink)
  if (nowX > 0) body += `<rect${cls ? ` class="${cls}"` : ''} x="0" y="${barY}" width="${nowX.toFixed(1)}" height="${barH}" fill="${hex}"/>`
  body += '</g>'
  const line = (v: number, color: string) =>
    `<rect x="${(x(v) - 1.5).toFixed(1)}" y="0" width="3" height="${barY * 2 + barH}" rx="1" fill="${color}"/>`
  body += line(marks.warn, LEVEL_HEX.warn) + line(marks.cut, LEVEL_HEX.cut)
  const fontPx = 10
  const textW = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) >= 0x1100 ? fontPx : fontPx * 0.6), 0)
  const y = TIMING_H - 2
  const text = (at: number, anchor: string, color: string, s: string) =>
    `<text x="${at.toFixed(1)}" y="${y}" text-anchor="${anchor}" font-size="${fontPx}" font-family="sans-serif" fill="${color}">${escapeXml(s)}</text>`
  const [warnName, cutName] = timingNames(marks.warnName, marks.cutName, width, textW)
  let warnEnd = Math.max(textW(warnName), x(marks.warn) - 3)
  let cutStart = Math.min(width - textW(cutName), x(marks.cut) + 3)
  if (warnEnd + NAME_GAP > cutStart) {
    warnEnd = textW(warnName)
    cutStart = width - textW(cutName)
  }
  body += text(warnEnd, 'end', LEVEL_HEX.warn, warnName) + text(cutStart, 'start', LEVEL_HEX.cut, cutName)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${TIMING_H}" viewBox="0 0 ${width} ${TIMING_H}">${body}</svg>`
}

const NAME_GAP = 8

export function timingNames(warnName: string, cutName: string, width: number, w: (s: string) => number): [string, string] {
  if (w(warnName) + NAME_GAP + w(cutName) <= width) return [warnName, cutName]
  const short = (s: string) => s.split(' ')[0] ?? s
  return [short(warnName), short(cutName)]
}

export const COMPACT_HEX = '#3fb6c6'

export const MODEL_HEX = '#b48cf2'

const RULE_HEX = '#9aa0a8'

const LABEL_W = 54

export const AXIS_H = 13

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const FLOW_MAX_BARS = 90

export function flowSvg(
  points: readonly CtxPoint[],
  marks: readonly number[],
  width: number,
  fullHeight: number,
  switches: readonly number[] = [],
  axis?: { left: string; right: string },
): string {
  const height = axis ? fullHeight - AXIS_H : fullHeight
  const n = points.length
  const t = thresholds()
  const plotW = Math.max(40, width - LABEL_W)
  let top = t.ctxCut
  for (const p of points) if (p.ctx > top) top = p.ctx
  top *= 1.05
  const bars = Math.max(1, Math.min(n, Math.floor(plotW / 3), FLOW_MAX_BARS))
  const per = n / bars
  const bw = plotW / bars
  const yOf = (v: number) => height - (v / top) * (height - 1)
  const lastMark = marks.length > 0 ? marks[marks.length - 1]! : 0
  let body = ''
  const groups = new Map<string, string>()
  const w = Math.max(1, bw - 1).toFixed(1)
  for (let b = 0; b < bars; b++) {
    const from = Math.floor(b * per)
    const to = Math.max(from + 1, Math.floor((b + 1) * per))
    let v = 0
    for (let i = from; i < to && i < n; i++) v = Math.max(v, points[i]!.ctx)
    const y = yOf(v)
    const key = `${LEVEL_HEX[levelOf(v)]}${from < lastMark ? ' fill-opacity="0.4"' : ''}`
    groups.set(key, `${groups.get(key) ?? ''}M${(b * bw).toFixed(1)} ${y.toFixed(1)}h${w}V${height}h-${w}z`)
  }
  for (const [key, d] of groups) {
    const [hex, ...dim] = key.split(' ')
    body += `<path d="${d}" fill="${hex}"${dim.length > 0 ? ` ${dim.join(' ')}` : ''}/>`
  }
  const rule = (v: number, dash: string, hex: string) =>
    `<line x1="0" x2="${plotW.toFixed(1)}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}" stroke="${hex}" stroke-width="1" stroke-dasharray="${dash}" stroke-opacity="0.9"/>`
  body += rule(t.ctxWarn, '2 3', LEVEL_HEX.warn) + rule(t.ctxCut, '6 3', LEVEL_HEX.cut)
  const fontPx = 10
  let yCut = Math.max(fontPx, yOf(t.ctxCut) + 3.5)
  let yWarn = Math.max(yCut + fontPx + 1, yOf(t.ctxWarn) + 3.5)
  if (yWarn > height - 1) {
    yWarn = height - 1
    yCut = Math.min(yCut, yWarn - fontPx - 1)
  }
  const name = (y: number, hex: string, text: string) =>
    `<text x="${(plotW + 4).toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontPx}" font-family="sans-serif" fill="${hex}">${text}</text>`
  body += name(yCut, 'currentColor', fmtTokens(t.ctxCut)) + name(yWarn, 'currentColor', fmtTokens(t.ctxWarn))
  for (const index of marks) {
    const x = Math.min(plotW - 1, Math.max(1, (index / Math.max(1, n)) * plotW))
    body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${height}" stroke="${COMPACT_HEX}" stroke-width="2"/>`
  }
  for (const index of switches) {
    const x = Math.min(plotW - 1, Math.max(1, (index / Math.max(1, n)) * plotW))
    body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${height}" stroke="${MODEL_HEX}" stroke-width="2" stroke-dasharray="3 2"/>`
  }
  if (axis) {
    const y = (fullHeight - 2).toFixed(1)
    const text = (x: number, anchor: string, value: string) =>
      `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" font-size="10" font-family="sans-serif" fill="${RULE_HEX}">${escapeXml(value)}</text>`
    body += text(0, 'start', axis.left) + text(plotW, 'end', axis.right)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fullHeight}" viewBox="0 0 ${width} ${fullHeight}">${body}</svg>`
}

export function segmentExtra(
  flow: Flow,
  model: string,
  fallbackAfter: number,
): { base: number; baseNow: number; cum: number[]; ratios: number[]; nowExtraUsd: number } | null {
  const last = flow.compactions[flow.compactions.length - 1]
  const from = last ? last.index : 0
  const pts = flow.points.slice(from)
  if (pts.length < 2) return null
  const base = last?.after ?? fallbackAfter
  const scales = tokenScales(flow.points, from)
  const extraOf = (p: CtxPoint, k: number) => {
    const r = ratesFor(p.model ?? model, p.ctx, dayOf(p.atMs), p.engine ?? null)
    return r ? (Math.max(0, p.ctx - base * scales[k]!) * r.read) / 1e6 : 0
  }
  let sum = 0
  const cum = pts.map((p, k) => (sum += extraOf(p, k)))
  const ratios = pts.map((p, k) => (base > 0 ? p.ctx / (base * scales[k]!) : 1))
  const k = pts.length - 1
  return { base, baseNow: base * scales[k]!, cum, ratios, nowExtraUsd: extraOf(pts[k]!, k) }
}

export function tokenScales(points: readonly CtxPoint[], fromIndex: number): number[] {
  const first = points[fromIndex]?.model
  const out: number[] = []
  let scale = 1
  for (let i = fromIndex; i < points.length; i++) {
    const a = points[i - 1]?.model
    const b = points[i]!.model
    if (i > fromIndex && a && b && modelKey(a) !== modelKey(b)) {
      scale = first && modelKey(b) === modelKey(first) ? 1 : (scale * points[i]!.ctx) / Math.max(1, points[i - 1]!.ctx)
    }
    out.push(scale)
  }
  return out
}

export function afterInNowTokens(flow: Flow, after: number): number {
  const last = flow.compactions[flow.compactions.length - 1]
  if (!last || last.index >= flow.points.length) return after
  const scales = tokenScales(flow.points, last.index)
  return after * (scales[scales.length - 1] ?? 1)
}

export function compactSummary(flow: Flow, c: CompactEvent, first: CtxPoint | null): number | null {
  if (typeof c.summary === 'number' && c.after !== null) return Math.min(c.summary, c.after)
  if (!first || c.after === null || c.after <= first.ctx) return null
  const model = flow.points[c.index]?.model ?? flow.points[c.index - 1]?.model
  if (model && first.model && modelKey(model) !== modelKey(first.model)) return null
  return c.after - first.ctx
}

export function keptOf(flow: Flow, c: CompactEvent, first: CtxPoint | null): number | null {
  if (c.fixed !== undefined && c.after !== null && c.after > c.fixed) return c.after - c.fixed
  if (c.kept !== undefined && c.after !== null) return Math.min(c.kept, c.after)
  return compactSummary(flow, c, first)
}

export function fitTokens(text: string): number {
  const ko = (text.match(/[가-힣]/g) ?? []).length
  return Math.round(ko * 1.7 + (text.length - ko) / 2.2)
}

export function compactJustMeasured(flow: Flow): CompactEvent | null {
  const last = flow.compactions[flow.compactions.length - 1]
  return last && last.after !== null && last.fixed === undefined && last.index === flow.points.length - 1 ? last : null
}

export function fixedOf(c: CompactEvent, p: CtxPoint, read: number, side: number): number | null {
  if (c.after === null || read <= 0 || p.atMs - c.atMs > coldGapMs(ttlAt(p))) return null
  const fixed = Math.round(read + side)
  return fixed < c.after ? fixed : null
}

export type FixedStored = { model: string; tokens: number }

export function fixedHintOf(flow: Flow, model: string, stored: FixedStored | null): number | null {
  const last = [...flow.compactions].reverse().find(c => c.after !== null && c.fixed !== undefined)
  const at = last ? flow.points[last.index]?.model : undefined
  if (last?.fixed !== undefined && !(at && model && modelKey(at) !== modelKey(model))) return last.fixed
  return stored && stored.tokens > 0 && (!stored.model || !model || stored.model === modelKey(model)) ? stored.tokens : null
}

export function measuredBase(flow: Flow, model: string): number | null {
  const last = [...flow.compactions].reverse().find(c => c.after !== null && c.kept !== undefined)
  if (!last || last.after === null || last.kept === undefined) return null
  const at = flow.points[last.index]?.model
  if (at && model && modelKey(at) !== modelKey(model)) return null
  return last.after > last.kept ? last.after - last.kept : null
}

export function afterGuess(flow: Flow, c: CompactEvent, model: string, base: number | null): number | null {
  if (c.kept === undefined) return null
  const b = measuredBase(flow, model) ?? base
  return b === null || (c.before > 0 && c.kept + b >= c.before) ? null : c.kept + b
}
