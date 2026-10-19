/**
 * 사용량 패널 짜기 — register 의 Pane 훅이 $ 로 읽은 값과 동작(act)을 받아 탭 줄 · 설정 견본 · 현황 본문을 짠다. 입력창 위 바(ui-bar
 * drawBar)와 같은 꼴: $ 는 import 너머로 못 넘겨(엔진) 읽기 · 동작 묶기는 register 에 남는다. 2026-10-19 register.tsx 공개본이 249.6 KB
 * (경고 240 KiB · 디렉터리 한도 256 KiB)라 떼어 냈다 — 읽는 순서 · 그린 트리는 떼어 내기 전 그대로(tools/snap-diff.mjs)
 */
import type { CompactInputs, CompactPhase, LiveTurn, Optimal, PaneMode, Settings, TurnSummary, UpdateState, Usage } from '../types'
import type { Flow } from './flow'
import { fmtTokens, fmtUsd, levelOf, thresholds, ttlOf } from './cost'
import { bandShowOf, isSlim, paneModeName, revealLabel, slimViewOf, viewOf } from './settings'
import { ctxNumText, modelCompareText } from './text'
import { CARD_INSET, gaugeEl, hoverTip, previewChip, segButton, segGroup } from './ui-common'
import type { Fold, Grid, Ui } from './ui-common'
import { drawBandPreview } from './ui-band'
import type { BandPreviewExtra, SpendShown } from './ui-band'
import { compactingBlock, decisionLine, drawAllSpend, drawCompactCard, drawEfficiency, drawFlow, drawHistory, drawNow, drawReference, drawSummary, liveBlock } from './ui-usage'
import type { AllSpendLine, Perm, Tally } from './ui-usage'
import { drawCompactTiming, updateButton } from './ui-settings'
import type { SettingsTab } from './ui-settings'
import { answerPreview, liveSample } from './ui-answer'
import { statusLineText } from './status-line'
import { L } from './i18n'

// ── 탭 줄 ──────────────────────────────────────────────────────

export type PaneHeadData = {
  u: Usage | null
  isSettings: boolean
  paneMode: PaneMode
  upd: UpdateState
  isDrawerOpen: boolean
  /** 설정 "애니메이션" */
  motion: boolean
  /** 컴팩트 끝 줄어듦(바 게이지와 같이) */
  shrink: { from: number; to: number } | null
  phase: CompactPhase
}

export type PaneHeadActions = { openTab: (which: 'main' | 'settings') => void; setMode: (mode: PaneMode) => void; toggleDrawer: () => void }

