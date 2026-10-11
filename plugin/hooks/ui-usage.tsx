import type { CompactInputs, LiveTurn, Optimal, TurnSummary, Usage } from '../types'
import {
  average,
  PERM_HEX,
  compactPayoff,
  coldCompact,
  estimate,
  fmtTokens,
  fmtUsd,
  LEVEL_HEX,
  LEVEL_TEXT,
  levelOf,
  LITTLE_SHRINK,
  modelKey,
  modelName,
  ratesFor,
  thresholds,
} from './cost'
import { OUTPUT_GUESS, SUMMARY_GUESS } from './optimal'
import {
  afterInNowTokens,
  COMPACT_HEX,
  compactEffects,
  compactSummary,
  TIMING_H,
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
import { promptHead, clipText, cellsOf, fitCells, gainText, agoText, costBreakdown, modelText, switchText } from './text'
import {
  ACCENT,
  TALK_HEX,
  ctxBar,
  row,
  legend,
  gridOf,
  leadCell,
  DETAIL_BOX,
  DETAIL_INSET,
  textCells,
  detailRows,
  phaseLook,
  LIVE_HEX,
  pulseDot,
  usdCell,
  CARD,
  TITLE_BAND,
  CARD_INSET,
  TILE,
  TILE_PX,
  foldButton,
  section,
  growthText,
  emptyLine,
  svgOf,
} from './ui-common'
import type { Ui, Grid, Fold } from './ui-common'
import { rewriteNote } from './ui-band'
import { L, plural } from './i18n'
import { iconOf, withIcon } from './glyph'
import { rasterOf } from './ui-common'
import { flowCells, flowLayout, timingCells } from './cells'

/** 터미널 흐름 그래프 높이(줄) — 8줄은 작은 컨텍스트일 때 거의 빈 칸이라 패널만 길게 했다(2026-10-11 CLI) */
const FLOW_ROWS = 6

/** 📊 사용량 패널 — 컨텍스트 · 비용, 질문별 비용, 컴팩트(시점 · 흐름 그래프 · 효과), 참고 */

/**
 * 앞 질문과 비교한 모델 · 노력도 변화(바뀐 쪽의 앞 값, 안 바뀌었으면 null). 모델은 이 질문의 첫 요청 때 바뀌어 있었으면(switchedFrom)
 * 또는 앞 질문과 다르면, 노력도는 둘 다 기록이 있고 다르면. 질문별 비용 줄 · 진행 중 줄이 같이 쓴다
 */
export function changesOf(
  t: { model?: string; effort?: string; switchedFrom?: string },
  older?: TurnSummary,
): { fromModel: string | null; fromEffort: string | null } {
  const fromModel = t.switchedFrom ?? (older?.model && t.model && modelKey(older.model) !== modelKey(t.model) ? older.model : null)
  const fromEffort = older?.effort && t.effort && older.effort !== t.effort ? older.effort : null
  return { fromModel, fromEffort }
}

/** 진행 중 질문에서 보이는 최근 동작 수 — 오래된 것은 수만 */
export const LIVE_SHOWN = 8

/**
 * 진행 중 질문: 질문별 비용 맨 위에 늘 펼쳐서. 요청이 끝날 때마다 한 줄씩 는다.
 * 아이콘 칸(끝난 질문의 ▸ 자리)에 깜빡이는 점 — 띠처럼 지금 도는 줄로 보이게. 저장 · 컴팩트 단계면 띠와 같은 색 · 글
 */
export function liveBlock(ui: Ui, now: LiveTurn, older: TurnSummary | undefined, cols: number, g: Grid, surface: string, phase: unknown, kind: unknown) {
  const { Box, Text } = ui
  const { fromModel, fromEffort } = changesOf(now, older)
  // 에이전트 줄은 늘 보인다(백그라운드 에이전트가 도는 동안 메인 요청이 쌓여도 "앞 동작" 으로 접히지 않게) — 메인 요청만 최근 몇 개
  const mainIdx = now.details.flatMap((d, i) => (d.agent || d.app || d.compact ? [] : [i]))
  const keepFrom = mainIdx[Math.max(0, mainIdx.length - LIVE_SHOWN)] ?? 0
  const shown = now.details.filter((d, i) => d.agent || d.app || d.compact || i >= keepFrom)
  const hidden = now.details.length - shown.length
  const model = modelText(now.model, now.effort)
  const look = phaseLook(phase, kind)
  // 끝난 질문 줄과 같은 칸: 아이콘 칸(점) · 금액 · 글 기둥(질문 · 아래 줄 · 동작별 값이 같은 자리에서 시작).
  // 테두리 타일 안이라 그만큼 좁다
  const textBox = cols - CARD_INSET - g.iconW - 1 - g.leadW - 1
  return (
    <Box key="h-live" marginTop={1} {...TILE}>
      <Box columnGap={1} alignItems="flex-start" flexGrow={1}>
        {/* 빈 글 한 칸을 곁들여 줄 높이를 잡는다 — 점이 첫 줄 글의 세로 가운데에 온다 */}
        <Box key="h-live-dot" width={g.iconW} flexShrink={0} justifyContent="center" alignItems="center">
          {pulseDot(ui, surface, look ? look.hex : LIVE_HEX, look ? look.text : L('진행 중', 'Running'))}
          <Text> </Text>
        </Box>
        {/* 첫 요청이 끝나기 전엔 값이 없다 — $0.00 대신 비운다 */}
        {now.steps > 0 ? usdCell(ui, now.cost.usd, true, g.leadW) : <Box width={g.leadW} flexShrink={0} />}
        <Box flexDirection="column" flexShrink={1} minWidth={0}>
          {look ? (
            <Text wrap="wrap" color={look.color}>
              {look.text}
            </Text>
          ) : (
            <Text wrap="wrap">
              <Text bold color={ACCENT}>
                {L('진행 중', 'Running')}
              </Text>
              <Text>{` ${clipText(now.prompt, 60) || L('(글 없음)', '(no text)')}`}</Text>
            </Text>
          )}
          {/* 첫 요청이 끝나기 전엔 컨텍스트 · 요청 수를 모른다 — "컨텍스트 0 · 요청 0회" 대신 기다린다고만 */}
          {now.steps === 0 ? (
            <Text dimColor>{L('첫 응답을 기다리는 중', 'Waiting for the first response')}</Text>
          ) : (
            <Text wrap="wrap">
              <Text color={LEVEL_TEXT[levelOf(now.contextTokens)]}>{L(`컨텍스트 ${fmtTokens(now.contextTokens)}`, `context ${fmtTokens(now.contextTokens)}`)}</Text>
              <Text dimColor>{L(` · 요청 ${now.steps}회`, ` · ${plural(now.steps, 'request')}`) + (model ? ` · ${model}` : '')}</Text>
              {fromModel && now.model ? <Text>{` · ${withIcon('🔄', `${L('모델', 'model')} ${modelName(fromModel)} → ${modelName(now.model)}`)}`}</Text> : null}
              {fromEffort && now.effort ? <Text>{` · ${withIcon('🔄', `${L('노력도', 'effort')} ${fromEffort} → ${now.effort}`)}`}</Text> : null}
              {rewriteNote(ui, now.rewriteUsd)}
            </Text>
          )}
          {now.details.length > 0 ? (
            <Box key="h-live-box" {...DETAIL_BOX}>
              {hidden > 0 ? <Text key="h-live-more" dimColor>{L(`├─ 앞 동작 ${hidden}개`, `├─ ${hidden} earlier steps`)}</Text> : null}
              {detailRows(ui, shown, 'hl', textBox - DETAIL_INSET, g)}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 컴팩트가 도는 동안: 진행 중 질문이 없어도 띠와 같은 점 · 글을 맨 위에 — 저장 턴은 이미 끝났고 /compact 는 턴이 아니라
 * 진행 중 줄만 그리던 때는 띠에 "컴팩트 중" 이 떠도 패널엔 아무 표시가 없었다. 금액 칸은 비운다(끝나야 안다)
 */
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
          <Text wrap="wrap" color={look.color}>
            {look.text}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 끝난 질문 한 줄: [아이콘] [금액 · 그 아래 언제] [글 기둥]. 글 기둥 = 질문 글 · 아래 줄(모델 · 노력도 · 컨텍스트) · 펼치면 내역과
 * 동작별 값 — 모두 같은 자리에서 시작한다. 금액 · 아래 줄 · 질문 글 · 동작별 글이 저마다 다른 자리에서 시작해 들쭉날쭉했다
 * (2026-10-11 스크린샷). 아이콘은 접힌 줄 두 줄의 세로 가운데, 펼치면 위(긴 글 가운데로 가면 불편했다)
 */
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
) {
  const { Box, Text } = ui
  const when = agoText(t.atMs, nowMs)
  const growth = growthOf(t, older)
  // 모델 · 노력도를 바꾼 질문. 바꾼 값은 보통 색으로, 안 바뀐 값은 흐리게
  const { fromModel, fromEffort } = changesOf(t, older)
  // 아래 줄: 모델 · 노력도 · 컨텍스트(수준 색) — 모델부터 시작해 줄마다 같은 자리에 선다. 언제는 금액 밑(leadCell).
  // 읽기 · 쓰기 · 출력은 펼쳐야 보인다 — 줄에선 모델 · 컨텍스트가 더 중요하다
  const parts: unknown[] = []
  if (t.model) {
    parts.push(
      fromModel ? (
        <Text key="m">{withIcon('🔄', `${L('모델', 'model')} ${modelName(fromModel)} → ${modelName(t.model)}`)}</Text>
      ) : (
        <Text key="m" dimColor>
          {modelName(t.model)}
        </Text>
      ),
    )
  }
  if (t.effort) {
    parts.push(
      fromEffort ? (
        <Text key="e">{withIcon('🔄', `${L('노력도', 'effort')} ${fromEffort} → ${t.effort}`)}</Text>
      ) : (
        <Text key="e" dimColor>
          {t.effort}
        </Text>
      ),
    )
  }
  if (t.contextTokens) {
    parts.push(
      <Text key="c">
        <Text color={LEVEL_TEXT[levelOf(t.contextTokens)]}>{L(`컨텍스트 ${fmtTokens(t.contextTokens)}`, `context ${fmtTokens(t.contextTokens)}`)}</Text>
        {growth !== null ? growthText(ui, growth, fromModel !== null) : null}
      </Text>,
    )
  }
  const meta = parts.flatMap((p, j) => (j === 0 ? [p] : [<Text key={`s${j}`} dimColor>{' · '}</Text>, p]))
  return (
    <Box key={key} marginTop={1} columnGap={1} alignItems={isOpen || g.iconTop ? 'flex-start' : 'center'}>
      <Box width={g.iconW} flexShrink={0}>
        {icon}
      </Box>
      <Box columnGap={1} alignItems="flex-start" flexShrink={1} minWidth={0}>
        {leadCell(
          ui,
          <Text bold>{fmtUsd(t.cost.usd)}</Text>,
          when,
          g,
        )}
        <Box flexDirection="column" flexShrink={1} minWidth={0}>
          {head}
          {meta.length > 0 ? <Text wrap="wrap">{meta}</Text> : null}
          {extra}
        </Box>
      </Box>
    </Box>
  )
}

export const FLOW_HEIGHT = 56

/**
 * 컴팩트 카드의 재료: gauge = 미룬 비용 게이지(늘 보임), details = 흐름 그래프 · 범례 · 컴팩트 효과(접혀 있다가 펼침).
 * 예전엔 컨텍스트 카드 아래에 다 펼쳐 둬 질문별 비용이 화면 밖으로 밀렸다
 */
export type FlowParts = {
  gauge: unknown
  /** 미룬 비용 한 줄 — 판단 타일 맨 아래(지금 컴팩트하면 줄 다음) */
  gaugeNote: unknown
  details: unknown[]
  compactions: number
  gain: number | null
  /** 미룬 비용 게이지의 상태 말(여유 · 곧 컴팩트할 때 · 컴팩트할 때)과 색 — 컴팩트 카드를 접으면 제목 줄에 */
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
  // 그래프는 최근 질문 FLOW_RECENT 개만, [전체] 로 다 — 질문별 비용의 [최근 5] [전체 N] 과 같은 꼴(점점 길어지면 보기
  // 힘들다). 제목 줄 요청 · 컴팩트 · 최고는 세션 전체 값 그대로
  const recentFrom = recentStart(flow.points, questionStarts, FLOW_RECENT)
  const hasMoreFlow = recentFrom > 0
  const isFlowAll = showAllFlow && hasMoreFlow
  const from = isFlowAll ? 0 : recentFrom
  const flowToggle = (key: string, text: string, isOn: boolean, toAll: boolean) =>
    isOn ? (
      <Button key={key} label={`✓ ${text}`} variant="primary" onPress={() => onShowAllFlow(toAll)} />
    ) : (
      <Button key={key} label={text} variant="secondary" dimColor onPress={() => onShowAllFlow(toAll)} />
    )
  // 가장 컸던 크기는 제목 줄 설명에 — 그래프 아래 시간 줄에 붙여 두니 "그 시각이 최고였다" 로 읽혔다
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
      {hasMoreFlow && n >= 2 ? flowToggle('flow-recent', L(`최근 질문 ${FLOW_RECENT}`, `Last ${FLOW_RECENT} questions`), !isFlowAll, false) : null}
      {hasMoreFlow && n >= 2 ? flowToggle('flow-all', L('전체', 'All'), isFlowAll, true) : null}
    </Box>
  )
  const noteLine = note ? emptyLine(ui, 'f-note', note) : null
  if (n < 2) {
    const empty = emptyLine(
      ui,
      'f-empty',
      isLoaded
        ? L('요청이 두 번 넘게 쌓이면 흐름을 그립니다.', 'The flow is drawn once there are more than two requests.')
        : L('세션 기록을 읽는 중입니다. 못 읽으면 지금부터 그립니다.', 'Reading the session transcript. If it cannot be read, drawing starts from now.'),
    )
    return { gauge: null, gaugeNote: null, details: [head, noteLine, empty], compactions: flow.compactions.length, gain: null, state: null }
  }
  // 시간 축: 막대 바로 아래 왼쪽 끝 = 첫 요청(질문별 비용처럼 "16시간 전"), 오른쪽 끝 = 지금
  const axis = { left: agoText(flow.points[from]!.atMs, nowMs) || fmtClock(flow.points[from]!.atMs), right: L('지금', 'now') }
  // 보이는 창 안 번호로 — 창 왼쪽 끝(from)의 컴팩트 선은 테두리처럼 보여 뺀다
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
    // 터미널: 칸 그림 + 아래 시간 축 — 기준 이름(300k · 400k)은 그림 오른쪽 끝에 같이 그린다(cells.ts flowCells). 시간 축은 막대를
    // 그린 폭까지만: 요청이 적으면 막대가 왼쪽에 몰려 있어 "지금" 이 오른쪽 끝에 떨어져 있으면 어느 막대인지 안 읽힌다
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
  // 처음부터 있던 몫(시스템 · 도구 · 지시문) = 기록의 첫 요청 — 기록이 세션 처음부터일 때만(note = 앞 구간을 못 읽음)
  const first = note === null ? (flow.points[0] ?? null) : null
  // 엔진이 값을 안 준 컴팩트는 추정: 그 컴팩트의 요약 크기(모르면 계산식 재료의 요약) · 요약 출력(이 PC 실측 또는 가정)
  const effects = u
    ? compactEffects(flow, u.model, {
        output: opt?.inputs?.output ?? OUTPUT_GUESS,
        summaryOf: c => compactSummary(flow, c, first) ?? opt?.inputs?.summary ?? SUMMARY_GUESS,
      })
    : []
  // 컴팩트 미룬 값: 지난 컴팩트 뒤 커진 만큼 더 읽은 값의 합 — 컴팩트 효과(지난 이득)보다 먼저, 지금 손해가 쌓이는 게
  // 보이게. 컴팩트 전이면 컴팩트했다면 될 크기(계산식 재료의 직후 크기)와 견준다
  const extra = u && opt?.inputs ? segmentExtra(flow, u.model, opt.inputs.after) : null
  const extraTotal = extra ? extra.cum[extra.cum.length - 1]! : 0
  // 컴팩트 시점 칸: 지금 컨텍스트가 적용 중인 기준(구간 · 직접 지정)의 어디쯤인지 — 상태 말 한 줄 + 막대(timingSvg).
  // 예전 게이지는 100% = 비용만 본 최적(컴팩트 한 번 값만큼 더 읽은 때)이라 고른 구간과 따로 놀았다: 구간 안인데 7.5배 ·
  // 빨강이고, 100% 눈금이 눈에 안 들어와 좋은 때인지 놓쳤는지 몰랐다. 미룬 비용은 숫자 한 줄로만(extraNote)
  const fillColor = { ok: LEVEL_HEX.ok, warn: LEVEL_TEXT.warn, cut: LEVEL_TEXT.cut } as const
  const applied = thresholds()
  const fillWord = applied.isRange
    ? { ok: L('여유', 'Room left'), warn: L('컴팩트하기 좋은 때', 'Good time to compact'), cut: L('컴팩트 늦어짐', 'Compact overdue') }
    : { ok: L('여유', 'Room left'), warn: L('곧 컴팩트할 때', 'Compact soon'), cut: L('컴팩트할 때', 'Time to compact') }
  const nowCtx = u && u.contextTokens > 0 ? u.contextTokens : flow.points[n - 1]!.ctx
  const extraLevel = levelOf(nowCtx)
  // 상태 말 옆에 다음 자리까지 얼마 — "좋은 때인지 놓쳤는지" 를 말로
  const stateNote =
    extraLevel === 'ok'
      ? L(
          `${fmtTokens(applied.ctxWarn)}부터 ${fillWord.warn} · ${fmtTokens(applied.ctxWarn - nowCtx)} 남음`,
          `${fillWord.warn} from ${fmtTokens(applied.ctxWarn)} · ${fmtTokens(applied.ctxWarn - nowCtx)} to go`,
        )
      : extraLevel === 'warn'
        ? L(`${fmtTokens(applied.ctxCut)} 전에 · ${fmtTokens(applied.ctxCut - nowCtx)} 남음`, `before ${fmtTokens(applied.ctxCut)} · ${fmtTokens(applied.ctxCut - nowCtx)} to go`)
        : L(`${fmtTokens(applied.ctxCut)}를 ${fmtTokens(nowCtx - applied.ctxCut)} 넘음`, `${fmtTokens(nowCtx - applied.ctxCut)} past ${fmtTokens(applied.ctxCut)}`)
  // 지난 구간(마지막 컴팩트 전)에 컴팩트 전까지 쌓인 미룬 비용 — 지금이 그때와 견줘 어떤지
  const lastC = flow.compactions[flow.compactions.length - 1]
  const prev =
    u && lastC && lastC.index >= 2
      ? segmentExtra({ points: flow.points.slice(0, lastC.index), compactions: flow.compactions.slice(0, -1) }, u.model, opt?.inputs?.after ?? lastC.before)
      : null
  const prevTotal = prev ? prev.cum[prev.cum.length - 1]! : 0
  // 막대의 회색 = 상주(컴팩트해도 남는 몫, 지금 모델로 센 값)
  const baseTokens = extra?.baseNow ?? lastC?.after ?? opt?.inputs?.after ?? null
  // 막대는 컴팩트 카드의 판단 타일 안에 들어가 그만큼 좁다(흐름 그래프는 타일 밖이라 그대로)
  const tilePx = Math.max(120, widthPx - TILE_PX)
  const markNames = applied.isRange
    ? { warnName: L(`${fmtTokens(applied.ctxWarn)} 좋은 때`, `${fmtTokens(applied.ctxWarn)} good`), cutName: L(`${fmtTokens(applied.ctxCut)} 늦어짐`, `${fmtTokens(applied.ctxCut)} late`) }
    : { warnName: L(`${fmtTokens(applied.ctxWarn)} 곧`, `${fmtTokens(applied.ctxWarn)} soon`), cutName: L(`${fmtTokens(applied.ctxCut)} 정한 크기`, `${fmtTokens(applied.ctxCut)} set size`) }
  const extraEl = (
    <Box key="f-extra" flexDirection="column">
      <Box columnGap={1} flexWrap="wrap" alignItems="center">
        <Text bold>{L('컴팩트 시점', 'Compact timing')}</Text>
        <Text bold color={fillColor[extraLevel]}>{`● ${fillWord[extraLevel]}`}</Text>
        <Text dimColor wrap="wrap">
          {stateNote}
        </Text>
      </Box>
      {Svg ? (
        <Svg
          key="f-timing"
          source={timingSvg(nowCtx, baseTokens, { warn: applied.ctxWarn, cut: applied.ctxCut, ...markNames }, LEVEL_HEX[extraLevel], tilePx)}
          alt={L(`컴팩트 시점 — 지금 ${fmtTokens(nowCtx)}, ${fillWord[extraLevel]}(${stateNote})`, `Compact timing — now ${fmtTokens(nowCtx)}, ${fillWord[extraLevel]} (${stateNote})`)}
          width={tilePx}
          height={TIMING_H}
        />
      ) : Raster ? (
        // 터미널: 칸 그림 한 줄 + 아래 시작 · 끝 이름(데스크톱은 그림 안에 있다)
        <Box key="f-timing" flexDirection="column">
          <Raster
            key="f-timing-cells"
            columns={Math.max(10, Math.round(tilePx / 6))}
            rows={1}
            cells={timingCells(nowCtx, baseTokens, applied.ctxWarn, applied.ctxCut, LEVEL_HEX[extraLevel], Math.max(10, Math.round(tilePx / 6))).toBase64()}
          />
          <Box key="f-timing-names" columnGap={2}>
            <Text>
              <Text color={LEVEL_HEX.warn}>┃</Text>
              <Text dimColor>{` ${markNames.warnName}`}</Text>
            </Text>
            <Text>
              <Text color={LEVEL_HEX.cut}>┃</Text>
              <Text dimColor>{` ${markNames.cutName}`}</Text>
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  )
  // 미룬 비용: 지난 컴팩트 뒤 커진 만큼 더 낸 읽기 비용 — 숫자 한 줄
  const extraNote =
    (extra && extraTotal > 0) || lastC ? (
      <Text key="f-extra-note" wrap="wrap">
        <Text>{L('미룬 비용 ', 'Deferral cost ')}</Text>
        <Text bold>{fmtUsd(extraTotal)}</Text>
        {extra && extraTotal > 0 ? (
          <Text dimColor>
            {L(` — 컴팩트했다면 안 냈을 읽기 비용 · 요청마다 +${fmtUsd(extra.nowExtraUsd)}`, ` — reads you would not have paid had you compacted · +${fmtUsd(extra.nowExtraUsd)} per request`)}
          </Text>
        ) : (
          <Text dimColor>{L(' — 방금 컴팩트해 아직 없습니다', ' — none yet, just compacted')}</Text>
        )}
        {prev && prevTotal > 0 ? <Text dimColor>{L(` · 지난 구간 ${fmtUsd(prevTotal)}`, ` · previous segment ${fmtUsd(prevTotal)}`)}</Text> : null}
      </Text>
    ) : null
  const details = [
    head,
    noteLine,
    chart,

    // 범례는 그래프만 봐선 모르는 것만, 선 색 견본 + 이름을 칸 간격으로: 막대(제목 "요청 N회")와 점선(오른쪽 끝 "권장 · 강조")은
    // 그래프에 이미 이름이 있다. 예전 한 줄 "막대: … · 점선: 노랑 · 빨강 기준 · 청록 선: …" 은 · 가 항목 사이와 항목 안에 같이
    // 쓰여 어디서 끊기는지 안 읽혔다. 모델 변경은 바꾼 적이 있을 때만 — 그 자리의 증감은 컴팩트가 아니라 모델 차이
    flow.compactions.length > 0 || switches.length > 0 ? (
      <Box key="f-key" columnGap={3} flexWrap="wrap">
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
        {flow.compactions.length > 0 ? <Text dimColor>{L('흐린 막대 = 지난 구간', 'faded bars = earlier segments')}</Text> : null}
      </Box>
    ) : null,
    // 컴팩트마다 남긴 요약은 각 컴팩트 줄 옆에. 지금 상주 크기는 맨 위 지금 카드의 컨텍스트 막대에
    ...effectsBlock(
      ui,
      effects,
      u ? flow.points[n - 1]!.ctx : null,
      u,
      showAllEffects,
      onShowAllEffects,
      nowMs,
      gridOf(surface),
      ef => compactSummary(flow, ef.event, first),
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

/**
 * 상주 = 컴팩트해도 남는 크기(지금 모델로 센 값). fixed = 처음부터 있던 몫(/context 의 System prompt · tools · Memory files ·
 * Skills — 화면 이름 "기본 적재"), summary = 마지막 컴팩트 요약(공식 이름 Compact summary, 다시 붙는 파일 포함).
 * 가르지 못하면 둘 다 null. "영구" 라 부르다 바꿨다 — 요약은 컴팩트마다 새로 써 영구가 아니고 공식 용어도 아니다. "컴팩트해도 남음" 은 구어체라 화면 이름은 "상주"
 */
export type Perm = { tokens: number; fixed: number | null; summary: number | null; isEstimated: boolean; isRescaled: boolean }

/**
 * 영구 컨텍스트: 이 세션에서 잰 마지막 컴팩트 직후 크기. 컴팩트 전이면 지난 실측(fallback)으로 추정, 이번 컴팩트를 아직
 * 못 쟀으면 앞 컴팩트 값으로 추정(isEstimated). 요약은 컴팩트마다 앞 요약까지 다시 써 쌓이지 않고 바뀐다(이 세션 28k →
 * 24k → 22k → 25k → 32k → 19k) — "쌓인 요약" 으로 읽히지 않게 마지막 요약만. 모델을 바꾸면 대화는 그대로고 세는 값만
 * 다르다 — 지금 모델로 센 값(isRescaled 면 처음부터 있던 몫 · 요약은 예전 모델로 센 값이라 가르지 않는다).
 * isPartial = 기록 앞 구간을 못 읽음(첫 요청이 세션 처음이 아니다)
 */
export function permanentOf(flow: Flow, isPartial: boolean, fallback: number | null): Perm | null {
  const measured = flow.compactions.filter(c => c.after !== null)
  const last = measured[measured.length - 1]
  if (!last || last.after === null) {
    // 컴팩트 전: 계산식 재료의 직후 크기(기본 적재 + 요약 추정) — 그것도 모르면 그리지 않는다
    return fallback === null ? null : { tokens: fallback, fixed: null, summary: null, isEstimated: true, isRescaled: false }
  }
  const tokens = afterInNowTokens(flow, last.after)
  const isRescaled = Math.abs(tokens - last.after) > last.after * 0.03
  const first = isPartial ? null : (flow.points[0] ?? null)
  const summary = isRescaled ? null : compactSummary(flow, last, first)
  return {
    tokens,
    fixed: summary !== null && first ? first.ctx : null,
    summary,
    isEstimated: pendingCompact(flow) !== null,
    isRescaled,
  }
}

/** 컴팩트 효과에서 처음 보이는 수 — 넘으면 질문별 비용처럼 [최근 3] [전체 N] */
export const EFFECTS_RECENT = 3

/**
 * 컴팩트 효과의 총 이득(끝난 셈만). 마지막 컴팩트가 아직 본전 전(회수 중)이면 빼야 "방금 한 컴팩트 = 손해" 로 읽히지
 * 않는다. 끝난 셈이 없으면 null. 컴팩트 카드 제목 줄에 보인다
 */
export function effectsNet(effects: readonly CompactEffect[]): number | null {
  const latest = effects[effects.length - 1]
  const measured = effects.filter(ef => ef.event.after !== null && !(ef === latest && ef.netUsd < 0))
  return measured.length > 0 ? measured.reduce((sum, ef) => sum + ef.netUsd, 0) : null
}

/**
 * 컴팩트 효과: 제목 줄(총 이득 · 전환) + 컴팩트마다 한 덩어리(최근 것부터, 남긴 요약 크기 = summaryOf). 총 이득은 컴팩트
 * 카드 제목 줄에도 있다(effectsNet — 카드 제목마다 그 카드의 돈 합: 이 세션 누적 비용 · 질문 합 · 총 이득, 그래프를 접어도 보이게).
 * 컴팩트가 쌓이면 질문별 비용처럼 최근 3개만, [전체 N] 으로 다 본다
 */
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
  const shown = isAll ? all : all.slice(0, EFFECTS_RECENT)
  const net = effectsNet(effects)
  // 질문별 비용의 전환과 같은 꼴: 고른 쪽은 채운 버튼 + ✓
  const toggle = (key: string, text: string, isOn: boolean, toAll: boolean) =>
    isOn ? (
      <Button key={key} label={`✓ ${text}`} variant="primary" onPress={() => onShowAll(toAll)} />
    ) : (
      <Button key={key} label={text} variant="secondary" dimColor onPress={() => onShowAll(toAll)} />
    )
  return [
    <Box key="f-eh" marginTop={1} columnGap={1} alignItems="center" flexWrap="wrap">
      <Text bold>{L('컴팩트 효과', 'Compact results')}</Text>
      {/* 카드 제목 줄에도 있지만 목록 옆에서도 — 옮겼더니 목록을 볼 때 합이 안 보였다. "합 이득 $73.79 · 왼쪽 =
          아낀 값 − 컴팩트 비용 · …" 처럼 식을 붙이면 안 읽혔다 — 줄마다 아낀 값 · 컴팩트 비용이 있어 총계만 */}
      {net !== null ? (
        <Text bold color={net >= 0 ? 'green' : 'yellow'}>
          {L(`총 ${gainText(net)}`, `total ${gainText(net)}`)}
        </Text>
      ) : null}
      {hasMore ? toggle('effects-recent', L(`최근 ${EFFECTS_RECENT}`, `Last ${EFFECTS_RECENT}`), !isAll, false) : null}
      {hasMore ? toggle('effects-all', L(`전체 ${all.length}`, `All ${all.length}`), isAll, true) : null}
    </Box>,
    ...(effects.length === 0
      ? [emptyLine(ui, 'f-none', L('아직 컴팩트한 적이 없습니다. 컴팩트하면 여기에 기록됩니다.', 'No compacts yet. Each compact is recorded here.'))]
      : shown.map((ef, i) => effectRow(ui, ef, `ef-${i}`, ef === latest ? nowCtx : null, u, nowMs, g, summaryOf(ef), ef === latest))),
  ]
}

/**
 * 컴팩트 한 번 — 질문별 비용과 같은 꼴: 왼쪽 고정 폭 칸에 순이득(아낀 값 − 컴팩트 비용)과 그 아래 언제("3시간 전"),
 * 오른쪽 제목에 (자동) 컴팩트 · 줄인 양, 아래 줄에 그때 모델 · 컴팩트 비용 · 이후 요청 · 아낀 값.
 * "든 값" 은 무엇에 든 값인지 흐려 요청당 값과 섞였다 — 무엇의 값인지 이름에
 * 가장 최근 것엔 지금 요청당 차이도. summary = 그 컴팩트가 남긴 요약 크기(직후 크기 옆에).
 * isLatest = 마지막 컴팩트 — 아직 본전 전이면 끝난 손해가 아니라 회수 중이다. 4분 전 컴팩트에 "손해" 가 붙으니 잘못 한
 * 컴팩트처럼 읽혔다. 손해는 다음 컴팩트 전에 본전을 못 뽑고 끝난 것에만. "회수중" · "비용 회수중" 만으론 무엇을
 * 되찾는지 몰랐다 — 왼쪽 칸은 좁아 "회수중", 무엇인지는 아래 줄에 "컴팩트 비용 회수중 ~$0.64"
 */
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
      <Text bold color={ef.netUsd >= 0 ? 'green' : 'yellow'}>
        {gainText(ef.netUsd)}
      </Text>
    )
  // 왼쪽 칸은 "이득 $15.65"(11글자)까지 — 질문별 비용 칸보다 2칸 넓게
  return (
    <Box key={key} marginTop={1} columnGap={1} alignItems="flex-start">
      {leadCell(ui, net, agoText(ef.event.atMs, nowMs), { ...g, leadW: g.leadW + 2 })}
      <Box flexDirection="column" flexShrink={1} minWidth={0}>
        <Text wrap="wrap">
          {/* 청록 "컴팩트" — 그래프의 청록 세로선과 짝. 자동이면 제목에(시간 옆에 붙어 있었다) — 진행 글과 같은 "클로드 기본 auto-compact" */}
          <Text color="cyan">{ef.event.trigger === 'auto' ? L('클로드 기본 auto-compact ', "Claude's auto-compact ") : L('컴팩트 ', 'Compact ')}</Text>
          <Text color={LEVEL_TEXT[levelOf(ef.event.before)]}>{fmtTokens(ef.event.before)}</Text>
          <Text dimColor> → </Text>
          {after === null ? <Text dimColor>?</Text> : <Text color="green">{fmtTokens(after)}</Text>}
          {/* 직후 크기 안에 요약이 들어 있다 — " · 요약 18k" 는 따로 18k 가 더 있는 것처럼 읽혔다 */}
          {summary !== null && after !== null ? <Text dimColor>{L(`(요약 ${fmtTokens(summary)} 포함)`, `(incl. ${fmtTokens(summary)} summary)`)}</Text> : null}
        </Text>
        <Text wrap="wrap">
          <Text dimColor>{L(`${modelName(ef.model)} · 컴팩트 비용 `, `${modelName(ef.model)} · compact cost `)}</Text>
          {isRecouping ? <Text bold>{L('회수중 ', 'recouping ')}</Text> : null}
          <Text>{`~${fmtUsd(ef.costUsd)}`}</Text>
          {ef.isEstimated ? <Text dimColor>{L(' 추정', ' est.')}</Text> : null}
          {after === null ? (
            <Text dimColor>{L(' · 줄어든 크기는 다음 요청 때 잽니다', ' · the reduced size is measured at the next request')}</Text>
          ) : (
            <Text>
              <Text dimColor>{L(` · 이후 요청 ${ef.requestsAfter}회 · 절약 `, ` · ${plural(ef.requestsAfter, 'request')} since · saved `)}</Text>
              <Text color="green">{fmtUsd(ef.savedUsd)}</Text>
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

/** 질문 글. 질문 기록 기능(prompt · 시각) 전에 끝난 질문은 글이 없다 */
export function promptText(t: TurnSummary): string {
  if (t.prompt) return promptHead(t.prompt) // 예전에 머리말째 저장한 글도 다듬는다
  return Number.isFinite(t.atMs) ? L('(이어서 진행)', '(continued)') : L('(예전 질문)', '(earlier question)')
}

export const RECENT_COUNT = 5

/** 바로 앞 질문 대비 컨텍스트 증감. 둘 중 하나라도 값이 없으면(기능 전 기록) null */
export function growthOf(t: TurnSummary, older: TurnSummary | undefined): number | null {
  return t.contextTokens && older?.contextTokens ? t.contextTokens - older.contextTokens : null
}

/**
 * 컴팩트 카드의 판단 한 줄 — 지난 컴팩트 효과(이득)만 보이니 "괜찮네, 문제없네" 로 읽혔고, 지금 컴팩트하면 얼마인지가
 * 없었다. 지금 컴팩트하면 질문마다 아끼는 값 · 컴팩트 비용 · 본전(띠 확인창과 같은 계산). 캐시가 식었으면 그 견줌
 */
export function drawEfficiency(ui: Ui, u: Usage, sums: readonly TurnSummary[], nowMs: number, inputs: CompactInputs) {
  const { Box, Text } = ui
  const ctx = u.contextTokens
  const r = ratesFor(u.model, ctx)
  if (!r || ctx <= 0) return null
  const after = Math.min(inputs.after, ctx)
  const ratio = after > 0 ? ctx / after : 1
  const est = estimate(ctx, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom))
  const calls = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  let second: unknown = null
  if (ratio < LITTLE_SHRINK) {
    // 띠 툴팁 · 확인 카드와 같은 선 · 같은 말 · 같은 색
    second = <Text bold color="red" wrap="wrap">{L('아낄 게 거의 없음 — 지금 컴팩트하면 손해', 'Little to save — compacting now is a loss')}</Text>
  } else if (est.kind === 'cold') {
    const c = coldCompact(ctx, inputs, u.model)
    if (c) {
      second = (
        <Text wrap="wrap">
          <Text dimColor>{L('캐시가 만료돼 다음 요청은 전체를 다시 씁니다. 지금 컴팩트하면 ', 'The cache expired, so the next request rewrites everything. Compacting now ')}</Text>
          {c.compactUsd < c.continueUsd ? (
            <Text color="green" bold>{L(`${fmtUsd(c.continueUsd - c.compactUsd)} 이득`, `saves ${fmtUsd(c.continueUsd - c.compactUsd)}`)}</Text>
          ) : (
            <Text bold color="red">{L(`${fmtUsd(c.compactUsd - c.continueUsd)} 손해`, `costs ${fmtUsd(c.compactUsd - c.continueUsd)} more`)}</Text>
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
      second = (
        <Text wrap="wrap">
          <Text dimColor>{L('지금 컴팩트하면 ', 'Compacting now ')}</Text>
          <Text color="green" bold>
            {pay.saveQuestionUsd !== null
              ? L(`질문마다 ~${fmtUsd(pay.saveQuestionUsd)} 아낌`, `saves ~${fmtUsd(pay.saveQuestionUsd)} per question`)
              : L(`요청마다 ~${fmtUsd(pay.saveCallUsd)} 아낌`, `saves ~${fmtUsd(pay.saveCallUsd)} per request`)}
          </Text>
          <Text dimColor>{L(` · 비용 ~${fmtUsd(pay.costUsd)} · `, ` · cost ~${fmtUsd(pay.costUsd)} · `)}</Text>
          <Text>{even}</Text>
        </Text>
      )
    }
  }
  // "지금 요청 1회 $X · 컴팩트하면 $Y" 줄은 뺐다 — 지금 카드의 "다음 요청" 과 같은 값이 두 번 보였고, 컴팩트 판단은
  // 게이지와 이 한 줄로 충분하다. 배수("3.5배")는 예전에 이미 뺐다(기준점 없이 커 보였다)
  return (
    <Box key="c-eff" flexDirection="column">
      {second}
    </Box>
  )
}

/**
 * 컨텍스트 · 비용 카드 아래 "질문별 비용": 제목 옆 [최근 5] [전체 N] 으로 한 자리에서 바꿔 본다.
 * 질문을 누르면 펼쳐서 동작별 값. 맨 위엔 진행 중 질문(liveEl — 컴팩트 중이면 그 줄) — 맨 위 카드로 떼어 냈더니 지난 질문과
 * 끊겨 견주기 어렵고, 요청마다 동작 줄이 늘어 컨텍스트 막대가 밀려 내려갔다
 */
/** 질문별 비용의 버튼 동작 — 화면 코드는 $ 를 못 받아(import 너머로 못 넘김, 엔진 규칙) register.tsx 가 묶어 넘긴다 */
export type HistoryActions = { setAll: (isAll: boolean) => void; toggle: (id: number) => void }

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
  liveNote: string | null = null,
) {
  const { Box, Button, Text } = ui
  const all = [...sums].reverse()
  const total = all.reduce((sum, t) => sum + t.cost.usd, 0)
  const hasMore = all.length > RECENT_COUNT
  const isAll = showAll && hasMore
  const shown = isAll ? all : all.slice(0, RECENT_COUNT)
  // 고른 쪽은 채운 버튼(primary) + ✓, 다른 쪽은 흐린 보조 버튼 — 흐림 차이만으론 지금 보는 쪽이 안 읽혔다
  const toggle = (key: string, text: string, isOn: boolean, toAll: boolean) =>
    isOn ? (
      <Button key={key} label={`✓ ${text}`} variant="primary" onPress={() => act.setAll(toAll)} />
    ) : (
      <Button key={key} label={text} variant="secondary" dimColor onPress={() => act.setAll(toAll)} />
    )
  // 글 기둥 폭(Box 칸): 아이콘 칸 · 사이 · 금액(+ 시간) 칸 · 사이를 뺀 자리
  const textBox = cols - g.iconW - 1 - g.leadW - 1
  return (
    <Box key="s-history" flexDirection="column" marginTop={1} {...CARD}>
      {/* 제목 줄 아래 한 칸 더 — 줄마다 위 한 칸이 있지만 제목 줄의 버튼이 높아 붙어 보였다 */}
      <Box columnGap={1} alignItems="center" flexWrap="wrap" marginBottom={fold.isOpen ? 1 : 0} {...TITLE_BAND}>
        {foldButton(ui, 's-history', fold)}
        {iconOf('🧾') ? <Text>{iconOf('🧾')}</Text> : null}
        <Text bold color="cyan">
          {L('질문별 비용', 'Cost per question')}
        </Text>
        {/* 최근 · 전체 전환은 펼쳤을 때만(목록을 바꾸는 버튼). 접으면 진행 중 질문 값을 요약 앞에 붙인다 */}
        {fold.isOpen && hasMore ? toggle('history-recent', L(`최근 ${RECENT_COUNT}`, `Last ${RECENT_COUNT}`), !isAll, false) : null}
        {fold.isOpen && hasMore ? toggle('history-all', L(`전체 ${all.length}`, `All ${all.length}`), isAll, true) : null}
        {/* 합은 남겨 둔 질문(최대 60개)의 합이라 세션 누적보다 작을 수 있다 — "N개 합" 으로 무엇의 합인지 */}
        {all.length === 0 && !(liveNote && !fold.isOpen) ? null : (
          <Text wrap="wrap">
            {!fold.isOpen && liveNote ? <Text color={LIVE_HEX}>{`● ${liveNote}`}</Text> : null}
            {!fold.isOpen && liveNote && all.length > 0 ? <Text dimColor>{' · '}</Text> : null}
            {all.length > 0 ? <Text>{L(`${all.length}개 합 `, `${all.length} total `)}</Text> : null}
            {all.length > 0 ? <Text bold>{fmtUsd(total)}</Text> : null}
            {fold.isOpen && all.length > 0 ? <Text dimColor>{L(' · 누르면 자세히 · (+N)은 그 질문이 늘린 컨텍스트', ' · tap for details · (+N) = context the question added')}</Text> : null}
          </Text>
        )}
      </Box>
      {fold.isOpen ? liveEl : null}
      {fold.isOpen && all.length === 0 && !liveEl ? emptyLine(ui, 'h-none', L('아직 끝난 질문이 없습니다.', 'No finished questions yet.')) : null}
      {(fold.isOpen ? shown : []).map((t, i) => {
        const id = Number.isFinite(t.atMs) ? t.atMs : -i
        const isOpen = expanded === id
        // 열기 · 접기 아이콘(▸ / ▾)만 테두리 버튼, 금액 왼쪽에 — 글은 테두리 없이. 아이콘이 작고 테두리가 없어 안 띄었고,
        // 줄 전체를 테두리 버튼으로 하니 그건 아니었다. 접힌 글도 눌러 펼친다(아이콘과 같은 일).
        // 버튼 글은 데스크톱에서 줄을 안 바꾼다 — 길면 패널 틀을 넓혀 패널 전체 글이 오른쪽에서 잘렸다.
        // 그래서 접힌 글은 글 기둥 폭에 맞게 미리 자르고, 펼치면 그 자리에서 전체 글을 줄 바꿔 보인다(버튼 밖 Text)
        const full = promptText(t)
        const icon = (
          <Button key={`hx-${i}`} label={isOpen ? '▾' : '▸'} variant="secondary" onPress={() => act.toggle(id)} />
        )
        const head = isOpen ? (
          <Text wrap="wrap">{full}</Text>
        ) : (
          <Button key={`hxt-${i}`} plain onPress={() => act.toggle(id)}>
            <Text>{fitCells(full, textCells(g, textBox))}</Text>
          </Button>
        )
        // 펼치면 읽기 · 쓰기 · 출력 내역, 그 아래 동작별 값 — 접힌 줄에선 뺐다
        const extra = isOpen ? (
          <Box key={`hbox-${i}`} {...DETAIL_BOX}>
            <Text key={`hb-${i}`} dimColor wrap="wrap">
              {costBreakdown(t.cost, t.appUsd)}
            </Text>
            {(t.details ?? []).length === 0
              ? emptyLine(ui, `hd-none-t-${i}`, L('동작별 기록이 없는 예전 질문입니다.', 'An earlier question without per-step records.'))
              : detailRows(ui, t.details ?? [], `hd-${i}`, textBox - DETAIL_INSET, g)}
          </Box>
        ) : null
        return historyRow(ui, t, nowMs, `hr-${i}`, icon, head, isOpen, all[i + 1], extra, g)
      })}
    </Box>
  )
}

/**
 * 사용량 패널 맨 위 "컨텍스트 · 비용" 카드: 컨텍스트 크기 · 막대 · 상주 → 다음 요청 · 세션 누적. 다섯 줄 남짓이라 자리가
 * 고정된다 — 진행 중 질문은 바로 아래 질문별 비용 맨 위. 예전엔 컨텍스트 · 비용 · 컴팩트 판단 · 기록이 한 카드에 섞여
 * 있었다. 컴팩트 판단은 컴팩트 카드, 요율 · 색 기준은 맨 아래 참고 줄.
 * 이름은 담긴 것 그대로 — "지금" 은 진행 중 질문이 있을 때 이름이라, 빠진 뒤엔 무엇이 지금인지 흐렸다
 */
export function drawNow(
  ui: Ui,
  surface: string,
  u: Usage | null,
  nowMs: number,
  widthPx: number,
  perm: Perm | null = null,
  inputs: CompactInputs | null = null,
  fold?: Fold,
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
      '🧠',
      fold,
    )
  }
  const est = estimate(u.contextTokens, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom))
  const level = levelOf(u.contextTokens)
  const ctxPercent = u.percent ?? (u.window > 0 ? (u.contextTokens / u.window) * 100 : 0)
  const t = thresholds()
  const talk = perm ? Math.max(0, u.contextTokens - perm.tokens) : 0
  // 상주 몫은 두 색으로: 기본(처음부터 있던 시스템 · 도구 · 지시문) · 요약(컴팩트가 남긴 것, 컴팩트 청록) — 한 색이면 어디가
  // 컴팩트로 붙은 몫인지 안 보였다. 가를 수 없으면(기록 앞 구간을 못 읽음 · 모델을 바꿈 · 컴팩트 전) 한 칸
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
  // 대화 몫은 늘 같은 색 — 전체 크기 단계(노랑 · 빨강)로 칠했더니 "■ 대화 280k" 가 노랑이라 280k 가 기준을 넘은 것처럼
  // 읽혔다(실제론 전체 355k 때문). 단계는 위 전체 크기 숫자 색과 막대 위 눈금(노랑 · 빨강이 시작하는 크기)으로
  // 막대 아래 범례: 앞칸 상주 몫(무엇으로 이뤄졌나) · 뒤칸 대화 몫. 이 정도 양은 세션을 바꿀 징표가 아니라 표시만 —
  // 경고는 상주 몫 자체가 권장 기준을 넘어 컴팩트로 그 아래에 못 갈 때만(강조 기준 10만이면 98k 에서 거의 켜졌다)
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
      {/* 최적을 따라가면 권장이 늘 상주 위라 거의 안 켜진다 — 손으로 고정한 권장이 상주보다 작을 때 */}
      {perm.tokens >= t.ctxCut ? (
        <Text wrap="wrap" color="yellow">
          {L(
            `컴팩트해도 남는 크기(상주)가 빨강 기준 ${fmtTokens(t.ctxCut)}보다 큽니다. 새 세션으로 옮기는 게 낫습니다.`,
            `What stays after compacting (resident) is above the red threshold ${fmtTokens(t.ctxCut)}. Moving to a new session is better.`,
          )}
        </Text>
      ) : null}
    </Box>
  ) : null

  // 컨텍스트 크기 · 막대 · 상주/대화는 타일로 묶는다(지금 볼 값). 막대는 타일 안쪽 폭에 맞춰 좁게
  const tilePx = Math.max(120, widthPx - TILE_PX)
  const ctxRows = [
    <Box key="c-head" columnGap={1}>
      <Text>{L('컨텍스트', 'Context')}</Text>
      <Text bold color={LEVEL_TEXT[level]}>{`${u.contextEstimated ? '~' : ''}${fmtTokens(u.contextTokens)}`}</Text>
      <Text dimColor>
        / {fmtTokens(u.window)} · {u.contextEstimated ? '~' : ''}{Math.round(ctxPercent)}%
      </Text>
    </Box>,
    u.contextEstimated ? emptyLine(ui, 'c-estimated', L('컴팩트 직후라 추정값입니다. 다음 요청 때 실제 크기를 잽니다.', 'Estimated right after a compact. The real size is measured at the next request.')) : null,
    ctxBar(
      ui,
      surface,
      ctxPercent,
      permParts,
      TALK_HEX,
      tilePx,
      perm
        ? L(
            `컨텍스트 ${Math.round(ctxPercent)}% — 상주 ${fmtTokens(perm.tokens)}${split ? `(기본 적재 ${fmtTokens(split.fixed)} + 컴팩트 요약 ${fmtTokens(split.summary)})` : ''} · 대화 ${fmtTokens(talk)}`,
            `Context ${Math.round(ctxPercent)}% — resident ${fmtTokens(perm.tokens)}${split ? ` (base load ${fmtTokens(split.fixed)} + compact summary ${fmtTokens(split.summary)})` : ''} · conversation ${fmtTokens(talk)}`,
          )
        : L(`컨텍스트 ${Math.round(ctxPercent)}%`, `Context ${Math.round(ctxPercent)}%`),
      [
        { percent: pctOf(t.ctxWarn), hex: LEVEL_HEX.warn },
        { percent: pctOf(t.ctxCut), hex: LEVEL_HEX.cut },
      ],
    ),
    // 눈금 이름 — 막대 위 노랑 · 빨강 선이 무엇인지 카드 안에 설명이 없었다. 눈금은 데스크톱 막대에만 있다.
    // 조각 사이는 칸 간격으로(데스크톱은 글 조각 앞뒤 공백을 지운다)
    surface === 'desktop' ? (
      <Box key="c-marks" columnGap={1} flexWrap="wrap">
        <Text color={LEVEL_HEX.warn}>┃</Text>
        <Text dimColor>{`${fmtTokens(t.ctxWarn)} ${t.isRange ? L('컴팩트하기 좋은 때', 'good time to compact') : L('미리 알림', 'heads-up')}`}</Text>
        <Text color={LEVEL_HEX.cut}>┃</Text>
        <Text dimColor>{`${fmtTokens(t.ctxCut)} ${t.isRange ? L('컴팩트 늦어짐', 'compact overdue') : L('컴팩트 권장', 'compact advised')}`}</Text>
      </Box>
    ) : null,
    permEl,
  ]
  const ctxTile = (
    <Box key="c-tile" flexDirection="column" {...TILE}>
      {ctxRows}
    </Box>
  )

  // 비용은 두 줄: 다음 요청(예측) · 세션 누적. "지난 질문" 줄은 바로 아래 질문별 비용 맨 위와 같은 값이라 뺐다(2026-10-11).
  // 요율 · 노력도 · 색 기준은 맨 아래 흐린 참고 줄로
  const costRows: unknown[] = []
  // 제목 줄에도 있지만 본문에도 — 펼쳐 볼 땐 다음 요청과 같은 줄 꼴로 견준다. 접으면 제목 줄만 남는다
  // 이름 칸(12칸)에 "이 세션 누적 비용" 이 안 들어가 두 줄로 꺾였다 — 카드 제목 줄엔 "이 세션 누적 비용" 그대로
  if (u.costUsd !== null) costRows.push(row(ui, 'k-total', L('누적 비용', 'Total cost'), fmtUsd(u.costUsd)))
  if (est.kind === 'warm') {
    const isLate = est.minsLeft !== null && est.minsLeft < t.cacheWarnMin
    costRows.push(
      row(
        ui,
        'k-call',
        L('다음 요청', 'Next request'),
        `~${fmtUsd(est.perCallUsd)}`,
        est.minsLeft === null ? (
          <Text dimColor>{L('캐시 남은 시간 모름', 'cache time left unknown')}</Text>
        ) : (
          <Text>
            <Text dimColor>{L('캐시 ', 'cache ')}</Text>
            <Text {...(isLate ? { color: 'yellow' } : {})}>{L(`${est.minsLeft}분 남음`, `${est.minsLeft}m left`)}</Text>
            <Text {...(isLate ? { color: 'red' } : { dimColor: true })}>{L(` · 넘기면 ~${fmtUsd(est.rewriteUsd)}`, ` · after that ~${fmtUsd(est.rewriteUsd)}`)}</Text>
          </Text>
        ),
        LEVEL_TEXT[level],
      ),
    )
  }
  if (est.kind === 'cold') {
    const c = inputs ? coldCompact(u.contextTokens, inputs, u.model) : null
    const win = c !== null && c.compactUsd < c.continueUsd
    costRows.push(
      row(
        ui,
        'k-cold',
        L('다음 요청', 'Next request'),
        `~${fmtUsd(est.rewriteUsd)}`,
        L(
          `${est.reason === 'model' ? `모델이 바뀌어(${switchText(u.switchedFrom, u.model)}) ` : '캐시가 만료돼 '}전체를 다시 씁니다${win ? `. 바로 컴팩트하면 ~${fmtUsd(c.compactUsd)}` : ''}`,
          `${est.reason === 'model' ? `Model switched (${switchText(u.switchedFrom, u.model)}), so it` : 'Cache expired, so it'} rewrites everything${win ? `. Compact now: ~${fmtUsd(c.compactUsd)}` : ''}`,
        ),
        'red',
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

  // 세션 누적은 제목 줄에 — 줄 하나로 두니 중요한데 눈에 안 띄었다. 질문별 비용의 "합" · 컴팩트의 "총 이득" 과 같은 자리.
  // "세션 누적" 만으론 무엇이 쌓인 건지 흐려 "이 세션 누적 비용"(괄호 없이 — 괄호면 덧붙인 말처럼 약해 보인다).
  // "API 정가 환산" 은 패널의 모든 금액에 걸리는 말이라 이 카드 제목 옆이 아니라 맨 아래 요율 줄로 옮겼다
  // 접으면 지금 값 하나(컨텍스트 크기, 수준 색)를 앞에 — 제목 줄 한 줄이 이 카드의 간략 보기
  const isFolded = fold !== undefined && !fold.isOpen
  const hint = (
    <Text>
      {isFolded ? <Text>{L('컨텍스트 ', 'Context ')}</Text> : null}
      {isFolded ? <Text bold color={LEVEL_TEXT[level]}>{`${u.contextEstimated ? '~' : ''}${fmtTokens(u.contextTokens)}`}</Text> : null}
      {isFolded && u.costUsd !== null ? <Text dimColor>{' · '}</Text> : null}
      {u.costUsd !== null ? <Text>{L('이 세션 누적 비용 ', 'Session total ')}</Text> : null}
      {u.costUsd !== null ? <Text bold>{fmtUsd(u.costUsd)}</Text> : null}
    </Text>
  )
  return section(ui, 's-now', nowTitle(), [ctxTile, costEl], hint, true, '🧠', fold)
}

export const nowTitle = () => L('컨텍스트 · 비용', 'Context · cost')

/**
 * 컴팩트 카드: 컴팩트 시점(상태 말 · 구간 안 위치 막대) → 지금 컴팩트하면(아낌 · 비용 · 본전) 한 줄 → 미룬 비용 한 줄 →
 * 흐름 그래프 · 컴팩트 효과.
 * "컴팩트할까?" 에 답하는 곳을 한 카드로 모았다 — 예전엔 컨텍스트 카드의 효율 줄 · 게이지 · 효과 목록이 흩어져 같은 판단을
 * 따로 말했다. 그래프 · 효과는 늘 펼쳐 둔다 — 카드째 접을 수 있어 따로 접는 버튼은 군더더기였다
 */
export function drawCompactCard(ui: Ui, parts: FlowParts, effEl: unknown, fold?: Fold) {
  const { Box, Text } = ui
  // 접으면 지금 값 하나(게이지 상태 말)를 앞에 — 제목 줄 한 줄이 이 카드의 간략 보기
  const state = fold !== undefined && !fold.isOpen ? parts.state : null
  return section(
    ui,
    's-compact',
    L('컴팩트', 'Compact'),
    [
      // 게이지 + 판단 한 줄 = "지금 컴팩트할까" — 타일로 묶어 아래 지난 기록(그래프 · 효과)과 가른다
      parts.gauge || effEl ? (
        <Box key="c-decide" flexDirection="column" {...TILE}>
          {parts.gauge}
          {effEl}
          {parts.gaugeNote}
        </Box>
      ) : null,
      ...parts.details,
    ],
    // 제목 줄엔 컴팩트로 아낀 돈(끝난 셈) — 카드 제목마다 그 카드의 돈 합. 지금 할지는 바로 아래 타일이 말한다
    parts.gain === null && state === null ? undefined : (
      <Text>
        {state ? <Text bold color={state.color}>{`● ${state.word}`}</Text> : null}
        {state && parts.gain !== null ? <Text dimColor>{' · '}</Text> : null}
        {parts.gain !== null ? (
          <Text bold color={parts.gain >= 0 ? 'green' : 'yellow'}>
            {L(`총 ${gainText(parts.gain)}`, `total ${gainText(parts.gain)}`)}
          </Text>
        ) : null}
      </Text>
    ),
    true,
    '🗜',
    fold,
  )
}

/** 맨 아래 흐린 참고 줄: 요율 · 노력도 · 색 기준. 판단엔 안 쓰고 숫자를 확인할 때만 본다 — 예전엔 비용 카드 한가운데 있었다 */
export function drawReference(ui: Ui, u: Usage | null, last: TurnSummary | null, nowMs: number) {
  const { Box, Text } = ui
  if (!u) return null
  const est = estimate(u.contextTokens, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom))
  if (est.kind === 'unpriced') return null
  const r = est.rates
  const n = (v: number) => (v < 1 ? v.toFixed(2) : String(v))
  return (
    <Box key="s-ref" flexDirection="column" marginTop={1} paddingX={1}>
      <Text dimColor wrap="wrap">
        {L(
          `금액은 모두 API 정가 환산입니다(토큰 × 공식 요율). ${r.label} 요율 $/MTok · 입력 ${n(r.input)} · 출력 ${n(r.output)} · 캐시 읽기 ${n(r.read)} · 쓰기 ${n(r.write1h)}(1시간)`,
          `All amounts are API list prices (tokens × official rates). ${r.label} rates $/MTok · input ${n(r.input)} · output ${n(r.output)} · cache read ${n(r.read)} · write ${n(r.write1h)} (1h)`,
        )}
      </Text>
      {/* 노력도는 요청당 값(컨텍스트 읽기)과 무관하고 출력 · 생각 토큰을 바꾼다 — 쉬는 동안엔 못 읽어 지난 질문 값 */}
      {last?.effort ? (
        <Text dimColor wrap="wrap">{L(`노력도 ${last.effort}(지난 질문): 출력과 생각 토큰이 달라져 질문 값에 영향을 줍니다.`, `Effort ${last.effort} (last question): it changes output and thinking tokens, which affects question cost.`)}</Text>
      ) : null}
      {legend(ui, 'k-legend')}
    </Box>
  )
}
