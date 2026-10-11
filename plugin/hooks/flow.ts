// 컨텍스트 흐름: 요청마다의 컨텍스트 크기와 컴팩트 시점, 컴팩트마다의 효과(줄인 양 · 든 값 · 그 뒤 아낀 값).
//
// 세션 기록 파일(트랜스크립트)에 요청마다 usage 가, 컴팩트마다 compact_boundary 줄(시각 · 직전 크기)이
// 남는다 — 이 mod 를 쓰기 전 구간도 그래서 그릴 수 있다. 컴팩트 요청 자체의 값은 기록에 없어
// 그 구간은 추정(정가 입력)으로 보이고, mod 가 본 컴팩트는 엔진이 준 실제 토큰으로 잰다.

import type { CompactEvent, CtxPoint } from '../types'
import { costOf, fmtTokens, LEVEL_HEX, levelOf, modelKey, ratesFor, thresholds } from './cost'
import type { Tokens } from './cost'
import { L } from './i18n'

/**
 * questions = 질문(사용자 프롬프트)이 시작된 시각, 오래된 것부터 — 그래프 [최근 질문 40] 의 경계.
 * 없으면(undefined) 질문을 적기 전 판 저장 파일 — 불러올 때 기록에서 다시 읽는다
 */
export type Flow = { points: CtxPoint[]; compactions: CompactEvent[]; questions?: number[] }

/** 점이 너무 많으면 앞을 버린다(그래프는 어차피 몇백 칸) */
export const MAX_POINTS = 5000

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** 기록에서 뽑은 한 건: 요청 하나(p) · 컴팩트 하나(c) · 질문 시작 하나(q) */
export type FlowRecord =
  | { kind: 'p'; atMs: number; tokens: Tokens; model: string }
  | { kind: 'c'; atMs: number; trigger: string; pre: number }
  | { kind: 'q'; atMs: number }

/** 사용자 줄의 질문 id — 질문 하나의 줄(프롬프트 · 도구 결과)엔 모두 같은 promptId 가 붙는다. 글 속 따옴표는 \" 라 안 걸린다 */
const PROMPT_ID = /"promptId":"([^"]+)"/

/**
 * 기록 파일 본문 → 건들. 메인 대화만(서브에이전트 줄 isSidechain 은 뺀다), 같은 message.id 는 한 번만
 * (블록마다 줄이 따로 남는다). 질문은 promptId 가 처음 나온 사용자 줄의 시각 — 같은 줄이 다시 적혀도(2026-10-11:
 * 이 세션 사용자 글 줄 3,500여 개 중 3,200개가 중복) 한 번만. 깨진 줄은 건너뛴다. tools/scan-transcript.mjs 와 같은 규칙
 */
