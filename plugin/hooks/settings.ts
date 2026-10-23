import type { AutoState, BandMode, BandShow, BarLayout, CostShow, InfoLevel, LimitShow, PaneMode, PartKey, PartLevel, PartShow, ScreenPreset, ScreenView, Settings, Thresholds, TidyStyleId } from '../types'
import { L, lang } from './i18n'
import { onTerminal } from './glyph'
import type { Lang } from './i18n'
import { COMPACT_MAX, COMPACT_MIN, rangeThresholdsFor, thresholdsFor } from './optimal'
import { CACHE_WARN_5M_DEFAULT, currencyNow, fmtUsd } from './cost'
import type { Level } from './cost'

type TidyStyle = { name: string; use: string; keep: string; reply: string; save: string; compact: string; body: string[] }

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
export const TIDY_IDS: readonly TidyStyleId[] = ['default', 'thorough', 'light']
const OLD_TIDY_NAMES = new Map<string, TidyStyleId>([
  ['기본', 'default'],
  ['가볍게', 'light'],
  ['꼼꼼하게', 'thorough'],
  ['마무리하기', 'light'],
])

export const RANGE_ROWS: readonly number[] = [100_000, 150_000, 200_000, 250_000, 300_000, 400_000, 500_000, 700_000, 1_000_000]
export const RANGE_BANDS: readonly (readonly [number, number])[] = RANGE_ROWS.slice(1).map((end, i) => [RANGE_ROWS[i]!, end] as const)

let contextWindow = 1_000_000

export function setContextWindow(w: number | null | undefined): void {
  if (typeof w === 'number' && Number.isFinite(w) && w > 0) contextWindow = w
}

export function contextWindowNow(): number {
  return contextWindow
}

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

export function compactMax(): number {
  return Math.max(COMPACT_MAX, contextWindow)
}

let engineAutoAt: number | null = null
let isEngineAutoOff = false

export function setEngineAuto(at: number | null | undefined, isOn: boolean | undefined): void {
  engineAutoAt = typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : null
  isEngineAutoOff = isOn === false
}

export function autoCompactAt(): number {
  return engineAutoAt ?? Math.round(contextWindow * 0.967)
}

export function autoBands(): readonly (readonly [number, number])[] {
  const limit = isEngineAutoOff ? Number.POSITIVE_INFINITY : autoCompactAt()
  return rangeBands().filter(([, b]) => b < limit)
}

export const AUTO_RANGE_NEW: readonly [number, number] = [400_000, 500_000]

export function autoRangeDefault(): { start: number; end: number } {
  const bands = autoBands()
  const fit = bands.find(([a, b]) => a === AUTO_RANGE_NEW[0] && b === AUTO_RANGE_NEW[1]) ?? bands.filter(([, b]) => b <= AUTO_RANGE_NEW[1]).at(-1) ?? bands[0]
  return fit ? { start: fit[0], end: fit[1] } : { start: AUTO_RANGE_NEW[0], end: AUTO_RANGE_NEW[1] }
}

export function autoRangeOf(a: AutoState | null | undefined): { start: number; end: number } {
  return a?.range ?? autoRangeDefault()
}

export function setAutoRange(s: Settings, start: number, end: number): Settings {
  return start < end ? { ...s, autoStart: Math.round(start), autoEnd: Math.round(end) } : s
}

function autoFromCompact(c: Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'>): Pick<Settings, 'autoStart' | 'autoEnd'> {
  if (c.follow) return { autoStart: c.rangeStart, autoEnd: c.rangeEnd }
  const band = rangeBands().find(([a, b]) => c.compactAt > a && c.compactAt <= b)
  return band ? { autoStart: band[0], autoEnd: band[1] } : { autoStart: DEFAULT_SETTINGS.autoStart, autoEnd: DEFAULT_SETTINGS.autoEnd }
}

const ALL_LIMITS: LimitShow = { fiveHour: true, sevenDay: true, resets: true }
const NO_LIMITS: LimitShow = { fiveHour: false, sevenDay: false, resets: false }
const LIMIT_KEYS: readonly (keyof LimitShow)[] = ['fiveHour', 'sevenDay', 'resets']
const isLimitKey = (k: keyof BandShow): k is keyof LimitShow => (LIMIT_KEYS as readonly string[]).includes(k)

