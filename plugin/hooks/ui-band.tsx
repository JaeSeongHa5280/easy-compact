import type { BandShow, CompactInputs, CostParts, LiveTurn, TurnSummary, Usage } from '../types'
import { coldCompact, estimate, fmtTokens, fmtUntil, fmtUsd, LEVEL_TEXT, levelOf, limitHex, REWRITE_NOTE_USD, thresholds } from './cost'
import { L, plural } from './i18n'
import { DEFAULT_SETTINGS } from './settings'
import { limitName } from './text'
import { bar } from './ui-common'
import type { Ui } from './ui-common'

/** 입력창 위 띠의 줄들 — 한도 · 예상(요청당 · 컨텍스트 · 캐시) · 지난 질문. 칸마다 설정(bandShow)으로 뺄 수 있다 */

/** 최소화 · 컴팩트할 때만 보기의 한 줄 칸: 요청당 · 컨텍스트 · 컴팩트 구간(캐시 남은 분은 뺀다) */
export const MIN_SHOW: BandShow = { ...DEFAULT_SETTINGS.bandShow, cache: false }

/**
 * 띠 윗줄: 세션 한도. 계정 전체 값이라 다른 세션이 쓴 것도 들어 있다. 5시간 · 7일 · 리셋 시간은 칸마다 뺄 수 있고(그 밖의
 * 한도 — 지출 한도 등 — 는 늘 보인다), 다 빠지면 null
 */
