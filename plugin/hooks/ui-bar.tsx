import type { CompactEvent, CompactInputs, CompactPhase, PaneView, Settings, TurnSummary, Usage } from '../types'
import { approxUsd, average, coldFor, compactPayoff, estimateFor, fmtTokens, fmtUsd, isLittleToSave, LEVEL_HEX, LEVEL_TEXT, levelOf, thresholds } from './cost'
import { flashAnyOn, isFlashBusy } from './flash'
import { withIcon } from './glyph'
import { L } from './i18n'
import { isSlim, revealLabel, slimViewOf, TIDY_IDS, tidySteps, tidyStyles, viewOf } from './settings'
import { cellsOf, ctxNumText, fitCells, paneTitle, rangeNumText, textCh, widthOf } from './text'
import { directKeep } from './tidy'
import { afterCells, bandGrid, costGroups, drawLimitsLine, fitEstimateLine, fitLastTurnLine, fitLine, lastTurnCells, minShowOf, setCtxUnit, SLIM_BUTTON_PARTS, slimButtonText, slimParts, slimSummaryCells, bandShowNow } from './ui-band'
import type { SpendShown } from './ui-band'
import { ACCENT, CH_PX, segChoice, decoIcon, emptyLine, gaugeEl, gaugeShapeNow, nameColW, phaseLook, pulseDot, stageText } from './ui-common'
import { gaugeWidth } from './gauge'
import { autoBarChip, autoBarChipW, autoToggleEl } from './ui-auto'
import type { IconName, Ui } from './ui-common'

export type BarEvent = { surface: string; props: { isWorking: boolean; bodyColumns: number; maxRows: number } }

export type BarData = {
  sNow: Settings
  u: Usage | null
  view: PaneView | null
  isConfirming: boolean
  nowMs: number
  sums: readonly TurnSummary[]
  inputs: CompactInputs | null
  phase: CompactPhase
  kind: string
  just: CompactEvent | null
  shrink: { from: number; to: number } | null
  spendNow: SpendShown | null
  isSlimDismissed: boolean
  isSlimSummary: boolean
  tidyDraft: string | null
  compactDraft: string | null
  clearAsk: { questions: number | null } | null
  auto?: { isOn: boolean; label: string; tip: string } | null
}

export type BarActions = {
  toggleView: (view: PaneView) => Promise<unknown>
  openConfirm: () => Promise<unknown>
  closeConfirm: () => Promise<unknown>
  cancelTidy: () => Promise<unknown>
  tidyThenCompact: () => Promise<unknown>
  compactNow: (keep: string) => Promise<unknown>
  askClear: () => Promise<unknown>
  backFromClear: () => Promise<unknown>
  clearNow: () => Promise<unknown>
  pickTidy: (id: string) => Promise<unknown>
  setBand: (band: Settings['band']) => Promise<unknown>
  foldBand: () => Promise<unknown>
  toggleSummary: () => Promise<unknown>
  dismissSlim: () => Promise<unknown>
  typeTidy: (text: string) => Promise<unknown>
  typeCompact: (text: string) => Promise<unknown>
  saveTidy: (text: string) => Promise<unknown>
  saveCompact: (text: string) => Promise<unknown>
  toggleAuto?: () => Promise<unknown>
}

function autoPress(act: BarActions, isConfirming: boolean, isWorking: boolean): (() => void) | null {
  if (isConfirming) return () => void act.closeConfirm()
  if (isWorking) return act.toggleAuto ? () => void act.toggleAuto!() : null
  return () => void act.openConfirm()
}

const autoOffTip = () => L('누르면 이 세션의 이지 오토를 끕니다', 'Press to turn Easy Auto off in this session')

