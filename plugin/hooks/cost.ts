import type { CompactInputs, CompactMix, CostParts, SaveTurn, StepDetail, Thresholds, TtlConfig, Usage } from '../types'
import { L, lang } from './i18n'

export type Rates = { label: string; input: number; output: number; read: number; write5m: number; write1h: number }

const rates = (label: string, input: number, output: number, read: number): Rates => ({
  label,
  input,
  output,
  read,
  write5m: input * 1.25,
  write1h: input * 2,
})

export type RateChange = { until: string; minEngine?: string; base: Rates; announced?: string }

type PriceRow = {
  match: RegExp
  base: Rates
  long?: { over: number; rates: Rates }
  history?: readonly RateChange[]
}

const PRICE_TABLE: PriceRow[] = [
  { match: /(fable|mythos)-5-1/, base: rates('Fable 5.1', 10, 50, 0.25) },
  { match: /(fable|mythos)-5/, base: rates('Fable 5', 10, 50, 1) },
  { match: /opus-5-5/, base: rates('Opus 5.5', 4, 20, 0.2) },
  { match: /opus-5/, base: rates('Opus 5', 5, 25, 0.5) },
  { match: /opus-4-[5-8]/, base: rates('Opus 4.x', 5, 25, 0.5) },
  { match: /opus-4/, base: rates('Opus 4 · 4.1', 15, 75, 1.5) },
  { match: /sonnet-5-5/, base: rates('Sonnet 5.5', 2, 10, 0.1), history: [{ until: '2026-10-16', minEngine: '2.1.299', base: rates('Sonnet 5.5', 2, 10, 0.2), announced: '2026-10-07' }] },
  { match: /sonnet-5/, base: rates('Sonnet 5.x', 2, 10, 0.2) },
  { match: /sonnet-4/, base: rates('Sonnet 4.x', 3, 15, 0.3) },
  {
    match: /haiku-5-5/,
    base: rates('Haiku 5.5', 0.1, 0.5, 0.01),
    long: { over: 100_000, rates: rates('Haiku 5.5 (>100k)', 0.5, 2.5, 0.05) },
  },
  { match: /haiku-4-5/, base: rates('Haiku 4.5', 1, 5, 0.1) },
  { match: /3-[57]-sonnet/, base: rates('Sonnet 3.x', 3, 15, 0.3) },
  { match: /3-5-haiku/, base: rates('Haiku 3.5', 0.8, 4, 0.08) },
]

const KNOWN_MODELS = new Set([
  'fable-5-1',
  'fable-5',
  'mythos-5-1',
  'mythos-5',
  'opus-5-5',
  'opus-5',
  'opus-4-5',
  'opus-4-6',
  'opus-4-7',
  'opus-4-8',
  'opus-4',
  'opus-4-0',
  'opus-4-1',
  'sonnet-5-5',
  'sonnet-5',
  'sonnet-4-5',
  'sonnet-4-6',
  'haiku-5-5',
  'haiku-4-5',
  '3-5-sonnet',
  '3-7-sonnet',
  '3-5-haiku',
])

export function modelKeyOf(model: string): string {
  return model
    .toLowerCase()
    .replace(/\[.*$/, '')
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
}

export function isKnownModel(model: string): boolean {
  return KNOWN_MODELS.has(modelKeyOf(model))
}

export function priceWarnings(model: string | null | undefined, window: number | null | undefined): string[] {
  const out: string[] = []
  if (model && ratesFor(model) && !isKnownModel(model)) {
    out.push(L('가격표에 없는 모델이라 금액이 맞지 않을 수 있습니다. 다음 버전에서 반영할 예정입니다', 'This model isn’t in the price table, so prices may be off. A later version will fix it'))
  }
  if (typeof window === 'number' && window > 1_000_000) {
    out.push(L('최대 컨텍스트 양이 바뀌어 금액이 맞지 않을 수 있습니다. 다음 버전에서 반영할 예정입니다', 'The maximum context size changed, so prices may be off. A later version will fix it'))
  }
  return out
}

export function engineOfLine(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v) ? v : undefined
}

