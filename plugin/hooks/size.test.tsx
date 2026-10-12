import { expect, mock, test } from 'claude-code/testing'

// 패널 크기 한도 지키기(2026-10-13). 데스크톱은 한 번에 받는 그리기에 한도가 있다 — 넘으면 패널이 통째로 안 그려진다
// ("Nothing to show yet", 버튼 먹통). 한 세션에서 질문별 비용 "전체" 60줄(자세히)로 실제로 걸렸다. 엔진 문서는 같은 한도를
// 여러 곳에 적는다(Client 트리 "20,000 노드 · 32 깊이 · 직렬화 100,000자", Client props · post · 글 칸 100,000자) — 훅이 그리는
// 패널 트리도 같은 한도로 본다. 이 시험은 가장 무거운 화면을 그려 크기 · 노드 수 · 깊이가 여유 선 안인지 본다.
// 실물 기록(이 시험과 같은 잼): 8.1만 자 그려짐 · 9.6만 자 거부 → 크기 여유 선 7.5만

type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[]; text?: string }

/** 그린 트리의 직렬화 크기(맨 위 요소에 붙는 모은 글 text 는 시험 도구 것이라 뺌) · 노드 수 · 깊이 */
function measure(root: Node | undefined) {
  let nodes = 0
  let depth = 0
  const walk = (n: unknown, d: number) => {
    if (!n || typeof n !== 'object') return
    nodes++
    depth = Math.max(depth, d)
    for (const c of (n as Node).children ?? []) walk(c, d + 1)
  }
  walk(root, 1)
  const { text: _text, ...rest } = root ?? {}
  return { chars: JSON.stringify(rest).length, nodes, depth }
}

