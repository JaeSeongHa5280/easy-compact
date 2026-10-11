import { expect, test } from 'claude-code/testing'

import { plural, setLang } from './i18n'

import { stepLabel } from './text'

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

test('동작 이름: 도구와 대상, 도구가 없으면 답변 작성', () => {
  expect(stepLabel([])).toBe('답변 작성')
  expect(stepLabel([{ name: 'Edit', input: { file_path: 'C:/a/b/register.tsx' } }])).toBe('Edit register.tsx')
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
