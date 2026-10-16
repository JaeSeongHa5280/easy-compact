// 비용 예측과 그리기 재료.
//
// 요율: Anthropic 1차 API 정가(claude-api 스킬 가격표, 2026-10-06 기준). 모델마다 다르다 — API 가 요청마다
// 알려 주는 모델 id 로 고른다. 캐시 쓰기는 입력의 1.25배(5분) · 2배(1시간), 읽기는 모델마다 다른 배수.
// 엔진(claude 실행 파일)의 모델 요율 등급과 같다 — tools/check-rates.mjs 가 빠른 시험마다 견준다(2026-10-15, mod API 는 요율을 주지 않는다).
// 조직이 관리 설정 modelPricing 을 두면 엔진 세션 금액은 그 요율을 쓴다 — 이 mod 는 정가
// 2026-10-10 이전 판은 Opus 5 요율($5/$25, 읽기 $0.50)을 고정으로 써서 Opus 5.5 세션을 높게 쟀다.
//
// 2026-10-10 실측(이 mod 를 만든 세션 14턴): 턴당 호출 1~39회, 평균 9회 — 턴당 호출 수를 가정하면
// 3배 틀린다. 그래서 "요청 1회" 값과, 요청마다 API 가 보고한 토큰으로 잰 실제 질문 비용을 보인다.

import type { CompactInputs, CompactMix, CostParts, SaveTurn, StepDetail, Thresholds, Usage } from '../types'
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
/**
 * 요율 이력(0.9.2 — 회사 PC 금액 차이 보고서 2026-10-16 "현재 + 바로 전 하나만 → 시행일 순 배열"): base = 지금 요율(엔진 등급과 견주는
 * 값), history = 값이 바뀐 모델의 옛 요율 — until(UTC "YYYY-MM-DD", 그날부터 다음 요율) 이른 것부터. 그날의 요율 = until 이 그날보다 늦은
 * 첫 줄, 없으면 base. 다음 인하 · 인상은 지금 base 를 history 끝에 옮기고 base 를 바꾸면 된다. UTC 날짜 단위라 시행일 중 몇 시부터인지는
 * 모른다 — "그날부터" 로 센다(오차는 그날 하루치 일부)
 *
 * 0.9.3(회사 PC 의뢰서 "시행일이 하루 어긋남" 2026-10-16): 앱 설정(사용량) 화면은 날짜가 아니라 요청을 보낸 엔진(Claude Code 판)의 요율표로
 * 센다 — Sonnet 5.5 요청을 기록의 version 으로 가르니 설정 값 = 2.1.295 몫 $0.20 + 2.1.299 몫 $0.10($0.45 차). 엔진 업데이트 시각이
 * PC 마다 달라 고정 날짜는 PC 마다 어긋난다. 그래서 minEngine(그 판부터 새 요율)이 있으면 판으로 고르고, 판을 모르는 요청(옛 기록 · 판을
 * 못 읽은 때)만 until 날짜로 고른다
 */
export type RateChange = { until: string; minEngine?: string; base: Rates; announced?: string }

type PriceRow = {
  match: RegExp
  base: Rates
  long?: { over: number; rates: Rates }
  /** announced = 가격표가 발표한 시행일이 until 과 다를 때 — 패널 요율 줄이 둘 다 보인다. minEngine = 이 판부터 새 요율(0.9.3) */
  history?: readonly RateChange[]
}

