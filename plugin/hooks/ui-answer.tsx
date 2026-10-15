import type { TurnSummary, Usage } from '../types'
import { fmtUsd } from './cost'
import { L, plural } from './i18n'
import { iconOf } from './glyph'
import { agentPart, agentSum, answerBreakdown, APP_MIN_USD, callsOf, fitCells, recentSteps } from './text'
import { rewriteNote } from './ui-band'
import { agentText, BRAND_HEX, stepText } from './ui-common'
import type { Ui } from './ui-common'

/**
 * 답변 끝 질문 비용 칩(첫 줄 · 펼친 상세)과 설정 미리보기 예시 값 — $ 를 받지 않는 그리기라 register.tsx 에서 옮겼다(0.6.1: register.tsx 가
 * 앤트로픽 디렉터리 기준 256 KiB 에 바짝 붙어 — 넘으면 검토자 보류). 버튼 동작(펼치기)은 register.tsx 가 묶는다
 */

/** 답변 아래(정보량 전부, 펼쳤을 때) 동작별 줄 수 — 넘으면 비싼 것만, 나머지는 한 줄. 줄 폭은 알 수 없어 동작 이름을 이 칸까지 */
const ANSWER_STEPS = 10
const ANSWER_COLS = 72

/**
 * 답변 아래 칩의 첫 줄 — 답변 아래와 설정 화면 칸 미리보기가 같이 쓴다. 한 줄 전부 파랑(금액만 굵게) — 흐린 회색 글은 답변 글
 * 사이에서 안 보였다. "캐시 다시 씀" 경고만 노랑 그대로(드문 비용 경고라 파랑에 묻히면 안 된다).
 * 요청 수는 에이전트 요청까지, 에이전트는 정보량 최소면 개수만 · 전부면 "$ 포함" — 패널 질문별 비용과 같은 꼴(예전엔 따로 옵션).
 * 이 질문 값에 든 컴팩트 · 앱 자체 요청은 이름으로 — 예전 "엔진 집계 − 우리 합" 은 무엇인지 몰랐다. 첫 줄엔 터미널 · 정보량
 * 전부일 때만: 데스크톱 전부는 펼친 상세의 ⚙ · 🗜 줄에 있고(첫 줄이 길어 "포함" 만 다음 줄로 꺾였다), 최소는 합만
 */
export function answerLine(ui: Ui, summary: TurnSummary, isFull: boolean, surface: string) {
  const { Text } = ui
  const compactUsd = (summary.details ?? []).reduce((sum, d) => sum + (d.compact ? d.usd : 0), 0)
  const parts = [
    compactUsd >= APP_MIN_USD ? L(`컴팩트 ${fmtUsd(compactUsd)}`, `compact ${fmtUsd(compactUsd)}`) : '',
    (summary.appUsd ?? 0) >= APP_MIN_USD ? L(`앱 자체 요청 ${fmtUsd(summary.appUsd!)}`, `app's own requests ${fmtUsd(summary.appUsd!)}`) : '',
  ].filter(Boolean)
  const extra = parts.length > 0 && isFull && surface === 'terminal' ? L(` · ${parts.join(' · ')} 포함`, ` · incl. ${parts.join(' · ')}`) : ''
  const calls = callsOf(summary.steps, summary.details)
  const agentLine = agentPart(summary.details, isFull)
  const icon = iconOf('🧾')
  const head = [
    icon ? `${icon} ` : '',
    L('이 질문 ', 'This question '),
    <Text key="usd" bold>
      {fmtUsd(summary.cost.usd)}
    </Text>,
    L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`),
  ]
  // B4(0.6.1 피드백): 데스크톱은 🤖 대신 도트 캐릭터 — 답이 끝난 뒤에도 도는 백그라운드 에이전트면 끝날 때까지 걷는다. 그림은 글 안에 못 넣어
  // 줄을 칸(Box)으로 나눈다(글 안 Fragment · Box 는 엔진이 거부)
  if (agentLine && agentLine.startsWith('🤖 ') && surface === 'desktop') {
    const { Box } = ui
    return (
      <Box key="q-line" flexDirection="row" alignItems="center" flexWrap="wrap">
        <Text color={BRAND_HEX}>{head}</Text>
        {agentText(ui, 'q-agents', agentLine, agentSum(summary.details)?.running === true, { color: BRAND_HEX }, ' · ')}
        <Text color={BRAND_HEX}>
          {rewriteNote(ui, summary.rewriteUsd)}
          {extra}
        </Text>
      </Box>
    )
  }
  return (
    <Text color={BRAND_HEX}>
      {head}
      {/* 에이전트 — 답이 끝난 뒤에도 도는 백그라운드 에이전트면 끝날 때까지 "도는 중" */}
      {agentLine ? ` · ${agentLine}` : ''}
      {rewriteNote(ui, summary.rewriteUsd)}
      {extra}
    </Text>
  )
}

/**
 * 질문 비용 칩을 펼친 상세 — 답변 끝 칩과 설정 미리보기가 같이 쓴다. 맨 위 " - " 줄들의 합 = 질문 값(메인 · 🤖 · 🗜 · ⚙), 메인
 * 아래 더 들인 줄은 메인 금액을 동작마다 나눈 것 — 다 같은 깊이에 두니 동작 줄까지 더하는 항목으로 읽혔다. 요청 많은 질문은 비싼 동작 ANSWER_STEPS 개만(순서 그대로), 나머지는 한 줄
 */
export function answerDetail(ui: Ui, summary: TurnSummary) {
  const { Box, Text } = ui
  const bd = answerBreakdown(summary.cost, summary.appUsd, summary.details, summary.steps)
  // 0.5 묶음 2(N18): 답변 칩도 최근 ANSWER_STEPS 개 · 최신 위(패널과 같은 규칙)
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
        // 경고가 없으면 글 하나로(조각이 섞이면 글로 찾기 · 자르기가 흐려진다)
        return (
          <Text key={`qd-${j}`} dimColor wrap="truncate-end">
            {note ? [head, <Text key="n" color="warning">{note}</Text>] : head}
          </Text>
        )
      })}
      {rest > 0 ? (
        <Text key="qd-rest" dimColor>
          {L(`${SUB}이전 동작 ${rest}개 ${fmtUsd(restUsd)} — 더 보려면 이지 컴팩트 패널`, `${SUB}${plural(rest, 'earlier step')} ${fmtUsd(restUsd)} — more in the Easy Compact pane`)}
        </Text>
      ) : null}
      {/* 에이전트 줄은 데스크톱이면 🤖 대신 도트 캐릭터(B4) */}
      {bd.others.map((text, k) => agentText(ui, `qb-${k}`, text, agentSum(summary.details)?.running === true, { dimColor: true, wrap: 'wrap' }, ' - '))}
    </Box>
  )
}

/**
 * 설정 미리보기의 예시 값 — 아직 잰 값 · 끝난 질문이 없을 때(새 세션). 빈 자리만 그리니 무엇이 어떻게 보일지 몰랐다. 진짜 바 · 칩 그리기에 넣어 고른 화면 · 칸 · 정보량이 그대로 반영된다. 화면에 "예시 값" 이라 적는다
 */
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

