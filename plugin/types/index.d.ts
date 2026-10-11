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
  /** 캐시 남은 분이 이보다 적으면 노랑 */
  cacheWarnMin: number
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
  cacheWarnMin: number
  /** 정리 후 컴팩트 문구: 기본 프리셋 셋 중 하나, 또는 사용자가 쓴 글 */
  tidy: TidyStyleId | 'custom'
  tidyCustom: string
  /**
   * 화면 언어. auto(기본) = Claude Code 설정 language → Claude 데스크톱 앱 언어 → OS 언어 → 영어, 한국어면 한국어 아니면
   * 영어. ko · en 은 고정 — 감지가 빗나갈 때(CLI 만 쓰고 아무것도 안 정한 경우 등) 설정 탭 맨 위 줄에서 바꾼다
   */
  lang: 'auto' | 'ko' | 'en'
  /** 입력창 위 띠 보기(BandMode). 띠 오른쪽 위 버튼(전체 ↔ 최소화) · 설정 탭 · /easy-compact band 로 바꾼다 */
  band: BandMode
  /** 전체 보기 띠에 보일 칸 — 설정 탭 "UI 레이아웃 상세 조정". 끈 칸은 빠지고, 칸이 다 빠진 비용 줄은 줄째 빠진다 */
  bandShow: BandShow
}

/**
 * 띠 보기. full = 전체(한도 · 비용 · 질문 세 줄 + 이지 컴팩트 버튼), min = 한 줄(요청당 · 컨텍스트 · 컴팩트 구간 + 사용량
 * 패널 버튼 — 이지 컴팩트 버튼 · 캐시 · 한도 · 질문 줄은 뺀다), auto = 컴팩트할 때만: 컨텍스트가 컴팩트 구간 시작(노랑)에
 * 닿기 전엔 띠를 아예 안 그려 입력창 위 자리를 비우고, 닿으면 min 한 줄 + 이지 컴팩트 버튼. 띠가 늘 떠 있어 거슬린다는
 * 말에서 min · auto 를 더했다
 */
export type BandMode = 'full' | 'min' | 'auto'

/** 전체 보기 띠의 칸마다 보일지. 5시간 · 7일 = 요금제 한도 막대, resets = 그 뒤 "N 후 리셋" */
export type BandShow = {
  fiveHour: boolean
  sevenDay: boolean
  resets: boolean
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
export type CompactInputs = { after: number; summary: number; output: number; mix: CompactMix; save?: SaveTurn }

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
  /** 이 세션 트랜스크립트의 마지막 기록 시각 — 캐시 1h 타이머의 기준 */
  lastActivityMs: number | null
  /** 최근 턴들의 컨텍스트 토큰(오래된 것부터, 최대 12) */
  history: number[]
  /**
   * 컴팩트 뒤 아직 요청이 없다 — 엔진 값은 컴팩트 전 크기 그대로라 contextTokens · percent 는
   * 컴팩트 뒤 추정값(지난 컴팩트의 실측, 없으면 기본값)이다. 첫 요청이 재면 false
   */
  contextEstimated?: boolean
  /**
   * 마지막 요청과 다른 모델을 골랐다 — 그 요청의 모델(이 대화 캐시가 있는 모델). 새 모델엔 캐시가 없어
   * 다음 요청이 컨텍스트 전체를 다시 쓴다. 새 모델로 요청이 한 번 끝나면(또는 원래 모델로 돌아오면) 없어진다
   */
  switchedFrom?: string | null
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
}

/** 끝난 턴 요약. 답변 블록은 id 가 없어 마지막 글 끝부분(tail)으로 찾는다 */
export type TurnSummary = {
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
  /** 그 질문의 메인 턴 id — 질문이 끝난 뒤에도 도는 백그라운드 에이전트의 값을 띄운 질문에 더한다. 이전 판 기록에는 없다 */
  turnId?: string
}

