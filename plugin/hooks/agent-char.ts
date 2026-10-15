/**
 * 에이전트 캐릭터 "도트"(B4, 0.6.1 피드백 — 사용자 "에이전트가 돌 때 나오는 🤖 이모지가 짜친다 · 클로드 앱 캐릭터처럼 열심히 일하거나 좌우로
 * 움직이는 애니메이션 · 그 에이전트가 동작 중일 때만, 멈추면 초기화하고 기본 모습"). 후보 넷(볼트 로봇 · 말랑 젤리 · 도트 픽셀 벌레 · 톱니) 가운데
 * 사용자가 고름(2026-10-15 — D:/Claude/easy-compact-feedback-0.6/b4-characters.gif). 앱 캐릭터를 베끼지 않은 자체 그림(상표 · 디렉터리 심사).
 *
 * 16칸 판의 픽셀 벌레: 더듬이 · 몸 · 눈 · 다리. 파랑 = mod 색(BRAND_HEX — 답변 칩 · 진행 점과 같은 계열), 다리는 한 단 진하게, 눈은 거의 검정
 * — 어두운 · 밝은 테마 둘 다 읽힌다. 도는 중이면 다리를 번갈아(0.24초) 좌우로 걷는다(1.2초 왕복 · 한 칸씩), 멈추면 서 있는 기본 모습(그림이
 * 바뀌어 처음부터). 키프레임엔 transform · opacity 만 — color-mix(currentColor) 를 넣으면 Chromium 렌더러가 죽었다(gauge.ts). OS 동작 줄이기면
 * 그림 안에서 멈추고, 설정 "움직임" 끔이면 처음부터 서 있는 그림을 준다(ui-common agentMark). 순수 함수(시험 · 그림 도구가 같이 쓴다)
 */
const BODY = '#4c9be8'
const LEG = '#3a7fc4'
const EYE = '#0f1b2a'

const cell = (x: number, y: number, w: number, h: number, fill?: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${fill ? ` fill="${fill}"` : ''}/>`

/** 도트 SVG 글 — isWalking 이면 걷는 그림(움직임), 아니면 서 있는 그림 */
export function agentCharSvg(px: number, isWalking: boolean): string {
  const body = [cell(5, 3, 1, 2, BODY), cell(10, 3, 1, 2, BODY), cell(4, 5, 8, 5, BODY), cell(3, 6, 1, 3, BODY), cell(12, 6, 1, 3, BODY), cell(6, 6, 1, 2, EYE), cell(9, 6, 1, 2, EYE)].join('')
  const legsA = `<g class="la" fill="${LEG}">${cell(4, 10, 1, 2)}${cell(6, 10, 1, 2)}${cell(9, 10, 1, 2)}${cell(11, 10, 1, 2)}</g>`
  const legsB = isWalking ? `<g class="lb" fill="${LEG}" opacity="0">${cell(5, 10, 1, 2)}${cell(7, 10, 1, 1)}${cell(8, 10, 1, 2)}${cell(10, 10, 1, 1)}</g>` : ''
  const css = isWalking
    ? '<style>.w{animation:w 1.2s steps(4) infinite alternate}.la{animation:a .24s steps(1) infinite}.lb{animation:b .24s steps(1) infinite}' +
      '@keyframes w{from{transform:translateX(-2px)}to{transform:translateX(2px)}}@keyframes a{50%{opacity:0}}@keyframes b{0%{opacity:0}50%{opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){.w,.la,.lb{animation:none!important}.lb{opacity:0}}</style>'
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 16 16" shape-rendering="crispEdges">${css}<g class="w">${body}${legsA}${legsB}</g></svg>`
}
