import type { AutoChain, AutoState, CompactInputs, CompactPhase, Settings, TurnSummary, Usage } from '../types'
import { average, compactPayoff, estimateFor, isLittleToSave } from './cost'
import { L } from './i18n'
import { bandNumText, ctxNumText } from './text'

export const AUTO_WAIT_MS = 500
export const AUTO_AGAIN_REQUESTS = 3
export const AUTO_STALE_MS = 10 * 60_000
const STAGE_LIMIT_MS = { wait: 5_000, saving: 60_000, compacting: 5 * 60_000, continuing: 60_000 } as const
export const autoKey = (session: string) => `auto:${session}`

export function freshAuto(isOn: boolean, nowMs: number): AutoState {
  return { on: isOn, stop: null, note: null, chain: null, since: null, atMs: nowMs }
}

export function isAutoActive(a: AutoState | null | undefined): boolean {
  return a != null && a.on && a.stop === null
}

export function autoFromStore(raw: unknown, nowMs: number): AutoState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Partial<AutoState>
  if (typeof r.on !== 'boolean') return null
  const stop = r.stop === 'stuck' || r.stop === 'again' ? r.stop : null
  const note = r.note === 'stuck' || r.note === 'again' || r.note === 'cold' || r.note === 'model' ? r.note : null
  const c = r.chain
  const chain = c && typeof c === 'object' && c.stage === 'compacting' && typeof c.atMs === 'number' && nowMs - c.atMs < AUTO_STALE_MS ? c : null
  const since = r.since && typeof r.since.requests === 'number' && typeof r.since.atMs === 'number' ? r.since : null
  const g = r.range
  const range = g && typeof g.start === 'number' && typeof g.end === 'number' && g.start < g.end ? { start: g.start, end: g.end } : null
  return { on: r.on, stop, note, chain, since, atMs: nowMs, ...(range ? { range } : {}) }
}

export function isChainStuck(c: AutoChain, nowMs: number): boolean {
  const age = nowMs - c.atMs
  if (age > AUTO_STALE_MS) return true
  if ((c.stage === 'saving' || c.stage === 'continuing') && c.turnId !== null) return false
  return age > STAGE_LIMIT_MS[c.stage]
}

export function autoLossOf(u: Usage, inputs: CompactInputs | null, sums: readonly TurnSummary[], nowMs: number): 'cold' | 'model' | 'loss' | null {
  const est = estimateFor(u, nowMs)
  if (est.kind === 'cold') return est.reason === 'model' ? 'model' : 'cold'
  if (est.kind !== 'warm' || !inputs) return null
  const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  const pay = compactPayoff(u.contextTokens, inputs, u.model, callsPerQ)
  return pay !== null && isLittleToSave(u.contextTokens, inputs.after, pay.breakEvenCalls) ? 'loss' : null
}

export function isTooSoon(a: AutoState): boolean {
  return a.since !== null && a.since.requests <= AUTO_AGAIN_REQUESTS
}

export const DRAFT_POLL_MS = 2_000

export type AutoMachine = { auto: AutoState; otherAt: number; compacting: number | null; saveTurn: string | null }

export type AutoEvent =
  | { type: 'toggle' }
  | { type: 'turnEnd'; turnId: string; reason: string; isGo: boolean }
  | { type: 'waitDone'; at: number; isHeld: boolean }
  | { type: 'step'; turnId: string }
  | { type: 'afterStep'; ctx: number }
  | { type: 'compactTime'; at: number; isHeld: boolean }
  | { type: 'compactDone' }
  | { type: 'other' }
  | { type: 'turnStart'; turnId: string; kind: 'save' | 'continue' | null }
  | { type: 'watch' }

export type AutoFacts = {
  nowMs: number
  ctx: number | null
  autoStart: number
  autoEnd: number
  phase: CompactPhase
  loss: 'cold' | 'model' | 'loss' | null
  cold: 'cold' | 'model' | null
  isLive: boolean
  flowLoaded: boolean
  compactedSince: boolean
}

