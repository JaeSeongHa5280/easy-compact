import type { EngineInterface } from 'claude-code'
import type { StepDetail } from '../types'
import { barSvg, CTX_MARK_PAD, ctxBarSvg, fmtTokens, fmtUsd, modelName, pulseSvg, REWRITE_NOTE_USD, textBar } from './cost'
import { L } from './i18n'
import { iconOf, onDesktop, onTerminal, withIcon } from './glyph'
import { barCells } from './cells'
import { cellsOf, fitCells, compactStepText, widthOf } from './text'

/**
 * 화면 공통 조각 — 카드 · 줄 · 칸 · 막대 · 색.
 *
 * 그리기 함수(ui-*.tsx)는 $ 를 받지 않는다: 엔진은 $ 를 import 너머로 따라가지 않아, 넘기면 모듈이 안 뜬다
 * ("$ is followed only into a function declared in this same file"). 버튼 동작은 register.tsx 가 묶어(act) 넘긴다
 */

/** 컴팩트 확인 카드의 강조색(테두리 · 아이콘) — 테마 색 suggestion 이라 밝은 · 어두운 테마 둘 다 맞는다 */
export const ACCENT = 'suggestion'

/**
 * 바의 🗜 색: 진한 파랑 고정값. suggestion 은 어두운 테마에서 rgb(177,185,249) 라 흰 버튼 옆에선 흰색으로 보이고 회색 글
 * 옆(답 도는 중)에서만 파랗게 보였다. 밝은 · 어두운 바탕 둘 다에서 파랗게 읽히는 값 — 식은 캐시 점과 같은 파랑
 */
export const BRAND_HEX = '#4c9be8'

/**
 * 한 질문의 hover 묶음 — 답변 끝 질문 비용 칩과 그 답변 위 숨은 테두리 덮개가 같은 이름이라 칩에 마우스를 올리면 함께
 * 반응한다(엔진 hover scope, 사용자 2026-10-13). 이름은 끝난 시각(atMs) — 질문마다 다르다
 */
export function questionScope(atMs: number): string {
  return `q-${Math.round(atMs)}`
}

/**
 * 설정 비용표의 "★ 최적" · "★ 추천" 색 = 초록(최적 = 좋음, 판정 "좋음" 과 같은 색). 금색 #f5b301 은 주의 노랑(컴팩트하기 좋은 때)과
 * 헷갈렸다(2026-10-14 uxi C14 — 노랑은 뜻 하나)
 */
export const STAR_COLOR = 'green'

/**
 * 비용표 최적 대비 색 문턱(%): 넘으면 노랑 · 빨강, 빨강 = 비추천. 공식 값이 아니라 정한 값(설정 화면에 가정으로 적는다) —
 * 작성자 세션에서 40만부터 +56% 이상(세션 전체 재생), 표로는 +63%
 */
export const PEN_WARN_PCT = 10

export const PEN_BAD_PCT = 50

export const penColorOf = (p: number | null) => (p === null ? undefined : p > PEN_BAD_PCT ? 'red' : p > PEN_WARN_PCT ? 'yellow' : undefined)

export const isNotRecommended = (p: number | null) => p !== null && p > PEN_BAD_PCT

/**
 * 최적보다 더 드는 비율의 판정 말 — 색과 같은 기준(+10% 까지 좋음 · +50% 까지 보통 · 넘으면 비추천). % 만 있으니 무슨 뜻인지
 * 몰랐다. "쌈 · 비쌈" 은 한 글자 차라 둘 다 비싸다로 읽혀 헷갈리지 않는 말로
 */
export const penVerdict = (p: number | null): { word: string; color: string } | null =>
  p === null
    ? null
    : p > PEN_BAD_PCT
      ? { word: L('비추천', 'not advised'), color: 'red' }
      : p > PEN_WARN_PCT
        ? { word: L('보통', 'fair'), color: 'yellow' }
        : { word: L('좋음', 'good'), color: 'green' }

export type Ui = ReturnType<EngineInterface['ui']['resolve']>

export type SvgElement = (props: { source: string; alt: string; width: number; height: number; isInteractive?: true }) => unknown

/** 그림(Svg)은 데스크톱만 — 터미널 표에는 Svg 가 없어 칸 그림(Raster)으로 그린다 */
export function svgOf(ui: Ui, surface: string): SvgElement | undefined {
  return surface === 'desktop' ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
}

