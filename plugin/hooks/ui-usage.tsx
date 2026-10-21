import type { CompactInputs, LiveTurn, Optimal, QuestionDetail, StepSwitch, TurnsOlder, TurnSummary, Usage } from '../types'
import { approxUsd, average, PERM_HEX, compactPayoff, coldFor, estimateFor, fmtTokens, fmtUntil, fmtUsd, LEVEL_HEX, LEVEL_TEXT, levelOf, LITTLE_SHRINK, modelKey, modelName, ratesFor, rateHistory, thresholds, cacheWarnFor, sessionColorOf, ttlName, priceWarnings } from './cost'
import type { Rates } from './cost'
import { OUTPUT_GUESS, SUMMARY_GUESS } from './optimal'
import { contextWindowNow, SESSION_COLORS_DEFAULT } from './settings'
import {
  afterInNowTokens,
  COMPACT_HEX,
  compactEffects,
  compactSummary,
  keptOf,
  TIMING_H,
  timingNames,
  timingSvg,
  segmentExtra,
  FLOW_RECENT,
  recentStart,
  AXIS_H,
  fmtClock,
  flowSvg,
  MODEL_HEX,
  modelSwitches,
  pendingCompact,
} from './flow'
import type { CompactEffect, Flow } from './flow'
import { APP_MIN_USD, ctxNumText, promptHead, clipText, cellsOf, fitCells, gainText, agoText, agentHead, agentPart, agentSum, betweenSwitchText, callsOf, costBreakdown, effortKey, effortLabel, limitName, midSwitchText, switchText, switchTags, recentSteps } from './text'
import {
  ACCENT,
  TALK_HEX,
  ctxBar,
  row,
  gridOf,
  leadCell,
  DETAIL_BOX,
  DETAIL_INSET,
  textCells,
  detailCut,
  detailRows,
  fullButton,
  phaseLook,
  pickButton,
  decoIcon,
  ICON_GRAY,
  nameColW,
  isStackedFor,
  tilePxOf,
  LIVE_HEX,
  pulseDot,
  workMark,
  usdCell,
  CARD,
  titleBand,
  CARD_INSET,
  TILE,
  TILE_PX,
  agentText,
  CH_PX,
  compactMark,
  compactMarkCells,
  foldButton,
  foldHead,
  section,
  growthText,
  emptyLine,
  gaugeEl,
  svgOf,
  segButton,
  segGroup,
} from './ui-common'
import type { Ui, Grid, Fold } from './ui-common'
import { ctxUnitNow, fitLine, rewriteNote } from './ui-band'
import type { LineCell } from './ui-band'
import { L, plural } from './i18n'
import { iconOf, onDesktop, withIcon } from './glyph'
import { BRAND_HEX, questionScope, rasterOf, ultraPieces } from './ui-common'
import { flowCells, flowLayout, timingCells } from './cells'

const FLOW_ROWS = 6

export type PaneBarMotion = { compacting: boolean; shrink: { from: number; to: number } | null; on: boolean }
let paneBarMotion: PaneBarMotion = { compacting: false, shrink: null, on: true }

export function setPaneBarMotion(m: PaneBarMotion): void {
  paneBarMotion = m
}

export function changesOf(
  t: { model?: string; effort?: string; switchedFrom?: string; switches?: readonly StepSwitch[]; ultra?: true },
  older?: TurnSummary,
): { fromModel: string | null; fromEffort: string | null; toModel: string | null; toEffort: string | null } {
  const toModel = t.switches?.find(s => s.kind === 'model')?.from ?? t.model ?? null
  const firstEffort = t.switches?.find(s => s.kind === 'effort')?.from ?? t.effort
  const fromModel = t.switchedFrom ?? (older?.model && toModel && modelKey(older.model) !== modelKey(toModel) ? older.model : null)
  const oldKey = older ? effortKey(older.effort, older.ultra) : null
  const newKey = effortKey(firstEffort, t.ultra)
  const isEffortChanged = oldKey !== null && newKey !== null && oldKey !== newKey
  return {
    fromModel,
    toModel,
    fromEffort: isEffortChanged ? effortLabel(older?.effort, older?.ultra) : null,
    toEffort: isEffortChanged ? effortLabel(firstEffort, t.ultra) : null,
  }
}

export const LIVE_SHOWN = 8

