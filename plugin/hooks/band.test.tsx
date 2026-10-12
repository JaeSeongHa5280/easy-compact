import type { On, RenderSurface } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80 }

/** 설정 탭 칸을 다 펼친다 — 처음엔 컴팩트 시점 · 문구만 펼침(바 · 언어는 접혀 제목 줄에 지금 값). 이미 펼친 칸은 둔다 */
async function openSettings(pane: { find: (q: { key: string; text: string }) => Promise<unknown>; press: (q: { key: string }) => Promise<unknown> }) {
  // 0.4.0: 바 · 패널 칸은 맨 위 "화면" 칸의 [세부] 안
  for (const k of ['set-screen', 'set-window', 'set-compact', 'set-tidy', 'set-cache', 'set-lang']) {
    if (await pane.find({ key: `fold-${k}`, text: '▸' })) await pane.press({ key: `fold-${k}` })
  }
  if (!(await pane.find({ key: 'info-row', text: '' })) && (await pane.find({ key: 'screen-more', text: '' }))) await pane.press({ key: 'screen-more' })
}

test('데스크톱 띠: 컴팩트 → 실행/취소 → 실행이면 /compact 명령을 돌린다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const ran: string[] = []
  const args: string[] = []
  on('command.run', { command: 'compact' }, async (_$, e) => {
    ran.push(e.command)
    args.push(e.args ?? '')
    return { text: 'compacted' }
  })

  const ui = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // 세션 트리 버튼은 따로 mod(session-tree-viewer) — 여기 띠엔 사용량 · 컴팩트만
  expect(await ui.find({ key: 'tree' })).toBe(undefined)
  expect(await ui.find({ key: 'usage' })).not.toBe(undefined)

  await ui.press({ key: 'compact' })
  expect(await ui.find({ key: 'compact-yes' })).not.toBe(undefined)

  await ui.press({ key: 'compact-no' })
  expect(await ui.find({ key: 'compact' })).not.toBe(undefined)
  expect(ran).toEqual([])

  await ui.press({ key: 'compact' })
  await ui.press({ key: 'compact-yes' })
  expect(ran).toEqual(['compact'])
  // 정리 없이 바로여도 보존 지시는 붙는다(캐시 상태와 무관)
  expect(args[0]).toContain('이어서 할 일')
  expect(await ui.find({ key: 'compact' })).not.toBe(undefined)
})

test('작업 중이면 컴팩트 버튼 대신 흐린 글자 — 누를 수 없다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const ui = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { ...BAND, isWorking: true },
  })
  expect(await ui.find({ key: 'compact' })).toBe(undefined)
  expect(await ui.find({ text: /답이 끝나면 누를 수 있음/ })).not.toBe(undefined)
  // 못 누르는 동안 🗜 는 색 없이 흐리게
  const icon = JSON.stringify(await ui.find({ key: 'compact-icon' }))
  expect(icon).toContain('"dimColor":true')
  expect(icon).not.toContain('#4c9be8')
})

const SAMPLE = {
  model: 'claude-opus-5-5',
  contextTokens: 321_000,
  window: 1_000_000,
  percent: 32.1,
  costUsd: 18.06,
  rateLimits: [
    { kind: 'five_hour', percentUsed: 62, resetsAt: new Date(Date.now() + 80 * 60_000).toISOString() },
    { kind: 'seven_day', percentUsed: 23 },
  ],
  categories: [
    { name: 'Free space', tokens: 595_000, kind: 'free' },
    { name: 'Messages', tokens: 260_000, kind: 'used' },
    { name: 'Autocompact buffer', tokens: 33_000, kind: 'buffer' },
    { name: 'System tools', tokens: 25_000, kind: 'used' },
  ],
  lastActivityMs: Date.now() - 8 * 60_000,
  history: [200_000, 259_000, 321_000],
}

test('값이 있을 때: 띠 두 줄(한도 · 예상)과 사용량 패널이 데스크톱에서 검증을 통과한다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // mod 가 부르는 엔진 기능을 테스트가 맨 아래에서 대답한다
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: SAMPLE.lastActivityMs, isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:\\Claude' }))
  on('session.model', async () => ({ value: SAMPLE.model }))
  on('session.usage', async (_$, e) => ({ value: {
    startedAt: 0,
    context: {
      tokens: SAMPLE.contextTokens,
      window: SAMPLE.window,
      percent: SAMPLE.percent,
      ...(e.breakdown ? { breakdown: { categories: SAMPLE.categories.map(c => ({ ...c, color: 'x', isDeferred: false })) } } : {}),
    },
    rateLimits: SAMPLE.rateLimits.map(r => ({ ...r, source: 'test' })),
    cost: { usd: SAMPLE.costUsd },
  } }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('clock.now', async () => ({ value: Date.now() }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('session.measure', async (_$, e) => ({ changed: e.changed }))

  // /easy-compact usage: 사용량을 재고 사용량 패널을 연다. 다시 읽기(/easy-compact)는 기본 적재(/context 분류)도 잰다
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  await $.command.run({ command: 'easy-compact', args: '' })

  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  expect(await band.find({ type: 'Svg' })).not.toBe(undefined)
  // 지금 걸린 컴팩트 시점(기본 = 구간)을 컨텍스트 바로 뒤에
  expect(await band.find({ text: ' · 컴팩트 구간 ' })).not.toBe(undefined)
  expect(await band.find({ text: /^\d+k~\d+k$/ })).not.toBe(undefined)
  // 한도는 턴 끝을 기다리지 않고 응답마다(엔진이 1포인트 넘게 움직였다고 알릴 때) 바뀐다 — 긴 턴 동안 앱보다 낮았다
  expect(await band.find({ text: '62%' })).not.toBe(undefined)
  await $.session.measure({
    context: { tokens: SAMPLE.contextTokens, window: SAMPLE.window, percent: SAMPLE.percent },
    rateLimits: [{ kind: 'five_hour', percentUsed: 63.4 }, { kind: 'seven_day', percentUsed: 23 }],
    changed: ['rateLimits'],
  })
  expect(await band.find({ text: '63%' })).not.toBe(undefined)
  expect(await band.find({ text: '62%' })).toBe(undefined)

  await band.press({ key: 'compact' })
  expect(await band.find({ text: /컴팩트할까요[?]/ })).not.toBe(undefined)
  // 드는 값만이 아니라 효과: 32.1만 → 직후 크기로 줄어 아끼는 값. 직후 크기 = 기본 적재(/context 분류의 System tools 25k)
  // + 요약(아직 못 잼 — 가정 30k)
  expect(await band.find({ text: /아낌/ })).not.toBe(undefined)
  // 본전 계산은 화면에서 뺐다(투머치) — 정리 프롬프트로만 넘긴다
  expect(await band.find({ text: /본전/ })).toBe(undefined)
  expect(await band.find({ text: '~55k' })).not.toBe(undefined)
  // 확인은 아랫줄(컴팩트 자리)에서만 — 윗줄 사용량 버튼은 그대로
  expect(await band.find({ key: 'compact' })).toBe(undefined)
  expect(await band.find({ key: 'compact-yes' })).not.toBe(undefined)
  expect(await band.find({ key: 'usage' })).not.toBe(undefined)

  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 40, placement: 'dock' },
  })
  // 비용은 세 줄(세션 누적 · 지난 질문 · 다음 요청) — 검증용 엔진 집계 · 턴 평균 줄은 뺐다
  // 세션 누적은 카드 제목 줄에(줄 하나로 두니 눈에 안 띄었다) — 질문별 비용의 "N개 합" · 컴팩트의 "총 이득" 과 같은 자리
  // "세션 누적" 만으론 무엇이 쌓인 건지 흐려 "이 세션 누적 비용". "API 정가 환산" 은 모든 금액에 걸려 맨 아래 요율 줄로
  expect(await pane.find({ text: /^이 세션 누적 비용 \$\d+\.\d\d$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^금액은 모두 API 정가 환산입니다/ })).not.toBe(undefined)
  // 본문엔 같은 값 줄을 두지 않는다(0.4.0 — 같은 값은 한 곳). 카드는 접을 수 있다(간략 보기): 접으면 제목 줄 요약만 — 앞에 지금
  // 값(컨텍스트 크기)
  expect(await pane.find({ key: 'k-total' })).toBe(undefined)
  expect(await pane.find({ key: 'k-call' })).not.toBe(undefined)
  await pane.press({ key: 'fold-s-now' })
  expect(await pane.find({ key: 'fold-s-now', text: '▸' })).not.toBe(undefined)
  expect(await pane.find({ key: 'k-call' })).toBe(undefined)
  expect(await pane.find({ text: /^컨텍스트 ~?\d+k · 이 세션 누적 비용 \$\d+\.\d\d$/ })).not.toBe(undefined)
  await pane.press({ key: 'fold-s-now' })
  expect(await pane.find({ key: 'k-call' })).not.toBe(undefined)
  // 질문별 비용 · 컴팩트 카드도 같은 버튼으로 접는다
  await pane.press({ key: 'fold-s-compact' })
  expect(await pane.find({ key: 'f-head' })).toBe(undefined)
  await pane.press({ key: 'fold-s-compact' })
  expect(await pane.find({ key: 'f-head' })).not.toBe(undefined)
  await pane.press({ key: 'fold-s-history' })
  expect(await pane.find({ key: 'fold-s-history', text: '▸' })).not.toBe(undefined)
  await pane.press({ key: 'fold-s-history' })
  expect(await pane.find({ text: '다음 요청' })).not.toBe(undefined)
  expect(await pane.find({ text: '턴 평균' })).toBe(undefined)
  // Opus 5.5: 321k × $0.20/MTok = $0.064 (예전 Opus 5 고정 요율이면 $0.16 이었다)
  expect(await pane.find({ text: '~$0.06' })).not.toBe(undefined)
  expect(await pane.find({ text: /Opus 5\.5 요율/ })).not.toBe(undefined)
  // 비용 패널엔 한도(띠에 있다) · 컨텍스트 구성을 그리지 않는다. 질문별 비용은 패널 안 탭이 아니라 따로 연 패널이다
  expect(await pane.find({ text: 'Messages' })).toBe(undefined)
  expect(await pane.find({ text: '5시간' })).toBe(undefined)
  expect(await pane.find({ key: 'pane-history' })).toBe(undefined)

  // 터미널에선 SVG 대신 글자 막대
  const term = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await term.find({ type: 'Svg' })).toBe(undefined)
})

test('사용량 패널이 데스크톱 표면에서 그려진다(값이 없을 때)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 설정 탭(미리보기 예시 값)은 지금 시각을 묻는다
  on('clock.now', async () => ({ value: Date.now() }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  const ui = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 40, placement: 'dock' },
  })
  // 관계없는 세션(nav 없음)엔 트리 탭이 없다 — 사용량 · 설정 탭만(설정은 자주 안 열어 탭으로)
  expect(await ui.find({ key: 'pane-tree' })).toBe(undefined)
  expect(await ui.find({ key: 'pane-usage', text: '✓ 📊 사용량' })).not.toBe(undefined)
  expect(await ui.find({ key: 'pane-settings' })).not.toBe(undefined)
  // 위에서부터: 컨텍스트 · 비용 → 질문별 비용 → 컴팩트
  expect(await ui.find({ text: '컨텍스트 · 비용' })).not.toBe(undefined)
  expect(await ui.find({ text: '컴팩트' })).not.toBe(undefined)
  expect(await ui.find({ text: '질문별 비용' })).not.toBe(undefined)
  // 탭 바꾸기는 "설정 탭은 세션마다 따로" 테스트에서
  // 잰 값 · 끝난 질문이 하나도 없으면 설정 미리보기의 바 · 질문 비용 견본은 예시 값 — 예시라고 적는다
  await ui.press({ key: 'pane-settings' })
  const pv = JSON.stringify(await ui.find({ key: 'screen-preview' }))
  expect(pv).toContain('아래 견본은 예시 값입니다 — 첫 질문이 끝나면 이 세션 값으로 바뀝니다.')
  expect(pv).toContain('아래 견본은 예시 값입니다 — 첫 답변이 끝나면 이 세션 값으로 바뀝니다.')
  expect(pv).toContain('이 세션 $3.40')
  expect(pv).toContain('이 질문 $0.36 · 요청 4회')
})

test('정리 후 컴팩트: 정리 프롬프트 → 그 턴이 답으로 끝나면 /compact, 중단이면 안 함', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const submitted: string[] = []
  const ran: string[] = []
  on('prompt.submit', async (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('command.run', { command: 'compact' }, async (_$, e) => {
    ran.push(e.args)
    return { text: 'compacted' }
  })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:\Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('clock.after', async () => ({ value: undefined }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'compact' })
  // 확인창 선택지마다 하는 일이 적혀 있다: 저장하고 컴팩트는 잃을 정보가 있으면 멈춤, 바로 컴팩트는 붙이는 지시
  expect(await band.find({ text: /잃을 정보가 있으면 멈추고 알림/ })).not.toBe(undefined)
  expect(await band.find({ text: /이어서 할 일은 요약에 남길 것/ })).not.toBe(undefined)
  await band.press({ key: 'compact-tidy' })
  expect(submitted.length).toBe(1)
  expect(submitted[0]).toContain('[컴팩트 준비]')
  expect(submitted[0]).toContain('[컴팩트 보류]')
  // 돈 판단은 mod 가 숫자로 한다 — 세션엔 손익을 넘기지 않고 잃을 정보만 보게 한다
  expect(submitted[0]).toContain('잃는 정보가 있는지만 보세요')
  expect(submitted[0]).not.toContain('본전')
  // 정리 중엔 컴팩트 버튼이 없다(다시 못 누른다) — 취소만 있다
  expect(await band.find({ key: 'compact' })).toBe(undefined)
  expect(await band.find({ key: 'compact-cancel' })).not.toBe(undefined)

  // 정리 턴이 중단되면 컴팩트하지 않고 대기도 푼다
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 'a', reason: 'aborted' })
  expect(ran).toEqual([])
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)

  // 세션이 보류하면 컴팩트하지 않고 띠에 보류 표시
  await band.press({ key: 'compact' })
  await band.press({ key: 'compact-tidy' })
  await $.turn.complete({ answer: '편집이 중간이라 먼저 끝내야 합니다.\n[컴팩트 보류]', durationMs: 1, isAborted: false, turnId: 'h', reason: 'answer' })
  expect(ran).toEqual([])
  expect(await band.find({ text: '⏸ 보류됨' })).not.toBe(undefined)

  // 판정 표시 없이 끝나도 하지 않는다
  await band.press({ key: 'compact' })
  await band.press({ key: 'compact-tidy' })
  await $.turn.complete({ answer: '정리했습니다', durationMs: 1, isAborted: false, turnId: 'u', reason: 'answer' })
  expect(ran).toEqual([])

  // [컴팩트 진행] 으로 끝나면 /compact 에 "이어서 할 일 보존" 지시가 붙는다
  await band.press({ key: 'compact' })
  await band.press({ key: 'compact-tidy' })
  await $.turn.complete({ answer: '이어서 할 일: …\n[컴팩트 진행]', durationMs: 1, isAborted: false, turnId: 'b', reason: 'answer' })
  // /compact 는 턴이 끝난 뒤(clock.after)로 미뤄 돈다 — 그 타이머가 풀릴 틈을 준다
  for (let i = 0; i < 20 && ran.length === 0; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(ran.length).toBe(1)
  expect(ran[0]).toContain('이어서 할 일')
  // 끝나면 버튼이 돌아온다
  for (let i = 0; i < 20 && (await band.find({ key: 'compact' })) === undefined; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)
})

test('컨텍스트 흐름: 질문이 40개를 넘으면 최근 질문 40개만, [전체] 로 다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 시계는 요청마다 1초씩 — 질문 끝 시각과 요청 시각을 가른다
  let clock = Date.parse('2026-10-11T09:00:00Z')
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock, isLink: false } }))
  on('session.id', async () => ({ value: 't-q' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 120_000, window: 1_000_000, percent: 12 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: (clock += 1000) }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 120_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  const ask = async (n: number) => {
    await $.turn.start({ text: `질문 ${n}`, turnId: `q${n}` })
    for await (const _ of $.turn.step({ turnId: `q${n}`, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: `답 ${n}`, durationMs: 1, isAborted: false, turnId: `q${n}`, reason: 'answer' })
  }
  for (let n = 1; n <= 40; n++) await ask(n)
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  const flowAlt = async () => String((await pane.findAll({ type: 'Svg' })).map(s => s.props.alt).find(alt => /컨텍스트 흐름/.test(String(alt))))
  // 40개까지는 단추 없이 다
  expect(await pane.find({ key: 'flow-recent' })).toBe(undefined)
  expect(await flowAlt()).toMatch(/^요청 40회의 컨텍스트 흐름/)
  await ask(41)
  await ask(42)
  expect((await pane.find({ key: 'flow-recent' }))?.props.label).toBe('✓ 최근 질문 40')
  expect((await pane.find({ key: 'flow-all' }))?.props.label).toBe('전체')
  // 질문마다 요청 한 번 — 최근 40개 = 요청 40회, 제목 줄은 세션 전체(42회)
  expect(await flowAlt()).toMatch(/^요청 40회의 컨텍스트 흐름/)
  expect(await pane.find({ text: /^요청 42회/ })).not.toBe(undefined)
  await pane.press({ key: 'flow-all' })
  expect((await pane.find({ key: 'flow-all' }))?.props.label).toBe('✓ 전체')
  expect(await flowAlt()).toMatch(/^요청 42회의 컨텍스트 흐름/)
  // 터미널(CLI)도 같은 단추 — 칸 그림(Raster) 흐름 그래프와 같이, 눌러 오간다
  const term = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 89, placement: 'dock' } })
  expect((await term.find({ key: 'flow-all' }))?.props.label).toBe('✓ 전체')
  expect((await term.findAll({ type: 'Raster' })).some(r => r.props.rows === 6)).toBe(true)
  await term.press({ key: 'flow-recent' })
  expect((await term.find({ key: 'flow-recent' }))?.props.label).toBe('✓ 최근 질문 40')
  expect((await term.find({ key: 'flow-all' }))?.props.label).toBe('전체')
  // 질문별 비용 "전체" 는 최근 30개까지만 줄로, 그 앞은 개수 · 합 한 줄 — 한 세션에서 전체 60줄(자세히)을 그리자 데스크톱이 패널을
  // 통째로 받지 않았다(2026-10-13, 크기 한도로 보임)
  await pane.press({ key: 'history-all' })
  // 줄로 다 못 그리니 버튼 이름도 "전체" 가 아니라 "최근 30"
  expect((await pane.find({ key: 'history-all' }))?.props.label).toBe('✓ 최근 30')
  expect(await pane.find({ key: 'hr-29' })).not.toBe(undefined)
  expect(await pane.find({ key: 'hr-30' })).toBe(undefined)
  expect(await pane.find({ text: /^그 앞 질문 \d+개 · 합 \$\d+\.\d\d — 패널이 한 번에 그릴 수 있는 크기 때문에 최근 30개까지만 줄로 보입니다$/ })).not.toBe(undefined)
})

test('질문별 비용 패널: 질문 하나가 기록되고, 누르면 동작별 값이 펼쳐진다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  const opened: string[] = []
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:\Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [{ name: 'Edit', input: { file_path: 'C:/x/register.tsx' } }],
      stopReason: 'tool_use',
      usage: { input_tokens: 10, output_tokens: 1_000, cache_read_input_tokens: 300_000, cache_creation_input_tokens: 2_000, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.start({ text: '레지스터 고쳐줘', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만 필요하다
  }
  await $.turn.complete({ answer: '고쳤습니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ text: '레지스터 고쳐줘' })).not.toBe(undefined)

  // 질문별 비용은 따로 탭 없이 비용 패널 아래에 전부 — 질문을 누르면 그 자리에서 동작별 값이 펼쳐진다
  expect(await pane.find({ key: 'history-more' })).toBe(undefined)
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: 'Edit register.tsx' })).not.toBe(undefined)
  // 다시 누르면 접힌다
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: 'Edit register.tsx' })).toBe(undefined)

  // 5개 이하면 전환 버튼이 없다. 6개째부터 제목 옆 [최근 5] [전체 N] 으로 한 자리에서 바꿔 본다
  expect(await pane.find({ key: 'history-all' })).toBe(undefined)
  for (let n = 2; n <= 6; n++) {
    await $.turn.start({ text: `질문 ${n}`, turnId: `t${n}` })
    for await (const _ of $.turn.step({ turnId: `t${n}`, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: `답 ${n}`, durationMs: 1, isAborted: false, turnId: `t${n}`, reason: 'answer' })
  }
  expect(await pane.find({ key: 'hx-5' })).toBe(undefined)
  await pane.press({ key: 'history-all' })
  expect(await pane.find({ key: 'hx-5' })).not.toBe(undefined)
  await pane.press({ key: 'history-recent' })
  expect(await pane.find({ key: 'hx-5' })).toBe(undefined)
  expect(await pane.find({ text: /^\d+개 합 \$/ })).not.toBe(undefined)
  // 질문마다 그 질문이 늘린 컨텍스트(여기선 매번 30만 그대로라 +0)
  expect(await pane.find({ text: ' (+0)' })).not.toBe(undefined)
})

