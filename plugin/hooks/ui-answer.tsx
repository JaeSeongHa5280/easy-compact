import type { LiveTurn, TurnSummary, Usage } from '../types'
import { fmtTokens, fmtUsd, LEVEL_TEXT, levelOf } from './cost'
import { L, plural } from './i18n'
import { iconOf } from './glyph'
import { agentPart, agentSum, answerBreakdown, APP_MIN_USD, callsOf, fitCells, recentSteps } from './text'
import { rewriteNote } from './ui-band'
import { ACCENT, agentMark, agentText, BRAND_HEX, hoverTip, LIVE_HEX, previewChip, previewFrame, pulseDot, questionScope, stepText, workMark } from './ui-common'
import { autoTurnName, autoTurnOf } from './tidy'
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
  // 진행 칸(isLive)은 🧾 대신 앞의 진행 표지(liveStrip), 글은 바와 같은 꼴 — 이름 흐림 · 값 굵게. 답변 칩은 파랑 그대로(답변 글 사이에서 보여야 한다)
  const icon = isLive ? null : iconOf('🧾')
  // 흐림은 겹친 Text 에서 못 되돌려(안쪽 dimColor false 가 안 먹을 수 있다) 이름 · 값을 따로 감싼다. side = 에이전트 · 캐시 다시 씀 쪽
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
  // B4(0.6.1 피드백): 데스크톱은 🤖 대신 도트 캐릭터 — 답이 끝난 뒤에도 도는 백그라운드 에이전트면 끝날 때까지 걷는다. 그림은 글 안에 못 넣어
  // 줄을 칸(Box)으로 나눈다(글 안 Fragment · Box 는 엔진이 거부)
  if (agentLine && agentLine.startsWith('🤖 ') && surface === 'desktop') {
    const { Box } = ui
    return (
      <Box key="q-line" flexDirection="row" alignItems="center" flexWrap="wrap">
        <Text {...tone}>{head}</Text>
        {/* 진행 칸에서 에이전트가 도는 동안은 줄 앞 그림이 에이전트 그림이라 글 옆 그림을 뺀다 — 다 끝나면 줄 앞은 노트북 벌레, 글 옆은 DONE */}
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
      {/* 에이전트 — 답이 끝난 뒤에도 도는 백그라운드 에이전트면 끝날 때까지 "도는 중" */}
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

/**
 * 1.0 진행 칸(데스크톱 입력창 바로 위 — 사용자 2026-10-18 "현재 질문은 input 위에 아예 새로운 패널 붙여서"): 대답하는 동안 이 질문 값 · 요청
 * 수(+ 에이전트 · 캐시 다시 씀), 깜빡이는 점을 글 앞에. 끝나면 이 칸은 사라지고 답변 아래
 * 칩이 그 값을 잇는다. 첫 요청이 끝나기 전엔 "첫 요청 중"(칸이 턴 처음부터 자리를 잡아 입력창이 한 번만 움직인다). 예전 자리(앱 작업 줄)는 앱의
 * 도구 묶음 줄이 우리 그림을 버려 턴 내내 안 보였다. o.isAlone = 위에 바가 없음(윗선 없이), o.isPreview = 설정 견본(점은 틀 없이 그림)
 */
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
  // 이지 오토 요약 · 이어가기 턴은 이름이 글 머리표(시안 1019a "[이지 오토 · 요약] · 요청 2회" — 바 단계 글과 같은 파랑)
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
  // 1.0 시안 1018a 안 A: 바와 같은 카드 안에서 1px 윗선(설정 구분선 rowLine 과 같은 promptBorder)으로
  // 칸을 가른다. 입력창 위는 띠 하나 · 트리 하나라(엔진 AbovePrompt) 카드를 둘로 쪼갤 수는 없다. 위에 바가 없으면(슬림 · 접힌 바) 선도 없다.
  // 줄 앞 그림: 노트북을 두드리는 대장 벌레, 에이전트가 돌면 지금 에이전트
  // 그림(대장 + 작은 벌레) — 글의 🤖 자리 그림은 빼 그림이 두 번 안 나온다(answerLine noMark)
  const running = agentSum(now.details)?.runningCount ?? 0
  const mark = running > 0 ? agentMark(ui, 'ec-live-mark', running) : workMark(ui, 'ec-live-mark', !o.isPreview)
  return (
    <Box key="ec-live" flexDirection="column">
      {/* 선 아래 여백: 실제 바는 앱 카드 아래 여백(그림 실측 글 아래 ~23px)이 있어 0.3칸이면 글이 선 쪽으로 붙어 보였다(선 → 글 ~12px) — 0.8칸으로
          가운데(사용자 2026-10-18 "미리보기 요 느낌을 원하긴 했어"). 미리보기 상자는 아래 여백이 없어 0.3칸 그대로가 그 느낌 */}
      {o.isAlone ? null : <Box key="ec-live-line" height={0.06} marginTop={0.35} marginBottom={o.isPreview ? 0.3 : 0.8} backgroundColor="promptBorder" />}
      <Box key="ec-live-row" flexDirection="row" alignItems="center" columnGap={1}>
        {mark ?? pulseDot(ui, surface, LIVE_HEX, L('진행 중', 'Running'), !o.isPreview)}
        {body}
      </Box>
    </Box>
  )
}

/** 설정 바 미리보기의 진행 칸 견본 — 지난 질문(없으면 예시) 값. 데스크톱만(터미널은 진행 칸이 없고 앱 작업 줄 옆) */
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
          {L(`${SUB}이전 동작 ${rest}개 ${fmtUsd(restUsd)} · 다 보려면 이지 컴팩트 패널을 여세요`, `${SUB}${plural(rest, 'earlier step')} ${fmtUsd(restUsd)} · open the Easy Compact pane to see them all`)}
        </Text>
      ) : null}
      {/* 에이전트 줄은 데스크톱이면 🤖 대신 도트 캐릭터(B4) */}
      {bd.others.map((text, k) => agentText(ui, `qb-${k}`, text, (agentSum(summary.details)?.runningCount ?? 0), { dimColor: true, wrap: 'wrap' }, ' - '))}
    </Box>
  )
}

