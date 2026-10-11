/** 설치 경로 · 데이터 폴더 계산(공식 문서 기준). $ 를 받지 않는다 — register.tsx 가 $.plugin.root 를 넘긴다 */

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
