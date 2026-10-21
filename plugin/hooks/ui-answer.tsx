import type { LiveTurn, TurnSummary, Usage } from '../types'
import { fmtTokens, fmtUsd, LEVEL_TEXT, levelOf } from './cost'
import { L, plural } from './i18n'
import { iconOf } from './glyph'
import { agentPart, agentSum, answerBreakdown, APP_MIN_USD, callsOf, fitCells, recentSteps } from './text'
import { rewriteNote } from './ui-band'
import { ACCENT, agentMark, agentText, BRAND_HEX, hoverTip, LIVE_HEX, previewChip, previewFrame, pulseDot, questionScope, stepText, workMark } from './ui-common'
import { autoTurnName, autoTurnOf } from './tidy'
import type { Ui } from './ui-common'

const ANSWER_STEPS = 10
const ANSWER_COLS = 72

export function answerLine(ui: Ui, summary: TurnSummary, isFull: boolean, surface: string, isLive = false) {
  const { Text } = ui
  const compactUsd = (summary.details ?? []).reduce((sum, d) => sum + (d.compact ? d.usd : 0), 0)
  const parts = [
    compactUsd >= APP_MIN_USD ? L(`컴팩트 ${fmtUsd(compactUsd)}`, `compact ${fmtUsd(compactUsd)}`) : '',
    (summary.appUsd ?? 0) >= APP_MIN_USD ? L(`앱 자체 요청 ${fmtUsd(summary.appUsd!)}`, `app's own requests ${fmtUsd(summary.appUsd!)}`) : '',
  ].filter(Boolean)
  const extra = parts.length > 0 && isFull && surface === 'terminal' ? L(` · ${parts.join(' · ')} 포함`, ` · incl. ${parts.join(' · ')}`) : ''
  const calls = callsOf(summary.steps, summary.details)
  const agentLine = agentPart(summary.details, isFull)
  const icon = isLive ? null : iconOf('🧾')
  const tone = isLive ? {} : { color: BRAND_HEX }
  const side = isLive ? { dimColor: true } : { color: BRAND_HEX }
  const head = isLive
    ? [
        <Text key="lab" dimColor>
          {L('이 질문 ', 'This question ')}
        </Text>,
        <Text key="usd" bold>
          {fmtUsd(summary.cost.usd)}
        </Text>,
        <Text key="calls" dimColor>
          {L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`)}
        </Text>,
      ]
    : [
        icon ? `${icon} ` : '',
        L('이 질문 ', 'This question '),
        <Text key="usd" bold>
          {fmtUsd(summary.cost.usd)}
        </Text>,
        L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`),
      ]
  if (agentLine && agentLine.startsWith('🤖 ') && surface === 'desktop') {
    const { Box } = ui
    return (
      <Box key="q-line" flexDirection="row" alignItems="center" flexWrap="wrap">
        <Text {...tone}>{head}</Text>
        {agentText(ui, 'q-agents', agentLine, (agentSum(summary.details)?.runningCount ?? 0), side, ' · ', isLive && (agentSum(summary.details)?.runningCount ?? 0) > 0)}
        <Text {...side}>
          {rewriteNote(ui, summary.rewriteUsd)}
          {extra}
        </Text>
      </Box>
    )
  }
  return (
    <Text {...tone}>
      {head}
      {agentLine ? (
        isLive ? (
          <Text key="ag" dimColor>
            {` · ${agentLine}`}
          </Text>
        ) : (
          ` · ${agentLine}`
        )
      ) : (
        ''
      )}
      {rewriteNote(ui, summary.rewriteUsd)}
      {extra}
    </Text>
  )
}

export function liveStrip(ui: Ui, now: LiveTurn, isFull: boolean, surface: string, o: { isAlone?: boolean; isPreview?: boolean } = {}) {
  const { Box, Text } = ui
  const summary: TurnSummary = {
    tail: '',
    steps: now.steps,
    cost: now.cost,
    prompt: now.prompt,
    atMs: 0,
    contextTokens: now.contextTokens,
    details: now.details,
    ...(now.appUsd ? { appUsd: now.appUsd } : {}),
    ...(now.rewriteUsd ? { rewriteUsd: now.rewriteUsd } : {}),
  }
  const auto = autoTurnOf(now.prompt)
  const body =
    auto !== null ? (
      <Text>
        <Text color={ACCENT}>{autoTurnName(auto)}</Text>
        <Text dimColor>{L(` · 요청 ${now.steps}회`, ` · ${plural(now.steps, 'request')}`)}</Text>
      </Text>
    ) : now.steps === 0 ? (
      <Text dimColor>{L('이 질문 · 첫 요청 중…', 'This question · first request…')}</Text>
    ) : (
      answerLine(ui, summary, isFull, surface, true)
    )
  const running = agentSum(now.details)?.runningCount ?? 0
  const mark = running > 0 ? agentMark(ui, 'ec-live-mark', running) : workMark(ui, 'ec-live-mark', !o.isPreview)
  return (
    <Box key="ec-live" flexDirection="column">
      {o.isAlone ? null : <Box key="ec-live-line" height={0.06} marginTop={0.35} marginBottom={o.isPreview ? 0.3 : 0.8} backgroundColor="promptBorder" />}
      <Box key="ec-live-row" flexDirection="row" alignItems="center" columnGap={1}>
        {mark ?? pulseDot(ui, surface, LIVE_HEX, L('진행 중', 'Running'), !o.isPreview)}
        {body}
      </Box>
    </Box>
  )
}

