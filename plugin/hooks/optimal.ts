// 컴팩트 권장 크기: 공식 요율과 지금 세션의 사실로 낸 계산식 최적점.
//
// 요청마다 컨텍스트 전체를 다시 읽으니 미룰수록 더 읽는 값이 늘고, 컴팩트는 한 번에 값이 든다 — 재고 관리의 경제적
// 주문량(EOQ)과 같은 꼴이다. 컴팩트 직후 크기 b 에서 요청마다 g 씩 커지고 C 에서 컴팩트하면(n = (C − b) / g 요청마다)
//   요청당 평균 = 읽기 × (b + g(n+1)/2) + K(C) / n,   K = 컴팩트 한 번 값(cost.ts compactPayoff)
// K 는 크기에 비례하는 몫과 고정 몫으로 나뉘고, 비례 몫은 언제 하든 요청당 같은 값으로 나뉜다. 그래서 시점을 정하는 건
// K(b) = 직후 크기에서 컴팩트 한 번 값뿐이고, 최적은 C* = b + √(2 · g · K(b) / 읽기).
// 최적에선 그동안 더 읽은 값이 K(b) 와 같아진다 — 미룬 값 게이지의 100% 눈금이 이 값이다.
//
// 공식 문서엔 "언제 컴팩트" 기준이 없다(2026-10-11 조사). 요율은 1M 까지 같아 계단도 없다(Haiku 5.5 의 10만 5배만 예외).
// 지난 세션들의 기록(습관)은 쓰지 않는다 — 공유하는 mod 라 기준이 사람 · 습관마다 움직이지 않게. 지금 세션의 사실
// (모델 · 컴팩트 직후 크기 · 요청당 증가)을 재고, 아직 못 잰 값은 아래 가정으로 두고 설정 화면에 출처를 보인다.
// 검증(2026-10-11, 작성자 기록): 식의 값 = 격자 탐색 최소. 실제 세션 128개로 모의하면 최적 근처 23만~33만이 +2% 안으로
// 평평하다. 식에 없는 것 — 컴팩트 직후엔 파일을 다시 읽어 더 빨리 커진다(최적이 조금 늦어짐), 세션은 언젠가 끝난다(늦게 하는
// 손해가 줄어듦), 1시간 넘게 쉬면 전체를 다시 쓴다(쉬기 전 컴팩트가 유리), 요약으로 잃는 맥락(값으로 안 셈).
//
// 이 최적은 한 점으로 권하지 않는다 — 설정의 0~100만 비용표에서 "최적 대비" 칸과 ★ 로만 보이고, 구간(시작 · 끝)은 사람이
// 그 표에서 고른다(rangeThresholdsFor). 한 점은 컴팩트할 때마다 움직였고(이 세션 145k ~ 199k),
// 가볍게 컴팩트할수록 오히려 내려가 "이게 맞나" 싶었다. 바닥이 평평하다 — 이 세션 2,106요청을 천장만
// 바꿔 다시 돌리면 150k 가 최저 $71.0, 175k +1.4%, 200k +6.1%, 300k +30%, 500k +80%(작성자 기록, 1시간 넘는 쉼 · 늦을수록 커지는
// 요약 몫 포함). 정확한 점보다 크게 미루지 않는 게 수십 %짜리 일이고, 구간 안 어디서 할지는 하던 일이 끊기기 좋은 때로.

import type { CompactInputs, Optimal, Thresholds, Usage } from '../types'
import { compactPayoff, longTierOver, modelKey, ratesFor } from './cost'
import type { Flow } from './flow'

