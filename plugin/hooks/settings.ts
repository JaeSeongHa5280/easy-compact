// 설정: 컴팩트 시점(구간 · 직접 지정) · 캐시 경고 · 정리 후 컴팩트 문구.
//
// 값은 $.store 'settings' 한 곳(모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다). 화면(사용량 패널 안 설정)과
// /easy-compact 명령이 같은 함수를 부른다. 숫자는 ◀ ▶ · −/+ 단계로, 직접 쓰는 컴팩트 문구는 입력칸이나 명령으로 받는다.
//
// 예전엔 기준 프리셋(빡빡하게 · 기본 · 느슨하게 · 내 프리셋)과 자동(내 질문 값 분포)이 있었다. 기준이 습관 따라 움직이고
// 공유하면 남의 값이 되는 문제로 뺐다 — 권장 크기 하나를 계산식 최적이 따라가거나 손으로 고정한다.
// 그 뒤 한 점 대신 구간으로(같은 날): 0~100만 비용표(크기 띠마다 요청 1회 값 · 캐시 식으면 · 최적 대비)에서 한
// 줄을 고른다, 또는 사람이 ◀ ▶ 로 정한 한 크기 — 두 방식 중 하나. 처음엔 최적에서 폭(5 · 10 · 20%)만큼으로 했는데,
// 원한 구간은 요금표처럼 0~100만 크기마다 값이 붙은 표에서 고르는 것이었다. 고르는 값은 [적용] 을 눌러야 저장.

import type { Settings, Thresholds, TidyStyleId } from '../types'
import { L, lang } from './i18n'
import type { Lang } from './i18n'
import { COMPACT_MAX, COMPACT_MIN, rangeThresholdsFor, thresholdsFor } from './optimal'

/**
 * 정리 후 컴팩트 문구 프리셋. body 는 "무엇을 남기고 무엇을 답할지" 만 — 손해 판단과 [컴팩트 진행] ·
 * [컴팩트 보류] 표시는 어느 문구든 mod 가 앞뒤에 붙인다(사용자 문구가 흐름을 깨지 않게).
 * use = 언제 쓰나 한 줄(설정 화면) — 하는 일만 적으니 셋이 비슷해 보여 고르기 어려웠다.
 * keep · reply = 설정 화면 단계 보기의 ② 저장 · ③ 답(문구마다 다른 곳만) — 원문(body)은 모델이 읽으라고 쓴 글이라
 * 사람이 머릿속에서 풀어야 했다. 원문은 그 아래 접어 둔다. save = 컴팩트 확인창의 "저장하고 컴팩트" 줄
 */
type TidyStyle = { name: string; use: string; keep: string; reply: string; save: string; body: string[] }

/** 지금 언어의 문구 프리셋 — 이름 · 설명 · 모델에 보내는 글(body) 모두 그 언어로 */
export function tidyStyles(): Record<TidyStyleId, TidyStyle> {
  return STYLES[lang()]
}

