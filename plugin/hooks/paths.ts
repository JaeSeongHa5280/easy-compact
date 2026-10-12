/** 설치 경로 · 데이터 폴더 · 엔진 판 계산(공식 문서 기준). $ 를 받지 않는다 — register.tsx 가 $.plugin.root · 엔진 판을 넘긴다 */

/**
 * 마켓에서 설치하면 엔진이 <설정 폴더>/plugins/cache/<마켓>/<플러그인>/<판> 으로 복사한다(공식 문서 plugins/loading) —
 * 그 경로에서 설정 폴더와 마켓 이름을 읽는다. 폴더로 불러온 개발본이면 null
 */
export function installedFrom(root: string): { configDir: string; marketplace: string } | null {
  const m = /^(.*)\/plugins\/cache\/([^/]+)\/[^/]+\/[^/]+\/?$/.exec(root.replace(/\\/g, '/'))
  return m ? { configDir: m[1]!, marketplace: m[2]! } : null
}

/**
 * 공식 데이터 폴더 이름 plugins/data/<id> — id = "플러그인@마켓" 에서 영문 · 숫자 · _ · - 가 아닌 글자를 - 로
 * (공식 문서 plugins/components: my-plugin@my-marketplace → my-plugin-my-marketplace)
 */
export function pluginDataId(plugin: string, marketplace: string): string {
  return `${plugin}@${marketplace}`.replace(/[^A-Za-z0-9_-]/g, '-')
}

/**
 * easy-compact 이 제대로 도는 가장 낮은 Claude Code 판 — Button 안에 글(자식)을 넣는 기능이 2.1.295 에 들어왔다(변경 기록).
 * 플러그인 매니페스트엔 "최소 엔진 판" 칸이 없어 엔진이 막아 주지 않는다 — 시작할 때 재서 낮으면 바 대신 안내 한 줄
 */
export const MIN_ENGINE = '2.1.295'

/**
 * 엔진 판(`$.session.version()` 의 base, 예 "2.1.287" · "2.1.300-dev")이 min 보다 낮은가. 판을 못 읽으면 false —
 * 모르는 것을 낮다고 단정하지 않는다
 */
export function engineBelow(base: string | undefined, min: string = MIN_ENGINE): boolean {
  const nums = (v: string | undefined) => /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '')?.slice(1).map(Number) ?? null
  const a = nums(base)
  const b = nums(min)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! < b[i]!
  return false
}
