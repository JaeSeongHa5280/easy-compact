import type { Level } from './cost'
import { fmtUsd } from './cost'
import { L } from './i18n'
import { onTerminal } from './glyph'
import { REVEAL_SQUARE } from './settings'
import { ctxNumText, rangeNumText } from './text'
import type { CtxUnit } from './text'

export type StatusLineInput = {
  tokens: number | null
  window: number | null | undefined
  level: Level | null
  thr: { isRange?: boolean; ctxWarn: number; ctxCut: number }
  unit: CtxUnit
  costUsd: number | null
  phase: string
}

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

export function statusLineUse(): string {
  return L(
    '앱이 "다음 단계" 상자를 띄우는 동안엔 바가 빠집니다. 켜면 입력창 아래에 바의 요지를 한 줄로 늘 둡니다.',
    'While the app shows its "next step" box, the bar is taken away. Turn this on to keep its gist as one line below the input.',
  )
}
