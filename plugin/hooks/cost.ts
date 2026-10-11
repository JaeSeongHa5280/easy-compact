// 비용 예측과 그리기 재료.
//
// 요율: Anthropic 1차 API 정가(claude-api 스킬 가격표, 2026-10-06 기준). 모델마다 다르다 — API 가 요청마다
// 알려 주는 모델 id 로 고른다. 캐시 쓰기는 입력의 1.25배(5분) · 2배(1시간), 읽기는 모델마다 다른 배수.
// 2026-10-10 이전 판은 Opus 5 요율($5/$25, 읽기 $0.50)을 고정으로 써서 Opus 5.5 세션을 높게 쟀다.
//
// 2026-10-10 실측(이 mod 를 만든 세션 14턴): 턴당 호출 1~39회, 평균 9회 — 턴당 호출 수를 가정하면
// 3배 틀린다. 그래서 "요청 1회" 값과, 요청마다 API 가 보고한 토큰으로 잰 실제 질문 비용을 보인다.

import type { CompactInputs, CompactMix, CostParts, SaveTurn, Thresholds } from '../types'
import { L } from './i18n'

/** $/MTok. write5m · write1h 는 입력의 1.25배 · 2배 */
export type Rates = { label: string; input: number; output: number; read: number; write5m: number; write1h: number }

const rates = (label: string, input: number, output: number, read: number): Rates => ({
  label,
  input,
  output,
  read,
  write5m: input * 1.25,
  write1h: input * 2,
})

/** 위에서부터 처음 맞는 줄. 버전이 긴 것을 먼저 둔다(opus-5-5 가 opus-5 보다 위) */
const PRICE_TABLE: { match: RegExp; base: Rates; long?: { over: number; rates: Rates } }[] = [
  { match: /(fable|mythos)-5-1/, base: rates('Fable 5.1', 10, 50, 0.25) },
  { match: /(fable|mythos)-5/, base: rates('Fable 5', 10, 50, 1) },
  { match: /opus-5-5/, base: rates('Opus 5.5', 4, 20, 0.2) },
  { match: /opus-5/, base: rates('Opus 5', 5, 25, 0.5) },
  { match: /opus-4-[5-8]/, base: rates('Opus 4.x', 5, 25, 0.5) },
  { match: /sonnet-5/, base: rates('Sonnet 5.x', 2, 10, 0.2) },
  { match: /sonnet-4/, base: rates('Sonnet 4.x', 3, 15, 0.3) },
  // Haiku 5.5 는 프롬프트가 10만 토큰을 넘으면 요율이 5배다
  {
    match: /haiku-5-5/,
    base: rates('Haiku 5.5', 0.1, 0.5, 0.01),
    long: { over: 100_000, rates: rates('Haiku 5.5 (>100k)', 0.5, 2.5, 0.05) },
  },
  { match: /haiku-4-5/, base: rates('Haiku 4.5', 1, 5, 0.1) },
]

/** 모델 id 에 맞는 요율. 모르는 모델이면 null — 달러를 내지 않고 토큰만 보인다 */
export function ratesFor(model: string, promptTokens = 0): Rates | null {
  const row = PRICE_TABLE.find(r => r.match.test(model))
  if (!row) return null
  return row.long && promptTokens > row.long.over ? row.long.rates : row.base
}

/** 긴 프롬프트 요율이 붙는 경계(토큰). 없는 모델이면 null — 지금은 Haiku 5.5(10만 초과 5배)뿐 */
export function longTierOver(model: string): number | null {
  return PRICE_TABLE.find(r => r.match.test(model))?.long?.over ?? null
}

/**
 * 모델 id → 읽는 이름: "claude-sonnet-5-5" → "Sonnet 5.5", "claude-haiku-4-5-20251001" → "Haiku 4.5".
 * 요율표 이름("Sonnet 5.x")은 요율 묶음이라 5 와 5.5 가 같은 이름이다 — 화면엔 실제 모델을 쓴다.
 * 못 읽으면 요율표 이름, 그것도 없으면 id 그대로
 */
export function modelName(model: string): string {
  const m = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[.*\])?$/.exec(model.trim())
  if (m) return `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ''}`
  return ratesFor(model)?.label ?? model
}

/** 모델 id 비교용: 끝의 "[1m]" · 날짜(-20251001) 꼬리는 떼고 본다 — 엔진과 API 가 같은 모델을 다르게 적는다 */
export function modelKey(model: string): string {
  return model.replace(/\[.*\]$/, '').replace(/-\d{8}$/, '').trim()
}

