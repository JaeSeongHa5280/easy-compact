/**
 * 에이전트 캐릭터 "도트 벌레"(B4, 0.6.1 피드백 — 사용자 "에이전트가 돌 때 나오는 🤖 이모지가 짜친다 · 클로드 앱 캐릭터처럼 열심히 일하거나 좌우로
 * 움직이는 애니메이션 · 그 에이전트가 동작 중일 때만, 멈추면 초기화하고 기본 모습"). 후보 넷 가운데 사용자가 도트 벌레를 고름(2026-10-15). 앱
 * 캐릭터를 베끼지 않은 자체 그림(상표 · 디렉터리 심사).
 *
 * 1.0: 모자 쓴 대장 벌레(지금 세션) +
 * 작은 벌레(도는 에이전트 수만큼 셋까지, 넘으면 부르는 쪽이 옆 글 "+N"). 진한 외곽선 · 두 톤 음영 · 반짝이는 큰 눈 · 볼 터치(사용자가 보여 준
 * 다른 앱 캐릭터 고르기 화면을 참고 — 그림은 새로 그림). 한 박자(1.6초): 대장이 머리 위에 파랑 "!" 를 띄우며 앞발을 위 · 앞으로 두 번
 * 흔들고(손짓) → 작은 벌레들이 차례로 깡충(응답). 느낌표는 말풍선 없이 굵은 파랑 — 16px 에서 말풍선 속 1칸 느낌표는 흰 깃발처럼 보였고, 흰
 * 글자 + 외곽선은 밝은 바탕에서 "8" 로 보였다.
 * 끝나면: 대장 옆에서 작은
 * 벌레 둘(= 에이전트)이 DONE 현수막을 머리로 받친다. 글자는 5 × 7 글꼴 — 5px 글꼴은 16px 줄에서 안 읽혔다. 글 쪽은 text.ts agentPart 가
 * "에이전트 N개 완료"로.
 *
 * 그림은 색마다 path 하나(같은 색 칸을 가로 · 세로로 묶은 네모) — rect 보다 글이 짧다(패널 그리기 한도, size.test). 작은 벌레는 <use> 로 한
 * 번만 적는다. 키프레임엔 transform · opacity 만 — color-mix(currentColor) 를 넣으면 Chromium 렌더러가 죽었다(gauge.ts). 자리(transform
 * 속성)와 움직임(CSS transform)은 다른 g 에 — 한 g 에 두면 움직임이 자리를 덮는다. OS 동작 줄이기면 그림 안에서 쉼 자세로 멈추고, 설정
 * "애니메이션" 끔이면 처음부터 쉬는 그림(ui-common agentMark). 순수 함수(시험 · 그림 도구가 같이 쓴다)
 */

/** run = 도는 중(움직임) · still = 도는 중이지만 움직임 끔(쉬는 자세) · done = 다 끝남(DONE 현수막) */
export type AgentPose = 'run' | 'still' | 'done'

const PAL: Readonly<Record<string, string>> = {
  o: '#1d2c48', // 외곽선
  A: '#f2bf55', // 모자
  a: '#fde7a6', // 모자 빛
  N: '#4c9be8', // 몸(mod 파랑 BRAND_HEX — 답변 칩 · 진행 점과 같은 계열) · 앞발 · 느낌표
  n: '#2f6fc0', // 몸 그늘
  h: '#a4d0f8', // 몸 빛
  e: '#0f1b2a', // 눈
  w: '#ffffff', // 눈 반짝임
  k: '#f4a3b8', // 볼
  c: '#fff3c4', // 현수막 바탕
  g: '#1f7a3a', // 현수막 글(DONE)
  G: '#aeb6c2', // 노트북 자판(진행 칸 캐릭터)
  t: '#7ee0c3', // 노트북 화면 막대 · ✓
}