const STYLES: Record<Lang, Record<TidyStyleId, TidyStyle>> = {
  ko: {
  default: {
    name: '일반',
    use: '평소 작업 중간에 씁니다. 아직 안 남긴 것만 저장하고 이어서 할 일을 받습니다.',
    keep: '아직 파일에 없는 결정 · 진행 · 할 일 → 메모리 · 작업 기록',
    reply: '이어서 할 일 3~5줄',
    save: '아직 안 남긴 결정 · 진행 · 할 일을 메모리에 저장',
    body: [
      '1) 이 세션에서 정해진 것 · 진행 상황 · 다음 할 일 중 아직 파일(작업 기록 · 메모리 · 레지스트리 등)에 남기지 않은 게 있으면 지금 남기세요.',
      '2) 컴팩트 뒤 이어서 할 일을 3~5줄로 정리해 답하세요.',
    ],
  },
  light: {
    name: '마무리',
    use: '이미 다 저장했거나 곧 끝날 일일 때 씁니다. 저장 없이 할 일만 받아 가장 쌉니다.',
    keep: '저장 안 함',
    reply: '이어서 할 일 3~5줄',
    save: '저장 없이 이어서 할 일만 정리',
    body: ['1) 파일에는 아무것도 남기지 마세요.', '2) 컴팩트 뒤 이어서 할 일을 3~5줄로 정리해 답하세요.'],
  },
  thorough: {
    name: '긴 세션 이어가기',
    use: '긴 작업을 끊었다 이어 갈 때 씁니다. 이유와 열린 질문까지 남겨 다음에 덜 헤맵니다.',
    keep: '결정과 이유 · 열린 질문 · 선호까지 → 메모리 · 작업 기록',
    reply: '이어서 할 일 5~10줄과 주의할 점',
    save: '결정 · 이유 · 열린 질문 · 선호까지 메모리에 저장',
    body: [
      '1) 이 세션에서 정해진 것과 그 이유, 아직 열린 질문, 사용자가 밝힌 선호 · 수정 요청 중 파일(작업 기록 · 메모리 · 레지스트리 등)에 없는 것을 지금 남기세요.',
      '2) 컴팩트 뒤 이어서 할 일을 5~10줄로, 주의할 점(함정 · 아직 확인 못 한 것)과 함께 정리해 답하세요.',
    ],
  },
  },
  en: {
    default: {
      name: 'Normal',
      use: 'For the middle of everyday work. Saves only what is not yet recorded and gets the next steps.',
      keep: 'Decisions · progress · to-dos not yet in files → memory · work log',
      reply: 'Next steps in 3–5 lines',
      save: 'Save decisions · progress · to-dos not yet recorded to memory',
      body: [
        '1) Of what was decided in this session, the progress and the next steps, record now anything not yet in files (work log · memory · registry, etc.).',
        '2) Answer with the next steps after compacting, in 3–5 lines.',
      ],
    },
    light: {
      name: 'Wrap-up',
      use: 'When everything is already saved or the work ends soon. Gets only the next steps without saving — the cheapest.',
      keep: 'No saving',
      reply: 'Next steps in 3–5 lines',
      save: 'Only list the next steps, no saving',
      body: ['1) Do not record anything to files.', '2) Answer with the next steps after compacting, in 3–5 lines.'],
    },
    thorough: {
      name: 'Long-session handoff',
      use: 'When pausing long work to pick it up later. Also keeps reasons and open questions so you wander less next time.',
      keep: 'Decisions and reasons · open questions · preferences → memory · work log',
      reply: 'Next steps in 5–10 lines, with cautions',
      save: 'Save decisions · reasons · open questions · preferences to memory',
      body: [
        '1) Record now anything not yet in files (work log · memory · registry, etc.) among: what was decided in this session and why, open questions, and preferences or corrections the user stated.',
        '2) Answer with the next steps after compacting in 5–10 lines, with cautions (pitfalls · things not yet verified).',
      ],
    },
  },
}
/**
 * 버튼 순서. 이름은 쓰는 때로 — 예전 이름 기본 · 가볍게 ·
 * 꼼꼼하게는 하는 일의 양이라 언제 고를지 안 보였다. 예전 이름도 명령에서 받는다(OLD_TIDY_NAMES)
 */
export const TIDY_IDS: readonly TidyStyleId[] = ['default', 'thorough', 'light']
const OLD_TIDY_NAMES = new Map<string, TidyStyleId>([
  ['기본', 'default'],
  ['가볍게', 'light'],
  ['꼼꼼하게', 'thorough'],
  ['마무리하기', 'light'],
])

/**
 * 0~100만 비용표의 경계. 작은 쪽은 촘촘히(최적이 보통 15만~25만), 큰 쪽은 성기게
 */
export const RANGE_ROWS: readonly number[] = [100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000, 700_000, 1_000_000]
/**
 * 비용표의 줄 = 이웃 경계 사이 크기 띠(10만~15만 … 70만~100만). 한 줄을 누르면 그 띠가 컴팩트 구간 — 시작 · 끝을 따로
 * 고르는 버튼 둘은 낯설었다
 */
export const RANGE_BANDS: readonly (readonly [number, number])[] = RANGE_ROWS.slice(1).map((end, i) => [RANGE_ROWS[i]!, end] as const)

export const DEFAULT_SETTINGS: Settings = {
  // 직접 지정의 처음 값. 25만 = 컴팩트 직후 3만~12만 어느 환경에서도 최적보다 +11% 안(hooks/optimal.ts 계산)
  compactAt: 250_000,
  follow: true,
  // 처음 설치 값 25만 ~ 30만 — 실제 세션 128개 모의에서 최적보다 +2% 안이던 23만 ~ 33만 안쪽.
  // 예전 기본 15만 ~ 20만(작성자 세션 한 개 분석)은 컴팩트가 너무 잦았다
  rangeStart: 250_000,
  rangeEnd: 300_000,
  cacheWarnMin: 10,
  tidy: 'default',
  tidyCustom: '',
  lang: 'auto',
}

