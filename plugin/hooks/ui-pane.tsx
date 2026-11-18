import type { CompactInputs, CompactPhase, LiveTurn, Optimal, PaneMode, Settings, TurnSummary, UpdateState, Usage } from '../types'
import type { Flow } from './flow'
import { cacheWarnFor, estimateFor, fmtTokens, fmtUsd, LEVEL_TEXT, levelOf, thresholds, ttlOf } from './cost'
import { bandShowOf, isSlim, paneModeName, revealLabel, slimViewOf, viewOf } from './settings'
import { ctxNumText, modelCompareText } from './text'
import { CARD_INSET, foldCard, foldHead, gaugeEl, hoverTip, narrowFold, narrowOf, previewChip, segButton, segGroup } from './ui-common'
import type { Fold, Grid, Ui } from './ui-common'
import { ctxUnitNow, drawBandPreview } from './ui-band'
import type { BandPreviewExtra, SpendShown } from './ui-band'
import { compactingBlock, decisionLine, drawAllSpend, drawCompactCard, drawEfficiency, drawFlow, drawHistory, drawNow, drawReference, drawSummary, liveBlock, tallyOf } from './ui-usage'
import type { AllSpendLine, Perm, Tally } from './ui-usage'
import { drawCompactTiming, updateButton } from './ui-settings'
import type { SettingsTab } from './ui-settings'
import { answerPreview, liveSample } from './ui-answer'
import { statusLineText } from './status-line'
import { L } from './i18n'

export type PaneHeadData = {
  u: Usage | null
  isSettings: boolean
  paneMode: PaneMode
  upd: UpdateState
  isDrawerOpen: boolean
  motion: boolean
  shrink: { from: number; to: number } | null
  phase: CompactPhase
}

export type PaneHeadActions = { openTab: (which: 'main' | 'settings') => void; setMode: (mode: PaneMode) => void; toggleDrawer: () => void }

export function drawPaneHead(ui: Ui, surface: string, d: PaneHeadData, act: PaneHeadActions) {
  const { Box } = ui
  const tab = (key: string, label: string, isOn: boolean, onPress: () => void) => segButton(ui, `pane-${key}`, label, isOn, onPress)
  const headBusy = d.phase === 'compacting' || d.phase === 'tidying'
  const u = d.u
  const isNarrow = narrowOf(ui) !== null
  return (
    <Box key="pane-tabs" columnGap={2} rowGap={isNarrow ? 0 : 1} flexWrap="wrap" alignItems="center">
      <Box key="pane-tab-group" columnGap={1} flexShrink={0} alignItems="center">
        {(() => {
          const shrink = d.shrink
          const moving = d.motion
          const busy = headBusy && !shrink
          return gaugeEl(ui, surface, shrink ? shrink.to : (u?.contextTokens ?? 0), {
            key: 'pane-head-gauge',
            alt: u
              ? busy
                ? L(`컨텍스트 ${fmtTokens(u.contextTokens)} · ${d.phase === 'tidying' ? '저장 중' : '컴팩트 중'}`, `Context ${fmtTokens(u.contextTokens)} · ${d.phase === 'tidying' ? 'saving' : 'compacting'}`)
                : L(`컨텍스트 ${fmtTokens(u.contextTokens)}`, `Context ${fmtTokens(u.contextTokens)}`)
              : L('컨텍스트 아직 모름', 'Context not known yet'),
            px: 18,
            motion: moving,
            live: moving,
            busy,
            ...(shrink ? { fromCtx: shrink.from } : {}),
          })
        })()}
        {segGroup(ui, 'pane-tab-pair', [
          tab('usage', L('현황', 'Overview'), !d.isSettings, () => act.openTab('main')),
          tab('settings', L('설정', 'Settings'), d.isSettings, () => act.openTab('settings')),
        ])}
      </Box>
      <Box key="pane-mode" columnGap={1} alignItems="center" flexGrow={1} justifyContent="flex-end" flexWrap="wrap">
        {d.isSettings || isNarrow ? null : <ui.Text dimColor>{L('보기', 'View')}</ui.Text>}
        {d.isSettings
          ? null
          : segGroup(ui, 'pane-mode-pair', [
              tab('simple', paneModeName('simple'), d.paneMode === 'simple', () => act.setMode('simple')),
              tab('detail', paneModeName('detail'), d.paneMode === 'detail', () => act.setMode('detail')),
            ])}
        {isNarrow && !d.isSettings ? null : updateButton(ui, d.upd, d.isDrawerOpen, act.toggleDrawer)}
      </Box>
    </Box>
  )
}