const ALL_SHOWN: CostShow = {
  session: true,
  perRequest: true,
  context: true,
  range: true,
  cache: true,
  lastTurn: true,
}

export const SESSION_COLORS_DEFAULT: [number, number, number] = [10, 50, 100]

export const TODAY_COLORS_DEFAULT: [number, number, number] = [50, 100, 200]
export const MONTH_COLORS_DEFAULT: [number, number, number] = [1000, 1500, 2000]

export const SCREEN_VIEWS: Record<Exclude<ScreenPreset, 'custom'>, ScreenView> = {
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
  detail: {
    layout: 'three',
    parts: { ctx: 'on', btn: 'on', cache: 'on', lim5: 'on', lim7: 'on', resets: 'on', sess: 'on', req: 'on', today: 'on', month: 'on', range: 'on', last: 'on', chip: 'on', spin: 'on' },
    info: 'full',
  },
}

export const SLIM_DEFAULT: PartShow = SCREEN_VIEWS.slim.parts

export const DEFAULT_SETTINGS: Settings = {
  compactAt: 250_000,
  follow: true,
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
  bandAutoOpen: true,
  screen: 'detail',
  custom: null,
  sessionColors: SESSION_COLORS_DEFAULT,
  todayColors: TODAY_COLORS_DEFAULT,
  monthColors: MONTH_COLORS_DEFAULT,
  questionHover: false,
  paneAutoOpen: false,
  paneShared: true,
  bandOrder: ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache'],
  motion: 'system',
  ctxUnit: 'size',
  gaugeShape: 'cells',
  statusLine: false,
  autoStart: 200_000,
  autoEnd: 250_000,
  currency: 'usd',
}

export const PARTS: readonly { key: PartKey; group: 'bar' | 'chat'; states: readonly PartLevel[]; layouts: readonly BarLayout[] }[] = [
  { key: 'ctx', group: 'bar', states: ['need', 'on'], layouts: ['button', 'one', 'three'] },
  { key: 'btn', group: 'bar', states: ['off', 'need', 'on'], layouts: ['button'] },
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

export function levelName(_key: PartKey, v: PartLevel): string {
  if (v === 'off') return L('끔', 'Off')
  if (v === 'need') return L('필요할 때', 'When needed')
  return L('늘', 'Always')
}

export function normalizeParts(raw: unknown, base: PartShow): PartShow {
  const old = objectOf(raw)
  const r = typeof old.lim === 'string' ? { lim5: old.lim, lim7: old.lim, ...old } : old
  const out: PartShow = { ...base }
  for (const p of PARTS) if (p.states.includes(r[p.key] as PartLevel)) out[p.key] = r[p.key] as PartLevel
  return out
}

function partsFromOldSlim(raw: unknown): PartShow {
  const r = objectOf(raw)
  const out = normalizeParts({ ...r, today: undefined, month: undefined }, SCREEN_VIEWS.slim.parts)
  if (r.spend === 'on') return { ...out, today: 'on', month: 'on' }
  return out
}

export function isSlim(s: Pick<Settings, 'screen' | 'custom'>): boolean {
  return viewOf(s).layout === 'button'
}

export function slimViewOf(s: Pick<Settings, 'screen' | 'custom'>): PartShow {
  return viewOf(s).parts
}

export function setPart(s: Settings, key: PartKey, v: PartLevel): Settings {
  return editView(s, view => ({ ...view, parts: { ...view.parts, [key]: v } }))
}

export function parsePartLevel(text: string): PartLevel | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['need', 'needed', 'whenneeded', '필요할때', '필요시', '필요할때만'].includes(t)) return 'need'
  if (['늘', 'always'].includes(t)) return 'on'
  const on = parseOnOff(t)
  return on === null ? null : on ? 'on' : 'off'
}

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

export function parsePartKey(text: string): PartKey | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  return PART_KEYS.find(k => PART_WORDS[k].includes(t)) ?? null
}

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

export function slimCustom(s: Settings): Settings {
  const base = s.screen === 'custom' && s.custom ? s.custom : viewOf(s)
  return { ...s, screen: 'custom', custom: { ...base, layout: 'button', parts: base.layout === 'button' ? base.parts : SCREEN_VIEWS.slim.parts } }
}

export function spendOf(s: Pick<Settings, 'screen' | 'custom'>): { today: boolean; month: boolean } {
  const p = viewOf(s).parts
  return { today: p.today !== 'off', month: p.month !== 'off' }
}

