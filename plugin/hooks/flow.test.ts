import { expect, test } from 'claude-code/testing'

import { setLang } from './i18n'

import {
  afterInNowTokens,
  COMPACT_HEX,
  compactEffects,
  compactSummary,
  timingSvg,
  segmentExtra,
  tokenScales,
  flowFromRecords,
  lastCtxOf,
  fmtClock,
  flowSvg,
  lacksModels,
  mergeMeasured,
  MODEL_HEX,
  modelSwitches,
  parseFlowFile,
  recentStart,
  recordsFromLines,
  scanTranscript,
  serializeFlow,
  sharedFor,
  timingNames,
  withPoint,
  withQuestion,
} from './flow'
import type { Flow } from './flow'
import { DEFAULT_THRESHOLDS, setThresholds } from './cost'

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

const T0 = Date.parse('2026-10-10T12:00:00Z')
const at = (min: number) => new Date(T0 + min * 60_000).toISOString()
const asst = (id: string, ctx: number, min: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: at(min),
    ...extra,
    message: {
      id,
      model: 'claude-opus-5-5',
      usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0 },
    },
  })
const boundary = (pre: number, min: number) =>
  JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(min), compactMetadata: { trigger: 'manual', preTokens: pre } })

const TRANSCRIPT = [
  asst('a', 100_000, 1),
  asst('a', 100_000, 1), // 같은 메시지의 다른 블록 줄 — 한 번만
  asst('b', 300_000, 2),
  '{깨진 줄',
  boundary(596_441, 3),
  asst('c', 94_000, 4),
  asst('s', 50_000, 4, { isSidechain: true }), // 서브에이전트 — 뺀다
  asst('d', 100_000, 5),
  JSON.stringify({ type: 'user', timestamp: at(5), message: { content: '질문' } }),
].join('\n')

test('컴팩트 미룬 값: 지난 컴팩트 뒤 요청마다 직후 크기보다 커진 만큼 × 읽기 요율을 쌓는다', () => {
  const m = 'claude-opus-5-5'
  const flow = {
    points: [
      { atMs: 1, ctx: 500_000, usd: 0, model: m },
      { atMs: 2, ctx: 100_000, usd: 0, model: m },
      { atMs: 3, ctx: 150_000, usd: 0, model: m },
      { atMs: 4, ctx: 200_000, usd: 0, model: m },
    ],
    compactions: [{ atMs: 1, trigger: 'manual', before: 500_000, after: 100_000, costUsd: null, index: 1 }],
  }
  const x = segmentExtra(flow, m, 94_000)!
  // 직후 10만 기준: 0 · 5만 × $0.20 = $0.01 · 10만 × $0.20 = $0.02 → 누적 0 · 0.01 · 0.03
  expect(x.base).toBe(100_000)
  expect(x.cum.map(v => Math.round(v * 1000) / 1000)).toEqual([0, 0.01, 0.03])
  expect(Math.round(x.nowExtraUsd * 1000) / 1000).toBe(0.02)
  // 색을 정하는 배수: 1 · 1.5 · 2
  expect(x.ratios).toEqual([1, 1.5, 2])
  // 컴팩트 전이면 처음부터, 컴팩트했다면 될 크기와 견준다
  const y = segmentExtra({ points: flow.points.slice(1), compactions: [] }, m, 94_000)!
  expect(y.base).toBe(94_000)
  expect(y.cum.length).toBe(3)
})

