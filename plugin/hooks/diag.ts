import { L } from './i18n'

export type DiagCounts = { prompts: number; answers: number; labels: number; custom: number }

export type DiagView = {
  where: 'drawer' | 'gen'
  redact: boolean
  head: string
  lines: number
  turns: number
  counts: DiagCounts
  samples: string[]
  copiedLines: number | null
  savedPath: string | null
}

export const DIAG_HEAD_LINES = 40

const SAMPLE_MAX = 4
const SAMPLE_CHARS = 48

const cut = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return [...one].length > n ? `${[...one].slice(0, n).join('')}…` : one
}

export function removedText(s: string): string {
  const n = [...s].length
  return L(`(뺌 · ${n}자)`, `(removed · ${n} chars)`)
}

type Turnish = { prompt?: unknown; tail?: unknown; details?: unknown }

export function redactDump(state: Record<string, unknown>, redact: boolean): { state: Record<string, unknown>; counts: DiagCounts; samples: string[] } {
  const copy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  const counts: DiagCounts = { prompts: 0, answers: 0, labels: 0, custom: 0 }
  const prompts: string[] = []
  const customs: string[] = []
  const labels: string[] = []
  const turnOf = (t: unknown) => {
    if (!t || typeof t !== 'object') return
    const o = t as Turnish
    if (typeof o.prompt === 'string' && o.prompt.trim() !== '') {
      counts.prompts++
      prompts.push(o.prompt)
      if (redact) o.prompt = removedText(o.prompt)
    }
    if (typeof o.tail === 'string' && o.tail.trim() !== '') {
      counts.answers++
      if (redact) o.tail = removedText(o.tail)
    }
    if (!Array.isArray(o.details)) return
    for (const d of o.details) {
      const dd = d as { label?: unknown } | null
      if (!dd || typeof dd !== 'object' || typeof dd.label !== 'string' || dd.label.trim() === '') continue
      counts.labels++
      labels.push(dd.label)
      if (redact) dd.label = removedText(dd.label)
    }
  }
  if (Array.isArray(copy.turnSummaries)) copy.turnSummaries.forEach(turnOf)
  turnOf(copy.live)
  const st = copy.settings
  if (st && typeof st === 'object') {
    const so = st as Record<string, unknown>
    for (const k of ['tidyCustom', 'compactCustom']) {
      const v = so[k]
      if (typeof v !== 'string' || v.trim() === '') continue
      counts.custom++
      customs.push(v)
      if (redact) so[k] = removedText(v)
    }
  }
  const samples = [...prompts.reverse(), ...customs, ...labels.reverse()].slice(0, SAMPLE_MAX).map(s => cut(s, SAMPLE_CHARS))
  return { state: copy, counts, samples }
}

export function diagHead(text: string): { head: string; lines: number } {
  const all = text.split('\n')
  return { head: all.slice(0, DIAG_HEAD_LINES).join('\n'), lines: all.length }
}

export function diagSummary(v: Pick<DiagView, 'turns'>): string {
  return L(
    `버전 · 설정 · 사용량 · 질문 기록 ${v.turns}개 · 패널 기록(금액 · 모델 이름 포함)이 들어 있습니다. 이지 컴팩트는 아무 데도 보내지 않습니다.`,
    `Contains the version, settings, usage, ${v.turns} question records and the pane log (with costs and model names). Easy Compact sends nothing anywhere.`,
  )
}

export function diagOwnText(c: DiagCounts): string {
  return L(
    `나갈 내 글: 질문 ${c.prompts}개 · 답 끝 ${c.answers}개 · 동작 이름 ${c.labels}개 · 직접 쓴 문구 ${c.custom}개`,
    `Your own text going out: ${c.prompts} questions, ${c.answers} answer endings, ${c.labels} step names, ${c.custom} custom texts`,
  )
}

export const ISSUE_URL = 'https://github.com/JaeSeongHa5280/easy-compact/issues/new'

export function nativePath(path: string): string {
  return /^[A-Za-z]:[\\/]/.test(path) ? path.replace(/\//g, '\\') : path
}

export function revealArgv(path: string): string[][] {
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    const native = nativePath(path)
    return /[&^%!,\r\n]/.test(native) ? [] : [['cmd.exe', '/d', '/c', 'start', '', 'explorer.exe', '/select,', native]]
  }
  const dir = path.replace(/[\\/][^\\/]*$/, '') || '/'
  return [
    ['open', '-R', path],
    ['xdg-open', dir],
  ]
}

export function dumpText(state: Record<string, unknown>): { text: string; lone: number; ctrl: number } {
  const text = JSON.stringify(state, null, 2)
  const lone = (text.match(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g) ?? []).length
  const ctrl = (text.match(/\u00[01][0-9a-f]/gi) ?? []).length
  return { text, lone, ctrl }
}