function engineParts(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function engineAtLeast(v: string, min: string): boolean | null {
  const a = engineParts(v)
  const b = engineParts(min)
  if (!a || !b) return null
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
  return true
}

export function ratesFor(model: string, promptTokens = 0, day: string | null = null, engine: string | null = null): Rates | null {
  const row = PRICE_TABLE.find(r => r.match.test(model))
  if (!row) return null
  const isOld = (h: RateChange) => {
    const isNew = engine && h.minEngine ? engineAtLeast(engine, h.minEngine) : null
    return isNew !== null ? !isNew : day !== null && day < h.until
  }
  const old = row.history?.find(isOld)
  return row.long && promptTokens > row.long.over ? row.long.rates : (old?.base ?? row.base)
}

export function rateHistory(model: string): readonly RateChange[] {
  return PRICE_TABLE.find(r => r.match.test(model))?.history ?? []
}

export function splitEngineKey(key: string): [string, string | null] {
  const bar = key.lastIndexOf('|')
  return bar > 0 ? [key.slice(0, bar), key.slice(bar + 1) || null] : [key, null]
}

export function engineSince(days: SpendDays): Record<string, string> {
  const mins = new Set<string>()
  for (const row of PRICE_TABLE) for (const h of row.history ?? []) if (h.minEngine) mins.add(h.minEngine)
  const out: Record<string, string> = {}
  const sorted = Object.keys(days).sort()
  for (const min of mins) {
    let sawOld = false
    for (const day of sorted) {
      const flags = Object.keys(days[day] ?? {}).map(k => {
        const engine = splitEngineKey(k)[1]
        return engine ? engineAtLeast(engine, min) : null
      })
      if (flags.includes(false)) sawOld = true
      if (flags.includes(true)) {
        if (sawOld) out[min] = day
        break
      }
    }
  }
  return out
}

export function dayOf(atMs: number | null | undefined): string | null {
  return typeof atMs === 'number' && Number.isFinite(atMs) && atMs > 0 ? spendDay(atMs) : null
}

export type SpendDays = Record<string, Record<string, Partial<Record<'S' | 'L', number[]>>>>

export function spendUsd(days: SpendDays, from: string, to: string): number {
  let usd = 0
  for (const [day, byModel] of Object.entries(days)) {
    if (day < from || day > to) continue
    for (const [key, tiers] of Object.entries(byModel)) {
      const [model, engine] = splitEngineKey(key)
      for (const [tier, t] of Object.entries(tiers)) {
        const r = ratesFor(model, tier === 'L' ? Number.MAX_SAFE_INTEGER : 0, day, engine)
        if (!r || !t) continue
        usd += ((t[0] ?? 0) * r.input + (t[1] ?? 0) * r.output + (t[2] ?? 0) * r.read + (t[3] ?? 0) * r.write5m + (t[4] ?? 0) * r.write1h) / 1e6
      }
    }
  }
  return usd
}

export function extraUsd(extra: Record<string, number> | undefined, from: string, to: string): number {
  let usd = 0
  for (const [day, v] of Object.entries(extra ?? {})) if (day >= from && day <= to && typeof v === 'number' && Number.isFinite(v)) usd += v
  return usd
}

export type RetroCompacts = Record<string, Record<string, number[]>>

export type CompactCalib = readonly (readonly [number, string, number])[]

const RETRO_OUT_MIN = 1_000
const RETRO_OUT_MAX = 50_000

function compactInputRate(r: Rates, mix: CompactMix): number {
  return mix.input * r.input + mix.read * r.read + mix.write * r.write1h
}

export function compactOutputOf(calib: CompactCalib | undefined, mix: CompactMix, fallback: number): number {
  const outs: number[] = []
  for (const [pre, model, usd] of calib ?? []) {
    const r = ratesFor(model, pre)
    if (!r || !(pre > 0) || !Number.isFinite(usd)) continue
    const out = (usd * 1e6 - pre * compactInputRate(r, mix)) / r.output
    if (out >= RETRO_OUT_MIN && out <= RETRO_OUT_MAX) outs.push(out)
  }
  if (outs.length === 0) return fallback
  outs.sort((a, b) => a - b)
  const mid = outs.length >> 1
  return Math.round(outs.length % 2 ? outs[mid]! : (outs[mid - 1]! + outs[mid]!) / 2)
}

export function retroUsd(retro: RetroCompacts | undefined, from: string, to: string, mix: CompactMix, out: number): { usd: number; n: number } {
  let usd = 0
  let n = 0
  for (const [day, byModel] of Object.entries(retro ?? {})) {
    if (day < from || day > to) continue
    for (const [model, v] of Object.entries(byModel)) {
      const count = v?.[0] ?? 0
      const sum = v?.[1] ?? 0
      if (!(count > 0)) continue
      const r = ratesFor(model, sum / count, day)
      if (!r) continue
      usd += (sum * compactInputRate(r, mix) + count * out * r.output) / 1e6
      n += count
    }
  }
  return { usd, n }
}

export function spendDay(ms: number): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`
}

export function monthStartMs(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function longTierOver(model: string): number | null {
  return PRICE_TABLE.find(r => r.match.test(model))?.long?.over ?? null
}

export function modelName(model: string): string {
  const m = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[.*\])?$/.exec(model.trim())
  if (m) return `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
  return ratesFor(model)?.label ?? model
}

