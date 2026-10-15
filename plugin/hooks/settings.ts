// 설정: 컴팩트 시점(구간 · 직접 지정) · 캐시 경고 · 정리 후 컴팩트 문구.
//
// 값은 $.store 'settings' 한 곳(모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다). 화면(사용량 패널 안 설정)과
// (숨은) /easy-compact 명령이 같은 함수를 부른다. 숫자는 ◀ ▶ · −/+ 단계로, 직접 쓰는 컴팩트 문구는 입력칸으로 받는다.
//
// 예전엔 기준 프리셋(빡빡하게 · 기본 · 느슨하게 · 내 프리셋)과 자동(내 질문 값 분포)이 있었다. 기준이 습관 따라 움직이고
// 공유하면 남의 값이 되는 문제로 뺐다 — 권장 크기 하나를 계산식 최적이 따라가거나 손으로 고정한다.
// 그 뒤 한 점 대신 구간으로(같은 날): 0~100만 비용표(크기 띠마다 요청 1회 값 · 캐시 식으면 · 최적 대비)에서 한
// 줄을 고른다, 또는 사람이 ◀ ▶ 로 정한 한 크기 — 두 방식 중 하나. 처음엔 최적에서 폭(5 · 10 · 20%)만큼으로 했는데,
// 원한 구간은 요금표처럼 0~100만 크기마다 값이 붙은 표에서 고르는 것이었다. 고르는 값은 [적용] 을 눌러야 저장.

import type { BandMode, BandShow, CostShow, InfoLevel, LimitShow, PaneMode, ScreenPreset, ScreenView, Settings, Thresholds, TidyStyleId } from '../types'
import { L, lang } from './i18n'
import { onTerminal } from './glyph'
import type { Lang } from './i18n'
import { COMPACT_MAX, COMPACT_MIN, rangeThresholdsFor, thresholdsFor } from './optimal'
import { CACHE_WARN_5M_DEFAULT, fmtUsd } from './cost'

/**
 * 정리 후 컴팩트 문구 프리셋. body 는 "무엇을 남기고 무엇을 답할지" 만 — 손해 판단과 [컴팩트 진행] ·
 * [컴팩트 보류] 표시는 어느 문구든 mod 가 앞뒤에 붙인다.
 * use = 언제 쓰나 한 줄(설정 화면) — 하는 일만 적으니 셋이 비슷해 보여 고르기 어려웠다.
 * keep · reply = 설정 화면 단계 보기의 ② 저장 · ③ 답(문구마다 다른 곳만) — 원문(body)은 모델이 읽으라고 쓴 글이라
 * 사람이 머릿속에서 풀어야 했다. 원문은 그 아래 접어 둔다. save = 컴팩트 확인창의 "저장하고 컴팩트" 줄.
 * compact = /compact 뒤에 붙이는 요약 지시(② 칸 — 사용자 2026-10-15 "컴팩트 전 문구 · /compact 뒤 문구 둘을 각각 셋팅, 나머지는 프리셋").
 * 저장하고 컴팩트는 mod 고정 지시(직전 답 남김) 뒤에, 바로 컴팩트는 이것만
 */
