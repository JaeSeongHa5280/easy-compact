import type { ChangeGroup, CostShow, Optimal, ScreenView, Settings, Source, TidyStyleId, TtlConfig, UpdateState } from '../types'
import { cacheWarnFor, fmtTokens, fmtUsd, modelName, ratesFor, rewriteAllUsd, SESSION_HEX, ttlName, writeRate } from './cost'
import {
  BAND_MODES,
  BAND_PARTS,
  bandModeName,
  bandAutoUse,
  bandStateText,
  bandModeUse,
  bandPartName,
  bandShowOf,
  chooseScreen,
  editView,
  foldName,
  fmtUsd0,
  nudgeSessionColor,
  paneAutoUse,
  paneSyncUse,
  infoName,
  infoUse,
  resetCustom,
  SCREEN_PRESETS,
  screenName,
  screenUse,
  screenStateText,
  setBandPart,
  setFolded,
  setLimits,
  viewOf,
  chooseTidy,
  customName,
  customUse,
  DEFAULT_SETTINGS,
  nudgeCache,
  parseTokens,
  RANGE_BANDS,
  RANGE_ROWS,
  setCompactAt,
  thresholdsOf,
  TIDY_IDS,
  tidyStyles,
  tidySteps,
  usesCustom,
} from './settings'
import { penaltyAt, rangeThresholdsFor, thresholdsFor, WARN_RATIO } from './optimal'
import { tidyScript } from './tidy'
import { L } from './i18n'
import type { Lang } from './i18n'
import {
  ACCENT,
  STAR_COLOR,
  PEN_WARN_PCT,
  PEN_BAD_PCT,
  penColorOf,
  isNotRecommended,
  penVerdict,
  phaseLook,
  pickButton,
  pulseDot,
  CARD,
  CARD_INSET,
  decoIcon,
  LIVE_HEX,
  nameColW,
  isStackedFor,
  section,
} from './ui-common'
import type { Fold } from './ui-common'
import { cellsOf, widthOf } from './text'
import type { Ui } from './ui-common'

/** ⚙ 설정 탭 — 컴팩트 시점(구간 · 직접 지정)과 컴팩트 문구 */

/** 비용표 "질문 1개" 칸의 요청 수 — 작업량과 상관없는 고정 기준 */
export const Q_STEPS = 10

/** 설정의 컴팩트 시점에서 고르는 중인 값 — [적용] 전까지 저장하지 않는다 */
export type CmpDraft = Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'> & { sizeText?: string }

/** 직접 지정 입력칸에 친 글을 크기로(읽히면 10만 ~ 100만 안으로), 못 읽거나 안 쳤으면 고른 크기 그대로 */
export function draftCompactAt(s: Settings, d: CmpDraft): number {
  const typed = d.sizeText === undefined ? null : parseTokens(d.sizeText)
  return typed === null ? d.compactAt : setCompactAt(s, typed).compactAt
}

/**
 * 설정: 컴팩트 시점 → 캐시 경고 → 컴팩트 문구. 컴팩트 시점은 맨 위에 "적용 중" 값, 그 아래 두 방식 중 하나:
 * - 구간(기본): 0~100만 비용표의 크기 띠 한 줄을 고른다. 시작부터 노랑("컴팩트하기 좋은 때"), 끝부터 빨강. 예전엔 최적 한
 *   점을 권했는데 컴팩트할 때마다 움직여 "이게 맞나" 싶었다 — 바닥이 평평해 그 사이 어디서 해도 차이가 작다(optimal.ts 머리말)
 * - 직접 지정: 입력칸에 쓴 크기가 빨강, 그 80% 부터 노랑. 최적보다 요청당 몇 % 더 드는지를 보인다
 * 고르기만 해선 저장되지 않고 [▶ 적용] 으로. 설명은 이름 칸 + 짧은 풀이 한 줄씩, 중요한 데만 색
 */
/** 설정 화면의 버튼 동작 — 화면 코드는 $ 를 못 받아(엔진 규칙) register.tsx 가 묶어 넘긴다 */
export type SettingsActions = {
  save: (next: Settings) => void
  editCmp: (next: CmpDraft | null) => void
  applyCmp: () => void
  typeTidy: (text: string) => void
  saveTidy: (text: string) => void
  toggleRaw: () => void
  /** 설정 칸 접기 · 펼치기: compact · tidy · band · layout(바 안 상세 조정) · cache · lang */
  toggleFold: (key: string) => void
  setLang: (choice: Settings['lang']) => void
  /** 사용량 패널 옵션: 새 세션에서 자동으로 열기(paneAutoOpen) · 모든 세션 같이 열고 닫기(paneShared) */
  setPaneOption: (key: 'paneAutoOpen' | 'paneShared', isOn: boolean) => void
  /** 캐시 유지 시간(커스텀만): 사용자 설정 파일의 promptCacheTtl — null = 자동(키를 지움) */
  setTtl: (value: '5m' | '1h' | null) => void
  /** 업데이트 칸(설치본만): [업데이트 확인] · [업데이트] · 펼침(바뀐 것 · 오류 원문) */
  checkUpdate: () => void
  applyUpdate: () => void
  toggleUpdate: (key: 'changes' | 'error' | 'note') => void
}

/** 설정 탭 캐시 칸의 재료: 이 세션 유지 시간(분) · 기록에서 쟀나 · 무엇이 정하나 */
export type CacheInfo = {
  ttl: number
  measured: boolean
  config: TtlConfig | null
  /** 만료까지 남은 분(따뜻할 때) · 식었나 — 캐시 칸 "지금" 줄. 모르면 null · false */
  minsLeft?: number | null
  isCold?: boolean
}

