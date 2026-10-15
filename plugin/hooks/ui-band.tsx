import type { BandShow, CompactInputs, CostParts, LiveTurn, StepDetail, TurnSummary, Usage } from '../types'
import { cacheWarnFor, estimateFor, fmtUntil, fmtUsd, LEVEL_HEX, LEVEL_TEXT, levelOf, limitHex, REWRITE_NOTE_USD, sessionColorOf, thresholds, priceWarnings } from './cost'
import { L, plural } from './i18n'
import { bandShowOf, DEFAULT_SETTINGS, SESSION_COLORS_DEFAULT } from './settings'
import { agentPart, agentSum, callsOf, ctxNumText, limitName, rangeNumText, widthOf } from './text'
import type { CtxUnit } from './text'
import { iconOf, onDesktop, onTerminal, withIcon } from './glyph'
import { agentText, bar, decoIcon, TILE } from './ui-common'
import type { Ui } from './ui-common'

/** 입력창 위 띠의 줄들 — 한도 · 예상(이 세션 · 요청당 · 컨텍스트 · 캐시) · 지난 질문. 칸마다 화면 보기 값(bandShow)으로 뺄 수 있다 */

/**
 * 최소(한 줄) 바의 칸: 그 화면의 이 세션 · 요청당 · 컨텍스트 · 캐시(한도 · 컴팩트 구간 · 질문 줄은 뺀다). 캐시 남은 분은 한 줄에도
 * 남긴다 — 식으면 다음 요청이 전체를 다시 써 늘 볼 값. 캐시를 더하자 넓은 창에서도 두 줄로 넘어가
 * 컴팩트 구간을 뺐다 — 컴팩트할 때는 이지 컴팩트 버튼 색 · 점이 알린다. 캐시 글도 "캐시 만료 N분 남음" 으로 짧게(drawEstimateLine isShort)
 */
export function minShowOf(show: BandShow): BandShow {
  return { ...show, fiveHour: false, sevenDay: false, resets: false, range: false, lastTurn: false }
}

/** 칸 다 켠 화면(자세히)의 칸 — 그리기 함수의 기본 인자 */
const BASIC_SHOW: BandShow = bandShowOf({ ...DEFAULT_SETTINGS, screen: 'detail' })

/**
 * 띠 윗줄: 세션 한도. 계정 전체 값이라 다른 세션이 쓴 것도 들어 있다. 5시간 · 7일 · 리셋 시간은 칸마다 뺄 수 있고(그 밖의
 * 한도 — 지출 한도 등 — 는 늘 보인다), 다 빠지면 null
 */
