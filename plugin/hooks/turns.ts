import type { CostParts, StepDetail, Tokens, TurnSummary } from '../types'
import { costOf } from './cost'
import type { FlowRecord } from './flow'
import { L } from './i18n'
import { promptHead } from './text'

/**
 * N3(0.6.0): 질문별 비용을 세션마다 파일로 남기고(다시 연 세션에서 읽는다) — 이 판 전 세션은 대화 기록에서 다시 만든다.
 * 0.5.1 까지 질문 기록은 엔진 메모리에만 있어 앱을 다시 켜면 "질문별 비용" 이 비었다. 여기는 $ 없는 순수 함수만 — 파일 읽기 · 쓰기는 register.tsx
 */

/** 질문 기록 파일 판 — 꼴이 바뀌면 올린다(옛 판은 버리고 기록에서 다시 만든다) */
export const TURNS_V = 1

/** 질문 기록 파일 본문 */
export function serializeTurns(list: readonly TurnSummary[]): string {
  return JSON.stringify({ v: TURNS_V, turns: list })
}

/** 질문 기록 파일 → 목록. 판이 다르거나 깨졌으면 null(기록에서 다시 만든다) — 줄마다 꼭 있어야 할 칸만 본다 */
export function parseTurnsFile(text: string): TurnSummary[] | null {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return null
  }
  const o = j as { v?: unknown; turns?: unknown } | null
  if (!o || o.v !== TURNS_V || !Array.isArray(o.turns)) return null
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  return (o.turns as unknown[]).filter((t): t is TurnSummary => {
    const s = t as Partial<TurnSummary> | null
    return !!s && typeof s.prompt === 'string' && isNum(s.steps) && isNum(s.atMs) && !!s.cost && isNum(s.cost.usd)
  })
}

const ZERO: CostParts = { read: 0, write: 0, output: 0, input: 0, usd: 0 }

