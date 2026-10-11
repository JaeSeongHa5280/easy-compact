import type { Settings } from '../types'
import { L } from './i18n'
import { tidyBody } from './settings'

/**
 * 컴팩트 지시문 — [컴팩트 준비] 프롬프트 · 진행/보류 표시 · 컴팩트 종류 이름 · 요약에 남길 것.
 * 글은 지금 언어로(L) 만들어 함수로 준다 — 상수로 두면 불러올 때의 언어로 굳는다.
 */

/**
 * 컴팩트 중 글에 붙는 이름. 하는 일(엔진이 요약을 한 번 만든다)은 다 같고 요약에 붙는 지시만 다르다 — 버튼 둘은 우리 지시
 * (directKeep · compactKeep), /compact 는 친 글(없으면 엔진 기본), 자동은 없음. 예전엔 넷 다 "컴팩트 중" 하나라 어느 것이
 * 도는지 안 보였다. 저장하고 컴팩트는 이 단계에선 저장이 끝났으니 앞 단계 글("저장 중 → 끝나면 컴팩트")을 잇는다
 */
export function kindDirect(): string {
  return L('바로 컴팩트', 'Compact now')
}

export function kindTidy(): string {
  return L('저장 끝 → 컴팩트', 'Saved → compacting')
}

/**
 * 버튼이 세운 게 아닌 컴팩트(엔진이 출처를 트리거로만 준다 — 버튼이 돌린 /compact 도 manual 이라 버튼 쪽은 미리 세운다).
 * Claude 에 원래 있는 기능이라 "클로드 기본" 을 붙인다 — 우리 버튼(바로 컴팩트 · 저장하고 컴팩트)과 섞여 읽히지 않게.
 * "네이티브" 는 개발 외래어, "앱" 은 ⚙ 앱 자체 요청과 같은 말이라 직접 친 /compact 도 앱이 스스로 돌린 것처럼 읽혔다.
 * 뒤는 Claude Code 의 이름 — 명령 compact, 자동은 Auto-compact. 둘 다 슬래시 없이: /auto-compact 라는 명령은 없다
 */
export function compactKindOf(trigger: string): string {
  return trigger === 'auto'
    ? L('클로드 기본 auto-compact', "Claude's auto-compact")
    : trigger === 'manual'
      ? L('클로드 기본 compact', "Claude's compact")
      : L('컴팩트', 'Compact')
}

/** 저장 턴 프롬프트 머리 · 정리 답 맨 끝 줄의 판정 표시. 판정은 두 언어 다 받는다(턴 도중 언어가 바뀌어도) */
const TAGS = { tidy: ['[컴팩트 준비]', '[Compact prep]'], go: ['[컴팩트 진행]', '[Compact go]'], hold: ['[컴팩트 보류]', '[Compact hold]'] } as const

const pick = (pair: readonly [string, string]) => L(pair[0], pair[1])

export function tidyTag(): string {
  return pick(TAGS.tidy)
}

/** 정리 답 맨 끝 줄의 판정. 진행이 있어야만 컴팩트한다 — 없으면 멈추고 알린다 */
export function markGo(): string {
  return pick(TAGS.go)
}

export function markHold(): string {
  return pick(TAGS.hold)
}

/** 질문 글이 저장 턴 프롬프트인가(두 언어) */
export function isTidyPrompt(text: string): boolean {
  return TAGS.tidy.some(tag => text.startsWith(tag))
}

/**
 * 정리 턴에 보내는 글. 모델이 읽는 프롬프트라 이 턴은 토큰이 든다.
 * 턴이 도는 중엔 버튼이 막혀 있으니, 세션이 볼 것은 "지금 컴팩트하면 손해인가" 다 — 손익 숫자를 같이 준다
 */
