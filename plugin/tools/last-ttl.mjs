// 세션 기록(트랜스크립트 .jsonl) 끝부분에서 마지막 메인 요청이 쓴 캐시 종류를 찾는다 — 캐시 유지 시간(분).
// mod 의 $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 큰 기록은 이 스크립트를 $.process.run 으로 돌려 끝 2 MiB 만 읽는다.
//
// 출력: "60" · "5" · "-"(못 찾음). 규칙은 hooks/flow.ts 의 lastMainTtl 과 같다: 어시스턴트 줄만(isSidechain 제외 — 도구
// 결과 안에 든 에이전트 usage 는 사용자 줄이라 안 걸린다), usage.cache_creation 의 ephemeral_1h 가 있으면 60, 5m 만 있으면 5,
// 쓰기가 없는 요청은 그 앞 요청으로.

import { openSync, readSync, fstatSync, closeSync } from 'node:fs'

const path = process.argv[2]
if (!path) {
  console.error('쓰는 법: node last-ttl.mjs <트랜스크립트.jsonl>')
  process.exit(2)
}

const TAIL = 2 * 1024 * 1024
const fd = openSync(path, 'r')
const size = fstatSync(fd).size
const start = Math.max(0, size - TAIL)
const buf = Buffer.alloc(size - start)
readSync(fd, buf, 0, buf.length, start)
closeSync(fd)

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const lines = buf.toString('utf8').split('\n')
// 끝 2 MiB 의 첫 줄은 중간에서 잘렸을 수 있다 — 못 읽으면 건너뛴다
let found = '-'
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i]
  if (!line.includes('"cache_creation"') || !line.includes('"assistant"')) continue
  let r
  try {
    r = JSON.parse(line)
  } catch {
    continue
  }
  if (r.isSidechain === true || r.type !== 'assistant') continue
  const cc = r.message?.usage?.cache_creation
  if (!cc) continue
  if (num(cc.ephemeral_1h_input_tokens) > 0) {
    found = '60'
    break
  }
  if (num(cc.ephemeral_5m_input_tokens) > 0) {
    found = '5'
    break
  }
}
process.stdout.write(found)