export function parseSlim(text: string): 'on' | 'off' | 'custom' | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['슬림', 'slim', '슬림켜기', '슬림켬', 'slimon'].includes(t)) return 'on'
  if (['슬림끄기', '슬림끔', 'slimoff'].includes(t)) return 'off'
  if (['슬림커스텀', 'slimcustom'].includes(t)) return 'custom'
  return null
}

export const BAND_ORDER_DEFAULT: readonly string[] = ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache']

export function normalizeOrder(raw: unknown): string[] {
  const got = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string' && BAND_ORDER_DEFAULT.includes(k)) : []
  const seen = [...new Set(got)]
  return [...seen, ...BAND_ORDER_DEFAULT.filter(k => !seen.includes(k))]
}

export const MONEY_KEYS: readonly string[] = ['session', 'today', 'month']
export const MONEY_ORDERS: readonly (readonly string[])[] = [
  ['session', 'today', 'month'],
  ['session', 'month', 'today'],
  ['today', 'session', 'month'],
  ['today', 'month', 'session'],
  ['month', 'session', 'today'],
  ['month', 'today', 'session'],
]

export function moneyOf(order: readonly string[]): string[] {
  return normalizeOrder(order).filter(k => MONEY_KEYS.includes(k))
}

export function withMoney(s: Settings, money: readonly string[]): Settings {
  const rest = normalizeOrder(s.bandOrder).filter(k => !MONEY_KEYS.includes(k))
  return { ...s, bandOrder: [...money, ...rest] }
}

export function moveEarlier(s: Settings, key: string): Settings {
  const o = normalizeOrder(s.bandOrder)
  const i = o.indexOf(key)
  if (i <= 0) return s
  ;[o[i - 1], o[i]] = [o[i]!, o[i - 1]!]
  return { ...s, bandOrder: o }
}

export const NEW_INSTALL_SCREEN: ScreenPreset = 'simple'
export const UPDATE_SCREEN: ScreenPreset = 'simple'

export const SCREEN_PRESETS: readonly ScreenPreset[] = ['slim', 'simple', 'detail', 'custom']

export function screenName(p: ScreenPreset): string {
  return p === 'slim' ? L('슬림', 'Slim') : p === 'simple' ? L('간단', 'Simple') : p === 'detail' ? L('자세히', 'Detailed') : L('커스텀', 'Custom')
}

export function screenUse(p: ScreenPreset): string {
  return p === 'slim'
    ? L('익숙해진 뒤 · 필요할 때만 알림', 'Once you know your way around · alerts only when needed')
    : p === 'simple'
    ? L('처음 쓸 때 · 꼭 필요한 것만', 'For starting out · essentials only')
    : p === 'detail'
      ? L('AI 비용 구조를 아는 분 · 전부 보기', 'If you know how AI costs work · everything')
      : L('세부를 직접 고름 · 칸마다 켜고 끔', 'Pick each detail yourself · row by row')
}

export function parseScreen(text: string): ScreenPreset | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['슬림', 'slim'].includes(t)) return 'slim'
  if (['간단', 'simple', '처음', 'beginner', '초보'].includes(t)) return 'simple'
  if (['자세히', 'detail', 'detailed', '전문가', 'expert', '기본', 'basic', 'default'].includes(t)) return 'detail'
  if (['커스텀', 'custom', '직접', '사용자지정'].includes(t)) return 'custom'
  return null
}

export function bandShowOf(s: Pick<Settings, 'screen' | 'custom'>): BandShow {
  const p = viewOf(s).parts
  const on = (k: PartKey) => p[k] !== 'off'
  return { fiveHour: on('lim5'), sevenDay: on('lim7'), resets: (on('lim5') || on('lim7')) && on('resets'), session: on('sess'), perRequest: on('req'), context: on('ctx'), range: on('range'), cache: on('cache'), lastTurn: on('last') }
}

export function viewOf(s: Pick<Settings, 'screen' | 'custom'>): ScreenView {
  return s.screen === 'custom' ? (s.custom ?? SCREEN_VIEWS.detail) : SCREEN_VIEWS[s.screen]
}

export function chooseScreen(s: Settings, p: ScreenPreset): Settings {
  if (p !== 'custom') return { ...s, screen: p }
  return { ...s, screen: 'custom', custom: s.custom ?? viewOf(s) }
}

