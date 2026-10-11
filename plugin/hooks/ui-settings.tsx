import type { Optimal, Settings, Source, TidyStyleId } from '../types'
import { fmtTokens, fmtUsd, modelName, ratesFor } from './cost'
import {
  chooseTidy,
  customName,
  customUse,
  DEFAULT_SETTINGS,
  nudgeCache,
  parseTokens,
  RANGE_BANDS,
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
  STAR_HEX,
  PEN_WARN_PCT,
  PEN_BAD_PCT,
  penColorOf,
  isNotRecommended,
  penVerdict,
  phaseLook,
  pulseDot,
  CARD,
  CARD_INSET,
  section,
} from './ui-common'
import { cellsOf } from './text'
import type { Ui } from './ui-common'

/** ⚙ 설정 탭 — 컴팩트 시점(구간 · 직접 지정)과 컴팩트 문구 */

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
  setLang: (choice: Settings['lang']) => void
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
) {
  const { Box, Button, Input, Text } = ui
  const isTerminal = surface === 'terminal'
  const save = act.save
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  // 고르기 버튼(방식 · 시작 · 끝 · 문구): 고른 것은 ✓ 와 주 버튼
  const pick = (key: string, label: string, isOn: boolean, onPress: () => void) =>
    isOn ? (
      <Button key={key} label={`✓ ${label}`} variant="primary" onPress={onPress} />
    ) : (
      <Button key={key} label={label} variant="secondary" dimColor onPress={onPress} />
    )

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

  // 비용표 칸(데스크톱은 칸 폭을 상자로 맞춘다) · 크기에서 요청 1회(캐시 읽기) · 캐시 식으면(1시간 쓰기로 전체 다시)
  const cell = (key: string, width: number, el: unknown) => (
    <Box key={key} width={width} flexShrink={0}>
      {el}
    </Box>
  )
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    return r ? (size * r[which]) / 1e6 : null
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
  const ctxColor = ctxNow === null ? undefined : ctxNow >= appliedT.ctxCut ? 'red' : ctxNow >= appliedT.ctxWarn ? 'yellow' : undefined
  const appliedRow = (
    <Box key="cmp-applied" columnGap={1} alignItems="center" flexWrap="wrap">
      <Text>{L('적용 중', 'Applied')}</Text>
      <Text bold color={ACCENT}>
        {appliedText}
      </Text>
      {ctxNow !== null && ctxNow > 0 ? <Text dimColor>·</Text> : null}
      {ctxNow !== null && ctxNow > 0 ? <Text>{L('현재 컨텍스트', 'Current context')}</Text> : null}
      {ctxNow !== null && ctxNow > 0 ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtTokens(ctxNow)}
        </Text>
      ) : null}
      {/* 지금 크기에서 요청 1회(캐시 읽기) — 비용표의 "요청 1회" 칸과 같은 값 */}
      {ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text dimColor>·</Text> : null}
      {ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text>{L('요청 1회', 'Per request')}</Text> : null}
      {ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? (
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
  // 설명은 이름 칸 + 짧은 풀이 한 줄씩 — 한 문단 긴 글은 읽히지 않았다
  const TERM_W = 12
  const term = (key: string, name: string, desc: unknown, nameColor?: string) => (
    // 터미널은 풀이가 두 줄이면 이름이 가운데(둘째 줄)로 내려가 엇갈려 보였다 — 첫 줄에 맞춘다
    <Box key={key} columnGap={1} alignItems={isTerminal ? 'flex-start' : 'center'}>
      {cell('t', TERM_W, <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>)}
      <Box flexShrink={1} minWidth={0} columnGap={1} flexWrap="wrap">
        {typeof desc === 'string' ? (
          <Text dimColor wrap="wrap">
            {desc}
          </Text>
        ) : (
          desc
        )}
      </Box>
    </Box>
  )
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
  const starLine = inputs && opt ? term('cmp-how', L('★ 최적', '★ Best'), L('읽기 + 컴팩트 비용이 가장 적은 크기(공식 요율 · 이 세션 값)', 'Size with the lowest read + compact cost (official rates · this session)'), STAR_HEX) : null
  const capLine = capNote ? term('cmp-cap', model, capNote.trim()) : null

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
    // 터미널이 좁으면 "캐시 식으면" 칸을 뺀다 — 줄이 넘어가면 표가 두 줄씩 갈라져 못 읽었다. 판정 말 · "적용 중" 까지 한 줄에
    // 드는지: 카드 안 폭(테두리 · 여백 4) − 줄 테두리 2
    const tailW = Math.max(cellsOf(L('★ 최적', '★ Best')), cellsOf(penVerdict(PEN_BAD_PCT + 1)!.word)) + 1 + cellsOf(L('적용 중', 'Applied'))
    const showCold = !isTerminal || cols === null || cols - CARD_INSET - 2 >= BAND_W + USD_W * 2 + PEN_W + tailW + 5
    const usd2 = (x: number | null, y: number | null) => (x === null || y === null ? '—' : `${fmtUsd(x)}~${fmtUsd(y).slice(1)}`)
    // 고른 줄은 둥근 테두리, 나머지는 같은 자리만큼 안쪽 여백 — 칸이 어긋나지 않게
    const rowBox = (isOn: boolean) => (isOn ? { borderStyle: 'round' as const, borderColor: ACCENT } : { paddingX: 1 })
    const head = (
      <Box key="cmp-t-head" columnGap={1} marginTop={1} paddingX={1}>
        {cell('h-band', BAND_W, <Text dimColor>{L('크기 구간', 'Size range')}</Text>)}
        {cell('h-read', USD_W, <Text dimColor>{L('요청 1회', 'Per request')}</Text>)}
        {showCold ? cell('h-cold', USD_W, <Text dimColor>{L('캐시 식으면', 'Cold cache')}</Text>) : null}
        {cell('h-pen', PEN_W, <Text dimColor>{L('최적보다 더 듦', 'Over best')}</Text>)}
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
          {cell('read', USD_W, <Text bold={isOn} dimColor={!isOn}>{usd2(usdAt(a, 'read'), usdAt(b, 'read'))}</Text>)}
          {showCold ? cell('cold', USD_W, <Text bold={isOn} dimColor={!isOn}>{usd2(usdAt(a, 'write1h'), usdAt(b, 'write1h'))}</Text>) : null}
          {cell('pen', PEN_W, <Text bold={isOn} dimColor={!isOn && !penColor} {...(penColor ? { color: penColor } : {})}>{pens}</Text>)}
          {/* 최적이 든 띠엔 금색 "★ 최적" — 흐린 ★ 하나는 눈에 안 띄었다. 나머지는 판정 말(좋음 · 보통 · 비추천) */}
          {i === starAt ? (
            <Text key="star" bold color={STAR_HEX}>
              {L('★ 최적', '★ Best')}
            </Text>
          ) : verdict ? (
            <Text key="verdict" color={verdict.color}>
              {verdict.word}
            </Text>
          ) : null}
          {/* 저장된 구간엔 "적용 중" — 다른 띠를 고르는 동안 실제 적용 구간이 표에 안 보였다 */}
          {s.follow && s.rangeStart === a && s.rangeEnd === b ? (
            <Box key={`cmp-on-${a}`}>
              <Text bold color={ACCENT}>
                {L('적용 중', 'Applied')}
              </Text>
            </Box>
          ) : null}
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
            STAR_HEX,
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
      badParts.length > 0
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
        {term('cmp-read', L('요청 1회', 'Per request'), L('캐시 읽기 한 번', 'one cache read'))}
        {showCold ? term('cmp-cold', L('캐시 식으면', 'Cold cache'), L('1시간 쉬어 전부 다시 쓰기', 'idle 1h, everything rewritten')) : null}
        {starLine}
        {calcLine}
        {capLine}
        {term(
          'cmp-range-src',
          L('기본 구간', 'Default range'),
          L(`${fmtTokens(DEFAULT_SETTINGS.rangeStart)} ~ ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)}(처음 설치 값)`, `${fmtTokens(DEFAULT_SETTINGS.rangeStart)} – ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)} (initial value)`),
        )}
      </Box>,
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
      </Box>,
    ]
  }

  // 컴팩트 시점은 테두리 카드로 한 덩어리 — 표 · 적용이 설정의 다른 글과 섞여 보였다
  const compactSection = section(
    ui,
    'set-compact',
    L('컴팩트 시점', 'Compact timing'),
    rows,
    d.follow ? L('노랑 = 컴팩트하기 좋은 때, 빨강 = 늦어짐', 'yellow = good time to compact, red = overdue') : L('빨강 = 정한 크기', 'red = the set size'),
    true,
  )
  const cacheSection = section(ui, 'set-cache', L('캐시 경고', 'Cache warning'), [
    <Box key="cache-row" columnGap={1} alignItems="center">
      <Button key="cache-down" label="−" variant="secondary" onPress={() => save(nudgeCache(s, -1))} />
      <Box width={5} flexShrink={0} justifyContent="center">
        <Text bold>{L(`${s.cacheWarnMin}분`, `${s.cacheWarnMin} min`)}</Text>
      </Box>
      <Button key="cache-up" label="+" variant="secondary" onPress={() => save(nudgeCache(s, 1))} />
      <Box flexShrink={1} minWidth={0}>
        <Text dimColor wrap="wrap">
          {L('캐시가 이만큼 남으면 노랑으로 알립니다(캐시 수명 60분).', 'Turns yellow when this much cache time is left (cache lives 60 min).')}
        </Text>
      </Box>
    </Box>,
  ], undefined, true)

  // 문구는 버튼 넷(프리셋 셋 + 직접) — 직접을 고르면 아래에 한 줄 입력칸, Enter 로 저장.
  // 아래엔 "언제 쓰나" 한 줄과, 누르면 일어나는 일을 단계로: ① 손해 판단 → ② 저장 → ③ 답 → ④ 컴팩트. ①④ 는 어느 문구든
  // 같아 흐리게, 문구마다 다른 ②③ 만 보통 글 — 차이가 한눈에 보인다. 보내는 글 원문은 접어 둔다: 모델이 읽으라고 쓴 글이라
  // 사람이 머릿속에서 풀어야 했다. 직접은 쓴 글이 곧 원문이라 늘 펼친다
  const isCustom = s.tidy === 'custom'
  const steps = tidySteps(s)
  const use = !isCustom
    ? tidyStyles()[s.tidy as TidyStyleId].use
    : usesCustom(s)
      ? customUse()
      : L(`${customUse()} 비어 있으면 일반 문구를 보냅니다.`, `${customUse()} While empty, the Normal text is sent.`)
  const step = (key: string, mark: string, name: string, text: string, isFixed: boolean) => (
    <Box key={key} columnGap={1}>
      <Box width={9} flexShrink={0}>
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
    <Box key="tidy-flow" flexDirection="column" marginTop={1}>
      <Text>{L('[저장하고 컴팩트]를 누르면', 'When you press [Save & compact]')}</Text>
      {step('tidy-s1', '①', L('판단', 'Check'), L('지금 컴팩트하면 손해인지 봅니다. 손해면 멈추고 알림', 'Checks whether compacting now is a loss. If so, stops and tells you'), true)}
      {step('tidy-s2', '②', L('저장', 'Save'), steps.keep, false)}
      {step('tidy-s3', '③', L('답', 'Reply'), steps.reply, false)}
      {step('tidy-s4', '④', L('컴팩트', 'Compact'), L('③의 답은 요약에 그대로 남김', 'the reply in ③ is kept in the summary as is'), true)}
    </Box>,
    // 직접은 늘 펼쳐 접기 버튼이 없다
    isCustom ? null : (
      <Box key="tidy-raw-row" marginTop={1}>
        <Button key="tidy-raw" label={`${rawOpen ? '▾' : '▸'} ${L('보내는 글 전체', 'Full text sent')}`} variant="secondary" onPress={onToggleRaw} />
      </Box>
    ),
    // 보내는 글 전체: 세션에 보내는 글 그대로(tidyPrompt) + 이어서 /compact 에 붙이는 지시. 가운데만 보이고 앞뒤를 "늘 붙음"
    // 으로 줄이면 전체도 아니고 단계 보기와 겹쳐 사족이었다. 고른 문구 줄만 청록, 글은 보통 색(흐린 글은 데스크톱
    // 어두운 배경에서 안 읽혔다)
    showRaw ? (
      <Box key="tidy-script" flexDirection="column" marginTop={1} {...CARD}>
        {tidyScript(s).map((l, i) => (
          <Text key={`tidy-line-${i}`} wrap="wrap" {...(l.isBody ? { color: 'cyan' } : {})}>
            {l.text}
          </Text>
        ))}
      </Box>
    ) : null,
  ], undefined, true)

  // 명령 안내 줄은 뺐다 — 화면에서 다 바꿀 수 있어 사족이었다. 명령은 /easy-compact 도움말에 있다
  return (
    <Box flexDirection="column">
      {compactSection}
      {cacheSection}
      {tidy}
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
) {
  const { Box, Button, Text } = ui
  const look = phaseLook(phase, kind)
  // 언어 줄: 이름은 늘 두 언어로 — 읽지 못하는 언어로 떴을 때도 찾을 수 있게. 자동은 지금 고른 언어를 같이 보인다
  const autoName = autoLang === 'ko' ? '한국어' : autoLang === 'en' ? 'English' : '?'
  const langPick = (key: string, label: string, choice: Settings['lang']) =>
    s.lang === choice ? (
      <Button key={key} label={`✓ ${label}`} variant="primary" onPress={() => act.setLang(choice)} />
    ) : (
      <Button key={key} label={label} variant="secondary" dimColor onPress={() => act.setLang(choice)} />
    )
  // 설정 탭의 칸은 모두 같은 테두리 카드(사용량 탭과 같은 꼴) — 언어 줄만 맨몸으로 떠 있었다
  const langRow = section(
    ui,
    'set-lang',
    '언어 · Language',
    [
      <Box key="s-lang" columnGap={1} alignItems="center" flexWrap="wrap">
        {langPick('lang-auto', L(`자동(${autoName})`, `Auto (${autoName})`), 'auto')}
        {langPick('lang-ko', '한국어', 'ko')}
        {langPick('lang-en', 'English', 'en')}
      </Box>,
    ],
    undefined,
    true,
  )
  const dot = look ? pulseDot(ui, surface, look.hex, look.text) : null
  return (
    <Box key="s-settings" flexDirection="column">
      {langRow}
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
      {drawSettings(act, ui, s, opt, draft, rawOpen, act.toggleRaw, cmp, ctxNow, surface, cols)}
    </Box>
  )
}
