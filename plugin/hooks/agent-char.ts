export type AgentPose = 'run' | 'still' | 'done'

const PAL: Readonly<Record<string, string>> = {
  o: '#1d2c48',
  A: '#f2bf55',
  a: '#fde7a6',
  N: '#4c9be8',
  n: '#2f6fc0',
  h: '#a4d0f8',
  e: '#0f1b2a',
  w: '#ffffff',
  k: '#f4a3b8',
  c: '#fff3c4',
  g: '#1f7a3a',
  G: '#aeb6c2',
  t: '#7ee0c3',
}

const BOSS = ['.....oooooo', '....oaAAAAAo', '...oAAAAAAAAo', '..oNhNNNNNNNNo', '..oNNweNNweNNo', '..oNNeeNNeeNNo', '..oNkNNNNNNkNo', '..onNNNNNNNNno', '...onnnnnnnno', '....oooooooo', '....o.o..o.o']
const ARM_IN = ['N', 'N']
const ARM_OUT = ['NNN']
const ARM_UP = ['..N', '.N.', 'N..']
const EXCL = ['NN', 'NN', 'NN', 'NN', '', 'NN', 'NN']
const BABY = ['.o....o.', '.oNNNNo.', 'oNeNNeNo', 'oNkNNkNo', '.oooooo.', '..o..o..']
const F7: Readonly<Record<string, readonly string[]>> = {
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  E: ['XXXX', 'X...', 'X...', 'XXX.', 'X...', 'X...', 'XXXX'],
}
const DONE_ROWS = [0, 1, 2, 3, 4, 5, 6].map(r => ['D', 'O', 'N', 'E'].map(ch => F7[ch][r]).join('.'))
const BANNER = ['.' + 'o'.repeat(24) + '.', ...DONE_ROWS.map(r => `oc${r.replace(/X/g, 'g').replace(/\./g, 'c')}co`), '.' + 'o'.repeat(24) + '.']

export const AGENT_STEP = 9
const BABY_X = 17
export const AGENT_MAX_SHOWN = 3
const DONE_W = 42
const BANNER_X = 16

function paths(grid: readonly string[], dx: number, dy: number): string {
  const rects: Record<string, string> = {}
  let open = new Map<string, { ch: string; x: number; w: number; y: number; h: number }>()
  const close = (r: { ch: string; x: number; w: number; y: number; h: number }) => {
    rects[r.ch] = `${rects[r.ch] ?? ''}M${r.x + dx} ${r.y + dy}h${r.w}v${r.h}h-${r.w}z`
  }
  grid.forEach((row, y) => {
    const next = new Map<string, { ch: string; x: number; w: number; y: number; h: number }>()
    for (let x = 0; x < row.length; ) {
      const ch = row[x]
      let w = 1
      while (row[x + w] === ch) w++
      if (PAL[ch]) {
        const key = `${ch}${x},${w}`
        const prev = open.get(key)
        if (prev) {
          prev.h++
          open.delete(key)
          next.set(key, prev)
        } else next.set(key, { ch, x, w, y, h: 1 })
      }
      x += w
    }
    open.forEach(close)
    open = next
  })
  open.forEach(close)
  return Object.keys(rects)
    .map(ch => `<path fill="${PAL[ch]}" d="${rects[ch]}"/>`)
    .join('')
}

const shownOf = (pose: AgentPose, n: number) => (pose === 'run' ? Math.max(1, Math.min(n, AGENT_MAX_SHOWN)) : 1)

export function agentCharWidth(px: number, pose: AgentPose, n = 1): number {
  const units = pose === 'done' ? DONE_W : BABY_X - 1 + AGENT_STEP * shownOf(pose, n)
  return (px * units) / 16
}