export function editView(s: Settings, change: (v: ScreenView) => ScreenView): Settings {
  return { ...s, screen: 'custom', custom: change(viewOf(s)) }
}

export function resetCustom(s: Settings, from: Exclude<ScreenPreset, 'custom'>): Settings {
  return { ...s, screen: 'custom', custom: SCREEN_VIEWS[from] }
}

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

export function fmtUsd0(v: number): string {
  return Number.isInteger(v) && currencyNow() === 'usd' ? `$${v}` : fmtUsd(v)
}

export const SESSION_COLOR_STEPS: readonly number[] = [1, 2, 3, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000]

export type MoneyColorKey = 'sessionColors' | 'todayColors' | 'monthColors'
export const MONEY_COLOR_STEPS: Record<MoneyColorKey, readonly number[]> = {
  sessionColors: SESSION_COLOR_STEPS,
  todayColors: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000],
  monthColors: [100, 200, 300, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 5000, 10000],
}

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

export function infoUse(i: InfoLevel): string {
  return i === 'lean'
    ? L('처음 쓰는 분께 맞습니다. 꼭 필요한 것만 보입니다.', 'For first-time users. Shows only the essentials.')
    : L('비용 구조를 아는 분께 맞습니다. 이지 컴팩트가 아는 것을 모두 보입니다.', 'For those who know how the costs work. Shows everything Easy Compact knows.')
}

export function paneModeOf(s: Pick<Settings, 'screen' | 'custom'>): PaneMode {
  return viewOf(s).info === 'full' ? 'detail' : 'simple'
}

export function paneModeName(m: PaneMode): string {
  return m === 'simple' ? L('간단', 'Simple') : L('자세히', 'Detailed')
}

export function setLimits(s: Settings, on: boolean): Settings {
  return editView(s, v => ({ ...v, parts: { ...v.parts, lim5: on ? 'on' : 'off', lim7: on ? 'on' : 'off', resets: on ? 'on' : 'off' } }))
}

export function paneAutoUse(isOn: boolean): string {
  return isOn
    ? L('새 세션은 패널을 연 채로 시작합니다.', 'New sessions start with the pane open.')
    : L(
        `새 세션은 패널을 닫은 채로 시작합니다.`,
        `New sessions start with the pane closed.`,
      )
}

export function paneSyncUse(isOn: boolean): string {
  return isOn
    ? L('한 세션에서 열고 닫으면 다른 세션도 같이 열고 닫힙니다.', 'Opening or closing it in one session does the same in the others.')
    : L('세션마다 따로 열고 닫습니다.', 'Each session opens and closes it on its own.')
}

export function paneStateText(s: Settings): string {
  const onOff = (isOn: boolean) => (isOn ? L('켬', 'on') : L('끔', 'off'))
  return L(`자동 열기 ${onOff(s.paneAutoOpen)} · 같이 열고 닫기 ${onOff(s.paneShared)}`, `Auto-open ${onOff(s.paneAutoOpen)} · Open/close together ${onOff(s.paneShared)}`)
}

export const BAND_MODES: readonly BandMode[] = ['full', 'min']

export function bandModeName(m: BandMode): string {
  return m === 'full' ? L('전체', 'Full') : L('한 줄', 'One line')
}

export function bandModeUse(m: BandMode): string {
  return m === 'full'
    ? L('한도 · 비용 · 질문 줄과 컴팩트 버튼을 모두 보입니다.', 'Limits, cost and question rows with the Compact button.')
    : L('세션 · 요청당 · 컨텍스트 · 캐시를 한 줄로 보입니다.', 'Session, per request, context and cache in one line.')
}

export const REVEAL_SQUARE: Record<Level, string> = { ok: '🟦', warn: '🟧', cut: '🟥' }

export function revealLabel(isClosed: boolean, level: Level | null = null, value: string | null = null): string {
  const name = isClosed ? L('이지 컴팩트 닫힘', 'Easy Compact closed') : L('이지 컴팩트', 'Easy Compact')
  if (onTerminal()) return `⇱ ${name}`
  if (value !== null) return `${REVEAL_SQUARE[level ?? 'ok']} ${value}${isClosed ? L(' · 닫힘', ' · closed') : ''}`
  return `${REVEAL_SQUARE[level ?? 'ok']} ${name}`
}