test('설정: 컴팩트 시점(비용표 크기 띠 / 직접 지정 입력칸, [적용]) · 캐시 −/+ · 명령, 직접 쓴 컴팩트 문구가 정리 프롬프트에 들어간다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  const submitted: string[] = []
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:\Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('prompt.submit', async (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  const saved = () => store.get('settings') as { compactAt: number; follow: boolean; rangeStart: number; rangeEnd: number; cacheWarnMin: number }

  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  // 설정 명령은 사용량 패널의 설정 탭을 연다(사용량 내용 대신 설정만)
  expect(await pane.find({ key: 'pane-settings', text: '✓ ⚙ 설정' })).not.toBe(undefined)
  // 처음엔 맨 위 "화면" 칸만 펼침(0.4.0 설정 정리) — 컴팩트 시점 · 문구 · 언어는 접혀 제목 줄에 지금 값, 캐시 경고는 접지 않는다.
  // 화면 안 세부는 펼침 — 모든 화면 공통(한도 줄 · 세션 금액 색)이 거기 있다
  expect(await pane.find({ key: 'screen-detail' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-mode' })).toBe(undefined)
  expect(await pane.find({ key: 'tidy-default' })).toBe(undefined)
  // 캐시 칸도 접힌다(유지 시간 · 정하는 곳 · 경고 둘 · 바꾸기로 늘었다)
  expect(await pane.find({ key: 'cache-up' })).toBe(undefined)
  expect(await pane.find({ key: 'fold-set-cache' })).not.toBe(undefined)
  expect(await pane.find({ key: 'session-colors' })).not.toBe(undefined)
  expect(await pane.find({ key: 'lang-ko' })).toBe(undefined)
  // 펼친 칸은 패널을 연 채 사용량 ↔ 설정을 오가면 그대로, 패널을 닫았다 열면 처음대로(화면만)
  await pane.press({ key: 'fold-set-compact' })
  expect(await pane.find({ key: 'cmp-mode' })).not.toBe(undefined)
  await pane.press({ key: 'pane-usage' })
  await pane.press({ key: 'pane-settings' })
  expect(await pane.find({ key: 'cmp-mode' })).not.toBe(undefined)
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  expect(await pane.find({ key: 'pane-settings', text: '✓ ⚙ 설정' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-mode' })).toBe(undefined)
  expect(await pane.find({ key: 'screen-detail' })).not.toBe(undefined)
  await openSettings(pane)
  expect(await pane.find({ text: '질문별 비용' })).toBe(undefined)
  // 처음은 구간 방식 · 처음 설치 값 구간 20만 ~ 25만. 0~100만 비용표의 크기 띠 줄마다 버튼 하나 — 직접 지정의 ◀ ▶ 는 안
  // 보인다. 직후 크기를 몰라 최적 대비는 비어 있다. 지금 컨텍스트(30만)는 그 자리에 "지금" 줄로
  expect(await pane.find({ key: 'cmp-range', text: '✓ 구간' })).not.toBe(undefined)
  // 적용 중인 값은 카드 맨 위 한 줄(강조 색) + 표의 그 줄 끝 "적용 중" — 녹색 "지금 구간" 줄은 없다
  expect(await pane.find({ key: 'cmp-applied' })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: '구간 200k ~ 250k' }))?.props.color).toBe('suggestion')
  expect(await pane.find({ key: 'cmp-on-200000' })).not.toBe(undefined)
  expect(await pane.find({ text: /^지금 구간/ })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-t-head' })).not.toBe(undefined)
  expect((await pane.find({ key: 'cmp-band-200000' }))?.props.variant).toBe('primary')
  expect((await pane.find({ key: 'cmp-t-200000' }))?.props.borderStyle).toBe('round')
  // 띠 버튼 이름 길이가 같다(숫자 폭 공백 U+2007 로 맞춤) — 버튼 줄이 들쭉날쭉했다
  const nameOf = async (k: number) => String((await pane.find({ key: `cmp-band-${k}` }))?.props.label)
  expect((await nameOf(700_000)).length).toBe((await nameOf(250_000)).length)
  // 앞에 고르기 표시 ○(고른 줄 ◉) — 이름만 있으니 버튼처럼 안 느껴졌다
  expect(/^○\s+700k ~ 1M\s*$/.test(await nameOf(700_000))).toBe(true)
  expect((await nameOf(200_000)).startsWith('◉')).toBe(true)
  // 띠의 요청 1회 · 캐시 식으면(Opus 5.5: 15만 ~ 20만 × $0.20 · $8)
  expect(await pane.find({ text: '$0.03~0.04' })).not.toBe(undefined)
  expect(await pane.find({ text: '$1.20~1.60' })).not.toBe(undefined)
  // 지금 컨텍스트는 맨 위 적용 중 줄에 크기만(적용 중 기준 색: 끝 250k 을 넘어 빨강) — 표 사이에 끼운 줄은 띠 버튼 줄처럼
  // 생겨 눌러 보게 됐다
  expect(await pane.find({ key: 'cmp-t-now' })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '현재 컨텍스트' })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^300k$/ }))?.props.color).toBe('red')
  // 그 옆에 지금 크기에서 읽기 1회(Opus 5.5: 30만 × $0.20 = $0.06, 컨텍스트와 같은 색) — 바의 "요청당"(실제 값, 9a)과 이름을 가른다
  expect(await pane.find({ type: 'Text', text: '읽기 1회' })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^\$0\.06$/ }))?.props.color).toBe('red')
  expect(await pane.find({ key: 'cmp-down' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-apply' })).toBe(undefined)
  // 프리셋 · 자동 · 금액 문턱 · 최적값 · 폭 · 시작/끝 버튼은 없다
  expect(await pane.find({ key: 'preset-default' })).toBe(undefined)
  expect(await pane.find({ key: 'mode-auto' })).toBe(undefined)
  expect(await pane.find({ key: 'usdWarn-up' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-follow' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-pct-10' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-start-150000' })).toBe(undefined)

  // 줄을 고르기만 해서는 저장되지 않는다 — 확인창처럼 [▶ 적용] [✕ 취소], 취소하면 원래대로
  await pane.press({ key: 'cmp-band-300000' })
  expect(store.get('settings')).toBe(undefined)
  expect((await pane.find({ key: 'cmp-band-300000' }))?.props.variant).toBe('primary')
  expect((await pane.find({ key: 'cmp-t-300000' }))?.props.borderStyle).toBe('round')
  expect(await pane.find({ text: '구간 200k ~ 250k → 구간 300k ~ 400k 로 바꿀까요?' })).not.toBe(undefined)
  // 고르는 동안에도 실제 적용 구간은 표에 "적용 중"
  expect(await pane.find({ key: 'cmp-on-200000' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-on-300000' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-apply' })).not.toBe(undefined)
  await pane.press({ key: 'cmp-cancel' })
  expect(await pane.find({ key: 'cmp-apply' })).toBe(undefined)
  expect((await pane.find({ key: 'cmp-band-200000' }))?.props.variant).toBe('primary')
  expect((await pane.find({ key: 'cmp-t-200000' }))?.props.borderStyle).toBe('round')
  // 띠를 고르고 적용 — 모든 세션이 읽는 저장소에 남는다
  await pane.press({ key: 'cmp-band-150000' })
  await pane.press({ key: 'cmp-apply' })
  expect(saved()).toMatchObject({ follow: true, rangeStart: 150_000, rangeEnd: 200_000 })
  expect(await pane.find({ key: 'cmp-apply' })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '구간 150k ~ 200k' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-on-150000' })).not.toBe(undefined)

  // 직접 지정: 구간 끝(20만)에서 시작, 크기는 입력칸에 써서(◀ ▶ 대신) — 적용 전엔 저장된 값 그대로
  await pane.press({ key: 'cmp-manual' })
  expect((await pane.find({ key: 'cmp-size-input' }))?.props.value).toBe('200k')
  // 못 읽는 글은 빨강으로 알리고, 친 채로 두면(Enter 없이) 적용에도 안 들어간다
  await pane.input({ key: 'cmp-size-input', text: '이십만', kind: 'change' })
  expect(await pane.find({ text: /^크기로 못 읽었습니다/ })).not.toBe(undefined)
  // 치는 동안 어떤 크기로 읽었는지, 범위 밖이면 어디로 맞추는지(노랑) — 말없이 맞추면 안 들어간 줄 알았다
  await pane.input({ key: 'cmp-size-input', text: '450ㅏ', kind: 'change' })
  expect(await pane.find({ text: '= 450k' })).not.toBe(undefined)
  await pane.input({ key: 'cmp-size-input', text: '2M', kind: 'change' })
  expect((await pane.find({ type: 'Text', text: '= 1M(10만 ~ 100만 안으로 맞춤)' }))?.props.color).toBe('yellow')
  await pane.input({ key: 'cmp-size-input', text: '20만' })
  expect(saved().follow).toBe(true)
  expect(await pane.find({ key: 'cmp-manual', text: '✓ 직접 지정' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-t-head' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-down' })).toBe(undefined)
  expect((await pane.find({ key: 'cmp-size-input' }))?.props.value).toBe('200k')
  // 노랑 = 정한 크기의 80% — 노랑 · 빨강 글자에 그 색
  expect((await pane.find({ type: 'Text', text: '160k부터 노랑' }))?.props.color).toBe('yellow')
  expect((await pane.find({ type: 'Text', text: '200k부터 빨강' }))?.props.color).toBe('red')
  expect(await pane.find({ text: '10만 ~ 100만' })).not.toBe(undefined)
  expect(await pane.find({ text: '구간 150k ~ 200k → 직접 지정 200k 로 바꿀까요?' })).not.toBe(undefined)
  await pane.press({ key: 'cmp-apply' })
  expect(saved()).toMatchObject({ follow: false, compactAt: 200_000 })
  expect((await pane.find({ type: 'Text', text: '직접 지정 200k' }))?.props.color).toBe('suggestion')
  // 구간으로 돌아가면 고른 구간 그대로
  await pane.press({ key: 'cmp-range' })
  await pane.press({ key: 'cmp-apply' })
  expect(saved()).toMatchObject({ follow: true, rangeStart: 150_000, rangeEnd: 200_000 })
  // 캐시 경고 −/+
  await pane.press({ key: 'cache-up' })
  expect(saved().cacheWarnMin).toBe(15)
  await pane.press({ key: 'cache-down' })
  expect(saved().cacheWarnMin).toBe(10)

  // 명령: 크기 직접 지정 · 구간 방식(예전 "최적" 도) · 구간 값 · 캐시 — 명령은 바로 저장
  await $.command.run({ command: 'easy-compact', args: 'set 권장 60만' })
  expect(saved().compactAt).toBe(600_000)
  expect(saved().follow).toBe(false)
  await $.command.run({ command: 'easy-compact', args: 'set 권장 구간' })
  expect(saved().follow).toBe(true)
  await $.command.run({ command: 'easy-compact', args: 'set 권장 60만' })
  await $.command.run({ command: 'easy-compact', args: 'set 권장 최적' })
  expect(saved().follow).toBe(true)
  await $.command.run({ command: 'easy-compact', args: 'set 구간 15만 25만' })
  expect(saved()).toMatchObject({ follow: true, rangeStart: 150_000, rangeEnd: 250_000 })
  await $.command.run({ command: 'easy-compact', args: 'set 구간 30만 20만' })
  expect(saved()).toMatchObject({ rangeStart: 150_000, rangeEnd: 250_000 })
  await $.command.run({ command: 'easy-compact', args: 'set 캐시 5' })
  expect(saved().cacheWarnMin).toBe(5)
  await $.command.run({ command: 'easy-compact', args: 'set 캐시 10' })
  // 컴팩트 문구: 버튼 넷(일반 · 긴 세션 이어가기 · 마무리 · 직접). 직접을 고르면 입력칸이 열리고, 비어 있으면 일반 문구대로
  expect(await pane.find({ key: 'tidy-thorough', text: '긴 세션 이어가기' })).not.toBe(undefined)
  expect(await pane.find({ key: 'tidy-light', text: '마무리' })).not.toBe(undefined)
  expect(await pane.find({ key: 'tidy-input' })).toBe(undefined)
  await pane.press({ key: 'tidy-light' })
  expect(store.get('settings')).toMatchObject({ tidy: 'light' })
  expect(await pane.find({ text: /^이미 다 저장했거나/ })).not.toBe(undefined)
  // 누르면 일어나는 일은 단계로(② 저장 · ③ 답만 문구마다 다르다), 보내는 글 원문은 접혀 있다가 누르면 펼친다
  expect(await pane.find({ text: '저장 안 함' })).not.toBe(undefined)
  expect(await pane.find({ text: '이어서 할 일 3~5줄' })).not.toBe(undefined)
  expect(await pane.find({ text: '1) 파일에는 아무것도 남기지 마세요.' })).toBe(undefined)
  await pane.press({ key: 'tidy-raw' })
  expect(await pane.find({ text: '1) 파일에는 아무것도 남기지 마세요.' })).not.toBe(undefined)
  await pane.press({ key: 'tidy-raw' })
  expect(await pane.find({ text: '1) 파일에는 아무것도 남기지 마세요.' })).toBe(undefined)
  await pane.press({ key: 'tidy-thorough' })
  expect(await pane.find({ text: '이어서 할 일 5~10줄과 주의할 점' })).not.toBe(undefined)
  await pane.press({ key: 'tidy-custom' })
  expect(store.get('settings')).toMatchObject({ tidy: 'custom', tidyCustom: '' })
  expect(await pane.find({ key: 'tidy-input' })).not.toBe(undefined)
  // 비어 있으면 일반 문구를 보낸다 — 직접은 원문 상자를 늘 펼친다(접기 버튼 없음), 상자도 일반 문구
  expect(await pane.find({ text: /비어 있으면 일반 문구를 보냅니다/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'tidy-raw' })).toBe(undefined)
  expect(await pane.find({ text: /^1\) 이 세션에서 정해진 것/ })).not.toBe(undefined)
  // 치는 중인 글은 화면을 다시 그려도 칸에 남는다(Enter 전)
  await pane.input({ key: 'tidy-input', text: '결정 로그만', kind: 'change' })
  await $.command.run({ command: 'easy-compact', args: '' })
  expect((await pane.find({ key: 'tidy-input' }))?.props?.value).toBe('결정 로그만')
  // Enter 로 저장 — 명령(문구 <글>)과 같은 값
  await pane.input({ key: 'tidy-input', text: '결정 로그만 남기고 이어서 할 일 두 줄' })
  expect(store.get('settings')).toMatchObject({ tidy: 'custom', tidyCustom: '결정 로그만 남기고 이어서 할 일 두 줄' })
  // 아래 상자에 보내는 글 전체가 그대로 보인다: 앞(손익 · 손해 판단) · 쓴 글 · 끝([컴팩트 진행]) · 이어서 /compact 지시
  expect(await pane.find({ text: '결정 로그만 남기고 이어서 할 일 두 줄' })).not.toBe(undefined)
  expect(await pane.find({ text: /^\[컴팩트 준비\] 사용자가 "저장하고 컴팩트"/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^다 했으면 답 맨 끝 줄에 \[컴팩트 진행\]/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^답이 \[컴팩트 진행\]으로 끝나면: \/compact / })).not.toBe(undefined)
  expect(await pane.find({ text: /늘 붙음/ })).toBe(undefined)
  expect(await pane.find({ text: /^명령으로도/ })).toBe(undefined)

  // 정리 후 컴팩트: 직접 쓴 글이 가운데, 손해 판단과 [컴팩트 진행] 표시는 mod 가 앞뒤에
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'compact' })
  // 확인창에서 바로 고른다(설정 탭과 같은 값 — 다음 컴팩트에도 그대로). 직접은 쓴 글이 있을 때만 보인다
  expect(await band.find({ key: 'pick-custom', text: '✓ 직접' })).not.toBe(undefined)
  expect(await band.find({ text: '칸에 쓴 글대로' })).not.toBe(undefined)
  await band.press({ key: 'pick-light' })
  expect(store.get('settings')).toMatchObject({ tidy: 'light' })
  expect(await band.find({ key: 'pick-light', text: '✓ 마무리' })).not.toBe(undefined)
  expect(await band.find({ text: '저장 안 함' })).not.toBe(undefined)
  expect(await band.find({ key: 'compact-tidy' })).not.toBe(undefined)
  await band.press({ key: 'pick-custom' })
  expect(store.get('settings')).toMatchObject({ tidy: 'custom', tidyCustom: '결정 로그만 남기고 이어서 할 일 두 줄' })
  await band.press({ key: 'compact-tidy' })
  expect(submitted[0]).toContain('결정 로그만 남기고 이어서 할 일 두 줄')
  expect(submitted[0]).toContain('[컴팩트 보류]')
  expect(submitted[0]).toContain('[컴팩트 진행]')

  // 다른 테스트가 같은 모듈을 쓸 수 있으니 기본으로 되돌린다
  await $.command.run({ command: 'easy-compact', args: 'set 권장 최적' })
  await $.command.run({ command: 'easy-compact', args: 'set 캐시 10' })
})

test('비용 패널 컨텍스트 아래: 흐름 그래프와 컴팩트 효과, 기록이 없을 땐 빈 자리 안내', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const at = (min: number) => new Date(Date.parse('2026-10-10T12:00:00Z') + min * 60_000).toISOString()
  // write = 캐시에서 못 읽고 새로 쓴 몫(컴팩트 뒤 첫 요청이면 그 + 입력 10 이 요약)
  const asst = (id: string, ctx: number, min: number, write = 0) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: at(min),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10 - write, cache_creation_input_tokens: write } },
    })
  let transcript = ''
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: transcript }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 120_000, window: 1_000_000, percent: 12 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))

  // 기록이 비었으면: 그래프 대신 언제 채워지는지
  await $.command.run({ command: 'easy-compact', args: '' })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  // 흐름 그래프 · 컴팩트 효과는 컴팩트 카드 안에 늘 펼쳐 있다 — 따로 접는 버튼은 없다(카드째 접는다)
  expect(await pane.find({ key: 'flow-toggle' })).toBe(undefined)
  expect(await pane.find({ text: '컨텍스트 흐름' })).not.toBe(undefined)
  expect(await pane.find({ text: /요청이 두 번 넘게 쌓이면/ })).not.toBe(undefined)

  // 기록이 있으면: 그래프 + 컴팩트 효과. 컴팩트 뒤 첫 요청이 캐시가 식은 뒤(77분 뒤)라 요약을 못 잰다
  transcript = [
    asst('a', 300_000, 1),
    asst('b', 590_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } }),
    asst('c', 94_000, 80),
    asst('d', 120_000, 81),
  ].join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /요청 \d+회 · 컴팩트 1회/ })).not.toBe(undefined)
  expect(await pane.find({ type: 'Svg' })).not.toBe(undefined)
  expect(await pane.find({ text: '컴팩트 효과' })).not.toBe(undefined)
  expect(await pane.find({ text: '추정' })).not.toBe(undefined)
  expect(await pane.find({ text: /본전까지 요청/ })).not.toBe(undefined)
  // 마지막 컴팩트가 아직 본전 전이면 "손해" 가 아니라 "회수중" — 4분 전 컴팩트가 잘못 한 것처럼 읽혔다. 끝난 셈이 없으니 총계도 없다
  // 왼쪽 칸은 좁아 "회수중", 무엇을 되찾는지는 아래 줄 "컴팩트 비용 회수중 ~$…"
  expect(await pane.find({ text: '회수중' })).not.toBe(undefined)
  expect(await pane.find({ text: /컴팩트 비용 회수중 ~\$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^손해 \$/ })).toBe(undefined)
  expect(await pane.find({ text: /^총 / })).toBe(undefined)
  expect(await pane.find({ text: /왼쪽 = / })).toBe(undefined)
  expect(await pane.find({ text: / · 안 했으면 / })).not.toBe(undefined)
  // 컴팩트 시점: 지금 컨텍스트(12만)가 적용 중인 구간(처음 설치 값 20만 ~ 25만)의 어디쯤인지 — 상태 말 · 다음 자리까지 남은 양 ·
  // 막대(SVG — 선 · 이름은 flow 테스트에서). 예전 "100% = 컴팩트 기본 비용" 게이지는 고른 구간과 따로 놀았다
  expect(await pane.find({ type: 'Text', text: '컴팩트 시점' })).not.toBe(undefined)
  expect(await pane.find({ text: '● 여유' })).not.toBe(undefined)
  expect(await pane.find({ text: /^200k부터 컴팩트하기 좋은 때 · 80k 남음$/ })).not.toBe(undefined)
  expect(String((await pane.findAll({ type: 'Svg' })).map(s => s.props.alt).find(a => /^컴팩트 시점/.test(String(a))))).toMatch(/^컴팩트 시점 — 지금 120k, 여유/)
  expect(await pane.find({ text: /컴팩트 기본 비용|^100%/ })).toBe(undefined)
  // 미룬 비용은 숫자 한 줄 — 지난 구간과 견줌도 그 줄에
  expect(await pane.find({ text: /^ — 컴팩트했다면 안 냈을 읽기 비용 · 요청마다 \+\$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^ · 지난 구간 \$/ })).not.toBe(undefined)
  // 범례 색 이름이 곡선 색과 같다(예전엔 "초록" 인데 곡선은 파랑)
  expect(await pane.find({ text: '초록' })).toBe(undefined)
  // 상주(컴팩트해도 남는 크기): 맨 위 컨텍스트 막대 범례(앞칸 남는 몫 · 뒤칸 대화) — 요약을 못 쟀고 기록 첫 요청(30만)이 직후
  // 크기보다 커서 기본 적재와 컴팩트 요약을 못 가른다
  expect(await pane.find({ text: '상주 94k' })).not.toBe(undefined)
  expect(await pane.find({ text: '대화 26k' })).not.toBe(undefined)
  // 컴팩트 판단은 컴팩트 카드의 한 줄만: 12만 → 9.4만은 줄어드는 게 거의 없다. "지금 요청 1회 · 컴팩트하면" 줄은 지금 카드의
  // "다음 요청" 과 겹쳐 뺐다
  expect(await pane.find({ text: /아낄 게 거의 없음 — 지금 컴팩트하면 손해/ })).not.toBe(undefined)
  expect(await pane.find({ text: / · 컴팩트하면 ~?\$0\.02/ })).toBe(undefined)
  expect(await pane.find({ text: /\d배$/ })).toBe(undefined)
  expect(await pane.find({ text: /처음부터 있던/ })).toBe(undefined)
  expect(await pane.find({ text: /^\(요약 \d/ })).toBe(undefined)
  expect(await pane.find({ text: '쌓인 요약' })).toBe(undefined)

  // 요약 = 컴팩트 뒤 첫 요청이 새로 쓴 몫(3.4만), 기본 적재 = 직후 − 요약 — 컴팩트 줄 옆에도
  transcript = [
    asst('z', 60_000, 0),
    asst('a', 300_000, 1),
    asst('b', 590_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } }),
    asst('c', 94_000, 4, 33_990),
    asst('d', 120_000, 5),
  ].join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  // 남는 몫을 두 색으로 가른다: 기본 적재(처음부터 있던 시스템 · 도구 · 메모리) · 컴팩트 요약(공식 이름 Compact summary)
  expect(await pane.find({ text: '기본 적재 60k' })).not.toBe(undefined)
  expect(await pane.find({ text: '컴팩트 요약 34k' })).not.toBe(undefined)
  // 직후 크기 안에 든 요약 — " · 요약 34k" 는 따로 더 있는 것처럼 읽혔다
  expect(await pane.find({ text: '(요약 34k 포함)' })).not.toBe(undefined)

  // 컴팩트 둘: 앞 것은 다음 컴팩트까지 31회 아껴 끝난 이득, 뒤 것은 회수중 — 제목 옆 총계는 끝난 셈만
  const between = Array.from({ length: 30 }, (_, i) => asst(`m${i}`, 100_000, 5 + i))
  transcript = [
    asst('a', 300_000, 1),
    asst('b', 590_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } }),
    asst('c', 94_000, 4),
    ...between,
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(40), compactMetadata: { trigger: 'manual', preTokens: 200_000 } }),
    asst('e', 90_000, 41),
    asst('f', 95_000, 42),
  ].join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /^총 이득 \$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^이득 \$/ })).not.toBe(undefined)
  expect(await pane.find({ text: '회수중' })).not.toBe(undefined)

  // 컴팩트 직후(요청 한 번): 더 읽은 값이 0 이어도 미룬 비용 줄은 남는다(칸째 사라져 안 보였다)
  const boundary = JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } })
  transcript = [asst('z', 60_000, 0), asst('a', 300_000, 1), asst('b', 590_000, 2), boundary, asst('c', 94_000, 4)].join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ type: 'Text', text: '컴팩트 시점' })).not.toBe(undefined)
  expect(await pane.find({ text: / — 방금 컴팩트해 아직 없습니다/ })).not.toBe(undefined)

  // 컴팩트하고 아직 요청 전: 이 세션에서 잰 값이 없어 남는 크기는 추정(~)
  transcript = [asst('z', 60_000, 0), asst('a', 300_000, 1), asst('b', 590_000, 2), boundary].join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /^상주 ~/ })).not.toBe(undefined)
  expect(await pane.find({ text: / \(추정\)/ })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '컴팩트 시점' })).not.toBe(undefined)

  // 미룬 비용이 컴팩트 한 번 값을 한참 넘어도 적용 중인 구간(처음 설치 값 20만 ~ 25만) 아래면 "여유" — 예전 게이지는 그
  // 값(비용만 본 최적)으로 색을 정해 고른 구간 아래인데도 빨강 "컴팩트할 때" 였다
  const longWait = [asst('z', 60_000, 0), asst('a', 300_000, 1), asst('b', 590_000, 2), boundary, asst('c', 94_000, 4)]
  for (let k = 0; k < 40; k++) longWait.push(asst(`w${k}`, 190_000, 5 + k))
  transcript = longWait.join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: '● 여유' })).not.toBe(undefined)
  expect(await pane.find({ text: '200k부터 컴팩트하기 좋은 때 · 10k 남음' })).not.toBe(undefined)
  expect(await pane.find({ text: /● 컴팩트할 때|● 컴팩트 늦어짐/ })).toBe(undefined)
  // 그래프 단추는 컴팩트 횟수가 아니라 질문 수로 — 컴팩트가 7번이어도 질문 기록이 없으면 다 그린다
  const cut = (min: number) => JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(min), compactMetadata: { trigger: 'manual', preTokens: 300_000 } })
  const many = [asst('z', 60_000, 0)]
  for (let k = 0; k < 7; k++) many.push(asst(`u${k}`, 300_000, 1 + k * 5), cut(2 + k * 5), asst(`v${k}`, 90_000, 3 + k * 5))
  transcript = many.join('\n')
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /^요청 15회 · 컴팩트 7회/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'flow-recent' })).toBe(undefined)
})

