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

export function minShowOf(show: BandShow): BandShow {
  return { ...show, fiveHour: false, sevenDay: false, resets: false, range: false, lastTurn: false }
}

const BASIC_SHOW: BandShow = bandShowOf({ ...DEFAULT_SETTINGS, screen: 'detail' })

const LIMIT_BAR_PX = 64

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

export type LineCell = { key: string; text: string; el: (isFirst: boolean) => unknown; drop?: number; short?: LineCell }

export type LineFit = { el: unknown; width: number; over: boolean }

const SEP = ' · '

function lineWidth(cells: readonly LineCell[]): number {
  const isTerm = onTerminal()
  return cells.reduce((sum, c, i) => sum + widthOf((i === 0 ? '' : SEP) + c.text, isTerm), 0)
}

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

export type SpendShown = { today: number | null; month: number | null; todayColor?: string; monthColor?: string }

let bandOrder: readonly string[] = ['session', 'today', 'month', 'perRequest', 'context', 'range', 'cache']

export function setBandOrder(order: readonly string[]): void {
  bandOrder = order
}

let ctxUnit: CtxUnit = 'size'

export function setCtxUnit(unit: CtxUnit): void {
  ctxUnit = unit
}

export function ctxUnitNow(): CtxUnit {
  return ctxUnit
}

const ORDER_OF: Record<string, string> = { 'c-session': 'session', 'c-today': 'today', 'c-month': 'month', 'c-call': 'perRequest', 'c-ctx': 'context', 'c-range': 'range', 'c-cache': 'cache' }

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
  isGrid = false,
): LineCell[] {
  const { Box, Text } = ui
  const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor> · </Text>)
  const cells: LineCell[] = []
  if (show.session && u.costUsd !== null) {
    const usd = u.costUsd
    const color = sessionColorOf(usd, colors)
    const warns = priceWarnings(u.model, u.window)
    cells.push({
      key: 'c-session',
      text: `${L('세션 ', 'Session ')}${fmtUsd(usd)}${warns.length > 0 ? ' ⚠' : ''}`,
      el: isFirst => {
        const line = (
          <Text>
            {dot(isFirst)}
            <Text dimColor>{L('세션 ', 'Session ')}</Text>
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
  const isJust = u.contextEstimated === true || u.isAfterCompact === true
  const ctxNum = `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, ctxUnit)}`
  const ctxText = isJust ? L(`컨텍스트 ${ctxNum} 컴팩트 직후`, `Context ${ctxNum} just compacted`) : L(`컨텍스트 ${ctxNum}`, `Context ${ctxNum}`)
  const ctxCell: LineCell | null = !show.context
    ? null
    : {
        key: 'c-ctx',
        text: ctxText,
        el: isFirst => (
          <Text>
            {dot(isFirst)}
            <Text dimColor>{L('컨텍스트 ', 'Context ')}</Text>
            {stageText(ui, 'ctx', LEVEL_TEXT[level], ctxNum)}
            {isJust ? <Text dimColor>{L(' 컴팩트 직후', ' just compacted')}</Text> : null}
          </Text>
        ),
      }
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
    const isModel = est.reason === 'model'
    const stateWord = isModel ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')
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
          {stageText(ui, 'ctx', LEVEL_TEXT[level], perCall)}
        </Text>
      ),
    })
  }
  if (ctxCell) cells.push(ctxCell)
  if (rangeCell) cells.push(rangeCell)
  if (show.cache && est.minsLeft !== null) {
    const mins = est.minsLeft
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

const MONEY_KEYS: ReadonlySet<string> = new Set(['c-session', 'c-today', 'c-month'])

export function costGroups(...args: Parameters<typeof costCellsRaw>): { money: LineCell[]; now: LineCell[] } {
  const cells = costCells(...args)
  return { money: cells.filter(c => MONEY_KEYS.has(c.key)), now: cells.filter(c => !MONEY_KEYS.has(c.key)) }
}

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
  const slack = isTerm ? 0 : 2
  const GAP = 2
  const w = (c: LineCell) => widthOf(c.text, isTerm) + slack
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

export function fitEstimateLine(
  ui: Ui,
  u: Usage,
  nowMs: number,
  show: BandShow,
  colors: readonly [number, number, number],
  isShort: boolean,
  maxW: number | null,
  spend: SpendShown | null = null,
  wrapW: number | null = maxW,
): LineFit {
  return fitLine(ui, costCells(ui, u, nowMs, show, colors, isShort, spend), maxW, wrapW)
}

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

export function rewriteNote(ui: Ui, rewriteUsd: number | undefined) {
  const { Text } = ui
  if (rewriteUsd === undefined || rewriteUsd < REWRITE_NOTE_USD) return null
  return <Text color="warning">{L(` · 캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, ` · cache rewrite ${fmtUsd(rewriteUsd)}`)}</Text>
}

export type BandPreviewExtra = {
  label?: unknown
  stage?: boolean
  band?: 'full' | 'min'
  slim?: SlimShow
  foldedLabel?: string | null
  statusLine?: string | null
  live?: unknown
}

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
  boxW: number | null = null,
  extra: BandPreviewExtra = {},
) {
  const { Box, Text } = ui
  const label = extra.label ?? previewLabel(ui, 'pv-label-all', L('미리보기', 'Preview'))
  const frame = (key: string, body: unknown) => previewFrame(ui, key, label, body)
  const limits = !isLean && u && u.rateLimits.length > 0 ? drawLimitsLine(ui, surface, u, nowMs, show) : null
  const turn = show.lastTurn ? drawLastTurnLine(ui, last) : null
  if (extra.slim) return drawSlimPreview(ui, surface, u, nowMs, extra.slim, colors, label, extra.live ?? null)
  const fake = (key: string, text: string) => (
    <Text key={key} dimColor>
      {text}
    </Text>
  )
  const isOneRow = isLean || (!limits && !show.lastTurn)
  const isMin = extra.band === 'min' && !isOneRow
  const isTerm = !onDesktop()
  const winText = !isTerm ? (isOneRow ? '✕' : isMin ? '□  ✕' : '—  ✕') : isOneRow ? L('[패널 ▸] [✕]', '[Pane ▸] [✕]') : isMin ? L('[패널 ▸] [□] [✕]', '[Pane ▸] [□] [✕]') : L('[패널 ▸] [—] [✕]', '[Pane ▸] [—] [✕]')
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
  const hasTurnRow = show.lastTurn
  const compactW = gaugeCols + widthOf(compactText, isTerm)
  const estRight = isMin ? compactW + 2 + widthOf(winText, isTerm) : limits ? (hasTurnRow ? 0 : compactW) : hasTurnRow ? widthOf(winText, isTerm) : compactW + 2 + widthOf(winText, isTerm)
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
  const isStage = extra.stage === true && !isTerm
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
    <Box key="pv-input" borderStyle="round" borderColor="promptBorder" borderDimColor paddingX={1} justifyContent="center" alignItems="center">
      <Text dimColor>{L('입력창', 'Prompt box')}</Text>
    </Box>
  ) : null
  const folded = extra.foldedLabel ? (
    <Box key="pv-folded" flexDirection="column">
      <Text dimColor>{isTerm ? L('접힌 모습 · 바 자리', 'Folded · in the bar’s place') : L('접힌 모습 · 입력창 아래', 'Folded · below the input')}</Text>
      <Box key="pv-folded-btn" alignSelf="flex-start" borderStyle="round" borderColor="promptBorder" paddingX={1} paddingY={0}>
        <Text>{extra.foldedLabel}</Text>
      </Box>
      <Text dimColor>{L('펼치면', 'When opened')}</Text>
    </Box>
  ) : null
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

export function fitLastTurnLine(ui: Ui, last: TurnSummary | null, maxW: number | null): LineFit {
  const cells = lastTurnCells(ui, last)
  return cells ? fitLine(ui, cells, maxW) : { el: null, width: 0, over: false }
}

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
    if (agents) cells.push({ key: 't-agents', drop: 1, text: agents, el: () => agentText(ui, 't-agents-el', agents, (agentSum(details)?.runningCount ?? 0), {}, ' · ') })
    if (rewrite && rewriteUsd !== undefined) cells.push({ key: 't-rewrite', text: L(`캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, `cache rewrite ${fmtUsd(rewriteUsd)}`), el: () => rewrite })
    return cells
  }
  if (!last) return null
  return make(L('지난 질문 ', 'Last question '), last.cost, last.steps, last.rewriteUsd, last.details)
}

