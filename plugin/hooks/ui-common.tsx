import type { EngineInterface } from 'claude-code'
import type { StepDetail } from '../types'
import { barSvg, CTX_MARK_PAD, ctxBarSvg, fmtTokens, fmtUsd, levelOf, modelName, pulseSvg, REWRITE_NOTE_USD, textBar, thresholds } from './cost'
import type { BarAnim } from './cost'
import { gaugeFrac, gaugeSvg, gaugeWidth, redDepth } from './gauge'
import type { GaugeShape } from './gauge'
import { AGENT_MAX_SHOWN, type AgentPose, agentCharSvg, agentCharWidth, workCharSvg, workCharWidth } from './agent-char'
import { flashText } from './flash'
import type { FlashKey } from './flash'
import { L } from './i18n'
import { MIN_ENGINE } from './paths'
import { iconOf, onDesktop, onTerminal, withIcon } from './glyph'
import { barCells } from './cells'
import { cellsOf, fitCells, compactStepText, labelNow, toolParts, widthOf } from './text'
import type { ToolKind } from './text'
import { isAutoSaveKind } from './tidy'

export const ACCENT = 'suggestion'

export const BRAND_HEX = '#4c9be8'

export function questionScope(atMs: number): string {
  return `q-${Math.round(atMs)}`
}

export const STAR_COLOR = 'success'

export const PEN_WARN_PCT = 10

export const PEN_BAD_PCT = 50

export const penColorOf = (p: number | null) => (p === null ? undefined : p > PEN_BAD_PCT ? 'error' : p > PEN_WARN_PCT ? 'warning' : undefined)

export const isNotRecommended = (p: number | null) => p !== null && p > PEN_BAD_PCT

export const penVerdict = (p: number | null): { word: string; color: string } | null =>
  p === null
    ? null
    : p > PEN_BAD_PCT
      ? { word: L('비추천', 'not advised'), color: 'error' }
      : p > PEN_WARN_PCT
        ? { word: L('보통', 'fair'), color: 'warning' }
        : { word: L('좋음', 'good'), color: 'success' }

export type Ui = ReturnType<EngineInterface['ui']['resolve']>

export type SvgElement = (props: { source: string; alt: string; width: number; height: number; isInteractive?: true }) => unknown

export function svgOf(ui: Ui, surface: string): SvgElement | undefined {
  return surface === 'desktop' ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
}

export function gaugeEl(
  ui: Ui,
  surface: string,
  ctx: number,
  o: { key: string; alt: string; px: number; blink?: boolean; motion?: boolean; from?: number; fromCtx?: number; live?: boolean; busy?: boolean; lit?: boolean },
) {
  const Svg = svgOf(ui, surface)
  if (!Svg) return null
  const t = thresholds()
  const hasFrom = o.fromCtx !== undefined && o.fromCtx > 0
  const shape = gaugeShapeNow()
  const frac = gaugeFrac(ctx, t.ctxWarn, t.ctxCut)
  const source = gaugeSvg({
    px: o.px,
    shape,
    frac: o.blink ? Math.round(frac * 20) / 20 : frac,
    level: levelOf(ctx),
    blink: o.blink ? Math.round(redDepth(ctx, t.ctxCut) * 4) / 4 : null,
    motion: o.motion,
    from: hasFrom ? gaugeFrac(o.fromCtx!, t.ctxWarn, t.ctxCut) : o.from,
    fromLevel: hasFrom ? levelOf(o.fromCtx!) : undefined,
    ...(hasFrom ? { fromBusy: true } : {}),
    ...(o.busy === true ? { busy: true } : {}),
    ...(o.lit === true ? { lit: true } : {}),
  })
  return <Svg key={o.key} source={source} alt={o.alt} width={gaugeWidth(shape, o.px)} height={o.px} {...(o.live === true ? { isInteractive: true } : {})} />
}

let gaugeShape: GaugeShape = 'cells'

export function setGaugeShape(shape: GaugeShape): void {
  gaugeShape = shape
}

export function gaugeShapeNow(): GaugeShape {
  return gaugeShape
}

export type RasterElement = (props: { key: string; columns: number; rows: number; cells: string }) => unknown

let isMotionOn = true

export function setMotion(on: boolean): void {
  isMotionOn = on
}