// ── 컴팩트 시점 ──────────────────────────────────────────────────
// 직접 지정 크기는 입력칸(30만 · 300k)으로 — 예전 ◀ ▶(5만 칸)는 원하는 값까지 여러 번 눌러야 했다

/** 크기를 값으로 직접 지정(명령). 범위 밖이면 끝 값으로 */
export function setCompactAt(s: Settings, tokens: number): Settings {
  return { ...s, compactAt: Math.min(COMPACT_MAX, Math.max(COMPACT_MIN, Math.round(tokens))), follow: false }
}

/** 구간 방식 켜고 끄기. 끌 때(직접 지정) shown(지금 빨강 = 구간 끝)을 그 크기로 — 바꾸자마자 빨강이 튀지 않게 */
export function setFollow(s: Settings, on: boolean, shown?: number): Settings {
  if (on) return { ...s, follow: true }
  return { ...s, follow: false, compactAt: shown ?? s.compactAt }
}

/** 구간을 값으로 정하고 구간 방식으로(명령). 범위 밖이면 끝 값으로, 시작이 끝 이상이면 그대로 */
export function setRange(s: Settings, start: number, end: number): Settings {
  const clamp = (v: number) => Math.min(COMPACT_MAX, Math.max(COMPACT_MIN, Math.round(v)))
  return clamp(start) < clamp(end) ? { ...s, follow: true, rangeStart: clamp(start), rangeEnd: clamp(end) } : s
}

/** 캐시 경고 −/+ 칸 */
export const CACHE_STEPS: readonly number[] = [0, 5, 10, 15, 20, 30]

export function nudgeCache(s: Settings, dir: 1 | -1): Settings {
  const v = s.cacheWarnMin
  const next = dir > 0 ? (CACHE_STEPS.find(m => m > v) ?? v) : ([...CACHE_STEPS].reverse().find(m => m < v) ?? v)
  return { ...s, cacheWarnMin: next }
}

// ── 컴팩트 문구 ──────────────────────────────────────────────────

/** 문구 고르기 이름: 프리셋 셋과 직접 쓴 문구 — 설정 화면의 버튼 넷 */
export function customName(): string {
  return L('직접', 'Custom')
}
/** 직접의 "언제 쓰나" 줄 */
export function customUse(): string {
  return L('원하는 방식이 따로 있을 때 씁니다. 칸에 쓰고 Enter를 누르면 아래 글이 바뀝니다.', 'When you want your own way. Type in the box and press Enter to change the text below.')
}

/**
 * 문구 프리셋(이름이나 id)이나 직접(이름 · custom · 예전 이름 커스텀)을 고른다. 그 밖의 글이면 그 글을 직접 쓴 문구로 저장하고
 * 고른다. 직접 쓴 글이 아직 없어도 직접을 고를 수 있다 — 그동안은 일반 문구대로 하고, 설정 화면에 입력칸이 열린다.
 * 이름은 띄어쓰기 · 대소문자를 무시하고 두 언어 다 견준다("긴세션 이어가기" · "wrap-up" 도 받는다)
 */
export function chooseTidy(s: Settings, text: string): Settings {
  const t = text.trim()
  const bare = (v: string) => v.replace(/\s+/g, '').toLowerCase()
  const id = TIDY_IDS.find(k => k === t || bare(STYLES.ko[k].name) === bare(t) || bare(STYLES.en[k].name) === bare(t)) ?? OLD_TIDY_NAMES.get(bare(t))
  if (id) return { ...s, tidy: id }
  if (['직접', 'custom', '커스텀'].includes(bare(t))) return { ...s, tidy: 'custom' }
  return t ? setTidyCustom(s, t) : s
}

/** 직접 쓴 문구를 저장하고 고른다(설정 화면 입력칸의 Enter). 빈 글이면 지운다 — 그동안 일반 문구 */
export function setTidyCustom(s: Settings, text: string): Settings {
  return { ...s, tidy: 'custom', tidyCustom: text.trim() }
}

/** 직접을 골랐고 쓴 글이 있나 — 없으면 일반 문구대로 한다 */
export const usesCustom = (s: Settings) => s.tidy === 'custom' && s.tidyCustom !== ''

/** 정리 턴 프롬프트의 가운데(무엇을 남기고 무엇을 답할지) */
export function tidyBody(s: Settings): string[] {
  if (usesCustom(s)) return s.tidyCustom.split(/\n/)
  return tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy].body
}

