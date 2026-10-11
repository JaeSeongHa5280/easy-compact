/**
 * 터미널 칸 그림(엔진 Raster — 칸마다 글자 · 글자색 · 바탕색). 터미널엔 Svg 가 없어 데스크톱 그림(flow.ts flowSvg · timingSvg,
 * ui-common ctxBar)과 같은 규칙을 칸으로 그린다. 칸 글자는 한 칸짜리만 받으므로(엔진 규칙) 한글 이름 · 시간 축은 그림 밖
 * 글 줄로 둔다. Image(픽셀)는 kitty · Ghostty 같은 몇 터미널만 그려 Windows 터미널에선 글만 보여 쓰지 않았다
 */
import type { CtxPoint } from '../types'
import { fmtTokens, LEVEL_HEX, levelOf, thresholds } from './cost'
import { COMPACT_HEX, MODEL_HEX } from './flow'

/** 터미널 기본색(엔진 Raster 규칙: 0x01000000) */
const DEFAULT_COLOR = 0x01000000
/** 기준 점선 · 빈 칸 · 상주 회색 — 데스크톱 RULE_HEX · 바탕 회색과 맞춘다 */
const RULE = 0x9aa0a8
const TRACK = 0x6b7079
const PERM = 0x8a8f98

const hexInt = (hex: string) => parseInt(hex.replace('#', ''), 16)

/** 지난 구간 막대: 수준 색을 회색 쪽으로 반쯤 — 데스크톱의 0.4 불투명처럼 흐리게(밝은 · 어두운 배경 둘 다) */
function faded(color: number): number {
  const mix = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.45 + 0x80 * 0.55)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

/** 아래에서 위로 1/8 씩 채우는 글자 */
const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇']

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** 표준 base64(채움 있음) — 엔진 Raster 의 cells 형식 */
function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0
    out += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]!
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : '='
    out += i + 2 < bytes.length ? B64[c & 63]! : '='
  }
  return out
}

/** 칸 격자: 칸마다 [글자, 글자색, 바탕색] u32 셋(리틀 엔디언) */
export class CellGrid {
  readonly words: Uint32Array

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    this.words = new Uint32Array(columns * rows * 3)
    for (let i = 0; i < columns * rows; i++) this.words.set([0x20, DEFAULT_COLOR, DEFAULT_COLOR], i * 3)
  }

  set(x: number, y: number, ch: string, fg: number, bg = DEFAULT_COLOR): void {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return
    this.words.set([ch.codePointAt(0)!, fg, bg], (y * this.columns + x) * 3)
  }

  get(x: number, y: number): { ch: string; fg: number; bg: number } {
    const i = (y * this.columns + x) * 3
    return { ch: String.fromCodePoint(this.words[i]!), fg: this.words[i + 1]!, bg: this.words[i + 2]! }
  }

  /** 줄마다 글자만(시험 · 디버그용) */
  lines(): string[] {
    const out: string[] = []
    for (let y = 0; y < this.rows; y++) {
      let line = ''
      for (let x = 0; x < this.columns; x++) line += this.get(x, y).ch
      out.push(line)
    }
    return out
  }

  toBase64(): string {
    return base64(new Uint8Array(this.words.buffer, this.words.byteOffset, this.words.byteLength))
  }
}

/** 흐름 그래프 막대 한 개의 칸 수 상한(막대 2 + 틈 1) — 요청이 적을 때 막대 둘이 25칸씩 넓은 판처럼 그려져 그래프로 안 읽혔다(2026-10-11 CLI) */
const BAR_MAX_W = 3

/**
 * 흐름 그래프 칸 배치: 오른쪽 끝에 기준 이름(" 400k") 자리를 두고, 나머지에 막대. 막대는 왼쪽부터 쌓고(요청이 적으면 오른쪽이 빈다)
 * 막대 하나는 BAR_MAX_W 칸까지 — 시간 축(첫 요청 · 지금)은 쓴 폭(used)에 맞춘다
 */
export function flowLayout(n: number, columns: number): { area: number; bars: number; barW: number; used: number; labelW: number } {
  const t = thresholds()
  const labelW = 1 + Math.max(fmtTokens(t.ctxWarn).length, fmtTokens(t.ctxCut).length)
  const area = Math.max(4, columns - labelW)
  // 요청마다 두 칸 넘게 돌아가면 막대(BAR_MAX_W 까지) + 틈, 아니면 한 칸씩 폭을 다 채운다 — 요청이 칸보다 적으면 한 요청이
  // 여러 칸, 많으면 여러 요청을 한 칸에(가장 큰 값). 한 칸 막대로 두면 요청 90개가 146칸 중 90칸만 쓰고 오른쪽이 비었다
  const fit = Math.floor(area / Math.max(1, n))
  const [bars, barW] = fit >= 2 ? [n, Math.min(BAR_MAX_W, fit)] : [area, 1]
  return { area, bars, barW, used: bars * barW, labelW }
}

/**
 * 흐름 그래프(터미널): 요청 묶음마다 아래에서 위로 막대(1/8 칸 글자), 색 = 그 크기의 기준 색, 마지막 컴팩트 앞은 흐리게.
 * ┈ = 구간 시작(강조), ╌ = 구간 끝(권장) 기준 높이 — 오른쪽 끝에 그 크기(노랑 · 빨강 글자), ┃ 청록 = 컴팩트한 시점,
 * ┇ 보라 = 모델 바꾼 시점(앞 막대와의 틈에) — flowSvg 와 같은 규칙. 기준 이름은 숫자 · k · M 이라 한 칸짜리 글자로 그림 안에 둔다
 */
