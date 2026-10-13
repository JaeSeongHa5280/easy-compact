import type { On, RenderSurface } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// QA 조합 시험(층 ①) — 상태 × 표면 × 언어 × 바 크기 × 폭마다 바 · 확인 카드 · 작업 중 표시 · 답변 아래 줄 · 사용량 패널 · 설정 탭을
// 그려(그릴 수 있는지는 표면 표가 검증한다) 공통 규칙을 본다:
//   ① 화면 글에 undefined · NaN · Infinity · [object Object] 가 없다
//   ② 영어 화면에 한글이 없다(언어 줄 이름 · 한국어 버튼만 두 언어)
//   ③ 권하지 않는 동안(흐린 버튼) 🗜(캡슐 꼴 Svg)는 회색 #9aa0a8, 권하면 파랑 — 확인창을 열어도(바 · 카드 제목) 그대로
//   ④ 캐시가 식었으면 확인창은 캐시 만료 카드이고, 바 설명 칩의 다음 요청 금액 = 카드의 이어 가기 금액(데스크톱)
//   ⑤ 한도 줄이 없으면(API 키 세션) 비용 줄이 맨 윗줄
// 칠한 화면의 폭(터미널 넘침) · 데스크톱 겹침은 시험 도구가 칠하지 않아 못 본다 — 층 ②(브라우저) · ③(CLI 실물)

/**
 * extras = 0.5.0 새 화면(2026-10-14 QA 자체 점검에서 더함 — QA 가 기본 끔 · 설치본 전용 화면을 하나도 안 거쳤다): 오늘 · 이번 달 켬 ·
 * 마켓 설치본 흉내(EASY_COMPACT_FAKE_INSTALL) · 전부터 쓰던 사람(업데이트 뒤 첫 실행 알림) — 알림 · 바뀐 것 · 업데이트 칸 네 상태까지
 */
type State = 'normal' | 'warn' | 'coldWin' | 'coldLoss' | 'switched' | 'afterCompact' | 'api' | 'working' | 'agent' | 'tidying' | 'extras'
const STATES: State[] = ['normal', 'warn', 'coldWin', 'coldLoss', 'switched', 'afterCompact', 'api', 'working', 'agent', 'tidying', 'extras']
const SURFACES: RenderSurface[] = ['desktop', 'terminal']
const LANGS = ['ko', 'en'] as const
/**
 * 바 모양 — 자세히 최대(세 줄) · 자세히 최소(한 줄) · 간단(한 줄 고정, 최소가 따로 없다). 0.4.1 부터 새 설치 · 업데이트의 첫 화면이
 * 간단인데 QA 는 저장값 없이 돌아 기본값(자세히)만 봤다 — 2026-10-13 QA 점검에서 더함
 */
const BANDS = ['full', 'min', 'simple'] as const
/**
 * 바 폭(칸) — 갈림길은 둘: 터미널은 100 아래면 좁은 터미널(창 버튼 맨 윗줄 · 짧은 패널 버튼), 115 이상이면 확인 카드 줄을 덜 바꾼다
 * (register.tsx isNarrowTerminal · isWide). 데스크톱은 115 하나뿐이라 50 · 100 이 같은 길 — 데스크톱은 100 · 140 만(240 → 200개,
 * 2026-10-13 시험 정리). 패널은 그 폭에 맞춘 사이드 패널 폭
 */
const WIDTHS = [{ band: 50, pane: 36 }, { band: 100, pane: 60 }, { band: 140, pane: 90 }]
const widthsFor = (surface: RenderSurface) => (surface === 'terminal' ? WIDTHS : WIDTHS.filter(w => w.band >= 100))

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
  extras: 120_000,
}
const CFG = '/home/test/.claude'
const MARKET = `${CFG}/plugins/marketplaces/easy-compact`
const CHANGELOG = {
  ko: ['# 변경 기록', '', '## [0.5.1] — 2026-10-20', '', '### 고침', '- **업데이트 칸 글이 꺾이던 것**', '', '## [0.5.0] — 2026-10-14', '', '### 새로 생김', '- **업데이트 확인** — 설정 탭 맨 아래.', '- **오늘 · 이번 달 사용량**(옵션)'].join('\n'),
  en: ['# Changelog', '', '## [0.5.1] — 2026-10-20', '', '### Fixed', '- **The update section wrapping**', '', '## [0.5.0] — 2026-10-14', '', '### Added', '- **Check for updates** — at the bottom of Settings.', '- **Today · this month** (option)'].join('\n'),
}
/** 뒤에서 도는 일(켤 때 판 읽기 · claude 명령)을 잠깐 기다린다 */
async function waitFor(check: () => Promise<boolean>) {
  for (let i = 0; i < 50 && !(await check()); i++) await new Promise(resolve => setTimeout(resolve, 10))
}
const ANSWER = 'QA answer, last sentence — one question ends right here.'
const BAD = /undefined|NaN|Infinity|\[object Object\]/
const HANGUL = /[가-힣]/
/** 영어 화면에서도 두 언어로 두는 글(언어 줄) — 터미널 고르기 버튼은 안 고른 쪽도 ✓ 자리 빈칸("[  한국어]") */
const BOTH = new Set(['언어 · Language', '[한국어]', '[  한국어]'])

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
  // 영어 캐시 글이 "cache expires in 38m left" 로 겹치지 않는다(앞말 · 값이 다른 Text 라 이어 붙여 본다 — 2026-10-13 공개 세션 발견)
  if (lang === 'en') expect({ where, overlap: /in \d+m left/.test(list.join('')) }).toEqual({ where, overlap: false })
  if (lang === 'en') expect({ where, hangul: list.filter(t => HANGUL.test(t) && !BOTH.has(t)) }).toEqual({ where, hangul: [] })
}

