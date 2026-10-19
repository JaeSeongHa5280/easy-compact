import type { CostParts, StepDetail, Tokens, TurnsOlder, TurnSummary } from '../types'
import { costOf, dayOf, engineOfLine } from './cost'
import type { FlowRecord } from './flow'
import { L } from './i18n'
import { agentSum, promptHead } from './text'

/**
 * N3(0.6.0): 질문별 비용을 세션마다 파일로 남기고(다시 연 세션에서 읽는다) — 이 판 전 세션은 대화 기록에서 다시 만든다.
 * 0.5.1 까지 질문 기록은 엔진 메모리에만 있어 앱을 다시 켜면 "질문별 비용" 이 비었다. 여기는 $ 없는 순수 함수만 — 파일 읽기 · 쓰기는 register.tsx
 */

/** 질문 기록 파일 판 — 꼴이 바뀌면 올린다(옛 판은 버리고 기록에서 다시 만든다). 밀린 질문 합(older, 1.0)은 없어도 읽히는 칸이라 판은 그대로 */
export const TURNS_V = 1

/**
 * 질문 기록 파일에 줄로 남기는 질문 수(1.0 — 숫자에 이름을 붙임). 답변 끝 칩은 채팅을 위로 올려 본 옛 답의 질문도 이 목록에서 찾는다(끝 글 —
 * endsWithTail). 패널에 줄로 그리는 수(ui-usage HISTORY_ALL_MAX 20)와 일부러 따로 둔다: 그쪽은 패널 한 번 그리기 크기 한도(10만 자 남짓),
 * 이쪽은 칩이 찾을 만큼 + 파일 크기($.fs.read 4 MiB — 질문마다 동작 줄 60개까지). 하나로 묶으면 20개 앞 답의 칩이 사라지거나 패널이 안 그려진다.
 * 밖으로 밀린 질문은 합(older)으로 남는다 — 질문 합계는 세션 전체
 */
export const TURNS_KEEP = 60

/** 밀린 질문이 없을 때(새 세션 · 한도를 안 넘은 세션) */
export const NO_OLDER: TurnsOlder = { count: 0, usd: 0, agentUsd: 0, appUsd: 0 }

/** 질문 기록 파일 본문 — 밀린 질문 합을 모르면(1.0 전 파일을 아직 못 채움) 그 칸 없이 */
export function serializeTurns(list: readonly TurnSummary[], older: TurnsOlder | null = null): string {
  return JSON.stringify({ v: TURNS_V, turns: list, ...(older ? { older } : {}) })
}

/** 질문 기록 파일의 밀린 질문 합. 칸이 없거나(1.0 전 파일) 깨졌으면 null */
export function parseTurnsOlder(text: string): TurnsOlder | null {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    return null
  }
  const o = (j as { older?: Partial<TurnsOlder> } | null)?.older
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (!o || !isNum(o.count) || !isNum(o.usd) || !isNum(o.agentUsd) || !isNum(o.appUsd)) return null
  return { count: o.count, usd: o.usd, agentUsd: o.agentUsd, appUsd: o.appUsd, ...(o.rebuilt === true ? { rebuilt: true as const } : {}) }
}

/** 밀린 질문들을 합에 더한다 — 대화 기록에서 다시 만든 줄이 섞이면 rebuilt */
export function foldOlder(older: TurnsOlder, dropped: readonly TurnSummary[]): TurnsOlder {
  return dropped.reduce<TurnsOlder>(
    (o, t) => ({
      count: o.count + 1,
      usd: o.usd + t.cost.usd,
      agentUsd: o.agentUsd + (agentSum(t.details)?.usd ?? 0),
      appUsd: o.appUsd + (t.appUsd ?? 0),
      ...(o.rebuilt || t.rebuilt ? { rebuilt: true as const } : {}),
    }),
    older,
  )
}

/**
 * 1.0 전 파일(밀린 질문 합 없음)이 한도까지 찬 세션: 대화 기록에서 다시 만든 질문(rebuilt) 중 남긴 목록 첫 줄보다 앞 것 = 밀린 질문 어림.
 * 첫 줄의 짝 = 그 줄이 끝난 때(+2초) 안에 끝난 마지막 질문(기록 시각은 요청 끝, 메모리 줄 시각은 답이 끝난 때라 조금 늦다 — 2026-10-18 이
 * PC 세 세션에서 짝이 요청 수 · 값까지 맞았다). 짝이 없으면 null
 */
