// 요율 적용일 대조(0.9.2 — 사용자 "엔진에서 못 얻으면 툴 업데이트할 때 실측해서 반영"): 엔진은 요율표도, 요율이 언제 바뀌었는지도 mod 에
// 주지 않는다. 그래서 요율이 바뀐 모델(hooks/cost.ts PRICE_TABLE 의 history 줄)마다 "언제부터 새 요율인가" 를 날짜 후보별로 바꿔 가며 이 PC
// 이번 달 합(대화 기록 + 장부 extra — 패널 "이번 달" 과 같은 셈, 컴팩트 어림은 합계 밖이라 뺌)을 내고, 앱 설정(사용량) 화면 금액과 가장
// 가까운 날을 알려 준다. 고칠 곳: 그 줄의 until(그날부터 새 요율), 가격표 발표일은 announced.
//
// 쓰는 법: node tools/rate-fit.mjs --usage <설정 화면 이번 달 $> [--month YYYY-MM] [--config <설정 폴더>] [--data <mod 데이터 폴더>] [--json]
//   --usage   앱 설정(사용량) 화면의 이번 달 금액(Claude Code 만 — Cowork 같은 다른 제품은 빼고)
//   --month   기본 = 지금 달(UTC). 지난 달도 됨
//   --config  기본 = CLAUDE_CONFIG_DIR, 없으면 ~/.claude — 그 아래 projects/ 를 읽는다
//   --data    기본 = <설정 폴더>/plugins/data/easy-compact* 중 extra/ 가 있는 곳(마켓 설치본 easy-compact-easy-compact · 개발본 easy-compact)
//   --json    사람 표 대신 JSON 한 줄(AI · 다른 도구용)
// 읽기만 한다(대화 기록 · 장부 · cost.ts). 캐시는 OS 임시 폴더(easy-compact-rate-fit-cache.json) — 두 번째부터 빠르다. 네트워크 없음.
// 공개본 플러그인 폴더에도 든다(plugin/tools) — 회사 PC 처럼 설정 화면 금액이 있는 PC 에서 바로 돌리게. 플러그인은 이 도구를 부르지 않는다.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** cost.ts PRICE_TABLE 을 읽는다(엔진 없이 node 로 — check-rates 와 같은 길). 줄마다 { match, base, long?, history[] } */
export function parseTable(src) {
  const start = src.indexOf('const PRICE_TABLE')
  const body = src.slice(start, src.indexOf(']\n', src.indexOf('= [', start)))
  const rates = (input, output, read) => ({ input, output, read, write5m: input * 1.25, write1h: input * 2 })
  const rows = []
  const parts = body.split(/(?=match:\s*\/)/).slice(1)
  for (const part of parts) {
    const m = /^match:\s*\/(.+?)\/,\s*base:\s*rates\('([^']*)',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/s.exec(part)
    if (!m) continue
    const row = { source: m[1], match: new RegExp(m[1]), label: m[2], base: rates(+m[3], +m[4], +m[5]), history: [] }
    const long = /long:\s*\{\s*over:\s*([\d_]+),\s*rates:\s*rates\('[^']*',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/s.exec(part)
    if (long) row.long = { over: Number(long[1].replace(/_/g, '')), rates: rates(+long[2], +long[3], +long[4]) }
    for (const h of part.matchAll(/until:\s*'([\d-]+)',\s*base:\s*rates\('[^']*',\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)(?:,\s*announced:\s*'([\d-]+)')?/g)) {
      row.history.push({ until: h[1], base: rates(+h[2], +h[3], +h[4]), ...(h[5] ? { announced: h[5] } : {}) })
    }
    rows.push(row)
  }
  if (rows.length === 0) throw new Error('cost.ts 에서 PRICE_TABLE 을 못 읽음 — 이 도구의 정규식을 고칠 것')
  return rows
}

/** 그날 요율(ratesFor 와 같은 규칙). over = 이 줄의 history 를 바꿔 볼 때 [줄 번호, 첫 이력의 until] */
function rateOf(rows, model, tier, day, over) {
  const i = rows.findIndex(r => r.match.test(model))
  if (i < 0) return null
  const row = rows[i]
  if (tier === 'L' && row.long) return row.long.rates
  const hist = over && over[0] === i ? row.history.map((h, k) => (k === 0 ? { ...h, until: over[1] } : h)) : row.history
  return hist.find(h => day < h.until)?.base ?? row.base
}

/** 한 달(YYYY-MM) 합 = 기록 토큰 × 그날 요율 + 장부 extra(달러) */
export function monthTotal(rows, days, extra, month, over = null) {
  let usd = 0
  for (const [day, byModel] of Object.entries(days ?? {})) {
    if (!day.startsWith(month)) continue
    for (const [model, tiers] of Object.entries(byModel)) {
      for (const [tier, t] of Object.entries(tiers)) {
        const r = rateOf(rows, model, tier, day, over)
        if (!r || !t) continue
        usd += ((t[0] ?? 0) * r.input + (t[1] ?? 0) * r.output + (t[2] ?? 0) * r.read + (t[3] ?? 0) * r.write5m + (t[4] ?? 0) * r.write1h) / 1e6
      }
    }
  }
  for (const [day, v] of Object.entries(extra ?? {})) if (day.startsWith(month) && typeof v === 'number' && Number.isFinite(v)) usd += v
  return usd
}

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/**
 * 요율이 바뀐 줄마다 적용일 후보(그 달 1일 ~ 그 달 끝 + "바뀌지 않음") 별 이번 달 합과 설정 화면과의 차. best = 차가 가장 작은 날
 */
export function fitDates(rows, days, extra, month, usage) {
  const first = `${month}-01`
  const next = addDays(`${month}-28`, 4).slice(0, 7)
  const last = addDays(`${next}-01`, -1)
  const out = []
  rows.forEach((row, i) => {
    if (row.history.length === 0) return
    const h = row.history[0]
    // 이번 달에 걸린 변경만 — 적용일 · 발표일이 둘 다 이 달 밖이면 이 달 합엔 상관없다
    const touches = [h.until, h.announced].some(d => d && d >= first && d <= addDays(last, 1))
    if (!touches) return
    const cands = []
    for (let d = first; d <= addDays(last, 1); d = addDays(d, 1)) {
      const usd = monthTotal(rows, days, extra, month, [i, d])
      cands.push({ until: d, usd, diff: usage === null ? null : usd - usage })
    }
    const never = monthTotal(rows, days, extra, month, [i, '9999-12-31'])
    const best = usage === null ? null : cands.reduce((a, b) => (Math.abs(b.diff) < Math.abs(a.diff) ? b : a))
    const changed = Object.keys(h.base).filter(k => h.base[k] !== row.base[k])
    out.push({ model: row.label, source: row.source, changed: changed.map(k => [k, h.base[k], row.base[k]]), until: h.until, announced: h.announced ?? null, cands, never: { usd: never, diff: usage === null ? null : never - usage }, best })
  })
  return out
}

/** <설정 폴더>/plugins/data/easy-compact* 중 extra/ 가 있는 곳(여럿이면 마켓 설치본 먼저) */
function findData(config) {
  const base = join(config, 'plugins', 'data')
  let names = []
  try {
    names = readdirSync(base).filter(n => n.startsWith('easy-compact'))
  } catch {
    return null
  }
  const order = ['easy-compact-easy-compact', 'easy-compact-synced', 'easy-compact']
  names.sort((a, b) => (order.indexOf(a) === -1 ? 9 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 9 : order.indexOf(b)))
  return names.map(n => join(base, n)).find(p => existsSync(join(p, 'extra'))) ?? (names[0] ? join(base, names[0]) : null)
}

function main() {
  const args = process.argv.slice(2)
  const arg = name => {
    const i = args.indexOf(name)
    return i >= 0 ? args[i + 1] : undefined
  }
  const usageArg = arg('--usage')
  const usage = usageArg === undefined ? null : Number(String(usageArg).replace(/[$,]/g, ''))
  if (usage !== null && !Number.isFinite(usage)) throw new Error(`--usage 가 숫자가 아님: ${usageArg}`)
  const now = new Date()
  const month = arg('--month') ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const config = resolve(arg('--config') ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'))
  const data = arg('--data') ? resolve(arg('--data')) : findData(config)
  const rows = parseTable(readFileSync(join(here, '..', 'hooks', 'cost.ts'), 'utf8'))
  const since = Date.parse(`${month}-01T00:00:00Z`)
  const cache = join(tmpdir(), 'easy-compact-rate-fit-cache.json')
  const run = spawnSync(process.execPath, [join(here, 'scan-spend.mjs'), join(config, 'projects'), cache, String(since), ...(data ? [data] : [])], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (run.status !== 0) throw new Error(`scan-spend 실패(${run.status}): ${run.stderr}`)
  const out = JSON.parse(run.stdout)
  const fits = fitDates(rows, out.days, out.extra, month, usage)
  const now0 = monthTotal(rows, out.days, out.extra, month)
  if (args.includes('--json')) {
    console.log(JSON.stringify({ month, usage, total: now0, data, fits }))
    return
  }
  const usd = v => `$${v.toFixed(2)}`
  const sign = v => (v === null ? '' : `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`)
  console.log(`이번 달 ${month}(UTC) · 이 PC 기록 + 장부 · 지금 요율표로 ${usd(now0)}${usage !== null ? ` · 설정 화면 ${usd(usage)} 과 ${sign(now0 - usage)}` : ''}`)
  console.log(`(장부 폴더: ${data ?? '없음 — 대화 기록만'} · 컴팩트 어림은 합계 밖이라 뺌)`)
  if (fits.length === 0) {
    console.log('이 달에 걸린 요율 변경이 없습니다.')
    return
  }
  for (const f of fits) {
    const what = f.changed.map(([k, a, b]) => `${k} ${a} → ${b}`).join(' · ')
    console.log(`\n${f.model} (${f.source}) — ${what} · 지금 적용일 ${f.until}${f.announced ? ` · 가격표 발표 ${f.announced}` : ''}`)
    // 금액이 같은 날이 이어지면 한 줄로(그 사이 그 모델을 안 쓴 날) — 표시(지금 · 가격표 · 가장 가까움)가 붙은 날은 따로
    const markOf = c => [c.until === f.until ? '지금' : '', f.best && c.until === f.best.until ? '← 가장 가까움' : '', c.until === f.announced ? '가격표' : ''].filter(Boolean).join(' · ')
    const groups = []
    for (const c of f.cands) {
      const g = groups[groups.length - 1]
      if (g && !markOf(c) && !markOf(g.last) && Math.abs(g.last.usd - c.usd) < 0.005) g.last = c
      else groups.push({ first: c, last: c })
    }
    for (const g of groups) {
      const when = g.first === g.last ? `${g.first.until} 부터` : `${g.first.until} ~ ${g.last.until.slice(5)} 부터`
      console.log(`  ${when.padEnd(20)} ${usd(g.first.usd).padStart(10)}  ${sign(g.first.diff).padStart(10)}  ${markOf(g.first)}`)
    }
    console.log(`  바뀌지 않음  ${usd(f.never.usd).padStart(10)}  ${sign(f.never.diff).padStart(10)}`)
    if (f.best && f.best.until !== f.until) console.log(`  → hooks/cost.ts 의 이 줄 until 을 '${f.best.until}' 로(가격표 날짜는 announced 에 두고), 시험 · 판 올리기`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
