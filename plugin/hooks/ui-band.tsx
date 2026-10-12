import type { BandShow, CompactInputs, CostParts, LiveTurn, StepDetail, TurnSummary, Usage } from '../types'
import { cacheWarnFor, coldFor, estimateFor, fmtTokens, fmtUntil, fmtUsd, LEVEL_TEXT, levelOf, limitHex, REWRITE_NOTE_USD, sessionColorOf, thresholds } from './cost'
import { L, plural } from './i18n'
import { bandShowOf, DEFAULT_SETTINGS, SESSION_COLORS_DEFAULT } from './settings'
import { agentPart, callsOf, limitName } from './text'
import { iconOf, withIcon } from './glyph'
import { bar, TILE } from './ui-common'
import type { Ui } from './ui-common'

/** 입력창 위 띠의 줄들 — 한도 · 예상(이 세션 · 요청당 · 컨텍스트 · 캐시) · 지난 질문. 칸마다 화면 보기 값(bandShow)으로 뺄 수 있다 */

/**
 * 최소(한 줄) 바의 칸: 그 화면의 이 세션 · 요청당 · 컨텍스트 · 캐시(한도 · 컴팩트 구간 · 질문 줄은 뺀다). 캐시 남은 분은 한 줄에도
 * 남긴다 — 식으면 다음 요청이 전체를 다시 써 늘 볼 값. 캐시를 더하자 넓은 창에서도 두 줄로 넘어가
 * 컴팩트 구간을 뺐다 — 컴팩트할 때는 이지 컴팩트 버튼 색 · 점이 알린다. 캐시 글도 "캐시 만료 N분 남음" 으로 짧게(drawEstimateLine isShort)
 */
export function minShowOf(show: BandShow): BandShow {
  return { ...show, fiveHour: false, sevenDay: false, resets: false, range: false, lastTurn: false }
}

/** 칸 다 켠 화면(자세히)의 칸 — 그리기 함수의 기본 인자 */
const BASIC_SHOW: BandShow = bandShowOf({ ...DEFAULT_SETTINGS, screen: 'detail' })

/**
 * 비용 줄 맨 앞 "이 세션 $12.34". 최대 · 최소 두 크기에서 같은 자리, 식은
 * 캐시 줄 앞에도. 색은 설정의 세션 금액 기준(기본 $10 노랑 · $50 주황 · $100 빨강). 질문 평균(0.4.0 자세히)은 뺐다 — 자리만
 * 차지했고 패널 비용 요약에 같은 값이 있다. 금액을 모르면(엔진이 비용 장부를 안 줌) null
 */
function sessionPart(ui: Ui, u: Usage, show: BandShow, colors: readonly [number, number, number]) {
  const { Text } = ui
  if (!show.session || u.costUsd === null) return null
  const color = sessionColorOf(u.costUsd, colors)
  return (
    <Text>
      <Text dimColor>{L('이 세션 ', 'Session ')}</Text>
      <Text bold {...(color ? { color } : {})}>
        {fmtUsd(u.costUsd)}
      </Text>
    </Text>
  )
}

/**
 * 띠 윗줄: 세션 한도. 계정 전체 값이라 다른 세션이 쓴 것도 들어 있다. 5시간 · 7일 · 리셋 시간은 칸마다 뺄 수 있고(그 밖의
 * 한도 — 지출 한도 등 — 는 늘 보인다), 다 빠지면 null
 */
