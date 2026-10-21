export const FLASH_TIMES = 3
export const FLASH_STEP_MS = 300
const FLASH_STEPS = FLASH_TIMES * 2
const FLASH_STALE_MS = 2_000

export type FlashKey = 'ctx' | 'sess' | 'cache'
const KEYS: readonly FlashKey[] = ['ctx', 'sess', 'cache']

const lastRank: Partial<Record<FlashKey, number>> = {}
const beganAt: Partial<Record<FlashKey, number>> = {}
const starting = new Set<FlashKey>()
let tick = 0
let drawnTick = -1
let drawnAt = 0
let stalls = 0
let isBarDraw = false

function begin(key: FlashKey): void {
  starting.add(key)
}

export function noteRank(key: FlashKey, rank: number, isOn: boolean): boolean {
  const prev = lastRank[key]
  lastRank[key] = rank
  if (prev === undefined || rank <= prev || !isOn) return false
  begin(key)
  return true
}

function phaseOf(key: FlashKey): number | null {
  const at = beganAt[key]
  if (at === undefined) return null
  const p = tick - at
  return p >= 0 && p < FLASH_STEPS ? p : null
}

export function isFlashing(key: FlashKey): boolean {
  return starting.has(key) || phaseOf(key) !== null
}

export function flashOn(key: FlashKey): boolean {
  const p = phaseOf(key)
  return isBarDraw && p !== null && p % 2 === 0
}

export function flashText(key: FlashKey, color: string | undefined): { color?: string; backgroundColor?: string } {
  if (color && flashOn(key)) return { backgroundColor: color, color: '#111111' }
  return color ? { color } : {}
}

export function drawingBar<T>(nowMs: number, draw: () => T): T {
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

export function stepFlash(): boolean {
  if (drawnTick === tick) {
    tick += 1
    stalls = 0
  } else if (++stalls >= FLASH_STEPS) {
    endFlash()
  }
  return KEYS.some(isFlashing)
}

function dropRunning(): void {
  for (const k of KEYS) delete beganAt[k]
  stalls = 0
}

export function endFlash(): void {
  dropRunning()
  starting.clear()
}

export const ARRIVE_SETTLE_MS = 600
const ARRIVE_WAIT_MS = 5_000
let arriveAt: number | null = null

export function markArrival(nowMs: number): void {
  arriveAt = nowMs
}

export function clearArrival(): void {
  arriveAt = null
}

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

export function isFlashBusy(nowMs: number): boolean {
  if (arriveAt !== null && nowMs - arriveAt <= ARRIVE_WAIT_MS) return true
  return starting.size > 0 || KEYS.some(k => phaseOf(k) !== null)
}

export function flashAnyOn(): boolean {
  return KEYS.some(k => flashOn(k))
}

export function resetFlash(): void {
  for (const k of KEYS) delete lastRank[k]
  endFlash()
  tick = 0
  drawnTick = -1
  drawnAt = 0
  arriveAt = null
}