type TidyStyle = { name: string; use: string; keep: string; reply: string; save: string; compact: string; body: string[] }

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
    compact: '진행 중 작업 · 결정 · 이어서 할 일은 요약에 남길 것',
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
    compact: '이어서 할 일만 짧게 요약에 남길 것',
    body: ['1) 파일에는 아무것도 남기지 마세요.', '2) 컴팩트 뒤 이어서 할 일을 3~5줄로 정리해 답하세요.'],
  },
  thorough: {
    name: '긴 세션 이어가기',
    use: '긴 작업을 끊었다 이어 갈 때 씁니다. 이유와 열린 질문까지 남겨 다음에 덜 헤맵니다.',
    keep: '결정과 이유 · 열린 질문 · 선호까지 → 메모리 · 작업 기록',
    reply: '이어서 할 일 5~10줄과 주의할 점',
    save: '결정 · 이유 · 열린 질문 · 선호까지 메모리에 저장',
    compact: '진행 중 작업 · 결정과 이유 · 열린 질문 · 이어서 할 일은 요약에 자세히 남길 것',
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
      compact: 'Keep ongoing work, decisions and next steps in the summary',
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
      compact: 'Keep only the next steps, briefly, in the summary',
      body: ['1) Do not record anything to files.', '2) Answer with the next steps after compacting, in 3–5 lines.'],
    },
    thorough: {
      name: 'Long-session handoff',
      use: 'When pausing long work to pick it up later. Also keeps reasons and open questions so you wander less next time.',
      keep: 'Decisions and reasons · open questions · preferences → memory · work log',
      reply: 'Next steps in 5–10 lines, with cautions',
      save: 'Save decisions · reasons · open questions · preferences to memory',
      compact: 'Keep ongoing work, decisions with reasons, open questions and next steps in the summary in detail',
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

/**
 * N22: 최대 컨텍스트 양(엔진 창 — 사용량 window). 1M 을 넘으면(2M 창) 구간 목록 · 직접 지정 상한 · 자동 컴팩트 자리가 창을 따라
 * 늘어난다(요율은 그대로 — 경고는 cost.ts priceWarnings). register 가 사용량을 읽을 때 맞춘다(언어처럼 모듈 하나의 값)
 */
let contextWindow = 1_000_000

export function setContextWindow(w: number | null | undefined): void {
  if (typeof w === 'number' && Number.isFinite(w) && w > 0) contextWindow = w
}

export function contextWindowNow(): number {
  return contextWindow
}

/** 구간 목록의 경계: 1M 창까지는 RANGE_ROWS, 창이 더 크면 50만 칸씩 창까지 */
export function rangeRows(): readonly number[] {
  if (contextWindow <= RANGE_ROWS[RANGE_ROWS.length - 1]!) return RANGE_ROWS
  const more: number[] = []
  for (let v = 1_500_000; v < contextWindow; v += 500_000) more.push(v)
  return [...RANGE_ROWS, ...more, contextWindow]
}

export function rangeBands(): readonly (readonly [number, number])[] {
  const rows = rangeRows()
  return rows.slice(1).map((end, i) => [rows[i]!, end] as const)
}

/** 직접 지정 크기 · 구간 끝의 상한: 1M 과 창 중 큰 쪽 */
export function compactMax(): number {
  return Math.max(COMPACT_MAX, contextWindow)
}

/** 엔진 자동 컴팩트가 도는 자리(어림): 창의 96.7%(1M 창이면 약 967k) */
export function autoCompactAt(): number {
  return Math.round(contextWindow * 0.967)
}

/** 한도 줄 칸 다 켬(처음 값) */
const ALL_LIMITS: LimitShow = { fiveHour: true, sevenDay: true, resets: true }
const NO_LIMITS: LimitShow = { fiveHour: false, sevenDay: false, resets: false }
const LIMIT_KEYS: readonly (keyof LimitShow)[] = ['fiveHour', 'sevenDay', 'resets']
const isLimitKey = (k: keyof BandShow): k is keyof LimitShow => (LIMIT_KEYS as readonly string[]).includes(k)

/** 비용 · 질문 줄 칸을 다 켠 바(기본 · 자세히) */
const ALL_SHOWN: CostShow = {
  session: true,
  perRequest: true,
  context: true,
  range: true,
  cache: true,
  lastTurn: true,
}

/**
 * 이 세션 금액 색 기준 처음 값: $10 노랑 · $50 주황 · $100 빨강. 습관 통계가 아니라 사람이 정하는
 * 경고선이라 설정에서 바꾼다 — 화면 프리셋과 따로, 어느 화면에서나
 */
export const SESSION_COLORS_DEFAULT: [number, number, number] = [10, 50, 100]

/**
 * 화면 프리셋의 보기 값 — 간단 · 자세히 · 커스텀 셋. 0.4.0 의 기본은 뺐다: 바가 자세히와 같고 차이는 패널
 * 보기뿐이었다.
 * - 간단: 처음 쓰는 분 · AI 비용이 낯선 분 · 꼭 필요한 것만 보고 싶은 분. 보이는 정보를 최소로가 기조 — 바 한 줄(이 세션 금액 ·
 *   컨텍스트 · 캐시 · 이지 컴팩트), 패널 간략(질문은 요청 수 · 총액, 모델 견줌 없음), 설정의 컴팩트 시점은 크기 구간과 판정만.
 *   캐시는 넣는다 — 식으면 다음 요청이 전체를 다시 써 처음 쓰는 사람도 알아야 한다
 * - 자세히: AI 비용 구조를 아는 분 — Easy Compact 의 정보를 다(한도 · 요청당 · 컴팩트 구간 · 질문 줄, 패널 자세히, 비용표 전체)
 */
export const SCREEN_VIEWS: Record<Exclude<ScreenPreset, 'custom'>, ScreenView> = {
  simple: {
    bandShow: { session: true, perRequest: false, context: true, range: false, cache: true, lastTurn: false },
    info: 'lean',
  },
  detail: { bandShow: ALL_SHOWN, info: 'full' },
}

export const DEFAULT_SETTINGS: Settings = {
  // 직접 지정의 처음 값. 25만 = 컴팩트 직후 3만~12만 어느 환경에서도 최적보다 +11% 안(hooks/optimal.ts 계산)
  compactAt: 250_000,
  follow: true,
  // 처음 설치 값 20만 ~ 25만 — 컴팩트 요청을 캐시 읽기로 바르게 세자(0.4.0) 최적이 내려갔다: 직후 9.4만
  // 가정에서 Opus 5.5 ~22만 · Sonnet 5.5 ~19만, 이 구간이면 두 모델 다 최적보다 +5% 안. 0.3.x 의 25만 ~ 30만은 컴팩트를 정가로
  // 세 최적이 ~26만이던 때 값이고, 그보다 앞 15만 ~ 20만(작성자 세션 한 개 분석)은 컴팩트가 너무 잦았다. 이미 고른 구간은 그대로
  rangeStart: 200_000,
  rangeEnd: 250_000,
  cacheWarnMin: 10,
  cacheWarnMin5m: CACHE_WARN_5M_DEFAULT,
  tidy: 'default',
  tidyCustom: '',
  compactCustom: '',
  lang: 'auto',
  band: 'full',
  bandFolded: false,
  // 컴팩트할 때 자동으로 펴기는 처음부터 켬 — ✕ 로 접어 둬도 컴팩트할 때를 놓치지 않게
  bandAutoOpen: true,
  // 저장소를 못 읽으면 자세히(0.4.0 전부터 보던 그대로 — 칸 다 · 패널 자세히). 새 설치는 첫 실행 때 기본을 적어 두고
  // (register.tsx seedSettings · NEW_INSTALL_SCREEN), 0.4.0 전 저장값은 normalizeSettings 가 옮긴다(칸 다 켬 → 자세히)
  screen: 'detail',
  custom: null,
  sessionColors: SESSION_COLORS_DEFAULT,
  // 한도 줄은 처음부터 켬 — 구독 사용자에게 5시간 · 7일 한도는 늘 볼 값(API 키 세션은 엔진이 한도를 안 줘 줄이 없다)
  limitShow: ALL_LIMITS,
  // 질문 강조(칩에 마우스를 올리면 그 답변에 테두리)는 처음부터 켬
  questionHover: true,
  paneAutoOpen: false,
  // 같이 열고 닫기는 처음부터 켬
  paneShared: true,
  // 오늘 · 이번 달 사용량은 처음엔 끔 — 늘 볼 값이 아니라 옵션
  spendToday: false,
  spendMonth: false,
  bandOrder: ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache'],
  motion: 'system',
  ctxUnit: 'size',
}

/** 바 비용 줄 칸 순서의 기본(0.5 묶음 2 N15) — 세션 · 오늘 · 이번 달(돈) → 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시 */
export const BAND_ORDER_DEFAULT: readonly string[] = ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache']

/** 저장값 → 순서(모르는 이름은 버리고 빠진 이름은 기본 자리 순서로 뒤에) */
export function normalizeOrder(raw: unknown): string[] {
  const got = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string' && BAND_ORDER_DEFAULT.includes(k)) : []
  const seen = [...new Set(got)]
  return [...seen, ...BAND_ORDER_DEFAULT.filter(k => !seen.includes(k))]
}

/** 돈 칸(세션 · 오늘 · 이번 달)의 여섯 순서 — 설정 "돈 칸 순서" 드롭다운(0.5 묶음 2 N15) */
export const MONEY_KEYS: readonly string[] = ['session', 'today', 'month']
export const MONEY_ORDERS: readonly (readonly string[])[] = [
  ['session', 'today', 'month'],
  ['session', 'month', 'today'],
  ['today', 'session', 'month'],
  ['today', 'month', 'session'],
  ['month', 'session', 'today'],
  ['month', 'today', 'session'],
]

/** 지금 순서의 돈 칸만(순서대로) */
export function moneyOf(order: readonly string[]): string[] {
  return normalizeOrder(order).filter(k => MONEY_KEYS.includes(k))
}

/** 돈 칸 순서를 바꾼다 — 돈 칸이 맨 앞, 나머지는 그대로 뒤에 */
export function withMoney(s: Settings, money: readonly string[]): Settings {
  const rest = normalizeOrder(s.bandOrder).filter(k => !MONEY_KEYS.includes(k))
  return { ...s, bandOrder: [...money, ...rest] }
}

/** 칸 하나를 한 칸 앞으로(맨 앞이면 그대로) */
export function moveEarlier(s: Settings, key: string): Settings {
  const o = normalizeOrder(s.bandOrder)
  const i = o.indexOf(key)
  if (i <= 0) return s
  ;[o[i - 1], o[i]] = [o[i]!, o[i - 1]!]
  return { ...s, bandOrder: o }
}

/**
 * 처음 설치 · 업데이트 뒤 첫 화면 = 간단.
 * 저장값이 있으면 normalizeSettings 가 옮긴다: 0.4.0 의 기본 · 0.4.0 전 칸 다 켬 → 간단, 직접 고른 자세히 · 커스텀 · 꺼 둔 칸은 그대로
 */
export const NEW_INSTALL_SCREEN: ScreenPreset = 'simple'
export const UPDATE_SCREEN: ScreenPreset = 'simple'

// ── 화면 프리셋(설정 탭 맨 위 "화면"): 보이는 것만 묶는다 — 컴팩트 기준은 프리셋이 없다(개인 기록 기반이라 없앤 것) ──

export const SCREEN_PRESETS: readonly ScreenPreset[] = ['simple', 'detail', 'custom']

/** 프리셋 이름: 간단 · 자세히 · 커스텀 */
export function screenName(p: ScreenPreset): string {
  return p === 'simple' ? L('간단', 'Simple') : p === 'detail' ? L('자세히', 'Detailed') : L('커스텀', 'Custom')
}

/**
 * 프리셋 풀이(설정 탭) — 누구에게 · 무엇. 짧게 한 줄: 예전 풀이(약 40자 넘는 문단)는 패널 폭을 밀어 끝선을 바꿨고, 무엇이 보이는지는
 * 바로 아래 미리보기가 이미 보여 준다(2026-10-14 uxi W7 안 A — 셋 다 같은 길이로). 대상은 그대로: 간단 = 처음 쓰는 분, 자세히 = AI
 * 비용 구조를 아는 분
 */
export function screenUse(p: ScreenPreset): string {
  return p === 'simple'
    ? L('처음 쓸 때 · 꼭 필요한 것만', 'For starting out · essentials only')
    : p === 'detail'
      ? L('AI 비용 구조를 아는 분 · 전부 보기', 'If you know how AI costs work · everything')
      : L('세부를 직접 고름 · 칸마다 켜고 끔', 'Pick each detail yourself · row by row')
}

/** "간단" · "basic" · "커스텀" 등 → 화면 프리셋. 못 읽으면 null(띄어쓰기 · 대소문자 무시) */
export function parseScreen(text: string): ScreenPreset | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['간단', 'simple', '처음', 'beginner', '초보'].includes(t)) return 'simple'
  // 0.4.0 의 기본은 자세히로(바가 같았다)
  if (['자세히', 'detail', 'detailed', '전문가', 'expert', '기본', 'basic', 'default'].includes(t)) return 'detail'
  if (['커스텀', 'custom', '직접', '사용자지정'].includes(t)) return 'custom'
  return null
}

