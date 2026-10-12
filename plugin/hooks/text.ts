import type { CostParts, StepDetail } from '../types'
import { fmtTokens, fmtUsd, modelKey, modelName, otherModelOf, repriceTurns } from './cost'
import { L, plural } from './i18n'
import { onTerminal, withIcon } from './glyph'
import { isTidyPrompt } from './tidy'

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
  if (isTidyPrompt(one)) return withIcon('🗜', L('저장하고 컴팩트 — 저장 턴', 'Save & compact — save turn'))
  return clipText(one, PROMPT_KEEP)
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
 * 진행 중 · 끝난 질문 값 뒤에 붙는 에이전트 몫: " · 🤖 $1.93 · 요청 6회 · 도는 중". 질문 값은 에이전트까지 더한 합이라 그중
 * 얼마가 에이전트인지 따로. 끝났으면 "도는 중" 없이. 없으면 빈 글
 */
export function agentNote(details: readonly StepDetail[] | undefined): string {
  const a = agentSum(details)
  if (!a) return ''
  return L(
    ` · ${agentHead()} ${fmtUsd(a.usd)} · 요청 ${a.steps}회${a.running ? ' · 도는 중' : ''}`,
    ` · ${agentHead()} ${fmtUsd(a.usd)} · ${plural(a.steps, 'request')}${a.running ? ' · running' : ''}`,
  )
}

/**
 * 질문별 비용 펼친 줄의 요금 분해 — 줄마다: 메인(읽기 · 쓰기 · 출력) / 🤖 에이전트(합 · 읽기 · 쓰기 · 출력) / ⚙ 앱 자체 요청.
 * 예전엔 읽기 · 쓰기 · 출력이 메인 + 에이전트 합이라 에이전트가 얼마인지 안 보였다. 에이전트가 없으면 한 줄(예전 꼴).
 * 에이전트 몫을 나눠 적기 전 기록(hasParts 아님)은 에이전트 합만
 */
export function costBreakdown(cost: CostParts, appUsd?: number, details?: readonly StepDetail[]): string[] {
  const parts = (read: number, write: number, output: number) =>
    L(`읽기 ${fmtUsd(read)} · 쓰기 ${fmtUsd(write)} · 출력 ${fmtUsd(output)}`, `read ${fmtUsd(read)} · write ${fmtUsd(write)} · output ${fmtUsd(output)}`)
  const hasApp = appUsd !== undefined && appUsd >= APP_MIN_USD
  const app = hasApp ? withIcon('⚙', L(`앱 자체 요청 ${fmtUsd(appUsd!)}`, `app's own requests ${fmtUsd(appUsd!)}`)) : null
  const a = agentSum(details)
  // 이 질문 뒤 컴팩트(🗜 줄)도 질문 값에 들어 있다 — 메인으로 세지 않게 따로(읽기 · 쓰기 · 출력으로는 못 나눠 금액만)
  const compactUsd = (details ?? []).reduce((s, d) => s + (d.compact ? d.usd : 0), 0)
  const compact = compactUsd >= APP_MIN_USD ? withIcon('🗜', L(`컴팩트 ${fmtUsd(compactUsd)}`, `Compact ${fmtUsd(compactUsd)}`)) : null
  if (!a && !compact) return [`${parts(cost.read, cost.write, cost.output)}${app ? ` · ${app}` : ''}`]
  const mainUsd = Math.max(0, cost.usd - (a?.usd ?? 0) - (hasApp ? appUsd! : 0) - compactUsd)
  // 메인의 읽기 · 쓰기 · 출력은 에이전트 몫을 나눠 적었고(0.4.0 기록) 컴팩트가 없을 때만 — 그 밖엔 금액만
  const main =
    (!a || a.hasParts) && !compact
      ? `${L('메인', 'Main')} ${fmtUsd(mainUsd)} · ${parts(Math.max(0, cost.read - (a?.read ?? 0)), Math.max(0, cost.write - (a?.write ?? 0)), Math.max(0, cost.output - (a?.output ?? 0)))}`
      : `${L('메인', 'Main')} ${fmtUsd(mainUsd)}`
  const agents = !a
    ? null
    : a.hasParts
      ? `${withIcon('🤖', L(`에이전트 ${fmtUsd(a.usd)}`, `Agents ${fmtUsd(a.usd)}`))} · ${parts(a.read, a.write, a.output)}`
      : withIcon('🤖', L(`에이전트 ${fmtUsd(a.usd)}`, `Agents ${fmtUsd(a.usd)}`))
  return [main, ...(agents ? [agents] : []), ...(compact ? [compact] : []), ...(app ? [app] : [])]
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
  const file = (v: unknown) => text(v).split(/[\/]/).pop() ?? ''
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
