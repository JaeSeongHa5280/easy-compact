import type { CostParts, EffortOutput, StepDetail, StepSwitch } from '../types'
import { approxUsd, fmtTokens, fmtUsd, modelKey, modelName, otherModelOf, repriceTurns } from './cost'
import { L, plural } from './i18n'
import { onTerminal, withIcon } from './glyph'
import { autoTurnName, autoTurnOf, isTidyPrompt } from './tidy'

export const paneTitle = () => L('이지 컴팩트', 'Easy Compact')

export const APP_MIN_USD = 0.005

export const PLUGIN_SENT = /^The [\w.-]+ plugin sent a message:\s*/

export const PROMPT_KEEP = 1000

export function promptHead(text: string): string {
  const notice = noticeName(text)
  if (notice !== null) return notice
  let s = text
  for (const tag of HIDDEN_TAGS) s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?(?:</${tag}>|$)`, 'g'), ' ')
  s = s
    .replace(/<command-name>\s*([^<]*?)\s*<\/command-name>/g, ' $1 ')
    .replace(/<command-args>([^<]*)<\/command-args>/g, ' $1 ')
    .replace(/<bash-input>([^<]*)<\/bash-input>/g, ' ! $1 ')
    .replace(/\[Image #(\d+)\]/g, (_m, n: string) => L(`[그림 ${n}]`, `[image ${n}]`))
    .replace(/\[Image: source: [^\]]*\]/g, () => L('[그림]', '[image]'))
  const one = s
    .replace(/<pasted_content\b[^>]*>/g, ' ')
    .replace(/<\/pasted_content\b[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(PLUGIN_SENT, '')
  if (isTidyPrompt(one)) return withIcon('🗜', L(...TIDY_TURN))
  const auto = autoTurnOf(one)
  if (auto !== null) return autoTurnName(auto)
  const bare = one.replace(/^🗜\s*/, '')
  if (bare === TIDY_TURN[0] || bare === TIDY_TURN[1]) return withIcon('🗜', L(...TIDY_TURN))
  const bareC = one.replace(/^↪\s*/, '')
  if (bareC === CONTINUED[0] || bareC === CONTINUED[1]) return continuedName()
  const plain = one.replace(/^(?:⚙|💬)\s*/, '')
  for (const [, icon, ko, en] of NOTICE_TURNS) {
    const label = plain.startsWith(ko) ? ko : plain.startsWith(en) ? en : null
    if (label !== null) return withIcon(icon, L(ko, en)) + plain.slice(label.length)
  }
  const at = ATTACH_HEAD.exec(one)
  if (at) {
    const image = Number(at[1] ?? at[2] ?? 0)
    const other = Number(at[3] ?? at[4] ?? 0)
    return attachHead(promptHead(one.slice(at[0].length)), image > 0 ? { image, other: 0 } : { image: 0, other })
  }
  return clipText(one, PROMPT_KEEP)
}

const HIDDEN_TAGS = ['system-reminder', 'user-prompt-submit-hook', 'local-command-caveat', 'local-command-stdout', 'local-command-stderr', 'bash-stdout', 'bash-stderr', 'command-message']

const NOTICE_TURNS: readonly (readonly [RegExp, string, string, string])[] = [
  [/^\s*\[SYSTEM NOTIFICATION\b|<task-notification>/, '⚙', '백그라운드 작업 알림', 'Background task notice'],
  [/^\s*<side-sessions-event>/, '⚙', '다른 세션 소식', 'Other sessions update'],
  [/^\s*<ci-monitor-event>/, '⚙', 'PR 소식', 'PR update'],
]

function noticeName(text: string): string | null {
  for (const [re, icon, ko, en] of NOTICE_TURNS) {
    if (!re.test(text)) continue
    const name = /<summary>[^<"]*"([^"<]{1,120})"/.exec(text)?.[1]
    return withIcon(icon, L(ko, en)) + (name ? ` — ${name}` : '')
  }
  return null
}

export type AttachCounts = { readonly image: number; readonly other: number }

const ATTACH_HEAD = /^(?:🖼\s+|📎\s+)?(?:그림 (\d+)장|(\d+) images?|첨부 (\d+)개|(\d+) attachments?)(?: · |$)/

export function attachHead(head: string, a: AttachCounts | null): string {
  const total = a ? a.image + a.other : 0
  if (!a || total === 0) return head
  const label =
    a.other === 0
      ? withIcon('🖼', L(`그림 ${a.image}장`, `${a.image} image${a.image === 1 ? '' : 's'}`))
      : withIcon('📎', L(`첨부 ${total}개`, `${total} attachment${total === 1 ? '' : 's'}`))
  return head ? `${label} · ${head}` : label
}

const CONTINUED = ['새 질문 없이 이어서 한 작업', 'Continued without a new question'] as const

export function continuedName(): string {
  return withIcon('↪', L(...CONTINUED))
}

const TIDY_TURN = ['이지 컴팩트 — 저장 턴', 'Easy Compact — save turn'] as const

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

export function labelNow(label: string): string {
  for (const [ko, en] of MOD_LABELS) if (label === ko || label === en) return L(ko, en)
  return label
}

export function clipText(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text
}

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

export function cellsOf(text: string): number {
  let n = 0
  for (const ch of text) n += isWide(ch.codePointAt(0)!) ? 2 : 1
  return n
}

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

export function widthOf(text: string, isTerminal: boolean): number {
  return isTerminal ? cellsOf(text) : Math.ceil(textCh(text))
}

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

export function gainText(usd: number): string {
  return `${usd >= 0 ? L('이득', 'gain') : L('손해', 'loss')} ${fmtUsd(Math.abs(usd))}`
}

export function agoText(atMs: number, nowMs: number): string {
  if (!Number.isFinite(atMs) || !Number.isFinite(nowMs) || nowMs === 0) return ''
  const mins = Math.max(0, Math.round((nowMs - atMs) / 60000))
  if (mins < 1) return L('방금', 'just now')
  if (mins < 60) return L(`${mins}분 전`, `${mins}m ago`)
  const h = Math.floor(mins / 60)
  return h < 24 ? L(`${h}시간 전`, `${h}h ago`) : L(`${Math.floor(h / 24)}일 전`, `${Math.floor(h / 24)}d ago`)
}

export type AgentSum = { usd: number; steps: number; count: number; running: boolean; runningCount: number; read: number; write: number; output: number; input: number; hasParts: boolean }

export function agentSum(details: readonly StepDetail[] | undefined): AgentSum | null {
  const agents = (details ?? []).filter(d => d.agent)
  if (agents.length === 0) return null
  const sum = (pick: (d: StepDetail) => number | undefined) => agents.reduce((s, d) => s + (pick(d) ?? 0), 0)
  return {
    usd: sum(d => d.usd),
    steps: sum(d => d.steps ?? 1),
    count: agents.length,
    running: agents.some(d => d.done === false),
    runningCount: agents.filter(d => d.done === false).length,
    read: sum(d => d.read),
    write: sum(d => d.write),
    output: sum(d => d.output),
    input: sum(d => d.input),
    hasParts: agents.every(d => d.read !== undefined && d.output !== undefined),
  }
}

export function modelCompareText(turns: readonly { cost: CostParts; appUsd?: number; model?: string; details?: readonly StepDetail[] }[], model: string, ttl?: number): string | null {
  const other = otherModelOf(model)
  const r = other ? repriceTurns(turns, other, ttl) : null
  if (!other || !r) return null
  const isAllNow = r.models.length === 1 && r.models[0] === modelKey(model)
  return L(
    `같은 질문 ${r.count}개를 ${modelName(other)} 로 ${approxUsd(r.other)} · ${isAllNow ? `지금 ${modelName(model)}` : '실제'} ${fmtUsd(r.now)}`,
    `The same ${plural(r.count, 'question')} on ${modelName(other)} ${approxUsd(r.other)} · ${isAllNow ? `now ${modelName(model)}` : 'actual'} ${fmtUsd(r.now)}`,
  )
}

export function agentHead(): string {
  return onTerminal() ? L('에이전트', 'agents') : '🤖'
}

export function effortSplit(list: readonly EffortOutput[] | undefined): EffortOutput[] | null {
  return list && list.length >= 2 && list.every(e => e.effort !== '') ? [...list] : null
}

export function costBreakdown(
  cost: CostParts,
  appUsd?: number,
  details?: readonly StepDetail[],
  steps?: number,
  byEffort?: readonly EffortOutput[],
  ultra?: boolean,
): string[] {
  const split = effortSplit(byEffort)
  const think = (isMain: boolean) => {
    const by = isMain && split ? split.map(e => `${effortLabel(e.effort, ultra)} ${fmtUsd(e.usd)}`).join(' · ') : null
    return by ? L(`(생각 포함 — ${by})`, ` (incl. thinking — ${by})`) : L('(생각 포함)', ' (incl. thinking)')
  }
  const parts = (read: number, write: number, output: number, isMain = false) =>
    L(
      `읽기 ${fmtUsd(read)} · 쓰기 ${fmtUsd(write)} · 출력 ${fmtUsd(output)}${think(isMain)}`,
      `read ${fmtUsd(read)} · write ${fmtUsd(write)} · output ${fmtUsd(output)}${think(isMain)}`,
    )
  const reqs = steps === undefined ? '' : L(`요청 ${steps}회 `, `${plural(steps, 'request')} `)
  const hasApp = appUsd !== undefined && appUsd >= APP_MIN_USD
  const app = hasApp ? withIcon('⚙', L(`앱 자체 요청 ${fmtUsd(appUsd!)}`, `app's own requests ${fmtUsd(appUsd!)}`)) : null
  const a = agentSum(details)
  const compactUsd = (details ?? []).reduce((s, d) => s + (d.compact ? d.usd : 0), 0)
  const compact = compactUsd >= APP_MIN_USD ? withIcon('🗜', L(`컴팩트 ${fmtUsd(compactUsd)}`, `Compact ${fmtUsd(compactUsd)}`)) : null
  if (!a && !compact) return [`${steps === undefined ? '' : L(`요청 ${steps}회 · `, `${plural(steps, 'request')} · `)}${parts(cost.read, cost.write, cost.output, true)}${app ? ` · ${app}` : ''}`]
  const mainUsd = Math.max(0, cost.usd - (a?.usd ?? 0) - (hasApp ? appUsd! : 0) - compactUsd)
  const main =
    (!a || a.hasParts) && !compact
      ? `${L('메인', 'Main')} ${reqs}${fmtUsd(mainUsd)} · ${parts(Math.max(0, cost.read - (a?.read ?? 0)), Math.max(0, cost.write - (a?.write ?? 0)), Math.max(0, cost.output - (a?.output ?? 0)), true)}`
      : `${L('메인', 'Main')} ${reqs}${fmtUsd(mainUsd)}`
  const agentHeadText = a ? withIcon('🤖', L(`에이전트 ${a.count}개 · 요청 ${a.steps}회 ${fmtUsd(a.usd)}`, `${plural(a.count, 'agent')} · ${plural(a.steps, 'request')} ${fmtUsd(a.usd)}`)) : ''
  const agents = !a ? null : a.hasParts ? `${agentHeadText} · ${parts(a.read, a.write, a.output)}` : agentHeadText
  return [main, ...(agents ? [agents] : []), ...(compact ? [compact] : []), ...(app ? [app] : [])]
}

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