/** API 가 요청마다 보고하는 네 가지 토큰 수(ModelUsage) */
export type Tokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export const ZERO_COST: CostParts = { read: 0, write: 0, output: 0, input: 0, usd: 0 }

/**
 * 지금 쓰는 색 · 컴팩트 기준. 설정 · 계산식 최적(register.tsx applyThresholds → optimal.ts thresholdsFor)이 바꾼다 — 세션마다
 * 엔진 프로세스가 따로라 모듈 값 하나로 충분하다. 기본값 = 첫 계산 전(첫 요청 전): 권장 25만은 컴팩트 직후 3만~12만 어느
 * 환경에서도 최적보다 +11% 안
 */
export const DEFAULT_THRESHOLDS: Thresholds = { ctxWarn: 200_000, ctxCut: 250_000, cacheWarnMin: 10 }
let active: Thresholds = DEFAULT_THRESHOLDS

export function setThresholds(next: Thresholds): void {
  active = next
}

export function thresholds(): Thresholds {
  return active
}

// 금액 색 문턱은 없다(2026-10-11). 요청 1회 값 = 컨텍스트 × 읽기 요율이라 요청 값은 컨텍스트 색(LEVEL_TEXT[levelOf(크기)])을
// 따르고, 전체를 다시 쓰는 요청(캐시 만료 · 모델 변경)만 빨강이다. 질문 값은 시킨 일의 양이라 칠할 기준이 없어 금액만 보인다 —
// 예전 문턱(내 질문 값 분포의 상위 % · 프리셋 $0.25/$1)은 습관 따라 움직이거나 근거가 없었다

/**
 * 요청 하나의 실제 값 = API 가 보고한 토큰 × 그 모델의 요율. 메인 루프의 캐시 쓰기는 1시간짜리, 하위 에이전트는
 * 5분짜리다(2026-10-11 에이전트 기록의 cache_creation: ephemeral_5m 만 있음). 엔진은 쓰기 종류를 안 알려 준다.
 * 모르는 모델이면 null.
 */
export function costOf(t: Tokens, model: string, writeTtl: '1h' | '5m' = '1h'): CostParts | null {
  const prompt = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
  const r = ratesFor(model, prompt)
  if (!r) return null
  const read = (t.cache_read_input_tokens * r.read) / 1e6
  const write = (t.cache_creation_input_tokens * (writeTtl === '5m' ? r.write5m : r.write1h)) / 1e6
  const output = (t.output_tokens * r.output) / 1e6
  const input = (t.input_tokens * r.input) / 1e6
  return { read, write, output, input, usd: read + write + output + input }
}

/** 캐시를 이만큼 넘게 다시 쓴 요청 · 질문만 그 값을 따로(노랑) 보인다 */
export const REWRITE_NOTE_USD = 0.25

/**
 * 요청 하나가 캐시를 "다시" 쓴 값(달러): 앞 요청까지 있던 컨텍스트 중 이번에 캐시에서 못 읽고 새로 쓴 몫 — 캐시가 식었거나
 * 모델을 바꾼 뒤 첫 요청. prevCtx = 앞 메인 요청의 컨텍스트(flow.ts lastCtxOf), null 이면(세션 첫 요청 · 컴팩트 직후) 0.
 * 새 내용(파일 · 도구 결과)을 쓴 몫은 평소 캐시 쓰기라 넣지 않는다 — 쓰기 값 전체로 세면 새 세션 첫 질문도 "다시 씀" 이 된다
 */
