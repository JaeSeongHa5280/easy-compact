// 오늘 · 이번 달 사용량 재료 — 모든 세션 기록(메인 <세션>.jsonl + 하위 에이전트 <세션>/subagents/*.jsonl)의 요청 토큰을
// 날짜(이 PC 지역 시각) · 모델 · 크기 묶음별로 합한다. 값(달러)은 mod 가 공식 요율표(hooks/cost.ts)로 센다 — 요율은 한 곳에만.
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부하고 기록은 수백 개라 $.process.run 으로 이 스크립트를 돌린다(scan-transcript.mjs 와 같은 길).
//
// 쓰는 법: node scan-spend.mjs <projects 폴더> <캐시 파일> <시작 시각 ms>
// 출력(JSON 한 줄): { days: { "YYYY-MM-DD": { "<model>": { S: [input, output, cacheRead, write5m, write1h], L: [...] } } }, files, scanned }
//   S = 프롬프트(입력 + 캐시 읽기 + 쓰기) 10만 이하 요청, L = 넘는 요청 — 긴 프롬프트 요율(지금은 Haiku 5.5 10만 초과 5배)을 가른다
// 캐시: 파일마다 크기 · 수정 시각이 같으면 다시 안 읽는다 — 처음 켤 때만 이번 달 기록을 다 읽는다(기록이 크면 수십 초).
// 규칙: assistant 줄의 message.usage, 같은 message.id 는 파일마다 한 번(같은 응답이 여러 번 적힌다). 날짜는 그 줄 timestamp.
//   쓰기는 usage.cache_creation 의 ephemeral_5m · 1h 로 가르고, 그 칸이 없으면 메인은 1시간 · 하위 에이전트는 5분(엔진 기본).
//   앱 자체 요청(다음 질문 제안 · 컴팩트 요청 등)은 기록에 없어 빠진다 — 화면엔 "~" 를 붙인다

import { createReadStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'

const [root, cacheFile, sinceArg] = process.argv.slice(2)
if (!root || !cacheFile) {
  console.error('쓰는 법: node scan-spend.mjs <projects 폴더> <캐시 파일> <시작 시각 ms>')
  process.exit(2)
}
const since = Number(sinceArg) || 0
const LONG_OVER = 100_000
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const two = n => String(n).padStart(2, '0')
const dayOf = ms => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** projects 아래 .jsonl(수정 시각이 since 뒤) — 프로젝트 / 세션 / subagents / workflows / wf_… 까지(워크플로 에이전트 기록은 6단계 아래) */
function walk(dir, depth, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const path = join(dir, e.name)
    if (e.isDirectory()) {
      if (depth < 8) walk(path, depth + 1, out)
    } else if (e.isFile() && e.name.endsWith('.jsonl')) {
      try {
        const st = statSync(path)
        if (st.mtimeMs >= since) out.push({ path, size: st.size, mtimeMs: st.mtimeMs, isAgent: /[\\/]subagents[\\/]/.test(path) })
      } catch {
        // 지워졌다
      }
    }
  }
}

async function scanFile(f) {
  const days = {}
  const seen = new Set()
  const lines = createInterface({ input: createReadStream(f.path, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    if (!line.includes('"usage"')) continue
    let r
    try {
      r = JSON.parse(line)
    } catch {
      continue
    }
    const m = r.message
    if (r.type !== 'assistant' || !m?.usage || !m.id || seen.has(m.id)) continue
    seen.add(m.id)
    const at = Date.parse(String(r.timestamp ?? '')) || 0
    if (at < since) continue
    const u = m.usage
    const input = num(u.input_tokens)
    const output = num(u.output_tokens)
    const read = num(u.cache_read_input_tokens)
    const write = num(u.cache_creation_input_tokens)
    if (input + output + read + write === 0) continue
    const cc = u.cache_creation ?? {}
    let w5 = num(cc.ephemeral_5m_input_tokens)
    let w1 = num(cc.ephemeral_1h_input_tokens)
    const rest = Math.max(0, write - w5 - w1)
    if (f.isAgent) w5 += rest
    else w1 += rest
    const day = dayOf(at)
    const model = typeof m.model === 'string' ? m.model : '?'
    const tier = input + read + write > LONG_OVER ? 'L' : 'S'
    const t = slot(slot(slot(days, day, {}), model, {}), tier, [0, 0, 0, 0, 0])
    t[0] += input
    t[1] += output
    t[2] += read
    t[3] += w5
    t[4] += w1
  }
  return days
}

/** obj[key] 가 없으면 empty 를 넣고 돌려준다 — `??=` 는 Node 15 부터라 안 쓴다(README: Node.js 14.8 이상) */
function slot(obj, key, empty) {
  if (obj[key] === undefined) obj[key] = empty
  return obj[key]
}

let cache = { v: 1, files: {} }
try {
  const old = JSON.parse(readFileSync(cacheFile, 'utf8'))
  if (old && old.v === 1 && old.files) cache = old
} catch {
  // 처음
}
const files = []
walk(root, 0, files)
const next = { v: 1, files: {} }
let scanned = 0
for (const f of files) {
  const hit = cache.files[f.path]
  if (hit && hit.size === f.size && hit.mtimeMs === f.mtimeMs) {
    next.files[f.path] = hit
    continue
  }
  try {
    next.files[f.path] = { size: f.size, mtimeMs: f.mtimeMs, days: await scanFile(f) }
    scanned++
  } catch {
    // 못 읽은 파일은 다음에 다시
  }
}
try {
  mkdirSync(dirname(cacheFile), { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(next))
} catch {
  // 캐시를 못 써도 결과는 낸다
}
// 합치기(시작 날짜부터)
const out = {}
const firstDay = dayOf(since)
for (const entry of Object.values(next.files)) {
  for (const [day, byModel] of Object.entries(entry.days ?? {})) {
    if (day < firstDay) continue
    for (const [model, tiers] of Object.entries(byModel)) {
      for (const [tier, t] of Object.entries(tiers)) {
        const sum = slot(slot(slot(out, day, {}), model, {}), tier, [0, 0, 0, 0, 0])
        for (let i = 0; i < 5; i++) sum[i] += t[i] ?? 0
      }
    }
  }
}
process.stdout.write(JSON.stringify({ days: out, files: files.length, scanned }))