test('컴팩트 시점 막대: 회색 상주 → 지금까지 채움, 구간 시작 · 끝에 굵은 세로선과 이름', () => {
  const names = { warn: 300_000, cut: 400_000, warnName: '300k 좋은 때', cutName: '400k 늦어짐' }
  // 폭 500 · 끝의 1.25배(50만)가 오른쪽 끝 → 1k = 1px
  const svg = timingSvg(230_000, 80_000, names, '#6b8db8', 500)
  expect(svg).toContain('<rect x="0" y="4" width="80.0" height="8" fill="#888888" fill-opacity="0.6"/>')
  expect(svg).toContain('<rect x="80.0" y="4" width="150.0" height="8" fill="#6b8db8"/>')
  // 세로선 3px — 1 · 2px 은 막대 색에 묻혔다
  expect(svg).toContain('<rect x="298.5" y="0" width="3" height="16" rx="1" fill="#e0a030"/>')
  expect(svg).toContain('<rect x="398.5" y="0" width="3" height="16" rx="1" fill="#e05555"/>')
  // 이름: 시작은 막대 왼쪽 끝에 왼쪽 정렬, 끝은 오른쪽 끝에 오른쪽 정렬 — 선과는 색으로 잇는다. 예전엔 선 옆이라 좁은
  // 패널에서 끝 이름이 왼쪽으로 뒤집혀 "250k 좋은3때k 늦어짐" 으로 겹쳤다(동료)
  expect(svg).toContain('<text x="0.0" y="28" text-anchor="start" font-size="10" font-family="sans-serif" fill="#e0a030">300k 좋은 때</text>')
  expect(svg).toContain('<text x="500.0" y="28" text-anchor="end" font-size="10" font-family="sans-serif" fill="#e05555">400k 늦어짐</text>')
  // 좁아도(250px) 둘은 양 끝이라 안 겹친다. 그보다 좁아 나란히 안 들면(120px) 크기만
  const narrow = timingSvg(230_000, 80_000, names, '#6b8db8', 250)
  expect(narrow).toContain('x="0.0" y="28" text-anchor="start" font-size="10" font-family="sans-serif" fill="#e0a030">300k 좋은 때<')
  expect(narrow).toContain('x="250.0" y="28" text-anchor="end" font-size="10" font-family="sans-serif" fill="#e05555">400k 늦어짐<')
  const tiny = timingSvg(230_000, 80_000, names, '#6b8db8', 120)
  expect(tiny).toContain('fill="#e0a030">300k</text>')
  expect(tiny).toContain('fill="#e05555">400k</text>')
  // 끝을 넘으면 막대가 끝 선 너머로(오른쪽 끝 = 지금의 1.04배)
  const over = timingSvg(500_000, 80_000, names, '#e05555', 520)
  expect(over).toContain('width="420.0" height="8" fill="#e05555"')
})

test('시점 막대 이름: 나란히 들면 그대로, 안 들면 앞 낱말(크기)만 — 데스크톱 px · 터미널 칸 같은 규칙', () => {
  const px = (s: string) => s.length * 6
  expect(timingNames('250k 좋은 때', '300k 늦어짐', 200, px)).toEqual(['250k 좋은 때', '300k 늦어짐'])
  expect(timingNames('250k 좋은 때', '300k 늦어짐', 100, px)).toEqual(['250k', '300k'])
})

test('모델을 바꾸면 세는 값이 달라진다: 바꾼 자리 앞뒤 크기 비로 잣대를 맞추고, 처음 모델로 돌아오면 1', () => {
  const pts = [
    { atMs: 1, ctx: 100_000, usd: 0, model: 'claude-opus-5-5' },
    { atMs: 2, ctx: 110_000, usd: 0, model: 'claude-opus-5-5' },
    { atMs: 3, ctx: 88_000, usd: 0, model: 'claude-sonnet-5-5' },
    { atMs: 4, ctx: 90_000, usd: 0, model: 'claude-sonnet-5-5' },
    { atMs: 5, ctx: 120_000, usd: 0, model: 'claude-opus-5-5' },
  ]
  expect(tokenScales(pts, 0)).toEqual([1, 1, 0.8, 0.8, 1])
  const compactions = [{ atMs: 0, trigger: 'manual' as const, before: 500_000, after: 100_000, costUsd: null, index: 0 }]
  // Sonnet 으로 바꾼 채면 직후 10만(Opus 로 셈)은 Sonnet 으로 8만 — 더 읽은 값도 8만과 견준다
  const onSonnet = { points: pts.slice(0, 4), compactions }
  expect(afterInNowTokens(onSonnet, 100_000)).toBe(80_000)
  const x = segmentExtra(onSonnet, 'claude-opus-5-5', 94_000)!
  expect(x.base).toBe(100_000)
  expect(x.baseNow).toBe(80_000)
  // Opus 로 돌아오면 다시 10만
  expect(afterInNowTokens({ points: pts, compactions }, 100_000)).toBe(100_000)
})