export function drawSettings(
  act: SettingsActions,
  ui: Ui,
  s: Settings,
  opt: Optimal | null,
  draft: string | null,
  rawOpen = false,
  onToggleRaw: () => void = () => {},
  cmp: CmpDraft | null = null,
  ctxNow: number | null = null,
  surface = 'desktop',
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  preview: unknown = null,
  hasLimits: boolean | null = null,
) {
  const { Box, Button, Input, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const save = act.save
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  // 고르기 버튼(방식 · 시작 · 끝 · 문구): 고른 것은 주 버튼(채움) — 공용 pickButton(데스크톱 ✓ 없음 · 터미널 ✓)
  const pick = (key: string, label: string, isOn: boolean, onPress: () => void) => pickButton(ui, key, label, isOn, onPress)

  // 컴팩트 시점은 고르는 값(cmpDraft)으로 그리고 [적용] 을 눌러야 저장한다 — 누르자마자 바뀌어 고르는 도중에도 띠 · 색이
  // 따라 움직였다
  const d: CmpDraft = cmp ?? { follow: s.follow, rangeStart: s.rangeStart, rangeEnd: s.rangeEnd, compactAt: s.compactAt }
  const dAt = draftCompactAt(s, d)
  const isDirty = d.follow !== s.follow || d.rangeStart !== s.rangeStart || d.rangeEnd !== s.rangeEnd || dAt !== s.compactAt
  const edit = (next: CmpDraft) => act.editCmp(next)
  // 고르는 값으로 걸릴 기준(노랑 · 빨강) — 긴 프롬프트 경계(Haiku 5.5)로 묶인 값까지
  const dt = d.follow ? rangeThresholdsFor(d.rangeStart, d.rangeEnd, modelId, s.cacheWarnMin) : thresholdsFor(dAt, modelId, s.cacheWarnMin)

  // 방식: 구간 · 직접 지정. 직접으로 바꾸면 구간 끝(빨강)에서 시작 — 바꾸자마자 빨강이 튀지 않게
  const modeRow = (
    <Box key="cmp-mode" columnGap={1} alignItems="center" flexWrap="wrap" marginTop={1}>
      <Text>{L('방식', 'Mode')}</Text>
      {pick('cmp-range', L('구간', 'Range'), d.follow, () => edit({ ...d, follow: true }))}
      {pick('cmp-manual', L('직접 지정', 'Fixed size'), !d.follow, () => edit({ ...d, follow: false, compactAt: d.follow ? d.rangeEnd : d.compactAt, sizeText: undefined }))}
    </Box>
  )
  const capNote =
    opt?.capped != null
      ? L(` ${model}는 ${fmtTokens(opt.capped)}를 넘으면 요금이 5배라 그 아래로 묶습니다.`, ` ${model} costs 5× above ${fmtTokens(opt.capped)}, so it stays below that.`)
      : ''
  // 최적 대비(이 세션 값): 그 크기에서 컴팩트하면 요청당 평균이 비용이 가장 적은 크기보다 몇 % 더 드나
  const penOf = (size: number) => (inputs && opt?.model ? (penaltyAt(size, opt.model, inputs, opt.growth)?.pct ?? null) : null)

  // 비용표 칸(데스크톱은 칸 폭을 상자로 맞춘다) · 크기에서 요청 1회(캐시 읽기) · 캐시 식으면(이 세션 유지 시간의 쓰기 요율로 전체 다시)
  const cell = (key: string, width: number, el: unknown) => (
    <Box key={key} width={width} flexShrink={0}>
      {el}
    </Box>
  )
  // 캐시 식으면 = 공통 앞부분(다른 세션이 데워 둠)은 읽기, 나머지 다시 쓰기 — 띠 · 확인 카드와 같은 셈(cost.ts rewriteAllUsd)
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    if (!r) return null
    return which === 'write1h' ? rewriteAllUsd(size, r, opt?.shared ?? 0, ttl) : (size * r.read) / 1e6
  }
  const pctText = (p: number | null) => (p === null ? '—' : p < 0.5 ? '0' : `+${Math.round(p)}`)
  // 바꾼 값이 있으면 확인창처럼: 무엇으로 바뀌는지 한 줄 + 오른쪽 아래 큰 [▶ 적용] [✕ 취소] — 작은 버튼 둘이 줄 끝에 붙어
  // 있으니 눈에 안 들어왔다. 버튼 크기는 앱이 정해 굵은 글자와 양옆 여백(줄바꿈 없는 공백)으로 키운다
  const pad = (text: string) => `  ${text}  `
  // 적용 중인 값은 카드 맨 위 한 줄 — 방식 버튼 아래 녹색 "지금 구간" 은 왜 녹색인지, 무엇이 "지금" 인지(지금 컨텍스트 줄과)
  // 헷갈렸다
  const appliedText = s.follow
    ? L(`구간 ${fmtTokens(s.rangeStart)} ~ ${fmtTokens(s.rangeEnd)}`, `range ${fmtTokens(s.rangeStart)} – ${fmtTokens(s.rangeEnd)}`)
    : L(`직접 지정 ${fmtTokens(s.compactAt)}`, `fixed ${fmtTokens(s.compactAt)}`)
  // 지금 컨텍스트도 이 줄에 크기만 — 비용표 사이에 끼운 줄은 띠 버튼 줄처럼 생겨 눌러 보게 됐다. 색은 적용 중인
  // 기준으로: 시작(노랑)을 넘으면 노랑, 끝(빨강)을 넘으면 빨강
  const appliedT = thresholdsOf(s, modelId)
  // 정보량 최소(간단 · 커스텀에서 고름)면 컴팩트 시점도 최소로 — 표는 크기 구간 · 판정 · 적용 중만,
  // 읽기 1회 · 질문 1개 · 캐시 식으면 · 최적 대비 % · 계산 값 풀이는 자세히에서
  const isLean = viewOf(s).info === 'lean'
  const ctxColor = ctxNow === null ? undefined : ctxNow >= appliedT.ctxCut ? 'red' : ctxNow >= appliedT.ctxWarn ? 'yellow' : undefined
  // 적용 중인 값은 카드 제목 띠로 옮겼다(접든 펴든 늘 — 표 줄 끝 "적용 중" 칸 대신, 2026-10-14 uxi 1.1). 여기엔 지금 크기 · 읽기 1회만
  const appliedRow = !(ctxNow !== null && ctxNow > 0) ? null : (
    <Box key="cmp-applied" columnGap={1} alignItems="center" flexWrap="wrap">
      {ctxNow !== null && ctxNow > 0 ? <Text>{L('현재 컨텍스트', 'Current context')}</Text> : null}
      {ctxNow !== null && ctxNow > 0 ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtTokens(ctxNow)}
        </Text>
      ) : null}
      {/* 지금 크기에서 읽기 1회 — 비용표의 "읽기 1회" 칸과 같은 값. 바의 "요청당" 은 실제 값(9a)이라 이름을 갈랐다 */}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text dimColor>·</Text> : null}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text>{L('읽기 1회', 'One read')}</Text> : null}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtUsd(usdAt(ctxNow, 'read')!)}
        </Text>
      ) : null}
    </Box>
  )
  const draftText = d.follow
    ? L(`구간 ${fmtTokens(dt.ctxWarn)} ~ ${fmtTokens(dt.ctxCut)}`, `range ${fmtTokens(dt.ctxWarn)} – ${fmtTokens(dt.ctxCut)}`)
    : L(`직접 지정 ${fmtTokens(dt.ctxCut)}`, `fixed ${fmtTokens(dt.ctxCut)}`)
  const applyArea = isDirty ? (
    <Box key="cmp-apply-area" flexDirection="column" marginTop={1}>
      <Text color="yellow" wrap="wrap">
        {L(`${appliedText} → ${draftText} 로 바꿀까요?`, `Change ${appliedText} → ${draftText}?`)}
      </Text>
      <Box key="cmp-actions" justifyContent="flex-end" columnGap={2} marginTop={1}>
        <Button key="cmp-apply" label={pad(L('▶ 적용', '▶ Apply'))} variant="primary" onPress={() => act.applyCmp()}>
          <Text bold>{pad(L('▶ 적용', '▶ Apply'))}</Text>
        </Button>
        <Button key="cmp-cancel" label={pad(L('✕ 취소', '✕ Cancel'))} variant="secondary" onPress={() => act.editCmp(null)}>
          <Text bold>{pad(L('✕ 취소', '✕ Cancel'))}</Text>
        </Button>
      </Box>
    </Box>
  ) : null
  // 설명은 이름 칸 + 짧은 풀이 한 줄씩 — 한 문단 긴 글은 읽히지 않았다.
  // 이름 칸 = 그 카드에서 가장 긴 이름 + 1(termW — 카드마다 그리기 직전에 정한다). 예전 12칸 고정은 짧은 이름엔 비고 영어 긴 이름은
  // 두 줄로 꺾였다(2026-10-14 uxi C · fb A2). 좁은 패널이면 이름을 위에 쌓는다 — 값 · 버튼 자리가 15칸 남짓으로 줄었다
  let termW = 12
  // 이름을 쌓을지는 그 카드 이름 폭(termW)으로 — 그리는 때마다 본다
  const stacked = () => isStackedFor(cols, termW)
  const descEl = (desc: unknown) =>
    typeof desc === 'string' ? (
      <Text dimColor wrap="wrap">
        {desc}
      </Text>
    ) : (
      desc
    )
  const term = (key: string, name: string, desc: unknown, nameColor?: string) =>
    stacked() ? (
      <Box key={key} flexDirection="column">
        <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>
        <Box columnGap={1} flexWrap="wrap">
          {descEl(desc)}
        </Box>
      </Box>
    ) : (
      // 터미널은 풀이가 두 줄이면 이름이 가운데(둘째 줄)로 내려가 엇갈려 보였다 — 첫 줄에 맞춘다
      <Box key={key} columnGap={1} alignItems={isTerminal ? 'flex-start' : 'center'}>
        {cell('t', termW, <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>)}
        <Box flexShrink={1} minWidth={0} columnGap={1} flexWrap="wrap">
          {descEl(desc)}
        </Box>
      </Box>
    )
  // 컴팩트 시점 칸의 이름들 — 이 칸을 그리는 동안의 이름 칸 폭
  termW = nameColW([
    L('★ 추천', '★ Suggested'),
    L('비추천', 'Not advised'),
    L('최적보다', 'Over best'),
    L('읽기 1회', 'One read'),
    L('질문 1개', 'Question'),
    L('캐시 식으면', 'Cold cache'),
    L('★ 최적', '★ Best'),
    L('계산 값', 'Inputs'),
    model,
    L('기본 구간', 'Default range'),
    L('색', 'Colors'),
  ])
  // 색 문턱 설명: 노랑 · 빨강 글자에 그 색. 문턱(+10 · +50%)은 잰 값이 아니라 정한 규칙이라 "가정" 을 달지 않는다 — 숫자가
  // 그대로 보인다. 추정인 건 최적 쪽이라 "예상 최적"
  const colorDesc = (lead: string, warn: string, bad: string, tail: string) => [
    lead ? (
      <Text key="l" dimColor>
        {lead}
      </Text>
    ) : null,
    <Text key="w" color="yellow">
      {warn}
    </Text>,
    <Text key="s" dimColor>
      ·
    </Text>,
    <Text key="b" color="red">
      {bad}
    </Text>,
    tail ? (
      <Text key="n" dimColor>
        {tail}
      </Text>
    ) : null,
  ]
  // 계산 값: 가정인 것만 "(가정)" — 잰 값의 출처까지 다 적으니 줄이 길었다
  const guess = L('(가정)', ' (assumed)')
  const guessMark = (src: Source | undefined) => (src === 'guess' ? guess : '')
  const calcLine =
    inputs && opt
      ? term(
          'cmp-inputs',
          L('계산 값', 'Inputs'),
          L(
            `${model} · 컴팩트 후 ${fmtTokens(inputs.after)}${guessMark(opt.src.after)} · 요청당 +${fmtTokens(opt.growth)}${opt.growthSrc === 'session' ? '' : guess}${opt.onceUsd !== null ? ` · 컴팩트 한 번 ${fmtUsd(opt.onceUsd)}${opt.src.output === 'guess' || opt.src.save === 'guess' ? guess : ''}` : ''}`,
            `${model} · after compact ${fmtTokens(inputs.after)}${guessMark(opt.src.after)} · +${fmtTokens(opt.growth)} per request${opt.growthSrc === 'session' ? '' : guess}${opt.onceUsd !== null ? ` · one compact ${fmtUsd(opt.onceUsd)}${opt.src.output === 'guess' || opt.src.save === 'guess' ? guess : ''}` : ''}`,
          ),
        )
      : null
  const starLine = inputs && opt ? term('cmp-how', L('★ 최적', '★ Best'), L('읽기 + 컴팩트 비용이 가장 적은 크기(공식 요율 · 이 세션 값)', 'Size with the lowest read + compact cost (official rates · this session)'), STAR_COLOR) : null
  const capLine = capNote ? term('cmp-cap', model, capNote.trim()) : null
  // 간단 화면의 풀이는 한 줄 — 비용 칸 · 계산 값은 자세히 화면에
  // 글은 키로 못 찾아(시험 · 다른 mod) 상자에 키를 단다
  const leanNote = (
    <Box key="cmp-lean" marginTop={1}>
      <Text dimColor wrap="wrap">
        {L('★ 최적 · 좋음 · 보통 · 비추천은 이 세션 값으로 판정합니다. 크기별 비용 · 계산 값은 자세히 화면에서.', '★ Best, good, fair and not advised are judged from this session. Costs per size and the inputs are on the Detailed screen.')}
      </Text>
    </Box>
  )
  // 질문 1개 풀이(자세히): 10회 가정 · 이 세션 실제 평균 요청 수로 센 100k ~ 1M 범위 — 숫자에 색
  const perQAll = opt?.perQuestion ?? null
  const qRange = (steps: number) => {
    const lo = usdAt(RANGE_ROWS[0]!, 'read')
    const hi = usdAt(RANGE_ROWS[RANGE_ROWS.length - 1]!, 'read')
    const extra = perQAll?.extraUsd ?? 0
    return lo === null || hi === null ? null : ([steps * (lo + extra), steps * (hi + extra)] as const)
  }
  const sessionQ = perQAll ? qRange(perQAll.steps) : null
  const qDesc = [
    <Text key="q-a" bold color={ACCENT}>
      {L(`요청 ${Q_STEPS}회 가정`, `${Q_STEPS} requests assumed`)}
    </Text>,
    <Text key="q-b" dimColor>
      {L(
        `× (그 크기 읽기${perQAll ? ` + 요청마다 새로 쓰기 · 출력 ~${fmtUsd(perQAll.extraUsd)}` : ''}) · 에이전트 빼고 · ${model} 요율 — 작업량과 상관없이 크기끼리 견주는 기준.`,
        `× (read at that size${perQAll ? ` + ~${fmtUsd(perQAll.extraUsd)} writes · output per request` : ''}) · agents excluded · ${model} rates — a fixed yardstick across sizes.`,
      )}
    </Text>,
    ...(perQAll && sessionQ
      ? [
          <Text key="q-c">{L('이 세션 질문은 평균', 'This session averages')}</Text>,
          <Text key="q-d" bold color="yellow">
            {L(`요청 ${perQAll.steps.toFixed(1)}회`, `${perQAll.steps.toFixed(1)} requests`)}
          </Text>,
          <Text key="q-e">{L(`→ 질문 1개 ${fmtTokens(RANGE_ROWS[0]!)} ~ ${fmtTokens(RANGE_ROWS[RANGE_ROWS.length - 1]!)}`, `→ one question at ${fmtTokens(RANGE_ROWS[0]!)} – ${fmtTokens(RANGE_ROWS[RANGE_ROWS.length - 1]!)}`)}</Text>,
          <Text key="q-f" bold color="yellow">
            {`${fmtUsd(sessionQ[0])} ~ ${fmtUsd(sessionQ[1])}`}
          </Text>,
        ]
      : []),
  ]

  let rows: unknown[]
  if (d.follow) {
    // 0~100만 비용표: 크기 띠마다 요청 1회 · 캐시 식으면 · 최적 대비를 "띠 시작 ~ 끝" 값으로. 띠(줄 앞 버튼)를 누르면 그
    // 띠가 컴팩트 구간 — 시작 · 끝 버튼 둘은 낯설었다. 지금 컨텍스트는 그 크기 자리에
    // "지금" 줄로 끼운다
    // ★ 최적 = 이 세션에서 비용이 가장 적은 크기(계산식 최적, optimal.ts)가 든 띠
    const starAt = opt?.at != null && inputs ? RANGE_BANDS.findIndex(([a, b]) => opt.at! >= a && opt.at! < b) : -1
    // 띠 버튼 이름 길이를 숫자 폭 공백(U+2007)으로 맞춘다 — 버튼 폭은 앱이 글 길이로 정해 "700k ~ 1M" 만 좁았고, ✓ 붙은
    // 버튼만 넓었다. 고른 줄은 ✓ 대신 줄 전체 테두리로
    const bandName = (a: number, b: number) => `${fmtTokens(a)} ~ ${fmtTokens(b)}`
    const nameLen = Math.max(...RANGE_BANDS.map(([a, b]) => bandName(a, b).length))
    const evenName = (name: string) => {
      const gap = nameLen - name.length
      return `${' '.repeat(Math.floor(gap / 2))}${name}${' '.repeat(Math.ceil(gap / 2))}`
    }
    // 터미널 버튼은 "[ ○ 이름 ]" 으로 그려져 이름보다 4칸 넓다 — 데스크톱 칸(15)이면 "]" 가 다음 줄로 넘어가 표가 깨졌다(2026-10-11 CLI)
    const BAND_W = isTerminal ? 2 + nameLen + 4 : 15
    // "+158~+254%" 가 9칸을 넘어 뒤 "비추천" 에 붙었다. 머리 "최적보다 더 듦" 이 들어가게 14
    const PEN_W = 14
    const USD_W = 11
    // 질문 1개(9b): 요청 10회로 가정 × (그 크기 읽기 + 요청마다 읽기 말고 드는 값). 0.4.0 은 이 세션 질문의 평균 요청 수 + 에이전트
    // 평균이라 큰 작업을 하면 값이 출렁여 크기 구간끼리 견주는 기준이 안 됐다. 읽기 말고 드는 값(새로 쓰기 ·
    // 출력)은 이 세션 실측 — 아직 못 쟀으면 읽기만. 에이전트는 뺀다(작업마다 다르다). 이 세션의 실제 평균 요청 수로 센 값은
    // 풀이 줄에 100k ~ 1M 범위로(색)
    const Q_W = 15
    const perQ = opt?.perQuestion ?? null
    const qExtra = perQ?.extraUsd ?? 0
    const qAt = (size: number) => {
      const read = usdAt(size, 'read')
      return read !== null ? Q_STEPS * (read + qExtra) : null
    }
    // 줄 하나가 카드 안에 들게 열을 뺀다 — 터미널은 칸, 데스크톱은 ch(1칸 = 1ch, 렌더러 보정 2026-10-14). 예전엔 데스크톱은 늘 든다고
    // 봐(fits 늘 true) 75칸 패널에서 줄이 넘쳤고, 마지막 "적용 중" 칸이 한 글자 폭까지 줄어 세로로 섰다(fb A2). "적용 중" 칸은 없앴다 —
    // 카드 맨 위 "적용 중" 줄이 같은 말을 한다. 빼는 순서(2026-10-14 uxi 1.1): 최적보다 더 듦(판정 말이 요약) → 캐시 식으면 → 질문 1개 →
    // 읽기 1회. 드는지: 카드 안 폭(테두리 · 여백 4) − 줄 테두리 2
    const tailW = Math.max(widthOf(L('★ 최적', '★ Best'), isTerminal), widthOf(penVerdict(PEN_BAD_PCT + 1)!.word, isTerminal))
    const fits = (w: number) => cols === null || cols - CARD_INSET - 2 >= w
    const gapsOf = (n: number) => n - 1
    const rowW = (withRead: boolean, withQ: boolean, withCold: boolean, withPen: boolean) => {
      const cells = [BAND_W, withRead ? USD_W : 0, withQ ? Q_W : 0, withCold ? USD_W : 0, withPen ? PEN_W : 0, tailW].filter(x => x > 0)
      return cells.reduce((sum, x) => sum + x, 0) + gapsOf(cells.length)
    }
    const showPen = !isLean && fits(rowW(true, true, true, true))
    const showCold = !isLean && fits(rowW(true, true, true, false))
    const showQ = !isLean && fits(rowW(true, true, false, false))
    const showRead = !isLean && fits(rowW(true, false, false, false))
    const usd2 = (x: number | null, y: number | null) => (x === null || y === null ? '—' : `${fmtUsd(x)}~${fmtUsd(y).slice(1)}`)
    // 고른 줄은 둥근 테두리, 나머지는 같은 자리만큼 안쪽 여백 — 칸이 어긋나지 않게
    const rowBox = (isOn: boolean) => (isOn ? { borderStyle: 'round' as const, borderColor: ACCENT } : { paddingX: 1 })
    const head = (
      <Box key="cmp-t-head" columnGap={1} marginTop={1} paddingX={1}>
        {cell('h-band', BAND_W, <Text dimColor>{L('크기 구간', 'Size range')}</Text>)}
        {showRead ? cell('h-read', USD_W, <Text dimColor>{L('읽기 1회', 'One read')}</Text>) : null}
        {showQ ? cell('h-q', Q_W, <Text dimColor wrap="wrap">{L(`질문 1개(${Q_STEPS}회 가정)`, `Question (${Q_STEPS} req assumed)`)}</Text>) : null}
        {showCold ? cell('h-cold', USD_W, <Text dimColor>{L('캐시 식으면', 'Cold cache')}</Text>) : null}
        {showPen ? cell('h-pen', PEN_W, <Text dimColor>{L('최적보다 더 듦', 'Over best')}</Text>) : null}
      </Box>
    )
    const bandRows = RANGE_BANDS.map(([a, b], i) => {
      const isOn = d.rangeStart === a && d.rangeEnd === b
      const pens = penOf(a) === null || penOf(b) === null ? '—' : `${pctText(penOf(a))}~${pctText(penOf(b))}%`
      // 색은 띠 시작의 최적 대비로(그 구간에서 가장 일찍 해도 이만큼 더 든다) — 달러 칸까지 칠하면 표가 알록달록해진다
      const penColor = penColorOf(penOf(a))
      const verdict = penVerdict(penOf(a))
      return (
        <Box key={`cmp-t-${a}`} columnGap={1} alignItems="center" {...rowBox(isOn)}>
          {cell(
            'band',
            BAND_W,
            // 앞에 고르기 표시(○ · 고른 줄 ◉) — 이름만 있으니 누르는 버튼처럼 안 느껴졌다
            <Button
              key={`cmp-band-${a}`}
              label={`${isOn ? '◉' : '○'} ${evenName(bandName(a, b))}`}
              variant={isOn ? 'primary' : 'secondary'}
              {...(isOn ? {} : { dimColor: true })}
              onPress={() => edit({ ...d, rangeStart: a, rangeEnd: b })}
            />,
          )}
          {showRead ? cell('read', USD_W, <Text bold={isOn} dimColor={!isOn}>{usd2(usdAt(a, 'read'), usdAt(b, 'read'))}</Text>) : null}
          {showQ ? cell('q', Q_W, <Text bold={isOn} dimColor={!isOn}>{usd2(qAt(a), qAt(b))}</Text>) : null}
          {showCold ? cell('cold', USD_W, <Text bold={isOn} dimColor={!isOn}>{usd2(usdAt(a, 'write1h'), usdAt(b, 'write1h'))}</Text>) : null}
          {showPen ? cell('pen', PEN_W, <Text bold={isOn} dimColor={!isOn && !penColor} {...(penColor ? { color: penColor } : {})}>{pens}</Text>) : null}
          {/* 최적이 든 띠엔 금색 "★ 최적" — 흐린 ★ 하나는 눈에 안 띄었다. 나머지는 판정 말(좋음 · 보통 · 비추천) */}
          {i === starAt ? (
            <Text key="star" bold color={STAR_COLOR}>
              {L('★ 최적', '★ Best')}
            </Text>
          ) : verdict ? (
            <Text key="verdict" color={verdict.color}>
              {verdict.word}
            </Text>
          ) : null}
          {/* "적용 중" 칸은 없앴다 — 줄 끝 칸이 한 글자 폭까지 줄어 세로로 섰다(fb A2). 적용 중인 구간은 카드 제목 띠(늘)와 고르는
              동안의 "A → B 로 바꿀까요?" 줄이 말한다(2026-10-14 uxi 1.1) */}
        </Box>
      )
    })
    // 추천 · 비추천: 표 바로 아래 두 줄, 이름 칸에 색(★ 금색 · 빨강) — 풀이는 보통 글(흐리면 안 읽힌다)
    // 추천 = 최적이 든 띠. 고른 띠가 그 띠면 맞다고, 아니면 [◉ 이 구간 고르기]
    const starBand = starAt >= 0 ? RANGE_BANDS[starAt]! : null
    const isStarOn = starBand !== null && d.rangeStart === starBand[0] && d.rangeEnd === starBand[1]
    const recommend =
      starBand && opt?.at != null
        ? term(
            'cmp-recommend',
            L('★ 추천', '★ Suggested'),
            isStarOn
              ? [<Text key="t">{L(`고른 구간에 최적(${fmtTokens(opt.at)})이 있습니다`, `The chosen range contains the best size (${fmtTokens(opt.at)})`)}</Text>]
              : [
                  <Text key="b" bold>
                    {bandName(starBand[0], starBand[1])}
                  </Text>,
                  <Text key="t">{L(`최적(${fmtTokens(opt.at)})이 든 구간`, `the range with the best size (${fmtTokens(opt.at)})`)}</Text>,
                  // 띠 버튼과 같은 고르기 표시 — "이 구간으로" 만으론 버튼처럼 안 생겼다
                  <Button key="cmp-recommend-pick" label={L('◉ 이 구간 고르기', '◉ Pick this range')} variant="secondary" onPress={() => edit({ ...d, rangeStart: starBand[0], rangeEnd: starBand[1] })} />,
                ],
            STAR_COLOR,
          )
        : null
    // 비추천: 최적 대비가 PEN_BAD_PCT 를 넘는 띠(이 세션 값) — 고정 크기(40만 등) 대신 세션 사실로. 최적 위는 "N 이상",
    // 최적 아래(너무 잦음)는 그 띠 이름으로 — 첫 비추천 띠만 보고 "100k 이상" 이라 적어 모든 띠가 비추천으로 읽혔다.
    // 70만 ~ 100만은 자동 컴팩트(1M 창이면 약 96.7만)가 돌기 직전이라 고를 일이 거의 없다
    const highBad = RANGE_BANDS.find(([a], i) => i > starAt && isNotRecommended(penOf(a)))
    const lowBad = RANGE_BANDS.filter(([a], i) => i < starAt && isNotRecommended(penOf(a)))
    const badParts = [
      lowBad.length > 0 ? `${fmtTokens(lowBad[0]![0])} ~ ${fmtTokens(lowBad[lowBad.length - 1]![1])}` : null,
      highBad ? L(`${fmtTokens(highBad[0])} 이상`, `${fmtTokens(highBad[0])} and up`) : null,
    ].filter((p): p is string => p !== null)
    const notRecommended =
      badParts.length > 0 && !isLean
        ? term(
            'cmp-not-recommended',
            L('비추천', 'Not advised'),
            [
              <Text key="t" wrap="wrap">
                {L(
                  `${badParts.join(' · ')} — 최적보다 요청당 +${PEN_BAD_PCT}% 넘게${highBad ? ' · 700k ~ 1M 은 자동 컴팩트(약 967k) 직전' : ''}`,
                  `${badParts.join(' · ')} — over +${PEN_BAD_PCT}% per request vs best${highBad ? ' · 700k – 1M is right before auto-compact (~967k)' : ''}`,
                )}
              </Text>,
            ],
            'red',
          )
        : null
    rows = [
      appliedRow,
      modeRow,
      head,
      ...bandRows,
      recommend || notRecommended ? (
        <Box key="cmp-advice" flexDirection="column" marginTop={1}>
          {recommend}
          {notRecommended}
        </Box>
      ) : null,
      applyArea,
      isLean ? leanNote : (
      <Box key="cmp-legend" flexDirection="column" marginTop={1}>
        {term('cmp-range-how', L('최적보다', 'Over best'), [
          <Text key="l" dimColor>
            {L('예상 최적보다 요청당 더 드는 비율 ·', 'Extra cost per request vs the estimated best ·')}
          </Text>,
          <Text key="g" color="green">{L(`+${PEN_WARN_PCT}%까지 좋음`, `up to +${PEN_WARN_PCT}% good`)}</Text>,
          <Text key="s1" dimColor>
            ·
          </Text>,
          <Text key="y" color="yellow">{L(`+${PEN_BAD_PCT}%까지 보통`, `up to +${PEN_BAD_PCT}% fair`)}</Text>,
          <Text key="s2" dimColor>
            ·
          </Text>,
          <Text key="r" color="red">
            {L('넘으면 비추천', 'beyond: not advised')}
          </Text>,
        ])}
        {term('cmp-read', L('읽기 1회', 'One read'), L('그 크기를 캐시에서 한 번 읽는 값(새로 쓰기 · 출력 빼고)', 'reading that size from cache once (no writes or output)'))}
        {showQ ? term('cmp-q', L(`질문 1개`, `Question`), qDesc) : null}
        {showCold
          ? term(
              'cmp-cold',
              L('캐시 식으면', 'Cold cache'),
              (opt?.shared ?? 0) > 0
                ? L(`${ttlName(ttl)} 넘게 쉬어 다시 쓰기(공통 앞부분 ${fmtTokens(opt!.shared!)} 은 읽기)`, `idle over ${ttlName(ttl)}, rewritten (the shared ${fmtTokens(opt!.shared!)} prefix is read)`)
                : L(`${ttlName(ttl)} 넘게 쉬어 전부 다시 쓰기`, `idle over ${ttlName(ttl)}, everything rewritten`),
            )
          : null}
        {starLine}
        {calcLine}
        {capLine}
        {term(
          'cmp-range-src',
          L('기본 구간', 'Default range'),
          L(`${fmtTokens(DEFAULT_SETTINGS.rangeStart)} ~ ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)}(처음 설치 값)`, `${fmtTokens(DEFAULT_SETTINGS.rangeStart)} – ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)} (initial value)`),
        )}
      </Box>
      ),
    ]
  } else {
    // 크기는 입력칸에 써서(30만 · 300k · 300000) — ◀ ▶ 는 5만 칸이라 원하는 값까지 여러 번 눌러야 했다. 치는 글은 sizeText 에 두고, Enter(넣기)를 누르면 크기로 읽어 바꾼 값에 넣는다
    const sizeText = d.sizeText ?? fmtTokens(d.compactAt)
    const typedSize = d.sizeText === undefined ? null : parseTokens(d.sizeText)
    const isBadSize = d.sizeText !== undefined && typedSize === null
    // 치는 동안 어떤 크기로 읽었는지 · 범위 밖이면 어디로 맞추는지 — 말없이 10만 · 100만으로 맞추면 안 들어간 줄 알았다
    const fitted = typedSize === null ? null : setCompactAt(s, typedSize).compactAt
    const sizeHint = isBadSize
      ? L('크기로 못 읽었습니다(예: 40만 · 400k · 1M)', 'Not a size (e.g. 400k · 1M)')
      : fitted === null
        ? L('10만 ~ 100만', '100k – 1M')
        : fitted !== typedSize
          ? L(`= ${fmtTokens(fitted)}(10만 ~ 100만 안으로 맞춤)`, `= ${fmtTokens(fitted)} (clamped to 100k – 1M)`)
          : `= ${fmtTokens(fitted)}`
    const sizeRow = (
      <Box key="cmp-row" columnGap={1} alignItems="center" flexWrap="wrap">
        <Text>{L('크기', 'Size')}</Text>
        <Box width={16} flexShrink={0}>
          <Input
            key="cmp-size-input"
            placeholder={L('예) 30만 · 300k', 'e.g. 300k')}
            value={sizeText}
            submitLabel={L('넣기', 'Set')}
            onInput={v => edit({ ...d, sizeText: v })}
            onSubmit={v => {
              const n = parseTokens(v)
              if (n !== null) edit({ ...d, compactAt: setCompactAt(s, n).compactAt, sizeText: undefined })
            }}
          />
        </Box>
        <Text dimColor={!isBadSize && fitted === typedSize} {...(isBadSize ? { color: 'red' } : fitted !== typedSize ? { color: 'yellow' } : {})}>
          {sizeHint}
        </Text>
      </Box>
    )
    // 직접 정한 크기의 대가: 최적보다 요청당 몇 % 더 드나 — % 에 최적 대비 색
    const pen = penOf(dt.ctxCut)
    const pct = pen === null ? null : Math.round(pen)
    const status =
      opt?.at != null && pct !== null ? (
        <Box key="cmp-status" columnGap={1} flexWrap="wrap">
          <Text>
            {pct >= 1
              ? L(`최적 ${fmtTokens(opt.at)}보다 요청당`, `Per request vs best ${fmtTokens(opt.at)}:`)
              : L(`최적 ${fmtTokens(opt.at)} — 차이 거의 없음`, `Best ${fmtTokens(opt.at)} — almost no difference`)}
          </Text>
          {pct >= 1 ? (
            <Text bold {...(penColorOf(pen) ? { color: penColorOf(pen) } : {})}>
              {L(`+${pct}% 더 듦`, `+${pct}% more`)}
            </Text>
          ) : null}
          {/* 판정 말(좋음 · 보통 · 비추천). 비추천은 알리기만 — 적용은 막지 않는다 */}
          {pct >= 1 && penVerdict(pen) ? (
            <Text bold color={penVerdict(pen)!.color}>
              {penVerdict(pen)!.color === 'red' ? L('· 비추천(적용은 됩니다)', '· not advised (still applies)') : `· ${penVerdict(pen)!.word}`}
            </Text>
          ) : null}
        </Box>
      ) : inputs && dt.ctxCut <= inputs.after ? (
        <Text key="cmp-status" wrap="wrap" color="yellow">
          {L(`컴팩트 후 크기(${fmtTokens(inputs.after)})보다 작아 컴팩트해도 줄지 않습니다`, `Smaller than the post-compact size (${fmtTokens(inputs.after)}), so compacting would not shrink it`)}
        </Text>
      ) : null
    rows = [
      appliedRow,
      modeRow,
      sizeRow,
      status,
      applyArea,
      isLean ? leanNote : (
      <Box key="cmp-legend" flexDirection="column" marginTop={1}>
        {term(
          'cmp-warn',
          L('색', 'Colors'),
          colorDesc(
            '',
            L(`${fmtTokens(dt.ctxWarn)}부터 노랑`, `yellow from ${fmtTokens(dt.ctxWarn)}`),
            L(`${fmtTokens(dt.ctxCut)}부터 빨강`, `red from ${fmtTokens(dt.ctxCut)}`),
            L(`(노랑 = 정한 크기의 ${Math.round(WARN_RATIO * 100)}%)`, `(yellow = ${Math.round(WARN_RATIO * 100)}% of the set size)`),
          ),
        )}
        {starLine}
        {calcLine}
        {capLine}
      </Box>
      ),
    ]
  }

  // 칸마다 접기(제목 줄 맨 앞 ▸ / ▾): 접으면 제목 줄에 지금 값만 — 설정 탭이 길어져 훑기 어려웠다. 처음엔
  // 컴팩트 시점 · 문구만 펼침, 캐시 경고는 한 줄이라 접지 않는다. 펼치면 제목 옆은 원래 설명. 펼친 칸은 세션마다(settingsOpen)
  const fold = (k: string): Fold => ({ isOpen: open[k] === true, onToggle: () => act.toggleFold(k) })
  const summary = (k: string, folded: unknown, opened?: unknown) => (open[k] === true ? opened : folded)

  // 컴팩트 시점은 테두리 카드로 한 덩어리 — 표 · 적용이 설정의 다른 글과 섞여 보였다
  const compactSection = section(
    ui,
    'set-compact',
    L('컴팩트 시점', 'Compact timing'),
    rows,
    summary('compact', appliedText, L(`적용 중 ${appliedText}`, `Applied: ${appliedText}`)),
    true,
    undefined,
    fold('compact'),
  )
  // 캐시: 유지 시간은 엔진이 요청마다 정한다(구독 요금제 사용량 안 1시간, API 키 · 사용량 초과 5분 —
  // 공식 문서 기본값, promptCacheTtl 설정 · 환경 변수로 바뀜). 기록에서 잰 값을 보이고, 못 쟀으면 "추정". 경고는 유지 시간마다
  // 따로(5분 캐시에 10분 경고면 늘 노랑). 유지 시간 바꾸기는 커스텀에서만 — 잘 모르고 바꾸면 손해만 본다
  const cfg = cache?.config ?? null
  const srcText = !cfg
    ? L('자동(구독 요금제 사용량 안 1시간 · API 키 · 사용량 초과 5분)', 'automatic (1 h within a subscription plan · 5 min on an API key or over the plan)')
    : cfg.source === 'force5m'
      ? L('환경 변수 FORCE_PROMPT_CACHING_5M(5분 고정)', 'env FORCE_PROMPT_CACHING_5M (5 min forced)')
      : cfg.source === 'env'
        ? L(`환경 변수 CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`, `env CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`)
        : cfg.source === 'setting'
          ? L(`설정 promptCacheTtl = ${cfg.value}`, `setting promptCacheTtl = ${cfg.value}`)
          : cfg.source === 'enable1h'
            ? L('환경 변수 ENABLE_PROMPT_CACHING_1H(1시간)', 'env ENABLE_PROMPT_CACHING_1H (1 h)')
            : L('자동(구독 요금제 사용량 안 1시간 · API 키 · 사용량 초과 5분)', 'automatic (1 h within a subscription plan · 5 min on an API key or over the plan)')
  // 환경 변수가 정하면 설정 파일을 바꿔도 안 먹는다(엔진 순서) — 버튼 대신 까닭
  const isEnvFixed = cfg?.source === 'force5m' || cfg?.source === 'env'
  // 캐시 칸의 이름들
  termW = nameColW([
    L('지금', 'Now'),
    L('이 세션에선', 'Here'),
    L('유지 시간', 'Lifetime'),
    L('정하는 곳', 'Set by'),
    L('1시간 캐시', '1 hour cache'),
    L('5분 캐시', '5 min cache'),
    L('바꾸기', 'Change'),
    L('지금 크기', 'Now'),
  ])
  const warnRow = (key: string, forTtl: number) => {
    const v = forTtl < 60 ? s.cacheWarnMin5m : s.cacheWarnMin
    const isNow = forTtl === (ttl < 60 ? 5 : 60)
    return (
      <Box key={key} columnGap={1} alignItems="center">
        {cell('t', termW, <Text {...(isNow ? { bold: true } : { dimColor: true })}>{L(`${ttlName(forTtl)} 캐시`, `${ttlName(forTtl)} cache`)}</Text>)}
        <Button key={`${key}-down`} label="−" variant="secondary" onPress={() => save(nudgeCache(s, -1, forTtl))} />
        <Box width={5} flexShrink={0} justifyContent="center">
          <Text bold={isNow}>{L(`${v}분`, `${v} min`)}</Text>
        </Box>
        <Button key={`${key}-up`} label="+" variant="secondary" onPress={() => save(nudgeCache(s, 1, forTtl))} />
        <Box flexShrink={1} minWidth={0}>
          <Text dimColor wrap="wrap">
            {L(`남으면 노랑${isNow ? ' · 지금 이 세션' : ''}`, `left turns yellow${isNow ? ' · this session' : ''}`)}
          </Text>
        </Box>
      </Box>
    )
  }
  // 지금 크기를 다시 쓰는 값(복구 값)을 유지 시간마다 — 대가가 숫자로 보이게
  const rNow = ctxNow !== null && ctxNow > 0 && modelId ? ratesFor(modelId, ctxNow) : null
  const ttlPicks = (
    <Box key="ttl-picks" columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center">
      {s.screen !== 'custom' ? (
        <Text dimColor wrap="wrap">
          {L('바꾸기는 화면 → 커스텀에서(모르고 바꾸면 손해라 프리셋에선 막아 둠)', 'Change it under Screen → Custom (locked in presets — changing it blindly costs money)')}
        </Text>
      ) : isEnvFixed ? (
        <Text color="yellow" wrap="wrap">
          {L('환경 변수가 정해 여기서 못 바꿉니다', 'An environment variable decides it, so it cannot be changed here')}
        </Text>
      ) : cfg?.userFile ? (
        [
          pick('ttl-auto', L('자동', 'Automatic'), cfg.userSetting === null, () => act.setTtl(null)),
          pick('ttl-1h', L('1시간', '1 hour'), cfg.userSetting === '1h', () => act.setTtl('1h')),
          pick('ttl-5m', L('5분', '5 min'), cfg.userSetting === '5m', () => act.setTtl('5m')),
        ]
      ) : (
        <Text dimColor>{L('설정 파일을 못 찾아 못 바꿉니다', 'Settings file not found, so it cannot be changed')}</Text>
      )}
    </Box>
  )
  // 지금 이 세션의 캐시 — 정보량 최소면 이 한 줄만. 노랑 기준을 넘었으면 노랑, 식었으면 빨강
  const minsLeft = cache?.minsLeft ?? null
  const isLateNow = minsLeft !== null && minsLeft < cacheWarnFor(s, ttl)
  const stateText = cache?.isCold
    ? L('캐시 만료 — 다음 요청이 대화 전체를 다시 씁니다', 'Cache expired — the next request rewrites the whole conversation')
    : minsLeft !== null
      ? L(`캐시 만료까지 ${minsLeft}분 남음`, `Cache expires in ${minsLeft} min`)
      : L('첫 요청 뒤부터 잽니다', 'Measured after the first request')
  const stateRow = term('cache-state', L('지금', 'Now'), [
    <Text key="s" bold {...(cache?.isCold ? { color: 'red' } : isLateNow ? { color: 'yellow' } : {})}>
      {stateText}
    </Text>,
    isLean ? (
      <Text key="t" dimColor>
        {L(`· ${ttlName(ttl)} 캐시${cache?.measured ? '' : ' 추정'}`, `· ${ttlName(ttl)} cache${cache?.measured ? '' : ' (est.)'}`)}
      </Text>
    ) : null,
  ])
  // 정보량 전부: 이 세션 숫자로 무엇인지 · 넘기면 얼마인지 · 그때 누가 알려 주는지
  const readNow = ctxNow !== null && ctxNow > 0 ? usdAt(ctxNow, 'read') : null
  const rewriteNow = rNow ? (ctxNow! * writeRate(rNow, ttl)) / 1e6 : null
  const whyRow = term(
    'cache-why',
    L('이 세션에선', 'Here'),
    readNow !== null && rewriteNow !== null
      ? L(
          `Claude 가 이 대화(${fmtTokens(ctxNow!)})를 ${ttlName(ttl)} 기억합니다. 그 안에 다음 질문을 보내면 캐시에서 읽어 요청당 ~${fmtUsd(readNow)}, 넘기면 전체를 다시 써 ~${fmtUsd(rewriteNow)} 가 한 번 더 듭니다. 그때 바로 컴팩트할지는 바 · 이지 컴팩트 버튼이 알려 줍니다.`,
          `Claude keeps this conversation (${fmtTokens(ctxNow!)}) for ${ttlName(ttl)}. Ask again within it and it is read from cache at ~${fmtUsd(readNow)} per request; after it, rewriting everything costs ~${fmtUsd(rewriteNow)} once. The bar and the Easy Compact button then tell you whether to compact right away.`,
        )
      : L(
          `Claude 가 이 대화를 ${ttlName(ttl)} 기억합니다. 그 안에 다음 질문을 보내면 싸게 읽고, 넘기면 대화 전체를 다시 써 비쌉니다. 그때 바로 컴팩트할지는 바 · 이지 컴팩트 버튼이 알려 줍니다.`,
          `Claude keeps this conversation for ${ttlName(ttl)}. Ask again within it and it is read cheaply; after it, the whole conversation is rewritten at a higher price. The bar and the Easy Compact button then tell you whether to compact right away.`,
        ),
  )
  const cacheSection = section(
    ui,
    'set-cache',
    L('캐시', 'Cache'),
    [
      stateRow,
      isLean ? null : whyRow,
      isLean ? null : term(
        'cache-ttl',
        L('유지 시간', 'Lifetime'),
        [
          <Text key="v" bold>
            {ttlName(ttl)}
          </Text>,
          <Text key="m" dimColor>
            {cache?.measured ? L('(이 세션 기록에서 잼)', '(measured from this session)') : L('(추정 — 첫 요청 뒤 기록으로 잽니다)', '(estimated — measured after the first request)')}
          </Text>,
        ],
      ),
      // 정보량 최소면 위 "지금" 한 줄만 — 유지 시간 · 정하는 곳 · 노랑 기준 · 바꾸기 · 대가 풀이는 정보량 전부에서
      isLean ? null : term('cache-src', L('정하는 곳', 'Set by'), srcText),
      isLean ? null : (
        <Box key="cache-warns" flexDirection="column" marginTop={1}>
          {warnRow('cache', 60)}
          {warnRow('cache5', 5)}
        </Box>
      ),
      isLean ? null : <Box key="cache-change" flexDirection="column" marginTop={1}>
        {term('cache-pick', L('바꾸기', 'Change'), [ttlPicks])}
        {term('cache-1h', L('1시간', '1 hour'), L('쓰기가 입력 요율의 2배 · 1시간 안에 돌아오면 다시 안 씀', 'writes cost 2× input · no rewrite if you are back within an hour'))}
        {term('cache-5m', L('5분', '5 min'), L('쓰기 1.25배 · 5분 넘게 쉬면 컨텍스트 전체를 다시 씀', 'writes cost 1.25× · a break over 5 min rewrites the whole context'))}
        {rNow
          ? term(
              'cache-now',
              L('지금 크기', 'Now'),
              L(
                `${fmtTokens(ctxNow!)} 를 다시 쓰면 1시간 ${fmtUsd((ctxNow! * writeRate(rNow, 60)) / 1e6)} · 5분 ${fmtUsd((ctxNow! * writeRate(rNow, 5)) / 1e6)}`,
                `rewriting ${fmtTokens(ctxNow!)}: 1 h ${fmtUsd((ctxNow! * writeRate(rNow, 60)) / 1e6)} · 5 min ${fmtUsd((ctxNow! * writeRate(rNow, 5)) / 1e6)}`,
              ),
            )
          : null}
      </Box>,
    ].filter(Boolean),
    summary(
      'cache',
      isLean
        ? L(`${ttlName(ttl)} 캐시 · ${stateText}`, `${ttlName(ttl)} cache · ${stateText}`)
        : L(`${ttlName(ttl)} 캐시 · ${cacheWarnFor(s, ttl)}분 남으면 노랑`, `${ttlName(ttl)} cache · yellow at ${cacheWarnFor(s, ttl)} min left`),
    ),
    true,
    undefined,
    fold('cache'),
  )

  // 문구는 버튼 넷(프리셋 셋 + 직접) — 직접을 고르면 아래에 한 줄 입력칸, Enter 로 저장.
  // 아래엔 "언제 쓰나" 한 줄과, 누르면 일어나는 일을 단계로: ① 잃을 정보 확인 → ② 저장 → ③ 답 → ④ 컴팩트. ①④ 는 어느 문구든
  // 같아 흐리게, 문구마다 다른 ②③ 만 보통 글 — 차이가 한눈에 보인다. 보내는 글 원문은 접어 둔다: 모델이 읽으라고 쓴 글이라
  // 사람이 머릿속에서 풀어야 했다. 직접은 쓴 글이 곧 원문이라 늘 펼친다
  const isCustom = s.tidy === 'custom'
  const steps = tidySteps(s)
  const use = !isCustom
    ? tidyStyles()[s.tidy as TidyStyleId].use
    : usesCustom(s)
      ? customUse()
      : L(`${customUse()} 비어 있으면 일반 문구를 보냅니다.`, `${customUse()} While empty, the Normal text is sent.`)
  // 단계 이름 칸 = 가장 긴 "④ 컴팩트" + 1(예전 9칸 고정)
  const stepW = nameColW([`① ${L('확인', 'Check')}`, `② ${L('저장', 'Save')}`, `③ ${L('답', 'Reply')}`, `④ ${L('컴팩트', 'Compact')}`])
  const step = (key: string, mark: string, name: string, text: string, isFixed: boolean) => (
    <Box key={key} columnGap={1}>
      <Box width={stepW} flexShrink={0}>
        <Text {...(isFixed ? { dimColor: true } : { color: 'cyan' })}>{`${mark} ${name}`}</Text>
      </Box>
      <Box flexShrink={1} minWidth={0}>
        <Text wrap="wrap" {...(isFixed ? { dimColor: true } : {})}>
          {text}
        </Text>
      </Box>
    </Box>
  )
  const showRaw = isCustom || rawOpen
  const tidy = section(ui, 'set-tidy', L('컴팩트 문구', 'Compact text'), [
    <Box key="tidy-row" columnGap={1} rowGap={1} flexWrap="wrap">
      {TIDY_IDS.map(id => pick(`tidy-${id}`, tidyStyles()[id].name, s.tidy === id, () => save(chooseTidy(s, id))))}
      {pick('tidy-custom', customName(), isCustom, () => save(chooseTidy(s, customName())))}
    </Box>,
    isCustom ? (
      <Box key="tidy-input-row" marginTop={1}>
        <Input
          key="tidy-input"
          placeholder={L('예) 결정한 것만 메모리에 남기고 이어서 할 일 3줄', 'e.g. save only decisions to memory, then 3 lines of next steps')}
          value={draft ?? s.tidyCustom}
          submitLabel={L('저장', 'Save')}
          onInput={v => act.typeTidy(v)}
          onSubmit={v => act.saveTidy(v)}
        />
      </Box>
    ) : null,
    <Text key="tidy-use" wrap="wrap">
      {use}
    </Text>,
    // 간단은 문구 고르기와 언제 쓰나 한 줄만 — 단계 풀이 · 보내는 글 전체는 자세히 · 커스텀에서
    isLean ? null : <Box key="tidy-flow" flexDirection="column" marginTop={1}>
      <Text>{L('[저장하고 컴팩트]를 누르면', 'When you press [Save & compact]')}</Text>
      {step('tidy-s1', '①', L('확인', 'Check'), L('세션이 컴팩트하면 잃을 정보가 있는지 봅니다(비용은 mod 가 이미 따짐). 있으면 멈추고 알림', 'The session checks whether compacting would lose information it needs (the mod has already weighed the cost). If so, it stops and tells you'), true)}
      {step('tidy-s2', '②', L('저장', 'Save'), steps.keep, false)}
      {step('tidy-s3', '③', L('답', 'Reply'), steps.reply, false)}
      {step('tidy-s4', '④', L('컴팩트', 'Compact'), L('③의 답은 요약에 그대로 남김', 'the reply in ③ is kept in the summary as is'), true)}
    </Box>,
    // 직접은 늘 펼쳐 접기 버튼이 없다
    isCustom || isLean ? null : (
      <Box key="tidy-raw-row" marginTop={1}>
        <Button key="tidy-raw" label={`${rawOpen ? '▾' : '▸'} ${L('보내는 글 전체', 'Full text sent')}`} variant="secondary" onPress={onToggleRaw} />
      </Box>
    ),
    // 보내는 글 전체: 세션에 보내는 글 그대로(tidyPrompt) + 이어서 /compact 에 붙이는 지시. 가운데만 보이고 앞뒤를 "늘 붙음"
    // 으로 줄이면 전체도 아니고 단계 보기와 겹쳐 사족이었다. 고른 문구 줄만 청록, 글은 보통 색(흐린 글은 데스크톱
    // 어두운 배경에서 안 읽혔다)
    showRaw && !isLean ? (
      <Box key="tidy-script" flexDirection="column" marginTop={1} {...CARD}>
        {tidyScript(s).map((l, i) => (
          <Text key={`tidy-line-${i}`} wrap="wrap" {...(l.isBody ? { color: 'cyan' } : {})}>
            {l.text}
          </Text>
        ))}
      </Box>
    ) : null,
  ], summary('tidy', isCustom ? customName() : tidyStyles()[s.tidy as TidyStyleId].name), true, undefined, fold('tidy'))

  // ── 화면: 프리셋 넷 — 간단(컴팩트만 아는 처음 쓰는 사람) · 기본(지향하는 화면) · 자세히(지표 최대) ·
  // 커스텀(다 고름). 프리셋의 세부는 보기만 — 버튼 대신 글(✓ · ·)이라 눌러지지 않는다. 커스텀에선 같은 자리가 버튼.
  // 창 상태(바 크기 · 접기 · 컴팩트할 때 펴기 · 패널 열기)는 프리셋과 따로 "바 · 패널" 칸 — 바의 창 버튼과 같은 값이라 어느
  // 화면에서든 바꾼다. 컴팩트 기준엔 프리셋이 없다(개인 기록 기반이라 없앤 것 — 공식 계산 · 표시만)
  const view = viewOf(s)
  const isCustomScreen = s.screen === 'custom'
  // 커스텀이면 고르기 버튼, 프리셋이면 같은 이름을 글로(✓ 켬 · · 끔)
  const choose = (key: string, label: string, isOn: boolean, onPress: () => void) =>
    isCustomScreen ? (
      pick(key, label, isOn, onPress)
    ) : (
      // 글은 키로 못 찾아(시험 · 다른 mod) 상자에 키를 단다
      <Box key={key}>
        <Text {...(isOn ? {} : { dimColor: true })}>{`${isOn ? '✓' : '·'} ${label}`}</Text>
      </Box>
    )
  const editV = (change: (v: ScreenView) => ScreenView) => save(editView(s, change))
  // 한도 줄은 화면과 따로 — 아래 "한도 줄" 칸
  const groups = [
    { id: 'cost', name: L('비용 줄', 'Cost row') },
    { id: 'turn', name: L('질문 줄', 'Question row') },
  ] as const
  // 화면 칸 세부의 이름들
  termW = nameColW([L('정보량', 'Detail level'), L('비용 줄', 'Cost row'), L('질문 줄', 'Question row'), L('한도 줄', 'Limits row'), L('세션 금액 색', 'Session cost'), L('모든 세션', 'All sessions'), L('질문 강조', 'Highlight')])
  const detailRow = (key: string, name: string, picks: unknown, gap = 1) =>
    stacked() ? (
      <Box key={key} flexDirection="column" marginTop={gap}>
        <Text>{name}</Text>
        <Box columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center">
          {picks}
        </Box>
      </Box>
    ) : (
      <Box key={key} columnGap={1} alignItems={isTerminal ? 'flex-start' : 'center'} marginTop={gap}>
        {cell('t', termW, <Text>{name}</Text>)}
        <Box flexShrink={1} minWidth={0} columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center">
          {picks}
        </Box>
      </Box>
    )
  // 줄 이름 칸 아래 풀이 글은 고르기 버튼과 같은 자리에서 시작 — 이름 칸 밑에서 시작해 줄이 안 맞아 보였다.
  // 이름을 위에 쌓았으면 들이지 않는다
  const useLine = (key: string, text: string) => (
    <Box key={key} paddingLeft={stacked() ? 0 : termW + 1}>
      <Text dimColor wrap="wrap">
        {text}
      </Text>
    </Box>
  )
  const partRows = groups.map(g =>
    detailRow(
      `band-g-${g.id}`,
      g.name,
      BAND_PARTS.filter(p => p.group === g.id).map(p => {
        const k = p.key as keyof CostShow
        return choose(`show-${k}`, bandPartName(k), view.bandShow[k], () => editV(v => ({ ...v, bandShow: { ...v.bandShow, [k]: !v.bandShow[k] } })))
      }),
    ),
  )
  // ── 모든 화면 공통(세부 아래): 한도 줄 · 세션 금액 색
  const limitsOn = s.limitShow.fiveHour || s.limitShow.sevenDay
  const colorNames = [
    { name: L('노랑', 'yellow'), hex: SESSION_HEX.yellow },
    { name: L('주황', 'orange'), hex: SESSION_HEX.orange },
    { name: L('빨강', 'red'), hex: SESSION_HEX.red },
  ]
  const commonRows = [
    // 요청이 끝났는데도 엔진이 한도를 안 준 세션(API 키 등 — 단정은 안 한다)엔 한도 줄 줄을 뺀다: 켜도 그릴 게 없다. 첫 응답
    // 전엔 구독 세션도 비어 있어 모른다(null) — 그땐 둔다
    hasLimits === false
      ? null
      : detailRow('limits-row', L('한도 줄', 'Limits row'), [
          pick('show-limits', L('한도 전체', 'All limits'), limitsOn, () => save(setLimits(s, !limitsOn))),
          ...BAND_PARTS.filter(p => p.group === 'limits').map(p => pick(`show-${p.key}`, bandPartName(p.key), bandShowOf(s)[p.key], () => save(setBandPart(s, p.key, !bandShowOf(s)[p.key])))),
        ]),
    hasLimits === false
      ? null
      : useLine(
          'limits-use',
          s.screen === 'simple'
            ? L('구독 요금제의 5시간 · 7일 한도(계정 전체). 간단 화면은 바가 한 줄이라 안 보입니다 — 자세히 · 커스텀에서 보입니다.', 'Your plan’s 5-hour and 7-day limits (whole account). Hidden on the one-row Simple screen — shown on Detailed and Custom.')
            : L('구독 요금제의 5시간 · 7일 한도(계정 전체 — 다른 세션 몫도 들어 있음).', 'Your plan’s 5-hour and 7-day limits (whole account — other sessions count too).'),
        ),
    detailRow(
      'session-colors',
      L('세션 금액 색', 'Session cost'),
      colorNames.map((c, i) => (
        <Box key={`color-${i}`} columnGap={1} alignItems="center">
          <Text color={c.hex}>{c.name}</Text>
          <Button key={`color-${i}-down`} label="−" variant="secondary" onPress={() => save(nudgeSessionColor(s, i as 0 | 1 | 2, -1))} />
          <Text bold>{fmtUsd0(s.sessionColors[i]!)}</Text>
          <Button key={`color-${i}-up`} label="+" variant="secondary" onPress={() => save(nudgeSessionColor(s, i as 0 | 1 | 2, 1))} />
        </Box>
      )),
    ),
    useLine('colors-use', L('바 · 패널의 세션 금액이 이 값을 넘으면 그 색.', 'The session cost on the bar and pane takes this color above each value.')),
    // 오늘 · 이번 달 사용량(0.5.0, 사용자 2026-10-14: 입력창 위에 일일 · 이번 달 전체 사용량을 옵션으로) — 따로 켜고 끈다(기본 끔).
    // 0.5.1: 줄 이름 "전체 사용량" → "모든 세션"(패널 맨 위 줄 · 카드 "이 세션" 과 짝). 옵션은 바 · 간단 패널에 보일지 — 자세히 패널엔 늘
    detailRow('spend-row', L('모든 세션', 'All sessions'), [
      pick('spend-today', L('오늘', 'Today'), s.spendToday, () => save({ ...s, spendToday: !s.spendToday })),
      pick('spend-month', L('이번 달', 'This month'), s.spendMonth, () => save({ ...s, spendMonth: !s.spendMonth })),
    ]),
    useLine(
      'spend-use',
      L(
        '켜면 바 비용 줄과 간단 패널에도 보입니다. 자세히 패널엔 늘 보입니다. 이 PC 모든 세션의 금액(API 정가 환산)이고, 세션 기록에 없는 앱 자체 요청은 빠져 "~". 처음 한 번 이번 달 기록을 읽습니다.',
        'When on, also shown on the bar’s cost row and the Simple pane. The Detailed pane always shows them. Cost of every session on this PC (API list prices); app-internal requests are not in the transcripts, hence "~". The first time, it reads this month’s transcripts once.',
      ),
    ),
    // 질문 강조 — 마우스 올림은 데스크톱에만 있어 터미널에선 줄을 뺀다
    isTerminal
      ? null
      : detailRow('hover-row', L('질문 강조', 'Highlight'), [
          pick('hover-on', L('마우스 올리면', 'On hover'), s.questionHover, () => save({ ...s, questionHover: true })),
          pick('hover-off', L('끄기', 'Off'), !s.questionHover, () => save({ ...s, questionHover: false })),
        ]),
    isTerminal
      ? null
      : useLine(
          'hover-use',
          L(
            '채팅창 답변 끝의 질문 비용 칩이나 사용량 패널의 그 질문 줄에 마우스를 올리면 칩 · 패널 줄 · 그 답변이 함께 회색이 됩니다 — 어느 답변의 값인지 보입니다. 답변 글에 올려선 반응하지 않습니다. 채팅창에서 지금 안 보이는 답변은 회색이 되어도 보이지 않습니다(채팅은 스크롤되지 않음).',
            'Hover the question-cost chip under an answer, or that question’s row in the Usage pane, and the chip, the row and the answer turn gray together — so you see which answer it priced. Hovering the answer text does nothing; an answer scrolled out of view stays out of view (the chat does not scroll).',
          ),
        ),
  ]
  const detailOpen = open.detail === true
  const screenSection = section(ui, 'set-screen', L('화면', 'Screen'), [
    <Box key="screen-row" columnGap={1} rowGap={1} alignItems="center" flexWrap="wrap">
      {SCREEN_PRESETS.map(p => pick(`screen-${p}`, screenName(p), s.screen === p, () => save(chooseScreen(s, p))))}
    </Box>,
    <Text key="screen-use" dimColor wrap="wrap">
      {screenUse(s.screen)}
    </Text>,
    // 미리보기: 고른 화면으로 이 세션 값을 바처럼 — ✓ 만으론 무엇이 보일지 알기 힘들었다. 입력창 위 진짜 바도
    // 바로 바뀌지만 접혀 있거나(✕) 터미널(설정이 바를 가린다)에선 안 보인다
    preview ? (
      // 미리보기 전체를 흐린 각진 테두리로 묶는다 — 머리말 · 들여 쓰기만으론 아래 질문 비용 칩 견본이 미리보기인지 안 보였다. 안쪽 바 상자 · 파란 칩은 둥근 테두리라 갈린다
      <Box key="screen-preview" flexDirection="column" marginTop={1} borderStyle="single" borderDimColor paddingX={1}>
        <Text dimColor>{L('미리보기 — 이 화면을 고르면 이렇게 보입니다', 'Preview — how this screen looks')}</Text>
        <Box key="screen-preview-body" flexDirection="column" paddingLeft={2}>
          {preview}
        </Box>
      </Box>
    ) : null,
    <Box key="screen-more-row" marginTop={1}>
      <Button key="screen-more" label={`${detailOpen ? '▾' : '▸'} ${L('세부', 'Details')}`} variant="secondary" onPress={() => act.toggleFold('detail')} />
    </Box>,
    ...(detailOpen
      ? [
          isCustomScreen ? (
            // 커스텀을 프리셋 값으로 되돌리기 — 처음부터 다시 고를 때
            <Box key="custom-reset-row" columnGap={1} rowGap={1} alignItems="center" flexWrap="wrap" marginTop={1}>
              <Text dimColor>{L('가져오기', 'Start from')}</Text>
              {(['simple', 'detail'] as const).map(p => (
                <Button key={`custom-from-${p}`} label={screenName(p)} variant="secondary" dimColor onPress={() => save(resetCustom(s, p))} />
              ))}
            </Box>
          ) : (
            <Text key="screen-locked" dimColor wrap="wrap">
              {L(`${screenName(s.screen)} 화면의 값입니다 — 바꾸려면 [커스텀]`, `Values of the ${screenName(s.screen)} screen — choose [Custom] to change them`)}
            </Text>
          ),
          // 정보량. 패널의 처음 보기도 이것이 정한다 —
          // 따로 있던 "패널 보기" 줄은 합쳤다(늘 같이 갔다). 패널 위 [간략][자세히] 는 이 세션만 잠깐. 세부 맨 앞 — 패널 · 설정 · 답변 끝
          // 칩까지 넓게 바꾸는 큰 스위치라 바 칸(좁은 조정)보다 먼저
          detailRow(
            'info-row',
            L('정보량', 'Detail level'),
            (['lean', 'full'] as const).map(i => choose(`info-${i}`, infoName(i), view.info === i, () => editV(v => ({ ...v, info: i })))),
          ),
          useLine('info-use', infoUse(view.info)),
          ...partRows,
          // 모든 화면 공통: 한도 줄 · 세션 금액 색 — 화면 안의 보기 옵션이라 세부 아래에, 프리셋이어도 버튼
          // 위 화면 값과 갈리게 한 칸 더 띄운다 — 커스텀이면 둘 다 버튼이라 경계가 흐렸다
          <Box key="common-head" marginTop={2}>
            <Text bold>{L('모든 화면 공통 — 어느 화면에서나 바꿉니다', 'All screens — change on any screen')}</Text>
          </Box>,
          ...commonRows,
        ]
      : []),
  ], summary('screen', `${screenName(s.screen)} · ${screenStateText(s)}`), true, undefined, fold('screen'))

  // 바 · 패널(창 상태): 바의 창 버튼(— / □ · ✕) · 입력창 아래 버튼과 같은 값이라 어느 화면에서든 바꾼다. 컴팩트할 때 자동으로
  // 펴기 = 옛 자동 숨김(⇲ — ✕ 와 같아 보여 뺐다, 사용자 2026-10-13)
  // 바 · 패널 칸의 이름들 — 이 칸 줄들은 아래 windowSection 안에서 그린다
  const windowW = nameColW([L('바 크기', 'Bar size'), L('바 접기', 'Bar'), L('컴팩트할 때', 'When compacting'), L('패널 자동', 'Pane auto'), L('패널 같이', 'Pane sync')])
  const paneOn = (key: 'paneAutoOpen' | 'paneShared', onName: string) =>
    [false, true].map(isOn =>
      pick(`${key === 'paneAutoOpen' ? 'pane-auto' : 'pane-sync'}-${isOn ? 'on' : 'off'}`, isOn ? onName : L('끄기', 'Off'), s[key] === isOn, () => act.setPaneOption(key, isOn)),
    )
  termW = windowW
  const windowSection = section(ui, 'set-window', L('바 · 패널', 'Bar · pane'), [
    detailRow('band-mode-row', L('바 크기', 'Bar size'), BAND_MODES.map(m => pick(`band-${m}`, bandModeName(m), s.band === m, () => save({ ...s, band: m }))), 0),
    // 한도 줄 · 질문 줄이 없는 화면(간단 등)은 바가 한 줄 — 최소 · 최대가 같다(바의 [—] 도 빠진다)
    useLine(
      'band-use',
      s.screen === 'simple' || (!bandShowOf(s).lastTurn && !s.limitShow.fiveHour && !s.limitShow.sevenDay)
        ? L('지금 화면은 바가 한 줄이라 전체 · 한 줄이 같습니다.', 'With this screen the bar is one row, so Full and One line look the same.')
        : bandModeUse(s.band),
    ),
    detailRow('band-fold-row', L('바 접기', 'Bar'), [false, true].map(f => pick(`fold-${f ? 'on' : 'off'}`, foldName(f), s.bandFolded === f, () => save(setFolded(s, f))))),
    detailRow('band-autoopen-row', L('컴팩트할 때', 'When compacting'), [
      pick('autoopen-on', L('저절로 펴기', 'Open by itself'), s.bandAutoOpen, () => save({ ...s, bandAutoOpen: true })),
      pick('autoopen-off', L('끄기', 'Off'), !s.bandAutoOpen, () => save({ ...s, bandAutoOpen: false })),
    ]),
    useLine('band-autoopen-use', bandAutoUse(s.bandAutoOpen)),
    // 이름 칸은 이 칸에서 가장 긴 이름 + 1(windowW) — "패널 자동 열기" · "패널 같이 여닫기" 는 터미널에서 두 줄로 꺾여 짧게(리뷰)
    detailRow('pane-auto-row', L('패널 자동', 'Pane auto'), paneOn('paneAutoOpen', L('새 세션에서 열기', 'In new sessions'))),
    useLine('pane-auto-use', paneAutoUse(s.paneAutoOpen)),
    // 같이 여닫기는 데스크톱 세션끼리 — 터미널 세션의 패널은 자기 것만이라 터미널에선 줄을 뺀다
    isTerminal ? null : detailRow('pane-sync-row', L('패널 같이', 'Pane sync'), paneOn('paneShared', L('모든 세션 같이', 'All sessions'))),
    isTerminal ? null : useLine('pane-sync-use', paneSyncUse(s.paneShared)),
  ], summary('window', bandStateText(s)), true, undefined, fold('window'))

  // 명령 안내 줄은 뺐다 — 화면에서 다 바꿀 수 있어 사족이었다. 명령은 /easy-compact 도움말에 있다.
  // 순서: 화면(처음엔 이것만 펼침 — 세부 아래 모든 화면 공통: 한도 줄 · 세션 금액 색) → 바 · 패널 → 컴팩트 시점 → 컴팩트 문구 → 캐시(언어는 맨 아래, drawSettingsView)
  return (
    <Box flexDirection="column">
      {screenSection}
      {windowSection}
      {compactSection}
      {tidy}
      {/* 정보량 최소(간단)면 캐시 칸을 뺀다 — 바꿀 것이 없고(노랑 기준은 기본값), 남은 시간은 바에 늘 있다. 노랑 기준 · 유지 시간은 자세히 · 커스텀에서 */}
      {isLean ? null : cacheSection}
    </Box>
  )
}

