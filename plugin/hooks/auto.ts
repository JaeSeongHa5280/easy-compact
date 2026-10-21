import type { AutoChain, AutoState, CompactInputs, Settings, TurnSummary, Usage } from '../types'
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
  return { on: r.on, stop, note, chain, since, atMs: nowMs }
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