export function recordsFromTranscript(text: string): FlowRecord[] {
  const out: FlowRecord[] = []
  const seen = new Set<string>()
  // 컴팩트 경계 줄도 같은 것이 다시 적힌다(2026-10-11: 세 번째 컴팩트 때 첫 경계 줄이 그대로 한 번 더) — 시각 · 직전 크기로 한 번만
  const seenBoundary = new Set<string>()
  const seenPrompt = new Set<string>()
  for (const line of text.split('\n')) {
    // 대부분의 줄은 도구 결과 · 사용자 글이다 — 파싱 전에 거른다(질문은 새 promptId 의 첫 줄만)
    const isBoundary = line.includes('"compact_boundary"')
    const promptId = PROMPT_ID.exec(line)?.[1]
    const isNewPrompt = promptId !== undefined && !seenPrompt.has(promptId)
    if (!isBoundary && !isNewPrompt && !line.includes('"usage"')) continue
    let r: Record<string, unknown>
    try {
      r = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (r.isSidechain === true) continue
    const atMs = Date.parse(String(r.timestamp ?? '')) || 0
    if (isNewPrompt && r.type === 'user') {
      seenPrompt.add(promptId)
      out.push({ kind: 'q', atMs })
      continue
    }
    if (r.type === 'system' && r.subtype === 'compact_boundary') {
      const meta = (r.compactMetadata ?? {}) as Record<string, unknown>
      const key = `${atMs}:${num(meta.preTokens)}`
      if (seenBoundary.has(key)) continue
      seenBoundary.add(key)
      out.push({ kind: 'c', atMs, trigger: typeof meta.trigger === 'string' ? meta.trigger : 'manual', pre: num(meta.preTokens) })
      continue
    }
    const m = r.message as { id?: string; model?: string; usage?: Record<string, unknown> } | undefined
    if (r.type !== 'assistant' || !m?.usage || !m.id || seen.has(m.id)) continue
    seen.add(m.id)
    out.push({
      kind: 'p',
      atMs,
      model: m.model ?? '?',
      tokens: {
        input_tokens: num(m.usage.input_tokens),
        output_tokens: num(m.usage.output_tokens),
        cache_read_input_tokens: num(m.usage.cache_read_input_tokens),
        cache_creation_input_tokens: num(m.usage.cache_creation_input_tokens),
      },
    })
  }
  return out
}

/** tools/scan-transcript.mjs 의 출력(줄마다 "p …" · "c …" · "q …") → 건들 */
export function recordsFromLines(text: string): FlowRecord[] {
  const out: FlowRecord[] = []
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/)
    if (f[0] === 'p' && f.length >= 7) {
      const [, at, input, output, read, write, model] = f
      out.push({
        kind: 'p',
        atMs: Number(at) || 0,
        model: model!,
        tokens: { input_tokens: Number(input) || 0, output_tokens: Number(output) || 0, cache_read_input_tokens: Number(read) || 0, cache_creation_input_tokens: Number(write) || 0 },
      })
    } else if (f[0] === 'c' && f.length >= 4) {
      out.push({ kind: 'c', atMs: Number(f[1]) || 0, trigger: f[2]!, pre: Number(f[3]) || 0 })
    } else if (f[0] === 'q' && f.length >= 2) {
      out.push({ kind: 'q', atMs: Number(f[1]) || 0 })
    }
  }
  return out
}

/** 건들 → 흐름. 값은 요청마다 그 모델 요율로 */
export function flowFromRecords(records: readonly FlowRecord[]): Flow {
  const flow: Flow = { points: [], compactions: [], questions: [] }
  for (const r of records) {
    if (r.kind === 'q') {
      flow.questions!.push(r.atMs)
      continue
    }
    if (r.kind === 'c') {
      // 같은 컴팩트가 두 번 적힌 기록(위 recordsFromTranscript · 추출 도구가 거르지만, 예전 출력 · 저장 파일 대비)
      if (flow.compactions.some(c => c.atMs === r.atMs && c.before === r.pre)) continue
      const last = flow.points[flow.points.length - 1]
      flow.compactions.push({ atMs: r.atMs, trigger: r.trigger, before: r.pre || (last ? last.ctx : 0), after: null, costUsd: null, index: flow.points.length })
      continue
    }
    const t = r.tokens
    const ctx = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
    if (ctx <= 0) continue // 오류 · 합성 응답
    addPoint(flow, { atMs: r.atMs, ctx, usd: costOf(t, r.model)?.usd ?? 0, ...(r.model && r.model !== '?' ? { model: r.model } : {}) })
  }
  return trim(flow)
}

export function scanTranscript(text: string): Flow {
  return flowFromRecords(recordsFromTranscript(text))
}

/**
 * 세션별 저장 파일: 다시 불러올 때마다 큰 기록을 다시 읽지 않게. v2 = 점마다 모델(모델 바꾼 시점을 그린다) —
 * 모델 id 는 표(m)에 한 번만 적고 점엔 그 번호(-1 = 모름). 점마다 id 를 쓰면 파일이 몇 배다. v3 = 질문 시작 시각(q)
 */
export function serializeFlow(flow: Flow): string {
  const models: string[] = []
  const idOf = (model: string | undefined) => {
    if (!model) return -1
    const at = models.indexOf(model)
    if (at >= 0) return at
    models.push(model)
    return models.length - 1
  }
  const p = flow.points.map(pt => [pt.atMs, pt.ctx, Math.round(pt.usd * 1e6) / 1e6, idOf(pt.model)])
  return JSON.stringify({ v: 3, m: models, p, c: flow.compactions, ...(flow.questions ? { q: flow.questions } : {}) })
}

/**
 * v1(모델 없음) · v2(질문 없음) · v3 를 읽는다. v1 이면 점에 모델이, v1 · v2 면 질문이 없다 — lacksModels ·
 * questions 없음으로 보고 기록에서 다시 읽는다
 */