/**
 * 설정 탭: 적용 범위 한 줄 + 권장 크기 · 캐시 경고 · 컴팩트 문구. 예전엔 비용 카드 안에서 펼쳤다 — 내용은 컴팩트 것인데 비용
 * 카드에 있었고, 펼치면 패널이 길어졌다. 자주 안 여는 곳이라 탭으로 뺐다.
 * 답이 도는 동안에도 잠그지 않는다 — 여기 버튼은 모두 값만 저장하고(질문을 보내거나 컴팩트하지 않는다) 다음 판단부터 쓰인다.
 * 저장하고 컴팩트가 도는 중이면 이미 보낸 문구는 안 바뀐다는 것만 알린다. 그 줄은 띠 · 진행 중 질문과
 * 같은 깜빡이는 점 · 색을 달고, 그동안 적용 범위 줄은 숨긴다 — 두 줄이 겹쳐 "바로 적용"과 "다음부터"가 엇갈려 읽혔다.
 * 글은 단계마다: 컴팩트 중은 /compact 직접 입력 · 자동 · [바로 컴팩트]도 같이 그리는데 거기엔 저장 턴이 없다 — 예전엔 늘
 * "저장하고 컴팩트가 도는 중" 이라 틀렸다. 컴팩트 문구는 [저장하고 컴팩트]의 저장 턴에만 쓰이니 둘 다 "다음 [저장하고 컴팩트]부터".
 * 컴팩트 중엔 띠와 같은 이름(compactKind): "지금 바로 컴팩트 중입니다." · "지금 /compact 중입니다."
 */
