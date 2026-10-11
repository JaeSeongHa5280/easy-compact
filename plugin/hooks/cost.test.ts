import { expect, test } from 'claude-code/testing'

import { setLang } from './i18n'

import {
  addCost,
  coldCompact,
  compactPayoff,
  modelName,
  ratesFor,
  average,
  costOf,
  rewriteOf,
  endsWithTail,
  barSvg,
  estimate,
  fmtTokens,
  fmtUntil,
  fmtUsd,
  levelOf,
  DEFAULT_THRESHOLDS,
  setThresholds,
  projectSlug,
  ctxBarSvg,
  tailOf,
  textBar,
} from './cost'

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

const NOW = 10 * 3600_000
const MODEL = 'claude-opus-5-5'
const round3 = (usd: number) => Math.round(usd * 1000) / 1000

test('Opus 5.5 요청 1회 = 컨텍스트 × $0.20/MTok, 재작성 = × $8/MTok', () => {
  const est = estimate(321_000, MODEL, NOW - 8 * 60_000, NOW)
  expect(est.kind).toBe('warm')
  if (est.kind !== 'warm') return
  expect(round3(est.perCallUsd)).toBe(0.064)
  expect(est.minsLeft).toBe(52)
  expect(round3(est.rewriteUsd)).toBe(2.568)
  expect(est.rates.label).toBe('Opus 5.5')
})

