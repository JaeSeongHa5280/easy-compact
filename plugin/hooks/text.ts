import type { CostParts, StepDetail } from '../types'
import { fmtTokens, fmtUsd, modelKey, modelName, otherModelOf, repriceTurns } from './cost'
import { L, plural } from './i18n'
import { onTerminal, withIcon } from './glyph'
import { isTidyPrompt } from './tidy'

// 사용량 = 지금(컨텍스트 · 비용) · 컴팩트 · 질문별 비용, 설정은 패널 안 탭(예전 이름 '비용' 은 내용보다 좁았다)
// 0.5 묶음 2(N13): 패널 이름 "이지 컴팩트" — 사용량뿐 아니라 컴팩트 판단 · 시점 · 효과까지 담은 mod 의 상세 본체.
// 패널 머리(register.tsx) · 바 게이지 칩(ui-bar.tsx)이 같이 쓴다
export const paneTitle = () => L('이지 컴팩트', 'Easy Compact')

/** 글 도우미 — 칸 세기 · 자르기 · 금액 · 시간 · 모델 이름 글. 그리기 함수처럼 $ 를 받지 않는다 */

/** 이보다 작으면 다음 확인에 모은다 */
export const APP_MIN_USD = 0.005

/** 플러그인이 대신 보낸 글에 엔진이 붙이는 머리말 */
export const PLUGIN_SENT = /^The [\w.-]+ plugin sent a message:\s*/

/**
 * 질문 글: 줄바꿈 접고 1000자까지. 정리 턴은 이름으로.
 * 질문별 비용에서 펼치면 전부 보인다 — 60자만 남겼을 땐 펼쳐도 잘린 글이었다. 접힌 줄 · 진행 중 줄은 그리는 곳에서 자른다
 */
export const PROMPT_KEEP = 1000

