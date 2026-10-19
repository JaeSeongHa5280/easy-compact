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
 * 앤트로픽 디렉터리(claude.ai)에서 받은 설치본: 엔진이 <설정 폴더>/plugins/synced/ 아래에 두고 id 는 "<이름>@synced"(공식 문서
 * plugins/loading — synced 는 마켓 이름으로 못 쓰는 예약어). 그 설정 폴더와 마켓 자리 "synced", 아니면 null
 */
export function syncedFrom(root: string): { configDir: string; marketplace: 'synced' } | null {
  const m = /^(.*)\/plugins\/synced\//.exec(`${root.replace(/\\/g, '/').replace(/\/$/, '')}/`)
  return m ? { configDir: m[1]!, marketplace: 'synced' } : null
}

/**
 * 공식 데이터 폴더 이름 plugins/data/<id> — id = "플러그인@마켓" 에서 영문 · 숫자 · _ · - 가 아닌 글자를 - 로
 * (공식 문서 plugins/components: my-plugin@my-marketplace → my-plugin-my-marketplace)
 */
export function pluginDataId(plugin: string, marketplace: string): string {
  return `${plugin}@${marketplace}`.replace(/[^A-Za-z0-9_-]/g, '-')
}

/** "0.5.0" > "0.4.1" — 숫자 세 칸만 견준다. 못 읽으면 false(새 판이라고 단정하지 않는다) */
export function versionGt(a: string | null | undefined, b: string | null | undefined): boolean {
  const nums = (v: string | null | undefined) => /^(\d+)\.(\d+)\.(\d+)/.exec(v ?? '')?.slice(1).map(Number) ?? null
  const x = nums(a)
  const y = nums(b)
  if (!x || !y) return false
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!
  return false
}

/** 마켓 사본의 .claude-plugin/marketplace.json → 이 플러그인 판(없으면 null) */
export function marketVersionOf(json: unknown, plugin = 'easy-compact'): string | null {
  const list = (json as { plugins?: unknown } | null)?.plugins
  const p = Array.isArray(list) ? (list as { name?: unknown; version?: unknown }[]).find(x => x?.name === plugin) : undefined
  return typeof p?.version === 'string' ? p.version : null
}

/**
 * CHANGELOG(.ko).md 에서 한 판의 바뀐 것 — 절(### 바뀜 · 새로 생김 · 뺌 · 고침)마다 맨 위 항목의 머리만: 굵은 글로 시작하면 그것,
 * 아니면 첫 " — " · 마침표 앞. 마켓 사본에 받아 둔 파일이라 네트워크 없음. 그 판 절이 없으면 null
 */
export function changelogItems(md: string, version: string, maxItems = 20): { head: string; items: string[] }[] | null {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex(l => l.startsWith(`## [${version}]`))
  if (start < 0) return null
  const groups: { head: string; items: string[] }[] = []
  let count = 0
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    if (line.startsWith('### ')) {
      groups.push({ head: line.slice(4).trim(), items: [] })
      continue
    }
    if (!line.startsWith('- ') || count >= maxItems) continue
    const text = line.slice(2)
    const bold = /^\*\*(.+?)\*\*/.exec(text)
    const lead = bold ? bold[1]! : text.split(/ — |\.\s/)[0]!
    const plain = lead
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|`/g, '')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim()
      .replace(/\.$/, '')
    if (!plain) continue
    if (groups.length === 0) groups.push({ head: '', items: [] })
    groups[groups.length - 1]!.items.push(plain)
    count++
  }
  return groups.filter(g => g.items.length > 0)
}

/**
 * U1(0.6.1 피드백 "내 판보다 높은 모든 판의 바뀐 것을 판별로"): CHANGELOG 에 적힌 판 가운데 from < v ≤ to 인 것을 새 판부터. from 이
 * null 이면 to 하나만(본 판을 모를 때 — 0.5.0 전부터 쓰던 사람). 못 읽는 판 이름은 뺀다
 */
export function changelogVersionsBetween(md: string, from: string | null, to: string | null): string[] {
  if (!to) return []
  const all = [...md.matchAll(/^## \[(\d+\.\d+\.\d+[^\]]*)\]/gm)].map(m => m[1]!)
  const picked = from === null ? all.filter(v => v === to) : all.filter(v => versionGt(v, from) && !versionGt(v, to))
  return [...new Set(picked)].sort((a, b) => (versionGt(a, b) ? -1 : versionGt(b, a) ? 1 : 0))
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

/** 서랍에 보일 판의 범위: 새 판이 있으면 지금 판 < v ≤ 새 판, 업데이트 뒤 첫 실행이면 본 판 < v ≤ 지금 판, 그 밖엔 지금 판 하나 */
export function changeRange(own: string | null, market: string | null, seen: unknown, updatedTo: string | null | undefined): { from: string | null; to: string | null } {
  if (own && market && versionGt(market, own)) return { from: own, to: market }
  if (updatedTo) return { from: typeof seen === 'string' && versionGt(updatedTo, seen) ? seen : null, to: updatedTo }
  return { from: null, to: own }
}