/** 바를 그릴 칸 = 한도 줄(따로 켜고 끔) + 화면 보기 값의 비용 · 질문 줄 칸 */
export function bandShowOf(s: Pick<Settings, 'screen' | 'custom' | 'limitShow'>): BandShow {
  return { ...s.limitShow, ...viewOf(s).bandShow }
}

/** 지금 보이는 값 — 프리셋이면 정해 둔 값, 커스텀이면 저장한 값(아직 없으면 기본) */
export function viewOf(s: Pick<Settings, 'screen' | 'custom'>): ScreenView {
  return s.screen === 'custom' ? (s.custom ?? SCREEN_VIEWS.detail) : SCREEN_VIEWS[s.screen]
}

/**
 * 프리셋 고르기. 커스텀을 처음 고르면 지금 보이는 값을 옮겨 둔다(빈 화면에서 시작하지 않게) — 그 뒤엔 저장한 커스텀 값 그대로.
 * 바 크기 · 접기 · 패널 열기 옵션(창 상태)은 그대로 둔다
 */
export function chooseScreen(s: Settings, p: ScreenPreset): Settings {
  if (p !== 'custom') return { ...s, screen: p }
  return { ...s, screen: 'custom', custom: s.custom ?? viewOf(s) }
}

/** 커스텀 값을 바꾼다 — 프리셋이었으면 지금 보이는 값에서 커스텀으로 옮겨 바꾼다(명령으로 칸을 바꿀 때) */
export function editView(s: Settings, change: (v: ScreenView) => ScreenView): Settings {
  return { ...s, screen: 'custom', custom: change(viewOf(s)) }
}

/** 커스텀을 프리셋 값으로 되돌린다(커스텀 칸의 [간단 · 자세히에서 가져오기]) */
export function resetCustom(s: Settings, from: Exclude<ScreenPreset, 'custom'>): Settings {
  return { ...s, screen: 'custom', custom: SCREEN_VIEWS[from] }
}

