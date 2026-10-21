/** 사이드 패널이 보여 주는 화면. 세션을 옮겨도 $.store 로 같은 화면을 연다(설정은 패널 안 탭). 세션 트리는 따로 mod(session-tree-viewer) */
export type PaneView = 'usage'
export type UsageTab = 'main' | 'settings'

/**
 * 지금 걸린 기준(hooks/optimal.ts 의 thresholdsFor). 컨텍스트 노랑(= 컴팩트 버튼 강조) · 빨강(= 컴팩트 권장 + 깜빡임)
 * 시작 크기(토큰). 요청 값 색도 이 크기를 따른다 — 요청 1회 = 컨텍스트 × 읽기 요율이라 금액 문턱을 따로 두지 않는다
 */
export type Thresholds = {
  ctxWarn: number
  ctxCut: number
  /** 캐시 남은 분이 이보다 적으면 노랑 — 1시간 캐시일 때 */
  cacheWarnMin: number
  /** 5분 캐시일 때의 노랑 기준(분). 없으면 CACHE_WARN_5M_DEFAULT */
  cacheWarnMin5m?: number
  /** 컴팩트 구간으로 건 기준: 노랑 = 구간 시작(비용이 가장 적은 크기), 빨강 = 구간 끝. 아니면 직접 정한 크기(노랑 = 그 80%) */
  isRange?: boolean
}

export type TidyStyleId = 'default' | 'light' | 'thorough'

/** $.store 'settings'. 모든 세션이 같은 값을 쓴다 */
export type Settings = {
  /** 직접 지정 방식의 컴팩트 크기(토큰) — 이 크기부터 빨강, 그 80% 부터 노랑 */
  compactAt: number
  /** 구간 방식(기본): rangeStart 부터 노랑, rangeEnd 부터 빨강. 끄면 직접 지정(compactAt) */
  follow: boolean
  /** 컴팩트 구간 시작 · 끝(토큰) — 설정 탭의 0~100만 비용표(RANGE_ROWS)에서 고른다. 세션을 따라 움직이지 않는다 */
  rangeStart: number
  rangeEnd: number
  /** 캐시 남은 분이 이보다 적으면 노랑 — 1시간 캐시(구독 요금제 기본) */
  cacheWarnMin: number
  /**
   * 5분 캐시(API 키 · 사용량 초과 · promptCacheTtl "5m")일 때의 노랑 기준(분). 1시간용 10분을 그대로 쓰면 늘 노랑이다
   *
   */
  cacheWarnMin5m: number
  /** 정리 후 컴팩트 문구: 기본 프리셋 셋 중 하나, 또는 직접(① tidyCustom · ② compactCustom 을 사용자가 씀) */
  tidy: TidyStyleId | 'custom'
  /** ① 컴팩트 전에 보낼 글 — [저장하고 컴팩트] 저장 턴의 가운데(앞뒤 고정 글은 mod 가 붙인다) */
  tidyCustom: string
  /** ② /compact 뒤에 붙일 글 — 요약에 남길 것(저장하고 컴팩트는 mod 고정 지시 뒤에, 바로 컴팩트는 이것만) */
  compactCustom: string
  /**
   * 화면 언어. auto(기본) = Claude Code 설정 language → Claude 데스크톱 앱 언어 → OS 언어 → 영어, 한국어면 한국어 아니면
   * 영어. ko · en 은 고정 — 감지가 빗나갈 때(CLI 만 쓰고 아무것도 안 정한 경우 등) 설정 탭 맨 위 줄에서 바꾼다
   */
  lang: 'auto' | 'ko' | 'en'
  /** 입력창 위 띠 크기(BandMode). 띠 오른쪽 위 버튼(— 최소 / □ 최대) · 설정 탭 · /easy-compact 최소|최대 로 바꾼다 */
  band: BandMode
  /**
   * 바를 접었다(창 버튼 ✕): 입력창 아래 [🔽 이지 컴팩트 ⇱] 로 접혀 모든 세션에서 바가 안 보인다. 그 버튼 · /easy-compact
   * 보이기로 편다. 0.4.0 전 bandHidden(안 보이기) · bandAuto(자동 숨김)를 둘로 옮긴 값 — ✕ 와 ⇲ 가 같아 보였다
   */
  bandFolded: boolean
  /**
   * 컴팩트할 때 자동으로 펴기(기본 켬): 접힌 바가 컴팩트 구간 시작(노랑) · 캐시 만료 · 모델 바뀜에 닿으면 저절로 펴지고, 컴팩트로
   * 내려가면 다시 접힌다(옛 자동 숨김). 끄면 누를 때까지 접힌 채(옛 안 보이기)
   */
  bandAutoOpen: boolean
  /**
   * 화면 프리셋(설정 탭 맨 위): 간단 · 자세히는 보기 값(ScreenView)을 정해 두고 바꾸지 못한다 — 세부는 보기만. 커스텀은 custom 값을 쓰고
   * 다 바꾼다. 슬림 화면(slim)이 켜져 있는 동안은 쉰다(값은 남아 끄면 돌아온다)
   */
  screen: ScreenPreset
  /** 커스텀의 보기 값 — 처음 커스텀을 고를 때 그때 프리셋 값을 옮겨 둔다(그 전엔 null) */
  custom: ScreenView | null
  /**
   * 이 세션 금액 색 기준(달러, 오름차순): 넘으면 노랑 · 주황 · 빨강 — 그 아래는 기본 글색. 화면 프리셋과 따로(어느 화면에서나
   * 바꾼다 — 보기가 아니라 사람마다 다른 예산 경고선, 사용자 2026-10-13). 0.4.0 은 커스텀 보기 값 안에 있었다(normalizeSettings 가 옮김)
   */
  sessionColors: [number, number, number]
  /**
   * 오늘 · 이번 달 금액 색 기준(달러, 오름차순 — 1.0, 사용자 2026-10-18 "오늘 · 이번 달도 색상 · 깜빡임은 안 해야 됨"): 넘으면 노랑 · 주황 ·
   * 빨강. 세션 금액 색과 같은 꼴 · 따로 값. 깜빡이지 않는다(한 번 넘으면 그날 · 그달 내내 넘어 있다)
   */
  todayColors: [number, number, number]
  monthColors: [number, number, number]
  /**
   * 질문 강조(기본 끔 — 0.9.2, 그 전엔 켬): 답변 끝 질문 비용 칩이나 사용량 패널의 그 질문 줄에 마우스를 올리면 칩 · 패널 줄 · 그 답변이 함께
   * 회색(엔진 hover scope · reveal). 답변 글에 올려선 반응 없음. 데스크톱만 — 터미널 설정 탭엔 줄이 없다
   */
  questionHover: boolean
  /**
   * 사용량 패널: 새 세션에서 자동으로 열기(기본 끔). 그 뒤 닫으면 그대로. 예전엔 다른 세션이 연 값을 따라 새 세션에 들어가
   * 채팅만 쳐도 패널이 저절로 열렸다
   */
  paneAutoOpen: boolean
  /** 사용량 패널: 모든 데스크톱 세션 같이 열고 닫기(기본 끔) — 사람이 연 · 닫은 것을 떠 있는 다른 데스크톱 세션이 따라 한다. 터미널은 늘 혼자 */
  paneShared: boolean
  /** 0.5 묶음 2(N15): 바 비용 줄 칸 순서(BAND_ORDER_DEFAULT 의 이름들) — 설정 "바 · 패널" 에서 ◂ 로 한 칸씩 앞으로 */
  bandOrder: string[]
  /** 0.5 묶음 2(N20): 모션 — system = OS 동작 줄이기만 따름, reduce = 게이지 · 점 움직임 · 값 깜빡임 없음(앱 "모션" 값은 mod 가 못 읽는다) */
  motion: 'system' | 'reduce'
  /** B1(0.6.1 피드백): 바 · 설명 칩의 컨텍스트 · 컴팩트 구간 숫자 꼴 — size = 281k, pct = 최대 컨텍스트 대비 28%(앱 '11% 사용됨' 과 같은 셈), both = 281k(28%) */
  ctxUnit: 'size' | 'pct' | 'both'
  /** 0.8.1 B8: 게이지 꼴(바 · 패널 머리 · 확인 카드) — bar 가로 막대(기본) · ring 고리(앱 컨텍스트 고리 꼴) · vbar 세로 막대 · cells 칸 막대 */
  gaugeShape: 'bar' | 'ring' | 'vbar' | 'cells'
  /** 0.9.0 B10: 입력창 아래 한 줄($.ui.status — 크기 단계 · 컨텍스트 · 컴팩트 구간 · 세션 금액). 앱이 "다음 단계" 상자 동안 바를 빼서. 기본 끔 */
  statusLine: boolean
  /**
   * 이지 오토 구간(2026-10-19 — 모든 세션 공통, 켜고 끄기는 세션마다 입력창 아래 칩): 답이 끝났을 때 앞쪽(autoStart)을 넘었으면 저장 →
   * 컴팩트, 일하는 도중 뒤쪽(autoEnd)을 넘으면 끊고 저장 → 컴팩트 → 이어가기. 처음 값은 그때의 컴팩트 구간(그 뒤 따로)
   */
  autoStart: number
  autoEnd: number
}

