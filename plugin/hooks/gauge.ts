import type { Level } from './cost'

export const GAUGE_HEX = { warn: '#d9722b', cut: '#e05555' } as const

const STEP = { warn: 0.58, cut: 0.78 } as const

export const FULL_RATIO = 1.25

const RING = 'M32 5A27 27 0 1 1 32 59A27 27 0 1 1 32 5'

export function gaugeFrac(ctx: number, warn: number, cut: number): number {
  if (!(ctx > 0) || !(warn > 0) || !(cut > warn)) return 0
  const full = cut * FULL_RATIO
  if (ctx <= warn) return (ctx / warn) * STEP.warn
  if (ctx <= cut) return STEP.warn + ((ctx - warn) / (cut - warn)) * (STEP.cut - STEP.warn)
  return Math.min(1, STEP.cut + ((ctx - cut) / (full - cut)) * (1 - STEP.cut))
}

export function redDepth(ctx: number, cut: number): number {
  if (!(cut > 0)) return 0
  return Math.max(0, Math.min(1, (ctx - cut) / (cut * FULL_RATIO - cut)))
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0')

function lerpHex(a: string, b: string, t: number): string {
  const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16))
  const B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16))
  return `#${A.map((v, i) => hex2(v + (B[i]! - v) * t)).join('')}`
}

export type GaugeShape = 'bar' | 'ring' | 'vbar' | 'cells' | 'vcells'
export const GAUGE_SHAPES: readonly GaugeShape[] = ['bar', 'ring', 'vbar', 'cells', 'vcells']

export function gaugeWidth(shape: GaugeShape, px: number): number {
  return shape === 'bar' || shape === 'cells' ? Math.round(px * 1.625) : px
}

export type GaugeLook = {
  px: number
  shape?: GaugeShape
  frac: number
  level: Level
  from?: number
  fromLevel?: Level
  blink?: number | null
  motion?: boolean
  busy?: boolean
  fromBusy?: boolean
  lit?: boolean
}

const LIT_HEX = '#f5afaf'

export const BUSY_HEX = '#4c9be8'

const REDUCE = '@media (prefers-reduced-motion:reduce){.f,.g,.s,.c0,.c1,.c2,.c3{animation:none!important}}'

export function gaugeSvg(g: GaugeLook): string {
  if (g.shape !== undefined && g.shape !== 'ring') return barGaugeSvg(g, g.shape)
  const f = Math.max(0, Math.min(1, g.frac))
  const pct = Math.max(0.01, f * 100)
  const motion = g.motion !== false
  if (g.busy === true) {
    const track = `<path d="${RING}Z" stroke="currentColor" stroke-opacity=".2" stroke-width="8"/>`
    const arc = motion
      ? `<style>@keyframes gr{to{transform:rotate(360deg)}}.s{transform-origin:32px 32px;animation:gr 1.6s linear infinite}${REDUCE}</style><path class="s" d="${RING}" pathLength="100" stroke="${BUSY_HEX}" stroke-width="8" stroke-linecap="round" stroke-dasharray="28 100"/>`
      : `<path d="${RING}" pathLength="100" stroke="${BUSY_HEX}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${pct.toFixed(2)} 100"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.px}" height="${g.px}" viewBox="0 0 64 64" fill="none">${track}${arc}</svg>`
  }
  const fromPct = g.from !== undefined && motion && Math.abs(g.from - f) > 0.005 ? Math.max(0.01, Math.min(1, Math.max(0, g.from)) * 100) : null
  const stroke = g.lit === true ? LIT_HEX : g.level === 'ok' ? 'currentColor' : GAUGE_HEX[g.level]
  const opacity = f === 0 && fromPct === null ? '0' : g.level === 'ok' ? '.8' : '1'
  const t = g.blink === null || g.blink === undefined || !motion ? null : Math.max(0, Math.min(1, g.blink))
  const dur = fromPct !== null && fromPct - pct > 15 ? 1.3 : 0.5
  const fromHex = fromPct === null ? null : g.fromBusy === true ? BUSY_HEX : g.fromLevel !== undefined && g.fromLevel !== g.level && g.fromLevel !== 'ok' ? GAUGE_HEX[g.fromLevel] : null
  const fromStroke = fromHex ? `;stroke:${fromHex};stroke-opacity:1` : ''
  const slide = fromPct === null ? '' : `@keyframes gs{from{stroke-dasharray:${fromPct.toFixed(2)} 100${fromStroke}}}`
  const pulse = t === null ? '' : `@keyframes gp{50%{stroke:${lerpHex('#ea7c7c', '#ffe2e2', t)};stroke-width:${(8 + 1.8 * t).toFixed(2)}}}`
  const anim = [fromPct !== null ? `gs ${dur}s ease-out` : '', t !== null ? `gp ${(1.6 - 0.9 * t).toFixed(2)}s ease-in-out infinite` : ''].filter(Boolean).join(',')
  const css = anim ? `<style>${slide}${pulse}.f{animation:${anim}}@media (prefers-reduced-motion:reduce){.f{animation:none!important}}</style>` : ''
  const track = `<path d="${RING}Z" stroke="currentColor" stroke-opacity=".2" stroke-width="8"/>`
  const fill = `<path class="f" d="${RING}" pathLength="100" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${pct.toFixed(2)} 100"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.px}" height="${g.px}" viewBox="0 0 64 64" fill="none">${css}${track}${fill}</svg>`
}