export function drawBar(ui: Ui, e: BarEvent, d: BarData, act: BarActions) {
  const { Box, Button, Text } = ui
  const { sNow, u, view, isConfirming, nowMs, sums, inputs, phase, kind, just, shrink, spendNow, isSlimDismissed, isSlimSummary, tidyDraft, compactDraft, clearAsk } = d
  const compactCore = L('컴팩트', 'Compact')
  const isLean = viewOf(sNow).layout === 'one'
  const fullShow = bandShowNow(slimViewOf(sNow), u, nowMs, sNow.sessionColors)
  const hasLimitsRow = !isLean && (u?.rateLimits ?? []).some(r => (r.kind === 'five_hour' ? fullShow.fiveHour : r.kind === 'seven_day' ? fullShow.sevenDay : true))
  const isOneRow = isLean || (!hasLimitsRow && !fullShow.lastTurn)
  const mode = isOneRow ? 'full' : sNow.band
  const show = mode === 'full' ? fullShow : minShowOf(fullShow)

  const lineEst = u && !e.props.isWorking ? estimateFor(u, nowMs) : null
  const showLastLine = !(mode !== 'full' || !show.lastTurn || lineEst?.kind === 'cold' || u?.isAfterCompact)
  const afterTokens = inputs?.after ?? u?.contextTokens ?? 0

  const level = u ? levelOf(u.contextTokens) : 'ok'
  const look = phaseLook(phase, kind, false)
  const est = u ? estimateFor(u, nowMs) : null
  const isSwitched = est?.kind === 'cold' && est.reason === 'model'
  const cold = u && inputs && est?.kind === 'cold' ? coldFor(u, inputs) : null
  const isColdWin = cold !== null && cold.compactUsd < cold.continueUsd
  const shownLevel = est?.kind === 'cold' && !isColdWin ? 'ok' : level
  const pulse = (hex: string, alt: string) => pulseDot(ui, e.surface, hex, alt)
  const withTip = (key: string, button: unknown, text: string | readonly string[], right = 4) =>
    e.surface === 'terminal' ? (
      <Box key={key}>{button}</Box>
    ) : (
      <Box key={key}>
        {button}
        <Box position="absolute" top={0} right={right} display="none" flexDirection="column" hover={{ display: 'flex' }}>
          {(typeof text === 'string' ? [text] : text).map((line, i) => (
            <Text key={`tip-${i}`} wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  const isRange = thresholds().isRange === true
  const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  const pay = u && inputs && est?.kind === 'warm' ? compactPayoff(u.contextTokens, inputs, u.model, callsPerQ) : null
  const isLittle = pay !== null && u !== null && isLittleToSave(u.contextTokens, afterTokens, pay.breakEvenCalls)
  const isJustShrunk = just !== null && u !== null && just.before > u.contextTokens
  const justPay = isJustShrunk && inputs ? compactPayoff(just.before, inputs, u.model, callsPerQ) : null
  const justTip = isJustShrunk
    ? [
        L(
          `방금 컴팩트함 · ${fmtTokens(just.before)} → ${u.contextEstimated ? '~' : ''}${fmtTokens(u.contextTokens)}`,
          `Just compacted · ${fmtTokens(just.before)} → ${u.contextEstimated ? '~' : ''}${fmtTokens(u.contextTokens)}`,
        ),
        ...(justPay && justPay.saveCallUsd > 0
          ? [
              justPay.saveQuestionUsd !== null
                ? L(`질문마다 ${approxUsd(justPay.saveQuestionUsd)} 아낌`, `saves ${approxUsd(justPay.saveQuestionUsd)} per question`)
                : L(`요청마다 ${approxUsd(justPay.saveCallUsd)} 아낌`, `saves ${approxUsd(justPay.saveCallUsd)} per request`),
            ]
          : []),
      ].join(' · ')
    : null
  const isNotNow = shownLevel === 'ok' && !isColdWin
  const thr = thresholds()
  const coldTip =
    est?.kind === 'cold' && !isColdWin
      ? cold
        ? L(
            `${isSwitched ? '모델이 바뀌었습니다' : '캐시가 만료됐습니다'}. 다음 요청은 ${approxUsd(cold.continueUsd)} 이고, 기본 컴팩트는 ${approxUsd(cold.compactUsd - cold.continueUsd)} 더 들어 그냥 이어 가는 편이 쌉니다`,
            `${isSwitched ? 'Model switched' : 'The cache has expired'}. The next request is ${approxUsd(cold.continueUsd)}, and a plain compact costs ${approxUsd(cold.compactUsd - cold.continueUsd)} more, so continuing as is is cheaper`,
          )
        : L(
            `${isSwitched ? '모델이 바뀌었습니다' : '캐시가 만료됐습니다'}. 다음 요청은 캐시를 다시 써 ${approxUsd(est.rewriteUsd)} 듭니다`,
            `${isSwitched ? 'Model switched' : 'The cache has expired'}. The next request rewrites the cache: ${approxUsd(est.rewriteUsd)}`,
          )
      : null
  const notNowTip =
    coldTip ??
    justTip ??
    (isLittle
      ? L('컨텍스트가 이미 작아 지금 컴팩트하면 손해입니다', 'The context is already small, so compacting now is a loss')
      : L('아직 컴팩트할 때가 아닙니다', 'Not time to compact yet'))
  setCtxUnit(sNow.ctxUnit)
  const ctxTip = u
    ? thr.isRange
      ? L(`컨텍스트 ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · 컴팩트 구간 ${rangeNumText(thr, u.window, sNow.ctxUnit)}`, `Context ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · compact range ${rangeNumText(thr, u.window, sNow.ctxUnit)}`)
      : L(`컨텍스트 ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · 컴팩트 기준 ${rangeNumText(thr, u.window, sNow.ctxUnit)}`, `Context ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · compact at ${rangeNumText(thr, u.window, sNow.ctxUnit)}`)
    : null
  const tipLines = (state: string): string[] => [state]
  const compactText =
    shownLevel === 'cut'
      ? isRange
        ? L('컴팩트 늦어짐', 'Compact overdue')
        : L('컴팩트 권장', 'Compact advised')
      : shownLevel === 'warn'
        ? isRange
          ? L('컴팩트할 때', 'Time to compact')
          : L('곧 컴팩트할 때', 'Compact soon')
        : compactCore
  const autoOn = d.auto?.isOn === true
  const compactLabel = autoOn ? d.auto!.label : isColdWin ? L('기본 컴팩트 권장', 'Plain compact advised') : compactText
  const canBlink = !isConfirming && phase !== 'tidying' && phase !== 'compacting' && !isNotNow && !isLittle && level === 'cut' && !autoOn
  const motion = sNow.motion !== 'reduce'
  const isBusy = phase === 'compacting' || phase === 'tidying'
  const gaugeBox = (blink: boolean, frame = true) => {
    const isHold = blink && Boolean(u) && !shrink && isFlashBusy(nowMs)
    const isBlink = blink && Boolean(u) && !shrink && !isHold
    const busy = isBusy && !shrink
    const el = gaugeEl(ui, e.surface, shrink ? shrink.to : (u?.contextTokens ?? 0), {
      key: 'compact-icon-svg',
      alt: u
        ? busy
          ? L(`컨텍스트 ${fmtTokens(u.contextTokens)} · ${phase === 'tidying' ? '저장 중' : '컴팩트 중'}`, `Context ${fmtTokens(u.contextTokens)} · ${phase === 'tidying' ? 'saving' : 'compacting'}`)
          : isBlink
            ? L('컨텍스트 · 컴팩트 늦어짐', 'Context · compact overdue')
            : L(`컨텍스트 ${fmtTokens(u.contextTokens)}`, `Context ${fmtTokens(u.contextTokens)}`)
        : L('컨텍스트 아직 모름', 'Context not known yet'),
      px: 16,
      blink: isBlink,
      motion,
      busy,
      live: frame && motion && (isBlink || busy || Boolean(shrink)),
      ...(shrink ? { fromCtx: shrink.from } : {}),
      ...(motion && isHold && flashAnyOn() ? { lit: true } : {}),
    })
    return el ? <Box key="compact-icon">{el}</Box> : null
  }
  const brandIcon = gaugeBox(canBlink)
  const offIcon = gaugeBox(false)
  const slimIcon = isSlim(sNow) ? gaugeBox(canBlink, false) : null
  const coldWinTip =
    isColdWin && cold
      ? L(
          `${isSwitched ? '모델이 바뀌었습니다' : '캐시가 만료됐습니다'}. 다음 요청은 ${approxUsd(cold.continueUsd)} 이고, 기본 컴팩트하면 ${approxUsd(cold.continueUsd - cold.compactUsd)} 덜 듭니다`,
          `${isSwitched ? 'Model switched' : 'The cache has expired'}. The next request is ${approxUsd(cold.continueUsd)}, and a plain compact costs ${approxUsd(cold.continueUsd - cold.compactUsd)} less`,
        )
      : null
  const W = e.props.bodyColumns
  const isTerm = e.surface === 'terminal'
  const btnW = (label: string) => (isTerm ? cellsOf(label) + 4 : Math.ceil((textCh(label) * 12) / 13 + 1.6))
  const txtW = (text: string) => widthOf(text, isTerm)
  const gaugePx = gaugeWidth(gaugeShapeNow(), 16)
  const ICON_W = isTerm ? 0 : Math.ceil(gaugePx / CH_PX) + 1
  const shortLabel = autoOn ? L('오토', 'Auto') : L('컴팩트', 'Compact')
  const dotW = ICON_W > 0 ? 0 : 2
  const compactW = (label: string) =>
    phase === 'compacting' && look
      ? ICON_W + dotW + txtW(look.text)
      : phase === 'tidying' && look
        ? ICON_W + dotW + txtW(look.text) + 1 + btnW(L('취소', 'Cancel'))
        : autoOn
          ? ICON_W + autoBarChipW(isConfirming ? `${label} ▾` : label, isTerm)
          : e.props.isWorking
          ? ICON_W + txtW(isTerm ? `[ ${label} ]` : label)
          : isConfirming
            ? ICON_W + btnW(`${label} ▾`)
            : (phase === 'held' ? txtW(withIcon('⏸', L('보류됨', 'On hold'))) + 1 : 0) + ICON_W + btnW(label)
  const hasGaugeDoor = !isTerm && offIcon !== null
  const controlsW = (isTerm ? btnW(view === 'usage' ? L('패널 ▾', 'Pane ▾') : L('패널 ▸', 'Pane ▸')) + 1 : hasGaugeDoor ? 0 : btnW('◔') + 1) + (isOneRow ? 0 : btnW('—') + 1) + btnW('✕')
  const hasLimitsLine = hasLimitsRow && u !== null
  const onCost = !show.lastTurn && (!hasLimitsLine || u === null || fitEstimateLine(ui, u, nowMs, show, sNow.sessionColors, mode !== 'full', null, spendNow).el !== null)
  const lastSum = sums.length > 0 ? sums[sums.length - 1]! : null
  const availOf = (right: number) => (right > 0 ? W - right - 2 : W)
  const isRegroup = mode === 'full' && hasLimitsLine && show.lastTurn && u !== null
  const layoutFor = (label: string) => {
    const cw = compactW(mode === 'min' && !isTerm ? shortLabel : label)
    if (isRegroup && u) {
      const g = costGroups(ui, u, nowMs, show, sNow.sessionColors, false, spendNow)
      const q = showLastLine ? afterCells(ui, lastTurnCells(ui, lastSum) ?? []) : []
      const last = fitLine(ui, [...g.now, ...q], availOf(cw))
      return { cost: fitLine(ui, g.money, availOf(0)), last, isOver: last.over }
    }
    const costRight = mode === 'min' ? cw + 2 + controlsW : hasLimitsLine ? (onCost ? cw : 0) : onCost ? cw + 2 + controlsW : controlsW
    const cost = u ? fitEstimateLine(ui, u, nowMs, show, sNow.sessionColors, mode !== 'full', availOf(costRight), spendNow) : null
    const last = showLastLine ? fitLastTurnLine(ui, lastSum, availOf(onCost ? 0 : cw)) : null
    const isOver = onCost || mode === 'min' ? (cost?.over ?? false) : (last?.over ?? false)
    return { cost, last, isOver }
  }
  const longFit = layoutFor(compactLabel)
  const isShortLabel = longFit.isOver && compactLabel !== shortLabel && !isTerm
  const fit = isShortLabel ? layoutFor(shortLabel) : longFit
  const barLabel = isShortLabel ? shortLabel : compactLabel
  const estimateLine = u
    ? (fit.cost?.el ?? null)
    : emptyLine(ui, 'b-none', L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes'))
  const lastLine = fit.last?.el ?? null
  const busyTip = L('답이 끝나면 누를 수 있습니다', 'Available when the answer ends')
  const tipRight = (nameW: number) => nameW + 1
  const isPaneOpen = view === 'usage'
  const doorTip = isPaneOpen ? L('누르면 패널이 닫힙니다', 'Click to close the pane') : L('누르면 패널이 열리고, 다시 누르면 닫힙니다', 'Click to open the pane, again to close')
  const gaugeDoor = (icon: unknown) =>
    icon === null || e.surface === 'terminal'
      ? icon
      : withTip(
          `band-gauge-${isPaneOpen ? 'open' : 'closed'}`,
          <Box key="gauge-door">
            {icon}
            <Box position="absolute" top={0} left={0}>
              <Button key="usage" label={gaugePx > 18 ? '\u2800\u2800' : '\u2800'} plain dimColor onPress={async () => void (await act.toggleView('usage'))} />
            </Box>
          </Box>,
          [ctxTip ?? L('컨텍스트 아직 모름', 'Context not known yet'), doorTip],
          ICON_W,
        )
  const busyName = (name: string, icon: unknown) =>
    e.surface === 'terminal' ? (
      <Box columnGap={1} alignItems="center">
        {icon}
        <Text dimColor>{`[ ${name} ]`}</Text>
      </Box>
    ) : (
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(icon)}
        {withTip('band-compact-box-busy', <Text dimColor>{name}</Text>, tipLines(busyTip), tipRight(txtW(name)))}
      </Box>
    )
  const compactRow =
    phase === 'compacting' && look ? (
      <Box columnGap={1} alignItems="center" flexShrink={0}>
        {gaugeDoor(brandIcon)}
        {brandIcon ? null : pulse(look.hex, L('컴팩트 중', 'Compacting'))}
        <Text color={look.color}>{look.text}</Text>
      </Box>
    ) : phase === 'tidying' && look ? (
      <Box columnGap={1} alignItems="center" flexShrink={0}>
        {gaugeDoor(brandIcon)}
        {brandIcon ? null : pulse(look.hex, L('저장 중', 'Saving'))}
        <Text color={look.color}>{look.text}</Text>
        <Button key="compact-cancel" label={L('취소', 'Cancel')} variant="secondary" onPress={() => act.cancelTidy()} />
      </Box>
    ) : autoOn ? (
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(offIcon)}
        {withTip(
          `band-auto-chip-${isConfirming ? 'open' : e.props.isWorking ? 'busy' : 'idle'}`,
          autoBarChip(ui, e.surface, isConfirming ? `${barLabel} ▾` : barLabel, autoPress(act, isConfirming, e.props.isWorking)),
          tipLines(isConfirming ? L('누르면 확인창 닫기', 'Press to close the card') : e.props.isWorking ? autoOffTip() : d.auto!.tip),
          tipRight(autoBarChipW(barLabel, isTerm)),
        )}
      </Box>
    ) : e.props.isWorking ? (
      busyName(barLabel, canBlink ? brandIcon : offIcon)
    ) : isConfirming ? (
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(isNotNow ? offIcon : brandIcon)}
        {withTip(
          'band-compact-box-open',
          <Button key="compact-close" label={`${barLabel} ▾`} {...(autoOn ? { variant: 'secondary' as const } : isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })} onPress={() => act.closeConfirm()} />,
          tipLines(L('누르면 확인창 닫기', 'Press to close the card')),
          tipRight(btnW(`${barLabel} ▾`)),
        )}
      </Box>
    ) : (
      <Box columnGap={1} alignItems="center">
        {phase === 'held' ? (
          <Box key="held" columnGap={1} alignItems="center">
            {decoIcon(ui, 'held', LEVEL_HEX.warn, L('보류됨', 'On hold'), 'held-icon', { color: 'warning' })}
            <Text color="warning">{L('보류됨', 'On hold')}</Text>
          </Box>
        ) : null}
        {gaugeDoor(isNotNow ? offIcon : brandIcon)}
        {withTip(
          `band-compact-tip-${autoOn ? 'auto' : isNotNow ? 'not-now' : shownLevel}`,
          <Button
            key="compact"
            label={barLabel}
            {...(autoOn ? { variant: 'secondary' as const } : isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
            onPress={() => act.openConfirm()}
          />,
          tipLines(
            autoOn
              ? d.auto!.tip
              : isNotNow
                ? notNowTip
                : (coldWinTip ?? (isShortLabel ? `${compactLabel} · ${L('누르면 컴팩트할지 묻습니다', 'press to open Compact now?')}` : L('누르면 컴팩트할지 묻습니다', 'Press to open Compact now?'))),
          ),
          tipRight(btnW(barLabel)),
        )}
      </Box>
    )

  const tidyNow = tidySteps(sNow)
  const isWide = e.props.bodyColumns >= 115
  const limitsLine = hasLimitsRow && u ? drawLimitsLine(ui, e.surface, u, nowMs, show) : null
  const isNarrowTerminal = e.surface === 'terminal' && e.props.bodyColumns < 100
  const baseRows = (limitsLine ? (isNarrowTerminal ? 4 : 3) : 2) + 2 + 1 + (isWide ? 1 : 2) + (isWide ? 1 : 2) + (isWide ? 2 : 4) + 1
  const spare = e.surface === 'desktop' ? 3 : e.props.maxRows - baseRows
  const gapBelowSummary = spare >= 1 ? 1 : 0
  const gapAboveSummary = spare >= 2 ? 1 : 0
  const gapAboveActions = spare >= 3 ? 1 : 0
  const isTermCard = e.surface === 'terminal'
  const keyOf = (digit: string) => (isTermCard ? { hotkey: digit } : {})
  const numbered = (digit: string, text: string) => (isTermCard ? `${digit} ${text}` : text)
  const choiceW = nameColW([numbered('1', L('이지 컴팩트', 'Easy Compact')), numbered('1', L('기본 컴팩트', 'Plain compact')), numbered('2', L('클리어', 'Clear'))])
  const explain = (key: string, name: string, desc: unknown) => (
    <Box key={key} columnGap={1}>
      <Box width={choiceW} flexShrink={0}>
        <Text bold>{name}</Text>
      </Box>
      <Text dimColor>:</Text>
      <Box flexShrink={1} minWidth={0}>
        <Text wrap="wrap">{desc}</Text>
      </Box>
    </Box>
  )
  const card = (key: string, icon: IconName, title: string, summary: unknown, rows: unknown[], isColdFirst: boolean, acts?: unknown, headRight: unknown = null) => (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={1}>
      <Box key={`${key}-head`} columnGap={1} justifyContent="space-between" alignItems="center">
      <Box columnGap={1}>
        {(() => {
          const el =
            u
              ? gaugeEl(ui, e.surface, u.contextTokens, { key: 'card-icon-svg', alt: title, px: 16, motion: false })
              : gaugeEl(ui, e.surface, 0, { key: 'card-icon-svg', alt: title, px: 16, motion: false })
          return el ? <Box key="card-icon">{el}</Box> : null
        })()}
        <Text bold>{title}</Text>
      </Box>
      {headRight}
      </Box>
      <Box paddingLeft={2} marginTop={gapAboveSummary} marginBottom={gapBelowSummary}>
        {summary}
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {rows}
      </Box>
      {acts ?? actions(isColdFirst)}
    </Box>
  )
  const pad = (text: string) => `\u00a0\u00a0${text}\u00a0\u00a0`
  const wide = (text: string) => <Text bold>{pad(text)}</Text>
  const isLoss = (cold !== null && !isColdWin) || isLittle
  const autoButton = d.auto && act.toggleAuto ? autoToggleEl(ui, e.surface, d.auto.isOn, () => void act.toggleAuto!(), keyOf('4')) : null
  const actions = (isColdFirst: boolean) => (
    <Box key="actions" justifyContent="flex-end" alignItems="center" columnGap={2} marginTop={gapAboveActions}>
      {isLoss ? (
        <Button key="compact-no" label={pad(numbered('1', L('✓ 확인 · 이어 가기', '✓ OK · keep working')))} variant="primary" {...keyOf('1')} onPress={() => act.closeConfirm()}>
          {wide(numbered('1', L('✓ 확인 · 이어 가기', '✓ OK · keep working')))}
        </Button>
      ) : (
        [
          isColdFirst ? (
            <Button
              key="compact-yes"
              label={pad(numbered('1', L('▶ 기본 컴팩트', '▶ Plain compact')))}
              variant="primary"
              {...keyOf('1')}
              onPress={() => act.compactNow(directKeep(sNow))}
            >
              {wide(numbered('1', L('▶ 기본 컴팩트', '▶ Plain compact')))}
            </Button>
          ) : (
            <Button
              key="compact-tidy"
              label={pad(numbered('1', L('▶ 이지 컴팩트', '▶ Easy Compact')))}
              variant="primary"
              {...keyOf('1')}
              onPress={() => act.tidyThenCompact()}
            >
              {wide(numbered('1', L('▶ 이지 컴팩트', '▶ Easy Compact')))}
            </Button>
          ),
          <Button key="compact-clear" label={pad(numbered('2', L('클리어', 'Clear')))} variant="secondary" {...keyOf('2')} onPress={() => act.askClear()}>
            {wide(numbered('2', L('클리어', 'Clear')))}
          </Button>,
          <Button key="compact-no" label={pad(numbered('3', L('✕ 취소', '✕ Cancel')))} variant="secondary" {...keyOf('3')} onPress={() => act.closeConfirm()}>
            {wide(numbered('3', L('✕ 취소', '✕ Cancel')))}
          </Button>,
        ]
      )}
    </Box>
  )
  const keepRow = (isCold: boolean) => (
    <Box key="e-keep">
      <Text wrap="wrap">
        <Text bold color="success">
          {L('작업을 이어 가세요', 'Keep working')}
        </Text>
        <Text>
          {isCold
            ? L('. 다음 질문이 캐시를 다시 데웁니다. 컴팩트할 때가 되면 바가 알려 줍니다.', '. Your next question warms the cache again. The bar tells you when it is time to compact.')
            : L('. 지금은 아낄 게 거의 없습니다.', '. There is little to save right now.')}
        </Text>
      </Text>
    </Box>
  )
  const saves = pay !== null && pay.saveCallUsd > 0 && !isLittle
  const costLine =
    pay && u ? (
      <Text wrap="wrap">
        <Text>{L('컨텍스트 ', 'Context ')}</Text>
        {stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true })}
        <Text dimColor> → </Text>
        <Text bold color="success">
          ~{fmtTokens(Math.min(afterTokens, u.contextTokens))}
        </Text>
        <Text dimColor>{' · '}</Text>
        {!saves ? (
          <Text bold color="error">{L('아낄 게 거의 없어 지금 컴팩트하면 손해입니다', 'little to save, so compacting now is a loss')}</Text>
        ) : (
          <Text>
            <Text>{pay.saveQuestionUsd !== null ? L('질문 1개당 ', 'saves ') : L('요청 1회당 ', 'saves ')}</Text>
            <Text bold color="success">
              ~{fmtUsd(pay.saveQuestionUsd ?? pay.saveCallUsd)}
            </Text>
            <Text>{pay.saveQuestionUsd !== null ? L(' 아낌', ' per question') : L(' 아낌', ' per request')}</Text>
          </Text>
        )}
        <Text dimColor>{' · '}</Text>
        <Text>{L('이지 컴팩트 ', 'Easy Compact ')}</Text>
        <Text bold>
          ~{fmtUsd(pay.costUsd)}
        </Text>
      </Text>
    ) : null
  const tidyPicker = () =>
    segChoice(
      ui,
      'pick-tidy',
      [...TIDY_IDS.map(id => ({ value: id, label: tidyStyles()[id].name })), { value: 'custom', label: L('직접 쓰기', 'Write my own') }],
      sNow.tidy,
      v => void act.pickTidy(v),
    )
  const InputEl = (ui as unknown as { Input?: (p: Record<string, unknown>) => unknown }).Input
  const inputBox = (key: string, el: unknown) => (
    <Box key={key} {...(isTerm ? { borderStyle: 'round' as const, borderColor: 'promptBorder', paddingX: 1 } : {})}>
      {el}
    </Box>
  )
  const tidyInput = () =>
    InputEl ? (
      <InputEl
        key="pick-tidy-text"
        placeholder={tidyStyles().default.body.join(' ')}
        value={tidyDraft ?? sNow.tidyCustom}
        submitLabel={L('저장', 'Save')}
        onInput={(v: string) => void act.typeTidy(v)}
        onSubmit={(v: string) => void act.saveTidy(v)}
      />
    ) : null
  const compactInput = () =>
    InputEl ? (
      <InputEl
        key="pick-compact-text"
        placeholder={tidyStyles().default.compact}
        value={compactDraft ?? (sNow.compactCustom !== '' ? sNow.compactCustom : tidyStyles().default.compact)}
        submitLabel={L('저장', 'Save')}
        onInput={(v: string) => void act.typeCompact(v)}
        onSubmit={(v: string) => void act.saveCompact(v)}
      />
    ) : null
  const saveRow = () => (
    <Box key="e-save" columnGap={1}>
      <Box width={choiceW} flexShrink={0}>
        <Text bold>{numbered('1', L('이지 컴팩트', 'Easy Compact'))}</Text>
      </Box>
      <Text dimColor>:</Text>
      <Box flexDirection="column" flexShrink={1} minWidth={0}>
        <Box key="e-save-pick" columnGap={1} alignItems="center" flexWrap="wrap">
          {tidyPicker()}
        </Box>
        {sNow.tidy === 'custom' && InputEl ? (
          <Box key="e-save-custom" flexDirection="column" rowGap={0.5}>
            <Text key="e-save-pre-name" dimColor>{L('① 컴팩트 전에 보낼 글(저장 턴)', '① Sent before compacting (save turn)')}</Text>
            {inputBox('e-save-pre', tidyInput())}
            <Text key="e-save-post-name" dimColor>{L('② /compact 뒤에 붙일 글', '② After /compact')}</Text>
            {inputBox('e-save-post', compactInput())}
          </Box>
        ) : sNow.tidy === 'custom' ? (
          <Text key="e-save-custom" wrap="wrap">
            <Text dimColor>{L('보낼 글 ', 'Sends ')}</Text>
            <Text>{L(`「${fitCells(sNow.tidyCustom !== '' ? sNow.tidyCustom : tidyStyles().default.body.join(' '), 44)}」`, `"${fitCells(sNow.tidyCustom !== '' ? sNow.tidyCustom : tidyStyles().default.body.join(' '), 44)}"`)}</Text>
          </Text>
        ) : (
          <Text key="e-save-keep" wrap="wrap">
            <Text dimColor>{L('저장 ', 'Save ')}</Text>
            <Text bold>{tidyNow.keep}</Text>
          </Text>
        )}
        {sNow.tidy === 'custom' ? null : (
          <Text key="e-save-reply" wrap="wrap">
            <Text dimColor>{L('답 ', 'Reply ')}</Text>
            <Text bold>{tidyNow.reply}</Text>
          </Text>
        )}
      </Box>
    </Box>
  )
  const directRow = (
    <Box key="e-direct" columnGap={1}>
      <Box width={choiceW} flexShrink={0}>
        <Text bold>{numbered('1', L('기본 컴팩트', 'Plain compact'))}</Text>
      </Box>
      <Text dimColor>:</Text>
      <Box key="e-direct-body" flexDirection="column" flexShrink={1} minWidth={0}>
        <Box key="e-direct-pick" columnGap={1} alignItems="center" flexWrap="wrap">
          {tidyPicker()}
        </Box>
        {sNow.tidy === 'custom' && InputEl ? (
          <Box key="e-direct-custom" flexDirection="column">
            <Text key="e-direct-post-name" dimColor>{L('② /compact 뒤에 붙일 글', '② After /compact')}</Text>
            {inputBox('e-direct-post', compactInput())}
          </Box>
        ) : (
          <Text key="e-direct-text" wrap="wrap">
            <Text bold>{L('/compact 뒤 글로 컴팩트합니다', 'Runs /compact with the text after it')}</Text>
            <Text dimColor> · </Text>
            <Text>{L(`「${directKeep(sNow)}」`, `"${directKeep(sNow)}"`)}</Text>
          </Text>
        )}
        <Text key="e-direct-note" dimColor wrap="wrap">
          {L('저장 질문 없이 바로 컴팩트합니다.', 'Compacts right away, without the save question.')}
        </Text>
      </Box>
    </Box>
  )
  const clearRow = (isCold: boolean) =>
    explain(
      'e-clear',
      numbered('2', L('클리어', 'Clear')),
      <Text>
        <Text bold>{L('대화를 비우고 새로 시작(/clear)', 'Start over with an empty conversation (/clear)')}</Text>
        <Text dimColor> · </Text>
        <Text>
          {isCold
            ? L('비용 없음 · 요약 없음', 'no cost · no summary')
            : L('요약 없이 지웁니다. 남기지 않은 결정은 사라집니다.', 'Clears without a summary. Anything not saved yet is gone.')}
        </Text>
      </Text>,
    )
  const clearYes = (
    <Button key="clear-yes" label={pad(numbered('1', L('지우기', 'Clear')))} variant="secondary" {...keyOf('1')} onPress={() => act.clearNow()}>
      {wide(numbered('1', L('지우기', 'Clear')))}
    </Button>
  )
  const clearBack = (
    <Button key="clear-back" label={pad(numbered('2', L('← 돌아가기', '← Back')))} variant="primary" {...keyOf('2')} onPress={() => act.backFromClear()}>
      {wide(numbered('2', L('← 돌아가기', '← Back')))}
    </Button>
  )
  const lostQ = clearAsk?.questions ? clearAsk.questions : null
  const lostLead =
    L('요약 없이 새 대화로 시작합니다. 지금까지의 ', 'Starts a new conversation without a summary. Claude forgets everything so far') +
    (lostQ !== null ? L('', ': ') : u ? L('대화 ', ': ') : L('대화', ''))
  const clearAskCard = clearAsk
    ? card(
        'confirm-clear',
        'compact',
        L('대화를 지울까요?', 'Clear the conversation?'),
        <Text wrap="wrap">
          <Text>{lostLead}</Text>
          {lostQ !== null ? <Text bold>{L(`질문 ${lostQ}개`, `${lostQ} question${lostQ === 1 ? '' : 's'}`)}</Text> : null}
          {u && lostQ !== null ? <Text dimColor>{' · '}</Text> : null}
          {u ? stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true }) : null}
          <Text>{L(u ? ' 를 Claude 가 잊습니다.' : '를 Claude 가 잊습니다.', '.')}</Text>
        </Text>,
        [],
        false,
        <Box key="actions" justifyContent="flex-end" alignItems="center" columnGap={2} marginTop={gapAboveActions}>
          {isTermCard ? [clearYes, clearBack] : [clearBack, clearYes]}
        </Box>,
      )
    : null
  const coldConfirm =
    est?.kind === 'cold' && u
      ? card(
          'confirm-cold',
          isSwitched ? 'switch' : 'cold',
          isSwitched
            ? isLoss
              ? L('모델을 바꿔 새 모델엔 캐시가 없지만, 지금은 컴팩트하지 않는 편이 낫습니다', 'You switched models and the new one has no cache, but it’s better not to compact now')
              : L('모델을 바꿔 새 모델엔 캐시가 없습니다. 기본 컴팩트할까요?', 'You switched models and the new one has no cache. Do a plain compact?')
            : isLoss
              ? L('캐시가 만료됐지만 지금은 컴팩트하지 않는 편이 낫습니다', 'The cache has expired, but it’s better not to compact now')
              : L('캐시가 만료됐습니다. 기본 컴팩트할까요?', 'The cache has expired. Do a plain compact?'),
          <Text wrap="wrap">
            <Text>{L('그냥 이어 가면 첫 요청이 ', (u.sharedTokens ?? 0) > 0 ? 'Continuing as is, the first request rewrites ' : 'Continuing as is, the first request rewrites all ')}</Text>
            {stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true })}
            <Text>
              {(u.sharedTokens ?? 0) > 0
                ? L(
                    ` 중 ~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} 를 다시 씀 `,
                    ` (~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} of it, the shared prefix is read) `,
                  )
                : L(' 전체를 다시 씀 ', ' ')}
            </Text>
            <Text bold>~{fmtUsd(cold?.continueUsd ?? est.rewriteUsd)}</Text>
            {cold === null ? null : (
              <Text>
                <Text dimColor>{' · '}</Text>
                <Text>{L('기본 컴팩트하면 ', 'a plain compact ')}</Text>
                <Text bold>~{fmtUsd(cold.compactUsd)}</Text>
                <Text dimColor> → </Text>
                <Text bold>~{fmtTokens(Math.min(afterTokens, u.contextTokens))}</Text>
                <Text dimColor>{' · '}</Text>
                {isColdWin ? (
                  <Text bold color="success">
                    {L(`${fmtUsd(cold.continueUsd - cold.compactUsd)} 이득`, `saves ${fmtUsd(cold.continueUsd - cold.compactUsd)}`)}
                  </Text>
                ) : (
                  <Text>
                    <Text bold color="error">
                      {L(`${approxUsd(cold.compactUsd - cold.continueUsd)} 손해`, `${approxUsd(cold.compactUsd - cold.continueUsd)} more`)}
                    </Text>
                    <Text>{L(' · 그냥 이어 가는 편이 쌉니다', ' · continuing as is is cheaper')}</Text>
                  </Text>
                )}
              </Text>
            )}
          </Text>,
          isLoss ? [keepRow(true)] : [directRow, clearRow(true)],
          true,
        )
      : null
  const confirm = !isConfirming ? null : (clearAskCard ?? coldConfirm ??
      (isLoss
        ?
          card('confirm', 'compact', L('지금 컴팩트하면 손해입니다', 'Compacting now would cost more than it saves'), costLine, [keepRow(false)], false, undefined, autoButton)
        : card('confirm', 'compact', L('컴팩트할까요?', 'Compact now?'), costLine, [saveRow(), clearRow(false)], false, undefined, autoButton)))
  const panelButton = (key: PaneView, name: string) => (
    <Button
      key={key}
      label={view === key ? `${name} ▾` : `${name} ▸`}
      variant="secondary"
      onPress={async () => {
        await act.toggleView(key)
      }}
    />
  )
  const isAutoShown = sNow.bandFolded
  const foldedLabel = revealLabel(!sNow.bandAutoOpen, u && u.contextTokens > 0 ? levelOf(u.contextTokens) : null, u && u.contextTokens > 0 ? `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)}` : null)
  const modeButton = withTip(`band-mode-box-${mode}`, (
    <Button
      key="band-mode"
      label={mode === 'full' ? '—' : '□'}
      plain
      dimColor
      onPress={() => act.setBand(mode === 'full' ? 'min' : 'full')}
    />
  ), mode === 'full' ? L('한 줄로 줄이기', 'Shrink to one line') : L('전체로 펴기', 'Expand to full'))
  const closeButton = withTip(`band-close-box-${isAutoShown ? 'auto' : 'open'}`, (
    <Button key="band-close" label="✕" variant="secondary" dimColor {...(e.surface === 'terminal' ? {} : { role: 'dismiss' as const })} onPress={async () => act.foldBand()} />
  ), isAutoShown
    ? L('접습니다. 늦어지거나 캐시가 만료되면 다시 펼칩니다', 'Folds it. It opens again if it runs late or the cache expires')
    : L(`접기 · 다시 펴기: 입력창 아래 [${foldedLabel}]`, `Fold · reopen: [${foldedLabel}] below the input`))
  const isPanelIcon = e.surface !== 'terminal'
  const panels = (
    <Box key="b-panels" columnGap={1} alignItems="center" flexShrink={0}>
      {!isPanelIcon
        ? panelButton('usage', L('패널', 'Pane'))
        : hasGaugeDoor
          ? null
          : withTip(
            `band-panel-box-${view === 'usage' ? 'open' : 'closed'}`,
            <Button key="usage" label="◔" {...(view === 'usage' ? { variant: 'secondary' as const } : { plain: true, dimColor: true })} onPress={async () => void (await act.toggleView('usage'))} />,
            view === 'usage' ? L(`${paneTitle()} 패널 닫기`, `Close the ${paneTitle()} pane`) : L(`${paneTitle()} 패널 열기`, `Open the ${paneTitle()} pane`),
          )}
    </Box>
  )
  const controls = (
    <Box key="b-r1-right" columnGap={1} alignItems="center" flexShrink={0}>
      {isPanelIcon ? null : panels}
      <Box key="b-window" columnGap={1} alignItems="center">
        {isPanelIcon ? panels : null}
        {isOneRow ? null : modeButton}
        {closeButton}
      </Box>
    </Box>
  )

  const row = (key: string, left: unknown, rightEl: unknown, align: 'center' | 'flex-start') => (
    <Box key={key} flexWrap="nowrap" alignItems={align} columnGap={2}>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {left ?? <Text> </Text>}
      </Box>
      {rightEl}
    </Box>
  )
  if (isSlim(sNow)) {
    const sv = slimViewOf(sNow)
    const parts = u ? slimParts(ui, u, nowMs, sv, sNow.sessionColors, spendNow) : []
    const over = parts.slice(SLIM_BUTTON_PARTS)
    const isBusyPhase = phase === 'compacting' || phase === 'tidying'
    const wantsButton = sv.btn === 'on' || (sv.btn === 'need' && !isNotNow && !autoOn)
    if (isTerm) {
      return (
        <Box flexDirection="column">
          <Box key="b-slim" columnGap={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
            <Button key="slim-pane" label={slimButtonText(u, parts, sv, sNow.ctxUnit, view === 'usage', true)} variant="secondary" onPress={async () => void (await act.toggleView('usage'))} />
            {isBusyPhase || isConfirming || wantsButton || autoOn ? compactRow : null}
          </Box>
          {over.length === 0 || isBusyPhase ? null : <Box key="b-slim-more">{fitLine(ui, over, W - 2).el}</Box>}
          {confirm}
        </Box>
      )
    }
    const isSum = isSlimSummary && u !== null && !isBusyPhase
    const showBtn = isSum || wantsButton
    if (!isSum && !isBusyPhase && !isConfirming) {
      if (!wantsButton && over.length === 0) return null
      if (isSlimDismissed) return null
    }
    const warnAt = u ? ctxNumText(thr.ctxWarn, u.window, sNow.ctxUnit) : ''
    const cutAt = u ? ctxNumText(thr.ctxCut, u.window, sNow.ctxUnit) : ''
    const coldWhy = isSwitched ? L('모델 바뀜 · 기본 컴팩트가 더 쌈', 'Model switched · a plain compact is cheaper') : L('캐시 만료 · 기본 컴팩트가 더 쌈', 'Cache expired · a plain compact is cheaper')
    const pastWhy = L(` · ${shownLevel === 'cut' ? cutAt : warnAt} 넘음`, ` · past ${shownLevel === 'cut' ? cutAt : warnAt}`)
    const roomWhy = u ? L(`${warnAt}까지 ${fmtTokens(Math.max(0, thr.ctxWarn - u.contextTokens))} 남음`, `${fmtTokens(Math.max(0, thr.ctxWarn - u.contextTokens))} left until ${warnAt}`) : ''
    const isPast = !autoOn && (shownLevel === 'cut' || shownLevel === 'warn')
    const whyText = isColdWin ? coldWhy : isPast ? `${compactText}${pastWhy}` : showBtn && u ? roomWhy : ''
    const why = isColdWin ? (
      stageText(ui, 'cache', 'error', coldWhy, { textKey: 'slim-why' })
    ) : isPast ? (
      <Text key="slim-why" wrap="truncate-end">
        {stageText(ui, 'ctx', shownLevel === 'cut' ? 'error' : 'warning', compactText)}
        <Text dimColor>{pastWhy}</Text>
      </Text>
    ) : showBtn && u && !autoOn ? (
      <Text key="slim-why" dimColor>
        {roomWhy}
      </Text>
    ) : null
    const btnLabel = autoOn ? d.auto!.label : isColdWin ? L('기본 컴팩트 권장', 'Plain compact advised') : L('이지 컴팩트', 'Easy Compact')
    const btnLook = autoOn ? { variant: 'secondary' as const } : isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const }
    const right = isBusyPhase ? (
      <Box key="b-slim-right" columnGap={1} alignItems="center" flexShrink={0}>
        {compactRow}
      </Box>
    ) : (
      <Box key="b-slim-right" columnGap={1} alignItems="center" flexShrink={0}>
        {gaugeDoor(slimIcon)}
        {autoOn && (isConfirming || showBtn) ? (
          withTip(
            'band-auto-chip-slim',
            autoBarChip(ui, e.surface, isConfirming ? `${btnLabel} ▾` : btnLabel, autoPress(act, isConfirming, e.props.isWorking)),
            tipLines(e.props.isWorking && !isConfirming ? autoOffTip() : d.auto!.tip),
            tipRight(autoBarChipW(btnLabel, false)),
          )
        ) : isConfirming ? (
          withTip(
            'band-compact-box-open',
            <Button key="compact-close" label={`${btnLabel} ▾`} {...btnLook} onPress={() => act.closeConfirm()} />,
            tipLines(L('누르면 확인창 닫기', 'Press to close the card')),
            tipRight(btnW(`${btnLabel} ▾`)),
          )
        ) : showBtn && e.props.isWorking ? (
          withTip('band-compact-box-busy', <Text dimColor>{btnLabel}</Text>, tipLines(busyTip), tipRight(txtW(btnLabel)))
        ) : showBtn ? (
          withTip(
            `band-compact-tip-${autoOn ? 'auto' : isNotNow ? 'not-now' : shownLevel}`,
            <Button key="compact" label={btnLabel} {...btnLook} onPress={() => act.openConfirm()} />,
            tipLines(autoOn ? d.auto!.tip : isNotNow ? notNowTip : (coldWinTip ?? L('누르면 컴팩트할지 묻습니다', 'Press to open Compact now?'))),
            tipRight(btnW(btnLabel)),
          )
        ) : null}
        {isSum
          ? withTip('sc-close-tip', <Button key="sc-close" label="✕" plain dimColor onPress={() => void act.toggleSummary()} />, [L('닫습니다. 아래 버튼으로 다시 열 수 있습니다', 'Closes it. Reopen it with the button below')], 4)
          : withTip('slim-dismiss-tip', <Button key="slim-dismiss" label="✕" plain dimColor onPress={() => act.dismissSlim()} />, [L('닫습니다. 늦어지거나 캐시가 만료되면 다시 알려 드립니다', 'Closes it. It shows again if it runs late or the cache expires')], 4)}
      </Box>
    )
    const rightW = isBusyPhase ? 0 : ICON_W + (showBtn || isConfirming ? btnW(`${btnLabel} ▾`) + 1 : 0) + btnW('✕')
    const lineCells = isSum && u ? slimSummaryCells(ui, u, nowMs, sv, sNow.sessionColors, spendNow) : over
    const sideW = availOf(rightW + 2) - (whyText ? txtW(`${whyText} · `) + 1 : 0) - 3
    const side = lineCells.length > 0 ? fitLine(ui, lineCells, Math.max(0, sideW), null) : null
    const isBelow = side !== null && side.over
    const cells = side === null || isBelow ? null : side.el
    const more = isBelow ? fitLine(ui, lineCells, W - 2).el : null
    return (
      <Box flexDirection="column">
        <Box key={isSum ? 'b-slim-sum' : 'b-slim'} columnGap={2} alignItems="center" justifyContent="space-between" flexWrap="nowrap">
          <Box key="b-slim-left" columnGap={1} alignItems="center" flexShrink={1} minWidth={0} flexWrap="wrap">
            {isBusyPhase ? null : why}
            {isBusyPhase || cells === null ? null : (
              <Box key="b-slim-cells" flexShrink={1} minWidth={0}>
                {why ? <Text dimColor>· </Text> : null}
                {cells}
              </Box>
            )}
          </Box>
          {right}
        </Box>
        {more === null || isBusyPhase ? null : <Box key={isSum ? 'b-slim-sum-more' : 'b-slim-more'}>{more}</Box>}
        {confirm}
      </Box>
    )
  }
  if (mode === 'min') {
    const isShort = e.surface !== 'terminal'
    const miniName = autoOn ? L('오토', 'Auto') : L('컴팩트', 'Compact')
    const miniLook = autoOn ? { variant: 'secondary' as const } : isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const }
    const compactTip = isColdWin
      ? (coldWinTip ?? (isSwitched ? L('모델 바뀜 · 기본 컴팩트 권장', 'Model switched · plain compact advised') : L('캐시 만료 · 기본 컴팩트 권장', 'Cache expired · plain compact advised')))
      : shownLevel === 'cut'
        ? isRange
          ? L('컴팩트 늦어짐', 'Compact overdue')
          : L('컴팩트 권장', 'Compact advised')
        : shownLevel === 'warn'
          ? isRange
            ? L('컴팩트할 때', 'Time to compact')
            : L('곧 컴팩트할 때', 'Compact soon')
          : L('컴팩트', 'Compact')
    const compactMini =
      !isShort || autoOn || phase === 'compacting' || phase === 'tidying' ? (
        compactRow
      ) : e.props.isWorking ? (
        busyName(miniName, canBlink ? brandIcon : offIcon)
      ) : isConfirming ? (
        <Box columnGap={1} alignItems="center">
          {gaugeDoor(isNotNow ? offIcon : brandIcon)}
          {withTip(
            'band-compact-box-open',
            <Button key="compact-close" label={`${miniName} ▾`} {...miniLook} onPress={() => act.closeConfirm()} />,
            tipLines(L('누르면 확인창 닫기', 'Press to close the card')),
            tipRight(btnW(`${miniName} ▾`)),
          )}
        </Box>
      ) : (
        <Box columnGap={1} alignItems="center">
          {phase === 'held' ? (decoIcon(ui, 'held', LEVEL_HEX.warn, L('보류됨', 'On hold'), 'held-icon', { color: 'warning' }) ?? <Text color="warning">{L('보류', 'Held')}</Text>) : null}
          {gaugeDoor(isNotNow ? offIcon : brandIcon)}
          {withTip(
            `band-compact-box-${shownLevel}${isColdWin ? '-cold' : ''}`,
            <Button
              key="compact"
              label={miniName}
              {...miniLook}
              onPress={() => act.openConfirm()}
            />,
            tipLines(autoOn ? `${d.auto!.label} · ${d.auto!.tip}` : isNotNow ? notNowTip : `${compactTip} · ${L('누르면 컴팩트할지 묻습니다', 'press to open Compact now?')}`),
            tipRight(btnW(miniName)),
          )}
        </Box>
      )
    return (
      <Box flexDirection="column">
        {row(
          'b-r1',
          estimateLine,
          <Box key="b-one-right" columnGap={2} alignItems="center" flexShrink={0}>
            {compactMini}
            {controls}
          </Box>,
          'center',
        )}
        {confirm}
      </Box>
    )
  }
  const compactOnCost = onCost
  const grid =
    isRegroup && limitsLine && !isNarrowTerminal && u
      ? bandGrid(ui, e.surface, u, nowMs, show, sNow.sessionColors, spendNow, showLastLine ? lastSum : null, availOf(Math.max(controlsW, compactW(barLabel))))
      : null
  if (grid) {
    return (
      <Box flexDirection="column">
        {row('b-r1', grid.limits, controls, 'center')}
        {grid.money ? row('b-r2', grid.money, null, 'center') : null}
        {row('b-r3', grid.now, compactRow, 'center')}
        {confirm}
      </Box>
    )
  }
  const oneRight = (
    <Box key="b-one-right" columnGap={2} alignItems="center" flexShrink={0}>
      {compactRow}
      {controls}
    </Box>
  )
  return (
    <Box flexDirection="column">
      {limitsLine && isNarrowTerminal ? row('b-r0', null, controls, 'center') : null}
      {limitsLine && isNarrowTerminal
        ? row('b-r1', limitsLine, null, 'flex-start')
        : limitsLine
          ? row('b-r1', limitsLine, controls, 'flex-start')
          : row('b-r1', estimateLine, compactOnCost ? oneRight : controls, 'center')}
      {limitsLine && estimateLine ? row('b-r2', estimateLine, compactOnCost ? compactRow : null, 'center') : null}
      {compactOnCost ? null : row('b-r3', lastLine, compactRow, 'center')}
      {confirm}
    </Box>
  )
}
