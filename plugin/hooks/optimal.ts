import type { CompactInputs, Optimal, Thresholds, Usage } from '../types'
import { compactPayoff, longTierOver, modelKey, ratesFor } from './cost'
import type { Flow } from './flow'

export const GROWTH_GUESS = 3_000
export const SUMMARY_GUESS = 30_000
export const OUTPUT_GUESS = 10_000
export const MIN_GROWTH_STEPS = 5
const GROWTH_WINDOW = 200
export const WARN_RATIO = 0.8
export const COMPACT_STEP = 10_000
export const COMPACT_MIN = 100_000
export const COMPACT_MAX = 1_000_000
const LONG_CUT = 0.95
const LONG_WARN = 0.85

const roundStep = (v: number) => Math.round(v / COMPACT_STEP) * COMPACT_STEP

export function growthPerStep(flow: Flow): { g: number; n: number } {
  const cuts = new Set(flow.compactions.map(c => c.index))
  const diffs: number[] = []
  for (let i = flow.points.length - 1; i >= 1 && diffs.length < GROWTH_WINDOW; i--) {
    if (cuts.has(i)) continue
    const a = flow.points[i - 1]!
    const b = flow.points[i]!
    if (a.model && b.model && modelKey(a.model) !== modelKey(b.model)) continue
    diffs.push(Math.max(0, b.ctx - a.ctx))
  }
  return { g: diffs.length > 0 ? diffs.reduce((s, d) => s + d, 0) / diffs.length : 0, n: diffs.length }
}

export function onceUsd(model: string, inputs: CompactInputs): number | null {
  return compactPayoff(inputs.after, inputs, model, null)?.costUsd ?? null
}

function averageAt(at: number, model: string, inputs: CompactInputs, growth: number): number | null {
  const r = ratesFor(model, 0)
  const b = inputs.after
  if (!r || growth <= 0 || at <= b) return null
  const n = (at - b) / growth
  const k = compactPayoff(at, inputs, model, null)?.costUsd
  if (k === undefined) return null
  return (r.read / 1e6) * (b + (growth * (n + 1)) / 2) + k / n
}

function rawOptimal(model: string, inputs: CompactInputs, growth: number): number | null {
  const r = ratesFor(model, 0)
  const k = onceUsd(model, inputs)
  if (!r || k === null || growth <= 0 || r.read <= 0) return null
  return inputs.after + Math.sqrt((2 * growth * k) / (r.read / 1e6))
}

export function optimalAt(model: string, inputs: CompactInputs, growth: number): { at: number; capped: number | null } | null {
  const raw = rawOptimal(model, inputs, growth)
  if (raw === null) return null
  const over = longTierOver(model)
  const cap = over === null ? null : Math.round(over * LONG_CUT)
  const at = Math.max(roundStep(raw), roundStep(inputs.after) + COMPACT_STEP)
  return cap !== null && at > cap ? { at: cap, capped: over } : { at, capped: null }
}

export function penaltyAt(at: number, model: string, inputs: CompactInputs, growth: number): { pct: number; every: number } | null {
  const raw = rawOptimal(model, inputs, growth)
  const avg = averageAt(at, model, inputs, growth)
  if (raw === null || avg === null) return null
  const over = longTierOver(model)
  const best = averageAt(over === null ? raw : Math.min(raw, over * LONG_CUT), model, inputs, growth)
  if (best === null || best <= 0) return null
  return { pct: Math.max(0, (avg / best - 1) * 100), every: Math.round((at - inputs.after) / growth) }
}

export function keepOptimal(prev: Optimal | null, next: Optimal): Optimal {
  if (!prev || prev.at === null) return next
  const key = (o: Optimal) => JSON.stringify([o.model ? modelKey(o.model) : '', o.inputs, o.growthSrc])
  return key(prev) === key(next) ? prev : next
}

export function rangeThresholdsFor(start: number, end: number, model: string, cacheWarnMin: number): Thresholds {
  const over = longTierOver(model)
  const ctxCut = over === null ? end : Math.min(end, Math.round(over * LONG_CUT))
  const warn = over === null ? start : Math.min(start, Math.round(over * LONG_WARN))
  return { ctxWarn: Math.min(warn, ctxCut), ctxCut, cacheWarnMin, isRange: true }
}

export function thresholdsFor(at: number, model: string, cacheWarnMin: number): Thresholds {
  const over = longTierOver(model)
  const ctxCut = over === null ? at : Math.min(at, Math.round(over * LONG_CUT))
  const warn = roundStep(ctxCut * WARN_RATIO)
  const ctxWarn = over === null ? warn : Math.min(warn, Math.round(over * LONG_WARN))
  return { ctxWarn: Math.min(ctxWarn, ctxCut), ctxCut, cacheWarnMin }
}

export function baseOfCategories(categories: Usage['categories']): number | null {
  const sum = categories.filter(c => c.kind === 'used' && !/message|summary|compact/i.test(c.name)).reduce((s, c) => s + c.tokens, 0)
  return sum > 0 ? sum : null
}
