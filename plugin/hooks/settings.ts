// 설정: 컴팩트 시점(구간 · 직접 지정) · 캐시 경고 · 정리 후 컴팩트 문구.
//
// 값은 $.store 'settings' 한 곳(모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다). 화면(사용량 패널 안 설정)과
// (개발본의 숨은) 단축 명령이 같은 함수를 부른다. 숫자는 ◀ ▶ · −/+ 단계로, 직접 쓰는 컴팩트 문구는 입력칸으로 받는다.
//
// 예전엔 기준 프리셋(빡빡하게 · 기본 · 느슨하게 · 내 프리셋)과 자동(내 질문 값 분포)이 있었다. 기준이 습관 따라 움직이고
// 공유하면 남의 값이 되는 문제로 뺐다 — 권장 크기 하나를 계산식 최적이 따라가거나 손으로 고정한다.
// 그 뒤 한 점 대신 구간으로(같은 날): 0~100만 비용표(크기 띠마다 요청 1회 값 · 캐시 식으면 · 최적 대비)에서 한
// 줄을 고른다, 또는 사람이 ◀ ▶ 로 정한 한 크기 — 두 방식 중 하나. 처음엔 최적에서 폭(5 · 10 · 20%)만큼으로 했는데,
// 원한 구간은 요금표처럼 0~100만 크기마다 값이 붙은 표에서 고르는 것이었다. 고르는 값은 [적용] 을 눌러야 저장.

import type { BandMode, BandShow, BarLayout, CostShow, InfoLevel, LimitShow, PaneMode, PartKey, PartLevel, PartShow, ScreenPreset, ScreenView, Settings, Thresholds, TidyStyleId } from '../types'
import { L, lang } from './i18n'
import { onTerminal } from './glyph'
import type { Lang } from './i18n'
import { COMPACT_MAX, COMPACT_MIN, rangeThresholdsFor, thresholdsFor } from './optimal'
import { CACHE_WARN_5M_DEFAULT, fmtUsd } from './cost'
import type { Level } from './cost'

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

/**
 * 엔진 자동 컴팩트 기준값 — /context 분해(autoCompactThreshold · isAutoCompactEnabled, 세션 시작 때 잰다). 모르면 창의 96.7% 어림.
 * 이지 오토 구간은 이보다 앞만 고른다(엔진 값은 읽기만 — 정본 easy-compact-auto.md §0)
 */
let engineAutoAt: number | null = null
let isEngineAutoOff = false

export function setEngineAuto(at: number | null | undefined, isOn: boolean | undefined): void {
  engineAutoAt = typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : null
  isEngineAutoOff = isOn === false
}

/** 엔진 자동 컴팩트가 도는 자리: 잰 값, 모르면 창의 96.7%(1M 창이면 약 967k) */
export function autoCompactAt(): number {
  return engineAutoAt ?? Math.round(contextWindow * 0.967)
}

/** 이지 오토 구간으로 고를 수 있는 띠: 끝이 엔진 자동 컴팩트보다 앞(엔진 자동 컴팩트를 껐으면 다) */
export function autoBands(): readonly (readonly [number, number])[] {
  const limit = isEngineAutoOff ? Number.POSITIVE_INFINITY : autoCompactAt()
  return rangeBands().filter(([, b]) => b < limit)
}

/** 이지 오토 구간을 값으로(시작 < 끝일 때만) */
export function setAutoRange(s: Settings, start: number, end: number): Settings {
  return start < end ? { ...s, autoStart: Math.round(start), autoEnd: Math.round(end) } : s
}