test('컴팩트가 남긴 요약: 컴팩트 뒤 첫 요청이 새로 낸 몫 — 못 쟀으면 직후 크기 − 기록의 첫 요청, 견줄 수 없으면 없음', () => {
  // 작성자 세션(2026-10-12): 첫 요청 65.0k(읽기 44.2k · 씀 20.8k — 첫 질문 포함), 컴팩트 뒤 첫 요청 70.8k 중 읽기 61.1k ·
  // 새로 씀 9.6k. 직후 − 첫 요청은 5.8k 로 요약을 첫 질문만큼 작게 셌다(동료 "요약 1k 포함")
  const lines = [
    `q ${Date.parse(at(0))}`,
    `p ${Date.parse(at(1))} 0 100 44164 20808 claude-opus-5-5`,
    `p ${Date.parse(at(2))} 0 100 247494 0 claude-opus-5-5`,
    `c ${Date.parse(at(3))} manual 247494`,
    `q ${Date.parse(at(3.5))}`,
    `p ${Date.parse(at(4))} 6 100 61142 9620 claude-opus-5-5`,
  ].join('\n')
  const measured = flowFromRecords(recordsFromLines(lines))
  expect(measured.compactions[0]!.summary).toBe(9_626)
  expect(compactSummary(measured, measured.compactions[0]!, measured.points[0]!)).toBe(9_626)
  expect(compactSummary(measured, measured.compactions[0]!, null)).toBe(9_626)
  // 컴팩트 뒤 첫 요청이 캐시가 식은 뒤면(전부 다시 씀) 요약으로 안 적는다
  const late = flowFromRecords(recordsFromLines(lines.replace(`p ${Date.parse(at(4))}`, `p ${Date.parse(at(90))}`)))
  expect(late.compactions[0]!.summary).toBe(undefined)
  // 새 질문 없이 이어진 요청(질문 도중 자동 컴팩트 — 밀린 도구 결과까지 새로 쓴다)도 안 적는다
  const midTurn = flowFromRecords(recordsFromLines(lines.replace(`q ${Date.parse(at(3.5))}\n`, '')))
  expect(midTurn.compactions[0]!.summary).toBe(undefined)
  // 못 잰 컴팩트(잰 값이 없는 옛 저장 파일): 직후 크기 − 기록의 첫 요청
  const flow = scanTranscript([asst('z', 60_000, 0), TRANSCRIPT].join('\n'))
  const c = { ...flow.compactions[0]!, summary: undefined }
  expect(compactSummary(flow, c, flow.points[0]!)).toBe(34_000)
  // 처음부터 있던 몫을 모름 · 첫 요청이 직후보다 큼(기록이 세션 처음부터가 아님) · 첫 요청과 모델이 다름
  expect(compactSummary(flow, c, null)).toBe(null)
  const partial = scanTranscript(TRANSCRIPT)
  expect(compactSummary(partial, { ...partial.compactions[0]!, summary: undefined }, partial.points[0]!)).toBe(null)
  expect(compactSummary(flow, c, { ...flow.points[0]!, model: 'claude-sonnet-5-5' })).toBe(null)
  // 직후 크기를 아직 못 잼
  expect(compactSummary(flow, { ...c, after: null }, flow.points[0]!)).toBe(null)
})