/**
 * 이지 오토 사슬 하나(세션마다 · 상태 auto 안). wait = 답 끝 0.5초 기다림(사람 글이 오면 쉼) · saving = 요약 턴 · compacting = /compact ·
 * continuing = 이어가기 턴(긴 일 길만). turnId = 우리 턴(글 머리표 "[이지 오토" 로 알아본다 — 우리 훅은 우리 보내기를 못 본다)
 */
export type AutoChain = {
  path: 'end' | 'mid'
  stage: 'wait' | 'saving' | 'compacting' | 'continuing'
  /** 그 단계에 들어간 시각 — 10분 넘게 묵은 사슬은 버린다 */
  atMs: number
  turnId: string | null
  /** 사슬을 건 때의 컨텍스트 */
  before: number
  /** 컴팩트를 시작한 뒤 사람 · 다른 세션 글이 들어왔다 — 이어가기를 안 보낸다 */
  isInterrupted?: boolean
  /** 1.0.2: 입력 칸에 사람이 쓰던 글이 있어 그 단계(요약 · 컴팩트)를 미루는 중 — 칩 "오토 · 입력 칸 글 기다림" */
  isDraftHeld?: boolean
}

/**
 * 이지 오토 세션 상태(상태 auto — 다시 불림에 남고, $.store auto:<세션> 에도 적어 앱을 다시 켜도 이어받는다).
 * stop = 자동 멈춤(stuck 컴팩트하고도 앞쪽 아래로 못 내려감 · again 앞 컴팩트 뒤 요청 3번 안에 또 넘음) — 칩 "오토 멈춤".
 * note = 입력창 위 한 줄(멈춤 둘 · cold 캐시 만료 · model 모델 바뀜으로 저절로 꺼짐), ✕ 로 닫는다.
 * since = 앞 사슬의 컴팩트가 끝난 뒤 메인 요청 수(자동 멈춤 판정)
 */
export type AutoState = {
  on: boolean
  stop: 'stuck' | 'again' | null
  note: 'stuck' | 'again' | 'cold' | 'model' | null
  chain: AutoChain | null
  since: { atMs: number; requests: number } | null
  atMs: number
}

/** 바 꼴(1.0): button = 평소 입력창 위가 비고 아래 버튼 하나(슬림) · one = 바 한 줄(간단) · three = 한도 · 비용 · 질문 세 줄(자세히) */
export type BarLayout = 'button' | 'one' | 'three'

/** 칸 단계: 끔 · 필요할 때(지금 색이 바뀌는 문턱부터) · 늘 */
export type PartLevel = 'off' | 'need' | 'on'