export function liveSample(ui: Ui, last: TurnSummary, isFull: boolean, surface: string, isAlone: boolean) {
  if (surface === 'terminal') return null
  const now: LiveTurn = {
    turnId: 'pv',
    steps: last.steps,
    cost: last.cost,
    prompt: last.prompt,
    contextTokens: last.contextTokens ?? 0,
    outputTokens: 0,
    details: last.details ?? [],
    ...(last.appUsd ? { appUsd: last.appUsd } : {}),
    ...(last.rewriteUsd ? { rewriteUsd: last.rewriteUsd } : {}),
  }
  return liveStrip(ui, now, isFull, surface, { isAlone, isPreview: true })
}

export function answerDetail(ui: Ui, summary: TurnSummary) {
  const { Box, Text } = ui
  const bd = answerBreakdown(summary.cost, summary.appUsd, summary.details, summary.steps)
  const { shown, rest, restUsd } = recentSteps(bd.mainSteps, ANSWER_STEPS)
  const SUB = '     '
  return (
    <Box key="q-detail" flexDirection="column">
      <Text key="qb-main" dimColor wrap="wrap">
        {` - ${bd.main}`}
      </Text>
      {shown.map((d, j) => {
        const { text, note } = stepText(d)
        const head = `${SUB}${fmtUsd(d.usd)}  ${fitCells(text, ANSWER_COLS)}`
        return (
          <Text key={`qd-${j}`} dimColor wrap="truncate-end">
            {note ? [head, <Text key="n" color="warning">{note}</Text>] : head}
          </Text>
        )
      })}
      {rest > 0 ? (
        <Text key="qd-rest" dimColor>
          {L(`${SUB}이전 동작 ${rest}개 ${fmtUsd(restUsd)} · 다 보려면 이지 컴팩트 패널을 여세요`, `${SUB}${plural(rest, 'earlier step')} ${fmtUsd(restUsd)} · open the Easy Compact pane to see them all`)}
        </Text>
      ) : null}
      {bd.others.map((text, k) => agentText(ui, `qb-${k}`, text, (agentSum(summary.details)?.runningCount ?? 0), { dimColor: true, wrap: 'wrap' }, ' - '))}
    </Box>
  )
}

export function questionBar(ui: Ui, scope: string) {
  const { Box } = ui
  return <Box key="q-bar" position="absolute" top={0} bottom={0} left={-1} width={1} display="none" backgroundColor={BRAND_HEX} hover={{ scope, display: 'flex' }} />
}

export function cellMark(ui: Ui, theirs: unknown, scope: string) {
  const { Box } = ui
  return (
    <Box key="q-cell" flexDirection="column">
      {questionBar(ui, scope)}
      {theirs}
    </Box>
  )
}

export function drawAnswerChip(ui: Ui, d: { theirs: unknown; summary: TurnSummary; isFull: boolean; surface: string; isOpen: boolean; isHover: boolean }, act: { toggle: () => void }) {
  const { Box, Button, Text } = ui
  const { theirs, summary, isFull, surface, isOpen, isHover } = d
  const line = answerLine(ui, summary, isFull, surface)
  const canFold = isFull && surface !== 'terminal'
  const foldButton = canFold ? (
    <Box key="q-fold-box" flexShrink={0}>
      <Button key="q-fold" plain onPress={() => act.toggle()}>
        <Text color={BRAND_HEX} dimColor>
          {isOpen ? L('▾ 접기', '▾ Hide') : L('▸ 자세히', '▸ Details')}
        </Text>
      </Button>
    </Box>
  ) : null
  const detailEl = isOpen ? answerDetail(ui, summary) : null
  const scope = questionScope(summary.atMs)
  return (
    <Box flexDirection="column">
      {isHover ? (
        <Box key="q-ans" flexDirection="column">
          {questionBar(ui, scope)}
          {theirs}
        </Box>
      ) : (
        theirs
      )}
      {surface === 'terminal' ? (
        line
      ) : (
        <Box key="q-cost" alignSelf="flex-start" flexDirection="column" marginTop={1} borderStyle="round" borderColor={BRAND_HEX} paddingX={1} {...(isHover ? { hover: { scope, borderStyle: 'bold' } } : {})}>
          <Box key="q-head" columnGap={2} alignItems="center">
            {line}
            {foldButton}
          </Box>
          {detailEl}
        </Box>
      )}
    </Box>
  )
}