export function olderFromRebuilt(rebuilt: readonly TurnSummary[], kept: readonly TurnSummary[]): TurnsOlder | null {
  const first = kept[0]
  if (!first) return null
  const cut = rebuilt.findLastIndex(t => t.atMs <= first.atMs + 2_000)
  return cut < 0 ? null : foldOlder(NO_OLDER, rebuilt.slice(0, cut))
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

/** 하위 에이전트 한 갈래(기록 파일 하나): 첫 · 마지막 요청 시각 · 요청 수 · 모델별 토큰 · 엔진 판(첫 요청 줄의 version — 0.9.3) */
export type AgentRun = { id: string; firstAtMs: number; lastAtMs: number; steps: number; byModel: Record<string, Tokens>; engine?: string }

/**
 * 하위 에이전트 기록 파일 본문 → 한 갈래. 같은 응답(message.id)은 첫 줄로 세고 뒤 줄은 출력만 최댓값으로(N1 과 같은 규칙).
 * 쓰기 종류(5분 · 1시간)는 기록의 cache_creation 칸 — 없으면 costOf 가 에이전트 기본(5분)으로 센다. 요청이 없으면 null.
 * own = 이 세션 줄만(갈라 온 세션의 subagents 폴더엔 부모 세션의 갈래가 그대로 복사돼 있다 — sessionId 가 부모, 2026-10-18 이 PC)
 */
export function agentRunFromText(id: string, text: string, own: string | null = null): AgentRun | null {
  const seen = new Map<string, Tokens>()
  const byModel: Record<string, Tokens> = {}
  let firstAtMs = 0
  let lastAtMs = 0
  let steps = 0
  let engine: string | undefined
  for (const line of text.split('\n')) {
    if (!line.includes('"usage"')) continue
    let r: { type?: unknown; timestamp?: unknown; version?: unknown; sessionId?: unknown; message?: { id?: unknown; model?: unknown; usage?: Record<string, unknown> } }
    try {
      r = JSON.parse(line) as typeof r
    } catch {
      continue
    }
    if (own !== null && typeof r.sessionId === 'string' && r.sessionId !== own) continue
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
    if (engine === undefined) engine = engineOfLine(r.version)
    steps++
  }
  return steps > 0 ? { id, firstAtMs, lastAtMs, steps, byModel, ...(engine ? { engine } : {}) } : null
}

/**
 * 대화 기록 건들(흐름 records — 질문 시작 'q' 에 질문 글) + 하위 에이전트 갈래 → 질문별 비용(전부 — 남기는 수는 부르는 쪽이 TURNS_KEEP). 질문 = 질문 시작 뒤
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
      // 0.9.2: 그 요청 날의 요율(요율이 바뀐 모델의 지난 질문을 지금 요율로 다시 세면 낮게 나왔다), 0.9.3: 판을 알면 그 판의 요율
      q.cost = addCost(q.cost, costOf(r.tokens, r.model, undefined, dayOf(r.atMs), r.engine ?? null))
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
      c = addCost(c, costOf(t, m, 5, dayOf(a.firstAtMs), a.engine ?? null))
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
}

/**
 * 동작 목록에 에이전트 몫 더하기 — 에이전트마다 한 줄, 요청이 끝날 때마다 값 · 요청 수가 는다. 읽기 · 쓰기 · 출력 · 입력도
 * 따로 모은다(질문별 비용의 메인 / 🤖 분해). 이름은 더 나은 것이 오면 바꾼다(처음엔 "하위 에이전트" 였다가 목록에서 찾음)
 */
export function withAgentStep(details: readonly StepDetail[], agentId: string, label: string, cost: CostParts, model: string, atMs: number): StepDetail[] {
  const i = details.findIndex(d => d.agent === agentId)
  if (i < 0) return [...details, { label, usd: cost.usd, write: cost.write, read: cost.read, output: cost.output, input: cost.input, agent: agentId, steps: 1, model, done: false, at: atMs }]
  const d = details[i]!
  const merged = {
    ...d,
    label,
    usd: d.usd + cost.usd,
    write: (d.write ?? 0) + cost.write,
    read: (d.read ?? 0) + cost.read,
    output: (d.output ?? 0) + cost.output,
    input: (d.input ?? 0) + cost.input,
    steps: (d.steps ?? 0) + 1,
    model,
    at: atMs,
  }
  return [...details.slice(0, i), merged, ...details.slice(i + 1)]
}

/** 앱 자체 요청 줄(이름마다 한 줄, 같은 이름이면 더한다) */
export function withAppStep(details: readonly StepDetail[], label: string, usd: number): StepDetail[] {
  const i = details.findIndex(d => d.app && d.label === label)
  if (i < 0) return [...details, { label, usd, app: true }]
  return details.map((d, j) => (j === i ? { ...d, usd: d.usd + usd } : d))
}

/** 파일에서 읽은 목록의 밀린 질문 합: 파일 값 → 한도 아래면 밀린 것 없음 → 모름(null) */
export function olderOf(fileOlder: TurnsOlder | null, list: readonly TurnSummary[]): TurnsOlder | null {
  return fileOlder ?? (list.length < TURNS_KEEP ? NO_OLDER : null)
}