/** 요청당 증가 가정 — 이 세션에서 MIN_GROWTH_STEPS 쌍을 재기 전. 최적은 √g 라 2배 틀려도 최적보다 +6% 안 */
export const GROWTH_GUESS = 3_000
/** 컴팩트 요약(다시 붙는 파일 포함) 가정 — 이 PC 에서 컴팩트를 재기 전 */
export const SUMMARY_GUESS = 30_000
/** 요약 출력 토큰 가정 — 이 PC 에서 컴팩트를 재기 전 */
export const OUTPUT_GUESS = 10_000
/** 요청당 증가를 이만큼 이웃 요청에서 재야 이 세션 값으로 */
export const MIN_GROWTH_STEPS = 5
/** 요청당 증가는 최근 이웃 요청 이만큼으로 */
const GROWTH_WINDOW = 200
/** 강조 = 권장의 이만큼 — 요청 수로 √½ 앞(최적보다 +6% 지점)을 크기로 어림 */
export const WARN_RATIO = 0.8
/** 권장 크기의 단위와 ◀ ▶ 범위 */
export const COMPACT_STEP = 10_000
export const COMPACT_MIN = 100_000
export const COMPACT_MAX = 1_000_000
/** 긴 프롬프트 요율 경계가 있는 모델은 권장 · 강조를 경계의 이 몫 아래로 — 넘는 순간 요청 전체가 5배 */
const LONG_CUT = 0.95
const LONG_WARN = 0.85

const roundStep = (v: number) => Math.round(v / COMPACT_STEP) * COMPACT_STEP

/**
 * 컨텍스트가 요청마다 느는 평균(토큰). 같은 구간(컴팩트 사이) · 같은 모델 이웃 요청의 크기 차, 줄어든 건 0 으로(도구 결과
 * 정리 등). 최근 GROWTH_WINDOW 쌍. 지금 구간이 짧으면 앞 구간까지 — 컴팩트 직후에도 이 세션의 속도를 쓴다
 */
export function growthPerStep(flow: Flow): { g: number; n: number } {
  const cuts = new Set(flow.compactions.map(c => c.index))
  const diffs: number[] = []
  for (let i = flow.points.length - 1; i >= 1 && diffs.length < GROWTH_WINDOW; i--) {
    if (cuts.has(i)) continue // i 앞에서 컴팩트 — 크기가 뚝 떨어진 자리
    const a = flow.points[i - 1]!
    const b = flow.points[i]!
    if (a.model && b.model && modelKey(a.model) !== modelKey(b.model)) continue // 모델마다 세는 값이 다르다
    diffs.push(Math.max(0, b.ctx - a.ctx))
  }
  return { g: diffs.length > 0 ? diffs.reduce((s, d) => s + d, 0) / diffs.length : 0, n: diffs.length }
}

/** 직후 크기에서 컴팩트 한 번 값 K(b) — 시점을 정하는 몫이자 게이지 100% */
export function onceUsd(model: string, inputs: CompactInputs): number | null {
  return compactPayoff(inputs.after, inputs, model, null)?.costUsd ?? null
}

/** 요청당 평균(읽기 + 컴팩트 값 나눔). C 가 직후 크기 이하면 null */
function averageAt(at: number, model: string, inputs: CompactInputs, growth: number): number | null {
  const r = ratesFor(model, 0)
  const b = inputs.after
  if (!r || growth <= 0 || at <= b) return null
  const n = (at - b) / growth
  const k = compactPayoff(at, inputs, model, null)?.costUsd
  if (k === undefined) return null
  return (r.read / 1e6) * (b + (growth * (n + 1)) / 2) + k / n
}

/** 계산식 최적(반올림 전). 요율을 모르거나 커지지 않으면 null */
function rawOptimal(model: string, inputs: CompactInputs, growth: number): number | null {
  const r = ratesFor(model, 0)
  const k = onceUsd(model, inputs)
  if (!r || k === null || growth <= 0 || r.read <= 0) return null
  return inputs.after + Math.sqrt((2 * growth * k) / (r.read / 1e6))
}

/** 계산식 최적 크기(1만 단위). 긴 프롬프트 요율이 있는 모델은 그 경계 아래로 묶고 capped 에 경계를 */
export function optimalAt(model: string, inputs: CompactInputs, growth: number): { at: number; capped: number | null } | null {
  const raw = rawOptimal(model, inputs, growth)
  if (raw === null) return null
  const over = longTierOver(model)
  const cap = over === null ? null : Math.round(over * LONG_CUT)
  const at = Math.max(roundStep(raw), roundStep(inputs.after) + COMPACT_STEP)
  return cap !== null && at > cap ? { at: cap, capped: over } : { at, capped: null }
}