export function parseFlowFile(text: string): Flow | null {
  try {
    const raw = JSON.parse(text) as { v?: number; m?: unknown; p?: unknown; c?: unknown; q?: unknown }
    if ((raw.v !== 1 && raw.v !== 2 && raw.v !== 3) || !Array.isArray(raw.p) || !Array.isArray(raw.c)) return null
    const models = Array.isArray(raw.m) ? (raw.m as unknown[]).map(x => (typeof x === 'string' ? x : '')) : []
    const points = (raw.p as unknown[])
      .filter((x): x is number[] => Array.isArray(x) && x.length >= 3)
      .map(([atMs, ctx, usd, mi]) => {
        const model = typeof mi === 'number' && mi >= 0 ? models[mi] : undefined
        return { atMs: num(atMs), ctx: num(ctx), usd: num(usd), ...(model ? { model } : {}) }
      })
    const compactions = (raw.c as Partial<CompactEvent>[])
      .filter(c => c && typeof c.index === 'number' && typeof c.before === 'number')
      .map(c => ({
        atMs: num(c.atMs),
        trigger: typeof c.trigger === 'string' ? c.trigger : 'manual',
        before: num(c.before),
        after: typeof c.after === 'number' ? c.after : null,
        costUsd: typeof c.costUsd === 'number' ? c.costUsd : null,
        index: num(c.index),
      }))
      // 중복 컴팩트를 걸러내기 전에 저장한 파일도 고쳐 읽는다(같은 시각 · 직전 크기면 하나)
      .filter((c, i, all) => all.findIndex(o => o.atMs === c.atMs && o.before === c.before) === i)
    const questions = Array.isArray(raw.q) ? (raw.q as unknown[]).map(num) : undefined
    return { points, compactions, ...(questions ? { questions } : {}) }
  } catch {
    return null
  }
}

/** 모델을 적기 전 판(v1) 저장 파일에서 읽은 흐름 — 점이 있는데 모델이 하나도 없다 */
export function lacksModels(flow: Flow): boolean {
  return flow.points.length > 0 && flow.points.every(p => p.model === undefined)
}

/**
 * 모델을 바꾼 자리: 앞 점과 모델이 다른 점의 번호(그 점부터 새 모델). 둘 중 하나라도 모델을 모르면 넘어간다.
 * 날짜 꼬리 · [1m] 만 다른 id 는 같은 모델로 본다
 */
export function modelSwitches(points: readonly CtxPoint[]): number[] {
  const out: number[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.model
    const b = points[i]!.model
    if (a && b && modelKey(a) !== modelKey(b)) out.push(i)
  }
  return out
}

/** 흐름 그래프가 처음 보이는 질문 수 — 넘으면 [최근 질문 40] [전체] */
export const FLOW_RECENT = 40

/**
 * 최근 질문 count 개가 보이는 첫 점: 그 질문들 중 첫 질문이 시작된 뒤 첫 요청부터. 질문이 count 개 이하면 처음부터(0).
 * questionStarts = 질문마다 시작 시각(흐름의 questions — 기록 파일 · 질문마다, 오래된 것부터). 예전엔 질문별 비용 기록(이
 * mod 가 직접 본 질문, 60개까지)으로 셌다 — mod 를 다시 불러온 긴 세션은 그 기록이 40개 아래라 22시간 · 요청 2,613회가
 * 단추 없이 다 그려졌다. 컴팩트 횟수로 자르니 컴팩트가 적은 긴 세션은 다 보였다.
 * 40 = 이 세션처럼 질문마다 요청이 많아도(최근 약 25회) 요청 1,000회 안팎 — 막대 약 115개면 컴팩트 한 번
 * 사이가 막대 15개쯤(세션 전체 17번 · 2,336요청은 7개쯤이라 안 읽혔다). 50 이면 이런 세션에선 전체에 가깝다
 */
export function recentStart(points: readonly CtxPoint[], questionStarts: readonly number[], count: number): number {
  if (questionStarts.length <= count) return 0
  const from = questionStarts[questionStarts.length - count]!
  const i = points.findIndex(p => p.atMs >= from)
  return i < 0 ? 0 : i
}