/**
 * 칸(1.0 — 화면마다): ctx 컨텍스트 · btn 컴팩트 버튼(아래 버튼 꼴) · cache 캐시 남은 시간 · lim 한도(5시간 · 7일) · resets 리셋까지 남은 시간 ·
 * sess 이 세션 금액 · req 요청당 · today 오늘 · month 이번 달 · range 컴팩트 구간 · last 지난 · 진행 중 질문(세 줄 꼴) · chip 답변 끝 칩 ·
 * spin 작업 중 금액. 칸마다 고를 수 있는 단계 · 쓰는 바 꼴은 settings.ts PARTS
 */
export type PartKey = 'ctx' | 'btn' | 'cache' | 'lim5' | 'lim7' | 'resets' | 'sess' | 'req' | 'today' | 'month' | 'range' | 'last' | 'chip' | 'spin'

export type PartShow = Record<PartKey, PartLevel>

/** 1.0 전 슬림 이름(같은 것) */
export type SlimLevel = PartLevel
export type SlimKey = PartKey
export type SlimShow = PartShow

/** 오늘 · 이번 달 사용량(달러) — atMs 에 잰 값. tools/scan-spend.mjs 결과를 cost.ts spendUsd 로 센 것 */
/** retroMonth = 이번 달 값 중 잰 값이 없는 컴팩트 어림(M2 — 장부 전 · 질문 기록 60개 밖, 대화 기록의 컴팩트 크기로) */
/** engineSince = 요율이 바뀐 판(minEngine) → 이 PC 가 그 판으로 처음 요청한 날(이번 달에 옛 판 · 새 판이 다 있을 때만, 0.9.3) */
export type SpendTotals = { atMs: number; today: number; month: number; retroMonth?: number; engineSince?: Record<string, string> }

/**
 * 설정 탭 easy-compact 칸(업데이트, 마켓 설치본만 — 2026-10-14 사용자 1~3안 · 자동 확인 없음). phase: idle(아직) · checking(마켓 받는 중) ·
 * latest · newer(받아 둔 마켓 사본이 더 새 판) · updating · done(받음 — 앱을 다시 켜면 적용) · failed · synced(앤트로픽 디렉터리에서 받은
 * 판 — Claude Code 가 켤 때 저절로 새 판을 받아 버튼이 없다, 0.6.0). own = 이 판, market = 마켓 사본 판, marketAt = 사본을 받은 때
 * (known_marketplaces.json lastUpdated)
 */
export type UpdateState = {
  /** dev = 폴더로 불러온 개발본(0.9.1 — 버튼은 늘 보이되 업데이트 명령은 없다) */
  phase: 'idle' | 'checking' | 'latest' | 'newer' | 'updating' | 'done' | 'failed' | 'synced' | 'dev'
  /**
   * phase dev 에서 개발자 모드 스위치가 꺼짐(2026-10-17 — ~/.claude/mods/README.md "개발자 모드"): 판 표시에 "개발자 모드" 를 안 붙여
   * 공개판처럼, 서랍 글로 꺼진 것을 알린다. 공개판엔 스위치를 읽는 코드가 없어 늘 비어 있다
   */
  devOff?: boolean
  own: string | null
  market: string | null
  marketAt: string | null
  /** 실패한 명령의 마지막 출력 줄(펼쳐 보기) · 어느 단계였나(확인 = 마켓 받기, 업데이트) */
  error?: string
  failedOn?: 'check' | 'apply'
  /** 명령이 시간 안에 안 끝나 멈춤(응답 없음) — 실패 글이 "응답이 없어 멈췄습니다" */
  isTimeout?: boolean
  /** 업데이트 뒤 첫 실행(3안): 이 판으로 업데이트됨 — [닫기] 하면 null */
  updatedTo?: string | null
  /** 받아 둔 마켓 사본 CHANGELOG 에서 뽑은 판별 바뀐 것 — [바뀐 것 ▸] */
  changes?: Record<string, ChangeGroup[]>
  /** 펼침: 새 판의 바뀐 것 · 오류 원문 · 업데이트 알림의 바뀐 것 */
  open?: { changes?: boolean; error?: boolean; note?: boolean }
  /** U1(0.6.1 피드백): 서랍에 보일 판들(새 판부터) — 새 판이면 지금 판 < v ≤ 새 판, 업데이트 뒤 첫 실행이면 본 판 < v ≤ 지금 판, 그 밖엔 지금 판 */
  versions?: string[]
}

/** CHANGELOG 한 판의 한 절(바뀜 · 새로 생김 · 뺌 · 고침) — 항목은 굵은 머리만 */
export type ChangeGroup = { head: string; items: string[] }

/**
 * 화면 프리셋(1.0 — 시안 preview-1017d 안 3): 슬림(익숙해진 분 · 필요한 것만) · 간단(처음 쓰는 분 · 정보 최소) · 자세히(AI 를 잘 아는 분 ·
 * 정보 전부) · 커스텀(다 고름). 0.4.0 의 기본('basic')은 간단으로, 1.0 전 따로 켜던 슬림(slim) · 개발본의 'glance' 는 슬림으로 옮긴다
 */
export type ScreenPreset = 'slim' | 'simple' | 'detail' | 'custom'

/** 프리셋이 정하는 보기 값 — 창 상태(바 크기 · 접기 · 패널 자동 열기 · 같이)는 넣지 않는다(창 버튼과 같은 값) */
export type ScreenView = {
  /** 바 꼴 — 아래 버튼(슬림) · 한 줄(간단) · 세 줄(자세히) */
  layout: BarLayout
  /**
   * 칸마다 끔 · 필요할 때 · 늘(1.0 — 사용자 "필요할 때 · 늘 · 끄기 옵션이 기본 옵션에서도"). 1.0 전엔 비용 · 질문 줄 칸만 켬/끔이고 한도 줄 ·
   * 오늘 · 이번 달은 화면과 따로였다(normalizeSettings 가 옮김)
   */
  parts: PartShow
  /**
   * 정보량 — 최소(간단) / 전부(자세히). 사용량 패널의 처음 보기도 정한다(최소 = 간략, 전부 = 자세히 — settings.ts paneModeOf).
   * 0.4.1 작업 중 따로 있던 "패널 보기" 를 합쳤다. 패널 위 [간략][자세히] 는 이 세션만 잠깐
   */
  info: InfoLevel
}