/** 탭 줄: 머리 게이지 · [현황 | 설정] · [보기 간단 | 자세히](현황) · 버전 버튼 */
export function drawPaneHead(ui: Ui, surface: string, d: PaneHeadData, act: PaneHeadActions) {
  const { Box } = ui
  // 탭: 고르기 버튼(pickButton — 고른 쪽 채움, 데스크톱은 ✓ 없이 · 터미널은 ✓). 흐림 차이만으론 지금 보는 쪽이 안 읽혔고,
  // ✓ 를 붙이니 고른 탭만 넓어져 옆 탭이 밀렸다(fb A4)
  // 탭 · 보기 = 묶음 버튼(고른 쪽 칩 · 나머지 plain 흐린 글 — 앱 탭 · 묶음 꼴)
  const tab = (key: string, label: string, isOn: boolean, onPress: () => void) => segButton(ui, `pane-${key}`, label, isOn, onPress)
  // B11(0.9.1): 패널 머리 게이지도 컴팩트 · 저장 중엔 진행 파랑으로 움직인다(그림 설명에 "컴팩트 중")
  const headBusy = d.phase === 'compacting' || d.phase === 'tidying'
  const u = d.u
  return (
    <Box key="pane-tabs" columnGap={2} rowGap={1} flexWrap="wrap" alignItems="center">
      {/* 0.5 묶음 2: 탭 줄 머리에 게이지(고리 18px — 패널 이름 "이지 컴팩트" 의 상징, 데스크톱만. 0.6.0 실물: 앱 컨텍스트 고리 꼴, 바늘 뺌). 첫 탭 이름 "사용량" → "현황"
          (N13 — 담긴 것이 이 세션 · 질문별 비용 · 컴팩트 시점 · 흐름 · 효과라 사용량보다 넓다), 탭은 이모지 없이 붙은 두 칸(앱 탭 꼴 — N20) */}
      <Box key="pane-tab-group" columnGap={1} flexShrink={0} alignItems="center">
        {(() => {
          // 컴팩트 끝 줄어듦은 바 게이지와 같이 — 그동안 뒤 크기로 고정
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
      {/* 사용량 탭에서 바로 간단 ⇄ 자세히 — 이 세션 보기만(기본은 설정 탭 "화면" 값, 프리셋은 세부를 못 바꾼다).
          상위 탭과 한 단계 아래로 보이게 "보기" 이름 + 붙은 두 칸, 탭 줄 오른쪽 끝 — 좁으면 아래 줄 오른쪽(2026-10-14 uxi 안 A).
          둥근 테두리 묶음은 데스크톱에서 위아래 한 줄씩 더 먹어(바 창 버튼에서 겪음) 테두리 없이 간격 0 */}
      {/* 오른쪽 끝: [보기 간단|자세히](현황) · 버전 버튼(U4 — 0.9.1 U5 부터 개발본도 늘) */}
      <Box key="pane-mode" columnGap={1} alignItems="center" flexGrow={1} justifyContent="flex-end" flexWrap="wrap">
        {d.isSettings ? null : <ui.Text dimColor>{L('보기', 'View')}</ui.Text>}
        {d.isSettings
          ? null
          : segGroup(ui, 'pane-mode-pair', [
              tab('simple', paneModeName('simple'), d.paneMode === 'simple', () => act.setMode('simple')),
              tab('detail', paneModeName('detail'), d.paneMode === 'detail', () => act.setMode('detail')),
            ])}
        {updateButton(ui, d.upd, d.isDrawerOpen, act.toggleDrawer)}
      </Box>
    </Box>
  )
}

// ── 설정 탭 견본 ───────────────────────────────────────────────

export type PreviewData = {
  setTab: SettingsTab
  s: Settings
  /** 이 세션 값(없으면 견본은 예시 값 — 풀이 글이 갈린다) */
  u: Usage | null
  pvU: Usage
  pvTurn: TurnSummary
  /** 끝난 질문이 없어 예시 질문인가 */
  isSample: boolean
  nowMs: number
  inputs: CompactInputs | null
  spend: SpendShown | null
  cols: number
  /** 입력창 아래 한 줄 견본의 단계(바 탭 · 그 옵션 켬 · 슬림 아님일 때만 읽음) */
  phase: CompactPhase | null
  open: Record<string, boolean>
  isPreviewOpen: boolean
}

export type PreviewActions = { toggleFold: (key: string) => void; togglePreview: () => void }

/** S10 · S11(0.8.1): 미리보기는 탭에 맞는 것만 그린다 — 바 탭 = 바 전체 + 줄마다(한도 · 비용 · 질문), 답변 칩 탭 = 칩 견본 */
export function settingsPreviews(ui: Ui, surface: string, d: PreviewData, act: PreviewActions) {
  const { Box } = ui
  const isTerminal = surface === 'terminal'
  const sSet = d.s
  const pvU = d.pvU
  // 견본 바 안쪽 폭 = 패널 − 설정 카드(테두리 · 여백) − 견본 바 타일(테두리 · 여백): 터미널 10칸 · 데스크톱 약 7칸(테두리 1px)
  const pvBoxW = d.cols - (isTerminal ? 10 : 7)
  const pvBand = (part: 'all' | 'limits' | 'cost' | 'turn', extra: BandPreviewExtra = {}) =>
    drawBandPreview(ui, surface, pvU, d.nowMs, d.inputs, bandShowOf(sSet), sSet.sessionColors, d.pvTurn, viewOf(sSet).layout === 'one', d.spend, pvBoxW, part, extra)
  // S14(0.9.1 uxi 점검 — 옵션을 바꿔도 견본이 그대로였다): 바 크기 한 줄 · 접어 두기 · 입력창 아래 한 줄도 바 전체 견본에
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
  // 미리보기 제목 "?" 도 누르면 아래에 풀이(S5 — 모든 "?" 같은 동작, 터미널은 [ ? ])
  const openSet = d.open
  return d.setTab === 'bar'
    ? {
        // S13(0.9.1): "바 — 입력창 위" 제목 줄 → 견본 틀 안 "미리보기 · 입력창 위" 칩(+ "?"), 견본은 입력창 모형 위 무대(데스크톱)
        bar: (
          <Box key="pv" flexDirection="column">
            {pvBand('all', {
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
              // 1.0 슬림이면 견본도 슬림 두 장면(평소 아래 버튼 · 컴팩트할 때 위 알림)
              ...(isSlim(sSet) ? { slim: slimViewOf(sSet) } : {}),
              foldedLabel: sSet.bandFolded && !isSlim(sSet) ? revealLabel(false, pvLevel, pvU.contextTokens > 0 ? ctxNumText(pvU.contextTokens, pvU.window, sSet.ctxUnit) : null) : null,
              statusLine: pvStatus,
              live: slimViewOf(sSet).spin === 'off' ? null : liveSample(ui, d.pvTurn, viewOf(sSet).info === 'full', surface, isSlim(sSet)),
            })}
          </Box>
        ),
        // 슬림은 한도 · 비용 · 질문 줄 카드가 없다(ui-settings barTab)
        limits: isSlim(sSet) ? null : pvBand('limits'),
        cost: isSlim(sSet) ? null : pvBand('cost'),
        turn: isSlim(sSet) ? null : pvBand('turn'),
        chip: null,
      }
    : d.setTab === 'chip'
      ? {
          bar: null,
          limits: null,
          cost: null,
          turn: null,
          chip: answerPreview(ui, d.pvTurn, d.isSample, viewOf(sSet).info === 'full', surface, d.isPreviewOpen, sSet.questionHover, openSet['desc-pv-answer-tip'] === true, { toggleTip: () => act.toggleFold('desc-pv-answer-tip'), toggleOpen: act.togglePreview }),
        }
      : null
}

// ── 현황 탭 본문 ───────────────────────────────────────────────

export type PaneMainData = {
  u: Usage | null
  sums: readonly TurnSummary[]
  nowMs: number
  /** 도는 질문 */
  now: LiveTurn | null
  phase: CompactPhase
  kind: string
  /** 질문 내역 보기(간략 = summary) */
  detail: 'summary' | 'steps'
  tally: Tally
  /** [글 다 보기] 로 편 질문들 */
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
  /** 이지 오토가 일하는 중이면 그 구간(크기별 비용 표 그 줄에 "오토") */
  autoBand: { start: number; end: number } | null
  /** 보이는 보기(간단 · 자세히) */
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
  /** 컴팩트 시점 고르기 저장 */
  save: (chosen: Settings) => void
  sizeError: (msg: string | null) => void
  toggleFold: (key: string) => void
}

/**
 * 현황 = 위에서부터: 컨텍스트 · 비용(다섯 줄 남짓, 자리 고정) → 질문별 비용(맨 위 진행 중 질문) → 컴팩트(게이지 · 판단 · 접힌 그래프) →
 * 참고(요율 · 색 기준). 예전엔 진행 중 질문이 맨 아래라 안 보였다. 컴팩트 카드는 아래로 내려가도 된다 — 띠의 컴팩트
 * 버튼이 🟡/🔴 로 이미 알린다
 */
export function drawPaneMain(ui: Ui, surface: string, d: PaneMainData, act: PaneMainActions) {
  const { Box } = ui
  const { u, nowMs, opt, perm, cols, g } = d
  const allSums = d.sums
  const nowTurn = d.now
  const phase = d.phase
  const inputsNow = d.inputs
  const isTerminal = surface === 'terminal'
  const qDetail = d.detail
  // 진행 중 질문은 보내자마자(첫 요청이 끝나기 전에도) — 첫 요청이 끝나야 보이면 도구 없이 한 번에 끝나는 질문은
  // 끝날 때까지 안 보였다(2026-10-11 CLI)
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
  // 판단 한 줄은 컴팩트 카드 안 타일(c-decide) 안 — 폭 = 패널 − 카드 − 타일
  const effEl = u && inputsNow ? drawEfficiency(ui, u, allSums, nowMs, perm ? { ...inputsNow, after: perm.tokens } : inputsNow, cols - CARD_INSET * 2) : null
  // 카드 접기(간략 보기): 접으면 제목 줄의 요약만. 세션마다 따로 기억
  const foldOf = (which: 'now' | 'history' | 'compact'): Fold => ({ isOpen: d.cardsOpen[which], onToggle: () => act.toggleCard(which) })
  const liveNote =
    nowTurn
      ? { text: L(`진행 중 ${fmtUsd(nowTurn.cost.usd)}`, `running ${fmtUsd(nowTurn.cost.usd)}`), isRunning: true }
      : phase === 'compacting'
        ? { text: L('컴팩트 중', 'compacting'), isRunning: false }
        : null
  const history = drawHistory({ setAll: act.setHistoryAll, toggle: act.toggleExpanded, isFull: id => d.fullIds.includes(id), toggleFull: act.toggleFull }, ui, allSums, nowMs, d.expanded, d.historyAll, liveEl, cols - CARD_INSET, g, foldOf('history'), liveNote, qDetail, !isTerminal && d.s.questionHover, d.tally, qDetail === 'steps')
  // 같은 질문들을 다른 모델 요율로(9c) — 간략은 비용 요약 안, 자세히는 컨텍스트 · 비용 카드 안
  const modelLine = u ? modelCompareText(allSums, u.model, ttlOf(u)) : null
  // 세션 금액 색 기준은 화면 값(바와 같은 색)
  const sPane = d.s
  const colors = sPane.sessionColors
  // 컴팩트 시점(0.6.0 — 설정 탭에서 옮김, 사용자 "현황에 넣는 정보가 맞아 보임"): 간단 = 드롭다운 한 줄, 자세히 = 풀이 · 전체 구간 표
  const timingAct = {
    save: act.save,
    sizeError: act.sizeError,
    // O1(0.6.1 피드백): 현황 "?" 도 누르면 줄 아래 풀이 — 펼침 값은 설정 탭과 같은 곳(패널을 닫으면 처음대로)
    toggle: act.toggleFold,
  }
  const timingEl = (mode: 'simple' | 'detail') =>
    drawCompactTiming(timingAct, ui, sPane, opt, u?.contextTokens ?? null, surface, cols - CARD_INSET, { ttl: ttlOf(u), measured: u?.cacheTtlMeasured === true, config: null }, mode, d.timingErr, d.open, d.autoBand)
  // 간단(12): 이 세션 카드(누적 · 질문 · 메인/🤖/⚙ · "지금" 결정 줄 하나) + 질문별 비용. 자세히: 지금까지의 패널 전부.
  // "지금" 은 결정 줄 하나(상태 + 숫자 하나 + 할 일) — 예전엔 바 비용 줄을 옮긴 줄과 컴팩트 판단 줄이 따로라 같은 판단을 두 번
  // 읽었다(2026-10-14 uxi D6). 간단엔 모델 견줌 줄을 안 붙인다(정보 최소), 자세히의 이 세션 카드에
  // 업데이트 알림 카드 둘(업데이트 뒤 첫 실행 · 새 판)은 뺐다 — 탭 줄 업데이트 버튼 · 서랍이 맡는다(U4, 0.6.1 피드백 "늘 내용이 보이면 불편")
  const allEl = drawAllSpend(ui, d.allLine)
  return d.mode === 'simple' ? (
    <Box flexDirection="column">
      {allEl}
      {drawSummary(ui, u, allSums, u ? decisionLine(ui, u, allSums, nowMs, inputsNow) : null, timingEl('simple'), null, foldOf('now'), colors, cols, d.tally)}
      {history}
    </Box>
  ) : (
    <Box flexDirection="column">
      {allEl}
      {drawNow(ui, surface, u, nowMs, d.widthPx, perm, inputsNow, foldOf('now'), modelLine, colors)}
      {history}
      {drawCompactCard(ui, flowParts, effEl, foldOf('compact'), timingEl('detail'))}
      {drawReference(ui, u, allSums.length > 0 ? allSums[allSums.length - 1]! : null, nowMs, d.rateSince)}
    </Box>
  )
}
