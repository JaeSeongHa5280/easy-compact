// 오늘 · 이번 달 사용량 재료 — 모든 세션 기록(메인 <세션>.jsonl + 하위 에이전트 <세션>/subagents/*.jsonl)의 요청 토큰을
// 날짜(UTC — Claude 사용량 화면처럼, 한국은 오전 9시에 바뀜) · 모델 · 크기 묶음별로 합한다. 값(달러)은 mod 가 공식 요율표(hooks/cost.ts)로 센다 — 요율은 한 곳에만.
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부하고 기록은 수백 개라 $.process.run 으로 이 스크립트를 돌린다(scan-transcript.mjs 와 같은 길).
//
// 쓰는 법: node scan-spend.mjs <projects 폴더> <캐시 파일> <시작 시각 ms> [<mod 데이터 폴더>]
// 출력(JSON 한 줄): { days: { "YYYY-MM-DD": { "<model>": { S: [input, output, cacheRead, write5m, write1h], L: [...] } } }, extra: { "YYYY-MM-DD": 달러 },
//   retro: { "YYYY-MM-DD": { "<model>": [개수, 컴팩트 전 크기 합] } }, calib: [[컴팩트 전 크기, 모델, 달러], …], files, scanned }
//   extra = 대화 기록에 없는 요청(컴팩트 요청 · 앱 자체 요청) — mod 데이터 폴더를 주면 그 안 extra/ · turns/ 만 읽는다(아래 끝)
//   retro = 기록의 컴팩트 경계(compact_boundary) 중 mod 가 잰 값이 없는 것(장부 전 · 질문 기록 60개 밖) — 값은 mod 가 잰 컴팩트(calib)로 어림(M2)
//   S = 프롬프트(입력 + 캐시 읽기 + 쓰기) 10만 이하 요청, L = 넘는 요청 — 긴 프롬프트 요율(지금은 Haiku 5.5 10만 초과 5배)을 가른다
// 캐시: 파일마다 크기 · 수정 시각이 같으면 다시 안 읽는다 — 처음 켤 때만 이번 달 기록을 다 읽는다(기록이 크면 수십 초).
// 규칙: assistant 줄의 message.usage, 같은 message.id 는 파일마다 첫 줄로 세고(날짜 · 모델 · 크기 묶음), 뒤 줄은 출력만 최댓값으로 —
//   스트리밍 중 같은 응답이 출력이 늘며 여러 번 적힌다. 첫 줄만 세면 출력이 모자랐다(N1: 이 PC 이번 달 출력 약 243만 토큰 ≈ $49 빠짐).
//   날짜는 첫 줄 timestamp(UTC).
//   쓰기는 usage.cache_creation 의 ephemeral_5m · 1h 로 가르고, 그 칸이 없으면 메인은 1시간 · 하위 에이전트는 5분(엔진 기본).
//   앱 자체 요청(다음 질문 제안 · 컴팩트 요청 등)은 기록에 없다 — mod 가 잰 값을 extra 로 따로 낸다(0.7.0 피드백 M1). 다른 기기 · 웹은 못 센다("~")

