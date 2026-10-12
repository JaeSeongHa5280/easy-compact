import { expect, mock, test } from 'claude-code/testing'

import { projectSlug } from './cost'
import { engineBelow, installedFrom } from './paths'

// 맥(macOS) 꼴 환경 — 맥 실물 없이 경로 · 언어 · 낮은 엔진 판을 확인한다. 맥 사용자가 "설치 안 됨" 을 알려 와 조사했다
// (원인 후보: "Windows 용" 표기 · Homebrew stable 엔진 2.1.287 · git 없음). 따로 된 파일 — 언어 · 설정 폴더는 모듈이 한 번 찾고 기억한다

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 }

test('맥 경로: 설치본 /Users/<이름>/.claude/plugins/cache/… 에서 설정 폴더 · 마켓, 기록 폴더 이름은 엔진 규칙대로', () => {
  expect(installedFrom('/Users/kim/.claude/plugins/cache/easy-compact/easy-compact/0.4.1')).toEqual({
    configDir: '/Users/kim/.claude',
    marketplace: 'easy-compact',
  })
  expect(projectSlug('/Users/kim/my app')).toBe('-Users-kim-my-app')
})

test('엔진 판: 2.1.295 보다 낮으면 true, 못 읽는 판은 false(낮다고 단정하지 않음)', () => {
  expect(engineBelow('2.1.287')).toBe(true)
  expect(engineBelow('2.1.294')).toBe(true)
  expect(engineBelow('2.1.295')).toBe(false)
  expect(engineBelow('2.1.300-dev')).toBe(false)
  expect(engineBelow('2.2.0')).toBe(false)
  expect(engineBelow('1.9.999')).toBe(true)
  expect(engineBelow(undefined)).toBe(false)
  expect(engineBelow('dev')).toBe(false)
})

test('맥 언어 자동: 데스크톱 앱 언어는 ~/Library/Application Support/Claude/config.json 의 locale', async ($, on) => {
  // APPDATA 없음 · LANG 없음(Dock 에서 켠 앱) — 이 PC 의 Intl 은 ko-KR 이라 영어가 나오면 맥 앱 설정을 읽은 것.
  // 시험 엔진은 Windows 에서 /Users/u 를 C:\Users\u 로 바꿔 넘긴다 — 끝부분으로 맞춘다
  const MAC_APP = '/Users/u/Library/Application Support/Claude/config.json'
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  mock.env(on, { HOME: '/Users/u' })
  on('clock.now', async () => ({ value: Date.now() }))
  const reads: string[] = []
  on('fs.read', async (_$, e) => {
    reads.push(norm(e.path))
    if (norm(e.path) === MAC_APP) return { value: JSON.stringify({ locale: 'en-US' }) }
    throw new Error('ENOENT')
  })
  on('fs.list', async () => ({ value: [] }))
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(reads).toContain(MAC_APP)
  expect(await band.find({ text: /Easy Compact/ })).not.toBe(undefined)
  expect(await band.find({ text: /이지 컴팩트/ })).toBe(undefined)
})

test('낮은 엔진 판(Homebrew stable 2.1.287): 바 · 패널 대신 업데이트 안내 한 줄, 패널을 저절로 열지 않는다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/Users/u' })
  on('session.version', async () => ({ value: { version: '2.1.287', base: '2.1.287', builtAt: '2026-10-01T00:00:00Z' } }))
  on('fs.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'mac-old' }))
  on('session.cwd', async () => ({ value: '/Users/u/app' }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  const opened: string[] = []
  on('ui.open', async () => {
    opened.push('pane')
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/Users/u/app', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ key: 'old-engine', text: /Claude Code 2\.1\.295 이상이 필요합니다 — 이 세션은 2\.1\.287/ })).not.toBe(undefined)
  expect(await band.find({ key: 'compact' })).toBe(undefined)
  expect(await band.find({ key: 'usage' })).toBe(undefined)
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 40, placement: 'dock' } })
  expect(await pane.find({ key: 'old-engine' })).not.toBe(undefined)
  expect(await pane.find({ key: 'pane-usage' })).toBe(undefined)
  expect(opened).toEqual([])
})

test('2.1.295 이상이면 바를 그대로 그린다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/Users/u' })
  on('session.version', async () => ({ value: { version: '2.1.296', base: '2.1.296', builtAt: '2026-10-12T00:00:00Z' } }))
  on('fs.list', async () => ({ value: [] }))
  on('session.id', async () => ({ value: 'mac-new' }))
  on('session.cwd', async () => ({ value: '/Users/u/app' }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/Users/u/app', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ key: 'old-engine' })).toBe(undefined)
  expect(await band.find({ key: 'usage' })).not.toBe(undefined)
})