test('설정 탭은 세션마다 따로: 탭을 바꿔도 모든 세션이 따라가는 패널 화면 값은 그대로', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 200_000, window: 1_000_000, percent: 20 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ key: 'cmp-mode' })).toBe(undefined)
  const shared = JSON.stringify(store.get('pane'))
  await pane.press({ key: 'pane-settings' })
  await openSettings(pane)
  expect(await pane.find({ key: 'cmp-mode' })).not.toBe(undefined)
  expect(await pane.find({ text: '바꾸면 모든 세션에 바로 적용됩니다.' })).not.toBe(undefined)
  // 패널 화면 값($.store 'pane')은 모든 세션이 따라 연다 — 설정 탭을 거기 두면 다른 세션 패널도 설정으로 바뀐다
  expect(JSON.stringify(store.get('pane'))).toBe(shared)
  await pane.press({ key: 'pane-usage' })
  expect(await pane.find({ key: 'cmp-mode' })).toBe(undefined)
  // 범례엔 설정을 펼치는 버튼이 없다(탭으로 옮겼다)
  expect(await pane.find({ key: 'open-settings' })).toBe(undefined)
})

test('세션 한도 줄은 계정에 따라 저절로: 엔진이 한도를 주면(구독) 보이고, 안 주면(API 키) 없다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  let limits: { kind: string; percentUsed: number; source: string }[] = []
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: limits, cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))

  // API 키 세션: 엔진이 한도를 안 준다 → 한도 줄 없음, 비용 줄(요청당 · 컨텍스트 · 구간 · 캐시)이 창 버튼과 같은 맨 윗줄로 —
  // 예전엔 빈 윗줄을 남겨 칸이 비어 보였다
  await $.command.run({ command: 'easy-compact', args: '' })
  const api = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await api.find({ text: '5시간' })).toBe(undefined)
  expect(await api.find({ text: '요청당 ' })).not.toBe(undefined)
  const top = JSON.stringify(await api.find({ key: 'b-r1' }))
  expect(top).toContain('요청당 ')
  expect(top).toContain('"key":"band-close"')
  expect(await api.find({ key: 'b-r2' })).toBe(undefined)

  // 구독 세션: 5시간 · 7일이 오면 그 줄이 맨 위, 비용 줄은 둘째 줄
  limits = [
    { kind: 'five_hour', percentUsed: 10, source: 'test' },
    { kind: 'seven_day', percentUsed: 21, source: 'test' },
  ]
  await $.command.run({ command: 'easy-compact', args: '' })
  const sub = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await sub.find({ text: '5시간' })).not.toBe(undefined)
  expect(JSON.stringify(await sub.find({ key: 'b-r1' }))).not.toContain('요청당 ')
  expect(JSON.stringify(await sub.find({ key: 'b-r2' }))).toContain('요청당 ')
})

test('확인창: 연 자리(오른쪽 컴팩트 버튼)를 다시 누르면 닫힌다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const ui = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await ui.press({ key: 'compact' })
  expect(await ui.find({ key: 'compact-tidy' })).not.toBe(undefined)
  await ui.press({ key: 'compact-close' })
  expect(await ui.find({ key: 'compact-tidy' })).toBe(undefined)
  expect(await ui.find({ key: 'compact' })).not.toBe(undefined)
})

test('4 MiB 넘는 세션 기록은 node 추출로 읽고, node 가 실패하면 그 까닭을 한 줄로', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const ran: string[][] = []
  let nodeOk = true
  let hasNode = true
  const at = (min: number) => Date.parse('2026-10-10T12:00:00Z') + min * 60_000
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => {
    throw new Error('over 4 MiB')
  })
  on('fs.stat', async () => ({ value: { kind: 'file', size: 10 * 1024 * 1024, mtimeMs: Date.now(), isLink: false } }))
  on('process.run', async (_$, e) => {
    ran.push(e.argv)
    if (!hasNode) throw new Error('spawn node ENOENT')
    return nodeOk
      ? {
          value: {
            exitCode: 0,
            stdout: [`p ${at(1)} 10 100 299990 0 claude-opus-5-5`, `c ${at(2)} manual 596000`, `p ${at(3)} 10 100 93990 0 claude-opus-5-5`].join('\n'),
            stderr: '',
          },
        }
      : { value: { exitCode: 1, stdout: '', stderr: 'node 없음' } }
  })
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 94_000, window: 1_000_000, percent: 9 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))

  await $.command.run({ command: 'easy-compact', args: '' })
  expect(ran.some(argv => argv[0] === 'node' && argv[1]!.endsWith('tools/scan-transcript.mjs'))).toBe(true)
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  // 흐름 그래프는 컴팩트 카드 안에 처음부터 펼쳐 있다
  expect(await pane.find({ text: /요청 2회 · 컴팩트 1회/ })).not.toBe(undefined)

  nodeOk = false
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /앞 구간을 못 읽어 지금부터 그립니다/ })).not.toBe(undefined)
  // node 가 아예 없으면(띄우지도 못함 — 데스크톱만 쓰는 맥 등) 깔면 된다고 알린다
  hasNode = false
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await pane.find({ text: /node 가 있어야 앞 구간을 읽습니다 — Node\.js 14\.8 이상을 깔고 앱을 다시 켜세요/ })).not.toBe(undefined)
})

test('컴팩트 직후 첫 요청 전: 엔진 값이 컴팩트 전 그대로여도 "권장" 대신 추정값, 첫 요청이 재면 바로 실제 값', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const at = (min: number) => new Date(Date.parse('2026-10-11T12:00:00Z') + min * 60_000).toISOString()
  const asst = (id: string, ctx: number, min: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: at(min),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0 } },
    })
  // 기록이 세션 처음부터: 첫 요청 64k = 기본 적재. 컴팩트 직후 추정 = 기본 적재 + 요약(아직 못 잼 — 가정 30k) = 94k
  const transcript = [
    asst('z', 64_000, 0),
    asst('a', 300_000, 1),
    asst('b', 536_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 536_000 } }),
  ].join('\n')
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: transcript }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-after' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  // 엔진은 컴팩트 뒤에도 마지막 응답 기준 — 컴팩트 전 크기 그대로
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 536_000, window: 1_000_000, percent: 54 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 95_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /권장/ })).toBe(undefined)
  expect(await band.find({ text: /~94k/ })).not.toBe(undefined)
  expect(await band.find({ text: /컴팩트 직후/ })).not.toBe(undefined)

  // 첫 요청이 재면 턴 끝을 기다리지 않고 실제 값으로
  await $.turn.start({ text: '다음', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만 필요하다
  }
  expect(await band.find({ text: /컴팩트 직후/ })).toBe(undefined)
  expect(await band.find({ text: /컨텍스트 95k/ })).not.toBe(undefined)
  expect(store.get('afterCompactTokens')).toBe(undefined) // 버튼 컴팩트가 아니라 기록에서 읽은 컴팩트 — 실측 저장은 mod 가 본 컴팩트만

  // 턴이 끝나 엔진 값(여전히 536k)을 다시 재도 컨텍스트는 우리가 잰 마지막 요청 값 — 띠 · 그래프 · 질문별 비용이 같은 값
  await $.turn.complete({ answer: '끝', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  expect(await band.find({ text: /컨텍스트 95k/ })).not.toBe(undefined)
  expect(await band.find({ text: /권장/ })).toBe(undefined)
})

test('식은 캐시 · 큰 컨텍스트: 띠가 "바로 컴팩트 권장", 확인창은 정리 없이 바로 컴팩트(이어서 할 일 보존 지시)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const ran: string[] = []
  on('command.run', { command: 'compact' }, async (_$, e) => {
    ran.push(`${e.command} ${e.args ?? ''}`)
    return { text: 'compacted' }
  })
  on('fs.list', async () => ({ value: [] }))
  // 마지막 활동이 2시간 전 — 1시간 캐시가 식었다
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now() - 2 * 3600_000, isLink: false } }))
  on('session.id', async () => ({ value: 't-cold' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 500_000, window: 1_000_000, percent: 50 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  // 기록을 못 읽어 기본 적재를 모른다 — 이 PC 에서 잰 지난 컴팩트 직후 크기(94k)를 쓴다
  on('store.get', async (_$, e) => ({ value: e.key === 'afterCompactTokens' ? 94_000 : undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))

  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /바로 컴팩트 권장/ })).not.toBe(undefined)
  // 띠 줄엔 차이 하나를 말로: 이어 가기 50만 × $8 = $4.00 − 컴팩트(50만 × $4 + 출력 $0.20 + 9.4만 × $8 ≈ $2.95) ≈ $1.05 이득
  // 금액엔 "~" 가 없다 — 빨간 "~$" 가 "−$" 로 읽혔다
  expect(await band.find({ text: '$4.00 소비' })).not.toBe(undefined)
  expect(await band.find({ text: /컴팩트하면/ })).not.toBe(undefined)
  expect(await band.find({ text: '$1.05 이득' })).not.toBe(undefined)
  // 쌈/비쌈 글자는 없다 — 한 글자 차라 둘 다 비싸다로 읽혔다
  expect(await band.find({ text: /비쌈|더 쌈/ })).toBe(undefined)
  await band.press({ key: 'compact' })
  expect(await band.find({ text: /캐시가 만료됐습니다 — 바로 컴팩트할까요/ })).not.toBe(undefined)
  expect(await band.find({ text: '~$4.00' })).not.toBe(undefined)
  await band.press({ key: 'compact-yes' })
  expect(ran.length).toBe(1)
  expect(ran[0]).toContain('이어서 할 일')

  // 최적을 낼 수 있으면(직후 94k · Opus 5.5) 비용표에 "최적 대비"(이 세션 값)와 비용이 가장 적은 줄에 ★ — 구간은
  // 사람이 표에서 고른 값(처음 설치 값 20만 ~ 25만) 그대로. 한 점(최적)은 컴팩트마다 움직여 "이게 맞나" 싶었다.
  // 띠마다 "시작 ~ 끝" 의 최적 대비
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  await openSettings(pane)
  expect(await pane.find({ type: 'Text', text: '구간 200k ~ 250k' })).not.toBe(undefined)
  // 데스크톱은 모든 화면 공통에 질문 강조(기본 켬)
  expect(await pane.find({ key: 'hover-on', text: '✓ 마우스 올리면' })).not.toBe(undefined)
  // ★ 최적(금색) — 흐린 ★ 하나는 눈에 안 띄었다. 컴팩트 요청이 대화 캐시를 읽으니(실측 98.6%) 컴팩트 한 번이
  // 싸져 최적(약 22만)은 20만 ~ 25만 띠에 — 0.3.x 는 정가 입력으로 세 약 26만이었다
  expect((await pane.find({ type: 'Text', text: '★ 최적' }))?.props.color).toBe('#f5b301')
  expect(await pane.find({ text: /^(0|\+\d+)~(0|\+\d+)%$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /컴팩트 한 번 \$0\.57/ })).not.toBe(undefined)
  // 처음 설치 값(20만 ~ 25만)엔 최적이 들어 있어 추천은 맞다는 말만(버튼 없음) — 0.3.x 의 25만 ~ 30만은 이제 최적 위
  expect(await pane.find({ text: /^고른 구간에 최적\(220k\)이 있습니다$/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-recommend-pick' })).toBe(undefined)
  // 다른 띠(15만 ~ 20만)를 고르면 아래 추천에 [◉ 이 구간 고르기] — 고르기 표시를 단 버튼("이 구간으로" 만으론 버튼처럼 안 생겼다)
  await pane.press({ key: 'cmp-band-150000' })
  expect(await pane.find({ text: '구간 200k ~ 250k → 구간 150k ~ 200k 로 바꿀까요?' })).not.toBe(undefined)
  expect(await pane.find({ text: '★ 추천' })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^200k ~ 250k$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^최적\(220k\)이 든 구간$/ })).not.toBe(undefined)
  expect((await pane.find({ key: 'cmp-recommend-pick' }))?.props.label).toBe('◉ 이 구간 고르기')
  // 최적 대비 색(구간 시작 기준): +50% 넘는 띠는 빨강 · "비추천", 표 아래 한 줄
  expect(await pane.find({ type: 'Text', text: '비추천' })).not.toBe(undefined)
  expect((await pane.findAll({ type: 'Text', text: /^\+\d+~\+\d+%$/ })).some(t => t.props.color === 'red')).toBe(true)
  expect((await pane.findAll({ type: 'Text', text: /^\+\d+~\+\d+%$/ })).some(t => t.props.color === 'yellow')).toBe(true)
  // 최적 위는 "N 이상", 최적 아래(너무 잦음)는 띠 이름 — 첫 비추천 띠만 보고 "100k 이상" 이라 적어 다 비추천으로 읽혔다
  expect(await pane.find({ text: /^100k ~ 150k · 700k 이상 — 최적보다 요청당 \+50% 넘게/ })).not.toBe(undefined)
  expect((await pane.findAll({ type: 'Text', text: '비추천' })).some(t => t.props.color === 'red')).toBe(true)
  // 추천을 고르면 최적 띠(= 적용 중)로 돌아가 바꿀 것이 없다
  await pane.press({ key: 'cmp-recommend-pick' })
  expect((await pane.find({ key: 'cmp-band-200000' }))?.props.variant).toBe('primary')
  expect(await pane.find({ text: /^고른 구간에 최적\(\d+k\)이 있습니다$/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-recommend-pick' })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-apply' })).toBe(undefined)
  expect(await pane.find({ text: /^\+\d+~\+\d+%$/ })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^500k$/ }))?.props.color).toBe('red')
  // 설명은 이름 칸 + 짧은 풀이 한 줄씩 — 색 문턱 글자에 그 색
  expect(await pane.find({ text: /^줄 앞 크기 구간을 누르면/ })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-range-how', text: /최적보다/ })).not.toBe(undefined)
  expect(await pane.find({ text: '예상 최적보다 요청당 더 드는 비율 ·' })).not.toBe(undefined)
  expect(await pane.find({ text: /색 문턱은 가정/ })).toBe(undefined)
  // % 만으론 뜻을 몰랐다 — 판정 말(좋음 · 보통 · 비추천)에 그 색, "쌈 · 비쌈" 은 한 글자 차라 쓰지 않는다
  expect((await pane.find({ type: 'Text', text: '+10%까지 좋음' }))?.props.color).toBe('green')
  expect((await pane.find({ type: 'Text', text: '+50%까지 보통' }))?.props.color).toBe('yellow')
  expect((await pane.find({ type: 'Text', text: '넘으면 비추천' }))?.props.color).toBe('red')
  expect(await pane.find({ text: '최적보다 더 듦' })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^좋음$/ }))?.props.color).toBe('green')
  expect((await pane.find({ type: 'Text', text: /^보통$/ }))?.props.color).toBe('yellow')
  expect(await pane.find({ text: /쌈/ })).toBe(undefined)
  expect(await pane.find({ text: '200k ~ 250k(처음 설치 값)' })).not.toBe(undefined)
  expect(await pane.find({ text: /^Opus 5\.5 · 컴팩트 후 94k · 요청당 \+\d+k(\(가정\))? · 컴팩트 한 번 \$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /계산에 쓴 값|컴팩트 기본 비용\(저장 턴 포함\)/ })).toBe(undefined)
  // 직접 지정의 비추천 크기(90만, 최적보다 +50% 넘게)는 알리기만 하고 적용은 된다
  await pane.press({ key: 'cmp-manual' })
  await pane.input({ key: 'cmp-size-input', text: '90만' })
  expect(await pane.find({ type: 'Text', text: /^\+\d+% 더 듦$/ })).not.toBe(undefined)
  expect((await pane.find({ type: 'Text', text: '· 비추천(적용은 됩니다)' }))?.props.color).toBe('red')
  expect(await pane.find({ text: '구간 200k ~ 250k → 직접 지정 900k 로 바꿀까요?' })).not.toBe(undefined)
  // (이 테스트의 저장소는 값을 남기지 않아 적용 뒤 맨 위 줄은 그대로 — 적용이 막히지 않고 확인창이 닫히는 것까지)
  await pane.press({ key: 'cmp-apply' })
  expect(await pane.find({ key: 'cmp-apply' })).toBe(undefined)
})

test('구간 방식 띠: 구간 안이면 🟡 "컴팩트하기 좋은 때", 끝을 지나면 🔴 "컴팩트 늦어짐"', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  let tokens = 0
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-range' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens, window: 1_000_000, percent: tokens / 10_000 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  // 처음 설치 값 구간 20만 ~ 25만
  const start = 200_000
  const end = 250_000

  tokens = start + 10_000
  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // 상태는 버튼 글 · 깜빡이는 점 · 강조 버튼으로 — 🗜 는 버튼 밖에 늘 파랗게(상태 그림 🟡 · 🔴 는 뺐다)
  expect(await band.find({ key: 'compact', text: '컴팩트하기 좋은 때' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"color":"#4c9be8"')
  expect(await band.find({ text: /🟡|🔴/ })).toBe(undefined)
  expect(await band.find({ text: /컴팩트 늦어짐|컴팩트 권장/ })).toBe(undefined)

  tokens = end + 50_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ key: 'compact', text: '컴팩트 늦어짐' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"color":"#4c9be8"')

  // 사용량 패널: 컨텍스트 막대 위 노랑 · 빨강 눈금에 이름 — 무엇인지 설명이 없었다
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  const k = (n: number) => `${Math.round(n / 1000)}k`
  expect(await pane.find({ text: `${k(start)} 컴팩트하기 좋은 때` })).not.toBe(undefined)
  expect(await pane.find({ text: `${k(end)} 컴팩트 늦어짐` })).not.toBe(undefined)
})

test('식은 캐시인데 바로 컴팩트가 더 비싼 크기(20만)면 강조 · 권장도, 바로 컴팩트 권장도 띄우지 않는다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const submitted: string[] = []
  on('prompt.submit', async (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now() - 2 * 3600_000, isLink: false } }))
  on('session.id', async () => ({ value: 't-cold-small' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 200_000, window: 1_000_000, percent: 20 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  // 기록을 못 읽어 기본 적재를 모른다 — 이 PC 에서 잰 지난 컴팩트 직후 크기(94k)를 쓴다
  on('store.get', async (_$, e) => ({ value: e.key === 'afterCompactTokens' ? 94_000 : undefined }))
  on('store.set', async () => ({ value: undefined }))

  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // 기본 프리셋이면 20만은 강조(🟡) — 식은 캐시에선 정리가 가장 비싸 띄우지 않는다
  expect(await band.find({ text: /🟡/ })).toBe(undefined)
  expect(await band.find({ text: /바로 컴팩트 권장/ })).toBe(undefined)
  // 권하지 않는 동안 🗜 는 회색(데스크톱은 버튼 흐림을 안 그린다), 까닭은 툴팁 — 누르면 확인창은 그대로.
  // 버튼의 dimColor 는 터미널에서 흐리게 보인다
  const button = await band.find({ key: 'compact', text: '이지 컴팩트' })
  expect(button?.props.variant).toBe('secondary')
  expect(button?.props.dimColor).toBe(true)
  // 툴팁은 권하지 않는 까닭 그대로 — "아직 컴팩트할 때가 아님 · 구간" 은 구간 안이어도 떠 카드의 "손해" 와 엇갈렸다
  expect(await band.find({ text: '캐시 만료 · 지금 바로 컴팩트하면 ~$0.15 더 듦 — 그냥 이어 가는 편이 쌈' })).not.toBe(undefined)
  expect(await band.find({ text: /^아직 컴팩트할 때가 아님/ })).toBe(undefined)
  const icon = JSON.stringify(await band.find({ key: 'compact-icon' }))
  expect(icon).toContain('"dimColor":true')
  expect(icon).not.toContain('#4c9be8')
  // 왜 안 띄우는지 띠 줄에: 이어 가기 20만 × $8 = $1.60 < 컴팩트 20만 × $4 + 출력 $0.20 + 9.4만 × $8 ≈ $1.75 → $0.15 손해
  expect(await band.find({ text: '$1.60 소비' })).not.toBe(undefined)
  expect(await band.find({ text: '$0.15 손해' })).not.toBe(undefined)
  // 차이엔 말과 같이 색 — 손해 빨강 · 이득 초록(드는 값엔 색 없음)
  expect((await band.find({ type: 'Text', text: /^\$0\.15 손해$/ }))?.props.color).toBe('red')
  const spend = await band.find({ type: 'Text', text: /^\$1\.60 소비$/ })
  expect(spend).not.toBe(undefined)
  expect(spend?.props.color).toBe(undefined)
  expect(await band.find({ text: /이득|비쌈|더 쌈/ })).toBe(undefined)
  // 흐린 버튼도 누르면 확인 카드 — 식은 캐시면 손익과 상관없이 캐시 만료 카드(주 버튼 ▶ 바로 컴팩트). 예전엔 손해인 크기면
  // 보통 카드(▶ 저장하고 컴팩트)라 회사 세션에서 저장 질문이 전체를 다시 써 $0.43 이 들었다. 카드도 띠와 같은 셈 · 같은 말
  // (예전엔 다시 쓰기 몫 9.4만 × $8 = $0.75 만 초록으로 보여 띠의 "손해" 와 거꾸로 읽혔다)
  await band.press({ key: 'compact' })
  expect(await band.find({ key: 'confirm' })).toBe(undefined)
  const card = JSON.stringify(await band.find({ key: 'confirm-cold' }))
  expect(card).toContain('캐시가 만료됐습니다 — 지금은 컴팩트하지 마세요')
  expect(card).toContain('바로 컴팩트하면 ')
  expect(card).toContain('$1.75')
  expect(card).toContain('~$0.15 손해')
  expect(card).toContain(' · 그냥 이어 가는 편이 쌈')
  expect(card).toContain('작업을 이어 가세요')
  expect(card).toContain('다음 질문이 캐시를 다시 데웁니다')
  expect(card).not.toContain('$0.75')
  expect(card).not.toContain('이득')
  // 권하지 않는 상태에서 연 확인창이면 바 · 카드 제목 아이콘도 회색 그대로(회사 세션: 눌렀더니 파랑으로 바뀌어 권하는 듯 보였다)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"dimColor":true')
  const titleIcon = await band.find({ type: 'Text', text: '🧊' })
  expect(titleIcon?.props.dimColor).toBe(true)
  expect(titleIcon?.props.color).toBe(undefined)
  // 손해면 컴팩트 버튼(저장하고 · 바로)이 없고 확인 하나 — 예전엔 저장하고 컴팩트를 고르면 저장 턴이 돌았고, 식은 캐시면 프롬프트에
  // 손익이 없어 세션이 "잃을 게 없다" 며 진행했다
  expect(await band.find({ key: 'compact-tidy' })).toBe(undefined)
  expect(await band.find({ key: 'compact-yes' })).toBe(undefined)
  expect((await band.find({ key: 'compact-no' }))?.props.label).toContain('✓ 확인 · 이어 가기')
  await band.press({ key: 'compact-no' })
  expect(await band.find({ key: 'confirm-cold' })).toBe(undefined)
  expect(submitted.length).toBe(0)
})

test('질문 글: 긴 글은 패널 폭에 맞게 잘리고(…) 펼치면 줄을 바꿔 전체가 보인다 · 1000자까지 남아 60자 뒤도 보인다', async ($, on) => {
  // 두 시험(패널 폭 · 1000자)을 한 세션의 질문 둘로 합쳤다 — 준비가 같았다. 목록은 새 질문이 위(hx-0)
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-long' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '답',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  const ask = async (text: string, turnId: string) => {
    await $.turn.start({ text, turnId })
    for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: '답', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
  }

  // ① 패널 폭: 긴 질문 글은 버튼 안에서 패널 폭에 맞게 잘린다
  const long = '화면 크기에 따라 사이드 패널 글자가 잘려 보이고 창을 최대로 해도 잘려 보여서 해결이 필요해'
  await ask(long, 't1')
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 50, placement: 'dock' },
  })
  // 접힌 줄: 앞부분만, 끝에 …
  expect(await pane.find({ text: /^화면 크기에 따라.*…$/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'hx-0', text: '▸' })).not.toBe(undefined)
  expect(await pane.find({ text: /해결이 필요해/ })).toBe(undefined)
  // 펼치면 아이콘(▾) 옆 그 자리에서 전체 글이 줄을 바꿔 보이고, ▾ 를 누르면 다시 접힌다. 제목 글은 눌리지 않는다 — 열기 · 닫기는
  // 왼쪽 버튼만
  expect(await pane.find({ key: 'hxt-0' })).toBe(undefined)
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: long })).not.toBe(undefined)
  expect(await pane.find({ key: 'hx-0', text: '▾' })).not.toBe(undefined)
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: /해결이 필요해/ })).toBe(undefined)

  // ② 1000자: 100자 넘는 질문 — 끝말이 60자 뒤에 있다. 붙여넣은 글이라 앱이 <pasted_content> 로 감쌌다
  const pasted = `<pasted_content id="ab12">\n${'가나다라마바사아자차'.repeat(9)} 끝말은 여기\n</pasted_content id="ab12">`
  await ask(pasted, 't2')
  expect(await pane.find({ text: /끝말은 여기/ })).toBe(undefined)
  // 시간은 금액 밑 칸에 따로("방금"), 아래 줄은 모델부터
  expect(await pane.find({ text: '방금' })).not.toBe(undefined)
  expect(await pane.find({ text: /방금 ·/ })).toBe(undefined)
  // 읽기 · 쓰기 · 출력은 접힌 줄엔 없고 펼치면 보인다
  expect(await pane.find({ text: /읽기 \$/ })).toBe(undefined)
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: /읽기 \$0\.\d\d · 쓰기 \$/ })).not.toBe(undefined)
  // 그 아래 동작별 값은 트리 가지 — 하나뿐이면 마지막 가지 └─
  expect(await pane.find({ text: '└─' })).not.toBe(undefined)
  expect(await pane.find({ text: /끝말은 여기/ })).not.toBe(undefined)
  // 태그만 지우고 원문 그대로(📋 도 없이)
  expect(await pane.find({ text: /pasted_content/ })).toBe(undefined)
  expect(await pane.find({ text: /^가나다/ })).not.toBe(undefined)
  expect(await pane.find({ text: /📋/ })).toBe(undefined)

  // 컴팩트 판단: 10만은 컴팩트 직후(기본 9.4만)의 1.1배 — 비슷해서 아낄 게 거의 없다
  expect(await pane.find({ text: /아낄 게 거의 없음 — 지금 컴팩트하면 손해/ })).not.toBe(undefined)

  // "ⓘ 값이 어떻게 붙나요" 는 뺐다 — 숫자가 모두 효율 줄 · 비용 카드에 이미 있었다
  expect(await pane.find({ text: /값이 어떻게 붙나요/ })).toBe(undefined)
})

