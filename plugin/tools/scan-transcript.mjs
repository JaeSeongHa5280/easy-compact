// 세션 기록(트랜스크립트 .jsonl)에서 컨텍스트 흐름에 쓸 숫자만 뽑는다 — mod 는 큰 기록을 직접 못 읽어 이 도구를 돌려 작은 출력만 받는다.
//
// 쓰는 법: node scan-transcript.mjs <트랜스크립트.jsonl> [세션 id] [--costs] · node scan-transcript.mjs <트랜스크립트.jsonl> --ultra <시작 바이트>
// 출력(공백 구분, 한 줄에 하나 — 규칙은 hooks/flow.ts 의 recordsFromTranscript 와 같다):
//   p <시각ms> <input> <output> <cache_read> <cache_creation> <model> <5분 쓰기> <1시간 쓰기> <엔진 버전>
//                       (5분 · 1시간 = usage.cache_creation 의 ephemeral_5m · 1h — 그 요청의 캐시 유지 시간,
//                        엔진 버전 = 기록 줄의 version, 모르면 "-")
//   c <시각ms> <trigger> <preTokens> <postTokens>   (postTokens 모르면 0)
//   q <시각ms> <질문 글 앞부분>       (질문 시작 — promptId 가 처음 나온 사용자 줄, 글은 hooks/flow.ts promptTextOf 와 같은 규칙)
//   i                                 (물려받은 시작 — 첫 자기 줄 앞에 다른 세션 줄이 있음(포크): 첫 점이 부모 대화 크기를 담는다. 한 번만)
// <세션 id> 를 주면 그 세션 줄만.
//
// --costs: 세션 금액 단서만(hooks/flow.ts costScanOf 와 같은 규칙) —
//   f <포크 0|1> <부모 몫>   (첫 자기 메시지 줄 앞에 다른 세션 메시지 줄이 있으면 포크, 부모 몫 = 앞부분 마지막 메시지 세션의 앞부분 속 마지막
//                            cost-state 값 — 갈라 올 때 엔진이 되살린 장부)
//   s <값>                 (세션마다 마지막 cost-state 값 — 엔진이 세션을 열 때 되살렸을 수 있는 값)
//
// --ultra <시작 바이트>: Ultracode 켬 · 끔 단서만(hooks/flow.ts ULTRA_ON · ULTRA_OFF 와 같은 글) — 그 바이트부터 끝까지에서 마지막 것
//   on | off | none   (none = 그 구간에 엔진 켬 · 끔 알림 줄이 없음 — mod 는 앞 구간 값을 그대로 쓴다)

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const ULTRA_ON = '"attachment":{"type":"ultra_effort_enter"'
const ULTRA_OFF = '"attachment":{"type":"ultra_effort_exit"'

const args = process.argv.slice(2)
const ultraAt = args.indexOf('--ultra')
if (ultraAt >= 0) {
  const from = Number(args[ultraAt + 1])
  if (ultraAt !== 1 || !args[0] || !Number.isInteger(from) || from < 0) {
    console.error('쓰는 법: node scan-transcript.mjs <트랜스크립트.jsonl> --ultra <시작 바이트>')
    process.exit(2)
  }
  let state = 'none'
  for await (const line of createInterface({ input: createReadStream(args[0], { encoding: 'utf8', start: from }), crlfDelay: Infinity })) {
    if (line.includes(ULTRA_ON)) state = 'on'
    else if (line.includes(ULTRA_OFF)) state = 'off'
  }
  console.log(state)
  process.exit(0)
}
const isCosts = args.includes('--costs')
const [path, own] = args.filter(a => a !== '--costs')
if (!path || (isCosts && !own)) {
  console.error('쓰는 법: node scan-transcript.mjs <트랜스크립트.jsonl> [세션 id] [--costs]')
  process.exit(2)
}