function barGaugeSvg(g: GaugeLook, shape: 'bar' | 'vbar' | 'cells' | 'vcells'): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const f = clamp(g.frac)
  const motion = g.motion !== false
  const W = gaugeWidth(shape, g.px)
  const H = g.px
  const th = Math.max(4, Math.round(H * 0.38))
  const n2 = (v: number) => v.toFixed(2)
  const filled = (v: number) => (v <= 0 ? 0 : v < STEP.warn ? (v < STEP.warn / 2 ? 1 : 2) : v < STEP.cut ? 3 : 4)
  const isCells = shape === 'cells' || shape === 'vcells'
  const gap = Math.max(1, Math.round(H * 0.08))
  const frame = !isCells
    ? ''
    : shape === 'vcells'
      ? `<rect x="${n2((W - Math.round(W * 0.62)) / 2)}" y="0.5" width="${Math.round(W * 0.62)}" height="${H - 1}" rx="2" fill="none" stroke="currentColor" stroke-opacity=".45"/>`
      : `<rect x="0.5" y="${n2((H - Math.round(H * 0.75)) / 2)}" width="${W - 1}" height="${Math.round(H * 0.75)}" rx="2" fill="none" stroke="currentColor" stroke-opacity=".45"/>`
  const cellAt = (i: number) => {
    if (shape === 'vcells') {
      const fw = Math.round(W * 0.62)
      const cw = fw - 4
      const ch = (H - 4 - gap * 3) / 4
      return `x="${n2((W - fw) / 2 + 2)}" y="${n2(H - 2 - (i + 1) * ch - i * gap)}" width="${cw}" height="${n2(ch)}" rx="1"`
    }
    const ch = Math.max(5, Math.round(H * 0.5))
    const cw = (W - 5 - gap * 3) / 4
    return `x="${n2(2.5 + i * (cw + gap))}" y="${n2((H - ch) / 2)}" width="${n2(cw)}" height="${ch}" rx="1"`
  }
  if (g.busy === true) {
    let body = ''
    let css = ''
    if (isCells) {
      const n = motion ? 4 : filled(f)
      body = frame
      for (let i = 0; i < 4; i++) body += i < n ? `<rect class="c${i}" ${cellAt(i)} fill="${BUSY_HEX}"/>` : `<rect ${cellAt(i)} fill="currentColor" fill-opacity=".2"/>`
      if (motion) css = `@keyframes gc{0%,100%{opacity:.3}18%{opacity:1}45%{opacity:.3}}${[-0.35, -0.7, -1.05, 0].map((d, i) => `.c${i}{animation:gc 1.4s linear ${d}s infinite}`).join('')}`
    } else if (shape === 'bar') {
      const y = (H - th) / 2
      const len = W - 2
      body = `<rect x="1" y="${n2(y)}" width="${len}" height="${th}" rx="${th / 2}" fill="currentColor" fill-opacity=".2"/>`
      body += `<rect class="f" x="1" y="${n2(y)}" width="${n2(Math.max(th, len * f))}" height="${th}" rx="${th / 2}" fill="${BUSY_HEX}"/>`
    } else {
      const x = (W - th) / 2
      const len = H - 2
      const h = Math.max(th, len * f)
      body = `<rect x="${n2(x)}" y="1" width="${th}" height="${len}" rx="${th / 2}" fill="currentColor" fill-opacity=".2"/>`
      body += `<rect class="f" x="${n2(x)}" y="${n2(1 + len - h)}" width="${th}" height="${n2(h)}" rx="${th / 2}" fill="${BUSY_HEX}"/>`
    }
    if (motion && !isCells) css = '@keyframes gb{50%{opacity:.35}}.f{animation:gb 1.4s ease-in-out infinite}'
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${css ? `<style>${css}${REDUCE}</style>` : ''}${body}</svg>`
  }
  const from = g.from !== undefined && motion && Math.abs(g.from - f) > 0.005 ? clamp(g.from) : null
  const color = g.lit === true ? LIT_HEX : g.level === 'ok' ? 'currentColor' : GAUGE_HEX[g.level]
  const opacity = f === 0 && from === null ? '0' : g.level === 'ok' ? '.8' : '1'
  const t = g.blink === null || g.blink === undefined || !motion ? null : clamp(g.blink)
  const dur = from !== null && from - f > 0.15 ? 1.3 : 0.5
  const fromHex = from === null ? null : g.fromBusy === true ? BUSY_HEX : g.fromLevel !== undefined && g.fromLevel !== g.level && g.fromLevel !== 'ok' ? GAUGE_HEX[g.fromLevel] : null
  const fromFill = fromHex ? `;fill:${fromHex};fill-opacity:1` : ''
  let shapes = ''
  let slide = ''
  if (shape === 'bar') {
    const y = (H - th) / 2
    const len = W - 2
    shapes = `<rect x="1" y="${n2(y)}" width="${len}" height="${th}" rx="${th / 2}" fill="currentColor" fill-opacity=".2"/>`
    shapes += `<rect class="f" x="1" y="${n2(y)}" width="${n2(Math.max(th, len * f))}" height="${th}" rx="${th / 2}" fill="${color}" fill-opacity="${opacity}"/>`
    if (from !== null) slide = `@keyframes gs{from{width:${n2(Math.max(th, len * from))}px${fromFill}}}`
  } else if (shape === 'vbar') {
    const x = (W - th) / 2
    const len = H - 2
    const h = Math.max(th, len * f)
    shapes = `<rect x="${n2(x)}" y="1" width="${th}" height="${len}" rx="${th / 2}" fill="currentColor" fill-opacity=".2"/>`
    shapes += `<rect class="f" x="${n2(x)}" y="${n2(1 + len - h)}" width="${th}" height="${n2(h)}" rx="${th / 2}" fill="${color}" fill-opacity="${opacity}"/>`
    if (from !== null) {
      const hf = Math.max(th, len * from)
      slide = `@keyframes gs{from{height:${n2(hf)}px;y:${n2(1 + len - hf)}px${fromFill}}}`
    }
  } else {
    const n = filled(f)
    const nFrom = from !== null ? filled(from) : n
    shapes = frame
    for (let i = 0; i < 4; i++) {
      const at = cellAt(i)
      shapes += i < n ? `<rect class="f" ${at} fill="${color}" fill-opacity="${opacity}"/>` : i < nFrom ? `<rect class="g" ${at} fill="currentColor" fill-opacity=".2"/>` : `<rect ${at} fill="currentColor" fill-opacity=".2"/>`
    }
    if (nFrom > n) slide = `@keyframes gs{from{fill:${fromHex ?? (g.level === 'ok' ? '#888888' : GAUGE_HEX[g.level])};fill-opacity:1}}`
  }
  const pulse = t === null ? '' : `@keyframes gp{50%{fill:${lerpHex('#ea7c7c', '#ffe2e2', t)}}}`
  const fAnim = [slide && !isCells ? `gs ${dur}s ease-out` : '', t !== null ? `gp ${(1.6 - 0.9 * t).toFixed(2)}s ease-in-out infinite` : ''].filter(Boolean).join(',')
  const rules = [fAnim ? `.f{animation:${fAnim}}` : '', slide && isCells ? `.g{animation:gs ${dur}s ease-out}` : ''].join('')
  const css = rules ? `<style>${slide}${pulse}${rules}@media (prefers-reduced-motion:reduce){.f,.g{animation:none!important}}</style>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${css}${shapes}</svg>`
}