test('진행 중 질문: 도구 줄엔 금액이 없고, 질문별 비용 맨 위에 동작별 값 · 모델 · 노력도가 요청마다 쌓인다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-live' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('tool.call', async () => ({ result: 'ok' }))
  // 도구 줄의 엔진 기본 모양(맨 아래)
  on('ui.render', { component: 'ToolUse' }, async (_$, e) => {
    const { Text } = _$.ui.resolve(e)
    return <Text>Bash</Text>
  })
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // 요청마다 출력을 달리 해 값이 구분되게: 요청 1 = 출력 1만($0.20), 요청 2 = 출력 2만($0.40)
  let step = 0
  on('turn.step', async function* (_$, e) {
    step += 1
    await $.tool.call({ tool: 'Bash', tool_use_id: `call-${step}`, command: 'ls' })
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [{ name: 'Bash', input: { command: 'ls' } }],
      stopReason: 'tool_use',
      usage: { input_tokens: 0, output_tokens: step * 10_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })

  await $.turn.start({ text: '도구 두 번', turnId: 't1' })
  for (const index of [0, 1]) {
    for await (const _ of $.turn.step({ turnId: 't1', index, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
      // 결과만 필요하다
    }
  }
  // 도구 줄은 엔진 모양 그대로 — 금액을 붙이지 않는다
  const tool = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'ToolUse',
    props: { tool_use_id: 'call-1', tool: 'Bash', input: { command: 'ls' }, isRunning: false, isErrored: false },
  })
  expect(await tool.find({ text: '$0.20' })).toBe(undefined)

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ text: /진행 중/ })).not.toBe(undefined)
  // 아이콘 칸(끝난 질문의 ▸ 자리)에 깜빡이는 점
  expect(await pane.find({ key: 'h-live-dot' })).not.toBe(undefined)
  expect(await pane.find({ text: '$0.20' })).not.toBe(undefined)
  expect(await pane.find({ text: '$0.40' })).not.toBe(undefined)
  expect(await pane.find({ text: '$0.60' })).not.toBe(undefined)
  expect(await pane.find({ text: /Opus 5\.5 · high/ })).not.toBe(undefined)
})

test('하위 에이전트 값: 작업 중에도 띄운 질문에 더하고(에이전트마다 한 줄), 질문이 끝난 뒤 요청은 그 질문에', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-agent' }))
  // 엔진 기본 그림(시험엔 없다) — 작업 중 표시 · 답변 아래 줄이 감싸는 자리
  on('ui.render', { component: 'Spinner' }, async ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, async ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  // 저장소는 값을 기억한다 — 화면을 바꾸면 다음 설정 읽기에도 남아야 미리보기 견본을 볼 수 있다(값을 버리면 처음 설치 값 간단으로 되돌아갔다)
  const store = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('agent.spawn', async () => ({ model: 'claude-opus-5-5', agentId: 'ag1' }))
  // 메인 요청 = 출력 1만($0.20). 에이전트 요청 = 출력 1만($0.20) + 5분 캐시 쓰기 2만 × $5 = $0.10 → $0.30
  // (1시간 쓰기로 셌다면 $0.36). 에이전트 요청은 컨텍스트 크기에 안 들어간다
  on('turn.step', async function* (_$, e) {
    const isAgent = e.agentId !== undefined
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 0,
        output_tokens: 10_000,
        cache_read_input_tokens: isAgent ? 0 : 50_000,
        cache_creation_input_tokens: isAgent ? 20_000 : 0,
        model: 'claude-opus-5-5',
      },
    }
  })
  const agentStep = async (index: number) => {
    for await (const _ of $.turn.step({ turnId: 'sub', index, model: 'claude-opus-5-5', messageCount: 1, agentId: 'ag1' })) {
      // 결과만 필요하다
    }
  }

  await $.turn.start({ text: '문서 찾아 줘', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만 필요하다
  }
  await $.agent.spawn({ prompt: '공식 문서를 찾아라', description: '문서 조사', subagentType: 'Explore' })
  await agentStep(0)
  await agentStep(1)

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    // 진행 중 질문은 테두리 타일 안이라 4칸 좁다 — 70칸이면 에이전트 줄이 "…" 로 잘린다
    props: { bodyColumns: 80, placement: 'dock' },
  })
  // 진행 중 질문 = 메인 $0.21 + 에이전트 $0.60 — 에이전트는 한 줄로 합쳐 요청 수와 함께
  // 에이전트 줄엔 도는 중 · 끝남(6c) — 작업 이름보다 앞에
  expect(await pane.find({ text: /^🤖 에이전트 요청 2회 · 도는 중 · Opus 5\.5 · / })).not.toBe(undefined)
  expect(await pane.find({ text: '$0.60' })).not.toBe(undefined)
  expect(await pane.find({ text: '$0.81' })).not.toBe(undefined)
  // 컨텍스트는 메인 요청 크기 그대로(에이전트가 쓴 2만이 아니라 5만)
  expect(await pane.find({ text: /컨텍스트 50k/ })).not.toBe(undefined)
  // 요청 수는 메인 요청만
  expect(await pane.find({ text: /요청 1회/ })).not.toBe(undefined)

  // 실시간(6a): 바 질문 줄 · 작업 중 표시에 에이전트 몫을 따로 — 질문 값엔 이미 더해져 있어 얼마가 에이전트인지 안 보였다.
  // 꼴은 패널 · 답변 아래와 같게 "🤖 에이전트 1개 $ 포함"
  const working = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: { ...BAND, isWorking: true } })
  expect(await working.find({ text: ' · 🤖 에이전트 1개 $0.60 포함 · 도는 중' })).not.toBe(undefined)
  const spinner = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Spinner', props: { word: 'Working', message: null, suffix: '…', mode: 'requesting' } })
  expect(await spinner.find({ text: /^ · 🤖 에이전트 1개 \$0\.60 포함/ })).not.toBe(undefined)
  // 출력 토큰은 뺐다 — 그 자리에 🤖
  expect(await spinner.find({ text: / · 출력 / })).toBe(undefined)
  // 터미널은 그림 글자 대신 글
  const termSpinner = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'Spinner', props: { word: 'Working', message: null, suffix: '…', mode: 'requesting' } })
  expect(await termSpinner.find({ text: /^ · 에이전트 1개 \$0\.60 포함/ })).not.toBe(undefined)

  // 질문이 끝난 뒤에도 도는 백그라운드 에이전트 — 띄운 질문(t1)에 더한다. 답변 아래 줄 · 바 지난 질문 줄에 "도는 중"
  await $.turn.complete({ answer: '찾는 중입니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await agentStep(2)
  expect(await pane.find({ text: '$1.11' })).not.toBe(undefined)
  const reply = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AssistantMessage', props: { text: '찾는 중입니다', isFirstOfReply: true } })
  expect(await reply.find({ text: ' · 🤖 에이전트 1개 $0.90 포함 · 도는 중' })).not.toBe(undefined)
  // 답변 아래 줄: 데스크톱은 둥근 파란 테두리 칩, 글은 전부 파랑(금액만 굵게) — 흐린 회색 글이 답변 사이에서 안 보였다
  const chip = await reply.find({ key: 'q-cost' })
  expect(chip?.props.borderStyle).toBe('round')
  expect(chip?.props.borderColor).toBe('#4c9be8')
  // 첫 줄(q-head)은 파랑 — 흐린 것은 [▸ 자세히] 버튼 글뿐
  const headJson = JSON.stringify(await reply.find({ key: 'q-head' }))
  expect(headJson).toContain('"color":"#4c9be8"')
  expect(headJson.match(/"dimColor":true/g)?.length ?? 0).toBe(1)
  // 답변 글에 붙어 보여 한 칸 띄움. 정보량 전부(이 시험 = 자세히)면 패널 자세히의 펼친 질문처럼 분해 줄 · 동작별 값 — 처음엔 접힘,
  // 칩 끝 [▸ 자세히] 로 그 질문만 펴고 접는다. 동작 줄은 ├─ 없이 금액 + 이름
  expect(chip?.props.marginTop).toBe(1)
  expect(await reply.find({ key: 'q-detail' })).toBe(undefined)
  expect(await reply.find({ key: 'q-fold', text: '▸ 자세히' })).not.toBe(undefined)
  await reply.press({ key: 'q-fold' })
  expect(await reply.find({ key: 'q-fold', text: '▾ 접기' })).not.toBe(undefined)
  expect(await reply.find({ text: /^ - 메인 요청 \d+회 \$/ })).not.toBe(undefined)
  expect(await reply.find({ text: /^ - 🤖 에이전트 1개 · 요청 \d+회 \$0\.90$/ })).not.toBe(undefined)
  // 동작 줄은 메인 아래로 더 들여(메인 금액을 나눈 것) — 맨 위 " - " 줄만 더하면 질문 값
  expect(await reply.find({ text: /^ {5}\$\d+\.\d\d  / })).not.toBe(undefined)
  expect(await reply.find({ text: /^ - \$/ })).toBe(undefined)
  // [▸ 자세히] 는 줄지 않는 칸 안 — 첫 줄 글이 길어도 꺾이지 않는다
  expect((await reply.find({ key: 'q-fold-box' }))?.props.flexShrink).toBe(0)
  expect(JSON.stringify(await reply.find({ key: 'q-detail' }))).not.toMatch(/├─|└─/)
  await reply.press({ key: 'q-fold' })
  expect(await reply.find({ key: 'q-detail' })).toBe(undefined)
  // 질문 강조(기본 켬): 칩 · 패널 질문 줄과 한 hover 묶음인 숨은 덮개를 답변 앞(밑)에 깐다 — 시험 도구는 hover 를 넘겨주지 않아
  // 묶음 · 회색은 데스크톱 실물로 봤다(2026-10-13). 여기선 덮개 자리만. 터미널은 마우스 올림이 없어 덮개도 없다
  expect(await reply.find({ key: 'q-ans' })).not.toBe(undefined)
  expect(await reply.find({ key: 'q-glow' })).not.toBe(undefined)
  // 터미널은 테두리 없이 글만(테두리는 답마다 두 줄을 늘린다), 색은 같은 파랑
  const termReply = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AssistantMessage', props: { text: '찾는 중입니다', isFirstOfReply: true } })
  expect(await termReply.find({ key: 'q-cost' })).toBe(undefined)
  expect(await termReply.find({ key: 'q-glow' })).toBe(undefined)
  // 터미널은 칩 한 줄만(지난 대화 줄은 다시 그려지지 않는다 — 상세는 사용량 패널)
  expect(await termReply.find({ key: 'q-fold' })).toBe(undefined)
  expect(await termReply.find({ key: 'q-detail' })).toBe(undefined)
  expect(JSON.stringify(await termReply.find({ text: /이 질문/ }))).toContain('#4c9be8')
  const idle = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await idle.find({ text: ' · 🤖 에이전트 1개 $0.90 포함 · 도는 중' })).not.toBe(undefined)
  // 접힌 질문 줄에도 🤖 몫(6b)
  // 질문 줄의 에이전트는 "$ 포함" — 값 옆 🤖 $ 만으론 질문 값과의 관계가 헷갈렸다
  expect(await pane.find({ text: '🤖 에이전트 1개 $0.90 포함 · 도는 중' })).not.toBe(undefined)

  // 에이전트가 끝남(그 agentId 의 turn.complete) — 도는 중이 빠지고, 에이전트 줄은 끝남
  await $.turn.complete({ answer: '다 찾음', durationMs: 1, isAborted: false, turnId: 'sub', reason: 'answer', agentId: 'ag1' } as Parameters<typeof $.turn.complete>[0])
  expect(await reply.find({ text: ' · 🤖 에이전트 1개 $0.90 포함' })).not.toBe(undefined)
  expect(await reply.find({ text: /도는 중/ })).toBe(undefined)
  expect(await pane.find({ text: '🤖 에이전트 1개 $0.90 포함' })).not.toBe(undefined)
  // 펼치면 요금 분해가 메인 / 🤖 에이전트로(6b): 메인 = 읽기 5만 × $0.20 + 출력 1만 × $20, 에이전트 = 쓰기 6만 × $5 + 출력 3만 × $20
  await pane.press({ key: 'hx-0' })
  // 펼친 줄은 메인 · 에이전트마다 요청 수 · 금액 · 읽기 · 쓰기 · 출력
  expect(await pane.find({ text: /^메인 요청 \d+회 \$0\.21 · 읽기 \$0\.01 · 쓰기 \$0\.00 · 출력 \$0\.20$/ })).not.toBe(undefined)
  expect(await pane.find({ text: '🤖 에이전트 1개 · 요청 3회 $0.90 · 읽기 $0.00 · 쓰기 $0.30 · 출력 $0.60' })).not.toBe(undefined)
  expect(await pane.find({ text: /^🤖 에이전트 요청 3회 · 끝남 · Opus 5\.5 · / })).not.toBe(undefined)
  // 정보량 최소(간단)면 답변 아래는 칩 한 줄만
  await $.command.run({ command: 'easy-compact', args: 'screen simple' })
  expect(await reply.find({ key: 'q-cost' })).not.toBe(undefined)
  expect(await reply.find({ key: 'q-fold' })).toBe(undefined)
  expect(await reply.find({ key: 'q-detail' })).toBe(undefined)
  // 설정 화면 칸 미리보기에 답변 아래 견본(마지막 질문, 접힌 칩) — 정보량 최소면 [▸ 자세히] 없이, 전부면 흐린 [▸ 자세히]
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  // 머리말 하나("미리보기 — 이 화면을 고르면 …") 아래에 입력창 위 바 · 답변 아래 견본이 둘 다 들어 있다
  const pvText = async () => JSON.stringify(await pane.find({ key: 'screen-preview' }))
  expect(await pvText()).toContain('미리보기 — 이 화면을 고르면 이렇게 보입니다')
  expect(await pvText()).toContain('바 — 세션 채팅 입력창 위(최대 크기)')
  expect(await pvText()).toContain('질문 비용 — 세션 채팅창, Claude 답변 끝')
  // 채팅창에서 실제로 일어나는 일 그대로
  expect(await pvText()).toContain('Claude 의 답변이 끝날 때마다 그 답변 바로 아래에 붙습니다')
  expect(await pvText()).toContain('아래 견본은 이 세션 지난 질문의 값으로 그렸습니다')
  // 미리보기 전체를 흐린 테두리로 묶는다(질문 비용 견본도 미리보기인지 보이게)
  expect((await pane.find({ key: 'screen-preview' }))?.props.borderStyle).toBe('single')
  expect(await pvText()).toContain('🧾 이 질문 $1.11 · 요청 4회')
  expect(await pvText()).not.toContain('▸ 자세히')
  // 자세히(정보량 전부)면 견본에도 [▸ 자세히] — 처음엔 접힘, 누르면 견본 안에서 펼친다
  await pane.press({ key: 'screen-detail' })
  expect(await pvText()).toContain('▸ 자세히')
  expect(await pvText()).not.toContain(' - 메인 요청')
  await pane.press({ key: 'pv-fold' })
  expect(await pvText()).toContain('▾ 접기')
  expect(await pvText()).toContain(' - 메인 요청')
  await pane.press({ key: 'pv-fold' })
  expect(await pvText()).not.toContain(' - 메인 요청')
})

test('엔진 목록에 없는 갈래(워크플로우 · 엔진 자체)는 끝났다는 소식이 없어도 2분 조용하면 끝남 — "도는 중" 이 세션 내내 남았다(리뷰)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const clock = mock.clock(on, { now: Date.parse('2026-10-12T13:00:00Z') })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-quiet' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } } }))
  on('store.get', async (_$, e) => ({ value: e.key === 'settings' ? { screen: 'detail' } : undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  // 목록엔 늘 없다(워크플로우 에이전트 · 엔진 자체 갈래)
  on('agent.list', async () => ({ value: [] }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } }
  })
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: '돌려 줘', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만
  }
  for await (const _ of $.turn.step({ turnId: 'wf', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: 'wf-agent' })) {
    // 결과만
  }
  await $.turn.complete({ answer: '돌렸습니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // 막 돈 뒤엔 도는 중 — 목록에 없다고 바로 끝남으로 치지 않는다
  await clock.advance(1_600)
  expect(await band.find({ text: /도는 중/ })).not.toBe(undefined)
  // 2분 넘게 조용하면 끝남
  await clock.advance(3 * 60_000)
  expect(await band.find({ text: /도는 중/ })).toBe(undefined)
  expect(await band.find({ text: /🤖 에이전트 1개 \$/ })).not.toBe(undefined)
})

test('좁은 터미널(패널을 연 CLI · 바 100칸 아래)엔 창 버튼을 맨 윗줄에 혼자, 한도 줄은 그 아래 전체 폭 — 넓으면 한 줄', async ($, on) => {
  // 2026-10-12 CLI 실물: 바 ~68칸에 창 버튼 묶음(~45칸)이 오른쪽을 차지해 한도 칸이 "5 / 시 / 간" 처럼 세로로 쪼개졌다
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-narrow' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: 100_000, window: 1_000_000, percent: 10 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 25, resetsAt: new Date(Date.now() + 3 * 3600_000).toISOString() }, { kind: 'seven_day', percentUsed: 12 }],
      cost: { usd: 1 },
    },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  await $.command.run({ command: 'easy-compact', args: '' })
  const narrow = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 70 } })
  expect(JSON.stringify(await narrow.find({ key: 'b-r0' }))).toContain('"band-close"')
  const limits = JSON.stringify(await narrow.find({ key: 'b-r1' }))
  expect(limits).toContain('5시간')
  expect(limits).not.toContain('"band-close"')
  const wide = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, bodyColumns: 160 } })
  expect(await wide.find({ key: 'b-r0' })).toBe(undefined)
  expect(JSON.stringify(await wide.find({ key: 'b-r1' }))).toContain('"band-close"')
})

test('패널 간략 모드(12): 비용 요약(세션 · 질문 · 메인/🤖 · 지금 한 줄 · 컴팩트 판단) + 질문별 비용만, [자세히] · 명령으로 바꾼다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>([['settings', { screen: 'detail' }]])
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-simple' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 3.5 } } }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('agent.spawn', async () => ({ model: 'claude-opus-5-5', agentId: 'ag1' }))
  on('turn.step', async function* (_$, e) {
    const isAgent = e.agentId !== undefined
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 10_000, cache_read_input_tokens: isAgent ? 0 : 50_000, cache_creation_input_tokens: isAgent ? 20_000 : 0, model: 'claude-opus-5-5' } }
  })
  const step = async (turnId: string, agentId?: string) => {
    for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })) {
      // 결과만
    }
  }
  await $.turn.start({ text: '문서 찾아 줘', turnId: 't1' })
  await step('t1')
  await $.agent.spawn({ prompt: '찾아라', description: '문서 조사', subagentType: 'Explore' })
  await step('sub', 'ag1')
  await $.turn.complete({ answer: '찾았습니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await $.turn.start({ text: '정리해 줘', turnId: 't2' })
  await step('t2')
  await $.turn.complete({ answer: '정리했습니다', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' })
  await $.turn.start({ text: '마무리', turnId: 't3' })
  await step('t3')
  await $.turn.complete({ answer: '끝', durationMs: 1, isAborted: false, turnId: 't3', reason: 'answer' })

  // 9a: 바 "요청당" = 이 세션 최근 요청의 실제 값(읽기 5만 × $0.20 + 출력 1만 × $20 = $0.21) — 읽기만이면 $0.01 이라
  // Opus 5.5 · Sonnet 5.5 가 같았다(동료)
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: '~$0.21' })).not.toBe(undefined)
  // 비용 줄 맨 앞 이 세션 금액. 질문 평균(0.4.0 자세히)은 뺐다 — 자리만 차지했고 패널 비용 요약에 있다
  expect(await band.find({ type: 'Text', text: '이 세션 ' })).not.toBe(undefined)
  expect(await band.find({ type: 'Text', text: '$3.50' })).not.toBe(undefined)
  expect(await band.find({ text: / \(질문 3개/ })).toBe(undefined)

  // 패널 보기는 이 세션만 — 저장하지 않는다(화면 프리셋은 세부를 못 바꾼다)
  expect(await $.command.run({ command: 'easy-compact', args: '간략' })).toMatchObject({ text: '사용량 패널을 잠깐 간략 보기로 바꿨습니다 — 패널을 닫거나 설정 탭에 다녀오면 정보량대로 돌아갑니다.' })
  expect((store.get('settings') as { screen?: string } | undefined)?.screen).not.toBe('custom')
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 80, placement: 'dock' } })
  // 비용 요약: 이 세션 누적(제목 줄) · 질문 2개 합 $0.72(= $0.51 + $0.21) · 질문당 평균 · 메인 / 🤖 나눔 · 지금 한 줄 · 판단 한 줄
  expect(await pane.find({ type: 'Text', text: '비용 요약' })).not.toBe(undefined)
  expect(await pane.find({ text: '이 세션 누적 비용 $3.50' })).not.toBe(undefined)
  expect(await pane.find({ text: '3개 $0.93 · 질문당 평균 $0.31' })).not.toBe(undefined)
  expect(await pane.find({ text: '메인 $0.63 · 🤖 에이전트 $0.30' })).not.toBe(undefined)
  // 9c: 같은 질문들을 다른 모델 요율로 — 간략엔 안 붙인다(정보 최소), 자세히의 컨텍스트 · 비용 카드에
  expect(await pane.find({ text: '같은 질문 3개를 Sonnet 5.5 로 ~$0.48 · 지금 Opus 5.5 $0.93' })).toBe(undefined)
  expect(JSON.stringify(await pane.find({ key: 'm-now' }))).toContain('요청당 ')
  // 질문별 비용 카드는 그대로, 컨텍스트 막대 · 컴팩트 카드 · 흐름 그래프 · 요율 줄은 없다
  expect(await pane.find({ text: '질문별 비용' })).not.toBe(undefined)
  expect(await pane.find({ text: '컨텍스트 흐름' })).toBe(undefined)
  expect(await pane.find({ text: '컴팩트 효과' })).toBe(undefined)
  expect(await pane.find({ text: /^금액은 모두 API 정가 환산/ })).toBe(undefined)
  expect((await pane.find({ key: 'pane-simple' }))?.props.variant).toBe('primary')
  // 간략은 펼치기 없이 한 줄씩 — 아래 줄에 요청 수(에이전트 요청까지) · 에이전트 개수(금액 없이), 동작별 내역 없음
  expect(await pane.find({ key: 'hx-0' })).toBe(undefined)
  const row0 = async () => (await pane.find({ key: 'hr-0' }))?.text ?? ''
  expect(await row0()).toMatch(/요청 \d+회/)
  expect(await row0()).not.toMatch(/읽기 \$/)
  expect(await pane.find({ type: 'Text', text: /^🤖 에이전트 1개( · 도는 중)?$/ })).not.toBe(undefined)
  // [자세히] — 지금까지의 패널 전부. 에이전트는 "$ 포함", ▸ 로 펼치면 메인 · 에이전트를 줄마다 요청 수 · 금액 · 읽기 · 쓰기 · 출력으로
  await pane.press({ key: 'pane-detail' })
  expect(await pane.find({ type: 'Text', text: /^🤖 에이전트 1개 \$0\.30 포함( · 도는 중)?$/ })).not.toBe(undefined)
  await pane.press({ key: 'hx-0' })
  const opened = async () => (await pane.find({ key: 'hbox-0' }))?.text ?? ''
  expect(await opened()).toMatch(/읽기 \$/)
  expect(await opened()).toMatch(/요청 \d+회/)
  expect((store.get('settings') as { screen?: string } | undefined)?.screen).not.toBe('custom')
  expect(await pane.find({ text: '컨텍스트 흐름' })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '비용 요약' })).toBe(undefined)
  expect((await pane.find({ key: 'pane-detail' }))?.props.variant).toBe('primary')
  // 패널 위 탭은 잠깐 보기 — 설정 탭에 다녀오면 정보량대로(자세히 화면 = 패널 자세히) 돌아온다
  await pane.press({ key: 'pane-simple' })
  expect((await pane.find({ key: 'pane-simple' }))?.props.variant).toBe('primary')
  await pane.press({ key: 'pane-settings' })
  await pane.press({ key: 'pane-usage' })
  expect((await pane.find({ key: 'pane-detail' }))?.props.variant).toBe('primary')
  // 자세히에도 모델 견줌 줄(컨텍스트 · 비용 카드)
  expect(await pane.find({ text: '같은 질문 3개를 Sonnet 5.5 로 ~$0.48 · 지금 Opus 5.5 $0.93' })).not.toBe(undefined)
  // 9b: 설정 표에 "질문 1개(10회 가정)" 칸 — 요청 10회로 가정 × (그 크기 읽기 + 요청마다 출력 $0.20), 에이전트는 뺀다. 0.4.0 은 이 세션
  // 질문 평균 요청 수 + 에이전트 평균이라 작업량 따라 출렁였다. 20만 ~ 25만 = 10 × ($0.04 + $0.20) ~ 10 × ($0.05 + $0.20)
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  await openSettings(pane)
  expect(await pane.find({ type: 'Text', text: '질문 1개(10회 가정)' })).not.toBe(undefined)
  expect(await pane.find({ text: '$2.40~2.50' })).not.toBe(undefined)
  // 풀이: 10회 가정(색) · 이 세션 실제 평균 요청 수와 그 수로 센 100k ~ 1M 질문 1개 값(색) — 사용자: 색으로 표시해야 눈에 들어온다
  expect(await pane.find({ type: 'Text', text: '요청 10회 가정' })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '요청 1.0회' })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: '→ 질문 1개 100k ~ 1M' })).not.toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^\$0\.\d\d ~ \$\d+\.\d\d$/ })).not.toBe(undefined)
})