export type RasterElement = (props: { key: string; columns: number; rows: number; cells: string }) => unknown

/** 칸 그림(Raster)은 터미널만 — 칸마다 글자 · 색(hooks/cells.ts). 없는 엔진이면 글자 막대 · 안내로 */
export function rasterOf(ui: Ui, surface: string): RasterElement | undefined {
  return surface === 'terminal' ? (ui as unknown as { Raster?: RasterElement }).Raster : undefined
}

/** 진행 막대: 데스크톱은 둥근 SVG, 그 밖은 글자 막대 */
export function bar(ui: Ui, surface: string, percent: number, hex: string, width: number, alt: string) {
  const { Text } = ui
  const Svg = svgOf(ui, surface)
  if (Svg) return <Svg source={barSvg(percent, hex, width, 8)} alt={alt} width={width} height={8} />
  return <Text color={hex}>{textBar(percent, Math.max(6, Math.round(width / 12)))}</Text>
}

/**
 * 컨텍스트 막대의 대화 몫 색 — 크기 단계와 상관없이 늘 같은 진한 파랑. 차분한 파랑(기준 아래 막대 색)은 앞칸 상주 몫
 * (회청 · 청록)과 비슷해 덜 갈렸다
 */
export const TALK_HEX = '#3d7be0'

/**
 * 컨텍스트 막대: 앞칸들 = 영구 몫(기본 · 요약), 뒤칸 = 대화 몫(늘 같은 색). 데스크톱은 SVG(노랑 · 빨강 기준 눈금 포함),
 * 그 밖은 글자 막대를 칸마다 다른 색으로
 */
export function ctxBar(
  ui: Ui,
  surface: string,
  percent: number,
  parts: readonly { percent: number; hex: string }[],
  hex: string,
  width: number,
  alt: string,
  marks: readonly { percent: number; hex: string }[] = [],
) {
  const { Text } = ui
  const Svg = svgOf(ui, surface)
  if (Svg) {
    // 이름을 h 로 두면 JSX 함수(h)를 가린다
    const svgHeight = 8 + (marks.length > 0 ? CTX_MARK_PAD * 2 : 0)
    return <Svg key="c-bar" source={ctxBarSvg(percent, parts, hex, width, 8, marks)} alt={alt} width={width} height={svgHeight} />
  }
  // 터미널: 칸 그림 한 줄 — 상주 몫 색 · 대화 색 · 노랑 · 빨강 기준 ┃ 까지 데스크톱과 같게(글자 막대엔 기준 눈금이 없었다)
  const Raster = rasterOf(ui, surface)
  if (Raster) {
    const columns = Math.max(10, Math.round(width / 6))
    return <Raster key="c-bar" columns={columns} rows={1} cells={barCells(percent, parts, hex, columns, marks).toBase64()} />
  }
  const cells = Math.max(6, Math.round(width / 12))
  const n = Math.round((Math.max(0, Math.min(100, percent)) / 100) * cells)
  let used = 0
  const heads = parts.map((part, i) => {
    const k = Math.min(n - used, Math.round((Math.max(0, part.percent) / 100) * cells))
    used += k
    return <Text key={`c-bar-${i}`} color={part.hex}>{'█'.repeat(k)}</Text>
  })
  return (
    <Text key="c-bar">
      {heads}
      <Text color={hex}>{'█'.repeat(n - used)}</Text>
      <Text dimColor>{'░'.repeat(cells - n)}</Text>
    </Text>
  )
}

/**
 * 패널 한 줄: 이름 칸(고정 폭) · 값 · 흐린 설명을 왼쪽부터. 데스크톱 패널은 오른쪽 끝이
 * 몇 칸 잘려 보여서 값을 오른쪽 끝에 붙이지 않는다. 좁으면 설명이 다음 줄로 넘어간다
 */
export function row(ui: Ui, key: string, label: string, value: string, note?: unknown, color?: string, noteColor?: string, labelW = nameColW([label])) {
  const { Box, Text } = ui
  // 이름 칸 = 이름 폭 + 1(예전 12칸 고정), 이름은 기본 글색 — 이름-값 줄은 어디서나 한 꼴(이름 보통 · 값 굵게, 2026-10-14 uxi C)
  return (
    <Box key={key} columnGap={1}>
      <Box width={labelW} flexShrink={0}>
        <Text>{label}</Text>
      </Box>
      <Box flexShrink={1} minWidth={0}>
        <Text wrap="wrap">
          <Text bold {...(color ? { color } : {})}>
            {value}
          </Text>
          {typeof note === 'string' && note ? <Text {...(noteColor ? { color: noteColor } : { dimColor: true })}>{`  ${note}`}</Text> : null}
          {note && typeof note !== 'string' ? <Text>{'  '}{note}</Text> : null}
        </Text>
      </Box>
    </Box>
  )
}