export function drawLastTurnLine(ui: Ui, last: TurnSummary | null) {
  return fitLastTurnLine(ui, last, null).el
}

export function slimParts(ui: Ui, u: Usage, nowMs: number, view: SlimShow, colors: readonly [number, number, number], spend: SpendShown | null): LineCell[] {
  const { Text } = ui
  const shown = (k: SlimKey, need: boolean) => view[k] === 'on' || (view[k] === 'need' && need)
  const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor> · </Text>)
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
    const pctEl =
      r.percentUsed >= 70 ? (
        <Text bold color={r.percentUsed >= 90 ? 'error' : 'warning'}>
          {pct}
        </Text>
      ) : (
        <Text dimColor>{pct}</Text>
      )
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
    if (view.today === 'on' && spend.today !== null) cells.push(named('s-today', L('오늘 ', 'Today '), fmtUsd(spend.today), spend.todayColor))
    if (view.month === 'on' && spend.month !== null) cells.push(named('s-month', L('이번 달 ', 'This month '), fmtUsd(spend.month), spend.monthColor))
  }
  if (view.range === 'on') cells.push(named('s-range', L('구간 ', 'Range '), rangeNumText(thresholds(), u.window, ctxUnit)))
  return cells
}

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
  if (est.kind === 'cold') head.push(cell('s-next', L('다음 요청 ', 'Next request '), `${approxUsd(est.rewriteUsd)}`, 'error', 'cache'))
  else if (est.kind !== 'unpriced') head.push(cell('s-next', L('다음 요청 ', 'Next request '), `${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`, color, 'ctx'))
  const all = Object.fromEntries(Object.entries(view).map(([k, v]) => [k, v === 'off' ? 'off' : 'on'])) as SlimShow
  return [...head, ...slimParts(ui, u, nowMs, { ...all, req: 'off', cache: 'on' }, colors, spend)]
}

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

export const SLIM_BUTTON_PARTS = 2

export function slimButtonText(u: Usage | null, parts: readonly LineCell[], view: SlimShow, unit: CtxUnit, isOpen: boolean | 'side' = false, isTerminal = false): string {
  const level = u && u.contextTokens > 0 ? levelOf(u.contextTokens) : 'ok'
  const ctx = u && u.contextTokens > 0 && (view.ctx === 'on' || level !== 'ok') ? `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, unit)}` : null
  const words = [ctx, ...parts.slice(0, SLIM_BUTTON_PARTS).map(p => (p.short ?? p).text)].filter((w): w is string => w !== null && w !== '')
  const body = words.length > 0 ? words.join(' · ') : L('이지 컴팩트', 'Easy Compact')
  const mark = isOpen === 'side' ? ' ▸' : isOpen ? ' ▴' : ''
  return isTerminal ? `${body}${mark}` : `${REVEAL_SQUARE[level]} ${body}${mark}`
}

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