export function revealName(isClosed = false): string {
  if (onTerminal()) return revealLabel(isClosed)
  return isClosed ? L('🟦 컨텍스트 · 닫힘', '🟦 context · closed') : L('🟦 컨텍스트', '🟦 context')
}

export function revealWhere(): string {
  return onTerminal() ? L('입력창 위', 'above the input') : L('입력창 아래', 'below the input')
}

function revealKeys(): string {
  return onTerminal() ? '(ctrl+x tab)' : ''
}

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

export type BandShowMode = 'always' | 'auto' | 'never'

export function bandShowMode(s: Settings): BandShowMode {
  return !s.bandFolded ? 'always' : s.bandAutoOpen ? 'auto' : 'never'
}

export function setBandShow(s: Settings, m: BandShowMode): Settings {
  if (m === 'always') return { ...s, bandFolded: false }
  return { ...s, bandFolded: true, bandAutoOpen: m === 'auto' }
}

export function setFolded(s: Settings, folded: boolean): Settings {
  return { ...s, bandFolded: folded }
}

export function foldName(folded: boolean): string {
  return folded ? L('접음', 'Folded') : L('펼침', 'Open')
}

function turnBackOn(isAuto: boolean, label: string | null = null): string {
  const name = label ?? revealName(!isAuto)
  return L(
    `다시 펴기: ${revealWhere()} [${name}]${revealKeys()}`,
    `open it again with [${name}] ${revealWhere()}${revealKeys() ? ` ${revealKeys()}` : ''}`,
  )
}

export function hiddenNote(s: Pick<Settings, 'bandAutoOpen'>, label: string | null = null): string {
  return s.bandAutoOpen
    ? L(`이지 컴팩트 바를 접었습니다. ${turnBackOn(true, label)} · 컴팩트할 때 저절로 펴집니다.`, `Easy Compact bar folded; ${turnBackOn(true, label)}. It opens by itself when it’s time to compact.`)
    : L(`이지 컴팩트 바를 모든 세션에서 접었습니다. ${turnBackOn(false, label)}`, `Easy Compact bar is folded in every session; ${turnBackOn(false, label)}.`)
}

export const HIDDEN_NOTE_MS = 10_000

export function bandStateText(s: Settings): string {
  const size = isSlim(s) ? L('슬림', 'Slim') : bandModeName(s.band)
  return [foldName(s.bandFolded), s.bandFolded && s.bandAutoOpen ? L('컴팩트할 때 펴기', 'opens when compacting') : null, size].filter(Boolean).join(' · ')
}

export function parseOnOff(text: string): boolean | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['on', 'show', 'open', '켜기', '켜', '켬', '보이기', '열기'].includes(t)) return true
  if (['off', 'hide', 'close', '끄기', '꺼', '끔', '빼기', '숨기기', '닫기'].includes(t)) return false
  return null
}

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

export function bandPartName(key: keyof BandShow): string {
  const names: Record<keyof BandShow, [string, string]> = {
    fiveHour: ['5시간', '5h'],
    sevenDay: ['7일', '7d'],
    resets: ['리셋까지 남은 시간', 'Time to reset'],
    session: ['세션 금액', 'Session cost'],
    perRequest: ['요청당', 'Per request'],
    context: ['컨텍스트', 'Context'],
    range: ['컴팩트 구간', 'Compact range'],
    cache: ['캐시 남은 시간', 'Cache time left'],
    lastTurn: ['지난 질문', 'Last question'],
  }
  return L(...names[key])
}

export function parseBandMode(text: string): BandMode | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (['full', 'max', 'maximize', '최대', '최대화', '전체', '전체보기'].includes(t)) return 'full'
  if (['min', 'minimize', 'minimized', '최소', '최소화', '한줄'].includes(t)) return 'min'
  return null
}

export function isAutoWord(text: string): boolean {
  return ['auto', 'autohide', 'auto-hide', 'needed', 'whenneeded', 'onlywhenneeded', '자동숨김', '자동', '필요할때만', '필요시', '컴팩트할때만'].includes(text.replace(/\s+/g, '').toLowerCase())
}

export function parseBandPart(text: string): keyof BandShow | null {
  const t = text.replace(/\s+/g, '').toLowerCase()
  return BAND_PARTS.find(p => p.names.includes(t))?.key ?? null
}

