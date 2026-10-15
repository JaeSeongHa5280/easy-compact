/**
 * 입력창 위 바(AbovePrompt) 짜기 — 줄(한도 · 예상 · 지난 질문, ui-band.tsx)에 게이지(패널 문) · 컴팩트 버튼 · 창 버튼 · 확인 카드를 붙인다.
 * $ 를 받지 않는다(엔진은 $ 를 import 너머로 따라가지 않는다): register.tsx 의 AbovePrompt 훅이 $ 로 읽은 값(BarData)과 버튼 동작
 * 묶음(barActs → BarActions)을 넘긴다. register.tsx 가 디렉터리 파일 한도(256 KiB)에 붙어 훅에서 떼어 냈다(0.8.0 뒤)
 */
import type { CompactEvent, CompactInputs, CompactPhase, LiveTurn, PaneView, Settings, TurnSummary, Usage } from '../types'
import { average, coldFor, compactPayoff, estimateFor, fmtTokens, fmtUsd, isLittleToSave, LEVEL_HEX, LEVEL_TEXT, levelOf, thresholds } from './cost'
import { withIcon } from './glyph'
import { L } from './i18n'
import { bandShowOf, revealLabel, TIDY_IDS, tidySteps, tidyStyles } from './settings'
import { cellsOf, ctxNumText, fitCells, paneTitle, rangeNumText, textCh, widthOf } from './text'
import { directKeep } from './tidy'
import { drawLimitsLine, fitEstimateLine, fitLastTurnLine, minShowOf, setCtxUnit } from './ui-band'
import type { SpendShown } from './ui-band'
import { ACCENT, CH_PX, choiceControl, decoIcon, emptyLine, gaugeEl, gaugeShapeNow, nameColW, phaseLook, pulseDot } from './ui-common'
import { gaugeWidth } from './gauge'
import type { IconName, Ui } from './ui-common'

/** 바가 쓰는 훅 이벤트 몫 — 표면 · 답이 도는 중인가 · 바 폭(칸) · 바 높이 한도(줄) */
export type BarEvent = { surface: string; props: { isWorking: boolean; bodyColumns: number; maxRows: number } }

/** AbovePrompt 훅이 $ 로 읽어 넘기는 값(읽는 순서는 훅에 그대로) */
export type BarData = {
  sNow: Settings
  u: Usage | null
  view: PaneView | null
  /** 확인 카드가 열렸나 — 답이 도는 중엔 늘 false */
  isConfirming: boolean
  nowMs: number
  sums: readonly TurnSummary[]
  /** 답이 도는 중의 진행 질문 */
  now: LiveTurn | null
  /** 컴팩트 직후 크기 · 입력 몫 등 계산식 재료(measureOptimal) — 모르면 null */
  inputs: CompactInputs | null
  phase: CompactPhase
  /** 도는 컴팩트의 이름(compactKind) */
  kind: string
  /** 방금 컴팩트함(컴팩트 뒤 첫 요청 전)이면 그 컴팩트 */
  just: CompactEvent | null
  /** 컴팩트 끝 게이지 줄어듦(shrinkNow) */
  shrink: { from: number; to: number } | null
  spendNow: SpendShown | null
}

/** 바 버튼 동작 — register.tsx barActs 가 $ 로 묶어 넘긴다. 약속을 돌려줘 누른 일이 끝날 때까지 기다릴 수 있다(옮기기 전과 같다) */
export type BarActions = {
  toggleView: (view: PaneView) => Promise<unknown>
  openConfirm: () => Promise<unknown>
  closeConfirm: () => Promise<unknown>
  /** 저장 중의 [취소] */
  cancelTidy: () => Promise<unknown>
  tidyThenCompact: () => Promise<unknown>
  compactNow: (keep: string) => Promise<unknown>
  /** 확인 카드 [클리어] — /clear(0.8.1 B9) */
  clearNow: () => Promise<unknown>
  /** 확인 카드에서 문구 고르기 — 설정 값이 바뀐다(모든 세션) */
  pickTidy: (id: string) => Promise<unknown>
  /** 크기 버튼(— / □): 열린 확인창은 닫고 바꾼다 */
  setBand: (band: Settings['band']) => Promise<unknown>
  /** 창 버튼 ✕ */
  foldBand: () => Promise<unknown>
}