/**
 * 데스크톱 패널 · 바의 가로 한 칸(Box 폭 1 · 간격 1) = 본문 글꼴 1ch = 7.84px(13px anthropic-sans 의 '0' 폭). 앱 웹 번들의 엔진
 * 렌더러가 width · margin · padding · columnGap 을 ch 로 그리고, bodyColumns = floor(안쪽 폭 ÷ 1ch) — 2026-10-14 render 도구 보정
 * (실물 스크린샷 4장과 대조, uxi_results/easy-compact/render/README.md). 예전 가정(그림 칸당 6px · "Box 한 칸 ≈ 12px")은 틀려
 * 막대 · 그래프가 카드 안쪽 3/4 남짓에서 멈췄고(fb A1), 글 자르는 폭은 실제보다 넓게 잡혀 오른쪽 1할을 비워 둬야 했다
 */
export const CH_PX = 7.84

/** 데스크톱 그림(Svg) 폭 상한 — 넓은 패널에서 막대 · 그래프가 끝없이 길어지지 않게(읽기 좋은 최대 폭). 예전 320 은 64칸부터 멈췄다 */
export const SVG_MAX_PX = 640

/**
 * 이름-값 줄의 값 기둥이 이 칸 수보다 좁으면 이름을 값 위에 쌓는다 — 값 · 버튼 자리가 20칸 남짓이면 줄마다 꺾였다(fb A2). 카드마다
 * 이름 폭이 달라 쌓는 패널 폭도 다르다(이름 두 글자 카드는 약 34칸, 설정 칸들은 약 40칸 아래). 패널이 넓으면 그림 · 카드가 폭을 따라
 * 늘어나고(1칸 = 1ch), 비용표는 열을 뺀다
 */
export const MIN_VALUE_COLS = 24

/** cols = 패널 글 폭(칸), nameW = 이름 칸 폭 — 카드 테두리 · 여백(CARD_INSET)과 사이 한 칸을 빼고 값 기둥이 MIN_VALUE_COLS 보다 좁으면 쌓는다 */
export function isStackedFor(cols: number | null, nameW: number): boolean {
  return cols !== null && cols - CARD_INSET - nameW - 1 < MIN_VALUE_COLS
}

/**
 * 이름 칸 폭(이름-값 줄의 이름 칸): 그 카드에서 가장 긴 이름 + 1 — 고정 칸(8 · 12 · 16)은 짧은 이름엔 비고 영어 긴 이름은
 * 두 줄로 꺾였다(2026-10-14 uxi C · fb A2). 터미널은 칸 수, 데스크톱은 ch 어림(textCh)
 */
export function nameColW(names: readonly string[]): number {
  return Math.max(...names.filter(n => n !== '').map(n => widthOf(n, onTerminal())), 2) + 1
}

/**
 * 질문별 비용의 칸 폭. amountW = 금액 칸(Box 칸), textScale = Box 칸 하나에 드는 글자 칸 수(cellsOf 기준 — 한글 2칸) — 자르는
 * 폭에 곱한다. 데스크톱 1ch(7.84px)에 한글 반 글자(6.5px) · 라틴 한 글자(약 6.7px)가 드니 약 1.15 — 넘치면 줄이 바뀌니 조금 낮게 1.1
 * (예전 1.25 는 "Box 한 칸 ≈ 12px" 가정에서 나와 글이 칸보다 넓었다 — 2026-10-14 보정)
 */
// leadW = 줄 맨 앞 칸(금액 + 그 아래 시간 "23시간 전" 9글자): 데스크톱 7칸 ≈ 84px, 터미널 9칸
// iconW = 열기 아이콘 칸(▸ / ▾ 버튼) — 아이콘은 금액 왼쪽. 데스크톱 4칸 ≈ 40px, 터미널은 버튼이 "[ ▸ ]" 다섯 칸이라
// 4칸이면 "]" 가 다음 줄로 넘어갔다(2026-10-11 CLI). 진행 중 줄도 같은 폭을 비운다.
// iconTop = 접힌 줄(두 줄)에서 아이콘을 첫 줄에 — 데스크톱은 두 줄의 세로 가운데, 터미널은 가운데가 둘째 줄(시간 줄)이라 금액과 떨어졌다
export type Grid = { amountW: number; leadW: number; textScale: number; iconW: number; iconTop: boolean }