export function modelKey(model: string): string {
  return model.replace(/\[.*\]$/, '').replace(/-\d{8}$/, '').trim()
}

export type Tokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  cache_creation_5m?: number
  cache_creation_1h?: number
}

export type TtlMin = 5 | 60

export function writeRate(r: Rates, ttl: number): number {
  return ttl < 60 ? r.write5m : r.write1h
}

export function ttlOfTokens(t: Tokens): TtlMin | null {
  const m5 = t.cache_creation_5m ?? 0
  const h1 = t.cache_creation_1h ?? 0
  if (h1 > 0) return 60
  if (m5 > 0) return 5
  return null
}

export const ZERO_COST: CostParts = { read: 0, write: 0, output: 0, input: 0, usd: 0 }

export const DEFAULT_THRESHOLDS: Thresholds = { ctxWarn: 200_000, ctxCut: 250_000, cacheWarnMin: 10 }
let active: Thresholds = DEFAULT_THRESHOLDS

export function setThresholds(next: Thresholds): void {
  active = next
}

export function thresholds(): Thresholds {
  return active
}

export function costOf(t: Tokens, model: string, writeTtl: number = CACHE_TTL_MIN, day: string | null = null, engine: string | null = null): CostParts | null {
  const prompt = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
  const r = ratesFor(model, prompt, day, engine)
  if (!r) return null
  const read = (t.cache_read_input_tokens * r.read) / 1e6
  const m5 = t.cache_creation_5m ?? 0
  const h1 = t.cache_creation_1h ?? 0
  const known = m5 + h1 > 0 ? Math.min(m5 + h1, t.cache_creation_input_tokens) : 0
  const write = (m5 * r.write5m + h1 * r.write1h + (t.cache_creation_input_tokens - known) * writeRate(r, writeTtl)) / 1e6
  const output = (t.output_tokens * r.output) / 1e6
  const input = (t.input_tokens * r.input) / 1e6
  return { read, write, output, input, usd: read + write + output + input }
}

export const REWRITE_NOTE_USD = 0.25

export function rewriteOf(t: Tokens, model: string, prevCtx: number | null, ttl: number = CACHE_TTL_MIN, day: string | null = null, engine: string | null = null): number {
  if (prevCtx === null) return 0
  const r = ratesFor(model, t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens, day, engine)
  if (!r) return 0
  const missed = Math.max(0, prevCtx - t.cache_read_input_tokens)
  return (Math.min(t.cache_creation_input_tokens, missed) * writeRate(r, ttlOfTokens(t) ?? ttl)) / 1e6
}