/**
 * 현황 보기(사이드 패널 — 자세히 보고 싶은 사람 몫). 한 장 요약은 패널이 아니라 입력창 위 요약 카드(게이지 · 슬림 아래 버튼으로 엶 —
 * 1.0 시안 3판 "보기는 위, 공부는 옆")
 */
export type PaneMode = 'simple' | 'detail'

/**
 * 정보량: lean = 최소 — 설정의 컴팩트 시점 · 캐시 · 컴팩트 문구 풀이를 줄이고 답변 아래 · 작업 중 줄의 에이전트는
 * 개수만, full = 전부. 간단 = 최소, 자세히 = 전부, 커스텀은 고른다
 */
export type InfoLevel = 'lean' | 'full'

/**
 * 펼친 질문 · 진행 중 질문의 내역: summary = 한 줄(요청 N회 · 총 $ · 🤖 에이전트 · ⚙ 앱 자체), steps = 읽기 · 쓰기 · 출력과 동작별 줄.
 * 패널 보기를 따른다 — 간략 = summary
 */
export type QuestionDetail = 'summary' | 'steps'

/**
 * 바 크기. full = 최대(한도 · 비용 · 질문 세 줄 + 이지 컴팩트 버튼), min = 최소 한 줄(요청당 · 컨텍스트 · 컴팩트 구간 +
 * 사용량 패널 · 이지 컴팩트 버튼 — 캐시 · 한도 · 질문 줄은 뺀다). 늘 떠 있어 거슬린다는 말에서 min 과 자동 숨김(bandAuto) ·
 * 안 보이기(bandHidden)를 더했다. 0.2.0 의 'auto' 는 min + bandAuto 로 옮긴다(normalizeSettings). 슬림 화면은 크기와 상관없이 슬림 꼴
 */
export type BandMode = 'full' | 'min'

/**
 * 띠의 칸마다 보일지(그릴 때 쓰는 합친 값 — 한도 줄 LimitShow + 화면 보기 값 CostShow).
 */
export type BandShow = LimitShow & CostShow

/**
 * 한도 줄의 칸: 5시간 · 7일 = 요금제 한도 막대, resets = 그 뒤 "N 후 리셋". 화면 프리셋과 따로 켜고 끈다(Settings.limitShow —
 * 사용자, 2026-10-13: 어느 화면에서나 따로). 엔진이 구독 세션에만 한도를 줘서 API 키 세션엔 켜도 줄이 없다
 */
export type LimitShow = {
  fiveHour: boolean
  sevenDay: boolean
  resets: boolean
}

/**
 * 비용 · 질문 줄의 칸(화면 보기 값): session = 이 세션 금액(비용 줄 맨 앞, 최소 바에도). 0.4.0 의 질문 평균(sessionAvg)은
 * 뺐다 — 자리만 차지하고 패널 비용 요약에 같은 값이 있다
 */
export type CostShow = {
  session: boolean
  perRequest: boolean
  context: boolean
  range: boolean
  cache: boolean
  lastTurn: boolean
}

/** 컴팩트 요청이 입력을 어떻게 내는지(몫, 합 1). 엔진이 컴팩트 끝에 준 실제 토큰으로 잰다 */
export type CompactMix = { input: number; read: number; write: number }

/**
 * 컴팩트 한 번의 값을 셀 재료. after = 컴팩트 직후 크기(기본 적재 + 요약), summary = 그중 새로 쓰는 요약(다시 붙는 파일
 * 포함), output = 요약 출력 토큰, mix = 컴팩트 요청의 입력 몫
 */
export type CompactInputs = {
  after: number
  summary: number
  output: number
  mix: CompactMix
  save?: SaveTurn
  /** 메인 대화 캐시 유지 시간(분) — 저장 턴 · 요약 쓰기 요율(Usage.cacheTtlMin). 없으면 60 */
  ttl?: number
}

/**
 * 저장 턴(저장하고 컴팩트의 앞 단계) 한 번의 몫: steps = 요청 수(그만큼 그때 컨텍스트를 한 번씩 읽는다), output = 출력
 * 토큰(메모리에 쓰는 글 · 답), write = 새로 쓴 토큰(도구 결과 등). 크기와 상관없는 몫(output · write)이 권장 크기를 조금 늦춘다
 */
export type SaveTurn = { steps: number; output: number; write: number }

/** 값이 어디서 왔나: 이 세션에서 잼 · 이 PC 의 지난 컴팩트에서 잼 · 가정(아직 못 잼) */
export type Source = 'session' | 'pc' | 'guess'

/** 계산식 최적과 그 재료 — 설정 화면에 출처와 함께 보인다(hooks/optimal.ts) */
export type Optimal = {
  model: string
  /** null = 컴팩트 직후 크기를 아직 모름(기록 앞부분을 못 읽었고 이 PC 에서 잰 적도 없음) */
  inputs: CompactInputs | null
  src: { after: Source; summary: Source; output: Source; mix: Source; save?: Source }
  /** 요청당 증가(토큰)와 잰 이웃 요청 수 */
  growth: number
  growthN: number
  growthSrc: Source
  /** 계산식 최적 크기(1만 단위). 요율 · 직후 크기를 모르면 null */
  at: number | null
  /** 직후 크기에서 컴팩트 한 번 값 — 미룬 값 게이지의 100% */
  onceUsd: number | null
  /** 긴 프롬프트 요율 경계(Haiku 5.5 의 10만)로 묶였으면 그 경계 */
  capped: number | null
  /** 이 모델의 공통 앞부분(flow.ts sharedFor) — 설정 탭 비용표 "캐시 식으면" 도 띠 · 카드와 같은 셈 */
  shared?: number
  /**
   * 질문 하나의 꼴(9b — 설정 표 "질문 1개" 칸): steps = 이 세션 최근 질문의 평균 요청 수, extraUsd = 요청마다 읽기 말고 드는 값
   * (새로 쓰기 · 출력 · 입력)의 가운데 값. 못 쟀으면 없다 — 칸을 숨긴다(가정을 지어내지 않는다)
   */
  perQuestion?: { steps: number; extraUsd: number; agentUsd: number } | null
}