test('기록 파일 → 흐름: 메인 요청만 한 번씩, 컴팩트 직전 · 직후 크기와 자리', () => {
  const flow = scanTranscript(TRANSCRIPT)
  expect(flow.points.map(p => p.ctx)).toEqual([100_000, 300_000, 94_000, 100_000])
  expect(flow.compactions.length).toBe(1)
  const c = flow.compactions[0]!
  expect(c.before).toBe(596_441)
  expect(c.after).toBe(94_000)
  expect(c.index).toBe(2)
  expect(c.costUsd).toBe(null)
  expect(scanTranscript('').points.length).toBe(0)
})

// 엔진이 값을 안 준 컴팩트의 추정 재료: 요약 출력 1만 · 요약(다시 쓰는 몫) 3.13만
const EST = { output: 10_000, summaryOf: () => 31_300 }

test('컴팩트 효과: 줄인 양 × 읽기 요율 × 그 뒤 요청 수 − 든 값(못 쟀으면 그때 캐시 상태로 추정)', () => {
  const [ef] = compactEffects(scanTranscript(TRANSCRIPT), 'claude-opus-5-5', EST)
  expect(ef!.removed).toBe(502_441)
  expect(ef!.requestsAfter).toBe(2)
  expect(ef!.isEstimated).toBe(true)
  // 앞 요청 1분 뒤 컴팩트 — 캐시가 살아 있어 컴팩트 요청이 대화 캐시를 읽는다(실측 98.6%):
  // 59.6만 × $0.20 + 요약 출력 1만 × $20 + 요약 3.13만 다시 쓰기 × $8 ≈ $0.57. 0.3.x 는 늘 정가($4)로 세 $2.84 였다
  expect(Math.round(ef!.costUsd * 100)).toBe(57)
  // 요청마다 50.2만 × $0.20 = $0.10 아낌 × 2회
  expect(Math.round(ef!.savedUsd * 100)).toBe(20)
  expect(ef!.breakEvenLeft).toBe(4)
})

test('컴팩트 효과: 캐시가 식은 뒤 컴팩트면 공통 앞부분만 읽기, 나머지는 정가 입력', () => {
  // 첫 요청(세션 시작 = 식은 캐시)이 읽은 4.8만이 공통 앞부분. 컴팩트는 앞 요청 98분 뒤(캐시 60분 지남)
  const lines = [
    `p ${Date.parse(at(1))} 10 100 47990 52000 claude-opus-5-5`,
    `p ${Date.parse(at(2))} 10 100 299990 0 claude-opus-5-5`,
    `c ${Date.parse(at(100))} manual 300000`,
    `p ${Date.parse(at(101))} 10 100 93990 0 claude-opus-5-5`,
    `p ${Date.parse(at(102))} 10 100 99990 0 claude-opus-5-5`,
  ].join('\n')
  const flow = flowFromRecords(recordsFromLines(lines))
  expect(flow.shared).toEqual({ 'claude-opus-5-5': 47_990 })
  const [ef] = compactEffects(flow, 'claude-opus-5-5', EST)
  // (30만 − 4.8만) × $4 + 4.8만 × $0.20 + 요약 출력 1만 × $20 + 요약 3.13만 × $8 ≈ $1.47
  expect(Math.round(ef!.costUsd * 100)).toBe(147)
})

