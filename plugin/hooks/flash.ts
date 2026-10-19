/**
 * 값이 바뀔 때 강조(1.0 — 사용자 "금액 · 컨텍스트 색이 바뀔 때 강조 한 번" → 시안 uxi_results/easy-compact/preview-1017g ③ →
 * preview-1017k "글자 깜빡 3번"). 색 단계가 오르는 순간(컨텍스트 아직 → 컴팩트할 때 → 늦어짐, 세션 금액 기준 $10 · $50 · $100, 캐시 넉넉 →
 * 곧 만료 → 만료)부터 그 값 글자의 바탕을 켰다 껐다 3번. 글자는 앱이 그려 CSS 움직임이 없어 엔진 시계로 다시 그린다(register
 * startFlashTicker). 내려갈 때(컴팩트 뒤 · 기준을 올림 · 요청으로 캐시가 다시 참)는 조용히, 처음 본 값(세션 시작 · mod 다시 불림)은 강조하지
 * 않는다. 설정 "애니메이션"(옛 이름 움직임) 끔이면 없음. 자리는 입력창 위 바만 — 패널 · 설정 견본은 같은 칸 함수를 써도 색만
 *
 * 사용자(2026-10-17 실물 "약간 급하게 밀리듯이 깜빡이고, 막대 그래프는 깜빡이면 안 될 듯 — 거기 애니메이션이 있으니, 대신 캐시 만료 글자는
 * 깜빡여 주면"):
 * - 박자: 예전엔 그린 시각으로 칸을 셌다 — 그리기가 밀리면 칸을 건너뛰거나 몰아 깜빡였다. 이제 칸은 시계가 넘기되 바가 그 칸을 그린 뒤에만
 *   다음 칸으로(켜짐 · 꺼짐이 하나씩 빠짐없이), 한 칸 0.2초 → 0.3초
 * - 게이지는 강조하지 않는다(예전엔 같은 칸에 작아졌다 — 게이지엔 제 움직임이 있다: 늦어짐 빨강 깜빡 · 컴팩트 중 · 줄어듦)
 * - 캐시 글(캐시 만료 · 모델 바뀜 · 곧 만료 노랑 분)도 강조하는 값
 */

/** 깜빡 수 · 한 칸(켜짐 또는 꺼짐) 길이 — 3번 = 6칸 = 1.8초 */
export const FLASH_TIMES = 3
export const FLASH_STEP_MS = 300
const FLASH_STEPS = FLASH_TIMES * 2
/** 한 칸이 이만큼 그대로면 시계가 멎은 것(엔진이 주기를 거절하면 시계가 소리 없이 끝난다) — 켜진 채 남지 않게 끝낸다 */
const FLASH_STALE_MS = 2_000

export type FlashKey = 'ctx' | 'sess' | 'cache'
const KEYS: readonly FlashKey[] = ['ctx', 'sess', 'cache']

const lastRank: Partial<Record<FlashKey, number>> = {}
/** 그 값의 강조가 시작된 칸(tick) */
const beganAt: Partial<Record<FlashKey, number>> = {}
/** 다음 바 그리기에서 시작할 값 — 단계를 본 그리기와 바를 그리는 사이에 시계가 칸을 넘겨도 첫 켜짐이 빠지지 않게 */
const starting = new Set<FlashKey>()
/** 강조 칸 — 시계가 넘긴다(바가 그린 칸만) */
let tick = 0
/** 바가 마지막으로 그린 칸 · 그 칸을 처음 그린 시각 · 그리지 않고 지나간 시계 수 */
let drawnTick = -1
let drawnAt = 0
let stalls = 0
/** 지금 바를 그리는 중인가(drawingBar 안) */
let isBarDraw = false

/** 그 값의 강조를 다음 바 그리기의 칸부터(켜짐) — 도는 시계에 얹힌다(값마다 시작 칸을 따로 센다) */
function begin(key: FlashKey): void {
  starting.add(key)
}

