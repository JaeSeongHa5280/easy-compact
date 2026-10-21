let isTerminal = false

let isDesktop = true

export function setSurface(surface: string): void {
  isTerminal = surface === 'terminal'
  isDesktop = surface === 'desktop'
}

export function onDesktop(): boolean {
  return isDesktop
}

export function onTerminal(): boolean {
  return isTerminal
}

export function withIcon(icon: string, text: string): string {
  return isTerminal ? text : `${icon} ${text}`
}

export function iconOf(icon: string): string {
  return isTerminal ? '' : icon
}