export function spinnerCost(ui: Ui, theirs: unknown, now: LiveTurn, agents: string | null) {
  const { Box, Text } = ui
  return (
    <Box columnGap={1} alignItems="center">
      {theirs}
      <Text>
        <Text bold>
          {fmtUsd(now.cost.usd)}
        </Text>
        {agents ? <Text>{` · ${agents}`}</Text> : null}
        <Text dimColor>{L(' · 컨텍스트 ', ' · context ')}</Text>
        <Text color={LEVEL_TEXT[levelOf(now.contextTokens)]}>{fmtTokens(now.contextTokens)}</Text>
      </Text>
    </Box>
  )
}

export function sampleUsage(nowMs: number, model: string): Usage {
  return {
    model,
    contextTokens: 120_000,
    window: 1_000_000,
    percent: 12,
    costUsd: 3.4,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 30, resetsAt: new Date(nowMs + 3 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 20, resetsAt: new Date(nowMs + 4 * 86_400_000).toISOString() },
    ],
    categories: [],
    lastActivityMs: nowMs - 5 * 60_000,
    history: [100_000, 120_000],
    cacheTtlMin: 60,
    cacheTtlMeasured: true,
  }
}

export function sampleTurn(nowMs: number, model: string): TurnSummary {
  const details = [
    { label: 'Read band.test.tsx', usd: 0.06 },
    { label: 'Edit register.tsx', usd: 0.14 },
    { label: L('Bash 시험 돌리기', 'Bash run tests'), usd: 0.09 },
    { label: L('답변 작성', 'Writing the answer'), usd: 0.07 },
  ]
  return { tail: '', steps: 4, cost: { usd: 0.36, read: 0.12, write: 0.1, output: 0.14, input: 0 }, prompt: '', atMs: nowMs, contextTokens: 120_000, details, model }
}

export function answerPreview(ui: Ui, summary: TurnSummary, isSample: boolean, isFull: boolean, surface: string, isOpen: boolean, isHover: boolean, isTipOpen: boolean, acts: { toggleTip: () => void; toggleOpen: () => void }) {
  const { Box, Button, Text } = ui
  const line = answerLine(ui, summary, isFull, surface)
  const canFold = isFull && surface !== 'terminal'
  const hover = isHover && surface !== 'terminal' ? { hover: { ...(isSample ? {} : { scope: questionScope(summary.atMs) }), borderStyle: 'bold' } } : {}
  const tip =
    L(
      '답변이 끝날 때마다 그 아래에 질문 하나의 금액과 요청 수를 붙입니다.',
      "Adds that question's cost and request count under each finished answer.",
    ) +
    (isSample ? L(' 견본은 예시 값입니다.', ' Example values.') : L(' 견본은 이 세션 지난 질문 값입니다.', " The sample uses this session's last question."))
  const label = hoverTip(ui, 'pv-answer-tip', previewChip(ui, 'pv-answer-chip', L('미리보기 · 답변 아래', 'Preview · below each answer')), tip, { isOpen: isTipOpen, onToggle: acts.toggleTip })
  return previewFrame(
    ui,
    'pv-answer',
    label,
    <Box key="pv-answer-body" flexDirection="column">
      {surface === 'terminal' ? (
        line
      ) : (
        <Box key="pv-chip" alignSelf="flex-start" flexDirection="column" borderStyle="round" borderColor={BRAND_HEX} paddingX={1} {...hover}>
          <Box key="pv-head" columnGap={2} alignItems="center">
            {line}
            {canFold ? (
              <Box key="pv-fold-box" flexShrink={0}>
                <Button key="pv-fold" plain onPress={acts.toggleOpen}>
                  <Text color={BRAND_HEX} dimColor>
                    {isOpen ? L('▾ 접기', '▾ Hide') : L('▸ 자세히', '▸ Details')}
                  </Text>
                </Button>
              </Box>
            ) : null}
          </Box>
          {canFold && isOpen ? answerDetail(ui, summary) : null}
        </Box>
      )}
    </Box>,
  )
}