/** 바 하나(최소 = 한 줄, 최대 = 한도 · 비용 · 지난 질문 줄 + 확인 카드) */
export function drawBar(ui: Ui, e: BarEvent, d: BarData, act: BarActions) {
  const { Box, Button, Text } = ui
  const { sNow, u, view, isConfirming, nowMs, sums, now, inputs, phase, kind, just, shrink, spendNow } = d
  // 버튼엔 크기를 안 붙인다 — 바로 왼쪽 줄에 컨텍스트 · 컴팩트 구간이 있다. 이름은 mod 이름 "이지 컴팩트":
  // 띠에 mod 이름이 따로 없고, 앱 기본 컴팩트(진행 글 "클로드 기본 compact")와 갈린다
  // 0.5 묶음 2(N10): 쉬는 때 이름도 "컴팩트" — 한 줄 바의 "컴팩트" 통일이 좋다(동료 s09), mod 이름은 옆 게이지 · 패널 이름이 말한다
  const compactCore = L('컴팩트', 'Compact')
  // 바의 🗜 는 컴팩트 단계 색과 상관없이 진한 파랑(BRAND_HEX) 글자로, 버튼 · 진행 글 밖에 따로 둔다. 🗜 는 글자처럼 그려지는 기호라 감싼
  // 글의 색을 따라가 평소 흰색 · 답 도는 중 회색 · 컴팩트 중 청록 · 저장 중 노랑 · 확인창 파랑으로 바뀌었다 — 상태에
  // 영향 받지 않게 파랑. 상태는 깜빡이는 점 · 버튼 글 · 강조 버튼으로만 — 버튼 이름의 🟡 · 🔴 · 🧊 · 🔄 도 뺐다(🗜
  // 와 그림 둘이 붙는다). 아이콘은 버튼 밖. 터미널은 아이콘 없이. 답 도는 중엔 누를 수 없으니 색 없이 흐리게(offIcon) —
  // 비활성이면 색이 없어야 맞다. 저장 · 컴팩트 중은 이지 컴팩트가 하는 일이라 파랑 그대로
  // 2026-10-14: 이모지 🗜 → 캡슐 꼴 Svg(uxi 아이콘 안 A — 한 그림체), 쉬는 상태는 회색 #9aa0a8. 터미널은 아이콘 없이(그대로)
  // 0.5 묶음 2: 캡슐 아이콘 → 게이지(채움 16px, 확정 규격) — brandIcon · offIcon 은 아래 판단(isNotNow 등) 뒤에서 만든다
  // 띠 크기(창 상태): 최대 = 세 줄, 최소 = 한 줄(이 세션 · 요청당 · 컨텍스트 · 컴팩트 구간). 칸은 화면 값(프리셋 · 커스텀)이 정한다.
  // 최대가 이미 한 줄이면(한도 줄 · 질문 줄 없음 — 간단 등) 최소와 같은 것: 최소여도 최대 한 줄을 그리고 [—] 를 뺀다. 예전엔
  // 최소가 줄은 그대로 캐시 칸만 빼 "캐시 보이기 · 안 보이기" 처럼 동작했다
  // 간단 화면은 한 줄 고정 — 한도 줄을 그리지 않고 [—] 도 없다
  const isLean = sNow.screen === 'simple'
  const fullShow = bandShowOf(sNow)
  const hasLimitsRow = !isLean && (u?.rateLimits ?? []).some(r => (r.kind === 'five_hour' ? fullShow.fiveHour : r.kind === 'seven_day' ? fullShow.sevenDay : true))
  const isOneRow = isLean || (!hasLimitsRow && !fullShow.lastTurn)
  const mode = isOneRow ? 'full' : sNow.band
  const show = mode === 'full' ? fullShow : minShowOf(fullShow)

  // 왼쪽 = 비용 영역(두 줄), 오른쪽 = 버튼 영역. 둘 사이에 세로줄을 둔다
  // 쉬는 동안 캐시가 식었거나 모델을 바꿨으면(다음 요청이 전체를 다시 씀) 지난 질문 줄은 숨긴다 — "캐시 만료 · 재작성"
  // 줄과 지난 질문의 "캐시 다시 씀" 이 같이 보여 어느 게 지금 일인지 헷갈렸다. 지난 질문 값은 사용량 패널에 있다.
  // 컴팩트 뒤 첫 요청 전도 같다 — 컴팩트 전 저장 턴의 "캐시 다시 씀" 이 지금 일처럼 읽혔다
  const lineEst = u && !e.props.isWorking ? estimateFor(u, nowMs) : null
  const showLastLine = !(mode !== 'full' || !show.lastTurn || lineEst?.kind === 'cold' || u?.isAfterCompact)
  // 컴팩트 직후 크기 · 입력 몫 등 계산식 재료(measureOptimal) — 식은 캐시 줄 · 버튼 판단 · 확인창이 같은 값을 쓴다.
  // 모르면(직후 크기를 못 잼) 컴팩트 손익을 안 보인다
  const afterTokens = inputs?.after ?? u?.contextTokens ?? 0

  // 버튼: 패널(세션 트리 · 사용량)은 맨 윗줄 오른쪽, 컴팩트는 비용 줄 오른쪽. 확인은 띠 아래 한 덩어리로 펼친다
  const level = u ? levelOf(u.contextTokens) : 'ok'
  const look = phaseLook(phase, kind, false)
  const est = u ? estimateFor(u, nowMs) : null
  // 캐시가 없는 까닭: 60분 지나 만료 · 모델을 바꿔 새 모델엔 없음 — 버튼 · 확인창 글만 다르고 셈은 같다
  const isSwitched = est?.kind === 'cold' && est.reason === 'model'
  // 캐시가 식었고 바로 컴팩트가 그냥 이어 가기보다 싸면 버튼을 "바로 컴팩트 권장" 으로(정리 단계 없이)
  const cold = u && inputs && est?.kind === 'cold' ? coldFor(u, inputs) : null
  const isColdWin = cold !== null && cold.compactUsd < cold.continueUsd
  // 캐시가 식었는데 바로 컴팩트가 이어 가기보다 비싼 크기면 권장 · 강조를 띄우지 않는다(정리 후 컴팩트는 정리 질문이
  // 전체를 다시 써 더 비싸다). 줄인 만큼은 그 뒤 요청들에서 천천히 돌아올 뿐이다
  const shownLevel = est?.kind === 'cold' && !isColdWin ? 'ok' : level
  const pulse = (hex: string, alt: string) => pulseDot(ui, e.surface, hex, alt)
  // 마우스를 올리면 버튼 바로 왼쪽에 설명 칩: 엔진 문서의 꼴 그대로 — 키 있는 상자(버튼을 감싼다) 안에 display none 인
  // absolute 칸을 두고 hover 에 display flex. 칩엔 키를 주지 않는다(키가 있으면 칩 자신이 hover 범위가 돼 안 드러난다).
  // 처음엔 버튼 hover scope 로 다른 칸을 켜게 했는데 데스크톱에서 안 떴다. absolute 라 줄이 안 밀리고, 바탕색으로
  // 아래 글을 가린다. key 엔 버튼 상태를 붙인다(…-open · …-on 등) — 눌러서 패널이 열리고 닫혀 바 폭이 바뀌면 마우스가
  // 떠나도 칩이 켜진 채 남았다. 상태가 바뀌면 상자가 새것이라 hover 가 안 남는다
  // 터미널엔 칩을 그리지 않는다 — 터미널도 포인터를 따라 hover 를 칠해, 밝은 칩이 버튼 위를 덮고 덮인 자리를 누르면 버튼이
  // 아니라 감싼 상자가 눌렸다. 터미널 버튼은 글이 상태를 말한다
  // B2(0.6.1 피드백 "바로 컴팩트 권장 툴팁이 떠 있으면 위의 ◔ 를 못 누름"): 칩 오른쪽 끝 = 감싼 상자 오른쪽에서 right 칸 — 작은 창
  // 버튼(◔ — ✕)은 4 면 그 왼쪽이지만 넓은 컴팩트 버튼은 버튼 위를 덮었고, 앱이 바 칩을 떠 있는 창으로 띄워 바로 위 줄 ◔ 까지 가렸다.
  // 컴팩트 자리는 게이지 + 버튼 폭만큼 밀어 버튼 밖 왼쪽에(위 줄 창 버튼 아래를 안 지난다). 여러 줄이면 줄마다(B1 — 첫 줄 컨텍스트 · 구간)
  const withTip = (key: string, button: unknown, text: string | readonly string[], right = 4) =>
    e.surface === 'terminal' ? (
      <Box key={key}>{button}</Box>
    ) : (
      <Box key={key}>
        {button}
        {/* 바탕은 앱 칩 것 — 반투명 promptBorder 바탕은 뒤 글이 비쳤다 */}
        <Box position="absolute" top={0} right={right} display="none" flexDirection="column" hover={{ display: 'flex' }}>
          {(typeof text === 'string' ? [text] : text).map((line, i) => (
            <Text key={`tip-${i}`} wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
    )
  // 컴팩트 시점(설정): 구간이면 시작부터 노랑 "컴팩트하기 좋은 때", 끝부터 빨강 "컴팩트 늦어짐" + 깜빡이는 점.
  // 직접 지정이면 그 80% 부터 노랑, 정한 크기부터 빨강 "컴팩트 권장"
  const isRange = thresholds().isRange === true
  // 손익(확인 카드와 같은 셈): 컴팩트로 요청 · 질문마다 얼마 아끼고 몇 번이면 본전인지
  const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  const pay = u && inputs && est?.kind === 'warm' ? compactPayoff(u.contextTokens, inputs, u.model, callsPerQ) : null
  // 아낄 게 거의 없음(본전 없음 · 줄어드는 몫이 작음) — 툴팁 · 카드 · 저장 프롬프트가 같은 판정
  const isLittle = pay !== null && u !== null && isLittleToSave(u.contextTokens, afterTokens, pay.breakEvenCalls)
  // 방금 컴팩트함(컴팩트 뒤 첫 요청 전): 권하지 않는 까닭 대신 얼마를 줄였고 얼마나 아끼는지 — 컴팩트 전 손익과 같은 셈(직전
  // 크기 → 직후 크기). 0.6.0 은 이 동안 컴팩트 전 크기로 "컴팩트 늦어짐" 을 띄웠다
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
                ? L(`질문마다 ~${fmtUsd(justPay.saveQuestionUsd)} 아낌`, `saves ~${fmtUsd(justPay.saveQuestionUsd)} per question`)
                : L(`요청마다 ~${fmtUsd(justPay.saveCallUsd)} 아낌`, `saves ~${fmtUsd(justPay.saveCallUsd)} per request`),
            ]
          : []),
      ].join(' · ')
    : null
  // 컴팩트를 권하지 않는 동안(구간 전 · 방금 컴팩트함 · 식었어도 컴팩트가 더 비쌈) 🗜 는 회색, 까닭은 툴팁으로 — 대부분의
  // 시간이 이 상태라 글을 붙이면 바가 늘 길어진다. 처음엔 버튼을 흐리게(dimColor) 했는데 데스크톱은 버튼 흐림을 안
  // 그렸다 — 버튼 밖 아이콘은 색이 먹는다. 버튼의 dimColor 는 터미널(아이콘 없음)에서 흐리게 보여 남긴다.
  // 눌러 확인창을 여는 건 그대로
  const isNotNow = shownLevel === 'ok' && !isColdWin
  const thr = thresholds()
  // 식었는데 바로 컴팩트가 더 비싸 권하지 않는 때는 그 까닭으로 — "아직 컴팩트할 때가 아님 · 구간" 은 구간 안이어도 떠 카드의
  // "손해" 와 엇갈렸다
  // 바 비용 줄이 상태만 말해(uxi B1 안 A) 돈 숫자는 이 칩에 — 다음 요청 값(패널 · 확인 카드와 같은 말 "다음 요청 ~$")과 바로
  // 컴팩트와의 차이("덜 듦" · "더 듦" — 돈이 나가는 말은 "듦" 하나)
  const coldTip =
    est?.kind === 'cold' && !isColdWin
      ? cold
        ? L(
            `${isSwitched ? '모델 바뀜' : '캐시 만료'} · 다음 요청 ~${fmtUsd(cold.continueUsd)} · 기본 컴팩트하면 ~${fmtUsd(cold.compactUsd - cold.continueUsd)} 더 듦 — 그냥 이어 가는 편이 쌈`,
            `${isSwitched ? 'Model switched' : 'Cache expired'} · next request ~${fmtUsd(cold.continueUsd)} · a plain compact costs ~${fmtUsd(cold.compactUsd - cold.continueUsd)} more — continuing as is is cheaper`,
          )
        : L(
            `${isSwitched ? '모델 바뀜' : '캐시 만료'} · 다음 요청 ~${fmtUsd(est.rewriteUsd)} — 캐시를 다시 씀`,
            `${isSwitched ? 'Model switched' : 'Cache expired'} · next request ~${fmtUsd(est.rewriteUsd)} — it rewrites the cache`,
          )
      : null
  // 구간 숫자는 칩 첫 줄(ctxTip)이 늘 말한다 — 여기선 상태만
  const notNowTip =
    coldTip ??
    justTip ??
    (isLittle
      ? L('지금 컴팩트하면 손해 — 아낄 게 거의 없음(컨텍스트가 이미 작음)', 'Compacting now is a loss — little to save, the context is already small')
      : L('아직 컴팩트할 때가 아님', 'Not time to compact yet'))
  // B1(0.6.1 피드백 "호버 때 지금 걸린 컨텍스트 범위 값"): 게이지 · 컴팩트 버튼 칩 첫 줄 = 지금 컨텍스트 · 걸린 컴팩트 구간(숫자 꼴은 설정
  // — 크기 · % · 둘 다). 예전엔 노랑 · 빨강(가장 중요한 때)에 "누르면 컴팩트할까요?" 만이라 숫자가 없었고 게이지엔 칩이 없었다
  setCtxUnit(sNow.ctxUnit)
  const ctxTip = u
    ? thr.isRange
      ? L(`컨텍스트 ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · 컴팩트 구간 ${rangeNumText(thr, u.window, sNow.ctxUnit)}`, `Context ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · compact range ${rangeNumText(thr, u.window, sNow.ctxUnit)}`)
      : L(`컨텍스트 ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · 컴팩트 기준 ${rangeNumText(thr, u.window, sNow.ctxUnit)}`, `Context ${ctxNumText(u.contextTokens, u.window, sNow.ctxUnit)} · compact at ${rangeNumText(thr, u.window, sNow.ctxUnit)}`)
    : null
  // B5(0.7.0 피드백 "게이지 칩이 컴팩트 버튼 칩과 똑같아 헷갈림"): 숫자(컨텍스트 · 구간)는 게이지 칩(gaugeDoor)에만, 컴팩트 버튼 칩은
  // 지금 상태 · 할 일
  const tipLines = (state: string): string[] => [state]
  // 0.5 묶음 2: "컴팩트하기 좋은 때" → "컴팩트할 때"(노랑은 기회가 아니라 구간 경고 — 사용자 정정). 단일 크기도 버튼에 상태를
  // ("곧 컴팩트할 때" — 예전엔 칩에만 있고 버튼은 "이지 컴팩트" 라 구간 모드와 달랐다)
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
  // 식은 캐시에 바로 컴팩트가 쌀 때: 비용 줄 맨 앞이 이미 "캐시 만료" · "모델 바뀜" 을 말해 버튼은 할 일만(같은 말 두 번 없앰,
  // 2026-10-14 uxi B1 안 A). 얼마나 덜 드는지는 설명 칩 · 확인 카드 · 패널에
  const compactLabel = isColdWin ? L('기본 컴팩트 권장', 'Plain compact advised') : compactText
  // 게이지: 색 = 크기 단계(levelOf — 숫자와 같은 순간), 깜빡임 = 빨강 구간 + 권함 + 누를 수 있을 때만(일하는 중 · 확인창 열림 ·
  // 저장 · 컴팩트 중 · 식은 캐시 비권함 · 아낄 게 적음엔 색만 — 사용자 규칙 12). 깜빡이는 점은 뺐다(게이지가 맡는다)
  const canBlink = !e.props.isWorking && !isConfirming && phase !== 'tidying' && phase !== 'compacting' && !isNotNow && !isLittle && level === 'cut'
  const motion = sNow.motion !== 'reduce'
  const gaugeBox = (blink: boolean) => {
    const isBlink = blink && Boolean(u) && !shrink
    const el = gaugeEl(ui, e.surface, shrink ? shrink.to : (u?.contextTokens ?? 0), {
      key: 'compact-icon-svg',
      alt: u ? L(`컨텍스트 ${fmtTokens(u.contextTokens)}`, `Context ${fmtTokens(u.contextTokens)}`) : L('컨텍스트 아직 모름', 'Context not known yet'),
      px: 16,
      blink: isBlink,
      motion,
      // B6(0.7.0 피드백 "바를 최소 · 최대로 열 때마다 게이지가 깜빡"): 틀(샌드박스 iframe)은 움직일 때만(깜빡임 · 컴팩트 끝 줄어듦) —
      // 늘 틀이면 최소 ↔ 최대처럼 게이지가 다른 줄 · 다른 상자로 옮겨 갈 때 앱이 틀을 새로 띄워 빈칸이 번쩍였다. 가만히 있는 게이지는
      // 그림(img)이라 다시 그려도 바로 그려진다(패널 머리 게이지와 같은 규칙)
      live: motion && (isBlink || Boolean(shrink)),
      ...(shrink ? { fromCtx: shrink.from } : {}),
    })
    return el ? <Box key="compact-icon">{el}</Box> : null
  }
  const brandIcon = gaugeBox(canBlink)
  const offIcon = gaugeBox(false)
  const coldWinTip =
    isColdWin && cold
      ? L(
          `${isSwitched ? '모델 바뀜' : '캐시 만료'} · 다음 요청 ~${fmtUsd(cold.continueUsd)} · 기본 컴팩트하면 ~${fmtUsd(cold.continueUsd - cold.compactUsd)} 덜 듦`,
          `${isSwitched ? 'Model switched' : 'Cache expired'} · next request ~${fmtUsd(cold.continueUsd)} · a plain compact costs ~${fmtUsd(cold.continueUsd - cold.compactUsd)} less`,
        )
      : null
  // ── 폭 맞춤(2026-10-14 uxi D1 — 렌더러 보정 1칸 = 1ch): 줄마다 오른쪽 버튼 묶음 폭을 어림해 왼쪽 글 칸을 뺀다(비용 줄: 컴팩트
  // 구간 → 요청당 → 캐시 짧은 꼴, 질문 줄: 에이전트 → 요청 수). 그래도 이지 컴팩트가 붙은 줄이 넘치면 이름을 "컴팩트" 로 줄인다(B1
  // 안 A 좁음 — 상태는 점 색 · 설명 칩이 말한다). 넘치는 줄은 칸 사이에서만 꺾인다. 데스크톱 바 버튼 = 12px 글 · 좌우 6px(1.6칸),
  // 터미널 버튼 = "[ 이름 ]"(4칸 더)
  const W = e.props.bodyColumns
  const isTerm = e.surface === 'terminal'
  const btnW = (label: string) => (isTerm ? cellsOf(label) + 4 : Math.ceil((textCh(label) * 12) / 13 + 1.6))
  const txtW = (text: string) => widthOf(text, isTerm)
  // 게이지 칸 폭(칸) = 그림 폭 + 사이 한 칸 — 고리 · 세로 막대 16px = 4칸, 가로 · 칸 막대 26px = 5칸(B8)
  const gaugePx = gaugeWidth(gaugeShapeNow(), 16)
  const ICON_W = isTerm ? 0 : Math.ceil(gaugePx / CH_PX) + 1
  const shortLabel = L('컴팩트', 'Compact')
  const compactW = (label: string) =>
    phase === 'compacting' && look
      ? ICON_W + 2 + txtW(look.text)
      : phase === 'tidying' && look
        ? ICON_W + 2 + txtW(look.text) + 1 + btnW(L('취소', 'Cancel'))
        : e.props.isWorking
          ? ICON_W + txtW(isTerm ? `[ ${label} ]` : label)
          : isConfirming
            ? ICON_W + btnW(`${label} ▾`)
            : (phase === 'held' ? txtW(withIcon('⏸', L('보류됨', 'On hold'))) + 1 : 0) + ICON_W + btnW(label)
  // B5: 게이지를 그리는 표면(데스크톱)은 게이지가 패널 문 — 창 버튼 줄에 패널 버튼이 없다
  const hasGaugeDoor = !isTerm && offIcon !== null
  const controlsW = (isTerm ? btnW(view === 'usage' ? L('패널 ▾', 'Pane ▾') : L('패널 ▸', 'Pane ▸')) + 1 : hasGaugeDoor ? 0 : btnW('◔') + 1) + (isOneRow ? 0 : btnW('—') + 1) + btnW('✕')
  const hasLimitsLine = hasLimitsRow && u !== null
  // 질문 줄을 뺀 화면이면 이지 컴팩트는 비용 줄 오른쪽(아래 그리기와 같은 판단)
  const onCost = !show.lastTurn && (!hasLimitsLine || u === null || fitEstimateLine(ui, u, nowMs, show, sNow.sessionColors, mode !== 'full', null, spendNow).el !== null)
  const lastSum = sums.length > 0 ? sums[sums.length - 1]! : null
  const availOf = (right: number) => (right > 0 ? W - right - 2 : W)
  const layoutFor = (label: string) => {
    // 데스크톱 최소 바는 늘 짧은 [컴팩트](상태는 설명 칩)
    const cw = compactW(mode === 'min' && !isTerm ? shortLabel : label)
    // 비용 줄 오른쪽: 최소 바 = 이지 컴팩트 + 창 버튼, 한도 줄이 있으면 이지 컴팩트(질문 줄 없는 화면)뿐, 없으면 창 버튼(+ 이지 컴팩트)
    const costRight = mode === 'min' ? cw + 2 + controlsW : hasLimitsLine ? (onCost ? cw : 0) : onCost ? cw + 2 + controlsW : controlsW
    const cost = u ? fitEstimateLine(ui, u, nowMs, show, sNow.sessionColors, mode !== 'full', availOf(costRight), spendNow) : null
    const last = showLastLine ? fitLastTurnLine(ui, lastSum, now, availOf(onCost ? 0 : cw)) : null
    const isOver = onCost || mode === 'min' ? (cost?.over ?? false) : (last?.over ?? false)
    return { cost, last, isOver }
  }
  const longFit = layoutFor(compactLabel)
  // 터미널은 이름을 안 줄인다 — 게이지 · 설명 칩이 없어 "컴팩트할 때 · 늦어짐" 같은 상태를 이름만 말한다(0.6.0 CLI 확인: 캐시 칸이
  // 붙어 넘치자 "컴팩트" 로 줄어 상태가 안 보였다). 넘치는 비용 줄은 칸 사이에서 두 줄로 나뉜다(fitLine)
  const isShortLabel = longFit.isOver && compactLabel !== shortLabel && !isTerm
  const fit = isShortLabel ? layoutFor(shortLabel) : longFit
  const barLabel = isShortLabel ? shortLabel : compactLabel
  const estimateLine = u
    ? (fit.cost?.el ?? null)
    : emptyLine(ui, 'b-none', L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes'))
  const lastLine = fit.last?.el ?? null
  // 답 도는 중 자리: 버튼과 같은 이름을 흐리게(누를 수 없음) — 자리 폭이 끝난 뒤 버튼과 같다(원칙: 자리 고정). 예전 긴 흐린 글
  // "이지 컴팩트 · 답이 끝나면 누를 수 있음" 은 터미널에서 칸을 많이 먹고 끝나면 폭이 바뀌었다(2026-10-14 진단 T3).
  // 터미널은 버튼이 "[ 이름 ]" 로 그려져 같은 꼴 글로
  const busyTip = L('답이 끝나면 누를 수 있음', 'Available when the answer ends')
  // 칩 자리(B2): 이름 폭 + 1 만큼 왼쪽 — 감싼 상자 = 버튼(B5 부터 게이지는 제 칸 · 제 칩)
  const tipRight = (nameW: number) => nameW + 1
  // B5(0.7.0 피드백 "버튼이 복잡 · ◔ 가 작아 안 보임 · 게이지를 누르면 뭔가 열려야 할 것 같음"): 게이지 = 이지 컴팩트 패널 문 — 앱 입력창
  // 컨텍스트 고리를 누르면 내역이 뜨는 것과 같은 짝. 창 버튼 줄의 ◔ 는 뺐다(게이지와 닮은 동그라미가 다른 일을 했다). 그림(Svg)엔 누르기가
  // 없어 게이지 위에 plain 버튼을 겹친다(absolute — 그림 위에 칠해지고 누름은 버튼이 받는다). plain 은 label 을 글로 그린다(children 은
  // 안 그림) — 첫 실물에서 label "이지 컴팩트 패널 열기" 가 게이지 위에 글로 떠 컴팩트 버튼과 겹쳤다. 그래서 label =
  // 빈 점자 칸(U+2800) 하나 — 공백이 아니라 데스크톱이 안 지우고, 안 보인다. dimColor 도 준다: plain 만이면 데스크톱이 회색 버튼 바탕을
  // 그려 게이지가 "버튼 뒤에" 보였다(둘째 실물 캡처) — 예전 ◔(plain + dimColor)는 바탕이 없었다. 열린 동안 게이지 뒤 옅은 바탕도 같은
  // 꼴이라 뺐다(열림은 옆 패널이 보이고 칩이 "닫기" 라 말한다). 무엇인지는 칩이 말한다: 지금 컨텍스트 · 걸린 구간 / 누르면 패널 열기 ·
  // 닫기. 그림을 못 그리는 표면(터미널 등)은 게이지가 없어 창 버튼 줄의 패널 버튼 그대로
  const isPaneOpen = view === 'usage'
  const doorTip = isPaneOpen ? L(`누르면 ${paneTitle()} 패널 닫기`, `Click to close the ${paneTitle()} pane`) : L(`누르면 ${paneTitle()} 패널 열기`, `Click to open the ${paneTitle()} pane`)
  const gaugeDoor = (icon: unknown) =>
    icon === null || e.surface === 'terminal'
      ? icon
      : withTip(
          `band-gauge-${isPaneOpen ? 'open' : 'closed'}`,
          <Box key="gauge-door">
            {icon}
            <Box position="absolute" top={0} left={0}>
              {/* \ub204\ub974\ub294 \uc790\ub9ac = \uac8c\uc774\uc9c0 \ud3ed \u2014 \ub113\uc740 \uaf34(\uac00\ub85c \u00b7 \uce78 \ub9c9\ub300 26px)\uc740 \ube48 \uce78 \ub458(B8) */}
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
      // B5: 게이지는 제 칸(패널 문 · 제 칩) — 답이 도는 동안에도 패널을 열 수 있다
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(icon)}
        {withTip('band-compact-box-busy', <Text dimColor>{name}</Text>, tipLines(busyTip), tipRight(txtW(name)))}
      </Box>
    )
  // 진행 중엔 버튼 대신 글자 — 눌러도 아무 일 없다
  const compactRow =
    phase === 'compacting' && look ? (
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(brandIcon)}
        {pulse(look.hex, L('컴팩트 중', 'Compacting'))}
        <Text color={look.color}>{look.text}</Text>
      </Box>
    ) : phase === 'tidying' && look ? (
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(brandIcon)}
        {pulse(look.hex, L('저장 중', 'Saving'))}
        <Text color={look.color}>{look.text}</Text>
        <Button key="compact-cancel" label={L('취소', 'Cancel')} variant="secondary" onPress={() => act.cancelTidy()} />
      </Box>
    ) : e.props.isWorking ? (
      // 턴이 도는 중엔 누를 수 없다(버튼이 아니라 글자) — 끝나면 버튼으로 돌아온다
      busyName(barLabel, offIcon)
    ) : isConfirming ? (
      // 확인창이 열린 자리를 다시 누르면 닫힌다(글자였을 땐 눌러도 반응이 없었다)
      // 아이콘은 버튼 밖 — 카드 제목 아이콘과 짝. 권하지 않는 동안 연 확인창이면 닫힌 바처럼 회색(회사 세션: 회색 🗜 를 눌렀더니 파랑으로
      // 바뀌어 권하는 것처럼 보였다). 0.5 묶음 2(N10): 열어도 이름 그대로 + ▾(아래 카드가 이 버튼의 것) — "이지 컴팩트 ✕" 는 이름이 바뀌고
      // ✕ 가 바로 위 창 버튼 ✕ 와 같아 닫기인지 무엇인지 헷갈렸다(동료 s09 · s10). 닫기는 다시 누르거나 카드의 [✕ 취소]
      <Box columnGap={1} alignItems="center">
        {gaugeDoor(isNotNow ? offIcon : brandIcon)}
        {withTip(
          'band-compact-box-open',
          <Button key="compact-close" label={`${barLabel} ▾`} {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })} onPress={() => act.closeConfirm()} />,
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
        {/* 권하지 않는 동안 게이지는 단계 색만(깜빡임 없음). B5(0.7.0 피드백): 게이지는 제 칸(패널 문 · 숫자 칩), 컴팩트 버튼은 제 칩 —
            0.7.0 B1 은 둘을 한 마우스 올림 칸으로 묶어 칩이 같았다(사용자 "똑같아서 혼란") */}
        {gaugeDoor(isNotNow ? offIcon : brandIcon)}
        {withTip(
          `band-compact-tip-${isNotNow ? 'not-now' : shownLevel}`,
          <Button
            key="compact"
            label={barLabel}
            {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
            onPress={() => act.openConfirm()}
          />,
          // 둘째 줄 = 지금 상태 · 할 일. 이름을 줄였으면 상태 말을 칩에("컴팩트 늦어짐 · 누르면 …")
          tipLines(
            isNotNow
              ? notNowTip
              : (coldWinTip ?? (isShortLabel ? `${compactLabel} · ${L('누르면 컴팩트할까요?', 'press to open Compact now?')}` : L('누르면 컴팩트할까요?', 'Press to open Compact now?'))),
          ),
          tipRight(btnW(barLabel)),
        )}
      </Box>
    )

  // 확인창은 대화상자 꼴: 위에 선택지마다 "이름 · 하는 일"(한 줄에 들게 짧게), 맨 아래 오른쪽에 버튼.
  // 0.8.1 B9: 보통 = [▶ 이지 컴팩트] [클리어] [✕ 취소],
  // 식은 캐시(만료 · 모델 바뀜) = [▶ 기본 컴팩트] [클리어] [✕ 취소] — 저장 질문(문구 고르기)은 식은 캐시엔 전체를 다시 써 빼고, 기본
  // 컴팩트가 붙이는 /compact 뒤 글을 그대로 보인다. 기본 = Claude 의 /compact(이지 컴팩트와 짝 — "컴팩트" 만이면 바 버튼과 겹친다).
  // 버튼을 왼쪽에 세로로 두니 설명과 섞였고, 한 줄 왼쪽에 셋이면 탭처럼 읽혔다.
  // 띠에 여유가 있으면 줄 사이를 한 칸씩 띄운다(넘치면 띠가 스크롤된다)
  const tidyNow = tidySteps(sNow)
  // 띠 높이(maxRows)에서 남는 줄만큼 카드 안을 띄운다 — 넘치면 띠가 스크롤돼 버튼이 가려진다.
  // 기본 줄 수 = 띠 두 줄(+ 한도 줄) + 테두리 2 + 제목 + 효과 줄 + 문구 고르기 + 선택지 2 + 버튼, 좁으면 효과 줄 · 문구 고르기 ·
  // 선택지가 줄바꿈된다.
  // 띄우는 순서: 효과 줄 아래 → 효과 줄 위 → 버튼 위
  const isWide = e.props.bodyColumns >= 115
  // 한도 줄: 구독 세션만(엔진이 API 키 세션엔 한도를 안 준다), 5시간 · 7일을 다 빼도 없다 — 없으면 비용 줄이 맨 윗줄로 오른다
  const limitsLine = hasLimitsRow && u ? drawLimitsLine(ui, e.surface, u, nowMs, show) : null
  // 좁은 터미널이면 창 버튼을 한도 줄 위 따로 한 줄에(아래 그리기)
  const isNarrowTerminal = e.surface === 'terminal' && e.props.bodyColumns < 100
  const baseRows = (limitsLine ? (isNarrowTerminal ? 4 : 3) : 2) + 2 + 1 + (isWide ? 1 : 2) + (isWide ? 1 : 2) + (isWide ? 2 : 4) + 1
  // 데스크톱 띠는 maxRows 보다 넉넉히 그린다(12줄 확인창도 잘리지 않았다) — 계산대로면 늘 0 이하라 띄우기가 꺼져 있었다
  const spare = e.surface === 'desktop' ? 3 : e.props.maxRows - baseRows
  const gapBelowSummary = spare >= 1 ? 1 : 0
  const gapAboveSummary = spare >= 2 ? 1 : 0
  const gapAboveActions = spare >= 3 ? 1 : 0
  // T2(0.7.0 피드백 "CLI 에서 바로 컴팩트는 Enter 를 쳐도 반응 없음" — PTY 로 0.7.0 CLI 재현: 초점이 문구 드롭다운에 들어가면 목록이 열리고
  // ↓↑ 는 항목만 돌고 ←→ 는 안 먹어 아래 버튼에 못 갔다 · Enter = 항목 고르기. 화면은 "저장하고 컴팩트 / 바로 컴팩트" 두 줄 메뉴처럼 보였다.
  // Tab 으로 버튼까지 가면 /compact 는 돈다): 드롭다운은 T1 로 가로 버튼, 터미널 버튼엔 숫자 단축키(1 저장하고 컴팩트 · 2 바로 컴팩트 ·
  // 3 취소 — 엔진: 띠에 초점이 없어도 빈 입력창에서 숫자만 치면 눌림)를 달고 버튼 · 줄 이름 앞에 그 숫자. 데스크톱은 그대로(빈 입력창
  // 숫자가 버튼을 누르면 놀란다)
  const isTermCard = e.surface === 'terminal'
  const keyOf = (digit: string) => (isTermCard ? { hotkey: digit } : {})
  const numbered = (digit: string, text: string) => (isTermCard ? `${digit} ${text}` : text)
  // 선택지 이름 칸 = 가장 긴 이름 + 1 — 예전 16칸 고정은 데스크톱에서 넉넉히 비었다(1칸 = 1ch, 2026-10-14 보정)
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
  // 알림 카드: 제목(파랑) / 무엇이 얼마나 · 얼마 / 선택지 / 버튼 — 덩어리마다 한 칸 띄우고, 본문은 제목 아래로
  // 들여 쓴다(가운데 정렬은 긴 줄이 줄바꿈될 때 시작이 들쭉날쭉해 훑기 어렵다). 테두리는 흐린 회색이 잘 안 보여
  // 제목과 같은 파랑(테마 색 suggestion — 밝은 · 어두운 테마 둘 다 맞춘다)
  // 제목은 흰색, 아이콘만 파랑 — 테두리와 이어지고 글은 잘 읽힌다. 권하지 않는 동안(isNotNow)은 아이콘도 바처럼 회색
  const card = (key: string, icon: IconName, title: string, summary: unknown, rows: unknown[], isColdFirst: boolean) => (
    // 간격 단계(2026-10-14 uxi 1.2): 카드 안쪽 여백 S1(1칸) · 본문 들여 S2(2칸) — 예전 2 · 3 은 다른 카드(1 · 1)와 달랐다
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={1}>
      {/* 아이콘과 글 사이는 공백 문자가 아니라 칸 간격 — 데스크톱은 글 조각 앞뒤 공백을(줄바꿈 없는 공백도) 잘라 붙어 보였다 */}
      <Box columnGap={1}>
        {/* 캡슐 꼴 Svg — 권하면 파랑, 권하지 않는 동안 회색(바의 🗜 와 짝) */}
        {(() => {
          // 0.5 묶음 2: 확인 카드 제목 아이콘은 모두 게이지(바와 짝 · 움직임 없음) — 캐시 만료 · 모델 바뀜 카드의 옛 캡슐 아이콘은 뜻이 약했다
          //. 상태는 제목 글이 말한다
          const el =
            u
              ? gaugeEl(ui, e.surface, u.contextTokens, { key: 'card-icon-svg', alt: title, px: 16, motion: false })
              : gaugeEl(ui, e.surface, 0, { key: 'card-icon-svg', alt: title, px: 16, motion: false })
          return el ? <Box key="card-icon">{el}</Box> : null
        })()}
        <Text bold>{title}</Text>
      </Box>
      <Box paddingLeft={2} marginTop={gapAboveSummary} marginBottom={gapBelowSummary}>
        {summary}
      </Box>
      <Box flexDirection="column" paddingLeft={2}>
        {rows}
      </Box>
      {actions(isColdFirst)}
    </Box>
  )
  // 버튼엔 크기 속성이 없다(높이는 앱이 정한다) — 굵은 글자와 양옆 여백으로 조금 크게 보인다.
  // 여백은 줄바꿈 없는 공백: 보통 공백은 데스크톱이 지워 버린다
  const pad = (text: string) => `\u00a0\u00a0${text}\u00a0\u00a0`
  const wide = (text: string) => <Text bold>{pad(text)}</Text>
  // 손해면(식었는데 바로 컴팩트가 이어 가기보다 비쌈 · 아낄 게 거의 없음) 컴팩트 버튼을 다 막고 "작업을 이어 가세요" 만 알린다.
  // 돈 판단은 mod 가 숫자로 한다 — 세션에 맡기면 정보 손실만 보고 진행했다. 바로 컴팩트도
  // 막는다: 버튼은 이득인 길을 쉽게 하는 것이고, 손해를 알고도 할 까닭이 있으면 /compact 를 직접 친다(카드에 적음).
  // 손익을 모르면(입력 값 없음) 막지 않는다
  const isLoss = (cold !== null && !isColdWin) || isLittle
  const actions = (isColdFirst: boolean) => (
    <Box key="actions" justifyContent="flex-end" alignItems="center" columnGap={2} marginTop={gapAboveActions}>
      {isLoss ? (
        // 닫기만 — 키는 취소와 같다(같은 일)
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
          <Button key="compact-clear" label={pad(numbered('2', L('클리어', 'Clear')))} variant="secondary" {...keyOf('2')} onPress={() => act.clearNow()}>
            {wide(numbered('2', L('클리어', 'Clear')))}
          </Button>,
          <Button key="compact-no" label={pad(numbered('3', L('✕ 취소', '✕ Cancel')))} variant="secondary" {...keyOf('3')} onPress={() => act.closeConfirm()}>
            {wide(numbered('3', L('✕ 취소', '✕ Cancel')))}
          </Button>,
        ]
      )}
    </Box>
  )
  // 손해일 때 카드 본문 — 버튼 대신 할 일만. 식은 캐시면 다음 질문 하나가 캐시를 다시 데운다(그 값은 위 줄에). /compact 직접
  // 입력은 막을 수 없지만 권하지도 않는다
  const keepRow = (isCold: boolean) => (
    <Box key="e-keep">
      <Text wrap="wrap">
        <Text bold color="success">
          {L('작업을 이어 가세요', 'Keep working')}
        </Text>
        <Text>
          {isCold
            ? L(' — 다음 질문이 캐시를 다시 데웁니다. 컴팩트할 때가 되면 바가 알려 줍니다.', ' — your next question warms the cache again. The bar tells you when it is time to compact.')
            : L(' — 지금은 아낄 게 거의 없습니다.', ' — there is little to save right now.')}
        </Text>
      </Text>
    </Box>
  )
  // 화면엔 두 줄만: 무엇을 얻나(질문당 아끼는 값) · 얼마 드나. 본전 · 요청당 값은 투머치였다. 손해인지는 mod 가
  // 정한다(isLoss) — 저장 프롬프트엔 손익을 넘기지 않는다(세션은 잃을 정보만 본다)
  const saves = pay !== null && pay.saveCallUsd > 0 && !isLittle
  // 한 줄: 효과(컨텍스트 전 → 후 · 아끼는 값) · 드는 값 — 띠 높이가 모자라 버튼이 잘렸다
  const costLine =
    pay && u ? (
      // 숫자만 색: 컨텍스트는 수준 색 → 줄어든 크기 초록, 아끼는 값 초록, 드는 값은 금액 기준 색. 글은 흐리게
      <Text wrap="wrap">
        <Text>{L('컨텍스트 ', 'Context ')}</Text>
        <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>
          {fmtTokens(u.contextTokens)}
        </Text>
        <Text dimColor> → </Text>
        <Text bold color="success">
          ~{fmtTokens(Math.min(afterTokens, u.contextTokens))}
        </Text>
        <Text dimColor>{' · '}</Text>
        {!saves ? (
          // 바 툴팁과 같은 판정 · 같은 색 — 아낄 게 없으면 지금 컴팩트는 손해(빨강)
          <Text bold color="error">{L('아낄 게 거의 없음 — 지금 컴팩트하면 손해', 'little to save — compacting now is a loss')}</Text>
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
  // 저장할 것은 여기서 바로 고른다 — 설정 탭에만 있으면 컴팩트할 때 어느 문구인지 안 보이고, 바꾸려면 탭을 오가야 했다
  //. 고르면 설정 값이 바뀐다 — 다음 컴팩트에도 그대로, 모든 세션 공통. 직접은 쓴 글이
  // 있을 때만(쓰기 · 고치기는 설정 탭). 누른 때의 설정 위에 — 그린 뒤 다른 세션이 바꿨을 수 있다
  const saveRow = () => (
    <Box key="e-save" columnGap={1}>
      <Box width={choiceW} flexShrink={0}>
        <Text bold>{numbered('1', L('이지 컴팩트', 'Easy Compact'))}</Text>
      </Box>
      <Text dimColor>:</Text>
      <Box flexDirection="column" flexShrink={1} minWidth={0}>
        {/* 0.5 묶음 2(N11): 문구를 눌러도 바뀌는 게 흐린 한 줄 속 몇 낱말뿐 · 식은 캐시 카드는 0 이라 무슨 효과인지 몰랐다(동료 s10) —
            고른 문구가 하는 일을 늘 두 줄로(저장 · 답 — 문구마다 다른 값을 굵게), 식은 캐시면 그 아래 비용 한 줄. 붙은 두 칸(묶음 버튼 꼴, N20).
            N19 안 1: 앞에 붙일 글이 있으면 한 줄 더 */}
        {/* R2: 문구 = 드롭다운(설정 탭과 같은 부품) — 고른 문구가 하는 일은 아래 두 줄. T1(0.7.0): 터미널은 가로 고르기 버튼 */}
        <Box key="e-save-pick" columnGap={1} alignItems="center" flexWrap="wrap">
          {choiceControl(
            ui,
            'pick-tidy',
            [
              ...TIDY_IDS.map(id => ({ value: id, label: tidyStyles()[id].name })),
              // 직접 쓰기는 쓴 글이 있거나 지금 고른 때만 — 카드에선 글을 못 쓴다(설정 탭의 두 칸)
              ...(sNow.tidy === 'custom' || sNow.tidyCustom !== '' || sNow.compactCustom !== '' ? [{ value: 'custom', label: L('직접 쓰기', 'Write my own') }] : []),
            ],
            sNow.tidy,
            v => act.pickTidy(v),
          )}
        </Box>
        {sNow.tidy === 'custom' ? (
          // 직접 쓰기: ① 컴팩트 전에 보낼 글 앞부분(비었으면 일반 문구)
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
  // 기본 컴팩트(식은 캐시 카드만): /compact 뒤에 붙는 글을 그대로 — 무엇을 붙이는지 보인다. 문구는 설정 ② 칸
  const directRow = explain(
    'e-direct',
    numbered('1', L('기본 컴팩트', 'Plain compact')),
    <Text>
      <Text bold>{L('/compact 뒤 글로 컴팩트합니다', 'Runs /compact with the text after it')}</Text>
      <Text dimColor> — </Text>
      <Text>{L(`「${directKeep(sNow)}」`, `"${directKeep(sNow)}"`)}</Text>
      <Text dimColor>
        {L(' · 저장 질문 없이(식은 캐시엔 저장 질문이 전체를 다시 써 더 비쌈) · 글은 설정 → 컴팩트 문구 ②', ' · no save question (on a cold cache it would rewrite everything first) · the text is Settings → Compact text ②')}
      </Text>
    </Text>,
  )
  // 클리어: /clear — 대화를 비우고 새로 시작(요약 없음). 식은 캐시면 돈도 안 든다
  const clearRow = (isCold: boolean) =>
    explain(
      'e-clear',
      numbered('2', L('클리어', 'Clear')),
      <Text>
        <Text bold>{L('대화를 비우고 새로 시작(/clear)', 'Start over with an empty conversation (/clear)')}</Text>
        <Text dimColor> — </Text>
        <Text>
          {isCold
            ? L('비용 없음 · 요약 없음', 'no cost · no summary')
            : L('요약 없음 · 아직 안 남긴 결정은 사라짐(남기려면 이지 컴팩트)', 'no summary · anything not saved yet is gone (Easy Compact saves first)')}
        </Text>
      </Text>,
    )
  // 캐시가 식었으면(만료 · 모델 바꿈) 손익과 상관없이 이 카드 — 주 버튼은 ▶ 기본 컴팩트, 저장 질문(이지 컴팩트)은 없다. 예전엔
  // 바로 컴팩트가 손해인 크기면 보통 카드(▶ 저장하고 컴팩트)를 띄워, 회사 세션에서 저장 질문이 전체를 다시 써 $0.43 이 들었다.
  // 손해면 그냥 이어 가는 편이 싸다고 적고, 컴팩트 버튼 대신 "작업을 이어 가세요"(isLoss — 위 actions · keepRow)
  const coldConfirm =
    est?.kind === 'cold' && u
      ? card(
          'confirm-cold',
          isSwitched ? 'switch' : 'cold',
          isSwitched
            ? isLoss
              ? L('모델을 바꿔 새 모델엔 캐시가 없습니다 — 지금은 컴팩트하지 마세요', 'You switched models and the new one has no cache — hold off on compacting')
              : L('모델을 바꿔 새 모델엔 캐시가 없습니다 — 기본 컴팩트할까요?', 'You switched models and the new one has no cache — do a plain compact?')
            : isLoss
              ? L('캐시가 만료됐습니다 — 지금은 컴팩트하지 마세요', 'The cache has expired — hold off on compacting')
              : L('캐시가 만료됐습니다 — 기본 컴팩트할까요?', 'The cache has expired — do a plain compact?'),
          <Text wrap="wrap">
            {/* 공통 앞부분을 쟀으면 그만큼은 읽기라 "전체" 가 아니다 — 다시 쓰는 크기를 같이(금액과 말이 맞게) */}
            <Text>{L('그냥 이어 가면 첫 요청이 ', (u.sharedTokens ?? 0) > 0 ? 'Continuing as is, the first request rewrites ' : 'Continuing as is, the first request rewrites all ')}</Text>
            <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>
              {fmtTokens(u.contextTokens)}
            </Text>
            <Text>
              {(u.sharedTokens ?? 0) > 0
                ? L(
                    ` 중 ~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} 를 다시 씀 `,
                    ` (~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} of it, the shared prefix is read) `,
                  )
                : L(' 전체를 다시 씀 ', ' ')}
            </Text>
            {/* 금액엔 색 없음, 차이에만 이득 초록 · 손해 빨강 — 띠 줄 · 보통 카드와 같은 규칙 */}
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
                      {L(`~${fmtUsd(cold.compactUsd - cold.continueUsd)} 손해`, `~${fmtUsd(cold.compactUsd - cold.continueUsd)} more`)}
                    </Text>
                    <Text>{L(' · 그냥 이어 가는 편이 쌈', ' · continuing as is is cheaper')}</Text>
                  </Text>
                )}
              </Text>
            )}
          </Text>,
          isLoss ? [keepRow(true)] : [directRow, clearRow(true)],
          true,
        )
      : null
  // 저장 내용은 컴팩트 문구(일반 · 긴 세션 이어가기 · 마무리 · 직접 쓴 글)를 따른다 — 이 카드에서도 고른다
  const confirm = !isConfirming ? null : (coldConfirm ??
      (isLoss
        ? // 0.5 묶음 2(N2 글 몫): 바는 크기로 "컴팩트 늦어짐" 인데 카드가 "컴팩트할 때가 아닙니다" 라 엇갈렸다 — 때가 아니라 손익을 말한다
          card('confirm', 'compact', L('지금 컴팩트하면 손해입니다', 'Compacting now would cost more than it saves'), costLine, [keepRow(false)], false)
        : card('confirm', 'compact', L('컴팩트할까요?', 'Compact now?'), costLine, [saveRow(), clearRow(false)], false)))
  // 패널 버튼: 버튼 하나에 상태와 동작을 같이 — 닫혀 있으면 "○○ 패널 ▸", 열려 있으면 "○○ 패널 열림 ✕".
  // "비용 닫기" 는 비용을 닫는 것처럼, 글자 + 작은 [닫기] 는 아래 컴팩트 버튼과 줄이 안 맞아 어색했다
  const panelButton = (key: PaneView, name: string) => (
    <Button
      key={key}
      // 터미널은 폭과 상관없이 짧게 — "사용량 패널 열림 ✕" 가 길어 최소 바의 왼쪽 글이 "이 세션…" 까지만 남았고(2026-10-13 CLI
      // 확인), 넓은 터미널에서도 버튼이 "[ 이름 ]" 로 4칸 더 먹어 비용 글을 짓눌렀다(2026-10-14 진단 T2). 열림은 옆 패널이 보인다
      label={view === key ? `${name} ▾` : `${name} ▸`}
      variant="secondary"
      onPress={async () => {
        await act.toggleView(key)
      }}
    />
  )
  // 바는 세 줄 격자: 1 = 한도 | 사용량 패널 · 창 버튼 묶음(⇲ 자동 숨김 · — 최소 / □ 최대 · ✕ 닫기), 2 = 요청당(식은 캐시)
  // 줄, 3 = 지난 질문 | 이지 컴팩트.
  // 왼쪽 글이 비어도(한도 없는 API 키 세션 · 식은 캐시라 지난 질문 숨김) 줄은 남아 버튼 자리가 늘 같다 — 버튼을 왼쪽 글
  // 덩어리의 세로 가운데에 두니 한도 줄이 넘어가거나 줄이 빠질 때마다 자리가 바뀌었고,
  // 패널 버튼과 컴팩트 버튼이 위아래로 붙어 누를 때 간섭했다. 같은 줄 가로로 붙여도 이지 컴팩트 옆이라 거슬렸다
  // — 패널 버튼은 윗줄 창 버튼 옆으로, 아랫줄엔 이지 컴팩트 하나.
  // 자동 숨김 · 크기 버튼은 창 제어 버튼처럼 아이콘 하나씩(⇲ · — 최소 / □ 최대) — 글 버튼 셋이 오른쪽 위에 몰려
  // 붐볐다.
  // 창 버튼에도 설명 칩(withTip — 위에 정의). 자동 숨김 ⇲ 는 뺐다 — ✕(접기)와 같아 보였다. 접힌 바가
  // 컴팩트할 때 저절로 펴질지는 설정의 "컴팩트할 때 자동으로 펴기"(기본 켬)
  const isAutoShown = sNow.bandFolded
  // 크기 버튼(맨 오른쪽 위): 최대 ↔ 최소. 안 보이기는 명령 · 설정 탭으로(바가 없을 때도 되게).
  // 바꾸면 열린 확인창은 닫는다(최소 바엔 자동 숨김이 아니면 확인창이 없다)
  const modeButton = withTip(`band-mode-box-${mode}`, (
    <Button
      key="band-mode"
      label={mode === 'full' ? '—' : '□'}
      plain
      dimColor
      onPress={() => act.setBand(mode === 'full' ? 'min' : 'full')}
    />
  ), mode === 'full' ? L('한 줄로 줄이기', 'Shrink to one line') : L('전체로 펴기', 'Expand to full'))
  // 접기(창 버튼의 ✕): 입력창 아래 [🔽 이지 컴팩트 ⇱] 로 접고(모든 세션) 다시 펴는 법을 토스트로. 저절로 펴진 바면 지금보다
  // 급해질 때까지 다시 접어 둔다(foldBand)
  const closeButton = withTip(`band-close-box-${isAutoShown ? 'auto' : 'open'}`, (
    <Button key="band-close" label="✕" variant="secondary" dimColor {...(e.surface === 'terminal' ? {} : { role: 'dismiss' as const })} onPress={async () => act.foldBand()} />
  ), isAutoShown
    ? L('다시 접기 · 더 급해지면(빨강 · 캐시 만료) 다시 펴짐', 'Fold again · reopens when more urgent (red · cache expired)')
    : L(`접기 · 다시 펴기: 입력창 아래 [${revealLabel(!sNow.bandAutoOpen)}]`, `Fold · reopen: [${revealLabel(!sNow.bandAutoOpen)}] below the input`))
  // 사용량 패널 버튼: 데스크톱은 두 크기 모두 아이콘 📊 하나(열렸으면 밝게, 말은 툴팁)를 창 버튼 묶음 안 맨 앞에 —
  // 아이콘만이면 창 버튼과 같이 묶여야 한다. "열림" 글은 옆에 패널이 보이니 겹치는 말이고, 최대에서 글 버튼
  // (📊 사용량 패널 열림 ✕)을 두니 한도 줄이 두 줄로 밀려 꼴이 안 났다. 터미널은 마우스 올리기가 없어 글 버튼.
  // 다른 mod 가 이 바를 감싸면(next) key "b-panels" 칸 끝에 자기 패널 버튼을 넣을 수 있다(두 크기 모두 이 칸이 있다).
  // 바를 안 그리는 때(자동 숨김 · 안 보이기)엔 칸도 없다 — 늘 보여야 할 버튼은 바 밖에 둔다.
  // B5(0.7.0 피드백): 게이지를 그리는 표면은 게이지가 패널 문이라 ◔ 를 안 그린다 — b-panels 칸은 남긴다(다른 mod 가 넣는 자리)
  const isPanelIcon = e.surface !== 'terminal'
  const panels = (
    <Box key="b-panels" columnGap={1} alignItems="center" flexShrink={0}>
      {!isPanelIcon
        ? panelButton('usage', L('패널', 'Pane'))
        : hasGaugeDoor
          ? null
          : withTip(
            `band-panel-box-${view === 'usage' ? 'open' : 'closed'}`,
            // 열림 · 닫힘: 📊 는 색 그림이라 흐리게(dim)만으론 안 갈렸다 — 열렸으면 강조 버튼(설정 탭의 "✓ 고른 값" 과 같은 꼴)
            <Button key="usage" label="◔" {...(view === 'usage' ? { variant: 'secondary' as const } : { plain: true, dimColor: true })} onPress={async () => void (await act.toggleView('usage'))} />,
            view === 'usage' ? L(`${paneTitle()} 패널 닫기`, `Close the ${paneTitle()} pane`) : L(`${paneTitle()} 패널 열기`, `Open the ${paneTitle()} pane`),
          )}
    </Box>
  )
  // 창 버튼은 한 칸(b-window)에 나란히 — 묶음 표시는 없다. 둥근 테두리는 데스크톱에서도 위아래 한 줄씩을 더 먹어 바가
  // 두꺼웠고, 바탕색 띠는 버튼 바탕과 색이 겹쳤다. 이지 컴팩트와는 줄이 달라 따로 묶지 않아도 갈린다
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

  // 비용(왼쪽) · 버튼(오른쪽 끝 정렬)은 간격으로만 나눈다 — "│" 글자 세로줄은 줄 사이가 끊겨 싸 보였다
  // 왼쪽 글 ↔ 오른쪽 버튼 사이 S2(2칸) — 예전 4칸은 좁은 바에서 글 자리를 2칸 더 먹었다(2026-10-14 uxi 1.2), 설정 미리보기와 같은 값
  const row = (key: string, left: unknown, rightEl: unknown, align: 'center' | 'flex-start') => (
    <Box key={key} flexWrap="nowrap" alignItems={align} columnGap={2}>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {left ?? <Text> </Text>}
      </Box>
      {rightEl}
    </Box>
  )
  // 최소(한 줄): 왼쪽 요청당 · 컨텍스트 · 컴팩트 구간, 오른쪽 이지 컴팩트 → 창 버튼 묶음(📊 · ⇲ · □ · ✕).
  // 이지 컴팩트는 최소에서도 늘 둔다 — 처음엔 뺐는데 최소로 하면 컴팩트할 길이 안 보였다. 확인창도 그대로
  if (mode === 'min') {
    // 최소에선 이지 컴팩트를 파란 🗜 + 짧은 [컴팩트] 버튼으로 — 상태 글은 툴팁으로, 컴팩트할 때는 깜빡이는 점 색
    // (노랑 · 빨강 · 파랑)과 강조 버튼으로. 처음엔 아이콘 버튼 [🗜] 하나였는데 버튼 안
    // 글자는 앱 버튼 색이라 🗜 가 흰색이었다 — 🗜 를 버튼 밖으로 빼고 버튼엔 짧은 이름. 저장 · 컴팩트 중 글과
    // [취소]는 그대로(보고 눌러야 한다), 터미널은 마우스 올리기가 없어 글 그대로
    const isShort = e.surface !== 'terminal'
    const miniName = L('컴팩트', 'Compact')
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
      !isShort || phase === 'compacting' || phase === 'tidying' ? (
        compactRow
      ) : e.props.isWorking ? (
        // 못 누르는 동안은 게이지 · 이름 둘 다 색 없이 흐리게(버튼 자리 폭은 그대로)
        busyName(miniName, offIcon)
      ) : isConfirming ? (
        <Box columnGap={1} alignItems="center">
          {gaugeDoor(isNotNow ? offIcon : brandIcon)}
          {withTip(
            'band-compact-box-open',
            <Button key="compact-close" label={`${miniName} ▾`} {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })} onPress={() => act.closeConfirm()} />,
            tipLines(L('누르면 확인창 닫기', 'Press to close the card')),
            tipRight(btnW(`${miniName} ▾`)),
          )}
        </Box>
      ) : (
        <Box columnGap={1} alignItems="center">
          {/* 터미널은 그림 글자 대신 글(칸이 어긋난다 — glyph.ts) */}
          {phase === 'held' ? (decoIcon(ui, 'held', LEVEL_HEX.warn, L('보류됨', 'On hold'), 'held-icon', { color: 'warning' }) ?? <Text color="warning">{L('보류', 'Held')}</Text>) : null}
          {/* 0.5 묶음 2: 상태 점은 뺐다 — 게이지가 맡는다. B5: 게이지는 제 칸(패널 문 · 숫자 칩) · 버튼 칩은 그 왼쪽 밖(B2) */}
          {gaugeDoor(isNotNow ? offIcon : brandIcon)}
          {withTip(
            `band-compact-box-${shownLevel}${isColdWin ? '-cold' : ''}`,
            <Button
              key="compact"
              label={miniName}
              {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
              onPress={() => act.openConfirm()}
            />,
            tipLines(isNotNow ? notNowTip : `${compactTip} · ${L('누르면 컴팩트할까요?', 'press to open Compact now?')}`),
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
  // 질문 줄을 뺀 화면(간단 등)이면 이지 컴팩트는 비용 줄 오른쪽 — 왼쪽이 빈 셋째 줄에 버튼만 있었다. 한도 줄이 없으면 바가 한 줄. 질문 줄 글이 잠깐 비는 때(식은 캐시 · 컴팩트 직후)가 아니라 칸 설정으로 정한다 —
  // 버튼 자리가 그때그때 바뀌면 안 된다. 한도 줄만 있고 비용 줄 칸을 다 뺐으면 셋째 줄에 그대로
  const compactOnCost = onCost
  const oneRight = (
    <Box key="b-one-right" columnGap={2} alignItems="center" flexShrink={0}>
      {compactRow}
      {controls}
    </Box>
  )
  return (
    <Box flexDirection="column">
      {/* 세션 한도 줄은 계정에 따라 저절로: 엔진은 구독 세션에만 5시간 · 7일을 알려 준다
          ("rateLimits is empty off a subscription") — API 키 세션엔 줄이 없다. 옵션을 두지 않는다.
          5시간 · 7일 · 리셋 시간은 설정 탭 "바에 보일 칸" → 한도 줄에서 뺀다([한도 전체] 로 한꺼번에도). 한도 줄이 없으면(API 키 세션 · 둘 다 뺌) 비용
          줄이 창 버튼 옆 맨 윗줄로 오른다 — 예전엔 빈 윗줄을 남겨 API 모드에서 칸이 비어 보였다.
          좁으면 한도 줄이 두 줄로 넘어간다 — 패널 버튼은 그때도 오른쪽 위(위 정렬) */}
      {/* 좁은 터미널(패널을 연 CLI 등 — 창 버튼 묶음이 ~45칸이라 한도 줄 자리가 20칸 남짓)에선 창 버튼을 맨 윗줄에 혼자,
          한도 줄은 그 아래 전체 폭 — 한도 칸이 짓눌려 글자가 세로로 쪼개졌다(2026-10-12 CLI 확인) */}
      {limitsLine && isNarrowTerminal ? row('b-r0', null, controls, 'center') : null}
      {limitsLine && isNarrowTerminal
        ? row('b-r1', limitsLine, null, 'flex-start')
        : limitsLine
          ? row('b-r1', limitsLine, controls, 'flex-start')
          : row('b-r1', estimateLine, compactOnCost ? oneRight : controls, 'center')}
      {/* 비용 줄의 칸을 다 빼면 줄째 빠진다 */}
      {limitsLine && estimateLine ? row('b-r2', estimateLine, compactOnCost ? compactRow : null, 'center') : null}
      {compactOnCost ? null : row('b-r3', lastLine, compactRow, 'center')}
      {confirm}
    </Box>
  )
}
