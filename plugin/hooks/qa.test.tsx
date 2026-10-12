import type { On, RenderSurface } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// QA 조합 시험(층 ①) — 상태 × 표면 × 언어 × 바 크기 × 폭마다 바 · 확인 카드 · 작업 중 표시 · 답변 아래 줄 · 사용량 패널 · 설정 탭을
// 그려(그릴 수 있는지는 표면 표가 검증한다) 공통 규칙을 본다:
//   ① 화면 글에 undefined · NaN · Infinity · [object Object] 가 없다
//   ② 영어 화면에 한글이 없다(언어 줄 이름 · 한국어 버튼만 두 언어)
//   ③ 권하지 않는 동안(흐린 버튼) 🗜 는 회색, 권하면 파랑 — 확인창을 열어도(바 · 카드 제목) 그대로
//   ④ 캐시가 식었으면 확인창은 캐시 만료 카드이고, 바의 다시 쓰기 금액 = 카드의 이어 가기 금액
//   ⑤ 한도 줄이 없으면(API 키 세션) 비용 줄이 맨 윗줄
// 칠한 화면의 폭(터미널 넘침) · 데스크톱 겹침은 시험 도구가 칠하지 않아 못 본다 — 층 ②(브라우저) · ③(CLI 실물)

type State = 'normal' | 'warn' | 'coldWin' | 'coldLoss' | 'switched' | 'afterCompact' | 'api' | 'working' | 'agent' | 'tidying'
const STATES: State[] = ['normal', 'warn', 'coldWin', 'coldLoss', 'switched', 'afterCompact', 'api', 'working', 'agent', 'tidying']
const SURFACES: RenderSurface[] = ['desktop', 'terminal']
const LANGS = ['ko', 'en'] as const
const BANDS = ['full', 'min'] as const
/** 바 폭(칸) — 60 아래면 자동 숨김 버튼을 빼고, 115 이상이면 확인 카드 줄을 덜 바꾼다. 패널은 그 폭에 맞춘 사이드 패널 폭 */
const WIDTHS = [{ band: 50, pane: 36 }, { band: 100, pane: 60 }, { band: 140, pane: 90 }]

const CTX: Record<State, number> = {
  normal: 120_000,
  warn: 260_000,
  coldWin: 500_000,
  // 공통 앞부분 4.76만을 읽기로 세면 20만도 바로 컴팩트가 이득이다 — 손해 쪽은 13만(이어 가기 ~$0.67 < 컴팩트 ~$0.89)
  coldLoss: 130_000,
  switched: 300_000,
  afterCompact: 300_000,
  api: 120_000,
  working: 150_000,
  agent: 150_000,
  tidying: 260_000,
}
const ANSWER = 'QA answer, last sentence — one question ends right here.'
const BAD = /undefined|NaN|Infinity|\[object Object\]/
const HANGUL = /[가-힣]/
/** 영어 화면에서도 두 언어로 두는 글(언어 줄) */
const BOTH = new Set(['언어 · Language', '[한국어]'])

type Ui = { findAll: (q: { type: string }) => Promise<{ text?: unknown; props: Record<string, unknown> }[]> }

/** 화면에 보이는 글 · 버튼 이름 · 입력칸 안내 · 그림 설명 */
async function shown(ui: Ui): Promise<string[]> {
  const out: string[] = []
  for (const t of await ui.findAll({ type: 'Text' })) out.push(String(t.text ?? ''))
  for (const b of await ui.findAll({ type: 'Button' })) out.push(`[${String(b.props.label ?? '')}]`)
  for (const i of await ui.findAll({ type: 'Input' })) for (const v of [i.props.placeholder, i.props.submitLabel]) if (v !== undefined) out.push(`input:${String(v)}`)
  for (const s of await ui.findAll({ type: 'Svg' })) out.push(`svg:${String(s.props.alt ?? '')}`)
  return out
}

async function rules(ui: Ui, lang: 'ko' | 'en', where: string): Promise<void> {
  const list = await shown(ui)
  expect({ where, bad: list.filter(t => BAD.test(t)) }).toEqual({ where, bad: [] })
  if (lang === 'en') expect({ where, hangul: list.filter(t => HANGUL.test(t) && !BOTH.has(t)) }).toEqual({ where, hangul: [] })
}

