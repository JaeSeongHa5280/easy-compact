import type { Level } from './cost'

/**
 * 이지 컴팩트 게이지(0.5 피드백 묶음 2 — 사용자 확정 2026-10-14): 바 아이콘(16px) · 패널 탭 줄 머리(18px) · 확인 카드 제목.
 * 꼴 = 앱 컨텍스트 고리(앱 2.37337 shared-8 실측 — 원 · 12시에서 시계 방향으로 채움 · 굵기 2px · 끝 둥글게 · 바탕 고리 글자색 20%).
 * 0.6.0 실물: 250° · 300° 호와
 * 구간 띠 · 바늘(패널 머리)을 뺐다 — 원에 바늘을 달면 시계로 읽힌다. 64칸 판 · 중심 (32,32) · 반지름 27 · 선 8(16px 에서 2px).
 * 채움 몫 = 단계: 0 ~ 주황 시작(ctxWarn) 58% · 주황 20% · 빨강 22%(빨강 시작 ctxCut ~ 꽉 참 = ctxCut × 1.25). 설정이 바뀌어도
 * 색이 바뀌는 자리는 같고 숫자만 다르다. 엔진 자동 컴팩트는 읽지도 바꾸지도 않는다.
 * 색 = 지금 크기 단계로 통째로(levelOf — 숫자와 같은 순간): 아직 = 글자색(currentColor) .8 · 주황 #d9722b · 빨강 #e05555.
 * 깜빡임 = 권함 + 누를 수 있을 때만 — 빨강 구간 위치 t 로 1.6 → 0.7초 · 굵기 8 → 9.8 · 밝은 쪽 #ea7c7c → #ffe2e2, 꽉 찬 뒤 최대 유지
 * (초당 3번 아래). 키프레임 색은 고정 hex — color-mix(currentColor) 를 넣으면 Chromium 렌더러가 죽는다(2026-10-14 실측).
 * 움직임은 OS 동작 줄이기 · 설정 "모션 줄임" 이면 없다. 데스크톱 Svg 는 <img>(data URI) · 움직일 땐 샌드박스 틀 — 앱이 뿌리에
 * 그 자리 글자색을 넣어 currentColor 가 테마를 따른다
 */
export const GAUGE_HEX = { warn: '#d9722b', cut: '#e05555' } as const

/** 채움 단계(고리 위 몫): 주황 시작 · 빨강 시작 */
const STEP = { warn: 0.58, cut: 0.78 } as const

/** 꽉 참 = 빨강 시작 × 1.25 — 패널 "컴팩트 시점" 막대 끝(cells timingCells)과 같은 자리 */
export const FULL_RATIO = 1.25

/** 고리: 12시(32,5)에서 시계 방향으로 반 바퀴씩 두 번 — 깜빡일 때 굵기 9.8 도 판 안(27 + 4.9 < 32) */
const RING = 'M32 5A27 27 0 1 1 32 59A27 27 0 1 1 32 5'

/** 크기 → 게이지 채움(0~1, 단계별 몫). 기준을 모르면 0 */
export function gaugeFrac(ctx: number, warn: number, cut: number): number {
  if (!(ctx > 0) || !(warn > 0) || !(cut > warn)) return 0
  const full = cut * FULL_RATIO
  if (ctx <= warn) return (ctx / warn) * STEP.warn
  if (ctx <= cut) return STEP.warn + ((ctx - warn) / (cut - warn)) * (STEP.cut - STEP.warn)
  return Math.min(1, STEP.cut + ((ctx - cut) / (full - cut)) * (1 - STEP.cut))
}

/** 빨강 구간 안 위치(0 = 빨강 시작 · 1 = 꽉 참 이상) — 깜빡임 세기 */
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

/**
 * 게이지 꼴(0.8.1 B8 — 사용자 "클로드 기본 컨텍스트 아이콘 말고 다른 아이콘 · 전부 제공해 주고 옵션으로 바꿀 수 있으면, 기본은 가로 막대"):
 * 고리는 0.6.0 에 앱 컨텍스트 고리를 일부러 따른 꼴이라 입력창 오른쪽 앱 고리와 나란히 보여 헷갈렸다(동료 — 같은 고리가 싫다). 양 · 색 ·
 * 깜빡임 · 컴팩트 끝 줄어듦은 꼴과 무관하게 같다. 바 · 패널 머리 · 확인 카드 제목이 이 한 함수라 같이 바뀐다
 */