if (isCosts) {
  let isOwnSeen = false
  let leaf = null
  const states = new Map()
  const before = new Map()
  for await (const line of createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })) {
    if (line.startsWith('{"type":"cost-state"')) {
      let r
      try {
        r = JSON.parse(line)
      } catch {
        continue
      }
      if (typeof r.sessionId !== 'string' || typeof r.totalCostUSD !== 'number' || !Number.isFinite(r.totalCostUSD)) continue
      states.set(r.sessionId, r.totalCostUSD)
      if (!isOwnSeen) before.set(r.sessionId, r.totalCostUSD)
      continue
    }
    if (isOwnSeen || !line.includes('"uuid":"')) continue
    const id = /"sessionId":"([^"]+)"/.exec(line)?.[1]
    if (id === undefined) continue
    if (id === own) isOwnSeen = true
    else leaf = id
  }
  const inherited = leaf === null ? 0 : (before.get(leaf) ?? 0)
  process.stdout.write([`f ${leaf === null ? 0 : 1} ${inherited}`, ...[...states.values()].map(v => `s ${v}`)].join('\n'))
  process.exit(0)
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const seen = new Map()
const seenBoundary = new Set()
const seenPrompt = new Set()
const PROMPT_ID = /"promptId":"([^"]+)"/
const out = []
const promptText = c => {
  const b = Array.isArray(c) ? c.find(x => x && x.type === 'text' && typeof x.text === 'string') : null
  return (typeof c === 'string' ? c : b ? b.text : '').replace(/\s+/g, ' ').trim().slice(0, 200)
}
let carry
let isOwnAsked = false
let isOwnSeen = false
let isInherited = false
const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
for await (const line of lines) {
  const isBoundary = line.includes('"compact_boundary"')
  const promptId = PROMPT_ID.exec(line)?.[1]
  const isNewPrompt = promptId !== undefined && !seenPrompt.has(promptId)
  if (!isBoundary && !isNewPrompt && !line.includes('"usage"')) continue
  let r
  try {
    r = JSON.parse(line)
  } catch {
    continue
  }
  if (r.isSidechain === true) continue
  if (own && typeof r.sessionId === 'string' && r.sessionId !== own) {
    if (!isOwnSeen && !isInherited) {
      isInherited = true
      out.push('i')
    }
    if (isNewPrompt && r.type === 'user') {
      seenPrompt.add(promptId)
      carry = promptText(r.message?.content)
    }
    continue
  }
  isOwnSeen = true
  const at = Date.parse(String(r.timestamp ?? '')) || 0
  if (isNewPrompt && r.type === 'user') {
    seenPrompt.add(promptId)
    isOwnAsked = true
    const text = promptText(r.message?.content)
    out.push(text ? `q ${at} ${text}` : `q ${at}`)
    continue
  }
  if (r.type === 'system' && r.subtype === 'compact_boundary') {
    const meta = r.compactMetadata ?? {}
    const key = `${at}:${num(meta.preTokens)}`
    if (seenBoundary.has(key)) continue
    seenBoundary.add(key)
    out.push(`c ${at} ${typeof meta.trigger === 'string' ? meta.trigger : 'manual'} ${num(meta.preTokens)} ${num(meta.postTokens)}`)
    continue
  }
  const m = r.message
  if (r.type !== 'assistant' || !m?.usage || !m.id) continue
  const prev = seen.get(m.id)
  if (prev) {
    const o = num(m.usage.output_tokens)
    if (o > prev.parts[3]) {
      prev.parts[3] = o
      out[prev.at] = prev.parts.join(' ')
    }
    continue
  }
  if (carry !== undefined && !isOwnAsked) {
    isOwnAsked = true
    out.push(carry ? `q ${at} ${carry}` : `q ${at}`)
  }
  const u = m.usage
  const cc = u.cache_creation ?? {}
  const engine = typeof r.version === 'string' && /^\d+\.\d+\.\d+/.test(r.version) ? r.version : '-'
  const parts = ['p', at, num(u.input_tokens), num(u.output_tokens), num(u.cache_read_input_tokens), num(u.cache_creation_input_tokens), m.model ?? '?', num(cc.ephemeral_5m_input_tokens), num(cc.ephemeral_1h_input_tokens), engine]
  seen.set(m.id, { at: out.length, parts })
  out.push(parts.join(' '))
}
process.stdout.write(out.join('\n'))