test('공통 앞부분: 캐시가 식은 뒤 첫 요청(세션 첫 요청 · 65분 넘게 쉼 · 모델 바꿈)이 읽은 크기를 모델마다 — 컴팩트 뒤 첫 요청은 아님', () => {
  const m = 'claude-opus-5-5'
  const tk = (read: number, fresh = 0) => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: read, cache_creation_input_tokens: fresh })
  let flow: Flow = { points: [], compactions: [], shared: {} }
  flow = withPoint(flow, { atMs: 0, ctx: 60_000, usd: 0, model: m }, tk(47_594))
  expect(sharedFor(flow, m)).toBe(47_594)
  expect(sharedFor(flow, 'claude-opus-5-5[1m]')).toBe(47_594)
  // 캐시 안의 요청은 대화 캐시를 다 읽는다 — 공통 앞부분이 아니다
  flow = withPoint(flow, { atMs: 10 * 60_000, ctx: 80_000, usd: 0, model: m }, tk(79_000))
  expect(sharedFor(flow, m)).toBe(47_594)
  // 60분을 조금 넘긴 요청(긴 요청이 끝난 시각일 수 있다)은 안 본다, 65분 넘게 쉰 뒤면 새로 잰다
  flow = withPoint(flow, { atMs: 72 * 60_000, ctx: 90_000, usd: 0, model: m }, tk(89_000))
  expect(sharedFor(flow, m)).toBe(47_594)
  flow = withPoint(flow, { atMs: 140 * 60_000, ctx: 95_000, usd: 0, model: m }, tk(46_000))
  expect(sharedFor(flow, m)).toBe(46_000)
  // 모델을 바꾼 첫 요청은 그 모델의 값, 처음 보는 모델은 0
  expect(sharedFor(flow, 'claude-sonnet-5-5')).toBe(0)
  flow = withPoint(flow, { atMs: 141 * 60_000, ctx: 98_000, usd: 0, model: 'claude-sonnet-5-5' }, tk(40_000))
  expect(sharedFor(flow, 'claude-sonnet-5-5')).toBe(40_000)
  // 컴팩트 뒤 첫 요청은 컴팩트가 데운 앞부분을 읽는다 — 모델이 바뀌어도 안 잰다
  flow = { ...flow, compactions: [{ atMs: 142 * 60_000, trigger: 'manual', before: 98_000, after: null, costUsd: null, index: flow.points.length }], questions: [142.5 * 60_000] }
  flow = withPoint(flow, { atMs: 143 * 60_000, ctx: 30_000, usd: 0, model: m }, tk(29_000, 1_000))
  expect(sharedFor(flow, m)).toBe(46_000)
  // 그 요청이 새로 낸 몫이 요약(새로 쓴 몫)
  expect(flow.compactions[0]!.summary).toBe(1_000)
  // 흐름이 다 읽히지 않았으면(기록 못 읽음 · 읽는 중) 점이 비어도 세션 첫 요청으로 보지 않는다 — 다시 연 세션의 첫 요청이 대화
  // 전체를 읽어 그게 공통 앞부분이 됐다
  expect(withPoint({ points: [], compactions: [], shared: {} }, { atMs: 0, ctx: 300_000, usd: 0, model: m }, tk(299_000), false).shared).toEqual({})
  // 저장 파일에 남고 되읽힌다(v4). 그 전 판(v3) 파일은 없음(undefined) — 기록에서 다시 읽는다
  expect(parseFlowFile(serializeFlow(flow))!.shared).toEqual({ 'claude-opus-5-5': 46_000, 'claude-sonnet-5-5': 40_000 })
  expect(parseFlowFile(JSON.stringify({ v: 3, m: [], p: [], c: [], q: [] }))!.shared).toBe(undefined)
})

test('다시 읽어도 예전에 잰 컴팩트 값은 남고, 살아 있는 요청은 직후 크기를 채운다', () => {
  const fresh = scanTranscript(TRANSCRIPT).compactions
  const old = [{ ...fresh[0]!, atMs: fresh[0]!.atMs + 60_000, costUsd: 2.5 }]
  expect(mergeMeasured(fresh, old)[0]!.costUsd).toBe(2.5)
  const live = withPoint({ points: [{ atMs: 1, ctx: 500_000, usd: 0.1 }], compactions: [{ atMs: 2, trigger: 'manual', before: 500_000, after: null, costUsd: 2, index: 1 }] }, { atMs: 3, ctx: 90_000, usd: 0.02 })
  expect(live.compactions[0]!.after).toBe(90_000)
})

