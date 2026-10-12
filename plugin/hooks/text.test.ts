import { expect, test } from 'claude-code/testing'

import { plural, setLang } from './i18n'

import { answerBreakdown, stepLabel, topSteps } from './text'

import { questionScope } from './ui-common'

test('질문 hover 묶음 이름: 끝난 시각으로 질문마다 다르다(답변 끝 칩 · 그 답변 덮개 · 패널 질문 줄 · 미리보기 견본이 같은 이름)', () => {
  expect(questionScope(1_760_000_000_123)).toBe('q-1760000000123')
  expect(questionScope(1_760_000_000_123.4)).toBe('q-1760000000123')
  expect(questionScope(1)).not.toBe(questionScope(2))
})

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

test('동작 이름: 도구와 대상, 도구가 없으면 답변 작성', () => {
  expect(stepLabel([])).toBe('답변 작성')
  expect(stepLabel([{ name: 'Edit', input: { file_path: 'C:/a/b/register.tsx' } }])).toBe('Edit register.tsx')
  expect(stepLabel([{ name: 'Edit', input: { file_path: 'C:\\a\\b\\register.tsx' } }])).toBe('Edit register.tsx')
  expect(stepLabel([{ name: 'Read', input: { file_path: '/Users/kim/app/main.ts' } }])).toBe('Read main.ts')
  expect(stepLabel([{ name: 'Bash', input: { command: 'ls', description: '파일 목록 보기' } }])).toBe('Bash 파일 목록 보기')
  expect(stepLabel([{ name: 'mcp__ccd_sidebar__list_sections', input: {} }])).toBe('list_sections')
  expect(stepLabel([{ name: 'Read', input: { file_path: 'x.ts' } }, { name: 'Grep', input: { pattern: 'foo' } }])).toBe('Read x.ts, Grep foo')
})

test('영어 개수: 1 이면 단수, 0 · 2 이상은 복수 — "1 requests" 로 나왔다', () => {
  expect(plural(1, 'request')).toBe('1 request')
  expect(plural(2, 'request')).toBe('2 requests')
  expect(plural(0, 'compact')).toBe('0 compacts')
  expect(plural(1, 'minute')).toBe('1 minute')
})


test('답변 칩 상세: 맨 위 줄(메인 · 🤖 · 🗜 · ⚙)의 합 = 질문 값, 메인 동작만 메인 아래로 — 같은 깊이면 더하는 항목으로 읽혔다', () => {
  const cost = { usd: 1.84, read: 0.8, write: 0.41, output: 0.63, input: 0 }
  const steps = [
    { label: 'Edit a.ts', usd: 1.0 },
    { label: '찾기', usd: 0.4, agent: true, steps: 3, read: 0.1, output: 0.2, write: 0.1 },
    { label: '제목', usd: 0.09, app: true },
  ]
  const r = answerBreakdown(cost as never, 0.09, steps as never, 4)
  expect(r.main).toBe('메인 요청 4회 $1.35')
  expect(r.others).toEqual(['🤖 에이전트 1개 · 요청 3회 $0.40', '⚙ 앱 자체 요청 $0.09'])
  expect(r.mainSteps.map(d => d.label)).toEqual(['Edit a.ts'])
  // 메인뿐이면 읽기 · 쓰기 · 출력까지
  expect(answerBreakdown(cost as never, undefined, [steps[0]!] as never, 4).main).toBe('메인 요청 4회 $1.84 (읽기 $0.80 · 쓰기 $0.41 · 출력 $0.63)')
})

test('동작별 값 줄이기: 비싼 것 n 개만 순서 그대로, 나머지는 개수 · 합 — 답변 아래(정보량 전부)가 끝없이 길어지지 않게', () => {
  const d = (label: string, usd: number) => ({ label, usd })
  const steps = [d('a', 0.1), d('b', 0.5), d('c', 0.2), d('e', 0.4)]
  const r = topSteps(steps, 2)
  expect(r.shown.map(x => x.label)).toEqual(['b', 'e'])
  expect(r.rest).toBe(2)
  expect(Math.round(r.restUsd * 100)).toBe(30)
  expect(topSteps(steps, 10)).toEqual({ shown: steps, rest: 0, restUsd: 0 })
})
