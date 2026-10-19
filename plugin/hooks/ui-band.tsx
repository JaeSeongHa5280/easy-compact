import type { BandShow, CompactInputs, CostParts, PartKey, PartShow, SlimKey, SlimShow, StepDetail, TurnSummary, Usage } from '../types'
import { approxUsd, cacheWarnFor, estimateFor, fmtUntil, fmtUsd, LEVEL_HEX, LEVEL_TEXT, levelOf, limitHex, REWRITE_NOTE_USD, sessionColorOf, thresholds, priceWarnings } from './cost'
import { L, plural } from './i18n'
import { bandShowOf, DEFAULT_SETTINGS, REVEAL_SQUARE, SESSION_COLORS_DEFAULT } from './settings'
import { agentPart, agentSum, callsOf, ctxNumText, limitName, rangeNumText, widthOf } from './text'
import type { CtxUnit } from './text'
import { iconOf, onDesktop, onTerminal, withIcon } from './glyph'
import { agentText, bar, CH_PX, decoIcon, gaugeEl, gaugeShapeNow, previewFrame, previewLabel, stageText, TILE } from './ui-common'
import { gaugeWidth } from './gauge'
import type { Ui } from './ui-common'
import type { FlashKey } from './flash'

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
/** 한도 막대 폭(px) — 앱 사용량 막대 꼴 */
const LIMIT_BAR_PX = 64

/**
 * 한도 %: 70% 아래는 흐리게(0.9.4 — 사용자 "여긴 컨텍스트가 아닌데 왜 여기만 흰색이야 18%? 이상함": 평소에도 밝은 흰 글이라 돈 값처럼
 * 튀었다), 70% 부터 주황 · 90% 부터 빨강
 */
function limitPct(ui: Ui, percent: number) {
  const { Text } = ui
  return <Text {...(percent >= 90 ? { color: 'error' } : percent >= 70 ? { color: 'warning' } : { dimColor: true })}>{`${Math.round(percent)}%`}</Text>
}

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
            {bar(ui, surface, r.percentUsed, limitHex(r.percentUsed), LIMIT_BAR_PX, L(`${limitName(r.kind)} 한도 ${r.percentUsed}%`, `${limitName(r.kind)} limit ${r.percentUsed}%`))}
            {limitPct(ui, r.percentUsed)}
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
/**
 * 바에 보일 오늘 · 이번 달 사용량(설정에서 켠 것만, 못 쟀으면 null) · 금액 색(1.0 — 설정 오늘 · 이번 달 금액 색 기준을 넘으면 노랑 · 주황 · 빨강,
 * 넘지 않으면 없음. 값 강조처럼 깜빡이지 않는다 — 사용자 2026-10-18 "넘어가면 맨날 깜빡여서")
 */
export type SpendShown = { today: number | null; month: number | null; todayColor?: string; monthColor?: string }

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

