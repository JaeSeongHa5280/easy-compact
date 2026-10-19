import { L } from './i18n'

/**
 * 진단 내용 보기(0.9.1 U6 — 사용자 "덤프는 뽑으면 뽑히는 내용을 사람한테 보여 줘야 될 듯, 그 사람이 복사해도 되는지 봐야 되니"): [진단 내용
 * 보기] 를 누르면 그 줄 아래 카드에 무엇이 들어 있는지 · 처음 몇 줄을 먼저 보이고, 본 그대로 [복사] · [파일로 저장]. 내 글(질문 글 앞부분 ·
 * 동작 이름 — 파일 이름 · 명령이 들어갈 수 있음 · 직접 쓴 컴팩트 문구)은 처음부터 "(뺌 · N자)" 로 바꿔 두고(스위치로 끔), 끄면 나갈 내 글
 * 앞부분을 노랗게 따로 보인다. 금액 · 모델 이름 · 한도 · 설정 값은 그대로(진단에 필요). 이 파일은 순수 함수만 — 시험이 같이 쓴다
 */
export type DiagCounts = { prompts: number; answers: number; labels: number; custom: number }

export type DiagView = {
  /** 카드를 연 자리 — 판 서랍 · 설정 › 일반 탭 */
  where: 'drawer' | 'gen'
  redact: boolean
  /** 처음 DIAG_HEAD_LINES 줄(Code 로 보임) */
  head: string
  /** 전체 줄 수 · 질문 기록 수 */
  lines: number
  turns: number
  counts: DiagCounts
  /** 빼기를 끄면 보일 나갈 내 글 앞부분(4개까지) */
  samples: string[]
  /** [복사] 한 줄 수 · [파일로 저장] 한 경로 — 아직이면 null */
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

/** 뺀 글 자리: 글자 수만 남긴다(얼마나 긴 질문이었나는 진단에 쓸모가 있다) */
export function removedText(s: string): string {
  const n = [...s].length
  return L(`(뺌 · ${n}자)`, `(removed · ${n} chars)`)
}

type Turnish = { prompt?: unknown; tail?: unknown; details?: unknown }

/**
 * 덤프 상태의 내 글을 세고, redact 면 "(뺌 · N자)" 로 바꾼 사본을 돌려준다(원본은 안 건드림). 세는 것: 질문 기록 · 진행 중 질문의 prompt,
 * 답 끝 글(tail), 그 동작들의 label, 설정의 직접 쓴 문구(tidyCustom · compactCustom). samples = 질문 글 → 직접 쓴 문구 → 동작 이름 순으로 앞부분
 */
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
    // 답 끝 글(tail — Claude 답의 마지막 120자, 답 블록과 질문 줄을 맞출 때 쓴다)도 대화 글이다
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
  // 최근 질문이 위로(기록은 오래된 것부터 쌓인다)
  const samples = [...prompts.reverse(), ...customs, ...labels.reverse()].slice(0, SAMPLE_MAX).map(s => cut(s, SAMPLE_CHARS))
  return { state: copy, counts, samples }
}

/** 덤프 글 → 카드 재료(처음 줄 · 줄 수) */
export function diagHead(text: string): { head: string; lines: number } {
  const all = text.split('\n')
  return { head: all.slice(0, DIAG_HEAD_LINES).join('\n'), lines: all.length }
}

/** 카드 맨 위 한 줄 — 무엇이 들어 있나 */
export function diagSummary(v: Pick<DiagView, 'turns'>): string {
  return L(
    `버전 · 설정 · 사용량 · 질문 기록 ${v.turns}개 · 패널 기록(금액 · 모델 이름 포함)이 들어 있습니다. 이지 컴팩트는 아무 데도 보내지 않습니다.`,
    `Contains the version, settings, usage, ${v.turns} question records and the pane log (with costs and model names). Easy Compact sends nothing anywhere.`,
  )
}

/** 빼기를 끈 때 나갈 내 글 한 줄 */
export function diagOwnText(c: DiagCounts): string {
  return L(
    `나갈 내 글: 질문 ${c.prompts}개 · 답 끝 ${c.answers}개 · 동작 이름 ${c.labels}개 · 직접 쓴 문구 ${c.custom}개`,
    `Your own text going out: ${c.prompts} questions, ${c.answers} answer endings, ${c.labels} step names, ${c.custom} custom texts`,
  )
}

/** 제보할 곳 — 공개 저장소 새 이슈 */
export const ISSUE_URL = 'https://github.com/JaeSeongHa5280/easy-compact/issues/new'

/** 덤프 글 + 짝 없는 서로게이트 · 제어 문자 수(데스크톱이 그리기를 통째로 거부하는 글 후보) */
export function dumpText(state: Record<string, unknown>): { text: string; lone: number; ctrl: number } {
  const text = JSON.stringify(state, null, 2)
  const lone = (text.match(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g) ?? []).length
  const ctrl = (text.match(/\u00[01][0-9a-f]/gi) ?? []).length
  return { text, lone, ctrl }
}