test('에이전트 이름: 띄운 때를 못 봤으면(mod 다시 불러옴) 엔진 목록의 설명으로 — "하위 에이전트" 로만 나왔다(동료)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-agent-name' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } } }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // agent.spawn 을 못 본 에이전트 — 엔진 목록엔 있다
  on('agent.list', async () => ({ value: [{ id: 'bg1', description: 'Implement viewer card UI', type: 'general-purpose', status: 'running' }] }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } }
  })
  await $.turn.start({ text: '뷰어 카드 만들어 줘', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만
  }
  for await (const _ of $.turn.step({ turnId: 'sub', index: 0, model: 'claude-opus-5-5', messageCount: 1, agentId: 'bg1' })) {
    // 결과만
  }
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 90, placement: 'dock' } })
  expect(await pane.find({ text: /^🤖 에이전트 요청 1회 · 도는 중 · Opus 5\.5 · Implement viewer/ })).not.toBe(undefined)
  expect(await pane.find({ text: /하위 에이전트/ })).toBe(undefined)
})

test('답 뒤 앱 자체 요청 · 컴팩트: 앞 질문에 ⚙ · 🗜 줄로 따로, 하위 에이전트 🤖 와 갈린다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 답변 아래 칩을 그릴 바탕(엔진 기본 답변 그리기 흉내) — hook 은 시험이 $ 를 처음 부르기 전에
  on('ui.render', { component: 'AssistantMessage' }, async ($$, e) => {
    const { Text } = $$.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  const store = new Map<string, unknown>()
  // 엔진 집계(세션 비용) — 요청마다 엔진이 더하듯 테스트가 더한다
  let ledger = 1
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-app' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: ledger } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  // 메인 요청: 질문 1은 읽기 5만 + 출력 1만 = $0.21, 컴팩트 뒤 질문 2는 읽기 8.4만
  on('turn.step', async function* (_$, e) {
    const read = e.turnId === 't1' ? 50_000 : 84_000
    ledger += (read * 0.2 + 10_000 * 20) / 1e6
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 10_000, cache_read_input_tokens: read, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })
  // 컴팩트 요청: 53만 읽기 $0.106 + 요약 출력 1만 $0.20 = $0.31
  on('session.compact', async () => {
    ledger += (530_000 * 0.2 + 10_000 * 20) / 1e6
    return {
      messages: [{ role: 'user' as const, text: '요약', toolUses: [] }],
      tokensBefore: 530_000,
      usage: { input_tokens: 0, output_tokens: 10_000, cache_read_input_tokens: 530_000, cache_creation_input_tokens: 0 },
    }
  })
  const step = async (turnId: string) => {
    for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만 필요하다
    }
  }

  await $.turn.start({ text: '저장해 줘', turnId: 't1' })
  await step('t1')
  await $.turn.complete({ answer: '저장했습니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  // 답 뒤: 앱이 대화 기록 밖에서 요청 하나(다음 질문 제안 — 53만 읽기 ≈ $0.11), 그리고 컴팩트
  ledger += 0.11
  // 엔진이 컴팩트를 시작할 때 주는 입력 그대로(대화 목록 포함)
  await $.session.compact({ trigger: 'plugin', messages: [{ role: 'user', text: '저장해 줘', toolUses: [] }] } as never)
  // 다음 질문이 시작될 때 잰다: 집계가 는 $0.42 − 우리가 본 컴팩트 $0.31 = 앱 자체 요청 $0.11
  await $.turn.start({ text: '이어서', turnId: 't2' })
  await step('t2')

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 80, placement: 'dock' },
  })
  // 질문 1 = 메인 $0.21 + 컴팩트 $0.31 + 앱 자체 요청 $0.11
  expect(await pane.find({ text: '$0.63' })).not.toBe(undefined)
  await pane.press({ key: 'hx-0' })
  expect(await pane.find({ text: /^⚙ 앱 자체 요청 · 답 뒤 · 다음 질문 제안/ })).not.toBe(undefined)
  // 컴팩트 줄: 직후 크기는 컴팩트 뒤 첫 메인 요청(8.4만)이 채운다
  expect(await pane.find({ text: /^🗜 컴팩트 530k → 84k$/ })).not.toBe(undefined)
  // 펼친 요금 분해: 메인 / 🗜 컴팩트 / ⚙ 앱 자체 요청 줄로 — 컴팩트는 메인으로 세지 않는다(리뷰), 둘 다 금액만
  expect(await pane.find({ text: /^메인 요청 \d+회 \$0\.21$/ })).not.toBe(undefined)
  expect(await pane.find({ text: '🗜 컴팩트 $0.31' })).not.toBe(undefined)
  expect(await pane.find({ text: '⚙ 앱 자체 요청 $0.11' })).not.toBe(undefined)
  expect(await pane.find({ text: /🤖/ })).toBe(undefined)
  // 답변 아래 칩: 데스크톱 정보량 전부면 첫 줄엔 합 · 요청 수만, 앱 자체 요청 · 컴팩트는 펼친 상세의 ⚙ · 🗜 줄에(첫 줄이 길어
  // "포함" 만 다음 줄로 꺾였다). 터미널은 상세가 없어 첫 줄에 "… 포함"
  const reply = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AssistantMessage', props: { text: '저장했습니다', isFirstOfReply: true } })
  expect(await reply.find({ key: 'q-cost' })).not.toBe(undefined)
  expect(await reply.find({ text: /앱 자체 요청|포함/ })).toBe(undefined)
  await reply.press({ key: 'q-fold' })
  expect(await reply.find({ text: ' - ⚙ 앱 자체 요청 $0.11' })).not.toBe(undefined)
  expect(await reply.find({ text: ' - 🗜 컴팩트 $0.31' })).not.toBe(undefined)
  const termReply = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AssistantMessage', props: { text: '저장했습니다', isFirstOfReply: true } })
  expect(await termReply.find({ text: /컴팩트 \$0\.31 · 앱 자체 요청 \$0\.11 포함/ })).not.toBe(undefined)
})

test('저장하고 컴팩트 중: 질문별 비용의 진행 중 줄이 띠와 같은 글 "저장 중 → 끝나면 컴팩트"', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const submitted: string[] = []
  on('prompt.submit', async (_$, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-tidy-live' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('clock.after', async () => ({ value: undefined }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  // /compact 가 도는 동안을 붙잡아 둔다 — 풀 때까지 컴팩트 중
  let isCompactRunning = false
  let finishCompact = () => {}
  const compactHeld = new Promise<void>(resolve => (finishCompact = resolve))
  on('command.run', { command: 'compact' }, async () => {
    isCompactRunning = true
    await compactHeld
    return { text: 'compacted' }
  })
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })

  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'compact' })
  await band.press({ key: 'compact-tidy' })
  expect(submitted.length).toBe(1)
  await $.turn.start({ text: submitted[0]!, turnId: 'tidy' })
  for await (const _ of $.turn.step({ turnId: 'tidy', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })) {
    // 결과만 필요하다
  }

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  // 띠 버튼 자리와 같은 글 · 점 — "진행 중 🗜 저장하고 컴팩트 — 저장 턴" 으로 달리 보이지 않는다. 띠는 🗜 를 따로 파랗게
  expect(await band.find({ text: '저장 중 → 끝나면 컴팩트' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"color":"#4c9be8"')
  expect(await pane.find({ text: '🗜 저장 중 → 끝나면 컴팩트' })).not.toBe(undefined)
  expect(await pane.find({ key: 'h-live-dot' })).not.toBe(undefined)
  expect(await pane.find({ text: '진행 중' })).toBe(undefined)

  // 설정 탭: 진행 줄에 같은 깜빡이는 점, 그동안 "바로 적용" 줄은 숨긴다 — 두 줄이 엇갈려 읽혔다
  await pane.press({ key: 'pane-settings' })
  expect(await pane.find({ key: 's-busy' })).not.toBe(undefined)
  expect(await pane.find({ key: 's-busy-dot' })).not.toBe(undefined)
  expect(await pane.find({ text: /^지금 저장 중입니다 — 끝나면 컴팩트\. 컴팩트 문구를 바꾸면 다음 \[저장하고 컴팩트\]부터/ })).not.toBe(undefined)
  expect(await pane.find({ text: '바꾸면 모든 세션에 바로 적용됩니다.' })).toBe(undefined)
  await pane.press({ key: 'pane-usage' })

  // 저장 턴이 [컴팩트 진행] 으로 끝나 /compact 가 도는 동안: 진행 중 질문은 없어도(컴팩트는 턴이 아니다) 패널도 띠처럼
  // "컴팩트 중" — 진행 중 줄만 그리던 때는 띠에만 떴다
  await $.turn.complete({ answer: '이어서 할 일: …\n[컴팩트 진행]', durationMs: 1, isAborted: false, turnId: 'tidy', reason: 'answer' })
  for (let i = 0; i < 20 && !isCompactRunning; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(isCompactRunning).toBe(true)
  // 어떤 컴팩트인지: 저장이 끝나고 컴팩트 — 앞 단계 글 "저장 중 → 끝나면 컴팩트" 를 잇는다
  expect(await band.find({ text: '저장 끝 → 컴팩트 중…' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"color":"#4c9be8"')
  expect(await pane.find({ text: '🗜 저장 끝 → 컴팩트 중…' })).not.toBe(undefined)
  expect(await pane.find({ key: 'h-compacting-dot' })).not.toBe(undefined)
  expect(await pane.find({ key: 'h-live-dot' })).toBe(undefined)

  // 끝나면 둘 다 사라진다
  finishCompact()
  for (let i = 0; i < 20 && (await pane.find({ key: 'h-compacting-dot' })) !== undefined; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(await pane.find({ key: 'h-compacting-dot' })).toBe(undefined)
  expect(await band.find({ text: /컴팩트 중…/ })).toBe(undefined)
  await pane.press({ key: 'pane-settings' })
  expect(await pane.find({ key: 's-busy' })).toBe(undefined)
  expect(await pane.find({ text: '바꾸면 모든 세션에 바로 적용됩니다.' })).not.toBe(undefined)
})

test('/compact 를 직접 치거나 자동 컴팩트: 띠 · 설정 탭에 "컴팩트 중" — 저장 턴이 없으니 "저장" 글은 없다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-typed-compact' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('clock.after', async () => ({ value: undefined }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  // 컴팩트가 도는 동안을 붙잡아 둔다(컴팩트마다 새로)
  let finishCompact = () => {}
  let compactHeld = new Promise<void>(resolve => (finishCompact = resolve))
  let isCompactRunning = false
  on('session.compact', async () => {
    isCompactRunning = true
    await compactHeld
    return { messages: [{ role: 'user' as const, text: '요약', toolUses: [] }], tokensBefore: 300_000 }
  })

  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  await pane.press({ key: 'pane-settings' })

  // 사용자가 친 /compact 도 엔진엔 버튼이 돌린 것과 같은 컴팩트(트리거 manual)
  const running = $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: '이어서', toolUses: [] }] } as never)
  for (let i = 0; i < 20 && !isCompactRunning; i++) await new Promise(resolve => setTimeout(resolve, 10))
  // 버튼이 세운 게 아니니 친 /compact — [바로 컴팩트]와 하는 일은 같고 붙는 지시만 달라, 이름으로 가른다
  // Claude 에 원래 있는 기능이라 "클로드 기본" — 우리 버튼과 섞여 읽히지 않게
  expect(await band.find({ text: '클로드 기본 compact 중…' })).not.toBe(undefined)
  expect(await pane.find({ key: 's-busy-dot' })).not.toBe(undefined)
  expect(await pane.find({ text: /^지금 클로드 기본 compact 중입니다\. 컴팩트 문구를 바꾸면 다음 \[저장하고 컴팩트\]부터/ })).not.toBe(undefined)
  expect(await pane.find({ text: /저장 중|저장하고 컴팩트가 도는/ })).toBe(undefined)

  finishCompact()
  await running
  expect(await pane.find({ key: 's-busy' })).toBe(undefined)
  expect(await band.find({ text: /컴팩트 중…/ })).toBe(undefined)

  // 엔진이 문턱에서 돌린 자동 컴팩트
  isCompactRunning = false
  compactHeld = new Promise<void>(resolve => (finishCompact = resolve))
  const auto =$.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: '이어서', toolUses: [] }] } as never)
  for (let i = 0; i < 20 && !isCompactRunning; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(await band.find({ text: '클로드 기본 auto-compact 중…' })).not.toBe(undefined)
  expect(await pane.find({ text: /^지금 클로드 기본 auto-compact 중입니다\./ })).not.toBe(undefined)
  finishCompact()
  await auto
})

test('[바로 컴팩트]: 띠 · 설정 탭에 "바로 컴팩트 중" — 엔진엔 친 /compact 와 같은 manual 이어도 버튼이 세운 이름을 지킨다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-direct-compact' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('clock.after', async () => ({ value: undefined }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  let finishCompact = () => {}
  const compactHeld = new Promise<void>(resolve => (finishCompact = resolve))
  let isCompactRunning = false
  on('session.compact', async () => {
    isCompactRunning = true
    await compactHeld
    return { messages: [{ role: 'user' as const, text: '요약', toolUses: [] }], tokensBefore: 300_000 }
  })
  // 엔진처럼: /compact 명령은 manual 컴팩트를 부르고, 친 글이 지시로 간다
  let instructions: string | undefined
  on('command.run', { command: 'compact' }, async (_$, e) => {
    instructions = e.args
    await $.session.compact({ trigger: 'manual', instructions: e.args, messages: [{ role: 'user', text: '이어서', toolUses: [] }] } as never)
    return { text: 'compacted' }
  })

  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  await pane.press({ key: 'pane-settings' })
  await band.press({ key: 'compact' })
  const pressing = band.press({ key: 'compact-yes' })
  for (let i = 0; i < 20 && !isCompactRunning; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(instructions).toBe('진행 중 작업 · 결정 · 이어서 할 일은 요약에 남길 것')
  expect(await band.find({ text: '바로 컴팩트 중…' })).not.toBe(undefined)
  expect(await pane.find({ text: /^지금 바로 컴팩트 중입니다\./ })).not.toBe(undefined)
  finishCompact()
  await pressing
  for (let i = 0; i < 20 && (await pane.find({ key: 's-busy' })) !== undefined; i++) await new Promise(resolve => setTimeout(resolve, 10))
  expect(await pane.find({ key: 's-busy' })).toBe(undefined)
})

test('모델을 바꾸면 설정 탭의 계산 값 · 비용표가 바로 새 모델 요율 — 다음 요청을 기다리지 않는다(1.5초마다 모델 따라가기)', async ($, on) => {
  // 동료: 모델을 바꿔도 설정 탭 · 카드 값이 다음 메인 요청 때까지 옛 모델 요율이었다
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const clock = mock.clock(on, { now: Date.parse('2026-10-11T13:00:00Z') })
  let model = 'claude-opus-5-5'
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-follow' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: model }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('store.get', async (_$, e) => ({ value: e.key === 'afterCompactTokens' ? 94_000 : e.key === 'settings' ? { screen: 'detail' } : undefined }))
  on('store.set', async () => ({ value: undefined }))
  // 패널은 연 뒤 열린 채 — 닫힌 것으로 흉내 내면 1.5초마다 패널 맞추기가 사용량을 다시 재 모델 따라가기 없이도 바뀐다
  let isUp = false
  on('ui.panes', async () => ({ value: isUp ? [{ id: 'easy-compact', title: '사용량', isShown: true, isFocused: false, isPlaced: true }] : [] }))
  on('ui.open', async () => {
    isUp = true
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: '' })
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  await openSettings(pane)
  expect(await pane.find({ text: /^Opus 5\.5 · 컴팩트 후 94k/ })).not.toBe(undefined)
  model = 'claude-sonnet-5-5'
  await clock.advance(1600)
  expect(await pane.find({ text: /^Sonnet 5\.5 · 컴팩트 후 94k/ })).not.toBe(undefined)
  expect(await pane.find({ text: /^Opus 5\.5 · 컴팩트 후/ })).toBe(undefined)
})

test('모델을 바꾸면: 띠가 새 모델 요율로 "모델 바뀜 · 이어 가면 전체 다시 쓰기", 새 모델 요청이 한 번 끝나면 다시 요청당 값', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  let model = 'claude-opus-5-5'
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-switch' }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: model }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  // 기록을 못 읽어 기본 적재를 모른다 — 이 PC 에서 잰 지난 컴팩트 직후 크기(94k)를 쓴다
  on('store.get', async (_$, e) => ({ value: e.key === 'afterCompactTokens' ? 94_000 : undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '답',
      toolUses: [],
      stopReason: 'end_turn',
      // Sonnet 은 같은 대화를 더 적게 센다(실제로 222k → 185k) — 컴팩트가 아니라 모델 차이로 줄어든 경우
      usage: {
        input_tokens: 0,
        output_tokens: 1_000,
        cache_read_input_tokens: e.model.includes('sonnet') ? 260_000 : 300_000,
        cache_creation_input_tokens: 0,
        model: e.model,
      },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  const ask = async (turnId: string) => {
    await $.turn.start({ text: '질문', turnId })
    for await (const _ of $.turn.step({ turnId, index: 0, model, messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: '답', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
  }
  await ask('t1')
  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // Opus 5.5 요청당: 30만 × $0.20 = $0.06
  expect(await band.find({ text: '~$0.06' })).not.toBe(undefined)
  expect(await band.find({ text: /모델 바뀜/ })).toBe(undefined)
  expect(await band.find({ text: /지난 질문/ })).not.toBe(undefined)

  // Sonnet 5 로 바꿈 — 새 모델엔 캐시가 없어 첫 요청이 30만 × $4(1시간 쓰기) = $1.20 을 다시 쓴다
  model = 'claude-sonnet-5'
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ text: /모델 바뀜/ })).not.toBe(undefined)
  expect(await band.find({ text: '$1.20 소비' })).not.toBe(undefined)
  // 컴팩트하면 $1.20 − $1.08 ≈ $0.12 이득
  expect(await band.find({ text: '$0.12 이득' })).not.toBe(undefined)
  // 다음 요청이 전체를 다시 쓰는 동안엔 지난 질문 줄을 숨긴다 — 지난 질문의 "캐시 다시 씀" 과 섞여 헷갈렸다
  expect(await band.find({ text: /지난 질문/ })).toBe(undefined)
  // 바로 컴팩트(30만 × $2 + 출력 1만 × $10 + 9.4만 × $4 ≈ $1.08)가 이어 가기($1.20)보다 싸다 — 식은 캐시처럼 권장
  // 바로 컴팩트가 더 싸다 — 띠 버튼이 권장으로. 확인창은 스스로 열지 않는다(앱이 이미 경고 팝업을 띄운다)
  expect(await band.find({ key: 'compact', text: '모델 바뀜 · 바로 컴팩트 권장' })).not.toBe(undefined)
  expect(await band.find({ key: 'compact-yes' })).toBe(undefined)
  await band.press({ key: 'compact' })
  expect(await band.find({ text: /모델을 바꿔 새 모델엔 캐시가 없습니다/ })).not.toBe(undefined)
  await band.press({ key: 'compact-no' })

  // 요청을 보내기 전에 원래 모델로 돌아오면 캐시가 그대로다 — 표시가 사라진다
  // (다른 모델로 요청을 보낸 뒤 돌아오면 그땐 다시 쓴다 — 2026-10-11 실측: 13분 만에 Opus 로 돌아와도 239k 를 다시 씀)
  model = 'claude-opus-5-5'
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ text: /모델 바뀜/ })).toBe(undefined)
  expect(await band.find({ text: /지난 질문/ })).not.toBe(undefined)

  // 다시 Sonnet 으로 바꾸고 권장을 무시한 채 질문을 보내면: 첫 요청이 새 모델에 캐시를 만들어 원래대로(요청당 값 · 보통 버튼)
  model = 'claude-sonnet-5'
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ text: /모델 바뀜/ })).not.toBe(undefined)
  await ask('t2')
  expect(await band.find({ text: /모델 바뀜/ })).toBe(undefined)
  // 26만 × $0.20 = $0.05
  expect(await band.find({ text: '~$0.05' })).not.toBe(undefined)

  // 질문별 비용에 남는다: 모델을 바꾼 질문엔 🔄 모델 Opus 5.5 → Sonnet 5, 줄어든 컨텍스트는 "컴팩트" 가 아니라 "모델 바뀜"
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ text: /🔄 모델 Opus 5\.5 → Sonnet 5/ })).not.toBe(undefined)
  expect(await pane.find({ text: /−40k · 모델 바뀜/ })).not.toBe(undefined)
  expect(await pane.find({ text: /−40k 컴팩트/ })).toBe(undefined)
})

