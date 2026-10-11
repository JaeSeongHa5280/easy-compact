/**
 * 화면 글 언어 — Claude 설정 언어가 한국어면 한국어, 아니면 영어(mod 에 따로 언어 설정을 두지 않고 Claude
 * 설정을 따라 같이 바뀐다). register.tsx 가 설정을 읽어(detectLang) setLang 으로 넣는다.
 *
 * 글마다 이름을 붙여 표에 따로 두지 않고 쓰는 자리에 두 언어를 나란히 쓴다(L) — 두 언어뿐이라 이름 찾기가 없고,
 * 코드를 고칠 때 한쪽이 빠지기 어렵다.
 */
export type Lang = 'ko' | 'en'

let current: Lang = 'en'

export function setLang(next: Lang): void {
  current = next
}

export function lang(): Lang {
  return current
}

/** 지금 언어의 글 */
export function L(ko: string, en: string): string {
  return current === 'ko' ? ko : en
}

/** 영어 개수 + 낱말: 1 이면 단수("1 request"), 아니면 복수("2 requests") — "1 requests" 로 나왔다. 불규칙 복수는 many 로 */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Claude Code 설정 language("korean" · "한국어" 등 자유 글) · 데스크톱 앱 locale("ko-KR")이 한국어인가 */
export function isKorean(value: string): boolean {
  const v = value.trim().toLowerCase()
  return /^ko([-_]|$)/.test(v) || v.startsWith('kor') || v.includes('한국') || v.includes('한글')
}