export function addCost(a: CostParts, b: CostParts): CostParts {
  return {
    read: a.read + b.read,
    write: a.write + b.write,
    output: a.output + b.output,
    input: a.input + b.input,
    usd: a.usd + b.usd,
  }
}

const TAIL = 120

export function tailOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(-TAIL)
}

export function endsWithTail(blockText: string, tail: string): boolean {
  if (!tail) return false
  const block = blockText.replace(/\s+/g, ' ').trim()
  if (block.endsWith(tail)) return true
  return block.length >= 20 && tail.endsWith(block)
}

export const CACHE_TTL_MIN = 60

export const CACHE_WARN_5M_DEFAULT = 2

export function cacheWarnFor(t: Pick<Thresholds, 'cacheWarnMin' | 'cacheWarnMin5m'>, ttl: number): number {
  return ttl < 60 ? (t.cacheWarnMin5m ?? CACHE_WARN_5M_DEFAULT) : t.cacheWarnMin
}

export function ttlOf(u: Pick<Usage, 'cacheTtlMin'> | null | undefined): number {
  return u?.cacheTtlMin === 5 ? 5 : CACHE_TTL_MIN
}

export function ttlName(ttl: number): string {
  return ttl < 60 ? L(`${ttl}분`, `${ttl} min`) : L(`${ttl / 60}시간`, `${ttl / 60} h`)
}

export type Estimate =
  | { kind: 'warm'; perCallUsd: number; minsLeft: number | null; ttlMin: number; rewriteUsd: number; rates: Rates }
  | { kind: 'cold'; rewriteUsd: number; rates: Rates; reason: 'expired' | 'model'; ttlMin: number }
  | { kind: 'unpriced' }

export function rewriteAllUsd(ctx: number, r: Rates, shared = 0, ttl: number = CACHE_TTL_MIN): number {
  const s = Math.max(0, Math.min(shared, ctx))
  return ((ctx - s) * writeRate(r, ttl) + s * r.read) / 1e6
}

export function estimate(
  contextTokens: number,
  model: string,
  lastActivityMs: number | null,
  nowMs: number,
  isModelSwitched = false,
  shared = 0,
  ttl: number = CACHE_TTL_MIN,
  isAfterCompact = false,
): Estimate {
  const r = ratesFor(model, contextTokens)
  if (!r || contextTokens <= 0) return { kind: 'unpriced' }
  const rewriteUsd = rewriteAllUsd(contextTokens, r, shared, ttl)
  if (isModelSwitched) return { kind: 'cold', rewriteUsd, rates: r, reason: 'model', ttlMin: ttl }
  const minsLeft = lastActivityMs === null ? null : Math.floor(ttl - (nowMs - lastActivityMs) / 60000)
  if (minsLeft !== null && minsLeft <= 0) return { kind: 'cold', rewriteUsd, rates: r, reason: 'expired', ttlMin: ttl }
  return { kind: 'warm', perCallUsd: isAfterCompact ? rewriteUsd : (contextTokens * r.read) / 1e6, minsLeft, ttlMin: ttl, rewriteUsd, rates: r }
}

export function estimateFor(
  u: Pick<Usage, 'contextTokens' | 'model' | 'lastActivityMs' | 'switchedFrom' | 'sharedTokens' | 'cacheTtlMin' | 'isAfterCompact'>,
  nowMs: number,
  ctx = u.contextTokens,
): Estimate {
  return estimate(ctx, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom), u.sharedTokens ?? 0, ttlOf(u), u.isAfterCompact === true)
}

export const SAVE_GUESS: SaveTurn = { steps: 3, output: 2_000, write: 2_000 }

export const LITTLE_SHRINK = 1.3

export function isLittleToSave(ctx: number, after: number, breakEvenCalls: number | null): boolean {
  return breakEvenCalls === null || ctx < Math.min(after, ctx) * LITTLE_SHRINK
}

export type Payoff = {
  nowCallUsd: number
  afterCallUsd: number
  costUsd: number
  saveCallUsd: number
  saveQuestionUsd: number | null
  breakEvenCalls: number | null
  breakEvenQuestions: number | null
}