export type PreviewData = {
  setTab: SettingsTab
  s: Settings
  u: Usage | null
  pvU: Usage
  pvTurn: TurnSummary
  isSample: boolean
  nowMs: number
  inputs: CompactInputs | null
  spend: SpendShown | null
  cols: number
  phase: CompactPhase | null
  open: Record<string, boolean>
  isPreviewOpen: boolean
}

export type PreviewActions = { toggleFold: (key: string) => void; togglePreview: () => void }

export function settingsPreviews(ui: Ui, surface: string, d: PreviewData, act: PreviewActions) {
  const { Box } = ui
  const isTerminal = surface === 'terminal'
  const sSet = d.s
  const pvU = d.pvU
  const pvBoxW = d.cols - (isTerminal ? 10 : 7)
  const pvBand = (extra: BandPreviewExtra = {}) =>
    drawBandPreview(ui, surface, pvU, d.nowMs, d.inputs, bandShowOf(sSet), sSet.sessionColors, d.pvTurn, viewOf(sSet).layout === 'one', d.spend, pvBoxW, extra)
  const pvLevel = pvU.contextTokens > 0 ? levelOf(pvU.contextTokens) : null
  const pvStatus =
    d.setTab === 'bar' && sSet.statusLine && !isSlim(sSet)
      ? statusLineText({
          tokens: pvU.contextTokens > 0 ? pvU.contextTokens : null,
          window: pvU.window,
          level: pvLevel,
          thr: thresholds(),
          unit: sSet.ctxUnit,
          costUsd: pvU.costUsd ?? null,
          phase: d.phase ?? 'idle',
        })
      : null
  const openSet = d.open
  const pvFold = narrowFold(ui, 'card-preview')
  const folded = (el: unknown) =>
    pvFold ? (
      <Box key="pv-narrow" flexDirection="column">
        {foldHead(ui, 'pv-narrow', L('미리보기', 'Preview'), pvFold)}
        {pvFold.isOpen ? el : null}
      </Box>
    ) : (
      el
    )
  const shown = (pv: { bar: unknown; chip: unknown }) => ({ bar: pv.bar ? folded(pv.bar) : null, chip: pv.chip ? folded(pv.chip) : null })
  return d.setTab === 'bar'
    ? shown({
        bar: (
          <Box key="pv" flexDirection="column">
            {pvBand({
              label: hoverTip(
                ui,
                'pv-bar-tip',
                previewChip(ui, 'pv-bar-chip', L('미리보기 · 입력창 위', 'Preview · above the input')),
                L('입력창 바로 위에 늘 떠 있는 줄입니다.', 'Always shown right above the input.') +
                  (d.u ? L(' 견본은 이 세션 값입니다.', ' The sample uses this session.') : L(' 견본은 예시 값입니다.', ' Example values.')),
                { isOpen: openSet['desc-pv-bar-tip'] === true, onToggle: () => act.toggleFold('desc-pv-bar-tip') },
              ),
              stage: true,
              band: sSet.band,
              ...(isSlim(sSet) ? { slim: slimViewOf(sSet) } : {}),
              foldedLabel: sSet.bandFolded && !isSlim(sSet) ? revealLabel(false, pvLevel, pvU.contextTokens > 0 ? ctxNumText(pvU.contextTokens, pvU.window, sSet.ctxUnit) : null) : null,
              statusLine: pvStatus,
              live: slimViewOf(sSet).spin === 'off' ? null : liveSample(ui, d.pvTurn, viewOf(sSet).info === 'full', surface, isSlim(sSet)),
            })}
          </Box>
        ),
        chip: null,
      })
    : d.setTab === 'chip'
      ? shown({
          bar: null,
          chip: answerPreview(ui, d.pvTurn, d.isSample, viewOf(sSet).info === 'full', surface, d.isPreviewOpen, sSet.questionHover, openSet['desc-pv-answer-tip'] === true, { toggleTip: () => act.toggleFold('desc-pv-answer-tip'), toggleOpen: act.togglePreview }),
        })
      : null
}

