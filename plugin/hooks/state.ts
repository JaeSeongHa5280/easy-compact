/**
 * register.tsx 가 쓰는 $ 없는 몫 — 저장 키 · 시간 값 · 처음 값 · 형 · 작은 순수 함수. 2026-10-18 register.tsx 정리에서 옮기기만 했다(글 그대로 — 주석은 그 자리의 기록). $ 를 쓰는 함수는 register.tsx 에 둔다(엔진은 $ 를 import 너머로
 * 따라가지 않는다). 화면 상태(atom)도 register.tsx 에 둔다 — 엔진 검사가 read · update 하는 파일 안의 정의만 읽는다
 */
import { SESSION_TEXT, sessionColorOf } from './cost'
import type { PaneView, Settings, UpdateState, Usage } from '../types'

/**
 * 업데이트 뒤 첫 실행 표시(3안)의 기준: 마지막으로 본 판($.store, 모든 세션 같이). 처음 설치면 설정을 처음 적을 때(seedSettings) 지금
 * 판을 같이 적는다 — 그래서 값이 없으면 0.5.0 전부터 쓰던 사람(그땐 안 적었다)이라 업데이트로 본다
 */
export const SEEN_VERSION_KEY = 'seenVersion'

/** 마켓 받기 · 플러그인 업데이트에 줄 시간(후보 모두 합쳐) — 넘기면 "응답이 없어 멈췄습니다" */
export const CHECK_TOTAL_MS = 90_000

export const APPLY_TOTAL_MS = 150_000

/** 끝을 못 알린 일을 버리는 때: 줄 시간 + 이만큼(엔진이 명령을 안 끊었거나 결과를 못 받음) */
export const UPDATE_GRACE_MS = 30_000

// N6: node 가 없거나 기록을 못 읽어 재기가 실패하면 10분 동안 다시 안 잰다(사람이 옵션을 켤 때만 바로) — 예전엔 실패 뒤에도
// 간격이 성공 시각으로만 재져 1분마다 node 를 띄우고 로그를 남겼다. 로그는 까닭이 바뀔 때 한 번
export const SPEND_RETRY_MS = 10 * 60_000

export const PANE = 'easy-compact'

// 이 PC 에서 잰 마지막 컴팩트 값($.store, 세션끼리 같이 쓴다). 이 세션에서 아직 컴팩트하지 않았을 때 쓰고, 그것도 없으면 가정
/** 컴팩트 뒤 첫 요청의 컨텍스트 — 기록 앞부분을 못 읽어 기본 적재를 모를 때만 */
export const AFTER_KEY = 'afterCompactTokens'

/** 컴팩트 요청의 입력 몫(CompactMix) — 캐시가 살아 있던 컴팩트만. 없으면 전부 캐시 읽기로 본다(WARM_COMPACT) */
export const MIX_KEY = 'compactMix'

/** 컴팩트 뒤 첫 요청이 새로 쓴 몫(흐름의 c.summary — 요약 쓰기 값) */
export const SUMMARY_KEY = 'compactSummaryTokens'

/** 남긴 대화 — 엔진이 컴팩트 결과로 준 크기(흐름의 c.kept, 요약 + 다시 붙는 파일). 직후 크기 어림 = 기본 적재 + 이것 */
export const KEPT_KEY = 'compactKeptTokens'

/** 컴팩트 요청의 출력 토큰(요약을 쓴 양) */
export const OUTPUT_KEY = 'compactOutputTokens'

export const SAVE_KEEP = 5

// 처음 펼친 칸: 화면만(0.4.0 설정 정리 — 설계 확인, 2026-10-12). 나머지는 제목 줄에 지금 값
/**
 * 설정 탭 칸 펼침의 처음 값 — 화면과 그 안 세부까지 펼침. 세부엔 모든 화면 공통(한도 줄 · 세션 금액 색)이 있어 접혀 있으면
 * 못 찾는다. 패널을 닫으면 이것으로 돌아간다
 */
// S3(0.6.1 피드백 "다 펼쳐져 길다 — 큰 제목 기준 접기"): 칸마다 접는 카드(sec-<칸>), 처음엔 화면만 펼침 — 미리보기 · 그 화면이 정하는 칸이 거기
export const SETTINGS_OPEN_DEFAULT: Record<string, boolean> = { 'sec-screen': true }

/** 0.9.1 U6: 진단 내용 카드(이 세션) — 처음엔 닫힘 · 질문 · 동작 글 빼기 켬 */
export const DIAG_CLOSED = { open: false, where: 'drawer' as 'drawer' | 'gen', redact: true, copiedLines: null as number | null, savedPath: null as string | null }