export function drawLimitsLine(ui: Ui, surface: string, u: Usage, nowMs: number, show: BandShow = BASIC_SHOW) {
  const { Box, Text } = ui
  const shown = u.rateLimits.filter(r => (r.kind === 'five_hour' ? show.fiveHour : r.kind === 'seven_day' ? show.sevenDay : true))
  if (shown.length === 0) return null
  return (
    <Box columnGap={3} flexWrap="wrap">
      {/* 한도 하나(이름 · 막대 · % · 리셋)는 줄지 않고 통째로 다음 줄로 — 좁은 터미널(패널을 연 CLI, 바 ~68칸)에서 칸마다
          짓눌려 "5 / 시 / 간" 처럼 글자가 세로로 쪼개졌다(2026-10-12 CLI 확인) */}
      {shown.map(r => (
        <Box key={`bl-${r.kind}`} columnGap={1} alignItems="center" flexShrink={0}>
          <Text dimColor>{limitName(r.kind)}</Text>
          {bar(ui, surface, r.percentUsed, limitHex(r.percentUsed), 64, L(`${limitName(r.kind)} 한도 ${r.percentUsed}%`, `${limitName(r.kind)} limit ${r.percentUsed}%`))}
          <Text {...(r.percentUsed >= 90 ? { color: 'red' } : r.percentUsed >= 70 ? { color: 'yellow' } : {})}>
            {Math.round(r.percentUsed)}%
          </Text>
          {r.resetsAt && show.resets ? <Text dimColor>{L(`· ${fmtUntil(r.resetsAt, nowMs)} 후 리셋`, `· resets in ${fmtUntil(r.resetsAt, nowMs)}`)}</Text> : null}
        </Box>
      ))}
    </Box>
  )
}

/**
 * 띠 아랫줄 왼쪽: 이 세션 금액과 지금 입력하면 드는 값. 한 줄을 넘으면 끝을 자른다. show 로 이 세션 · 요청당 · 컨텍스트 ·
 * 컴팩트 구간 · 캐시 칸을 뺀다(식은 캐시 줄은 경고라 컨텍스트 칸만 따른다) — 다 빠지면 null
 */
export function drawEstimateLine(
  ui: Ui,
  u: Usage,
  nowMs: number,
  inputs: CompactInputs | null,
  show: BandShow = BASIC_SHOW,
  colors: readonly [number, number, number] = SESSION_COLORS_DEFAULT,
  isShort = false,
) {
  const { Text } = ui
  const session = sessionPart(ui, u, show, colors)
  const rest = drawCostRest(ui, u, nowMs, inputs, show, isShort)
  if (!session && !rest) return null
  // 줄 하나를 Text 하나로 — 조각은 글 조각(Fragment · 줄바꿈 속성 없는 Text)만. 데스크톱은 줄바꿈 속성(wrap)이 있는 Text 를
  // 따로 자르는 상자로 그려, 그 상자를 다른 Text 안에 넣으면 글 아래가 아니라 상자 바닥에 줄을 맞춰 위로 떴다
  return (
    <Text wrap="truncate-end">
      {session}
      {session && rest ? <Text dimColor> · </Text> : null}
      {rest}
    </Text>
  )
}

/**
 * 비용 줄의 이 세션 뒤: 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시(또는 식은 캐시 경고) — wrap 없는 Text 조각으로, 줄은 부른 쪽이 감싼다.
 * isShort = 최소(한 줄) 바: 캐시를 "캐시 만료 42분 남음" 으로 짧게
 */