const PRICE_TABLE: PriceRow[] = [
  { match: /(fable|mythos)-5-1/, base: rates('Fable 5.1', 10, 50, 0.25) },
  { match: /(fable|mythos)-5/, base: rates('Fable 5', 10, 50, 1) },
  { match: /opus-5-5/, base: rates('Opus 5.5', 4, 20, 0.2) },
  { match: /opus-5/, base: rates('Opus 5', 5, 25, 0.5) },
  { match: /opus-4-[5-8]/, base: rates('Opus 4.x', 5, 25, 0.5) },
  // 옛 모델 — 엔진 요율 등급(tier_15_75 · tier_3_15 · haiku_35)에 맞춰 넣었다(M2, tools/check-rates.mjs 가 엔진 등급과 견준다)
  { match: /opus-4/, base: rates('Opus 4 · 4.1', 15, 75, 1.5) },
  // 요율 변경 기록 — Sonnet 5.5 캐시 읽기 $0.20 → $0.10(입력의 0.1배 → 0.05배, 입력 2 · 출력 10 · 쓰기 그대로). 근거: Anthropic 가격표
  // (platform.claude.com/docs/en/about-claude/pricing — 2026-10-07 부터) · 엔진 2.1.299 등급 tier_2_10_cache_read_0_10(check-rates — 2.1.295
  // 는 tier_2_10 = 읽기 0.2). 0.9.1 은 가격표대로 10-07 부터 셌다. 0.9.2: 금액은 앱 설정(사용량) 화면에 맞춘다 — 회사 PC 대조(2026-10-16, 보고서 둘)에서 설정 화면은 인하를 10-15(UTC) 무렵부터만 반영했다: 10-15 부터로 세면 이번 달
  // $919.1 vs 설정 $920.37(10-07 부터면 $776.86, 10-14 부터면 $899.5). 0.9.3(같은 PC 의뢰서, 기록 10-16T04:26 까지): 설정 $944.34 vs 0.9.2
  // $928.96 — 설정 화면은 요청을 보낸 엔진의 요율표로 센다(2.1.295 = tier_2_10 읽기 $0.20 · 2.1.299 = tier_2_10_cache_read_0_10 $0.10, 그 PC 는
  // 10-16T00:29 UTC 에 2.1.299). 그래서 minEngine 2.1.299, 판을 모르는 요청은 10-16 부터(그 PC 의 날짜 — 판 기준과 같은 선, $944.18).
  // npm 엔 2.1.296(10-09)도 있으나 앱 · 두 PC 는 2.1.295 → 2.1.299 라 그 판의 요율은 모른다(실행 파일을 못 봄)
  { match: /sonnet-5-5/, base: rates('Sonnet 5.5', 2, 10, 0.1), history: [{ until: '2026-10-16', minEngine: '2.1.299', base: rates('Sonnet 5.5', 2, 10, 0.2), announced: '2026-10-07' }] },
  { match: /sonnet-5/, base: rates('Sonnet 5.x', 2, 10, 0.2) },
  { match: /sonnet-4/, base: rates('Sonnet 4.x', 3, 15, 0.3) },
  // Haiku 5.5 는 프롬프트가 10만 토큰을 넘으면 요율이 5배다
  {
    match: /haiku-5-5/,
    base: rates('Haiku 5.5', 0.1, 0.5, 0.01),
    long: { over: 100_000, rates: rates('Haiku 5.5 (>100k)', 0.5, 2.5, 0.05) },
  },
  { match: /haiku-4-5/, base: rates('Haiku 4.5', 1, 5, 0.1) },
  { match: /3-[57]-sonnet/, base: rates('Sonnet 3.x', 3, 15, 0.3) },
  { match: /3-5-haiku/, base: rates('Haiku 3.5', 0.8, 4, 0.08) },
]

/**
 * N22: 요율을 확인한 모델(계열 · 판). 목록에 없는 모델(새 판 — 예 opus-5-6)은 위 표의 계열 요율로 그대로 세되 경고한다 — 요율을
 * mod 가 스스로 고치지는 않는다. 날짜 · [1m] 같은 꼬리는 떼고 견준다
 */
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

/** 모델 id → 견줄 이름: "claude-haiku-4-5-20251001" → "haiku-4-5", "claude-opus-5-5[1m]" → "opus-5-5" */
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

/**
 * N22 경고(바 세션 금액 옆 ⚠ · 패널 참고 줄): 가격표에 없는 모델(계열 요율로 셈) · 최대 컨텍스트 양이 1M 을 넘음(긴 창 요율이
 * 따로일 수 있다). 둘 다 아니면 빈 목록. 문구는 사용자 확정(2026-10-14)
 */
export function priceWarnings(model: string | null | undefined, window: number | null | undefined): string[] {
  const out: string[] = []
  if (model && ratesFor(model) && !isKnownModel(model)) {
    out.push(L('가격표에 없는 모델이라 요율 가격이 맞지 않을 수 있음 — 최신 버전에서 반영 예정', 'This model is not in the price table, so prices may be off — to be fixed in a later version'))
  }
  if (typeof window === 'number' && window > 1_000_000) {
    out.push(L('최대 컨텍스트 양이 바뀌어 요율 가격이 맞지 않을 수 있음 — 최신 버전에서 반영 예정', 'The maximum context size changed, so prices may be off — to be fixed in a later version'))
  }
  return out
}

/** 기록 줄의 version(그 줄을 쓴 Claude Code 판, 예 "2.1.299") — 판 꼴이 아니면 undefined. tools/scan-transcript.mjs · scan-spend.mjs 와 같은 규칙 */
export function engineOfLine(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v) ? v : undefined
}

/** 엔진 판 "2.1.299" · "2.1.300-dev" → [2, 1, 299]. 못 읽으면 null */
function engineParts(v: string): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** 엔진 판 v 가 min 이상인가(0.9.3 — 요율을 판으로 고른다). 어느 쪽이든 못 읽으면 null(날짜로 고른다) */
export function engineAtLeast(v: string, min: string): boolean | null {
  const a = engineParts(v)
  const b = engineParts(min)
  if (!a || !b) return null
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!
  return true
}