export function drawSettingsView(
  act: SettingsActions,
  ui: Ui,
  s: Settings,
  opt: Optimal | null,
  draft: string | null,
  rawOpen: boolean,
  phase: unknown,
  kind: unknown,
  surface: string,
  cmp: CmpDraft | null = null,
  ctxNow: number | null = null,
  autoLang: Lang | null = null,
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  preview: unknown = null,
  hasLimits: boolean | null = null,
  upd: UpdateState | null = null,
  nowMs = 0,
) {
  const { Box, Button, Text } = ui
  const look = phaseLook(phase, kind)
  // 언어 줄: 이름은 늘 두 언어로 — 읽지 못하는 언어로 떴을 때도 찾을 수 있게. 자동은 지금 고른 언어를 같이 보인다
  // 아직 모르면 그냥 "자동" — "자동(?)" 은 고장처럼 보였다
  const autoName = autoLang === 'ko' ? '한국어' : autoLang === 'en' ? 'English' : null
  const autoLabel = autoName ? L(`자동(${autoName})`, `Auto (${autoName})`) : L('자동', 'Auto')
  const langPick = (key: string, label: string, choice: Settings['lang']) => pickButton(ui, key, label, s.lang === choice, () => act.setLang(choice))
  // 설정 탭의 칸은 모두 같은 테두리 카드(사용량 탭과 같은 꼴) — 언어 줄만 맨몸으로 떠 있었다.
  // 한 번 정하면 끝이라 맨 아래, 접힌 제목 줄엔 지금 언어
  const langName = s.lang === 'ko' ? '한국어' : s.lang === 'en' ? 'English' : autoLabel
  const langOpen = open.lang === true
  const langRow = section(
    ui,
    'set-lang',
    '언어 · Language',
    [
      <Box key="s-lang" columnGap={1} alignItems="center" flexWrap="wrap">
        {langPick('lang-auto', autoLabel, 'auto')}
        {langPick('lang-ko', '한국어', 'ko')}
        {langPick('lang-en', 'English', 'en')}
      </Box>,
    ],
    langOpen ? undefined : langName,
    true,
    undefined,
    { isOpen: langOpen, onToggle: () => act.toggleFold('lang') },
  )
  const dot = look ? pulseDot(ui, surface, look.hex, look.text) : null
  return (
    <Box key="s-settings" flexDirection="column">
      {look ? (
        <Box key="s-busy" columnGap={1} alignItems="flex-start">
          {/* 빈 글 한 칸을 곁들여 줄 높이를 잡는다 — 점이 첫 줄 글의 세로 가운데에 온다 */}
          {dot ? (
            <Box key="s-busy-dot" flexShrink={0} alignItems="center">
              {dot}
              <Text> </Text>
            </Box>
          ) : null}
          <Text color={look.color} wrap="wrap">
            {L(
              `${phase === 'tidying' ? '지금 저장 중입니다 — 끝나면 컴팩트.' : `지금 ${typeof kind === 'string' && kind ? kind : '컴팩트'} 중입니다.`} 컴팩트 문구를 바꾸면 다음 [저장하고 컴팩트]부터 쓰입니다.`,
              `${phase === 'tidying' ? 'Saving now — compacts when done.' : `${typeof kind === 'string' && kind ? kind : 'Compact'} in progress.`} A changed compact text is used from the next [Save & compact].`,
            )}
          </Text>
        </Box>
      ) : (
        <Text dimColor wrap="wrap">
          {L('바꾸면 모든 세션에 바로 적용됩니다.', 'Changes apply to all sessions right away.')}
        </Text>
      )}
      {drawSettings(act, ui, s, opt, draft, rawOpen, act.toggleRaw, cmp, ctxNow, surface, cols, open, cache, preview, hasLimits)}
      {langRow}
      {/* 업데이트 칸은 맨 아래 — 마켓 설치본만(폴더로 불러온 개발본은 upd 가 null) */}
      {upd ? drawUpdateCard(act, ui, upd, nowMs, surface) : null}
    </Box>
  )
}