export function liveBlock(
  ui: Ui,
  now: LiveTurn,
  older: TurnSummary | undefined,
  cols: number,
  g: Grid,
  surface: string,
  phase: unknown,
  kind: unknown,
  detail: QuestionDetail = 'steps',
  full: { isOn: boolean; toggle: () => void } | null = null,
) {
  const { Box, Text } = ui
  const { fromModel, fromEffort, toModel, toEffort } = changesOf(now, older)
  const mainIdx = now.details.flatMap((d, i) => (d.agent || d.app || d.compact ? [] : [i]))
  const keepFrom = mainIdx[Math.max(0, mainIdx.length - LIVE_SHOWN)] ?? 0
  const shown = now.details.filter((d, i) => d.agent || d.app || d.compact || i >= keepFrom)
  const hidden = now.details.length - shown.length
  const midModel = midSwitchText(now.switches, 'model')
  const midEffort = midSwitchText(now.switches, 'effort')
  const isModelMark = (fromModel !== null && toModel !== null) || midModel !== null
  const isEffortMark = (fromEffort !== null && toEffort !== null) || midEffort !== null
  const plainEffort = isEffortMark || now.ultra ? '' : effortLabel(now.effort, false)
  const model = [!isModelMark && now.model ? modelName(now.model) : '', plainEffort].filter(Boolean).join(' · ')
  const tags = switchTags(now.details, now.steps, now.switches)
  const look = phaseLook(phase, kind)
  const textBox = cols - CARD_INSET - g.iconW - 1 - g.leadW - 1
  const isFull = full?.isOn === true
  const fullEl = full && detail === 'steps' && (isFull || detailCut(shown, textBox - DETAIL_INSET, g, tags)) ? fullButton(ui, 'hl-full', isFull, full.toggle) : null
  return (
    <Box key="h-live" marginTop={1} {...TILE}>
      <Box columnGap={1} alignItems="flex-start" flexGrow={1}>
        <Box key="h-live-dot" width={g.iconW} flexShrink={0} justifyContent="center" alignItems="center">
          {look ? pulseDot(ui, surface, look.hex, look.text) : (workMark(ui, 'h-live-mark') ?? pulseDot(ui, surface, LIVE_HEX, L('진행 중', 'Running')))}
          <Text> </Text>
        </Box>
        {now.steps > 0 ? usdCell(ui, now.cost.usd, true, g.leadW) : <Box width={g.leadW} flexShrink={0} />}
        <Box flexDirection="column" flexShrink={1} minWidth={0}>
          {look ? (
            agentText(ui, 'h-live-phase', look.text, false, { wrap: 'wrap', color: look.color })
          ) : (
            <Text wrap="wrap">
              <Text bold color={ACCENT}>
                {L('진행 중', 'Running')}
              </Text>
              <Text>{` ${clipText(promptHead(now.prompt), 60) || L('(질문 글이 기록 안 됨)', '(question text not recorded)')}`}</Text>
            </Text>
          )}
          {now.steps === 0 ? (
            <Text dimColor>{L('첫 응답을 기다리는 중', 'Waiting for the first response')}</Text>
          ) : (
            (() => {
              const liveAgents = agentPart(now.details, detail === 'steps')
              const isMark = liveAgents !== null && liveAgents.startsWith('🤖 ') && onDesktop()
              const kids = [
                <Text key="lc" color={LEVEL_TEXT[levelOf(now.contextTokens)]}>{L(`컨텍스트 ${fmtTokens(now.contextTokens)}`, `context ${fmtTokens(now.contextTokens)}`)}</Text>,
                <Text key="lr" dimColor>{L(` · 요청 ${callsOf(now.steps, now.details)}회`, ` · ${plural(callsOf(now.steps, now.details), 'request')}`)}</Text>,
                liveAgents ? (isMark ? agentText(ui, 'la', liveAgents, (agentSum(now.details)?.runningCount ?? 0), {}, ' · ') : <Text key="la">{` · ${liveAgents}`}</Text>) : null,
                model ? <Text key="lm" dimColor>{` · ${model}`}</Text> : null,
                !isEffortMark && now.ultra ? (
                  <Text key="lu">
                    {' · '}
                    {ultraPieces(ui, 'lu', effortLabel(now.effort, true))}
                  </Text>
                ) : null,
                fromModel && toModel ? <Text key="lfm">{` · ${withIcon('🔄', betweenSwitchText('model', modelName(fromModel), modelName(toModel)))}`}</Text> : null,
                fromEffort && toEffort ? (
                  <Text key="lfe">
                    {' · '}
                    {ultraPieces(ui, 'lfe', withIcon('🔄', betweenSwitchText('effort', fromEffort, toEffort)))}
                  </Text>
                ) : null,
                midModel ? <Text key="lmm">{` · ${withIcon('🔄', midModel)}`}</Text> : null,
                midEffort ? <Text key="lme">{` · ${withIcon('🔄', midEffort)}`}</Text> : null,
                rewriteNote(ui, now.rewriteUsd),
              ]
              const meta = isMark ? (
                <Box key="live-meta" flexDirection="row" flexWrap="wrap" alignItems="center">
                  {kids}
                </Box>
              ) : (
                <Text wrap="wrap">{kids}</Text>
              )
              return fullEl ? (
                <Box key="live-meta-row" flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                  {meta}
                  {fullEl}
                </Box>
              ) : (
                meta
              )
            })()
          )}
          {now.details.length > 0 && detail === 'steps' ? (
            <Box key="h-live-box" {...DETAIL_BOX}>
              {detailRows(ui, [...shown].reverse(), 'hl', textBox - DETAIL_INSET, g, hidden > 0, isFull, tags)}
              {hidden > 0 ? <Text key="h-live-more" dimColor>{L(`└─ 이전 동작 ${hidden}개`, `└─ ${hidden} earlier steps`)}</Text> : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}

export function compactingBlock(ui: Ui, g: Grid, surface: string, kind: unknown) {
  const { Box, Text } = ui
  const look = phaseLook('compacting', kind)!
  return (
    <Box key="h-compacting" marginTop={1} {...TILE}>
      <Box columnGap={1} alignItems="flex-start" flexGrow={1}>
        <Box key="h-compacting-dot" width={g.iconW} flexShrink={0} justifyContent="center" alignItems="center">
          {pulseDot(ui, surface, look.hex, look.text)}
          <Text> </Text>
        </Box>
        <Box width={g.leadW} flexShrink={0} />
        <Box flexDirection="column" flexShrink={1} minWidth={0}>
          {agentText(ui, 'h-compacting-text', look.text, false, { wrap: 'wrap', color: look.color })}
        </Box>
      </Box>
    </Box>
  )
}

export function historyRow(
  ui: Ui,
  t: TurnSummary,
  nowMs: number,
  key: string,
  icon: unknown,
  head: unknown,
  isOpen: boolean,
  older: TurnSummary | undefined,
  extra: unknown,
  g: Grid,
  detail: QuestionDetail = 'steps',
  isHover = false,
) {
  const { Box, Text } = ui
  const when = agoText(t.atMs, nowMs)
  const growth = growthOf(t, older)
  const { fromModel, fromEffort, toModel, toEffort } = changesOf(t, older)
  const midModel = midSwitchText(t.switches, 'model')
  const midEffort = midSwitchText(t.switches, 'effort')
  const parts: unknown[] = []
  if (t.rebuilt) parts.push(<Text key="r" dimColor>{L('기록에서 다시 만듦', 'rebuilt from the transcript')}</Text>)
  if (t.aborted) parts.push(<Text key="x" color="warning">{withIcon('⏹', L('중단됨', 'stopped'))}</Text>)
  const calls = callsOf(t.steps, t.details)
  if (calls > 0) parts.push(<Text key="n">{L(`요청 ${calls}회`, plural(calls, 'request'))}</Text>)
  const agents = agentPart(t.details, detail === 'steps')
  const isMark = agents !== null && agents.startsWith('🤖 ') && onDesktop()
  if (agents) parts.push(isMark ? agentText(ui, 'a', agents, (agentSum(t.details)?.runningCount ?? 0)) : <Text key="a">{agents}</Text>)
  if (t.model) {
    if (fromModel && toModel) parts.push(<Text key="m">{withIcon('🔄', betweenSwitchText('model', modelName(fromModel), modelName(toModel)))}</Text>)
    if (midModel) parts.push(<Text key="mm">{withIcon('🔄', midModel)}</Text>)
    if (!fromModel && !midModel)
      parts.push(
        <Text key="m" dimColor>
          {modelName(t.model)}
        </Text>,
      )
  }
  if (t.effort || t.ultra) {
    if (fromEffort && toEffort) parts.push(<Text key="e">{ultraPieces(ui, 'e', withIcon('🔄', betweenSwitchText('effort', fromEffort, toEffort)))}</Text>)
    if (midEffort) parts.push(<Text key="em">{withIcon('🔄', midEffort)}</Text>)
    if (!fromEffort && !midEffort)
      parts.push(
        t.ultra ? (
          <Text key="e">{ultraPieces(ui, 'e', effortLabel(t.effort, true))}</Text>
        ) : (
          <Text key="e" dimColor>
            {effortLabel(t.effort, false)}
          </Text>
        ),
      )
  }
  if (t.contextTokens) {
    parts.push(
      <Text key="c">
        <Text color={LEVEL_TEXT[levelOf(t.contextTokens)]}>{L(`컨텍스트 ${fmtTokens(t.contextTokens)}`, `context ${fmtTokens(t.contextTokens)}`)}</Text>
        {growth !== null ? growthText(ui, growth, fromModel !== null || midModel !== null) : null}
      </Text>,
    )
  }
  const meta: unknown[] = []
  let dim = ''
  const flush = (j: number) => {
    if (dim) meta.push(<Text key={`d${j}`} dimColor>{dim}</Text>)
    dim = ''
  }
  parts.forEach((p, j) => {
    if (j > 0) dim += ' · '
    const el = p as { props?: { dimColor?: unknown; color?: unknown; children?: unknown }; children?: unknown }
    const kids = Array.isArray(el?.children) ? el.children : Array.isArray(el?.props?.children) ? el.props.children : [el?.props?.children]
    const only = kids.length === 1 && typeof kids[0] === 'string' ? kids[0] : null
    if (el?.props?.dimColor === true && el.props.color === undefined && only !== null) dim += only
    else {
      flush(j)
      meta.push(p)
    }
  })
  flush(parts.length)
  return (
    <Box key={key} marginTop={1} columnGap={1} alignItems={isOpen || g.iconTop ? 'flex-start' : 'center'}>
      <Box width={g.iconW} flexShrink={0}>
        {icon}
      </Box>
      <Box flexDirection="column" flexShrink={1} minWidth={0}>
        <Box
          key={`${key}-hov`}
          columnGap={1}
          alignItems="flex-start"
          flexShrink={1}
          minWidth={0}
          {...(isHover && Number.isFinite(t.atMs) ? { hover: { scope: questionScope(t.atMs) } } : {})}
        >
          {isHover && Number.isFinite(t.atMs) ? (
            <Box key={`${key}-glow`} position="absolute" top={0} left={0} right={0} bottom={0} display="none" borderStyle="round" borderColor={BRAND_HEX} hover={{ scope: questionScope(t.atMs), display: 'flex' }} />
          ) : null}
          {leadCell(
            ui,
            <Text bold>{fmtUsd(t.cost.usd)}</Text>,
            when,
            g,
          )}
          <Box flexDirection="column" flexShrink={1} minWidth={0}>
            {head}
            {meta.length > 0 ? (
              isMark ? (
                <Box key="h-meta" flexDirection="row" flexWrap="wrap" alignItems="center">
                  {meta}
                </Box>
              ) : (
                <Text wrap="wrap">{meta}</Text>
              )
            ) : null}
          </Box>
        </Box>
        {extra ? (
          <Box key={`${key}-extra`} marginLeft={g.leadW + 1} flexDirection="column" flexShrink={1} minWidth={0}>
            {extra}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

export const FLOW_HEIGHT = 56

export type FlowParts = {
  gauge: unknown
  gaugeNote: unknown
  details: unknown[]
  compactions: number
  gain: number | null
  state: { word: string; color: string } | null
}

export function drawFlow(
  ui: Ui,
  surface: string,
  flow: Flow,
  isLoaded: boolean,
  note: string | null,
  u: Usage | null,
  widthPx: number,
  showAllEffects: boolean,
  onShowAllEffects: (isAll: boolean) => void,
  nowMs: number,
  opt: Optimal | null = null,
  showAllFlow = false,
  onShowAllFlow: (isAll: boolean) => void = () => {},
  questionStarts: readonly number[] = [],
): FlowParts {
  const { Box, Button, Text } = ui
  const Svg = svgOf(ui, surface)
  const Raster = rasterOf(ui, surface)
  const n = flow.points.length
  const switches = modelSwitches(flow.points)
  const switchNote = switches.length > 0 ? L(` · 모델 변경 ${switches.length}회`, ` · ${switches.length} model switches`) : ''
  let top = 0
  for (const p of flow.points) top = Math.max(top, p.ctx)
  const recentFrom = recentStart(flow.points, questionStarts, FLOW_RECENT)
  const hasMoreFlow = recentFrom > 0
  const isFlowAll = showAllFlow && hasMoreFlow
  const from = isFlowAll ? 0 : recentFrom
  const flowToggle = (key: string, text: string, isOn: boolean, toAll: boolean) => segButton(ui, key, text, isOn, () => onShowAllFlow(toAll))
  const head = (
    <Box key="f-head" columnGap={1} marginTop={1} alignItems="center" flexWrap="wrap">
      <Text bold>{L('컨텍스트 흐름', 'Context flow')}</Text>
      {n > 0 ? (
        <Text dimColor>
          {L(
            `요청 ${n}회 · 컴팩트 ${flow.compactions.length}회${switchNote} · 최고 ${fmtTokens(top)}`,
            `${plural(n, 'request')} · ${plural(flow.compactions.length, 'compact')}${switchNote} · peak ${fmtTokens(top)}`,
          )}
        </Text>
      ) : null}
      {hasMoreFlow && n >= 2
        ? segGroup(ui, 'flow-seg', [
            flowToggle('flow-recent', L(`최근 질문 ${FLOW_RECENT}`, `Last ${FLOW_RECENT} questions`), !isFlowAll, false),
            flowToggle('flow-all', L('전체', 'All'), isFlowAll, true),
          ])
        : null}
    </Box>
  )
  const noteLine = note ? emptyLine(ui, 'f-note', note) : null
  if (n < 2) {
    const empty = emptyLine(
      ui,
      'f-empty',
      isLoaded
        ? L('요청이 두 번 넘게 쌓이면 흐름을 그립니다.', 'The flow is drawn once there are more than two requests.')
        : L('세션 기록을 읽는 중입니다.', 'Reading the session transcript.'),
    )
    return { gauge: null, gaugeNote: null, details: [head, noteLine, empty], compactions: flow.compactions.length, gain: null, state: null }
  }
  const axis = { left: agoText(flow.points[from]!.atMs, nowMs) || fmtClock(flow.points[from]!.atMs), right: L('지금', 'now') }
  const inView = (indices: readonly number[]) => indices.filter(i => i > from).map(i => i - from)
  const shownMarks = inView(flow.compactions.map(c => c.index))
  const chart = Svg ? (
    <Svg
      key="f-svg"
      source={flowSvg(flow.points.slice(from), shownMarks, widthPx, FLOW_HEIGHT + AXIS_H, inView(switches), axis)}
      alt={L(
        `요청 ${n - from}회의 컨텍스트 흐름(${axis.left} → 지금), 컴팩트 ${shownMarks.length}회${switchNote}, 최고 ${fmtTokens(top)}`,
        `Context flow of ${plural(n - from, 'request')} (${axis.left} → now), ${plural(shownMarks.length, 'compact')}${switchNote}, peak ${fmtTokens(top)}`,
      )}
      width={widthPx}
      height={FLOW_HEIGHT + AXIS_H}
    />
  ) : Raster ? (
    (() => {
      const columns = Math.max(20, Math.round(widthPx / 6))
      const shown = flow.points.slice(from)
      const axisW = Math.min(columns, Math.max(flowLayout(shown.length, columns).used, cellsOf(axis.left) + cellsOf(axis.right) + 1))
      return (
        <Box key="f-raster" flexDirection="column">
          <Raster key="f-cells" columns={columns} rows={FLOW_ROWS} cells={flowCells(shown, shownMarks, columns, FLOW_ROWS, inView(switches)).toBase64()} />
          <Box key="f-axis" width={axisW} justifyContent="space-between">
            <Text dimColor>{axis.left}</Text>
            <Text dimColor>{axis.right}</Text>
          </Box>
        </Box>
      )
    })()
  ) : (
    emptyLine(ui, 'f-noart', L('그래프는 데스크톱 앱에서만 보입니다.', 'The graph is shown only in the desktop app.'))
  )
  const first = note === null ? (flow.points[0] ?? null) : null
  const effects = u
    ? compactEffects(flow, u.model, {
        output: opt?.inputs?.output ?? OUTPUT_GUESS,
        summaryOf: c => compactSummary(flow, c, first) ?? opt?.inputs?.summary ?? SUMMARY_GUESS,
      })
    : []
  const extra = u && opt?.inputs ? segmentExtra(flow, u.model, opt.inputs.after) : null
  const extraTotal = extra ? extra.cum[extra.cum.length - 1]! : 0
  const fillColor = { ok: LEVEL_HEX.ok, warn: LEVEL_TEXT.warn, cut: LEVEL_TEXT.cut } as const
  const applied = thresholds()
  const fillWord = applied.isRange
    ? { ok: L('여유', 'Room left'), warn: L('컴팩트할 때', 'Time to compact'), cut: L('컴팩트 늦어짐', 'Compact overdue') }
    : { ok: L('여유', 'Room left'), warn: L('곧 컴팩트할 때', 'Compact soon'), cut: L('컴팩트 권장', 'Compact advised') }
  const nowCtx = u && u.contextTokens > 0 ? u.contextTokens : flow.points[n - 1]!.ctx
  const extraLevel = levelOf(nowCtx)
  const num = (v: number) => ctxNumText(v, u?.window ?? contextWindowNow(), ctxUnitNow())
  const stateNote =
    extraLevel === 'ok'
      ? L(
          `${num(applied.ctxWarn)}부터 ${fillWord.warn} · ${num(applied.ctxWarn - nowCtx)} 남음`,
          `${fillWord.warn} from ${num(applied.ctxWarn)} · ${num(applied.ctxWarn - nowCtx)} to go`,
        )
      : extraLevel === 'warn'
        ? L(`${num(applied.ctxCut)} 전에 · ${num(applied.ctxCut - nowCtx)} 남음`, `before ${num(applied.ctxCut)} · ${num(applied.ctxCut - nowCtx)} to go`)
        : L(`${num(applied.ctxCut)} 넘음 · 지금 ${num(nowCtx)}`, `past ${num(applied.ctxCut)} · now ${num(nowCtx)}`)
  const lastC = flow.compactions[flow.compactions.length - 1]
  const prev =
    u && lastC && lastC.index >= 2
      ? segmentExtra({ points: flow.points.slice(0, lastC.index), compactions: flow.compactions.slice(0, -1) }, u.model, opt?.inputs?.after ?? lastC.before)
      : null
  const prevTotal = prev ? prev.cum[prev.cum.length - 1]! : 0
  const tilePx = Math.max(120, widthPx - tilePxOf(surface))
  const markNames = applied.isRange
    ? { warnName: L(`${num(applied.ctxWarn)} 컴팩트할 때`, `${num(applied.ctxWarn)} compact`), cutName: L(`${num(applied.ctxCut)} 늦어짐`, `${num(applied.ctxCut)} late`) }
    : { warnName: L(`${num(applied.ctxWarn)} 곧`, `${num(applied.ctxWarn)} soon`), cutName: L(`${num(applied.ctxCut)} 정한 크기`, `${num(applied.ctxCut)} set size`) }
  const pm = paneBarMotion
  const timingAnim = !pm.on ? null : pm.compacting ? { pulse: true } : pm.shrink ? { fromCtx: pm.shrink.from, fromHex: LEVEL_HEX[levelOf(pm.shrink.from)] } : null
  const extraEl = (
    <Box key="f-extra" flexDirection="column">
      <Box columnGap={1} flexWrap="wrap" alignItems="center">
        <Text bold>{L('컴팩트 시점', 'Compact timing')}</Text>
        <Text bold color={fillColor[extraLevel]}>{`● ${fillWord[extraLevel]}`}</Text>
        <Text dimColor wrap="wrap">
          {stateNote}
        </Text>
        {pm.compacting ? <Text color={ACCENT}>{L('컴팩트 중…', 'Compacting…')}</Text> : null}
      </Box>
      {Svg ? (
        <Svg
          key="f-timing"
          source={timingSvg(nowCtx, { warn: applied.ctxWarn, cut: applied.ctxCut, ...markNames }, LEVEL_HEX[extraLevel], tilePx, timingAnim)}
          alt={L(`컴팩트 시점: 지금 ${fmtTokens(nowCtx)}, ${fillWord[extraLevel]}(${stateNote})`, `Compact timing: now ${fmtTokens(nowCtx)}, ${fillWord[extraLevel]} (${stateNote})`)}
          width={tilePx}
          height={TIMING_H}
          {...(timingAnim ? { isInteractive: true as const } : {})}
        />
      ) : Raster ? (
        (() => {
          const cols = Math.max(10, Math.round(tilePx / 6))
          const [warnName, cutName] = timingNames(markNames.warnName, markNames.cutName, cols - 4, cellsOf)
          return (
            <Box key="f-timing" flexDirection="column" width={cols}>
              <Raster key="f-timing-cells" columns={cols} rows={1} cells={timingCells(nowCtx, applied.ctxWarn, applied.ctxCut, LEVEL_HEX[extraLevel], cols).toBase64()} />
              <Box key="f-timing-names" justifyContent="space-between" columnGap={2}>
                <Text>
                  <Text color={LEVEL_HEX.warn}>┃</Text>
                  <Text dimColor>{` ${warnName}`}</Text>
                </Text>
                <Text>
                  <Text dimColor>{`${cutName} `}</Text>
                  <Text color={LEVEL_HEX.cut}>┃</Text>
                </Text>
              </Box>
            </Box>
          )
        })()
      ) : null}
    </Box>
  )
  const extraWhy = L('컴팩트했다면 안 냈을 읽기 비용', 'reads you would not have paid had you compacted')
  const isTermPane = surface === 'terminal'
  const extraNote =
    (extra && extraTotal > 0) || lastC
      ? decideRow(
          ui,
          'f-extra-note',
          L('더 든 비용', 'Deferral cost'),
          <Text wrap="wrap">
            <Text bold>{fmtUsd(extraTotal)}</Text>
            {extra && extraTotal > 0 ? (
              <Text dimColor>{`${isTermPane ? ` — ${extraWhy}` : ''}${L(` · 요청마다 +${fmtUsd(extra.nowExtraUsd)}`, ` · +${fmtUsd(extra.nowExtraUsd)} per request`)}`}</Text>
            ) : (
              <Text dimColor>{L(' · 방금 컴팩트해 아직 없음', ' · none yet, just compacted')}</Text>
            )}
            {prev && prevTotal > 0 ? <Text dimColor>{L(` · 지난 구간 ${fmtUsd(prevTotal)}`, ` · previous segment ${fmtUsd(prevTotal)}`)}</Text> : null}
          </Text>,
          decideStacked(Math.floor(tilePx / CH_PX) - CARD_INSET),
          isTermPane ? null : extraWhy,
        )
      : null
  const details = [
    head,
    noteLine,
    chart,

    (
      <Box key="f-key" columnGap={3} flexWrap="wrap">
        <Text>
          <Text color={LEVEL_HEX.warn}>┄</Text>
          <Text>{` ${fmtTokens(applied.ctxWarn)} ${applied.isRange ? L('컴팩트할 때', 'time to compact') : L('곧 컴팩트할 때', 'compact soon')}`}</Text>
        </Text>
        <Text>
          <Text color={LEVEL_HEX.cut}>╌</Text>
          <Text>{` ${fmtTokens(applied.ctxCut)} ${applied.isRange ? L('컴팩트 늦어짐', 'compact overdue') : L('컴팩트 권장', 'compact advised')}`}</Text>
        </Text>
        {flow.compactions.length > 0 ? (
          <Text>
            <Text color={COMPACT_HEX}>┃</Text>
            <Text>{L(' 컴팩트', ' compact')}</Text>
          </Text>
        ) : null}
        {switches.length > 0 ? (
          <Text>
            <Text color={MODEL_HEX}>┇</Text>
            <Text>{L(' 모델 변경', ' model switch')}</Text>
          </Text>
        ) : null}
        {flow.compactions.length > 0 ? <Text dimColor>{L('흐린 막대: 지난 구간', 'faded bars: earlier segments')}</Text> : null}
      </Box>
    ),
    ...effectsBlock(
      ui,
      effects,
      u ? flow.points[n - 1]!.ctx : null,
      u,
      showAllEffects,
      onShowAllEffects,
      nowMs,
      gridOf(surface),
      ef => keptOf(flow, ef.event, first),
    ),
  ]
  return {
    gauge: extraEl,
    gaugeNote: extraNote,
    details,
    compactions: flow.compactions.length,
    gain: effectsNet(effects),
    state: { word: fillWord[extraLevel], color: fillColor[extraLevel] ?? LEVEL_HEX.ok },
  }
}

export type Perm = { tokens: number; fixed: number | null; summary: number | null; isEstimated: boolean; isRescaled: boolean }

export function permanentOf(flow: Flow, isPartial: boolean, fallback: number | null): Perm | null {
  const pending = pendingCompact(flow)
  if (pending?.kept !== undefined && fallback !== null && fallback > pending.kept) {
    return { tokens: fallback, fixed: fallback - pending.kept, summary: pending.kept, isEstimated: true, isRescaled: false }
  }
  const measured = flow.compactions.filter(c => c.after !== null)
  const last = measured[measured.length - 1]
  if (!last || last.after === null) {
    return fallback === null ? null : { tokens: fallback, fixed: null, summary: null, isEstimated: true, isRescaled: false }
  }
  const tokens = afterInNowTokens(flow, last.after)
  const isRescaled = Math.abs(tokens - last.after) > last.after * 0.03
  const first = isPartial ? null : (flow.points[0] ?? null)
  const summary = isRescaled ? null : keptOf(flow, last, first)
  return {
    tokens,
    fixed: summary !== null ? last.after - summary : null,
    summary,
    isEstimated: pending !== null,
    isRescaled,
  }
}

export const EFFECTS_RECENT = 3

export const EFFECTS_ALL_MAX = 10

export function effectsNet(effects: readonly CompactEffect[]): number | null {
  const latest = effects[effects.length - 1]
  const measured = effects.filter(ef => ef.event.after !== null && !(ef === latest && ef.netUsd < 0))
  return measured.length > 0 ? measured.reduce((sum, ef) => sum + ef.netUsd, 0) : null
}

export function effectsBlock(
  ui: Ui,
  effects: readonly CompactEffect[],
  nowCtx: number | null,
  u: Usage | null,
  showAll: boolean,
  onShowAll: (isAll: boolean) => void,
  nowMs: number,
  g: Grid,
  summaryOf: (ef: CompactEffect) => number | null = () => null,
): unknown[] {
  const { Box, Button, Text } = ui
  const latest = effects[effects.length - 1]
  const all = [...effects].reverse()
  const hasMore = all.length > EFFECTS_RECENT
  const isAll = showAll && hasMore
  const shown = isAll ? all.slice(0, EFFECTS_ALL_MAX) : all.slice(0, EFFECTS_RECENT)
  const olderEffects = isAll ? all.length - shown.length : 0
  const net = effectsNet(effects)
  const toggle = (key: string, text: string, isOn: boolean, toAll: boolean) => segButton(ui, key, text, isOn, () => onShowAll(toAll))
  return [
    <Box key="f-eh" marginTop={1} columnGap={1} alignItems="center" flexWrap="wrap">
      <Text bold>{L('컴팩트 효과', 'Compact results')}</Text>
      {net !== null ? (
        <Text bold color={net >= 0 ? 'success' : 'error'}>
          {L(`총 ${gainText(net)}`, `total ${gainText(net)}`)}
        </Text>
      ) : null}
      {hasMore
        ? segGroup(ui, 'effects-seg', [
            toggle('effects-recent', L(`최근 ${EFFECTS_RECENT}`, `Last ${EFFECTS_RECENT}`), !isAll, false),
            toggle(
              'effects-all',
              all.length > EFFECTS_ALL_MAX ? L(`최근 ${EFFECTS_ALL_MAX}`, `Last ${EFFECTS_ALL_MAX}`) : L(`전체 ${all.length}`, `All ${all.length}`),
              isAll,
              true,
            ),
          ])
        : null}
    </Box>,
    ...(effects.length === 0
      ? [emptyLine(ui, 'f-none', L('아직 컴팩트한 적이 없습니다.', 'No compacts yet.'))]
      : shown.map((ef, i) => effectRow(ui, ef, `ef-${i}`, ef === latest ? nowCtx : null, u, nowMs, g, summaryOf(ef), ef === latest))),
    ...(olderEffects > 0
      ? [
          <Text key="ef-older" dimColor wrap="wrap">
            {L(
              `그 앞 컴팩트 ${olderEffects}번은 총계에만 들어 있습니다.`,
              `${plural(olderEffects, 'earlier compact')}: only in the total.`,
            )}
          </Text>,
        ]
      : []),
  ]
}

export function effectRow(
  ui: Ui,
  ef: CompactEffect,
  key: string,
  nowCtx: number | null,
  u: Usage | null,
  nowMs: number,
  g: Grid,
  summary: number | null = null,
  isLatest = false,
) {
  const { Box, Text } = ui
  const r = u ? ratesFor(u.model, nowCtx ?? ef.event.before) : null
  const after = ef.event.after
  const isRecouping = isLatest && after !== null && ef.netUsd < 0
  const net =
    after === null ? (
      <Text dimColor>—</Text>
    ) : isRecouping ? (
      <Text bold>{L('회수중', 'recouping')}</Text>
    ) : (
      <Text bold color={ef.netUsd >= 0 ? 'success' : 'error'}>
        {gainText(ef.netUsd)}
      </Text>
    )
  return (
    <Box key={key} marginTop={1} columnGap={1} alignItems="flex-start">
      {leadCell(ui, net, agoText(ef.event.atMs, nowMs), { ...g, leadW: g.leadW + 2 })}
      <Box flexDirection="column" flexShrink={1} minWidth={0}>
        <Text wrap="wrap">
          <Text color="suggestion">{ef.event.trigger === 'auto' ? L('클로드 기본 auto-compact ', "Claude's auto-compact ") : L('컴팩트 ', 'Compact ')}</Text>
          <Text color={LEVEL_TEXT[levelOf(ef.event.before)]}>{fmtTokens(ef.event.before)}</Text>
          {after !== null || isLatest ? <Text dimColor> → </Text> : null}
          {after !== null ? <Text color="success">{fmtTokens(after)}</Text> : isLatest ? <Text dimColor>?</Text> : null}
          {summary !== null && after !== null ? <Text dimColor>{L(`(요약 ${fmtTokens(summary)} 포함)`, `(incl. ${fmtTokens(summary)} summary)`)}</Text> : null}
        </Text>
        <Text wrap="wrap">
          <Text dimColor>{L(`${modelName(ef.model)} · 컴팩트 비용 `, `${modelName(ef.model)} · compact cost `)}</Text>
          {isRecouping ? <Text bold>{L('회수중 ', 'recouping ')}</Text> : null}
          <Text>{`${approxUsd(ef.costUsd)}`}</Text>
          {ef.isEstimated ? <Text dimColor>{L(' 추정', ' est.')}</Text> : null}
          {after === null ? (
            isLatest ? <Text dimColor>{L(' · 줄어든 크기는 다음 요청 때 잽니다', ' · the reduced size is measured at the next request')}</Text> : null
          ) : (
            <Text>
              <Text dimColor>{L(` · 이후 요청 ${ef.requestsAfter}회 · 절약 `, ` · ${plural(ef.requestsAfter, 'request')} since · saved `)}</Text>
              <Text color="success">{fmtUsd(ef.savedUsd)}</Text>
              {isRecouping ? (
                <Text>
                  {ef.breakEvenLeft === null
                    ? L(' · 본전 시점 모름', ' · break-even unknown')
                    : L(` · 본전까지 요청 ${ef.breakEvenLeft}회`, ` · ${plural(ef.breakEvenLeft, 'request')} to break even`)}
                </Text>
              ) : null}
            </Text>
          )}
        </Text>
        {nowCtx !== null && r && after !== null && ef.removed > 0 ? (
          <Text wrap="wrap">
            <Text dimColor>{L('지금 요청 1회 ', 'Per request now ')}</Text>
            <Text color={LEVEL_TEXT[levelOf(nowCtx)]}>{fmtUsd((nowCtx * r.read) / 1e6)}</Text>
            <Text dimColor>{L(' · 안 했으면 ', ' · without it ')}</Text>
            <Text color={LEVEL_TEXT[levelOf(nowCtx + ef.removed)]}>{fmtUsd(((nowCtx + ef.removed) * r.read) / 1e6)}</Text>
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}

export function promptText(t: TurnSummary): string {
  if (t.prompt) return promptHead(t.prompt) || L('(글이 잘린 옛 기록)', '(old record, text cut)')
  return Number.isFinite(t.atMs) ? L('(질문 글이 기록 안 됨)', '(question text not recorded)') : L('(예전 질문)', '(earlier question)')
}

export const RECENT_COUNT = 5

export const HISTORY_ALL_MAX = 20

export const PANE_STEPS = 20

export function growthOf(t: TurnSummary, older: TurnSummary | undefined): number | null {
  return t.contextTokens && older?.contextTokens ? t.contextTokens - older.contextTokens : null
}

const DECIDE_MIN_VALUE = 24
function decideNameW(): number {
  return nameColW([L('지금 하면', 'Compact now'), L('더 든 비용', 'Deferral cost')])
}
function decideStacked(cols: number | null): boolean {
  return cols !== null && cols - decideNameW() - 1 < DECIDE_MIN_VALUE
}
function decideRow(ui: Ui, key: string, name: string, value: unknown, isStacked: boolean, tip: string | null = null) {
  const { Box, Text } = ui
  const scope = `ec-tip-${key}`.slice(0, 64)
  const hasTip = tip !== null && onDesktop()
  const nameEl = hasTip ? (
    <Box key={`${key}-n`} hover={{ scope }}>
      <Text dimColor>{name}</Text>
    </Box>
  ) : (
    <Text key={`${key}-n`} dimColor>
      {name}
    </Text>
  )
  return (
    <Box key={key} flexDirection="column">
      {isStacked ? (
        <Box key={`${key}-s`} flexDirection="column">
          {nameEl}
          {value}
        </Box>
      ) : (
        <Box key={`${key}-r`} columnGap={1}>
          <Box width={decideNameW()} flexShrink={0}>
            {nameEl}
          </Box>
          <Box flexShrink={1} minWidth={0}>
            {value}
          </Box>
        </Box>
      )}
      {hasTip ? (
        <Box key={`${key}-card`} position="absolute" top={1} left={0} right={0} display="none" hover={{ display: 'flex', scope }} backgroundColor="userMessageBackground" borderStyle="round" borderColor="promptBorder" paddingX={1}>
          <Text wrap="wrap">{tip}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

export function drawEfficiency(ui: Ui, u: Usage, sums: readonly TurnSummary[], nowMs: number, inputs: CompactInputs, wrapW: number | null = null) {
  const { Box, Text } = ui
  const ctx = u.contextTokens
  const r = ratesFor(u.model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ratio = after > 0 ? ctx / after : 1
  const est = estimateFor(u, nowMs, ctx)
  const calls = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  let second: unknown = null
  if (ratio < LITTLE_SHRINK) {
    second = <Text bold color="error" wrap="wrap">{L('아낄 게 거의 없어 지금 컴팩트하면 손해입니다', 'Little to save, so compacting now is a loss')}</Text>
  } else if (est.kind === 'cold') {
    const c = coldFor(u, inputs, ctx)
    if (c) {
      second = (
        <Text wrap="wrap">
          <Text dimColor>{L('캐시가 만료돼 다음 요청은 전체를 다시 씁니다. 지금 컴팩트하면 ', 'The cache expired, so the next request rewrites everything. Compacting now ')}</Text>
          {c.compactUsd < c.continueUsd ? (
            <Text color="success" bold>{L(`${fmtUsd(c.continueUsd - c.compactUsd)} 이득`, `saves ${fmtUsd(c.continueUsd - c.compactUsd)}`)}</Text>
          ) : (
            <Text bold color="error">{L(`${fmtUsd(c.compactUsd - c.continueUsd)} 손해`, `costs ${fmtUsd(c.compactUsd - c.continueUsd)} more`)}</Text>
          )}
        </Text>
      )
    }
  } else {
    const pay = compactPayoff(ctx, inputs, u.model, calls)
    if (pay) {
      const even =
        pay.breakEvenQuestions !== null
          ? pay.breakEvenQuestions <= 1
            ? L('다음 질문 하나로 본전', 'breaks even with the next question')
            : L(`질문 ${pay.breakEvenQuestions}개면 본전`, `breaks even after ${pay.breakEvenQuestions} questions`)
          : pay.breakEvenCalls !== null
            ? L(`요청 ${pay.breakEvenCalls}회면 본전`, `breaks even after ${plural(pay.breakEvenCalls, 'request')}`)
            : L('본전 시점 모름', 'break-even unknown')
      const save =
        pay.saveQuestionUsd !== null
          ? L(`질문마다 ${approxUsd(pay.saveQuestionUsd)} 아낌`, `saves ${approxUsd(pay.saveQuestionUsd)} per question`)
          : L(`요청마다 ${approxUsd(pay.saveCallUsd)} 아낌`, `saves ${approxUsd(pay.saveCallUsd)} per request`)
      const costText = L(`컴팩트 한 번 ${approxUsd(pay.costUsd)}`, `one compact ${approxUsd(pay.costUsd)}`)
      const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor>{' · '}</Text>)
      const isStacked = decideStacked(wrapW)
      second = decideRow(ui, 'eff-row', L('지금 하면', 'Compact now'), fitLine(
        ui,
        [
          {
            key: 'eff-save',
            text: save,
            el: (isFirst: boolean) => (
              <Text>
                {dot(isFirst)}
                <Text color="success" bold>
                  {save}
                </Text>
              </Text>
            ),
          },
          {
            key: 'eff-cost',
            text: costText,
            el: (isFirst: boolean) => (
              <Text>
                {dot(isFirst)}
                <Text dimColor>{costText}</Text>
              </Text>
            ),
          },
          {
            key: 'eff-even',
            text: even,
            el: (isFirst: boolean) => (
              <Text>
                {dot(isFirst)}
                <Text>{even}</Text>
              </Text>
            ),
          },
        ],
        null,
        wrapW === null ? null : isStacked ? wrapW : wrapW - decideNameW() - 1,
      ).el, isStacked)
    }
  }
  return (
    <Box key="c-eff" flexDirection="column">
      {second}
    </Box>
  )
}

export type HistoryActions = {
  setAll: (isAll: boolean) => void
  toggle: (id: number) => void
  isFull?: (id: number) => boolean
  toggleFull?: (id: number) => void
}

export type Tally = { older: TurnsOlder | null; liveUsd: number; costUsd: number | null }

const OUTSIDE_MIN_PART = 0.02
const OUTSIDE_MIN_USD = 0.1

export function tallyOf(sums: readonly TurnSummary[], tally: Tally | null) {
  const older = tally?.older ?? null
  const count = sums.length + (older?.count ?? 0)
  const usd = sums.reduce((s, t) => s + t.cost.usd, 0) + (older?.usd ?? 0)
  const agentUsd = sums.reduce((s, t) => s + (agentSum(t.details)?.usd ?? 0), 0) + (older?.agentUsd ?? 0)
  const appUsd = sums.reduce((s, t) => s + (t.appUsd ?? 0), 0) + (older?.appUsd ?? 0)
  const cum = tally?.costUsd ?? null
  const gap = cum === null ? 0 : cum - usd - (tally?.liveUsd ?? 0)
  const outsideUsd = cum !== null && gap >= OUTSIDE_MIN_USD && gap >= cum * OUTSIDE_MIN_PART ? gap : 0
  return { count, usd, agentUsd, appUsd, outsideUsd, rebuiltCount: older?.rebuilt ? older.count : 0 }
}

function outsideText(t: ReturnType<typeof tallyOf>, isShort: boolean): string {
  const head = L(`질문 밖 ${fmtUsd(t.outsideUsd)}`, `Outside questions ${fmtUsd(t.outsideUsd)}`)
  if (isShort) return head
  const rebuilt = t.rebuiltCount > 0 ? L(` · 앞 ${t.rebuiltCount}개는 대화 기록에서 다시 셈`, ` · first ${t.rebuiltCount} recounted from the transcript`) : ''
  return `${head}${L(' · 누적엔 있지만 질문에 안 잡힌 요청입니다', ' · in the total, not tied to a question')}${rebuilt}`
}

export function drawHistory(
  act: HistoryActions,
  ui: Ui,
  sums: readonly TurnSummary[],
  nowMs: number,
  expanded: number | null,
  showAll: boolean,
  liveEl: unknown,
  cols: number,
  g: Grid,
  fold: Fold = { isOpen: true, onToggle: () => {} },
  liveNote: { text: string; isRunning: boolean } | null = null,
  detail: QuestionDetail = 'steps',
  isHover = false,
  tally: Tally | null = null,
  isOutside = false,
) {
  const { Box, Button, Text } = ui
  const all = [...sums].reverse()
  const tallied = tallyOf(sums, tally)
  const total = tallied.usd
  const hasMore = all.length > RECENT_COUNT
  const isAll = showAll && hasMore
  const shown = isAll ? all.slice(0, HISTORY_ALL_MAX) : all.slice(0, RECENT_COUNT)
  const older = isAll ? all.slice(HISTORY_ALL_MAX) : []
  const olderCount = older.length + (isAll ? (tally?.older?.count ?? 0) : 0)
  const olderUsd = older.reduce((s, t) => s + t.cost.usd, 0) + (isAll ? (tally?.older?.usd ?? 0) : 0)
  const toggle = (key: string, text: string, isOn: boolean, toAll: boolean) => segButton(ui, key, text, isOn, () => act.setAll(toAll))
  const textBox = cols - g.iconW - 1 - g.leadW - 1
  const liveMark = !fold.isOpen && liveNote?.isRunning ? workMark(ui, 's-history-mark') : null
  const summary =
    all.length === 0 && !(liveNote && !fold.isOpen) ? null : (
      <Text key="s-history-sum" wrap="wrap">
        {!fold.isOpen && liveNote ? <Text color={LIVE_HEX}>{liveMark ? liveNote.text : `● ${liveNote.text}`}</Text> : null}
        {!fold.isOpen && liveNote && all.length > 0 ? <Text dimColor>{' · '}</Text> : null}
        {all.length > 0 ? <Text>{L(`${tallied.count}개 합 `, `${tallied.count} total `)}</Text> : null}
        {all.length > 0 ? <Text bold>{fmtUsd(total)}</Text> : null}
        {all.length > 0 && isOutside && tallied.outsideUsd > 0 ? <Text dimColor>{` · ${outsideText(tallied, true)}`}</Text> : null}
        {fold.isOpen && all.length > 0 ? (
          <Text dimColor>
            {detail === 'summary'
              ? L(' · (+N)은 그 질문이 늘린 컨텍스트', ' · (+N) = context the question added')
              : L(' · ▸ 로 자세히 · (+N)은 그 질문이 늘린 컨텍스트', ' · ▸ for details · (+N) = context the question added')}
          </Text>
        ) : null}
      </Text>
    )
  return (
    <Box key="s-history" flexDirection="column" marginTop={1}>
      <Box key="s-history-head" columnGap={1} alignItems="center" flexWrap="wrap">
        {foldHead(ui, 's-history', L('질문별 비용', 'Cost per question'), fold)}
        {liveMark}
        {summary}
        {fold.isOpen && hasMore
          ? segGroup(ui, 'history-seg', [
              toggle('history-recent', L(`최근 ${RECENT_COUNT}`, `Last ${RECENT_COUNT}`), !isAll, false),
              toggle(
                'history-all',
                all.length > HISTORY_ALL_MAX ? L(`최근 ${HISTORY_ALL_MAX}`, `Last ${HISTORY_ALL_MAX}`) : L(`전체 ${all.length}`, `All ${all.length}`),
                isAll,
                true,
              ),
            ])
          : null}
      </Box>
      {fold.isOpen ? (
      <Box key="s-history-card" flexDirection="column" {...CARD}>
      {liveEl}
      {fold.isOpen && all.length === 0 && !liveEl ? emptyLine(ui, 'h-none', L('아직 끝난 질문이 없습니다.', 'No finished questions yet.')) : null}
      {(fold.isOpen ? shown : []).map((t, i) => {
        const id = Number.isFinite(t.atMs) ? t.atMs : -i
        const isLean = detail === 'summary'
        const isOpen = !isLean && expanded === id
        const fullText = promptText(t)
        const mark = fullText.startsWith('🗜 ') ? compactMark(ui, `hm-${i}`) : null
        const full = mark ? fullText.slice('🗜 '.length) : fullText
        const markCells = mark ? compactMarkCells(ui) : 0
        const icon = isLean ? null : (
          <Button key={`hx-${i}`} label={isOpen ? '▾' : '▸'} variant="secondary" onPress={() => act.toggle(id)} />
        )
        const headText = isLean ? (
          <Text wrap="truncate-end">{fitCells(full, Math.floor(textCells(g, textBox) * 0.9) - markCells)}</Text>
        ) : isOpen ? (
          <Text wrap="wrap">{full}</Text>
        ) : (
          <Text>{fitCells(full, textCells(g, textBox) - markCells)}</Text>
        )
        const head = mark ? (
          <Box key={`hmh-${i}`} flexDirection="row" alignItems="center" columnGap={0.5}>
            {mark}
            {headText}
          </Box>
        ) : (
          headText
        )
        const top = recentSteps(t.details ?? [], PANE_STEPS)
        const tags = switchTags(t.details ?? [], t.steps, t.switches)
        const isFull = isOpen && act.isFull?.(id) === true
        const fullEl =
          isOpen && act.toggleFull && (isFull || detailCut(top.shown, textBox - DETAIL_INSET, g, tags)) ? fullButton(ui, `hf-${i}`, isFull, () => act.toggleFull!(id)) : null
        const costLines = isOpen ? costBreakdown(t.cost, t.appUsd, t.details, t.steps) : []
        const extra = isOpen ? (
          <Box key={`hbox-${i}`} {...DETAIL_BOX}>
            {costLines.map((line, k) => {
              const el = agentText(ui, `hb-${i}-${k}`, line, (agentSum(t.details)?.runningCount ?? 0), { dimColor: true, wrap: 'wrap' })
              return fullEl && k === costLines.length - 1 ? (
                <Box key={`hbr-${i}`} flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1}>
                  {el}
                  {fullEl}
                </Box>
              ) : (
                el
              )
            })}
            {(t.details ?? []).length === 0
              ? emptyLine(ui, `hd-none-t-${i}`, L('동작별 기록이 없는 예전 질문입니다.', 'An earlier question without per-step records.'))
              : detailRows(ui, top.shown, `hd-${i}`, textBox - DETAIL_INSET, g, top.rest > 0, isFull, tags)}
            {top.rest > 0 ? (
              <Text key={`hd-${i}-rest`} dimColor wrap="wrap">
                {L(
                  `└─ 이전 동작 ${top.rest}개 ${fmtUsd(top.restUsd)}`,
                  `└─ ${plural(top.rest, 'earlier step')} ${fmtUsd(top.restUsd)}`,
                )}
              </Text>
            ) : null}
          </Box>
        ) : null
        return historyRow(ui, t, nowMs, `hr-${i}`, icon, head, isOpen, all[i + 1], extra, g, detail, isHover)
      })}
      {fold.isOpen && olderCount > 0 ? (
        <Text key="h-older" dimColor wrap="wrap">
          {L(
            `그 앞 질문 ${olderCount}개 · 합 ${fmtUsd(olderUsd)}`,
            `${plural(olderCount, 'earlier question')} · ${fmtUsd(olderUsd)} total`,
          )}
        </Text>
      ) : null}
      </Box>
      ) : null}
    </Box>
  )
}

export function drawNow(
  ui: Ui,
  surface: string,
  u: Usage | null,
  nowMs: number,
  widthPx: number,
  perm: Perm | null = null,
  inputs: CompactInputs | null = null,
  fold?: Fold,
  modelLine: string | null = null,
  colors: readonly [number, number, number] = SESSION_COLORS_DEFAULT,
) {
  const { Box, Text } = ui
  if (!u) {
    return section(
      ui,
      's-now',
      nowTitle(),
      [emptyLine(ui, 'u-none', L('아직 잰 값이 없습니다. 질문이 한 번 끝나면 채워집니다.', 'Nothing measured yet. Filled in after the first question finishes.'))],
      undefined,
      true,
      NOW_ICON,
      fold,
    )
  }
  const est = estimateFor(u, nowMs)
  const level = levelOf(u.contextTokens)
  const ctxPercent = u.percent ?? (u.window > 0 ? (u.contextTokens / u.window) * 100 : 0)
  const t = thresholds()
  const talk = perm ? Math.max(0, u.contextTokens - perm.tokens) : 0
  const split = perm && perm.fixed !== null && perm.summary !== null ? { fixed: perm.fixed, summary: perm.summary } : null
  const pctOf = (tokens: number) => (u.window > 0 ? (tokens / u.window) * 100 : 0)
  const permParts = !perm
    ? []
    : split
      ? [
          { percent: pctOf(split.fixed), hex: PERM_HEX },
          { percent: pctOf(split.summary), hex: COMPACT_HEX },
        ]
      : [{ percent: pctOf(perm.tokens), hex: PERM_HEX }]
  const permEl = perm ? (
    <Box key="c-perm" flexDirection="column">
      <Text wrap="wrap">
        {split ? null : <Text color={PERM_HEX}>■ </Text>}
        <Text bold>{L(`상주 ${perm.isEstimated ? '~' : ''}${fmtTokens(perm.tokens)}`, `Resident ${perm.isEstimated ? '~' : ''}${fmtTokens(perm.tokens)}`)}</Text>
        {split ? <Text dimColor> = </Text> : null}
        {split ? <Text color={PERM_HEX}>■ </Text> : null}
        {split ? <Text>{L(`기본 적재 ${fmtTokens(split.fixed)}`, `base load ${fmtTokens(split.fixed)}`)}</Text> : null}
        {split ? <Text dimColor> + </Text> : null}
        {split ? <Text color={COMPACT_HEX}>■ </Text> : null}
        {split ? <Text>{L(`컴팩트 요약 ${fmtTokens(split.summary)}`, `compact summary ${fmtTokens(split.summary)}`)}</Text> : null}
        {split ? null : perm.isRescaled ? (
          <Text dimColor>{L(' 지금 모델로 센 값', ' counted with the current model')}</Text>
        ) : perm.isEstimated ? (
          <Text dimColor>{L(' (추정)', ' (est.)')}</Text>
        ) : null}
        {talk >= 1000 ? <Text>{'   '}</Text> : null}
        {talk >= 1000 ? <Text color={TALK_HEX}>■ </Text> : null}
        {talk >= 1000 ? <Text bold>{L(`대화 ${fmtTokens(talk)}`, `conversation ${fmtTokens(talk)}`)}</Text> : null}
      </Text>
      {perm.tokens >= t.ctxCut ? (
        <Text wrap="wrap" color="warning">
          {L(
            `컴팩트해도 남는 크기(상주)가 빨강 기준 ${fmtTokens(t.ctxCut)}보다 큽니다. 새 세션으로 옮기는 게 낫습니다.`,
            `What stays after compacting (resident) is above the red threshold ${fmtTokens(t.ctxCut)}. Moving to a new session is better.`,
          )}
        </Text>
      ) : null}
    </Box>
  ) : null

  const tilePx = Math.max(120, widthPx - tilePxOf(surface))
  const pm = paneBarMotion
  const ctxAnim = !pm.on ? null : pm.compacting ? { pulse: true } : pm.shrink ? { fromPercent: (pm.shrink.from / Math.max(1, u.window)) * 100 } : null
  const unit = ctxUnitNow()
  const num = (v: number) => ctxNumText(v, u.window, unit)
  const ctxRows = [
    <Box key="c-head" columnGap={1}>
      <Text>{L('컨텍스트', 'Context')}</Text>
      <Text bold color={LEVEL_TEXT[level]}>{`${u.contextEstimated ? '~' : ''}${num(u.contextTokens)}`}</Text>
      <Text dimColor>{`/ ${fmtTokens(u.window)}`}</Text>
      {pm.compacting ? <Text color={ACCENT}>{L('컴팩트 중…', 'Compacting…')}</Text> : null}
    </Box>,
    u.contextEstimated ? emptyLine(ui, 'c-estimated', L('컴팩트 직후라 추정값입니다.', 'Estimated right after a compact.')) : null,
    ctxBar(
      ui,
      surface,
      ctxPercent,
      permParts,
      TALK_HEX,
      tilePx,
      perm
        ? L(
            `컨텍스트 ${Math.round(ctxPercent)}%: 상주 ${fmtTokens(perm.tokens)}${split ? `(기본 적재 ${fmtTokens(split.fixed)} + 컴팩트 요약 ${fmtTokens(split.summary)})` : ''} · 대화 ${fmtTokens(talk)}`,
            `Context ${Math.round(ctxPercent)}%: resident ${fmtTokens(perm.tokens)}${split ? ` (base load ${fmtTokens(split.fixed)} + compact summary ${fmtTokens(split.summary)})` : ''} · conversation ${fmtTokens(talk)}`,
          )
        : L(`컨텍스트 ${Math.round(ctxPercent)}%`, `Context ${Math.round(ctxPercent)}%`),
      [
        { percent: pctOf(t.ctxWarn), hex: LEVEL_HEX.warn },
        { percent: pctOf(t.ctxCut), hex: LEVEL_HEX.cut },
      ],
      ctxAnim,
    ),
    surface === 'desktop' ? (
      <Box key="c-marks" columnGap={1} flexWrap="wrap">
        <Text color={LEVEL_HEX.warn}>┃</Text>
        <Text dimColor>{`${num(t.ctxWarn)} ${t.isRange ? L('컴팩트할 때', 'time to compact') : L('곧 컴팩트할 때', 'compact soon')}`}</Text>
        <Text color={LEVEL_HEX.cut}>┃</Text>
        <Text dimColor>{`${num(t.ctxCut)} ${t.isRange ? L('늦어짐', 'overdue') : L('컴팩트 권장', 'compact advised')}`}</Text>
      </Box>
    ) : null,
    permEl,
  ]
  const ctxTile = (
    <Box key="c-tile" flexDirection="column" {...TILE}>
      {ctxRows}
    </Box>
  )

  const costRows: unknown[] = []
  if (modelLine) costRows.push(<Text key="k-model" dimColor wrap="wrap">{modelLine}</Text>)
  if (est.kind === 'warm') {
    const isLate = est.minsLeft !== null && est.minsLeft < cacheWarnFor(t, est.ttlMin)
    const guessNote = u.cacheTtlMeasured === false ? L(' 추정', ' est.') : ''
    costRows.push(
      row(
        ui,
        'k-call',
        L('다음 요청', 'Next request'),
        `${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`,
        est.minsLeft === null ? (
          <Text dimColor>{L('캐시 남은 시간 모름', 'cache time left unknown')}</Text>
        ) : (
          <Text>
            <Text dimColor>{L('캐시 만료까지 ', 'cache expires in ')}</Text>
            <Text {...(isLate ? { color: 'warning' } : {})}>{L(`${est.minsLeft}분 남음`, `${est.minsLeft}m`)}</Text>
            <Text dimColor>{L(` · ${ttlName(est.ttlMin)} 캐시`, ` · ${ttlName(est.ttlMin)} cache`)}</Text>
            {guessNote ? <Text dimColor>{guessNote}</Text> : null}
            <Text {...(isLate ? { color: 'error' } : { dimColor: true })}>{L(` · 넘기면 ${approxUsd(est.rewriteUsd)}`, ` · after that ${approxUsd(est.rewriteUsd)}`)}</Text>
          </Text>
        ),
        LEVEL_TEXT[level],
      ),
    )
  }
  if (est.kind === 'cold') {
    costRows.push(
      row(
        ui,
        'k-cold',
        L('다음 요청', 'Next request'),
        `${approxUsd(est.rewriteUsd)}`,
        est.reason === 'model'
          ? L(`모델이 바뀌어(${switchText(u.switchedFrom, u.model)}) 전체를 다시 씁니다`, `model switched (${switchText(u.switchedFrom, u.model)}), so it rewrites everything`)
          : L('캐시가 만료돼 전체를 다시 씁니다', 'cache expired, so it rewrites everything'),
        'error',
      ),
    )
  }
  if (est.kind === 'unpriced') {
    costRows.push(<Text key="k-none" dimColor wrap="wrap">{L(`요율을 모르는 모델(${u.model})이라 토큰만 보여 줍니다.`, `Unknown rates for this model (${u.model}) — showing tokens only.`)}</Text>)
  }
  const costEl =
    costRows.length > 0 ? (
      <Box key="k-rows" flexDirection="column" marginTop={1}>
        {costRows}
      </Box>
    ) : null

  const isFolded = fold !== undefined && !fold.isOpen
  const hint = (
    <Text>
      {isFolded ? <Text>{L('컨텍스트 ', 'Context ')}</Text> : null}
      {isFolded ? <Text bold color={LEVEL_TEXT[level]}>{`${u.contextEstimated ? '~' : ''}${fmtTokens(u.contextTokens)}`}</Text> : null}
      {isFolded && u.costUsd !== null ? <Text dimColor>{' · '}</Text> : null}
      {u.costUsd !== null ? <Text>{L('누적 ', 'Total ')}</Text> : null}
      {u.costUsd !== null ? sessionUsd(ui, u.costUsd, colors) : null}
    </Text>
  )
  return section(ui, 's-now', nowTitle(), [ctxTile, costEl], hint, true, NOW_ICON, fold)
}

export const nowTitle = () => L('이 세션', 'This session')

export const NOW_ICON = 'session' as const

export function decisionLine(ui: Ui, u: Usage, sums: readonly TurnSummary[], nowMs: number, inputs: CompactInputs | null) {
  const { Text } = ui
  const est = estimateFor(u, nowMs)
  if (est.kind === 'unpriced') return null
  const ctx = u.contextTokens
  const t = thresholds()
  const head = (text: string, color?: string) => <Text bold {...(color ? { color } : {})}>{text}</Text>
  if (est.kind === 'cold') {
    const c = inputs ? coldFor(u, inputs) : null
    return (
      <Text wrap="wrap">
        {head(est.reason === 'model' ? withIcon('🔄', L('모델 바뀜', 'Model switched')) : withIcon('🧊', L('캐시 만료', 'Cache expired')), 'error')}
        <Text>{L(` · 다음 요청 ${approxUsd(est.rewriteUsd)}`, ` · next request ${approxUsd(est.rewriteUsd)}`)}</Text>
        {c === null ? null : c.compactUsd < c.continueUsd ? (
          <Text>{L(` · 지금 컴팩트하면 ${approxUsd(c.continueUsd - c.compactUsd)} 덜 듭니다`, ` · compacting now costs ${approxUsd(c.continueUsd - c.compactUsd)} less`)}</Text>
        ) : (
          <Text>{L(` · 지금 컴팩트하면 ${approxUsd(c.compactUsd - c.continueUsd)} 더 들어 그냥 이어 가는 편이 낫습니다`, ` · compacting now costs ${approxUsd(c.compactUsd - c.continueUsd)} more, so keep going`)}</Text>
        )}
      </Text>
    )
  }
  const level = levelOf(ctx)
  const after = inputs ? Math.min(inputs.after, ctx) : null
  const isLittle = after !== null && after > 0 && ctx / after < LITTLE_SHRINK
  if (level !== 'ok' && isLittle) return <Text wrap="wrap">{head(L('아낄 게 거의 없어 지금 컴팩트하면 손해입니다', 'Little to save, so compacting now is a loss'), 'error')}</Text>
  if (level !== 'ok') {
    const name =
      level === 'cut'
        ? t.isRange
          ? L('컴팩트 늦어짐', 'Compact overdue')
          : L('컴팩트 권장', 'Compact advised')
        : t.isRange
          ? L('컴팩트할 때', 'Time to compact')
          : L('곧 컴팩트할 때', 'Compact soon')
    const pay = inputs ? compactPayoff(ctx, inputs, u.model, average(sums.slice(-10).map(x => x.steps).filter(n => n > 0))) : null
    return (
      <Text wrap="wrap">
        {head(name, LEVEL_TEXT[level])}
        {pay ? (
          <Text>
            {pay.saveQuestionUsd !== null
              ? L(` · 지금 컴팩트하면 질문마다 ${approxUsd(pay.saveQuestionUsd)} 아낍니다`, ` · compacting now saves ${approxUsd(pay.saveQuestionUsd)} per question`)
              : L(` · 지금 컴팩트하면 요청마다 ${approxUsd(pay.saveCallUsd)} 아낍니다`, ` · compacting now saves ${approxUsd(pay.saveCallUsd)} per request`)}
          </Text>
        ) : null}
      </Text>
    )
  }
  return (
    <Text wrap="wrap">
      {head(L('여유', 'Room left'))}
      <Text>{L(` · 다음 요청 ${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`, ` · next request ${approxUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}`)}</Text>
      <Text dimColor>
        {L(` · ${fmtTokens(t.ctxWarn)}까지 ${fmtTokens(Math.max(0, t.ctxWarn - ctx))} 남았습니다`, ` · ${fmtTokens(Math.max(0, t.ctxWarn - ctx))} to ${fmtTokens(t.ctxWarn)}`)}
      </Text>
    </Text>
  )
}

function sessionUsd(ui: Ui, usd: number, colors: readonly [number, number, number]) {
  const color = sessionColorOf(usd, colors)
  return (
    <ui.Text bold {...(color ? { color } : {})}>
      {fmtUsd(usd)}
    </ui.Text>
  )
}

export function drawSummary(
  ui: Ui,
  u: Usage | null,
  sums: readonly TurnSummary[],
  nowLine: unknown,
  decideEl: unknown,
  extra: unknown = null,
  fold?: Fold,
  colors: readonly [number, number, number] = SESSION_COLORS_DEFAULT,
  cols: number | null = null,
  tally: Tally | null = null,
) {
  const { Box, Text } = ui
  const tallied = tallyOf(sums, tally)
  const total = tallied.usd
  const agentUsd = tallied.agentUsd
  const appUsd = tallied.appUsd
  const names = [L('질문', 'Questions'), L('지금', 'Now')]
  const labelW = nameColW(names)
  const isStacked = isStackedFor(cols, labelW)
  const line = (key: string, name: string, body: unknown) =>
    isStacked ? (
      <Box key={key} flexDirection="column">
        {name ? <Text>{name}</Text> : null}
        {body}
      </Box>
    ) : (
      <Box key={key} columnGap={1}>
        <Box width={labelW} flexShrink={0}>
          <Text>{name}</Text>
        </Box>
        <Box flexShrink={1} minWidth={0}>
          {body}
        </Box>
      </Box>
    )
  const questions =
    tallied.count === 0 ? (
      <Text dimColor>{L('아직 끝난 질문이 없습니다.', 'No finished questions yet.')}</Text>
    ) : (
      <Text wrap="wrap">
        <Text>{L(`${tallied.count}개 `, `${tallied.count} · `)}</Text>
        <Text bold>{fmtUsd(total)}</Text>
        <Text dimColor>{L(' · 질문당 평균 ', ' · avg per question ')}</Text>
        <Text>{fmtUsd(total / tallied.count)}</Text>
      </Text>
    )
  const outside = tallied.outsideUsd > 0 ? <Text wrap="wrap" dimColor>{outsideText(tallied, false)}</Text> : null
  const mainPart = L(`메인 ${fmtUsd(Math.max(0, total - agentUsd - appUsd))}`, `main ${fmtUsd(Math.max(0, total - agentUsd - appUsd))}`)
  const agentPartText = agentUsd > 0 ? withIcon('🤖', L(`에이전트 ${fmtUsd(agentUsd)}`, `agents ${fmtUsd(agentUsd)}`)) : null
  const appPart = appUsd >= APP_MIN_USD ? withIcon('⚙', L(`앱 자체 요청 ${fmtUsd(appUsd)}`, `app's own ${fmtUsd(appUsd)}`)) : null
  const split =
    agentUsd > 0 || appUsd >= APP_MIN_USD ? (
      agentPartText && agentPartText.startsWith('🤖 ') && onDesktop() ? (
        <Box key="m-split-row" flexDirection="row" flexWrap="wrap" alignItems="center">
          <Text dimColor>{mainPart}</Text>
          {agentText(ui, 'm-split-agents', agentPartText, sums.reduce((n, s) => n + (agentSum(s.details)?.runningCount ?? 0), 0), { dimColor: true }, ' · ')}
          {appPart ? <Text dimColor>{` · ${appPart}`}</Text> : null}
        </Box>
      ) : (
        <Text wrap="wrap" dimColor>
          {[mainPart, agentPartText, appPart].filter(Boolean).join(' · ')}
        </Text>
      )
    ) : null
  const hint =
    u && u.costUsd !== null ? (
      <Text>
        <Text>{L('누적 ', 'Total ')}</Text>
        {sessionUsd(ui, u.costUsd, colors)}
      </Text>
    ) : undefined
  return section(
    ui,
    's-summary',
    nowTitle(),
    [
      line('m-q', L('질문', 'Questions'), questions),
      split ? line('m-split', '', split) : null,
      outside ? line('m-outside', '', outside) : null,
      extra ? line('m-extra', '', extra) : null,
      nowLine ? line('m-now', L('지금', 'Now'), nowLine) : null,
      decideEl ? line('m-decide', '', decideEl) : null,
    ],
    hint,
    true,
    NOW_ICON,
    fold,
  )
}


export function drawCompactCard(ui: Ui, parts: FlowParts, effEl: unknown, fold?: Fold, timing: unknown = null) {
  const { Box, Text } = ui
  const state = fold !== undefined && !fold.isOpen ? parts.state : null
  return section(
    ui,
    's-compact',
    L('컴팩트', 'Compact'),
    [
      parts.gauge || effEl || timing ? (
        <Box key="c-decide" flexDirection="column" {...TILE}>
          {parts.gauge}
          {effEl}
          {parts.gaugeNote}
          {timing ? (
            <Box key="c-timing" flexDirection="column" marginTop={1}>
              {timing}
            </Box>
          ) : null}
        </Box>
      ) : null,
      ...parts.details,
    ],
    parts.gain === null && state === null ? undefined : (
      <Text>
        {state ? <Text bold color={state.color}>{`● ${state.word}`}</Text> : null}
        {state && parts.gain !== null ? <Text dimColor>{' · '}</Text> : null}
        {parts.gain !== null ? (
          <Text bold color={parts.gain >= 0 ? 'success' : 'error'}>
            {L(`총 ${gainText(parts.gain)}`, `total ${gainText(parts.gain)}`)}
          </Text>
        ) : null}
      </Text>
    ),
    true,
    'compact',
    fold,
  )
}

export type AllSpendLine = { today: number | null; month: number | null; todayColor?: string; monthColor?: string; retro?: number | null; state: 'ok' | 'measuring' | 'failed' }

export function drawAllSpend(ui: Ui, line: AllSpendLine | null) {
  const { Box, Text } = ui
  if (!line) return null
  const amounts: [string, string, number, string | undefined][] = []
  if (line.today !== null) amounts.push(['a-today', L('오늘 ', 'Today '), line.today, line.todayColor])
  if (line.month !== null) amounts.push(['a-month', L('이번 달 ', 'This month '), line.month, line.monthColor])
  if (line.state === 'ok' && amounts.length === 0) return null
  const name = L('모든 세션(추정)', 'All sessions (est.)')
  const head: LineCell = { key: 'a-name', text: name, el: () => <Text dimColor>{name}</Text> }
  const stateText =
    line.state === 'failed'
      ? L('재지 못했습니다. 기록을 읽으려면 Node 14.8 이상이 필요합니다', 'Not measured. Reading transcripts needs Node 14.8+')
      : L('재는 중…', 'Measuring…')
  const retroText = line.retro !== undefined && line.retro !== null && line.retro >= 0.005 ? L(`컴팩트 추정 +${fmtUsd(line.retro)} 별도`, `+${fmtUsd(line.retro)} est. compacts not included`) : null
  const cells: LineCell[] =
    line.state === 'ok'
      ? [
          head,
          ...amounts.map(([key, label, usd, color], j): LineCell => {
            const lead = j === 0 ? ' ' : ' · '
            return {
              key,
              text: `${lead}${label}${fmtUsd(usd)}`,
              el: () => (
                <Text>
                  <Text dimColor>{`${lead}${label}`}</Text>
                  <Text bold {...(color ? { color } : {})}>
                    {fmtUsd(usd)}
                  </Text>
                </Text>
              ),
            }
          }),
          ...(retroText ? [{ key: 'a-retro', text: ` · ${retroText}`, drop: 1, el: () => <Text dimColor>{` · ${retroText}`}</Text> }] : []),
        ]
      : [head, { key: 'a-state', text: ` ${stateText}`, el: () => <Text dimColor>{` ${stateText}`}</Text> }]
  return (
    <Box key="s-all" flexDirection="column" marginTop={1} paddingX={1}>
      {fitLine(ui, cells, null).el}
    </Box>
  )
}

export function rateChangeText(model: string, n: (v: number) => string, since: Record<string, string> | null = null): string | null {
  const hist = rateHistory(model)
  const now = ratesFor(model)
  if (hist.length === 0 || !now) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const md = (day: string) => {
    const [, m = 1, d = 1] = day.split('-').map(Number)
    return L(`${m}월 ${d}일`, `${months[m - 1] ?? m} ${d}`)
  }
  const fields: [keyof Rates, string, string][] = [
    ['input', '입력', 'input'],
    ['output', '출력', 'output'],
    ['read', '캐시 읽기', 'cache read'],
    ['write1h', '쓰기', 'write'],
  ]
  const steps: string[] = []
  let byEngine = false
  hist.forEach((change, i) => {
    const next = hist[i + 1]?.base ?? now
    for (const [key, ko, en] of fields) {
      const a = change.base[key] as number
      const b = next[key] as number
      if (a === b) continue
      if (change.minEngine) {
        byEngine = true
        const day = since?.[change.minEngine]
        const pc = day ? L(` · 이 PC 는 ${md(day)}`, ` · on this PC ${md(day)}`) : ''
        const ann = change.announced ? L(` · 가격표 발표는 ${md(change.announced)}`, ` · the price list says ${md(change.announced)}`) : ''
        steps.push(L(`${ko} ${n(a)} → ${n(b)}(Claude Code ${change.minEngine} 부터${pc}${ann})`, `${en} ${n(a)} → ${n(b)} (from Claude Code ${change.minEngine}${pc}${ann})`))
        continue
      }
      const why = change.announced && change.announced !== change.until ? L(` · 앱 설정(사용량) 화면에 맞췄고, 가격표 발표는 ${md(change.announced)}`, ` · matched to Claude's usage page; the price list says ${md(change.announced)}`) : ''
      steps.push(L(`${ko} ${n(a)} → ${n(b)}(${md(change.until)}부터${why})`, `${en} ${n(a)} → ${n(b)} (from ${md(change.until)}${why})`))
    }
  })
  if (steps.length === 0) return null
  if (byEngine) {
    return L(
      `요율이 바뀐 것: ${steps.join(' · ')}. 앱 설정(사용량) 화면처럼 요청마다 그 요청을 보낸 Claude Code 판의 요율로 셉니다.`,
      `Rate change: ${steps.join(' · ')}. Like Claude's usage page, each request uses the rates of the Claude Code version that sent it.`,
    )
  }
  return L(`요율이 바뀐 것: ${steps.join(' · ')}. 그 전 기록은 그때 요율로 셉니다.`, `Rate change: ${steps.join(' · ')}. Earlier records use the rate of their day.`)
}

export function drawReference(ui: Ui, u: Usage | null, last: TurnSummary | null, nowMs: number, since: Record<string, string> | null = null) {
  const { Box, Text } = ui
  if (!u) return null
  const est = estimateFor(u, nowMs)
  if (est.kind === 'unpriced') return null
  const r = est.rates
  const n = (v: number) => (v < 1 ? v.toFixed(2) : String(v))
  return (
    <Box key="s-ref" flexDirection="column" marginTop={1} paddingX={1}>
      {priceWarnings(u.model, u.window).map((w, i) => (
        <Text key={`ref-warn-${i}`} color="warning" wrap="wrap">
          {`⚠ ${w}`}
        </Text>
      ))}
      <Text dimColor wrap="wrap">
        {L(
          `금액은 모두 API 정가로 셈한 값입니다. ${r.label} 요율($/MTok): 입력 ${n(r.input)} · 출력 ${n(r.output)} · 캐시 읽기 ${n(r.read)} · 쓰기 ${n(r.write1h)}(1시간)`,
          `All amounts are at API list prices. ${r.label} rates ($/MTok): input ${n(r.input)} · output ${n(r.output)} · cache read ${n(r.read)} · write ${n(r.write1h)} (1h)`,
        )}
      </Text>
      {(() => {
        const change = rateChangeText(u.model, n, since)
        return change ? (
          <Text key="ref-rate-change" dimColor wrap="wrap">
            {change}
          </Text>
        ) : null
      })()}
      {last?.effort || last?.ultra ? (
        <Text dimColor wrap="wrap">
          {ultraPieces(
            ui,
            'ref-effort',
            L(
              `생각 깊이(앱 메뉴의 '노력') ${effortLabel(last.effort, last.ultra)}(지난 질문 기준) · 깊을수록 생각 토큰이 늘어 출력 값이 커집니다 — 금액엔 이미 들어 있습니다`,
              `Effort ${effortLabel(last.effort, last.ultra)} (last question) · higher effort uses more thinking tokens, so output costs more — already counted in the amounts`,
            ),
          )}
        </Text>
      ) : null}
    </Box>
  )
}