test('노력도를 바꾼 질문: 질문별 비용에 앞 질문과 비교해 "🔄 노력도 high → xhigh"', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-effort' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-sonnet-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '답',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 0, model: 'claude-sonnet-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  const ask = async (turnId: string, effort: 'high' | 'xhigh') => {
    await $.turn.start({ text: `질문 ${turnId}`, turnId })
    for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-sonnet-5-5', effort, messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: '답', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
  }
  await ask('t1', 'high')
  // 두 번째 질문이 도는 중에도 진행 중 줄에 바뀐 노력도가 보인다
  await $.turn.start({ text: '질문 t2', turnId: 't2' })
  for await (const _ of $.turn.step({ turnId: 't2', index: 0, model: 'claude-sonnet-5-5', effort: 'xhigh', messageCount: 1 })) {
    // 결과만 필요하다
  }
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ text: /진행 중/ })).not.toBe(undefined)
  expect(await pane.find({ text: /🔄 노력도 high → xhigh/ })).not.toBe(undefined)
  // 끝나면 진행 중 줄은 사라지고 질문 줄에 남는다
  await $.turn.complete({ answer: '답', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' })
  expect(await pane.find({ text: /진행 중/ })).toBe(undefined)
  expect(await pane.find({ text: /🔄 노력도 high → xhigh/ })).not.toBe(undefined)
  // 모델은 그대로라 모델 바뀜 표시는 없다
  expect(await pane.find({ text: /🔄 모델/ })).toBe(undefined)
})

test('띠 질문 줄: 합 · 요청 수, 캐시를 크게 다시 쓴 질문만 그 값을 따로(식은 캐시 · 모델 전환 뒤 첫 요청) — 세션 첫 요청은 아님', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-rewrite' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // 30만을 캐시 없이 통째로 쓴 요청: 쓰기 300k × $8 = $2.40. 세션 첫 요청이면 처음 쓰는 것, 앞 요청(30만)이 있으면 다시 쓰는 것
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '답',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 300_000, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  const ask = async (turnId: string) => {
    await $.turn.start({ text: '오랜만의 질문', turnId })
    for await (const _ of $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만 필요하다
    }
    await $.turn.complete({ answer: '답', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
  }
  await ask('t1')
  const first = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await first.find({ text: /요청 1회/ })).not.toBe(undefined)
  expect(await first.find({ text: /캐시 다시 씀/ })).toBe(undefined)
  await ask('t2')
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ text: /캐시 다시 씀 \$2\.40/ })).not.toBe(undefined)
  // 읽기 · 쓰기 · 출력 내역은 띠에 없다(질문별 비용 패널에 있다)
  expect(await band.find({ text: /출력 \$/ })).toBe(undefined)
})

test('영어: 설정 탭(커스텀 세부까지) · 명령 답에 한글이 없다(언어 줄 이름만 두 언어)', async ($, on) => {
  // 띠 · 확인창 · 터미널 띠 · 사용량 패널 · 최소화 띠의 한글 검사는 QA 조합(qa.test 규칙 ②)이 상태마다 본다 — 여기선 QA 가 안 가는
  // 커스텀 화면 세부와 명령 답만
  mock.env(on, { EASY_COMPACT_LANG: 'en', HOME: '/home/test' })
  const at = (min: number) => new Date(Date.parse('2026-10-10T12:00:00Z') + min * 60_000).toISOString()
  const asst = (id: string, ctx: number, min: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: at(min),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0 } },
    })
  const transcript = [
    asst('a', 300_000, 1),
    asst('b', 590_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } }),
    asst('c', 94_000, 4),
    asst('d', 120_000, 5),
  ].join('\n')
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: transcript }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: 120_000, window: 1_000_000, percent: 12 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 15, resetsAt: new Date(Date.now() + 3 * 3600_000).toISOString() }],
      cost: { usd: 1 },
    },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))

  // 화면에 보이는 글 · 버튼 이름 · 입력칸 안내 · 그림 설명 중 한글이 든 것
  const hangul = /[가-힣]/
  const leftovers = async (ui: Awaited<ReturnType<typeof $.ui.mount>>) => {
    const out: string[] = []
    for (const t of await ui.findAll({ type: 'Text' })) if (hangul.test(String(t.text ?? ''))) out.push(String(t.text))
    for (const b of await ui.findAll({ type: 'Button' })) if (hangul.test(String(b.props.label ?? ''))) out.push(`[${String(b.props.label)}]`)
    for (const i of await ui.findAll({ type: 'Input' })) {
      for (const v of [i.props.placeholder, i.props.submitLabel]) if (hangul.test(String(v ?? ''))) out.push(`input:${String(v)}`)
    }
    for (const s of await ui.findAll({ type: 'Svg' })) if (hangul.test(String(s.props.alt ?? ''))) out.push(`svg:${String(s.props.alt)}`)
    return out
  }

  await $.command.run({ command: 'easy-compact', args: '' })
  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  // 설정 탭: 언어 줄 이름("언어 · Language")과 한국어 버튼만 한글
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  // 접힌 제목 줄(지금 값)도 영어
  expect((await leftovers(pane)).filter(t => t !== '언어 · Language' && t !== '[한국어]')).toEqual([])
  await openSettings(pane)
  expect(await pane.find({ key: 'lang-en' })).not.toBe(undefined)
  expect((await leftovers(pane)).filter(t => t !== '언어 · Language' && t !== '[한국어]')).toEqual([])
  // 화면 세부(프리셋이라 글로 — 못 누름) · 커스텀(버튼)도
  expect(await pane.find({ key: 'show-resets', text: '✓ Time to reset' })).not.toBe(undefined)
  await pane.press({ key: 'screen-custom' })
  expect(await pane.find({ key: 'show-resets', text: '✓ Time to reset' })).not.toBe(undefined)
  expect(await pane.find({ key: 'color-0-up' })).not.toBe(undefined)
  expect((await leftovers(pane)).filter(t => t !== '언어 · Language' && t !== '[한국어]')).toEqual([])

  // 명령 도움말 · 답
  const help = await $.command.run({ command: 'easy-compact', args: '?' })
  expect(hangul.test(String(help.text))).toBe(false)
  const set = await $.command.run({ command: 'easy-compact', args: 'set cache 10' })
  expect(hangul.test(String(set.text))).toBe(false)
  for (const args of ['band', 'band 5h off', 'auto on', 'auto off', 'autoopen off', 'hide', 'show', 'max', 'min', 'screen basic', 'simple', 'detailed']) {
    const r = await $.command.run({ command: 'easy-compact', args })
    expect(hangul.test(String(r.text))).toBe(false)
  }
})

test('언어 감지: Claude Code 설정 language → 앱 언어(locale) → OS(LANG) → 설정 탭에서 고르면 그 언어로 고정', async ($, on) => {
  const files = new Map<string, string>()
  const env = new Map<string, string>()
  const store = new Map<string, unknown>()
  let now = Date.now()
  // 엔진은 경로를 \ 로 넘긴다. 없는 파일은 빈 글(던지면 이 훅을 건너뛰고 진짜 파일을 읽는다), 긴 끝맺음부터 맞춘다
  // (프로젝트 설정 ".../Work/.claude/settings.json" 이 사용자 설정 "/.claude/settings.json" 보다 먼저)
  on('fs.read', async (_$, e) => {
    const path = e.path.replace(/\\/g, '/')
    const hit = [...files].filter(([suffix]) => path.endsWith(suffix)).sort((a, b) => b[0].length - a[0].length)[0]
    return { value: hit ? hit[1] : '' }
  })
  on('env.get', async (_$, e) => ({ value: env.get(e.name) }))
  // 감지는 30초에 한 번 — 부를 때마다 1분씩 흐르게 해 바뀐 설정을 바로 읽는다
  on('clock.now', async () => ({ value: (now += 60_000) }))
  on('session.cwd', async () => ({ value: 'D:/Work' }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  const helpText = async () => String((await $.command.run({ command: 'easy-compact', args: '?' })).text)
  const isKo = async () => /[가-힣]/.test(await helpText())

  // 1) Claude Code 사용자 설정 language("한국어" 같은 자유 글) → 한국어
  files.set('/.claude/settings.json', JSON.stringify({ language: '한국어' }))
  env.set('APPDATA', 'C:/Users/u/AppData/Roaming')
  files.set('/Claude/config.json', JSON.stringify({ locale: 'en-US' }))
  expect(await isKo()).toBe(true)
  // 프로젝트 설정이 사용자 설정보다 앞선다
  files.set('/Work/.claude/settings.json', JSON.stringify({ language: 'english' }))
  expect(await isKo()).toBe(false)
  files.delete('/Work/.claude/settings.json')

  // 2) Claude Code 설정에 language 가 없으면 데스크톱 앱 언어(config.json 의 locale)
  files.set('/.claude/settings.json', JSON.stringify({ theme: 'dark' }))
  expect(await isKo()).toBe(false)
  files.set('/Claude/config.json', JSON.stringify({ locale: 'ko-KR' }))
  expect(await isKo()).toBe(true)

  // 3) 앱도 없으면 OS 언어(LANG — "C" 는 언어가 아니라 건너뜀)
  files.delete('/Claude/config.json')
  env.set('LANG', 'en_US.UTF-8')
  expect(await isKo()).toBe(false)
  env.set('LANG', 'ko_KR.UTF-8')
  expect(await isKo()).toBe(true)

  // 4) 설정 탭 언어 줄 = /easy-compact lang — 고르면 감지와 상관없이 그 언어, 자동으로 돌리면 다시 감지
  expect(String((await $.command.run({ command: 'easy-compact', args: 'lang en' })).text)).toBe('Display language set to English.')
  expect(await isKo()).toBe(false)
  expect(String((await $.command.run({ command: 'easy-compact', args: 'lang auto' })).text)).toBe('화면 언어를 자동으로 정합니다(지금 한국어).')
  expect(await isKo()).toBe(true)
})

/** 2칸 그림 글자(이모지 · ⚙ 같은 그림 기호) — ★ ✓ ✕ ● 같은 1칸 기호는 뺀다 */
const EMOJI = /[🌀-🫿☀-☄☆-⛿⏩-⏺]/u
async function expectNoEmoji(ui: { find: (q: { text: RegExp }) => Promise<unknown>; findAll: (q: { type: string }) => Promise<{ props: { label?: unknown } }[]> }) {
  expect(await ui.find({ text: EMOJI })).toBe(undefined)
  for (const button of await ui.findAll({ type: 'Button' })) expect(EMOJI.test(String(button.props.label ?? ''))).toBe(false)
}

test('터미널(CLI): 띠 · 확인 카드 · 사용량 패널 · 설정 탭이 그려지고, 그림은 칸 그림(Raster)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 캐시가 살아 있게 기록 시각을 최근으로(캐시 타이머는 마지막 요청 시각 기준)
  const at = (min: number) => new Date(Date.now() - 10 * 60_000 + min * 60_000).toISOString()
  const asst = (id: string, ctx: number, min: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: at(min),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0 } },
    })
  const transcript = [
    asst('a', 300_000, 1),
    asst('b', 590_000, 2),
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(3), compactMetadata: { trigger: 'manual', preTokens: 596_000 } }),
    asst('c', 94_000, 4),
    asst('d', 120_000, 5),
  ].join('\n')
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: transcript }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-1' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: 120_000, window: 1_000_000, percent: 12 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 15, resetsAt: new Date(Date.now() + 3 * 3600_000).toISOString() }],
      cost: { usd: 1 },
    },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))

  await $.command.run({ command: 'easy-compact', args: '' })
  await $.command.run({ command: 'easy-compact', args: 'usage' })

  // 띠: 한도 · 요청당 · 컴팩트 버튼, 한도 막대는 글자 막대
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, maxRows: 12 } })
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  expect(await band.find({ text: /█/ })).not.toBe(undefined)
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)
  expect(await band.find({ key: 'usage' })).not.toBe(undefined)
  // 확인 카드: 실행 버튼 셋
  await band.press({ key: 'compact' })
  // 120k 는 아낄 게 거의 없어(손해) 컴팩트 버튼 없이 "작업을 이어 가세요" 와 확인 하나
  expect(await band.find({ text: /작업을 이어 가세요/ })).not.toBe(undefined)
  expect(await band.find({ key: 'compact-tidy' })).toBe(undefined)
  expect(await band.find({ key: 'compact-yes' })).toBe(undefined)
  expect(await band.find({ key: 'compact-no' })).not.toBe(undefined)
  // 그림 글자 없음: 앱 터미널 패널은 2칸 그림 글자를 1칸처럼 그려 칸이 어긋나고 찌꺼기가 남았다(glyph.ts)
  await expectNoEmoji(band)

  // 사용량 패널: 컨텍스트 글자 막대, 컴팩트 시점 글, 흐름 그래프 자리는 안내 한 줄
  const pane = await $.ui.mount({
    plugin: 'easy-compact',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'easy-compact',
    props: { bodyColumns: 60, placement: 'dock' },
  })
  expect(await pane.find({ type: 'Text', text: '컴팩트 시점' })).not.toBe(undefined)
  expect(await pane.find({ text: '컨텍스트 흐름' })).not.toBe(undefined)
  expect(await pane.find({ text: /^200k부터 컴팩트하기 좋은 때 · \d+k 남음$/ })).not.toBe(undefined)
  expect(await pane.find({ text: '질문별 비용' })).not.toBe(undefined)
  // 그림은 칸 그림(Raster): 컨텍스트 막대 · 흐름 그래프 · 컴팩트 시점 막대 — "데스크톱에서만" 안내는 없다
  const rasters = await pane.findAll({ type: 'Raster' })
  expect(rasters.length >= 3).toBe(true)
  expect(rasters.some(r => r.props.rows === 6)).toBe(true)
  expect(await pane.find({ text: /데스크톱 앱에서만/ })).toBe(undefined)
  await expectNoEmoji(pane)
  // 진행 중 질문: 보내자마자(첫 요청이 끝나기 전에도) 질문별 비용 맨 위에 — 도구 없이 한 번에 끝나는 질문은 첫 요청이 끝나면
  // 질문도 끝나 예전엔 끝까지 안 보였다
  await $.turn.start({ text: '실시간 질문', turnId: 'live-1' })
  expect(await pane.find({ text: / 실시간 질문$/ })).not.toBe(undefined)
  expect(await pane.find({ text: '첫 응답을 기다리는 중' })).not.toBe(undefined)
  expect(await pane.find({ key: 'h-live-dot' })).not.toBe(undefined)

  // 설정 탭: 언어 · 컴팩트 시점(비용표 · 입력칸) · 캐시 · 문구
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  await openSettings(pane)
  expect(await pane.find({ key: 'lang-auto' })).not.toBe(undefined)
  // 터미널에서 안 쓰는 옵션은 안 보인다: 질문 강조(마우스 올림 없음) · 패널 같이 여닫기(터미널 패널은 자기 것만)
  expect(await pane.find({ key: 'hover-row' })).toBe(undefined)
  expect(await pane.find({ key: 'pane-sync-row' })).toBe(undefined)
  expect(await pane.find({ key: 'pane-auto-row' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cmp-range' })).not.toBe(undefined)
  expect(await pane.find({ key: 'cache-up' })).not.toBe(undefined)
  expect(await pane.find({ key: 'tidy-default' })).not.toBe(undefined)
  await expectNoEmoji(pane)
  await pane.press({ key: 'cmp-manual' })
  expect(await pane.find({ key: 'cmp-size-input' })).not.toBe(undefined)
})

/** 패널 시험 바탕: 사용량을 읽을 만큼만 흉내 내고, $.store 와 열린 패널을 기억한다 */
function paneWorld(on: On, surfaces: RenderSurface[], store: Map<string, unknown>) {
  const clock = mock.clock(on, { now: Date.parse('2026-10-11T13:00:00Z') })
  const world = { isUp: false, panesAsked: 0, clock }
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-pane' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.surfaces', async () => ({ value: surfaces }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 120_000, window: 1_000_000, percent: 12 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('ui.panes', async () => {
    world.panesAsked++
    return { value: world.isUp ? [{ id: 'easy-compact', title: '사용량', isShown: true, isFocused: false, isPlaced: true }] : [] }
  })
  on('ui.open', async () => {
    world.isUp = true
    return { value: { isPlaced: true } }
  })
  on('ui.close', async () => {
    world.isUp = false
    return { value: undefined }
  })
  return world
}

/** 기록 파일 하나로 띠를 띄운다 — 파일 수정 시각은 늘 지금(앱이 세션을 열 때 메타 줄을 덧붙인 것처럼), 엔진 컨텍스트는 engineTokens */
async function mountFromTranscript($: Parameters<Parameters<typeof test>[1]>[0], on: On, lines: string[], engineTokens: number) {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: lines.join('\n') }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-reopen' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: engineTokens, window: 1_000_000, percent: engineTokens / 10_000 }, rateLimits: [], cost: { usd: 1 } } }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  await $.command.run({ command: 'easy-compact', args: '' })
  return $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
}

const recordAt = (baseMs: number) => ({
  asst: (id: string, ctx: number, min: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: new Date(baseMs + min * 60_000).toISOString(),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: ctx - 10, cache_creation_input_tokens: 0 } },
    }),
  compact: (min: number, before: number) =>
    JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: new Date(baseMs + min * 60_000).toISOString(), compactMetadata: { trigger: 'manual', preTokens: before } }),
})

test('캐시 타이머는 마지막 요청 시각 기준 — 앱이 기록에 메타 줄을 덧붙여 파일 수정 시각이 새로워도, 하루 넘게 쉰 세션은 캐시 만료', async ($, on) => {
  // 26 · 28시간 쉰 세션 둘이 캐시 만료 · 바로 컴팩트 권장 없이 그냥 "컴팩트할까요?" 로 나왔다
  const r = recordAt(Date.now() - 2 * 24 * 3600_000)
  const band = await mountFromTranscript($, on, [r.asst('a', 250_000, 1), r.asst('b', 300_000, 2), JSON.stringify({ type: 'custom-title', customTitle: '[큰그림-표면]' })], 300_000)
  expect(await band.find({ text: '캐시 만료' })).not.toBe(undefined)
  expect(await band.find({ text: '요청당 ' })).toBe(undefined)
})

test('식은 캐시 셈에 공통 앞부분: 세션 첫 요청이 캐시에서 읽은 시스템 · 도구(다른 세션이 데워 둠)는 이어 가기 · 바로 컴팩트 둘 다 읽기', async ($, on) => {
  // 회사 세션(2026-10-12): 요청 1 과 식은 뒤 요청 17 이 둘 다 47,594 를 읽었다 — 전부 다시 쓴다고 세면 이어 가기가 높게 나와
  // 판정이 바로 컴팩트 쪽으로 기울었다
  const base = Date.now() - 2 * 24 * 3600_000
  const line = (id: string, read: number, write: number, min: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: new Date(base + min * 60_000).toISOString(),
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 0, output_tokens: 100, cache_read_input_tokens: read, cache_creation_input_tokens: write } },
    })
  const band = await mountFromTranscript($, on, [line('a', 47_594, 12_406, 1), line('b', 300_000, 0, 2)], 300_000)
  // 이어 가기: (30만 − 4.76만) × $8 + 4.76만 × $0.20 ≈ $2.03(전부 다시 쓰면 $2.40)
  expect(await band.find({ text: '캐시 만료' })).not.toBe(undefined)
  expect(await band.find({ text: '$2.03 소비' })).not.toBe(undefined)
  await band.press({ key: 'compact' })
  const card = JSON.stringify(await band.find({ key: 'confirm-cold' }))
  expect(card).toContain('~$2.03')
  // "전체" 가 아니라 다시 쓰는 크기(30만 − 4.76만 ≈ 252k)
  expect(card).toContain(' 중 ~252k 를 다시 씀 ')
  expect(card).not.toContain('300k 전체를 다시 씀')
  // 설정 탭 비용표 "캐시 식으면" 도 같은 셈 — 25만 ~ 30만: (25만 − 4.76만) × $8 + … ≈ $1.63 ~ $2.03(전부 다시 쓰면 $2.00 ~ $2.40)
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  await openSettings(pane)
  expect(await pane.find({ text: '$1.63~2.03' })).not.toBe(undefined)
  expect(await pane.find({ text: '$2.00~2.40' })).toBe(undefined)
  expect(await pane.find({ text: '1시간 넘게 쉬어 다시 쓰기(공통 앞부분 48k 은 읽기)' })).not.toBe(undefined)
})

test('캐시 유지 시간은 기록에서 잰다: 5분 캐시(API 키 · 사용량 초과)면 만료까지 n분 남음, 10분 쉬면 만료, 복구 값은 5분 쓰기 요율', async ($, on) => {
  // 엔진은 요청마다 유지 시간을 정하고(구독 사용량 안 1시간, API 키 · 사용량 초과 5분 — 공식 문서) 기록의 cache_creation 에
  // ephemeral_5m · 1h 로 남긴다. 단정하지 않고 그 값을 쓴다
  const line = (base: number, id: string, read: number, write: number, min: number, ttl: '5m' | '1h') =>
    JSON.stringify({
      type: 'assistant',
      timestamp: new Date(base + min * 60_000).toISOString(),
      message: {
        id,
        model: 'claude-opus-5-5',
        usage: {
          input_tokens: 0,
          output_tokens: 100,
          cache_read_input_tokens: read,
          cache_creation_input_tokens: write,
          cache_creation: { ephemeral_5m_input_tokens: ttl === '5m' ? write : 0, ephemeral_1h_input_tokens: ttl === '1h' ? write : 0 },
        },
      },
    })
  // 10분 전에 끝난 5분 캐시 세션 — 1시간이었으면 살아 있을 때
  const base = Date.now() - 12 * 60_000
  const band = await mountFromTranscript($, on, [line(base, 'a', 47_594, 12_406, 1, '5m'), line(base, 'b', 290_000, 10_000, 2, '5m')], 300_000)
  expect(await band.find({ text: '캐시 만료' })).not.toBe(undefined)
  // 복구 값 = 5분 쓰기 요율(Opus 5.5 $5): (30만 − 4.76만) × $5 + 4.76만 × $0.20 ≈ $1.27 — 1시간 요율이면 $2.03
  expect(await band.find({ text: '$1.27 소비' })).not.toBe(undefined)
  expect(await band.find({ text: '$2.03 소비' })).toBe(undefined)
  // 설정 탭 캐시 칸: 5분 · 기록에서 잼 · 5분 캐시 경고가 지금 것
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 70, placement: 'dock' } })
  await openSettings(pane)
  expect(await pane.find({ type: 'Text', text: '5분' })).not.toBe(undefined)
  expect(await pane.find({ text: '(이 세션 기록에서 잼)' })).not.toBe(undefined)
  expect(await pane.find({ text: '남으면 노랑 · 지금 이 세션' })).not.toBe(undefined)
  // 비용표 "캐시 식으면" 도 5분 요율 · 이름도 5분
  expect(await pane.find({ text: '5분 넘게 쉬어 다시 쓰기(공통 앞부분 48k 은 읽기)' })).not.toBe(undefined)
  // 유지 시간 바꾸기는 커스텀에서만(프리셋은 글로 막아 둠 — 잘 모르고 바꾸면 손해)
  expect(await pane.find({ key: 'ttl-1h' })).toBe(undefined)
  expect(await pane.find({ text: /^바꾸기는 화면 → 커스텀에서/ })).not.toBe(undefined)
})