import { createReadStream, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'

const [root, cacheFile, sinceArg, dataArg] = process.argv.slice(2)
if (!root || !cacheFile) {
  console.error('쓰는 법: node scan-spend.mjs <projects 폴더> <캐시 파일> <시작 시각 ms>')
  process.exit(2)
}
const since = Number(sinceArg) || 0
const LONG_OVER = 100_000
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const two = n => String(n).padStart(2, '0')
// 날짜는 UTC 로 나눈다(사용자 2026-10-15: Claude 사용량 화면과 같게 — 설정 옵션 없이 고정)
const dayOf = ms => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`
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
  // 컴팩트 경계 [시각 ms, 컴팩트 전 크기, 그 앞 마지막 응답 모델] — 같은 경계가 한 기록에 2~3번 다시 적혀(되감기 · 이어 받기) 시각 · 크기로 한 번만
  const compacts = []
  const seenCompact = new Set()
  let lastModel = '?'
  // 응답 id → { 그 응답이 더해진 칸, 센 출력 } — 뒤 줄은 출력만 늘어난 만큼 더한다
  const seen = new Map()
  const lines = createInterface({ input: createReadStream(f.path, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) {
    const isCompact = line.includes('"compact_boundary"')
    if (!isCompact && !line.includes('"usage"')) continue
    let r
    try {
      r = JSON.parse(line)
    } catch {
      continue
    }
    if (isCompact && r.type === 'system' && r.subtype === 'compact_boundary') {
      const at = Date.parse(String(r.timestamp ?? '')) || 0
      const pre = num(r.compactMetadata?.preTokens)
      const key = `${at}|${pre}`
      if (at >= since && pre > 0 && !seenCompact.has(key)) {
        seenCompact.add(key)
        compacts.push([at, pre, lastModel])
      }
      continue
    }
    const m = r.message
    if (r.type !== 'assistant' || !m?.usage || !m.id) continue
    if (typeof m.model === 'string' && m.model !== '<synthetic>') lastModel = m.model
    const prev = seen.get(m.id)
    if (prev) {
      const more = num(m.usage.output_tokens) - prev.output
      if (more > 0) {
        prev.t[1] += more
        prev.output += more
      }
      continue
    }
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
    seen.set(m.id, { t, output })
  }
  return { days, compacts }
}

/** obj[key] 가 없으면 empty 를 넣고 돌려준다 — `??=` 는 Node 15 부터라 안 쓴다(README: Node.js 14.8 이상) */
function slot(obj, key, empty) {
  if (obj[key] === undefined) obj[key] = empty
  return obj[key]
}

// v2(N1): 출력 셈 · UTC 날짜가 바뀌어 v1 캐시는 버린다. v3(M2): 파일마다 컴팩트 경계도 담아 v2 는 버린다(처음 한 번 다시 읽음)
let cache = { v: 3, files: {} }
try {
  const old = JSON.parse(readFileSync(cacheFile, 'utf8'))
  if (old && old.v === 3 && old.files) cache = old
} catch {
  // 처음
}
const files = []
walk(root, 0, files)
const next = { v: 3, files: {} }
let scanned = 0
for (const f of files) {
  const hit = cache.files[f.path]
  if (hit && hit.size === f.size && hit.mtimeMs === f.mtimeMs) {
    next.files[f.path] = hit
    continue
  }
  try {
    const got = await scanFile(f)
    next.files[f.path] = { size: f.size, mtimeMs: f.mtimeMs, days: got.days, compacts: got.compacts }
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
// M1(0.7.0 피드백 "이번 달 금액이 Claude 화면보다 작음"): 대화 기록에 없는 요청(컴팩트 요약 요청 · 앱 자체 요청 — 엔진 세션 집계엔 있다)의
// 값은 mod 가 잰다. 세션마다 장부 <데이터>/extra/<세션>.json { v: 1, days: { 날짜: 달러 } }(0.8.0 부터)가 있으면 그것, 없으면 그 세션 질문 기록
// <데이터>/turns/<세션>.json 의 동작 줄(compact · app)을 질문이 끝난 날짜로 — 장부 전 판 세션 · 끝난 세션도 채운다(장부는 처음 만들 때 질문
// 기록에서 시작한다). 기록에서 다시 만든 질문(rebuilt)엔 이 줄이 없다. 달러 그대로(잰 때 요율)
const extra = {}
// 세션 파일 이름(<세션>.json) → 잰 컴팩트 [컴팩트 전 크기, 달러] — 장부 compacts(M2 부터) · 질문 기록 compact.before(아래 M2 가 맞춘다)
const measured = new Map()
const addMeasured = (n, before, usd) => {
  let list = measured.get(n)
  if (!list) measured.set(n, (list = []))
  if (!list.some(([b]) => b === before)) list.push([before, usd])
}
if (dataArg) {
  const addDay = (day, usd) => {
    if (day >= firstDay && usd > 0) extra[day] = (extra[day] ?? 0) + usd
  }
  const jsonIn = sub => {
    try {
      return readdirSync(join(dataArg, sub)).filter(n => n.endsWith('.json'))
    } catch {
      return []
    }
  }
  const booked = new Set()
  for (const n of jsonIn('extra')) {
    try {
      const j = JSON.parse(readFileSync(join(dataArg, 'extra', n), 'utf8'))
      if (j?.v !== 1 || !j.days) continue
      booked.add(n)
      for (const [day, usd] of Object.entries(j.days)) addDay(day, num(usd))
      for (const c of Array.isArray(j.compacts) ? j.compacts : []) if (Array.isArray(c) && num(c[0]) > 0) addMeasured(n, num(c[0]), num(c[1]))
    } catch {
      // 깨진 장부는 건너뛴다
    }
  }
  for (const n of jsonIn('turns')) {
    try {
      const j = JSON.parse(readFileSync(join(dataArg, 'turns', n), 'utf8'))
      for (const t of j?.turns ?? []) {
        if (t?.rebuilt || typeof t?.atMs !== 'number') continue
        for (const d of t.details ?? []) {
          // 잰 컴팩트는 장부가 있는 세션도 맞추기 재료로(장부 전 판이 남긴 줄)
          if (d?.compact && num(d.compact.before) > 0) addMeasured(n, num(d.compact.before), num(d.usd))
          if (!booked.has(n) && (d?.app || d?.compact)) addDay(dayOf(t.atMs), num(d.usd))
        }
      }
    } catch {
      // 깨진 기록은 건너뛴다
    }
  }
}

// M2(0.8.0 뒤 피드백 "이번 달 금액이 설정 화면보다 $4.75 낮음"): 장부 전 · 질문 기록 60개 밖의 컴팩트는 잰 값이 없어 extra 에 없다 — 기록의
// 컴팩트 경계(compact_boundary · preTokens)는 남으니 그 크기로 어림한다. 같은 경계가 한 기록에 2~3번, 이어 받은 기록에도 다시 적혀 시각 ·
// 크기로 한 번만. 세션의 잰 컴팩트(장부 compacts · 질문 기록 compact.before)와 크기로 1:1 맞춰, 맞으면 calib(요약 출력 몫을 거꾸로 구하는 재료),
// 안 맞으면 retro(날짜 · 모델별 [개수, 크기 합]). 값은 mod 가 요율표로 센다
const retro = {}
const calib = []
{
  const SID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  // projects/<프로젝트>/<세션>.jsonl · projects/<프로젝트>/<세션>/subagents/… → 세션
  const sidOf = path => {
    const parts = path.slice(root.length).split(/[\\/]/).filter(Boolean)
    return SID.exec(parts[1] ?? '')?.[0] ?? null
  }
  const bounds = new Map()
  for (const [path, entry] of Object.entries(next.files)) {
    const sid = sidOf(path)
    for (const [at, pre, model] of entry.compacts ?? []) {
      if (dayOf(at) < firstDay) continue
      const key = `${at}|${pre}`
      const b = bounds.get(key)
      if (!b) bounds.set(key, { at, pre, model, sids: new Set(sid ? [sid] : []) })
      else {
        if (sid) b.sids.add(sid)
        if (b.model === '?') b.model = model
      }
    }
  }
  for (const b of [...bounds.values()].sort((x, y) => x.at - y.at)) {
    let hit = null
    for (const sid of b.sids) {
      const list = measured.get(`${sid}.json`) ?? []
      const i = list.findIndex(([before]) => Math.abs(before - b.pre) <= Math.max(1000, b.pre * 0.001))
      if (i >= 0) {
        hit = list.splice(i, 1)[0]
        break
      }
    }
    if (hit) calib.push([b.pre, b.model, hit[1]])
    else {
      const sum = slot(slot(retro, dayOf(b.at), {}), b.model, [0, 0])
      sum[0] += 1
      sum[1] += b.pre
    }
  }
}
process.stdout.write(JSON.stringify({ days: out, extra, retro, calib, files: files.length, scanned }))