export type GaugeShape = 'bar' | 'ring' | 'vbar' | 'cells' | 'vcells'
/** 0.9.2: 칸 막대 세로(vcells)를 칸 막대 옆에 */
export const GAUGE_SHAPES: readonly GaugeShape[] = ['bar', 'ring', 'vbar', 'cells', 'vcells']

/** 그림 폭(px) — 가로 막대 · 칸 막대는 높이의 1.625배(16px → 26px), 고리 · 세로 막대 · 칸 막대 세로는 정사각 */
export function gaugeWidth(shape: GaugeShape, px: number): number {
  return shape === 'bar' || shape === 'cells' ? Math.round(px * 1.625) : px
}

export type GaugeLook = {
  px: number
  /** 꼴 — 없으면 고리(예전 꼴 · 시험) */
  shape?: GaugeShape
  /** 채움 0~1(gaugeFrac) */
  frac: number
  level: Level
  /** 그 앞 채움(미끄러짐 · 컴팩트 뒤 줄어듦) — 그림은 그릴 때마다 새로 떠서 한 번 그린 뒤엔 지금 값과 같게 준다 */
  from?: number
  /** 그 앞 단계 — 지금과 다르면(컴팩트 끝: 빨강 → 아직) 채움 색도 그 색에서 지금 색으로 옮겨 간다 */
  fromLevel?: Level
  /** 깜빡임 세기(빨강 구간 위치 0~1, redDepth) — null · 없음이면 깜빡이지 않는다 */
  blink?: number | null
  /** 움직임(미끄러짐 · 깜빡임) — 설정 "모션 줄임" 이면 false */
  motion?: boolean
  /**
   * 컴팩트 · 저장 중(0.9.1 B11 — 사용자 "게이지 모양별 컴팩트 중 · 완료 깜빡임, 없으면 현황 컴팩트 시점 · 컨텍스트처럼"): 진행 파랑(BUSY_HEX —
   * 옆 "컴팩트 중…" 글 · 진행 점과 같은 색 — 빨강 "권함" 깜빡임과 갈린다)에 꼴마다 움직임: 가로 · 세로 막대 = 숨쉬기(현황 막대와 같은
   * .35 ↔ 1 · 1.4초), 고리 = 28% 호가 돈다(1.6초 한 바퀴 — 꽉 찬 고리는 돌아도 안 보인다), 칸 막대 = 네 칸이 끝 칸부터 차례로 밝아짐(1.4초
   * 한 바퀴 — 0.9.4 비워지는 쪽).
   * 움직임이 꺼져 있으면 멈춘 파랑(지금 채움)
   */
  busy?: boolean
  /** 컴팩트 끝 줄어듦을 진행 파랑에서 시작(컴팩트 중이 파랑이었으니 — 앞 단계 색 대신) */
  fromBusy?: boolean
}

/** 컴팩트 · 저장 중 게이지 색(진행 파랑 — ui-common LIVE_HEX · PHASE_HEX 와 같은 계열) */
export const BUSY_HEX = '#4c9be8'

/** 컴팩트 중 움직임 CSS(꼴마다) — 키프레임엔 고정 값만. 동작 줄이기면 멈춤 */
const REDUCE = '@media (prefers-reduced-motion:reduce){.f,.g,.s,.c0,.c1,.c2,.c3{animation:none!important}}'