/**
 * 모델 id 에 맞는 요율. 모르는 모델이면 null — 달러를 내지 않고 토큰만 보인다. 요율이 바뀐 모델(history)은 engine(그 요청을 보낸 Claude
 * Code 판)을 주면 판으로(0.9.3 — 앱 설정 화면과 같은 기준), 판을 모르면 day(UTC "YYYY-MM-DD")로 그날 시행 중이던 요율, 둘 다 없으면 지금
 * 요율. 지난 기록을 다시 셀 때(질문별 비용 다시 만들기 · 흐름 · 컴팩트 효과 · 한 달 합)는 기록의 판 · 날짜를, 지금 요청은 지금 엔진 판을 준다
 */
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

/** 값이 바뀐 요율(패널 요율 줄 — 앱 설정 화면 금액과 어긋나는 까닭이 보이게): 이 모델의 옛 요율과 바뀐 날 · 판, 이른 것부터. 없으면 빈 목록 */
export function rateHistory(model: string): readonly RateChange[] {
  return PRICE_TABLE.find(r => r.match.test(model))?.history ?? []
}

/** scan-spend 의 모델 칸 "<model>|<엔진 판>"(0.9.3) → [모델, 판]. 판이 없는 칸(0.9.2 캐시 · 판 없는 기록)은 [그대로, null] */
export function splitEngineKey(key: string): [string, string | null] {
  const bar = key.lastIndexOf('|')
  return bar > 0 ? [key.slice(0, bar), key.slice(bar + 1) || null] : [key, null]
}

/**
 * 이 PC 가 요율이 바뀐 판(minEngine)으로 처음 요청한 날(패널 요율 줄 "이 PC 는 10월 16일" — 0.9.3): scan-spend 날짜별 칸에서 옛 판 요청이 그날이나
 * 그 전에 있고 새 판 요청이 처음 나온 날. 이번 달에 옛 판이 없으면(전 달에 이미 올림) 안 넣는다 — 그 달 1일로 잘못 보이지 않게
 */
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

/** 날짜 쓰는 요청 · 기록의 UTC 날짜 — 시각을 모르면 null(지금 요율) */
export function dayOf(atMs: number | null | undefined): string | null {
  return typeof atMs === 'number' && Number.isFinite(atMs) && atMs > 0 ? spendDay(atMs) : null
}

/**
 * 오늘 · 이번 달 사용량 재료(tools/scan-spend.mjs 출력): 날짜("YYYY-MM-DD", UTC) → 모델(0.9.3 부터 "<model>|<엔진 판>" — 판을 아는 기록) →
 * 크기 묶음(S = 프롬프트 10만 이하, L = 넘음) → [입력, 출력, 캐시 읽기, 5분 쓰기, 1시간 쓰기] 토큰
 */
export type SpendDays = Record<string, Record<string, Partial<Record<'S' | 'L', number[]>>>>

/** 날짜 범위(from ~ to, "YYYY-MM-DD" 포함)의 API 정가 환산 합 — 요율을 모르는 모델은 뺀다. L 묶음은 긴 프롬프트 요율이 있으면 그 요율 */
export function spendUsd(days: SpendDays, from: string, to: string): number {
  let usd = 0
  for (const [day, byModel] of Object.entries(days)) {
    if (day < from || day > to) continue
    for (const [key, tiers] of Object.entries(byModel)) {
      const [model, engine] = splitEngineKey(key)
      for (const [tier, t] of Object.entries(tiers)) {
        // 그 요청을 보낸 엔진 판의 요율(0.9.3), 판을 모르면 그날 요율(0.9.1 — 값이 바뀐 모델은 바뀐 날 전후로 갈린다)
        const r = ratesFor(model, tier === 'L' ? Number.MAX_SAFE_INTEGER : 0, day, engine)
        if (!r || !t) continue
        usd += ((t[0] ?? 0) * r.input + (t[1] ?? 0) * r.output + (t[2] ?? 0) * r.read + (t[3] ?? 0) * r.write5m + (t[4] ?? 0) * r.write1h) / 1e6
      }
    }
  }
  return usd
}

/**
 * 오늘 · 이번 달을 나누는 날짜 "YYYY-MM-DD" — UTC.
 * tools/scan-spend.mjs 와 같은 꼴
 */
/**
 * M1(0.7.0 피드백): 대화 기록에 없는 요청 값(scan-spend 출력 extra — 날짜 → 달러)의 날짜 범위 합. 오늘 · 이번 달 = spendUsd + 이것
 */