export type AutoAction =
  | { do: 'set'; fn: (a: AutoState) => AutoState; then?: AutoAction[] }
  | { do: 'end' }
  | { do: 'otherAt'; at: number }
  | { do: 'compacting'; at: number }
  | { do: 'compactingDone'; at: number }
  | { do: 'saveTurn'; turnId: string }
  | { do: 'toast'; note: 'toggle' | 'save' | 'compact' | 'continue'; isOn?: boolean }
  | { do: 'after'; ms: number; ev: AutoEvent }
  | { do: 'event'; ev: AutoEvent }
  | { do: 'save'; path: 'end' | 'mid' }
  | { do: 'abortSave'; turnId: string }
  | { do: 'recordSaveTurn' }
  | { do: 'startCompacting' }
  | { do: 'phaseIdle' }
  | { do: 'compactNow'; at: number }
  | { do: 'continue' }
  | { do: 'ifDraft'; yes: AutoAction[]; no: AutoAction[] }

const offPatch = (why: 'cold' | 'model') => (a: AutoState): AutoState => ({ ...a, on: false, stop: null, note: why, chain: null, since: null })
const haltPatch = (why: 'stuck' | 'again') => (a: AutoState): AutoState => ({ ...a, stop: why, note: why, chain: null, since: null })
const interruptPatch = (a: AutoState): AutoState => (a.chain ? { ...a, chain: { ...a.chain, isInterrupted: true } } : a)

export function autoGate(a: AutoState, f: AutoFacts): AutoAction[] | null {
  if (f.phase === 'tidying' || f.phase === 'compacting') return []
  if (f.loss === 'cold' || f.loss === 'model') return [{ do: 'set', fn: offPatch(f.loss) }]
  if (isTooSoon(a)) return [{ do: 'set', fn: haltPatch('again') }]
  return f.loss === 'loss' ? [] : null
}

function startEnd(a: AutoState, f: AutoFacts): AutoAction[] {
  if (f.ctx === null || f.ctx < f.autoStart) return []
  const stop = autoGate(a, f)
  if (stop) return stop
  const chain: AutoChain = { path: 'end', stage: 'wait', atMs: f.nowMs, turnId: null, before: f.ctx }
  return [
    { do: 'set', fn: x => ({ ...x, chain }) },
    { do: 'after', ms: AUTO_WAIT_MS, ev: { type: 'waitDone', at: f.nowMs, isHeld: false } },
  ]
}

