import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// 업데이트 칸: 설정 탭 맨 아래 easy-compact 칸 · 새 판이면 설정 탭 이름에 점 · 업데이트 뒤 첫 실행 알림.
// 마켓 설치본만이라 개발본(이 폴더)에선 EASY_COMPACT_FAKE_INSTALL 로 설치본을 흉내 낸다 — 파일은 모의 fs, claude 명령은 모의 process.run

const CFG = '/home/test/.claude'
const MARKET_DIR = `${CFG}/plugins/marketplaces/easy-compact`

const CHANGELOG = [
  '# 변경 기록',
  '',
  '## [0.5.1] — 2026-10-20',
  '',
  '### 고침',
  '- **업데이트 칸 글이 꺾이던 것** — 좁은 패널에서.',
  '',
  '## [0.5.0] — 2026-10-14',
  '',
  '### 새로 생김',
  '- **업데이트 칸** — 설정 탭 맨 아래.',
  '- **오늘 · 이번 달 사용량**(옵션)',
].join('\n')

type World = { own: string; market: string; marketAfterCheck: string; checkFails: 'no' | 'exit' | 'spawn'; ran: string[][]; store: Map<string, unknown> }

function setup(on: On, world: World, isInstalled = true) {
  mock.env(on, {
    EASY_COMPACT_LANG: 'ko',
    HOME: '/home/test',
    ...(isInstalled ? { EASY_COMPACT_FAKE_INSTALL: JSON.stringify({ configDir: CFG, marketplace: 'easy-compact' }) } : {}),
  })
  const now = Date.now()
  on('fs.read', async (_$, e) => {
    // 엔진은 /home/test 를 Windows 에선 C:/home/test 로 푼다 — 드라이브 글자를 떼고 견준다
    const path = String(e.path).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
    if (path.endsWith('/.claude-plugin/plugin.json') && !path.startsWith(MARKET_DIR)) return { value: JSON.stringify({ name: 'easy-compact', version: world.own }) }
    if (path === `${MARKET_DIR}/.claude-plugin/marketplace.json`) return { value: JSON.stringify({ name: 'easy-compact', plugins: [{ name: 'easy-compact', version: world.market }] }) }
    if (path === `${CFG}/plugins/known_marketplaces.json`) return { value: JSON.stringify({ 'easy-compact': { lastUpdated: new Date(now - 3 * 86_400_000).toISOString() } }) }
    if (path === `${MARKET_DIR}/CHANGELOG.ko.md`) return { value: CHANGELOG }
    throw new Error(`ENOENT: ${path}`)
  })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: now, isLink: false } }))
  on('session.id', async () => ({ value: 't-update' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: now }))
  on('store.get', async (_$, e) => ({ value: world.store.get(e.key) }))
  on('store.set', async (_$, e) => {
    world.store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.keys', async () => ({ value: [...world.store.keys()] }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  // 켤 때 일(판 읽기 · 처음 설치면 본 판 적기)은 session.start 에서 — 시험은 모의를 다 건 뒤 직접 시작한다
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('process.run', async (_$, e) => {
    world.ran.push(e.argv)
    const args = e.argv.slice(1).join(' ')
    if (args === 'plugin marketplace update easy-compact') {
      if (world.checkFails === 'spawn') throw new Error('spawn claude ENOENT')
      if (world.checkFails === 'exit') return { value: { exitCode: 1, stdout: '', stderr: 'fatal: unable to access github.com' } }
      world.market = world.marketAfterCheck
      return { value: { exitCode: 0, stdout: '✔ Successfully updated marketplace: easy-compact', stderr: '' } }
    }
    if (args === 'plugin update easy-compact@easy-compact') {
      return { value: { exitCode: 0, stdout: `✔ Plugin "easy-compact" updated from ${world.own} to ${world.market}. Restart to apply changes.`, stderr: '' } }
    }
    return { value: { exitCode: 1, stdout: '', stderr: '' } }
  })
}

const worldOf = (over: Partial<World> = {}): World => ({ own: '0.5.0', market: '0.5.0', marketAfterCheck: '0.5.0', checkFails: 'no', ran: [], store: new Map(), ...over })

/** 뒤에서 도는 일(켤 때 판 읽기 · 명령)을 잠깐 기다린다 */
async function waitFor(check: () => Promise<boolean>) {
  for (let i = 0; i < 50 && !(await check()); i++) await new Promise(resolve => setTimeout(resolve, 10))
}

async function openSettingsPane($: Parameters<Parameters<typeof test>[1]>[0], cols = 90) {
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  return $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: cols, placement: 'dock' } })
}