/** 이지 오토 구간 처음 값 = 그때의 컴팩트 구간(직접 지정이면 그 크기가 든 띠) — 그 뒤는 따로 움직인다 */
function autoFromCompact(c: Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'>): Pick<Settings, 'autoStart' | 'autoEnd'> {
  if (c.follow) return { autoStart: c.rangeStart, autoEnd: c.rangeEnd }
  const band = rangeBands().find(([a, b]) => c.compactAt > a && c.compactAt <= b)
  return band ? { autoStart: band[0], autoEnd: band[1] } : { autoStart: DEFAULT_SETTINGS.autoStart, autoEnd: DEFAULT_SETTINGS.autoEnd }
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
 * 오늘 · 이번 달 금액 색 기준 처음 값(1.0 — 사용자 2026-10-18 "오늘 값은 50 100 200, 이번 달은 1000 1500 2000"): 넘으면 노랑 · 주황 · 빨강.
 * 세션 금액 색과 같은 꼴이지만 깜빡이지 않는다 — 한 번 넘으면 그날 · 그달 내내 넘어 있어 볼 때마다 깜빡였을 것
 */
export const TODAY_COLORS_DEFAULT: [number, number, number] = [50, 100, 200]
export const MONTH_COLORS_DEFAULT: [number, number, number] = [1000, 1500, 2000]

/**
 * 화면 프리셋의 보기 값 — 간단 · 자세히 · 커스텀 셋. 0.4.0 의 기본은 뺐다: 바가 자세히와 같고 차이는 패널
 * 보기뿐이었다.
 * - 간단: 처음 쓰는 분 · AI 비용이 낯선 분 · 꼭 필요한 것만 보고 싶은 분. 보이는 정보를 최소로가 기조 — 바 한 줄(이 세션 금액 ·
 *   컨텍스트 · 캐시 · 이지 컴팩트), 패널 간략(질문은 요청 수 · 총액, 모델 견줌 없음), 설정의 컴팩트 시점은 크기 구간과 판정만.
 *   캐시는 넣는다 — 식으면 다음 요청이 전체를 다시 써 처음 쓰는 사람도 알아야 한다
 * - 자세히: AI 비용 구조를 아는 분 — Easy Compact 의 정보를 다(한도 · 요청당 · 컴팩트 구간 · 질문 줄, 패널 자세히, 비용표 전체)
 * - 슬림(1.0 — 시안 preview-1017d 안 3): 익숙해진 분 · 필요한 것만 — 평소 입력창 위가 비고 아래 버튼 하나, 필요할 때만 위 알림.
 *   화면 넷 모두 바 꼴 · 칸 단계(끔 · 필요할 때 · 늘) · 정보량을 정하고, 커스텀은 그것을 다 고른다
 */
export const SCREEN_VIEWS: Record<Exclude<ScreenPreset, 'custom'>, ScreenView> = {
  // 슬림(1.0 — 사용자 "익숙해진 뒤엔 필요한 내용만 · 정말 최소"): 평소엔 입력창 아래 버튼 하나(컨텍스트), 필요할 때만 위 알림 — 컴팩트
  // 버튼 · 캐시 · 한도는 필요할 때, 채팅 칸은 그대로
  slim: {
    layout: 'button',
    parts: { ctx: 'on', btn: 'need', cache: 'need', lim5: 'need', lim7: 'need', resets: 'on', sess: 'off', req: 'off', today: 'off', month: 'off', range: 'off', last: 'off', chip: 'on', spin: 'on' },
    info: 'lean',
  },
  simple: {
    layout: 'one',
    parts: { ctx: 'on', btn: 'on', cache: 'on', lim5: 'off', lim7: 'off', resets: 'off', sess: 'on', req: 'off', today: 'off', month: 'off', range: 'off', last: 'off', chip: 'on', spin: 'on' },
    info: 'lean',
  },
  // 자세히: 다 늘 — 오늘 · 이번 달도(1.0 — 사용자 2026-10-18 "자세히는 풀로 정보를 보여 주는 건데 오늘 · 이번 달 꺼 둘 필요 있나, 켜 두고 필요하면
  // 커스텀에서". 2026-10-14 엔 이 PC 모든 세션을 재는 옵션이라 꺼 뒀었다)
  detail: {
    layout: 'three',
    parts: { ctx: 'on', btn: 'on', cache: 'on', lim5: 'on', lim7: 'on', resets: 'on', sess: 'on', req: 'on', today: 'on', month: 'on', range: 'on', last: 'on', chip: 'on', spin: 'on' },
    info: 'full',
  },
}

/**
 * 슬림의 정해 둔 칸 — 늘 = 컨텍스트, 필요할 때 = 컴팩트 버튼 · 캐시 · 한도, 나머지 끔, 채팅 칸은 그대로 켬. 필요할 때 = 지금 색이 바뀌는
 * 문턱(컨텍스트 · 요청당 · 컴팩트 버튼 = 컴팩트할 때부터, 캐시 = 경고 분 아래 · 만료, 한도 = 70%, 세션 = 금액 색 첫 기준)
 */
export const SLIM_DEFAULT: PartShow = SCREEN_VIEWS.slim.parts

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
  todayColors: TODAY_COLORS_DEFAULT,
  monthColors: MONTH_COLORS_DEFAULT,
  // 질문 강조(칩에 마우스를 올리면 그 답변에 파란 테두리 — 1.0.1 까지 회색 바탕)는 처음엔 끔(0.9.2 — 사용자 2026-10-16 "기본옵션 꺼둔 걸로"). 0.9.1 까지는 켬
  // (2026-10-13) — 설정을 한 번이라도 저장한 사람은 저장값(켬) 그대로, 바꾼 적 없는 사람 · 새 설치는 끔
  questionHover: false,
  paneAutoOpen: false,
  // 같이 열고 닫기는 처음부터 켬
  paneShared: true,
  bandOrder: ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache'],
  motion: 'system',
  ctxUnit: 'size',
  // B8: 앱 고리와 같은 꼴은 기본이 아니다(동료). 0.9.1: 바 안 한도 막대(5시간 · 7일)와
  // 같은 가로 막대 꼴이라 헷갈렸다 · 16px 에서도 몇 칸 찼나가 단계로 읽힌다 · 컴팩트 중 차례로 켜짐이 가장 또렷하다. 이미 고른 사람은 그대로
  gaugeShape: 'cells',
  // B10: 입력창 아래 한 줄은 기본 끔(바와 같은 내용이 두 번 — 바가 빠질 때만 쓸모)
  statusLine: false,
  // 이지 오토 구간 — 저장값이 없으면 그때의 컴팩트 구간을 처음 값으로(normalizeSettings · register loadSettings 가 한 번 적어 둔다)
  autoStart: 200_000,
  autoEnd: 250_000,
}

// ── 슬림 화면(1.0 — 시안 3판 "보기는 위, 공부는 옆, 행동은 한 자리"): 평소엔 입력창 아래 버튼 하나, 필요할 때만 위 알림 · 누르면 요약 카드 ──