export function agentMark(ui: Ui, key: string, running: boolean | number) {
  const Svg = onDesktop() ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
  if (!Svg) return null
  const count = typeof running === 'number' ? running : running ? 1 : 0
  const isRunning = count > 0
  const pose: AgentPose = isRunning ? (isMotionOn ? 'run' : 'still') : 'done'
  const n = pose === 'run' ? count : 1
  return (
    <Svg
      key={key}
      source={agentCharSvg(16, pose, n)}
      alt={isRunning ? (count > 1 ? L(`에이전트 ${count}개 도는 중`, `${count} agents running`) : L('에이전트 도는 중', 'Agent running')) : L('에이전트 끝남', 'Agents done')}
      width={agentCharWidth(16, pose, n)}
      height={16}
      {...(pose === 'run' ? { isInteractive: true as const } : {})}
    />
  )
}

export function stageText(ui: Ui, key: FlashKey, color: string | undefined, children: unknown, o: { noFlash?: boolean; bold?: false; textKey?: string } = {}) {
  const look = o.noFlash ? (color ? { color } : {}) : flashText(key, color)
  return (
    <ui.Text {...(o.textKey ? { key: o.textKey } : {})} {...(o.bold === false ? {} : { bold: true })} {...look}>
      {children}
    </ui.Text>
  )
}

export function workMark(ui: Ui, key: string, isFrame = true, isStill = false) {
  const Svg = onDesktop() ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
  if (!Svg) return null
  const isRun = isMotionOn && !isStill
  return (
    <Svg
      key={key}
      source={workCharSvg(16, isRun ? 'run' : 'still')}
      alt={L('진행 중', 'Running')}
      width={workCharWidth(16)}
      height={16}
      {...(isRun && isFrame ? { isInteractive: true as const } : {})}
    />
  )
}

export function agentText(ui: Ui, key: string, text: string, isRunning: boolean | number, textProps: Record<string, unknown> = {}, prefix = '', noMark = false) {
  const { Box, Text } = ui
  const AGENT = '🤖 '
  const COMPACT = '🗜 '
  const isAgent = text.startsWith(AGENT)
  const ICON = isAgent ? AGENT : COMPACT
  const mark = isAgent ? agentMark(ui, `${key}-mark`, isRunning) : text.startsWith(COMPACT) ? compactMark(ui, `${key}-mark`) : null
  const extra = isAgent && typeof isRunning === 'number' && isRunning > AGENT_MAX_SHOWN && isMotionOn ? `+${isRunning - AGENT_MAX_SHOWN} ` : ''
  if (!mark)
    return (
      <Text key={key} {...textProps}>
        {`${prefix}${text}`}
      </Text>
    )
  return (
    <Box key={key} flexDirection="row" alignItems="center" columnGap={0.5}>
      {prefix ? <Text {...textProps}>{prefix}</Text> : null}
      {noMark ? null : mark}
      <Text {...textProps}>{`${noMark ? '' : extra}${text.slice(ICON.length)}`}</Text>
    </Box>
  )
}

export function rasterOf(ui: Ui, surface: string): RasterElement | undefined {
  return surface === 'terminal' ? (ui as unknown as { Raster?: RasterElement }).Raster : undefined
}

export function bar(ui: Ui, surface: string, percent: number, hex: string, width: number, alt: string) {
  const { Text } = ui
  const Svg = svgOf(ui, surface)
  if (Svg) return <Svg source={barSvg(percent, hex, width, 8)} alt={alt} width={width} height={8} />
  return <Text color={hex}>{textBar(percent, Math.max(6, Math.round(width / 12)))}</Text>
}

export const TALK_HEX = '#3d7be0'

export function ctxBar(
  ui: Ui,
  surface: string,
  percent: number,
  parts: readonly { percent: number; hex: string }[],
  hex: string,
  width: number,
  alt: string,
  marks: readonly { percent: number; hex: string }[] = [],
  anim: BarAnim | null = null,
) {
  const { Text } = ui
  const Svg = svgOf(ui, surface)
  if (Svg) {
    const svgHeight = 8 + (marks.length > 0 ? CTX_MARK_PAD * 2 : 0)
    return <Svg key="c-bar" source={ctxBarSvg(percent, parts, hex, width, 8, marks, anim)} alt={alt} width={width} height={svgHeight} {...(anim ? { isInteractive: true } : {})} />
  }
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

export function row(ui: Ui, key: string, label: string, value: string, note?: unknown, color?: string, noteColor?: string, labelW = nameColW([label])) {
  const { Box, Text } = ui
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

export const CH_PX = 7.84

export const SVG_MAX_PX = 640

export const MIN_VALUE_COLS = 24

export function isStackedFor(cols: number | null, nameW: number): boolean {
  return cols !== null && cols - CARD_INSET - nameW - 1 < MIN_VALUE_COLS
}

export function nameColW(names: readonly string[]): number {
  return Math.max(...names.filter(n => n !== '').map(n => widthOf(n, onTerminal())), 2) + 1
}

export type Grid = { amountW: number; leadW: number; textScale: number; iconW: number; iconTop: boolean }

export const TERMINAL_GRID: Grid = { amountW: 7, leadW: 9, textScale: 1, iconW: 5, iconTop: true }

export const DESKTOP_GRID: Grid = { amountW: 5, leadW: 7, textScale: 1.1, iconW: 4, iconTop: false }

export function gridOf(surface: string): Grid {
  return surface === 'desktop' ? DESKTOP_GRID : TERMINAL_GRID
}

export function leadCell(ui: Ui, top: unknown, when: string, g: Grid) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" width={g.leadW} flexShrink={0}>
      {top}
      {when ? <Text dimColor>{when}</Text> : null}
    </Box>
  )
}

