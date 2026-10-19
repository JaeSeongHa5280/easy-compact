// B10(0.9.0): 입력창 아래 한 줄($.ui.status) — 앱이 턴 끝 "다음 단계" 상자(단추로 묻는 칸)를 띄우는 동안 플러그인 바를 DOM 에서
// 뺀다(mod 로 못 막음 · 알려 주는 사건도 없음 — 정본 easy-compact-feedback-0.8.md "B10 조사 결과"). 이 줄은 바닥 띠라 그 상자에 안
// 묶인다. 설정 "입력창 아래 한 줄"(기본 끔)을 켜면 바의 요지(크기 단계 · 컨텍스트 · 컴팩트 구간 · 세션 금액)를 글 한 줄로 늘 둔다
import type { Level } from './cost'
import { fmtUsd } from './cost'
import { L } from './i18n'
import { onTerminal } from './glyph'
import { REVEAL_SQUARE } from './settings'
import { ctxNumText, rangeNumText } from './text'
import type { CtxUnit } from './text'

export type StatusLineInput = {
  /** 지금 컨텍스트(토큰) — 0 · null = 아직 모름 */
  tokens: number | null
  window: number | null | undefined
  level: Level | null
  thr: { isRange?: boolean; ctxWarn: number; ctxCut: number }
  unit: CtxUnit
  costUsd: number | null
  phase: string
}

/**
 * "🟦 이지 컴팩트 · 컨텍스트 140k · 컴팩트 구간 200k~250k · 세션 $8.40" — 주황 · 빨강이면 이름 뒤에 바 버튼과 같은 상태 말("컴팩트할 때" ·
 * "컴팩트 늦어짐"), 컴팩트 · 저장 중엔 그 말. 네모 색은 입력창 아래 접힌 바 버튼(B7)과 같은 크기 단계. 터미널은 글만(네모 없음)
 */
export function statusLineText(v: StatusLineInput): string {
  const name = L('이지 컴팩트', 'Easy Compact')
  const head = onTerminal() ? name : `${REVEAL_SQUARE[v.level ?? 'ok']} ${name}`
  const state =
    v.phase === 'compacting'
      ? L('컴팩트 중…', 'Compacting…')
      : v.phase === 'tidying'
        ? L('저장 중…', 'Saving…')
        : v.level === 'cut'
          ? v.thr.isRange
            ? L('컴팩트 늦어짐', 'Compact overdue')
            : L('컴팩트 권장', 'Compact advised')
          : v.level === 'warn'
            ? v.thr.isRange
              ? L('컴팩트할 때', 'Time to compact')
              : L('곧 컴팩트할 때', 'Compact soon')
            : null
  const ctx =
    v.tokens !== null && v.tokens > 0
      ? L(`컨텍스트 ${ctxNumText(v.tokens, v.window, v.unit)}`, `Context ${ctxNumText(v.tokens, v.window, v.unit)}`)
      : L('컨텍스트 아직 모름', 'Context not known yet')
  const range = v.thr.isRange
    ? L(`컴팩트 구간 ${rangeNumText(v.thr, v.window, v.unit)}`, `compact range ${rangeNumText(v.thr, v.window, v.unit)}`)
    : L(`컴팩트 기준 ${rangeNumText(v.thr, v.window, v.unit)}`, `compact at ${rangeNumText(v.thr, v.window, v.unit)}`)
  const cost = v.costUsd !== null ? L(`세션 ${fmtUsd(v.costUsd)}`, `Session ${fmtUsd(v.costUsd)}`) : null
  return [head, state, ctx, range, cost].filter(Boolean).join(' · ')
}

/** 설정 줄 풀이(마우스 올림 칩) */
export function statusLineUse(): string {
  return L(
    '앱이 "다음 단계" 상자를 띄우는 동안엔 바가 빠집니다. 켜면 입력창 아래에 바의 요지를 한 줄로 늘 둡니다.',
    'While the app shows its "next step" box, the bar is taken away. Turn this on to keep its gist as one line below the input.',
  )
}
