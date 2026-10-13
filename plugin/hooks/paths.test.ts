import { expect, test } from 'claude-code/testing'

import { changelogItems, installedFrom, marketVersionOf, pluginDataId, versionGt } from './paths'

test('설치 경로: 마켓 설치본은 설정 폴더와 마켓 이름, 폴더로 불러온 개발본은 null', () => {
  expect(installedFrom('C:\\Users\\u\\.claude\\plugins\\cache\\easy-compact\\easy-compact\\0.1.0')).toEqual({
    configDir: 'C:/Users/u/.claude',
    marketplace: 'easy-compact',
  })
  // CLAUDE_CONFIG_DIR 을 바꾼 사람: 설정 폴더 이름이 .claude 가 아니어도
  expect(installedFrom('/opt/claude-config/plugins/cache/someone-tools/easy-compact/1a2b3c4d5e6f/')).toEqual({
    configDir: '/opt/claude-config',
    marketplace: 'someone-tools',
  })
  expect(installedFrom('C:/Users/u/.claude/mods/easy-compact')).toBe(null)
  expect(installedFrom('D:/dev/easy-compact')).toBe(null)
})

test('데이터 폴더 이름: 플러그인@마켓 의 영문 · 숫자 · _ · - 아닌 글자를 - 로(공식 예와 같게)', () => {
  expect(pluginDataId('my-plugin', 'my-marketplace')).toBe('my-plugin-my-marketplace')
  expect(pluginDataId('easy-compact', 'easy-compact')).toBe('easy-compact-easy-compact')
  expect(pluginDataId('easy-compact', 'owner.tools')).toBe('easy-compact-owner-tools')
})

test('판 견주기: 숫자 세 칸만, 못 읽으면 새 판이라고 하지 않는다', () => {
  expect(versionGt('0.5.0', '0.4.1')).toBe(true)
  expect(versionGt('0.10.0', '0.9.9')).toBe(true)
  expect(versionGt('0.4.1', '0.4.1')).toBe(false)
  expect(versionGt('0.4.1', '0.5.0')).toBe(false)
  expect(versionGt(null, '0.4.1')).toBe(false)
  expect(versionGt('0.5.0', undefined)).toBe(false)
  expect(versionGt('abc', '0.1.0')).toBe(false)
})

test('마켓 사본 판: marketplace.json 의 plugins 에서 이 플러그인 판', () => {
  expect(marketVersionOf({ plugins: [{ name: 'other', version: '9.9.9' }, { name: 'easy-compact', version: '0.5.1' }] })).toBe('0.5.1')
  expect(marketVersionOf({ plugins: [{ name: 'other', version: '1.0.0' }] })).toBe(null)
  expect(marketVersionOf(null)).toBe(null)
  expect(marketVersionOf({ plugins: 'x' })).toBe(null)
})

test('CHANGELOG 한 판: 절마다 항목 머리(굵은 글 · 없으면 첫 " — " 앞), 그 판이 없으면 null', () => {
  const md = [
    '# 변경 기록',
    '',
    '## [0.5.1] — 2026-10-20',
    '',
    '### 바뀜',
    '- **업데이트 칸** — 설정 탭 맨 아래에서 새 판을 확인합니다.',
    '  - 들여 쓴 줄은 뺀다',
    '- 패널 위 **간략 · 자세히** 는 잠깐 보기 — 닫으면 돌아갑니다.',
    '- 짧은 설명 문구를 `고침`. README 도 [새 판 받기](README.ko.md#새-판-받기) 절.',
    '',
    '### 고침',
    '- **바 글이 꺾이던 것**(좁은 창)',
    '',
    '## [0.5.0] — 2026-10-14',
    '',
    '### 새로 생김',
    '- **오늘 · 이번 달 사용량**',
  ].join('\n')
  expect(changelogItems(md, '0.5.1')).toEqual([
    { head: '바뀜', items: ['업데이트 칸', '패널 위 간략 · 자세히 는 잠깐 보기', '짧은 설명 문구를 고침'] },
    { head: '고침', items: ['바 글이 꺾이던 것'] },
  ])
  expect(changelogItems(md, '0.5.0')).toEqual([{ head: '새로 생김', items: ['오늘 · 이번 달 사용량'] }])
  expect(changelogItems(md, '0.4.9')).toBe(null)
  // 줄 끝이 CRLF 여도
  expect(changelogItems(md.split('\n').join('\r\n'), '0.5.0')).toEqual([{ head: '새로 생김', items: ['오늘 · 이번 달 사용량'] }])
})