const BAND_TO_PART: Record<keyof BandShow, PartKey> = { fiveHour: 'lim5', sevenDay: 'lim7', resets: 'resets', session: 'sess', perRequest: 'req', context: 'ctx', range: 'range', cache: 'cache', lastTurn: 'last' }

export function setBandPart(s: Settings, key: keyof BandShow, on: boolean): Settings {
  const pk = BAND_TO_PART[key]
  return setPart(s, pk, on ? 'on' : pk === 'ctx' ? 'need' : 'off')
}

export function isViewPart(_key: keyof BandShow): boolean {
  return true
}

export function setCompactAt(s: Settings, tokens: number): Settings {
  return { ...s, compactAt: Math.min(compactMax(), Math.max(COMPACT_MIN, Math.round(tokens))), follow: false }
}

export function setFollow(s: Settings, on: boolean, shown?: number): Settings {
  if (on) return { ...s, follow: true }
  return { ...s, follow: false, compactAt: shown ?? s.compactAt }
}

export function setRange(s: Settings, start: number, end: number): Settings {
  const clamp = (v: number) => Math.min(compactMax(), Math.max(COMPACT_MIN, Math.round(v)))
  return clamp(start) < clamp(end) ? { ...s, follow: true, rangeStart: clamp(start), rangeEnd: clamp(end) } : s
}

export const CACHE_STEPS: readonly number[] = [0, 5, 10, 15, 20, 30]
export const CACHE_STEPS_5M: readonly number[] = [0, 1, 2, 3, 4]

export function nudgeCache(s: Settings, dir: 1 | -1, ttl = 60): Settings {
  const is5m = ttl < 60
  const steps = is5m ? CACHE_STEPS_5M : CACHE_STEPS
  const v = is5m ? s.cacheWarnMin5m : s.cacheWarnMin
  const next = dir > 0 ? (steps.find(m => m > v) ?? v) : ([...steps].reverse().find(m => m < v) ?? v)
  return is5m ? { ...s, cacheWarnMin5m: next } : { ...s, cacheWarnMin: next }
}

export function customName(): string {
  return L('직접', 'Custom')
}
export function customUse(): string {
  return L('원하는 방식이 따로 있을 때 씁니다.', 'When you want your own way.')
}

export function chooseTidy(s: Settings, text: string): Settings {
  const t = text.trim()
  const bare = (v: string) => v.replace(/\s+/g, '').toLowerCase()
  const id = TIDY_IDS.find(k => k === t || bare(STYLES.ko[k].name) === bare(t) || bare(STYLES.en[k].name) === bare(t)) ?? OLD_TIDY_NAMES.get(bare(t))
  if (id) return { ...s, tidy: id }
  if (['직접', 'custom', '커스텀'].includes(bare(t))) return { ...s, tidy: 'custom' }
  return t ? setTidyCustom(s, t) : s
}

export function setTidyCustom(s: Settings, text: string): Settings {
  return { ...s, tidy: 'custom', tidyCustom: text.trim(), compactCustom: s.tidy === 'custom' ? s.compactCustom : compactText(s) }
}

export function setCompactCustom(s: Settings, text: string): Settings {
  return { ...s, tidy: 'custom', compactCustom: text.trim(), tidyCustom: s.tidy === 'custom' ? s.tidyCustom : tidyBody(s).join('\n') }
}

export function compactText(s: Settings): string {
  if (s.tidy === 'custom' && s.compactCustom !== '') return s.compactCustom
  return tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy].compact
}

export const usesCustom = (s: Settings) => s.tidy === 'custom' && s.tidyCustom !== ''

export function tidyBody(s: Settings): string[] {
  if (usesCustom(s)) return s.tidyCustom.split(/\n/)
  return tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy].body
}