test('그래프: 막대와 컴팩트 세로선, 시각 표기', () => {
  // 다른 테스트 파일이 같은 모듈의 기준을 바꿔 두었을 수 있다
  setThresholds(DEFAULT_THRESHOLDS)
  const flow = scanTranscript(TRANSCRIPT)
  const svg = flowSvg(flow.points, flow.compactions.map(c => c.index), 120, 40)
  expect(svg.split('<rect').length - 1).toBe(4)
  expect(svg).toContain(COMPACT_HEX)
  // 점선 이름: 첫 계산 전 기본 강조 200k · 권장 250k
  expect(svg).toContain('>권장 250k</text>')
  expect(svg).toContain('>강조 200k</text>')
  // 구간 방식이면 시작 · 끝(이름 칸에 들게 짧게)
  setThresholds({ ctxWarn: 150_000, ctxCut: 210_000, cacheWarnMin: 10, isRange: true })
  const rangeSvg = flowSvg(flow.points, flow.compactions.map(c => c.index), 120, 40)
  expect(rangeSvg).toContain('>끝 210k</text>')
  expect(rangeSvg).toContain('>시작 150k</text>')
  setThresholds(DEFAULT_THRESHOLDS)
  expect(fmtClock(0)).toBe('시각 모름')
})

test('큰 기록용 추출 출력(p · c 줄)도 같은 흐름이 되고, 저장 파일은 그대로 되읽힌다', () => {
  const lines = [
    `p ${Date.parse(at(1))} 10 100 99990 0 claude-opus-5-5`,
    `p ${Date.parse(at(2))} 10 100 299990 0 claude-opus-5-5`,
    `c ${Date.parse(at(3))} manual 596441`,
    `p ${Date.parse(at(4))} 10 100 93990 0 claude-opus-5-5`,
    `p ${Date.parse(at(5))} 10 100 99990 0 claude-opus-5-5`,
    '이상한 줄',
  ].join('\n')
  const fromLines = flowFromRecords(recordsFromLines(lines))
  const fromJson = scanTranscript(TRANSCRIPT)
  expect(fromLines.points.map(p => p.ctx)).toEqual(fromJson.points.map(p => p.ctx))
  expect(fromLines.compactions).toEqual(fromJson.compactions)
  const back = parseFlowFile(serializeFlow(fromLines))!
  expect(back.points.map(p => p.ctx)).toEqual(fromLines.points.map(p => p.ctx))
  expect(back.compactions[0]!.after).toBe(94_000)
  expect(parseFlowFile('{깨짐')).toBe(null)
})

test('컴팩트 효과는 그때 모델 요율 — 지금 모델을 바꿔도 지난 컴팩트 값은 그대로, 아낀 값은 요청마다 그 요청 모델', () => {
  const lines = [
    `p ${Date.parse(at(1))} 10 100 99990 0 claude-opus-5`,
    `p ${Date.parse(at(2))} 10 100 299990 0 claude-opus-5`,
    `c ${Date.parse(at(3))} manual 300000`,
    `p ${Date.parse(at(4))} 10 100 93990 0 claude-opus-5-5`,
    `p ${Date.parse(at(5))} 10 100 99990 0 claude-opus-5-5`,
  ].join('\n')
  const flow = flowFromRecords(recordsFromLines(lines))
  const [a] = compactEffects(flow, 'claude-sonnet-5', EST)
  const [b] = compactEffects(flow, 'claude-opus-5-5', EST)
  expect(a!.model).toBe('claude-opus-5')
  expect(a!.costUsd).toBe(b!.costUsd)
  expect(a!.savedUsd).toBe(b!.savedUsd)
  // 든 값: Opus 5 로 30만 × 읽기 $0.50(캐시 살아 있음) + 요약 출력 1만 × $25 + 요약 3.13만 다시 쓰기 × $10 ≈ $0.71
  expect(Math.round(a!.costUsd * 100)).toBe(71)
  // 아낀 값: 줄인 20.6만 × Opus 5.5 읽기 $0.20 × 2회 = $0.0824
  expect(Math.round(a!.savedUsd * 10000)).toBe(824)
})