/**
 * 정리 후 컴팩트의 단계. tidying = 정리 턴이 도는 중, compacting = /compact 가 도는 중,
 * held = 세션이 지금은 컴팩트하면 안 된다고 답해 멈춘 상태(다음 질문까지 띠에 표시)
 */
export type CompactPhase = 'idle' | 'tidying' | 'compacting' | 'held'

/** 사용량 패널 · 띠 예측이 읽는 값. 턴이 끝날 때마다 다시 잰다 */
export type Usage = {
  model: string
  contextTokens: number
  window: number
  percent: number | null
  costUsd: number | null
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  /** /context 의 항목별 토큰. 패널이 열려 있을 때만 잰다 */
  categories: { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' }[]
  /** 이 대화의 마지막 메인 요청 · 컴팩트 시각 — 캐시 1h 타이머의 기준(컴팩트 뒤 첫 요청 전이면 컴팩트 시각). 모르면 null */
  lastActivityMs: number | null
  /** 최근 턴들의 컨텍스트 토큰(오래된 것부터, 최대 12) */
  history: number[]
  /**
   * 컴팩트 뒤 아직 요청이 없고 엔진이 직후 크기(tokensAfter)를 안 줬다 — 엔진 값은 컴팩트 전 크기 그대로라 contextTokens ·
   * percent 는 컴팩트 뒤 추정값(지난 컴팩트의 실측, 없으면 기본값)이다. 첫 요청이 재면 false
   */
  contextEstimated?: boolean
  /**
   * 컴팩트 뒤 아직 요청이 없다 — contextTokens 는 직후 크기(엔진 값, 없으면 추정), 다음 요청이 요약을 처음 쓴다(바의 지난 질문
   * 줄을 숨기고 컨텍스트 칸에 "컴팩트 직후")
   */
  isAfterCompact?: boolean
  /**
   * 마지막 요청과 다른 모델을 골랐다 — 그 요청의 모델(이 대화 캐시가 있는 모델). 새 모델엔 캐시가 없어
   * 다음 요청이 컨텍스트 전체를 다시 쓴다. 새 모델로 요청이 한 번 끝나면(또는 원래 모델로 돌아오면) 없어진다
   */
  switchedFrom?: string | null
  /**
   * 요청마다 읽기 말고 드는 값(9a — flow.ts extraPerCall): 이 세션 그 모델 최근 요청의 가운데 값. "요청당" = 지금 크기 × 읽기 요율 +
   * 이 값. 모자라면 null(읽기만 어림)
   */
  perCallExtraUsd?: number | null
  /**
   * 지금 모델의 공통 앞부분(토큰): 캐시가 식은 뒤 첫 요청이 그래도 캐시에서 읽은 크기(시스템 · 도구 — 같은 모델의 다른 세션이
   * 데워 둔다, flow.ts noteShared). 식은 캐시 셈이 이만큼은 읽기로 센다. 못 쟀으면 0
   */
  sharedTokens?: number
  /**
   * 메인 대화의 캐시 유지 시간(분, 5 · 60). 기록의 마지막 메인 요청이 쓴 종류(cache_creation 의 ephemeral_5m · 1h)로 잰다.
   * 엔진은 요청마다 정한다 — 구독 요금제 사용량 안 = 1시간, 사용량 초과 · API 키 · 클라우드 = 5분(공식 문서 기본값),
   * promptCacheTtl 설정 · 환경 변수로 바뀐다. 없으면 60
   */
  cacheTtlMin?: number
  /** cacheTtlMin 을 기록에서 쟀나 — 아니면 설정 · 문서 기본값으로 짐작한 값(화면에 "추정") */
  cacheTtlMeasured?: boolean
}

/** 질문 안의 동작 하나(= 모델 요청 하나): 무엇을 했는지와 그 요청의 값. write = 그중 캐시 쓰기 값(이전 기록엔 없다) */
export type StepDetail = {
  label: string
  usd: number
  write?: number
  /** 그중 캐시를 다시 쓴 값(cost.ts rewriteOf — 앞 요청까지 있던 컨텍스트를 못 읽고 새로 씀). 0 이거나 이전 기록이면 없다 */
  rewrite?: number
  /**
   * 하위 에이전트 한 마리의 합(요청마다 한 줄이 아니라 에이전트마다 한 줄, 요청이 끝날 때마다 값이 는다).
   * label = 에이전트 작업 이름, steps = 그 에이전트의 요청 수, model = 그 에이전트가 돈 모델
   */
  agent?: string
  steps?: number
  model?: string
  /** 에이전트 줄: 읽기 · 출력 · 정가 입력 값(달러) — 질문별 비용에서 메인 / 에이전트를 나눠 보인다(0.4.0 부터, 그 전 기록엔 없다) */
  read?: number
  output?: number
  input?: number
  /** 에이전트 줄: false = 도는 중, true = 끝남(하위 턴의 turn.complete · 엔진 목록). 0.4.0 전 기록엔 없다(표시 없음) */
  done?: boolean
  /** 에이전트 줄: 마지막 요청이 끝난 시각 — 엔진 목록에 없는 갈래가 조용해지면 끝남으로 친다 */
  at?: number
  /**
   * 앱 자체 요청의 합(대화 기록에 없는 요청 — 답 뒤 다음 질문 제안 · 메모리 정리, 컴팩트 미리 계산). 엔진 집계가 는 만큼에서
   * 우리가 본 요청을 뺀 값이라 요청 수 · 모델은 모른다. label = 무엇인지(아는 만큼)
   */
  app?: boolean
  /**
   * 이 질문 답 뒤의 컴팩트 한 번(저장하고 컴팩트면 그 저장 턴에): 직전 → 직후 크기. usd = 컴팩트 요청 값(엔진이 준 토큰 × 요율,
   * 미리 계산한 요약을 썼으면 0). 직후 크기는 다음 메인 요청이 채운다
   */
  compact?: { before: number; after: number | null }
}

/** 요청 · 턴 비용을 요율별로 나눈 값(달러) */
export type CostParts = { read: number; write: number; output: number; input: number; usd: number }

/**
 * 한 질문 안에서 모델 · 노력이 바뀐 자리(1.0.3) — at = 그 질문의 몇 번째 메인 요청부터(1부터), from · to = 앞 요청 값 · 이 요청 값.
 * 질문 사이 바뀜은 앞 질문과 견준다(ui-usage changesOf) — 여기엔 질문 안 바뀜만
 */
export type StepSwitch = { at: number; kind: 'model' | 'effort'; from: string; to: string }

/** 지금 도는 메인 턴의 누적(작업 중 표시용). prompt 는 사용자가 보낸 글 앞부분 */
export type LiveTurn = {
  turnId: string
  steps: number
  cost: CostParts
  prompt: string
  /** 마지막 요청의 컨텍스트(입력 전체)와 이번 질문의 출력 토큰 합 */
  contextTokens: number
  outputTokens: number
  details: StepDetail[]
  /** 그중 앱 자체 요청 몫(StepDetail.app 줄들의 합) — 읽기 · 쓰기 · 출력으로 못 나눠 cost.usd 에만 더했다 */
  appUsd?: number
  /** 그중 캐시를 다시 쓴 값(StepDetail.rewrite 합) */
  rewriteUsd?: number
  /** 마지막 요청에 답한 모델 id 와 그 요청의 노력도(엔진이 요청마다 알려 준다 — 쉬는 동안엔 노력도를 알 길이 없다) */
  model?: string
  effort?: string
  /** 이 질문의 첫 요청이 모델을 바꾼 뒤 첫 요청이었다 — 바꾸기 전 모델 id */
  switchedFrom?: string
  /** 이 질문 안에서 모델 · 노력이 바뀐 자리(1.0.3) — 없으면 안 바뀜 */
  switches?: StepSwitch[]
  /** Ultracode 가 켜진 채 도는 질문(1.0.4 — 첫 요청 때 기록의 엔진 켬 알림으로 가림). 앱에선 생각 깊이 단계 하나라 엑스트라 대신 이 글로 */
  ultra?: true
}

/** 끝난 턴 요약. 답변 블록은 id 가 없어 마지막 글 끝부분(tail)으로 찾는다 */
export type TurnSummary = {
  /** 사람이 멈춘 질문(turn.complete isAborted, N7) — 요청이 0개여도 줄을 남기고 "⏹ 중단됨" */
  aborted?: true
  /** 대화 기록에서 다시 만든 질문(N3 — 이 판 전 세션). 앱 자체 요청 · 컴팩트 값 · 동작별 줄이 없다 */
  rebuilt?: true
  tail: string
  steps: number
  cost: CostParts
  /** 그중 앱 자체 요청 몫(StepDetail.app 줄들의 합) — 읽기 · 쓰기 · 출력으로 못 나눠 cost.usd 에만 더했다 */
  appUsd?: number
  /** 그중 캐시를 다시 쓴 값(StepDetail.rewrite 합). 이전 판 기록에는 없다 */
  rewriteUsd?: number
  /** 사용량 패널 히스토리용: 질문 앞부분 · 끝난 시각 · 끝났을 때 컨텍스트 */
  prompt: string
  atMs: number
  contextTokens: number | null
  /** 동작별 값. 이전 판 기록에는 없다 */
  details?: StepDetail[]
  /** 그 질문의 마지막 요청 모델 · 노력도. 이전 판 기록에는 없다 */
  model?: string
  effort?: string
  /** 이 질문의 첫 요청이 모델을 바꾼 뒤 첫 요청이었다 — 바꾸기 전 모델 id */
  switchedFrom?: string
  /** 이 질문 안에서 모델 · 노력이 바뀐 자리(1.0.3). 이전 판 기록에는 없다 */
  switches?: StepSwitch[]
  /** Ultracode 가 켜진 채 돈 질문(1.0.3 — 대화 기록의 엔진 켬 · 끔 알림으로 가림). 이전 판 기록에는 없다 */
  ultra?: true
  /** 그 질문의 메인 턴 id — 질문이 끝난 뒤에도 도는 백그라운드 에이전트의 값을 띄운 질문에 더한다. 이전 판 기록에는 없다 */
  turnId?: string
}

/**
 * 질문 기록 한도(TURNS_KEEP) 밖으로 밀린 질문들의 합(1.0) — 개수 · 금액 · 그중 에이전트 · 앱 자체 요청. 질문 합계 = 남긴 줄 + 이것.
 * rebuilt = 대화 기록에서 다시 센 몫이 있다(1.0 전 세션 — 앱 자체 요청 · 컴팩트 값은 기록에 없어 빠진다)
 */
export type TurnsOlder = { count: number; usd: number; agentUsd: number; appUsd: number; rebuilt?: true }

/** 컨텍스트 흐름 그래프의 점: 메인 모델 요청 하나 */
export type CtxPoint = {
  atMs: number
  ctx: number
  usd: number
  /** 그 요청이 캐시에 쓴 종류(분): 5 · 60. 기록에서 잰 것만 — 모르면 없다(60 으로 본다) */
  ttl?: number
  /** 이 요청에 답한 모델 id — 모델 바꾼 시점을 그린다. 모델을 적기 전 판 저장 파일엔 없다 */
  model?: string
  /** 이 요청을 보낸 Claude Code 판(0.9.3 — 요율이 판으로 갈리는 모델). 모르면 없다(날짜로 고른다) */
  engine?: string
}

/** 컴팩트 한 번. index = 그 직전까지의 점 수(그래프에서 세로선 자리) */
export type CompactEvent = {
  atMs: number
  trigger: string
  /**
   * 컴팩트 직전 · 직후 첫 요청의 컨텍스트(기본 적재 + 남긴 대화 + 새 질문 글). 직후는 다음 요청이 와야 안다 — 그 전엔 null(어림은
   * kept + 기본 적재, flow.ts afterGuess)
   */
  before: number
  after: number | null
  /** 컴팩트 요청의 실제 값(엔진이 준 토큰 × 요율). 기록 파일로만 안 경우는 없다 — 추정으로 보인다 */
  costUsd: number | null
  index: number
  /**
   * 요약(새로 쓴 몫): 컴팩트 뒤 첫 요청이 캐시에서 못 읽고 새로 낸 토큰(input + cache_creation) — 컴팩트 비용의 요약 쓰기 값. 컴팩트
   * 요청이 데워 둔 앞부분(시스템 · 도구 — 2026-10-18 이 PC 실측 58.6k)만 읽고 메모리 · 요약 · 다시 붙은 파일 · 새 질문은 새로 쓴다.
   * 그 요청이 캐시가 식은 뒤였거나 못 쟀으면 없다(직후 − 첫 요청으로 어림)
   */
  summary?: number | null
  /**
   * 남긴 대화: 엔진이 컴팩트 결과로 준 크기(tokensAfter = 기록 compact_boundary 의 postTokens) — 경계 + 요약 + 다시 붙인 파일 + 훅
   * 결과(엔진 2.1.299 실행 파일). 기본 적재(시스템 지시 · 도구 · 메모리)는 안 든다 — 화면의 "컴팩트 요약". 0.6.0 ~ 1.0 은 이 값을
   * 직후 크기로 써 상주가 18k(기본 적재 0)로 보였다. 엔진이 안 줬으면 없다
   */
  kept?: number
  /**
   * 1.0.2: 어느 길로 알아챘나(진단 파일 — 사용자 2026-10-20 "진단 파일에 컴팩트 판정 넣는거 좋음"). hook = session.compact 훅 · catch =
   * 훅이 적기 전에 던져 .catch 가 받은 결과 · boundary = 엔진 값이 빈 때 기록 경계 · watch = 의심 뒤 감시가 본 경계 · shrink = 의심 뒤
   * 다음 요청이 줄어듦 · own-boundary / own-empty = 우리 /compact 뒤 기록 경계 / 엔진 값 빔. 1.0.1 까지 적은 것엔 없다
   */
  via?: string
}

/**
 * 캐시 유지 시간을 무엇이 정하나(엔진 순서, 공식 문서 "Choose the TTL yourself"): FORCE_PROMPT_CACHING_5M → 환경 변수
 * CLAUDE_CODE_PROMPT_CACHE_TTL → 설정 promptCacheTtl → ENABLE_PROMPT_CACHING_1H → 자동(구독 요금제 사용량 안 1시간, 그 밖 5분).
 * 보이기만 한다 — 설정 파일을 바꾸던 칸은 0.6.1 피드백으로 뺐다
 */
export type TtlConfig = {
  source: 'force5m' | 'env' | 'setting' | 'enable1h' | 'auto'
  /** 그 출처가 정한 값(자동이면 null) */
  value: '5m' | '1h' | null
}

/** $.store 에 두는 열린 패널. 트리는 그 그룹 세션에서만 따라 연다 */
export type StoredPane = { view: PaneView }

declare module 'claude-code' {
  interface PluginState {
    'easy-compact': {
      isConfirmingCompact: boolean
      /** 확인 카드 [클리어]를 눌러 같은 자리가 경고 카드로 바뀜(2026-10-19) */
      isAskingClear: boolean
      paneView: PaneView | null
      /** 터미널(CLI) 세션이 열어 둔 화면 — 데스크톱 세션은 $.store 'pane' 을 같이 따르고, 터미널 세션은 이것만 본다 */
      localPane: PaneView | null
      usage: Usage | null
      live: LiveTurn | null
      turnSummaries: TurnSummary[]
      /** 한도 밖으로 밀린 질문들의 합 — null = 모름(1.0 전 파일이 한도까지 참 · 아직 대화 기록에서 못 채움) */
      turnsOlder: TurnsOlder | null
      /** "정리 후 컴팩트" 진행 단계. 진행 중이면 버튼 대신 상태 글자를 그려 다시 못 누르게 한다 */
      compactPhase: CompactPhase
      /** 도는 컴팩트의 이름("바로 컴팩트" · "저장 끝 → 컴팩트" · "클로드 기본 compact" · "클로드 기본 auto-compact") — 컴팩트 중 글에 붙는다 */
      compactKind: string
      /** 질문별 비용에서 펼친 질문(atMs) */
      expandedTurn: number | null
      /** 답변 아래 칩에서 상세(분해 · 동작별 값)를 펼친 질문들(atMs) — 처음엔 다 접힘 */
      answerOpen: number[]
      /** 질문별 비용에서 동작 줄을 [글 다 보기]로 편 질문들(끝난 질문 = atMs, 진행 중 = 'live') — 1.0 시안 1017o 안 3 */
      stepsFull: (number | 'live')[]
      /** 설정 미리보기의 질문 비용 견본을 펼쳤는가(이 세션만, 패널을 닫으면 접힘) */
      previewOpen: boolean
      /** 질문별 비용: true 면 전체, 아니면 최근 5개 */
      historyAll: boolean
      /** 컴팩트 효과: true 면 전체, 아니면 최근 3개 */
      effectsAll: boolean
      /** 컨텍스트 흐름 그래프: true 면 전체, 아니면 최근 질문 40개(FLOW_RECENT) */
      flowAll: boolean
      /** 지금 쓰는 설정($.store 'settings' 를 읽어 둔 것) */
      settings: Settings | null
      /**
       * 사용량 패널 안 탭: main(지금 · 컴팩트 · 질문별 비용) 또는 settings. 세션마다 따로 — 패널 화면(paneView)은
       * 모든 세션이 같이 따라가 거기 두면 한 세션에서 설정을 열 때 다른 세션 패널도 설정으로 바뀐다
       */
      usageTab: UsageTab
      /** 설정의 컴팩트 문구 "보내는 글 전체"를 펼쳤는가(처음엔 접힘 — 단계 보기만) */
      tidyRawOpen: boolean
      /**
       * 설정 탭에서 펼친 칸(compact · tidy · band · layout · lang → true). 처음엔 컴팩트 시점 · 문구만 펼침, 접힌 칸은
       * 제목 줄에 지금 값만(캐시 경고는 접지 않는다). 세션마다 따로
       */
      settingsOpen: Record<string, boolean>
      /** S10(0.9.0): 설정 안 탭 — 바 · 답변 칩 · 패널 · 컴팩트 · 일반. 이 세션, 패널을 닫으면 바 탭으로 */
      settingsTab: 'bar' | 'chip' | 'pane' | 'compact' | 'gen'
      /**
       * 0.9.1 U6: 진단 내용 카드(이 세션) — 연 자리(판 서랍 · 설정 › 일반 탭) · 질문 · 동작 글 빼기 · [복사] 한 줄 수 · [파일로 저장] 한 경로.
       * 보이는 덤프 글은 연 때 · 빼기를 바꿀 때 한 번 만든 사본(register.tsx diagSnap — 본 그대로 복사 · 저장)
       */
      diagCard: { open: boolean; where: 'drawer' | 'gen'; redact: boolean; copiedLines: number | null; savedPath: string | null }
      /** 사용량 카드 펼침: 접으면 제목 줄의 요약만. 패널을 열 때 이 세션 카드는 펼침 · 질문별 비용은 접힘(CARDS_OPEN_DEFAULT) */
      cardsOpen: { now: boolean; history: boolean; compact: boolean }
      /** 오늘 · 이번 달 사용량(설정에서 켰거나 패널 자세히를 볼 때 잰다) — 못 쟀으면 null */
      spend: SpendTotals | null
      /** 마지막 재기가 실패했나(node 가 없거나 기록을 못 읽음) — 패널 "모든 세션" 줄의 "못 잼" */
      spendFailed: boolean
      /** 업데이트 칸 상태(설치본만) */
      update: UpdateState
      /** U4(0.6.1 피드백): 탭 줄 업데이트 버튼의 서랍이 열렸나 — 이 세션, 탭을 바꾸거나 패널을 닫으면 닫힘 */
      updDrawer: boolean
      /** 설정의 직접 쓴 문구 입력칸에 치는 중인 글(Enter 전). 화면을 다시 그려도 친 글이 남게 칸 값으로 다시 준다 */
      tidyDraft: string | null
      /** 설정의 컴팩트 문구 ② /compact 뒤에 붙일 글 칸에 치는 중인 글(Enter 전) — tidyDraft 와 같은 까닭 */
      compactDraft: string | null
      /**
       * 설정의 컴팩트 시점에서 고르는 중인 값(방식 · 구간 시작 · 끝 · 직접 지정 크기). [적용] 을 눌러야 저장 — 누르자마자
       * 바뀌어 고르는 도중에도 띠 · 색이 따라 움직였다. null 이면 바꾸는 중이 아니다
       */
      cmpDraft: (Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'> & { sizeText?: string }) | null
      /** 컨텍스트 흐름: 세션 시작 때 기록 파일에서 읽고, 요청 · 컴팩트마다 이어 붙인다 */
      flowPoints: CtxPoint[]
      compactions: CompactEvent[]
      /** 질문이 시작된 시각, 오래된 것부터 — 그래프 [최근 질문 40] 경계. 기록 파일 · 질문마다 */
      flowQuestions: number[]
      /** 모델마다(modelKey) 공통 앞부분 — 캐시가 식은 뒤 첫 요청이 그래도 읽은 크기(flow.ts noteShared) */
      flowShared: Record<string, number>
      /** 기록 파일을 읽었는가(못 읽었으면 그래프 자리에 그 사실을 보인다) */
      flowLoaded: boolean
      /** 앞 구간을 못 읽었을 때 그 까닭(패널에 한 줄로 보인다) */
      flowNote: string | null
      /** 계산식 최적과 그 재료(출처 포함). 설정 화면 · 게이지 · 컴팩트 손익이 같은 값을 쓴다 */
      optimal: Optimal | null
      /** 기록에서 잰 메인 대화 캐시 유지 시간(분, 5 · 60) — 턴 끝 · 흐름을 읽을 때 잰다. 못 쟀으면 null */
      ttlMeasured: number | null
      /** 캐시 유지 시간 설정의 출처(설정 탭) — 무엇이 정하나 */
      ttlConfig: TtlConfig | null
      /** 패널 위 [간략][자세히] 로 이 세션에서만 바꾼 보기 — null 이면 화면 프리셋 값 */
      paneModeLocal: PaneMode | null
      /** 자동으로 펴진 바를 ✕ 로 다시 접은 단계(warn · cut · cold) — 그보다 급해질 때만 다시 편다. 컴팩트하면 null */
      autoDismissed: string | null
      /** 1.0 요약 카드(입력창 위 — 게이지 · 슬림 아래 버튼으로 엶)가 열려 있나. 저장 · 컴팩트를 시작하면 닫는다 */
      summaryCard: boolean
      /** 1.0 값 강조 시계(0.2초)가 올리는 수 — 바만 읽어 강조 동안 그 칸만 다시 그린다 */
      flashTick: number
      /** 이지 오토(이 세션) — null 이면 아직 안 읽음(세션 시작 때 저장소의 이 세션 값, 없으면 꺼짐) */
      auto: AutoState | null
    }
  }
}
