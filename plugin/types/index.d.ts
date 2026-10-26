export type PaneView = 'usage'
export type UsageTab = 'main' | 'settings'

export type Thresholds = {
  ctxWarn: number
  ctxCut: number
  cacheWarnMin: number
  cacheWarnMin5m?: number
  isRange?: boolean
}

export type TidyStyleId = 'default' | 'light' | 'thorough'

export type Settings = {
  compactAt: number
  follow: boolean
  rangeStart: number
  rangeEnd: number
  cacheWarnMin: number
  cacheWarnMin5m: number
  tidy: TidyStyleId | 'custom'
  tidyCustom: string
  compactCustom: string
  lang: 'auto' | 'ko' | 'en'
  band: BandMode
  bandFolded: boolean
  bandAutoOpen: boolean
  screen: ScreenPreset
  custom: ScreenView | null
  sessionColors: [number, number, number]
  todayColors: [number, number, number]
  monthColors: [number, number, number]
  questionHover: boolean
  paneAutoOpen: boolean
  paneShared: boolean
  bandOrder: string[]
  motion: 'system' | 'reduce'
  ctxUnit: 'size' | 'pct' | 'both'
  gaugeShape: 'bar' | 'ring' | 'vbar' | 'cells'
  statusLine: boolean
  autoStart: number
  autoEnd: number
  currency: 'usd' | 'krw'
}

export type AutoChain = {
  path: 'end' | 'mid'
  stage: 'wait' | 'saving' | 'compacting' | 'continuing'
  atMs: number
  turnId: string | null
  before: number
  isInterrupted?: boolean
  isDraftHeld?: boolean
}

export type AutoState = {
  on: boolean
  stop: 'stuck' | 'again' | null
  note: 'stuck' | 'again' | 'cold' | 'model' | null
  chain: AutoChain | null
  since: { atMs: number; requests: number } | null
  atMs: number
  range?: { start: number; end: number } | null
}

export type BarLayout = 'button' | 'one' | 'three'

export type PartLevel = 'off' | 'need' | 'on'

export type PartKey = 'ctx' | 'btn' | 'cache' | 'lim5' | 'lim7' | 'resets' | 'sess' | 'req' | 'today' | 'month' | 'range' | 'last' | 'chip' | 'spin'

export type PartShow = Record<PartKey, PartLevel>

export type SlimKey = PartKey
export type SlimShow = PartShow

export type SpendTotals = { atMs: number; today: number; month: number; retroMonth?: number; engineSince?: Record<string, string> }

export type UpdateState = {
  phase: 'idle' | 'checking' | 'latest' | 'newer' | 'updating' | 'done' | 'failed' | 'synced' | 'dev'
  devOff?: boolean
  own: string | null
  market: string | null
  marketAt: string | null
  error?: string
  failedOn?: 'check' | 'apply'
  isTimeout?: boolean
  updatedTo?: string | null
  changes?: Record<string, ChangeGroup[]>
  open?: { changes?: boolean; error?: boolean; note?: boolean }
  versions?: string[]
}

export type ChangeGroup = { head: string; items: string[] }

export type ScreenPreset = 'slim' | 'simple' | 'detail' | 'custom'

export type ScreenView = {
  layout: BarLayout
  parts: PartShow
  info: InfoLevel
}

export type PaneMode = 'simple' | 'detail'

export type InfoLevel = 'lean' | 'full'

export type QuestionDetail = 'summary' | 'steps'

export type BandMode = 'full' | 'min'

export type BandShow = LimitShow & CostShow

export type LimitShow = {
  fiveHour: boolean
  sevenDay: boolean
  resets: boolean
}

export type CostShow = {
  session: boolean
  perRequest: boolean
  context: boolean
  range: boolean
  cache: boolean
  lastTurn: boolean
}

export type CompactMix = { input: number; read: number; write: number }

export type CompactInputs = {
  after: number
  summary: number
  output: number
  mix: CompactMix
  save?: SaveTurn
  ttl?: number
}

export type SaveTurn = { steps: number; output: number; write: number }

export type Source = 'session' | 'pc' | 'guess'

export type Optimal = {
  model: string
  inputs: CompactInputs | null
  src: { after: Source; summary: Source; output: Source; mix: Source; save?: Source }
  growth: number
  growthN: number
  growthSrc: Source
  at: number | null
  onceUsd: number | null
  capped: number | null
  shared?: number
  perQuestion?: { steps: number; extraUsd: number; agentUsd: number } | null
}