export function rewriteOf(t: Tokens, model: string, prevCtx: number | null): number {
  if (prevCtx === null) return 0
  const r = ratesFor(model, t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens)
  if (!r) return 0
  const missed = Math.max(0, prevCtx - t.cache_read_input_tokens)
  return (Math.min(t.cache_creation_input_tokens, missed) * r.write1h) / 1e6
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

/** 답변 끝부분 — 공백을 하나로 접고 마지막 120자. 답변 블록을 턴 요약과 맞출 때 쓴다 */
export function tailOf(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(-TAIL)
}

/** 블록이 턴 글의 끝이면 참. 마지막 블록이 120자보다 짧으면 블록 전체가 tail 의 끝과 맞는지 본다 */
export function endsWithTail(blockText: string, tail: string): boolean {
  if (!tail) return false
  const block = blockText.replace(/\s+/g, ' ').trim()
  if (block.endsWith(tail)) return true
  return block.length >= 20 && tail.endsWith(block)
}

export const CACHE_TTL_MIN = 60
/** 컨텍스트 색 기준은 thresholds() 의 ctxWarn · ctxCut(설정의 컴팩트 권장 크기). 요청마다 컨텍스트 전체를 다시 읽으니 크기가 곧 요청당 값이다 */

export type Estimate =
  | { kind: 'warm'; perCallUsd: number; minsLeft: number | null; rewriteUsd: number; rates: Rates }
  | { kind: 'cold'; rewriteUsd: number; rates: Rates; reason: 'expired' | 'model' }
  | { kind: 'unpriced' }

/**
 * 지금 입력하면 드는 값. 캐시가 살아 있으면 요청 1회가 컨텍스트를 그 모델의 읽기 요율로 읽고,
 * 마지막 활동에서 60분이 지났으면 첫 요청이 컨텍스트 전체를 1시간 쓰기 요율로 다시 쓴다.
 */
export function estimate(contextTokens: number, model: string, lastActivityMs: number | null, nowMs: number, isModelSwitched = false): Estimate {
  const r = ratesFor(model, contextTokens)
  if (!r || contextTokens <= 0) return { kind: 'unpriced' }
  const rewriteUsd = (contextTokens * r.write1h) / 1e6
  // 모델을 바꿨으면 새 모델엔 이 대화 캐시가 없다 — 식은 캐시와 같다(2026-10-11 기록 7회: 공통 앞부분 ~4.5만만 읽고 나머지 다시 씀)
  if (isModelSwitched) return { kind: 'cold', rewriteUsd, rates: r, reason: 'model' }
  const minsLeft = lastActivityMs === null ? null : Math.floor(CACHE_TTL_MIN - (nowMs - lastActivityMs) / 60000)
  if (minsLeft !== null && minsLeft <= 0) return { kind: 'cold', rewriteUsd, rates: r, reason: 'expired' }
  return { kind: 'warm', perCallUsd: (contextTokens * r.read) / 1e6, minsLeft, rewriteUsd, rates: r }
}

/**
 * 저장 턴 가정 — 이 PC 에서 저장하고 컴팩트를 재기 전. 요청 3회(그만큼 지금 컨텍스트를 읽는다) · 출력 2천 · 새로 씀 2천.
 * 재면 이 PC 의 최근 저장 턴 평균(register.tsx SAVE_KEY). 작성자 세션 9번 실측은 요청 1~4(평균 2.7) · 출력 0.6천~4.4천 ·
 * 새로 씀 0.7천~7천이었다(2026-10-11, 가정이 크게 빗나가지 않는지 본 값 — 기준으로 쓰지 않는다)
 */
export const SAVE_GUESS: SaveTurn = { steps: 3, output: 2_000, write: 2_000 }

/** 정리 후 컴팩트의 손익: 드는 값과, 그 뒤 요청 · 질문마다 아끼는 값 */
export type Payoff = {
  nowCallUsd: number
  afterCallUsd: number
  /** 저장 턴(요청 steps 회 읽기 + 출력 · 새로 씀) + 컴팩트 요청(읽기 + 요약 출력) + 컴팩트 뒤 첫 요청의 요약 쓰기 */
  costUsd: number
  saveCallUsd: number
  /** 질문당 요청 수를 알 때만 */
  saveQuestionUsd: number | null
  /** 본전까지 요청 수 · 질문 수. 아낄 게 없으면 null */
  breakEvenCalls: number | null
  breakEvenQuestions: number | null
}

/**
 * 컴팩트 요청이 입력을 어떻게 내는지(몫, 합 1). 처음엔 전부 캐시 없이 정가 입력으로 본다 — 엔진의 과금 방식이라 사람마다
 * 다르지 않다고 보고, 한 번 대조했다(2026-10-11: /usage 세션 비용과 기록의 요청 합 차이가 컴팩트 직전 크기 × 입력 요율과
 * 맞았다). 컴팩트가 끝날 때 엔진이 주는 실제 토큰으로 다시 잰다
 */
export type { CompactInputs, CompactMix, SaveTurn }
export const UNCACHED_COMPACT: CompactMix = { input: 1, read: 0, write: 0 }

/** 컴팩트 요청의 실제 토큰 → 입력 몫 */
export function compactMixOf(t: Tokens): CompactMix | null {
  const total = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
  if (total <= 0) return null
  return { input: t.input_tokens / total, read: t.cache_read_input_tokens / total, write: t.cache_creation_input_tokens / total }
}

/**
 * 캐시가 식었을 때: 그냥 이어 가면 다음 요청이 컨텍스트 전체를 1시간 쓰기 요율로 다시 쓴다.
 * 바로 컴팩트하면 정가 입력으로 한 번 읽고(+ 요약 출력 ~1만) 줄어든 컨텍스트만 다시 쓴다.
 * 정리 단계는 없다 — 정리 질문도 첫 요청이 전체를 다시 써서 식은 캐시에선 가장 비싼 단계다
 */
export function coldCompact(ctx: number, inputs: CompactInputs, model: string): { continueUsd: number; compactUsd: number } | null {
  const r = ratesFor(model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ra = ratesFor(model, after) ?? r
  return {
    continueUsd: (ctx * r.write1h) / 1e6,
    compactUsd: (ctx * r.input + inputs.output * r.output + after * ra.write1h) / 1e6,
  }
}

export function compactPayoff(ctx: number, inputs: CompactInputs, model: string, callsPerQuestion: number | null): Payoff | null {
  const r = ratesFor(model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ra = ratesFor(model, after) ?? r
  const mix = inputs.mix
  const nowCallUsd = (ctx * r.read) / 1e6
  const afterCallUsd = (after * ra.read) / 1e6
  // 컴팩트 요청: 지금 컨텍스트 전체를 입력으로(몫대로 정가 · 캐시 읽기 · 쓰기) + 요약 출력
  const compactUsd = (ctx * (mix.input * r.input + mix.read * r.read + mix.write * r.write1h) + inputs.output * r.output) / 1e6
  // 저장 턴: 요청마다 지금 컨텍스트를 읽고(크기에 비례 — 시점은 안 바꾼다) 출력 · 새로 쓰기(크기와 상관없음 — 권장을 조금
  // 늦춘다). 컴팩트 뒤 첫 요청은 남는 것 중 요약만 새로 쓴다(시스템 · 도구는 캐시 그대로)
  const save = inputs.save ?? SAVE_GUESS
  const saveUsd = nowCallUsd * save.steps + (save.output * r.output + save.write * r.write1h) / 1e6
  const costUsd = saveUsd + compactUsd + (Math.min(inputs.summary, after) * ra.write1h) / 1e6
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

export type Level = 'ok' | 'warn' | 'cut'

export function levelOf(contextTokens: number): Level {
  return contextTokens >= active.ctxCut ? 'cut' : contextTokens >= active.ctxWarn ? 'warn' : 'ok'
}

/** Text 의 color — 터미널 · 데스크톱 둘 다 아는 이름만 쓴다 */
/** 컨텍스트 글자 색: 강조 · 권장을 넘었을 때만(그 아래는 색 없음 — 어디나 색이면 정작 노랑 · 빨강이 묻힌다) */
export const LEVEL_TEXT: Record<Level, string | undefined> = { ok: undefined, warn: 'yellow', cut: 'red' }

/** 한도 막대 색: 70% 까지 파랑, 90% 까지 주황, 그 위 빨강 */
export function limitHex(percent: number): string {
  return percent >= 90 ? '#e05555' : percent >= 70 ? '#e0a030' : '#5b8def'
}

/** 막대 색: 기준 아래는 차분한 파랑(초록이면 "좋다" 로 읽혀 색이 늘어난다), 넘으면 노랑 · 빨강 */
export const LEVEL_HEX: Record<Level, string> = { ok: '#6b8db8', warn: '#e0a030', cut: '#e05555' }

/** 둥근 진행 막대 SVG(데스크톱). 바탕은 반투명 회색이라 밝은 · 어두운 테마 둘 다 보인다 */
export function barSvg(percent: number, hex: string, width: number, height: number): string {
  const p = Math.max(0, Math.min(100, percent))
  const r = height / 2
  const fillWidth = p === 0 ? 0 : Math.max(height, (width * p) / 100)
  const fill = fillWidth === 0 ? '' : `<rect width="${fillWidth.toFixed(1)}" height="${height}" rx="${r}" fill="${hex}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="${r}" fill="#888888" fill-opacity="0.28"/>${fill}</svg>`
}

/** 컨텍스트 막대의 영구 몫(컴팩트해도 남는 크기) 색 — 크기 단계(파랑 · 노랑 · 빨강) · 컴팩트(청록) · 모델(보라)과 겹치지 않는 밝은 회청색 */
export const PERM_HEX = '#c3c9d4'

/**
 * 컨텍스트 막대(데스크톱): 앞칸들 = 영구 몫(parts — 기본 · 요약, 왼쪽부터), 뒤칸 = 대화 몫(hex), 칸 사이 1px 틈. marks 가
 * 있으면 막대 위아래로 삐져나오는 눈금(선 하나씩).
 * 영구 몫을 컴팩트 효과 안 한 줄로 두니 눈에 안 띄었다 — 지금 컨텍스트 중 컴팩트로 못 줄이는 몫이라 이 막대에서
 * 바로 보이게. 앞칸은 지금 크기(percent)를 넘지 않는다
 */
/** 컨텍스트 막대 눈금이 막대 위아래로 삐져나오는 길이(px) — 눈금이 있으면 그림 높이 = 막대 + 2 × 이 값 */
export const CTX_MARK_PAD = 4

export function ctxBarSvg(
  percent: number,
  parts: readonly { percent: number; hex: string }[],
  hex: string,
  width: number,
  height: number,
  marks: readonly { percent: number; hex: string }[] = [],
): string {
  const p = Math.max(0, Math.min(100, percent))
  const fw = p === 0 ? 0 : Math.max(height, (width * p) / 100)
  const r = height / 2
  // 눈금이 있으면 막대를 가운데로 내리고 위아래에 눈금 자리를 둔다
  const pad = marks.length > 0 ? CTX_MARK_PAD : 0
  const total = height + pad * 2
  const y = pad > 0 ? ` y="${pad}"` : ''
  let body = `<rect${y} width="${width}" height="${height}" fill="#888888" fill-opacity="0.28"/>`
  let x = 0
  for (const part of parts) {
    const w = Math.min(fw - x, (width * Math.max(0, part.percent)) / 100)
    if (w <= 0) break
    body += `<rect x="${x.toFixed(1)}"${y} width="${Math.max(0, w - 1).toFixed(1)}" height="${height}" fill="${part.hex}"/>`
    x += w
  }
  if (fw > x) body += `<rect x="${x.toFixed(1)}"${y} width="${(fw - x).toFixed(1)}" height="${height}" fill="${hex}"/>`
  const xOf = (at: number) => Math.min(width - 1.5, Math.max(1.5, (width * at) / 100))
  const shown = marks.filter(m => m.percent > 0 && m.percent < 100)
  // 기준 눈금(노랑 · 빨강이 시작하는 크기): 막대 위아래로 삐져나오는 3px 세로선 하나씩 — 막대 안의 좁은 칸(컴팩트 요약 등)과
  // 헷갈렸다. 두 선을 위아래 선으로 이어 괄호 상자로 그려 봤더니 난잡했다 — 선 둘만. 지금 크기는 채운 막대
  // 끝이 곧 그 자리라 따로 표시하지 않는다. 막대 밖이라 둥근 끝 자르기 밖에 그린다
  const ticks = shown.map(m => `<rect x="${(xOf(m.percent) - 1.5).toFixed(1)}" width="3" height="${total}" rx="1" fill="${m.hex}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${total}" viewBox="0 0 ${width} ${total}"><defs><clipPath id="ctx-clip"><rect${y} width="${width}" height="${height}" rx="${r}"/></clipPath></defs><g clip-path="url(#ctx-clip)">${body}</g>${ticks}</svg>`
}

/** 깜빡이는 점(데스크톱 SVG · SMIL) — 다시 그리기 없이 움직인다. Svg 의 isInteractive 가 있어야 돈다 */
export function pulseSvg(hex: string, size: number): string {
  const r = size / 2 - 1
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${hex}"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></circle></svg>`
}

/** 터미널용 글자 막대 */
export function textBar(percent: number, cells: number): string {
  const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * cells)
  return '█'.repeat(n) + '░'.repeat(cells - n)
}

/** 134400 → "134k", 1_250_000 → "1.25M", 900 → "900" */
export function fmtTokens(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}

/** 금액은 어디서나 센트까지. 예전엔 $10 이상을 소수 한 자리로 줄여 $42.69 가 $42.7 로 보였다(/usage 와 대조하다 발견) */
export function fmtUsd(usd: number): string {
  return `$${usd.toFixed(2)}`
}

/** 리셋 시각까지: "2시간 13분", "3일 4시간", "12분" */
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

/** "D:\\Claude" → "D--Claude": ~/.claude/projects/ 아래 폴더 이름 규칙 */
export function projectSlug(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}