function costCellsRaw(
  ui: Ui,
  u: Usage,
  nowMs: number,
  show: BandShow,
  colors: readonly [number, number, number],
  isShort: boolean,
  spend: SpendShown | null = null,
  /** 0.9.4 바 A 칸 맞춤 — 캐시 칸을 짧은 꼴 "캐시 42분 남음"(열 폭은 가장 긴 꼴 "59분" 으로 어림) */
  isGrid = false,
): LineCell[] {
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
            {/* 1.0 값 강조(flash.ts): 색 단계가 오르면 바탕이 그 색으로 3번 깜빡 */}
            {stageText(ui, 'sess', color, fmtUsd(usd))}
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
  // 오늘 · 이번 달(설정에서 켰을 때만) — 이 세션 금액 바로 뒤 돈 묶음. 모든 세션 기록 합 + 기록 밖 요청 장부(0.7.0 피드백 M1)여도 다른
  // 기기 · 웹은 못 세 "~".
  // 좁으면 컴팩트 구간 → 요청당 → 캐시 짧은 꼴 다음에 이번 달 → 오늘 순으로 뺀다(사람이 켠 칸이라 캐시를 먼저 줄인다)
  // 금액 색(1.0)은 색만 — 값 강조(flashText)를 안 거친다
  const spendCell = (key: string, name: string, usd: number, drop: number, color: string | undefined): LineCell => ({
    key,
    drop,
    text: `${name}${fmtUsd(usd)}`,
    el: isFirst => (
      <Text>
        {dot(isFirst)}
        <Text dimColor>{name}</Text>
        <Text bold {...(color ? { color } : {})}>
          {fmtUsd(usd)}
        </Text>
      </Text>
    ),
  })
  if (spend?.today !== null && spend?.today !== undefined) cells.push(spendCell('c-today', L('오늘 ', 'Today '), spend.today, 2.4, spend.todayColor))
  if (spend?.month !== null && spend?.month !== undefined) cells.push(spendCell('c-month', L('이번 달 ', 'This month '), spend.month, 2.2, spend.monthColor))
  const level = levelOf(u.contextTokens)
  // 컴팩트 뒤 첫 요청 전이면 "컴팩트 직후" — 크기는 어림(엔진이 준 남긴 대화 + 기본 적재, flow.ts afterGuess)이라 "~"
  const isJust = u.contextEstimated === true || u.isAfterCompact === true
  const ctxNum = `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, ctxUnit)}`
  const ctxText = isJust ? L(`컨텍스트 ${ctxNum} 컴팩트 직후`, `Context ${ctxNum} just compacted`) : L(`컨텍스트 ${ctxNum}`, `Context ${ctxNum}`)
  const ctxCell: LineCell | null = !show.context
    ? null
    : {
        key: 'c-ctx',
        text: ctxText,
        // 0.9.4 바 A: 이름은 흐리게 · 값만 단계 색(예전엔 "컨텍스트" 이름까지 주황 · 빨강 — 다른 칸은 이름이 흐리다)
        el: isFirst => (
          <Text>
            {dot(isFirst)}
            <Text dimColor>{L('컨텍스트 ', 'Context ')}</Text>
            {stageText(ui, 'ctx', LEVEL_TEXT[level], ctxNum)}
            {isJust ? <Text dimColor>{L(' 컴팩트 직후', ' just compacted')}</Text> : null}
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
    // 0.5 묶음 2: 옛 캡슐 아이콘은 뺐다 — 빨강 굵은 "캐시 만료" 글이 말하고, 상태 그림은 버튼 옆 게이지 하나.
    // 1.0 값 강조(flash.ts 'cache'): 만료가 된 때 · 세션에 들어온 때 바탕 3번 깜빡
    cells.push({
      key: 'c-cold',
      text: stateWord,
      el: isFirst => (
        <Box columnGap={1} alignItems="center">
          {isFirst ? null : <Text dimColor> ·</Text>}
          {stageText(ui, 'cache', 'error', stateWord)}
        </Box>
      ),
    })
    if (ctxCell) cells.push(ctxCell)
    return cells
  }
  // 요청당 = 지금 크기 × 읽기 요율 + 요청마다 읽기 말고 드는 실측 값(새로 쓰기 · 출력, 9a), 못 쟀으면 읽기만 — 색은 컨텍스트 색
  if (show.perRequest) {
    const perCall = `${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`
    cells.push({
      key: 'c-call',
      drop: 2,
      text: `${L('요청당 ', 'Per request ')}${perCall}`,
      el: isFirst => (
        <Text>
          {dot(isFirst)}
          <Text dimColor>{L('요청당 ', 'Per request ')}</Text>
          {/* 1.0 값 강조: 요청당은 컨텍스트 단계 색이라 컨텍스트와 같은 때 깜빡 */}
          {stageText(ui, 'ctx', LEVEL_TEXT[level], perCall)}
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
    // 노랑(곧 만료)이 된 때 · 그때 세션에 들어온 때 남은 분이 3번 깜빡(flash.ts 'cache')
    const isLate = mins < cacheWarnFor(thresholds(), est.ttlMin)
    const lateColor = isLate ? 'warning' : undefined
    const cacheCell = (isShortForm: boolean): LineCell => ({
      key: 'c-cache',
      text: isShortForm ? L(`캐시 만료 ${mins}분 남음`, `cache expires in ${mins}m`) : L(`캐시 만료까지 ${mins}분 남음`, `cache expires in ${mins}m`),
      el: isFirst => (
        <Text>
          <Text dimColor>
            {(isFirst ? '' : ' · ') +
              (isShortForm ? L('캐시 만료 ', isFirst ? 'Cache expires in ' : 'cache expires in ') : L('캐시 만료까지 ', isFirst ? 'Cache expires in ' : 'cache expires in '))}
          </Text>
          {stageText(ui, 'cache', lateColor, L(`${mins}분 남음`, `${mins}m`), { bold: false })}
        </Text>
      ),
      ...(isShortForm ? {} : { drop: 2.1, short: cacheCell(true) }),
    })
    // 칸 맞춤: "캐시 42분 남음"(목표 시안 — 사용자 "바는 추천대로"). 폭 어림 글은 59분 — 분이 바뀌어도 열이 안 흔들린다
    const gridCell: LineCell = {
      key: 'c-cache',
      text: L('캐시 59분 남음', 'Cache 59m left'),
      el: () => (
        <Text>
          <Text dimColor>{L('캐시 ', 'Cache ')}</Text>
          {stageText(ui, 'cache', lateColor, L(`${mins}분`, `${mins}m`))}
          <Text dimColor>{L(' 남음', ' left')}</Text>
        </Text>
      ),
    }
    cells.push(isGrid ? gridCell : cacheCell(isShort))
  }
  return cells
}

/**
 * 0.9.4 바 A: 질문 줄 칸을 지금 값 칸 뒤에 이어 붙일 때 — 첫 칸(머리 "진행 중 질문 $X")은 원래 줄 맨 앞이라 " · " 를 안 붙였다. 앞 칸이
 * 있으면 붙인다(없으면 "… 30분 남음지난 질문 …" 처럼 붙어 읽혔다 — render 도구 90칸)
 */
export function afterCells(ui: Ui, cells: readonly LineCell[]): LineCell[] {
  const { Text } = ui
  return cells.map((c, i) =>
    i === 0
      ? {
          ...c,
          el: (isFirst: boolean) =>
            isFirst ? (
              c.el(true)
            ) : (
              <Text>
                <Text dimColor>{' · '}</Text>
                {c.el(true)}
              </Text>
            ),
        }
      : c,
  )
}

/** 0.9.4 바 A — 쌓인 돈 칸(최대 바 둘째 줄). 나머지(요청당 · 컨텍스트 · 컴팩트 구간 · 캐시 · 식은 캐시 상태)는 지금 값(셋째 줄) */
const MONEY_KEYS: ReadonlySet<string> = new Set(['c-session', 'c-today', 'c-month'])

/** 비용 줄 칸을 두 묶음으로 — 0.9.4 바 A 다시 묶기(쌓인 돈 / 지금 값). 묶음 안 순서는 설정 순서 그대로 */
export function costGroups(...args: Parameters<typeof costCellsRaw>): { money: LineCell[]; now: LineCell[] } {
  const cells = costCells(...args)
  return { money: cells.filter(c => MONEY_KEYS.has(c.key)), now: cells.filter(c => !MONEY_KEYS.has(c.key)) }
}

/**
 * 0.9.4 바 A 한도 줄 칸: 한도마다 [이름 · 막대 · %] · [리셋] 두 칸. text = 폭 어림 글 — 막대는 그 칸 수만큼 채운 글자, % 는 "100%",
 * 리셋은 가장 긴 꼴("23시간 59분 후 리셋")로 어림해 값이 바뀌어도 열이 안 흔들린다
 */
function limitCells(ui: Ui, surface: string, u: Usage, nowMs: number, show: BandShow): LineCell[] {
  const { Box, Text } = ui
  const barW = surface === 'terminal' ? 6 : Math.ceil(LIMIT_BAR_PX / CH_PX)
  const isTerm = surface === 'terminal'
  const cells: LineCell[] = []
  for (const r of u.rateLimits.filter(x => (x.kind === 'five_hour' ? show.fiveHour : x.kind === 'seven_day' ? show.sevenDay : true))) {
    const name = limitName(r.kind)
    cells.push({
      key: `bl-${r.kind}`,
      text: `${name} ${'0'.repeat(barW)} 100%`,
      el: () => (
        <Box key={`bl-${r.kind}-v`} columnGap={1} alignItems="center">
          <Text dimColor>{name}</Text>
          {bar(ui, surface, r.percentUsed, limitHex(r.percentUsed), LIMIT_BAR_PX, L(`${name} 한도 ${r.percentUsed}%`, `${name} limit ${r.percentUsed}%`))}
          {limitPct(ui, r.percentUsed)}
        </Box>
      ),
    })
    if (r.resetsAt && show.resets) {
      const reset = L(`${fmtUntil(r.resetsAt, nowMs)} 후 리셋`, `resets in ${fmtUntil(r.resetsAt, nowMs)}`)
      const longest = L('23시간 59분 후 리셋', 'resets in 23h 59m')
      cells.push({ key: `bl-${r.kind}-r`, text: widthOf(reset, isTerm) > widthOf(longest, isTerm) ? reset : longest, el: () => <Text dimColor>{reset}</Text> })
    }
  }
  return cells
}

/**
 * 0.9.4 바 A(uxi — 사용자 "바는 추천대로", 정본 0.9.md "uxi 다듬기"): 최대 바 세 줄을 다시 묶어(한도 / 쌓인 돈 / 지금 값 + 지난 질문)
 * 칸 맞춤 — 칸마다 같은 열 폭이라 줄마다 같은 세로줄에서 시작한다(예전엔 " · " 흐름이라 어느 세로줄도 안 맞았고 둘째 줄에 6칸이 몰렸다).
 * 열 폭 = 그 열에서 가장 넓은 칸(어림 글 — 리셋 · 캐시 · % 는 가장 긴 꼴이라 값이 바뀌어도 안 흔들림). 셋째 줄 끝 칸(질문 — 값 · 요청 수가
 * 자주 바뀐다)은 뒤에 아무것도 없어 열에 안 넣는다. 세 줄이 다 왼쪽 폭(leftW)에 들 때만 — 안 들면 null(부르는 쪽이 다시 묶은 흐름으로).
 * 1.0: 한도 줄은 열에 안 넣는다 — 0.9.4 는 한도 줄도 열에 맞춰 리셋 시각이 제 한도에서 떨어져 옆 열(오늘 · 컨텍스트) 값처럼 읽혔다. 한도 줄은 흐름 꼴(drawLimitsLine — 좁은 바의 흐름과 같은 꼴), 열 맞춤은
 * 아래 두 줄(쌓인 돈 · 지금 값)만
 */
export function bandGrid(
  ui: Ui,
  surface: string,
  u: Usage,
  nowMs: number,
  show: BandShow,
  colors: readonly [number, number, number],
  spend: SpendShown | null,
  last: TurnSummary | null,
  leftW: number,
): { limits: unknown; money: unknown | null; now: unknown } | null {
  const { Box } = ui
  const isTerm = surface === 'terminal'
  const lim = limitCells(ui, surface, u, nowMs, show)
  if (lim.length === 0) return null
  const groups = costGroups(ui, u, nowMs, show, colors, false, spend, true)
  const q = lastTurnCells(ui, last)
  // 데스크톱 글 폭 어림(ch)은 바 글꼴에서 한글 · 공백이 조금 모자라 칸마다 2 여유 — 1 이면 "컴팩트 구간 200k~250k" 가 두 줄로 꺾였다
  // (render 도구 130칸 — 19ch 칸에 약 19.5ch 글)
  const slack = isTerm ? 0 : 2
  const GAP = 2
  const w = (c: LineCell) => widthOf(c.text, isTerm) + slack
  // 한도 줄 폭(흐름): 한도마다 [이름 · 막대 · %] + 리셋("· " 와 사이 한 칸 = 3) · 한도 사이 3칸(drawLimitsLine columnGap)
  const isReset = (c: LineCell) => c.key.endsWith('-r')
  const limW = lim.reduce((s, c) => s + w(c) + (isReset(c) ? 3 : 0), 0) + 3 * Math.max(0, lim.filter(c => !isReset(c)).length - 1)
  const rows = [groups.money, groups.now]
  const n = Math.max(...rows.map(r => r.length))
  const colW = Array.from({ length: n }, (_, k) => Math.max(0, ...rows.map(r => (r[k] ? w(r[k]!) : 0))))
  const rowW = (r: readonly LineCell[], tail = 0) => r.reduce((s, _c, k) => s + colW[k]!, 0) + GAP * Math.max(0, r.length - 1) + (tail > 0 ? (r.length > 0 ? GAP : 0) + tail : 0)
  const qW = q ? q.reduce((s, c, i) => s + widthOf((i > 0 ? ' · ' : '') + c.text, isTerm), 0) + slack : 0
  if (limW > leftW || rowW(groups.money) > leftW || rowW(groups.now, qW) > leftW) return null
  const rowEl = (key: string, cells: readonly LineCell[], tail: unknown = null) =>
    cells.length === 0 && tail === null ? null : (
      <Box key={key} columnGap={GAP} alignItems="center">
        {cells.map((c, k) => (
          <Box key={c.key} width={colW[k]} flexShrink={0}>
            {c.el(true)}
          </Box>
        ))}
        {tail}
      </Box>
    )
  const qEl = q ? (
    <Box key="b-q" flexShrink={1} minWidth={0}>
      {fitLine(ui, q, null).el}
    </Box>
  ) : null
  return { limits: <Box key="bg-limits">{drawLimitsLine(ui, surface, u, nowMs, show)}</Box>, money: rowEl('bg-money', groups.money), now: rowEl('bg-now', groups.now, qEl) }
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

/** 바 미리보기 덧값(0.9.1 S13 · S12 · S14) — register 가 설정 · 이 세션 값으로 채운다 */
export type BandPreviewExtra = {
  /** 이름표 줄(바 전체 = "미리보기 · 입력창 위" + "?") — 없으면 "미리보기" */
  label?: unknown
  /** 무대: 바 견본을 입력창 모형 위에(바 전체 · 데스크톱만 — 조화 검토 ★) */
  stage?: boolean
  /** 바 크기 — 한 줄(min)이면 견본도 한 줄 꼴(S14) */
  band?: 'full' | 'min'
  /** 슬림 화면 칸(1.0) — 있으면 견본이 슬림 꼴: 평소(입력창 아래 버튼) · 컴팩트할 때(입력창 위 알림) 두 장면 */
  slim?: SlimShow
  /** 바 접어 두기 켬 — 맨 위에 접힌 모습(펴는 버튼 이름 — revealLabel) */
  foldedLabel?: string | null
  /** 입력창 아래 한 줄 켬 — 그 글(statusLineText) */
  statusLine?: string | null
  /** 1.0 진행 중 질문 칸 켬 — 진행 칸 견본(ui-answer liveSample, 데스크톱). 바 견본 아래 · 슬림은 "대답하는 동안" 장면 */
  live?: unknown
}

/**
 * 설정 탭 화면 칸의 바 미리보기 — 고른 화면 · 한도 줄 · 금액 색으로
 * 이 세션 값을 바(최대 크기)와 같은 줄 배치로 그린다(register.tsx AbovePrompt 의 줄 나눔과 같게). 버튼 자리는 흐린 글이라
 * 눌러지지 않는다. 한도 줄은 엔진이 한도를 준 세션(구독)에서만 — 바와 같다.
 * 0.9.1: 틀 = 미리보기 칩 + 옅은 바탕(S13 — 카드 안 카드로 읽히던 것), 컴팩트 자리에 게이지(S12 — 0.5 땐 글 줄에 그림을 못 넣어 뺐다,
 * 지금 줄은 상자라 넣는다 · 고른 꼴 · 이 세션 단계 색), 바 크기 한 줄 · 접어 두기 · 입력창 아래 한 줄도 견본에(S14 — uxi 점검: 옵션을 바꿔도
 * 견본이 그대로였다)
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
  /**
   * S10 · S11(0.8.1 — 사용자 "한 화면에 못 담으면 부분별로 나눠 그 구간만큼 미리보기"): all = 바 전체, limits · cost · turn = 그 줄만 —
   * 설정 바 탭에서 그 줄을 바꾸는 칸 바로 위에. 그 줄이 지금 화면에 없으면 까닭 한 줄
   */
  part: 'all' | 'limits' | 'cost' | 'turn' = 'all',
  extra: BandPreviewExtra = {},
) {
  const { Box, Text } = ui
  const label = extra.label ?? previewLabel(ui, `pv-label-${part}`, L('미리보기', 'Preview'))
  const frame = (key: string, body: unknown) => previewFrame(ui, key, label, body)
  // 간단 화면은 한 줄 고정 — 한도 줄을 안 그린다(바와 같다)
  const limits = !isLean && u && u.rateLimits.length > 0 ? drawLimitsLine(ui, surface, u, nowMs, show) : null
  const turn = show.lastTurn ? drawLastTurnLine(ui, last) : null
  const why = (key: string, text: string) =>
    frame(
      key,
      <Text key={`${key}-why`} dimColor wrap="wrap">
        {text}
      </Text>,
    )
  if (part === 'limits' && !limits) {
    return why(
      'band-preview-limits',
      isLean
        ? L('간단 화면은 바가 한 줄이라 한도 줄이 안 보입니다', 'The one-row Simple screen has no limits row')
        : u && u.rateLimits.length > 0
          ? L('한도 줄이 꺼져 있습니다', 'The limits row is off')
          : L('이 세션엔 한도 값이 아직 없습니다(첫 응답 뒤 · API 키 세션엔 없음)', 'No limit values in this session yet (after the first answer · none with an API key)'),
    )
  }
  if (extra.slim && part === 'all') return drawSlimPreview(ui, surface, u, nowMs, extra.slim, colors, label, extra.live ?? null)
  if (part === 'turn' && (isLean || !turn)) {
    return why('band-preview-turn', isLean ? L('간단 화면은 바가 한 줄이라 질문 줄이 안 보입니다', 'The one-row Simple screen has no question row') : L('질문 줄이 꺼져 있습니다', 'The question row is off'))
  }
  const fake = (key: string, text: string) => (
    <Text key={key} dimColor>
      {text}
    </Text>
  )
  // 창 버튼은 바와 같게 — 바가 한 줄(간단 · 한도 줄 · 질문 줄 없음)이면 [—] 가 없다(register.tsx isOneRow). 간단 미리보기에도
  // "📊  —  ✕" 가 나왔다(공개 세션 발견, 2026-10-13)
  const isOneRow = isLean || (!limits && !show.lastTurn)
  // S14: 바 크기 한 줄(최소)이면 견본도 한 줄 — 비용 줄 + [게이지 컴팩트] + □ ✕(ui-bar 최소 꼴). 바가 원래 한 줄이면 같다
  const isMin = extra.band === 'min' && !isOneRow
  const isTerm = !onDesktop()
  // B5(0.7.0 피드백): 데스크톱은 게이지가 패널 문이라 창 버튼은 — ✕ 만(최소면 □ ✕)
  const winText = !isTerm ? (isOneRow ? '✕' : isMin ? '□  ✕' : '—  ✕') : isOneRow ? L('[패널 ▸] [✕]', '[Pane ▸] [✕]') : isMin ? L('[패널 ▸] [□] [✕]', '[Pane ▸] [□] [✕]') : L('[패널 ▸] [—] [✕]', '[Pane ▸] [—] [✕]')
  // 컴팩트 버튼 이름 = 바와 같은 말(이 세션 단계 — 최소 데스크톱은 늘 짧은 "컴팩트"), 왼쪽에 게이지(S12 — 데스크톱만, 고른 꼴 · 움직임 없이)
  const ctx = u && u.contextTokens > 0 ? u.contextTokens : 0
  const lv = ctx > 0 ? levelOf(ctx) : 'ok'
  const isRange = thresholds().isRange === true
  const compactText =
    isMin && !isTerm
      ? L('컴팩트', 'Compact')
      : lv === 'cut'
        ? isRange
          ? L('컴팩트 늦어짐', 'Compact overdue')
          : L('컴팩트 권장', 'Compact advised')
        : lv === 'warn'
          ? isRange
            ? L('컴팩트할 때', 'Time to compact')
            : L('곧 컴팩트할 때', 'Compact soon')
          : L('컴팩트', 'Compact')
  const gauge = gaugeEl(ui, surface, ctx, {
    key: 'pv-gauge-svg',
    alt: ctx > 0 ? L(`컨텍스트 견본 ${Math.round(ctx / 1000)}k`, `Sample context ${Math.round(ctx / 1000)}k`) : L('컨텍스트 견본', 'Sample context'),
    px: 16,
    motion: false,
  })
  const gaugeCols = gauge ? Math.ceil(gaugeWidth(gaugeShapeNow(), 16) / CH_PX) + 1 : 0
  const win = fake('pv-win', winText)
  const compact = (
    <Box key="pv-compact" columnGap={1} alignItems="center">
      {gauge ? <Box key="pv-gauge">{gauge}</Box> : null}
      {fake('pv-compact-name', compactText)}
    </Box>
  )
  // 질문 줄을 뺀 화면이면 이지 컴팩트는 비용 줄 오른쪽(한도 줄이 없으면 한 줄) — 바와 같은 규칙
  const hasTurnRow = show.lastTurn
  // 비용 줄 폭 = 견본 바 안쪽 − 같은 줄 오른쪽 글(줄 사이 2칸). 칸은 빼지 않고(최대 크기 견본) 이 폭으로만 나눈다
  const compactW = gaugeCols + widthOf(compactText, isTerm)
  const estRight = isMin ? compactW + 2 + widthOf(winText, isTerm) : limits ? (hasTurnRow ? 0 : compactW) : hasTurnRow ? widthOf(winText, isTerm) : compactW + 2 + widthOf(winText, isTerm)
  // 무대(테두리 상자 · 안쪽 여백)만큼 안쪽 폭이 준다
  const stageW = extra.stage && !isTerm ? 4 : 0
  const estW = boxW === null ? null : Math.max(12, boxW - stageW - (estRight > 0 ? estRight + 2 : 0))
  const est = u ? drawEstimateLine(ui, u, nowMs, inputs, show, colors, false, spend, estW) : <Text dimColor>{L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes')}</Text>
  const line = (key: string, left: unknown, right: unknown) => (
    <Box key={key} columnGap={2} alignItems="flex-start">
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {left ?? <Text> </Text>}
      </Box>
      {right ? (
        <Box key={`${key}-r`} flexShrink={0} columnGap={2} alignItems="center">
          {right}
        </Box>
      ) : null}
    </Box>
  )
  // 줄 미리보기(S10): 그 줄 글만 — 창 버튼은 바 전체에만, 컴팩트 버튼은 질문 줄 끝에(바와 같은 자리)
  if (part !== 'all') {
    const one = part === 'limits' ? line('pv-1', limits, null) : part === 'cost' ? line('pv-2', est, null) : line('pv-3', turn, compact)
    return frame(`band-preview-${part}`, one)
  }
  // 0.9.4 바 A: 바 전체 견본도 바처럼 다시 묶고(쌓인 돈 / 지금 값 + 질문), 폭을 알고 다 들면 칸 맞춤(bandGrid)
  const isRegroup = !isMin && limits !== null && hasTurnRow && u !== null
  const regrouped = (() => {
    if (!isRegroup || !u) return null
    const rightW = Math.max(widthOf(winText, isTerm), compactW)
    const grid = boxW === null ? null : bandGrid(ui, surface, u, nowMs, show, colors, spend, last, boxW - stageW - rightW - 2)
    if (grid) return [line('pv-1', grid.limits, win), grid.money ? line('pv-2', grid.money, null) : null, line('pv-3', grid.now, compact)]
    const g = costGroups(ui, u, nowMs, show, colors, false, spend)
    const q = afterCells(ui, lastTurnCells(ui, last) ?? [])
    const money = fitLine(ui, g.money, null, boxW === null ? null : Math.max(12, boxW - stageW)).el
    const nowLine = fitLine(ui, [...g.now, ...q], null, boxW === null ? null : Math.max(12, boxW - stageW - compactW - 2)).el
    return [line('pv-1', limits, win), money ? line('pv-2', money, null) : null, line('pv-3', nowLine, compact)]
  })()
  const rows = isMin
    ? [line('pv-min', est, [compact, win])]
    : regrouped
      ? regrouped
      : limits
        ? [line('pv-1', limits, win), est ? line('pv-2', est, hasTurnRow ? null : compact) : null, hasTurnRow || !est ? line('pv-3', turn, compact) : null]
        : [line('pv-1', est, hasTurnRow ? win : [compact, win]), hasTurnRow ? line('pv-3', turn, compact) : null]
  // 무대(S13 ★ — 바 전체 · 데스크톱): 바 견본을 테두리 상자에, 그 아래 입력창 모형 — "입력창 위에 뜨는 바"를 그대로
  const isStage = extra.stage === true && !isTerm
  // 1.0 진행 칸 견본은 바 카드 안 아래(실물과 같은 자리 — 사용자 2026-10-18 "미리보기 바에 왜 질문 표시 내용은 반영 안 해 줘?")
  const barBox = isStage ? (
    <Box key="pv-bar" flexDirection="column" borderStyle="round" borderColor="promptBorder" paddingX={1} paddingY={0}>
      {rows}
      {extra.live ?? null}
    </Box>
  ) : (
    <Box key="pv-bar" flexDirection="column">
      {rows}
    </Box>
  )
  const input = isStage ? (
    // 입력창 모형은 자리 표만(흐린 테두리 · 가운데 "입력창") — "메시지 입력 ↑" 은 쳐 넣을 수 있는 칸처럼 보였다
    <Box key="pv-input" borderStyle="round" borderColor="promptBorder" borderDimColor paddingX={1} justifyContent="center" alignItems="center">
      <Text dimColor>{L('입력창', 'Prompt box')}</Text>
    </Box>
  ) : null
  // S14: 접어 두기 켬 — 맨 위에 접힌 모습(펴는 버튼 — 데스크톱 입력창 아래 · 터미널 바 자리), 그 아래 "펼치면" 바 견본
  const folded = extra.foldedLabel ? (
    <Box key="pv-folded" flexDirection="column">
      <Text dimColor>{isTerm ? L('접힌 모습 · 바 자리', 'Folded · in the bar’s place') : L('접힌 모습 · 입력창 아래', 'Folded · below the input')}</Text>
      <Box key="pv-folded-btn" alignSelf="flex-start" borderStyle="round" borderColor="promptBorder" paddingX={1} paddingY={0}>
        <Text>{extra.foldedLabel}</Text>
      </Box>
      <Text dimColor>{L('펼치면', 'When opened')}</Text>
    </Box>
  ) : null
  // S14: 입력창 아래 한 줄 켬 — 바닥 띠 글(statusLineText)
  const status = extra.statusLine ? (
    <Box key="pv-status" flexDirection="column">
      <Text dimColor>{L('입력창 아래 한 줄', 'Line below the input')}</Text>
      <Text wrap="truncate-end">{extra.statusLine}</Text>
    </Box>
  ) : null
  return frame(
    'band-preview',
    <Box key="band-preview-body" flexDirection="column" rowGap={isStage ? 1 : 0}>
      {folded}
      {barBox}
      {input}
      {status}
    </Box>,
  )
}

/**
 * 띠 질문 줄: 지난 질문 하나에 실제로 든 값(1.0 — 대답하는 동안에도 지난 질문: 이번 질문 값은 칸 "진행 중 질문 칸"(데스크톱 입력창 바로 위 ·
 * 터미널 작업 줄)이 따로 — 두 칸은 서로 독립, 사용자 2026-10-18 "서로서로 독립 셋팅"). 합 · 요청 수 —
 * 요청마다 든 값 · 읽기 · 쓰기 · 출력은 질문별 비용 패널에(띠에선 흐린 괄호가 길기만 하고 안 읽혔다). 요청 수는 에이전트
 * 요청까지, 에이전트는 "🤖 에이전트 1개 $1.93 포함" — 값 옆 "🤖 $" 만으론 질문 값과의 관계가 헷갈렸다. 질문이
 * 끝난 뒤 도는 백그라운드 에이전트도 "지난 질문" 줄에서 도는 중 → 끝남. 좁을 때 빼는 차례: 에이전트 → 요청 수(합 · "캐시 다시 씀"
 * 경고는 남김, 2026-10-14 uxi D1)
 */
export function fitLastTurnLine(ui: Ui, last: TurnSummary | null, maxW: number | null): LineFit {
  const cells = lastTurnCells(ui, last)
  return cells ? fitLine(ui, cells, maxW) : { el: null, width: 0, over: false }
}

/** 띠 질문 줄의 칸(지난 질문) — 없으면 null. 0.9.4 바 A 는 지금 값 칸 뒤에 이어 붙인다 */
export function lastTurnCells(ui: Ui, last: TurnSummary | null): LineCell[] | null {
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
    if (agents) cells.push({ key: 't-agents', drop: 1, text: agents, el: () => agentText(ui, 't-agents-el', agents, (agentSum(details)?.runningCount ?? 0), {}, ' · ') })
    if (rewrite && rewriteUsd !== undefined) cells.push({ key: 't-rewrite', text: L(`캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, `cache rewrite ${fmtUsd(rewriteUsd)}`), el: () => rewrite })
    return cells
  }
  if (!last) return null
  return make(L('지난 질문 ', 'Last question '), last.cost, last.steps, last.rewriteUsd, last.details)
}

/** 띠 질문 줄(폭 맞춤 없이) — 설정 미리보기 */
export function drawLastTurnLine(ui: Ui, last: TurnSummary | null) {
  return fitLastTurnLine(ui, last, null).el
}

/**
 * 슬림 칸(1.0 — Settings.slim, 시안 3판): 지금 보일 칸만, 급한 차례(한도 → 캐시 → 세션 → 요청당 → 오늘 · 이번 달 → 구간). 컨텍스트 ·
 * 컴팩트 버튼은 따로(아래 버튼의 값 · 위 알림의 버튼). text = 아래 버튼 글(버튼 안 글은 앱 버튼 색이라 색을 못 낸다), el = 위 알림 칸(색).
 * 필요할 때 = 지금 색이 바뀌는 문턱(한도 70% · 캐시 경고 분 · 세션 금액 색 첫 기준 · 요청당은 컴팩트할 때부터). 식은 캐시면 캐시 칸 자리에
 * "캐시 만료" · "모델 바뀜"(빨강) — 다음 요청이 전체를 다시 써 꼭 볼 값이라 캐시 칸이 끔이 아니면 늘
 */
export function slimParts(ui: Ui, u: Usage, nowMs: number, view: SlimShow, colors: readonly [number, number, number], spend: SpendShown | null): LineCell[] {
  const { Text } = ui
  const shown = (k: SlimKey, need: boolean) => view[k] === 'on' || (view[k] === 'need' && need)
  const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor> · </Text>)
  // flash = 값 강조 칸(flash.ts — 색 단계가 오르면 바탕 3번 깜빡)
  const named = (key: string, name: string, value: string, color?: string, flash?: FlashKey): LineCell => ({
    key,
    text: `${name}${value}`,
    el: isFirst => (
      <Text>
        {dot(isFirst)}
        <Text dimColor>{name}</Text>
        {flash ? stageText(ui, flash, color, value) : <Text bold {...(color ? { color } : {})}>{value}</Text>}
      </Text>
    ),
  })
  const cells: LineCell[] = []
  for (const r of u.rateLimits) {
    if ((r.kind !== 'five_hour' && r.kind !== 'seven_day') || !shown(r.kind === 'five_hour' ? 'lim5' : 'lim7', r.percentUsed >= 70)) continue
    const pct = `${Math.round(r.percentUsed)}%`
    const reset = view.resets === 'on' && r.resetsAt ? L(`${fmtUntil(r.resetsAt, nowMs)} 후 리셋`, `resets in ${fmtUntil(r.resetsAt, nowMs)}`) : null
    const name = `${limitName(r.kind)} `
    const pctEl = (
      <Text bold {...(r.percentUsed >= 90 ? { color: 'error' } : r.percentUsed >= 70 ? { color: 'warning' } : {})}>
        {pct}
      </Text>
    )
    // 짧은 꼴(리셋 시각 뺌): 아래 버튼 글 · 좁은 알림 줄
    const short: LineCell = {
      key: `s-lim-${r.kind}`,
      text: `${name}${pct}`,
      el: isFirst => (
        <Text>
          {dot(isFirst)}
          <Text dimColor>{name}</Text>
          {pctEl}
        </Text>
      ),
    }
    cells.push({
      key: `s-lim-${r.kind}`,
      text: `${name}${pct}${reset ? ` · ${reset}` : ''}`,
      el: isFirst => (
        <Text>
          {dot(isFirst)}
          <Text dimColor>{name}</Text>
          {pctEl}
          {reset ? <Text dimColor>{` · ${reset}`}</Text> : null}
        </Text>
      ),
      ...(reset ? { drop: 1, short } : {}),
    })
  }
  const level = levelOf(u.contextTokens)
  const est = estimateFor(u, nowMs)
  if (est.kind === 'cold') {
    if (view.cache !== 'off') {
      const word = est.reason === 'model' ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')
      cells.push({
        key: 's-cold',
        text: word,
        el: isFirst => (
          <Text>
            {dot(isFirst)}
            {stageText(ui, 'cache', 'error', word)}
          </Text>
        ),
      })
    }
  } else if (est.kind !== 'unpriced' && est.minsLeft !== null) {
    const isLate = est.minsLeft < cacheWarnFor(thresholds(), est.ttlMin)
    if (shown('cache', isLate)) cells.push(named('s-cache', L('캐시 ', 'Cache '), L(`${est.minsLeft}분`, `${est.minsLeft}m`), isLate ? 'warning' : undefined, 'cache'))
  }
  if (u.costUsd !== null) {
    const color = sessionColorOf(u.costUsd, colors)
    if (shown('sess', color !== null)) cells.push(named('s-sess', L('세션 ', 'Session '), fmtUsd(u.costUsd), color ?? undefined, 'sess'))
  }
  if (est.kind !== 'cold' && est.kind !== 'unpriced' && shown('req', level !== 'ok')) {
    cells.push(named('s-req', L('요청당 ', 'Per request '), `${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`, LEVEL_TEXT[level], 'ctx'))
  }
  if (spend) {
    // 금액 색(1.0) — 깜빡임(flash) 없이 색만
    if (view.today === 'on' && spend.today !== null) cells.push(named('s-today', L('오늘 ', 'Today '), fmtUsd(spend.today), spend.todayColor))
    if (view.month === 'on' && spend.month !== null) cells.push(named('s-month', L('이번 달 ', 'This month '), fmtUsd(spend.month), spend.monthColor))
  }
  if (view.range === 'on') cells.push(named('s-range', L('구간 ', 'Range '), rangeNumText(thresholds(), u.window, ctxUnit)))
  return cells
}

/**
 * 1.0 슬림 요약 한 줄(아래 버튼 · 게이지를 누르면 — 사용자 "슬림도 한 줄 볼 수 있어야 · 항상 컴팩트 시점하고 나오니까 슬림이 아닌데"): 컨텍스트 ·
 * 다음 요청 · 캐시 + 슬림에서 고른 칸(필요할 때도 늘처럼 — 보려고 연 것). 컴팩트 시점 막대 · 표는 패널 몫(공부는 옆)
 */
export function slimSummaryCells(ui: Ui, u: Usage, nowMs: number, view: SlimShow, colors: readonly [number, number, number], spend: SpendShown | null): LineCell[] {
  const { Text } = ui
  const level = levelOf(u.contextTokens)
  const est = estimateFor(u, nowMs)
  const color = LEVEL_TEXT[level]
  const cell = (key: string, name: string, value: string, c?: string, flash?: FlashKey): LineCell => ({
    key,
    text: `${name}${value}`,
    el: isFirst => (
      <Text>
        {isFirst ? null : <Text dimColor> · </Text>}
        <Text dimColor>{name}</Text>
        {flash ? stageText(ui, flash, c, value) : <Text bold {...(c ? { color: c } : {})}>{value}</Text>}
      </Text>
    ),
  })
  const head: LineCell[] = [cell('s-ctx', L('컨텍스트 ', 'Context '), `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, ctxUnit)}`, color, 'ctx')]
  // 다음 요청도 강조: 식은 캐시면 캐시 만료와 같은 때(다시 쓰는 값), 아니면 컨텍스트와 같은 때
  if (est.kind === 'cold') head.push(cell('s-next', L('다음 요청 ', 'Next request '), `${approxUsd(est.rewriteUsd)}`, 'error', 'cache'))
  else if (est.kind !== 'unpriced') head.push(cell('s-next', L('다음 요청 ', 'Next request '), `${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`, color, 'ctx'))
  const all = Object.fromEntries(Object.entries(view).map(([k, v]) => [k, v === 'off' ? 'off' : 'on'])) as SlimShow
  return [...head, ...slimParts(ui, u, nowMs, { ...all, req: 'off', cache: 'on' }, colors, spend)]
}

/**
 * 바 칸(켬/끔)을 지금 값으로(1.0 — 칸 단계 "끔 · 필요할 때 · 늘", 사용자 "필요할 때 · 늘 · 끄기 옵션이 기본 옵션에서도"): 늘 = 켬, 필요할 때 =
 * 그 문턱부터(한도 70% · 세션 금액 색 첫 기준 · 컴팩트할 때 · 캐시 경고 분 아래 · 만료), 끔 = 끔. 한도 줄은 보일 한도가 없으면 줄째 빠진다
 */
export function bandShowNow(view: PartShow, u: Usage | null, nowMs: number, colors: readonly [number, number, number]): BandShow {
  const lvl = (k: PartKey, need: boolean) => view[k] === 'on' || (view[k] === 'need' && need)
  const level = u && u.contextTokens > 0 ? levelOf(u.contextTokens) : 'ok'
  const est = u ? estimateFor(u, nowMs) : null
  const limHigh = (kind: string) => (u?.rateLimits ?? []).some(r => r.kind === kind && r.percentUsed >= 70)
  const cacheNeed = est !== null && (est.kind === 'cold' || (est.kind !== 'unpriced' && est.minsLeft !== null && est.minsLeft < cacheWarnFor(thresholds(), est.ttlMin)))
  return {
    fiveHour: lvl('lim5', limHigh('five_hour')),
    sevenDay: lvl('lim7', limHigh('seven_day')),
    resets: view.resets === 'on' && (view.lim5 !== 'off' || view.lim7 !== 'off'),
    session: lvl('sess', u !== null && u.costUsd !== null && sessionColorOf(u.costUsd, colors) !== null),
    perRequest: lvl('req', level !== 'ok'),
    context: lvl('ctx', level !== 'ok'),
    range: view.range === 'on',
    cache: lvl('cache', cacheNeed),
    lastTurn: view.last === 'on',
  }
}

/** 슬림 아래 버튼에 넣는 칸 수 — 넘치는 칸(셋째부터)은 입력창 위 알림 카드로 */
export const SLIM_BUTTON_PARTS = 2

/**
 * 슬림 아래 버튼 글(1.0): 단계 색 네모(데스크톱) + 컨텍스트(늘 · 필요할 때 = 컴팩트할 때부터) + 보일 칸 두 개까지. 버튼 안 글은 색을 못 내
 * 네모가 단계를 말한다(접힘 C 와 같은 꼴). 터미널은 그림 글자 없이 글로. 요약 카드가 열려 있으면 끝에 ▴
 */
/** isOpen: 참 = 요약이 위에 열림(▴), 'side' = 현황이 옆 패널에 열림(▸ — 1.0 사용자 "패널이 열린 느낌이 없음"), 거짓 = 둘 다 닫힘 */
export function slimButtonText(u: Usage | null, parts: readonly LineCell[], view: SlimShow, unit: CtxUnit, isOpen: boolean | 'side' = false, isTerminal = false): string {
  const level = u && u.contextTokens > 0 ? levelOf(u.contextTokens) : 'ok'
  const ctx = u && u.contextTokens > 0 && (view.ctx === 'on' || level !== 'ok') ? `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, unit)}` : null
  // 버튼엔 짧은 꼴(한도는 리셋 시각 없이 — 렌더 확인 2026-10-17: "5시간 42% · 2시간 30분 후 리셋 · 7일 17% · …" 로 버튼이 줄 끝까지 늘었다)
  const words = [ctx, ...parts.slice(0, SLIM_BUTTON_PARTS).map(p => (p.short ?? p).text)].filter((w): w is string => w !== null && w !== '')
  const body = words.length > 0 ? words.join(' · ') : L('이지 컴팩트', 'Easy Compact')
  const mark = isOpen === 'side' ? ' ▸' : isOpen ? ' ▴' : ''
  return isTerminal ? `${body}${mark}` : `${REVEAL_SQUARE[level]} ${body}${mark}`
}

/**
 * 슬림 견본(설정 바 탭 — 1.0): 두 장면 — 평소(입력창 위엔 없고 입력창 아래 버튼 하나) · 컴팩트할 때(입력창 위 알림 한 줄). 값은 견본(평소 =
 * 이 세션이 여유면 그 값, 아니면 구간 앞), 버튼은 흐린 글이라 눌러지지 않는다
 */
export function drawSlimPreview(ui: Ui, surface: string, u: Usage | null, nowMs: number, view: SlimShow, colors: readonly [number, number, number], label: unknown, live: unknown = null) {
  const { Box, Text } = ui
  const isTerm = !onDesktop()
  const thr = thresholds()
  const okCtx = u && u.contextTokens > 0 && levelOf(u.contextTokens) === 'ok' ? u.contextTokens : Math.round(thr.ctxWarn * 0.6)
  const warnCtx = Math.round((thr.ctxWarn + thr.ctxCut) / 2)
  const win = u?.window ?? 1_000_000
  const sample = (ctx: number): Usage | null => (u ? { ...u, contextTokens: ctx, contextEstimated: false } : null)
  const okU = sample(okCtx)
  const okParts = okU ? slimParts(ui, okU, nowMs, view, colors, null) : []
  const okLabel = okU ? slimButtonText(okU, okParts, view, ctxUnit, false, isTerm) : isTerm ? ctxNumText(okCtx, win, ctxUnit) : `${REVEAL_SQUARE.ok} ${ctxNumText(okCtx, win, ctxUnit)}`
  const warnLabel = isTerm ? ctxNumText(warnCtx, win, ctxUnit) : `${REVEAL_SQUARE.warn} ${ctxNumText(warnCtx, win, ctxUnit)}`
  const isRange = thr.isRange === true
  // 넘은 값은 바와 같은 셈(ctxNumText — 단위까지). 구간 글을 ~ 에서 자르면 % 꼴에서 단위가 떨어졌다("25 넘음" — 사용자 실물)
  const why = isRange ? L(`컴팩트할 때 · ${ctxNumText(thr.ctxWarn, win, ctxUnit)} 넘음`, `Time to compact · past ${ctxNumText(thr.ctxWarn, win, ctxUnit)}`) : L('곧 컴팩트할 때', 'Compact soon')
  const fakeBtn = (key: string, text: string) => (
    <Box key={key} alignSelf="flex-start" borderStyle="round" borderColor="promptBorder" paddingX={1} paddingY={0}>
      <Text>{text}</Text>
    </Box>
  )
  const input = (key: string) =>
    isTerm ? null : (
      <Box key={key} borderStyle="round" borderColor="promptBorder" borderDimColor paddingX={1} justifyContent="center" alignItems="center">
        <Text dimColor>{L('입력창', 'Prompt box')}</Text>
      </Box>
    )
  const gauge = gaugeEl(ui, surface, warnCtx, { key: 'pv-slim-gauge', alt: L('컨텍스트 견본', 'Sample context'), px: 16, motion: false })
  const alert = (
    <Box key="pv-slim-alert" columnGap={2} alignItems="center" justifyContent="space-between" borderStyle={isTerm ? undefined : 'round'} borderColor="promptBorder" paddingX={isTerm ? 0 : 1}>
      <Box key="pv-slim-alert-l" columnGap={1} alignItems="center" flexShrink={1} minWidth={0}>
        {gauge ? <Box key="pv-slim-g">{gauge}</Box> : null}
        <Text color="warning" bold>
          {why}
        </Text>
      </Box>
      <Text key="pv-slim-alert-r" dimColor>
        {L('[이지 컴팩트]  ✕', '[Easy Compact]  ✕')}
      </Text>
    </Box>
  )
  return previewFrame(
    ui,
    'band-preview',
    label,
    <Box key="band-preview-body" flexDirection="column" rowGap={1}>
      <Box key="pv-slim-ok" flexDirection="column">
        <Text dimColor>{isTerm ? L('평소 · 바 자리 한 줄', 'Usually · one line in the bar’s place') : L('평소 · 입력창 위엔 없고 아래 버튼 하나', 'Usually · nothing above the input, one button below')}</Text>
        {input('pv-slim-input-ok')}
        {fakeBtn('pv-slim-btn-ok', okLabel)}
      </Box>
      <Box key="pv-slim-warn" flexDirection="column">
        <Text dimColor>{L('컴팩트할 때 · 입력창 위 알림', 'Time to compact · alert above the input')}</Text>
        {alert}
        {input('pv-slim-input-warn')}
        {fakeBtn('pv-slim-btn-warn', warnLabel)}
      </Box>
      {/* 1.0 진행 중 질문 칸 켬: 대답하는 동안 입력창 바로 위 한 줄(위에 바가 없어 윗선 없이) */}
      {live ? (
        <Box key="pv-slim-live" flexDirection="column">
          <Text dimColor>{L('대답하는 동안 · 입력창 바로 위', 'While answering · right above the input')}</Text>
          <Box key="pv-slim-live-card" flexDirection="column" borderStyle="round" borderColor="promptBorder" paddingX={1}>
            {live}
          </Box>
          {input('pv-slim-input-live')}
        </Box>
      ) : null}
    </Box>,
  )
}
