import type { CtxPoint } from '../types'
import { fmtTokens, LEVEL_HEX, levelOf, thresholds } from './cost'
import { COMPACT_HEX, MODEL_HEX } from './flow'

const DEFAULT_COLOR = 0x01000000
const RULE = 0x9aa0a8
const TRACK = 0x6b7079

const hexInt = (hex: string) => parseInt(hex.replace('#', ''), 16)

function faded(color: number): number {
  const mix = (shift: number) => Math.round(((color >> shift) & 0xff) * 0.45 + 0x80 * 0.55)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇']

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

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

const BAR_MAX_W = 3

export function flowLayout(n: number, columns: number): { area: number; bars: number; barW: number; used: number; labelW: number } {
  const t = thresholds()
  const labelW = 1 + Math.max(fmtTokens(t.ctxWarn).length, fmtTokens(t.ctxCut).length)
  const area = Math.max(4, columns - labelW)
  const fit = Math.floor(area / Math.max(1, n))
  const [bars, barW] = fit >= 2 ? [n, Math.min(BAR_MAX_W, fit)] : [area, 1]
  return { area, bars, barW, used: bars * barW, labelW }
}

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
  const lineX = (index: number) => {
    const b = barOf(index)
    return barW >= 2 && b > 0 ? b * barW - 1 : b * barW
  }
  const ruleRow = (v: number) => rows - 1 - Math.min(rows - 1, Math.floor((v / top) * rows))
  const rules = [
    { row: ruleRow(t.ctxWarn), ch: '┈', name: fmtTokens(t.ctxWarn), hex: LEVEL_HEX.warn },
    { row: ruleRow(t.ctxCut), ch: '╌', name: fmtTokens(t.ctxCut), hex: LEVEL_HEX.cut },
  ]
  for (const r of rules) {
    for (let x = 0; x < area; x++) g.set(x, r.row, r.ch, RULE)
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
    const w = barW >= 2 ? barW - 1 : barW
    for (let dx = 0; dx < w; dx++) {
      const x = b * barW + dx
      for (let k = 0; k < full; k++) g.set(x, rows - 1 - k, '█', color)
      if (part > 0 && full < rows) g.set(x, rows - 1 - full, BLOCKS[part - 1]!, color)
    }
  }
  return g
}

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

export function timingCells(ctx: number, warn: number, cut: number, hex: string, columns: number): CellGrid {
  const top = Math.max(cut * 1.25, ctx * 1.04)
  const pct = (v: number) => (v / top) * 100
  return barCells(pct(ctx), [], hex, columns, [
    { percent: pct(warn), hex: LEVEL_HEX.warn },
    { percent: pct(cut), hex: LEVEL_HEX.cut },
  ])
}