/** 질문 하나가 시작됐다 — 흐름에 그 시각을 잇는다(원본은 그대로) */
export function withQuestion(flow: Flow, atMs: number): Flow {
  return { ...flow, questions: [...(flow.questions ?? []), atMs] }
}

/** 점 하나를 잇는다. 막 지난 컴팩트의 "직후" 크기는 그 뒤 첫 점이다 */
export function addPoint(flow: Flow, p: CtxPoint): void {
  flow.points.push(p)
  const last = flow.compactions[flow.compactions.length - 1]
  if (last && last.after === null && last.index === flow.points.length - 1) last.after = p.ctx
}

/** 컴팩트 뒤 아직 요청이 없어 직후 크기를 모르는 컴팩트(맨 마지막 것만). 없으면 null */
export function pendingCompact(flow: Flow): CompactEvent | null {
  const last = flow.compactions[flow.compactions.length - 1]
  return last && last.after === null && last.index === flow.points.length ? last : null
}

/**
 * 다음 요청이 캐시에서 읽을 수 있던 크기 = 마지막 요청의 컨텍스트. 요청이 아직 없거나(세션 첫 요청) 그 뒤 컴팩트했으면 null —
 * 그때 쓰는 캐시는 처음 쓰는 것이지 다시 쓰는 게 아니다
 */
export function lastCtxOf(flow: Flow): number | null {
  const last = flow.points[flow.points.length - 1]
  if (!last) return null
  return flow.compactions.some(c => c.index >= flow.points.length) ? null : last.ctx
}

/** 살아 있는 세션: 점 하나를 이은 새 흐름(원본은 그대로) */
export function withPoint(flow: Flow, p: CtxPoint): Flow {
  const next: Flow = { ...flow, points: [...flow.points], compactions: flow.compactions.map(c => ({ ...c })) }
  addPoint(next, p)
  return trim(next)
}

function trim(flow: Flow): Flow {
  const drop = flow.points.length - MAX_POINTS
  if (drop <= 0) return flow
  return {
    ...flow,
    points: flow.points.slice(drop),
    compactions: flow.compactions.map(c => ({ ...c, index: Math.max(0, c.index - drop) })),
  }
}

/**
 * 다시 읽은 흐름에 예전에 잰 컴팩트 값을 옮긴다(기록 파일엔 그 값이 없다).
 * 같은 컴팩트 = 시각이 10분 안
 */
export function mergeMeasured(fresh: readonly CompactEvent[], old: readonly CompactEvent[]): CompactEvent[] {
  return fresh.map(c => {
    const same = old.find(o => o.costUsd !== null && Math.abs(o.atMs - c.atMs) < 10 * 60_000)
    return same ? { ...c, costUsd: same.costUsd } : c
  })
}

export type CompactEffect = {
  event: CompactEvent
  /** 그 컴팩트 때 모델(직전 요청의 모델) — 든 값은 이 모델 요율. 모르면 지금 모델 */
  model: string
  /** 줄인 양(직전 − 직후) */
  removed: number
  /** 컴팩트 요청 + 직후 요약 다시 쓰기. isEstimated = 컴팩트 요청 값을 못 재서 정가 입력으로 셈 */
  costUsd: number
  isEstimated: boolean
  /** 그 뒤(다음 컴팩트 전까지) 요청 수와, 줄인 양을 다시 읽지 않아 아낀 값 */
  requestsAfter: number
  savedUsd: number
  netUsd: number
  /** 아직 본전 전이면 남은 요청 수 */
  breakEvenLeft: number | null
}

/**
 * 컴팩트마다의 효과(직후 크기를 아직 모르면 아낀 값 0). 든 값은 그 컴팩트 때 모델 요율, 아낀 값은 그 뒤 요청마다
 * 그 요청의 모델 읽기 요율로 — 예전엔 전부 지금 모델 요율로 다시 재서 모델을 바꿀 때마다 지난 컴팩트 값이 바뀌었다.
 * model = 점에 모델 기록이 없을 때 쓰는 모델(지금 모델). 엔진이 값을 안 준 컴팩트(이 mod 전 · 기록으로만 안 것)는 추정 —
 * est.output = 요약 출력 토큰, est.summaryOf = 그 컴팩트의 요약 크기(새로 쓴 몫)
 */