export const TERMINAL_GRID: Grid = { amountW: 7, leadW: 9, textScale: 1, iconW: 5, iconTop: true }

export const DESKTOP_GRID: Grid = { amountW: 5, leadW: 7, textScale: 1.1, iconW: 4, iconTop: false }

export function gridOf(surface: string): Grid {
  return surface === 'desktop' ? DESKTOP_GRID : TERMINAL_GRID
}

/**
 * 줄 맨 앞 칸: 금액(또는 순이득) + 그 아래 언제(흐리게). 시간이 둘째 줄 맨 앞이면 길이("방금" · "12시간 전")에 따라
 * 모델 · 컨텍스트가 줄마다 다른 자리에서 시작했고, 가장 잘 보이는 자리를 덜 중요한 시간이 차지했다 — 금액 밑으로
 */
export function leadCell(ui: Ui, top: unknown, when: string, g: Grid) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" width={g.leadW} flexShrink={0}>
      {top}
      {when ? <Text dimColor>{when}</Text> : null}
    </Box>
  )
}

/**
 * 펼친 내역: 한 칸 들여 읽기 · 쓰기 · 출력 줄, 그 아래 동작별 값은 트리 가지(├─ · 마지막 └─) — 질문의 하위로 읽힌다.
 * 거쳐 온 꼴: 그냥 이어 붙이면 질문 글 · 아래 줄과 한 덩어리로 보였고, 흐린 테두리 상자는 거부감이 들었고,
 * 줄마다 "-" 는 읽기 · 쓰기 · 출력과 동작별 값이 같은 층으로 보였다.
 * DETAIL_INSET = 들여쓰기 1(Box 칸) — 가지와 사이 칸은 줄 안에서 뺀다
 */
export const DETAIL_BOX = { flexDirection: 'column', marginLeft: 1 } as const

export const DETAIL_INSET = 1

/** 동작별 줄 머리 가지(├─ / └─)와 사이 칸(Box 칸) */
export const BULLET_W = 3

/** Box 칸 폭 → 그 안에 드는 글자 칸 수 */
export function textCells(g: Grid, boxCols: number): number {
  return Math.max(8, Math.floor(boxCols * g.textScale))
}

/**
 * 동작별 값(요청 하나에 한 줄): 금액 칸 · 한 일. 도구 줄 아래 "요청 $" 를 대신한다(금액이 답변 아래 · 도구 줄 · 띠
 * 세 곳에 흩어져 있었다). 한 일은 보통 색 — 흐린 글은 데스크톱 어두운 배경에서 안 읽혔다.
 * 캐시를 크게 다시 쓴 요청(식은 캐시 · 모델을 바꾼 뒤 첫 요청)만 다시 쓴 값을 붙인다(띠 rewriteNote 와 같은 기준).
 * boxCols = 이 줄들이 들어가는 글 기둥의 폭(Box 칸) — 들여쓰기 없이 질문 글과 같은 자리에서 시작한다
 */
/**
 * 동작 한 줄의 글(금액 빼고)과 캐시 다시 씀 경고 — 질문별 비용(detailRows)과 답변 아래 칩이 같이 쓴다.
 * 줄 끝은 잘린다 — 요청 수 · 모델을 앞에, 작업 이름을 뒤에. 하위 에이전트 🤖 · 앱 자체 요청 ⚙ · 컴팩트 🗜 를 머리로 가른다.
 * 에이전트는 도는 중 · 끝남도(0.4.0 전 기록엔 없다) — 작업 이름보다 앞에(줄 끝이 잘려도 보이게)
 */
