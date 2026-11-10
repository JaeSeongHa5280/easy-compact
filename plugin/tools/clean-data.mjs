// easy-compact 자기 자료 폴더 정리 — 플러그인의 $.fs 엔 지우기가 없어 $.process.run 으로 돌린다(하루 한 번 — hooks/register.tsx cleanupOwnData).
// 쓰는 법: node clean-data.mjs <자료 폴더> <보관 일수 ≥ 1> <지금 세션 id>
// 지우는 것(그 밖은 안 건드린다 — 진단 저장 파일 debug-*.json · 캐시 · 다른 이름은 그대로):
//   turns/ · flow/ · cost/ · extra/ 바로 아래의 <세션>.json 가운데 마지막 수정이 보관 일수를 넘은 것(지금 세션 것은 빼고)
//   자료 폴더 옆 advisor-use/ 바로 아래의 <세션>.json — 같은 규칙(이 mod 가 다른 플러그인과 나누려고 쓰는 세션별 advisor 횟수 · 금액)
//   맨 위의 옛 기록 bar-log-*.json · spinner-log-*.json(지금 판은 안 쓴다 — 나이와 상관없이)
//   맨 위의 개발자 기록 trace-auto-*.json 가운데 14일 넘은 것
// 일반 파일만 지운다(링크 · 폴더는 그대로), 아래 폴더로 내려가지 않는다.
// 출력(JSON 한 줄): {"turns":n,"flow":n,"cost":n,"extra":n,"advisor":n,"logs":n,"traces":n} — 지운 수
import { lstatSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const [dir, daysArg, own] = process.argv.slice(2)
const days = Number(daysArg)
if (!dir || !Number.isFinite(days) || days < 1 || !own) {
  console.error('쓰는 법: node clean-data.mjs <자료 폴더> <보관 일수 ≥ 1> <지금 세션 id>')
  process.exit(2)
}

const DAY = 86_400_000
const now = Date.now()
const out = { turns: 0, flow: 0, cost: 0, extra: 0, advisor: 0, logs: 0, traces: 0 }

const removeIf = (path, isOld) => {
  try {
    const s = lstatSync(path)
    if (!s.isFile() || !isOld(now - s.mtimeMs)) return false
    unlinkSync(path)
    return true
  } catch {
    return false
  }
}

const names = path => {
  try {
    return readdirSync(path)
  } catch {
    return []
  }
}

for (const sub of ['turns', 'flow', 'cost', 'extra']) {
  for (const name of names(join(dir, sub))) {
    if (!name.endsWith('.json') || name === `${own}.json`) continue
    if (removeIf(join(dir, sub, name), age => age > days * DAY)) out[sub]++
  }
}
const shared = join(dir, '..', 'advisor-use')
for (const name of names(shared)) {
  if (!name.endsWith('.json') || name === `${own}.json`) continue
  if (removeIf(join(shared, name), age => age > days * DAY)) out.advisor++
}
for (const name of names(dir)) {
  if (/^(bar-log|spinner-log)-.+\.json$/.test(name)) {
    if (removeIf(join(dir, name), () => true)) out.logs++
  } else if (/^trace-auto-.+\.json$/.test(name)) {
    if (removeIf(join(dir, name), age => age > 14 * DAY)) out.traces++
  }
}
console.log(JSON.stringify(out))