export function tidyPrompt(payoff: string | null, body: readonly string[]): string {
  // 앞(손익 · 손해 판단)과 뒤([컴팩트 진행] 표시)는 고정, 가운데만 설정의 문구(프리셋 또는 사용자 글)
  return [
    L(
      `${tidyTag()} 사용자가 "저장하고 컴팩트" 를 눌렀습니다. 이 답이 끝나면 대화를 컴팩트합니다(세부 내용은 요약만 남습니다).`,
      `${tidyTag()} The user pressed "Save & compact". When this answer ends, the conversation will be compacted (details survive only as a summary).`,
    ),
    payoff ? L(`손익(mod 계산, API 정가): ${payoff}`, `Payoff (computed by the mod, API list prices): ${payoff}`) : null,
    L('0) 먼저 지금 컴팩트하면 손해인지 판단하세요. 손해인 경우:', '0) First decide whether compacting now would be a loss. It is a loss when:'),
    L(
      '   - 다음 단계에 지금 맥락의 세부(오류 원문 · 비교 중인 값 · 고치다 만 파일 상태)가 꼭 필요한데 파일로 남기기 어렵다',
      '   - the next step needs details of the current context (raw errors, values being compared, half-edited file state) that are hard to save to files',
    ),
    L('   - 남은 일이 곧 끝나서 위 손익으로는 본전을 못 뽑는다', '   - the remaining work ends soon, so the payoff above will not break even'),
    L(
      `   손해면: 저장하지 말고 이유와 언제 컴팩트하면 좋을지 사용자에게 짧게 알리고, 답 맨 끝 줄에 ${markHold()} 만 쓰세요.`,
      `   If it is a loss: do not save; briefly tell the user why and when to compact instead, and write only ${markHold()} on the last line.`,
    ),
    L('손해가 아니면 아래대로 하세요:', 'Otherwise, do the following:'),
    ...body,
    L(
      `다 했으면 답 맨 끝 줄에 ${markGo()} 만 쓰세요. 새 작업은 시작하지 마세요.`,
      `When done, write only ${markGo()} on the last line. Do not start new work.`,
    ),
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

/** 설정 화면 "보내는 글 전체" 의 손익 줄 자리 — 숫자는 누를 때 띠 확인창의 값이 들어간다 */
export function payoffSample(): string {
  return L(
    '(누를 때의 숫자: 컨텍스트 전 → 후 · 요청 1회 값 · 질문 1개당 아낌 · 저장 + 컴팩트 값 · 본전)',
    '(numbers at the time you press: context before → after · cost per request · saving per question · save + compact cost · break-even)',
  )
}

/** 설정 화면 "보내는 글 전체": 저장 턴에 보내는 글 줄마다(고른 문구 줄 표시) + 그 턴이 끝난 뒤 /compact 지시 */
export function tidyScript(s: Settings): { text: string; isBody: boolean }[] {
  const body = tidyBody(s)
  return [
    ...tidyPrompt(payoffSample(), body)
      .split('\n')
      .map(text => ({ text, isBody: body.includes(text) })),
    { text: L(`답이 ${markGo()}으로 끝나면: /compact ${compactKeep()}`, `If the answer ends with ${markGo()}: /compact ${compactKeep()}`), isBody: false },
  ]
}

/** 정리 답(이어서 할 일 등)을 요약이 버리지 않게 /compact 에 함께 넘기는 지시 */
export function compactKeep(): string {
  return L(
    `직전 ${tidyTag()} 답에 적은 내용("이어서 할 일" 등)은 요약에 그대로 남길 것`,
    `Keep what the previous ${tidyTag()} answer wrote (e.g. "next steps") in the summary as is`,
  )
}

/**
 * 정리 없이 바로 컴팩트할 때(캐시가 살아 있든 식었든) — 정리 턴이 하던 일을 요약 지시로 대신한다.
 * 지시문은 몇십 토큰이라 늘 붙인다. 캐시 상태로 정하는 건 정리 단계를 할지 뿐이다
 */
export function directKeep(): string {
  return L('진행 중 작업 · 결정 · 이어서 할 일은 요약에 남길 것', 'Keep ongoing work, decisions and next steps in the summary')
}

/** 정리 턴의 답으로 다음 단계를 정한다(표시는 두 언어 다 받는다) */
export function tidyVerdict(reason: string, answer: string): 'go' | 'hold' | 'stopped' | 'unmarked' {
  if (reason !== 'answer') return 'stopped'
  if (TAGS.hold.some(mark => answer.includes(mark))) return 'hold'
  return TAGS.go.some(mark => answer.includes(mark)) ? 'go' : 'unmarked'
}