test('캐시 타이머는 메인 요청마다 처음부터: 긴 작업 중에도 남은 분이 줄지 않는다', async ($, on) => {
  // "계속 작업 중인데도 캐시 시간이 감소하는 거야?" — 예전엔 턴 끝에만 기준 시각을 바꿨다
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const clock = mock.clock(on, { now: Date.parse('2026-10-13T01:00:00Z') })
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-timer' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } } }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'tool_use', usage: { input_tokens: 0, output_tokens: 100, cache_read_input_tokens: 99_000, cache_creation_input_tokens: 1_000, model: 'claude-opus-5-5' } }
  })
  const step = async () => {
    for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
      // 결과만
    }
  }
  await $.turn.complete({ answer: '앞 질문', durationMs: 1, isAborted: false, turnId: 't0', reason: 'answer' })
  await $.turn.start({ text: '긴 작업', turnId: 't1' })
  // 50분 동안 10분마다 요청 — 턴은 아직 안 끝남
  for (let i = 0; i < 5; i++) {
    await clock.advance(10 * 60_000)
    await step()
  }
  await clock.advance(60_000)
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  // 마지막 요청에서 1분 — 59분 남음(턴 시작에서 셌으면 9분 남거나 만료)
  expect(await band.find({ text: '59분 남음' })).not.toBe(undefined)
  expect(await band.find({ text: /^캐시 만료$/ })).toBe(undefined)
})

// 처음 설치 구간: 새 설치는 20만 ~ 25만, 0.3.x 를 쓰던 사람은 설정을 저장한 적이 없어도 쓰던 25만 ~ 30만 그대로. 흔적 = 저장소의 0.3.x 실측값 · 다른 세션의
// 흐름 파일. 세 경우는 준비가 같아 표로 — 시험마다 새 세계라 한 시험에 넣으면 섞인다
for (const c of [
  { name: '0.3.x 실측값이 저장소에 있으면 업데이트(25만 ~ 30만)', store: [['afterCompactTokens', 70_000]] as [string, unknown][], files: [] as string[], range: [250_000, 300_000], text: '250k~300k' },
  { name: '자기 흐름 파일만 있으면 새 설치(20만 ~ 25만)', store: [], files: ['s-me.json'], range: [200_000, 250_000], text: '200k~250k' },
  { name: '저장소엔 흔적이 없어도 다른 세션의 흐름 파일이 있으면 업데이트', store: [], files: ['other-session.json'], range: [250_000, 300_000], text: '250k~300k' },
]) {
  test(`처음 설치 구간: ${c.name}`, async ($, on) => {
    const store = new Map<string, unknown>(c.store)
    mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
    mock.clock(on, { now: Date.parse('2026-10-12T13:00:00Z') })
    on('fs.list', async () => ({ value: c.files.map(name => ({ name, kind: 'file', size: 10, mtimeMs: 1 })) }))
    on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
    on('session.id', async () => ({ value: 's-me' }))
    on('session.cwd', async () => ({ value: 'D:/Claude' }))
    on('session.model', async () => ({ value: 'claude-opus-5-5' }))
    on('session.surfaces', async () => ({ value: ['desktop'] }))
    on('command.register', async (_$, e) => ({ value: { command: e.name } }))
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 120_000, window: 1_000_000, percent: 12 }, rateLimits: [], cost: { usd: 1 } } }))
    on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
    on('store.keys', async () => ({ value: [...store.keys()] }))
    on('store.set', async (_$, e) => {
      store.set(e.key, e.value)
      return { value: undefined }
    })
    on('ui.panes', async () => ({ value: [] }))
    on('ui.open', async () => ({ value: { isPlaced: true } }))
    await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
    // 처음 화면은 간단 — 설치 · 업데이트 둘 다
    expect(store.get('settings')).toEqual({ rangeStart: c.range[0], rangeEnd: c.range[1], screen: 'simple' })
    const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
    expect(await band.find({ text: c.text })).not.toBe(undefined)
    // 한 번 정하면 그대로(이미 저장값이 있다)
    expect(store.get('settings')).toEqual({ rangeStart: c.range[0], rangeEnd: c.range[1], screen: 'simple' })
  })
}

test('저장 턴 · 컴팩트 몫 실측: 식은 캐시 때 것이 섞여도 셈이 부풀지 않는다(저장 턴은 가운데 값, 읽기 절반 아래 몫은 버림)', async ($, on) => {
  // 이 PC(2026-10-12): 저장 턴 다섯 중 하나가 식은 캐시라 새로 씀 25만 — 평균이면 5만으로 부풀었다. 0.3.x 는 식은 캐시의 컴팩트
  // 몫(정가 입력 위주)도 남겨 다음 손익이 7배쯤 비싸 보였다
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>([
    ['afterCompactTokens', 94_000],
    ['saveTurns', [{ steps: 3, output: 2_000, write: 2_000 }, { steps: 3, output: 2_000, write: 2_000 }, { steps: 2, output: 2_000, write: 251_707 }]],
    ['compactMix', { input: 0.7, read: 0.3, write: 0 }],
  ])
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-save' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 300_000, window: 1_000_000, percent: 30 }, rateLimits: [], cost: { usd: 1 } } }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  await $.command.run({ command: 'easy-compact', args: '' })
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  await openSettings(pane)
  // 컴팩트 한 번(직후 94k): 저장 턴(가운데 값: 요청 3 · 출력 2천 · 새로 씀 2천) $0.11 + 컴팩트 요청(캐시 읽기 — 식은 몫은 버림)
  // $0.02 + 요약 출력 $0.20 + 요약 다시 쓰기 $0.24 ≈ $0.57. 평균이면 +$0.68, 식은 몫이면 +$0.25
  expect(await pane.find({ text: /컴팩트 한 번 \$0\.57/ })).not.toBe(undefined)
})

test('다시 연 세션의 컴팩트 직후(첫 요청 전 · 엔진 컨텍스트 0)엔 "컨텍스트 0" 대신 직후 크기 추정값', async ($, on) => {
  // 컴팩트한 세션의 띠가 "컨텍스트 0" — 지난 컴팩트의 직후 크기(94k)로 추정한다
  const r = recordAt(Date.now() - 30 * 60_000)
  const band = await mountFromTranscript($, on, [r.asst('a', 300_000, 1), r.compact(2, 300_000), r.asst('b', 94_000, 3), r.asst('c', 200_000, 4), r.compact(5, 200_000)], 0)
  expect(await band.find({ text: '컨텍스트 0' })).toBe(undefined)
  expect(await band.find({ text: /^컨텍스트 ~/ })).not.toBe(undefined)
  expect(await band.find({ text: ' 컴팩트 직후' })).not.toBe(undefined)
  // 첫 요청 전에도 캐시 남은 분 — 컴팩트 시각(25분 전)부터 센다. 컴팩트 요청이 앞부분 캐시를 읽어 시간이 새로 시작된다.
  // 0.3.1 의 "캐시 없음(다음 요청이 새로 씀)" 은 뜻을 모르겠고 필요 없었다(얼리버드)
  expect(await band.find({ text: /^3[45]분 남음$/ })).not.toBe(undefined)
  expect(await band.find({ text: /캐시 없음/ })).toBe(undefined)
  // 지난 질문 줄(컴팩트 전 저장 턴의 "캐시 다시 씀")은 숨긴다 — 지금 일처럼 읽혔다
  expect(await band.find({ text: /^지난 질문/ })).toBe(undefined)
  // 방금 컴팩트해 아낄 게 없다 — 버튼은 흐리게, 툴팁에 손해
  expect((await band.find({ key: 'compact' }))?.props.dimColor).toBe(true)
  expect(await band.find({ text: /^지금 컴팩트하면 손해/ })).not.toBe(undefined)
  // 카드도 같은 판정 — 74k → 72k 에 "요청 1회당 ~$0.00 아낌"(초록)이 보였다
  await band.press({ key: 'compact' })
  const card = JSON.stringify(await band.find({ key: 'confirm' }))
  expect(card).toContain('아낄 게 거의 없음 — 지금 컴팩트하면 손해')
  expect(card).not.toContain('아낌')
})

test('터미널(CLI) 세션의 사용량 패널은 자기 것만: 데스크톱 세션들이 같이 쓰는 $.store 열림 값을 안 따르고 안 바꾼다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 데스크톱 세션이 패널을 열어 둔 상태 — 예전엔 CLI 의 usage 가 이 값을 보고 "닫기"로 뒤집었다
  const store = new Map<string, unknown>([['pane', { view: 'usage' }]])
  const world = paneWorld(on, ['terminal'], store)
  // 타이머(1.5초마다 패널 맞추기)는 session.start 에서 건다
  await $.session.start({ cwd: 'D:/Claude', surface: 'terminal', isInteractive: true })

  const opened = await $.command.run({ command: 'easy-compact', args: 'usage' })
  expect(opened.text ?? '').toMatch(/사용량 패널을 열었습니다/)
  expect(world.isUp).toBe(true)
  expect(JSON.stringify(store.get('pane'))).toBe(JSON.stringify({ view: 'usage' }))
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  // 좁은 터미널(80칸)은 패널 버튼 이름을 짧게 — 최소 바 왼쪽 글이 "이 세션…" 까지만 남았다(2026-10-13 CLI)
  expect(await band.find({ text: /사용량 ✕/ })).not.toBe(undefined)
  // 터미널은 창 버튼 묶음에 바탕색 · 테두리를 안 둔다
  expect(await band.find({ key: 'b-window' })).not.toBe(undefined)
  expect((await band.find({ key: 'b-window' }))?.props.borderStyle).toBe(undefined)
  expect((await band.find({ key: 'b-window' }))?.props.backgroundColor).toBe(undefined)

  // 앱에서 패널을 닫아도(데스크톱 세션이 값을 지움) CLI 패널은 그대로 — 2026-10-11 settings 가 "열었다"고 답한 뒤 사라졌다
  store.delete('pane')
  const asked = world.panesAsked
  await world.clock.advance(3_100)
  expect(world.panesAsked > asked).toBe(true)
  expect(world.isUp).toBe(true)
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  expect(world.isUp).toBe(true)
  expect(store.has('pane')).toBe(false)

  const closed = await $.command.run({ command: 'easy-compact', args: 'usage' })
  expect(closed.text ?? '').toMatch(/사용량 패널을 닫았습니다/)
  expect(world.isUp).toBe(false)
  expect(store.has('pane')).toBe(false)
})

test('같이 열고 닫기(설정)면 사람이 연 · 닫은 것을 떠 있는 다른 데스크톱 세션이 따라 한다 — 이 세션이 시작하기 전 일은 안 따른다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'en', HOME: '/home/test' })
  // 이 세션이 시작하기 전 다른 세션이 연 일 — 따르지 않는다(새 세션의 처음 상태는 자동 열기가 정한다)
  const store = new Map<string, unknown>([
    ['settings', { paneShared: true }],
    ['paneEvent', { view: 'usage', at: Date.parse('2026-10-11T12:00:00Z'), from: 'other' }],
  ])
  const world = paneWorld(on, ['desktop'], store)
  await $.session.start({ cwd: 'D:/Claude', surface: null, isInteractive: false })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(false)

  // 이 세션에서 열면 연 일을 남긴다
  const opened = await $.command.run({ command: 'easy-compact', args: 'usage' })
  expect(opened.text ?? '').toMatch(/Opened the Usage pane/)
  expect(world.isUp).toBe(true)
  expect(store.get('paneEvent')).toMatchObject({ view: 'usage', from: 't-pane' })

  // 다른 데스크톱 세션에서 사람이 닫음 → 1.5초 타이머가 따라 닫는다
  store.set('paneEvent', { view: null, at: world.clock.now() + 1, from: 'other' })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(false)
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ key: 'usage', text: '📊' })).not.toBe(undefined)
  expect(await band.find({ text: 'Open the Usage pane' })).not.toBe(undefined)
  expect((await band.find({ key: 'usage', text: '📊' }))?.props.variant).toBe('secondary')
  // 다른 세션이 열면 따라 연다 — 바의 📊 는 열렸으면 강조 버튼(색 그림이라 흐리게만으론 안 갈렸다)
  store.set('paneEvent', { view: 'usage', at: world.clock.now() + 1, from: 'other' })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(true)
  expect((await band.find({ key: 'usage', text: '📊' }))?.props.variant).toBe('primary')
  expect(await band.find({ text: 'Close the Usage pane' })).not.toBe(undefined)

  // 이 세션에서 닫으면 닫은 일을 남긴다
  const closed = await $.command.run({ command: 'easy-compact', args: 'usage' })
  expect(closed.text ?? '').toMatch(/Closed the Usage pane/)
  expect(store.get('paneEvent')).toMatchObject({ view: null, from: 't-pane' })
})

test('사용량 패널 기본: 자동 열기 끔 · 같이 열고 닫기 켬 — 새 세션은 닫힌 채로, 같이 끄면 세션마다 따로. 두 옵션은 따로 켠다(명령 · 설정 탭)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  // 예전 판(같이가 기본)이 남긴 열림 값 — 새 세션에 들어가 채팅만 쳐도 패널이 저절로 열렸다. 이제 안 쓴다
  const store = new Map<string, unknown>([['pane', { view: 'usage' }]])
  const world = paneWorld(on, ['desktop'], store)
  const run = async (args: string) => String((await $.command.run({ command: 'easy-compact', args })).text)
  await $.session.start({ cwd: 'D:/Claude', surface: null, isInteractive: false })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(false)

  // 같이 열고 닫기는 기본 켬 — 이 세션에서 열면 연 일을 남긴다
  expect(await run('패널')).toMatch(/열었습니다/)
  expect(world.isUp).toBe(true)
  expect(store.get('paneEvent')).toMatchObject({ view: 'usage', from: 't-pane' })
  // 끄면 세션마다 따로 — 다른 세션이 닫아도 안 따른다
  expect(await run('패널 같이 끄기')).toMatch(/^모든 세션 같이 열고 닫기 끔 — /)
  expect(store.get('settings')).toMatchObject({ paneAutoOpen: false, paneShared: false })
  store.set('paneEvent', { view: null, at: world.clock.now() + 1, from: 'other' })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(true)

  // 옵션 둘은 따로(한국어 · 영어 명령)
  expect(await run('패널 자동 켜기')).toMatch(/^새 세션에서 자동으로 열기 켬 — /)
  expect(store.get('settings')).toMatchObject({ paneAutoOpen: true, paneShared: false })
  expect(await run('panel share on')).toMatch(/^모든 세션 같이 열고 닫기 켬 — /)
  expect(store.get('settings')).toMatchObject({ paneAutoOpen: true, paneShared: true })
  // 켜기 전에 남은 일은 안 따른다(켠 뒤 사람이 연 · 닫은 것부터)
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(true)

  // 설정 탭: 맨 위 "화면" 칸의 [세부] 안에 패널 두 옵션(0.4.0 — 바 · 패널 칸을 화면 한 칸으로)
  await run('settings')
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  expect(await pane.find({ key: 'pane-auto-on' })).toBe(undefined)
  await openSettings(pane)
  expect(await pane.find({ key: 'pane-auto-on', text: '✓ 새 세션에서 열기' })).not.toBe(undefined)
  expect(await pane.find({ key: 'pane-sync-on', text: '✓ 모든 세션 같이' })).not.toBe(undefined)
  await pane.press({ key: 'pane-auto-off' })
  await pane.press({ key: 'pane-sync-off' })
  expect(store.get('settings')).toMatchObject({ paneAutoOpen: false, paneShared: false })
  expect(await pane.find({ key: 'pane-auto-off', text: '✓ 끄기' })).not.toBe(undefined)
})

test('새 세션에서 자동으로 열기: 처음 보는 세션만 시작할 때 연다 — 닫은 뒤 mod 를 다시 불러와도(session.start) 또 열지 않는다', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>([['settings', { paneAutoOpen: true }]])
  const world = paneWorld(on, ['desktop'], store)
  const run = async (args: string) => String((await $.command.run({ command: 'easy-compact', args })).text)
  await $.session.start({ cwd: 'D:/Claude', surface: null, isInteractive: false })
  await world.clock.advance(1_600)
  expect(world.isUp).toBe(true)
  expect(store.get('paneAutoOpened')).toEqual(['t-pane'])

  // 사람이 닫으면 닫힌 채로 — mod 를 다시 불러와도(session.start 가 다시 온다) 본 세션이라 안 연다
  expect(await run('패널 닫기')).toMatch(/닫았습니다/)
  expect(world.isUp).toBe(false)
  await $.session.start({ cwd: 'D:/Claude', surface: null, isInteractive: false })
  await world.clock.advance(3_100)
  expect(world.isUp).toBe(false)
  expect(store.get('paneAutoOpened')).toEqual(['t-pane'])
})

test('영어 띠 질문 줄: 요청 한 번이면 "1 request"(단수), 두 번이면 "2 requests"', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'en', HOME: '/home/test' })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-plural' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 100_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  const ask = async (turnId: string, steps: number) => {
    await $.turn.start({ text: 'question', turnId })
    for (let index = 0; index < steps; index++) {
      for await (const _ of $.turn.step({ turnId, index, model: 'claude-opus-5-5', messageCount: 1 })) {
        // 결과만 필요하다
      }
    }
    await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId, reason: 'answer' })
  }
  await ask('p1', 1)
  const one = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await one.find({ text: ' · 1 request' })).not.toBe(undefined)
  expect(await one.find({ text: /1 requests/ })).toBe(undefined)
  await ask('p2', 2)
  const two = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  expect(await two.find({ text: ' · 2 requests' })).not.toBe(undefined)
})

/** 띠 보기 시험 공통: 구독 세션(5시간 · 7일), 컨텍스트는 tokens() 로, 저장소는 store. panes = 패널 흉내까지(패널 시험은 따로 건다) */
function bandWorld(on: On, store: Map<string, unknown>, tokens: () => number, panes = true) {
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-band' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: tokens(), window: 1_000_000, percent: tokens() / 10_000 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 41, resetsAt: new Date(Date.now() + 80 * 60_000).toISOString(), source: 'test' },
        { kind: 'seven_day', percentUsed: 23, source: 'test' },
      ],
      cost: { usd: 1 },
    },
  }))
  on('clock.now', async () => ({ value: Date.now() }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', async (_$, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  if (!panes) return
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
}

test('띠 단축 명령: 최소 ↔ 최대(띠 버튼 · 명령), 필요할 때만 켜면 노랑 전엔 띠가 없고 닿으면 고른 크기로, 안보이기 · 보이기', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  let tokens = 120_000
  bandWorld(on, store, () => tokens)
  // 띠를 안 그릴 땐(next) 엔진 몫 — 시험에선 빈 상자로 대신한다(입력창 아래 모드 줄도)
  on('ui.render', { component: 'AbovePrompt' }, async (_$, e) => {
    const { Box } = _$.ui.resolve(e)
    return <Box key="core" />
  })
  on('ui.render', { component: 'SessionMode' }, async (_$, e) => {
    const { Box } = _$.ui.resolve(e)
    return <Box key="core-mode" />
  })
  const toasts: string[] = []
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await $.command.run({ command: 'easy-compact', args: '' })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const run = async (args: string) => String((await $.command.run({ command: 'easy-compact', args })).text)

  // 최대: 한도 · 캐시 · 이지 컴팩트
  expect(await band.find({ text: '41%' })).not.toBe(undefined)
  expect(await band.find({ text: ' · 캐시 만료까지 ' })).not.toBe(undefined)
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)
  expect(await band.find({ key: 'band-mode', text: '—' })).not.toBe(undefined)
  // 창 제어 버튼(— 최소 · ✕ 접기)의 설명 칩은 숨어 있다가 마우스를 올리면 보인다. ⇲ 자동 숨김은 뺐다 — ✕ 와 같아 보였다
  expect(await band.find({ key: 'band-auto' })).toBe(undefined)
  expect(await band.find({ text: '최소 · 한 줄로 줄이기' })).not.toBe(undefined)
  expect(await band.find({ text: '접기 · 다시 펴기: 입력창 아래 [🔽 이지 컴팩트 ⇱]' })).not.toBe(undefined)
  // 사용량 패널 버튼(📊)은 윗줄 창 버튼 칸 안 맨 앞 — 아랫줄엔 이지 컴팩트 하나. 묶음 표시 없음(테두리는 위아래 줄을 더 먹고, 바탕색은 버튼과 겹쳤다)
  expect(JSON.stringify(await band.find({ key: 'b-r1' }))).toContain('"usage"')
  expect(JSON.stringify(await band.find({ key: 'b-r3' }))).not.toContain('"usage"')
  expect(await band.find({ key: 'usage', text: '📊' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'b-window' }))).toContain('"usage"')
  expect((await band.find({ key: 'b-window' }))?.props.backgroundColor).toBe(undefined)
  expect((await band.find({ key: 'b-window' }))?.props.borderStyle).toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'b-window' }))).toContain('"band-close"')

  // 최소(띠 버튼): 요청당 · 컨텍스트 · 컴팩트 구간 · 캐시 한 줄 + 사용량 패널 버튼(캐시 만료까지 남은 분은 한 줄에도). 한도는 없다
  await band.press({ key: 'band-mode' })
  expect(store.get('settings')).toMatchObject({ band: 'min' })
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  // 최소엔 컴팩트 구간을 뺀다(캐시를 더하자 두 줄로 넘어갔다), 캐시는 짧게 "캐시 만료 N분 남음"
  expect(await band.find({ text: ' · 컴팩트 구간 ' })).toBe(undefined)
  expect(await band.find({ text: '41%' })).toBe(undefined)
  expect(await band.find({ text: ' · 캐시 만료 ' })).not.toBe(undefined)
  // 이지 컴팩트는 최소에서도 늘 — 누르면 확인창
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)
  await band.press({ key: 'compact' })
  expect(await band.find({ key: 'compact-yes' })).not.toBe(undefined)
  await band.press({ key: 'compact-no' })
  expect(await band.find({ key: 'usage' })).not.toBe(undefined)
  expect(await band.find({ key: 'b-panels' })).not.toBe(undefined)
  expect(await band.find({ key: 'band-mode', text: '□' })).not.toBe(undefined)
  // 최대(명령)
  expect(await run('최대')).toMatch(/최대/)
  expect(store.get('settings')).toMatchObject({ band: 'full' })
  expect(await band.find({ text: '41%' })).not.toBe(undefined)

  // 자동 숨김(옛 명령 — 띄어 써도 · 처음 이름 "필요할 때만" 도) = 접고 컴팩트할 때 펴기: 구간(20만 ~ 25만) 시작 전엔 띠를 안 그린다
  expect(await run('자동 숨김 켜기')).toMatch(/^바를 접었습니다/)
  expect(store.get('settings')).toMatchObject({ band: 'full', bandFolded: true, bandAutoOpen: true })
  expect(await band.find({ key: 'core' })).not.toBe(undefined)
  expect(await band.find({ text: '요청당 ' })).toBe(undefined)
  expect(await band.find({ key: 'usage' })).toBe(undefined)
  // 구간에 닿으면 고른 크기(최대)로 저절로 펴진다
  tokens = 210_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ key: 'compact', text: '컴팩트하기 좋은 때' })).not.toBe(undefined)
  expect(await band.find({ text: '41%' })).not.toBe(undefined)
  // 저절로 펴진 바의 ✕ = 지금 급함(노랑)까지는 다시 접어 둔다(이 세션) — 빨강이 되면 다시 펴진다
  expect(await band.find({ text: '다시 접기 · 더 급해지면(빨강 · 캐시 만료) 다시 펴짐' })).not.toBe(undefined)
  await band.press({ key: 'band-close' })
  expect(await band.find({ key: 'core' })).not.toBe(undefined)
  expect(store.get('settings')).toMatchObject({ bandFolded: true, bandAutoOpen: true })
  tokens = 260_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ key: 'compact', text: '컴팩트 늦어짐' })).not.toBe(undefined)
  // 최소면 한 줄 + 파란 🗜 · 짧은 [컴팩트] 버튼 · 📊: 상태 글 대신 강조 버튼 · 깜빡이는 점, 말은 툴팁으로. 누르면 확인창
  tokens = 210_000
  await $.command.run({ command: 'easy-compact', args: '' })
  await run('min')
  expect(await band.find({ text: '41%' })).toBe(undefined)
  expect(await band.find({ key: 'compact', text: '컴팩트하기 좋은 때' })).toBe(undefined)
  expect((await band.find({ key: 'compact', text: '컴팩트' }))?.props.variant).toBe('primary')
  // 🗜 는 버튼 밖에 진한 파랑 글자로(버튼 안 글자는 앱 버튼 색 흰색이었다)
  expect(JSON.stringify(await band.find({ key: 'compact-icon' }))).toContain('"color":"#4c9be8"')
  expect(await band.find({ key: 'compact', text: '🗜' })).toBe(undefined)
  expect(await band.find({ text: '컴팩트하기 좋은 때 · 누르면 컴팩트할까요?' })).not.toBe(undefined)
  expect(await band.find({ key: 'usage', text: '📊' })).not.toBe(undefined)
  expect(await band.find({ text: '사용량 패널 열기' })).not.toBe(undefined)
  // 아이콘만일 땐 창 버튼 묶음 안 맨 앞
  expect(JSON.stringify(await band.find({ key: 'b-window' }))).toContain('"usage"')
  expect(await band.find({ key: 'band-mode' })).not.toBe(undefined)
  await band.press({ key: 'compact' })
  expect(await band.find({ key: 'compact-yes' })).not.toBe(undefined)
  await band.press({ key: 'compact-no' })
  await run('최대')
  // 켜기 · 끄기 없이 치면 번갈아(처음 이름도) — 크기를 고르면 이미 펼침이라 이번엔 접는다
  tokens = 120_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await run('필요할때만')).toMatch(/^바를 접었습니다/)
  expect(await run('필요할때만')).toMatch(/폈습니다/)
  expect(store.get('settings')).toMatchObject({ bandFolded: false })
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  // 바의 ✕(접기): 컴팩트할 때 펴기가 켜져 있으면 토스트에 그 말 — 노랑 전이라 바로 접힌다
  await band.press({ key: 'band-close' })
  expect(store.get('settings')).toMatchObject({ bandFolded: true, bandAutoOpen: true })
  expect(toasts.at(-1)).toBe('이지 컴팩트 바를 접었습니다 — 컴팩트할 때 저절로 펴집니다. 다시 펴기: 입력창 아래 [🔽 이지 컴팩트 ⇱] 를 누르거나 /easy-compact 보이기')
  // 접힌 동안 입력창 아래 모드 줄에 파란 [🔽 이지 컴팩트 ⇱] 하나 — 엔진 모드 글(안쪽)은 앞에 그대로, 누르면 펼침.
  // 이 줄엔 마우스 올리기 칩을 두지 않는다(칩 글이 "자동 …" 으로 늘 보였다) — 버튼 글 말고 다른 글이 없다
  const footer = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'SessionMode', props: { modes: ['focus'] } })
  expect(await footer.find({ key: 'core-mode' })).not.toBe(undefined)
  expect(await footer.find({ key: 'band-reveal', text: '🔽 이지 컴팩트 ⇱' })).not.toBe(undefined)
  expect((await footer.find({ key: 'band-reveal' }))?.props.variant).toBe('primary')
  // 이 줄엔 버튼 하나만 — 버튼 밖 글자는 줄 끝으로 모여 떨어졌다(파란 🗜 가 🌳 뒤로). 색은 🔽 그림 자체
  expect(JSON.stringify(await footer.find({ key: 'ec-mode' }))).not.toContain('"Text"')
  expect(await footer.find({ text: /자동 숨김/ })).toBe(undefined)
  await footer.press({ key: 'band-reveal' })
  expect(store.get('settings')).toMatchObject({ bandFolded: false })
  expect(await footer.find({ key: 'band-reveal' })).toBe(undefined)
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)

  // 컴팩트할 때 펴기를 끄고 접으면(옛 안 보이기) 회색 "닫힘" — 노랑 · 빨강이 와도 접힌 채
  expect(await run('자동펴기 끄기')).toMatch(/끔/)
  expect(await run('안 보이기')).toBe('이지 컴팩트 바를 모든 세션에서 접었습니다. 다시 펴기: 입력창 아래 [🔽 이지 컴팩트 닫힘 ⇱] 를 누르거나 /easy-compact 보이기')
  expect(store.get('settings')).toMatchObject({ bandFolded: true, bandAutoOpen: false })
  expect(await band.find({ key: 'core' })).not.toBe(undefined)
  tokens = 260_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await band.find({ key: 'core' })).not.toBe(undefined)
  expect(await footer.find({ key: 'band-reveal', text: '🔽 이지 컴팩트 닫힘 ⇱' })).not.toBe(undefined)
  // 닫았으면 회색(강조 버튼 아님 · dim)
  expect((await footer.find({ key: 'band-reveal' }))?.props.variant).toBe('secondary')
  expect((await footer.find({ key: 'band-reveal' }))?.props.dimColor).toBe(true)
  tokens = 120_000
  await $.command.run({ command: 'easy-compact', args: '' })
  expect(await run('보이기')).toMatch(/^이지 컴팩트 바를 폈습니다/)
  expect(store.get('settings')).toMatchObject({ bandFolded: false, bandAutoOpen: false })
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  // 크기를 고르면 접기도 풀린다(보려고 고른 것)
  await run('hide')
  await run('최대')
  expect(store.get('settings')).toMatchObject({ band: 'full', bandFolded: false })
  await run('자동펴기 켜기')

  // 모르는 말엔 한 줄만(명령 출력은 대화 기록에 남는다) — 사람에게 보이는 명령은 보이기 · 안보이기뿐, 나머지는 바의 버튼
  expect(await run('이거 스킬처럼 입력하니깐')).toBe('모르는 명령입니다. 명령은 /easy-compact 보이기 · 안보이기 — 나머지는 바의 버튼(📊 패널 · ⚙ 설정 탭)')
  const help = await run('?')
  expect(help).toMatch(/^\/easy-compact 보이기 \| 안보이기 /)
  expect(help.split('\n').length).toBe(2)
  // 숨은 명령(테스트 · 예전 사용법)은 도움말에 안 나온다
  for (const hidden of ['최소', '최대 ', 'settings', 'set ', '문구', 'lang', '자동숨김']) expect(help.includes(hidden)).toBe(false)
  // 예전 이름(툴바)으로 쳐도 칸 명령
  expect(await run('툴바')).toMatch(/^이지 컴팩트 바: 펼침 · 최대/)
})