/** 컴팩트 확인창의 "저장하고 컴팩트" 줄(save)과 설정 화면 단계 보기의 ② 저장 · ③ 답(keep · reply) */
export function tidySteps(s: Settings): { save: string; keep: string; reply: string } {
  if (usesCustom(s)) {
    const asTyped = L('칸에 쓴 글대로', 'As typed in the box')
    return { save: L('직접 쓴 문구대로', 'As your custom text'), keep: asTyped, reply: asTyped }
  }
  const style = tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy]
  return { save: style.save, keep: style.keep, reply: style.reply }
}

// ── 읽기 · 명령 ──────────────────────────────────────────────────

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

/**
 * 저장된 값을 관대하게 읽는다: 빠진 키는 기본값, 깨진 값은 버린다. 예전 판(프리셋 · 자동) 값은 옮긴다 — 손으로 고정해
 * 쓰던 사람(auto: false)은 그 권장 크기를 고정으로, 나머지는 최적 따라감으로
 */
export function normalizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const r = raw as Partial<Settings> & { auto?: unknown; values?: { ctxCut?: unknown; cacheWarnMin?: unknown } }
  const legacyFixed = r.auto === false && isCount(r.values?.ctxCut)
  const compactAt = isCount(r.compactAt) ? r.compactAt : legacyFixed ? (r.values!.ctxCut as number) : DEFAULT_SETTINGS.compactAt
  const follow = typeof r.follow === 'boolean' ? r.follow : !legacyFixed
  // 구간은 시작 < 끝일 때만(예전 판의 폭 rangePct 는 버린다 — 기본 구간으로)
  const hasRange = isCount(r.rangeStart) && isCount(r.rangeEnd) && r.rangeStart < r.rangeEnd
  const rangeStart = hasRange ? r.rangeStart! : DEFAULT_SETTINGS.rangeStart
  const rangeEnd = hasRange ? r.rangeEnd! : DEFAULT_SETTINGS.rangeEnd
  const cacheWarnMin = isCount(r.cacheWarnMin) ? r.cacheWarnMin : isCount(r.values?.cacheWarnMin) ? r.values.cacheWarnMin : DEFAULT_SETTINGS.cacheWarnMin
  const tidy = r.tidy === 'custom' || TIDY_IDS.includes(r.tidy as TidyStyleId) ? (r.tidy as Settings['tidy']) : 'default'
  const tidyCustom = typeof r.tidyCustom === 'string' ? r.tidyCustom : ''
  const lang = r.lang === 'ko' || r.lang === 'en' ? r.lang : 'auto'
  return { compactAt, follow, rangeStart, rangeEnd, cacheWarnMin, tidy, tidyCustom, lang }
}

/** "30만" · "300k" · "300000" → 토큰, "10분" · "10" → 분. 못 읽으면 null */
export function parseTokens(text: string): number | null {
  // 한글 자판 그대로 친 k · m(ㅏ · ㅡ)도 읽는다. 화면이 100만을 "1M" 으로 보여 M 도
  const t = text.trim().replace(/[,\s]/g, '').replace(/ㅏ/g, 'k').replace(/ㅡ/g, 'm')
  const m = /^(\d+(?:\.\d+)?)(만|k|K|m|M)?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  if (unit === '만') return Math.round(n * 10_000)
  if (unit === 'k' || unit === 'K') return Math.round(n * 1000)
  if (unit === 'm' || unit === 'M') return Math.round(n * 1_000_000)
  // 단위 없는 1만 아래 수는 k 로(400 → 400k) — 컴팩트 크기는 10만 ~ 100만이라 그만한 토큰 수는 뜻이 없다
  return Math.round(n < 10_000 ? n * 1000 : n)
}

export function parseMinutes(text: string): number | null {
  const m = /^(\d+)(분|m|min)?$/i.exec(text.trim())
  return m ? Number(m[1]) : null
}

/** 걸 기준: 구간 방식이면 고른 구간(노랑 = 시작, 빨강 = 끝), 직접 지정이면 그 크기(노랑 = 그 80%) */
export function thresholdsOf(s: Settings, model: string): Thresholds {
  return s.follow ? rangeThresholdsFor(s.rangeStart, s.rangeEnd, model, s.cacheWarnMin) : thresholdsFor(s.compactAt, model, s.cacheWarnMin)
}