// 16칸 판 — 한 줄 = 한 픽셀 줄, '.' = 빈칸. 대장은 4 ~ 14줄 · 2 ~ 13칸
const BOSS = ['.....oooooo', '....oaAAAAAo', '...oAAAAAAAAo', '..oNhNNNNNNNNo', '..oNNweNNweNNo', '..oNNeeNNeeNNo', '..oNkNNNNNNkNo', '..onNNNNNNNNno', '...onnnnnnnno', '....oooooooo', '....o.o..o.o']
// 앞발 세 자세(오른쪽 어깨 14칸): 쉼(아래로) · 앞(작은 벌레 쪽을 가리킴) · 위(들어 올림)
const ARM_IN = ['N', 'N']
const ARM_OUT = ['NNN']
const ARM_UP = ['..N', '.N.', 'N..']
// 머리 위 느낌표(14 ~ 15칸 · 0 ~ 6줄): 막대 4줄 · 틈 · 점 2줄
const EXCL = ['NN', 'NN', 'NN', 'NN', '', 'NN', 'NN']
// 작은 벌레(8칸 폭, 6줄)
const BABY = ['.o....o.', '.oNNNNo.', 'oNeNNeNo', 'oNkNNkNo', '.oooooo.', '..o..o..']
// DONE 현수막(26 × 9): 5 × 7 글꼴(E 만 4칸), 글 사이 1칸 · 좌우 여백 1칸
const F7: Readonly<Record<string, readonly string[]>> = {
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
  E: ['XXXX', 'X...', 'X...', 'XXX.', 'X...', 'X...', 'XXXX'],
}
const DONE_ROWS = [0, 1, 2, 3, 4, 5, 6].map(r => ['D', 'O', 'N', 'E'].map(ch => F7[ch][r]).join('.'))
const BANNER = ['.' + 'o'.repeat(24) + '.', ...DONE_ROWS.map(r => `oc${r.replace(/X/g, 'g').replace(/\./g, 'c')}co`), '.' + 'o'.repeat(24) + '.']

/** 작은 벌레 사이 칸 · 첫 작은 벌레 자리(대장 + 앞발 + 느낌표가 0 ~ 16칸) · 그리는 최대 수(넘는 수는 옆 글 "+N") · 끝난 그림 폭 · 현수막 자리 */
export const AGENT_STEP = 9
const BABY_X = 17
export const AGENT_MAX_SHOWN = 3
const DONE_W = 42
const BANNER_X = 16

/** 글 판 → 색마다 path 하나: 같은 글자가 가로로 이어지면 한 칸, 같은 자리 · 폭이 아래 줄로 이어지면 한 네모로 */
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

/** 그림 폭(px) — 도는 중이면 작은 벌레 수만큼, 끝났으면 현수막까지 */
export function agentCharWidth(px: number, pose: AgentPose, n = 1): number {
  const units = pose === 'done' ? DONE_W : BABY_X - 1 + AGENT_STEP * shownOf(pose, n)
  return (px * units) / 16
}

/**
 * 도트 벌레 SVG 글. n = 도는 에이전트 수(1.0 사용자 "에이전트 1개 이상일 때 여러 개 표시 · 다시 1개면 1개까지"): run 이면 작은 벌레를 셋까지
 * 차례로 깡충(0.12초씩 엇갈림), still 이면 쉬는 대장 + 작은 벌레 하나, done 이면 쉬는 대장 옆에서 작은 벌레 둘이 DONE 현수막
 */
export function agentCharSvg(px: number, pose: AgentPose, n = 1): string {
  const boss = paths(BOSS, 0, 4) + paths(ARM_IN, 14, 10)
  const babyDef = `<defs><g id="b">${paths(BABY, 0, 0)}</g></defs>`
  const baby = (x: number, y: number, cls = '', delay = '') => `<g transform="translate(${x},${y})"><g${cls ? ` class="${cls}"` : ''}${delay}><use href="#b"/></g></g>`
  let body: string
  let vbW: number
  if (pose === 'done') {
    // 작은 벌레 둘이 현수막 아래(9줄)를 더듬이로 받친다 — 왼쪽 끝 · 오른쪽 끝
    body = `${babyDef}${boss}${paths(BANNER, BANNER_X, 0)}${baby(BANNER_X + 1, 9)}${baby(BANNER_X + 17, 9)}`
    vbW = DONE_W
  } else {
    const shown = shownOf(pose, n)
    const isRun = pose === 'run'
    // 한 박자 1.6초: "!"(s) 0 ~ 42% · 앞발 위(u) · 앞(o) 번갈아 두 번 → 쉼(i) · 작은 벌레 깡충(j) 48 ~ 58%
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

/**
 * 1.0 진행 칸 캐릭터 "노트북 진행 막대": 대장 벌레가 화면 쪽을 보며 앞발로 자판을 두드리고(1.2초에 8번), 화면 막대가 한 칸씩 차 다 차면 ✓ 깜빡 뒤 다시
 * (2.4초 — 실제 진행률과는 상관없음). still = 움직임 끔(설정 "애니메이션" · OS 동작 줄이기와 같은 쉬는 그림 — 막대 세 칸). 에이전트가 돌면
 * 부르는 쪽이 에이전트 그림(대장 + 작은 벌레)으로 바꾼다
 */
export type WorkPose = 'run' | 'still'
const WORK_W = 25
// 눈이 화면 쪽(오른쪽 한 칸) — BOSS 의 눈 두 줄만 다르다
const BOSS_R = [...BOSS.slice(0, 4), '..oNNNweNNweNo', '..oNNNeeNNeeNo', ...BOSS.slice(6)]
// 노트북(16 ~ 24칸 · 5 ~ 13줄): 화면 테두리 · 검은 화면 · 자판 · 받침
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