export function extraUsd(extra: Record<string, number> | undefined, from: string, to: string): number {
  let usd = 0
  for (const [day, v] of Object.entries(extra ?? {})) if (day >= from && day <= to && typeof v === 'number' && Number.isFinite(v)) usd += v
  return usd
}

/**
 * M2(0.8.0 뒤 피드백 "이번 달 금액이 설정 화면보다 $4.75 낮음"): 대화 기록의 컴팩트 경계 중 이지 컴팩트가 잰 값이 없는 것(장부 전 · 질문 기록
 * 60개 밖) — 날짜 → 모델 → [개수, 컴팩트 전 크기 합](tools/scan-spend.mjs retro)
 */
export type RetroCompacts = Record<string, Record<string, number[]>>

/** 잰 컴팩트 [컴팩트 전 크기, 모델, 달러](scan-spend calib) — 요약 출력 몫을 거꾸로 구하는 재료 */
export type CompactCalib = readonly (readonly [number, string, number])[]

/**
 * 거꾸로 구한 요약 출력(토큰)이 이 범위 밖이면 뺀다 — 아래: 엔진이 미리 계산한 요약을 쓴 자동 컴팩트(요청 값 0 에 가까움), 위: 식은 캐시의
 * 컴팩트(정가 입력이라 거꾸로 구하면 십몇만)
 */
const RETRO_OUT_MIN = 1_000
const RETRO_OUT_MAX = 50_000

/** 컴팩트 요청 입력 1토큰의 값($/MTok) — 입력 몫대로 정가 · 캐시 읽기 · 쓰기 */
function compactInputRate(r: Rates, mix: CompactMix): number {
  return mix.input * r.input + mix.read * r.read + mix.write * r.write1h
}

/**
 * 컴팩트 한 번의 요약 출력 몫 — 이 PC 에서 잰 컴팩트에서 거꾸로(값 − 크기 × 입력 요율 = 출력 × 출력 요율)의 가운데 값. 마지막 한 번 값
 * (compactOutputTokens)은 들쭉날쭉해(이 PC 0.46만 ~ 1만, 잰 값 가운데는 1.5만) 잰 것이 없을 때만 fallback
 */
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

/**
 * 잰 값이 없는 컴팩트의 날짜 범위 합(어림): 캐시가 살아 있던 컴팩트로 센다 — 크기 × 입력 몫 요율 + 요약 출력. 식은 캐시의 컴팩트는 정가
 * 입력이라 더 비싸지만 기록으로는 못 가려 아래로 잡는다. n = 센 컴팩트 수(요율을 모르는 모델은 뺀다)
 */
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

/** 이번 달 1일 0시(UTC, ms) */
export function monthStartMs(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
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

/**
 * API 가 요청마다 보고하는 네 가지 토큰 수(ModelUsage). cache_creation_5m · 1h = 쓰기의 종류별 몫 — 기록(트랜스크립트)의
 * usage.cache_creation 에만 있고 엔진이 요청마다 주는 값엔 없다
 */
export type Tokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
  cache_creation_5m?: number
  cache_creation_1h?: number
}

/**
 * 캐시 유지 시간(분). 엔진이 요청마다 정한다: 메인 대화 = 구독 요금제 사용량 안 1시간, 사용량 초과 · API 키 · 클라우드 5분,
 * 하위 에이전트 · 컴팩트 등 = 5분(공식 문서 code.claude.com/docs/en/prompt-caching "Which TTL each request gets", 2026-10-12
 * 확인). promptCacheTtl 설정 · 환경 변수로 바뀐다. 기본값을 단정하지 않고 기록에서 잰 값을 쓴다(register.tsx measureTtl)
 */
export type TtlMin = 5 | 60

/** 그 유지 시간의 쓰기 요율 — 1시간 = 입력 × 2, 5분 = × 1.25. 식은 캐시를 다시 쓰는 값(복구 값)도 이 요율이다 */
export function writeRate(r: Rates, ttl: number): number {
  return ttl < 60 ? r.write5m : r.write1h
}