/** 화면 한 줄(설정 탭 "화면" 아래 · 접힌 제목): "바 최대 · 칸 9개 · 패널 간략" */
export function screenStateText(s: Settings): string {
  const v = viewOf(s)
  const show = bandShowOf(s)
  const shown = BAND_PARTS.filter(p => show[p.key]).length
  return [
    L(`바 ${bandModeName(s.band)}`, `Bar ${bandModeName(s.band)}`),
    L(`칸 ${shown}개`, `${shown} parts`),
    L(`정보량 ${infoName(v.info)}`, `detail ${infoName(v.info)}`),
  ].join(' · ')
}

/** 기준 금액은 센트 없이($10) — 정수가 아니면 fmtUsd */
export function fmtUsd0(v: number): string {
  return Number.isInteger(v) ? `$${v}` : fmtUsd(v)
}

/** 세션 금액 색 기준의 −/+ 칸(달러) */
export const SESSION_COLOR_STEPS: readonly number[] = [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000]

/**
 * 색 기준 하나를 한 칸 옮긴다(i = 0 노랑 · 1 주황 · 2 빨강). 오름차순을 지킨다 — 이웃 값을 넘지 못한다. 화면 프리셋과 상관없이
 */
export function nudgeSessionColor(s: Settings, i: 0 | 1 | 2, dir: 1 | -1): Settings {
  const c = [...s.sessionColors] as [number, number, number]
  const cur = c[i]
  const next = dir > 0 ? SESSION_COLOR_STEPS.find(x => x > cur) : [...SESSION_COLOR_STEPS].reverse().find(x => x < cur)
  if (next === undefined) return s
  if ((i > 0 && next <= c[i - 1]!) || (i < 2 && next >= c[i + 1]!)) return s
  c[i] = next
  return { ...s, sessionColors: c }
}

export function infoName(i: InfoLevel): string {
  return i === 'lean' ? L('최소', 'Minimal') : L('전부', 'Everything')
}

/** 정보량 한 줄 풀이(설정 탭 세부) */
export function infoUse(i: InfoLevel): string {
  return i === 'lean'
    ? L('꼭 필요한 것만: 패널은 간단으로 시작, 설정의 컴팩트 시점은 크기 구간 · 판정만, 캐시 칸 없음, 컴팩트 문구는 고르기만, 답변 끝 질문 비용은 금액 · 요청 수 한 줄, 에이전트는 개수만(답변 끝 · 작업 중 줄).', 'Essentials only: the pane starts Simple, compact timing shows sizes and verdicts, no cache section, compact text shows the choices, the question cost after each answer as one line (cost and request count), agents as a count (after answers and while working).')
    : L('Easy Compact 가 아는 것을 모두: 패널은 자세히로 시작(그래프 · 컴팩트 효과 · 질문 동작별), 비용표 · 계산 값, 캐시 유지 시간 · 정하는 곳 · 대가, 컴팩트 단계 · 보내는 글 전체, 에이전트 금액, 답변 끝 질문 비용의 [▸ 자세히]로 그 질문의 나눔 · 동작별 값까지.', 'Everything Easy Compact knows: the pane starts Detailed (graphs, compact effects, per-step questions), the cost table and inputs, cache lifetime, source and trade-offs, the compact steps and full text, agent costs, and [▸ Details] on the question cost after each answer for its split and per-step costs.')
}

/** 사용량 패널의 처음 보기 — 정보량을 따른다(최소 = 간략, 전부 = 자세히). 패널 위 탭으로 이 세션만 바꿀 수 있다 */
export function paneModeOf(v: Pick<ScreenView, 'info'>): PaneMode {
  return v.info === 'full' ? 'detail' : 'simple'
}

/**
 * 패널 보기 이름 = 화면 프리셋과 같은 말(간단 · 자세히) — "간략" 이 "간단" 과 따로 있어 같은 것인지 맞춰 봐야 했다(2026-10-14 uxi W1 안 A).
 * 명령 별칭 "간략" 은 그대로 받는다
 */
export function paneModeName(m: PaneMode): string {
  return m === 'simple' ? L('간단', 'Simple') : L('자세히', 'Detailed')
}

/** 한도 묶음(5시간 · 7일 · 리셋까지 남은 시간) 한꺼번에 켜고 끄기 — 설정 탭 한도 줄 [✓ 한도 전체]. 화면 프리셋은 그대로 */
export function setLimits(s: Settings, on: boolean): Settings {
  return { ...s, limitShow: on ? ALL_LIMITS : NO_LIMITS }
}

// ── 사용량 패널: 새 세션에서 자동으로 열기 · 모든 세션 같이 열고 닫기(따로 켠다) ───────────────

/** 새 세션에서 자동으로 열기 한 줄 풀이(설정 탭 · 명령 답) */
export function paneAutoUse(isOn: boolean): string {
  return isOn
    ? L('새 세션은 이지 컴팩트 패널을 연 채로 시작합니다. 그 뒤 닫으면 닫힌 채로 둡니다.', 'New sessions start with the Easy Compact pane open. Once you close it, it stays closed.')
    : L(
        `새 세션은 패널이 닫힌 채로 시작합니다. ${onTerminal() ? '바의 [패널 ▸] 버튼으로 엽니다' : '바의 게이지(동그라미)를 누르면 열립니다'}.`,
        `New sessions start with the pane closed. ${onTerminal() ? 'Open it with the [Pane ▸] button on the bar' : 'Click the gauge (the ring) on the bar to open it'}.`,
      )
}

/** 모든 세션 같이 열고 닫기 한 줄 풀이(설정 탭 · 명령 답) */
export function paneSyncUse(isOn: boolean): string {
  return isOn
    ? L('한 세션에서 열거나 닫으면 떠 있는 다른 데스크톱 세션도 같이 열고 닫습니다(CLI 는 따로).', 'Opening or closing it in one session does the same in the other open desktop sessions (the CLI stays separate).')
    : L('세션마다 따로 열고 닫습니다.', 'Each session opens and closes it on its own.')
}