/** 상태 하나의 세계: 기록 파일 · 엔진 값 · 저장소 · 모델. 모델은 바꿀 수 있게 돌려준다 */
function world(on: On, s: State, lang: 'ko' | 'en') {
  mock.env(on, { EASY_COMPACT_LANG: lang, HOME: '/home/test' })
  const isCold = s === 'coldWin' || s === 'coldLoss'
  const base = Date.now() - (isCold ? 2 * 24 * 3600_000 : 20 * 60_000)
  const at = (min: number) => new Date(base + min * 60_000).toISOString()
  const ctx = CTX[s]
  // 첫 요청은 공통 앞부분 4.76만을 읽고(다른 세션이 데워 둠) 나머지를 쓴다 — 회사 세션 꼴
  const line = (id: string, read: number, write: number, min: number) =>
    JSON.stringify({ type: 'assistant', timestamp: at(min), message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 500, cache_read_input_tokens: read, cache_creation_input_tokens: write } } })
  const lines = [line('a', 47_594, 12_396, 0), line('b', ctx - 2_010, 2_000, 1)]
  if (s === 'afterCompact') lines.push(JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(2), compactMetadata: { trigger: 'manual', preTokens: ctx } }))
  const store = new Map<string, unknown>()
  const env = { model: 'claude-opus-5-5', submitted: [] as string[] }
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async () => ({ value: lines.join('\n') }))
  on('fs.stat', async () => ({ value: { kind: 'file', size: 1, mtimeMs: Date.now(), isLink: false } }))
  on('session.id', async () => ({ value: `qa-${s}` }))
  on('session.cwd', async () => ({ value: 'D:/Claude' }))
  on('session.model', async () => ({ value: env.model }))
  on('session.usage', async () => ({
    value: {
      startedAt: 0,
      context: { tokens: ctx, window: 1_000_000, percent: ctx / 10_000 },
      rateLimits:
        s === 'api'
          ? []
          : [
              { kind: 'five_hour', percentUsed: 15, resetsAt: new Date(Date.now() + 3 * 3600_000).toISOString() },
              { kind: 'seven_day', percentUsed: 30, resetsAt: new Date(Date.now() + 4 * 24 * 3600_000).toISOString() },
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
  on('ui.panes', async () => ({ value: [] }))
  on('ui.open', async () => ({ value: { isPlaced: true } }))
  on('prompt.submit', async (_$, e) => {
    env.submitted.push(e.text)
    return { text: e.text }
  })
  on('command.run', { command: 'compact' }, async () => ({ text: 'compacted' }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('agent.spawn', async () => ({ model: 'claude-opus-5-5', agentId: 'qa-agent' }))
  on('turn.step', async function* (_$, e) {
    const isAgent = e.agentId !== undefined
    return {
      turnId: e.turnId,
      index: e.index,
      answer: isAgent ? '' : ANSWER,
      toolUses: [],
      stopReason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 2_000,
        cache_read_input_tokens: isAgent ? 0 : ctx - 3_010,
        cache_creation_input_tokens: isAgent ? 20_000 : 3_000,
        model: e.model,
      },
    }
  })
  // 엔진 기본 그림(시험엔 없다) — mod 의 작업 중 표시 · 답변 아래 줄이 감싸는 자리
  on('ui.render', { component: 'Spinner' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.word}</Text>
  })
  on('ui.render', { component: 'AssistantMessage' }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.text}</Text>
  })
  return env
}

for (const s of STATES)
  for (const surface of SURFACES)
    for (const lang of LANGS)
      for (const band of BANDS)
        for (const w of WIDTHS)
          test(`QA ${s} · ${surface} · ${lang} · ${band} · ${w.band}칸`, async ($, on) => {
            const env = world(on, s, lang)
            const step = async (turnId: string, agentId?: string) => {
              for await (const _ of $.turn.step({ turnId, index: 0, model: env.model, messageCount: 1, ...(agentId ? { agentId } : {}) })) {
                // 결과만 필요하다
              }
            }
            await $.command.run({ command: 'easy-compact', args: '' })
            // 바 크기는 명령으로(설정은 세션 시작 · 타이머 때 읽는다 — 저장소에만 넣으면 안 바뀐다)
            await $.command.run({ command: 'easy-compact', args: band })
            // 끝난 질문 하나(캐시가 식은 상태는 질문을 돌리면 다시 살아나 돌리지 않는다)
            const hasTurn = s === 'normal' || s === 'warn' || s === 'api' || s === 'switched' || s === 'tidying'
            if (hasTurn) {
              await $.turn.start({ text: 'question', turnId: 't1' })
              await step('t1')
              await $.turn.complete({ answer: ANSWER, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
            }
            if (s === 'switched') {
              env.model = 'claude-sonnet-5-5'
              await $.command.run({ command: 'easy-compact', args: '' })
            }
            const isWorking = s === 'working' || s === 'agent'
            if (isWorking) {
              await $.turn.start({ text: 'running question', turnId: 't2' })
              await step('t2')
              if (s === 'agent') {
                await $.agent.spawn({ prompt: 'find it', description: 'QA research', subagentType: 'Explore' })
                await step('sub', 'qa-agent')
              }
            }
            const props = { hasSurvey: false, isWorking, maxRows: 10, bodyColumns: w.band }
            const bar = await $.ui.mount({ plugin: 'easy-compact', surface, component: 'AbovePrompt', props })
            await rules(bar, lang, 'bar')
            // 고른 바 크기가 걸렸나 — 최소는 한 줄(b-r1)뿐, 최대는 질문 줄(b-r3)까지
            expect((await bar.find({ key: 'b-r3' })) === undefined).toBe(band === 'min')

            // ⑤ 한도 없으면 비용 줄이 맨 윗줄(최대 바)
            if (s === 'api' && band === 'full') {
              expect(JSON.stringify(await bar.find({ key: 'b-r1' }))).toMatch(lang === 'ko' ? /요청당 / : /Per request /)
              expect(await bar.find({ key: 'b-r2' })).toBe(undefined)
            }

            // ③ 🗜 색 = 버튼 상태(데스크톱 — 터미널은 아이콘 없이 버튼 흐림으로)
            const button = await bar.find({ key: 'compact' })
            const isNotNow = button?.props.dimColor === true
            const iconLook = async () => JSON.stringify(await bar.find({ key: 'compact-icon' }))
            if (surface === 'desktop' && button) expect(await iconLook()).toContain(isNotNow ? '"dimColor":true' : '"color":"#4c9be8"')

            if (isWorking) {
              // 작업 중 표시 · 바는 못 누르는 글
              expect(button).toBe(undefined)
              const spinner = await $.ui.mount({ plugin: 'easy-compact', surface, component: 'Spinner', props: { word: 'Working', message: null, suffix: '…', mode: 'requesting' } })
              await rules(spinner, lang, 'spinner')
            } else if (button) {
              // ④ 바의 다시 쓰기 금액(식은 캐시)
              const isCold = s === 'coldWin' || s === 'coldLoss' || s === 'switched'
              // 영어엔 "소비" 가 없어 이 세션 금액($1.00, 비용 줄 맨 앞)과 꼴이 같다 — 그 값은 뺀다
              const rewrite = isCold ? String((await bar.find({ type: 'Text', text: lang === 'ko' ? /^\$\d+\.\d\d 소비$/ : /^\$(?!1\.00$)\d+\.\d\d$/ }))?.text ?? '').replace(' 소비', '') : ''
              await bar.press({ key: 'compact' })
              await rules(bar, lang, 'card')
              const card = (await bar.find({ key: 'confirm-cold' })) ?? (await bar.find({ key: 'confirm' }))
              expect(card).not.toBe(undefined)
              if (isCold) {
                expect(await bar.find({ key: 'confirm' })).toBe(undefined)
                expect(rewrite).toMatch(/^\$\d+\.\d\d$/)
                expect(JSON.stringify(card)).toContain(`~${rewrite}`)
                expect((await bar.find({ key: 'compact-yes' }))?.props.variant).toBe('primary')
                // 손해면 그냥 이어 가는 편이 싸다고, 이득이면 이득을
                if (s === 'coldLoss') expect(JSON.stringify(card)).toContain(lang === 'ko' ? '그냥 이어 가는 편이 쌈' : 'continuing as is is cheaper')
                if (s === 'coldWin') expect(JSON.stringify(card)).toContain(lang === 'ko' ? ' 이득' : 'saves ')
              }
              if (surface === 'desktop') {
                expect(await iconLook()).toContain(isNotNow ? '"dimColor":true' : '"color":"#4c9be8"')
                const title = await bar.find({ type: 'Text', text: /^(🗜|🧊|🔄)$/ })
                expect(title?.props.dimColor === true).toBe(isNotNow)
              }
              if (s === 'tidying') {
                await bar.press({ key: 'compact-tidy' })
                expect(env.submitted.length).toBe(1)
                expect(await bar.find({ key: 'compact-cancel' })).not.toBe(undefined)
                await rules(bar, lang, 'tidying')
              }
            }

            if (hasTurn) {
              const reply = await $.ui.mount({ plugin: 'easy-compact', surface, component: 'AssistantMessage', props: { text: ANSWER, isFirstOfReply: true } })
              await rules(reply, lang, 'reply')
              expect(await reply.find({ text: lang === 'ko' ? '이 질문 ' : 'This question ' })).not.toBe(undefined)
            }

            // 사용량 패널 · 설정 탭(펼친 것 · 상세 조정까지)
            await $.command.run({ command: 'easy-compact', args: 'usage' })
            const pane = await $.ui.mount({ plugin: 'easy-compact', surface, component: 'Pane', requestId: 'easy-compact', props: { bodyColumns: w.pane, placement: 'dock' } })
            await rules(pane, lang, 'usage')
            await $.command.run({ command: 'easy-compact', args: 'settings' })
            for (const k of ['set-screen', 'set-window', 'set-compact', 'set-tidy', 'set-cache', 'set-lang']) {
              if (await pane.find({ key: `fold-${k}`, text: '▸' })) await pane.press({ key: `fold-${k}` })
            }
            if (!(await pane.find({ key: 'session-colors' })) && (await pane.find({ key: 'screen-more' }))) await pane.press({ key: 'screen-more' })
            await rules(pane, lang, 'settings')
            // 커스텀 세부(버튼 · 색 −/+ · 캐시 유지 시간 고르기)도 같은 규칙
            await pane.press({ key: 'screen-custom' })
            await rules(pane, lang, 'settings')
          })
