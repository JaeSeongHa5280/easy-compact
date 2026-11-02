import { L } from './i18n'
import { onTerminal } from './glyph'
import { textCh } from './text'
import { CH_PX, svgOf } from './ui-common'
import type { Ui } from './ui-common'

const AUTO_HEX = '#4c9be8'

function pixA(x: number, y: number, s: number): string {
  const n = (v: number) => String(Math.round(v * 100) / 100)
  const d = ['.X.', 'X.X', 'XXX', 'X.X'].flatMap((r, j) => [...r].map((c, i) => (c === 'X' ? `M${n(x + i * s)} ${n(y + j * s)}h${s}v${s}h-${s}z` : ''))).join('')
  return `<path d="${d}" fill="#ffffff"/>`
}

const OFF_HEX = '#898781'

export function autoIconSvg(px: number, hex = AUTO_HEX): string {
  const cells = [0, 1, 2, 3].map(i => `<rect x="${3 + i * 4}" y="5" width="3" height="8" fill="${hex}" opacity="${i < 2 ? 0.9 : 0.25}"/>`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round((px * 26) / 16)}" height="${px}" viewBox="0 0 26 16" shape-rendering="crispEdges">` +
    `<rect x="1" y="3" width="18" height="12" rx="3" fill="none" stroke="${hex}" stroke-opacity=".7" shape-rendering="geometricPrecision"/>${cells}` +
    `<rect x="17" y="0" width="9" height="9" rx="2" fill="${hex}" shape-rendering="geometricPrecision"/>${pixA(19.5, 2, 1.35)}</svg>`
  )
}

export function autoIcon(ui: Ui, surface: string, key: string, px = 14, isOn = true) {
  const Svg = svgOf(ui, surface)
  if (!Svg) return null
  return (
    <ui.Box key={key} flexShrink={0}>
      <Svg source={autoIconSvg(px, isOn ? AUTO_HEX : OFF_HEX)} alt={L('이지 오토', 'Easy Auto')} width={Math.round((px * 26) / 16)} height={px} />
    </ui.Box>
  )
}

function switchSvg(isOn: boolean): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="16" viewBox="0 0 28 16">` +
    `<rect width="28" height="16" rx="8" fill="${isOn ? '#2a78d6' : 'rgba(128,128,128,0.5)'}"/>` +
    `<circle cx="${isOn ? 20 : 8}" cy="8" r="6" fill="#ffffff"/></svg>`
  )
}

const SWITCH_W = Math.ceil(28 / CH_PX)

export function autoBarChip(ui: Ui, surface: string, label: string, onPress: (() => void) | null, isOn = true) {
  const { Box, Button, Text } = ui
  if (surface === 'terminal') {
    const text = isOn ? `✓ ${label}` : label
    return onPress ? <Button key="auto-bar" label={text} variant="secondary" {...(isOn ? {} : { dimColor: true })} onPress={onPress} /> : <Text dimColor>{`[ ${text} ]`}</Text>
  }
  const Svg = svgOf(ui, surface)
  return (
    <Box key={isOn ? 'auto-bar-chip' : 'auto-bar-off'} columnGap={1} alignItems="center" flexShrink={0}>
      {label ? <Text dimColor>{label}</Text> : null}
      {Svg ? <Svg source={switchSvg(isOn)} alt={isOn ? L('이지 오토 켜짐', 'Easy Auto on') : L('이지 오토 꺼짐', 'Easy Auto off')} width={28} height={16} /> : null}
      {onPress ? (
        <Box key="auto-bar-press" position="absolute" top={0} left={0}>
          <Button key="auto-bar" label={'⠀'.repeat(autoBarChipW(label, false))} plain dimColor onPress={onPress} />
        </Box>
      ) : null}
    </Box>
  )
}

export function autoBarChipW(label: string, isTerminal: boolean): number {
  return isTerminal ? textCh(label) + 6 : Math.ceil(textCh(label)) + (label ? 1 : 0) + SWITCH_W
}

export function drawAutoNote(ui: Ui, text: string, act: { resume: (() => void) | null; dismiss: () => void }) {
  const { Box, Button, Text } = ui
  return (
    <Box key="auto-note" columnGap={1} alignItems="center" flexWrap="wrap">
      <Box key="auto-note-text" flexShrink={1} minWidth={0}>
        <Text wrap="wrap">{text}</Text>
      </Box>
      {act.resume ? <Button key="auto-note-on" label={L('다시 켜기', 'Turn on again')} variant="secondary" onPress={act.resume} /> : null}
      <Button key="auto-note-x" label="✕" variant="secondary" dimColor {...(onTerminal() ? {} : { role: 'dismiss' as const })} onPress={act.dismiss} />
    </Box>
  )
}