/** 게이지 SVG 글 — 순수 함수(시험 · README 그림이 같이 쓴다) */
export function gaugeSvg(g: GaugeLook): string {
  if (g.shape !== undefined && g.shape !== 'ring') return barGaugeSvg(g, g.shape)
  const f = Math.max(0, Math.min(1, g.frac))
  const pct = Math.max(0.01, f * 100)
  const motion = g.motion !== false
  // 컴팩트 중(B11): 바탕 고리 + 28% 진행 파랑 호가 돈다 — 움직임이 꺼져 있으면 지금 채움을 멈춘 파랑으로
  if (g.busy === true) {
    const track = `<path d="${RING}Z" stroke="currentColor" stroke-opacity=".2" stroke-width="8"/>`
    const arc = motion
      ? `<style>@keyframes gr{to{transform:rotate(360deg)}}.s{transform-origin:32px 32px;animation:gr 1.6s linear infinite}${REDUCE}</style><path class="s" d="${RING}" pathLength="100" stroke="${BUSY_HEX}" stroke-width="8" stroke-linecap="round" stroke-dasharray="28 100"/>`
      : `<path d="${RING}" pathLength="100" stroke="${BUSY_HEX}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${pct.toFixed(2)} 100"/>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.px}" height="${g.px}" viewBox="0 0 64 64" fill="none">${track}${arc}</svg>`
  }
  const fromPct = g.from !== undefined && motion && Math.abs(g.from - f) > 0.005 ? Math.max(0.01, Math.min(1, Math.max(0, g.from)) * 100) : null
  const stroke = g.level === 'ok' ? 'currentColor' : GAUGE_HEX[g.level]
  // 0 이면 바탕 고리만 — 앱 고리처럼 빈 원(둥근 끝이 12시에 점으로 남지 않게)
  const opacity = f === 0 && fromPct === null ? '0' : g.level === 'ok' ? '.8' : '1'
  const t = g.blink === null || g.blink === undefined || !motion ? null : Math.max(0, Math.min(1, g.blink))
  // 미끄러짐 0.5초, 크게 줄면(컴팩트 뒤) 1.3초
  const dur = fromPct !== null && fromPct - pct > 15 ? 1.3 : 0.5
  // 앞 단계 색(고정 hex)에서 시작 — 끝 값은 그 선의 제 색(아직 = currentColor)이라 키프레임엔 hex 만 들어간다(color-mix 금지). 컴팩트 끝은
  // 진행 파랑에서(B11 — 컴팩트 중이 파랑이었다)
  const fromHex = fromPct === null ? null : g.fromBusy === true ? BUSY_HEX : g.fromLevel !== undefined && g.fromLevel !== g.level && g.fromLevel !== 'ok' ? GAUGE_HEX[g.fromLevel] : null
  const fromStroke = fromHex ? `;stroke:${fromHex};stroke-opacity:1` : ''
  const slide = fromPct === null ? '' : `@keyframes gs{from{stroke-dasharray:${fromPct.toFixed(2)} 100${fromStroke}}}`
  const pulse = t === null ? '' : `@keyframes gp{50%{stroke:${lerpHex('#ea7c7c', '#ffe2e2', t)};stroke-width:${(8 + 1.8 * t).toFixed(2)}}}`
  const anim = [fromPct !== null ? `gs ${dur}s ease-out` : '', t !== null ? `gp ${(1.6 - 0.9 * t).toFixed(2)}s ease-in-out infinite` : ''].filter(Boolean).join(',')
  const css = anim ? `<style>${slide}${pulse}.f{animation:${anim}}@media (prefers-reduced-motion:reduce){.f{animation:none!important}}</style>` : ''
  // 바탕 고리는 닫아(Z) 12시 이음매가 안 보이게
  const track = `<path d="${RING}Z" stroke="currentColor" stroke-opacity=".2" stroke-width="8"/>`
  const fill = `<path class="f" d="${RING}" pathLength="100" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${pct.toFixed(2)} 100"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.px}" height="${g.px}" viewBox="0 0 64 64" fill="none">${css}${track}${fill}</svg>`
}

/**
 * 막대 꼴 게이지(B8): 가로 막대(왼쪽부터) · 세로 막대(아래부터) · 칸 막대(4칸) — 바탕 = 글자색 20%, 채움 = 단계 색(아직 = 글자색 .8),
 * 굵기 = 높이의 38%(16px → 6px — 고리 2px 은 막대엔 너무 가늘다). 움직임은 고리와 같은 이름 · 같은 때: gs = 앞 채움에서 지금으로(컴팩트
 * 끝 줄어듦 — 앞 단계 색에서 시작), gp = 권할 때 깜빡임(빨강 구간 위치로 세기). 키프레임엔 고정 hex 만(color-mix 는 렌더러를 죽인다)
 */