export function stepText(d: StepDetail): { text: string; note: string } {
  // 메인 요청만 rewrite 가 있다 — 에이전트 · 앱 자체 요청 · 컴팩트 줄엔 없다
  const note = d.rewrite !== undefined && d.rewrite >= REWRITE_NOTE_USD ? L(` · 캐시 다시 씀 ${fmtUsd(d.rewrite)}`, ` · cache rewrite ${fmtUsd(d.rewrite)}`) : ''
  const state = d.done === false ? L(' · 도는 중', ' · running') : d.done === true ? L(' · 끝남', ' · done') : ''
  const text = d.agent
    ? withIcon('🤖', `${L(`에이전트 요청 ${d.steps ?? 1}회`, `agent requests ×${d.steps ?? 1}`)}${state} · ${d.model ? `${modelName(d.model)} · ` : ''}${d.label}`)
    : d.app
      ? withIcon('⚙', `${L('앱 자체 요청', "app's own requests")} · ${d.label}`)
      : d.compact
        ? compactStepText(d.compact, d.usd)
        : d.label
  return { text, note }
}

export function detailRows(ui: Ui, details: readonly StepDetail[], key: string, boxCols: number, g: Grid, hasMore = false) {
  const { Box, Text } = ui
  return details.map((d, j) => {
    const { text, note } = stepText(d)
    // "-" · 금액 칸 · 사이를 뺀 자리에 맞게 미리 자른다(줄을 안 바꾸는 글이 길면 패널 틀이 넓어진다)
    const label = fitCells(text, Math.max(8, textCells(g, boxCols - BULLET_W - g.amountW - 1) - cellsOf(note)))
    return (
      <Box key={`${key}-${j}`} columnGap={1}>
        {/* 아래에 "그 밖 동작" 줄이 붙으면(hasMore) 마지막도 ├─ */}
        <Text dimColor>{j === details.length - 1 && !hasMore ? '└─' : '├─'}</Text>
        {usdCell(ui, d.usd, false, g.amountW)}
        <Box flexShrink={1} minWidth={0}>
          <Text wrap="truncate-end">
            {label}
            {note ? <Text color="yellow">{note}</Text> : null}
          </Text>
        </Box>
      </Box>
    )
  })
}

/**
 * 컴팩트 단계 표시 — 띠 버튼 자리와 질문별 비용의 진행 중 줄이 같은 꼴(깜빡이는 점 · 글 색 · 글)을 쓴다.
 * 같은 순간을 띠는 "● 저장 중 → 끝나면 컴팩트", 패널은 "진행 중 🗜 저장하고 컴팩트 — 저장 턴" 으로 달리 보였다
 */
// 진행은 진행 색 하나(파랑) — 저장 중이 노랑이면 "주의" 로 읽혔다(2026-10-14 uxi 색 표: 노랑은 좋은 때 · 주의만)
const PHASE_HEX = { tidying: '#4c9be8', compacting: '#4c9be8' } as const

/**
 * 단계 표시(없으면 null) — 컴팩트 중 글엔 어떤 컴팩트인지(compactKind): "🗜 바로 컴팩트 중…". 뒤에 붙던 "요약을 만들고
 * 있습니다" 는 "컴팩트 중" 과 같은 말이고, 이름이 길어져 뺐다
 */
export function phaseLook(phase: unknown, kind: unknown, hasIcon = true): { hex: string; color: string; text: string } | null {
  // 바는 🗜 를 따로 파랗게 그려 글엔 빼고 받는다(hasIcon = false)
  const icon = (text: string) => (hasIcon ? withIcon('🗜', text) : text)
  // 글자색은 테마 suggestion(밝은 · 어두운 테마 둘 다 읽히는 파랑) — 점 · 🗜 의 고정 파랑과 같은 계열
  if (phase === 'tidying') return { hex: PHASE_HEX.tidying, color: ACCENT, text: icon(L('저장 중 → 끝나면 컴팩트', 'Saving → then compact')) }
  if (phase !== 'compacting') return null
  const name = typeof kind === 'string' && kind ? kind : L('컴팩트', 'Compact')
  return { hex: PHASE_HEX.compacting, color: ACCENT, text: icon(L(`${name} 중…`, `${name} in progress…`)) }
}

/** 보통 진행 중 질문의 깜빡이는 점(ACCENT 와 비슷한 파랑) */
export const LIVE_HEX = '#4c9be8'

/** 깜빡이는 점: 데스크톱은 깜빡이는 그림, 터미널은 같은 색 ● 한 칸(그림 글자 대신 — 띠 버튼의 🟡 · 🔴 를 뺀 자리의 색 표시) */
export function pulseDot(ui: Ui, surface: string, hex: string, alt: string) {
  const Svg = svgOf(ui, surface)
  if (Svg) return <Svg source={pulseSvg(hex, 10)} alt={alt} width={10} height={10} isInteractive />
  return surface === 'terminal' ? <ui.Text color={hex}>●</ui.Text> : null
}