/**
 * 사용량 패널을 열 때 카드 펼침: 이 세션 카드는 펼침, 질문별 비용은 접힘(질문이 쌓이면 길다 — 진행 중 값은 접힌 제목 줄에 보인다).
 * 접어 둔 채 닫으면 다음에 작게 열려 고장처럼 보였다(영태, 2026-10-13 — 사용자 답 "열 때 늘 이 꼴", fb A6). 닫을 때 이 값으로 되돌린다
 */
export const CARDS_OPEN_DEFAULT = { now: true, history: false, compact: true }

export const UPDATE_IDLE: UpdateState = { phase: 'idle', own: null, market: null, marketAt: null }

/** 현황 [간단|자세히] 로 고른 보기(모든 세션 · 다시 켜도) — 0.6.0 */
export const PANE_MODE_KEY = 'paneModeChoice'

/** $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 그보다 큰 기록은 tools/scan-transcript.mjs(node)로 뽑는다 */
export const READ_LIMIT = 4 * 1024 * 1024 - 64 * 1024

/** $.store 키: 같이 여닫기에서 마지막으로 사람이 열거나 닫은 일(PaneEvent) */
export const PANE_EVENT_KEY = 'paneEvent'

/** $.store 키: 자동 열기를 한 번 한 세션 id 목록(최근 PANE_AUTO_KEEP 개) — mod 를 다시 불러와도 또 열지 않게 */
export const PANE_AUTO_KEY = 'paneAutoOpened'

export const PANE_AUTO_KEEP = 200

export type PaneEvent = { view: PaneView | null; at: number; from: string }

/** 사람이 열고 닫는 길(띠 버튼 · 명령 · 패널 닫기): 이 세션 값을 바꾸고, 같이 여닫기면 다른 세션에 알린다 */
/** N4: 패널 여닫기 기록(최근 50 — 메모리만, 덤프에 실린다). 시각은 UTC 시:분:초.밀리초 */
export const paneLog: string[] = []

/**
 * 0.3.x 까지의 처음 설치 구간. 0.4.0 에서 처음 설치 값을 20만 ~ 25만으로 내렸다(설정 기본값) — 설정은 사람이 무엇이든 한 번
 * 바꿀 때 통째로 저장돼, 한 번도 안 바꾼 사람은 저장값이 없어 업데이트하자마자 말없이 20만 ~ 25만으로 바뀔 뻔했다. 업데이트하는
 * 사람은 쓰던 구간 그대로 — 새 구간은 설정 탭 ★ 추천으로 알린다. 화면도 같은 까닭으로 업데이트면 보던
 * 그대로(자세히 — 칸 다 · 패널 자세히)
 */
export const OLD_DEFAULT_RANGE = { rangeStart: 250_000, rangeEnd: 300_000 }

/**
 * B5 안내: 패널 문이 ◔ 에서 게이지로 옮겨 간 것을 데스크톱에서 한 번만 알린다 — 모든 세션
 * 공통 표시(저장소). 토스트는 그 세션 대화 화면 오른쪽 위에 몇 초만 떠, 세션이 켜질 때(업데이트가 뒤에 숨은 세션들에도 한꺼번에
 * 올라간다)가 아니라 사람이 그 세션에서 질문을 보낼 때 띄운다. ◔ 를 쓰던 사람인지는 세션 시작 때 다른 저장값을 쓰기 전에 가린다
 * (새 설치도 곧 패널 기록이 생긴다). 터미널은 [패널 ▸] 그대로라 알리지 않는다
 */
export const GAUGE_NOTE_KEY = 'gaugeDoorNoted'

export const GAUGE_NOTE_MS = 12_000

/** 질문 하나를 끝내는 데 쓰는 최근 질문 수 · 그만큼 모여야 질문 꼴을 낸다(9b) */
export const PER_Q_WINDOW = 10

export const PER_Q_MIN = 3

/** 오늘 · 이번 달 금액 색(1.0 — 설정 기준을 넘으면, 깜빡임 없이) — 값이 없거나 기준 아래면 칸이 없다 */
export function spendColors(s: Settings, today: number | null, month: number | null): { todayColor?: string; monthColor?: string } {
  const todayColor = today !== null ? sessionColorOf(today, s.todayColors) : undefined
  const monthColor = month !== null ? sessionColorOf(month, s.monthColors) : undefined
  return { ...(todayColor ? { todayColor } : {}), ...(monthColor ? { monthColor } : {}) }
}

export const GAUGE_SHRINK_MS = 1800

