/**
 * 그림 글자(이모지): 데스크톱 · VS Code 는 그대로, 터미널에선 뺀다. 앱 터미널 패널은 📊 · 🧠 같은 2칸 그림 글자를 1칸처럼
 * 그려(뒤 빈칸을 먹는다) 엔진이 센 칸과 어긋났고, 다시 그릴 때 안 지워진 글자(카드 제목 끝 "$", 띠의 "░ %")가 남았다
 * (2026-10-11 CLI 확인). Claude Code 도 터미널에선 1칸 기호(✻ ⎿ ❯)만 쓴다 — ✓ · ✕ · ★ · ● 같은 1칸 기호는 그대로 둔다.
 * 표면은 그리기 훅이 setSurface 로 알린다(한 프로세스는 표면 하나 — 앱이면 desktop, CLI 면 terminal)
 */
let isTerminal = false

export function setSurface(surface: string): void {
  isTerminal = surface === 'terminal'
}

/** 그림 글자 + 글: 터미널이면 글만 */
export function withIcon(icon: string, text: string): string {
  return isTerminal ? text : `${icon} ${text}`
}

/** 그림 글자 하나(따로 그리는 자리): 터미널이면 빈 글 — 그리는 쪽이 빈 글이면 자리째 뺀다 */
export function iconOf(icon: string): string {
  return isTerminal ? '' : icon
}