export function drawLimitsLine(ui: Ui, surface: string, u: Usage, nowMs: number, show: BandShow = BASIC_SHOW) {
  const { Box, Text } = ui
  const shown = u.rateLimits.filter(r => (r.kind === 'five_hour' ? show.fiveHour : r.kind === 'seven_day' ? show.sevenDay : true))
  if (shown.length === 0) return null
  return (
    <Box columnGap={3} flexWrap="wrap">
      {/* 한도 하나(이름 · 막대 · % · 리셋)는 줄지 않고 통째로 다음 줄로 — 좁은 터미널(패널을 연 CLI, 바 ~68칸)에서 칸마다
          짓눌려 "5 / 시 / 간" 처럼 글자가 세로로 쪼개졌다(2026-10-12 CLI 확인) */}
      {/* 한도 하나 = [이름 · 막대 · %] 와 [리셋] 두 덩어리 — 덩어리째 꺾이고 짓눌리진 않는다. 한 덩어리였을 땐 좁은 자리(설정 미리보기
          40칸)에서 리셋 글이 상자 밖으로 넘쳐 창 버튼과 겹쳤다(2026-10-14 render 도구) */}
      {shown.map(r => (
        <Box key={`bl-${r.kind}`} columnGap={1} alignItems="center" flexWrap="wrap" minWidth={0}>
          <Box key={`bl-${r.kind}-v`} columnGap={1} alignItems="center" flexShrink={0}>
            <Text dimColor>{limitName(r.kind)}</Text>
            {bar(ui, surface, r.percentUsed, limitHex(r.percentUsed), 64, L(`${limitName(r.kind)} 한도 ${r.percentUsed}%`, `${limitName(r.kind)} limit ${r.percentUsed}%`))}
            <Text {...(r.percentUsed >= 90 ? { color: 'error' } : r.percentUsed >= 70 ? { color: 'warning' } : {})}>
              {Math.round(r.percentUsed)}%
            </Text>
          </Box>
          {r.resetsAt && show.resets ? (
            <Box key={`bl-${r.kind}-r`} flexShrink={0}>
              <Text dimColor>{L(`· ${fmtUntil(r.resetsAt, nowMs)} 후 리셋`, `· resets in ${fmtUntil(r.resetsAt, nowMs)}`)}</Text>
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  )
}

/**
 * 바 줄의 칸 하나: text = 폭 어림용 글(앞 " · " 빼고), el(isFirst) = 그릴 글(앞 칸이 있으면 " · " 를 붙여 — 데스크톱도 칸 앞 공백을
 * 그린다, Text = pre-wrap), drop = 좁을 때 빼는 차례(작을수록 먼저, 없으면 안 뺌), short = 빼는 대신 쓰는 짧은 꼴
 */
export type LineCell = { key: string; text: string; el: (isFirst: boolean) => unknown; drop?: number; short?: LineCell }

/** 칸을 맞춘 줄: el = 그린 줄(칸이 없으면 null), width = 맞춘 폭(칸), over = 다 빼고도 maxW 를 넘음 */
export type LineFit = { el: unknown; width: number; over: boolean }

const SEP = ' · '

function lineWidth(cells: readonly LineCell[]): number {
  const isTerm = onTerminal()
  return cells.reduce((sum, c, i) => sum + widthOf((i === 0 ? '' : SEP) + c.text, isTerm), 0)
}

/**
 * 칸들을 폭(maxW)에 맞춰 그린다: 다 안 들면 drop 차례대로 빼거나 짧은 꼴로 바꾼다 — 그래도 넘치면 그대로 두고 over(줄은 칸 사이에서만
 * 꺾인다). maxW = null 이면(설정 미리보기 등) 다 둔다.
 * 칸마다 따로 꺾이지 않는 조각(Box)으로 그린다 — 예전엔 줄 하나를 Text 하나로 그렸는데 데스크톱은 안쪽 Text 가 pre-wrap 이라 바깥
 * truncate 를 안 지켜 "…$0.60 이 / 득" 처럼 한글 낱말 중간에서 꺾였다(2026-10-14 render 도구로 원인 확인 · fb B1 · E1). 칸 Box 안
 * 글은 줄바꿈 속성이 없어 위로 뜨지 않는다(6ddd6b4 의 뜸은 Text 안 wrap Text 였다).
 * wrapW(나눌 폭 — 기본 maxW)를 넘으면 칸을 줄마다 직접 담아 나눈다 — 줄 머리 칸엔 " · " 를 안 붙인다. 엔진이 칸 사이에서 꺾게 두면
 * 다음 줄이 "· 캐시 만료 …" 처럼 점으로 시작했다(0.6.0 CLI 확인)
 */
export function fitLine(ui: Ui, cells: readonly LineCell[], maxW: number | null, wrapW: number | null = maxW): LineFit {
  const { Box } = ui
  let list = [...cells]
  if (maxW !== null) {
    const steps = [...new Set(cells.flatMap(c => (c.drop === undefined ? [] : [c.drop])))].sort((a, b) => a - b)
    for (const step of steps) {
      if (lineWidth(list) <= maxW) break
      list = list.flatMap(c => (c.drop === step ? (c.short ? [c.short] : []) : [c]))
    }
  }
  const width = lineWidth(list)
  if (list.length === 0) return { el: null, width: 0, over: false }
  const rowEl = (row: readonly LineCell[], key?: string) => (
    <Box {...(key ? { key } : {})} flexWrap="wrap" alignItems="center">
      {row.map((c, i) => (
        <Box key={c.key} flexShrink={0}>
          {c.el(i === 0)}
        </Box>
      ))}
    </Box>
  )
  const rows = wrapW !== null && width > wrapW ? packRows(list, wrapW) : [list]
  return {
    el: rows.length === 1 ? rowEl(list) : <Box flexDirection="column">{rows.map(r => rowEl(r, `${r[0]!.key}-row`))}</Box>,
    width,
    over: maxW !== null && width > maxW,
  }
}

/** 칸을 폭(w)에 맞춰 줄마다 담는다 — 안 드는 칸은 다음 줄 머리로, 한 칸이 줄보다 넓으면 그 칸 하나로 한 줄 */
function packRows(list: readonly LineCell[], w: number): LineCell[][] {
  const isTerm = onTerminal()
  const rows: LineCell[][] = []
  let row: LineCell[] = []
  let rowW = 0
  for (const c of list) {
    const add = widthOf((row.length === 0 ? '' : SEP) + c.text, isTerm)
    if (row.length > 0 && rowW + add > w) {
      rows.push(row)
      row = [c]
      rowW = widthOf(c.text, isTerm)
    } else {
      row.push(c)
      rowW += add
    }
  }
  if (row.length > 0) rows.push(row)
  return rows
}

/**
 * 비용 줄 칸: 이 세션 · 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시(식은 캐시면 상태 · 컨텍스트). show 로 끈 칸은 없다.
 * 좁을 때 빼는 차례(2026-10-14 uxi D1): 컴팩트 구간(컨텍스트 색 · 이지 컴팩트 점이 이미 말한다) → 요청당 → 캐시는 짧은 꼴
 * ("캐시 만료 42분 남음"). 이 세션 · 컨텍스트 · 상태는 안 뺀다(이름 빼기 안 C 는 안 함 — 사용자 고름).
 * isShort = 최소(한 줄) 바: 캐시를 처음부터 짧은 꼴로
 */
/** 바에 보일 오늘 · 이번 달 사용량(설정에서 켠 것만, 못 쟀으면 null) */
export type SpendShown = { today: number | null; month: number | null }

/** 0.5 묶음 2(N15): 비용 줄 칸 순서(설정 bandOrder) — register 가 그리기 전에 넣는다(thresholds() 와 같은 방식) */
let bandOrder: readonly string[] = ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache']

export function setBandOrder(order: readonly string[]): void {
  bandOrder = order
}

/** B1(0.6.1 피드백): 컨텍스트 · 컴팩트 구간 숫자 꼴(설정 ctxUnit) — register 가 그리기 전에 넣는다(bandOrder 와 같은 방식) */
let ctxUnit: CtxUnit = 'size'

export function setCtxUnit(unit: CtxUnit): void {
  ctxUnit = unit
}

/** 지금 숫자 꼴 — 바 설명 칩도 같은 꼴 */
export function ctxUnitNow(): CtxUnit {
  return ctxUnit
}

const ORDER_OF: Record<string, string> = { 'c-session': 'session', 'c-today': 'today', 'c-month': 'month', 'c-call': 'perRequest', 'c-ctx': 'context', 'c-range': 'range', 'c-cache': 'cache' }

/** 칸을 설정 순서로(식은 캐시 상태 칸은 컨텍스트 바로 앞 — 상태 · 크기가 붙어 읽히게). 같은 순위는 원래 순서 */
function costCells(...args: Parameters<typeof costCellsRaw>): LineCell[] {
  const rank = (c: LineCell) => {
    const name = ORDER_OF[c.key]
    const i = name ? bandOrder.indexOf(name) : -1
    return i >= 0 ? i : c.key === 'c-cold' ? bandOrder.indexOf('context') - 0.5 : 99
  }
  return costCellsRaw(...args)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(x => x.c)
}

function costCellsRaw(ui: Ui, u: Usage, nowMs: number, show: BandShow, colors: readonly [number, number, number], isShort: boolean, spend: SpendShown | null = null): LineCell[] {
  const { Box, Text } = ui
  const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor> · </Text>)
  const cells: LineCell[] = []
  // 비용 줄 맨 앞 "세션 $12.34" — 최대 · 최소 두 크기에서 같은 자리, 식은
  // 이름표는 "이 세션" 에서 "세션" 으로 줄였다(2026-10-14 uxi 안 A — 옆 이름표 오늘 · 이번 달 · 요청당과 나란, 영어 Session 과 같은 짜임,
  // 좁은 바에서 칸이 하나 더 남음). 패널 첫 카드 제목은 홀로 서는 머리말이라 "이 세션" 그대로.
  // 캐시 줄 앞에도. 색은 설정의 세션 금액 기준(기본 $10 노랑 · $50 주황 · $100 빨강). 금액을 모르면(엔진이 비용 장부를 안 줌) 없음
  if (show.session && u.costUsd !== null) {
    const usd = u.costUsd
    const color = sessionColorOf(usd, colors)
    // N22: 가격표에 없는 모델 · 1M 을 넘는 창 — 금액 옆 ⚠, 마우스를 올리면 까닭(바 설명 칩과 같은 꼴, 데스크톱만)
    const warns = priceWarnings(u.model, u.window)
    cells.push({
      key: 'c-session',
      text: `${L('세션 ', 'Session ')}${fmtUsd(usd)}${warns.length > 0 ? ' ⚠' : ''}`,
      el: isFirst => {
        const line = (
          <Text>
            {dot(isFirst)}
            <Text dimColor>{L('세션 ', 'Session ')}</Text>
            <Text bold {...(color ? { color } : {})}>
              {fmtUsd(usd)}
            </Text>
            {warns.length > 0 ? <Text color="warning"> ⚠</Text> : null}
          </Text>
        )
        if (warns.length === 0 || onTerminal()) return line
        return (
          <Box key="c-session-warn">
            {line}
            <Box position="absolute" top={0} left={0} display="none" hover={{ display: 'flex' }} backgroundColor="promptBorder" paddingX={1}>
              <Text wrap="truncate-end">{warns.join(' · ')}</Text>
            </Box>
          </Box>
        )
      },
    })
  }
  // 오늘 · 이번 달(설정에서 켰을 때만) — 이 세션 금액 바로 뒤 돈 묶음. 모든 세션 기록 합이라 "~"(앱 자체 요청은 기록에 없다).
  // 좁으면 컴팩트 구간 → 요청당 → 캐시 짧은 꼴 다음에 이번 달 → 오늘 순으로 뺀다(사람이 켠 칸이라 캐시를 먼저 줄인다)
  const spendCell = (key: string, name: string, usd: number, drop: number): LineCell => ({
    key,
    drop,
    text: `${name}${fmtUsd(usd)}`,
    el: isFirst => (
      <Text>
        {dot(isFirst)}
        <Text dimColor>{name}</Text>
        <Text bold>{fmtUsd(usd)}</Text>
      </Text>
    ),
  })
  if (spend?.today !== null && spend?.today !== undefined) cells.push(spendCell('c-today', L('오늘 ', 'Today '), spend.today, 2.4))
  if (spend?.month !== null && spend?.month !== undefined) cells.push(spendCell('c-month', L('이번 달 ', 'This month '), spend.month, 2.2))
  const level = levelOf(u.contextTokens)
  // 컴팩트 뒤 첫 요청 전이면 "컴팩트 직후" — 크기는 엔진이 준 직후 크기(N2), 그게 없어 추정이면 "~"
  const isJust = u.contextEstimated === true || u.isAfterCompact === true
  const ctxNum = `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, ctxUnit)}`
  const ctxText = isJust ? L(`컨텍스트 ${ctxNum} 컴팩트 직후`, `Context ${ctxNum} just compacted`) : L(`컨텍스트 ${ctxNum}`, `Context ${ctxNum}`)
  const ctxCell: LineCell | null = !show.context
    ? null
    : {
        key: 'c-ctx',
        text: ctxText,
        el: isFirst =>
          isJust ? (
            <Text>
              {dot(isFirst)}
              <Text color={LEVEL_TEXT[level]}>{L(`컨텍스트 ${ctxNum}`, `Context ${ctxNum}`)}</Text>
              <Text dimColor>{L(' 컴팩트 직후', ' just compacted')}</Text>
            </Text>
          ) : (
            <Text>
              {dot(isFirst)}
              <Text color={LEVEL_TEXT[level]}>{ctxText}</Text>
            </Text>
          ),
      }
  // 지금 걸린 컴팩트 시점(설정 탭) — 컨텍스트 크기 바로 뒤에, 얼마나 남았는지 견주게. 칸 사이 " · " 는 앞 칸이 있을 때만
  const t = thresholds()
  const rangeValue = rangeNumText(t, u.window, ctxUnit)
  const rangeCell: LineCell | null = !show.range
    ? null
    : {
        key: 'c-range',
        drop: 1,
        text: `${t.isRange ? L('컴팩트 구간 ', 'compact range ') : L('컴팩트 기준 ', 'compact at ')}${rangeValue}`,
        el: isFirst => (
          <Text>
            <Text dimColor>
              {t.isRange ? L(`${isFirst ? '' : ' · '}컴팩트 구간 `, `${isFirst ? 'Compact range ' : ' · compact range '}`) : L(`${isFirst ? '' : ' · '}컴팩트 기준 `, `${isFirst ? 'Compact at ' : ' · compact at '}`)}
            </Text>
            <Text>{rangeValue}</Text>
          </Text>
        ),
      }
  const est = estimateFor(u, nowMs)
  if (est.kind === 'unpriced') return [...cells, ...[ctxCell, rangeCell].filter((c): c is LineCell => c !== null)]
  if (est.kind === 'cold') {
    // 식은 캐시여도 바는 상태만(2026-10-14 uxi B1 안 A): "🧊 캐시 만료 · 컨텍스트 513k". 돈 숫자(다음 요청 ~$ · 바로 컴팩트하면 ~$ 덜 듦)는
    // 이지 컴팩트 설명 칩 · 확인 카드 · 패널 "지금" 줄에 — 같은 판단을 바에서 또 말하면 줄이 길어 좁은 바에서 낱말 중간에 꺾였다.
    // 예전 꼴 "첫 요청 재작성 $1.89 소비 · 컴팩트하면 $0.60 이득" 의 거쳐 온 판단(이득 · 손해는 말로, 금액엔 색 없음)은 확인 카드 · 칩이
    // 지킨다. 빨강 + 🧊(모델이면 🔄) — 파랑은 easy-compact · 진행만(같은 상태 두 색이던 것을 맞춤, 사용자 고름 2026-10-14)
    // 아이콘은 캡슐 꼴 Svg(빨강 — 바 바탕 위라 상태 색, 확인 카드 제목과 같은 그림), 터미널은 글만
    const isModel = est.reason === 'model'
    const stateWord = isModel ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')
    // 0.5 묶음 2: 옛 캡슐 아이콘은 뺐다 — 빨강 굵은 "캐시 만료" 글이 말하고, 상태 그림은 버튼 옆 게이지 하나
    cells.push({
      key: 'c-cold',
      text: stateWord,
      el: isFirst => (
        <Box columnGap={1} alignItems="center">
          {isFirst ? null : <Text dimColor> ·</Text>}
          <Text color="error" bold>
            {stateWord}
          </Text>
        </Box>
      ),
    })
    if (ctxCell) cells.push(ctxCell)
    return cells
  }
  // 요청당 = 지금 크기 × 읽기 요율 + 요청마다 읽기 말고 드는 실측 값(새로 쓰기 · 출력, 9a), 못 쟀으면 읽기만 — 색은 컨텍스트 색
  if (show.perRequest) {
    const perCall = `~${fmtUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`
    cells.push({
      key: 'c-call',
      drop: 2,
      text: `${L('요청당 ', 'Per request ')}${perCall}`,
      el: isFirst => (
        <Text>
          {dot(isFirst)}
          <Text dimColor>{L('요청당 ', 'Per request ')}</Text>
          <Text bold color={LEVEL_TEXT[level]}>
            {perCall}
          </Text>
        </Text>
      ),
    })
  }
  if (ctxCell) cells.push(ctxCell)
  if (rangeCell) cells.push(rangeCell)
  // 캐시 남은 분은 늘 — 컴팩트 직후(첫 요청 전)도 컴팩트 시각부터 센다(register.tsx refreshUsage). "캐시 만료까지 42분 남음":
  // 0.4.0 의 "42/60분" 은 점수처럼 읽혀 남은 시간으로 안 와닿았다. 요청마다 다시 차서
  // 일하는 동안은 유지 시간(60 · 5) 그대로 보이고, 유지 시간 종류는 패널 · 설정 캐시 칸에. 노랑 기준도 그 유지 시간 것.
  // 영어는 앞말이 "cache expires in " 이라 값은 "38m" 만 — "in 38m left" 로 겹쳤다(공개 세션 발견, 2026-10-13)
  if (show.cache && est.minsLeft !== null) {
    const mins = est.minsLeft
    const isLate = mins < cacheWarnFor(thresholds(), est.ttlMin)
    const cacheCell = (isShortForm: boolean): LineCell => ({
      key: 'c-cache',
      text: isShortForm ? L(`캐시 만료 ${mins}분 남음`, `cache expires in ${mins}m`) : L(`캐시 만료까지 ${mins}분 남음`, `cache expires in ${mins}m`),
      el: isFirst => (
        <Text>
          <Text dimColor>
            {(isFirst ? '' : ' · ') +
              (isShortForm ? L('캐시 만료 ', isFirst ? 'Cache expires in ' : 'cache expires in ') : L('캐시 만료까지 ', isFirst ? 'Cache expires in ' : 'cache expires in '))}
          </Text>
          <Text {...(isLate ? { color: 'warning' } : {})}>{L(`${mins}분 남음`, `${mins}m`)}</Text>
        </Text>
      ),
      ...(isShortForm ? {} : { drop: 2.1, short: cacheCell(true) }),
    })
    cells.push(cacheCell(isShort))
  }
  return cells
}

/**
 * 비용 줄(이 세션 금액과 지금 입력하면 드는 값)을 폭에 맞춰 — maxW 는 이 줄에 쓸 수 있는 칸(오른쪽 버튼을 뺀 것), null 이면 다 둔다.
 * show 로 이 세션 · 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시 칸을 뺀다(식은 캐시 줄은 경고라 컨텍스트 칸만 따른다) — 다 빠지면 el null
 */
export function fitEstimateLine(
  ui: Ui,
  u: Usage,
  nowMs: number,
  show: BandShow,
  colors: readonly [number, number, number],
  isShort: boolean,
  maxW: number | null,
  spend: SpendShown | null = null,
  /** 줄을 나눌 폭(기본 maxW) — 설정 미리보기는 칸을 빼지 않고(maxW null) 이 폭으로만 나눈다 */
  wrapW: number | null = maxW,
): LineFit {
  return fitLine(ui, costCells(ui, u, nowMs, show, colors, isShort, spend), maxW, wrapW)
}

/** 비용 줄(폭 맞춤 없이) — 설정 미리보기 · 예전 부르는 곳. inputs 는 예전 인자(지금은 안 쓴다) */
export function drawEstimateLine(
  ui: Ui,
  u: Usage,
  nowMs: number,
  _inputs: CompactInputs | null,
  show: BandShow = BASIC_SHOW,
  colors: readonly [number, number, number] = SESSION_COLORS_DEFAULT,
  isShort = false,
  spend: SpendShown | null = null,
  wrapW: number | null = null,
) {
  return fitEstimateLine(ui, u, nowMs, show, colors, isShort, null, spend, wrapW).el
}

/**
 * 캐시를 다시 쓴 값(rewriteOf 합)이 REWRITE_NOTE_USD 이상이면 그 값만 따로 — 캐시가 식었거나 모델을 바꾼 뒤 첫 요청은
 * 컨텍스트 전체를 다시 써서 합이 갑자기 커진다. 그 까닭을 보이는 것이라 이때만 노랑으로 붙인다.
 * 새 내용(파일 · 도구 결과)을 쓴 값 · 세션 첫 요청은 다시 쓴 게 아니라 넣지 않는다. 이전 판 기록(값 없음)엔 안 붙인다
 */
export function rewriteNote(ui: Ui, rewriteUsd: number | undefined) {
  const { Text } = ui
  if (rewriteUsd === undefined || rewriteUsd < REWRITE_NOTE_USD) return null
  return <Text color="warning">{L(` · 캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, ` · cache rewrite ${fmtUsd(rewriteUsd)}`)}</Text>
}

/**
 * 설정 탭 화면 칸의 바 미리보기 — 고른 화면 · 한도 줄 · 금액 색으로
 * 이 세션 값을 바(최대 크기)와 같은 줄 배치로 그린다(register.tsx AbovePrompt 의 줄 나눔과 같게). 버튼 자리는 흐린 글이라
 * 눌러지지 않는다. 한도 줄은 엔진이 한도를 준 세션(구독)에서만 — 바와 같다
 */
export function drawBandPreview(
  ui: Ui,
  surface: string,
  u: Usage | null,
  nowMs: number,
  inputs: CompactInputs | null,
  show: BandShow,
  colors: readonly [number, number, number],
  last: TurnSummary | null,
  isLean = false,
  spend: SpendShown | null = null,
  /** 견본 바 안쪽 폭(칸) — 비용 줄을 칸 사이에서 직접 나눈다(줄 머리 " · " 없이). 모르면 null(엔진이 꺾음) */
  boxW: number | null = null,
) {
  const { Box, Text } = ui
  // 간단 화면은 한 줄 고정 — 한도 줄을 안 그린다(바와 같다)
  const limits = !isLean && u && u.rateLimits.length > 0 ? drawLimitsLine(ui, surface, u, nowMs, show) : null
  const turn = show.lastTurn ? drawLastTurnLine(ui, last, null) : null
  const fake = (key: string, text: string) => (
    <Text key={key} dimColor>
      {text}
    </Text>
  )
  // 창 버튼은 바와 같게 — 바가 한 줄(간단 · 한도 줄 · 질문 줄 없음)이면 [—] 가 없다(register.tsx isOneRow). 간단 미리보기에도
  // "📊  —  ✕" 가 나왔다(공개 세션 발견, 2026-10-13)
  const isOneRow = isLean || (!limits && !show.lastTurn)
  // 0.5 묶음 2: 패널 버튼 ◔ · 터미널 "패널 ▸", 컴팩트 버튼 이름 "컴팩트"(바와 같은 이름 — 게이지 그림은 미리보기 글 줄에 못 넣어 뺌)
  const winText = onDesktop() ? (isOneRow ? '◔  ✕' : '◔  —  ✕') : isOneRow ? L('[패널 ▸] [✕]', '[Pane ▸] [✕]') : L('[패널 ▸] [—] [✕]', '[Pane ▸] [—] [✕]')
  const compactText = L('컴팩트', 'Compact')
  const win = fake('pv-win', winText)
  const compact = fake('pv-compact', compactText)
  // 질문 줄을 뺀 화면이면 이지 컴팩트는 비용 줄 오른쪽(한도 줄이 없으면 한 줄) — 바와 같은 규칙
  const hasTurnRow = show.lastTurn
  // 비용 줄 폭 = 견본 바 안쪽 − 같은 줄 오른쪽 글(줄 사이 2칸). 칸은 빼지 않고(최대 크기 견본) 이 폭으로만 나눈다
  const isTerm = !onDesktop()
  const estRight = limits ? (hasTurnRow ? 0 : widthOf(compactText, isTerm)) : hasTurnRow ? widthOf(winText, isTerm) : widthOf(compactText, isTerm) + 2 + widthOf(winText, isTerm)
  const estW = boxW === null ? null : Math.max(12, boxW - (estRight > 0 ? estRight + 2 : 0))
  const est = u ? drawEstimateLine(ui, u, nowMs, inputs, show, colors, false, spend, estW) : <Text dimColor>{L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes')}</Text>
  const line = (key: string, left: unknown, right: unknown) => (
    <Box key={key} columnGap={2} alignItems="flex-start">
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {left ?? <Text> </Text>}
      </Box>
      {right ? (
        <Box key={`${key}-r`} flexShrink={0} columnGap={2}>
          {right}
        </Box>
      ) : null}
    </Box>
  )
  const rows = limits
    ? [line('pv-1', limits, win), est ? line('pv-2', est, hasTurnRow ? null : compact) : null, hasTurnRow || !est ? line('pv-3', turn, compact) : null]
    : [line('pv-1', est, hasTurnRow ? win : [compact, win]), hasTurnRow ? line('pv-3', turn, compact) : null]
  return (
    <Box key="band-preview" flexDirection="column" {...TILE}>
      {rows}
    </Box>
  )
}

/**
 * 띠 질문 줄: 지난 질문 하나에 실제로 든 값(작업 중엔 이번 질문이 지금까지 쓴 값 — 요청이 끝날 때마다 늘어난다). 합 · 요청 수 —
 * 요청마다 든 값 · 읽기 · 쓰기 · 출력은 질문별 비용 패널에(띠에선 흐린 괄호가 길기만 하고 안 읽혔다). 요청 수는 에이전트
 * 요청까지, 에이전트는 "🤖 에이전트 1개 $1.93 포함" — 값 옆 "🤖 $" 만으론 질문 값과의 관계가 헷갈렸다. 질문이
 * 끝난 뒤 도는 백그라운드 에이전트도 "지난 질문" 줄에서 도는 중 → 끝남. 좁을 때 빼는 차례: 에이전트 → 요청 수(합 · "캐시 다시 씀"
 * 경고는 남김, 2026-10-14 uxi D1)
 */
export function fitLastTurnLine(ui: Ui, last: TurnSummary | null, now: LiveTurn | null, maxW: number | null): LineFit {
  const { Text } = ui
  const make = (head: string, cost: CostParts, steps: number, rewriteUsd: number | undefined, details: readonly StepDetail[] | undefined) => {
    const agents = agentPart(details, true)
    const calls = callsOf(steps, details)
    const rewrite = rewriteNote(ui, rewriteUsd)
    const cells: LineCell[] = [
      {
        key: 't-head',
        text: `${head}${fmtUsd(cost.usd)}`,
        el: () => (
          <Text>
            <Text dimColor>{head}</Text>
            <Text bold>{fmtUsd(cost.usd)}</Text>
          </Text>
        ),
      },
      { key: 't-calls', drop: 2, text: L(`요청 ${calls}회`, plural(calls, 'request')), el: () => <Text dimColor>{L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`)}</Text> },
    ]
    // B4(0.6.1 피드백): 🤖 대신 도트 캐릭터(데스크톱) — 이 질문 에이전트가 도는 동안만 걷는다
    if (agents) cells.push({ key: 't-agents', drop: 1, text: agents, el: () => agentText(ui, 't-agents-el', agents, agentSum(details)?.running === true, {}, ' · ') })
    if (rewrite && rewriteUsd !== undefined) cells.push({ key: 't-rewrite', text: L(`캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, `cache rewrite ${fmtUsd(rewriteUsd)}`), el: () => rewrite })
    return fitLine(ui, cells, maxW)
  }
  if (now && now.steps > 0) return make(L('진행 중 질문 ', 'This question '), now.cost, now.steps, now.rewriteUsd, now.details)
  if (!last) return { el: null, width: 0, over: false }
  return make(L('지난 질문 ', 'Last question '), last.cost, last.steps, last.rewriteUsd, last.details)
}

/** 띠 질문 줄(폭 맞춤 없이) — 설정 미리보기 */
export function drawLastTurnLine(ui: Ui, last: TurnSummary | null, now: LiveTurn | null) {
  return fitLastTurnLine(ui, last, now, null).el
}
