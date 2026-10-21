import type { Settings } from '../types'
import { L } from './i18n'
import { compactText, tidyBody, tidyStyles } from './settings'

export function kindDirect(): string {
  return L('기본 컴팩트', 'Plain compact')
}

export function kindTidy(): string {
  return L('저장 끝 → 컴팩트', 'Saved → compacting')
}

export function compactKindOf(trigger: string): string {
  return trigger === 'auto'
    ? L('클로드 기본 auto-compact', "Claude's auto-compact")
    : trigger === 'manual'
      ? L('클로드 기본 compact', "Claude's compact")
      : L('컴팩트', 'Compact')
}

const TAGS = { tidy: ['[컴팩트 준비]', '[Compact prep]'], go: ['[컴팩트 진행]', '[Compact go]'], hold: ['[컴팩트 보류]', '[Compact hold]'] } as const

const pick = (pair: readonly [string, string]) => L(pair[0], pair[1])

export function tidyTag(): string {
  return pick(TAGS.tidy)
}

export function markGo(): string {
  return pick(TAGS.go)
}

export function markHold(): string {
  return pick(TAGS.hold)
}

export function isTidyPrompt(text: string): boolean {
  return TAGS.tidy.some(tag => text.startsWith(tag))
}

export function tidyPrompt(body: readonly string[]): string {
  return [
    L(
      `${tidyTag()} 사용자가 "이지 컴팩트" 를 눌렀습니다. 이 답이 끝나면 대화를 컴팩트합니다(세부 내용은 요약만 남습니다).`,
      `${tidyTag()} The user pressed "Easy Compact". When this answer ends, the conversation will be compacted (details survive only as a summary).`,
    ),
    L('0) 먼저 컴팩트하면 잃는 정보가 있는지만 보세요. 보류할 때:', '0) First check only whether compacting would lose information you need. Hold when:'),
    L(
      '   - 다음 단계에 지금 맥락의 세부(오류 원문 · 비교 중인 값 · 고치다 만 파일 상태)가 꼭 필요한데 파일로 남기기 어렵다',
      '   - the next step needs details of the current context (raw errors, values being compared, half-edited file state) that are hard to save to files',
    ),
    L('   - 이 세션의 일이 거의 끝나 컴팩트한 뒤 이어 갈 것이 없다', '   - the work in this session is essentially done, with nothing left to continue after compacting'),
    L(
      `   보류면: 저장하지 말고 이유를 사용자에게 짧게 알리고, 답 맨 끝 줄에 ${markHold()} 만 쓰세요.`,
      `   If holding: do not save; briefly tell the user why, and write only ${markHold()} on the last line.`,
    ),
    L('보류가 아니면 아래대로 하세요:', 'Otherwise, do the following:'),
    ...body,
    L(
      `다 했으면 답 맨 끝 줄에 ${markGo()} 만 쓰세요. 새 작업은 시작하지 마세요.`,
      `When done, write only ${markGo()} on the last line. Do not start new work.`,
    ),
  ].join('\n')
}

export function tidyScript(s: Settings): { text: string; isBody: boolean }[] {
  const body = tidyBody(s)
  return [
    { text: L('[이지 컴팩트]', '[Easy Compact]'), isBody: false },
    ...tidyPrompt(body)
      .split('\n')
      .map(text => ({ text, isBody: body.includes(text) })),
    { text: L(`→ 답이 ${markGo()}으로 끝나면: /compact ${compactKeep(s)}`, `→ If the answer ends with ${markGo()}: /compact ${compactKeep(s)}`), isBody: false },
    { text: '', isBody: false },
    { text: L(`[기본 컴팩트] /compact ${directKeep(s)}`, `[Plain compact] /compact ${directKeep(s)}`), isBody: false },
  ]
}

export function compactKeep(s?: Settings): string {
  const fixed = L(
    `직전 ${tidyTag()} 답에 적은 내용("이어서 할 일" 등)은 요약에 그대로 남길 것`,
    `Keep what the previous ${tidyTag()} answer wrote (e.g. "next steps") in the summary as is`,
  )
  const extra = s ? compactText(s) : ''
  return extra ? `${fixed}. ${extra}` : fixed
}

export function directKeep(s?: Settings): string {
  return s ? compactText(s) : L('진행 중 작업 · 결정 · 이어서 할 일은 요약에 남길 것', 'Keep ongoing work, decisions and next steps in the summary')
}

export function tidyVerdict(reason: string, answer: string): 'go' | 'hold' | 'stopped' | 'unmarked' {
  if (reason !== 'answer') return 'stopped'
  if (TAGS.hold.some(mark => answer.includes(mark))) return 'hold'
  return TAGS.go.some(mark => answer.includes(mark)) ? 'go' : 'unmarked'
}

const AUTO_TAGS = { save: ['[이지 오토 · 요약]', '[Easy Auto · summary]'], cont: ['[이지 오토 · 이어가기]', '[Easy Auto · continue]'] } as const

export function autoTurnOf(text: string): 'save' | 'continue' | null {
  const t = text.trimStart()
  if (AUTO_TAGS.save.some(tag => t.startsWith(tag))) return 'save'
  return AUTO_TAGS.cont.some(tag => t.startsWith(tag)) ? 'continue' : null
}

export function autoTurnName(kind: 'save' | 'continue'): string {
  return pick(kind === 'save' ? AUTO_TAGS.save : AUTO_TAGS.cont)
}

export function autoSavePrompt(path: 'end' | 'mid', at: string): string {
  const head =
    path === 'mid'
      ? L(
          `일하는 도중 컨텍스트가 이지 오토 구간 끝(${at})을 넘어 잠깐 멈췄습니다. 이 답이 끝나면 대화를 컴팩트하고, 컴팩트가 끝나면 하던 일을 이어서 하게 합니다.`,
          `While working, the context passed the end of the Easy Auto range (${at}), so work paused. When this answer ends, the conversation is compacted, then you will be asked to continue.`,
        )
      : L(
          `컨텍스트가 이지 오토 구간(${at})을 넘어, 이 답이 끝나면 대화를 컴팩트합니다(세부 내용은 요약만 남습니다).`,
          `The context passed the Easy Auto range (${at}), so the conversation is compacted when this answer ends (details survive only as a summary).`,
        )
  return [
    `${pick(AUTO_TAGS.save)} ${head}`,
    L('아래대로 하세요:', 'Do the following:'),
    ...tidyStyles().default.body,
    L(`다 했으면 답 맨 끝 줄에 ${markGo()} 만 쓰세요. 새 작업은 시작하지 마세요.`, `When done, write only ${markGo()} on the last line. Do not start new work.`),
  ].join('\n')
}

export function autoContinuePrompt(): string {
  return `${pick(AUTO_TAGS.cont)} ${L('컴팩트를 마쳤습니다. 하던 일을 이어서 해 주세요.', 'Compacting is done. Please continue what you were doing.')}`
}

export function autoCompactKeep(): string {
  return L(
    `직전 ${pick(AUTO_TAGS.save)} 답에 적은 내용("이어서 할 일" 등)은 요약에 그대로 남길 것. ${tidyStyles().default.compact}`,
    `Keep what the previous ${pick(AUTO_TAGS.save)} answer wrote (e.g. "next steps") in the summary as is. ${tidyStyles().default.compact}`,
  )
}

export function kindAuto(): string {
  return L('이지 오토 컴팩트', 'Easy Auto compact')
}

export function kindAutoSave(): string {
  return L('이지 오토', 'Easy Auto')
}

export function isAutoSaveKind(kind: unknown): boolean {
  return kind === '이지 오토' || kind === 'Easy Auto'
}