export type PaneMainData = {
  u: Usage | null
  sums: readonly TurnSummary[]
  nowMs: number
  now: LiveTurn | null
  phase: CompactPhase
  kind: string
  detail: 'summary' | 'steps'
  tally: Tally
  fullIds: readonly (number | 'live')[]
  flow: Flow
  flowLoaded: boolean
  flowNote: string | null
  widthPx: number
  effectsAll: boolean
  flowAll: boolean
  opt: Optimal | null
  inputs: CompactInputs | null
  perm: Perm | null
  cardsOpen: { now: boolean; history: boolean; compact: boolean }
  expanded: number | null
  historyAll: boolean
  s: Settings
  cols: number
  g: Grid
  timingErr: string | null
  open: Record<string, boolean>
  autoBand: { start: number; end: number } | null
  mode: PaneMode
  allLine: AllSpendLine | null
  rateSince: Record<string, string> | null
}

export type PaneMainActions = {
  toggleFull: (id: number | 'live') => void
  setEffectsAll: (isAll: boolean) => void
  setFlowAll: (isAll: boolean) => void
  toggleCard: (which: 'now' | 'history' | 'compact') => void
  setHistoryAll: (isAll: boolean) => void
  toggleExpanded: (id: number) => void
  save: (chosen: Settings) => void
  sizeError: (msg: string | null) => void
  toggleFold: (key: string) => void
}

export function drawPaneGlance(ui: Ui, d: { u: Usage | null; sums: readonly TurnSummary[]; tally: Tally | null; nowMs: number; allLine: AllSpendLine | null }) {
  const { Box, Text } = ui
  const u = d.u
  if (!u) {
    return (
      <Box key="glance" flexDirection="column">
        <Text dimColor wrap="wrap">
          {L('아직 잰 값이 없습니다. 질문이 한 번 끝나면 채워집니다.', 'Nothing measured yet. Filled in after the first question finishes.')}
        </Text>
      </Box>
    )
  }
  const tallied = tallyOf(d.sums, d.tally)
  const today = d.allLine?.state === 'ok' ? d.allLine.today : null
  const second = [
    tallied.count > 0 ? L(`질문 ${tallied.count}개 합 ${fmtUsd(tallied.usd)}`, `${tallied.count} ${tallied.count === 1 ? 'question' : 'questions'} ${fmtUsd(tallied.usd)}`) : null,
    today !== null ? L(`오늘 ${fmtUsd(today)}`, `today ${fmtUsd(today)}`) : null,
  ].filter((x): x is string => x !== null)
  const est = estimateFor(u, d.nowMs)
  const cache =
    est.kind === 'cold'
      ? { text: L('캐시 만료 — 다음 요청은 대화 전체를 다시 씁니다', 'Cache expired — the next request rewrites everything'), color: 'error' }
      : est.kind === 'warm' && est.minsLeft !== null
        ? { text: L(`캐시 만료 ${est.minsLeft}분 남음`, `Cache expires in ${est.minsLeft} min`), color: est.minsLeft < cacheWarnFor(thresholds(), est.ttlMin) ? 'warning' : null }
        : null
  return (
    <Box key="glance" flexDirection="column">
      <Text key="glance-ctx" wrap="wrap">
        <Text>{L('컨텍스트 ', 'Context ')}</Text>
        <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>{`${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, ctxUnitNow())}`}</Text>
        {u.costUsd !== null ? <Text>{L(' · 누적 ', ' · total ')}</Text> : null}
        {u.costUsd !== null ? <Text bold>{fmtUsd(u.costUsd)}</Text> : null}
      </Text>
      {second.length > 0 ? (
        <Text key="glance-sum" dimColor wrap="wrap">
          {second.join(' · ')}
        </Text>
      ) : null}
      {cache ? (
        <Text key="glance-cache" wrap="wrap" {...(cache.color ? { color: cache.color } : { dimColor: true })}>
          {cache.text}
        </Text>
      ) : null}
    </Box>
  )
}