/** 금액 칸: 줄 맨 앞 고정 폭 — 패널이 좁아져도 잘리지 않는다. 질문 · 동작 값이라 색 없이(시킨 일의 양) */
export function usdCell(ui: Ui, usd: number, bold = false, width = 7) {
  const { Box, Text } = ui
  return (
    <Box width={width} flexShrink={0}>
      <Text bold={bold}>
        {fmtUsd(usd)}
      </Text>
    </Box>
  )
}

/**
 * 패널 큰 구획(이 세션 · 질문별 비용 · 컴팩트)의 테두리: 둥근 회색 — 앱 입력창 테두리와 같은 테마 색이라 튀지 않고 덩어리만 나눈다.
 * 파랑은 easy-compact 가 직접 보이는 것에만: 컴팩트 확인 카드(결정할 것 — 테마 suggestion) · 답변 끝 질문 비용 칩 · 바의 🗜 ·
 * 진행(저장 중 · 컴팩트 중). 다 파랗면 그 뜻이 묻힌다(2026-10-14 uxi 파란 테두리 안 A — 칩이 생기며 "확인 카드에만" 이 낡았다)
 */
export const CARD = { borderStyle: 'round', borderColor: 'promptBorder', paddingX: 1 } as const

/**
 * 카드 제목 줄의 얇은 띠: 테두리와 같은 회색 바탕. 엔진 Box 엔 한 면만 긋는 테두리가 없어 구분선 대신 띠로
 */
export const TITLE_BAND = { backgroundColor: 'promptBorder', paddingX: 1 } as const

/** 카드 안쪽 폭이 줄어드는 칸 수: 테두리 2 + 안쪽 여백 2 */
export const CARD_INSET = 4

/**
 * 타일: 카드 안에서 "지금 볼 값" 만 같은 회색 테두리로 한 번 더 묶는다 — 컨텍스트 막대 · 컴팩트 판단(게이지 + 한 줄) ·
 * 진행 중 질문. 실시간으로 바뀌는 것만 테두리, 지난 기록(질문 목록 · 그래프 · 컴팩트 효과)은 없음 — 다 두르면 테두리가
 * 세 겹이 된다. 색은 카드와 같은 회색(상태 색이면 다시 알록달록)
 */
export const TILE = CARD

/** 타일 안 막대 폭(px)이 줄어드는 만큼: 타일 안쪽 칸 수 × 칸당 px — 터미널 칸 그림은 6px 가 한 칸, 데스크톱은 1ch = CH_PX */
export const TILE_PX = CARD_INSET * 6

export function tilePxOf(surface: string): number {
  return surface === 'desktop' ? Math.round(CARD_INSET * CH_PX) : TILE_PX
}

/**
 * 고르기 버튼 하나(탭 · 고르기 · 보기 토글 · 문구 · 언어가 같이 쓴다): 고른 쪽 = 주 버튼(채움), 안 고른 쪽 = 흐린 보조 버튼.
 * 데스크톱은 ✓ 없이 채움만 — ✓ 를 붙이니 고른 버튼만 두 칸 넓어져 옆 버튼이 밀렸다(fb A4, 2026-10-14 uxi 고른 표시 안 A). 채움 ·
 * 보조 차이가 이미 크다. 터미널은 주 버튼이 글자색만 달라 "✓ " 를 두고, 안 고른 쪽은 같은 폭 빈칸(칸이 정확해 폭이 안 바뀐다).
 * 엔진 Button 엔 "고름" 상태 속성이 없어(d.ts ButtonProps) 데스크톱 화면 읽기 프로그램엔 채움이 안 읽힌다 — 알고 둔 한계
 */
export function pickButton(ui: Ui, key: string, label: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  const text = onTerminal() ? `${isOn ? '✓' : ' '} ${label}` : label
  return isOn ? <Button key={key} label={text} variant="primary" onPress={onPress} /> : <Button key={key} label={text} variant="secondary" dimColor onPress={onPress} />
}