export function flowCells(points: readonly CtxPoint[], marks: readonly number[], columns: number, rows: number, switches: readonly number[] = []): CellGrid {
  const g = new CellGrid(columns, rows)
  const n = points.length
  if (n === 0) return g
  const t = thresholds()
  let top = t.ctxCut
  for (const p of points) if (p.ctx > top) top = p.ctx
  top *= 1.05
  const { area, bars, barW } = flowLayout(n, columns)
  const per = n / bars
  const barOf = (index: number) => Math.min(bars - 1, Math.max(0, Math.floor((index / n) * bars)))
  // 세로선 자리: 막대 사이 틈(앞 막대의 오른쪽 칸) — 틈이 없으면(한 칸 막대) 그 막대 칸
  const lineX = (index: number) => {
    const b = barOf(index)
    return barW >= 2 && b > 0 ? b * barW - 1 : b * barW
  }
  // 기준선 줄: 그 크기가 닿는 칸(위에서 몇째 줄)
  const ruleRow = (v: number) => rows - 1 - Math.min(rows - 1, Math.floor((v / top) * rows))
  const rules = [
    { row: ruleRow(t.ctxWarn), ch: '┈', name: fmtTokens(t.ctxWarn), hex: LEVEL_HEX.warn },
    { row: ruleRow(t.ctxCut), ch: '╌', name: fmtTokens(t.ctxCut), hex: LEVEL_HEX.cut },
  ]
  for (const r of rules) {
    for (let x = 0; x < area; x++) g.set(x, r.row, r.ch, RULE)
    // 두 기준이 같은 줄이면 뒤(끝)만 — 이름 자리를 비우고 쓴다(겹친 글자가 남지 않게)
    const label = ` ${r.name}`.padEnd(columns - area)
    for (let i = 0; i < label.length; i++) g.set(area + i, r.row, label[i]!, hexInt(r.hex))
  }
  for (const index of switches) for (let y = 0; y < rows; y++) g.set(lineX(index), y, '┇', hexInt(MODEL_HEX))
  for (const index of marks) for (let y = 0; y < rows; y++) g.set(lineX(index), y, '┃', hexInt(COMPACT_HEX))
  const lastMark = marks.length > 0 ? marks[marks.length - 1]! : 0
  for (let b = 0; b < bars; b++) {
    const from = Math.floor(b * per)
    const to = Math.max(from + 1, Math.floor((b + 1) * per))
    let v = 0
    for (let i = from; i < to && i < n; i++) v = Math.max(v, points[i]!.ctx)
    const level = hexInt(LEVEL_HEX[levelOf(v)])
    const color = from < lastMark ? faded(level) : level
    const eighths = Math.max(1, Math.round((v / top) * rows * 8))
    const full = Math.min(rows, Math.floor(eighths / 8))
    const part = eighths % 8
    // 막대 사이 틈: 두 칸 넘는 자리면 오른쪽 한 칸을 비운다(세로선 자리)
    const w = barW >= 2 ? barW - 1 : barW
    for (let dx = 0; dx < w; dx++) {
      const x = b * barW + dx
      for (let k = 0; k < full; k++) g.set(x, rows - 1 - k, '█', color)
      if (part > 0 && full < rows) g.set(x, rows - 1 - full, BLOCKS[part - 1]!, color)
    }
  }
  return g
}

/**
 * 한 줄 막대(터미널): 앞에서부터 parts(상주 몫 등) 색 → 나머지 채움 hex 로 percent 까지, 그 뒤는 ░.
 * marks 자리엔 ┃(그 색) — 채운 칸 위면 바탕을 채움 색으로 둬 칸이 끊겨 보이지 않게
 */
export function barCells(
  percent: number,
  parts: readonly { percent: number; hex: string }[],
  hex: string,
  columns: number,
  marks: readonly { percent: number; hex: string }[] = [],
): CellGrid {
  const g = new CellGrid(columns, 1)
  const at = (p: number) => Math.round((Math.max(0, Math.min(100, p)) / 100) * columns)
  const filled = at(percent)
  const fill: number[] = []
  let x = 0
  for (const part of parts) {
    const end = Math.min(filled, x + at(part.percent))
    for (; x < end; x++) fill[x] = hexInt(part.hex)
  }
  for (; x < filled; x++) fill[x] = hexInt(hex)
  for (let i = 0; i < columns; i++) g.set(i, 0, i < filled ? '█' : '░', i < filled ? fill[i]! : TRACK)
  for (const m of marks) {
    if (m.percent <= 0 || m.percent >= 100) continue
    const mx = Math.min(columns - 1, at(m.percent))
    g.set(mx, 0, '┃', hexInt(m.hex), mx < filled ? fill[mx]! : DEFAULT_COLOR)
  }
  return g
}

/**
 * 컴팩트 시점 막대(터미널): timingSvg 와 같은 눈금 — 끝 = 구간 끝의 1.25배(또는 지금 크기), 회색 = 상주, 그 뒤 지금까지
 * 상태 색, 시작(노랑) · 끝(빨강) 자리에 ┃
 */
export function timingCells(ctx: number, base: number | null, warn: number, cut: number, hex: string, columns: number): CellGrid {
  const top = Math.max(cut * 1.25, ctx * 1.04)
  const pct = (v: number) => (v / top) * 100
  const parts = base !== null && base > 0 ? [{ percent: pct(Math.min(base, ctx)), hex: `#${PERM.toString(16)}` }] : []
  return barCells(pct(ctx), parts, hex, columns, [
    { percent: pct(warn), hex: LEVEL_HEX.warn },
    { percent: pct(cut), hex: LEVEL_HEX.cut },
  ])
}