/** 기록의 종류별 몫 → 그 요청의 유지 시간. 쓰기가 없거나 몫을 모르면 null */
export function ttlOfTokens(t: Tokens): TtlMin | null {
  const m5 = t.cache_creation_5m ?? 0
  const h1 = t.cache_creation_1h ?? 0
  if (h1 > 0) return 60
  if (m5 > 0) return 5
  return null
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
 * 요청 하나의 실제 값 = API 가 보고한 토큰 × 그 모델의 요율. 쓰기는 기록에 종류별 몫(5분 · 1시간)이 있으면 그대로, 없으면
 * writeTtl(분) — 메인 대화는 세션의 유지 시간(Usage.cacheTtlMin), 하위 에이전트는 5분(이 PC 기록 570개: 사이드체인 전부
 * ephemeral_5m). 엔진이 요청마다 주는 값엔 종류가 없다. 모르는 모델이면 null. day · engine = ratesFor(요율이 바뀐 모델 — 판 먼저, 없으면 날짜)
 */
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

/** 캐시를 이만큼 넘게 다시 쓴 요청 · 질문만 그 값을 따로(노랑) 보인다 */
export const REWRITE_NOTE_USD = 0.25

/**
 * 요청 하나가 캐시를 "다시" 쓴 값(달러): 앞 요청까지 있던 컨텍스트 중 이번에 캐시에서 못 읽고 새로 쓴 몫 — 캐시가 식었거나
 * 모델을 바꾼 뒤 첫 요청. prevCtx = 앞 메인 요청의 컨텍스트(flow.ts lastCtxOf), null 이면(세션 첫 요청 · 컴팩트 직후) 0.
 * 새 내용(파일 · 도구 결과)을 쓴 몫은 평소 캐시 쓰기라 넣지 않는다 — 쓰기 값 전체로 세면 새 세션 첫 질문도 "다시 씀" 이 된다
 */
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

/** 유지 시간을 모를 때(기록에서 못 쟀고 짐작할 거리도 없을 때) — 구독 요금제 기본 */
export const CACHE_TTL_MIN = 60
/** 컨텍스트 색 기준은 thresholds() 의 ctxWarn · ctxCut(설정의 컴팩트 권장 크기). 요청마다 컨텍스트 전체를 다시 읽으니 크기가 곧 요청당 값이다 */

/** 5분 캐시의 노랑 기준 처음 값(분) — 1시간용 10분을 그대로 쓰면 늘 노랑이다 */
export const CACHE_WARN_5M_DEFAULT = 2

/** 지금 유지 시간의 캐시 노랑 기준(분) */
export function cacheWarnFor(t: Pick<Thresholds, 'cacheWarnMin' | 'cacheWarnMin5m'>, ttl: number): number {
  return ttl < 60 ? (t.cacheWarnMin5m ?? CACHE_WARN_5M_DEFAULT) : t.cacheWarnMin
}

/** 사용량의 유지 시간(분) — 모르면 60 */
export function ttlOf(u: Pick<Usage, 'cacheTtlMin'> | null | undefined): number {
  return u?.cacheTtlMin === 5 ? 5 : CACHE_TTL_MIN
}

/** "1시간" · "5분" — 설정 · 카드 풀이 */
export function ttlName(ttl: number): string {
  return ttl < 60 ? L(`${ttl}분`, `${ttl} min`) : L(`${ttl / 60}시간`, `${ttl / 60} h`)
}

export type Estimate =
  | { kind: 'warm'; perCallUsd: number; minsLeft: number | null; ttlMin: number; rewriteUsd: number; rates: Rates }
  | { kind: 'cold'; rewriteUsd: number; rates: Rates; reason: 'expired' | 'model'; ttlMin: number }
  | { kind: 'unpriced' }

/**
 * 캐시가 식은 뒤 첫 요청이 컨텍스트 ctx 를 다시 쓰는 값. shared = 그래도 캐시에서 읽히는 공통 앞부분(시스템 · 도구 —
 * 같은 모델의 다른 세션이 데워 둔다, flow.ts sharedFor). 회사 세션(Sonnet 5.5) 요청 1 · 17(식은 뒤 첫 요청)이 둘 다
 * 47,594 를 읽었다 — 빼면 그냥 이어 가기가 $0.60 이 아니라 $0.42 였다(2026-10-12). 모르면 0(전부 다시 씀)
 */
export function rewriteAllUsd(ctx: number, r: Rates, shared = 0, ttl: number = CACHE_TTL_MIN): number {
  const s = Math.max(0, Math.min(shared, ctx))
  return ((ctx - s) * writeRate(r, ttl) + s * r.read) / 1e6
}

/**
 * 지금 입력하면 드는 값. 캐시가 살아 있으면 요청 1회가 컨텍스트를 그 모델의 읽기 요율로 읽고, 마지막 활동에서 유지 시간
 * (ttl 분)이 지났으면 첫 요청이 컨텍스트 전체를 그 유지 시간의 쓰기 요율로 다시 쓴다(공통 앞부분 shared 는 읽기).
 */
export function estimate(
  contextTokens: number,
  model: string,
  lastActivityMs: number | null,
  nowMs: number,
  isModelSwitched = false,
  shared = 0,
  ttl: number = CACHE_TTL_MIN,
): Estimate {
  const r = ratesFor(model, contextTokens)
  if (!r || contextTokens <= 0) return { kind: 'unpriced' }
  const rewriteUsd = rewriteAllUsd(contextTokens, r, shared, ttl)
  // 모델을 바꿨으면 새 모델엔 이 대화 캐시가 없다 — 식은 캐시와 같다(2026-10-11 기록 7회: 공통 앞부분 ~4.5만만 읽고 나머지 다시 씀)
  if (isModelSwitched) return { kind: 'cold', rewriteUsd, rates: r, reason: 'model', ttlMin: ttl }
  const minsLeft = lastActivityMs === null ? null : Math.floor(ttl - (nowMs - lastActivityMs) / 60000)
  if (minsLeft !== null && minsLeft <= 0) return { kind: 'cold', rewriteUsd, rates: r, reason: 'expired', ttlMin: ttl }
  return { kind: 'warm', perCallUsd: (contextTokens * r.read) / 1e6, minsLeft, ttlMin: ttl, rewriteUsd, rates: r }
}

/** 띠 · 카드 · 패널이 같은 셈을 쓰게 사용량(Usage)에서 바로 — 공통 앞부분(sharedTokens) · 유지 시간을 빠뜨리지 않는다. ctx 를 주면 그 크기로 */
export function estimateFor(
  u: Pick<Usage, 'contextTokens' | 'model' | 'lastActivityMs' | 'switchedFrom' | 'sharedTokens' | 'cacheTtlMin'>,
  nowMs: number,
  ctx = u.contextTokens,
): Estimate {
  return estimate(ctx, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom), u.sharedTokens ?? 0, ttlOf(u))
}