export type { CompactInputs, CompactMix, SaveTurn }
export const WARM_COMPACT: CompactMix = { input: 0, read: 1, write: 0 }

export function isWarmMix(mix: CompactMix): boolean {
  return mix.read >= 0.5
}

export function compactMixOf(t: Tokens): CompactMix | null {
  const total = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
  if (total <= 0) return null
  return { input: t.input_tokens / total, read: t.cache_read_input_tokens / total, write: t.cache_creation_input_tokens / total }
}

export function coldCompact(
  ctx: number,
  inputs: CompactInputs,
  model: string,
  shared = 0,
  ttl: number = CACHE_TTL_MIN,
): { continueUsd: number; compactUsd: number } | null {
  const r = ratesFor(model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ra = ratesFor(model, after) ?? r
  const s = Math.max(0, Math.min(shared, ctx))
  return {
    continueUsd: rewriteAllUsd(ctx, r, shared, ttl),
    compactUsd: ((ctx - s) * r.input + s * r.read + inputs.output * r.output) / 1e6 + rewriteAllUsd(after, ra, shared, ttl),
  }
}

export function coldFor(
  u: Pick<Usage, 'contextTokens' | 'model' | 'sharedTokens' | 'cacheTtlMin'>,
  inputs: CompactInputs,
  ctx = u.contextTokens,
): { continueUsd: number; compactUsd: number } | null {
  return coldCompact(ctx, inputs, u.model, u.sharedTokens ?? 0, ttlOf(u))
}

export const SESSION_TEXT = ['warning', '#d9722b', 'error'] as const

export function sessionColorOf(usd: number, colors: readonly [number, number, number]): string | undefined {
  if (usd >= colors[2]) return SESSION_TEXT[2]
  if (usd >= colors[1]) return SESSION_TEXT[1]
  if (usd >= colors[0]) return SESSION_TEXT[0]
  return undefined
}

export function compactPayoff(ctx: number, inputs: CompactInputs, model: string, callsPerQuestion: number | null, ttl: number = CACHE_TTL_MIN): Payoff | null {
  const r = ratesFor(model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ra = ratesFor(model, after) ?? r
  const mix = inputs.mix
  const nowCallUsd = (ctx * r.read) / 1e6
  const afterCallUsd = (after * ra.read) / 1e6
  const compactUsd = (ctx * (mix.input * r.input + mix.read * r.read + mix.write * r.write1h) + inputs.output * r.output) / 1e6
  const tt = inputs.ttl ?? ttl
  const save = inputs.save ?? SAVE_GUESS
  const saveUsd = nowCallUsd * save.steps + (save.output * r.output + save.write * writeRate(r, tt)) / 1e6
  const costUsd = saveUsd + compactUsd + (Math.min(inputs.summary, after) * writeRate(ra, tt)) / 1e6
  const saveCallUsd = nowCallUsd - afterCallUsd
  const breakEvenCalls = saveCallUsd > 0 ? Math.ceil(costUsd / saveCallUsd) : null
  const perQ = callsPerQuestion !== null && callsPerQuestion > 0 ? callsPerQuestion : null
  return {
    nowCallUsd,
    afterCallUsd,
    costUsd,
    saveCallUsd,
    saveQuestionUsd: perQ === null ? null : saveCallUsd * perQ,
    breakEvenCalls,
    breakEvenQuestions: perQ === null || breakEvenCalls === null ? null : Math.ceil(breakEvenCalls / perQ),
  }
}

export function otherModelOf(model: string): string | null {
  if (!ratesFor(model)) return null
  if (/opus/.test(model)) return 'claude-sonnet-5-5'
  return 'claude-opus-5-5'
}

export function repriceTurns(
  turns: readonly { cost: CostParts; appUsd?: number; model?: string; details?: readonly StepDetail[]; atMs?: number }[],
  to: string,
  ttl: number = CACHE_TTL_MIN,
): { now: number; other: number; count: number; models: string[] } | null {
  if (!ratesFor(to)) return null
  const back = (usd: number, rate: number, toRate: number) => (rate > 0 ? (Math.max(0, usd) / rate) * toRate : 0)
  let now = 0
  let other = 0
  let count = 0
  const models = new Set<string>()
  for (const t of turns) {
    const day = dayOf(t.atMs)
    const r = t.model ? ratesFor(t.model, 0, day) : null
    const rt = ratesFor(to, 0, day)
    if (!r || !rt) continue
    const c = t.cost
    count++
    models.add(modelKey(t.model!))
    now += c.usd - (t.appUsd ?? 0)
    let main = { read: c.read, write: c.write, output: c.output, input: c.input }
    for (const d of t.details ?? []) {
      if (!d.agent || d.read === undefined || d.output === undefined) continue
      const ra = (d.model ? ratesFor(d.model, 0, day) : null) ?? r
      other += back(d.read, ra.read, rt.read) + back(d.write ?? 0, ra.write5m, rt.write5m) + back(d.output, ra.output, rt.output) + back(d.input ?? 0, ra.input, rt.input)
      main = { read: main.read - d.read, write: main.write - (d.write ?? 0), output: main.output - d.output, input: main.input - (d.input ?? 0) }
    }
    other += back(main.read, r.read, rt.read) + back(main.write, writeRate(r, ttl), writeRate(rt, ttl)) + back(main.output, r.output, rt.output) + back(main.input, r.input, rt.input)
  }
  return count === 0 ? null : { now, other, count, models: [...models] }
}

export type Level = 'ok' | 'warn' | 'cut'

export function levelOf(contextTokens: number): Level {
  return contextTokens >= active.ctxCut ? 'cut' : contextTokens >= active.ctxWarn ? 'warn' : 'ok'
}

export const LEVEL_TEXT: Record<Level, string | undefined> = { ok: undefined, warn: '#d9722b', cut: 'error' }

export function limitHex(percent: number): string {
  return percent >= 100 ? '#d03b3b' : '#2a78d6'
}

export const LEVEL_HEX: Record<Level, string> = { ok: '#6b8db8', warn: '#d9722b', cut: '#e05555' }

export function barSvg(percent: number, hex: string, width: number, height: number): string {
  const p = Math.max(0, Math.min(100, percent))
  const r = height / 2
  const fillWidth = p === 0 ? 0 : Math.max(height, (width * p) / 100)
  const fill = fillWidth === 0 ? '' : `<rect width="${fillWidth.toFixed(1)}" height="${height}" rx="${r}" fill="${hex}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="${r}" fill="currentColor" fill-opacity="0.1"/>${fill}</svg>`
}

export const PERM_HEX = '#c3c9d4'

export const CTX_MARK_PAD = 4

export type BarAnim = { pulse?: boolean; fromPercent?: number }

export function barAnimCss(pulse: boolean, shrink: string): string {
  const rules = `${pulse ? '@keyframes cp{50%{opacity:.35}}.fl{animation:cp 1.4s ease-in-out infinite}' : ''}${shrink ? `${shrink}.sh{animation:cs .8s ease-out}` : ''}`
  return rules ? `<style>${rules}@media (prefers-reduced-motion:reduce){.fl,.sh{animation:none!important}}</style>` : ''
}

export function ctxBarSvg(
  percent: number,
  parts: readonly { percent: number; hex: string }[],
  hex: string,
  width: number,
  height: number,
  marks: readonly { percent: number; hex: string }[] = [],
  anim: BarAnim | null = null,
): string {
  const p = Math.max(0, Math.min(100, percent))
  const fw = p === 0 ? 0 : Math.max(height, (width * p) / 100)
  const r = height / 2
  const pad = marks.length > 0 ? CTX_MARK_PAD : 0
  const total = height + pad * 2
  const y = pad > 0 ? ` y="${pad}"` : ''
  const fl = anim?.pulse ? ' class="fl"' : ''
  let body = `<rect${y} width="${width}" height="${height}" fill="#888888" fill-opacity="0.28"/>`
  let x = 0
  for (const part of parts) {
    const w = Math.min(fw - x, (width * Math.max(0, part.percent)) / 100)
    if (w <= 0) break
    body += `<rect${fl} x="${x.toFixed(1)}"${y} width="${Math.max(0, w - 1).toFixed(1)}" height="${height}" fill="${part.hex}"/>`
    x += w
  }
  const fromW = anim?.fromPercent !== undefined ? Math.min(width, (width * Math.max(0, anim.fromPercent)) / 100) - x : null
  const shrink = fromW !== null && fromW > fw - x + 0.5 ? `@keyframes cs{from{width:${fromW.toFixed(1)}px}}` : ''
  const cls = [anim?.pulse ? 'fl' : '', shrink ? 'sh' : ''].filter(Boolean).join(' ')
  if (fw > x) body += `<rect${cls ? ` class="${cls}"` : ''} x="${x.toFixed(1)}"${y} width="${(fw - x).toFixed(1)}" height="${height}" fill="${hex}"/>`
  body = barAnimCss(anim?.pulse === true, shrink) + body
  const xOf = (at: number) => Math.min(width - 1.5, Math.max(1.5, (width * at) / 100))
  const shown = marks.filter(m => m.percent > 0 && m.percent < 100)
  const ticks = shown.map(m => `<rect x="${(xOf(m.percent) - 1.5).toFixed(1)}" width="3" height="${total}" rx="1" fill="${m.hex}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}"><defs><clipPath id="ctx-clip"><rect${y} width="${width}" height="${height}" rx="${r}"/></clipPath></defs><g clip-path="url(#ctx-clip)">${body}</g>${ticks}</svg>`
}

export function pulseSvg(hex: string, size: number): string {
  const r = size / 2 - 1
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${hex}"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></circle></svg>`
}

export function textBar(percent: number, cells: number): string {
  const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * cells)
  return '█'.repeat(n) + '░'.repeat(cells - n)
}

export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}

export type Currency = 'usd' | 'krw'

export const KRW_PER_USD_DEFAULT = 1320

export type FxRate = { rate: number; date: string; gotOn: string }

export const FX_RETRY_MS = 3_600_000

let currency: Currency = 'usd'
let krwPerUsd = KRW_PER_USD_DEFAULT
let krwDate: string | null = null

export function setCurrency(next: Currency): void {
  currency = next
}

export function currencyNow(): Currency {
  return currency
}

export function setKrwRate(fx: FxRate | null): boolean {
  const rate = fx ? fx.rate : KRW_PER_USD_DEFAULT
  const date = fx ? fx.date : null
  if (rate === krwPerUsd && date === krwDate) return false
  krwPerUsd = rate
  krwDate = date
  return true
}

export function krwRateText(): string {
  const n = withComma(Math.round(krwPerUsd))
  return L(`${n}원`, `₩${n}`)
}

export function krwRateDate(): string | null {
  return krwDate
}

export function wonRateText(): string | null {
  if (currency !== 'krw') return null
  return krwDate ? L(`${krwRateText()}(${krwDate.slice(5)} 유럽중앙은행 기준)`, `${krwRateText()} (ECB, ${krwDate})`) : L(`${krwRateText()}(들어 있는 값)`, `${krwRateText()} (built-in rate)`)
}

export function parseFx(text: string, gotOn: string): FxRate | null {
  try {
    const j = JSON.parse(text) as { date?: unknown; rates?: { KRW?: unknown } }
    const rate = j.rates?.KRW
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 100 || rate > 10_000) return null
    if (typeof j.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(j.date)) return null
    return { rate, date: j.date, gotOn }
  } catch {
    return null
  }
}