export function compactEffects(
  flow: Flow,
  model: string,
  est: { output: number; summaryOf: (c: CompactEvent) => number },
): CompactEffect[] {
  return flow.compactions.map((event, i) => {
    const atModel = flow.points[event.index - 1]?.model ?? flow.points[event.index]?.model ?? model
    const r = ratesFor(atModel, event.before)
    const after = event.after ?? event.before
    const removed = Math.max(0, event.before - after)
    const nextIndex = Math.min(flow.compactions[i + 1]?.index ?? flow.points.length, flow.points.length)
    const requestsAfter = event.after === null ? 0 : Math.max(0, nextIndex - event.index)
    if (!r) {
      return { event, model: atModel, removed, costUsd: event.costUsd ?? 0, isEstimated: event.costUsd === null, requestsAfter, savedUsd: 0, netUsd: 0, breakEvenLeft: null }
    }
    const request = event.costUsd ?? (event.before * r.input + est.output * r.output) / 1e6
    const costUsd = request + (Math.min(est.summaryOf(event), after) * r.write1h) / 1e6
    // 아낀 값: 줄인 양을 그 뒤 요청마다 다시 읽지 않은 값 — 요청마다 그 요청 모델의 읽기 요율
    const readOf = (p: CtxPoint | undefined) => (ratesFor(p?.model ?? atModel, p?.ctx ?? after) ?? r).read
    let savedUsd = 0
    for (let j = event.index; j < event.index + requestsAfter; j++) savedUsd += (removed * readOf(flow.points[j])) / 1e6
    // 본전까지 남은 요청은 마지막 요청의 모델 기준
    const perRequest = (removed * readOf(flow.points[nextIndex - 1])) / 1e6
    const netUsd = savedUsd - costUsd
    const breakEvenLeft = netUsd >= 0 ? null : perRequest > 0 ? Math.ceil(-netUsd / perRequest) : null
    return { event, model: atModel, removed, costUsd, isEstimated: event.costUsd === null, requestsAfter, savedUsd, netUsd, breakEvenLeft }
  })
}

/** "10/10 23:18" — 엔진 프로세스의 지역 시각 */
export function fmtClock(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return L('시각 모름', 'time unknown')
  const d = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())}`
}

/** 컴팩트 시점 막대 높이(px): 눈금 위 여백 4 + 막대 8 + 눈금 아래 4 + 이름 줄 */
export const TIMING_H = 30

/**
 * 컴팩트 시점 막대(데스크톱): 지금 컨텍스트가 적용 중인 기준(구간 시작 · 끝, 직접 지정이면 노랑 · 빨강 크기)의 어디쯤인지.
 * 회색 = 상주(컴팩트해도 남는 몫), 그 뒤 지금까지 채움(상태 색), 시작 · 끝 자리에 그 색 세로선과 아래 이름.
 * 예전엔 "미룬 비용 ÷ 컴팩트 한 번 값" 게이지였는데 100% 가 비용만 본 최적이라 고른 구간과 따로 놀았고(구간 안인데 7.5배 ·
 * 빨강), 100% 눈금이 눈에 안 들어왔다
 */
export function timingSvg(
  ctx: number,
  base: number | null,
  marks: { warn: number; cut: number; warnName: string; cutName: string },
  hex: string,
  width: number,
): string {
  const barY = 4
  const barH = 8
  // 끝 선은 폭의 80% 자리 — 오른쪽에 끝 이름("400k 늦어짐")이 들어갈 자리를 둔다
  const top = Math.max(marks.cut * 1.25, ctx * 1.04)
  const x = (v: number) => Math.max(0, Math.min(width, (v / top) * width))
  let body = `<clipPath id="timing-clip"><rect x="0" y="${barY}" width="${width}" height="${barH}" rx="4"/></clipPath><g clip-path="url(#timing-clip)">`
  body += `<rect x="0" y="${barY}" width="${width}" height="${barH}" fill="#888888" fill-opacity="0.25"/>`
  const baseX = base !== null && base > 0 ? x(Math.min(base, ctx)) : 0
  if (baseX > 0) body += `<rect x="0" y="${barY}" width="${baseX.toFixed(1)}" height="${barH}" fill="#888888" fill-opacity="0.6"/>`
  const nowX = x(ctx)
  if (nowX > baseX) body += `<rect x="${baseX.toFixed(1)}" y="${barY}" width="${(nowX - baseX).toFixed(1)}" height="${barH}" fill="${hex}"/>`
  body += '</g>'
  // 시작 · 끝 세로선: 막대 위아래로 4px 더 길게, 3px 굵기 — 1 · 2px 은 막대 색에 묻혔다
  const line = (v: number, color: string) =>
    `<rect x="${(x(v) - 1.5).toFixed(1)}" y="0" width="3" height="${barY * 2 + barH}" rx="1" fill="${color}"/>`
  body += line(marks.warn, LEVEL_HEX.warn) + line(marks.cut, LEVEL_HEX.cut)
  // 이름: 시작은 선 왼쪽으로, 끝은 선 오른쪽으로 — 두 선이 가까워도 겹치지 않게. 자리가 모자라면 반대쪽으로
  const fontPx = 10
  const textW = (s: string) => [...s].reduce((w, ch) => w + (ch.charCodeAt(0) >= 0x1100 ? fontPx : fontPx * 0.6), 0)
  const y = TIMING_H - 2
  const text = (at: number, anchor: string, color: string, s: string) =>
    `<text x="${at.toFixed(1)}" y="${y}" text-anchor="${anchor}" font-size="${fontPx}" font-family="sans-serif" fill="${color}">${escapeXml(s)}</text>`
  const warnX = x(marks.warn)
  const cutX = x(marks.cut)
  body += warnX >= textW(marks.warnName) ? text(warnX, 'end', LEVEL_HEX.warn, marks.warnName) : text(warnX, 'start', LEVEL_HEX.warn, marks.warnName)
  body += cutX + textW(marks.cutName) <= width ? text(cutX, 'start', LEVEL_HEX.cut, marks.cutName) : text(cutX, 'end', LEVEL_HEX.cut, marks.cutName)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${TIMING_H}" viewBox="0 0 ${width} ${TIMING_H}">${body}</svg>`
}

