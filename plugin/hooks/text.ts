import type { CostParts } from '../types'
import { fmtTokens, fmtUsd, modelName } from './cost'
import { L } from './i18n'
import { withIcon } from './glyph'
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
export function costBreakdown(cost: CostParts, appUsd?: number): string {
  const app = appUsd !== undefined && appUsd >= APP_MIN_USD ? L(` · 앱 자체 요청 ${fmtUsd(appUsd)}`, ` · app's own requests ${fmtUsd(appUsd)}`) : ''
  return L(
    `읽기 ${fmtUsd(cost.read)} · 쓰기 ${fmtUsd(cost.write)} · 출력 ${fmtUsd(cost.output)}${app}`,
    `read ${fmtUsd(cost.read)} · write ${fmtUsd(cost.write)} · output ${fmtUsd(cost.output)}${app}`,
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
