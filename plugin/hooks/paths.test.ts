import { expect, test } from 'claude-code/testing'

import { installedFrom, pluginDataId } from './paths'

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