export function recentSteps(details: readonly StepDetail[], n: number): { shown: StepDetail[]; rest: number; restUsd: number } {
  const from = Math.max(0, details.length - n)
  return { shown: details.slice(from).reverse(), rest: from, restUsd: details.slice(0, from).reduce((sum, d) => sum + d.usd, 0) }
}

export function callsOf(steps: number, details?: readonly StepDetail[]): number {
  return steps + (agentSum(details)?.steps ?? 0)
}

export function agentPart(details: readonly StepDetail[] | undefined, withUsd: boolean): string | null {
  const a = agentSum(details)
  if (!a) return null
  const head = L(`에이전트 ${a.count}개`, plural(a.count, 'agent'))
  if (!a.running) {
    const done = L(`${head} 완료`, `${head} done`)
    return withIcon('🤖', withUsd ? L(`${done} · ${fmtUsd(a.usd)} 포함`, `${done} · ${fmtUsd(a.usd)} included`) : done)
  }
  const run = L(' · 도는 중', ' · running')
  return withIcon('🤖', withUsd ? L(`${head} ${fmtUsd(a.usd)} 포함${run}`, `${head} ${fmtUsd(a.usd)} included${run}`) : `${head}${run}`)
}

export function compactStepText(c: { before: number; after: number | null }, usd: number): string {
  const after = c.after === null ? L('?(다음 요청 때 잼)', '?(measured at the next request)') : fmtTokens(c.after)
  return withIcon('🗜', `${L('컴팩트', 'Compact')} ${fmtTokens(c.before)} → ${after}${usd === 0 ? L(' · 미리 계산한 요약을 씀', ' · used a precomputed summary') : ''}`)
}