/**
 * at 에서 컴팩트하면 요청당 평균이 최적보다 몇 % 더 드는지와 몇 요청마다 컴팩트하게 되는지. 직후 크기 이하면 null
 * (그 크기에선 컴팩트해도 줄지 않는다)
 */
export function penaltyAt(at: number, model: string, inputs: CompactInputs, growth: number): { pct: number; every: number } | null {
  const raw = rawOptimal(model, inputs, growth)
  const avg = averageAt(at, model, inputs, growth)
  if (raw === null || avg === null) return null
  const over = longTierOver(model)
  const best = averageAt(over === null ? raw : Math.min(raw, over * LONG_CUT), model, inputs, growth)
  if (best === null || best <= 0) return null
  return { pct: Math.max(0, (avg / best - 1) * 100), every: Math.round((at - inputs.after) / growth) }
}

/**
 * 구간 안에선 최적을 다시 정하지 않는다: 모델 · 컴팩트 직후 크기 · 요약 · 출력 · 입력 몫 · 증가의 출처가 그대로면 앞 값을
 * 그대로 둔다. 요청당 증가는 요청마다 조금씩 밀려 1만 단위에서 19만 ↔ 20만으로 깜빡였다(2026-10-11, 이 세션 1,600요청 중
 * 27번, 그 사이 차이는 1% 안) — 다가가는 목표선이 구간 도중에 움직이지 않게. 컴팩트 직후 크기를 잰 요청 · 모델을
 * 바꾼 요청에서 그때의 증가로 다시 정한다
 */
export function keepOptimal(prev: Optimal | null, next: Optimal): Optimal {
  if (!prev || prev.at === null) return next
  // 공통 앞부분 · 질문 꼴은 최적 크기와 상관없다 — 부르는 쪽이 늘 새 값으로 덮는다(register.tsx applyThresholds)
  const key = (o: Optimal) => JSON.stringify([o.model ? modelKey(o.model) : '', o.inputs, o.growthSrc])
  return key(prev) === key(next) ? prev : next
}

/**
 * 구간으로 걸 기준: 노랑 = 구간 시작, 빨강 = 구간 끝 — 둘 다 긴 프롬프트 경계 아래로(경계를 넘는 순간 요청 전체가 5배)
 */
export function rangeThresholdsFor(start: number, end: number, model: string, cacheWarnMin: number): Thresholds {
  const over = longTierOver(model)
  const ctxCut = over === null ? end : Math.min(end, Math.round(over * LONG_CUT))
  const warn = over === null ? start : Math.min(start, Math.round(over * LONG_WARN))
  return { ctxWarn: Math.min(warn, ctxCut), ctxCut, cacheWarnMin, isRange: true }
}

/**
 * 직접 정한 크기로 걸 기준: 빨강 = at(긴 프롬프트 경계 아래로), 노랑 = 그 WARN_RATIO. 요청 값 색도 이 크기를 따른다(cost.ts)
 */
export function thresholdsFor(at: number, model: string, cacheWarnMin: number): Thresholds {
  const over = longTierOver(model)
  const ctxCut = over === null ? at : Math.min(at, Math.round(over * LONG_CUT))
  const warn = roundStep(ctxCut * WARN_RATIO)
  const ctxWarn = over === null ? warn : Math.min(warn, Math.round(over * LONG_WARN))
  return { ctxWarn: Math.min(ctxWarn, ctxCut), ctxCut, cacheWarnMin }
}

/** /context 분류에서 기본 적재(시스템 지시 · 도구 · 메모리 · 스킬 등) — 대화 · 요약 · 빈칸 · 버퍼는 뺀다. 모르면 null */
export function baseOfCategories(categories: Usage['categories']): number | null {
  const sum = categories.filter(c => c.kind === 'used' && !/message|summary|compact/i.test(c.name)).reduce((s, c) => s + c.tokens, 0)
  return sum > 0 ? sum : null
}