export const DETAIL_BOX = { flexDirection: 'column', marginLeft: 1 } as const

export const DETAIL_INSET = 1

export const BULLET_W = 3

export function textCells(g: Grid, boxCols: number): number {
  return Math.max(8, Math.floor(boxCols * g.textScale))
}

export function stepText(d: StepDetail): { text: string; note: string } {
  const note = d.rewrite !== undefined && d.rewrite >= REWRITE_NOTE_USD ? L(` · 캐시 다시 씀 ${fmtUsd(d.rewrite)}`, ` · cache rewrite ${fmtUsd(d.rewrite)}`) : ''
  const state = d.done === false ? L(' · 도는 중', ' · running') : d.done === true ? L(' · 끝남', ' · done') : ''
  const label = labelNow(d.label)
  const text = d.agent
    ? withIcon('🤖', `${L(`에이전트 요청 ${d.steps ?? 1}회`, `agent requests ×${d.steps ?? 1}`)}${state} · ${d.model ? `${modelName(d.model)} · ` : ''}${label}`)
    : d.app
      ? withIcon('⚙', `${L('앱 자체 요청', "app's own requests")} · ${label}`)
      : d.compact
        ? compactStepText(d.compact, d.usd)
        : label
  return { text, note }
}

export const TOOL_COLOR: Readonly<Record<ToolKind, string>> = { read: 'suggestion', edit: 'autoAccept', cmd: '#1f9a8c', agent: '#d1589a', app: 'inactive' }

function toolPieces(raw: string): { text: string; kind?: ToolKind }[] | null {
  const parts = toolParts(raw)
  if (parts.length === 0) return null
  const pieces: { text: string; kind?: ToolKind }[] = []
  parts.forEach((p, i) => {
    if (i > 0) pieces.push({ text: ', ' })
    pieces.push({ text: p.shown, kind: p.kind })
    if (p.rest) pieces.push({ text: ` ${p.rest}` })
  })
  return pieces
}

function rowShown(d: StepDetail): { shown: string; text: string; note: string; isMain: boolean } {
  const { text, note } = stepText(d)
  const isMain = !d.agent && !d.app && !d.compact
  const pieces = isMain ? toolPieces(labelNow(d.label)) : null
  return { shown: pieces ? pieces.map(p => p.text).join('') : text, text, note, isMain }
}

function rowCells(g: Grid, boxCols: number, note: string): number {
  return Math.max(8, textCells(g, boxCols - BULLET_W - g.amountW - 1) - cellsOf(note))
}

export function detailCut(details: readonly StepDetail[], boxCols: number, g: Grid, tags?: ReadonlyMap<StepDetail, string>): boolean {
  return details.some(d => {
    const r = rowShown(d)
    return cellsOf(r.shown) > rowCells(g, boxCols, r.note + tagText(tags?.get(d)))
  })
}

function tagText(tag: string | undefined): string {
  return tag ? ` · ${withIcon('🔄', tag)}` : ''
}

export function ultraPieces(ui: Ui, key: string, text: string): unknown {
  const parts = text.split('Ultracode')
  if (parts.length === 1) return text
  return parts.flatMap((p, i) => [
    ...(p ? [p] : []),
    ...(i < parts.length - 1
      ? [
          <ui.Text key={`${key}-u${i}`} color="effortUltra">
            Ultracode
          </ui.Text>,
        ]
      : []),
  ])
}

export function fullButton(ui: Ui, key: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  return <Button key={key} label={isOn ? L('한 줄로 ▴', 'One line ▴') : L('글 다 보기 ▾', 'Full text ▾')} variant="secondary" onPress={onPress} />
}

