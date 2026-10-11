import { expect, test } from 'claude-code/testing'

import { setLang } from './i18n'

import { growthPerStep, keepOptimal, onceUsd, optimalAt, penaltyAt, rangeThresholdsFor, thresholdsFor } from './optimal'
import type { CompactEvent, CtxPoint, Optimal } from '../types'

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

const OPUS = 'claude-opus-5-5'
const pt = (ctx: number, model = OPUS): CtxPoint => ({ atMs: 0, ctx, usd: 0, model })
const compact = (index: number, after: number): CompactEvent => ({ atMs: 0, trigger: 'manual', before: 0, after, costUsd: null, index })
// 컴팩트 직후 8.4만 중 요약 2.8만 · 요약 출력 1만 · 컴팩트 요청은 전부 정가 입력
const IN = { after: 84_000, summary: 28_000, output: 10_000, mix: { input: 1, read: 0, write: 0 } }

test('요청당 증가: 같은 구간 · 같은 모델 이웃 요청만 — 컴팩트로 떨어진 자리 · 모델 바꾼 자리는 뺀다', () => {
  const flow = {
    points: [pt(100_000), pt(110_000), pt(50_000), pt(51_000), pt(40_000, 'claude-sonnet-5-5')],
    compactions: [compact(2, 50_000)],
  }
  expect(growthPerStep(flow)).toEqual({ g: 5500, n: 2 })
})

test('직후 크기에서 컴팩트 한 번 값 K(b): 저장 턴(읽기 3회 + 출력 · 새로 씀) + 정가 입력 + 요약 출력 + 요약 다시 쓰기', () => {
  // 저장 턴 8.4만 × $0.20 × 3 + 출력 2천 × $20 + 새로 씀 2천 × $8 = $0.05 + $0.04 + $0.016(가정)
  // + 8.4만 × $4 + 1만 × $20 + 2.8만 × $8 = $0.34 + $0.20 + $0.22 ≈ $0.87
  expect(Math.round(onceUsd(OPUS, IN)! * 100)).toBe(87)
  expect(onceUsd('unknown-model', IN)).toBe(null)
  // 이 PC 에서 잰 저장 턴이 있으면 그 값으로(요청 2회 · 출력 4천 · 새로 씀 0): $0.034 + $0.08 + $0.76 ≈ $0.87
  expect(Math.round(onceUsd(OPUS, { ...IN, save: { steps: 2, output: 4_000, write: 0 } })! * 100)).toBe(87)
  // 저장 턴의 크기와 상관없는 몫(출력 · 새로 씀)만큼 권장이 늦어진다 — 빼면 24만, 넣으면 25만
  expect(optimalAt(OPUS, { ...IN, save: { steps: 3, output: 0, write: 0 } }, 3000)!.at).toBe(240_000)
})

test('계산식 최적: 직후 크기 + √(2 × 증가 × K(b) ÷ 읽기) — 모델마다 읽기/입력 비가 달라 값이 다르다', () => {
  // Opus 5.5(읽기 = 입력의 5%): 8.4만 + √(2 × 3천 × $0.87 ÷ $0.20/M) ≈ 25만
  expect(optimalAt(OPUS, IN, 3000)).toEqual({ at: 250_000, capped: null })
  // Sonnet 5(10%): ≈ 20만
  expect(optimalAt('claude-sonnet-5', IN, 3000)).toEqual({ at: 200_000, capped: null })
  // 증가가 4배면 직후 크기 위 거리는 2배(√)
  expect(optimalAt(OPUS, IN, 12_000)!.at).toBe(410_000)
  // Haiku 5.5 는 10만부터 요청 전체가 5배 — 그 아래로 묶는다
  expect(optimalAt('claude-haiku-5-5', IN, 3000)).toEqual({ at: 95_000, capped: 100_000 })
  expect(optimalAt('unknown-model', IN, 3000)).toBe(null)
  expect(optimalAt(OPUS, IN, 0)).toBe(null)
})

test('최적에선 그동안 더 읽은 값이 K(b) — 미룬 값 게이지 100% 가 계산식 최적과 같은 때', () => {
  const g = 3000
  const raw = 84_000 + Math.sqrt((2 * g * onceUsd(OPUS, IN)!) / 0.2e-6)
  const n = (raw - IN.after) / g
  const extra = ((g * n * n) / 2) * 0.2e-6
  expect(Math.round(extra * 1000)).toBe(Math.round(onceUsd(OPUS, IN)! * 1000))
})

