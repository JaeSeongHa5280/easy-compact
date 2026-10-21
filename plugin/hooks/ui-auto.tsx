import { L } from './i18n'
import { onTerminal } from './glyph'
import { textCh } from './text'
import { ACCENT, svgOf } from './ui-common'
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15" viewBox="0 0 28 16"><rect x=".5" y=".5" width="27" height="15" rx="7.5" fill="${isOn ? AUTO_HEX : 'rgba(128,128,128,.25)'}" ` +
    `stroke="${isOn ? AUTO_HEX : 'rgba(128,128,128,.45)'}"/><circle cx="${isOn ? 20 : 8}" cy="8" r="5.5" fill="#ffffff"/></svg>`
  )
}

export function autoToggleEl(ui: Ui, surface: string, isOn: boolean, onPress: () => void, keyProps: Record<string, unknown> = {}) {
  const { Box, Button, Text } = ui
  const name = L('이지 오토', 'Easy Auto')
  if (surface === 'terminal') return <Button key="auto-toggle" label={`4 ${isOn ? L('이지 오토 끄기', 'Easy Auto off') : L('이지 오토 켜기', 'Easy Auto on')}`} variant="secondary" {...keyProps} onPress={onPress} />
  const Svg = svgOf(ui, surface)
  return (
    <Box key="auto-toggle-box" borderStyle="round" borderColor={isOn ? ACCENT : 'promptBorder'} paddingX={1} paddingY={0} columnGap={1} alignItems="center" flexShrink={0}>
      {autoIcon(ui, surface, 'auto-toggle-icon', 12, isOn)}
      <Text {...(isOn ? { color: ACCENT } : {})} bold>
        {name}
      </Text>
      {Svg ? <Svg source={switchSvg(isOn)} alt={isOn ? L('켜짐', 'On') : L('꺼짐', 'Off')} width={26} height={15} /> : null}
      <Box key="auto-toggle-press" position="absolute" top={0} left={0}>
        <Button key="auto-toggle" label={'⠀'.repeat(Math.ceil(textCh(name)) + 10)} plain dimColor {...keyProps} onPress={onPress} />
      </Box>
    </Box>
  )
}

export function autoBarChip(ui: Ui, surface: string, label: string, onPress: (() => void) | null) {
  const { Box, Button, Text } = ui
  if (surface === 'terminal') return onPress ? <Button key="compact" label={label} variant="secondary" onPress={onPress} /> : <Text dimColor>{`[ ${label} ]`}</Text>
  return (
    <Box key="auto-bar-chip" borderStyle="round" borderColor={ACCENT} paddingX={1} paddingY={0} columnGap={1} alignItems="center" flexShrink={0}>
      {autoIcon(ui, surface, 'auto-bar-icon', 12)}
      <Text color={ACCENT}>{label}</Text>
      {onPress ? (
        <Box key="auto-bar-press" position="absolute" top={0} left={0}>
          <Button key="compact" label={'⠀'.repeat(Math.ceil(textCh(label)) + 5)} plain dimColor onPress={onPress} />
        </Box>
      ) : null}
    </Box>
  )
}

export function autoBarChipW(label: string, isTerminal: boolean): number {
  return isTerminal ? textCh(label) + 4 : Math.ceil(textCh(label)) + 7
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