export function fxFrom(raw: unknown): FxRate | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<FxRate>
  if (typeof r.rate !== 'number' || !Number.isFinite(r.rate) || r.rate < 100 || r.rate > 10_000) return null
  if (typeof r.date !== 'string' || typeof r.gotOn !== 'string') return null
  return { rate: r.rate, date: r.date, gotOn: r.gotOn }
}

export function needsFx(saved: FxRate | null, today: string, nowMs: number, triedAt: number | null): boolean {
  if (saved?.gotOn === today) return false
  return triedAt === null || nowMs - triedAt >= FX_RETRY_MS
}

export function localDayOf(ms: number): string {
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

export function fmtUsd(usd: number): string {
  if (currency === 'krw') return fmtKrw(usd * krwPerUsd)
  if (isSubCent(usd)) return L('$0.01 이하', 'under $0.01')
  return `$${usd.toFixed(2).replace(/^(-?)(\d+)/, (_m, sign: string, int: string) => sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ','))}`
}

export function isSubCent(usd: number): boolean {
  return currency === 'krw' ? usd > 0 && usd * krwPerUsd < 0.5 : usd > 0 && usd < 0.005
}

export function approxUsd(usd: number): string {
  return isSubCent(usd) ? fmtUsd(usd) : `~${fmtUsd(usd)}`
}

export function fmtUsdRange(lo: number, hi: number): string {
  if (currency === 'krw') {
    const [a, b] = [lo * krwPerUsd, hi * krwPerUsd]
    if (b < 0.5) return fmtKrw(b)
    const pb = krwParts(b)
    const pa = a < 0.5 ? { num: '0', unit: pb.unit } : krwParts(a)
    if (lang() !== 'ko') return `₩${pa.num}~${pb.num}`
    return pa.unit === pb.unit ? `${pa.num}~${pb.num}${pb.unit}` : `${pa.num}${pa.unit}~${pb.num}${pb.unit}`
  }
  if (hi < 0.005) return fmtUsd(hi)
  return `${isSubCent(lo) ? '$0.00' : fmtUsd(lo)}~${fmtUsd(hi).slice(1)}`
}

export function fmtKrw(won: number): string {
  const a = Math.abs(won)
  if (a > 0 && a < 0.5) return L('1원 이하', 'under ₩1')
  const p = krwParts(a)
  const sign = won < 0 && p.num !== '0' ? '-' : ''
  return lang() === 'ko' ? `${sign}${p.num}${p.unit}` : `${sign}₩${p.num}`
}

const withComma = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const oneDecimal = (n: number): string => n.toFixed(1).replace(/\.0$/, '')

function krwParts(a: number): { num: string; unit: string } {
  if (lang() !== 'ko') return { num: withComma(a < 1000 ? Math.round(a) : Math.round(a / 10) * 10), unit: '' }
  if (a < 100) return { num: String(Math.round(a)), unit: '원' }
  const won = Math.round(a / 10) * 10
  if (won < 1e4) return { num: withComma(won), unit: '원' }
  const man = Math.round(a / 1e3) / 10
  if (man < 100) return { num: oneDecimal(man), unit: '만원' }
  const man0 = Math.round(a / 1e4)
  if (man0 < 1e4) return { num: withComma(man0), unit: '만원' }
  return { num: oneDecimal(Math.round(a / 1e7) / 10), unit: '억원' }
}

export function fmtUntil(iso: string, nowMs: number): string {
  const ms = Date.parse(iso) - nowMs
  if (Number.isNaN(ms)) return ''
  const mins = Math.max(0, Math.round(ms / 60000))
  const h = Math.floor(mins / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return L(`${d}일 ${h % 24}시간`, `${d}d ${h % 24}h`)
  return h > 0 ? L(`${h}시간 ${mins % 60}분`, `${h}h ${mins % 60}m`) : L(`${mins}분`, `${mins}m`)
}

export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length
}

export function projectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}

export function guessTtl(cfg: TtlConfig | null): number {
  if (cfg?.value) return cfg.value === '5m' ? 5 : 60
  return 60
}

export function cacheRankOf(u: Usage, nowMs: number): number {
  const est = estimateFor(u, nowMs)
  if (est.kind === 'cold') return 2
  return est.kind !== 'unpriced' && est.minsLeft !== null && est.minsLeft < cacheWarnFor(thresholds(), est.ttlMin) ? 1 : 0
}