/**
 * 장식 아이콘(버튼 밖) — 캡슐 꼴 선 아이콘(2026-10-14 uxi 아이콘 안 A). 이모지는 글꼴 ·
 * 운영체제마다 생김새가 달라 한 화면 안에서도 그림체가 섞였다. 16칸 판에 1.5px 선, 14px 로 그린다. 버튼 안(📊 · ▸ · ✕ 등)은 엔진이
 * 글만 받아 그대로 글(d.ts ButtonProps). Svg 안은 테마 색이 안 먹어 hex — 제목 띠 위는 회색 #9aa0a8 만(띠 #484848 위 3.47:1,
 * 상태 색 아이콘은 띠 밖에서만 — 빨강은 띠 위 2.44:1 로 미달). 데스크톱만, 터미널은 아이콘 없이(그림 글자는 칸이 어긋난다 — glyph.ts),
 * 그 밖 표면(Svg 없음)은 예전 그림 글자
 */
const ICON_PATHS = {
  session: '<rect x="1.75" y="4.75" width="12.5" height="6.5" rx="3.25"/><rect x="3.4" y="6.4" width="5.6" height="3.2" rx="1.6" fill="@" stroke="none"/>',
  questions: '<rect x="1.75" y="2.25" width="12.5" height="3" rx="1.5"/><rect x="1.75" y="6.5" width="9" height="3" rx="1.5"/><rect x="1.75" y="10.75" width="5.5" height="3" rx="1.5"/>',
  compact: '<rect x="4.6" y="4.75" width="6.8" height="6.5" rx="3.25"/><path d="M1.4 5.2 3.6 8 1.4 10.8M14.6 5.2 12.4 8 14.6 10.8"/>',
  cold: '<rect x="1.75" y="4.75" width="12.5" height="6.5" rx="3.25"/><path d="M8 6.1v3.8M6.35 7.05l3.3 1.9M6.35 8.95l3.3-1.9"/>',
  switch: '<rect x="1.75" y="2.5" width="8.5" height="4.5" rx="2.25"/><rect x="5.75" y="9" width="8.5" height="4.5" rx="2.25"/><path d="M12.3 4.75h1.95v2.1M3.7 11.25H1.75v-2.1"/>',
  held: '<rect x="1.75" y="4.75" width="12.5" height="6.5" rx="3.25"/><path d="M6.8 6.6v2.8M9.2 6.6v2.8"/>',
  update: '<rect x="1.75" y="8.25" width="12.5" height="5.5" rx="2.75"/><path d="M8 1.9v5M5.8 4.1 8 1.9l2.2 2.2"/>',
} as const

export type IconName = keyof typeof ICON_PATHS

/** Svg 를 못 그리는 표면의 그림 글자(예전 아이콘) */
const ICON_GLYPH: Record<IconName, string> = { session: '💰', questions: '🧾', compact: '🗜', cold: '🧊', switch: '🔄', held: '⏸', update: '⬆' }

/** 장식 아이콘 기본 회색 — 제목 띠 · 쉬는 상태(어두운 · 밝은 바탕 둘 다 읽히는 중간 회색) */
export const ICON_GRAY = '#9aa0a8'

export const ICON_PX = 14