export function tidySteps(s: Settings): { save: string; keep: string; reply: string } {
  if (usesCustom(s)) {
    const asTyped = L('칸에 쓴 글대로', 'As typed in the box')
    return { save: L('직접 쓴 문구대로', 'As your custom text'), keep: asTyped, reply: asTyped }
  }
  const style = tidyStyles()[s.tidy === 'custom' ? 'default' : s.tidy]
  return { save: style.save, keep: style.keep, reply: style.reply }
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

export function normalizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const r = raw as Partial<Settings> & { auto?: unknown; values?: { ctxCut?: unknown; cacheWarnMin?: unknown } }
  const legacyFixed = r.auto === false && isCount(r.values?.ctxCut)
  const compactAt = isCount(r.compactAt) ? r.compactAt : legacyFixed ? (r.values!.ctxCut as number) : DEFAULT_SETTINGS.compactAt
  const follow = typeof r.follow === 'boolean' ? r.follow : !legacyFixed
  const hasRange = isCount(r.rangeStart) && isCount(r.rangeEnd) && r.rangeStart < r.rangeEnd
  const rangeStart = hasRange ? r.rangeStart! : DEFAULT_SETTINGS.rangeStart
  const rangeEnd = hasRange ? r.rangeEnd! : DEFAULT_SETTINGS.rangeEnd
  const cacheWarnMin = isCount(r.cacheWarnMin) ? r.cacheWarnMin : isCount(r.values?.cacheWarnMin) ? r.values.cacheWarnMin : DEFAULT_SETTINGS.cacheWarnMin
  const cacheWarnMin5m = isCount(r.cacheWarnMin5m) && r.cacheWarnMin5m < 5 ? r.cacheWarnMin5m : DEFAULT_SETTINGS.cacheWarnMin5m
  const tidy = r.tidy === 'custom' || TIDY_IDS.includes(r.tidy as TidyStyleId) ? (r.tidy as Settings['tidy']) : 'default'
  const tidyCustom = typeof r.tidyCustom === 'string' ? r.tidyCustom : ''
  const compactCustom = typeof r.compactCustom === 'string' ? r.compactCustom : ''
  const lang = r.lang === 'ko' || r.lang === 'en' ? r.lang : 'auto'
  const rawBand = (r as { band?: unknown }).band
  const band = rawBand === 'auto' ? 'min' : BAND_MODES.includes(rawBand as BandMode) ? (rawBand as BandMode) : DEFAULT_SETTINGS.band
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
  const rawUnit = (r as { ctxUnit?: unknown }).ctxUnit
  const ctxUnit = rawUnit === 'pct' || rawUnit === 'both' ? rawUnit : 'size'
  const rawShape = (r as { gaugeShape?: unknown }).gaugeShape
  const gaugeShape = rawShape === 'ring' || rawShape === 'vbar' || rawShape === 'bar' || rawShape === 'cells' || rawShape === 'vcells' ? rawShape : DEFAULT_SETTINGS.gaugeShape
  const statusLine = (r as { statusLine?: unknown }).statusLine === true
  const rawColors = (r as { sessionColors?: unknown }).sessionColors ?? ((r as { custom?: { sessionColors?: unknown } }).custom ?? {}).sessionColors
  const sessionColors = isColors(rawColors) ? rawColors : SESSION_COLORS_DEFAULT
  const rawToday = (r as { todayColors?: unknown }).todayColors
  const rawMonth = (r as { monthColors?: unknown }).monthColors
  const todayColors = isColors(rawToday) ? rawToday : TODAY_COLORS_DEFAULT
  const monthColors = isColors(rawMonth) ? rawMonth : MONTH_COLORS_DEFAULT
  const hasAuto = isCount(r.autoStart) && isCount(r.autoEnd) && r.autoStart < r.autoEnd
  const auto = hasAuto ? { autoStart: r.autoStart!, autoEnd: r.autoEnd! } : autoFromCompact({ follow, rangeStart, rangeEnd, compactAt })
  const currency = r.currency === 'krw' || r.currency === 'usd' ? r.currency : DEFAULT_SETTINGS.currency
  const rest = { compactAt, follow, rangeStart, rangeEnd, cacheWarnMin, cacheWarnMin5m, tidy, tidyCustom, compactCustom, lang, band, bandFolded, bandAutoOpen, sessionColors, todayColors, monthColors, questionHover, paneAutoOpen, paneShared, bandOrder, motion, ctxUnit, gaugeShape, statusLine, ...auto, currency }
  return { ...rest, ...screenFrom(r as Record<string, unknown>) }
}