function toolLine(ui: Ui, key: string, raw: string, maxCells: number): unknown[] | null {
  const pieces = toolPieces(raw)
  if (pieces === null) return null
  const { Text } = ui
  let left = fitCells(pieces.map(p => p.text).join(''), maxCells)
  const els: unknown[] = []
  pieces.forEach((p, i) => {
    if (left.length === 0) return
    const take = left.startsWith(p.text) ? p.text : left
    left = left.slice(take.length)
    els.push(
      p.kind ? (
        <Text key={`${key}-t${i}`} bold color={TOOL_COLOR[p.kind]}>
          {take}
        </Text>
      ) : (
        <Text key={`${key}-t${i}`}>{take}</Text>
      ),
    )
  })
  return els
}

export function detailRows(ui: Ui, details: readonly StepDetail[], key: string, boxCols: number, g: Grid, hasMore = false, isFull = false, tags?: ReadonlyMap<StepDetail, string>) {
  const { Box, Text } = ui
  const wrap = isFull ? ('wrap' as const) : ('truncate-end' as const)
  return details.map((d, j) => {
    const { text, note, isMain } = rowShown(d)
    const tag = tagText(tags?.get(d))
    const maxCells = isFull ? Number.POSITIVE_INFINITY : rowCells(g, boxCols, note + tag)
    const label = fitCells(text, maxCells)
    const tools = isMain ? toolLine(ui, `${key}-${j}`, labelNow(d.label), maxCells) : null
    return (
      <Box key={`${key}-${j}`} columnGap={1} alignItems="flex-start">
        <Text dimColor>{j === details.length - 1 && !hasMore ? '└─' : '├─'}</Text>
        {usdCell(ui, d.usd, false, g.amountW)}
        <Box flexShrink={1} minWidth={0}>
          {((d.agent && label.startsWith('🤖 ')) || (d.compact && label.startsWith('🗜 '))) && onDesktop() ? (
            agentText(ui, `${key}-${j}-agent`, label, d.done === false, { wrap })
          ) : (
            <Text wrap={wrap}>
              {tools ?? label}
              {note ? <Text color="warning">{note}</Text> : null}
              {tag ? <Text>{ultraPieces(ui, `${key}-${j}-tag`, tag)}</Text> : null}
            </Text>
          )}
        </Box>
      </Box>
    )
  })
}

const PHASE_HEX = { tidying: '#4c9be8', compacting: '#4c9be8' } as const

export function phaseLook(phase: unknown, kind: unknown, hasIcon = true): { hex: string; color: string; text: string } | null {
  const icon = (text: string) => (hasIcon ? withIcon('🗜', text) : text)
  if (phase === 'tidying')
    return { hex: PHASE_HEX.tidying, color: ACCENT, text: icon(isAutoSaveKind(kind) ? L('이지 오토 · 저장 중 → 끝나면 컴팩트', 'Easy Auto · saving → then compact') : L('저장 중 → 끝나면 컴팩트', 'Saving → then compact')) }
  if (phase !== 'compacting') return null
  const name = typeof kind === 'string' && kind ? kind : L('컴팩트', 'Compact')
  return { hex: PHASE_HEX.compacting, color: ACCENT, text: icon(L(`${name} 중…`, `${name} in progress…`)) }
}

export const LIVE_HEX = '#4c9be8'

export function pulseDot(ui: Ui, surface: string, hex: string, alt: string, isFrame = true) {
  const Svg = svgOf(ui, surface)
  if (Svg) return <Svg source={pulseSvg(hex, 10)} alt={alt} width={10} height={10} {...(isFrame ? { isInteractive: true as const } : {})} />
  return surface === 'terminal' ? <ui.Text color={hex}>●</ui.Text> : null
}

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

export const CARD = { borderStyle: 'round', borderColor: 'promptBorder', paddingX: 1 } as const

export function titleBand(): { backgroundColor?: 'userMessageBackground'; paddingX: number } {
  return onTerminal() ? { backgroundColor: 'userMessageBackground', paddingX: 1 } : { paddingX: 0 }
}

export const CARD_INSET = 4

export const TILE = CARD

export const PREVIEW_WELL = 'rgba(128,128,128,0.10)'