test('같은 컴팩트 경계 줄이 기록에 두 번 적혀도(엔진이 다시 씀) 컴팩트는 한 번 — 기록 · 추출 출력 · 저장 파일 모두', () => {
  const twice = [...TRANSCRIPT, asst('d', 120_000, 5), boundary(596_441, 3), asst('e', 125_000, 6)].join('\n')
  expect(scanTranscript(twice).compactions.length).toBe(1)
  const lines = [
    `p ${Date.parse(at(1))} 10 100 99990 0 claude-opus-5-5`,
    `c ${Date.parse(at(2))} manual 596441`,
    `p ${Date.parse(at(3))} 10 100 93990 0 claude-opus-5-5`,
    `c ${Date.parse(at(2))} manual 596441`,
    `p ${Date.parse(at(4))} 10 100 99990 0 claude-opus-5-5`,
  ].join('\n')
  const flow = flowFromRecords(recordsFromLines(lines))
  expect(flow.compactions.length).toBe(1)
  expect(flow.compactions[0]!.after).toBe(94_000)
  // 중복이 든 채 저장된 예전 파일도 하나로 읽는다
  const saved = JSON.stringify({ v: 2, m: [], p: [[1, 100, 0, -1]], c: [flow.compactions[0], { ...flow.compactions[0], after: null, index: 1 }] })
  expect(parseFlowFile(saved)!.compactions.length).toBe(1)
})

test('모델 바꾼 시점: 점마다 모델을 남기고, 바뀐 자리에 보라 끊긴 선 · 저장 파일에도 남는다', () => {
  const lines = [
    `p ${Date.parse(at(1))} 10 100 99990 0 claude-opus-5-5`,
    `p ${Date.parse(at(2))} 10 100 199990 0 claude-opus-5-5`,
    `p ${Date.parse(at(3))} 10 100 159990 0 claude-sonnet-5-5`,
    `p ${Date.parse(at(4))} 10 100 169990 0 claude-sonnet-5-5`,
  ].join('\n')
  const flow = flowFromRecords(recordsFromLines(lines))
  expect(modelSwitches(flow.points)).toEqual([2])
  expect(flowSvg(flow.points, [], 120, 40, modelSwitches(flow.points)).includes(MODEL_HEX)).toBe(true)
  expect(flowSvg(flow.points, [], 120, 40).includes(MODEL_HEX)).toBe(false)
  const back = parseFlowFile(serializeFlow(flow))!
  expect(modelSwitches(back.points)).toEqual([2])
  expect(lacksModels(back)).toBe(false)
  // 모델을 적기 전 판(v1) 저장 파일은 모델 없이 읽힌다 — 불러올 때 기록에서 다시 읽는 신호
  const v1 = JSON.stringify({ v: 1, p: [[1, 100, 0.1], [2, 200, 0.1]], c: [] })
  expect(lacksModels(parseFlowFile(v1)!)).toBe(true)
  // 날짜 꼬리만 다른 id 는 같은 모델
  const same = [
    { atMs: 1, ctx: 1, usd: 0, model: 'claude-haiku-4-5' },
    { atMs: 2, ctx: 1, usd: 0, model: 'claude-haiku-4-5-20251001' },
  ]
  expect(modelSwitches(same)).toEqual([])
})

test('그래프 시간 축: 막대 아래 양 끝에 시작 · 지금, 그 줄만큼 막대 영역이 줄고 전체 높이는 그대로', () => {
  const pts = [100_000, 200_000, 300_000].map((ctx, i) => ({ atMs: i, ctx, usd: 0 }))
  const svg = flowSvg(pts, [], 120, 53, [], { left: '16시간 전', right: '지금' })
  expect(svg.includes('>16시간 전</text>')).toBe(true)
  expect(svg.includes('text-anchor="end"')).toBe(true)
  expect(svg.includes('height="53"')).toBe(true)
  // 막대는 축 줄(13) 위까지만: 가장 큰 막대의 아래 끝 = 40
  expect(/<rect [^>]*y="[\d.]+" [^>]*height="[\d.]+"/.test(svg)).toBe(true)
  expect(flowSvg(pts, [], 120, 40).includes('<text x="0"')).toBe(false)
})