/** 상태 하나의 세계: 기록 파일 · 엔진 값 · 저장소 · 모델. 모델은 바꿀 수 있게 돌려준다 */
function world(on: On, s: State, lang: 'ko' | 'en') {
  const isExtras = s === 'extras'
  mock.env(on, {
    EASY_COMPACT_LANG: lang,
    HOME: '/home/test',
    ...(isExtras ? { EASY_COMPACT_FAKE_INSTALL: JSON.stringify({ configDir: CFG, marketplace: 'easy-compact' }) } : {}),
  })
  const isCold = s === 'coldWin' || s === 'coldLoss'
  const base = Date.now() - (isCold ? 2 * 24 * 3600_000 : 20 * 60_000)
  const at = (min: number) => new Date(base + min * 60_000).toISOString()
  const ctx = CTX[s]
  // 첫 요청은 공통 앞부분 4.76만을 읽고(다른 세션이 데워 둠) 나머지를 쓴다 — 회사 세션 꼴
  const line = (id: string, read: number, write: number, min: number) =>
    JSON.stringify({ type: 'assistant', timestamp: at(min), message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 500, cache_read_input_tokens: read, cache_creation_input_tokens: write } } })
  const lines = [line('a', 47_594, 12_396, 0), line('b', ctx - 2_010, 2_000, 1)]
  if (s === 'afterCompact') lines.push(JSON.stringify({ type: 'system', subtype: 'compact_boundary', timestamp: at(2), compactMetadata: { trigger: 'manual', preTokens: ctx } }))
  // extras: 전부터 쓰던 사람(설정은 있고 본 판은 없음 → 업데이트 알림), 오늘 · 이번 달 켬
  const store = new Map<string, unknown>(isExtras ? [['settings', { spendToday: true, spendMonth: true }]] : [])
  const env = { model: 'claude-opus-5-5', submitted: [] as string[], market: '0.5.0' }
  on('fs.list', async () => ({ value: [] }))
  on('fs.read', async (_$, e) => {
    if (isExtras) {
      // 엔진은 /home/test 를 Windows 에선 C:/home/test 로 푼다
      const p = String(e.path).replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
      if (p.endsWith('/.claude-plugin/plugin.json') && !p.startsWith(MARKET)) return { value: JSON.stringify({ name: 'easy-compact', version: '0.5.0' }) }
      if (p === `${MARKET}/.claude-plugin/marketplace.json`) return { value: JSON.stringify({ plugins: [{ name: 'easy-compact', version: env.market }] }) }
      if (p === `${CFG}/plugins/known_marketplaces.json`) return { value: JSON.stringify({ 'easy-compact': { lastUpdated: new Date(Date.now() - 3 * 86_400_000).toISOString() } }) }
      if (p === `${MARKET}/CHANGELOG.ko.md`) return { value: CHANGELOG.ko }
      if (p === `${MARKET}/CHANGELOG.md`) return { value: CHANGELOG.en }
    }
    return { value: lines.join('\n') }
  })
  if (isExtras) {
    on('store.keys', async () => ({ value: [...store.keys()] }))
    on('session.surfaces', async () => ({ value: ['desktop', 'terminal'] }))
    on('command.register', async (_$, e) => ({ value: { command: e.name } }))
    on('session.start', async (_$, e) => ({ cwd: e.cwd }))
    on('process.run', async (_$, e) => {
      const args = e.argv.slice(1).join(' ')
      if (args === 'plugin marketplace update easy-compact') {
        env.market = '0.5.1'
        return { value: { exitCode: 0, stdout: '✔ Successfully updated marketplace: easy-compact', stderr: '' } }
      }
      if (args === 'plugin update easy-compact@easy-compact') return { value: { exitCode: 0, stdout: '✔ updated', stderr: '' } }
      if (e.argv.some(x => String(x).includes('scan-spend'))) {
        const d = new Date()
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return { value: { exitCode: 0, stdout: JSON.stringify({ days: { [day]: { 'claude-opus-5-5': { S: [0, 1_000_000, 10_000_000, 0, 0] } } }, files: 1, scanned: 1 }), stderr: '' } }
      }
      return { value: { exitCode: 1, stdout: '', stderr: '' } }
    })
  }
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
        for (const w of widthsFor(surface))
          test(`QA ${s} · ${surface} · ${lang} · ${band} · ${w.band}칸`, async ($, on) => {
            const env = world(on, s, lang)
            // extras: 켤 때 일(판 읽기 · 오늘 · 이번 달 재기)은 session.start 에서
            if (s === 'extras') await $.session.start({ cwd: 'D:/Claude', surface, isInteractive: true })
            const step = async (turnId: string, agentId?: string) => {
              for await (const _ of $.turn.step({ turnId, index: 0, model: env.model, messageCount: 1, ...(agentId ? { agentId } : {}) })) {
                // 결과만 필요하다
              }
            }
            await $.command.run({ command: 'easy-compact', args: '' })
            // 화면 · 바 크기는 명령으로(설정은 세션 시작 · 타이머 때 읽는다 — 저장소에만 넣으면 안 바뀐다)
            await $.command.run({ command: 'easy-compact', args: band === 'simple' ? 'screen simple' : 'screen detail' })
            if (band !== 'simple') await $.command.run({ command: 'easy-compact', args: band })
            // 끝난 질문 하나(캐시가 식은 상태는 질문을 돌리면 다시 살아나 돌리지 않는다)
            const hasTurn = s === 'normal' || s === 'warn' || s === 'api' || s === 'switched' || s === 'tidying' || s === 'extras'
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
            // extras: 넓은 바(140칸)엔 오늘 · 이번 달 칸이 뜬다(좁으면 빠질 수 있다 — 빼는 순서는 band.test)
            if (s === 'extras' && w.band === 140) {
              await waitFor(async () => (await bar.find({ key: 'c-today' })) !== undefined)
              expect(await bar.find({ key: 'c-today' })).not.toBe(undefined)
            }
            await rules(bar, lang, 'bar')
            // 고른 바 모양이 걸렸나 — 최소 · 간단은 한 줄(b-r1)뿐, 자세히 최대는 질문 줄(b-r3)까지
            expect((await bar.find({ key: 'b-r3' })) === undefined).toBe(band !== 'full')
            // 간단이 걸렸나 — 한 줄 고정이라 [—] · [□] 바 크기 버튼이 없다(자세히는 있다)
            expect((await bar.find({ key: 'band-mode' })) === undefined).toBe(band === 'simple')

            // ⑤ 한도 없으면 비용 줄이 맨 윗줄(최대 바)
            if (s === 'api' && band === 'full') {
              // 비용 줄은 폭에 맞춰 칸을 뺀다(좁은 터미널은 요청당도 빠진다) — 늘 남는 "세션" 칸으로 본다
              expect(JSON.stringify(await bar.find({ key: 'b-r1' }))).toMatch(lang === 'ko' ? /"세션 "/ : /"Session "/)
              expect(await bar.find({ key: 'b-r2' })).toBe(undefined)
            }

            // ③ 🗜 색 = 버튼 상태(데스크톱 — 터미널은 아이콘 없이 버튼 흐림으로)
            const button = await bar.find({ key: 'compact' })
            const isNotNow = button?.props.dimColor === true
            const iconLook = async () => JSON.stringify(await bar.find({ key: 'compact-icon' }))
            if (surface === 'desktop' && button) expect(await iconLook()).toContain(isNotNow ? '#9aa0a8' : '#4c9be8')

            if (isWorking) {
              // 작업 중 표시 · 바는 못 누르는 글
              expect(button).toBe(undefined)
              const spinner = await $.ui.mount({ plugin: 'easy-compact', surface, component: 'Spinner', props: { word: 'Working', message: null, suffix: '…', mode: 'requesting' } })
              await rules(spinner, lang, 'spinner')
            } else if (button) {
              // ④ 바의 다음 요청 금액(식은 캐시) — 바 비용 줄은 상태만(uxi B1 안 A)이라 금액은 데스크톱 이지 컴팩트 설명 칩에.
              // 터미널은 칩이 없어(누르는 자리를 덮었다) 카드 종류만 본다
              const isCold = s === 'coldWin' || s === 'coldLoss' || s === 'switched'
              const tip = isCold && surface === 'desktop' ? String((await bar.find({ type: 'Text', text: lang === 'ko' ? /다음 요청 ~\$\d+\.\d\d/ : /next request ~\$\d+\.\d\d/ }))?.text ?? '') : ''
              const rewrite = (tip.match(/~(\$\d+\.\d\d)/) ?? [])[1] ?? ''
              await bar.press({ key: 'compact' })
              await rules(bar, lang, 'card')
              const card = (await bar.find({ key: 'confirm-cold' })) ?? (await bar.find({ key: 'confirm' }))
              expect(card).not.toBe(undefined)
              if (isCold) {
                expect(await bar.find({ key: 'confirm' })).toBe(undefined)
                if (surface === 'desktop') {
                  expect(rewrite).toMatch(/^\$\d+\.\d\d$/)
                  expect(JSON.stringify(card)).toContain(`~${rewrite}`)
                }
                // 손해(그냥 이어 가는 편이 쌈)면 컴팩트 버튼 없이 이어 가라는 안내, 이득이면 ▶ 바로 컴팩트
                const isLossCard = JSON.stringify(card).includes(lang === 'ko' ? '그냥 이어 가는 편이 쌈' : 'continuing as is is cheaper')
                if (isLossCard) {
                  expect(await bar.find({ key: 'compact-yes' })).toBe(undefined)
                  expect(await bar.find({ key: 'compact-tidy' })).toBe(undefined)
                  expect(JSON.stringify(card)).toContain(lang === 'ko' ? '작업을 이어 가세요' : 'Keep working')
                } else {
                  expect((await bar.find({ key: 'compact-yes' }))?.props.variant).toBe('primary')
                }
                // 손해면 그냥 이어 가는 편이 싸다고, 이득이면 이득을
                if (s === 'coldLoss') expect(JSON.stringify(card)).toContain(lang === 'ko' ? '그냥 이어 가는 편이 쌈' : 'continuing as is is cheaper')
                if (s === 'coldWin') expect(JSON.stringify(card)).toContain(lang === 'ko' ? ' 이득' : 'saves ')
              }
              if (surface === 'desktop') {
                expect(await iconLook()).toContain(isNotNow ? '#9aa0a8' : '#4c9be8')
                // 카드 제목 아이콘(캡슐 꼴 Svg): 권하지 않는 동안 회색 — 2026-10-14 uxi 아이콘 안 A
                const title = JSON.stringify(await bar.find({ key: 'card-icon' }))
                expect(title.includes('#9aa0a8')).toBe(isNotNow)
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
            // 질문별 비용은 열 때 접혀 있다(fb A6) — 질문 줄 글도 규칙을 보게 펼친다
            if (await pane.find({ key: 'fold-s-history', text: '▸' })) await pane.press({ key: 'fold-s-history' })
            await rules(pane, lang, 'usage')
            if (s === 'extras') {
              // 업데이트 뒤 첫 실행 알림 · 바뀐 것(마켓 사본 CHANGELOG — 화면 언어의 파일)
              await waitFor(async () => (await pane.find({ key: 'upd-note' })) !== undefined)
              expect(await pane.find({ key: 'upd-note' })).not.toBe(undefined)
              await pane.press({ key: 'upd-note-changes' })
              expect(await pane.find({ key: 'upd-note-list' })).not.toBe(undefined)
              await rules(pane, lang, 'update-note')
            }
            await $.command.run({ command: 'easy-compact', args: 'settings' })
            for (const k of ['set-screen', 'set-window', 'set-compact', 'set-tidy', 'set-cache', 'set-lang']) {
              if (await pane.find({ key: `fold-${k}`, text: '▸' })) await pane.press({ key: `fold-${k}` })
            }
            if (!(await pane.find({ key: 'info-row' })) && (await pane.find({ key: 'screen-more' }))) await pane.press({ key: 'screen-more' })
            await rules(pane, lang, 'settings')
            if (s === 'extras') {
              // 업데이트 칸 네 상태: 평소 → [업데이트 확인] → 새 판(설정 탭 •) · 바뀐 것 → [업데이트] → 받음
              expect(await pane.find({ key: 'upd-check' })).not.toBe(undefined)
              await pane.press({ key: 'upd-check' })
              await waitFor(async () => (await pane.find({ key: 'upd-apply' })) !== undefined)
              expect(String((await pane.find({ key: 'pane-settings' }))?.props.label ?? '')).toContain('•')
              await pane.press({ key: 'upd-changes' })
              await rules(pane, lang, 'update-newer')
              await pane.press({ key: 'upd-apply' })
              await waitFor(async () => (await pane.find({ key: 'upd-apply' })) === undefined)
              expect(JSON.stringify(await pane.find({ key: 'set-update' }))).toContain('0.5.1')
              await rules(pane, lang, 'update-done')
            }
            // 커스텀 세부(버튼 · 색 −/+ · 캐시 유지 시간 고르기)도 같은 규칙
            await pane.press({ key: 'screen-custom' })
            await rules(pane, lang, 'settings')
          })