export function iconSvg(name: IconName, hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_PX}" height="${ICON_PX}" viewBox="0 0 16 16" fill="none" stroke="${hex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name].split('@').join(hex)}</svg>`
}

/**
 * 장식 아이콘 하나: 데스크톱은 Svg, 터미널은 없음(null), 그 밖은 그림 글자. glyphLook = 그림 글자일 때 글 색(예전과 같게)
 */
export function decoIcon(ui: Ui, name: IconName, hex: string, alt: string, key?: string, glyphLook: { color?: string; dimColor?: boolean } = {}) {
  const Svg = onDesktop() ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
  if (Svg) return <Svg key={key ?? `icon-${name}`} source={iconSvg(name, hex)} alt={alt} width={ICON_PX} height={ICON_PX} />
  const glyph = iconOf(ICON_GLYPH[name])
  return glyph ? (
    <ui.Text key={key ?? `icon-${name}`} {...glyphLook}>
      {glyph}
    </ui.Text>
  ) : null
}

/** 카드 접기: 제목 줄 맨 앞 ▾ / ▸ 버튼. 접으면 제목 줄(그 카드의 요약)만 남는다 */
export type Fold = { isOpen: boolean; onToggle: () => void }

/** 카드 접기 버튼 — 질문 줄의 펼치기 아이콘과 같은 꼴. 오른쪽 끝은 데스크톱에서 잘려 맨 앞에 */
export function foldButton(ui: Ui, key: string, fold: Fold) {
  const { Button } = ui
  return <Button key={`fold-${key}`} label={fold.isOpen ? '▾' : '▸'} variant="secondary" onPress={fold.onToggle} />
}

/**
 * 구획: 제목(청록 굵게) · 흐린 설명, 아래 내용. isCard 면 회색 테두리 카드, icon 은 제목 앞 그림 글자 —
 * 글자 크기는 엔진 Text 에 없어(색 · 굵게뿐) 큰 구획은 아이콘으로 눈에 띄게 한다. 사이는 공백 대신 칸 간격(데스크톱이 공백을 자른다).
 * fold 가 있으면 제목 줄 맨 앞에 접기 버튼, 접으면 내용 없이 제목 줄만(간략 보기 — 제목 옆 요약이 그 카드의 한 줄)
 */
export function section(
  ui: Ui,
  key: string,
  title: string,
  children: unknown[],
  hint?: unknown,
  isCard = false,
  icon?: IconName,
  fold?: Fold,
) {
  const { Box, Text } = ui
  const isOpen = fold?.isOpen ?? true
  return (
    <Box key={key} flexDirection="column" marginTop={1} rowGap={0} {...(isCard ? CARD : {})}>
      {/* 카드 제목 아래는 한 칸 — 컴팩트 확인 카드처럼 제목과 내용을 띄운다 */}
      <Box columnGap={1} alignItems="center" flexWrap="wrap" marginBottom={isCard && isOpen ? 1 : 0} {...(isCard ? TITLE_BAND : {})}>
        {fold ? foldButton(ui, key, fold) : null}
        {/* 제목 띠 위 아이콘은 회색 하나(색은 띠 밖에서만) */}
        {icon ? decoIcon(ui, icon, ICON_GRAY, title, `${key}-icon`) : null}
        {/* 제목은 기본 글색 굵게 — 청록은 회색 띠 위에서 대비가 3.66:1 이라 덜 읽혔다(2026-10-14 uxi E1). 색은 제목 앞 아이콘이 맡는다 */}
        <Text bold>{title}</Text>
        {/* 카드 제목 옆 설명은 보통 색("API 정가 환산"), 설정 안 작은 제목 옆은 흐리게 */}
        {hint ? <Text {...(isCard ? {} : { dimColor: true })}>{hint}</Text> : null}
      </Box>
      {isOpen ? children : null}
    </Box>
  )
}

/** 질문 한 줄(접힌 꼴): 금액 · 질문 앞부분, 아래 흐린 줄에 언제 · 컨텍스트 · 내역(좁으면 줄바꿈) */
/**
 * 질문 하나가 컨텍스트에 남긴 양: " (+54k)". 3만 넘으면 노랑, 10만 넘으면 빨강, 줄었으면(컴팩트) 초록.
 * 모델을 바꾼 질문은 컴팩트가 아니라 모델이 바뀌어 달라진 것이다(2026-10-11 Opus 5.5 → Sonnet 5.5: 222k → 185k,
 * 이전 모델의 생각 블록이 빠지거나 세는 방식이 다른 듯) — 그렇게 적는다
 */
export function growthText(ui: Ui, growth: number, isModelSwitch = false) {
  const { Text } = ui
  if (isModelSwitch) return <Text>{` (${growth < 0 ? '−' : '+'}${fmtTokens(Math.abs(growth))} · ${L('모델 바뀜', 'model switched')})`}</Text>
  if (growth < 0) return <Text color="green">{` (−${fmtTokens(-growth)} ${L('컴팩트', 'compact')})`}</Text>
  const color = growth >= 100_000 ? 'red' : growth >= 30_000 ? 'yellow' : undefined
  return <Text {...(color ? { color } : { dimColor: true })}>{` (+${fmtTokens(growth)})`}</Text>
}

/**
 * 빈 자리 한 줄: 데이터가 아직 없거나(기능 전 기록 · 첫 턴 전) 못 그릴 때 — 어디서나 같은 꼴.
 * 무엇이 없고, 언제 채워지는지를 말한다
 */
export function emptyLine(ui: Ui, key: string, text: string) {
  const { Text } = ui
  return (
    <Text key={key} dimColor wrap="wrap">
      {`· ${text}`}
    </Text>
  )
}