const tabLabel = async (pane: { find: (q: { key: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) => String((await pane.find({ key: 'pane-settings' }))?.props.label ?? '')

test('업데이트 칸: 폴더로 불러온 개발본엔 없다', async ($, on) => {
  const world = worldOf({ store: new Map([['settings', {}]]) })
  setup(on, world, false)
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: '' })
  const pane = await openSettingsPane($)
  expect(await pane.find({ key: 'set-lang' })).not.toBe(undefined)
  expect(await pane.find({ key: 'set-update' })).toBe(undefined)
  expect(world.ran.some(a => a.includes('plugin'))).toBe(false)
})

test('업데이트 칸: [업데이트 확인] 을 눌러야 마켓을 받고, 새 판이면 탭 이름 점 · [바뀐 것 ▸] · [업데이트] → 다시 켜면 적용', async ($, on) => {
  const world = worldOf({ marketAfterCheck: '0.5.1', store: new Map<string, unknown>([['settings', {}], ['seenVersion', '0.5.0']]) })
  setup(on, world)
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: '' })
  const pane = await openSettingsPane($)
  await waitFor(async () => (await pane.find({ key: 'set-update', text: '마지막 확인' })) !== undefined)
  // 켤 때는 이 PC 파일만 읽는다(마켓 사본 판 = 지금 판 → 점 없음), 명령은 안 돈다
  const card = JSON.stringify(await pane.find({ key: 'set-update' }))
  expect(card).toContain('easy-compact')
  expect(card).toContain('0.5.0')
  expect(card).toContain('마지막 확인 3일 전')
  expect(card).toContain('easy-compact 는 스스로 통신하지 않습니다')
  expect(world.ran.some(a => a.includes('plugin'))).toBe(false)
  expect(await tabLabel(pane)).not.toContain('•')

  await pane.press({ key: 'upd-check' })
  await waitFor(async () => (await pane.find({ key: 'upd-apply' })) !== undefined)
  expect(world.ran.find(a => a.includes('marketplace'))).toEqual(['claude', 'plugin', 'marketplace', 'update', 'easy-compact'])
  expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('새 판 0.5.1 있음')
  expect(await tabLabel(pane)).toContain(' •')
  // 바뀐 것: 받아 둔 마켓 사본의 CHANGELOG 그 판 절
  expect(await pane.find({ key: 'upd-changes-list' })).toBe(undefined)
  await pane.press({ key: 'upd-changes' })
  const list = JSON.stringify(await pane.find({ key: 'upd-changes-list' }))
  expect(list).toContain('고침')
  expect(list).toContain('업데이트 칸 글이 꺾이던 것')
  expect(list).not.toContain('오늘 · 이번 달 사용량')

  await pane.press({ key: 'upd-apply' })
  await waitFor(async () => (await pane.find({ key: 'set-update', text: '받음' })) !== undefined)
  expect(world.ran.find(a => a.includes('update') && !a.includes('marketplace'))).toEqual(['claude', 'plugin', 'update', 'easy-compact@easy-compact'])
  expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('0.5.1 받음 — 앱을 다시 켜면 적용됩니다')
  expect(await pane.find({ key: 'upd-apply' })).toBe(undefined)
})

test('업데이트 칸: 이미 최신이면 "최신 판입니다", 실패면 까닭 · [다시 시도] · 명령 출력 펼쳐 보기, claude 가 없으면 그 말', async ($, on) => {
  const world = worldOf({ checkFails: 'exit', store: new Map<string, unknown>([['settings', {}], ['seenVersion', '0.5.0']]) })
  setup(on, world)
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: '' })
  const pane = await openSettingsPane($)
  await waitFor(async () => (await pane.find({ key: 'upd-check' })) !== undefined)

  await pane.press({ key: 'upd-check' })
  await waitFor(async () => (await pane.find({ key: 'upd-retry' })) !== undefined)
  expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('확인 못 함 — git · 네트워크를 확인하세요')
  expect(await pane.find({ key: 'upd-error-text' })).toBe(undefined)
  await pane.press({ key: 'upd-error' })
  expect(JSON.stringify(await pane.find({ key: 'upd-error-text' }))).toContain('fatal: unable to access github.com')

  world.checkFails = 'no'
  await pane.press({ key: 'upd-retry' })
  await waitFor(async () => (await pane.find({ key: 'set-update', text: '최신 판입니다' })) !== undefined)
  expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('최신 판입니다(0.5.0)')
  expect(await pane.find({ key: 'upd-apply' })).toBe(undefined)

  world.checkFails = 'spawn'
  await pane.press({ key: 'upd-check' })
  await waitFor(async () => (await pane.find({ key: 'set-update', text: 'claude 명령을 못 찾았습니다' })) !== undefined)
  expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('claude 명령을 못 찾았습니다')
  // 원문이 없으니 펼쳐 볼 것도 없다
  expect(await pane.find({ key: 'upd-error' })).toBe(undefined)
})

test('업데이트 뒤 첫 실행: 전부터 쓰던 사람이면 사용량 패널 맨 위에 "N 판으로 업데이트됨" — [바뀐 것 ▸] · [닫기] 하면 다시 안 보인다', async ($, on) => {
  // 0.4.x 까지는 본 판(seenVersion)을 안 적었다 — 설정이 있으면 전부터 쓰던 사람
  const world = worldOf({ store: new Map<string, unknown>([['settings', { screen: 'detail' }]]) })
  setup(on, world)
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 70, placement: 'dock' } })
  await waitFor(async () => (await pane.find({ key: 'upd-note' })) !== undefined)
  expect(JSON.stringify(await pane.find({ key: 'upd-note' }))).toContain('0.5.0 판으로 업데이트됨')
  await pane.press({ key: 'upd-note-changes' })
  const list = JSON.stringify(await pane.find({ key: 'upd-note-list' }))
  expect(list).toContain('업데이트 칸')
  expect(list).toContain('오늘 · 이번 달 사용량')
  await pane.press({ key: 'upd-note-close' })
  await waitFor(async () => (await pane.find({ key: 'upd-note' })) === undefined)
  expect(await pane.find({ key: 'upd-note' })).toBe(undefined)
  expect(world.store.get('seenVersion')).toBe('0.5.0')
})

test('업데이트 뒤 첫 실행 알림은 처음 설치한 사람에겐 없다 — 설정을 처음 적을 때 본 판도 같이 적는다', async ($, on) => {
  const world = worldOf()
  setup(on, world)
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 70, placement: 'dock' } })
  await waitFor(async () => world.store.get('seenVersion') !== undefined)
  expect(world.store.get('seenVersion')).toBe('0.5.0')
  expect(await pane.find({ key: 'upd-note' })).toBe(undefined)
})
