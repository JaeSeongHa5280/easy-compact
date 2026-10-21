// 세션 기록(트랜스크립트 .jsonl) 끝부분에서 sinceMs 뒤의 마지막 컴팩트 경계(compact_boundary)를 찾는다 — 엔진이 정말 컴팩트했나.
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 큰 기록은 이 스크립트를 $.process.run 으로 돌려 끝 2 MiB 만 읽는다
// (컴팩트 직후라 경계 줄은 끝 가까이에 있다 — 뒤에 요약 · 다시 붙인 파일 몇백 KB).
//
// 쓰는 법: node last-compact.mjs <트랜스크립트.jsonl> <세션 id | -> <sinceMs>
// 출력: {"atMs":…,"trigger":"…","pre":…,"post":…} 한 줄 · "-"(못 찾음). 규칙은 hooks/flow.ts 의 lastBoundaryAfter 와 같다:
// system 줄의 subtype compact_boundary 만(isSidechain 제외), 세션 id 를 주면 그 세션 줄만, 끝에서부터 보고 sinceMs 앞이면 없음.

import { openSync, readSync, fstatSync, closeSync } from 'node:fs'

const [path, ownArg, sinceArg] = process.argv.slice(2)
if (!path || !sinceArg) {
  console.error('쓰는 법: node last-compact.mjs <트랜스크립트.jsonl> <세션 id | -> <sinceMs>')
  process.exit(2)
}
const own = ownArg && ownArg !== '-' ? ownArg : null
const sinceMs = Number(sinceArg) || 0

const TAIL = 2 * 1024 * 1024
const fd = openSync(path, 'r')
const size = fstatSync(fd).size
const start = Math.max(0, size - TAIL)
const buf = Buffer.alloc(size - start)
readSync(fd, buf, 0, buf.length, start)
closeSync(fd)

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const lines = buf.toString('utf8').split('\n')
let found = '-'
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i]
  if (!line.includes('"compact_boundary"')) continue
  let r
  try {
    r = JSON.parse(line)
  } catch {
    continue
  }
  if (r.type !== 'system' || r.subtype !== 'compact_boundary' || r.isSidechain === true) continue
  if (own !== null && typeof r.sessionId === 'string' && r.sessionId !== own) continue
  const atMs = Date.parse(String(r.timestamp ?? '')) || 0
  if (atMs <= sinceMs) break
  const meta = r.compactMetadata ?? {}
  const post = num(meta.postTokens)
  found = JSON.stringify({ atMs, trigger: typeof meta.trigger === 'string' ? meta.trigger : 'manual', pre: num(meta.preTokens), ...(post > 0 ? { post } : {}) })
  break
}
process.stdout.write(found)