/** 슬림 칸 — 설정 탭 차례(입력창 칸 → 채팅 칸)와 칸마다 고를 수 있는 단계 */
export const PARTS: readonly { key: PartKey; group: 'bar' | 'chat'; states: readonly PartLevel[]; layouts: readonly BarLayout[] }[] = [
  { key: 'ctx', group: 'bar', states: ['need', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'btn', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button'] },
  // 한도는 5시간 · 7일 따로(0.2.0 ~ 0.9.5 처럼 — 1.0 안 3 에서 한 칸으로 묶었다가 사용자 2026-10-18 "원래 나눠서 가능했던 거 아니야?" 로 되돌림)
  { key: 'lim5', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button', 'three'] },
  { key: 'lim7', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button', 'three'] },
  { key: 'resets', group: 'bar', states: ['off', 'on'], layouts: ['button', 'three'] },
  { key: 'sess', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'req', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'cache', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'today', group: 'bar', states: ['off', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'month', group: 'bar', states: ['off', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'range', group: 'bar', states: ['off', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'last', group: 'bar', states: ['off', 'on'], layouts: ['three'] },
  { key: 'chip', group: 'chat', states: ['off', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'spin', group: 'chat', states: ['off', 'on'], layouts: ['button', 'one', 'three'] },
]
export const PART_KEYS: readonly PartKey[] = PARTS.map(p => p.key)
/** 1.0 전 이름(같은 표) */
export const SLIM_PARTS = PARTS

/** 칸 이름(설정 탭) */
export function partName(key: PartKey): string {
  const names: Record<PartKey, [string, string]> = {
    ctx: ['컨텍스트', 'Context'],
    btn: ['컴팩트 버튼', 'Compact button'],
    cache: ['캐시 남은 시간', 'Cache time left'],
    lim5: ['5시간 한도', '5-hour limit'],
    lim7: ['7일 한도', '7-day limit'],
    resets: ['리셋까지 남은 시간', 'Time to reset'],
    sess: ['이 세션 금액', 'Session cost'],
    req: ['요청당', 'Per request'],
    today: ['오늘', 'Today'],
    month: ['이번 달', 'This month'],
    range: ['컴팩트 구간', 'Compact range'],
    last: ['지난 질문 줄', 'Last question row'],
    chip: ['답변 끝 칩', 'Answer chip'],
    spin: ['진행 중 질문 칸', 'Running question strip'],
  }
  return L(...names[key])
}

/**
 * 칸 풀이(설정 탭) — "필요할 때" 가 언제인지, 단계가 둘뿐인 칸은 무엇인지. 문턱은 색 이름 + 단계 이름으로. 색 이름은 설정 금액 색 줄과 같다(warning = 노랑 ·
 * #d9722b = 주황 · error = 빨강) — 컨텍스트 "컴팩트할 때" 는 주황(LEVEL_TEXT). 문장은 보통 말로
 */
export function partUse(key: PartKey): string {
  const uses: Record<PartKey, [string, string]> = {
    ctx: ["'필요할 때'면 컨텍스트가 주황(컴팩트할 때)이 된 뒤부터 숫자가 보입니다. 게이지는 늘 보입니다.", "With 'When needed', the number appears once the context turns orange (time to compact). The gauge always shows."],
    btn: ["'필요할 때'면 컨텍스트가 주황(컴팩트할 때)이 되거나, 캐시가 만료돼 기본 컴팩트가 더 쌀 때 입력창 위 알림에 나옵니다.", "With 'When needed', it shows in the alert above the input once the context turns orange (time to compact), or when the cache expired and a plain compact is cheaper."],
    cache: ["'필요할 때'면 남은 시간이 경고 분 아래로 줄거나(노랑) 캐시가 만료됐을 때(빨강) 보입니다.", "With 'When needed', it shows once the time left drops below the warning minutes (yellow) or the cache expires (red)."],
    lim5: ["'필요할 때'면 70%(노랑)를 넘은 뒤에 보입니다.", "With 'When needed', it shows once it passes 70% (yellow)."],
    lim7: ["'필요할 때'면 70%(노랑)를 넘은 뒤에 보입니다.", "With 'When needed', it shows once it passes 70% (yellow)."],
    resets: ["한도 옆에 'N 후 리셋'을 붙입니다.", "Adds 'resets in N' next to a limit."],
    sess: ["'필요할 때'면 세션 금액이 첫 색(노랑) 기준을 넘은 뒤에 보입니다.", "With 'When needed', it shows once the session cost passes the first color (yellow)."],
    req: ["'필요할 때'면 컨텍스트가 주황(컴팩트할 때)이 된 뒤에 보입니다.", "With 'When needed', it shows once the context turns orange (time to compact)."],
    today: ['이 PC 모든 세션의 오늘 금액입니다(API 정가로 셈한 추정).', "Today's cost across all sessions on this PC (estimated at API list prices)."],
    month: ['이 PC 모든 세션의 이번 달 금액입니다(API 정가로 셈한 추정).', "This month's cost across all sessions on this PC (estimated at API list prices)."],
    range: ['고른 컴팩트 구간입니다.', 'Your compact range.'],
    last: ['바 셋째 줄에 지난 질문의 금액과 요청 수를 보입니다(세 줄 꼴). 대답하는 동안에도 지난 질문이고, 진행 중 질문 칸과는 따로입니다.', "Shows the last question's cost and requests on the bar's third row (three rows). It stays on the last question while answering, separate from the running strip."],
    chip: ["채팅 답변 끝에 '이 질문 $ · 요청 N회'를 붙입니다.", "Adds 'This question $ · N requests' under each answer."],
    spin: ['대답하는 동안 입력창 바로 위에 이 질문의 금액과 요청 수를 보입니다. 끝나면 답변 아래 칩이 이어받습니다. 터미널은 앱 작업 줄 옆에 나옵니다.', "While answering, shows this question's cost and requests right above the input; the answer chip takes over when done. On the terminal it sits next to the working line."],
  }
  return L(...uses[key])
}

/** 단계 이름: 끔 · 필요할 때 · 늘 */
export function levelName(_key: PartKey, v: PartLevel): string {
  if (v === 'off') return L('끔', 'Off')
  if (v === 'need') return L('필요할 때', 'When needed')
  return L('늘', 'Always')
}
/** 1.0 전 이름(같은 함수) */
export const slimPartName = partName
export const slimPartUse = partUse
export const slimLevelName = levelName

/** 저장값 → 칸(모르는 칸 · 그 칸에 없는 단계는 base 값). 한 칸이던 때(1.0 로컬 — lim)의 저장값은 5시간 · 7일 둘에 같은 값 */
export function normalizeParts(raw: unknown, base: PartShow): PartShow {
  const old = objectOf(raw)
  const r = typeof old.lim === 'string' ? { lim5: old.lim, lim7: old.lim, ...old } : old
  const out: PartShow = { ...base }
  for (const p of PARTS) if (p.states.includes(r[p.key] as PartLevel)) out[p.key] = r[p.key] as PartLevel
  return out
}

/** 1.0 전 슬림 커스텀 저장값(slimShow) → 칸 — lim 은 한도, spend(오늘 · 이번 달 같이) 는 둘로 */
function partsFromOldSlim(raw: unknown): PartShow {
  const r = objectOf(raw)
  const out = normalizeParts({ ...r, today: undefined, month: undefined }, SCREEN_VIEWS.slim.parts)
  if (r.spend === 'on') return { ...out, today: 'on', month: 'on' }
  return out
}

/** 지금 화면이 아래 버튼 꼴(슬림 · 커스텀의 아래 버튼)인가 */
export function isSlim(s: Pick<Settings, 'screen' | 'custom'>): boolean {
  return viewOf(s).layout === 'button'
}

/** 지금 화면의 칸 */
export function slimViewOf(s: Pick<Settings, 'screen' | 'custom'>): PartShow {
  return viewOf(s).parts
}
export const partsOf = slimViewOf

/** 칸 하나 고르기 — 프리셋이었으면 그 값에서 커스텀으로 옮겨 바꾼다 */
export function setPart(s: Settings, key: PartKey, v: PartLevel): Settings {
  return editView(s, view => ({ ...view, parts: { ...view.parts, [key]: v } }))
}
export const setSlimPart = setPart

/** 칸 단계 말(명령): 켜기 · 늘 = 늘, 끄기 · 끔 = 끔, 필요할 때 = 필요할 때. 못 읽으면 null */
export function parsePartLevel(text: string): PartLevel | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['need', 'needed', 'whenneeded', '필요할때', '필요시', '필요할때만'].includes(t)) return 'need'
  if (['늘', 'always'].includes(t)) return 'on'
  const on = parseOnOff(t)
  return on === null ? null : on ? 'on' : 'off'
}

/** 칸 이름(명령 — 영 · 한, 띄어쓰기 없이 소문자) */
const PART_WORDS: Record<PartKey, readonly string[]> = {
  ctx: ['ctx', 'context', '컨텍스트'],
  btn: ['button', 'btn', '컴팩트버튼', '버튼'],
  cache: ['cache', '캐시'],
  lim5: ['5h', '5시간', '5시간한도', 'fivehour'],
  lim7: ['7d', '7일', '7일한도', 'sevenday'],
  resets: ['reset', 'resets', '리셋'],
  sess: ['session', '세션', '이세션', '세션금액'],
  req: ['request', '요청당', '요청'],
  today: ['today', '오늘'],
  month: ['month', 'thismonth', '이번달'],
  range: ['range', '구간', '컴팩트구간'],
  last: ['question', '질문', '지난질문'],
  chip: ['chip', '칩', '답변칩'],
  spin: ['spinner', 'working', '작업중', '작업중금액'],
}

/** 칸 이름 → 칸. 못 읽으면 null */
export function parsePartKey(text: string): PartKey | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  return PART_KEYS.find(k => PART_WORDS[k].includes(t)) ?? null
}

/** 바 꼴 */
export const LAYOUTS: readonly BarLayout[] = ['button', 'one', 'three']

export function layoutName(l: BarLayout): string {
  return l === 'button' ? L('아래 버튼', 'Button below') : l === 'one' ? L('한 줄', 'One row') : L('세 줄', 'Three rows')
}

export function layoutUse(l: BarLayout): string {
  return l === 'button'
    ? L('평소엔 입력창 아래 버튼 하나만 있고, 필요할 때만 위에 알림이 뜹니다.', 'Just one button below the input, and an alert above only when needed.')
    : l === 'one'
      ? L('입력창 위 바 한 줄(간단과 같은 꼴)', 'One row above the input (like Simple)')
      : L('한도 · 비용 · 질문을 세 줄로 보입니다.', 'Limits, cost and question in three rows.')
}

/** "슬림 커스텀": 아래 버튼 꼴의 커스텀(슬림에서 오면 슬림 칸, 아래 버튼 꼴 커스텀이면 그대로) */
export function slimCustom(s: Settings): Settings {
  const base = s.screen === 'custom' && s.custom ? s.custom : viewOf(s)
  return { ...s, screen: 'custom', custom: { ...base, layout: 'button', parts: base.layout === 'button' ? base.parts : SCREEN_VIEWS.slim.parts } }
}

/** 오늘 · 이번 달(이 PC 모든 세션 재기)을 켰나 — 지금 화면의 칸 */
export function spendOf(s: Pick<Settings, 'screen' | 'custom'>): { today: boolean; month: boolean } {
  const p = viewOf(s).parts
  return { today: p.today !== 'off', month: p.month !== 'off' }
}

/** "슬림" · "slim" · "슬림 커스텀" · "슬림 끄기" → 명령(on = 슬림 화면 · custom = 아래 버튼 꼴 커스텀 · off = 간단으로), 못 읽으면 null */
export function parseSlim(text: string): 'on' | 'off' | 'custom' | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['슬림', 'slim', '슬림켜기', '슬림켬', 'slimon'].includes(t)) return 'on'
  if (['슬림끄기', '슬림끔', 'slimoff'].includes(t)) return 'off'
  if (['슬림커스텀', 'slimcustom'].includes(t)) return 'custom'
  return null
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

export const SCREEN_PRESETS: readonly ScreenPreset[] = ['slim', 'simple', 'detail', 'custom']

/** 프리셋 이름: 간단 · 자세히 · 커스텀 */
export function screenName(p: ScreenPreset): string {
  return p === 'slim' ? L('슬림', 'Slim') : p === 'simple' ? L('간단', 'Simple') : p === 'detail' ? L('자세히', 'Detailed') : L('커스텀', 'Custom')
}

/**
 * 프리셋 풀이(설정 탭) — 누구에게 · 무엇. 짧게 한 줄: 예전 풀이(약 40자 넘는 문단)는 패널 폭을 밀어 끝선을 바꿨고, 무엇이 보이는지는
 * 바로 아래 미리보기가 이미 보여 준다(2026-10-14 uxi W7 안 A — 셋 다 같은 길이로). 대상은 그대로: 간단 = 처음 쓰는 분, 자세히 = AI
 * 비용 구조를 아는 분
 */
export function screenUse(p: ScreenPreset): string {
  return p === 'slim'
    ? L('익숙해진 뒤 · 필요할 때만 알림', 'Once you know your way around · alerts only when needed')
    : p === 'simple'
    ? L('처음 쓸 때 · 꼭 필요한 것만', 'For starting out · essentials only')
    : p === 'detail'
      ? L('AI 비용 구조를 아는 분 · 전부 보기', 'If you know how AI costs work · everything')
      : L('세부를 직접 고름 · 칸마다 켜고 끔', 'Pick each detail yourself · row by row')
}

/** "간단" · "basic" · "커스텀" 등 → 화면 프리셋. 못 읽으면 null(띄어쓰기 · 대소문자 무시) */
export function parseScreen(text: string): ScreenPreset | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['슬림', 'slim'].includes(t)) return 'slim'
  if (['간단', 'simple', '처음', 'beginner', '초보'].includes(t)) return 'simple'
  // 0.4.0 의 기본은 자세히로(바가 같았다)
  if (['자세히', 'detail', 'detailed', '전문가', 'expert', '기본', 'basic', 'default'].includes(t)) return 'detail'
  if (['커스텀', 'custom', '직접', '사용자지정'].includes(t)) return 'custom'
  return null
}

/**
 * 바를 그릴 칸(켬/끔) — 지금 화면의 칸 단계에서: 끔이 아니면 켬(필요할 때도). 바를 그릴 때는 지금 값으로 필요할 때를 가린다(ui-band
 * bandShowNow). 설정 견본 · 명령 답이 이것
 */
export function bandShowOf(s: Pick<Settings, 'screen' | 'custom'>): BandShow {
  const p = viewOf(s).parts
  const on = (k: PartKey) => p[k] !== 'off'
  return { fiveHour: on('lim5'), sevenDay: on('lim7'), resets: (on('lim5') || on('lim7')) && on('resets'), session: on('sess'), perRequest: on('req'), context: on('ctx'), range: on('range'), cache: on('cache'), lastTurn: on('last') }
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
  // 바 꼴 · 칸 · 정보량을 그 화면 값으로
  return { ...s, screen: 'custom', custom: SCREEN_VIEWS[from] }
}

/** 화면 한 줄(설정 탭 "화면" 아래 · 접힌 제목): "바 최대 · 칸 9개 · 패널 간략" */
export function screenStateText(s: Settings): string {
  const v = viewOf(s)
  const shown = PARTS.filter(p => p.group === 'bar' && p.layouts.includes(v.layout) && v.parts[p.key] !== 'off').length
  const bar = v.layout === 'three' ? bandModeName(s.band) : layoutName(v.layout)
  return [
    L(`바 ${bar}`, `Bar ${bar}`),
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

/** 금액 색 기준 셋(1.0 — 세션 · 오늘 · 이번 달)의 설정 칸과 고를 값(달러) — 처음 값이 다 들어 있게 */
export type MoneyColorKey = 'sessionColors' | 'todayColors' | 'monthColors'
export const MONEY_COLOR_STEPS: Record<MoneyColorKey, readonly number[]> = {
  sessionColors: SESSION_COLOR_STEPS,
  todayColors: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000],
  monthColors: [100, 200, 300, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 5000, 10000],
}

/**
 * 색 기준 하나를 한 칸 옮긴다(i = 0 노랑 · 1 주황 · 2 빨강). 오름차순을 지킨다 — 이웃 값을 넘지 못한다. 화면 프리셋과 상관없이.
 * key = 어느 금액(1.0 — 오늘 · 이번 달도, 터미널 − / + 칸)
 */
export function nudgeSessionColor(s: Settings, i: 0 | 1 | 2, dir: 1 | -1, key: MoneyColorKey = 'sessionColors'): Settings {
  const steps = MONEY_COLOR_STEPS[key]
  const c = [...s[key]] as [number, number, number]
  const cur = c[i]
  const next = dir > 0 ? steps.find(x => x > cur) : [...steps].reverse().find(x => x < cur)
  if (next === undefined) return s
  if ((i > 0 && next <= c[i - 1]!) || (i < 2 && next >= c[i + 1]!)) return s
  c[i] = next
  return { ...s, [key]: c }
}

export function infoName(i: InfoLevel): string {
  return i === 'lean' ? L('최소', 'Minimal') : L('전부', 'Everything')
}

/** 정보량 한 줄 풀이(설정 탭 세부) */
export function infoUse(i: InfoLevel): string {
  return i === 'lean'
    ? L('처음 쓰는 분께 맞습니다. 꼭 필요한 것만 보입니다.', 'For first-time users. Shows only the essentials.')
    : L('비용 구조를 아는 분께 맞습니다. 이지 컴팩트가 아는 것을 모두 보입니다.', 'For those who know how the costs work. Shows everything Easy Compact knows.')
}

/**
 * 사용량 패널의 처음 보기 — 정보량을 따른다(최소 = 간단, 전부 = 자세히). 패널 위 탭으로 바꾸면 그 보기를 기억한다(화면 종류를 바꾸면
 * 지움 — register saveSettings)
 */
export function paneModeOf(s: Pick<Settings, 'screen' | 'custom'>): PaneMode {
  return viewOf(s).info === 'full' ? 'detail' : 'simple'
}

/**
 * 패널 보기 이름 = 화면 프리셋과 같은 말(간단 · 자세히) — "간략" 이 "간단" 과 따로 있어 같은 것인지 맞춰 봐야 했다(2026-10-14 uxi W1 안 A).
 * 명령 별칭 "간략" 은 그대로 받는다
 */
export function paneModeName(m: PaneMode): string {
  return m === 'simple' ? L('간단', 'Simple') : L('자세히', 'Detailed')
}

/** 한도(5시간 · 7일 · 리셋까지 남은 시간) 한꺼번에 켜고 끄기 — 명령 · 칸. 1.0: 지금 화면의 칸(프리셋이면 커스텀으로 옮겨) */
export function setLimits(s: Settings, on: boolean): Settings {
  return editView(s, v => ({ ...v, parts: { ...v.parts, lim5: on ? 'on' : 'off', lim7: on ? 'on' : 'off', resets: on ? 'on' : 'off' } }))
}

// ── 사용량 패널: 새 세션에서 자동으로 열기 · 모든 세션 같이 열고 닫기(따로 켠다) ───────────────

/** 새 세션에서 자동으로 열기 한 줄 풀이(설정 탭 · 명령 답) */
export function paneAutoUse(isOn: boolean): string {
  return isOn
    ? L('새 세션은 패널을 연 채로 시작합니다.', 'New sessions start with the pane open.')
    : L(
        `새 세션은 패널을 닫은 채로 시작합니다.`,
        `New sessions start with the pane closed.`,
      )
}

/** 모든 세션 같이 열고 닫기 한 줄 풀이(설정 탭 · 명령 답) */
export function paneSyncUse(isOn: boolean): string {
  return isOn
    ? L('한 세션에서 열고 닫으면 다른 세션도 같이 열고 닫힙니다.', 'Opening or closing it in one session does the same in the others.')
    : L('세션마다 따로 열고 닫습니다.', 'Each session opens and closes it on its own.')
}

/** 사용량 패널 옵션 한 줄(설정 탭 접힌 제목): "자동 열기 끔 · 같이 열고 닫기 끔" */
export function paneStateText(s: Settings): string {
  const onOff = (isOn: boolean) => (isOn ? L('켬', 'on') : L('끔', 'off'))
  return L(`자동 열기 ${onOff(s.paneAutoOpen)} · 같이 열고 닫기 ${onOff(s.paneShared)}`, `Auto-open ${onOff(s.paneAutoOpen)} · Open/close together ${onOff(s.paneShared)}`)
}

// ── 띠: 보이기 · 필요할 때만 · 크기 · 칸 ──────────────────────────────

// 0.10.0: 개발 중 셋째 크기 아이콘을 뒀다가 화면 종류 한눈으로 옮겼다 — 크기는 전체 · 한 줄 둘
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
    ? L('한도 · 비용 · 질문 줄과 컴팩트 버튼을 모두 보입니다.', 'Limits, cost and question rows with the Compact button.')
    : L('세션 · 요청당 · 컨텍스트 · 캐시를 한 줄로 보입니다.', 'Session, per request, context and cache in one line.')
}

/**
 * 접힌 바(입력창 아래 오른쪽 버튼)의 글: 지금 크기 단계 색 네모 하나 + 이름 — 작업 표시줄의 최소화된 창처럼. 자동 숨김(노랑에
 * 저절로 펴짐)은 강조 버튼으로 살아 있음을 보이고, ✕ 로 닫았으면 회색 + "닫힘". 마우스 올리기 칩은 그 줄(SessionMode)이 못
 * 숨겨 칩 글이 "자동 …" 으로 잘려 늘 보였다. 터미널은 그림 글자를 안 써 글로.
 * 0.8.1 B7: 예전 [🔽 이지 컴팩트 ⇱] 는 두
 * 화살표의 뜻이 엇갈리고 ⇱ 는 버튼 글자색이라 따로 놀았다 → 사용자 고름 "막대 1개로 색상만" — 네모 색 = 바 게이지 · 현황 막대와 같은
 * 말(🟦 여유 · 🟧 컴팩트할 때 · 🟥 늦어짐, 단계를 모르면 🟦). 버튼 안 글자는 어떤 색을 줘도 앱 버튼 색이라 원래 색이 있는 그림 글자만
 * 제 색이다(🌳 초록처럼) — 이 줄은 버튼만 제자리에 두고 버튼 밖 글자는 줄 끝으로 모은다(파란 🗜 를 버튼 밖에 두자 🌳 뒤로 떨어졌다)
 */
export const REVEAL_SQUARE: Record<Level, string> = { ok: '🟦', warn: '🟧', cut: '🟥' }

/**
 * 0.10.0 접힘 C: 데스크톱은
 * 이름 대신 지금 컨텍스트 값(value — 설정 숫자 꼴). 게이지 그림은 못 넣는다 — 앱 버튼은 그림을 안 그리고(버튼 안 Svg 안 됨), 버튼 밖
 * 그림 · 글은 이 줄 끝으로 밀린다(위 규칙) — 그래서 단계 색 네모가 게이지 몫. 값을 모르면(첫 응답 전) 이름 그대로, 닫혔으면 뒤에 "닫힘".
 * 터미널은 바 자리 버튼이라 이름 그대로
 */
export function revealLabel(isClosed: boolean, level: Level | null = null, value: string | null = null): string {
  const name = isClosed ? L('이지 컴팩트 닫힘', 'Easy Compact closed') : L('이지 컴팩트', 'Easy Compact')
  if (onTerminal()) return `⇱ ${name}`
  if (value !== null) return `${REVEAL_SQUARE[level ?? 'ok']} ${value}${isClosed ? L(' · 닫힘', ' · closed') : ''}`
  return `${REVEAL_SQUARE[level ?? 'ok']} ${name}`
}

/** 접힌 바 버튼을 글에서 부르는 이름(값을 모르는 자리 — 도움말 · 설정 풀이 · 토스트): 데스크톱 "🟦 컨텍스트" 꼴(0.10.0 접힘 C) */
export function revealName(isClosed = false): string {
  if (onTerminal()) return revealLabel(isClosed)
  return isClosed ? L('🟦 컨텍스트 · 닫힘', '🟦 context · closed') : L('🟦 컨텍스트', '🟦 context')
}

/**
 * 접힌 바를 펴는 버튼의 자리 — 데스크톱 = 입력창 아래 모드 줄, 터미널 = 바 자리 한 줄(입력창 위, ctrl+x tab 으로 닿음). 0.9.0: 터미널의
 * 모드 줄엔 키보드 초점이 안 간다(엔진 초점 고리는 바 · 패널만) — 마켓 판엔 단축 명령도 없어 터미널은 바 자리에 둔다(실제 CLI 로 확인)
 */
export function revealWhere(): string {
  return onTerminal() ? L('입력창 위', 'above the input') : L('입력창 아래', 'below the input')
}

/** 버튼까지 가는 키(터미널만) */
function revealKeys(): string {
  return onTerminal() ? '(ctrl+x tab)' : ''
}

/** 컴팩트할 때 자동으로 펴기 풀이(설정 탭) */
export function bandAutoUse(isOn: boolean): string {
  return isOn
    ? L(
        `접어 둔 바가 컴팩트할 때가 되면 저절로 펴지고, 컴팩트하면 다시 접힙니다.`,
        `A folded bar opens by itself when it’s time to compact, and folds again after a compact.`,
      )
    : L(
        `접은 바는 다시 펼 때까지 접힌 채입니다.`,
        `A folded bar stays folded until you open it.`,
      )
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

/** 접은 바를 다시 펴는 법 — 그 버튼(0.9.0: 공개 · 마켓 판엔 단축 명령이 없어 두 판 다 버튼만 알린다) */
function turnBackOn(isAuto: boolean, label: string | null = null): string {
  // 0.10.0: 접는 순간 버튼 글(네모 + 컨텍스트 — revealLabel)을 알면 그대로, 모르면 이름 꼴(revealName)
  const name = label ?? revealName(!isAuto)
  return L(
    `다시 펴기: ${revealWhere()} [${name}]${revealKeys()}`,
    `open it again with [${name}] ${revealWhere()}${revealKeys() ? ` ${revealKeys()}` : ''}`,
  )
}

/**
 * 바를 접은 직후 알림 — 접는 길(바의 ✕ · 설정 탭 · 개발본 단축 명령)이 같은 말로 다시 펴는 법을 알린다. 컴팩트할 때
 * 저절로 펴지는지도(설정 "컴팩트할 때 자동으로 펴기"). 0.9.0: 다시 펴는 법을 앞에 — 터미널 알림은 한 줄이라 뒤가 잘렸다(실제 CLI)
 */
export function hiddenNote(s: Pick<Settings, 'bandAutoOpen'>, label: string | null = null): string {
  return s.bandAutoOpen
    ? L(`이지 컴팩트 바를 접었습니다. ${turnBackOn(true, label)} · 컴팩트할 때 저절로 펴집니다.`, `Easy Compact bar folded; ${turnBackOn(true, label)}. It opens by itself when it’s time to compact.`)
    : L(`이지 컴팩트 바를 모든 세션에서 접었습니다. ${turnBackOn(false, label)}`, `Easy Compact bar is folded in every session; ${turnBackOn(false, label)}.`)
}

/** 끈 직후 토스트가 떠 있는 시간 — 기본 4초는 다시 켜는 법을 읽기에 짧다 */
export const HIDDEN_NOTE_MS = 10_000

/** 바 상태 한 줄(명령 답 · 설정 탭 접힌 제목): "펼침 · 최대" · "접음 · 컴팩트할 때 펴기 · 최대" */
export function bandStateText(s: Settings): string {
  // 슬림 화면은 크기와 상관없이 슬림 꼴(1.0)
  const size = isSlim(s) ? L('슬림', 'Slim') : bandModeName(s.band)
  return [foldName(s.bandFolded), s.bandFolded && s.bandAutoOpen ? L('컴팩트할 때 펴기', 'opens when compacting') : null, size].filter(Boolean).join(' · ')
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
    // "남은 분" → "남은 시간"(동료 피드백 2026-10-16 "보통 이런 건 남은 시간(time)이라고 표현함 — hour 말고 time") · 위 리셋 칸과 같은 말
    cache: ['캐시 남은 시간', 'Cache time left'],
    lastTurn: ['지난 질문', 'Last question'],
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

/** 바 칸(명령 이름) → 칸 — 5시간 · 7일은 따로 */
const BAND_TO_PART: Record<keyof BandShow, PartKey> = { fiveHour: 'lim5', sevenDay: 'lim7', resets: 'resets', session: 'sess', perRequest: 'req', context: 'ctx', range: 'range', cache: 'cache', lastTurn: 'last' }

/** 칸 하나 켜고 끄기(명령) — 커스텀으로 옮겨 바꾼다. 컨텍스트는 끔 대신 필요할 때 */
export function setBandPart(s: Settings, key: keyof BandShow, on: boolean): Settings {
  const pk = BAND_TO_PART[key]
  return setPart(s, pk, on ? 'on' : pk === 'ctx' ? 'need' : 'off')
}

/** 이 칸을 바꾸면 화면이 커스텀이 되나 — 1.0 부터 모든 칸이 화면 값 */
export function isViewPart(_key: keyof BandShow): boolean {
  return true
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
  return L('원하는 방식이 따로 있을 때 씁니다.', 'When you want your own way.')
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
  const bandOrder = normalizeOrder((r as { bandOrder?: unknown }).bandOrder)
  const motion = (r as { motion?: unknown }).motion === 'reduce' ? 'reduce' : 'system'
  // B1(0.6.1 피드백): 컨텍스트 · 컴팩트 구간 숫자 꼴 — 크기(281k) · %(최대 컨텍스트 대비 28%) · 둘 다
  const rawUnit = (r as { ctxUnit?: unknown }).ctxUnit
  const ctxUnit = rawUnit === 'pct' || rawUnit === 'both' ? rawUnit : 'size'
  // B8(0.8.1): 게이지 꼴 — 모르는 값 · 없음이면 기본(0.9.1 부터 칸 막대 — 고른 적 없는 사람도 새 기본으로)
  const rawShape = (r as { gaugeShape?: unknown }).gaugeShape
  const gaugeShape = rawShape === 'ring' || rawShape === 'vbar' || rawShape === 'bar' || rawShape === 'cells' || rawShape === 'vcells' ? rawShape : DEFAULT_SETTINGS.gaugeShape
  const statusLine = (r as { statusLine?: unknown }).statusLine === true
  // 세션 금액 색: 0.4.0 은 커스텀 보기 값 안에 있었다 — 밖으로 옮긴다(어느 화면에서나 바꾼다)
  const rawColors = (r as { sessionColors?: unknown }).sessionColors ?? ((r as { custom?: { sessionColors?: unknown } }).custom ?? {}).sessionColors
  const sessionColors = isColors(rawColors) ? rawColors : SESSION_COLORS_DEFAULT
  // 1.0 오늘 · 이번 달 금액 색 — 없으면(1.0 전 저장값) 처음 값
  const rawToday = (r as { todayColors?: unknown }).todayColors
  const rawMonth = (r as { monthColors?: unknown }).monthColors
  const todayColors = isColors(rawToday) ? rawToday : TODAY_COLORS_DEFAULT
  const monthColors = isColors(rawMonth) ? rawMonth : MONTH_COLORS_DEFAULT
  // 이지 오토 구간(2026-10-19): 없으면 그때의 컴팩트 구간
  const hasAuto = isCount(r.autoStart) && isCount(r.autoEnd) && r.autoStart < r.autoEnd
  const auto = hasAuto ? { autoStart: r.autoStart!, autoEnd: r.autoEnd! } : autoFromCompact({ follow, rangeStart, rangeEnd, compactAt })
  const rest = { compactAt, follow, rangeStart, rangeEnd, cacheWarnMin, cacheWarnMin5m, tidy, tidyCustom, compactCustom, lang, band, bandFolded, bandAutoOpen, sessionColors, todayColors, monthColors, questionHover, paneAutoOpen, paneShared, bandOrder, motion, ctxUnit, gaugeShape, statusLine, ...auto }
  return { ...rest, ...screenFrom(r as Record<string, unknown>) }
}

/**
 * 1.0 화면(시안 preview-1017d 안 3 — 사용자 "나머진 추천방향으로"): 화면 = 바 꼴 · 칸 단계 · 정보량. 옛 저장값(슬림이 따로 · 한도 줄 ·
 * 오늘 · 이번 달이 화면과 따로 · 커스텀 칸 켬/끔)은 보이던 그대로 옮긴다 — 프리셋과 다르게 바꿔 둔 분은 그 값으로 커스텀
 */
function screenFrom(r: Record<string, unknown>): Pick<Settings, 'screen' | 'custom'> {
  const rawScreen = r.screen
  const rawCustom = objectOf(r.custom)
  // 이미 1.0 꼴(화면이 슬림이거나 커스텀에 바 꼴이 있음)
  if (rawScreen === 'slim' || typeof rawCustom.layout === 'string') {
    const screen = SCREEN_PRESETS.includes(rawScreen as ScreenPreset) ? (rawScreen as ScreenPreset) : 'simple'
    return { screen, custom: normalizeView(r.custom) }
  }
  // ── 옛 꼴 ──
  const limitFrom = (from: Record<string, unknown>, base: LimitShow): LimitShow => {
    const out = { ...base }
    for (const k of LIMIT_KEYS) if (typeof from[k] === 'boolean') out[k] = from[k] as boolean
    return out
  }
  const rawLimits = r.limitShow
  const savedLimits = typeof rawLimits === 'object' && rawLimits !== null ? limitFrom(rawLimits as Record<string, unknown>, ALL_LIMITS) : null
  const today = r.spendToday === true
  const month = r.spendMonth === true
  const lv = (on: boolean): PartLevel => (on ? 'on' : 'off')
  // 보기 하나에 옛 값을 얹는다 — 세 줄 꼴은 한도 줄, 어느 꼴이든 오늘 · 이번 달, 칸(bandShow)이 있으면 그 켬/끔
  // spendOff = 오늘 · 이번 달을 안 켰던 분의 값(프리셋으로 옮길 땐 그 화면 처음 값 — 1.0 자세히는 둘 다 늘, 사용자 2026-10-18 "자세히는 풀로")
  const withOld = (base: ScreenView, limits: LimitShow, show: CostShow | null, spendOff: PartLevel = 'off'): ScreenView => ({
    ...base,
    parts: {
      ...base.parts,
      ...(show ? { sess: lv(show.session), req: lv(show.perRequest), ctx: show.context ? ('on' as const) : ('need' as const), range: lv(show.range), cache: lv(show.cache), last: lv(show.lastTurn) } : {}),
      ...(base.layout === 'three' ? { lim5: lv(limits.fiveHour), lim7: lv(limits.sevenDay), resets: lv(limits.resets) } : {}),
      today: today ? 'on' : spendOff,
      month: month ? 'on' : spendOff,
    },
  })
  const same = (a: ScreenView, b: ScreenView) => a.layout === b.layout && a.info === b.info && PART_KEYS.every(k => a.parts[k] === b.parts[k])
  // 프리셋 + 옛 값 — 프리셋과 같으면 프리셋, 다르면 그 값으로 커스텀(화면이 그대로 보이게)
  const presetOr = (p: 'simple' | 'detail', limits: LimitShow): Pick<Settings, 'screen' | 'custom'> => {
    const v = withOld(SCREEN_VIEWS[p], limits, null, SCREEN_VIEWS[p].parts.today)
    return same(v, SCREEN_VIEWS[p]) ? { screen: p, custom: null } : { screen: 'custom', custom: v }
  }
  // 슬림 켬(개발본의 화면 'glance' 도) → 슬림, 슬림 커스텀 → 아래 버튼 꼴 커스텀
  if (r.slim === 'on' || rawScreen === 'glance') return { screen: 'slim', custom: null }
  if (r.slim === 'custom') return { screen: 'custom', custom: { ...SCREEN_VIEWS.slim, parts: partsFromOldSlim(r.slimShow) } }
  if (rawScreen === 'custom') {
    const old = normalizeOldView(r.custom)
    return { screen: 'custom', custom: withOld({ ...SCREEN_VIEWS.detail, info: old?.info ?? 'full' }, savedLimits ?? limitFrom(objectOf(rawCustom.bandShow), ALL_LIMITS), old?.bandShow ?? ALL_SHOWN) }
  }
  // 0.4.0 의 기본 화면 → 간단(기본은 뺐다 · 업데이트 뒤 첫 화면은 간단)
  if (rawScreen === 'simple' || rawScreen === 'basic') return presetOr('simple', savedLimits ?? NO_LIMITS)
  if (rawScreen === 'detail') return presetOr('detail', savedLimits ?? ALL_LIMITS)
  // 화면이 없는 저장값 = 0.4.0 전부터 쓰던 사람: 칸(bandShow) · 패널 보기(paneMode — 없으면 자세히)를 옮긴다. 비용 · 질문 줄 칸을 다
  // 켰으면(손대지 않음) 간단 — 업데이트 뒤 첫 화면. 하나라도 껐으면 고른 것이라 그 칸 · 패널 그대로 커스텀(세 줄 꼴)
  const shown = objectOf(r.bandShow)
  const oldShow: CostShow = { ...ALL_SHOWN }
  for (const k of Object.keys(oldShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') oldShow[k] = shown[k] as boolean
  const allOn = (Object.keys(oldShow) as (keyof CostShow)[]).every(k => oldShow[k])
  if (allOn) return presetOr('simple', NO_LIMITS)
  const info: InfoLevel = r.paneMode === 'simple' ? 'lean' : 'full'
  return { screen: 'custom', custom: withOld({ ...SCREEN_VIEWS.detail, info }, limitFrom(shown, ALL_LIMITS), oldShow) }
}

/** 저장값 안의 객체(아니면 빈 객체) */
function objectOf(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** 색 기준: 오름차순 양수 셋 */
function isColors(c: unknown): c is [number, number, number] {
  return Array.isArray(c) && c.length === 3 && c.every(x => isCount(x) && x > 0) && c[0] < c[1] && c[1] < c[2]
}

/** 저장된 커스텀 값(1.0 꼴)을 관대하게: 빠진 칸은 그 바 꼴 프리셋 값. 없거나 깨졌으면 null */
function normalizeView(raw: unknown): ScreenView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = objectOf(raw)
  const layout = LAYOUTS.includes(v.layout as BarLayout) ? (v.layout as BarLayout) : 'three'
  const base = layout === 'button' ? SCREEN_VIEWS.slim : layout === 'one' ? SCREEN_VIEWS.simple : SCREEN_VIEWS.detail
  return { layout, parts: normalizeParts(v.parts, base.parts), info: v.info === 'lean' || v.info === 'full' ? v.info : base.info }
}

/** 1.0 전 커스텀 값(칸 켬/끔 · 정보량). 없거나 깨졌으면 null(0.4.0 의 sessionColors · sessionAvg 는 버린다 — 색은 normalizeSettings 가 밖으로) */
function normalizeOldView(raw: unknown): { bandShow: CostShow; info: InfoLevel } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = objectOf(raw)
  const shown = objectOf(v.bandShow)
  const bandShow = { ...ALL_SHOWN }
  for (const k of Object.keys(bandShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') bandShow[k] = shown[k] as boolean
  // 정보량 — 없으면 0.4.0 의 패널 보기(paneMode)에서(간략 → 최소, 자세히 → 전부)
  const info: InfoLevel = v.info === 'lean' || v.info === 'full' ? v.info : v.paneMode === 'simple' ? 'lean' : 'full'
  return { bandShow, info }
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