/** 사용량 패널 옵션 한 줄(설정 탭 접힌 제목): "자동 열기 끔 · 같이 열고 닫기 끔" */
export function paneStateText(s: Settings): string {
  const onOff = (isOn: boolean) => (isOn ? L('켬', 'on') : L('끔', 'off'))
  return L(`자동 열기 ${onOff(s.paneAutoOpen)} · 같이 열고 닫기 ${onOff(s.paneShared)}`, `Auto-open ${onOff(s.paneAutoOpen)} · Open/close together ${onOff(s.paneShared)}`)
}

// ── 띠: 보이기 · 필요할 때만 · 크기 · 칸 ──────────────────────────────

export const BAND_MODES: readonly BandMode[] = ['full', 'min']

/**
 * 띠 크기 이름(설정 탭 버튼 · 명령 답): 전체 · 한 줄 — 보이는 것 그대로. "최소" 가 정보량 "최소" 와 겹쳤고 README 는 이미 "한 줄 /
 * 전체" 라 화면과 설명서 말이 달랐다(2026-10-14 uxi W1 안 A). 명령 별칭 최대 · 최소는 그대로 받는다
 */
export function bandModeName(m: BandMode): string {
  return m === 'full' ? L('전체', 'Full') : L('한 줄', 'One line')
}

/** 띠 크기 한 줄 풀이(설정 탭) — 한 줄 바는 한도 · 컴팩트 구간 · 질문 줄을 빼고 캐시는 남긴다(ui-band minShowOf) */
export function bandModeUse(m: BandMode): string {
  return m === 'full'
    ? L('전체: 한도 · 비용 · 질문 줄과 컴팩트 버튼. 칸은 아래 "바에 보일 칸" 에서 뺄 수 있습니다.', 'Full: limits, cost and question rows with the Compact button. Hide parts under "What the bar shows" below.')
    : L('한 줄: 이 세션 · 요청당 · 컨텍스트 · 캐시 한 줄과 컴팩트 · 패널 버튼.', 'One line: session, per request, context and cache, plus the Compact and pane buttons.')
}

/**
 * 접힌 바(입력창 아래 오른쪽 버튼)의 글: 이지 컴팩트 그림 + 이름 + ⇱(최소화된 창을 다시 펴는 느낌, ⇲ 접기와
 * 짝). 작업 표시줄의 최소화된 창처럼 이름만 — 자동 숨김(노랑에 저절로 펴짐)은 강조색(파랑)으로 그려 살아 있음을 보이고
 *, ✕ 로 닫았으면 회색 + "닫힘". 처음엔 "최소화 중" 을 붙였는데 파랑이면 말이 겹친다. 마우스 올리기 칩은 그 줄
 * (SessionMode)이 못 숨겨 칩 글이 "자동 …" 으로 잘려 늘 보였다. 터미널은 그림 글자를 안 써 글로.
 * 그림은 이 자리만 🔽(REVEAL_ICON) — 이 줄은 버튼만 제자리에 두고 버튼 밖 글자는 줄 끝으로 모으며(파란 🗜 를 버튼 밖에 두자
 * 🌳 뒤로 떨어졌다), 버튼 안 글자는 어떤 색을 줘도 앱 버튼 색이다. 원래 파란 그림 글자만 버튼 안에서 파랗다(🌳 초록처럼)
 */
export const REVEAL_ICON = '🔽'

export function revealLabel(isClosed: boolean): string {
  const name = isClosed ? L('이지 컴팩트 닫힘', 'Easy Compact closed') : L('이지 컴팩트', 'Easy Compact')
  return onTerminal() ? `⇱ ${name}` : `${REVEAL_ICON} ${name} ⇱`
}

/** 컴팩트할 때 자동으로 펴기 풀이(설정 탭) */
export function bandAutoUse(isOn: boolean): string {
  return isOn
    ? L(
        `✕ 로 접어 둔 바가 컴팩트 구간 시작(주황) · 캐시 만료에 닿으면 저절로 펴지고, 컴팩트하면 다시 접힙니다. 펴진 바를 ✕ 로 접으면 더 급해질 때(빨강 · 캐시 만료)까지 기다립니다.`,
        `A bar folded with ✕ opens by itself at the start of the compact range (yellow) or when the cache expires, and folds again after a compact. Fold it again with ✕ and it waits until things get more urgent (red · cache expired).`,
      )
    : L(`✕ 로 접은 바는 입력창 아래 [${revealLabel(true)}] 를 누를 때까지 접힌 채입니다.`, `A bar folded with ✕ stays folded until you press [${revealLabel(true)}] below the input.`)
}

/**
 * 바 표시 셋(저장은 bandFolded · bandAutoOpen 둘): 늘 보이기 = 펼침, 자동 = 접힘 + 컴팩트할 때 펴기, 꺼 둠 = 접힘 + 안 펴기.
 * 0.4.0 에서 창 버튼 ⇲(자동 숨김)를 뺐다 — ✕(닫기)와 같아 보였다. 이제 ✕ = 접기, 펴질지는 설정의 "컴팩트할 때
 * 자동으로 펴기" 가 정한다. 단축 명령(보이기 · 안보이기 · 자동숨김)이 이 셋으로 말한다
 */
export type BandShowMode = 'always' | 'auto' | 'never'

export function bandShowMode(s: Settings): BandShowMode {
  return !s.bandFolded ? 'always' : s.bandAutoOpen ? 'auto' : 'never'
}

/** 보이기 = 펼침(펴기 옵션은 그대로), 자동 = 접고 펴기 켬, 꺼 둠 = 접고 펴기 끔 */
export function setBandShow(s: Settings, m: BandShowMode): Settings {
  if (m === 'always') return { ...s, bandFolded: false }
  return { ...s, bandFolded: true, bandAutoOpen: m === 'auto' }
}

/** 바 접기 · 펴기(창 버튼 ✕ · 입력창 아래 버튼) — 펴기 옵션은 그대로 */
export function setFolded(s: Settings, folded: boolean): Settings {
  return { ...s, bandFolded: folded }
}

/** 바 접힘 상태 이름(설정 탭 버튼) */
export function foldName(folded: boolean): string {
  return folded ? L('접음', 'Folded') : L('펼침', 'Open')
}