export type CompactPhase = 'idle' | 'tidying' | 'compacting' | 'held'

export type Usage = {
  model: string
  contextTokens: number
  window: number
  percent: number | null
  costUsd: number | null
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
  categories: { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' }[]
  lastActivityMs: number | null
  history: number[]
  contextEstimated?: boolean
  isAfterCompact?: boolean
  switchedFrom?: string | null
  perCallExtraUsd?: number | null
  sharedTokens?: number
  cacheTtlMin?: number
  cacheTtlMeasured?: boolean
}

export type StepDetail = {
  label: string
  usd: number
  write?: number
  rewrite?: number
  agent?: string
  steps?: number
  model?: string
  read?: number
  output?: number
  input?: number
  done?: boolean
  at?: number
  app?: boolean
  compact?: { before: number; after: number | null }
}

export type CostParts = { read: number; write: number; output: number; input: number; usd: number }

export type StepSwitch = { at: number; kind: 'model' | 'effort'; from: string; to: string }

export type EffortOutput = { effort: string; usd: number }

export type QuestionCells = { turnId: string; tools: string[]; tails: string[] }

export type LiveTurn = {
  turnId: string
  steps: number
  cost: CostParts
  prompt: string
  contextTokens: number
  outputTokens: number
  details: StepDetail[]
  appUsd?: number
  rewriteUsd?: number
  model?: string
  effort?: string
  switchedFrom?: string
  switches?: StepSwitch[]
  outputByEffort?: EffortOutput[]
  ultra?: true
}

export type TurnSummary = {
  aborted?: true
  rebuilt?: true
  tail: string
  steps: number
  cost: CostParts
  appUsd?: number
  rewriteUsd?: number
  prompt: string
  atMs: number
  contextTokens: number | null
  details?: StepDetail[]
  model?: string
  effort?: string
  switchedFrom?: string
  switches?: StepSwitch[]
  outputByEffort?: EffortOutput[]
  ultra?: true
  turnId?: string
}

export type TurnsOlder = { count: number; usd: number; agentUsd: number; appUsd: number; rebuilt?: true }

export type CtxPoint = {
  atMs: number
  ctx: number
  usd: number
  ttl?: number
  model?: string
  engine?: string
}

export type CompactEvent = {
  atMs: number
  trigger: string
  before: number
  after: number | null
  costUsd: number | null
  index: number
  summary?: number | null
  kept?: number
  fixed?: number
  via?: string
}

export type TtlConfig = {
  source: 'force5m' | 'env' | 'setting' | 'enable1h' | 'auto'
  value: '5m' | '1h' | null
}

export type StoredPane = { view: PaneView }

declare module 'claude-code' {
  interface PluginState {
    'easy-compact': {
      isConfirmingCompact: boolean
      isAskingClear: boolean
      paneView: PaneView | null
      localPane: PaneView | null
      usage: Usage | null
      live: LiveTurn | null
      turnSummaries: TurnSummary[]
      cellScopes: Record<string, string>
      turnsOlder: TurnsOlder | null
      compactPhase: CompactPhase
      compactKind: string
      expandedTurn: number | null
      answerOpen: number[]
      stepsFull: (number | 'live')[]
      previewOpen: boolean
      historyAll: boolean
      effectsAll: boolean
      flowAll: boolean
      settings: Settings | null
      usageTab: UsageTab
      tidyRawOpen: boolean
      settingsOpen: Record<string, boolean>
      settingsTab: 'bar' | 'chip' | 'pane' | 'compact' | 'gen'
      diagCard: { open: boolean; where: 'drawer' | 'gen'; redact: boolean; copiedLines: number | null; savedPath: string | null }
      cardsOpen: { now: boolean; history: boolean; compact: boolean }
      spend: SpendTotals | null
      spendFailed: boolean
      update: UpdateState
      updDrawer: boolean
      tidyDraft: string | null
      compactDraft: string | null
      flowPoints: CtxPoint[]
      compactions: CompactEvent[]
      flowQuestions: number[]
      flowShared: Record<string, number>
      flowInherited: boolean | null
      flowLoaded: boolean
      flowNote: string | null
      optimal: Optimal | null
      ttlMeasured: number | null
      ttlConfig: TtlConfig | null
      paneModeLocal: PaneMode | null
      autoDismissed: string | null
      summaryCard: boolean
      flashTick: number
      auto: AutoState | null
    }
  }
}