function drawCostRest(ui: Ui, u: Usage, nowMs: number, inputs: CompactInputs | null, show: BandShow, isShort = false) {
  const { Text } = ui
  const level = levelOf(u.contextTokens)
  const ctx = !show.context ? null : u.contextEstimated ? (
    <Text>
      <Text color={LEVEL_TEXT[level]}>{L(`컨텍스트 ~${fmtTokens(u.contextTokens)}`, `Context ~${fmtTokens(u.contextTokens)}`)}</Text>
      <Text dimColor>{L(' 컴팩트 직후', ' just compacted')}</Text>
    </Text>
  ) : (
    <Text color={LEVEL_TEXT[level]}>{L(`컨텍스트 ${fmtTokens(u.contextTokens)}`, `Context ${fmtTokens(u.contextTokens)}`)}</Text>
  )
  // 지금 걸린 컴팩트 시점(설정 탭) — 컨텍스트 크기 바로 뒤에, 얼마나 남았는지 견주게
  // 칸 사이 " · " 는 앞 칸이 있을 때만 — 앞 칸을 끄면 구간 · 캐시가 "컴팩트 구간" 으로 시작한다
  const t = thresholds()
  const at = (isFirst: boolean) =>
    !show.range ? null : (
      <Text>
        <Text dimColor>
          {t.isRange ? L(`${isFirst ? '' : ' · '}컴팩트 구간 `, `${isFirst ? 'Compact range ' : ' · compact range '}`) : L(`${isFirst ? '' : ' · '}컴팩트 기준 `, `${isFirst ? 'Compact at ' : ' · compact at '}`)}
        </Text>
        <Text>{t.isRange ? `${fmtTokens(t.ctxWarn)}~${fmtTokens(t.ctxCut)}` : fmtTokens(t.ctxCut)}</Text>
      </Text>
    )
  const est = estimateFor(u, nowMs)
  if (est.kind === 'unpriced')
    return !ctx && !show.range ? null : (
      <Text>
        {ctx}
        {at(!ctx)}
      </Text>
    )
  if (est.kind === 'cold') {
    // 바로 컴팩트와 그냥 이어 가기의 차이 하나를 말로: "컴팩트하면 ~$0.28 이득" / "~$0.43 손해".
    // 거쳐 온 꼴 — "~$로 더 쌈 / 권장 안 함(~$로 더 비쌈)" 은 쌈·비쌈이 한 글자 차라 둘 다 비싸다로 읽혔고 줄이 넘어갔다.
    // "이어 가면 ~$X · 컴팩트하면 ~$Y" 에 싼 쪽 초록 · 비싼 쪽 빨강은 색이 이득/손해를 대신해 더 헷갈렸다.
    // 금액엔 "~" · 빨강을 붙이지 않는다 — 빨간 "~$2.36" 이 "−$2.36" 으로 읽혀 무엇이 드는지 헷갈렸다.
    // 드는 값은 "소비", 차이는 "이득 / 손해" 로 말이 뜻을 맡는다. 차이엔 말과 같이 색 — 이득 초록 · 손해 빨강(말이 붙어
    // 있어 빼기로 안 읽힌다. 손해만 색이 없어 이득과 짝이 안 맞았다). 드는 값(소비 · 컴팩트 값)엔 색 없음.
    // 데스크톱 띠는 truncate-end 를 안 지키고 줄을 바꾼다 — 짧게(그래서 컴팩트 구간은 이 줄엔 안 붙인다).
    // 같은 계산: 컴팩트 버튼의 "바로 컴팩트 권장"(coldCompact · 지난 컴팩트 실측 크기). 이어 가기 = 전체 다시 쓰기
    const c = inputs ? coldFor(u, inputs) : null
    const isWin = c !== null && c.compactUsd < c.continueUsd
    const gap = c === null ? 0 : Math.abs(c.continueUsd - c.compactUsd)
    // 모델을 바꿨을 땐 "모델 바뀜" 만 — 모델 이름은 입력창 아래 · 앱 팝업 · 질문별 비용에 있고 띠에선 줄만 길게 했다
    return (
      <Text>
        <Text color="red" bold>{est.reason === 'model' ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')}</Text>
        <Text dimColor>{L(' · 첫 요청 재작성 ', ' · first request rewrites ')}</Text>
        <Text bold>{L(`${fmtUsd(est.rewriteUsd)} 소비`, `${fmtUsd(est.rewriteUsd)}`)}</Text>
        {c === null ? null : <Text dimColor>{L(' · 컴팩트하면 ', ' · compacting ')}</Text>}
        {c === null ? null : isWin ? (
          <Text color="green" bold>{L(`${fmtUsd(gap)} 이득`, `saves ${fmtUsd(gap)}`)}</Text>
        ) : (
          <Text bold color="red">{L(`${fmtUsd(gap)} 손해`, `costs ${fmtUsd(gap)} more`)}</Text>
        )}
        {ctx ? <Text dimColor> · </Text> : null}
        {ctx}
      </Text>
    )
  }
  // 캐시 남은 분은 늘 — 컴팩트 직후(첫 요청 전)도 컴팩트 시각부터 센다(register.tsx refreshUsage). "캐시 만료까지 42분 남음":
  // 0.4.0 의 "42/60분" 은 점수처럼 읽혀 남은 시간으로 안 와닿았다. 요청마다 다시 차서
  // 일하는 동안은 유지 시간(60 · 5) 그대로 보이고, 유지 시간 종류는 패널 · 설정 캐시 칸에. 노랑 기준도 그 유지 시간 것
  const hasCache = show.cache && est.minsLeft !== null
  if (!show.perRequest && !ctx && !show.range && !hasCache) return null
  const isCacheFirst = !(show.perRequest || ctx || show.range)
  return (
    <Text>
      {show.perRequest ? <Text dimColor>{L('요청당 ', 'Per request ')}</Text> : null}
      {/* 요청당 = 지금 크기 × 읽기 요율 + 요청마다 읽기 말고 드는 실측 값(새로 쓰기 · 출력, 9a), 못 쟀으면 읽기만 — 색은 컨텍스트 색 */}
      {show.perRequest ? (
        <Text bold color={LEVEL_TEXT[level]}>
          ~{fmtUsd(est.perCallUsd + (u.perCallExtraUsd ?? 0))}
        </Text>
      ) : null}
      {show.perRequest && ctx ? <Text dimColor> · </Text> : null}
      {ctx}
      {at(!show.perRequest && !ctx)}
      {hasCache ? (
        <Text dimColor>
          {(isCacheFirst ? '' : ' · ') +
            (isShort ? L('캐시 만료 ', isCacheFirst ? 'Cache expires in ' : 'cache expires in ') : L('캐시 만료까지 ', isCacheFirst ? 'Cache expires in ' : 'cache expires in '))}
        </Text>
      ) : null}
      {hasCache ? (
        // 영어는 앞말이 "cache expires in " 이라 값은 "38m" 만 — "in 38m left" 로 겹쳤다(공개 세션 발견, 2026-10-13)
        <Text {...(est.minsLeft! < cacheWarnFor(thresholds(), est.ttlMin) ? { color: 'yellow' } : {})}>{L(`${est.minsLeft}분 남음`, `${est.minsLeft}m`)}</Text>
      ) : null}
    </Text>
  )
}

/**
 * 캐시를 다시 쓴 값(rewriteOf 합)이 REWRITE_NOTE_USD 이상이면 그 값만 따로 — 캐시가 식었거나 모델을 바꾼 뒤 첫 요청은
 * 컨텍스트 전체를 다시 써서 합이 갑자기 커진다. 그 까닭을 보이는 것이라 이때만 노랑으로 붙인다.
 * 새 내용(파일 · 도구 결과)을 쓴 값 · 세션 첫 요청은 다시 쓴 게 아니라 넣지 않는다. 이전 판 기록(값 없음)엔 안 붙인다
 */
export function rewriteNote(ui: Ui, rewriteUsd: number | undefined) {
  const { Text } = ui
  if (rewriteUsd === undefined || rewriteUsd < REWRITE_NOTE_USD) return null
  return <Text color="yellow">{L(` · 캐시 다시 씀 ${fmtUsd(rewriteUsd)}`, ` · cache rewrite ${fmtUsd(rewriteUsd)}`)}</Text>
}

/**
 * 설정 탭 화면 칸의 바 미리보기 — 고른 화면 · 한도 줄 · 금액 색으로
 * 이 세션 값을 바(최대 크기)와 같은 줄 배치로 그린다(register.tsx AbovePrompt 의 줄 나눔과 같게). 버튼 자리는 흐린 글이라
 * 눌러지지 않는다. 한도 줄은 엔진이 한도를 준 세션(구독)에서만 — 바와 같다
 */
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
) {
  const { Box, Text } = ui
  // 간단 화면은 한 줄 고정 — 한도 줄을 안 그린다(바와 같다)
  const limits = !isLean && u && u.rateLimits.length > 0 ? drawLimitsLine(ui, surface, u, nowMs, show) : null
  const est = u ? drawEstimateLine(ui, u, nowMs, inputs, show, colors) : <Text dimColor>{L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes')}</Text>
  const turn = show.lastTurn ? drawLastTurnLine(ui, last, null) : null
  const fake = (key: string, text: string) => (
    <Text key={key} dimColor>
      {text}
    </Text>
  )
  // 창 버튼은 바와 같게 — 바가 한 줄(간단 · 한도 줄 · 질문 줄 없음)이면 [—] 가 없다(register.tsx isOneRow). 간단 미리보기에도
  // "📊  —  ✕" 가 나왔다(공개 세션 발견, 2026-10-13)
  const isOneRow = isLean || (!limits && !show.lastTurn)
  const win = fake(
    'pv-win',
    iconOf('📊') ? (isOneRow ? '📊  ✕' : '📊  —  ✕') : isOneRow ? L('[사용량] [✕]', '[Usage] [✕]') : L('[사용량] [—] [✕]', '[Usage] [—] [✕]'),
  )
  const compact = fake('pv-compact', withIcon('🗜', L('이지 컴팩트', 'Easy Compact')))
  const line = (key: string, left: unknown, right: unknown) => (
    <Box key={key} columnGap={2} alignItems="flex-start">
      <Box flexGrow={1} flexShrink={1} minWidth={0}>
        {left ?? <Text> </Text>}
      </Box>
      {right ? (
        <Box key={`${key}-r`} flexShrink={0} columnGap={2}>
          {right}
        </Box>
      ) : null}
    </Box>
  )
  // 질문 줄을 뺀 화면이면 이지 컴팩트는 비용 줄 오른쪽(한도 줄이 없으면 한 줄) — 바와 같은 규칙
  const hasTurnRow = show.lastTurn
  const rows = limits
    ? [line('pv-1', limits, win), est ? line('pv-2', est, hasTurnRow ? null : compact) : null, hasTurnRow || !est ? line('pv-3', turn, compact) : null]
    : [line('pv-1', est, hasTurnRow ? win : [compact, win]), hasTurnRow ? line('pv-3', turn, compact) : null]
  return (
    <Box key="band-preview" flexDirection="column" {...TILE}>
      {rows}
    </Box>
  )
}

/** 띠 둘째 비용 줄: 지난 질문 하나에 실제로 든 값과 최근 평균 */
export function drawLastTurnLine(ui: Ui, last: TurnSummary | null, now: LiveTurn | null) {
  const { Text } = ui
  // 작업 중엔 이번 질문이 지금까지 쓴 값(요청이 끝날 때마다 늘어난다)
  // 합 · 요청 수 — 요청마다 든 값은 질문별 비용 패널에(진행 중 질문은 맨 위에 동작별로).
  // 읽기 · 쓰기 · 출력 내역은 질문별 비용 패널에 있다 — 띠에선 흐린 괄호가 길기만 하고 안 읽혔다
  // 요청 수는 에이전트 요청까지, 에이전트는 "🤖 에이전트 1개 $1.93 포함" — 값 옆 "🤖 $" 만으론 질문 값과의 관계가 헷갈렸다
  //. 질문이 끝난 뒤 도는 백그라운드 에이전트도 "지난 질문" 줄에서 도는 중 → 끝남
  const line = (head: string, cost: CostParts, steps: number, rewriteUsd: number | undefined, details: readonly StepDetail[] | undefined) => {
    const agents = agentPart(details, true)
    const calls = callsOf(steps, details)
    return (
    <Text wrap="truncate-end">
      <Text dimColor>{head}</Text>
      <Text bold>{fmtUsd(cost.usd)}</Text>
      <Text dimColor>{L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`)}</Text>
      {agents ? <Text>{` · ${agents}`}</Text> : null}
      {rewriteNote(ui, rewriteUsd)}
    </Text>
    )
  }
  if (now && now.steps > 0) return line(L('진행 중 질문 ', 'This question '), now.cost, now.steps, now.rewriteUsd, now.details)
  if (!last) return null
  return line(L('지난 질문 ', 'Last question '), last.cost, last.steps, last.rewriteUsd, last.details)
}