/**
 * 저장 턴 가정 — 이 PC 에서 저장하고 컴팩트를 재기 전. 요청 3회(그만큼 지금 컨텍스트를 읽는다) · 출력 2천 · 새로 씀 2천.
 * 재면 이 PC 의 최근 저장 턴 평균(register.tsx SAVE_KEY). 작성자 세션 9번 실측은 요청 1~4(평균 2.7) · 출력 0.6천~4.4천 ·
 * 새로 씀 0.7천~7천이었다(2026-10-11, 가정이 크게 빗나가지 않는지 본 값 — 기준으로 쓰지 않는다)
 */
export const SAVE_GUESS: SaveTurn = { steps: 3, output: 2_000, write: 2_000 }

/**
 * 컴팩트해도 줄어드는 게 거의 없다고 보는 선: 지금 크기가 컴팩트 직후 크기의 이 배 미만. 띠 툴팁 · 확인 카드 · 사용량 패널이
 * 같은 선으로 "아낄 게 거의 없음 — 지금 컴팩트하면 손해" 를 판정한다. 아끼는 값이 0 보다 조금만 커도 "요청 1회당 ~$0.00 아낌"
 * 이 초록으로 보였다(74k → 72k)
 */
export const LITTLE_SHRINK = 1.3

/** 아낄 게 거의 없다: 본전이 없거나(아끼는 값 0 이하) 줄어드는 몫이 LITTLE_SHRINK 미만 */
export function isLittleToSave(ctx: number, after: number, breakEvenCalls: number | null): boolean {
  return breakEvenCalls === null || ctx < Math.min(after, ctx) * LITTLE_SHRINK
}

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
 * 컴팩트 요청이 입력을 어떻게 내는지(몫, 합 1). 캐시가 살아 있을 때의 컴팩트는 대화 캐시를 그대로 읽는다 — 엔진이 준
 * 컴팩트 요청 토큰이 98.6% 캐시 읽기였다(2026-10-12 이 PC 실측). 0.3.x 는 처음 값을 전부 정가 입력으로 봐(2026-10-11 한 번
 * 대조한 값 — 식은 캐시였던 것으로 보인다) 컴팩트가 7배 비싸 보였고 본전이 멀었다(동료). 컴팩트가 끝날 때 엔진이 주는 실제
 * 토큰으로 다시 잰다 — 캐시가 살아 있던 컴팩트만(식은 캐시의 컴팩트는 coldCompact 셈을 따로 쓴다)
 */
export type { CompactInputs, CompactMix, SaveTurn }
export const WARM_COMPACT: CompactMix = { input: 0, read: 1, write: 0 }

/** 잰 몫이 캐시가 살아 있던 컴팩트의 것인가 — 읽기가 절반 아래면 식은 캐시였다(0.3.x 가 가리지 않고 남긴 값을 거른다) */
export function isWarmMix(mix: CompactMix): boolean {
  return mix.read >= 0.5
}

/** 컴팩트 요청의 실제 토큰 → 입력 몫 */
export function compactMixOf(t: Tokens): CompactMix | null {
  const total = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
  if (total <= 0) return null
  return { input: t.input_tokens / total, read: t.cache_read_input_tokens / total, write: t.cache_creation_input_tokens / total }
}