/** 접은 바를 다시 펴는 법 두 가지(버튼 · 단축 명령) */
function turnBackOn(isAuto: boolean): string {
  return L(
    `다시 펴기: 입력창 아래 [${revealLabel(!isAuto)}] 를 누르거나 /easy-compact 보이기`,
    `Open it again: press [${revealLabel(!isAuto)}] below the input, or type /easy-compact show`,
  )
}

/**
 * 바를 접은 직후 알림 — 접는 길(바의 ✕ · 설정 탭 · /easy-compact 안보이기)이 같은 말로 다시 펴는 법을 알린다. 컴팩트할 때
 * 저절로 펴지는지도(설정 "컴팩트할 때 자동으로 펴기")
 */
export function hiddenNote(s: Pick<Settings, 'bandAutoOpen'>): string {
  return s.bandAutoOpen
    ? L(`이지 컴팩트 바를 접었습니다 — 컴팩트할 때 저절로 펴집니다. ${turnBackOn(true)}`, `Easy Compact bar folded — it opens by itself when it is time to compact. ${turnBackOn(true)}`)
    : L(`이지 컴팩트 바를 모든 세션에서 접었습니다. ${turnBackOn(false)}`, `Easy Compact bar is folded in every session. ${turnBackOn(false)}`)
}

/** 끈 직후 토스트가 떠 있는 시간 — 기본 4초는 다시 켜는 법을 읽기에 짧다 */
export const HIDDEN_NOTE_MS = 10_000

/** 바 상태 한 줄(명령 답 · 설정 탭 접힌 제목): "펼침 · 최대" · "접음 · 컴팩트할 때 펴기 · 최대" */
export function bandStateText(s: Settings): string {
  return [foldName(s.bandFolded), s.bandFolded && s.bandAutoOpen ? L('컴팩트할 때 펴기', 'opens when compacting') : null, bandModeName(s.band)].filter(Boolean).join(' · ')
}

/** "켜기 · on · 끄기 · off" → true / false, 못 읽으면 null(띄어쓰기 · 대소문자 무시) */
export function parseOnOff(text: string): boolean | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['on', 'show', 'open', '켜기', '켜', '켬', '보이기', '열기'].includes(t)) return true
  if (['off', 'hide', 'close', '끄기', '꺼', '끔', '빼기', '숨기기', '닫기'].includes(t)) return false
  return null
}

/** 띠 칸: 설정 탭 묶음(한도 · 비용 · 질문 줄) 순서와 명령 이름(영 · 한, 띄어쓰기 없이 소문자) */
export const BAND_PARTS: readonly { key: keyof BandShow; group: 'limits' | 'cost' | 'turn'; names: readonly string[] }[] = [
  { key: 'fiveHour', group: 'limits', names: ['5h', '5시간'] },
  { key: 'sevenDay', group: 'limits', names: ['7d', '7일'] },
  { key: 'resets', group: 'limits', names: ['reset', 'resets', '리셋'] },
  { key: 'session', group: 'cost', names: ['session', '이세션', '세션', '세션금액'] },
  { key: 'perRequest', group: 'cost', names: ['request', '요청당', '요청'] },
  { key: 'context', group: 'cost', names: ['context', '컨텍스트'] },
  { key: 'range', group: 'cost', names: ['range', '구간', '컴팩트구간'] },
  { key: 'cache', group: 'cost', names: ['cache', '캐시'] },
  { key: 'lastTurn', group: 'turn', names: ['question', '질문'] },
]

/** 칸 이름(설정 탭 버튼) */
export function bandPartName(key: keyof BandShow): string {
  const names: Record<keyof BandShow, [string, string]> = {
    fiveHour: ['5시간', '5h'],
    sevenDay: ['7일', '7d'],
    resets: ['리셋까지 남은 시간', 'Time to reset'],
    session: ['세션 금액', 'Session cost'],
    perRequest: ['요청당', 'Per request'],
    context: ['컨텍스트', 'Context'],
    range: ['컴팩트 구간', 'Compact range'],
    cache: ['캐시 남은 분', 'Cache minutes'],
    lastTurn: ['지난 · 진행 중 질문', 'Last · running question'],
  }
  return L(...names[key])
}

/** "최소" · "min" · "최대" 등 → 띠 크기. 못 읽으면 null(띄어쓰기 · 대소문자 무시) */
export function parseBandMode(text: string): BandMode | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['full', 'max', 'maximize', '최대', '최대화', '전체', '전체보기'].includes(t)) return 'full'
  if (['min', 'minimize', 'minimized', '최소', '최소화', '한줄'].includes(t)) return 'min'
  return null
}

/** "자동 숨김" 의 이름들(명령 동사) — 처음 이름 "필요할 때만" · 0.2.0 의 "컴팩트할 때만" · auto 도 받는다 */
export function isAutoWord(text: string): boolean {
  return ['auto', 'autohide', 'auto-hide', 'needed', 'whenneeded', 'onlywhenneeded', '자동숨김', '자동', '필요할때만', '필요시', '컴팩트할때만'].includes(text.replace(/\s+/g, '').toLowerCase())
}

/** 칸 이름 → 칸 key. 못 읽으면 null */
export function parseBandPart(text: string): keyof BandShow | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  return BAND_PARTS.find(p => p.names.includes(t))?.key ?? null
}

/** 칸 하나 켜고 끄기 — 한도 줄 칸은 그대로(화면과 따로), 그 밖은 커스텀으로 옮겨 바꾼다 */
export function setBandPart(s: Settings, key: keyof BandShow, on: boolean): Settings {
  if (isLimitKey(key)) return { ...s, limitShow: { ...s.limitShow, [key]: on } }
  return editView(s, v => ({ ...v, bandShow: { ...v.bandShow, [key]: on } }))
}

/** 이 칸을 바꾸면 화면이 커스텀이 되나(한도 줄 칸은 아님) */
export function isViewPart(key: keyof BandShow): boolean {
  return !isLimitKey(key)
}

// ── 컴팩트 시점 ──────────────────────────────────────────────────
// 직접 지정 크기는 입력칸(30만 · 300k)으로 — 예전 ◀ ▶(5만 칸)는 원하는 값까지 여러 번 눌러야 했다

