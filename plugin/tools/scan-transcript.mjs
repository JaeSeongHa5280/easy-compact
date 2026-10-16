// 세션 기록(트랜스크립트 .jsonl)에서 컨텍스트 흐름에 쓸 숫자만 뽑는다.
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 긴 세션 기록(10 MB 넘음)은 이 스크립트를
// $.process.run 으로 돌려 작은 출력(줄마다 요청 하나 · 컴팩트 하나 · 질문 하나)만 받는다.
//
// 출력(공백 구분, 한 줄에 하나):
//   p <시각ms> <input> <output> <cache_read> <cache_creation> <model> <5분 쓰기> <1시간 쓰기> <엔진 판>
//                       (5분 · 1시간 = usage.cache_creation 의 ephemeral_5m · 1h — 그 요청의 캐시 유지 시간,
//                        엔진 판 = 기록 줄의 version, 모르면 "-" — 0.9.3: 요율이 판으로 갈린다)
//   c <시각ms> <trigger> <preTokens>
//   q <시각ms> <질문 글 앞부분>       (질문 시작 — promptId 가 처음 나온 사용자 줄, 글은 공백 하나로 200자까지 — N3)
// 규칙은 hooks/flow.ts 의 recordsFromTranscript 와 같다: 메인 대화만(isSidechain 제외),
// 같은 message.id 는 첫 줄로 내고 뒤 줄은 출력만 최댓값으로 고쳐 쓴다(N1 — 스트리밍 중 출력이 늘며 다시 적힌다),
// promptId 는 한 번만, 깨진 줄은 건너뛴다.

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const path = process.argv[2]
if (!path) {
  console.error('쓰는 법: node scan-transcript.mjs <트랜스크립트.jsonl>')
  process.exit(2)
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
// 응답 id → out 의 자리 · 그 줄의 칸들(뒤 줄에서 출력만 고쳐 다시 쓴다)
const seen = new Map()
// 컴팩트 경계 줄도 같은 것이 다시 적힌다(2026-10-11 확인) — 시각 · 직전 크기로 한 번만
const seenBoundary = new Set()
const seenPrompt = new Set()
const PROMPT_ID = /"promptId":"([^"]+)"/
const out = []
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
  const at = Date.parse(String(r.timestamp ?? '')) || 0
  if (isNewPrompt && r.type === 'user') {
    seenPrompt.add(promptId)
    // 질문 글 앞부분(N3) — hooks/flow.ts promptTextOf 와 같은 규칙
    const c = r.message?.content
    const b = Array.isArray(c) ? c.find(x => x && x.type === 'text' && typeof x.text === 'string') : null
    const text = (typeof c === 'string' ? c : b ? b.text : '').replace(/\s+/g, ' ').trim().slice(0, 200)
    out.push(text ? `q ${at} ${text}` : `q ${at}`)
    continue
  }
  if (r.type === 'system' && r.subtype === 'compact_boundary') {
    const meta = r.compactMetadata ?? {}
    const key = `${at}:${num(meta.preTokens)}`
    if (seenBoundary.has(key)) continue
    seenBoundary.add(key)
    out.push(`c ${at} ${typeof meta.trigger === 'string' ? meta.trigger : 'manual'} ${num(meta.preTokens)}`)
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
  const u = m.usage
  const cc = u.cache_creation ?? {}
  const engine = typeof r.version === 'string' && /^\d+\.\d+\.\d+/.test(r.version) ? r.version : '-'
  const parts = ['p', at, num(u.input_tokens), num(u.output_tokens), num(u.cache_read_input_tokens), num(u.cache_creation_input_tokens), m.model ?? '?', num(cc.ephemeral_5m_input_tokens), num(cc.ephemeral_1h_input_tokens), engine]
  seen.set(m.id, { at: out.length, parts })
  out.push(parts.join(' '))
}
process.stdout.write(out.join('\n'))