export const COMPACT_HEX = '#3fb6c6'

/** 모델 바꾼 시점 색(보라) — 컴팩트 청록 · 막대의 파랑 · 노랑 · 빨강과 겹치지 않게 */
export const MODEL_HEX = '#b48cf2'

/** 기준선(설정의 강조 · 권장 크기) 색 — 막대의 수준 색과 겹치지 않는 회색 */
const RULE_HEX = '#9aa0a8'

/** 오른쪽 기준선 이름 칸 폭(px) — 점선이 무엇인지 선 끝에 바로 적는다 */
const LABEL_W = 54

/**
 * 흐름 그래프: 요청마다 막대(칸이 모자라면 몇 개씩 묶어 그중 최고), 색 = 그 크기의 기준 색.
 * 점선 = 컴팩트 구간 시작 · 끝(직접 지정이면 강조 · 권장) 기준(오른쪽 끝에 이름과 값), 청록 세로선 = 컴팩트한 시점, 보라 끊긴 세로선 = 모델 바꾼 시점,
 * 마지막 컴팩트 앞 막대는 흐리게
 */
/** 그래프 아래 시간 축 줄의 높이(px) — 왼쪽 끝 = 첫 요청 시각, 오른쪽 끝 = 지금 */
export const AXIS_H = 13

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function flowSvg(
  points: readonly CtxPoint[],
  marks: readonly number[],
  width: number,
  fullHeight: number,
  switches: readonly number[] = [],
  axis?: { left: string; right: string },
): string {
  // 시간 축을 그리면 그 줄만큼 막대 높이를 줄인다(아래 height 는 막대 영역)
  const height = axis ? fullHeight - AXIS_H : fullHeight
  const n = points.length
  const t = thresholds()
  const plotW = Math.max(40, width - LABEL_W)
  let top = t.ctxCut
  for (const p of points) if (p.ctx > top) top = p.ctx
  top *= 1.05
  const bars = Math.max(1, Math.min(n, Math.floor(plotW / 3)))
  const per = n / bars
  const bw = plotW / bars
  const yOf = (v: number) => height - (v / top) * (height - 1)
  // 마지막 컴팩트 앞(지난 구간)은 흐리게 — 오른쪽 진한 부분이 지금
  const lastMark = marks.length > 0 ? marks[marks.length - 1]! : 0
  let body = ''
  for (let b = 0; b < bars; b++) {
    const from = Math.floor(b * per)
    const to = Math.max(from + 1, Math.floor((b + 1) * per))
    let v = 0
    for (let i = from; i < to && i < n; i++) v = Math.max(v, points[i]!.ctx)
    const y = yOf(v)
    const dim = from < lastMark ? ' fill-opacity="0.4"' : ''
    body += `<rect x="${(b * bw).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${(height - y).toFixed(1)}" fill="${LEVEL_HEX[levelOf(v)]}"${dim}/>`
  }
  // 기준선은 회색 — 빨강 · 노랑이면 "비용이 많다" 로 읽혔다. 강조는 잘게, 권장은 길게 끊는다
  const rule = (v: number, dash: string) =>
    `<line x1="0" x2="${plotW.toFixed(1)}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}" stroke="${RULE_HEX}" stroke-width="1" stroke-dasharray="${dash}" stroke-opacity="0.9"/>`
  body += rule(t.ctxWarn, '2 3') + rule(t.ctxCut, '6 3')
  // 선 이름: 선 높이에 맞추되 두 이름이 붙으면 겹치지 않게 벌린다
  const fontPx = 10
  let yCut = Math.max(fontPx, yOf(t.ctxCut) + 3.5)
  let yWarn = Math.max(yCut + fontPx + 1, yOf(t.ctxWarn) + 3.5)
  if (yWarn > height - 1) {
    yWarn = height - 1
    yCut = Math.min(yCut, yWarn - fontPx - 1)
  }
  const name = (y: number, hex: string, text: string) =>
    `<text x="${(plotW + 4).toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontPx}" font-family="sans-serif" fill="${hex}">${text}</text>`
  // 구간이면 "시작 · 끝"(이름 칸 54px 에 들게 짧게), 직접 지정이면 "강조 · 권장"
  const [cutName, warnName] = t.isRange ? [L('끝', 'end'), L('시작', 'start')] : [L('권장', 'limit'), L('강조', 'warn')]
  body += name(yCut, RULE_HEX, `${cutName} ${fmtTokens(t.ctxCut)}`) + name(yWarn, RULE_HEX, `${warnName} ${fmtTokens(t.ctxWarn)}`)
  for (const index of marks) {
    const x = Math.min(plotW - 1, Math.max(1, (index / Math.max(1, n)) * plotW))
    body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${height}" stroke="${COMPACT_HEX}" stroke-width="2"/>`
  }
  // 모델 바꾼 시점: 보라 끊긴 선 — 그 자리에서 컨텍스트가 줄거나 늘어도 컴팩트가 아니다(모델마다 세는 값이 다르다)
  for (const index of switches) {
    const x = Math.min(plotW - 1, Math.max(1, (index / Math.max(1, n)) * plotW))
    body += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="0" y2="${height}" stroke="${MODEL_HEX}" stroke-width="2" stroke-dasharray="3 2"/>`
  }
  // 시간 축: 막대 바로 아래 양 끝에 — 글 한 줄("10/10 21:47 → 지금 · 최고 596k")로 두니 "그때가 최고였다" 로 읽혔다
  if (axis) {
    const y = (fullHeight - 2).toFixed(1)
    const text = (x: number, anchor: string, value: string) =>
      `<text x="${x.toFixed(1)}" y="${y}" text-anchor="${anchor}" font-size="10" font-family="sans-serif" fill="${RULE_HEX}">${escapeXml(value)}</text>`
    body += text(0, 'start', axis.left) + text(plotW, 'end', axis.right)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${fullHeight}" viewBox="0 0 ${width} ${fullHeight}">${body}</svg>`
}

/**
 * 컴팩트 미룬 값: 지난 컴팩트 뒤(없으면 처음부터) 요청마다 "그 요청 크기 − 컴팩트 직후 크기" 만큼 더 읽은 값의 누적.
 * 지난 컴팩트 효과(이득)만 보이니 "괜찮네" 로 읽혔다 — 지금 구간에서 커진 만큼 얼마씩 더 내고 있는지.
 * 매번 컴팩트했다면과 견준 값이라 실제로 피할 수 있던 값보다 크다(컴팩트 비용 · 다시 차오르는 몫은 빠진다).
 * base = 지난 컴팩트 직후 크기(못 쟀거나 컴팩트가 없으면 fallbackAfter), baseNow = 그 크기를 지금 모델로 센 값,
 * ratios = 요청마다 크기 ÷ base, nowExtraUsd = 마지막 요청 1회가 더 읽은 값.
 * 구간 안에서 모델을 바꿨으면 base 를 그 모델로 센 크기로 바꿔 견준다 — 모델마다 세는 값이 달라(tokenScales)
 * 그대로 빼면 바꾼 자리에서 더 읽은 값이 튄다
 */
export function segmentExtra(
  flow: Flow,
  model: string,
  fallbackAfter: number,
): { base: number; baseNow: number; cum: number[]; ratios: number[]; nowExtraUsd: number } | null {
  const last = flow.compactions[flow.compactions.length - 1]
  const from = last ? last.index : 0
  const pts = flow.points.slice(from)
  if (pts.length < 2) return null
  const base = last?.after ?? fallbackAfter
  const scales = tokenScales(flow.points, from)
  const extraOf = (p: CtxPoint, k: number) => {
    const r = ratesFor(p.model ?? model, p.ctx)
    return r ? (Math.max(0, p.ctx - base * scales[k]!) * r.read) / 1e6 : 0
  }
  let sum = 0
  const cum = pts.map((p, k) => (sum += extraOf(p, k)))
  const ratios = pts.map((p, k) => (base > 0 ? p.ctx / (base * scales[k]!) : 1))
  const k = pts.length - 1
  return { base, baseNow: base * scales[k]!, cum, ratios, nowExtraUsd: extraOf(pts[k]!, k) }
}

/**
 * 모델을 바꾸면 같은 대화도 토큰 수가 달라진다(실측: Opus 5.5 → Sonnet 5.5 0.83배, 되돌리면 1.18배). 대화가 줄거나
 * 처음부터 다시 시작하는 게 아니라 세는 값만 다르다 — 크기를 견줄 땐 같은 잣대로.
 * fromIndex 부터 요청마다 "그 요청 모델로 센 크기 ÷ fromIndex 요청 모델로 센 크기" 를 바꾼 자리 앞뒤 요청의 크기 비로
 * 잰다(그 사이 늘어난 한 요청 몫은 섞인다). fromIndex 모델로 돌아오면 1
 */
export function tokenScales(points: readonly CtxPoint[], fromIndex: number): number[] {
  const first = points[fromIndex]?.model
  const out: number[] = []
  let scale = 1
  for (let i = fromIndex; i < points.length; i++) {
    const a = points[i - 1]?.model
    const b = points[i]!.model
    if (i > fromIndex && a && b && modelKey(a) !== modelKey(b)) {
      scale = first && modelKey(b) === modelKey(first) ? 1 : (scale * points[i]!.ctx) / Math.max(1, points[i - 1]!.ctx)
    }
    out.push(scale)
  }
  return out
}

/** 지난 컴팩트 직후 크기(after)를 마지막 요청의 모델로 센 값 — 컴팩트 뒤 모델을 바꿨으면 그 비율만큼 */
export function afterInNowTokens(flow: Flow, after: number): number {
  const last = flow.compactions[flow.compactions.length - 1]
  if (!last || last.index >= flow.points.length) return after
  const scales = tokenScales(flow.points, last.index)
  return after * (scales[scales.length - 1] ?? 1)
}

/**
 * 컴팩트가 남긴 요약 크기 = 직후 크기 − 처음부터 있던 몫(first = 기록의 첫 요청: 시스템 · 도구 · 지시문). 요약은 컴팩트마다
 * 앞 요약까지 다시 써 쌓이지 않고 바뀐다(이 세션 28k → 24k → 22k → 25k → 32k → 19k). 처음부터 있던 몫을 모르거나
 * (first = null · 직후보다 큼 — 기록이 세션 처음부터가 아님), 직후를 아직 못 쟀거나, 첫 요청과 모델이 달라(모델마다 세는
 * 값이 다르다) 견줄 수 없으면 null
 */
export function compactSummary(flow: Flow, c: CompactEvent, first: CtxPoint | null): number | null {
  if (!first || c.after === null || c.after <= first.ctx) return null
  const model = flow.points[c.index]?.model ?? flow.points[c.index - 1]?.model
  if (model && first.model && modelKey(model) !== modelKey(first.model)) return null
  return c.after - first.ctx
}