test('최적보다 얼마나 더 드나: 최적 근처는 평평하고, 일찍 할수록 크게 는다. 직후 크기 이하면 셀 수 없다', () => {
  expect(Math.round(penaltyAt(250_000, OPUS, IN, 3000)!.pct)).toBe(0)
  // 20만 · 30만은 +2~3%, 15만(API 기본 트리거)은 +22%, 50만은 +25%
  expect(Math.round(penaltyAt(200_000, OPUS, IN, 3000)!.pct)).toBe(3)
  expect(Math.round(penaltyAt(300_000, OPUS, IN, 3000)!.pct)).toBe(2)
  expect(Math.round(penaltyAt(150_000, OPUS, IN, 3000)!.pct)).toBe(22)
  expect(Math.round(penaltyAt(500_000, OPUS, IN, 3000)!.pct)).toBe(25)
  // 몇 요청마다 컴팩트하게 되나: (25만 − 8.4만) ÷ 3천 = 55
  expect(penaltyAt(250_000, OPUS, IN, 3000)!.every).toBe(55)
  expect(penaltyAt(80_000, OPUS, IN, 3000)).toBe(null)
})

test('컴팩트 구간으로 걸 기준: 노랑 = 시작, 빨강 = 끝', () => {
  // Haiku 5.5 는 둘 다 10만 경계 아래로(빨강 95%, 노랑 85%)
  expect(rangeThresholdsFor(150_000, 210_000, OPUS, 10)).toEqual({ ctxWarn: 150_000, ctxCut: 210_000, cacheWarnMin: 10, isRange: true })
  expect(rangeThresholdsFor(95_000, 105_000, 'claude-haiku-5-5', 10)).toEqual({ ctxWarn: 85_000, ctxCut: 95_000, cacheWarnMin: 10, isRange: true })
})

test('걸 기준: 강조 = 권장의 80%(1만 단위), Haiku 5.5 는 경계 아래로', () => {
  expect(thresholdsFor(250_000, OPUS, 10)).toEqual({ ctxWarn: 200_000, ctxCut: 250_000, cacheWarnMin: 10 })
  expect(thresholdsFor(240_000, OPUS, 5)).toEqual({ ctxWarn: 190_000, ctxCut: 240_000, cacheWarnMin: 5 })
  expect(thresholdsFor(250_000, 'claude-haiku-5-5', 10)).toEqual({ ctxWarn: 80_000, ctxCut: 95_000, cacheWarnMin: 10 })
})

test('구간 안에선 최적을 그대로: 요청당 증가만 밀리면 앞 값, 모델 · 직후 크기 · 증가 출처가 바뀌면 새 값', () => {
  const src = { after: 'session', summary: 'session', output: 'pc', mix: 'pc' } as const
  const opt = (over: Partial<Optimal>): Optimal => ({
    model: OPUS, inputs: IN, src, growth: 3000, growthN: 200, growthSrc: 'session', at: 240_000, onceUsd: 0.81, capped: null, ...over,
  })
  const prev = opt({})
  // 증가가 2.6k 로 밀려 최적이 21만이 돼도 같은 구간이면 24만 그대로(19만 ↔ 20만 깜빡임을 막는다)
  expect(keepOptimal(prev, opt({ growth: 2600, at: 210_000 })).at).toBe(240_000)
  // 같은 모델의 다른 이름(날짜 붙은 id)도 같은 모델
  expect(keepOptimal(prev, opt({ model: 'claude-opus-5-5-20260901', growth: 2600, at: 210_000 })).at).toBe(240_000)
  // 컴팩트로 직후 크기가 바뀌면 · 모델을 바꾸면 · 증가가 가정에서 이 세션 값이 되면 다시 정한다
  expect(keepOptimal(prev, opt({ inputs: { ...IN, after: 90_000 }, at: 250_000 })).at).toBe(250_000)
  expect(keepOptimal(prev, opt({ model: 'claude-sonnet-5', at: 200_000 })).at).toBe(200_000)
  expect(keepOptimal(opt({ growthSrc: 'guess' }), opt({ at: 210_000 })).at).toBe(210_000)
  // 앞 값이 없거나 못 냈으면 새 값
  expect(keepOptimal(null, prev)).toBe(prev)
  expect(keepOptimal(opt({ at: null }), prev)).toBe(prev)
})