export function autoStep(m: AutoMachine, ev: AutoEvent, f: AutoFacts): AutoAction[] {
  const a = m.auto
  const c = a.chain
  switch (ev.type) {
    case 'toggle': {
      const isOn = !isAutoActive(a)
      const patch = (x: AutoState): AutoState => ({
        ...x,
        on: isOn,
        stop: null,
        note: null,
        since: null,
        chain: isOn || x.chain?.stage === 'saving' || x.chain?.stage === 'compacting' ? x.chain : null,
      })
      const a1 = patch(a)
      const out: AutoAction[] = [{ do: 'set', fn: patch }, { do: 'toast', note: 'toggle', isOn }]
      return !isOn || f.isLive || a1.chain ? out : [...out, ...startEnd(a1, f)]
    }
    case 'turnEnd': {
      if (c?.stage === 'saving' && c.turnId === ev.turnId) {
        if (!a.on || !ev.isGo) return [{ do: 'end' }]
        return [
          { do: 'recordSaveTurn' },
          { do: 'compacting', at: f.nowMs },
          { do: 'set', fn: x => ({ ...x, chain: { ...c, stage: 'compacting', atMs: f.nowMs, turnId: null } }) },
          { do: 'startCompacting' },
          { do: 'after', ms: 300, ev: { type: 'compactTime', at: f.nowMs, isHeld: false } },
        ]
      }
      const out: AutoAction[] = []
      let a1 = a
      if (c?.stage === 'continuing' && c.turnId === ev.turnId) {
        out.push({ do: 'set', fn: x => ({ ...x, chain: null }) })
        a1 = { ...a, chain: null }
      } else if (c || ev.turnId === m.saveTurn) return []
      if (!isAutoActive(a) || ev.reason !== 'answer') return out
      return [...out, ...startEnd(a1, f)]
    }
    case 'waitDone': {
      if (c?.stage !== 'wait' || c.atMs !== ev.at) return []
      if (!isAutoActive(a) || m.otherAt >= ev.at) return [{ do: 'end' }]
      const held: AutoAction = { do: 'set', fn: x => (x.chain?.stage === 'wait' && x.chain.atMs === ev.at ? { ...x, chain: { ...x.chain, atMs: f.nowMs, isDraftHeld: true } } : x) }
      return [
        {
          do: 'ifDraft',
          yes: [held, ...(ev.isHeld ? [] : [{ do: 'toast', note: 'save' } as const]), { do: 'after', ms: DRAFT_POLL_MS, ev: { type: 'waitDone', at: f.nowMs, isHeld: true } }],
          no: [{ do: 'save', path: 'end' }],
        },
      ]
    }
    case 'step': {
      if (!isAutoActive(a) || (c && c.stage !== 'continuing') || a.since?.requests === 0) return []
      if (f.ctx === null || f.ctx < f.autoEnd) return []
      const stop = autoGate(a, f)
      if (stop) return stop
      const chain: AutoChain = { path: 'mid', stage: 'saving', atMs: f.nowMs, turnId: null, before: f.ctx }
      return [{ do: 'ifDraft', yes: [], no: [{ do: 'set', fn: x => ({ ...x, chain }) }, { do: 'abortSave', turnId: ev.turnId }] }]
    }
    case 'afterStep': {
      if (!a.since) return []
      const n = a.since.requests + 1
      if (n === 1 && isAutoActive(a) && ev.ctx >= f.autoStart) return [{ do: 'set', fn: haltPatch('stuck') }]
      return [{ do: 'set', fn: x => (x.since ? { ...x, since: n > AUTO_AGAIN_REQUESTS ? null : { ...x.since, requests: n } } : x) }]
    }
    case 'compactTime': {
      if (c?.stage !== 'compacting') return [{ do: 'compactingDone', at: ev.at }]
      const poll: AutoAction = { do: 'after', ms: DRAFT_POLL_MS, ev: { type: 'compactTime', at: ev.at, isHeld: true } }
      const hold: AutoAction[] = ev.isHeld
        ? [poll]
        : [{ do: 'phaseIdle' }, { do: 'set', fn: x => (x.chain?.stage === 'compacting' ? { ...x, chain: { ...x.chain, isDraftHeld: true } } : x) }, { do: 'toast', note: 'compact' }, poll]
      const unhold: AutoAction[] = ev.isHeld ? [{ do: 'set', fn: x => (x.chain?.isDraftHeld ? { ...x, chain: { ...x.chain, isDraftHeld: false } } : x) }] : []
      return [{ do: 'ifDraft', yes: hold, no: [...unhold, { do: 'compactNow', at: ev.at }] }]
    }
    case 'compactDone': {
      if (c?.stage !== 'compacting') return []
      const isNext = c.path === 'mid' && a.on && c.isInterrupted !== true && m.otherAt < c.atMs
      const since = { atMs: f.nowMs, requests: 0 }
      return [
        {
          do: 'set',
          fn: x => (x.chain?.stage === 'compacting' ? { ...x, since, chain: isNext ? { ...x.chain, stage: 'continuing', atMs: f.nowMs, turnId: null } : null } : x),
          then: isNext
            ? [{ do: 'ifDraft', yes: [{ do: 'set', fn: x => (x.chain?.stage === 'continuing' ? { ...x, chain: null } : x) }, { do: 'toast', note: 'continue' }], no: [{ do: 'continue' }] }]
            : [],
        },
      ]
    }
    case 'other': {
      const out: AutoAction[] = [{ do: 'otherAt', at: f.nowMs }]
      return c && (c.stage === 'compacting' || (c.stage === 'continuing' && c.turnId === null)) ? [...out, { do: 'set', fn: interruptPatch }] : out
    }
    case 'turnStart': {
      const out: AutoAction[] = ev.kind === 'save' ? [{ do: 'saveTurn', turnId: ev.turnId }] : []
      if (!c) return out
      if (((ev.kind === 'save' && c.stage === 'saving') || (ev.kind === 'continue' && c.stage === 'continuing')) && c.turnId === null) {
        return [...out, { do: 'set', fn: x => (x.chain ? { ...x, chain: { ...x.chain, turnId: ev.turnId } } : x) }]
      }
      if (ev.kind !== null) return out
      if (c.stage === 'wait') return [...out, { do: 'end' }]
      return c.stage === 'compacting' || (c.stage === 'continuing' && c.turnId === null) ? [...out, { do: 'set', fn: interruptPatch }] : out
    }
    case 'watch': {
      if (c?.stage === 'compacting' && m.compacting !== c.atMs && f.phase !== 'compacting' && f.flowLoaded) {
        return f.compactedSince ? [{ do: 'event', ev: { type: 'compactDone' } }] : [{ do: 'end' }]
      }
      if (c) return isChainStuck(c, f.nowMs) ? [{ do: 'end' }] : []
      return isAutoActive(a) && f.cold ? [{ do: 'set', fn: offPatch(f.cold) }] : []
    }
  }
}