export function previewChip(ui: Ui, key: string, text: string) {
  const { Box, Text } = ui
  if (onTerminal())
    return (
      <Box key={key} backgroundColor="userMessageBackground" paddingX={1} flexShrink={0}>
        <Text>{text}</Text>
      </Box>
    )
  return (
    <Box key={key} borderStyle="round" borderColor="background" backgroundColor="background" paddingX={1} paddingY={0} flexShrink={0}>
      <Text color="suggestion">{text}</Text>
    </Box>
  )
}

export function previewLabel(ui: Ui, key: string, text: string, tail: unknown = null) {
  const { Box } = ui
  return (
    <Box key={key} columnGap={1} alignItems="center" alignSelf="flex-start">
      {previewChip(ui, `${key}-chip`, text)}
      {tail}
    </Box>
  )
}

export function previewFrame(ui: Ui, key: string, label: unknown, children: unknown) {
  const { Box } = ui
  if (onTerminal())
    return (
      <Box key={key} flexDirection="column" {...TILE}>
        {label}
        {children}
      </Box>
    )
  return (
    <Box key={key} flexDirection="column" rowGap={1} borderStyle="round" borderColor={PREVIEW_WELL} backgroundColor={PREVIEW_WELL} paddingX={1}>
      {label}
      {children}
    </Box>
  )
}

export const TILE_PX = CARD_INSET * 6

export function tilePxOf(surface: string): number {
  return surface === 'desktop' ? Math.round(CARD_INSET * CH_PX) : TILE_PX
}

export function pickButton(ui: Ui, key: string, label: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  const text = onTerminal() ? `${isOn ? '✓' : ' '} ${label}` : label
  if (onTerminal()) return isOn ? <Button key={key} label={text} variant="secondary" onPress={onPress} /> : <Button key={key} label={text} variant="secondary" dimColor onPress={onPress} />
  return isOn ? <Button key={key} label={`✓ ${label}`} variant="secondary" onPress={onPress} /> : <Button key={key} label={label} variant="secondary" dimColor onPress={onPress} />
}

export function segButton(ui: Ui, key: string, label: string, isOn: boolean, onPress: () => void) {
  const { Button } = ui
  if (onTerminal()) return pickButton(ui, key, label, isOn, onPress)
  if (!isOn) return <Button key={key} label={label} plain dimColor onPress={onPress} />
  const { Box } = ui
  return (
    <Box key={`${key}-on`} borderStyle="round" borderColor={SEG_ON_EDGE} paddingX={0} paddingY={0}>
      <Button key={key} label={label} variant="secondary" onPress={onPress} />
    </Box>
  )
}

const SEG_BG = 'rgba(128,128,128,0.08)'
const SEG_EDGE = 'rgba(128,128,128,0.32)'
export const SEG_ON_EDGE = 'rgba(128,128,128,0.5)'

