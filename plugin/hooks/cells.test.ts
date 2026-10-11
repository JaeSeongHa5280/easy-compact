import { expect, test } from 'claude-code/testing'

import { barCells, CellGrid, flowCells, flowLayout, timingCells } from './cells'
import { LEVEL_HEX, setThresholds } from './cost'
import type { CtxPoint } from '../types'

const hexInt = (hex: string) => parseInt(hex.replace('#', ''), 16)

test('칸 격자: 엔진 Raster 형식(칸마다 글자 · 글자색 · 바탕색 u32, 리틀 엔디언 base64)', () => {
  const g = new CellGrid(1, 1)
  g.set(0, 0, '█', 0xff8800)
  // 엔진 문서의 예와 같은 칸 하나: Uint32Array.of(0x2588, 0xff8800, 0x01000000)
  expect(g.toBase64()).toBe('iCUAAACI/wAAAAAB')
  expect(new CellGrid(2, 1).lines()).toEqual(['  '])
})

test('흐름 그래프(터미널): 아래에서 위로 막대, 컴팩트 ┃ · 모델 ┇ 세로선은 막대 사이 틈에, 기준 ┈ ╌ 줄 끝에 크기, 지난 구간은 흐리게', () => {
  setThresholds({ ctxWarn: 300_000, ctxCut: 400_000, cacheWarnMin: 10, isRange: true })
  const at = (i: number) => Date.parse('2026-10-10T12:00:00Z') + i * 60_000
  const ctxs = [100_000, 300_000, 590_000, 90_000, 200_000, 420_000]
  const points: CtxPoint[] = ctxs.map((ctx, i) => ({ atMs: at(i), ctx, model: 'claude-opus-5-5' }) as CtxPoint)
  const g = flowCells(points, [3], 23, 6)
  // 오른쪽 5칸(" 400k")은 기준 이름 자리, 막대 6개를 18칸에 — 막대 하나가 3칸(막대 2 + 틈 1)
  expect(flowLayout(6, 23)).toEqual({ area: 18, bars: 6, barW: 3, used: 18, labelW: 5 })
  // 가장 큰 590k 막대(3번째, x 6~7)는 바닥부터 꼭대기 가까이, 틈(x 8)은 비어 있거나 세로선
  expect(g.get(6, 5).ch).toBe('█')
  expect(g.get(7, 1).ch).toBe('█')
  // 컴팩트 자리(4번째 요청 → 앞 막대와의 틈 x 8)에 청록 ┃ 가 위에서 아래까지
  expect(g.get(8, 0).ch).toBe('┃')
  expect(g.get(8, 5).ch).toBe('┃')
  // 기준선: 빈 칸에 시작 ┈ · 끝 ╌, 줄 끝에 그 크기(노랑 · 빨강 글자)
  const lines = g.lines()
  const warnRow = lines.findIndex(l => l.endsWith(' 300k'))
  const cutRow = lines.findIndex(l => l.endsWith(' 400k'))
  expect(warnRow > cutRow && cutRow >= 0).toBe(true)
  expect(g.get(17, warnRow).ch).toBe('┈')
  expect(g.get(17, cutRow).ch).toBe('╌')
  expect(g.get(19, warnRow).fg).toBe(hexInt(LEVEL_HEX.warn))
  expect(g.get(19, cutRow).fg).toBe(hexInt(LEVEL_HEX.cut))
  // 마지막 컴팩트 앞(지난 구간) 막대는 흐린 색, 뒤는 그 크기의 기준 색 — 420k 는 빨강
  expect(g.get(0, 5).fg).not.toBe(hexInt(LEVEL_HEX.ok))
  expect(g.get(15, 5).fg).toBe(hexInt(LEVEL_HEX.cut))
})

test('흐름 그래프(터미널): 요청이 적으면 막대는 3칸(막대 2 + 틈 1)까지 — 넓은 판처럼 늘이지 않고 왼쪽부터 쌓는다', () => {
  setThresholds({ ctxWarn: 300_000, ctxCut: 400_000, cacheWarnMin: 10, isRange: true })
  const points = [41_000, 49_000].map((ctx, i) => ({ atMs: i * 60_000, ctx, model: 'claude-opus-5-5' }) as CtxPoint)
  const g = flowCells(points, [], 60, 6)
  expect(flowLayout(2, 60).used).toBe(6)
  // 요청이 칸의 절반보다 많으면 한 칸씩 폭을 다 채운다(요청 90개 · 146칸 → 146칸 다)
  expect(flowLayout(90, 151)).toEqual({ area: 146, bars: 146, barW: 1, used: 146, labelW: 5 })
  const bottom = g.lines()[5]!
  // 막대 두 개(x 0~1 · 3~4)만 바닥에, 나머지는 빈 칸
  expect(bottom.slice(0, 5).replace(/ /g, '').length).toBe(4)
  expect(bottom.slice(6, 50).trim()).toBe('')
})

test('한 줄 막대(터미널): 상주 몫 · 채움 · 빈 칸 ░, 기준 자리 ┃ — 채운 칸 위면 바탕을 채움 색으로', () => {
  const g = barCells(50, [{ percent: 20, hex: '#888888' }], '#3d7be0', 10, [{ percent: 30, hex: '#e0a030' }, { percent: 80, hex: '#e05555' }])
  expect(g.lines()).toEqual(['███┃█░░░┃░'])
  expect(g.get(0, 0).fg).toBe(0x888888)
  expect(g.get(4, 0).fg).toBe(0x3d7be0)
  expect(g.get(3, 0).bg).toBe(0x3d7be0)
  expect(g.get(8, 0).fg).toBe(0xe05555)
})

test('컴팩트 시점 막대(터미널): timingSvg 와 같은 눈금(끝 = 구간 끝의 1.25배) · 시작 · 끝 ┃', () => {
  const g = timingCells(200_000, 80_000, 300_000, 400_000, '#6b8db8', 20)
  const line = g.lines()[0]!
  // 400k 의 1.25배 = 500k 가 20칸 → 200k = 8칸 채움, 300k = 12칸째 ┃, 400k = 16칸째 ┃
  expect(line.slice(0, 8)).toBe('████████')
  expect(line[12]).toBe('┃')
  expect(line[16]).toBe('┃')
  expect(g.get(12, 0).fg).toBe(hexInt(LEVEL_HEX.warn))
})