test('최근 질문 N개가 보이는 첫 점: 그중 첫 질문이 시작된 뒤 첫 요청부터, 질문이 N개 이하면 처음부터', () => {
  // 요청 10개(1초 간격), 질문 넷이 요청 0 · 3 · 6 · 8 앞에서 시작
  const pts = Array.from({ length: 10 }, (_, i) => ({ atMs: T0 + i * 1000, ctx: 100_000, usd: 0 }))
  const starts = [T0 - 500, T0 + 2500, T0 + 5500, T0 + 7500]
  // 최근 2개 = 셋째 · 넷째 질문 — 셋째 질문이 시작된 뒤 첫 요청(6번)부터
  expect(recentStart(pts, starts, 2)).toBe(6)
  expect(recentStart(pts, starts, 3)).toBe(3)
  expect(recentStart(pts, starts, 4)).toBe(0)
  expect(recentStart(pts, [], 20)).toBe(0)
})

test('질문 시작: promptId 가 처음 나온 메인 사용자 줄의 시각 — 다시 적힌 줄 · 도구 결과 · 하위 에이전트는 빼고, 추출 출력 · 저장 파일도 같게', () => {
  const user = (pid: string, min: number, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ type: 'user', promptId: pid, timestamp: at(min), message: { content: '질문' }, ...extra })
  const text = [
    user('p1', 0),
    asst('a', 100_000, 1),
    user('p1', 1, { message: { content: [{ type: 'tool_result', content: 'x' }] } }), // 같은 질문의 도구 결과
    user('p1', 0), // 다시 적힌 줄
    user('p2', 2),
    user('px', 2.5, { isSidechain: true }), // 하위 에이전트
    asst('b', 120_000, 3),
  ].join('\n')
  const flow = scanTranscript(text)
  expect(flow.questions).toEqual([Date.parse(at(0)), Date.parse(at(2))])
  expect(flow.points.length).toBe(2)
  const lines = [`q ${Date.parse(at(0))}`, `p ${Date.parse(at(1))} 10 100 99990 0 claude-opus-5-5`, `q ${Date.parse(at(2))}`].join('\n')
  expect(flowFromRecords(recordsFromLines(lines)).questions).toEqual(flow.questions)
  expect(parseFlowFile(serializeFlow(flow))!.questions).toEqual(flow.questions)
  // 질문을 적기 전 판(v2) 저장 파일은 질문 없이 읽힌다 — 불러올 때 기록에서 다시 읽는 신호
  expect(parseFlowFile(JSON.stringify({ v: 2, m: [], p: [[1, 100, 0, -1]], c: [] }))!.questions).toBe(undefined)
  // 질문 · 요청을 이어 붙여도 질문은 남는다
  expect(withPoint(withQuestion(flow, 9), { atMs: 10, ctx: 1, usd: 0 }).questions).toEqual([...flow.questions!, 9])
})

test('그래프: 마지막 컴팩트 앞(지난 구간) 막대는 흐리게', () => {
  const pts = [100_000, 300_000, 90_000, 120_000].map((ctx, i) => ({ atMs: i, ctx, usd: 0 }))
  const svg = flowSvg(pts, [2], 120, 40)
  expect(svg.split('fill-opacity="0.4"').length - 1).toBe(2)
})

test('다음 요청이 읽을 수 있던 크기: 마지막 점 — 점이 없거나 그 뒤 컴팩트했으면 null', () => {
  const p = (ctx: number) => ({ atMs: 0, ctx, usd: 0 })
  expect(lastCtxOf({ points: [], compactions: [] })).toBe(null)
  expect(lastCtxOf({ points: [p(80_000), p(120_000)], compactions: [] })).toBe(120_000)
  const c = (index: number) => ({ atMs: 0, trigger: 'manual', before: 120_000, after: null, costUsd: null, index })
  expect(lastCtxOf({ points: [p(80_000), p(120_000)], compactions: [c(2)] })).toBe(null)
  expect(lastCtxOf({ points: [p(80_000), p(120_000), p(90_000)], compactions: [c(2)] })).toBe(90_000)
})
