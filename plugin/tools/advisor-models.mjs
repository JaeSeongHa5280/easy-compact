// 세션 기록(트랜스크립트 .jsonl)에서 advisor 호출마다 어느 모델이 답했는지 찾는다 — 패널 advisor 줄 끝의 「· Opus 5.5」.
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 큰 기록은 이 스크립트를 $.process.run 으로 돌린다.
//
// 두 갈래:
// - node advisor-models.mjs <기록> <호출 id> … — 끝 8 MiB 만 읽고(호출은 방금 끝난 질문 · 에이전트 것이라 끝에 있다)
//   JSON {"<호출 id>":"<모델 id>", …} 을 낸다. 못 찾은 id 는 빠진다.
// - node advisor-models.mjs --all <기록> — 기록 전체를 줄 단위로 읽어(advisor 낱말이 든 줄만 푼다) 모든 호출을
//   JSON [{"id","atMs","model","isDone"}, …] 으로 낸다 — 옛 질문에 이름을 채울 때 질문 시각 범위로 가른다.
//
// 규칙은 hooks/flow.ts 의 advisorCallsIn 과 같다: 어시스턴트 메시지(message.id)마다 줄을 모아, 결과 블록(advisor_tool_result)까지 온
// advisor 호출(server_tool_use)을 차례로 그 메시지 usage.iterations 의 advisor_message 모델과 짝짓는다 — 모델이 하나뿐이면 모두 그 모델,
// 수가 안 맞으면 모름(null). 같은 호출 id 가 다시 적힌 줄은 한 번만 센다. 시각은 호출 블록이 처음 보인 줄의 timestamp.

import { closeSync, createReadStream, fstatSync, openSync, readSync } from 'node:fs'
import { createInterface } from 'node:readline'

const args = process.argv.slice(2)
const isAll = args[0] === '--all'
const [path, ...ids] = isAll ? args.slice(1) : args
if (!path || (!isAll && ids.length === 0)) {
  console.error('쓰는 법: node advisor-models.mjs <트랜스크립트.jsonl> <호출 id> [<호출 id> …]  |  node advisor-models.mjs --all <트랜스크립트.jsonl>')
  process.exit(2)
}

const msgs = new Map()
const add = line => {
  if (!line.includes('advisor')) return
  let r
  try {
    r = JSON.parse(line)
  } catch {
    return
  }
  const m = r?.message
  if (r?.type !== 'assistant' || !m || typeof m.id !== 'string') return
  let g = msgs.get(m.id)
  if (!g) {
    g = { uses: [], at: new Map(), done: new Set(), models: null }
    msgs.set(m.id, g)
  }
  const atMs = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN
  for (const x of Array.isArray(m.content) ? m.content : []) {
    if (x?.type === 'server_tool_use' && x.name === 'advisor' && typeof x.id === 'string' && !g.uses.includes(x.id)) {
      g.uses.push(x.id)
      if (Number.isFinite(atMs)) g.at.set(x.id, atMs)
    }
    if (x?.type === 'advisor_tool_result' && typeof x.tool_use_id === 'string') g.done.add(x.tool_use_id)
  }
  if (g.models === null && Array.isArray(m.usage?.iterations)) {
    g.models = m.usage.iterations.filter(it => it?.type === 'advisor_message').map(it => (typeof it.model === 'string' ? it.model : '?'))
  }
}
const calls = () => {
  const out = []
  for (const g of msgs.values()) {
    const finished = g.done.size > 0 ? g.uses.filter(id => g.done.has(id)) : g.uses
    const list = (g.models ?? []).filter(x => x !== '?')
    const one = list.length > 0 && list.every(x => x === list[0]) ? list[0] : null
    for (const id of g.uses) {
      const k = finished.indexOf(id)
      const model = k < 0 ? null : (one ?? (finished.length === list.length ? list[k] : null))
      out.push({ id, atMs: g.at.get(id) ?? null, model, isDone: g.done.has(id) })
    }
  }
  return out
}

if (isAll) {
  const lines = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity })
  for await (const line of lines) add(line)
  process.stdout.write(JSON.stringify(calls()))
} else {
  const TAIL = 8 * 1024 * 1024
  const fd = openSync(path, 'r')
  const size = fstatSync(fd).size
  const start = Math.max(0, size - TAIL)
  const buf = Buffer.alloc(size - start)
  readSync(fd, buf, 0, buf.length, start)
  closeSync(fd)
  for (const line of buf.toString('utf8').split('\n')) add(line)
  const want = new Set(ids.filter(id => id !== ''))
  const out = {}
  for (const c of calls()) if (c.model && want.has(c.id)) out[c.id] = c.model
  process.stdout.write(JSON.stringify(out))
}