export function limitName(kind: string): string {
  if (kind === 'five_hour') return L('5시간', '5h')
  if (kind === 'seven_day') return L('7일', '7d')
  if (kind === 'spend_limit') return L('지출 한도', 'Spend limit')
  return kind
}

export type CtxUnit = 'size' | 'pct' | 'both'

export function ctxNumText(tokens: number, window: number | null | undefined, unit: CtxUnit): string {
  const pct = window && window > 0 ? `${Math.round((tokens / window) * 100)}%` : null
  if (unit === 'pct' && pct) return pct
  if (unit === 'both' && pct) return `${fmtTokens(tokens)}(${pct})`
  return fmtTokens(tokens)
}

export function rangeNumText(t: { isRange?: boolean; ctxWarn: number; ctxCut: number }, window: number | null | undefined, unit: CtxUnit): string {
  const sizes = t.isRange ? `${fmtTokens(t.ctxWarn)}~${fmtTokens(t.ctxCut)}` : fmtTokens(t.ctxCut)
  if (!window || !(window > 0) || unit === 'size') return sizes
  const pct = (n: number) => Math.round((n / window) * 100)
  const pcts = t.isRange ? `${pct(t.ctxWarn)}~${pct(t.ctxCut)}%` : `${pct(t.ctxCut)}%`
  return unit === 'pct' ? pcts : `${sizes}(${pcts})`
}