function barGaugeSvg(g: GaugeLook, shape: 'bar' | 'vbar' | 'cells' | 'vcells'): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const f = clamp(g.frac)
  const motion = g.motion !== false
  const W = gaugeWidth(shape, g.px)
  const H = g.px
  const th = Math.max(4, Math.round(H * 0.38))
  const n2 = (v: number) => v.toFixed(2)
  // 켜진 칸 수 = 단계(0.9.4 — 0.9.5 에 색을 단계 색 통째로 되돌려도 그대로): 아직 = 1 · 2칸(주황 시작의 반까지 1칸), 컴팩트할 때 = 3칸,
  // 늦어짐 = 4칸. 예전엔 채움 × 4 를 올림해 아직인데 3칸 · 컴팩트할 때인데 4칸인 때가 있었다
  const filled = (v: number) => (v <= 0 ? 0 : v < STEP.warn ? (v < STEP.warn / 2 ? 1 : 2) : v < STEP.cut ? 3 : 4)
  const isCells = shape === 'cells' || shape === 'vcells'
  // 칸 막대 · 칸 막대 세로(0.9.2): 배터리 테두리 안에 네 칸(25%씩) — 가로는 왼쪽부터, 세로는 아래부터. 테두리는 둘 다. 세로 칸만 쌓으면 메뉴 아이콘 ≡ 처럼 보였다
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
  // 컴팩트 중(B11): 진행 파랑 — 막대는 지금 채움이 숨쉬고(현황 막대와 같은 .35 ↔ 1 · 1.4초), 칸 막대는 네 칸이 차례로 밝아진다(1.4초 한 바퀴,
  // 음수 지연이라 처음부터 차례 — 양수면 기다리는 동안 다 밝았다). 차례는 끝 칸(세로 위 · 가로 오른쪽)부터 — 아래부터 차오르니 배터리
  // 충전으로 읽혔다(0.9.4 사용자 "컴팩트 애니메이션만 반대" — 비워지는 쪽). 움직임이 꺼져 있으면 지금 채움을 멈춘 파랑으로
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
  const color = g.level === 'ok' ? 'currentColor' : GAUGE_HEX[g.level]
  const opacity = f === 0 && from === null ? '0' : g.level === 'ok' ? '.8' : '1'
  const t = g.blink === null || g.blink === undefined || !motion ? null : clamp(g.blink)
  const dur = from !== null && from - f > 0.15 ? 1.3 : 0.5
  // 컴팩트 끝 줄어듦은 진행 파랑에서(B11), 그 밖엔 앞 단계 색에서
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
    // 칸 막대: 단계가 칸으로(4칸). 컴팩트로 줄면 비워지는 칸이 앞 색에서 바탕으로 옅어진다(.g).
    // 켜진 칸 색 = 지금 단계 색 통째로(0.9.5 — 사용자 "컴팩트 할 때랑 늦어짐 시인성이 안 좋아졌음 · 원래대로 할 때는 칸 막대 주황색으로,
    // 늦어짐은 빨간색으로 깜빡임으로"): 0.9.4 레벨 미터(칸마다 자리 색 · 깜빡임은 빨강 칸만)는 컴팩트할 때 주황이 한 칸, 늦어짐 빨강이 한
    // 칸뿐이라 눈에 덜 띄었다. 늦어짐 깜빡임(gp)은 켜진 칸 모두
    const n = filled(f)
    const nFrom = from !== null ? filled(from) : n
    shapes = frame
    for (let i = 0; i < 4; i++) {
      const at = cellAt(i)
      shapes += i < n ? `<rect class="f" ${at} fill="${color}" fill-opacity="${opacity}"/>` : i < nFrom ? `<rect class="g" ${at} fill="currentColor" fill-opacity=".2"/>` : `<rect ${at} fill="currentColor" fill-opacity=".2"/>`
    }
    // 비는 칸: 앞 색(컴팩트 끝이면 진행 파랑 — B11)에서 바탕으로 옅어진다
    if (nFrom > n) slide = `@keyframes gs{from{fill:${fromHex ?? (g.level === 'ok' ? '#888888' : GAUGE_HEX[g.level])};fill-opacity:1}}`
  }
  const pulse = t === null ? '' : `@keyframes gp{50%{fill:${lerpHex('#ea7c7c', '#ffe2e2', t)}}}`
  const fAnim = [slide && !isCells ? `gs ${dur}s ease-out` : '', t !== null ? `gp ${(1.6 - 0.9 * t).toFixed(2)}s ease-in-out infinite` : ''].filter(Boolean).join(',')
  const rules = [fAnim ? `.f{animation:${fAnim}}` : '', slide && isCells ? `.g{animation:gs ${dur}s ease-out}` : ''].join('')
  const css = rules ? `<style>${slide}${pulse}${rules}@media (prefers-reduced-motion:reduce){.f,.g{animation:none!important}}</style>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${css}${shapes}</svg>`
}