/** 마켓을 받아 둔 때 → "오늘" · "N일 전"(모르면 null) */
function agoText(iso: string | null, nowMs: number): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN
  if (!Number.isFinite(at) || nowMs <= 0) return null
  const days = Math.floor((nowMs - at) / 86_400_000)
  if (days <= 0) return L('오늘', 'today')
  return L(`${days}일 전`, `${days} ${days === 1 ? 'day' : 'days'} ago`)
}

/** CHANGELOG 한 판의 바뀐 것(펼친 꼴): 절 이름은 흐리게, 항목은 "· " 로 */
function changesList(ui: Ui, key: string, groups: ChangeGroup[]) {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" marginTop={1}>
      {groups.map((g, gi) => (
        <Box key={`${key}-g${gi}`} flexDirection="column" marginTop={gi > 0 ? 1 : 0}>
          {g.head ? <Text dimColor>{g.head}</Text> : null}
          {g.items.map((item, ii) => (
            <Text key={`${key}-g${gi}-${ii}`} wrap="wrap">
              {`· ${item}`}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/**
 * 설정 탭 맨 아래 easy-compact 칸(마켓 설치본만, 2026-10-14 사용자 1~3안 · 자동 확인 없음): 지금 판 · 마지막 확인과
 * [업데이트 확인] → 새 판이면 [바뀐 것 ▸] [업데이트] → "앱을 다시 켜면 적용". 확인 · 업데이트는 Claude Code 명령(claude plugin …)이
 * 하고 그때만 마켓 저장소(GitHub)를 받는다 — 이 mod 는 통신하지 않는다(README 약속). 실패면 까닭 한 줄 + [다시 시도], 명령 출력은 펼쳐 보기.
 * 상태 글 색: 진행 = 파랑(저장 중 · 컴팩트 중과 같은 점), 최신 · 받음 = 초록, 실패 = 빨강 — 제목 띠 아이콘은 다른 카드처럼 회색
 */
export function drawUpdateCard(act: SettingsActions, ui: Ui, upd: UpdateState, nowMs: number, surface: string) {
  const { Box, Button, Text } = ui
  const btn = (key: string, label: string, onPress: () => void, isMain = false) =>
    isMain ? <Button key={key} label={label} variant="primary" onPress={onPress} /> : <Button key={key} label={label} variant="secondary" onPress={onPress} />
  const checkBtn = btn('upd-check', L('업데이트 확인', 'Check for updates'), act.checkUpdate)
  const changes = upd.market ? upd.changes?.[upd.market] : undefined
  const busy = (key: string, text: string) => [
    <Box key={`${key}-dot`} flexShrink={0} alignItems="center">
      {pulseDot(ui, surface, LIVE_HEX, text)}
    </Box>,
    <Text key={key} color={ACCENT}>
      {text}
    </Text>,
  ]
  const ago = agoText(upd.marketAt, nowMs)
  let row: unknown[]
  switch (upd.phase) {
    case 'checking':
      row = busy('upd-busy', L('새 판 확인 중…', 'Checking for a new version…'))
      break
    case 'updating':
      row = busy('upd-busy', L('업데이트 중…', 'Updating…'))
      break
    case 'latest':
      row = [
        <Text key="upd-state" color="green">
          {L(`최신 판입니다(${upd.own ?? '?'})`, `Up to date (${upd.own ?? '?'})`)}
        </Text>,
        checkBtn,
      ]
      break
    case 'newer':
      row = [
        <Text key="upd-state" bold>
          {L(`새 판 ${upd.market} 있음`, `New version ${upd.market}`)}
        </Text>,
        changes ? btn('upd-changes', `${L('바뀐 것', 'What changed')} ${upd.open?.changes ? '▾' : '▸'}`, () => act.toggleUpdate('changes')) : null,
        btn('upd-apply', L('업데이트', 'Update'), act.applyUpdate, true),
      ]
      break
    case 'done':
      row = [
        <Text key="upd-state" color="green" wrap="wrap">
          {L(`${upd.market ?? ''} 받음 — 앱을 다시 켜면 적용됩니다`, `${upd.market ?? ''} downloaded — restart the app to use it`)}
        </Text>,
      ]
      break
    case 'failed':
      row = [
        <Text key="upd-state" color="red" wrap="wrap">
          {!upd.error
            ? L('claude 명령을 못 찾았습니다 — README 의 새 판 받기를 보세요', 'claude command not found — see Updating in the README')
            : upd.failedOn === 'apply'
              ? L('업데이트 못 함 — git · 네트워크를 확인하세요', 'Update failed — check git and your network')
              : L('확인 못 함 — git · 네트워크를 확인하세요', 'Check failed — check git and your network')}
        </Text>,
        btn('upd-retry', L('다시 시도', 'Try again'), upd.failedOn === 'apply' ? act.applyUpdate : act.checkUpdate),
        upd.error ? btn('upd-error', `${L('명령 출력', 'Output')} ${upd.open?.error ? '▾' : '▸'}`, () => act.toggleUpdate('error')) : null,
      ]
      break
    default:
      row = [ago ? <Text key="upd-state">{L(`마지막 확인 ${ago}`, `Last checked ${ago}`)}</Text> : null, checkBtn]
  }
  // 누를 수 있는 [업데이트 확인] 곁에만 — 통신은 Claude Code 가 그때만 한다는 풀이
  const canCheck = upd.phase === 'idle' || upd.phase === 'latest' || (upd.phase === 'failed' && upd.failedOn !== 'apply')
  return section(
    ui,
    'set-update',
    'easy-compact',
    [
      <Box key="upd-row" columnGap={1} alignItems="center" flexWrap="wrap">
        {row}
      </Box>,
      upd.phase === 'newer' && upd.open?.changes && changes ? changesList(ui, 'upd-changes-list', changes) : null,
      upd.phase === 'failed' && upd.open?.error && upd.error ? (
        <Box key="upd-error-text">
          <Text dimColor wrap="wrap">
            {upd.error}
          </Text>
        </Box>
      ) : null,
      canCheck ? (
        <Text key="upd-net" dimColor wrap="wrap">
          {L(
            '[업데이트 확인] 을 누를 때만 Claude Code 가 GitHub 에서 마켓을 받아 옵니다 — easy-compact 는 스스로 통신하지 않습니다.',
            'Only when you press [Check for updates] does Claude Code fetch the marketplace from GitHub — easy-compact itself never goes online.',
          )}
        </Text>
      ) : null,
    ],
    upd.own ?? undefined,
    true,
    'update',
  )
}

/**
 * 업데이트 뒤 첫 실행(3안): 사용량 패널 맨 위 한 줄 카드 "N 판으로 업데이트됨 · [바뀐 것 ▸] [닫기]" — 닫으면 다시 안 보인다
 * (본 판을 저장소에 적는다). 바뀐 것은 받아 둔 마켓 사본의 CHANGELOG(네트워크 없음), 없으면 버튼을 뺀다
 */
export function drawUpdateNote(ui: Ui, upd: UpdateState, act: { toggle: () => void; close: () => void }) {
  const { Box, Button, Text } = ui
  const v = upd.updatedTo ?? ''
  const changes = upd.changes?.[v]
  return (
    <Box key="upd-note" flexDirection="column" marginTop={1} {...CARD}>
      <Box key="upd-note-row" columnGap={1} alignItems="center" flexWrap="wrap">
        {decoIcon(ui, 'update', LIVE_HEX, L('업데이트', 'Update'), 'upd-note-icon')}
        <Text>{L(`${v} 판으로 업데이트됨`, `Updated to ${v}`)}</Text>
        {changes ? <Button key="upd-note-changes" label={`${L('바뀐 것', 'What changed')} ${upd.open?.note ? '▾' : '▸'}`} variant="secondary" onPress={act.toggle} /> : null}
        <Button key="upd-note-close" label={L('닫기', 'Close')} variant="secondary" onPress={act.close} />
      </Box>
      {upd.open?.note && changes ? changesList(ui, 'upd-note-list', changes) : null}
    </Box>
  )
}
