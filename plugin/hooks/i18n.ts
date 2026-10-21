export type Lang = 'ko' | 'en'

let current: Lang = 'en'

export function setLang(next: Lang): void {
  current = next
}

export function lang(): Lang {
  return current
}

export function L(ko: string, en: string): string {
  return current === 'ko' ? ko : en
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export function isKorean(value: string): boolean {
  const v = value.trim().toLowerCase()
  return /^ko([-_]|$)/.test(v) || v.startsWith('kor') || v.includes('한국') || v.includes('한글')
}
