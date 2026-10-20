/**
 * 이지 오토 컴팩트(2026-10-19 — 정본 D:/Claude/easy-compact-auto.md "## 5. 구현 명세"): 정해 둔 구간을 넘으면 저절로 저장 → 컴팩트 →
 * (긴 일 도중이면) 이어가기. 여기는 순수 판단 · 화면 글만 — $ 와 상태(atom)를 쓰는 사슬은 register.tsx(엔진 규칙: $ · atom 은 그 파일
 * 안에서만), 보내는 글은 tidy.ts, 칩 · 안내 줄 그리기는 ui-auto.tsx.
 *
 * 켜고 끄기는 세션마다([컴팩트] 팝업 스위치), 새 세션은 늘 꺼진 채. 구간은 설정 ›
 * 컴팩트 탭(모든 세션). 사람이 입력해도 안 꺼진다. 자동 멈춤 둘(이 세션): ① 컴팩트 뒤 첫 요청이 여전히 앞쪽 이상 ② 앞 사슬의 컴팩트 뒤
 * 요청 3번 안에 또 넘음. 손해(바의 isLoss 와 같은 판정)면 이번만 쉬고, 캐시가 만료되거나 모델을 바꾸면 이 세션은 끈다
 */
import type { AutoChain, AutoState, CompactInputs, Settings, TurnSummary, Usage } from '../types'
import { average, compactPayoff, estimateFor, isLittleToSave } from './cost'
import { L } from './i18n'
import { bandNumText, ctxNumText } from './text'

/** 답 끝 길: 답이 끝나고 이만큼 기다려 그사이 사람 · 다른 세션 글이 들어왔으면 이번엔 쉰다(시험 C — 다른 세션 글이 0.12초 뒤에 들어왔다) */
export const AUTO_WAIT_MS = 500
/** 자동 멈춤 ②: 앞 사슬의 컴팩트 뒤 요청 이만큼 안에 또 넘으면 멈춤 */
export const AUTO_AGAIN_REQUESTS = 3
/** 이만큼 묵은 사슬은 버린다(다시 불림 · 앱 재시작 — 명세) */
export const AUTO_STALE_MS = 10 * 60_000
/** 단계마다 다음 일이 이만큼 안 오면 버린다: 기다림(시계가 다시 불림으로 사라짐) · 요약 턴이 안 시작됨 · 컴팩트가 안 끝남 */
const STAGE_LIMIT_MS = { wait: 5_000, saving: 60_000, compacting: 5 * 60_000, continuing: 60_000 } as const
/** $.store 키 — 세션마다 상태(앱을 다시 켜도 이어받는다). 1.0 의 autoLast(마지막으로 고른 값)는 안 읽는다 */
export const autoKey = (session: string) => `auto:${session}`

/** 새 세션 · 처음 읽은 세션의 상태 */
export function freshAuto(isOn: boolean, nowMs: number): AutoState {
  return { on: isOn, stop: null, note: null, chain: null, since: null, atMs: nowMs }
}

/** 오토가 일하는 중인가(켬 · 안 멈춤) — 이때 바의 깜빡임 · 슬림 알림은 오토에 맡긴다 */
export function isAutoActive(a: AutoState | null | undefined): boolean {
  return a != null && a.on && a.stop === null
}

/**
 * 저장소에 적어 둔 상태를 읽는다(앱 재시작). 깨졌으면 null. 사슬은 컴팩트 단계만 남긴다 — 다른 단계(기다림 · 요약 턴 · 이어가기)는 그
 * 턴이 엔진과 함께 사라졌다. 컴팩트 단계는 실제로 컴팩트가 끝났는지 흐름을 보고 이어 간다(register autoWatch). 10분 넘게 묵었으면 버린다
 */
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