function addCost(a: CostParts, b: CostParts | null): CostParts {
  return b ? { read: a.read + b.read, write: a.write + b.write, output: a.output + b.output, input: a.input + b.input, usd: a.usd + b.usd } : a
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 하위 에이전트 한 갈래(기록 파일 하나): 첫 · 마지막 요청 시각 · 요청 수 · 모델별 토큰 */
export type AgentRun = { id: string; firstAtMs: number; lastAtMs: number; steps: number; byModel: Record<string, Tokens> }

/**
 * 하위 에이전트 기록 파일 본문 → 한 갈래. 같은 응답(message.id)은 첫 줄로 세고 뒤 줄은 출력만 최댓값으로(N1 과 같은 규칙).
 * 쓰기 종류(5분 · 1시간)는 기록의 cache_creation 칸 — 없으면 costOf 가 에이전트 기본(5분)으로 센다. 요청이 없으면 null
 */
export function agentRunFromText(id: string, text: string): AgentRun | null {
  const seen = new Map<string, Tokens>()
  const byModel: Record<string, Tokens> = {}
  let firstAtMs = 0
  let lastAtMs = 0
  let steps = 0
  for (const line of text.split('\n')) {
    if (!line.includes('"usage"')) continue
    let r: { type?: unknown; timestamp?: unknown; message?: { id?: unknown; model?: unknown; usage?: Record<string, unknown> } }
    try {
      r = JSON.parse(line) as typeof r
    } catch {
      continue
    }
    const m = r.message
    if (r.type !== 'assistant' || !m?.usage || typeof m.id !== 'string') continue
    const u = m.usage
    const prev = seen.get(m.id)
    if (prev) {
      const out = num(u.output_tokens)
      if (out > prev.output_tokens) {
        const model = typeof m.model === 'string' ? m.model : '?'
        const t = byModel[model]
        if (t) t.output_tokens += out - prev.output_tokens
        prev.output_tokens = out
      }
      continue
    }
    const cc = (typeof u.cache_creation === 'object' && u.cache_creation !== null ? u.cache_creation : null) as Record<string, unknown> | null
    const tokens: Tokens = {
      input_tokens: num(u.input_tokens),
      output_tokens: num(u.output_tokens),
      cache_read_input_tokens: num(u.cache_read_input_tokens),
      cache_creation_input_tokens: num(u.cache_creation_input_tokens),
      ...(cc ? { cache_creation_5m: num(cc.ephemeral_5m_input_tokens), cache_creation_1h: num(cc.ephemeral_1h_input_tokens) } : {}),
    }
    seen.set(m.id, { ...tokens })
    const model = typeof m.model === 'string' ? m.model : '?'
    const t = byModel[model]
    if (t) {
      t.input_tokens += tokens.input_tokens
      t.output_tokens += tokens.output_tokens
      t.cache_read_input_tokens += tokens.cache_read_input_tokens
      t.cache_creation_input_tokens += tokens.cache_creation_input_tokens
      if (tokens.cache_creation_5m !== undefined || tokens.cache_creation_1h !== undefined) {
        t.cache_creation_5m = (t.cache_creation_5m ?? 0) + (tokens.cache_creation_5m ?? 0)
        t.cache_creation_1h = (t.cache_creation_1h ?? 0) + (tokens.cache_creation_1h ?? 0)
      }
    } else byModel[model] = { ...tokens }
    const at = Date.parse(String(r.timestamp ?? '')) || 0
    if (at > 0 && (firstAtMs === 0 || at < firstAtMs)) firstAtMs = at
    if (at > lastAtMs) lastAtMs = at
    steps++
  }
  return steps > 0 ? { id, firstAtMs, lastAtMs, steps, byModel } : null
}

/**
 * 대화 기록 건들(흐름 records — 질문 시작 'q' 에 질문 글) + 하위 에이전트 갈래 → 질문별 비용(최근 60개). 질문 = 질문 시작 뒤
 * 메인 요청들, 값은 요청마다 공식 요율(costOf). 하위 에이전트는 첫 요청 시각이 든 질문에(그 질문 시작 뒤 · 다음 질문 시작 전), 앞
 * 질문이 없으면 첫 질문에. 앱 자체 요청 · 컴팩트 값은 기록에 없어 빠진다 — 줄에 "기록에서 다시 만듦"(rebuilt). 언제 = 그 질문의
 * 마지막 요청(질문이 끝난 때 — 메모리에서 만든 줄과 같은 뜻)
 */
export function turnsFromRecords(records: readonly FlowRecord[], agents: readonly AgentRun[] = []): TurnSummary[] {
  type Q = { startMs: number; endMs: number; prompt: string; steps: number; cost: CostParts; ctx: number | null; model?: string; details: StepDetail[] }
  const qs: Q[] = []
  let cur: Q | null = null
  const open = (atMs: number, text: string): Q => {
    const q: Q = { startMs: atMs, endMs: atMs, prompt: promptHead(text), steps: 0, cost: ZERO, ctx: null, details: [] }
    qs.push(q)
    return q
  }
  for (const r of records) {
    if (r.kind === 'q') cur = open(r.atMs, r.text ?? '')
    else if (r.kind === 'p') {
      // 기록 앞부분이 질문 시작 없이 요청부터면(이어 붙인 기록) 이름 없는 질문 하나로
      const q = cur ?? (cur = open(r.atMs, ''))
      q.steps++
      q.cost = addCost(q.cost, costOf(r.tokens, r.model))
      q.ctx = r.tokens.input_tokens + r.tokens.cache_read_input_tokens + r.tokens.cache_creation_input_tokens
      q.model = r.model
      q.endMs = Math.max(q.endMs, r.atMs)
    }
  }
  for (const a of agents) {
    let target: Q | undefined = qs[0]
    for (const q of qs) if (q.startMs <= a.firstAtMs) target = q
    if (!target) continue
    let c = ZERO
    let model = ''
    for (const [m, t] of Object.entries(a.byModel)) {
      c = addCost(c, costOf(t, m, 5))
      model = m
    }
    target.cost = addCost(target.cost, c)
    target.details.push({ label: L('하위 에이전트', 'subagent'), usd: c.usd, write: c.write, read: c.read, output: c.output, input: c.input, agent: a.id, steps: a.steps, model, done: true, at: a.lastAtMs })
  }
  return qs
    .filter(q => q.steps > 0)
    .map((q, i) => ({
      tail: '',
      steps: q.steps,
      cost: q.cost,
      prompt: q.prompt,
      atMs: q.endMs,
      contextTokens: q.ctx,
      details: q.details,
      ...(q.model ? { model: q.model } : {}),
      turnId: `rebuilt-${i}`,
      rebuilt: true as const,
    }))
    .slice(-60)
}