test('패널 크기 한도: 질문 60개 · 동작 많은 세션에서 가장 무거운 사용량 · 설정 화면도 한도 안', async ($, on) => {
  mock.env(on, { EASY_COMPACT_LANG: 'ko', HOME: '/home/test' })
  let clock = Date.parse('2026-10-11T09:00:00Z')
  const store = new Map<string, unknown>()
  on('fs.list', async () => ({ value: [] }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: clock, isLink: false } }))
  on('session.id', async () => ({ value: 't-size' }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: 300_000, window: 1_000_000, percent: 30 },
      rateLimits: [
        { kind: 'five_hour', usedPercent: 42, resetsAt: clock + 3_600_000 },
        { kind: 'seven_day', usedPercent: 17, resetsAt: clock + 86_400_000 },
      ],
      cost: { usd: 214 },
    },
  }))
  on('clock.now', async () => ({ value: (clock += 1000) }))
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  // 질문마다 요청 8회: 도구 7번(이름 · 경로가 긴 것 섞어) + 답. 맨 위(마지막) 질문과 진행 중 질문은 요청 70회 — 질문마다
  // 동작 기록은 60개까지만 남아(register.tsx details slice(-60)) 펼친 질문 · 진행 중 질문의 동작 줄이 가장 많은 경우
  const STEPS = 8
  const BIG = 70
  const stepsOf = (turnId: string) => (turnId === 'q60' || turnId === 'live' ? BIG : STEPS)
  // 같은 이름 동작은 한 줄로 합쳐지니 큰 질문은 파일마다 다른 이름
  const bigTool = (i: number) => ({ name: 'Edit', input: { file_path: `C:/Users/someone/.claude/mods/easy-compact/hooks/file-${i}-with-a-long-name.tsx` } })
  const tools = [
    { name: 'Bash', input: { command: 'cd ~/.claude/mods/easy-compact && node tools/test-fast.mjs > /tmp/out.txt 2>&1; tail -3 /tmp/out.txt' } },
    { name: 'Edit', input: { file_path: 'C:/Users/someone/.claude/mods/easy-compact/hooks/register.tsx' } },
    { name: 'Read', input: { file_path: 'C:/Users/someone/.claude/mods/easy-compact/hooks/ui-usage.tsx' } },
    { name: 'Grep', input: { pattern: 'questionScope|historyRow|drawHistory' } },
    { name: 'Agent', input: { description: '패널 크기 한도 조사', prompt: '조사' } },
  ]
  on('turn.step', async function* (_$, e) {
    const isBig = stepsOf(e.turnId) === BIG
    const isLast = e.index === stepsOf(e.turnId) - 1
    return {
      turnId: e.turnId,
      index: e.index,
      answer: '',
      toolUses: isLast ? [] : [isBig ? bigTool(e.index) : tools[e.index % tools.length]!],
      stopReason: isLast ? 'end_turn' : 'tool_use',
      usage: { input_tokens: 10, output_tokens: 900, cache_read_input_tokens: 300_000, cache_creation_input_tokens: 3_000, model: 'claude-opus-5-5' },
    }
  })
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  // 질문 글은 길게(실제 질문처럼 두세 줄)
  const prompt = (n: number) =>
    `${n}번 질문: 사용량 패널에서 질문별 비용을 전체로 보면 패널이 안 그려지는 문제가 있는데 원인이 무엇인지 확인하고, 크기 한도 때문이면 최근 30개까지만 줄로 그리고 그 앞은 합계 한 줄로 바꿔 줘. 그리고 시험도 돌려 줘.`
  for (let n = 1; n <= 60; n++) {
    await $.turn.start({ text: prompt(n), turnId: `q${n}` })
    for (let i = 0; i < stepsOf(`q${n}`); i++) {
      for await (const _ of $.turn.step({ turnId: `q${n}`, index: i, model: 'claude-opus-5-5', messageCount: 1 + i })) {
        // 결과만 필요하다
      }
    }
    await $.turn.complete({ answer: `답 ${n}`, durationMs: 1, isAborted: false, turnId: `q${n}`, reason: 'answer' })
  }
  // 진행 중 질문(맨 위에 늘 펼쳐 보임) — 끝내지 않는다
  await $.turn.start({ text: prompt(61), turnId: 'live' })
  for (let i = 0; i < BIG - 1; i++) {
    for await (const _ of $.turn.step({ turnId: 'live', index: i, model: 'claude-opus-5-5', messageCount: 1 + i })) {
      // 결과만 필요하다
    }
  }

  await $.command.run({ command: 'easy-compact', args: 'usage' })
  const pane = await $.ui.mount({ plugin: 'easy-compact', surface: 'desktop', component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: 80, placement: 'dock' } })
  // 사용량: 자세히 · 접힌 카드 다 펼침 · 전체(질문 · 흐름 · 컴팩트 효과) · 첫 질문 펼침
  await pane.press({ key: 'pane-detail' })
  for (const b of await pane.findAll({ type: 'Button' })) {
    const key = String(b.props.key ?? '')
    if (key.startsWith('fold-') && b.props.label === '▸') await pane.press({ key })
  }
  for (const key of ['history-all', 'flow-all', 'effects-all']) if (await pane.find({ key, text: '' })) await pane.press({ key })
  if (await pane.find({ key: 'hx-0', text: '' })) await pane.press({ key: 'hx-0' })
  expect(await pane.find({ key: 'hr-29' })).not.toBe(undefined)
  // 펼친 큰 질문은 비싼 동작 PANE_STEPS(20)개 + "그 밖" 한 줄 — 60줄을 다 그리면 이 화면이 86,454자였다(2026-10-13)
  expect(
    await pane.find({ text: /^└─ 그 밖 동작 \d+개 \$\d+\.\d\d — 패널이 한 번에 그릴 수 있는 크기 때문에 비싼 20개까지만 줄로 보입니다$/ }),
  ).not.toBe(undefined)
  expect(await pane.find({ key: 'hd-0-19' })).not.toBe(undefined)
  expect(await pane.find({ key: 'hd-0-20' })).toBe(undefined)
  const usage = measure((await pane.find({ type: 'Box' })) as Node)

  // 설정: 칸 다 펼침 · 세부 · 미리보기 질문 비용 자세히까지
  await pane.press({ key: 'pane-settings' })
  for (const b of await pane.findAll({ type: 'Button' })) {
    const key = String(b.props.key ?? '')
    if (key.startsWith('fold-') && b.props.label === '▸') await pane.press({ key })
  }
  if (await pane.find({ key: 'screen-more', text: '' })) await pane.press({ key: 'screen-more' })
  if (await pane.find({ key: 'pv-fold', text: '▸' })) await pane.press({ key: 'pv-fold' })
  const settings = measure((await pane.find({ type: 'Box' })) as Node)

  // 2026-10-13 잰 값: 사용량 70,057자 · 792 노드 · 깊이 11(진행 중 질문 약 5.4천 · 펼친 질문 약 9.5천 · 질문 줄 하나 약 1.3천 × 30),
  // 설정 38,652자 · 417 노드 · 깊이 15. 조이는 것은 글자 수 하나 — 넘으면 줄 수 상한(ui-usage HISTORY_ALL_MAX · PANE_STEPS ·
  // EFFECTS_ALL_MAX)을 줄이거나 보이는 줄만 그리기(ui.scroll)를 생각한다
  for (const m of [usage, settings]) {
    expect(m.chars).toBeLessThan(75_000)
    expect(m.nodes).toBeLessThan(10_000)
    expect(m.depth).toBeLessThan(24)
  }
})