/**
 * 캐시가 식었을 때: 그냥 이어 가면 다음 요청이 컨텍스트 전체를 세션 유지 시간(ttl)의 쓰기 요율로 다시 쓴다(1시간 = 입력 × 2,
 * 5분 = × 1.25 — 복구 값이 유지 시간마다 다르다). 바로 컴팩트하면 정가 입력으로 한 번 읽고(+ 요약 출력 ~1만) 줄어든
 * 컨텍스트만 다시 쓴다. 공통 앞부분 shared(다른 세션이 데워 둔 시스템 · 도구)는 셋 다 캐시 읽기다(rewriteAllUsd).
 * 정리 단계는 없다 — 정리 질문도 첫 요청이 전체를 다시 써서 식은 캐시에선 가장 비싼 단계다
 */
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

/** coldCompact 를 사용량(Usage)에서 바로 — estimateFor 와 같은 까닭 */
export function coldFor(
  u: Pick<Usage, 'contextTokens' | 'model' | 'sharedTokens' | 'cacheTtlMin'>,
  inputs: CompactInputs,
  ctx = u.contextTokens,
): { continueUsd: number; compactUsd: number } | null {
  return coldCompact(ctx, inputs, u.model, u.sharedTokens ?? 0, ttlOf(u))
}

/**
 * 이 세션 금액의 색(설정 sessionColors — 기본 $10 · $50 · $100): 넘으면 노랑 · 주황 · 빨강, 그 아래는 기본 글색(undefined).
 * 금액 문턱을 없앴던 까닭(위 머리말)은 기준이 습관 통계였기 때문 — 이 값은 사람이 정하는 경고선이다
 */
// 노랑은 hex 하나(#e0a030 — 막대 · 시점 · 한도와 같은 노랑, 2026-10-14 uxi 색 표). 예전 #d6b03a 는 노랑 다섯 벌 중 하나였다
export const SESSION_HEX = { yellow: '#e0a030', orange: '#e8833a', red: '#e05555' } as const

/**
 * 세션 금액 글자 색(0.5 묶음 2 U13): 1단계 = 테마 키 warning(어두움 #db9300 · 밝음 #734500), 2단계 = mod 의 주황 하나 #d9722b(경고
 * 주황과 같은 hex — 예전 #e8833a 는 1.21:1 로 거의 같은 색에 다른 뜻이었다), 3단계 = 테마 키 error. 그림(막대)은 SESSION_HEX 그대로
 */
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
  // 컴팩트 요청: 지금 컨텍스트 전체를 입력으로(몫대로 정가 · 캐시 읽기 · 쓰기) + 요약 출력
  const compactUsd = (ctx * (mix.input * r.input + mix.read * r.read + mix.write * r.write1h) + inputs.output * r.output) / 1e6
  // 저장 턴: 요청마다 지금 컨텍스트를 읽고(크기에 비례 — 시점은 안 바꾼다) 출력 · 새로 쓰기(크기와 상관없음 — 권장을 조금
  // 늦춘다). 컴팩트 뒤 첫 요청은 남는 것 중 요약만 새로 쓴다(시스템 · 도구는 캐시 그대로)
  // 저장 턴 · 컴팩트 뒤 첫 요청은 메인 대화라 세션 유지 시간의 쓰기 요율(재료에 있으면 그 값 — 최적 계산은 재료만 넘긴다)
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

/**
 * 견줄 모델(9c): Opus ↔ Sonnet(같은 판 5.5). 그 밖의 모델(Haiku · Fable 등)은 Opus 5.5 와. 요율을 모르면 null
 */
export function otherModelOf(model: string): string | null {
  if (!ratesFor(model)) return null
  if (/opus/.test(model)) return 'claude-sonnet-5-5'
  return 'claude-opus-5-5'
}

/**
 * 같은 토큰을 다른 모델 요율로(9c): 질문마다 읽기 · 쓰기 · 출력 · 입력 값을 그 요율로 나눠 토큰으로 되돌리고 to 모델 요율로 다시
 * 센다. 에이전트 줄(몫을 나눠 적은 0.4.0 기록)은 그 에이전트 모델 요율 · 5분 쓰기로, 나머지는 질문 모델 · 1시간 쓰기로 — 질문 모델
 * 하나로 다 되돌리면 Haiku 에이전트 몫이 몇십 분의 일로 잡혔다(리뷰). now = 그 질문들의 실제 값(앱 자체 요청 몫 뺌 — 토큰을
 * 모른다), models = 질문 모델들(modelKey). 모르는 모델 질문은 뺀다. 질문이 없으면 null
 */
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
    // 0.9.2: 그 질문 날의 요율로 되돌리고 그날 to 모델 요율로 다시 — 지금 요율로 되돌리면 요율이 바뀐 모델(Sonnet 5.5 읽기 10-07)의
    // 그 전 질문 토큰이 두 배로 잡혔다
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