function screenFrom(r: Record<string, unknown>): Pick<Settings, 'screen' | 'custom'> {
  const rawScreen = r.screen
  const rawCustom = objectOf(r.custom)
  if (rawScreen === 'slim' || typeof rawCustom.layout === 'string') {
    const screen = SCREEN_PRESETS.includes(rawScreen as ScreenPreset) ? (rawScreen as ScreenPreset) : 'simple'
    return { screen, custom: normalizeView(r.custom) }
  }
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
  const presetOr = (p: 'simple' | 'detail', limits: LimitShow): Pick<Settings, 'screen' | 'custom'> => {
    const v = withOld(SCREEN_VIEWS[p], limits, null, SCREEN_VIEWS[p].parts.today)
    return same(v, SCREEN_VIEWS[p]) ? { screen: p, custom: null } : { screen: 'custom', custom: v }
  }
  if (r.slim === 'on' || rawScreen === 'glance') return { screen: 'slim', custom: null }
  if (r.slim === 'custom') return { screen: 'custom', custom: { ...SCREEN_VIEWS.slim, parts: partsFromOldSlim(r.slimShow) } }
  if (rawScreen === 'custom') {
    const old = normalizeOldView(r.custom)
    return { screen: 'custom', custom: withOld({ ...SCREEN_VIEWS.detail, info: old?.info ?? 'full' }, savedLimits ?? limitFrom(objectOf(rawCustom.bandShow), ALL_LIMITS), old?.bandShow ?? ALL_SHOWN) }
  }
  if (rawScreen === 'simple' || rawScreen === 'basic') return presetOr('simple', savedLimits ?? NO_LIMITS)
  if (rawScreen === 'detail') return presetOr('detail', savedLimits ?? ALL_LIMITS)
  const shown = objectOf(r.bandShow)
  const oldShow: CostShow = { ...ALL_SHOWN }
  for (const k of Object.keys(oldShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') oldShow[k] = shown[k] as boolean
  const allOn = (Object.keys(oldShow) as (keyof CostShow)[]).every(k => oldShow[k])
  if (allOn) return presetOr('simple', NO_LIMITS)
  const info: InfoLevel = r.paneMode === 'simple' ? 'lean' : 'full'
  return { screen: 'custom', custom: withOld({ ...SCREEN_VIEWS.detail, info }, limitFrom(shown, ALL_LIMITS), oldShow) }
}

function objectOf(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function isColors(c: unknown): c is [number, number, number] {
  return Array.isArray(c) && c.length === 3 && c.every(x => isCount(x) && x > 0) && c[0] < c[1] && c[1] < c[2]
}

function normalizeView(raw: unknown): ScreenView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = objectOf(raw)
  const layout = LAYOUTS.includes(v.layout as BarLayout) ? (v.layout as BarLayout) : 'three'
  const base = layout === 'button' ? SCREEN_VIEWS.slim : layout === 'one' ? SCREEN_VIEWS.simple : SCREEN_VIEWS.detail
  return { layout, parts: normalizeParts(v.parts, base.parts), info: v.info === 'lean' || v.info === 'full' ? v.info : base.info }
}

function normalizeOldView(raw: unknown): { bandShow: CostShow; info: InfoLevel } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = objectOf(raw)
  const shown = objectOf(v.bandShow)
  const bandShow = { ...ALL_SHOWN }
  for (const k of Object.keys(bandShow) as (keyof CostShow)[]) if (typeof shown[k] === 'boolean') bandShow[k] = shown[k] as boolean
  const info: InfoLevel = v.info === 'lean' || v.info === 'full' ? v.info : v.paneMode === 'simple' ? 'lean' : 'full'
  return { bandShow, info }
}

export function parseTokens(text: string): number | null {
  const t = text.trim().replace(/[,\s]/g, '').replace(/ㅏ/g, 'k').replace(/ㅡ/g, 'm')
  const m = /^(\d+(?:\.\d+)?)(만|k|K|m|M)?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  if (unit === '만') return Math.round(n * 10_000)
  if (unit === 'k' || unit === 'K') return Math.round(n * 1000)
  if (unit === 'm' || unit === 'M') return Math.round(n * 1_000_000)
  return Math.round(n < 10_000 ? n * 1000 : n)
}

export function parseMinutes(text: string): number | null {
  const m = /^(\d+)(분|m|min)?$/i.exec(text.trim())
  return m ? Number(m[1]) : null
}

export function thresholdsOf(s: Settings, model: string): Thresholds {
  const t = s.follow ? rangeThresholdsFor(s.rangeStart, s.rangeEnd, model, s.cacheWarnMin) : thresholdsFor(s.compactAt, model, s.cacheWarnMin)
  return { ...t, cacheWarnMin5m: s.cacheWarnMin5m }
}