export function lockedSeg(ui: Ui, key: string, items: readonly { key: string; label: string; isOn: boolean }[]) {
  const { Box, Text } = ui
  if (onTerminal()) {
    return (
      <Box key={key} columnGap={2} flexWrap="wrap" alignItems="center">
        {items.map(it => (
          <Box key={`${it.key}-locked`}>
            <Text dimColor>{`${it.isOn ? '✓' : ' '} ${it.label}`}</Text>
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Box key={key} columnGap={0} alignItems="center" flexWrap="wrap" borderStyle="round" borderColor={SEG_EDGE} backgroundColor={SEG_BG} paddingX={0.25} paddingY={0.2}>
      {items.map(it =>
        it.isOn ? (
          <Box key={`${it.key}-locked`} borderStyle="round" borderColor={SEG_ON_EDGE} paddingX={0.8}>
            <Text dimColor>{it.label}</Text>
          </Box>
        ) : (
          <Box key={`${it.key}-locked`} paddingX={0.8}>
            <Text dimColor>{it.label}</Text>
          </Box>
        ),
      )}
    </Box>
  )
}

export function segGroup(ui: Ui, key: string, children: unknown) {
  const { Box } = ui
  if (onTerminal()) {
    return (
      <Box key={key} columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center">
        {children}
      </Box>
    )
  }
  return (
    <Box key={key} columnGap={0} alignItems="center" flexWrap="wrap" borderStyle="round" borderColor={SEG_EDGE} backgroundColor={SEG_BG} paddingX={0.25} paddingY={0.2}>
      {children}
    </Box>
  )
}

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

const ICON_GLYPH: Record<IconName, string> = { session: '💰', questions: '🧾', compact: '🗜', cold: '🧊', switch: '🔄', held: '⏸', update: '⬆' }

export const ICON_GRAY = '#9aa0a8'

export const ICON_PX = 14

export function iconSvg(name: IconName, hex: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_PX}" height="${ICON_PX}" viewBox="0 0 16 16" fill="none" stroke="${hex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name].split('@').join(hex)}</svg>`
}

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

export function compactMark(ui: Ui, key: string, px = ICON_PX) {
  const Svg = onDesktop() ? (ui as unknown as { Svg?: SvgElement }).Svg : undefined
  if (!Svg) return null
  const shape = gaugeShapeNow()
  return <Svg key={key} source={gaugeSvg({ px, shape, frac: 1, level: 'ok', busy: true, motion: false })} alt={L('이지 컴팩트', 'Easy Compact')} width={gaugeWidth(shape, px)} height={px} />
}

export function compactMarkCells(ui: Ui): number {
  return onDesktop() && (ui as unknown as { Svg?: SvgElement }).Svg ? Math.ceil(gaugeWidth(gaugeShapeNow(), ICON_PX) / CH_PX) + 1 : 0
}

export type Fold = { isOpen: boolean; onToggle: () => void }

export function foldHead(ui: Ui, key: string, title: string, fold: Fold) {
  const { Button } = ui
  const mark = onTerminal() ? (fold.isOpen ? '▾' : '▸') : fold.isOpen ? '⌄' : '›'
  return <Button key={`fold-${key}`} label={`${title} ${mark}`} plain dimColor onPress={fold.onToggle} />
}

export function foldCard(ui: Ui, key: string, title: string, fold: Fold, children: unknown[], hint?: unknown) {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" marginTop={1}>
      <Box key={`${key}-head`} columnGap={1} alignItems="center" flexWrap="wrap">
        {foldHead(ui, key, title, fold)}
        {hint === undefined || hint === null || hint === '' ? null : <Box key={`${key}-hint`}>{typeof hint === 'string' ? <Text dimColor>{hint}</Text> : hint}</Box>}
      </Box>
      {fold.isOpen ? (
        <Box key={`${key}-card`} flexDirection="column" {...CARD}>
          {children}
        </Box>
      ) : null}
    </Box>
  )
}

export function plainCard(ui: Ui, key: string, title: unknown, rows: unknown[], hint?: unknown) {
  const { Box, Text } = ui
  const units = rows.filter(r => r !== null && r !== undefined && r !== false)
  const body: unknown[] = []
  units.forEach((r, i) => {
    if (i > 0) body.push(rowLine(ui, `${key}-line-${i}`))
    body.push(r)
  })
  return (
    <Box key={key} flexDirection="column" marginTop={1}>
      <Box key={`${key}-head`} columnGap={1} alignItems="center" flexWrap="wrap">
        {typeof title === 'string' ? <Text bold>{title}</Text> : title}
        {hint === undefined || hint === null || hint === '' ? null : <Box key={`${key}-hint`}>{typeof hint === 'string' ? <Text dimColor>{hint}</Text> : hint}</Box>}
      </Box>
      <Box key={`${key}-card`} flexDirection="column" {...CARD}>
        {body}
      </Box>
    </Box>
  )
}

export function foldButton(ui: Ui, key: string, fold: Fold) {
  const { Button } = ui
  return <Button key={`fold-${key}`} label={fold.isOpen ? '▾' : '▸'} variant="secondary" onPress={fold.onToggle} />
}


export function onOffControl(ui: Ui, id: string, isOn: boolean, onSet: (on: boolean) => void, disabled = false, onName = L('켬', 'On')) {
  if (onDesktop() && 'Client' in ui) return <ui.Client key={`sw-${id}`} module="./switch.tsx" props={{ on: isOn, disabled }} width={5} height={1} />
  if (disabled) {
    const dim = (key: string, label: string, isOn: boolean) => (
      <ui.Button key={key} label={onTerminal() ? `${isOn ? '✓' : ' '} ${label}` : isOn ? `✓ ${label}` : label} variant="secondary" dimColor onPress={() => {}} />
    )
    return segGroup(ui, `sw-${id}-seg`, [dim(`sw-${id}-off`, L('끄기', 'Off'), !isOn), dim(`sw-${id}-on`, onName, isOn)])
  }
  return segGroup(ui, `sw-${id}-seg`, [segButton(ui, `sw-${id}-off`, L('끄기', 'Off'), !isOn, () => onSet(false)), segButton(ui, `sw-${id}-on`, onName, isOn, () => onSet(true))])
}

export function onOffW(onName = L('켬', 'On')): number {
  return onDesktop() ? 5 : widthOf(L('끄기', 'Off'), true) + widthOf(onName, true) + 10
}

export function appSection(ui: Ui, key: string, title: string, rows: unknown[], hint?: unknown, fold?: Fold) {
  const { Box, Text } = ui
  const units = rows.filter(r => r !== null && r !== undefined && r !== false)
  const body: unknown[] = []
  units.forEach((r, i) => {
    if (i > 0) body.push(rowLine(ui, `${key}-line-${i}`))
    body.push(r)
  })
  if (fold) return foldCard(ui, key, title, fold, fold.isOpen ? body : [], hint)
  return (
    <Box key={key} flexDirection="column" marginTop={onTerminal() ? 1 : 4}>
      <Box key={`${key}-head`} columnGap={1} alignItems="center" flexWrap="wrap">
        <Text bold>{title}</Text>
        {typeof hint === 'string' ? <Text dimColor>{hint}</Text> : (hint ?? null)}
      </Box>
      {body}
    </Box>
  )
}


export function rowLine(ui: Ui, key: string) {
  if (onDesktop()) return <ui.Box key={key} height={0.06} marginY={1} backgroundColor="promptBorder" />
  return onTerminal() ? <ui.Box key={key} height={1} /> : null
}

export function settingRow(ui: Ui, key: string, name: unknown, desc: unknown, control: unknown, extra: unknown[] = [], stack = false) {
  const { Box, Text } = ui
  const nameEl = typeof name === 'string' ? <Text>{name}</Text> : name
  const descEl =
    desc === null || desc === undefined || desc === '' ? null : typeof desc === 'string' ? (
      <Text dimColor wrap="wrap">
        {desc}
      </Text>
    ) : (
      desc
    )
  const hasControl = control !== null && control !== undefined
  return (
    <Box key={key} flexDirection="column">
      <Box key={`${key}-main`} flexDirection={stack ? 'column' : 'row'} columnGap={2} rowGap={0} alignItems={stack ? 'stretch' : 'center'} paddingY={onTerminal() ? 0 : 0.6}>
        <Box key={`${key}-l`} flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0}>
          {nameEl}
          {descEl}
        </Box>
        {hasControl ? (
          <Box key={`${key}-r`} flexShrink={0} columnGap={1} rowGap={1} alignItems="center" justifyContent={stack ? 'flex-start' : 'flex-end'} flexWrap="wrap">
            {control}
          </Box>
        ) : null}
      </Box>
      {extra}
    </Box>
  )
}

export function helpTip(ui: Ui, key: string, text: unknown, top: number, toggle?: () => void): { mark: unknown; card: unknown } {
  const { Box, Button, Text } = ui
  const scope = `ec-tip-${key}`.slice(0, 64)
  const body = typeof text === 'string' ? <Text wrap="wrap">{text}</Text> : text
  if (onTerminal()) return { mark: toggle ? <Button key={`${key}-q`} label="?" variant="secondary" dimColor onPress={toggle} /> : null, card: null }
  return {
    mark: (
      <Box key={`${key}-q`} hover={{ scope }}>
        {toggle ? <Button key={`${key}-qb`} label="?" variant="secondary" dimColor onPress={toggle} /> : <Text dimColor>?</Text>}
      </Box>
    ),
    card: (
      <Box key={`${key}-card`} position="absolute" top={top} left={0} right={0} display="none" hover={{ display: 'flex', scope }} backgroundColor="userMessageBackground" borderStyle="round" borderColor="promptBorder" paddingX={1}>
        {body}
      </Box>
    ),
  }
}

export function hoverTip(ui: Ui, key: string, anchor: unknown, text: unknown, toggle?: { isOpen: boolean; onToggle: () => void }) {
  const { Box, Text } = ui
  const tip = helpTip(ui, key, text, 1, toggle?.onToggle)
  return (
    <Box key={key} flexDirection="column">
      <Box key={`${key}-line`} columnGap={1} alignItems="center">
        {anchor}
        {tip.mark}
      </Box>
      {tip.card}
      {toggle?.isOpen ? (
        <Box key={`${key}-open`} flexDirection="column">
          {typeof text === 'string' ? (
            <Text dimColor wrap="wrap">
              {text}
            </Text>
          ) : (
            text
          )}
        </Box>
      ) : null}
    </Box>
  )
}

export function tipRow(
  ui: Ui,
  key: string,
  name: string,
  control: unknown,
  extra: unknown[],
  nameEl: unknown,
  desc: unknown,
  stack: boolean,
  toggle?: { isOpen: boolean; onToggle: () => void },
) {
  const has = desc !== null && desc !== undefined && desc !== ''
  const nm = nameEl ?? name
  if (!has) return settingRow(ui, key, nm, null, control, extra, stack)
  const { Box, Text } = ui
  const tip = helpTip(ui, key, desc, 2, toggle?.onToggle)
  const named = (
    <Box key={`${key}-nm`} columnGap={1} alignItems="center">
      {typeof nm === 'string' ? <Text>{nm}</Text> : nm}
      {tip.mark}
    </Box>
  )
  const below = toggle?.isOpen
    ? [
        <Box key={`${key}-desc`} paddingBottom={onTerminal() ? 0 : 0.4}>
          {typeof desc === 'string' ? (
            <Text dimColor wrap="wrap">
              {desc}
            </Text>
          ) : (
            desc
          )}
        </Box>,
      ]
    : []
  return settingRow(ui, key, named, null, control, [...below, ...(tip.card ? [tip.card] : []), ...extra], stack)
}

export function buttonW(label: string): number {
  return widthOf(label, onTerminal()) + (onTerminal() ? 6 : 3)
}

export function selectW(labels: readonly string[]): number {
  return Math.max(...labels.map(l => widthOf(l, onTerminal())), 2) + 4
}

export function choiceControl(ui: Ui, key: string, options: readonly { value: string; label: string }[], value: string, onPick: (value: string) => void) {
  if (!onTerminal()) {
    const { Select } = ui
    return <Select key={key} options={options} value={value} onSelect={v => onPick(v)} />
  }
  return segGroup(
    ui,
    `${key}-seg`,
    options.map(o => segButton(ui, `${key}-${o.value}`, o.label, o.value === value, () => onPick(o.value))),
  )
}

export function segChoice(ui: Ui, key: string, options: readonly { value: string; label: string }[], value: string, onPick: (value: string) => void) {
  return segGroup(
    ui,
    `${key}-seg`,
    options.map(o => segButton(ui, `${key}-${o.value}`, o.label, o.value === value, () => onPick(o.value))),
  )
}

export function choiceW(labels: readonly string[]): number {
  return onTerminal() ? labels.reduce((sum, l) => sum + buttonW(l) + 1, -1) : selectW(labels)
}

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
  if (fold && isCard) return foldCard(ui, key, title, fold, children, hint)
  const isOpen = fold?.isOpen ?? true
  return (
    <Box key={key} flexDirection="column" marginTop={1} rowGap={0} {...(isCard ? CARD : {})}>
      <Box columnGap={1} alignItems="center" flexWrap="wrap" marginBottom={isCard && isOpen ? 1 : 0} {...(isCard ? titleBand() : {})}>
        {fold ? foldButton(ui, key, fold) : null}
        {icon ? decoIcon(ui, icon, ICON_GRAY, title, `${key}-icon`) : null}
        <Text bold>{title}</Text>
        {hint ? <Text {...(isCard ? {} : { dimColor: true })}>{hint}</Text> : null}
      </Box>
      {isOpen ? children : null}
    </Box>
  )
}

export function growthText(ui: Ui, growth: number, isModelSwitch = false) {
  const { Text } = ui
  if (isModelSwitch) return <Text>{` (${growth < 0 ? '−' : '+'}${fmtTokens(Math.abs(growth))} · ${L('모델 바뀜', 'model switched')})`}</Text>
  if (growth < 0) return <Text color="success">{` (−${fmtTokens(-growth)} ${L('컴팩트', 'compact')})`}</Text>
  const color = growth >= 100_000 ? 'error' : growth >= 30_000 ? 'warning' : undefined
  return <Text {...(color ? { color } : { dimColor: true })}>{` (+${fmtTokens(growth)})`}</Text>
}

export function emptyLine(ui: Ui, key: string, text: string) {
  const { Text } = ui
  return (
    <Text key={key} dimColor wrap="wrap">
      {`· ${text}`}
    </Text>
  )
}

export function oldEngineNote(ui: Ui, at: string) {
  const { Box, Text } = ui
  return (
    <Box key="old-engine">
      <Text color="warning">
        {L(
          `이지 컴팩트는 Claude Code ${MIN_ENGINE} 이상이 필요합니다. 이 세션은 ${at} 입니다. 업데이트한 뒤 새 세션을 여세요(앱: Check for Updates · 터미널: claude update).`,
          `Easy Compact needs Claude Code ${MIN_ENGINE} or later; this session runs ${at}. Update, then start a new session (app: Check for Updates · terminal: claude update).`,
        )}
      </Text>
    </Box>
  )
}