test('패널 단축 명령: /easy-compact 패널 [열기|닫기] — 띠가 없어도 사용량 패널을 열고 닫는다(없이 치면 번갈아)', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  bandWorld(on, store, () => 120_000, false)
  const opened: string[] = []
  const closed: string[] = []
  let panes: { id: string }[] = []
  on('ui.panes', async () => ({ value: panes }))
  on('ui.open', async (_$, e) => {
    opened.push(e.id)
    panes = [{ id: e.id }]
    return { value: { isPlaced: true } }
  })
  on('ui.close', async (_$, e) => {
    closed.push(e.id)
    panes = []
    return { value: undefined }
  })
  const run = async (args: string) => String((await $.command.run({ command: 'easy-compact', args })).text)
  await run('안보이기')
  expect(await run('패널 열기')).toMatch(/열었습니다/)
  expect(opened).toEqual(['easy-compact'])
  expect(await run('패널 닫기')).toMatch(/닫았습니다/)
  expect(closed).toEqual(['easy-compact'])
  expect(await run('패널')).toMatch(/열었습니다/)
  expect(await run('panel')).toMatch(/닫았습니다/)
  // 예전 이름 usage 도
  expect(await run('usage')).toMatch(/열었습니다/)
  // 설정 탭을 보다 닫고 다시 열면 사용량 탭부터(설정은 /easy-compact settings 로)
  await run('settings')
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  expect(await pane.find({ key: 'pane-settings', text: '✓ ⚙ 설정' })).not.toBe(undefined)
  await run('패널 닫기')
  await run('패널 열기')
  expect(await pane.find({ key: 'pane-usage', text: /^✓/ })).not.toBe(undefined)
  expect(await pane.find({ key: 'pane-settings', text: '⚙ 설정' })).not.toBe(undefined)
})

test('설정 탭: 화면 프리셋 셋(간단 · 자세히 · 커스텀) — 프리셋 세부는 글로만(못 누름), 커스텀에서 칸 · 정보량을 고르고, 바 · 패널(창 상태)은 따로', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const store = new Map<string, unknown>()
  bandWorld(on, store, () => 120_000)
  const toasts: string[] = []
  on('ui.toast', async (_$, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 60, placement: 'dock' } })
  const band = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'AbovePrompt', props: BAND })
  const run = async (args: string) => String((await $.command.run({ command: 'easy-compact', args })).text)
  const saved = () =>
    store.get('settings') as {
      screen: string
      custom: { bandShow: Record<string, boolean>; info: string }
      sessionColors: number[]
      limitShow: Record<string, boolean>
    }

  // 설정 탭: 화면 → 한도 줄 → 세션 금액 색 → 바 · 패널 → 컴팩트 시점 → 문구 → 캐시 → 언어. 처음엔 화면만 펼침, 나머지는 접혀 제목 줄에 지금 값
  const order = JSON.stringify(await pane.find({ key: 's-settings' }))
  const at = ['set-screen', 'set-window', 'set-compact', 'set-tidy', 'set-cache', 'set-lang'].map(k => order.indexOf(`"${k}"`))
  expect(at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1]!))).toBe(true)
  expect(await pane.find({ type: 'Text', text: '화면' })).not.toBe(undefined)
  // 언어: 아직 모르면 그냥 "자동", 알면 "자동(한국어)" — "자동(?)" 은 고장처럼 보였다
  expect(await pane.find({ text: /^자동(\(.+\))?$/ })).not.toBe(undefined)
  expect(await pane.find({ text: /\?\)$/ })).toBe(undefined)
  expect(await pane.find({ key: 'cmp-mode' })).toBe(undefined)
  expect(await pane.find({ text: '구간 200k ~ 250k' })).not.toBe(undefined)
  expect(await pane.find({ text: '펼침 · 최대' })).not.toBe(undefined)
  // 프리셋 셋(간단 · 자세히 · 커스텀 — 0.4.0 의 기본은 뺐다), 고른 것의 대상 풀이, 바 미리보기. 세부도 펼침
  for (const p of ['simple', 'detail', 'custom']) expect(await pane.find({ key: `screen-${p}` })).not.toBe(undefined)
  expect(await pane.find({ key: 'screen-basic' })).toBe(undefined)
  expect(JSON.stringify(await pane.find({ key: 'band-preview' }))).toContain('이 세션 ')
  // 끝난 질문이 없는 새 세션이면 질문 비용 견본은 예시 값 — 예시라고 적는다
  const pv = JSON.stringify(await pane.find({ key: 'screen-preview' }))
  expect(pv).toContain('아래 견본은 예시 값입니다 — 첫 답변이 끝나면 이 세션 값으로 바뀝니다.')
  expect(pv).toContain('이 질문 $0.36 · 요청 4회')
  expect(pv).toContain('아래 견본은 이 세션 값입니다.')
  expect(await pane.find({ key: 'info-row' })).not.toBe(undefined)
  expect(await pane.find({ key: 'common-head' })).not.toBe(undefined)
  // 간단(처음 쓰는 분 · 정보 최소): 바는 한 줄 고정 — 이 세션 금액 · 컨텍스트 · 캐시 · 이지 컴팩트만, 한도 줄도 [—] 도 없다
  //. 최소로 해 둬도 같은 한 줄(캐시 칸 그대로)
  await pane.press({ key: 'screen-simple' })
  expect(saved()).toMatchObject({ screen: 'simple' })
  expect(await pane.find({ text: /^처음 쓰는 분, 토큰 · 캐시 같은 AI 비용 이야기가 낯선 분/ })).not.toBe(undefined)
  expect(await band.find({ type: 'Text', text: '이 세션 ' })).not.toBe(undefined)
  expect(await band.find({ text: '5시간' })).toBe(undefined)
  expect(await band.find({ text: '요청당 ' })).toBe(undefined)
  expect(await band.find({ text: ' · 캐시 만료까지 ' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'b-r1' }))).toContain('"compact"')
  expect(await band.find({ key: 'b-r2' })).toBe(undefined)
  expect(await band.find({ key: 'band-mode' })).toBe(undefined)
  // 미리보기 창 버튼도 바와 같게 — 간단엔 [—] 가 없다("📊  —  ✕" 가 나왔다 — 공개 세션 발견, 2026-10-13)
  const pvSimple = JSON.stringify(await pane.find({ key: 'screen-preview' }))
  expect(pvSimple).toMatch(/📊 {2}✕|\[사용량\] \[✕\]/)
  expect(pvSimple).not.toMatch(/📊 {2}— {2}✕|\[사용량\] \[—\]/)
  await run('최소')
  expect(await band.find({ text: ' · 캐시 만료까지 ' })).not.toBe(undefined)
  expect(await band.find({ key: 'band-mode' })).toBe(undefined)
  await run('최대')
  // 미리보기도 같은 화면 값(한도 줄 없음)
  expect(JSON.stringify(await pane.find({ key: 'band-preview' }))).not.toContain('요청당 ')
  expect(JSON.stringify(await pane.find({ key: 'band-preview' }))).not.toContain('5시간')
  // 자세히: 한도 · 요청당 · 질문 줄까지(이지 컴팩트는 셋째 줄), [—] 로 최소 한 줄 — 최소에도 캐시 만료까지 남은 분
  await pane.press({ key: 'screen-detail' })
  expect(saved()).toMatchObject({ screen: 'detail' })
  expect(await pane.find({ text: /^AI 를 잘 아는 분/ })).not.toBe(undefined)
  expect(await band.find({ text: '5시간' })).not.toBe(undefined)
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'b-r3' }))).toContain('"compact"')
  expect(JSON.stringify(await pane.find({ key: 'band-preview' }))).toContain('요청당 ')
  expect(await band.find({ key: 'band-mode' })).not.toBe(undefined)
  await run('최소')
  expect(await band.find({ text: '5시간' })).toBe(undefined)
  expect(await band.find({ text: ' · 캐시 만료 ' })).not.toBe(undefined)
  await run('최대')
  await openSettings(pane)
  // 간단이면 설정의 컴팩트 시점도 최소: 표는 크기 구간 · 판정만, 풀이는 한 줄(비용 칸 · 계산 값은 자세히에서 — 사용자: 간단은 정보 최소)
  const has = async (k: string) => (await pane.find({ key: k })) !== undefined
  expect({ read: await has('h-read'), q: await has('cmp-q') }).toEqual({ read: true, q: true })
  await pane.press({ key: 'screen-simple' })
  expect({ read: await has('h-read'), pen: await has('h-pen'), q: await has('cmp-q'), lean: await has('cmp-lean'), limits: ((await pane.find({ key: 'limits-use' }))?.text ?? '').includes('간단 화면은 바가 한 줄이라') }).toEqual({ read: false, pen: false, q: false, lean: true, limits: true })
  // 캐시 칸: 정보량 최소면 칸째 뺀다 — 바꿀 것이 없고 남은 시간은 바에 있다. 이득 · 손해는 바 · 버튼 · 확인창이 그때 말한다
  expect({ section: await has('set-cache'), state: await has('cache-state'), warn: await has('cache-up') }).toEqual({ section: false, state: false, warn: false })
  await pane.press({ key: 'screen-detail' })
  // 정보량 전부면 이 세션 숫자로 푼 설명 · 노랑 기준 · 바꾸기까지
  expect({ state: await has('cache-state'), why: await has('cache-why'), warn: await has('cache-up') }).toEqual({ state: true, why: true, warn: true })
  // 프리셋의 세부는 글로만 — 버튼이 아니라 눌러지지 않는다
  expect(await pane.find({ text: '자세히 화면의 값입니다 — 바꾸려면 [커스텀]' })).not.toBe(undefined)
  expect((await pane.find({ key: 'show-cache' }))?.type).toBe('Box')
  // 한도 줄 · 세션 금액 색은 화면과 따로 — 프리셋이어도 버튼, 눌러도 화면은 그대로
  expect((await pane.find({ key: 'show-resets' }))?.type).toBe('Button')
  expect(await band.find({ text: /후 리셋/ })).not.toBe(undefined)
  await pane.press({ key: 'show-resets' })
  expect(saved()).toMatchObject({ screen: 'detail', limitShow: { resets: false, fiveHour: true } })
  expect(await band.find({ text: /후 리셋/ })).toBe(undefined)
  expect(await band.find({ text: '5시간' })).not.toBe(undefined)
  await pane.press({ key: 'show-fiveHour' })
  expect(await band.find({ text: '5시간' })).toBe(undefined)
  expect(await band.find({ text: '7일' })).not.toBe(undefined)
  // 한도 묶음: [한도 전체] 로 5시간 · 7일 · 리셋을 한꺼번에 — 다 끄면 한도 줄이 없어 비용 줄이 맨 윗줄로
  await pane.press({ key: 'show-limits' })
  expect(saved().limitShow).toEqual({ fiveHour: false, sevenDay: false, resets: false })
  expect(await band.find({ text: '7일' })).toBe(undefined)
  expect(JSON.stringify(await band.find({ key: 'b-r1' }))).toContain('요청당 ')
  await pane.press({ key: 'show-limits' })
  expect(saved().limitShow).toEqual({ fiveHour: true, sevenDay: true, resets: true })
  expect(await band.find({ text: '5시간' })).not.toBe(undefined)
  // 세션 금액 색 기준(−/+) — 오름차순을 지킨다(노랑은 주황을 못 넘는다), 화면은 그대로
  expect((await pane.find({ key: 'color-0-up' }))?.type).toBe('Button')
  await pane.press({ key: 'color-0-down' })
  expect(saved()).toMatchObject({ screen: 'detail', sessionColors: [5, 50, 100] })
  for (let i = 0; i < 12; i++) await pane.press({ key: 'color-0-up' })
  expect(saved().sessionColors[0]).toBe(30)
  await pane.press({ key: 'color-2-up' })
  expect(saved().sessionColors).toEqual([30, 50, 150])
  // 바 · 패널(창 상태)은 어느 화면에서든 버튼: 크기 · 접기 · 컴팩트할 때 펴기
  expect(await pane.find({ key: 'band-full', text: '✓ 최대' })).not.toBe(undefined)
  expect(await pane.find({ key: 'fold-off', text: '✓ 펼침' })).not.toBe(undefined)
  expect(await pane.find({ key: 'autoopen-on', text: '✓ 저절로 펴기' })).not.toBe(undefined)
  await pane.press({ key: 'autoopen-off' })
  expect(store.get('settings')).toMatchObject({ bandAutoOpen: false })
  await pane.press({ key: 'autoopen-on' })

  // 커스텀: 처음 고르면 지금 화면(자세히) 값에서 시작 — 세부가 버튼
  await pane.press({ key: 'screen-custom' })
  expect(saved()).toMatchObject({ screen: 'custom', custom: { info: 'full' } })
  expect((await pane.find({ key: 'show-cache' }))?.type).toBe('Button')
  // 정보량(패널 처음 보기도 이것이 정한다 — 패널 보기 줄을 합쳤다)
  await pane.press({ key: 'info-lean' })
  expect(saved().custom.info).toBe('lean')
  // 프리셋에서 가져오기 — 처음부터 다시(금액 색 · 한도 줄은 화면 밖 값이라 그대로)
  await pane.press({ key: 'custom-from-detail' })
  expect(saved()).toMatchObject({ screen: 'custom', custom: { info: 'full' }, sessionColors: [30, 50, 150] })
  // 다른 화면을 골랐다 돌아와도 커스텀 값은 남는다
  await pane.press({ key: 'show-cache' })
  await pane.press({ key: 'screen-detail' })
  expect(await band.find({ text: ' · 캐시 만료까지 ' })).not.toBe(undefined)
  await pane.press({ key: 'screen-custom' })
  expect(saved().custom.bandShow.cache).toBe(false)
  expect(await band.find({ text: ' · 캐시 만료까지 ' })).toBe(undefined)

  // 명령(영 · 한 이름 다): 프리셋에서 칸 명령을 치면 커스텀으로 — 그렇다고 답에 적는다. 한도 칸 명령은 화면 그대로
  await pane.press({ key: 'screen-detail' })
  expect(await run('band resets off')).not.toMatch(/커스텀/)
  expect(saved()).toMatchObject({ screen: 'detail', limitShow: { resets: false } })
  expect(await run('band cache off')).toMatch(/화면을 커스텀으로 바꿨습니다/)
  expect(saved()).toMatchObject({ screen: 'custom' })
  expect(saved().custom.bandShow.cache).toBe(false)
  // 비용 줄 칸을 다 끄면(이 세션 포함) 줄째 빠진다 — 이지 컴팩트 버튼은 그대로
  for (const p of ['세션', '요청당', 'context', '구간']) await run(`띠 ${p} 끄기`)
  expect(await band.find({ key: 'b-r2' })).toBe(undefined)
  expect(await band.find({ key: 'compact' })).not.toBe(undefined)
  await run('band question off')
  expect(saved().custom.bandShow.lastTurn).toBe(false)
  // 질문 줄도 끄고 비용 줄 칸도 없으면 이지 컴팩트는 셋째 줄에 그대로(한도 줄만 있음)
  expect(JSON.stringify(await band.find({ key: 'b-r3' }))).toContain('"compact"')
  // 모두 보이기(명령) — 한도 줄도
  await run('band all on')
  expect(await band.find({ text: '요청당 ' })).not.toBe(undefined)
  expect(await band.find({ text: '5시간' })).not.toBe(undefined)
  expect(await band.find({ text: /후 리셋/ })).not.toBe(undefined)
  // 화면 명령
  // 0.4.0 의 기본은 자세히로(바가 같았다)
  expect(await run('화면 기본')).toBe('화면을 자세히(으)로 바꿨습니다.')
  expect(saved()).toMatchObject({ screen: 'detail' })
  // 최소로 바꿔도 칸 설정은 남는다
  await pane.press({ key: 'band-min' })
  expect(store.get('settings')).toMatchObject({ band: 'min' })
  // 접기도 설정 탭에서 — 접은 직후 다시 펴는 법을 토스트로(✕ · 명령과 같은 말)
  await pane.press({ key: 'fold-on' })
  expect(store.get('settings')).toMatchObject({ bandFolded: true })
  expect(toasts.at(-1)).toMatch(/^이지 컴팩트 바를 접었습니다 — 컴팩트할 때 저절로 펴집니다\. 다시 펴기: .* \/easy-compact 보이기$/)
})

test('한도 줄 칸: 요청이 끝났는데도 엔진이 한도를 안 주면(API 키 등) 설정 탭에서 뺀다 — 첫 응답 전엔 구독도 비어 있어 둔다', async ($, on) => {
  // 사용자, 2026-10-13: API 를 쓰는 중이면 한도 줄 옵션도 보일 필요가 없다. API 라고 단정하지 않고 "요청이 끝났는데 한도 없음" 으로만
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  const clock = mock.clock(on, { now: Date.parse('2026-10-12T13:00:00Z') })
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock.now(), isLink: false } }))
  on('session.id', async () => ({ value: 't-nolimits' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { tokens: 100_000, window: 1_000_000, percent: 10 }, rateLimits: [], cost: { usd: 1 } } }))
  on('store.get', async (_$, e) => ({ value: e.key === 'settings' ? { screen: 'detail' } : undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('agent.list', async () => ({ value: [] }))
  on('turn.step', async function* (_$, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: { input_tokens: 0, output_tokens: 1_000, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 0, model: 'claude-opus-5-5' } }
  })
  await $.session.start({ cwd: 'D:/Claude', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'easy-compact', args: 'settings' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 80, placement: 'dock' } })
  // 첫 응답 전: 모른다 — 줄을 둔다(화면 → 세부 아래 모든 화면 공통, 세부는 처음부터 펼침)
  expect(await pane.find({ key: 'limits-row' })).not.toBe(undefined)
  await $.turn.start({ text: '해 줘', turnId: 't1' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1 })) {
    // 결과만
  }
  await $.turn.complete({ answer: '했습니다', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  // 요청이 끝났는데도 한도가 없다 — 칸을 뺀다(다른 칸은 그대로)
  expect(await pane.find({ key: 'limits-row' })).toBe(undefined)
  expect(await pane.find({ key: 'session-colors' })).not.toBe(undefined)
})