export function autoRangeText(s: Settings, window: number | null | undefined): string {
  return bandNumText(s.autoStart, s.autoEnd, window, s.ctxUnit === 'both' ? 'size' : s.ctxUnit)
}

export function autoChipText(a: AutoState | null, s: Settings, ctx: number | null, window: number | null | undefined): string {
  const name = L('오토', 'Auto')
  if (!a || !a.on) return name
  if (a.stop !== null) return L('오토 멈춤', 'Auto stopped')
  if (a.chain?.isDraftHeld) return L('오토 · 입력 칸 글 기다림', 'Auto · waiting for your text')
  const stage = a.chain?.stage
  if (stage === 'saving') return L('오토 · 저장 중', 'Auto · saving')
  if (stage === 'compacting') return L('오토 · 컴팩트 중', 'Auto · compacting')
  if (stage === 'continuing') return L('오토 · 이어가는 중', 'Auto · continuing')
  if (stage === 'wait' || (ctx !== null && ctx >= s.autoStart)) return L('오토 · 답 끝나면 컴팩트', 'Auto · compacts when the answer ends')
  return `${name} ${ctxNumText(s.autoStart, window, s.ctxUnit === 'both' ? 'size' : s.ctxUnit)}`
}

export function autoDraftNote(step: 'save' | 'compact' | 'continue'): string {
  if (step === 'save') return L('입력 칸에 쓰던 글이 있어 이지 오토가 기다립니다 — 보내면 그 답이 끝난 뒤, 지우면 바로 이어 갑니다', 'Easy Auto is waiting for the text in your prompt box — send it and it runs after that answer, clear it and it goes on now')
  if (step === 'compact') return L('입력 칸에 쓰던 글이 있어 이지 오토가 컴팩트를 기다립니다 — 보내거나 지우면 이어 갑니다', 'Easy Auto is holding the compact for the text in your prompt box — send it or clear it and it goes on')
  return L('컴팩트를 마쳤습니다. 입력 칸에 쓰던 글이 있어 [이지 오토 · 이어가기] 글은 보내지 않았습니다', 'Compact done. You have text in the prompt box, so Easy Auto did not send its continue message')
}

export function autoToggleNote(isOn: boolean, s: Settings, window: number | null | undefined): string {
  return isOn ? L(`이지 오토를 켰습니다 · ${autoRangeText(s, window)}`, `Easy Auto is on · ${autoRangeText(s, window)}`) : L('이지 오토를 껐습니다', 'Easy Auto is off')
}

export function autoNoteText(note: NonNullable<AutoState['note']>, s: Settings, window: number | null | undefined): string {
  const front = ctxNumText(s.autoStart, window, s.ctxUnit === 'both' ? 'size' : s.ctxUnit)
  switch (note) {
    case 'stuck':
      return L(`이지 오토를 이 세션에서 멈췄습니다. 컴팩트하고도 ${front} 아래로 내려가지 않았습니다`, `Easy Auto stopped in this session. Compacting did not bring the context below ${front}`)
    case 'again':
      return L('이지 오토를 이 세션에서 멈췄습니다. 컴팩트 뒤 요청 몇 번 만에 또 넘었습니다', 'Easy Auto stopped in this session. The context went over again a few requests after compacting')
    case 'cold':
      return L('캐시가 만료돼 이지 오토를 껐습니다', 'The cache expired, so Easy Auto is off')
    case 'model':
      return L('모델을 바꿔 이지 오토를 껐습니다', 'The model changed, so Easy Auto is off')
  }
}