test('모델 이름: id 를 읽는 이름으로 — 요율 묶음 이름(Sonnet 5.x)이 아니라 실제 모델', () => {
  expect(modelName('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(modelName('claude-sonnet-5')).toBe('Sonnet 5')
  expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelName('claude-fable-5-1')).toBe('Fable 5.1')
  expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelName('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  // 못 읽는 id 는 그대로
  expect(modelName('some-other-model')).toBe('some-other-model')
})

test('마지막 활동이 60분을 넘으면 첫 요청 재작성', () => {
  const est = estimate(300_000, MODEL, NOW - 61 * 60_000, NOW)
  expect(est.kind === 'cold' && round3(est.rewriteUsd)).toBe(2.4)
})

test('모델별 요율: Opus 5 · Sonnet 5.5 · Fable 5.1 · Haiku 5.5(10만 넘으면 5배)', () => {
  expect(ratesFor('claude-opus-5')?.read).toBe(0.5)
  expect(ratesFor('claude-opus-5-5')?.read).toBe(0.2)
  expect(ratesFor('claude-opus-5-5')?.write1h).toBe(8)
  expect(ratesFor('claude-sonnet-5-5')?.input).toBe(2)
  expect(ratesFor('claude-fable-5-1')?.read).toBe(0.25)
  expect(ratesFor('claude-fable-5')?.read).toBe(1)
  expect(ratesFor('claude-haiku-5-5', 50_000)?.input).toBe(0.1)
  expect(ratesFor('claude-haiku-5-5', 150_000)?.input).toBe(0.5)
  expect(ratesFor('gpt-x')).toBe(null)
})

test('요율 모르는 모델 · 빈 컨텍스트는 달러를 내지 않는다', () => {
  expect(estimate(100_000, 'some-other-model', NOW, NOW).kind).toBe('unpriced')
  expect(estimate(0, MODEL, NOW, NOW).kind).toBe('unpriced')
})

test('색 기준(첫 계산 전 기본): 강조 20만 미만 ok, 권장 25만 미만 warn, 그 위 cut', () => {
  // 다른 테스트 파일이 같은 모듈의 기준을 바꿔 두었을 수 있다
  setThresholds(DEFAULT_THRESHOLDS)
  expect(levelOf(199_999)).toBe('ok')
  expect(levelOf(200_000)).toBe('warn')
  expect(levelOf(250_000)).toBe('cut')
})

test('표기', () => {
  expect(fmtTokens(134_400)).toBe('134k')
  expect(fmtTokens(1_000_000)).toBe('1M')
  expect(fmtTokens(1_250_000)).toBe('1.25M')
  expect(fmtUsd(0.161)).toBe('$0.16')
  expect(fmtUsd(18.06)).toBe('$18.06')
  expect(fmtUsd(42.69)).toBe('$42.69') // $10 이상도 센트까지(/usage 와 같은 자릿수)
  expect(fmtUntil(new Date(NOW + 133 * 60_000).toISOString(), NOW)).toBe('2시간 13분')
  expect(fmtUntil(new Date(NOW + (3 * 24 + 4) * 3600_000).toISOString(), NOW)).toBe('3일 4시간')
  expect(average([1, 2, 3])).toBe(2)
  expect(average([])).toBe(null)
  expect(textBar(50, 10)).toBe('█████░░░░░')
  expect(barSvg(50, '#5b8def', 100, 8)).toContain('width="50.0"')
  expect(projectSlug('D:\\Claude')).toBe('D--Claude')
})

test('컨텍스트 막대: 앞칸 상주 몫 · 뒤칸 대화 · 기준 눈금', () => {
  // 컨텍스트 막대: 앞칸 영구 몫(기본 15% · 요약 5%), 칸마다 1px 틈, 뒤칸 대화 몫(50% 까지)
  const ctxSvg = ctxBarSvg(50, [{ percent: 15, hex: '#aaa' }, { percent: 5, hex: '#3fb6c6' }], '#e0a030', 100, 8)
  expect(ctxSvg).toContain('<rect x="0.0" width="14.0" height="8" fill="#aaa"/>')
  expect(ctxSvg).toContain('<rect x="15.0" width="4.0" height="8" fill="#3fb6c6"/>')
  expect(ctxSvg).toContain('<rect x="20.0" width="30.0" height="8" fill="#e0a030"/>')
  // 앞칸은 지금 크기를 넘지 않는다(컴팩트 직후 추정값이 영구보다 작을 때)
  expect(ctxBarSvg(10, [{ percent: 30, hex: '#aaa' }], '#e0a030', 100, 8)).not.toContain('#e0a030')
  // 기준 눈금: 노랑 · 빨강이 시작하는 크기에 막대 위아래로 4px 씩 삐져나오는 3px 세로선(막대 안 좁은 칸과 갈리게),
  // 선 하나씩만 — 두 선을 잇는 괄호 상자는 난잡했다. 막대 밖 · 끝 값은 그리지 않는다. 그림 높이 = 8 + 4 × 2
  const marked = ctxBarSvg(50, [], '#3d7be0', 100, 8, [{ percent: 15, hex: '#e0a030' }, { percent: 21, hex: '#e05555' }, { percent: 0, hex: '#000' }])
  expect(marked).toContain('height="16" viewBox="0 0 100 16"')
  expect(marked).toContain('<rect x="0.0" y="4" width="50.0" height="8" fill="#3d7be0"/>')
  expect(marked).not.toContain('height="2"')
  expect(marked).toContain('<rect x="13.5" width="3" height="16" rx="1" fill="#e0a030"/>')
  expect(marked).toContain('<rect x="19.5" width="3" height="16" rx="1" fill="#e05555"/>')
  expect(marked).not.toContain('#000')
})

test('요청 비용은 그 요청에 답한 모델 요율로', () => {
  const t = { input_tokens: 10, output_tokens: 2_000, cache_read_input_tokens: 300_000, cache_creation_input_tokens: 5_000 }
  const opus55 = costOf(t, 'claude-opus-5-5')!
  expect(round3(opus55.read)).toBe(0.06)
  expect(round3(opus55.write)).toBe(0.04)
  expect(round3(opus55.output)).toBe(0.04)
  expect(round3(opus55.usd)).toBe(0.14)
  const opus5 = costOf(t, 'claude-opus-5')!
  expect(round3(opus5.usd)).toBe(0.25)
  expect(round3(addCost(opus55, opus55).usd)).toBe(0.28)
  expect(costOf(t, 'unknown')).toBe(null)
})

test('답변 끝부분 맞추기: 공백 차이는 무시, 다른 글은 안 맞음', () => {
  const tail = tailOf('첫 줄\n\n마지막   문단입니다.')
  expect(endsWithTail('앞 블록 … 마지막 문단입니다.', tail)).toBe(false)
  expect(endsWithTail('첫 줄 마지막 문단입니다.', tail)).toBe(true)
  expect(endsWithTail('다른 답변', tail)).toBe(false)
  expect(endsWithTail('아무거나', '')).toBe(false)
  // 턴 글이 블록 여럿일 때: 마지막 블록만 그려져도 맞는다(20자 이상)
  const multi = tailOf('앞에서 도구를 부르기 전 쓴 글.\n\n도구 뒤에 쓴 마지막 블록, 이 줄이 답변의 끝입니다.')
  expect(endsWithTail('도구 뒤에 쓴 마지막 블록, 이 줄이 답변의 끝입니다.', multi)).toBe(true)
  expect(endsWithTail('끝입니다.', multi)).toBe(false)
})

// 컴팩트 재료: 직후 9.4만 중 요약 3.13만(다시 씀) · 요약 출력 1만 · 컴팩트 요청은 전부 정가 입력
const IN = { after: 94_000, summary: 31_300, output: 10_000, mix: { input: 1, read: 0, write: 0 } }

test('컴팩트 손익: Opus 5.5 · 59.6만 → 9.4만, 컴팩트 요청이 캐시 없이 정가면 질문 4개째에 본전', () => {
  const p = compactPayoff(596_000, IN, 'claude-opus-5-5', 9)!
  // 요청 1회 $0.119 → $0.019, 요청마다 $0.10 아낌
  expect(Math.round(p.nowCallUsd * 1000)).toBe(119)
  expect(Math.round(p.afterCallUsd * 1000)).toBe(19)
  expect(Math.round(p.saveQuestionUsd! * 100)).toBe(90)
  // 저장 턴(읽기 3회 $0.36 + 출력 2천 · 새로 씀 2천 $0.06 — 가정) + 컴팩트 요청(59.6만 × 정가 입력 $4 = $2.38 + 요약 출력
  // $0.20) + 요약 다시 쓰기 $0.25 ≈ $3.25
  expect(Math.round(p.costUsd * 100)).toBe(325)
  expect(p.breakEvenCalls).toBe(33)
  expect(p.breakEvenQuestions).toBe(4)
  // 컴팩트 요청이 캐시를 읽는다면(실측 몫) 훨씬 싸다: $0.98, 질문 2개째
  const cached = compactPayoff(596_000, { ...IN, mix: { input: 0, read: 1, write: 0 } }, 'claude-opus-5-5', 9)!
  expect(Math.round(cached.costUsd * 100)).toBe(98)
  expect(cached.breakEvenQuestions).toBe(2)
})

test('컴팩트 손익: 컨텍스트가 이미 작으면 아낄 게 없다', () => {
  const p = compactPayoff(90_000, IN, 'claude-opus-5-5', 9)!
  expect(p.saveCallUsd).toBe(0)
  expect(p.breakEvenCalls).toBe(null)
  expect(p.breakEvenQuestions).toBe(null)
})

test('식은 캐시: 이어 가면 전체 다시 쓰기, 바로 컴팩트는 정가 입력 한 번 + 줄어든 만큼만 다시 쓰기', () => {
  // Opus 5.5 50만: 이어 가기 500k × $8 = $4.00, 컴팩트 500k × $4 + 1만 × $20 + 94k × $8 = $2.95
  const big = coldCompact(500_000, IN, 'claude-opus-5-5')!
  expect(big.continueUsd.toFixed(2)).toBe('4.00')
  expect(big.compactUsd.toFixed(2)).toBe('2.95')
  // 20만이면 바로 컴팩트가 더 비싸다($1.75 > $1.60) — 권장하지 않는다
  const small = coldCompact(200_000, IN, 'claude-opus-5-5')!
  expect(small.compactUsd > small.continueUsd).toBe(true)
  expect(coldCompact(100_000, IN, 'unknown-model')).toBe(null)
})

test('다시 쓴 값: 앞 요청 컨텍스트 중 못 읽고 새로 쓴 몫만 — 세션 첫 요청 · 새 내용 쓰기는 0', () => {
  const t = (read: number, write: number) => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: read, cache_creation_input_tokens: write })
  // 세션 첫 요청(앞 요청 없음): 공용 앞부분 48k 를 읽고 19k 를 처음 쓴다
  expect(rewriteOf(t(48_000, 19_000), 'claude-opus-5-5', null)).toBe(0)
  // 평소: 앞 요청 67k 를 다 읽고 파일 결과 24k 를 새로 쓴다
  expect(rewriteOf(t(67_000, 24_000), 'claude-opus-5-5', 67_000)).toBe(0)
  // 캐시 만료: 앞 요청 30만 중 공용 48k 만 읽고 나머지 25.2만 + 새 글 1k 를 쓴다 → 25.2만 × $8
  expect(Math.round(rewriteOf(t(48_000, 253_000), 'claude-opus-5-5', 300_000) * 1000) / 1000).toBe(2.016)
  // 모르는 모델
  expect(rewriteOf(t(0, 300_000), 'unknown-model', 300_000)).toBe(0)
})
