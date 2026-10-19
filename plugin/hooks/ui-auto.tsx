/**
 * 이지 오토 그리기(2026-10-19 — 정본 D:/Claude/easy-compact-auto.md §5): 아이콘(게이지 + A — 시안 1019b, 그림이 그려지는 자리만: 설정 탭 ·
 * 현황 표) · 입력창 위 안내 한 줄(멈춤 · 저절로 꺼짐). $ 를 받지 않는다 — 동작은 register.tsx 가 묶어 넘긴다
 */
import { L } from './i18n'
import { onTerminal } from './glyph'
import { textCh } from './text'
import { ACCENT, svgOf } from './ui-common'
import type { Ui } from './ui-common'

/** 아이콘 파랑(앱 강조 파랑과 같은 계열 — 두 바탕 다 보인다) */
const AUTO_HEX = '#4c9be8'

/** 3×4 칸 글자 A(배지 안 흰 글자 — 글꼴 없이 칸으로 그려 16px 에서도 또렷하다) */
function pixA(x: number, y: number, s: number): string {
  return ['.X.', 'X.X', 'XXX', 'X.X']
    .flatMap((r, j) => [...r].map((c, i) => (c === 'X' ? `<rect x="${x + i * s}" y="${y + j * s}" width="${s}" height="${s}" fill="#ffffff"/>` : '')))
    .join('')
}

/** 꺼진 아이콘 · 글 회색(바 흐린 글과 같은 값) */
const OFF_HEX = '#898781'

/** 게이지 + A(시안 1019b 안 A): 칸 막대 넷(둘 참) + 오른쪽 위 A 배지. 높이 px, 폭 = px × 26/16, hex = 켜짐 파랑 · 꺼짐 회색 */
export function autoIconSvg(px: number, hex = AUTO_HEX): string {
  const cells = [0, 1, 2, 3].map(i => `<rect x="${3 + i * 4}" y="5" width="3" height="8" fill="${hex}" opacity="${i < 2 ? 0.9 : 0.25}"/>`).join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round((px * 26) / 16)}" height="${px}" viewBox="0 0 26 16" shape-rendering="crispEdges">` +
    `<rect x="1" y="3" width="18" height="12" rx="3" fill="none" stroke="${hex}" stroke-opacity=".7" shape-rendering="geometricPrecision"/>${cells}` +
    `<rect x="17" y="0" width="9" height="9" rx="2" fill="${hex}" shape-rendering="geometricPrecision"/>${pixA(19.5, 2, 1.35)}</svg>`
  )
}

/** 아이콘 요소 — 그림을 못 그리는 표면(터미널)이면 null */
export function autoIcon(ui: Ui, surface: string, key: string, px = 14, isOn = true) {
  const Svg = svgOf(ui, surface)
  if (!Svg) return null
  return (
    <ui.Box key={key} flexShrink={0}>
      <Svg source={autoIconSvg(px, isOn ? AUTO_HEX : OFF_HEX)} alt={L('이지 오토', 'Easy Auto')} width={Math.round((px * 26) / 16)} height={px} />
    </ui.Box>
  )
}

/** 스위치 그림(앱 설정 스위치 꼴): 켜짐 = 파란 바탕 · 손잡이 오른쪽 */
function switchSvg(isOn: boolean): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="15" viewBox="0 0 28 16"><rect x=".5" y=".5" width="27" height="15" rx="7.5" fill="${isOn ? AUTO_HEX : 'rgba(128,128,128,.25)'}" ` +
    `stroke="${isOn ? AUTO_HEX : 'rgba(128,128,128,.45)'}"/><circle cx="${isOn ? 20 : 8}" cy="8" r="5.5" fill="#ffffff"/></svg>`
  )
}

/**
 * [컴팩트] 팝업 오른쪽 위 켜기(시안 1019e ① — 사용자 2026-10-19 "단순 버튼이 아니라 활성화되는 느낌으로 누르고 싶은 모양"): 아이콘(게이지 + A) ·
 * "이지 오토" · 스위치를 한 테두리에, 켜지면 파랑. 그림 · 테두리엔 누르기가 없어 위에 투명 버튼을 겹친다(게이지 문과 같은 수). 터미널은 글 버튼
 * "4 이지 오토 켜기 | 끄기"(숫자 단축키)
 */
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

/**
 * 바의 이지 오토 칩(시안 1019a ① 꼴 — 사용자 2026-10-19 "활성화되면 기존 컴팩트 버튼이랑 교체 · 원래 이걸로"): 파란 테두리 + 게이지 + A + 글.
 * 앱 버튼은 색 · 그림을 못 받아 상자로 그리고, 위에 투명 버튼을 겹쳐 누른다(게이지 문과 같은 수 — 빈 점자 칸 글, 데스크톱이 공백은 지운다).
 * 터미널은 보통 버튼 "[ 글 ]". onPress 가 없으면(답이 도는 중) 누르기 없이
 */
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

/** 바 칩 폭(칸) — 테두리 · 여백 4 + 아이콘 3 + 글 */
export function autoBarChipW(label: string, isTerminal: boolean): number {
  return isTerminal ? textCh(label) + 4 : Math.ceil(textCh(label)) + 7
}

/**
 * 입력창 위 안내 한 줄(시안 1019a "멈춤 안내 한 줄"): 글 · [다시 켜기](멈춤일 때만 — 저절로 꺼짐은 [컴팩트] 팝업에서 다시 켠다) · ✕
 */
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