/** 크기를 값으로 직접 지정(명령). 범위 밖이면 끝 값으로 */
export function setCompactAt(s: Settings, tokens: number): Settings {
  return { ...s, compactAt: Math.min(compactMax(), Math.max(COMPACT_MIN, Math.round(tokens))), follow: false }
}

/** 구간 방식 켜고 끄기. 끌 때(직접 지정) shown(지금 빨강 = 구간 끝)을 그 크기로 — 바꾸자마자 빨강이 튀지 않게 */
export function setFollow(s: Settings, on: boolean, shown?: number): Settings {
  if (on) return { ...s, follow: true }
  return { ...s, follow: false, compactAt: shown ?? s.compactAt }
}

/** 구간을 값으로 정하고 구간 방식으로(명령). 범위 밖이면 끝 값으로, 시작이 끝 이상이면 그대로 */
export function setRange(s: Settings, start: number, end: number): Settings {
  const clamp = (v: number) => Math.min(compactMax(), Math.max(COMPACT_MIN, Math.round(v)))
  return clamp(start) < clamp(end) ? { ...s, follow: true, rangeStart: clamp(start), rangeEnd: clamp(end) } : s
}

/** 캐시 경고 −/+ 칸 — 1시간 캐시 · 5분 캐시 따로(5분 캐시에 10분 경고면 늘 노랑) */
export const CACHE_STEPS: readonly number[] = [0, 5, 10, 15, 20, 30]
export const CACHE_STEPS_5M: readonly number[] = [0, 1, 2, 3, 4]