/** Text 의 color — 터미널 · 데스크톱 둘 다 아는 이름만 쓴다 */
/** 컨텍스트 글자 색: 강조 · 권장을 넘었을 때만(그 아래는 색 없음 — 어디나 색이면 정작 노랑 · 빨강이 묻힌다) */
// 0.5 묶음 2(UI 묶음 U13): ANSI 이름(yellow · red)은 데스크톱에서 테마와 상관없는 고정 hex 라 밝은 테마에서 안 읽혔다(노랑 흰 바탕
// 1.42:1). 빨강은 테마 키 error(어두움 #ec7e7e · 밝음 #8e2626), 주황은 엔진 테마 키가 없어 hex 하나 #d9722b(어두운 바 4.96 · 흰 3.29:1 —
// 한 hex 로 두 테마 모두 4.5:1 은 셈으로 불가, 뜻은 말 · 게이지가 같이 말한다)
export const LEVEL_TEXT: Record<Level, string | undefined> = { ok: undefined, warn: '#d9722b', cut: 'error' }

/**
 * 한도 막대 색 = 앱 사용량 막대(Meter)와 같게: 채움 fill-accent #2a78d6(두 테마 같음),
 * 100% 에서만 fill-danger #d03b3b — 앱 2.37337 토큰 실측. 70 · 90% 경고는 막대 대신 옆 % 글자색(warning · error)이 맡는다
 */
export function limitHex(percent: number): string {
  return percent >= 100 ? '#d03b3b' : '#2a78d6'
}

/** 막대 색: 기준 아래는 차분한 파랑(초록이면 "좋다" 로 읽혀 색이 늘어난다), 넘으면 노랑 · 빨강 */
export const LEVEL_HEX: Record<Level, string> = { ok: '#6b8db8', warn: '#d9722b', cut: '#e05555' }

/** 둥근 진행 막대 SVG(데스크톱). 바탕 = 글자색 10%(앱 alpha-2 — 어두운 테마 흰 10% · 밝은 테마 검정 10%, 앱이 그림 뿌리에 그 자리 글자색을 넣는다) */
export function barSvg(percent: number, hex: string, width: number, height: number): string {
  const p = Math.max(0, Math.min(100, percent))
  const r = height / 2
  const fillWidth = p === 0 ? 0 : Math.max(height, (width * p) / 100)
  const fill = fillWidth === 0 ? '' : `<rect width="${fillWidth.toFixed(1)}" height="${height}" rx="${r}" fill="${hex}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="${r}" fill="currentColor" fill-opacity="0.1"/>${fill}</svg>`
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

/**
 * 현황 막대 움직임(O4, 0.8.1 사용자 "컴팩트 진행 중일 때 그대로 — 깜빡이거나 맞춰서 감소하는 애니"): pulse = 컴팩트 중 채움이 느리게 숨
 * 쉬듯(밝기만, 초당 1번 아래), fromPercent / fromCtx = 컴팩트 끝 옛 크기에서 지금으로 줄어듦(0.8초 — 바 게이지와 같은 때). 그림 안
 * prefers-reduced-motion 이면 멈춤, 설정 "움직임" 끔이면 부르는 쪽이 안 준다. 움직이는 동안만 샌드박스 틀(isInteractive)로 그린다
 */
export type BarAnim = { pulse?: boolean; fromPercent?: number }

/** 막대 움직임 CSS — 키프레임엔 고정 값만(color-mix 금지) */
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
  // 눈금이 있으면 막대를 가운데로 내리고 위아래에 눈금 자리를 둔다
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
  // 줄어듦은 뒤칸(대화 몫)이 옛 끝에서 지금 끝으로 — 앞칸(남는 몫)은 컴팩트해도 그대로라 안 움직인다
  const fromW = anim?.fromPercent !== undefined ? Math.min(width, (width * Math.max(0, anim.fromPercent)) / 100) - x : null
  const shrink = fromW !== null && fromW > fw - x + 0.5 ? `@keyframes cs{from{width:${fromW.toFixed(1)}px}}` : ''
  const cls = [anim?.pulse ? 'fl' : '', shrink ? 'sh' : ''].filter(Boolean).join(' ')
  if (fw > x) body += `<rect${cls ? ` class="${cls}"` : ''} x="${x.toFixed(1)}"${y} width="${(fw - x).toFixed(1)}" height="${height}" fill="${hex}"/>`
  body = barAnimCss(anim?.pulse === true, shrink) + body
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