export function bandNumText(a: number, b: number, window: number | null | undefined, unit: CtxUnit): string {
  const sizes = `${fmtTokens(a)} ~ ${fmtTokens(b)}`
  if (!window || !(window > 0) || unit === 'size') return sizes
  const pct = (n: number) => Math.round((n / window) * 100)
  const pcts = `${pct(a)} ~ ${pct(b)}%`
  return unit === 'pct' ? pcts : `${sizes}(${pcts})`
}

export function effortName(effort: string): string {
  const names: Readonly<Record<string, readonly [string, string]>> = {
    low: ['낮음', 'Low'],
    medium: ['중간', 'Medium'],
    high: ['높음', 'High'],
    xhigh: ['엑스트라', 'Extra'],
    max: ['최대', 'Max'],
  }
  const n = names[effort]
  return n ? L(n[0], n[1]) : effort
}

export function modelText(model: string | undefined, effort: string | undefined): string {
  return [model ? modelName(model) : '', effort ? effortName(effort) : ''].filter(Boolean).join(' · ')
}

function switchValue(kind: StepSwitch['kind'], v: string): string {
  return kind === 'model' ? modelName(v) : effortName(v)
}

function switchKindName(kind: StepSwitch['kind']): string {
  return kind === 'model' ? L('모델', 'model') : L('생각 깊이', 'effort')
}

function changeText(kind: StepSwitch['kind'], from: string, to: string, at: string | null): string {
  const name = switchKindName(kind)
  return at === null ? L(`${name} 변경: ${from} → ${to}`, `${name} change: ${from} → ${to}`) : L(`${at} ${name} 변경: ${from} → ${to}`, `${name} change ${at}: ${from} → ${to}`)
}

export function effortLabel(effort: string | undefined, ultra: boolean | undefined): string {
  if (!ultra) return effort ? effortName(effort) : ''
  return effort && effort !== 'xhigh' ? `Ultracode(${effortName(effort)})` : 'Ultracode'
}

export function effortKey(effort: string | undefined, ultra: boolean | undefined): string | null {
  if (!ultra) return effort ?? null
  return effort && effort !== 'xhigh' ? `ultracode:${effort}` : 'ultracode'
}

export function stepSwitchText(s: StepSwitch): string {
  return changeText(s.kind, switchValue(s.kind, s.from), switchValue(s.kind, s.to), null)
}

export function betweenSwitchText(kind: StepSwitch['kind'], from: string, to: string): string {
  return changeText(kind, from, to, L('이 질문부터', 'from this question'))
}