/** 1.0 값 강조 단계(flash.ts noteRank — 클수록 급함): 컨텍스트 아직 · 컴팩트할 때 · 늦어짐, 세션 금액 색 없음 · 노랑 · 주황 · 빨강 */
export const CTX_RANK = { ok: 0, warn: 1, cut: 2 } as const

export const sessRankOf = (color: string | undefined): number => (color === undefined ? 0 : (SESSION_TEXT as readonly string[]).indexOf(color) + 1)

/**
 * 하위 에이전트: 작업 이름과 띄운 질문(메인 턴) — 처음 본 요청 때 정한다(agentLabel). tries = 엔진 목록에서 이름을 못 찾은 횟수(몇 번 더 묻는다).
 * mod 를 다시 불러오면 비지만, 그땐 지금 질문에 더한다
 */
export const agentInfo = new Map<string, { label: string; turnId: string | null; tries?: number }>()

/** 엔진 목록에서 한 번이라도 본 에이전트 — 목록에 없는 갈래(워크플로우 · 엔진 자체)를 "끝남" 으로 잘못 치지 않게 */
export const listedAgents = new Set<string>()

/**
 * 목록에 한 번도 없던 갈래(워크플로우 에이전트 · 엔진 자체 갈래 — 엔진 문서: 목록에 없다)는 turn.complete 가 안 오면 끝남을 알
 * 길이 없다 — 마지막 요청 뒤 이만큼 조용하면 끝남으로 친다. 안 그러면 "도는 중" 이 세션 끝까지 남고 목록을 1.5초마다 물었다(리뷰)
 */
export const AGENT_QUIET_MS = 2 * 60_000

/** 엔진 목록에서 에이전트 이름을 몇 번까지 다시 찾나(처음 본 요청부터) */
export const AGENT_LIST_TRIES = 3

/** 답이 끝나고 앞 질문 값을 고정하는 때(ms) — 다음 질문 제안 · 메모리 정리는 답 뒤 몇 초 안에 돈다 */
export const APP_FIX_MS = 30_000

/** 장부에 남기는 잰 컴팩트 수 상한(M2 — 세션 하나가 이만큼 컴팩트하는 일은 드물다) */
export const LEDGER_COMPACTS_MAX = 300

/** 컴팩트가 얼마나 급한가: 없음 · 노랑 · 빨강 · 식은 캐시(바로 컴팩트 권장) — 접힌 바를 저절로 펼지 */
export type Urgency = 'ok' | 'warn' | 'cut' | 'cold'

export const URGENCY_RANK: Record<string, number> = { ok: 0, warn: 1, cut: 2, cold: 3 }

/**
 * 세션끼리 나눠 쓰는 한도(데이터 폴더 limits.json — 사용자 2026-10-18 "어떤 데서는 왜 5시간이 안 나와?"): 한도는 계정 하나 값인데 엔진은 그
 * 세션의 마지막 응답이 알려 준 한도만 줘서, 오래 쉰 세션은 옛 값(7일 9% — 지금 17%)이거나 5시간이 빠졌다. at = 그 한도를 준 응답 시각
 */
export type SharedLimits = { at: number; rateLimits: Usage['rateLimits'] }

export const LIMITS_FILE = 'limits.json'

/** limits.json 값 → 나눠 쓰는 한도(깨졌거나 비었으면 null) */
export function parseSharedLimits(raw: unknown): SharedLimits | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as { at?: unknown; rateLimits?: unknown }
  if (typeof r.at !== 'number' || !Array.isArray(r.rateLimits)) return null
  const rateLimits = r.rateLimits.filter(
    (x): x is Usage['rateLimits'][number] => typeof x === 'object' && x !== null && typeof x.kind === 'string' && typeof x.percentUsed === 'number',
  )
  return rateLimits.length > 0 ? { at: r.at, rateLimits } : null
}

/**
 * 이 세션 한도와 나눠 쓰는 한도 중 더 최근 응답 것 — 리셋 시각이 지난 창은 뺀다(새 창 값을 모른다). isOwn = 이 세션 것이 더 최근이거나 같다(파일에
 * 쓸 것). 이 세션 응답 시각을 모르면(ownAt null) 나눠 쓰는 쪽을 믿는다
 */
export function freshestLimits(own: Usage['rateLimits'], ownAt: number | null, shared: SharedLimits | null, nowMs: number): { rateLimits: Usage['rateLimits']; isOwn: boolean } {
  const isOwn = own.length > 0 && (shared === null || (ownAt !== null && ownAt >= shared.at))
  const picked = isOwn || shared === null ? own : shared.rateLimits
  const live = picked.filter(r => !r.resetsAt || !(Date.parse(r.resetsAt) <= nowMs))
  return { rateLimits: live, isOwn }
}