/**
 * 턴 끝 답변 아래 칩(register AssistantMessage 훅이 읽은 값으로 — 2026-10-20 register.tsx 에서 옮김). theirs = 엔진 몫(답변 글),
 * isOpen = 그 질문을 폈나(펼 수 있을 때만 읽는다), isHover = 질문 강조(데스크톱 · 설정)
 */
export function drawAnswerChip(ui: Ui, d: { theirs: unknown; summary: TurnSummary; isFull: boolean; surface: string; isOpen: boolean; isHover: boolean }, act: { toggle: () => void }) {
  const { Box, Button, Text } = ui
  const { theirs, summary, isFull, surface, isOpen, isHover } = d
  const line = answerLine(ui, summary, isFull, surface)
  // 정보량 전부면 패널 "자세히" 의 펼친 질문처럼 상세(메인 · 에이전트 · 앱 자체 요청 분해 줄과 동작별 값)를 붙이되 처음엔 접힘 —
  // 늘 펼쳐 두니 답마다 길었다. 칩 첫 줄 끝 [▸ 자세히] 로 그 질문만 펴고 접는다. 동작 줄은 ├─ 같은 가지 표시
  // 없이 한 칸 들여 " - " 로. 요청 많은 질문은 비싼 동작 ANSWER_STEPS 개만(순서 그대로), 나머지는 한 줄.
  // 터미널은 칩 한 줄만 — 지난 대화 줄은 다시 그려지지 않아 누름이 안 먹을 수 있고, 상세는 사용량 패널에 있다
  const canFold = isFull && surface !== 'terminal'
  // 버튼은 줄지 않게(flexShrink 0) — 첫 줄 글이 길면 "▸ / 자세히" 로 꺾였다
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
  // 질문 강조: 칩이나 사용량 패널의 그 질문 줄에 마우스를 올리면 칩 · 패널 줄 · 그 답변이 함께 빛난다. 칩 ·
  // 패널 줄과 답변 밑 숨은 덮개가 한 hover 묶음(questionScope) — 덮개는 묶음이 빛날 때만 드러난다. 덮개(absolute)에 올린 마우스는
  // 부모에 올린 것이라 답변 글로는 반응 없음. 덮개는 답변보다 앞에 둔다 — absolute 는 앞의 것 위에 칠해진다.
  // 반투명 배경(8자리 hex)을 깔았을 땐 데스크톱이 답변 아래 그리기를 통째로 받지 않았다(첫 시도 · 되돌림 fab644b). 한 조각씩 실물로
  // 확인: 칩 배경 → 묶음 이름 → 테두리 덮개 → 회색 덮개. 1.0.2: 회색(promptBorder) 바탕이 어두운 테마에서 흰 덩어리로 보여 답변 글이 안
  // 읽혔다 — 바탕 없이 칩과 같은 파란 둥근 테두리만. 데스크톱만, 설정으로 끈다
  const scope = questionScope(summary.atMs)
  return (
    <Box flexDirection="column">
      {isHover ? (
        <Box key="q-ans" flexDirection="column">
          <Box key="q-glow" position="absolute" top={0} left={0} right={0} bottom={0} display="none" borderStyle="round" borderColor={BRAND_HEX} hover={{ scope, display: 'flex' }} />
          {theirs}
        </Box>
      ) : (
        theirs
      )}
      {/* 데스크톱은 둥근 파란 테두리 칩(글 폭만큼) — 답변 글과 갈린다. 답변 글에 붙어 보여 한 칸 띄운다.
          터미널은 테두리가 답마다 두 줄을 늘려 글만. 질문 강조 때 칩은 테두리만 굵게(1.0.2 — 바탕 없음) */}
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

/**
 * 터미널 작업 줄 끝 이 질문 값(register Spinner 훅 — 데스크톱은 앱 작업 줄 그대로): 엔진 몫 + 금액 · 에이전트 · 컨텍스트. 출력 토큰은
 * 뺐다 — 판단에 안 쓰였다, 그 자리에 🤖. 에이전트는 간단이면 개수만, 그 밖엔 "$ 포함"(답변 아래 · 패널과 같은 꼴)
 */
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

/**
 * 설정 화면 칸 미리보기의 "질문 비용 — 답변 끝" 견본 — 이 세션 마지막 질문을 칩 그대로. 처음엔 접힘, 정보량 전부면 [▸ 자세히] 를 눌러 견본 안에서 펼쳐 본다. 펼침은 이 세션만(previewOpen) — 패널을 닫으면 접힌다. 누르기 동작은 register 가 acts 로 묶어 넘긴다($ 를 못 받음)
 */
export function answerPreview(ui: Ui, summary: TurnSummary, isSample: boolean, isFull: boolean, surface: string, isOpen: boolean, isHover: boolean, isTipOpen: boolean, acts: { toggleTip: () => void; toggleOpen: () => void }) {
  const { Box, Button, Text } = ui
  const line = answerLine(ui, summary, isFull, surface)
  const canFold = isFull && surface !== 'terminal'
  // 질문 강조가 켜져 있으면 견본 칩도 마우스를 올리면 테두리가 굵게.
  // 지난 질문 값으로 그린 견본은 그 질문과 한 묶음 — 올리면 채팅창의 그 답변 · 칩 · 패널 줄도 함께. 예시 값은 묶을 답변이 없어 견본만
  const hover = isHover && surface !== 'terminal' ? { hover: { ...(isSample ? {} : { scope: questionScope(summary.atMs) }), borderStyle: 'bold' } } : {}
  // S13(0.9.1): 견본 틀 = 미리보기 칩 + 옅은 바탕(바 견본과 같은 꼴) — 예전 제목 줄 "답변 끝 칩 — 질문 비용" 은 카드 제목과 겹쳐 칩으로 옮겼다.
  // 칩은 질문마다 붙고, 견본만 지난 질문 값(없으면 예시 값)으로 그린다. 설명은 "?"(데스크톱 마우스 올림 · 누르면 펼침)
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