/** ttl = 지금 세션의 캐시 유지 시간(분) — 그 유지 시간의 경고만 바꾼다 */
export function nudgeCache(s: Settings, dir: 1 | -1, ttl = 60): Settings {
  const is5m = ttl < 60
  const steps = is5m ? CACHE_STEPS_5M : CACHE_STEPS
  const v = is5m ? s.cacheWarnMin5m : s.cacheWarnMin
  const next = dir > 0 ? (steps.find(m => m > v) ?? v) : ([...steps].reverse().find(m => m < v) ?? v)
  return is5m ? { ...s, cacheWarnMin5m: next } : { ...s, cacheWarnMin: next }
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

/**
 * ① 컴팩트 전에 보낼 글(설정 화면 ① 칸의 Enter · 명령 '문구 <글>')을 저장하고 직접을 고른다. 프리셋에서 처음 직접으로 오면 ② 칸은
 * 그 프리셋 글로 채운다 — 한 칸만 고쳐도 다른 칸이 비지 않게. 빈 글이면 지운다(그동안 그 칸은 일반 문구)
 */
export function setTidyCustom(s: Settings, text: string): Settings {
  return { ...s, tidy: 'custom', tidyCustom: text.trim(), compactCustom: s.tidy === 'custom' ? s.compactCustom : compactText(s) }
}

/** ② /compact 뒤에 붙일 글(설정 화면 ② 칸의 Enter) — ① 과 같은 규칙(프리셋에서 오면 ① 칸은 그 프리셋 글로) */
export function setCompactCustom(s: Settings, text: string): Settings {
  return { ...s, tidy: 'custom', compactCustom: text.trim(), tidyCustom: s.tidy === 'custom' ? s.tidyCustom : tidyBody(s).join('\n') }
}

/** ② /compact 뒤에 붙일 글: 직접이고 쓴 글이 있으면 그 글, 아니면 고른 프리셋(직접인데 비었으면 일반) */
export function compactText(s: Settings): string {
  if (s.tidy === 'custom' && s.compactCustom !== '') return s.compactCustom
  return tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy].compact
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
  const cacheWarnMin5m = isCount(r.cacheWarnMin5m) && r.cacheWarnMin5m < 5 ? r.cacheWarnMin5m : DEFAULT_SETTINGS.cacheWarnMin5m
  const tidy = r.tidy === 'custom' || TIDY_IDS.includes(r.tidy as TidyStyleId) ? (r.tidy as Settings['tidy']) : 'default'
  const tidyCustom = typeof r.tidyCustom === 'string' ? r.tidyCustom : ''
  const compactCustom = typeof r.compactCustom === 'string' ? r.compactCustom : ''
  const lang = r.lang === 'ko' || r.lang === 'en' ? r.lang : 'auto'
  // 0.2.0 의 band 'auto'(컴팩트할 때만 = 한 줄로 나옴)는 최소 + 필요할 때만으로
  const rawBand = (r as { band?: unknown }).band
  const band = rawBand === 'auto' ? 'min' : BAND_MODES.includes(rawBand as BandMode) ? (rawBand as BandMode) : DEFAULT_SETTINGS.band
  // 바 접기: 0.4.0 전 안 보이기(bandHidden) → 접음 + 안 펴기, 자동 숨김(bandAuto · 0.2.0 band 'auto') → 접음 + 펴기, 늘 보이기 → 펼침
  const old = r as { bandHidden?: unknown; bandAuto?: unknown }
  const wasHidden = old.bandHidden === true
  const wasAuto = old.bandAuto === true || rawBand === 'auto'
  const bandFolded = typeof r.bandFolded === 'boolean' ? r.bandFolded : wasHidden || wasAuto
  const bandAutoOpen = typeof r.bandAutoOpen === 'boolean' ? r.bandAutoOpen : !wasHidden
  const paneAutoOpen = typeof r.paneAutoOpen === 'boolean' ? r.paneAutoOpen : false
  const paneShared = typeof r.paneShared === 'boolean' ? r.paneShared : DEFAULT_SETTINGS.paneShared
  const questionHover = typeof (r as { questionHover?: unknown }).questionHover === 'boolean' ? (r as { questionHover: boolean }).questionHover : DEFAULT_SETTINGS.questionHover
  // 오늘 · 이번 달 사용량(0.5.0 새 칸) — 없으면 끔
  const spendToday = (r as { spendToday?: unknown }).spendToday === true
  const spendMonth = (r as { spendMonth?: unknown }).spendMonth === true
  const bandOrder = normalizeOrder((r as { bandOrder?: unknown }).bandOrder)
  const motion = (r as { motion?: unknown }).motion === 'reduce' ? 'reduce' : 'system'
  // B1(0.6.1 피드백): 컨텍스트 · 컴팩트 구간 숫자 꼴 — 크기(281k) · %(최대 컨텍스트 대비 28%) · 둘 다
  const rawUnit = (r as { ctxUnit?: unknown }).ctxUnit
  const ctxUnit = rawUnit === 'pct' || rawUnit === 'both' ? rawUnit : 'size'
  const custom = normalizeView((r as { custom?: unknown }).custom)
  // 0.4.0 의 기본 화면 → 간단(기본은 뺐다 · 업데이트 뒤 첫 화면은 간단)
  const rawScreen = (r as { screen?: unknown }).screen
  const screen = rawScreen === 'basic' ? 'simple' : SCREEN_PRESETS.includes(rawScreen as ScreenPreset) ? (rawScreen as ScreenPreset) : null
  // 세션 금액 색: 0.4.0 은 커스텀 보기 값 안에 있었다 — 밖으로 옮긴다(어느 화면에서나 바꾼다)
  const rawColors = (r as { sessionColors?: unknown }).sessionColors ?? ((r as { custom?: { sessionColors?: unknown } }).custom ?? {}).sessionColors
  const sessionColors = isColors(rawColors) ? rawColors : SESSION_COLORS_DEFAULT
  // 한도 줄: 따로 저장한 값, 없으면 0.4.0 저장값(보기 값 안의 5시간 · 7일 · 리셋 — 간단은 다 끔, 커스텀은 그 값)에서 옮긴다
  const rawCustomShow = objectOf(objectOf((r as { custom?: unknown }).custom).bandShow)
  const limitFrom = (from: Record<string, unknown>, base: LimitShow): LimitShow => {
    const out = { ...base }
    for (const k of LIMIT_KEYS) if (typeof from[k] === 'boolean') out[k] = from[k] as boolean
    return out
  }
  const rawLimits = (r as { limitShow?: unknown }).limitShow
  if (screen !== null) {
    const limitShow =
      typeof rawLimits === 'object' && rawLimits !== null
        ? limitFrom(rawLimits as Record<string, unknown>, ALL_LIMITS)
        : screen === 'simple'
          ? NO_LIMITS
          : screen === 'custom'
            ? limitFrom(rawCustomShow, ALL_LIMITS)
            : ALL_LIMITS
    return { compactAt, follow, rangeStart, rangeEnd, cacheWarnMin, cacheWarnMin5m, tidy, tidyCustom, compactCustom, lang, band, bandFolded, bandAutoOpen, screen, custom, sessionColors, limitShow, questionHover, paneAutoOpen, paneShared, spendToday, spendMonth, bandOrder, motion, ctxUnit }
  }
  // 화면이 없는 저장값 = 0.4.0 전부터 쓰던 사람: 칸(bandShow) · 패널 보기(paneMode — 없으면 자세히)를 옮긴다. 한도 칸은 한도 줄로,
  // 비용 · 질문 줄 칸을 다 켰으면(손대지 않음) 간단 — 업데이트 뒤 첫 화면. 하나라도 껐으면 고른 것이라 그 칸 ·
  // 패널 그대로 커스텀. 새 칸(이 세션 금액)은 켠다
  const shown = objectOf((r as { bandShow?: unknown }).bandShow)
  const oldShow: CostShow = { ...ALL_SHOWN }
  for (const k of Object.keys(oldShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') oldShow[k] = shown[k] as boolean
  const limitShow = limitFrom(shown, ALL_LIMITS)
  const rawPane = (r as { paneMode?: unknown }).paneMode
  const oldPane: PaneMode = rawPane === 'simple' ? 'simple' : 'detail'
  const allOn = (Object.keys(oldShow) as (keyof CostShow)[]).every(k => oldShow[k])
  const migrated: Pick<Settings, 'screen' | 'custom'> =
    allOn ? { screen: 'simple', custom } : { screen: 'custom', custom: { ...SCREEN_VIEWS.detail, bandShow: oldShow, info: oldPane === 'simple' ? 'lean' : 'full' } }
  return { compactAt, follow, rangeStart, rangeEnd, cacheWarnMin, cacheWarnMin5m, tidy, tidyCustom, compactCustom, lang, band, bandFolded, bandAutoOpen, ...migrated, sessionColors, limitShow, questionHover, paneAutoOpen, paneShared, spendToday, spendMonth, bandOrder, motion, ctxUnit }
}

/** 저장값 안의 객체(아니면 빈 객체) */
function objectOf(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** 색 기준: 오름차순 양수 셋 */
function isColors(c: unknown): c is [number, number, number] {
  return Array.isArray(c) && c.length === 3 && c.every(x => isCount(x) && x > 0) && c[0] < c[1] && c[1] < c[2]
}

/** 저장된 커스텀 값을 관대하게: 빠진 칸은 기본 프리셋 값. 없거나 깨졌으면 null(0.4.0 의 sessionColors · sessionAvg 는 버린다 — 색은 normalizeSettings 가 밖으로) */
function normalizeView(raw: unknown): ScreenView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Partial<Record<keyof ScreenView, unknown>>
  const base = SCREEN_VIEWS.detail
  const shown = objectOf(v.bandShow)
  const bandShow = { ...base.bandShow }
  for (const k of Object.keys(bandShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') bandShow[k] = shown[k] as boolean
  return {
    bandShow,
    // 정보량 — 없으면 0.4.0 의 패널 보기(paneMode)에서(간략 → 최소, 자세히 → 전부)
    info: v.info === 'lean' || v.info === 'full' ? v.info : (v as { paneMode?: unknown }).paneMode === 'simple' ? 'lean' : (v as { paneMode?: unknown }).paneMode === 'detail' ? 'full' : base.info,
  }
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

/** 걸 기준: 구간 방식이면 고른 구간(노랑 = 시작, 빨강 = 끝), 직접 지정이면 그 크기(노랑 = 그 80%). 캐시 경고는 1시간 · 5분 둘 다 */
export function thresholdsOf(s: Settings, model: string): Thresholds {
  const t = s.follow ? rangeThresholdsFor(s.rangeStart, s.rangeEnd, model, s.cacheWarnMin) : thresholdsFor(s.compactAt, model, s.cacheWarnMin)
  return { ...t, cacheWarnMin5m: s.cacheWarnMin5m }
}