/**
 * 단계(0 = 아직 · 색 없음, 클수록 급함)를 보고 기억한다 — 앞보다 올랐고 isOn 이면 강조를 시작하고 true. 처음 본 값 · 같음 · 내려감은 false
 */
export function noteRank(key: FlashKey, rank: number, isOn: boolean): boolean {
  const prev = lastRank[key]
  lastRank[key] = rank
  if (prev === undefined || rank <= prev || !isOn) return false
  begin(key)
  return true
}

/** 그 값의 강조 안 몇째 칸인가(0 = 첫 켜짐) — 강조 중이 아니면 null */
function phaseOf(key: FlashKey): number | null {
  const at = beganAt[key]
  if (at === undefined) return null
  const p = tick - at
  return p >= 0 && p < FLASH_STEPS ? p : null
}

/** 강조 중인가(켜짐 · 꺼짐 칸 모두, 시작을 기다리는 값도) */
export function isFlashing(key: FlashKey): boolean {
  return starting.has(key) || phaseOf(key) !== null
}

/** 지금 그 값의 바탕이 켜진 칸인가 — 바를 그릴 때만(짝수 칸) */
export function flashOn(key: FlashKey): boolean {
  const p = phaseOf(key)
  return isBarDraw && p !== null && p % 2 === 0
}

/**
 * 값 글자의 꼴: 켜진 칸이면 바탕 = 그 단계 색 · 글 = 어두운 색(두 테마 다 읽힘), 아니면 단계 색 글 그대로(색이 없으면 빈 꼴)
 */
export function flashText(key: FlashKey, color: string | undefined): { color?: string; backgroundColor?: string } {
  if (color && flashOn(key)) return { backgroundColor: color, color: '#111111' }
  return color ? { color } : {}
}

/**
 * 바 그리기 — 이 안에서 칸 함수들이 강조를 읽는다(밖 = 패널 · 설정 견본은 색만, 밖에서 켜진 칸을 그리면 다시 안 그려져 켜진 채 남는다).
 * 시작을 기다리던 값은 이 칸부터, 그린 칸을 적어 둔다(시계는 그린 칸만 넘긴다). 그리기는 동기여야 한다(칸 함수가 이 안에서 불려야)
 */
export function drawingBar<T>(nowMs: number, draw: () => T): T {
  // 도는 강조만 끝낸다 — 이번 그리기에서 시작할 값(starting)은 남긴다
  if (drawnTick === tick && nowMs - drawnAt > FLASH_STALE_MS && KEYS.some(k => phaseOf(k) !== null)) dropRunning()
  if (starting.size > 0) {
    for (const k of starting) beganAt[k] = tick
    starting.clear()
    drawnAt = nowMs
  }
  if (drawnTick !== tick) {
    drawnTick = tick
    drawnAt = nowMs
  }
  isBarDraw = true
  try {
    return draw()
  } finally {
    isBarDraw = false
  }
}

/**
 * 시계 한 칸(register startFlashTicker): 바가 지금 칸을 그렸으면 다음 칸으로, 아직이면 기다린다 — 그리기가 밀려도 칸을 건너뛰거나 몰지
 * 않는다. 한 바퀴(6칸) 내내 안 그려지면(바가 숨음 · 다른 세션으로 감) 끝낸다. 아직 강조할 값이 남았으면 true
 */
export function stepFlash(): boolean {
  if (drawnTick === tick) {
    tick += 1
    stalls = 0
  } else if (++stalls >= FLASH_STEPS) {
    endFlash()
  }
  return KEYS.some(isFlashing)
}

/** 도는 강조를 끝낸다(시계가 멎음 · 바가 안 그려짐) — 켜진 채 남지 않게 */
function dropRunning(): void {
  for (const k of KEYS) delete beganAt[k]
  stalls = 0
}