export function agentCharSvg(px: number, pose: AgentPose, n = 1): string {
  const boss = paths(BOSS, 0, 4) + paths(ARM_IN, 14, 10)
  const babyDef = `<defs><g id="b">${paths(BABY, 0, 0)}</g></defs>`
  const baby = (x: number, y: number, cls = '', delay = '') => `<g transform="translate(${x},${y})"><g${cls ? ` class="${cls}"` : ''}${delay}><use href="#b"/></g></g>`
  let body: string
  let vbW: number
  if (pose === 'done') {
    body = `${babyDef}${boss}${paths(BANNER, BANNER_X, 0)}${baby(BANNER_X + 1, 9)}${baby(BANNER_X + 17, 9)}`
    vbW = DONE_W
  } else {
    const shown = shownOf(pose, n)
    const isRun = pose === 'run'
    const css = isRun
      ? '<style>.s{animation:s 1.6s steps(1) infinite}.u,.o{opacity:0}.u{animation:u 1.6s steps(1) infinite}.o{animation:o 1.6s steps(1) infinite}' +
        '.i{animation:i 1.6s steps(1) infinite}.j{animation:j 1.6s steps(1) infinite}@keyframes s{0%{opacity:1}42%{opacity:0}100%{opacity:0}}' +
        '@keyframes u{0%{opacity:1}10%{opacity:0}21%{opacity:1}31%{opacity:0}100%{opacity:0}}@keyframes o{0%{opacity:0}10%{opacity:1}21%{opacity:0}31%{opacity:1}42%{opacity:0}100%{opacity:0}}' +
        '@keyframes i{0%{opacity:0}42%{opacity:1}100%{opacity:1}}@keyframes j{0%{transform:translateY(0)}48%{transform:translateY(-3px)}58%{transform:translateY(0)}100%{transform:translateY(0)}}' +
        '@media (prefers-reduced-motion:reduce){.s,.u,.o,.i,.j{animation:none!important}.s,.u,.o{opacity:0!important}}</style>'
      : ''
    const bossNow = isRun
      ? `${paths(BOSS, 0, 4)}<g class="u">${paths(ARM_UP, 14, 7)}</g><g class="o">${paths(ARM_OUT, 14, 9)}</g><g class="i">${paths(ARM_IN, 14, 10)}</g><g class="s">${paths(EXCL, 14, 0)}</g>`
      : boss
    const babies = Array.from({ length: shown }, (_, i) =>
      baby(BABY_X + AGENT_STEP * i, 10, isRun ? 'j' : '', isRun && i > 0 ? ` style="animation-delay:${(0.12 * i).toFixed(2)}s"` : ''),
    ).join('')
    body = `${css}${babyDef}${bossNow}${babies}`
    vbW = BABY_X - 1 + AGENT_STEP * shown
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${agentCharWidth(px, pose, n)}" height="${px}" viewBox="0 0 ${vbW} 16" shape-rendering="crispEdges">${body}</svg>`
}

export type WorkPose = 'run' | 'still'
const WORK_W = 25
const BOSS_R = [...BOSS.slice(0, 4), '..oNNNweNNweNo', '..oNNNeeNNeeNo', ...BOSS.slice(6)]
const LAPTOP = ['.ooooooo.', '.oeeeeeo.', '.oeeeeeo.', '.oeeeeeo.', '.oeeeeeo.', '.oeeeeeo.', '.ooooooo.', 'GGGGGGGGG', 'ooooooooo']
const TAP_A = ['N.', '.N']
const TAP_B = ['NN']
const CHECK = ['...t', 't.t.', '.t..']

export function workCharWidth(px: number): number {
  return (px * WORK_W) / 16
}

export function workCharSvg(px: number, pose: WorkPose): string {
  const base = `${paths(LAPTOP, 16, 5)}${paths(BOSS_R, 0, 4)}`
  const cell = (i: number) => paths(['t'], 18 + i, 9)
  let body: string
  if (pose === 'still') body = `${base}${paths(TAP_A, 14, 10)}${cell(0)}${cell(1)}${cell(2)}`
  else {
    const tap = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `${i * 12.5}%{opacity:${i % 2 === 0 ? 1 : 0}}`).join('')
    const tapB = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `${i * 12.5}%{opacity:${i % 2 === 0 ? 0 : 1}}`).join('')
    const fill = [0, 1, 2, 3, 4].map(i => `.p${i}{opacity:0;animation:p${i} 2.4s steps(1) infinite}@keyframes p${i}{0%{opacity:0}${8 + i * 14}%{opacity:1}86%{opacity:0}100%{opacity:0}}`).join('')
    const css =
      `<style>.ta{animation:ta 1.2s steps(1) infinite}.tb{opacity:0;animation:tb 1.2s steps(1) infinite}@keyframes ta{${tap}}@keyframes tb{${tapB}}${fill}` +
      '.ck{opacity:0;animation:ck 2.4s steps(1) infinite}@keyframes ck{0%{opacity:0}76%{opacity:1}86%{opacity:0}100%{opacity:0}}' +
      '@media (prefers-reduced-motion:reduce){.ta,.tb,.ck,.p0,.p1,.p2,.p3,.p4{animation:none!important}.tb,.ck,.p3,.p4{opacity:0!important}.p0,.p1,.p2{opacity:1!important}}</style>'
    body = `${css}${base}${[0, 1, 2, 3, 4].map(i => `<g class="p${i}">${cell(i)}</g>`).join('')}<g class="ck">${paths(CHECK, 18, 6)}</g><g class="ta">${paths(TAP_A, 14, 10)}</g><g class="tb">${paths(TAP_B, 14, 10)}</g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${workCharWidth(px)}" height="${px}" viewBox="0 0 ${WORK_W} 16" shape-rendering="crispEdges">${body}</svg>`
}