export function drawLimitsLine(ui: Ui, surface: string, u: Usage, nowMs: number, show: BandShow = DEFAULT_SETTINGS.bandShow) {
  const { Box, Text } = ui
  const shown = u.rateLimits.filter(r => (r.kind === 'five_hour' ? show.fiveHour : r.kind === 'seven_day' ? show.sevenDay : true))
  if (shown.length === 0) return null
  return (
    <Box columnGap={3} flexWrap="wrap">
      {shown.map(r => (
        <Box key={`bl-${r.kind}`} columnGap={1} alignItems="center">
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
 * 띠 아랫줄 왼쪽: 지금 입력하면 드는 값. 한 줄을 넘으면 끝을 자른다. show 로 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시 칸을
 * 뺀다(식은 캐시 줄은 경고라 컨텍스트 칸만 따른다) — 다 빠지면 null
 */
export function drawEstimateLine(ui: Ui, u: Usage, nowMs: number, inputs: CompactInputs | null, show: BandShow = DEFAULT_SETTINGS.bandShow) {
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
  const est = estimate(u.contextTokens, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom))
  if (est.kind === 'unpriced')
    return !ctx && !show.range ? null : (
      <Text wrap="truncate-end">
        {ctx}
        {at(!ctx)}
      </Text>
    )
  if (est.kind === 'cold') {
    // 바로 컴팩트와 그냥 이어 가기의 차이 하나를 말로: "컴팩트하면 ~$0.28 이득" / "~$0.43 손해".
    // 거쳐 온 꼴 — "~$로 더 쌈 / 권장 안 함(~$로 더 비쌈)" 은 쌈·비쌈이 한 글자 차라 둘 다 비싸다로 읽혔고 줄이 넘어갔다.
    // "이어 가면 ~$X · 컴팩트하면 ~$Y" 에 싼 쪽 초록 · 비싼 쪽 빨강은 색이 이득/손해를 대신해 더 헷갈렸다.
    // 금액엔 "~" · 빨강을 붙이지 않는다 — 빨간 "~$2.36" 이 "−$2.36" 으로 읽혀 무엇이 드는지 헷갈렸다.
    // 드는 값은 "소비", 차이는 "이득 / 손해" 로 말이 뜻을 맡는다.
    // 데스크톱 띠는 truncate-end 를 안 지키고 줄을 바꾼다 — 짧게(그래서 컴팩트 구간은 이 줄엔 안 붙인다).
    // 같은 계산: 컴팩트 버튼의 "바로 컴팩트 권장"(coldCompact · 지난 컴팩트 실측 크기). 이어 가기 = 전체 다시 쓰기
    const c = inputs ? coldCompact(u.contextTokens, inputs, u.model) : null
    const isWin = c !== null && c.compactUsd < c.continueUsd
    const gap = c === null ? 0 : Math.abs(c.continueUsd - c.compactUsd)
    // 모델을 바꿨을 땐 "모델 바뀜" 만 — 모델 이름은 입력창 아래 · 앱 팝업 · 질문별 비용에 있고 띠에선 줄만 길게 했다
    return (
      <Text wrap="truncate-end">
        <Text color="red" bold>{est.reason === 'model' ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')}</Text>
        <Text dimColor>{L(' · 첫 요청 재작성 ', ' · first request rewrites ')}</Text>
        <Text bold>{L(`${fmtUsd(est.rewriteUsd)} 소비`, `${fmtUsd(est.rewriteUsd)}`)}</Text>
        {c === null ? null : <Text dimColor>{L(' · 컴팩트하면 ', ' · compacting ')}</Text>}
        {c === null ? null : isWin ? (
          <Text color="green" bold>{L(`${fmtUsd(gap)} 이득`, `saves ${fmtUsd(gap)}`)}</Text>
        ) : (
          <Text bold>{L(`${fmtUsd(gap)} 손해`, `costs ${fmtUsd(gap)} more`)}</Text>
        )}
        {ctx ? <Text dimColor> · </Text> : null}
        {ctx}
      </Text>
    )
  }
  const hasCache = show.cache && est.minsLeft !== null
  if (!show.perRequest && !ctx && !show.range && !hasCache) return null
  return (
    <Text wrap="truncate-end">
      {show.perRequest ? <Text dimColor>{L('요청당 ', 'Per request ')}</Text> : null}
      {/* 요청 1회 = 컨텍스트 × 읽기 요율 — 색은 컨텍스트 색과 같다 */}
      {show.perRequest ? (
        <Text bold color={LEVEL_TEXT[level]}>
          ~{fmtUsd(est.perCallUsd)}
        </Text>
      ) : null}
      {show.perRequest && ctx ? <Text dimColor> · </Text> : null}
      {ctx}
      {at(!show.perRequest && !ctx)}
      {hasCache ? <Text dimColor>{show.perRequest || ctx || show.range ? L(' · 캐시 ', ' · cache ') : L('캐시 ', 'Cache ')}</Text> : null}
      {hasCache ? (
        <Text {...(est.minsLeft! < thresholds().cacheWarnMin ? { color: 'yellow' } : {})}>{L(`${est.minsLeft}분`, `${est.minsLeft}m`)}</Text>
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

/** 띠 둘째 비용 줄: 지난 질문 하나에 실제로 든 값과 최근 평균 */
export function drawLastTurnLine(ui: Ui, last: TurnSummary | null, now: LiveTurn | null) {
  const { Text } = ui
  // 작업 중엔 이번 질문이 지금까지 쓴 값(요청이 끝날 때마다 늘어난다)
  // 합 · 요청 수 — 요청마다 든 값은 질문별 비용 패널에(진행 중 질문은 맨 위에 동작별로).
  // 읽기 · 쓰기 · 출력 내역은 질문별 비용 패널에 있다 — 띠에선 흐린 괄호가 길기만 하고 안 읽혔다
  const line = (head: string, cost: CostParts, steps: number, rewriteUsd: number | undefined) => (
    <Text wrap="truncate-end">
      <Text dimColor>{head}</Text>
      <Text bold>{fmtUsd(cost.usd)}</Text>
      <Text dimColor>{L(` · 요청 ${steps}회`, ` · ${plural(steps, 'request')}`)}</Text>
      {rewriteNote(ui, rewriteUsd)}
    </Text>
  )
  if (now && now.steps > 0) return line(L('진행 중 질문 ', 'This question '), now.cost, now.steps, now.rewriteUsd)
  if (!last) return null
  return line(L('지난 질문 ', 'Last question '), last.cost, last.steps, last.rewriteUsd)
}
