import type { EngineInterface } from 'claude-code'
import type { BarData } from './ui-bar'

export const VSCODE_SURFACE = 'vscode'

export async function isVscodeSession($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.surfaces()).includes(VSCODE_SURFACE)
  } catch {
    return false
  }
}

export const VSCODE_STACK_COLS = 40

export function vscodeBarLook(surface: string, bodyColumns: number): Pick<BarData, 'stackButtons' | 'actionsFirst' | 'revealAbove'> {
  if (surface !== VSCODE_SURFACE) return {}
  return { stackButtons: bodyColumns < VSCODE_STACK_COLS, actionsFirst: true, revealAbove: true }
}

export function paneYieldsToCard(surface: string, placement: string): boolean {
  return surface === VSCODE_SURFACE && placement === 'inline'
}

export function foldsInBand(surface: string): boolean {
  return surface === VSCODE_SURFACE
}

export function slimInBand(surface: string): boolean {
  return surface === VSCODE_SURFACE
}