/** 강조를 모두 끝낸다(세션에서 나감 · 시계를 못 검) — 시작을 기다리던 값까지 */
export function endFlash(): void {
  dropRunning()
  starting.clear()
}

/**
 * 세션에 들어왔을 때 한 번(1.0 — 사용자 "세션 변경해서 신규 세션 갔을 때 깜빡이는 거 1회, 그때 도달한 거 아니더라도 · 빠르게 세션
 * 전환했을 때 버그 안 생기게"): 들어온 신호(session.attach)를 기억해 두고, 화면이 자리 잡은 뒤(0.6초 — 세션을 바꾸는 동안은 앱이 대화를
 * 그리느라 바 그리기가 밀렸다, 사용자 "급하게 밀리듯이") 첫 바 그리기에서 급한 값(컴팩트할 때 · 늦어짐 · 금액 색 · 캐시 곧 만료 · 만료)을
 * 강조한다. 들어올 때마다 — 예전엔 들어옴 강조끼리 10초를 띄워, 세션을 오가면 어떨 때는 깜빡이고 어떨 때는 안 했다.
 * 빠른 전환은 자리 잡기(0.6초 안에 나가면 없음) · 나가면 지움(도는 강조 · 기다리던 들어옴)이 막는다. 5초 안에 안 그려진 들어옴은 버린다
 */
export const ARRIVE_SETTLE_MS = 600
const ARRIVE_WAIT_MS = 5_000
let arriveAt: number | null = null

/** 이 세션에 들어왔다(데스크톱이 붙음) — 자리 잡은 뒤 바 그리기에서 takeArrival */
export function markArrival(nowMs: number): void {
  arriveAt = nowMs
}

/** 이 세션에서 나갔다 — 기다리던 들어옴을 지운다(빠르게 오갈 때 늦은 강조가 안 남게) */
export function clearArrival(): void {
  arriveAt = null
}

/**
 * 들어온 뒤 바 그리기: 자리 잡기 전(0.6초 안)이면 기다리고, 그 뒤 첫 그리기에서 급한 값(단계 0 초과)이 있으면 강조를 시작하고 true.
 * 기다리던 들어옴은 이때 쓰고 지운다
 */
export function takeArrival(nowMs: number, ranks: Readonly<Record<FlashKey, number>>, isOn: boolean): boolean {
  const at = arriveAt
  if (at === null || nowMs - at < ARRIVE_SETTLE_MS) return false
  arriveAt = null
  if (!isOn || nowMs - at > ARRIVE_WAIT_MS) return false
  let isStarted = false
  for (const k of KEYS) {
    if (ranks[k] > 0) {
      begin(k)
      isStarted = true
    }
  }
  return isStarted
}

/**
 * 값 강조가 도는 중인가 — 시작을 기다리는 값 · 켜고 끄는 칸 · 자리 잡기를 기다리는 들어옴(5초 안). 그동안 바는 0.3초마다 다시 그려져, 움직이는
 * 게이지(틀)가 그때마다 처음부터 재생됐다.
 * ui-bar 가 이 동안 게이지를 가만히 둔다
 */
export function isFlashBusy(nowMs: number): boolean {
  if (arriveAt !== null && nowMs - arriveAt <= ARRIVE_WAIT_MS) return true
  return starting.size > 0 || KEYS.some(k => phaseOf(k) !== null)
}

/** 지금 켜진 칸인 값이 하나라도 있나 — 바를 그릴 때만(게이지가 글자와 같은 칸에 켜고 끈다) */
export function flashAnyOn(): boolean {
  return KEYS.some(k => flashOn(k))
}

/** 시험용 — 기억한 단계 · 강조 · 칸 · 들어옴을 지운다 */
export function resetFlash(): void {
  for (const k of KEYS) delete lastRank[k]
  endFlash()
  tick = 0
  drawnTick = -1
  drawnAt = 0
  arriveAt = null
}