export function drawPaneMain(ui: Ui, surface: string, d: PaneMainData, act: PaneMainActions) {
  const { Box } = ui
  const { u, nowMs, opt, perm, cols, g } = d
  const allSums = d.sums
  const nowTurn = d.now
  const phase = d.phase
  const inputsNow = d.inputs
  const isTerminal = surface === 'terminal'
  const qDetail = d.detail
  const liveEl =
    nowTurn
      ? liveBlock(ui, nowTurn, allSums[allSums.length - 1], cols - CARD_INSET, g, surface, phase, d.kind, qDetail, {
          isOn: d.fullIds.includes('live'),
          toggle: () => act.toggleFull('live'),
        })
      : phase === 'compacting'
        ? compactingBlock(ui, g, surface, d.kind)
        : null
  const flowParts = drawFlow(ui, surface, d.flow, d.flowLoaded, d.flowNote, u, d.widthPx, d.effectsAll, act.setEffectsAll, nowMs, opt, d.flowAll, act.setFlowAll, d.flow.questions ?? [])
  const effEl = u && inputsNow ? drawEfficiency(ui, u, allSums, nowMs, perm ? { ...inputsNow, after: perm.tokens } : inputsNow, cols - CARD_INSET * 2) : null
  const isNarrow = narrowOf(ui) !== null
  const foldOf = (which: 'now' | 'history' | 'compact'): Fold => narrowFold(ui, `card-${which}`) ?? { isOpen: d.cardsOpen[which], onToggle: () => act.toggleCard(which) }
  const liveNote =
    nowTurn
      ? { text: L(`진행 중 ${fmtUsd(nowTurn.cost.usd)}`, `running ${fmtUsd(nowTurn.cost.usd)}`), isRunning: true }
      : phase === 'compacting'
        ? { text: L('컴팩트 중', 'compacting'), isRunning: false }
        : null
  const history = drawHistory({ setAll: act.setHistoryAll, toggle: act.toggleExpanded, isFull: id => d.fullIds.includes(id), toggleFull: act.toggleFull }, ui, allSums, nowMs, d.expanded, d.historyAll, liveEl, cols - CARD_INSET, g, foldOf('history'), liveNote, qDetail, !isTerminal && d.s.questionHover, d.tally, qDetail === 'steps')
  const modelLine = u ? modelCompareText(allSums, u.model, ttlOf(u)) : null
  const sPane = d.s
  const colors = sPane.sessionColors
  const timingAct = {
    save: act.save,
    sizeError: act.sizeError,
    toggle: act.toggleFold,
  }
  const timingEl = (mode: 'simple' | 'detail') =>
    drawCompactTiming(timingAct, ui, sPane, opt, u?.contextTokens ?? null, surface, cols - CARD_INSET, { ttl: ttlOf(u), measured: u?.cacheTtlMeasured === true, config: null }, mode, d.timingErr, d.open, d.autoBand, true)
  const allEl = drawAllSpend(ui, d.allLine)
  const refEl = d.mode === 'simple' ? null : drawReference(ui, u, allSums.length > 0 ? allSums[allSums.length - 1]! : null, nowMs, d.rateSince)
  const narrowCard = (key: 'ref' | 'all', title: string, hint: string | null, el: unknown) => {
    const fold = narrowFold(ui, `card-${key}`)
    return el && fold ? foldCard(ui, `s-${key}-narrow`, title, fold, [el], fold.isOpen ? null : hint) : null
  }
  const allLine = d.allLine
  const allHint = !allLine
    ? null
    : allLine.state !== 'ok'
      ? null
      : allLine.today !== null
        ? L(`오늘 ${fmtUsd(allLine.today)}`, `today ${fmtUsd(allLine.today)}`)
        : allLine.month !== null
          ? L(`이번 달 ${fmtUsd(allLine.month)}`, `this month ${fmtUsd(allLine.month)}`)
          : null
  const allTop = isNarrow ? null : allEl
  const allBottom = isNarrow ? narrowCard('all', L('모든 세션', 'All sessions'), allHint, allEl) : null
  const refShown = isNarrow ? narrowCard('ref', L('참고', 'Reference'), L('정가 · 요율', 'list prices · rates'), refEl) : refEl
  return d.mode === 'simple' ? (
    <Box flexDirection="column">
      {allTop}
      {drawSummary(ui, u, allSums, u ? decisionLine(ui, u, allSums, nowMs, inputsNow) : null, timingEl('simple'), null, foldOf('now'), colors, cols, d.tally)}
      {history}
      {allBottom}
    </Box>
  ) : (
    <Box flexDirection="column">
      {allTop}
      {drawNow(ui, surface, u, nowMs, d.widthPx, perm, inputsNow, foldOf('now'), modelLine, colors)}
      {history}
      {drawCompactCard(ui, flowParts, effEl, foldOf('compact'), timingEl('detail'))}
      {refShown}
      {allBottom}
    </Box>
  )
}