export function promptHead(text: string): string {
  // 붙여넣은 글은 앱이 <pasted_content id="…"> 로 감싸 보낸다 — 태그째 보였다. 태그만 지우고 원문 그대로
  // (📋 를 붙였더니 원문이 아닌 것처럼 보였다)
  const one = text
    .replace(/<pasted_content\b[^>]*>/g, ' ')
    .replace(/<\/pasted_content\b[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PLUGIN_SENT, '')
  if (isTidyPrompt(one)) return withIcon('🗜', L(...TIDY_TURN))
  // 저장 턴 이름은 기록할 때 그 언어 글로 남는다 — 그릴 때 지금 언어로(L1). 질문 글은 그대로
  const bare = one.replace(/^🗜\s*/, '')
  if (bare === TIDY_TURN[0] || bare === TIDY_TURN[1]) return withIcon('🗜', L(...TIDY_TURN))
  return clipText(one, PROMPT_KEEP)
}

/** 저장 턴 질문 이름(한국어 · 영어) */
const TIDY_TURN = ['이지 컴팩트 — 저장 턴', 'Easy Compact — save turn'] as const

/**
 * mod 가 지어 붙인 이름(한국어 · 영어 짝) — 질문 기록에 그때 언어 글로 남아(질문별 비용 파일 N3), 언어를 바꾼 뒤에도 "답변 작성" · "하위
 * 에이전트" 가 보였다(L1, 0.6.1 피드백). 그릴 때 짝이 맞으면 지금 언어로. 도구 이름 · 에이전트 작업 이름 · 질문 글은 남이 쓴 글이라 그대로
 */
const MOD_LABELS: readonly (readonly [string, string])[] = [
  ['답변 작성', 'Writing the answer'],
  ['하위 에이전트', 'subagent'],
  ['답 뒤 · 다음 질문 제안', 'after the answer · next-prompt suggestion'],
  ['답 뒤 · 다음 질문 제안 · 메모리 정리 등', 'after the answer · next-prompt suggestion · memory upkeep, etc.'],
  ['중단 · 도중 끊긴 요청 등', 'stopped · interrupted requests, etc.'],
  ['질문 도중 · 앱 자체 요청', 'during the question · app requests'],
  ['앞 답 30초 뒤 ~ 이 질문 시작', 'from 30s after the last answer to this question'],
  ['컴팩트 미리 계산', 'compact precompute'],
  ['컴팩트', 'Compact'],
]

/** mod 가 지은 이름이면 지금 언어로, 아니면 그대로 */
export function labelNow(label: string): string {
  for (const [ko, en] of MOD_LABELS) if (label === ko || label === en) return L(ko, en)
  return label
}

export function clipText(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

/** 두 칸을 차지하는 글자: 한글 · 한자 · 전각 · 그림 글자 */
export function isWide(c: number): boolean {
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    c >= 0x1f300
  )
}

/** 글자 칸 수(넓은 글자 = 2칸) — 엔진 · 데스크톱이 폭을 재는 단위 */
export function cellsOf(text: string): number {
  let n = 0
  for (const ch of text) n += isWide(ch.codePointAt(0)!) ? 2 : 1
  return n
}

/**
 * 데스크톱에 그린 글 폭 어림 — 본문 글꼴 1ch(= Box 폭 한 칸, 13px 에서 7.84px) 단위. 한글 · 넓은 글자 1.66(맑은 고딕 13px),
 * 그림 글자 2.1, 화살표 · 도형 기호 1.3, 숫자 · 대문자 · $ ~ 1, 소문자 0.85, 공백 · 구두점 0.45 — render 도구 보정(2026-10-14, 실물
 * 스크린샷 4장 대조: 엔진 렌더러가 Box 폭 · 간격을 ch 로 그린다). 맥(Apple SD Gothic Neo)은 한글이 조금 좁아 넉넉한 쪽.
 * 터미널은 cellsOf(칸이 정확하다)
 */
export function textCh(text: string): number {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c >= 0x1f300) w += 2.1
    else if (isWide(c)) w += 1.66
    else if (c >= 0x2190 && c <= 0x2bff) w += 1.3
    else if (/[0-9A-Z$~%#@&]/.test(ch)) w += 1
    else if (/[a-z]/.test(ch)) w += 0.85
    else if (/[\s·.,:;'"()[\]|/\-]/.test(ch)) w += 0.45
    else w += 0.9
  }
  return w
}

/** 표면에 맞는 글 폭(칸): 터미널은 칸 수 그대로, 데스크톱은 ch 어림을 올림 */
export function widthOf(text: string, isTerminal: boolean): number {
  return isTerminal ? cellsOf(text) : Math.ceil(textCh(text))
}

/**
 * 칸 수에 맞게 자른다(넘치면 끝에 …). 버튼 이름처럼 줄을 안 바꾸는 글에 쓴다 — 데스크톱은 그런 글이 길면
 * 패널 안쪽 틀을 그만큼 넓혀, 다른 글까지 넓어진 틀에서 줄을 바꾸고 패널 밖으로 잘렸다
 */
export function fitCells(text: string, cells: number): string {
  if (cellsOf(text) <= cells) return text
  let out = ''
  let n = 0
  for (const ch of text) {
    const w = isWide(ch.codePointAt(0)!) ? 2 : 1
    if (n + w > cells - 1) break
    out += ch
    n += w
  }
  return `${out}…`
}

/** "+$7.95" · "−$0.30" — 순이득처럼 부호가 뜻인 값 */
/**
 * 이득 · 손해를 말로: "이득 $1.56" / "손해 $0.30". "+$1.56"(초록) · "−$0.30"(노랑) 처럼 부호 · 색에 맡기니
 * 헷갈렸다 — 띠의 "컴팩트하면 $X 이득 / 손해" 와 같은 말
 */
export function gainText(usd: number): string {
  return `${usd >= 0 ? L('이득', 'gain') : L('손해', 'loss')} ${fmtUsd(Math.abs(usd))}`
}

/** "방금", "12분 전", "3시간 전" */
export function agoText(atMs: number, nowMs: number): string {
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs) || nowMs === 0) return ''
  const mins = Math.max(0, Math.round((nowMs - atMs) / 60000))
  if (mins < 1) return L('방금', 'just now')
  if (mins < 60) return L(`${mins}분 전`, `${mins}m ago`)
  const h = Math.floor(mins / 60)
  return h < 24 ? L(`${h}시간 전`, `${h}h ago`) : L(`${Math.floor(h / 24)}일 전`, `${Math.floor(h / 24)}d ago`)
}

/** 앱 자체 요청은 읽기 · 쓰기 · 출력으로 못 나눠 따로 */
/**
 * 질문 하나의 하위 에이전트 몫(StepDetail.agent 줄들의 합). 에이전트 줄은 에이전트마다 하나라 count = 에이전트 수.
 * read · output · input 은 0.4.0 부터 적어(그 전 기록엔 usd · write 만) hasParts 로 가른다. running = 아직 안 끝난(done false)
 * 에이전트가 있다
 */
export type AgentSum = { usd: number; steps: number; count: number; running: boolean; read: number; write: number; output: number; input: number; hasParts: boolean }

export function agentSum(details: readonly StepDetail[] | undefined): AgentSum | null {
  const agents = (details ?? []).filter(d => d.agent)
  if (agents.length === 0) return null
  const sum = (pick: (d: StepDetail) => number | undefined) => agents.reduce((s, d) => s + (pick(d) ?? 0), 0)
  return {
    usd: sum(d => d.usd),
    steps: sum(d => d.steps ?? 1),
    count: agents.length,
    running: agents.some(d => d.done === false),
    read: sum(d => d.read),
    write: sum(d => d.write),
    output: sum(d => d.output),
    input: sum(d => d.input),
    hasParts: agents.every(d => d.read !== undefined && d.output !== undefined),
  }
}

/**
 * 모델 견줌 한 줄(9c): "같은 질문 12개를 Sonnet 5.5 로 ~$6.20 · 지금 Opus 5.5 $12.40". 이 세션 끝난 질문의 토큰을 다른 모델 요율로
 * 다시 센 값 — 요청 1회(읽기)만으론 두 모델 차이가 안 보였다(읽기 요율이 같다, 동료). 견줄 모델이 없거나 질문이 없으면 null
 */
export function modelCompareText(turns: readonly { cost: CostParts; appUsd?: number; model?: string; details?: readonly StepDetail[] }[], model: string, ttl?: number): string | null {
  const other = otherModelOf(model)
  const r = other ? repriceTurns(turns, other, ttl) : null
  if (!other || !r) return null
  // 질문들이 다 지금 모델이면 "지금 Opus 5.5 $Y", 모델을 바꿔 가며 했으면 "실제 $Y"(지금 모델 이름을 붙이면 틀린 말)
  const isAllNow = r.models.length === 1 && r.models[0] === modelKey(model)
  return L(
    `같은 질문 ${r.count}개를 ${modelName(other)} 로 ~${fmtUsd(r.other)} · ${isAllNow ? `지금 ${modelName(model)}` : '실제'} ${fmtUsd(r.now)}`,
    `The same ${plural(r.count, 'question')} on ${modelName(other)} ~${fmtUsd(r.other)} · ${isAllNow ? `now ${modelName(model)}` : 'actual'} ${fmtUsd(r.now)}`,
  )
}

/** 🤖 머리 — 터미널은 그림 글자 대신 글 */
export function agentHead(): string {
  return onTerminal() ? L('에이전트', 'agents') : '🤖'
}

/**
 * 질문별 비용 펼친 줄(자세히)의 요금 분해 — 줄마다: 메인(요청 수 · 금액 · 읽기 · 쓰기 · 출력) / 🤖 에이전트(개수 · 요청 수 · 금액 ·
 * 읽기 · 쓰기 · 출력) / ⚙ 앱 자체 요청. 예전엔 읽기 · 쓰기 · 출력이 메인 + 에이전트 합이라 에이전트가 얼마인지 안 보였다.
 * 요청 수도 줄마다 — 질문 값과 에이전트 값의 관계가 헷갈렸다. 에이전트가 없으면 한 줄(예전 꼴).
 * 에이전트 몫을 나눠 적기 전 기록(hasParts 아님)은 에이전트 합만. steps = 메인 요청 수(모르면 빼고)
 */
export function costBreakdown(cost: CostParts, appUsd?: number, details?: readonly StepDetail[], steps?: number): string[] {
  const parts = (read: number, write: number, output: number) =>
    L(`읽기 ${fmtUsd(read)} · 쓰기 ${fmtUsd(write)} · 출력 ${fmtUsd(output)}`, `read ${fmtUsd(read)} · write ${fmtUsd(write)} · output ${fmtUsd(output)}`)
  const reqs = steps === undefined ? '' : L(`요청 ${steps}회 `, `${plural(steps, 'request')} `)
  const hasApp = appUsd !== undefined && appUsd >= APP_MIN_USD
  const app = hasApp ? withIcon('⚙', L(`앱 자체 요청 ${fmtUsd(appUsd!)}`, `app's own requests ${fmtUsd(appUsd!)}`)) : null
  const a = agentSum(details)
  // 이 질문 뒤 컴팩트(🗜 줄)도 질문 값에 들어 있다 — 메인으로 세지 않게 따로(읽기 · 쓰기 · 출력으로는 못 나눠 금액만)
  const compactUsd = (details ?? []).reduce((s, d) => s + (d.compact ? d.usd : 0), 0)
  const compact = compactUsd >= APP_MIN_USD ? withIcon('🗜', L(`컴팩트 ${fmtUsd(compactUsd)}`, `Compact ${fmtUsd(compactUsd)}`)) : null
  if (!a && !compact) return [`${steps === undefined ? '' : L(`요청 ${steps}회 · `, `${plural(steps, 'request')} · `)}${parts(cost.read, cost.write, cost.output)}${app ? ` · ${app}` : ''}`]
  const mainUsd = Math.max(0, cost.usd - (a?.usd ?? 0) - (hasApp ? appUsd! : 0) - compactUsd)
  // 메인의 읽기 · 쓰기 · 출력은 에이전트 몫을 나눠 적었고(0.4.0 기록) 컴팩트가 없을 때만 — 그 밖엔 금액만
  const main =
    (!a || a.hasParts) && !compact
      ? `${L('메인', 'Main')} ${reqs}${fmtUsd(mainUsd)} · ${parts(Math.max(0, cost.read - (a?.read ?? 0)), Math.max(0, cost.write - (a?.write ?? 0)), Math.max(0, cost.output - (a?.output ?? 0)))}`
      : `${L('메인', 'Main')} ${reqs}${fmtUsd(mainUsd)}`
  const agentHeadText = a ? withIcon('🤖', L(`에이전트 ${a.count}개 · 요청 ${a.steps}회 ${fmtUsd(a.usd)}`, `${plural(a.count, 'agent')} · ${plural(a.steps, 'request')} ${fmtUsd(a.usd)}`)) : ''
  const agents = !a ? null : a.hasParts ? `${agentHeadText} · ${parts(a.read, a.write, a.output)}` : agentHeadText
  return [main, ...(agents ? [agents] : []), ...(compact ? [compact] : []), ...(app ? [app] : [])]
}

/**
 * 답변 아래 칩 상세(정보량 전부): 맨 위 줄들의 합 = 질문 값 — 메인 · 🤖 에이전트 · 🗜 컴팩트 · ⚙ 앱 자체 요청. 메인 아래에 들여
 * 쓰는 동작 줄은 메인 금액을 나눈 것(mainSteps). 같은 깊이에 다 두니 동작 줄까지 더하는 항목으로 읽혔다. 읽기 · 쓰기 · 출력은 메인뿐일 때만, 금액 뒤 괄호로 — " · " 로 이으니 금액과 나란한 항목처럼 읽혔다.
 * 그 밖엔 몫을 못 나눈다(사용량 패널에 있다). steps = 메인 요청 수
 */
export function answerBreakdown(
  cost: CostParts,
  appUsd: number | undefined,
  details: readonly StepDetail[] = [],
  steps?: number,
): { main: string; mainSteps: StepDetail[]; others: string[] } {
  const a = agentSum(details)
  const hasApp = appUsd !== undefined && appUsd >= APP_MIN_USD
  const compactUsd = details.reduce((s, d) => s + (d.compact ? d.usd : 0), 0)
  const hasCompact = compactUsd >= APP_MIN_USD
  const alone = !a && !hasApp && !hasCompact
  const reqs = steps === undefined ? '' : L(`요청 ${steps}회 `, `${plural(steps, 'request')} `)
  const mainUsd = Math.max(0, cost.usd - (a?.usd ?? 0) - (hasApp ? appUsd! : 0) - (hasCompact ? compactUsd : 0))
  const parts = alone
    ? L(
        ` (읽기 ${fmtUsd(cost.read)} · 쓰기 ${fmtUsd(cost.write)} · 출력 ${fmtUsd(cost.output)})`,
        ` (read ${fmtUsd(cost.read)} · write ${fmtUsd(cost.write)} · output ${fmtUsd(cost.output)})`,
      )
    : ''
  const others = [
    a ? withIcon('🤖', L(`에이전트 ${a.count}개 · 요청 ${a.steps}회 ${fmtUsd(a.usd)}`, `${plural(a.count, 'agent')} · ${plural(a.steps, 'request')} ${fmtUsd(a.usd)}`)) : null,
    hasCompact ? withIcon('🗜', L(`컴팩트 ${fmtUsd(compactUsd)}`, `Compact ${fmtUsd(compactUsd)}`)) : null,
    hasApp ? withIcon('⚙', L(`앱 자체 요청 ${fmtUsd(appUsd!)}`, `app's own requests ${fmtUsd(appUsd!)}`)) : null,
  ].filter((x): x is string => x !== null)
  return { main: `${L('메인 ', 'Main ')}${reqs}${fmtUsd(mainUsd)}${parts}`, mainSteps: details.filter(d => !d.agent && !d.app && !d.compact), others }
}

/**
 * 동작별 값 줄을 줄일 때: 비싼 것 n 개만 남기고(순서는 그대로) 나머지는 개수 · 합으로 — 답변 아래(정보량 전부)가 요청 많은 질문에서
 * 끝없이 길어지지 않게
 */
export function topSteps(details: readonly StepDetail[], n: number): { shown: StepDetail[]; rest: number; restUsd: number } {
  const top = new Set([...details].sort((a, b) => b.usd - a.usd).slice(0, n))
  const shown = details.filter(d => top.has(d))
  return { shown, rest: details.length - shown.length, restUsd: details.reduce((sum, d) => sum + (top.has(d) ? 0 : d.usd), 0) }
}

/**
 * 최근 n 개를 최신 위로 + 그 앞 수 · 합(0.5 묶음 2 N18 — 사용자: 비싼 20개가 아니라 최근 20개, 질문 목록처럼 최신이 위). 줄 수는 같아
 * 패널 크기 한도(size.test)는 그대로
 */
export function recentSteps(details: readonly StepDetail[], n: number): { shown: StepDetail[]; rest: number; restUsd: number } {
  const from = Math.max(0, details.length - n)
  return { shown: details.slice(from).reverse(), rest: from, restUsd: details.slice(0, from).reduce((sum, d) => sum + d.usd, 0) }
}

/** 질문 하나의 요청 수 — 메인 + 에이전트(질문 값에 들어 있는 것과 맞게). steps = 메인 요청 수 */
export function callsOf(steps: number, details?: readonly StepDetail[]): number {
  return steps + (agentSum(details)?.steps ?? 0)
}

/**
 * 질문 줄의 에이전트: 간략 = "🤖 에이전트 1개", 자세히 = "🤖 에이전트 1개 $3.56 포함" — 질문 값에 이미 들어 있다는 말을 붙인다.
 * 값 옆에 "🤖 $3.56" 만 있으니 $16.43 과의 관계가 헷갈렸다. 도는 중이면 그 말도. 없으면 null
 */
export function agentPart(details: readonly StepDetail[] | undefined, withUsd: boolean): string | null {
  const a = agentSum(details)
  if (!a) return null
  const run = a.running ? L(' · 도는 중', ' · running') : ''
  return withIcon(
    '🤖',
    withUsd
      ? L(`에이전트 ${a.count}개 ${fmtUsd(a.usd)} 포함${run}`, `${plural(a.count, 'agent')} ${fmtUsd(a.usd)} included${run}`)
      : L(`에이전트 ${a.count}개${run}`, `${plural(a.count, 'agent')}${run}`),
  )
}

/** 질문별 비용 동작 줄의 컴팩트 글: "🗜 컴팩트 530k → 84k" */
export function compactStepText(c: { before: number; after: number | null }, usd: number): string {
  const after = c.after === null ? L('?(다음 요청 때 잼)', '?(measured at the next request)') : fmtTokens(c.after)
  return withIcon('🗜', `${L('컴팩트', 'Compact')} ${fmtTokens(c.before)} → ${after}${usd === 0 ? L(' · 미리 계산한 요약을 씀', ' · used a precomputed summary') : ''}`)
}

// ── 컴팩트 ───────────────────────────────────────────────────────

export function limitName(kind: string): string {
  if (kind === 'five_hour') return L('5시간', '5h')
  if (kind === 'seven_day') return L('7일', '7d')
  if (kind === 'spend_limit') return L('지출 한도', 'Spend limit')
  return kind
}

/** 숫자 꼴(설정 ctxUnit): 크기 281k · % 28%(최대 컨텍스트 대비 — 앱 "11% 사용됨" 과 같은 셈) · 둘 다 281k(28%) */
export type CtxUnit = 'size' | 'pct' | 'both'

/** 컨텍스트 크기 글(B1, 0.6.1 피드백) — 창(최대 컨텍스트)을 모르면 크기 */
export function ctxNumText(tokens: number, window: number | null | undefined, unit: CtxUnit): string {
  const pct = window && window > 0 ? `${Math.round((tokens / window) * 100)}%` : null
  if (unit === 'pct' && pct) return pct
  if (unit === 'both' && pct) return `${fmtTokens(tokens)}(${pct})`
  return fmtTokens(tokens)
}

/** 컴팩트 구간 · 기준 글 — 같은 숫자 꼴: "250k~300k" · "25~30%" · "250k~300k(25~30%)" */
export function rangeNumText(t: { isRange?: boolean; ctxWarn: number; ctxCut: number }, window: number | null | undefined, unit: CtxUnit): string {
  const sizes = t.isRange ? `${fmtTokens(t.ctxWarn)}~${fmtTokens(t.ctxCut)}` : fmtTokens(t.ctxCut)
  if (!window || !(window > 0) || unit === 'size') return sizes
  const pct = (n: number) => Math.round((n / window) * 100)
  const pcts = t.isRange ? `${pct(t.ctxWarn)}~${pct(t.ctxCut)}%` : `${pct(t.ctxCut)}%`
  return unit === 'pct' ? pcts : `${sizes}(${pcts})`
}

/**
 * 크기 구간 이름(현황 컴팩트 카드 — 드롭다운 · ★ 추천 · 크기별 비용 표)의 숫자 꼴: "250k ~ 300k" · "25 ~ 30%" · "250k ~ 300k(25 ~ 30%)".
 * 0.8.1 S9: 예전엔 바만 설정 숫자 꼴을 따르고 현황은 늘 크기였다
 */
export function bandNumText(a: number, b: number, window: number | null | undefined, unit: CtxUnit): string {
  const sizes = `${fmtTokens(a)} ~ ${fmtTokens(b)}`
  if (!window || !(window > 0) || unit === 'size') return sizes
  const pct = (n: number) => Math.round((n / window) * 100)
  const pcts = `${pct(a)} ~ ${pct(b)}%`
  return unit === 'pct' ? pcts : `${sizes}(${pcts})`
}

/** "Opus 5.5 · high" — 모델 이름과 노력도 */
export function modelText(model: string | undefined, effort: string | undefined): string {
  return [model ? modelName(model) : '', effort ?? ''].filter(Boolean).join(' · ')
}

/** "Opus 5.5 → Sonnet 5.5" — 모델을 바꾼 직후(첫 요청 전) 띠 · 패널이 쓰는 글. 어디서 왔는지 모르면 새 모델만 */
export function switchText(from: string | null | undefined, to: string): string {
  return from ? `${modelName(from)} → ${modelName(to)}` : modelName(to)
}

/** 도구 호출 하나의 이름: 도구와 대상(파일 이름 · 설명 · 검색어) */
function toolLabel(tool: { name: string; input: unknown }): string {
  const input = (tool.input ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  // Windows 실제 경로는 역슬래시라 / 로만 자르면 전체 경로가 나왔다 — 둘 다로 자른다
  const file = (v: unknown) => text(v).split(/[\\/]/).pop() ?? ''
  switch (tool.name) {
    case 'Bash':
    case 'PowerShell':
      return `${tool.name} ${text(input.description) || text(input.command)}`
    case 'Read':
    case 'Write':
    case 'Edit':
      return `${tool.name} ${file(input.file_path)}`
    case 'Grep':
    case 'Glob':
      return `${tool.name} ${text(input.pattern)}`
    case 'Agent':
      return `Agent ${text(input.description)}`
    case 'WebFetch':
      return `WebFetch ${text(input.url)}`
    case 'WebSearch':
      return `WebSearch ${text(input.query)}`
    default:
      // mcp__서버__도구 → 도구
      return tool.name.replace(/^mcp__.+?__/, '')
  }
}

/** 요청 하나가 한 일: 도구를 불렀으면 그 이름들, 아니면 답변 작성. 70자로 자른다 */
export function stepLabel(toolUses: readonly { name: string; input: unknown }[]): string {
  if (toolUses.length === 0) return L('답변 작성', 'Writing the answer')
  const label = toolUses.map(toolLabel).join(', ').replace(/\s+/g, ' ').trim()
  return label.length > 70 ? `${label.slice(0, 69)}…` : label
}