export function midSwitchText(switches: readonly StepSwitch[] | undefined, kind: StepSwitch['kind']): string | null {
  const own = (switches ?? []).filter(s => s.kind === kind)
  if (own.length === 0) return null
  if (own.length === 1) return changeText(kind, switchValue(kind, own[0].from), switchValue(kind, own[0].to), L(`요청 ${own[0].at}부터`, `from request ${own[0].at}`))
  const chain = [own[0].from, ...own.map(s => s.to)].map(v => switchValue(kind, v)).join(' → ')
  const ats = own.map(s => s.at).join(' · ')
  return L(`${switchKindName(kind)} 변경: ${chain}(요청 ${ats}부터)`, `${switchKindName(kind)} change: ${chain} (from requests ${ats})`)
}

export function switchTags(details: readonly StepDetail[], steps: number, switches: readonly StepSwitch[] | undefined): Map<StepDetail, string> {
  const tags = new Map<StepDetail, string>()
  if (!switches || switches.length === 0) return tags
  const mains = details.filter(d => !d.agent && !d.app && !d.compact)
  const dropped = steps - mains.length
  for (const s of switches) {
    const d = mains[s.at - dropped - 1]
    if (!d) continue
    const text = stepSwitchText(s)
    tags.set(d, tags.has(d) ? `${tags.get(d)} · ${text}` : text)
  }
  return tags
}

export function switchText(from: string | null | undefined, to: string): string {
  return from ? `${modelName(from)} → ${modelName(to)}` : modelName(to)
}

export type ToolKind = 'read' | 'edit' | 'cmd' | 'agent' | 'app'

const TOOL_KINDS: Readonly<Record<string, ToolKind>> = {
  Read: 'read', Grep: 'read', Glob: 'read', LS: 'read', WebFetch: 'read', WebSearch: 'read', NotebookRead: 'read',
  Edit: 'edit', Write: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit',
  Bash: 'cmd', PowerShell: 'cmd', BashOutput: 'cmd', KillShell: 'cmd', Monitor: 'cmd',
  Agent: 'agent', Task: 'agent', Workflow: 'agent',
}

const TOOL_NAMES: Readonly<Record<string, readonly [string, string]>> = {
  update_plan: ['할 일 목록', 'Task list'],
  TodoWrite: ['할 일 목록', 'Task list'],
  wrap_up: ['마무리', 'Wrap-up'],
  SendUserFile: ['파일 보내기', 'Send file'],
  show_widget: ['그림 보이기', 'Show visual'],
  read_me: ['그림 안내 읽기', 'Read visual guide'],
  ToolSearch: ['도구 찾기', 'Find tools'],
  Skill: ['스킬', 'Skill'],
  mark_chapter: ['장 나누기', 'Mark chapter'],
  start_session: ['새 세션', 'Start session'],
  AskUserQuestion: ['물어보기', 'Ask'],
  SendMessage: ['메시지 보내기', 'Send message'],
  Artifact: ['아티팩트', 'Artifact'],
  Agent: ['에이전트 띄우기', 'Start agent'],
  Task: ['에이전트 띄우기', 'Start agent'],
}

const hasKey = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

export type ToolPart = { name: string; shown: string; kind: ToolKind; rest: string }

function isToolWord(w: string): boolean {
  return hasKey(TOOL_KINDS, w) || hasKey(TOOL_NAMES, w) || /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(w) || /^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+$/.test(w)
}

export function toolParts(label: string): ToolPart[] {
  const parts: ToolPart[] = []
  for (const piece of label.split(', ')) {
    const sp = piece.indexOf(' ')
    const word = sp < 0 ? piece : piece.slice(0, sp)
    if (isToolWord(word)) {
      const named = TOOL_NAMES[word]
      parts.push({ name: word, shown: named ? L(named[0], named[1]) : word, kind: TOOL_KINDS[word] ?? 'app', rest: sp < 0 ? '' : piece.slice(sp + 1) })
    } else if (parts.length > 0) {
      const last = parts[parts.length - 1]!
      last.rest = last.rest ? `${last.rest}, ${piece}` : piece
    } else return []
  }
  return parts
}

function toolLabel(tool: { name: string; input: unknown }): string {
  const input = (tool.input ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
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
      return tool.name.replace(/^mcp__.+?__/, '')
  }
}

export function stepLabel(toolUses: readonly { name: string; input: unknown }[]): string {
  if (toolUses.length === 0) return L('답변 작성', 'Writing the answer')
  const label = toolUses.map(toolLabel).join(', ').replace(/\s+/g, ' ').trim()
  return label.length > 240 ? `${label.slice(0, 239)}…` : label
}
