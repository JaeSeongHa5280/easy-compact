import type { ClientModule } from 'claude-code'

/**
 * 켜기/끄기 스위치(R3 — 앱 설정의 스위치 꼴, 사용자 2026-10-15 "true/false 는 앱 스위치 · 흐림 처리도 있다"). 엔진에 스위치 요소가
 * 없어 Client(플러그인 그리기 모듈)로 그린다: 둥근 테두리 길(폭 5칸 — 켬 = 앱 스위치 파랑 · 끔 = 옅은 회색) 안 흰 동그라미 글자 ●(켬 = 오른쪽).
 * 실물 시험(2026-10-15, 데스크톱 시험 mod): 손잡이를 상자로 그리면 타원처럼 커서 앱 꼴과 달랐고, ● 글자가 앱 스위치와 거의 같았다(A3).
 * 길 안 단추(Button)는 손잡이만 눌려 뺐다 — 포인터(onPointer)는 길 어디를 눌러도 온다(down · up 실측).
 * 누르거나(포인터 up) 초점에서 Enter · 스페이스 → post({ toggle, on }) — 훅 ui.message(register.tsx)가 설정을 바꾸고 새 props 를
 * 돌려준다(이 모듈은 상태를 안 든다 — 값은 늘 설정에서). disabled 면 흐리고 눌러도 안 보낸다.
 * 그리기 스레드에서 돈다: $ 없음, 요소는 surface.elements 만(Svg 없음)
 */
type SwitchProps = { on: boolean; disabled: boolean }

const Switch: ClientModule<SwitchProps> = (p, surface) => {
  const { Box, Text } = surface.elements
  const isOn = p.on === true
  const isOff = p.disabled === true
  const press = () => {
    if (!isOff) surface.post({ toggle: true, on: !isOn })
  }
  surface.onPointer(e => {
    if (e.type === 'up' && (e.button === undefined || e.button === 'left')) press()
  })
  surface.onKey(e => {
    if (e.key === 'return' || e.key === ' ') press()
  })
  // 0.6.0 실물: 손잡이 글자를
  // 큰 원 글자 ⬤ 로(Client 는 Text size 를 못 받음 — 엔진 검사) · 길 폭 5 → 4.8칸. 켬 = 앱 fill-accent #2a78d6(두 테마 같은 값 — 토큰 실측). 테마 키 suggestion 은 글 색이라 밝은 테마에서 남색이 된다.
  // 흐림(못 씀)은 같은 색을 옅게 — 엔진 Box 엔 투명도 속성이 없어 rgba 로
  const track = isOn ? (isOff ? 'rgba(42,120,214,0.4)' : '#2a78d6') : isOff ? 'rgba(128,128,128,0.18)' : 'rgba(128,128,128,0.5)'
  const knob = isOff ? 'rgba(255,255,255,0.55)' : '#ffffff'
  return (
    // 틀(5칸) 안 오른쪽에 붙인다 — 길은 4.2칸
    <Box width="100%" justifyContent="flex-end">
      <Box width={4.2} height={1} borderStyle="round" borderColor={track} backgroundColor={track} justifyContent={isOn ? 'flex-end' : 'flex-start'} alignItems="center" paddingX={0} paddingY={0}>
        {/* 큰 원 글자 ⬤(U+2B24) — 엔진이 Client 안 Text 의 size 를 거절해(검사 규칙) 글자 크기 대신 더 큰 원 글자로 손잡이를 키운다 */}
        <Text color={knob}>⬤</Text>
      </Box>
    </Box>
  )
}

export default Switch