/** 사슬이 그 단계에서 너무 오래 멈췄나(시계 · 턴이 다시 불림 · 재시작으로 사라졌다) — 버릴 때 */
export function isChainStuck(c: AutoChain, nowMs: number): boolean {
  const age = nowMs - c.atMs
  if (age > AUTO_STALE_MS) return true
  // 요약 · 이어가기 턴이 시작했으면 그 턴이 끝날 때까지 기다린다(긴 저장 턴도 있다 — 10분까지)
  if ((c.stage === 'saving' || c.stage === 'continuing') && c.turnId !== null) return false
  return age > STAGE_LIMIT_MS[c.stage]
}

/**
 * 손해 · 캐시 판정 — 바(ui-bar isLoss)와 같은 셈: 캐시가 살아 있으면 컴팩트 손익(compactPayoff)으로 아낄 게 거의 없나(isLittleToSave),
 * 식었으면 까닭(만료 · 모델 바뀜 — 오토를 끈다). 손익을 모르면(재료 없음) 막지 않는다
 */
export function autoLossOf(u: Usage, inputs: CompactInputs | null, sums: readonly TurnSummary[], nowMs: number): 'cold' | 'model' | 'loss' | null {
  const est = estimateFor(u, nowMs)
  if (est.kind === 'cold') return est.reason === 'model' ? 'model' : 'cold'
  if (est.kind !== 'warm' || !inputs) return null
  const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  const pay = compactPayoff(u.contextTokens, inputs, u.model, callsPerQ)
  return pay !== null && isLittleToSave(u.contextTokens, inputs.after, pay.breakEvenCalls) ? 'loss' : null
}

/** 사슬을 걸 자리에서 자동 멈춤 ②인가: 앞 사슬의 컴팩트 뒤 요청 3번 안 */
export function isTooSoon(a: AutoState): boolean {
  return a.since !== null && a.since.requests <= AUTO_AGAIN_REQUESTS
}

/** 구간 글(설정 숫자 꼴) — 토스트 · 풀이 */
export function autoRangeText(s: Settings, window: number | null | undefined): string {
  return bandNumText(s.autoStart, s.autoEnd, window, s.ctxUnit === 'both' ? 'size' : s.ctxUnit)
}

/**
 * 칩 글(데스크톱 입력창 아래 · 터미널 바 줄 끝 버튼 — 앱은 그 줄 버튼을 다 같은 색으로 그려 상태는 글이 말한다): 꺼짐 "오토" · 켜짐 "오토 200k"
 * (앞쪽) · 앞쪽을 넘어 답 끝을 기다림 "오토 · 답 끝나면 컴팩트" · 사슬 "오토 · 저장 중 | 컴팩트 중 | 이어가는 중" · 멈춤 "오토 멈춤"
 */
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

/** 1.0.2: 입력 칸에 사람이 쓰던 글이 있어 이지 오토가 기다리거나(요약 · 컴팩트) 이어가기를 안 보냈을 때 알림 */
export function autoDraftNote(step: 'save' | 'compact' | 'continue'): string {
  if (step === 'save') return L('입력 칸에 쓰던 글이 있어 이지 오토가 기다립니다 — 보내면 그 답이 끝난 뒤, 지우면 바로 이어 갑니다', 'Easy Auto is waiting for the text in your prompt box — send it and it runs after that answer, clear it and it goes on now')
  if (step === 'compact') return L('입력 칸에 쓰던 글이 있어 이지 오토가 컴팩트를 기다립니다 — 보내거나 지우면 이어 갑니다', 'Easy Auto is holding the compact for the text in your prompt box — send it or clear it and it goes on')
  return L('컴팩트를 마쳤습니다. 입력 칸에 쓰던 글이 있어 [이지 오토 · 이어가기] 글은 보내지 않았습니다', 'Compact done. You have text in the prompt box, so Easy Auto did not send its continue message')
}

/** 칩을 누른 뒤 토스트 */
export function autoToggleNote(isOn: boolean, s: Settings, window: number | null | undefined): string {
  return isOn ? L(`이지 오토를 켰습니다 · ${autoRangeText(s, window)}`, `Easy Auto is on · ${autoRangeText(s, window)}`) : L('이지 오토를 껐습니다', 'Easy Auto is off')
}

/** 입력창 위 한 줄(멈춤 둘 · 저절로 꺼짐 둘) */
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