/** 컨텍스트 흐름 그래프의 점: 메인 모델 요청 하나 */
export type CtxPoint = {
  atMs: number
  ctx: number
  usd: number
  /** 이 요청에 답한 모델 id — 모델 바꾼 시점을 그린다. 모델을 적기 전 판 저장 파일엔 없다 */
  model?: string
}

/** 컴팩트 한 번. index = 그 직전까지의 점 수(그래프에서 세로선 자리) */
export type CompactEvent = {
  atMs: number
  trigger: string
  /** 컴팩트 직전 · 직후 첫 요청의 컨텍스트. 직후는 다음 요청이 와야 안다 */
  before: number
  after: number | null
  /** 컴팩트 요청의 실제 값(엔진이 준 토큰 × 요율). 기록 파일로만 안 경우는 없다 — 추정으로 보인다 */
  costUsd: number | null
  index: number
}

/** $.store 에 두는 열린 패널. 트리는 그 그룹 세션에서만 따라 연다 */
export type StoredPane = { view: PaneView }

declare module 'claude-code' {
  interface PluginState {
    'easy-compact': {
      isHidden: boolean
      isConfirmingCompact: boolean
      paneView: PaneView | null
      /** 터미널(CLI) 세션이 열어 둔 화면 — 데스크톱 세션은 $.store 'pane' 을 같이 따르고, 터미널 세션은 이것만 본다 */
      localPane: PaneView | null
      usage: Usage | null
      live: LiveTurn | null
      turnSummaries: TurnSummary[]
      /** "정리 후 컴팩트" 진행 단계. 진행 중이면 버튼 대신 상태 글자를 그려 다시 못 누르게 한다 */
      compactPhase: CompactPhase
      /** 도는 컴팩트의 이름("바로 컴팩트" · "저장 끝 → 컴팩트" · "클로드 기본 compact" · "클로드 기본 auto-compact") — 컴팩트 중 글에 붙는다 */
      compactKind: string
      /** 질문별 비용에서 펼친 질문(atMs) */
      expandedTurn: number | null
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
      /** 설정의 "UI 레이아웃 상세 조정" 을 펼쳤는가(처음엔 접힘). 세션마다 따로 */
      layoutOpen: boolean
      /** 사용량 카드 펼침(간략 보기): 접으면 제목 줄의 요약만. 처음엔 다 펼침 */
      cardsOpen: { now: boolean; history: boolean; compact: boolean }
      /** 설정의 직접 쓴 문구 입력칸에 치는 중인 글(Enter 전). 화면을 다시 그려도 친 글이 남게 칸 값으로 다시 준다 */
      tidyDraft: string | null
      /**
       * 설정의 컴팩트 시점에서 고르는 중인 값(방식 · 구간 시작 · 끝 · 직접 지정 크기). [적용] 을 눌러야 저장 — 누르자마자
       * 바뀌어 고르는 도중에도 띠 · 색이 따라 움직였다. null 이면 바꾸는 중이 아니다
       */
      cmpDraft: (Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'> & { sizeText?: string }) | null
      /** 컨텍스트 흐름: 세션 시작 때 기록 파일에서 읽고, 요청 · 컴팩트마다 이어 붙인다 */
      flowPoints: CtxPoint[]
      compactions: CompactEvent[]
      /** 질문(사용자 프롬프트)이 시작된 시각, 오래된 것부터 — 그래프 [최근 질문 40] 경계. 기록 파일 · 질문마다 */
      flowQuestions: number[]
      /** 기록 파일을 읽었는가(못 읽었으면 그래프 자리에 그 사실을 보인다) */
      flowLoaded: boolean
      /** 앞 구간을 못 읽었을 때 그 까닭(패널에 한 줄로 보인다) */
      flowNote: string | null
      /** 계산식 최적과 그 재료(출처 포함). 설정 화면 · 게이지 · 컴팩트 손익이 같은 값을 쓴다 */
      optimal: Optimal | null
    }
  }
}
