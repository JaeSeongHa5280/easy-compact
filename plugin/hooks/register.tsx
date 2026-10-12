/**
 * easy-compact 훅 모듈 — 훅 등록 · 상태(atom · store) · 기록 읽기 · 요청/질문 집계 · 컴팩트 흐름 · 명령.
 *
 * $ 를 쓰는 함수는 모두 이 파일에 둔다: 엔진은 $ 를 import 너머로 따라가지 않아, 다른 파일 함수에 $ 를 넘기면 모듈이 안
 * 뜬다("$ is followed only into a function declared in this same file"). 화면 그리기는 ui-*.tsx(버튼 동작은 여기서 act 로
 * 묶어 넘긴다), 글 도우미는 text.ts, 컴팩트 지시문은 tidy.ts, 계산은 cost · flow · optimal · settings.ts
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type {
  BandShow,
  CompactInputs,
  CostShow,
  CostParts,
  LiveTurn,
  Optimal,
  PaneMode,
  PaneView,
  SaveTurn,
  Settings,
  Source,
  StepDetail,
  TtlConfig,
  TurnSummary,
  Usage,
  UsageTab,
} from '../types'
import {
  addCost,
  average,
  compactMixOf,
  compactPayoff,
  isLittleToSave,
  costOf,
  endsWithTail,
  coldFor,
  estimateFor,
  isWarmMix,
  fmtTokens,
  fmtUsd,
  LEVEL_TEXT,
  levelOf,
  projectSlug,
  modelKey,
  ratesFor,
  rewriteOf,
  tailOf,
  setThresholds,
  thresholds,
  SAVE_GUESS,
  WARM_COMPACT,
  ZERO_COST,
  ttlOf,
} from './cost'
import type { CompactMix } from './cost'
import {
  BAND_PARTS,
  bandModeName,
  bandPartName,
  bandShowMode,
  bandShowOf,
  bandStateText,
  chooseScreen,
  editView,
  hiddenNote,
  isViewPart,
  HIDDEN_NOTE_MS,
  parseScreen,
  screenName,
  setFolded,
  viewOf,
  paneAutoUse,
  paneSyncUse,
  revealLabel,
  setBandShow,
  chooseTidy,
  isAutoWord,
  parseOnOff,
  customName,
  DEFAULT_SETTINGS,
  normalizeSettings,
  NEW_INSTALL_SCREEN,
  UPDATE_SCREEN,
  paneModeName,
  paneModeOf,
  parseBandMode,
  parseBandPart,
  parseMinutes,
  parseTokens,
  setBandPart,
  setCompactAt,
  setFollow,
  setRange,
  setTidyCustom,
  thresholdsOf,
  TIDY_IDS,
  tidyStyles,
  tidyBody,
  tidySteps,
  usesCustom,
} from './settings'
import {
  GROWTH_GUESS,
  growthPerStep,
  keepOptimal,
  MIN_GROWTH_STEPS,
  onceUsd,
  optimalAt,
  OUTPUT_GUESS,
  SUMMARY_GUESS,
} from './optimal'
import {
  afterInNowTokens,
  compactSummary,
  flowFromRecords,
  lacksModels,
  lastCtxOf,
  lastMainTtl,
  mergeMeasured,
  parseFlowFile,
  pendingCompact,
  recordsFromLines,
  scanTranscript,
  serializeFlow,
  sharedFor,
  extraPerCall,
  withPoint,
  withQuestion,
} from './flow'
import type { Flow } from './flow'
import type { Tokens } from './cost'
import { APP_MIN_USD, agentPart, agentSum, answerBreakdown, callsOf, modelCompareText, promptHead, isWide, fitCells, stepLabel, topSteps } from './text'
import { kindDirect, kindTidy, compactKindOf, markGo, tidyPrompt, compactKeep, directKeep, tidyVerdict } from './tidy'
import { ACCENT, BRAND_HEX, row, gridOf, phaseLook, pulseDot, CARD_INSET, emptyLine, questionScope, stepText } from './ui-common'
import type { Ui, Fold } from './ui-common'
import { drawBandPreview, drawLimitsLine, drawEstimateLine, minShowOf, rewriteNote, drawLastTurnLine } from './ui-band'
import {
  liveBlock,
  compactingBlock,
  drawFlow,
  permanentOf,
  drawEfficiency,
  drawHistory,
  drawNow,
  drawCompactCard,
  drawReference,
  drawSummary,
} from './ui-usage'
import { draftCompactAt, drawSettingsView } from './ui-settings'
import { isKorean, L, lang, plural, setLang } from './i18n'
import { iconOf, setSurface, withIcon } from './glyph'
import type { Lang } from './i18n'
import { engineBelow, installedFrom, MIN_ENGINE, pluginDataId } from './paths'
import type { SettingsActions } from './ui-settings'

/** 답변 아래(정보량 전부, 펼쳤을 때) 동작별 줄 수 — 넘으면 비싼 것만, 나머지는 한 줄. 줄 폭은 알 수 없어 동작 이름을 이 칸까지 */
const ANSWER_STEPS = 10
const ANSWER_COLS = 72


/**
 * Claude 설정 폴더(~/.claude). 엔진이 알려 주지 않아 차례로 찾는다: 설치본의 설치 경로 → CLAUDE_CONFIG_DIR → mod 폴더가
 * ~/.claude 아래면 거기 → 홈 폴더(HOME · USERPROFILE)/.claude. 한 번 찾으면 그대로 쓴다 — 예전엔 작성자 경로를 박아 둬
 * 다른 PC 에서 못 찾았고, 그다음엔 node 에 물어 node 없는 설치(네이티브 설치기)와 시험 환경에서 못 찾았다
 */
let claudeHomeCache: string | null = null

async function claudeHome($: EngineInterface): Promise<string> {
  if (claudeHomeCache) return claudeHomeCache
  const root = $.plugin.root.replace(/\\/g, '/')
  const installed = installedFrom(root)
  if (installed) return (claudeHomeCache = installed.configDir)
  const env = async (get: () => Promise<string | undefined>) => {
    try {
      return (await get())?.replace(/\\/g, '/').replace(/\/+$/, '') || null
    } catch {
      return null
    }
  }
  const configDir = await env(() => $.env.get('CLAUDE_CONFIG_DIR'))
  if (configDir) return (claudeHomeCache = configDir)
  const at = root.lastIndexOf('/.claude/')
  if (at >= 0) return (claudeHomeCache = root.slice(0, at + '/.claude'.length))
  const home = (await env(() => $.env.get('HOME'))) ?? (await env(() => $.env.get('USERPROFILE')))
  if (home) return (claudeHomeCache = `${home}/.claude`)
  throw new Error(L('Claude 설정 폴더를 못 찾음(CLAUDE_CONFIG_DIR · HOME 없음)', 'Could not find the Claude config folder (no CLAUDE_CONFIG_DIR · HOME)'))
}

/**
 * 이 mod 의 데이터 폴더. 설치본은 공식 데이터 자리 plugins/data/<id> — id = "플러그인@마켓" 에서 영문 · 숫자 · _ · - 가
 * 아닌 글자를 - 로(공식 문서 plugins/components). 업데이트해도 남고 /plugin uninstall 이 지운다. 폴더로 불러온 개발본은
 * plugins/data/easy-compact
 */
async function dataDir($: EngineInterface): Promise<string> {
  const installed = installedFrom($.plugin.root)
  if (installed) return `${installed.configDir}/plugins/data/${pluginDataId('easy-compact', installed.marketplace)}`
  return `${await claudeHome($)}/plugins/data/easy-compact`
}

/**
 * 화면 글 언어(i18n.ts) — Claude 설정 언어가 한국어면 한국어, 아니면 영어.
 * 읽는 순서: Claude Code 설정 language(프로젝트 local → 프로젝트 → 사용자) → 데스크톱 앱 언어(config.json 의 locale) → 영어
 */
async function detectLang($: EngineInterface): Promise<Lang> {
  const readJson = async (path: string): Promise<Record<string, unknown> | null> => {
    try {
      return JSON.parse(await $.fs.read(path)) as Record<string, unknown>
    } catch {
      return null
    }
  }
  const settingsFiles: string[] = []
  try {
    const cwd = (await $.session.cwd()).replace(/\\/g, '/')
    settingsFiles.push(`${cwd}/.claude/settings.local.json`, `${cwd}/.claude/settings.json`)
  } catch {
    // 작업 폴더를 모르면 사용자 설정만
  }
  try {
    settingsFiles.push(`${await claudeHome($)}/settings.json`)
  } catch {
    // 설정 폴더를 모르면 앱 언어로
  }
  for (const path of settingsFiles) {
    const v = (await readJson(path))?.language
    if (typeof v === 'string' && v.trim()) return isKorean(v) ? 'ko' : 'en'
  }
  // 데스크톱 앱 언어: Windows %APPDATA%/Claude, macOS ~/Library/Application Support/Claude, Linux ~/.config/Claude
  const appDirs: string[] = []
  try {
    const appData = await $.env.get('APPDATA')
    if (appData) appDirs.push(`${appData.replace(/\\/g, '/')}/Claude`)
  } catch {
    // 없으면 다음
  }
  try {
    const home = await $.env.get('HOME')
    if (home) appDirs.push(`${home.replace(/\\/g, '/')}/Library/Application Support/Claude`, `${home.replace(/\\/g, '/')}/.config/Claude`)
  } catch {
    // 없으면 영어
  }
  for (const dir of appDirs) {
    const v = (await readJson(`${dir}/config.json`))?.locale
    if (typeof v === 'string' && v.trim()) return isKorean(v) ? 'ko' : 'en'
  }
  // OS 언어: 맥 · 리눅스 터미널은 LC_ALL · LC_MESSAGES · LANG, 없으면(Windows) 실행기의 기본 지역 — Windows 는 사용자 지역
  // 설정이 여기로 온다(이 PC: ko-KR). "C" · "POSIX" 는 언어가 아니라 건너뛴다
  const safeEnv = async (get: () => Promise<string | undefined>) => {
    try {
      return await get()
    } catch {
      return undefined
    }
  }
  const osVars = [await safeEnv(() => $.env.get('LC_ALL')), await safeEnv(() => $.env.get('LC_MESSAGES')), await safeEnv(() => $.env.get('LANG'))]
  const osVar = osVars.find(v => v && !/^(c|posix)([._]|$)/i.test(v))
  if (osVar) return isKorean(osVar) ? 'ko' : 'en'
  try {
    return isKorean(Intl.DateTimeFormat().resolvedOptions().locale) ? 'ko' : 'en'
  } catch {
    return 'en'
  }
}

/** 자동으로 고른 언어(설정 탭 "자동(한국어)" 표시) — 아직 안 읽었으면 null */
let autoLang: Lang | null = null

/** 마지막으로 설정 파일에서 언어를 읽은 때 — 그리기마다 파일을 읽지 않게 30초에 한 번 */
let langCheckedAt = Number.NEGATIVE_INFINITY

/**
 * 그리기 · 명령 앞에서 언어를 맞춘다: EASY_COMPACT_LANG(ko · en — 시험 · 고정용, 매번 읽음) → 설정 탭에서 고른 언어 →
 * 자동(30초마다 다시 읽어 Claude 설정을 바꾸면 따라간다)
 */
async function ensureLang($: EngineInterface): Promise<void> {
  let forced: string | undefined
  try {
    forced = await $.env.get('EASY_COMPACT_LANG')
  } catch {
    forced = undefined
  }
  let next: Lang | null = forced === 'ko' || forced === 'en' ? forced : null
  if (next === null) {
    const chosen = (await currentSettings($)).lang
    if (chosen === 'ko' || chosen === 'en') next = chosen
  }
  if (next === null) {
    const now = await $.clock.now()
    if (autoLang === null || now - langCheckedAt >= 30_000) {
      langCheckedAt = now
      autoLang = await detectLang($)
    }
    next = autoLang
  }
  if (next === lang()) return
  setLang(next)
  $.ui.invalidate('ui.render')
}

/** 설정 탭 언어 줄 · /easy-compact lang — 저장하고 바로 바꾼다(자동이면 다시 감지) */
async function saveLang($: EngineInterface, choice: Settings['lang']): Promise<void> {
  await saveSettings($, { ...(await currentSettings($)), lang: choice })
  langCheckedAt = Number.NEGATIVE_INFINITY
  await ensureLang($)
  $.ui.invalidate('ui.render')
}

const PANE = 'easy-compact'


// 사용량 = 지금(컨텍스트 · 비용) · 컴팩트 · 질문별 비용, 설정은 패널 안 탭(예전 이름 '비용' 은 내용보다 좁았다)
const paneTitle = () => L('사용량', 'Usage')

/** $.store 키: 설정(Settings). 모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다 */
const SETTINGS_KEY = 'settings'

// 이 PC 에서 잰 마지막 컴팩트 값($.store, 세션끼리 같이 쓴다). 이 세션에서 아직 컴팩트하지 않았을 때 쓰고, 그것도 없으면 가정
/** 컴팩트 뒤 첫 요청의 컨텍스트 — 기록 앞부분을 못 읽어 기본 적재를 모를 때만 */
const AFTER_KEY = 'afterCompactTokens'

/** 컴팩트 요청의 입력 몫(CompactMix) — 캐시가 살아 있던 컴팩트만. 없으면 전부 캐시 읽기로 본다(WARM_COMPACT) */
const MIX_KEY = 'compactMix'

/** 컴팩트 요약 크기(직후 크기 − 기본 적재, 다시 붙는 파일 포함) */
const SUMMARY_KEY = 'compactSummaryTokens'

/** 컴팩트 요청의 출력 토큰(요약을 쓴 양) */
const OUTPUT_KEY = 'compactOutputTokens'

/**
 * 이 PC 의 최근 저장 턴들(SaveTurn[]) — 저장하고 컴팩트는 저장 턴을 먼저 돌린 뒤 컴팩트한다. 그 몫을 컴팩트 값에 넣어야
 * 권장 크기가 실제로 하는 흐름에 맞는다. 한 번마다 요청 1~4회로 들쭉날쭉해 최근 몇 번의 평균으로
 */
const SAVE_KEY = 'saveTurns'

const SAVE_KEEP = 5

const isConfirmingCompact = atom({ plugin: 'easy-compact', key: 'isConfirmingCompact' } as const, false)

const paneView = atom({ plugin: 'easy-compact', key: 'paneView' } as const, null)

const localPane = atom({ plugin: 'easy-compact', key: 'localPane' } as const, null)

const live = atom({ plugin: 'easy-compact', key: 'live' } as const, null)

const turnSummaries = atom({ plugin: 'easy-compact', key: 'turnSummaries' } as const, [])

const compactPhase = atom({ plugin: 'easy-compact', key: 'compactPhase' } as const, 'idle')

/** 도는 컴팩트의 이름(compactKindOf) — compactPhase 가 'compacting' 일 때만 읽는다 */
const compactKind = atom({ plugin: 'easy-compact', key: 'compactKind' } as const, '')

const expandedTurn = atom({ plugin: 'easy-compact', key: 'expandedTurn' } as const, null)

const answerOpen = atom({ plugin: 'easy-compact', key: 'answerOpen' } as const, [])

const previewOpen = atom({ plugin: 'easy-compact', key: 'previewOpen' } as const, false)

const historyAll = atom({ plugin: 'easy-compact', key: 'historyAll' } as const, false)

const effectsAll = atom({ plugin: 'easy-compact', key: 'effectsAll' } as const, false)

const flowAll = atom({ plugin: 'easy-compact', key: 'flowAll' } as const, false)

const settings = atom({ plugin: 'easy-compact', key: 'settings' } as const, null)

const usageTab = atom({ plugin: 'easy-compact', key: 'usageTab' } as const, 'main')

const tidyRawOpen = atom({ plugin: 'easy-compact', key: 'tidyRawOpen' } as const, false)

// 처음 펼친 칸: 화면만(0.4.0 설정 정리 — 설계 확인, 2026-10-12). 나머지는 제목 줄에 지금 값
/**
 * 설정 탭 칸 펼침의 처음 값 — 화면과 그 안 세부까지 펼침. 세부엔 모든 화면 공통(한도 줄 · 세션 금액 색)이 있어 접혀 있으면
 * 못 찾는다. 패널을 닫으면 이것으로 돌아간다
 */
const SETTINGS_OPEN_DEFAULT: Record<string, boolean> = { screen: true, detail: true }
const settingsOpen = atom({ plugin: 'easy-compact', key: 'settingsOpen' } as const, SETTINGS_OPEN_DEFAULT)

const cardsOpen = atom({ plugin: 'easy-compact', key: 'cardsOpen' } as const, { now: true, history: true, compact: true })

const tidyDraft = atom({ plugin: 'easy-compact', key: 'tidyDraft' } as const, null)

const cmpDraft = atom({ plugin: 'easy-compact', key: 'cmpDraft' } as const, null)

const flowPoints = atom({ plugin: 'easy-compact', key: 'flowPoints' } as const, [])

const compactions = atom({ plugin: 'easy-compact', key: 'compactions' } as const, [])

const flowQuestions = atom({ plugin: 'easy-compact', key: 'flowQuestions' } as const, [])

const flowShared = atom({ plugin: 'easy-compact', key: 'flowShared' } as const, {})

const flowLoaded = atom({ plugin: 'easy-compact', key: 'flowLoaded' } as const, false)

const flowNote = atom({ plugin: 'easy-compact', key: 'flowNote' } as const, null)

const usage = atom({ plugin: 'easy-compact', key: 'usage' } as const, null)

const optimal = atom({ plugin: 'easy-compact', key: 'optimal' } as const, null)

const ttlMeasured = atom({ plugin: 'easy-compact', key: 'ttlMeasured' } as const, null)

const ttlConfig = atom({ plugin: 'easy-compact', key: 'ttlConfig' } as const, null)

const paneModeLocal = atom({ plugin: 'easy-compact', key: 'paneModeLocal' } as const, null)

const autoDismissed = atom({ plugin: 'easy-compact', key: 'autoDismissed' } as const, null)

function log($: EngineInterface, text: string): void {
  try {
    $.ui.log(`easy-compact: ${text}`)
  } catch {
    // 로그도 못 남기는 곳(테스트 등)에선 조용히 넘어간다
  }
}

// ── 사용량 ───────────────────────────────────────────────────────

async function transcriptPath($: EngineInterface): Promise<string> {
  return `${await claudeHome($)}/projects/${projectSlug(await $.session.cwd())}/${await $.session.id()}.jsonl`
}

/**
 * 캐시 타이머의 기준 = 이 대화의 마지막 메인 요청(흐름의 마지막 점) · 컴팩트 중 늦은 것. 처음엔 기록 파일 수정 시각을 썼는데
 * (statusline 과 같은 방식), 앱이 세션을 다시 열거나 제목을 바꿀 때 기록에 메타 줄(last-prompt · custom-title · mode)을
 * 덧붙여 하루 넘게 쉰 세션도 "방금 씀"으로 보였다 — 캐시 만료 · 바로 컴팩트 권장이 안 뜨고 저장하고 컴팩트가 전체를 다시
 * 썼다. 흐름이 비었으면(첫 요청 전 · 아직 못 읽음) 수정 시각
 */
async function lastActivity($: EngineInterface): Promise<number | null> {
  const points = await read($, flowPoints)
  const done = await read($, compactions)
  const at = Math.max(points[points.length - 1]?.atMs ?? 0, done[done.length - 1]?.atMs ?? 0)
  if (at > 0) return at
  try {
    return (await $.fs.stat(await transcriptPath($))).mtimeMs
  } catch {
    return null
  }
}

// ── 캐시 유지 시간: 기록에서 잰다(단정하지 않는다), 못 쟀을 때만 설정 · 문서 기본값 ──────────
//
// 엔진은 요청마다 유지 시간을 정한다(공식 문서 prompt-caching "Which TTL each request gets"): 메인 대화 = 구독 요금제 사용량 안
// 1시간, 사용량 초과 · API 키 · 클라우드 5분, promptCacheTtl 설정 · 환경 변수로 바뀐다. 엔진이 플러그인에 주는 요청 사용량엔
// 종류가 없고(모델 전환 훅에만 cache_ttl), 기록의 usage.cache_creation 에 ephemeral_5m · 1h 로 남는다 — 그래서 턴 끝마다 기록
// 끝부분을 읽는다. 사용량 초과를 한도 % 로 짐작하지 않는다 — 바뀌면 다음 요청 기록에 보인다

/** 기록의 마지막 메인 요청이 쓴 캐시 종류(분). 작은 기록은 바로 읽고, 큰 기록은 tools/last-ttl.mjs(node)로 끝 2 MiB 만. 못 재면 null */
async function measureTtl($: EngineInterface): Promise<number | null> {
  try {
    const path = await transcriptPath($)
    const size = (await $.fs.stat(path)).size
    if (size <= READ_LIMIT) return lastMainTtl(await $.fs.read(path))
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/last-ttl.mjs`, path], { timeoutMs: 20_000 })
    const v = ran.exitCode === 0 ? Number(ran.stdout.trim()) : NaN
    return v === 5 || v === 60 ? v : null
  } catch {
    return null
  }
}

/** 재고 남긴다 — 못 쟀으면 앞서 잰 값 그대로 */
async function refreshTtl($: EngineInterface): Promise<void> {
  const v = await measureTtl($)
  if (v !== null) await update($, ttlMeasured, () => v)
}

/**
 * 유지 시간을 무엇이 정하나(설정 탭 · 못 쟀을 때의 짐작). 엔진 순서 그대로: FORCE_PROMPT_CACHING_5M → CLAUDE_CODE_PROMPT_CACHE_TTL →
 * 설정 promptCacheTtl(합친 설정) → ENABLE_PROMPT_CACHING_1H → 자동. 사용자 설정 파일 값(userSetting)은 설정 탭이 바꾸는 곳
 */
async function readTtlConfig($: EngineInterface): Promise<TtlConfig> {
  const env = async (get: () => Promise<string | undefined>) => {
    try {
      return (await get())?.trim() ?? ''
    } catch {
      return ''
    }
  }
  const isTtl = (v: unknown): v is '5m' | '1h' => v === '5m' || v === '1h'
  const isOn = (v: string) => v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  let merged: unknown = undefined
  let user: unknown = undefined
  try {
    merged = (await $.settings.read()).promptCacheTtl
    user = (await $.settings.read({ source: 'user' })).promptCacheTtl
  } catch {
    // 설정을 못 읽는 곳(시험 등) — 자동으로 본다
  }
  let userFile: string | null = null
  try {
    userFile = `${await claudeHome($)}/settings.json`
  } catch {
    userFile = null
  }
  const userSetting = isTtl(user) ? user : null
  const force5m = await env(() => $.env.get('FORCE_PROMPT_CACHING_5M'))
  if (isOn(force5m)) return { source: 'force5m', value: '5m', userSetting, userFile }
  const envTtl = await env(() => $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'))
  if (isTtl(envTtl)) return { source: 'env', value: envTtl, userSetting, userFile }
  if (isTtl(merged)) return { source: 'setting', value: merged, userSetting, userFile }
  const enable1h = await env(() => $.env.get('ENABLE_PROMPT_CACHING_1H'))
  if (isOn(enable1h)) return { source: 'enable1h', value: '1h', userSetting, userFile }
  return { source: 'auto', value: null, userSetting, userFile }
}

/**
 * 못 쟀을 때의 짐작(분, 화면에 "추정"): 설정 · 환경 변수가 정했으면 그 값, 자동이면 60(0.3.x 까지 늘 쓰던 값). 한도 값이 없다고
 * API 키(5분)로 보지 않는다 — 구독 세션도 첫 응답 전엔 한도 값이 비어 있다(엔진: "empty when none has a reading"), 근거가 약한
 * 짐작은 단정과 같다. 첫 턴이 끝나면 기록에서 잰 값으로 바뀐다
 */
function guessTtl(cfg: TtlConfig | null): number {
  if (cfg?.value) return cfg.value === '5m' ? 5 : 60
  return 60
}

/**
 * 사용자 설정 파일(~/.claude/settings.json)의 promptCacheTtl 을 바꾼다(설정 탭 커스텀의 [자동 · 1시간 · 5분]). null = 키를 지워
 * 자동으로. 다른 키는 그대로 두고 그 키만 — 파일을 못 읽거나 JSON 이 아니면 건드리지 않는다. 엔진이 요청마다 설정을 읽어 다음
 * 요청부터 쓰인다
 */
async function writeTtlSetting($: EngineInterface, value: '5m' | '1h' | null): Promise<string | null> {
  const cfg = await readTtlConfig($)
  if (!cfg.userFile) return L('설정 파일 자리를 못 찾았습니다.', 'Could not find the settings file.')
  let obj: Record<string, unknown> = {}
  try {
    if (await $.fs.exists(cfg.userFile)) {
      const parsed = JSON.parse(await $.fs.read(cfg.userFile)) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return L('설정 파일이 JSON 객체가 아니라 바꾸지 않았습니다.', 'The settings file is not a JSON object, so it was left alone.')
      obj = parsed as Record<string, unknown>
    }
  } catch {
    return L('설정 파일을 읽지 못해 바꾸지 않았습니다.', 'Could not read the settings file, so it was left alone.')
  }
  if (value === null) delete obj.promptCacheTtl
  else obj.promptCacheTtl = value
  await $.fs.write(cfg.userFile, `${JSON.stringify(obj, null, 2)}\n`)
  await update($, ttlConfig, () => ({ ...cfg, userSetting: value }))
  void readTtlConfig($).then(next => update($, ttlConfig, () => next))
  return null
}

// ── 컨텍스트 흐름: 기록 파일에서 한 번 읽고, 그 뒤엔 요청 · 컴팩트마다 잇는다 ──────────

async function readFlow($: EngineInterface): Promise<Flow> {
  return { points: await read($, flowPoints), compactions: await read($, compactions), questions: await read($, flowQuestions), shared: await read($, flowShared) }
}

/** $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 그보다 큰 기록은 tools/scan-transcript.mjs(node)로 뽑는다 */
const READ_LIMIT = 4 * 1024 * 1024 - 64 * 1024

/** 세션별 흐름 저장 파일. mod 폴더 밖이라 저장해도 mod 가 다시 불러와지지 않는다 */
async function flowFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/flow/${await $.session.id()}.json`
}

/**
 * 상태에 쓰고 파일에도 남긴다(파일 쓰기 실패는 다음 쓰기에 다시 — 그리기를 막지 않는다). 질문 · 공통 앞부분이 없는 흐름이면
 * 있던 값 그대로
 */
async function writeFlow($: EngineInterface, flow: Flow): Promise<void> {
  const questions = flow.questions ?? (await read($, flowQuestions))
  const shared = flow.shared ?? (await read($, flowShared))
  await update($, flowPoints, () => flow.points)
  await update($, compactions, () => flow.compactions)
  await update($, flowQuestions, () => questions)
  await update($, flowShared, () => shared)
  void flowFile($)
    .then(path => $.fs.write(path, serializeFlow({ ...flow, questions, shared })))
    .catch(() => {})
}

/** 기록 파일에서 흐름을 처음부터. 기록이 아직 없으면(첫 질문 전) 빈 흐름 */
async function importFlow($: EngineInterface): Promise<Flow> {
  const path = await transcriptPath($)
  let size: number
  try {
    size = (await $.fs.stat(path)).size
  } catch {
    return { points: [], compactions: [] }
  }
  if (size <= READ_LIMIT) return scanTranscript(await $.fs.read(path))
  const mb = Math.round(size / 1048576)
  let ran: Awaited<ReturnType<EngineInterface['process']['run']>>
  try {
    ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path], { timeoutMs: 60_000 })
  } catch {
    // 띄우지도 못함 — 대개 node 가 없거나 앱이 못 찾는다(맥 앱을 Dock 에서 켜면 셸 프로필의 PATH 만 읽는다). 깔면 된다고 알린다
    throw new Error(L(`기록이 ${mb}MB 라 node 가 있어야 앞 구간을 읽습니다 — Node.js 14.8 이상을 깔고 앱을 다시 켜세요`, `the transcript is ${mb}MB, so the earlier part needs Node.js 14.8+ — install it and restart the app`))
  }
  if (ran.exitCode !== 0)
    throw new Error(L(`기록이 ${mb}MB 라 node 로 읽으려 했으나 실패(${ran.exitCode})`, `The transcript is ${mb}MB; reading it with node failed (${ran.exitCode})`))
  return flowFromRecords(recordsFromLines(ran.stdout))
}

/**
 * 세션 시작(재로드 포함) 때: 저장 파일이 있으면 그것(빠름), 없으면 기록 파일에서(이 mod 를 쓰기 전 구간 포함).
 * fromTranscript 면 저장 파일을 무시하고 기록에서 다시. 예전에 잰 컴팩트 값은 옮겨 둔다
 */
async function loadFlow($: EngineInterface, opts: { fromTranscript: boolean } = { fromTranscript: false }): Promise<void> {
  const old = await read($, compactions)
  try {
    let flow: Flow | null = null
    let saved: Flow['compactions'] = []
    if (!opts.fromTranscript) {
      try {
        flow = parseFlowFile(await $.fs.read(await flowFile($)))
      } catch {
        flow = null // 저장 파일이 아직 없다
      }
      // 모델 · 질문 · 공통 앞부분을 적기 전 판 저장 파일이면 기록에서 한 번 다시 읽는다(모델 바꾼 시점 · 최근 질문 경계 ·
      // 식은 캐시 셈) — 잰 컴팩트 값은 옮긴다
      if (flow && (lacksModels(flow) || flow.questions === undefined || flow.shared === undefined)) {
        saved = flow.compactions
        flow = null
      }
    }
    flow ??= await importFlow($)
    await writeFlow($, { points: flow.points, compactions: mergeMeasured(flow.compactions, [...old, ...saved]), questions: flow.questions ?? [], shared: flow.shared ?? {} })
    await update($, flowNote, () => null)
    // 캐시 유지 시간: 기록에서 읽은 마지막 점의 값(다시 연 세션도 첫 요청 전에 안다). 잰 점이 없으면 턴 끝에 잰다
    const lastTtl = [...flow.points].reverse().find(p => p.ttl === 5 || p.ttl === 60)?.ttl
    if (lastTtl !== undefined) await update($, ttlMeasured, () => lastTtl)
  } catch (err) {
    const why = String(err).replace(/^Error: /, '')
    await update($, flowNote, () => L(`앞 구간을 못 읽어 지금부터 그립니다(${why})`, `Could not read the earlier part — drawing from now on (${why})`))
    log($, `transcript read failed: ${why}`)
  } finally {
    await update($, flowLoaded, () => true)
  }
}

/** $.store 의 양수 하나. 없거나 못 읽으면 null */
async function storedCount($: EngineInterface, key: string): Promise<number | null> {
  try {
    const v = await $.store.get(key)
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** categories 는 /context 계산이라 패널이 열려 있을 때만, history 는 메인 턴이 끝날 때만 */
async function refreshUsage($: EngineInterface, opts: { categories: boolean; pushHistory: boolean }): Promise<void> {
  try {
    const measured = await $.session.usage(opts.categories ? { breakdown: 'summary' } : undefined)
    const prev = await read($, usage)
    // 컨텍스트 크기는 우리가 잰 마지막 메인 요청 값(흐름의 마지막 점)이 기준 — 띠 · 패널 · 그래프 · 질문별 비용이
    // 같은 값을 보인다. 흐름이 비었으면(기록을 못 읽음 · 첫 요청 전) 엔진 값.
    // 컴팩트 직후 · 첫 요청 전엔 엔진 값이 마지막 응답 기준이라 컴팩트 전 크기 그대로다(띠가 "권장 54%" 를 띄웠다) —
    // 그 동안은 추정값. 엔진 값이 이미 줄어 있으면(컴팩트 전의 8할 아래) 그것을 믿는다. 엔진 값이 0 이어도(다시 연 세션의
    // 컴팩트 직후 — 띠가 "컨텍스트 0" 이었다) 추정값
    const flow = await readFlow($)
    const pending = pendingCompact(flow)
    const engineTokens = measured.context.tokens ?? 0
    const lastCtx = flow.points[flow.points.length - 1]?.ctx ?? null
    const isStale = pending !== null && pending.before > 0 && (engineTokens <= 0 || engineTokens >= pending.before * 0.8)
    // 추정값은 계산식 재료와 같은 직후 크기 — 막 읽은 흐름으로 바로 잰다(걸어 둔 최적은 이 함수 끝에서야 갱신된다)
    const afterNow = isStale ? ((await measureOptimal($, prev?.model ?? (await $.session.model()))).inputs?.after ?? null) : null
    const tokens = isStale
      ? engineTokens > 0
        ? Math.min(afterNow ?? engineTokens, engineTokens)
        : (afterNow ?? 0)
      : pending !== null
        ? engineTokens
        : (lastCtx ?? engineTokens)
    const window = measured.context.window
    const percent = window > 0 ? (tokens / window) * 100 : (measured.context.percent ?? null)
    const categories = opts.categories
      ? (measured.context.breakdown?.categories ?? [])
          .filter(c => !c.isDeferred && c.kind !== 'deferred' && c.tokens > 0)
          .map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind === 'free' || c.kind === 'buffer' ? c.kind : 'used' }))
      : (prev?.categories ?? [])
    const costUsd = measured.cost?.usd ?? null
    const model = await $.session.model()
    // 캐시 유지 시간: 기록에서 잰 값, 없으면 설정 · 문서 기본값으로 짐작(화면에 "추정")
    const measuredTtl = await read($, ttlMeasured)
    const cfg = (await read($, ttlConfig)) ?? (await readTtlConfig($))
    if ((await read($, ttlConfig)) === null) await update($, ttlConfig, () => cfg)
    const cacheTtlMin = measuredTtl ?? guessTtl(cfg)
    const next: Usage = {
      model,
      contextTokens: tokens,
      window,
      percent,
      contextEstimated: isStale,
      // 모델이 바뀐 상태는 followModel 이 정한다(턴 끝에 다시 재도 지우지 않는다)
      switchedFrom: prev?.switchedFrom ?? null,
      costUsd,
      rateLimits: measured.rateLimits.map(r =>
        r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed },
      ),
      categories,
      // 캐시 타이머는 컴팩트 뒤 첫 요청 전에도 컴팩트 시각부터 — 컴팩트 요청이 시스템 · 도구 앞부분 캐시를 읽어(실측 98.6%) 시간이
      // 새로 시작된다. 0.3.1 은 그 동안 "캐시 없음(다음 요청이 새로 씀)" 을 띄웠는데 뜻을 모르겠고 필요 없다 — 늘 남은 시간(얼리버드)
      lastActivityMs: await lastActivity($),
      isAfterCompact: pending !== null,
      history: opts.pushHistory ? [...(prev?.history ?? []), tokens].slice(-12) : (prev?.history ?? []),
      sharedTokens: sharedFor(flow, model),
      perCallExtraUsd: extraPerCall(flow, model),
      cacheTtlMin,
      cacheTtlMeasured: measuredTtl !== null,
    }
    await update($, usage, () => next)
    // 최적은 모델 · 직후 크기 · 요청당 증가를 따라 바뀐다(컴팩트 직후 · 턴 끝 · 흐름을 다 읽은 뒤)
    await applyThresholds($)
  } catch (err) {
    log($, `usage read failed — ${String(err)}`)
  }
}

// ── 사이드 패널: 세션마다 따로 연다. 설정 "자동 열기" 는 새 세션의 처음, "같이 여닫기" 는 그 뒤 사람이 연 · 닫은 것만 퍼뜨린다 ──
//
// 처음엔 데스크톱 세션들이 열림 값 하나($.store)를 같이 따랐다 — 새 세션에 들어가 채팅만 쳐도 패널이 저절로 열렸고, 한
// 곳에서 닫으면 다 닫혔다. 그러면 안 되고 옵션으로 — "새 세션에서 열기" 와 "같이 열고 닫기" 둘로
// 나눈다. 그래서 열림 값은 세션마다(localPane) 두고, 두 옵션은 따로 켠다:
// - 자동 열기(paneAutoOpen): 처음 보는 세션(PANE_AUTO_KEY 목록에 없는 세션 id)이면 시작할 때 연다. 그 뒤 닫으면 그대로
// - 같이 여닫기(paneShared, 데스크톱만): 사람이 열거나 닫으면 그 일(PANE_EVENT_KEY)을 남기고, 이미 떠 있던 다른 데스크톱
//   세션이 따라 한다. 새 세션은 시작 전 일을 따르지 않는다 — 처음 상태는 자동 열기가 정한다

/** $.store 키: 같이 여닫기에서 마지막으로 사람이 열거나 닫은 일(PaneEvent) */
const PANE_EVENT_KEY = 'paneEvent'

/** $.store 키: 자동 열기를 한 번 한 세션 id 목록(최근 PANE_AUTO_KEEP 개) — mod 를 다시 불러와도 또 열지 않게 */
const PANE_AUTO_KEY = 'paneAutoOpened'

const PANE_AUTO_KEEP = 200

type PaneEvent = { view: PaneView | null; at: number; from: string }

/**
 * 터미널(CLI) 세션인가. 터미널 창은 저마다 따로 보여 같이 여닫을 까닭이 없다 — 같이 따르면 CLI 에서 열 때 앱의 모든 세션에
 * 패널이 뜨고, 앱에서 닫으면 CLI 패널도 닫혔다(2026-10-11: CLI 에서 settings 가 "열었다"고 답했는데 앱에서 닫힌 상태를 따라
 * 패널이 사라짐). 못 읽으면 데스크톱으로 본다
 */
async function isTerminalSession($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.surfaces()).includes('terminal')
  } catch {
    return false
  }
}

/** 같이 여닫기를 쓰나: 데스크톱이고 설정을 켰을 때 */
async function isPaneShared($: EngineInterface): Promise<boolean> {
  if (await isTerminalSession($)) return false
  return (await currentSettings($)).paneShared
}

async function wantedView($: EngineInterface): Promise<PaneView | null> {
  return read($, localPane)
}

/** 이 프로세스가 시작한 때(같이 여닫기: 그 전 일은 따르지 않는다) · 마지막으로 본 일의 때 */
let paneStartAt: number | null = null
let paneEventAt = 0

/** 사람이 열고 닫는 길(띠 버튼 · 명령 · 패널 닫기): 이 세션 값을 바꾸고, 같이 여닫기면 다른 세션에 알린다 */
async function setWantedView($: EngineInterface, view: PaneView | null): Promise<void> {
  const prev = await read($, localPane)
  await update($, localPane, () => view)
  // 탭만 바꿀 땐(열린 채 같은 화면) 알리지 않는다 — 다른 세션 패널이 열리면 안 된다
  if (prev === view || !(await isPaneShared($))) return
  // 알리기가 안 돼도(저장소 · 세션 id 를 못 읽음) 이 세션의 여닫기는 그대로
  try {
    const at = await $.clock.now()
    paneEventAt = at
    await $.store.set(PANE_EVENT_KEY, { view, at, from: await $.session.id() })
  } catch {}
}

/** 같이 여닫기: 이 세션이 시작한 뒤 다른 세션이 연 · 닫은 일이 새로 있으면 따라 한다 */
async function followPaneEvent($: EngineInterface): Promise<void> {
  if (!(await isPaneShared($))) return
  const raw = (await $.store.get(PANE_EVENT_KEY)) as Partial<PaneEvent> | undefined
  if (!raw || typeof raw.at !== 'number' || raw.at <= paneEventAt) return
  paneEventAt = raw.at
  if (raw.at < (paneStartAt ?? 0) || raw.from === (await $.session.id())) return
  await update($, localPane, () => (raw.view === 'usage' ? 'usage' : null))
}

/**
 * 엔진 판이 MIN_ENGINE 보다 낮으면 그 판(예 "2.1.287") — 바 · 패널 대신 업데이트 안내 한 줄을 그린다. 판을 못 읽으면 null(그대로).
 * Homebrew 의 claude-code 는 늦은 stable 채널이라(2026-10-13 stable = 2.1.287) 설치는 돼도 그리기가 깨질 수 있다
 */
let oldEngine: string | null = null

async function checkEngine($: EngineInterface): Promise<void> {
  try {
    const v = await $.session.version()
    const at = v.base ?? v.version
    oldEngine = engineBelow(at) ? at : null
  } catch {
    oldEngine = null
  }
}

/** 낮은 엔진 판 안내 — Button 없이 글 한 줄(낮은 판은 Button 안 글을 못 그린다) */
function oldEngineNote(ui: Ui, at: string) {
  const { Box, Text } = ui
  return (
    <Box key="old-engine">
      <Text color="yellow">
        {L(
          `이지 컴팩트는 Claude Code ${MIN_ENGINE} 이상이 필요합니다 — 이 세션은 ${at}. 업데이트한 뒤 새 세션을 여세요(앱: Check for Updates · 터미널: claude update).`,
          `Easy Compact needs Claude Code ${MIN_ENGINE} or later — this session runs ${at}. Update, then start a new session (app: Check for Updates · terminal: claude update).`,
        )}
      </Text>
    </Box>
  )
}

/** 자동 열기: 켜져 있고 처음 보는 세션이면 연다(session.start — mod 를 다시 불러와도 오므로 본 세션은 목록으로 거른다) */
async function autoOpenPane($: EngineInterface): Promise<void> {
  if (oldEngine) return
  if (!(await currentSettings($)).paneAutoOpen) return
  const id = await $.session.id()
  const raw = await $.store.get(PANE_AUTO_KEY)
  const seen = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  if (seen.includes(id)) return
  await $.store.set(PANE_AUTO_KEY, [...seen, id].slice(-PANE_AUTO_KEEP))
  await update($, localPane, () => 'usage')
}

/** 이 프로세스에서 처음 맞추는가 — 열린 패널을 이어받는다 */
let isPaneSeeded = false

/** 이 세션의 패널을 이 세션 값에 맞춘다. 타이머가 계속 부른다(같이 여닫기면 다른 세션의 일을 따라) */
async function syncPane($: EngineInterface): Promise<void> {
  if (paneStartAt === null) paneStartAt = await $.clock.now()
  const open = await $.ui.panes()
  const isOpen = open.some(pane => pane.id === PANE)
  // 이 프로세스에서 처음 볼 땐(mod 다시 불러옴 포함) 열린 패널을 그대로 둔다 — 지우지는 않는다(명령으로 막 연 값을 덮지 않게).
  // 새 세션은 열린 패널이 없어 닫힌 채로 시작한다(자동 열기면 그 전에 연다)
  if (!isPaneSeeded) {
    isPaneSeeded = true
    if (isOpen) await update($, localPane, () => 'usage')
  }
  await followPaneEvent($).catch(() => {})
  const want = await wantedView($)
  const have = await read($, paneView)
  if (want === null) {
    if (isOpen) await $.ui.close({ id: PANE })
    if (have !== null) {
      await update($, paneView, () => null)
      // 다시 열면 늘 사용량 탭부터 — 설정 탭을 보다 닫으면 다음에 설정으로 열렸다. 설정은 /easy-compact settings 로.
      // 열려 있던 것이 닫힐 때만(열린 적 없는 패널엔 손대지 않는다). 패널 위 [간략][자세히] 로 잠깐 바꾼 보기도 정보량대로
      await update($, usageTab, () => 'main')
      await update($, paneModeLocal, () => null)
      // 설정 칸 펼침도 처음대로(화면만) — 패널을 연 채 사용량 ↔ 설정을 오갈 땐 그대로 둔다(고치고 보고 다시 고칠 때 편하게)
      await update($, settingsOpen, () => SETTINGS_OPEN_DEFAULT)
      await update($, previewOpen, () => false)
    }
    return
  }
  if (want === have && isOpen) return
  if (want === 'usage') await refreshUsage($, { categories: false, pushHistory: false })
  await update($, paneView, () => want)
  await $.ui.open({ id: PANE, title: paneTitle() })
  // 알려진 문제: 띠 버튼으로 패널을 연 뒤 패널 안 첫 클릭은 먹지 않는다(두 번 눌러야 함). 첫 클릭이 키보드
  // 포커스를 띠에서 패널로 옮기는 데 쓰이는 앱 동작으로 본다 — 연 뒤 다시 그리기로는 안 고쳐졌고, 포커스는 사람만 줄 수
  // 있어(open focus · ui.focus 는 띠가 쥐고 있으면 거부, hover 는 플러그인에 안 온다) mod 쪽에선 못 고친다
}

/** 띠 버튼 · usage 명령: 같은 화면이 열려 있으면 닫고, 아니면 그 화면으로 연다. 바뀐 뒤 화면(null = 닫음)을 돌려준다 */
async function toggleView($: EngineInterface, view: PaneView): Promise<PaneView | null> {
  const next = (await wantedView($)) === view ? null : view
  await setWantedView($, next)
  await syncPane($)
  return next
}

/** 사용량 패널 옵션(설정 탭 · 명령): 새 세션에서 자동으로 열기 · 모든 세션 같이 열고 닫기 */
async function setPaneOption($: EngineInterface, key: 'paneAutoOpen' | 'paneShared', isOn: boolean): Promise<void> {
  await saveSettings($, { ...(await currentSettings($)), [key]: isOn })
  // 같이 여닫기를 켜는 때 남아 있던 일은 따르지 않는다(켠 뒤 사람이 연 · 닫은 것부터)
  if (key === 'paneShared' && isOn) paneEventAt = Math.max(paneEventAt, await $.clock.now())
}

/** 패널 안 탭: 닫지 않고 화면만 바꾼다 */
async function switchView($: EngineInterface, view: PaneView): Promise<void> {
  await setWantedView($, view)
  await syncPane($)
}

// ── 설정: $.store 한 곳, 모든 세션이 타이머로 따라 읽는다 ─────────────────

/** 마지막으로 반영한 설정(JSON). 같으면 다시 그리지 않는다 */
let appliedSettings = ''

/**
 * 0.3.x 까지의 처음 설치 구간. 0.4.0 에서 처음 설치 값을 20만 ~ 25만으로 내렸다(설정 기본값) — 설정은 사람이 무엇이든 한 번
 * 바꿀 때 통째로 저장돼, 한 번도 안 바꾼 사람은 저장값이 없어 업데이트하자마자 말없이 20만 ~ 25만으로 바뀔 뻔했다. 업데이트하는
 * 사람은 쓰던 구간 그대로 — 새 구간은 설정 탭 ★ 추천으로 알린다. 화면도 같은 까닭으로 업데이트면 보던
 * 그대로(자세히 — 칸 다 · 패널 자세히)
 */
const OLD_DEFAULT_RANGE = { rangeStart: 250_000, rangeEnd: 300_000 }

/** 이 PC 에서 이 mod 를 쓴 적이 있나: 이 PC 실측값 · 패널 기록이 저장소에 있거나, 다른 세션의 흐름 파일이 있다 */
async function usedBefore($: EngineInterface): Promise<boolean> {
  // 저장소 키 목록 한 번 — 설정 말고 무엇이든 있으면(이 PC 실측값 · 패널 기록) 쓰던 사람
  try {
    if ((await $.store.keys()).some(k => k !== SETTINGS_KEY)) return true
  } catch {
    // 목록을 못 읽으면 흐름 파일로만 본다
  }
  try {
    const mine = `${await $.session.id()}.json`
    return (await $.fs.list(`${await dataDir($)}/flow`)).some(f => f.kind === 'file' && f.name !== mine)
  } catch {
    return false // 폴더가 없다 — 처음 쓴다
  }
}

/**
 * 저장된 설정이 없을 때 한 번: 구간 · 화면만 적어 둔다(나머지는 계속 기본값을 따른다) — 업데이트면 쓰던 구간, 새 설치면 새 기본
 * (20만 ~ 25만). 화면은 둘 다 간단(정보가 처음부터 많으면 낯설다)
 */
async function seedSettings($: EngineInterface): Promise<Partial<Settings>> {
  const seed: Partial<Settings> = (await usedBefore($))
    ? { ...OLD_DEFAULT_RANGE, screen: UPDATE_SCREEN }
    : { rangeStart: DEFAULT_SETTINGS.rangeStart, rangeEnd: DEFAULT_SETTINGS.rangeEnd, screen: NEW_INSTALL_SCREEN }
  try {
    await $.store.set(SETTINGS_KEY, seed)
  } catch {
    // 못 쓰면 다음 읽기에 다시
  }
  return seed
}

async function loadSettings($: EngineInterface): Promise<void> {
  let raw: unknown
  try {
    raw = await $.store.get(SETTINGS_KEY)
    if (raw === undefined) raw = await seedSettings($)
  } catch {
    raw = undefined // 저장소를 못 읽으면 기본값 — 띠가 사라지면 안 된다
  }
  const next = normalizeSettings(raw)
  const text = JSON.stringify(next)
  if (text === appliedSettings) return
  appliedSettings = text
  await update($, settings, () => next)
  await applyThresholds($)
  $.ui.invalidate('ui.render')
}

// ── 컴팩트 권장 크기: 계산식 최적(hooks/optimal.ts) — 지금 세션의 사실 → 이 PC 의 지난 컴팩트 → 가정 순 ─────────────────

/** /context 분류에서 기본 적재(시스템 지시 · 도구 · 메모리 · 스킬 등) — 대화 · 요약 · 빈칸 · 버퍼는 뺀다. 모르면 null */
function baseOfCategories(categories: Usage['categories']): number | null {
  const sum = categories.filter(c => c.kind === 'used' && !/message|summary|compact/i.test(c.name)).reduce((s, c) => s + c.tokens, 0)
  return sum > 0 ? sum : null
}

/**
 * 계산식 재료를 잰다. 컴팩트 직후 크기 = 이 세션에서 잰 마지막 컴팩트 직후(지금 모델로 센 값), 아직 없으면 기본 적재 + 요약.
 * 기본 적재는 엔진의 /context 분류(세션 시작 때 · 패널을 열 때 잼), 없으면 기록의 첫 요청. 요약 · 출력 · 입력 몫은 이 PC 에서
 * 잰 마지막 컴팩트, 없으면 가정. 요청당 증가는 이 세션 이웃 요청에서(MIN_GROWTH_STEPS 쌍 전엔 가정). 지난 세션들의 기록은 쓰지 않는다
 */
async function measureOptimal($: EngineInterface, model: string): Promise<Optimal> {
  const flow = await readFlow($)
  const first = (await read($, flowNote)) === null ? (flow.points[0] ?? null) : null
  const base = baseOfCategories((await read($, usage))?.categories ?? []) ?? first?.ctx ?? null
  const measured = flow.compactions.filter(c => c.after !== null)
  const last = measured[measured.length - 1] ?? null
  const pcSummary = await storedCount($, SUMMARY_KEY)
  // 잰 요약(c.summary)은 기록 첫 요청이 없어도 쓴다 — 어림(직후 − 첫 요청)만 첫 요청이 필요하다
  const sessionSummary = last ? compactSummary(flow, last, first) : null
  const summary = sessionSummary ?? pcSummary ?? SUMMARY_GUESS
  const summarySrc: Source = sessionSummary !== null ? 'session' : pcSummary !== null ? 'pc' : 'guess'
  let after: number | null = null
  let afterSrc: Source = 'guess'
  if (last && last.after !== null) {
    after = afterInNowTokens(flow, last.after)
    afterSrc = 'session'
  } else if (base !== null) {
    // 기본 적재(이 세션) + 요약 — 요약을 가정했으면 직후 크기도 가정으로 보인다
    after = base + summary
    afterSrc = summarySrc === 'session' ? 'session' : summarySrc
  } else {
    after = await storedCount($, AFTER_KEY)
    afterSrc = 'pc'
  }
  const pcOutput = await storedCount($, OUTPUT_KEY)
  const pcMix = await storedMixOrNull($)
  const pcSave = await storedSaveOrNull($)
  const { g, n } = growthPerStep(flow)
  const growth = n >= MIN_GROWTH_STEPS && g > 0 ? g : GROWTH_GUESS
  const growthSrc: Source = n >= MIN_GROWTH_STEPS && g > 0 ? 'session' : 'guess'
  const inputs: CompactInputs | null =
    after === null
      ? null
      : {
          after,
          summary: Math.min(summary, after),
          output: pcOutput ?? OUTPUT_GUESS,
          mix: pcMix ?? WARM_COMPACT,
          save: pcSave ?? SAVE_GUESS,
          // 저장 턴 · 요약 쓰기는 메인 대화의 유지 시간 요율 — 5분 캐시면 1.25배(1시간은 2배)
          ttl: ttlOf(await read($, usage)),
        }
  const best = inputs && model ? optimalAt(model, inputs, growth) : null
  return {
    model,
    inputs,
    src: { after: afterSrc, summary: summarySrc, output: pcOutput !== null ? 'pc' : 'guess', mix: pcMix ? 'pc' : 'guess', save: pcSave ? 'pc' : 'guess' },
    growth,
    growthN: n,
    growthSrc,
    at: best?.at ?? null,
    onceUsd: inputs && model ? onceUsd(model, inputs) : null,
    capped: best?.capped ?? null,
    shared: sharedFor(flow, model),
    perQuestion: await perQuestionOf($, flow, model),
  }
}

/** 질문 하나를 끝내는 데 쓰는 최근 질문 수 · 그만큼 모여야 질문 꼴을 낸다(9b) */
const PER_Q_WINDOW = 10
const PER_Q_MIN = 3

/**
 * 질문 하나의 꼴(9b): 이 세션 최근 질문(요청이 있던 것)의 평균 요청 수와 요청마다 읽기 말고 드는 값. 질문이 PER_Q_MIN 개 안 됐거나
 * 그 모델 요청이 모자라면 null — 설정 표 "질문 1개" 칸을 숨긴다(가정 수를 지어내지 않는다 — 기준은 공식 · 이 세션 사실로)
 */
async function perQuestionOf($: EngineInterface, flow: Flow, model: string): Promise<{ steps: number; extraUsd: number; agentUsd: number } | null> {
  const recent = (await read($, turnSummaries)).slice(-PER_Q_WINDOW).filter(t => t.steps > 0)
  const extraUsd = extraPerCall(flow, model)
  if (recent.length < PER_Q_MIN || extraUsd === null) return null
  const avg = (pick: (t: TurnSummary) => number) => recent.reduce((s, t) => s + pick(t), 0) / recent.length
  // 질문마다 띄운 에이전트 값도 평균으로 — 메인 요청만 세면 에이전트를 많이 쓰는 세션의 질문 값이 몇 분의 일로 보였다(리뷰)
  return { steps: avg(t => t.steps), extraUsd, agentUsd: avg(t => agentSum(t.details)?.usd ?? 0) }
}

/**
 * 지금 기준을 정해 건다: 구간 방식이면 구간(노랑 = 시작, 빨강 = 끝; 못 내면 설정 값), 직접 지정이면 그 크기(노랑 = 그
 * WARN_RATIO). 설정이 바뀔 때 · 메인 요청마다 · 사용량을 다시 잴 때 부른다. 구간은 컴팩트 사이엔 그대로(keepOptimal) —
 * 모델을 바꾸거나 컴팩트하면 다시 정한다
 */
async function applyThresholds($: EngineInterface): Promise<void> {
  const s = await currentSettings($)
  const u = await read($, usage)
  const model = u?.model ?? (await read($, flowPoints)).at(-1)?.model ?? ''
  const fresh = await measureOptimal($, model)
  // 최적 크기는 구간 동안 그대로(keepOptimal), 공통 앞부분 · 질문 꼴은 늘 새 값 — 설정 표 "캐시 식으면" · "질문 1개" 가 쓴다
  const opt = { ...keepOptimal(await read($, optimal), fresh), shared: fresh.shared, perQuestion: fresh.perQuestion }
  await update($, optimal, () => opt)
  setThresholds(thresholdsOf(s, model))
}

/** 고르는 중인 컴팩트 시점을 저장하고 고르기를 끝낸다 — 입력칸에 치고 Enter 를 안 눌렀어도 친 크기로 */
async function applyCmpDraft($: EngineInterface): Promise<void> {
  const d = await read($, cmpDraft)
  if (d) {
    const s = await currentSettings($)
    await saveSettings($, { ...s, follow: d.follow, rangeStart: d.rangeStart, rangeEnd: d.rangeEnd, compactAt: draftCompactAt(s, d) })
  }
  await update($, cmpDraft, () => null)
}

/**
 * 사용량 패널 보기(간략 · 자세히) — 패널 위 버튼 · 명령은 잠깐 바꿔 보기(저장 안 함). 기본은 화면의 정보량(최소 = 간략 · 전부 =
 * 자세히). 패널을 닫거나 설정 탭에 다녀오면 정보량대로 돌아간다 — 한 번 본 것이라
 */
async function setPaneMode($: EngineInterface, mode: PaneMode): Promise<void> {
  await update($, paneModeLocal, () => mode)
  $.ui.invalidate('ui.render')
}

/** 이 세션 패널 보기 — 패널 탭으로 바꿨으면 그 값, 아니면 화면 값 */
async function paneModeNow($: EngineInterface): Promise<PaneMode> {
  return (await read($, paneModeLocal)) ?? paneModeOf(viewOf(await currentSettings($)))
}

async function saveSettings($: EngineInterface, next: Settings): Promise<void> {
  await $.store.set(SETTINGS_KEY, next)
  await loadSettings($)
}

async function currentSettings($: EngineInterface): Promise<Settings> {
  return (await read($, settings)) ?? DEFAULT_SETTINGS
}

/**
 * 고른 모델을 따라간다 — 모델 피커는 알려 주는 이벤트가 없어 1.5초마다 엔진에 묻는다(값만 읽는다).
 * 마지막 요청과 다른 모델이면 switchedFrom: 새 모델엔 이 대화 캐시가 없어 다음 요청이 전체를 다시 쓴다(식은 캐시와 같다).
 * 요청당 값 · 다음 요청 값도 새 모델 요율로 바로 바뀐다. 노력도는 쉬는 동안 읽을 길이 없다(요청이 시작될 때만 엔진이 알려 준다).
 * 모델이 바뀌면 기준(최적 · 구간 · 요청 1회 · 컴팩트 한 번 값)도 바로 다시 정한다 — 예전엔 다음 메인 요청 때까지 설정 탭 비용표 ·
 * 카드가 옛 모델 요율이었다(동료)
 */
async function followModel($: EngineInterface): Promise<void> {
  const u = await read($, usage)
  if (!u) return
  const model = await $.session.model()
  if (!model) return
  const sums = await read($, turnSummaries)
  const used = (await read($, live))?.model ?? sums[sums.length - 1]?.model ?? null
  const switchedFrom = used !== null && modelKey(used) !== modelKey(model) ? used : null
  if (model === u.model && (u.switchedFrom ?? null) === switchedFrom) return
  const sharedTokens = sharedFor({ shared: await read($, flowShared) }, model)
  await update($, usage, prev => (prev ? { ...prev, model, switchedFrom, sharedTokens } : prev))
  if (model !== u.model) await applyThresholds($)
  // 확인창을 스스로 열지는 않는다 — 모델을 바꾸면 앱이 이미 경고 팝업을 띄워 겹쳤다. 띠 버튼만 "🔄 모델 바뀜 · 바로 컴팩트 권장"
  $.ui.invalidate('ui.render')
}

// ── 요청 · 턴 비용 ─────────────────────────────────────────────────

/** 컴팩트가 끝났다 — 다음 메인 요청의 입력 토큰이 컴팩트 뒤 실제 컨텍스트다 */
let measureAfterCompact = false

/**
 * 메인 요청 하나가 끝났다: 진행 중 질문에 더하고 흐름 그래프에 점 하나. model = 이 요청에 실제로 답한 모델,
 * effort = 이 요청의 노력도(질문별 비용에 "Opus 5.5 · high" 로 — 모델 · 노력도별 값을 나중에 비교한다)
 */
async function recordStep(
  $: EngineInterface,
  turnId: string,
  cost: CostParts,
  tokens: Tokens,
  label: string,
  model: string,
  effort: string | number | undefined,
  switchedFrom: string | null,
): Promise<void> {
  trackedUsd += cost.usd
  const contextTokens = tokens.input_tokens + tokens.cache_read_input_tokens + tokens.cache_creation_input_tokens
  // 컨텍스트 흐름 그래프에 점 하나 — 잇기 전 마지막 점이 이 요청이 읽을 수 있던 캐시(다시 쓴 값의 기준)
  const flow = await readFlow($)
  // 다시 쓴 값 · 점의 유지 시간은 기록에서 잰 세션 유지 시간(엔진이 주는 요청 값엔 종류가 없다) — 못 쟀으면 점엔 안 적는다
  const ttl = await read($, ttlMeasured)
  const rewrite = rewriteOf(tokens, model, lastCtxOf(flow), ttl ?? ttlOf(await read($, usage)))
  // 기록을 다 읽은 흐름일 때만 공통 앞부분을 잰다(못 읽었거나 읽는 중이면 다시 연 세션의 첫 요청이 세션 첫 요청처럼 보인다)
  const isWhole = (await read($, flowLoaded)) && (await read($, flowNote)) === null
  await writeFlow($, withPoint(flow, { atMs: await $.clock.now(), ctx: contextTokens, usd: cost.usd, model, ...(ttl !== null ? { ttl } : {}) }, tokens, isWhole))
  await update($, live, prev => {
    const base: LiveTurn =
      prev && prev.turnId === turnId
        ? prev
        : { turnId, steps: 0, cost: ZERO_COST, prompt: '', contextTokens: 0, outputTokens: 0, details: [] }
    return {
      ...base,
      steps: base.steps + 1,
      cost: addCost(base.cost, cost),
      contextTokens,
      outputTokens: base.outputTokens + tokens.output_tokens,
      details: [...base.details, { label, usd: cost.usd, write: cost.write, ...(rewrite > 0 ? { rewrite } : {}) }].slice(-60),
      ...(rewrite > 0 ? { rewriteUsd: (base.rewriteUsd ?? 0) + rewrite } : {}),
      model,
      ...(effort === undefined ? {} : { effort: String(effort) }),
      // 모델을 바꾼 뒤 이 질문의 첫 요청이었다 — 질문별 비용에 "모델 바뀜" 으로 남긴다
      ...(switchedFrom && !base.switchedFrom ? { switchedFrom } : {}),
    }
  })
  // 데스크톱 패널은 상태 쓰기만으론 안 다시 그려질 때가 있다 — 질문별 비용의 진행 중 줄이 요청마다 늘게
  $.ui.invalidate('ui.render')
}

/** 띄운 하위 에이전트: 작업 이름과 띄운 질문(메인 턴). mod 를 다시 불러오면 비지만, 그땐 지금 질문에 더한다 */
const agentInfo = new Map<string, { label: string; turnId: string | null }>()

/**
 * 동작 목록에 에이전트 몫 더하기 — 에이전트마다 한 줄, 요청이 끝날 때마다 값 · 요청 수가 는다. 읽기 · 쓰기 · 출력 · 입력도
 * 따로 모은다(질문별 비용의 메인 / 🤖 분해). 이름은 더 나은 것이 오면 바꾼다(처음엔 "하위 에이전트" 였다가 목록에서 찾음)
 */
function withAgentStep(details: readonly StepDetail[], agentId: string, label: string, cost: CostParts, model: string, atMs: number): StepDetail[] {
  const i = details.findIndex(d => d.agent === agentId)
  if (i < 0) return [...details, { label, usd: cost.usd, write: cost.write, read: cost.read, output: cost.output, input: cost.input, agent: agentId, steps: 1, model, done: false, at: atMs }]
  const d = details[i]!
  const next = {
    ...d,
    label,
    usd: d.usd + cost.usd,
    write: (d.write ?? 0) + cost.write,
    read: (d.read ?? 0) + cost.read,
    output: (d.output ?? 0) + cost.output,
    input: (d.input ?? 0) + cost.input,
    steps: (d.steps ?? 0) + 1,
    model,
    at: atMs,
  }
  return [...details.slice(0, i), next, ...details.slice(i + 1)]
}

/** 에이전트 줄에 "끝남" 을 적는다(진행 중 질문 · 끝난 질문 어디에 있든). 바뀐 게 없으면 false */
async function markAgentsDone($: EngineInterface, isDone: (agentId: string) => boolean): Promise<boolean> {
  let changed = false
  const mark = (details: readonly StepDetail[] | undefined) =>
    (details ?? []).map(d => {
      if (!d.agent || d.done !== false || !isDone(d.agent)) return d
      changed = true
      return { ...d, done: true }
    })
  await update($, live, prev => (prev ? { ...prev, details: mark(prev.details) } : prev))
  await update($, turnSummaries, list => list.map(s => (s.details?.some(d => d.agent && d.done === false) ? { ...s, details: mark(s.details) } : s)))
  if (changed) $.ui.invalidate('ui.render')
  return changed
}

/** 엔진 목록에서 한 번이라도 본 에이전트 — 목록에 없는 갈래(워크플로우 · 엔진 자체)를 "끝남" 으로 잘못 치지 않게 */
const listedAgents = new Set<string>()

/**
 * 목록에 한 번도 없던 갈래(워크플로우 에이전트 · 엔진 자체 갈래 — 엔진 문서: 목록에 없다)는 turn.complete 가 안 오면 끝남을 알
 * 길이 없다 — 마지막 요청 뒤 이만큼 조용하면 끝남으로 친다. 안 그러면 "도는 중" 이 세션 끝까지 남고 목록을 1.5초마다 물었다(리뷰)
 */
const AGENT_QUIET_MS = 2 * 60_000

/**
 * 아직 "도는 중" 인 에이전트가 있으면 엔진 목록과 맞춘다 — 끝난 걸 못 들은 때(mod 를 다시 불러옴 등) "도는 중" 이 남지 않게.
 * 끝남 = 목록에서 도는 상태가 아니거나, 목록에 있다가 빠짐. 목록에 한 번도 없던 갈래는 그 turn.complete 만 믿는다
 */
async function reconcileAgents($: EngineInterface): Promise<void> {
  const open = new Set<string>()
  for (const d of [...((await read($, live))?.details ?? []), ...(await read($, turnSummaries)).flatMap(s => s.details ?? [])]) {
    if (d.agent && d.done === false) open.add(d.agent)
  }
  if (open.size === 0) return
  const listed = new Map((await $.agent.list()).map(a => [a.id, a.status] as const))
  for (const id of listed.keys()) listedAgents.add(id)
  // idle = 메시지를 기다리는 팀원(살아 있다) — 끝남이 아니다
  const isRunning = (status: string) => status === 'pending' || status === 'running' || status === 'waiting' || status === 'idle'
  const nowMs = await $.clock.now()
  const lastAt = new Map<string, number>()
  for (const d of [...((await read($, live))?.details ?? []), ...(await read($, turnSummaries)).flatMap(s => s.details ?? [])]) {
    if (d.agent && d.at !== undefined) lastAt.set(d.agent, Math.max(lastAt.get(d.agent) ?? 0, d.at))
  }
  await markAgentsDone($, id => {
    if (!open.has(id)) return false
    const status = listed.get(id)
    if (status !== undefined) return !isRunning(status)
    if (listedAgents.has(id)) return true
    const at = lastAt.get(id)
    return at !== undefined && nowMs - at > AGENT_QUIET_MS
  })
}

/**
 * 에이전트 이름: 띄울 때 적어 둔 작업 이름, 없으면(mod 를 다시 불러옴 · 띄운 때를 못 봄) 엔진 목록의 설명. 목록에도 없으면
 * "하위 에이전트" — 엔진 자체 갈래(메모리 정리 등)는 목록에 없다(엔진 문서). 예전엔 첫 경우만 봐 앱에 "Implement viewer card UI"
 * 로 보이는 에이전트가 "하위 에이전트" 로 나왔다(동료)
 */
async function agentLabel($: EngineInterface, agentId: string): Promise<string> {
  const known = agentInfo.get(agentId)?.label
  if (known) return known
  let label = L('하위 에이전트', 'subagent')
  try {
    const found = (await $.agent.list()).find(a => a.id === agentId)
    if (found) label = found.description || found.type
  } catch {
    // 목록을 못 읽으면 이름 없이
  }
  // 못 찾았어도 적어 둔다 — 목록에 없는 갈래(엔진 자체 · 워크플로우)는 요청마다 목록을 다시 물었다(리뷰)
  agentInfo.set(agentId, { label, turnId: null })
  return label
}

/**
 * 하위 에이전트 요청 하나: 띄운 질문의 값에 더한다(작업 중에도 바로 — 전엔 메인 요청만 세어 에이전트 값이 안 보였다).
 * 컨텍스트 · 흐름 그래프엔 넣지 않는다(에이전트 대화는 따로라 메인 컨텍스트와 무관). 질문이 끝난 뒤에도 도는
 * 백그라운드 에이전트면 끝난 그 질문의 요약에 더한다
 */
async function recordAgentStep($: EngineInterface, agentId: string, cost: CostParts, model: string): Promise<void> {
  trackedUsd += cost.usd
  const label = await agentLabel($, agentId)
  const atMs = await $.clock.now()
  const info = agentInfo.get(agentId)
  const now = await read($, live)
  if (now && (!info?.turnId || info.turnId === now.turnId)) {
    await update($, live, prev =>
      prev ? { ...prev, cost: addCost(prev.cost, cost), details: withAgentStep(prev.details, agentId, label, cost, model, atMs) } : prev,
    )
  } else {
    await update($, turnSummaries, list => {
      let i = list.length - 1
      if (info?.turnId) {
        const found = list.findLastIndex(s => s.turnId === info.turnId)
        if (found >= 0) i = found
      }
      const s = list[i]
      if (!s) return list
      const next = { ...s, cost: addCost(s.cost, cost), details: withAgentStep(s.details ?? [], agentId, label, cost, model, atMs) }
      return [...list.slice(0, i), next, ...list.slice(i + 1)]
    })
  }
  $.ui.invalidate('ui.render')
}

// ── 앱 자체 요청 · 컴팩트: 질문별 비용에 따로 한 줄 ─────────────────────────

/**
 * 앱 자체 요청 재기. 엔진 집계(세션 비용)는 모든 API 응답의 합인데, 그중 대화 기록에 없는 요청(답 뒤 다음 질문 제안 ·
 * 메모리 정리, 컴팩트 미리 계산)은 요청 훅에 안 보인다. 답이 끝난 때를 기준으로 두고 다음 질문이 시작될 때(그 전에도 몇 번)
 * 집계가 는 만큼에서 우리가 본 요청(백그라운드 하위 에이전트 · 컴팩트)을 빼면 그 몫이다 — 그 구간엔 메인 요청이 없어 요율
 * 차이가 끼지 않는다. 예전엔 턴마다 "엔진 집계 − 우리 합" 을 답 아래 "이 세션에 안 보이는 요청" 으로만 붙여 하위 에이전트인지
 * 무엇인지 몰랐다. trackedUsd = 우리가 요청마다 잰 값의 합
 */
let trackedUsd = 0

let idleMark: { ledger: number; tracked: number } | null = null

/** 기준을 둔 뒤 엔진이 다음 질문 제안을 띄웠다(prompt.suggest) — 그러면 그 이름을 붙인다 */
let suggestedSinceMark = false

/** 답이 끝난 뒤 다시 재는 때(ms) — 다음 질문 제안 · 메모리 정리는 답 뒤 몇 초 안에 돈다 */
const APP_CHECK_MS = [30_000, 120_000]

async function ledgerUsd($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

/** 답이 끝났다: 지금 집계를 기준으로 두고 조금 뒤 다시 잰다 */
async function markIdle($: EngineInterface): Promise<void> {
  const ledger = await ledgerUsd($)
  idleMark = ledger === null ? null : { ledger, tracked: trackedUsd }
  suggestedSinceMark = false
  if (!idleMark) return
  for (const ms of APP_CHECK_MS) {
    try {
      $.clock.after(ms, () => void settleAppRequests($))
    } catch {
      // 타이머가 없는 곳(테스트)에선 다음 질문이 시작될 때 잰다
    }
  }
}

/** 기준 뒤 는 집계 − 우리가 본 값 = 앱 자체 요청. 끝난 질문(마지막 요약)에 한 줄로 */
async function settleAppRequests($: EngineInterface): Promise<void> {
  const mark = idleMark
  if (!mark) return
  const ledger = await ledgerUsd($)
  // 그 사이 다른 확인이 먼저 셌다
  if (ledger === null || idleMark !== mark) return
  const extra = ledger - mark.ledger - (trackedUsd - mark.tracked)
  if (extra > 0 && extra < APP_MIN_USD) return
  idleMark = { ledger, tracked: trackedUsd }
  if (extra <= 0) return
  const label = suggestedSinceMark
    ? L('답 뒤 · 다음 질문 제안', 'after the answer · next-prompt suggestion')
    : L('답 뒤 · 다음 질문 제안 · 메모리 정리 등', 'after the answer · next-prompt suggestion · memory upkeep, etc.')
  suggestedSinceMark = false
  await addAppCost($, extra, label)
}

/** 앱 자체 요청 줄(이름마다 한 줄, 같은 이름이면 더한다) */
function withAppStep(details: readonly StepDetail[], label: string, usd: number): StepDetail[] {
  const i = details.findIndex(d => d.app && d.label === label)
  if (i < 0) return [...details, { label, usd, app: true }]
  return details.map((d, j) => (j === i ? { ...d, usd: d.usd + usd } : d))
}

/**
 * 앱 자체 요청 값을 질문에 더한다: 도는 질문이 있으면 그 질문에, 없으면 끝난 마지막 질문에. 읽기 · 쓰기 · 출력으로 못 나눠
 * cost.usd 와 appUsd 에만
 */
async function addAppCost($: EngineInterface, usd: number, label: string): Promise<void> {
  const add = <T extends { cost: CostParts; appUsd?: number }>(t: T, details: readonly StepDetail[]) => ({
    ...t,
    cost: { ...t.cost, usd: t.cost.usd + usd },
    appUsd: (t.appUsd ?? 0) + usd,
    details: withAppStep(details, label, usd),
  })
  if (await read($, live)) await update($, live, prev => (prev ? add(prev, prev.details) : prev))
  else {
    await update($, turnSummaries, list => {
      const s = list[list.length - 1]
      return s ? [...list.slice(0, -1), add(s, s.details ?? [])] : list
    })
  }
  $.ui.invalidate('ui.render')
}

/**
 * 컴팩트 한 번을 질문에 한 줄로 — 질문별 비용에서도 "얼마 들여 얼마로 줄었나" 가 보이게. 답 뒤 컴팩트면
 * 끝난 마지막 질문(저장하고 컴팩트면 그 저장 턴), 질문 도중 자동 컴팩트면 그 질문. 값은 질문 합에 더한다(읽기 · 쓰기 · 출력으로
 * 나뉜 값이라 내역도 맞는다)
 */
async function addCompactStep($: EngineInterface, parts: CostParts | null, before: number): Promise<void> {
  const add = <T extends { cost: CostParts }>(t: T, details: readonly StepDetail[]) => ({
    ...t,
    cost: parts ? addCost(t.cost, parts) : t.cost,
    details: [...details, { label: L('컴팩트', 'Compact'), usd: parts?.usd ?? 0, compact: { before, after: null } }],
  })
  if (await read($, live)) await update($, live, prev => (prev ? add(prev, prev.details) : prev))
  else {
    await update($, turnSummaries, list => {
      const s = list[list.length - 1]
      return s ? [...list.slice(0, -1), add(s, s.details ?? [])] : list
    })
  }
  $.ui.invalidate('ui.render')
}

/** 컴팩트 뒤 첫 메인 요청이 잰 직후 크기를 아직 비어 있는 컴팩트 줄에(진행 중 질문 · 끝난 질문) */
async function fillCompactAfter($: EngineInterface, after: number): Promise<void> {
  const fill = (details: readonly StepDetail[]) =>
    details.map(d => (d.compact?.after === null ? { ...d, compact: { ...d.compact, after } } : d))
  const isEmpty = (details: readonly StepDetail[] | undefined) => (details ?? []).some(d => d.compact?.after === null)
  await update($, live, prev => (prev && isEmpty(prev.details) ? { ...prev, details: fill(prev.details) } : prev))
  await update($, turnSummaries, list => {
    const i = list.findLastIndex(s => isEmpty(s.details))
    if (i < 0) return list
    const s = list[i]!
    return [...list.slice(0, i), { ...s, details: fill(s.details ?? []) }, ...list.slice(i + 1)]
  })
}

async function closeTurn($: EngineInterface, text: string): Promise<void> {
  const now = await read($, live)
  await update($, live, () => null)
  if (!now || now.steps === 0) return
  const measured = await read($, usage)
  const summary: TurnSummary = {
    tail: tailOf(text),
    steps: now.steps,
    cost: now.cost,
    ...(now.appUsd ? { appUsd: now.appUsd } : {}),
    ...(now.rewriteUsd ? { rewriteUsd: now.rewriteUsd } : {}),
    prompt: now.prompt,
    atMs: await $.clock.now(),
    contextTokens: measured?.contextTokens ?? (now.contextTokens || null),
    details: now.details,
    ...(now.model ? { model: now.model } : {}),
    ...(now.effort ? { effort: now.effort } : {}),
    ...(now.switchedFrom ? { switchedFrom: now.switchedFrom } : {}),
    turnId: now.turnId,
  }
  await update($, turnSummaries, list => [...list, summary].slice(-60))
}

async function startCompacting($: EngineInterface, kind: string): Promise<void> {
  await update($, compactKind, () => kind)
  await update($, compactPhase, () => 'compacting')
}

/**
 * /compact 명령을 사용자가 친 것처럼 돌린다. 데스크톱(SDK) 세션은 $.session.compact 를,
 * prompt.submit 은 / 로 시작하는 글을 막는다 — 엔진이 안내한 길이 $.command.run 이다.
 */
async function compactNow($: EngineInterface, args = ''): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await startCompacting($, args === compactKeep() ? kindTidy() : kindDirect())
  try {
    await $.command.run(args ? { command: 'compact', args } : { command: 'compact' })
  } catch (err) {
    $.ui.toast(L(`컴팩트 실패: ${String(err)}`, `Compact failed: ${String(err)}`))
  } finally {
    await update($, compactPhase, () => 'idle')
  }
}

/** "정리 후 컴팩트": 정리 프롬프트를 보내고, 그 턴이 [컴팩트 진행] 으로 끝나면 turn.complete 에서 /compact 를 돌린다 */
async function tidyThenCompact($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await update($, compactPhase, () => 'tidying')
  try {
    await $.prompt.submit({ text: tidyPrompt(tidyBody(await currentSettings($))) })
  } catch (err) {
    await update($, compactPhase, () => 'idle')
    $.ui.toast(L(`저장 요청 실패: ${String(err)}`, `Save request failed: ${String(err)}`))
  }
}

// ── 그리기 ───────────────────────────────────────────────────────

/** 펼친 질문을 바꾸고 다시 그리게 한다 — 데스크톱 패널은 상태 쓰기만으론 안 다시 그려졌다 */
async function toggleExpanded($: EngineInterface, id: number): Promise<void> {
  await update($, expandedTurn, now => (now === id ? null : id))
  $.ui.invalidate('ui.render')
}

/**
 * 답변 아래 칩의 첫 줄 — 답변 아래와 설정 화면 칸 미리보기가 같이 쓴다. 한 줄 전부 파랑(금액만 굵게) — 흐린 회색 글은 답변 글
 * 사이에서 안 보였다. "캐시 다시 씀" 경고만 노랑 그대로(드문 비용 경고라 파랑에 묻히면 안 된다).
 * 요청 수는 에이전트 요청까지, 에이전트는 정보량 최소면 개수만 · 전부면 "$ 포함" — 패널 질문별 비용과 같은 꼴(예전엔 따로 옵션).
 * 이 질문 값에 든 컴팩트 · 앱 자체 요청은 이름으로 — 예전 "엔진 집계 − 우리 합" 은 무엇인지 몰랐다. 첫 줄엔 터미널 · 정보량
 * 전부일 때만: 데스크톱 전부는 펼친 상세의 ⚙ · 🗜 줄에 있고(첫 줄이 길어 "포함" 만 다음 줄로 꺾였다), 최소는 합만
 */
function answerLine(ui: Ui, summary: TurnSummary, isFull: boolean, surface: string) {
  const { Text } = ui
  const compactUsd = (summary.details ?? []).reduce((sum, d) => sum + (d.compact ? d.usd : 0), 0)
  const parts = [
    compactUsd >= APP_MIN_USD ? L(`컴팩트 ${fmtUsd(compactUsd)}`, `compact ${fmtUsd(compactUsd)}`) : '',
    (summary.appUsd ?? 0) >= APP_MIN_USD ? L(`앱 자체 요청 ${fmtUsd(summary.appUsd!)}`, `app's own requests ${fmtUsd(summary.appUsd!)}`) : '',
  ].filter(Boolean)
  const extra = parts.length > 0 && isFull && surface === 'terminal' ? L(` · ${parts.join(' · ')} 포함`, ` · incl. ${parts.join(' · ')}`) : ''
  const calls = callsOf(summary.steps, summary.details)
  const agentLine = agentPart(summary.details, isFull)
  const icon = iconOf('🧾')
  return (
    <Text color={BRAND_HEX}>
      {icon ? `${icon} ` : ''}
      {L('이 질문 ', 'This question ')}
      <Text bold>
        {fmtUsd(summary.cost.usd)}
      </Text>
      {L(` · 요청 ${calls}회`, ` · ${plural(calls, 'request')}`)}
      {/* 에이전트 — 답이 끝난 뒤에도 도는 백그라운드 에이전트면 끝날 때까지 "도는 중" */}
      {agentLine ? ` · ${agentLine}` : ''}
      {rewriteNote(ui, summary.rewriteUsd)}
      {extra}
    </Text>
  )
}

/**
 * 질문 비용 칩을 펼친 상세 — 답변 끝 칩과 설정 미리보기가 같이 쓴다. 맨 위 " - " 줄들의 합 = 질문 값(메인 · 🤖 · 🗜 · ⚙), 메인
 * 아래 더 들인 줄은 메인 금액을 동작마다 나눈 것 — 다 같은 깊이에 두니 동작 줄까지 더하는 항목으로 읽혔다. 요청 많은 질문은 비싼 동작 ANSWER_STEPS 개만(순서 그대로), 나머지는 한 줄
 */
function answerDetail(ui: Ui, summary: TurnSummary) {
  const { Box, Text } = ui
  const bd = answerBreakdown(summary.cost, summary.appUsd, summary.details, summary.steps)
  const { shown, rest, restUsd } = topSteps(bd.mainSteps, ANSWER_STEPS)
  const SUB = '     '
  return (
    <Box key="q-detail" flexDirection="column">
      <Text key="qb-main" dimColor wrap="wrap">
        {` - ${bd.main}`}
      </Text>
      {shown.map((d, j) => {
        const { text, note } = stepText(d)
        const head = `${SUB}${fmtUsd(d.usd)}  ${fitCells(text, ANSWER_COLS)}`
        // 경고가 없으면 글 하나로(조각이 섞이면 글로 찾기 · 자르기가 흐려진다)
        return (
          <Text key={`qd-${j}`} dimColor wrap="truncate-end">
            {note ? [head, <Text key="n" color="yellow">{note}</Text>] : head}
          </Text>
        )
      })}
      {rest > 0 ? (
        <Text key="qd-rest" dimColor>
          {L(`${SUB}그 밖 ${rest}개 ${fmtUsd(restUsd)} — 더 보려면 사용량 패널`, `${SUB}${plural(rest, 'more step')} ${fmtUsd(restUsd)} — more in the Usage pane`)}
        </Text>
      ) : null}
      {bd.others.map((text, k) => (
        <Text key={`qb-${k}`} dimColor wrap="wrap">
          {` - ${text}`}
        </Text>
      ))}
    </Box>
  )
}

/**
 * 설정 화면 칸 미리보기의 "질문 비용 — 답변 끝" 견본 — 이 세션 마지막 질문을 칩 그대로. 처음엔 접힘, 정보량 전부면 [▸ 자세히] 를 눌러 견본 안에서 펼쳐 본다. 펼침은 이 세션만(previewOpen) — 패널을 닫으면 접힌다
 */
function answerPreview($: EngineInterface, ui: Ui, summary: TurnSummary, isSample: boolean, isFull: boolean, surface: string, isOpen: boolean, isHover: boolean) {
  const { Box, Button, Text } = ui
  const line = answerLine(ui, summary, isFull, surface)
  const canFold = isFull && surface !== 'terminal'
  // 질문 강조가 켜져 있으면 견본 칩도 마우스를 올리면 회색. 지난 질문 값으로 그린
  // 견본은 그 질문과 한 묶음 — 올리면 채팅창의 그 답변 · 칩 · 패널 줄도 함께. 예시 값은 묶을 답변이 없어 견본만
  const hover = isHover && surface !== 'terminal' ? { hover: { ...(isSample ? {} : { scope: questionScope(summary.atMs) }), backgroundColor: 'promptBorder' } } : {}
  return (
    <Box key="pv-answer" flexDirection="column" marginTop={1}>
      {/* 제목(무엇 — 어디)과 흐린 풀이 한 줄 — "답변 아래(마지막 질문)" 은 무엇인지 · 언제 붙는지 안 읽혔다.
          칩은 질문마다 붙고, 견본만 지난 질문 값(없으면 예시 값)으로 그린다 */}
      <Text>{L('질문 비용 — 세션 채팅창, Claude 답변 끝', 'Question cost — end of each Claude answer in the chat')}</Text>
      <Text dimColor wrap="wrap">
        {L(
          '이 세션 채팅창에서 Claude 의 답변이 끝날 때마다 그 답변 바로 아래에 붙습니다. 보낸 질문 하나에 든 금액과 요청 수입니다. ',
          "Each time Claude finishes an answer in this session's chat, this appears right below it: what that question (one message you sent) cost and how many requests it took. ",
        )}
        {isSample
          ? L('아래 견본은 예시 값입니다 — 첫 답변이 끝나면 이 세션 값으로 바뀝니다.', 'The sample below uses example values until the first answer ends.')
          : L('아래 견본은 이 세션 지난 질문의 값으로 그렸습니다.', "The sample below uses this session's last question.")}
        {isHover && surface !== 'terminal'
          ? L(' 칩에 마우스를 올리면 그 답변이 회색으로 강조됩니다(질문 강조).', ' Hover the chip and its answer turns gray (Highlight).')
          : ''}
      </Text>
      {surface === 'terminal' ? (
        line
      ) : (
        <Box key="pv-chip" alignSelf="flex-start" flexDirection="column" borderStyle="round" borderColor={BRAND_HEX} paddingX={1} {...hover}>
          <Box key="pv-head" columnGap={2} alignItems="center">
            {line}
            {canFold ? (
              <Box key="pv-fold-box" flexShrink={0}>
                <Button key="pv-fold" plain onPress={() => void togglePreview($)}>
                  <Text color={BRAND_HEX} dimColor>
                    {isOpen ? L('▾ 접기', '▾ Hide') : L('▸ 자세히', '▸ Details')}
                  </Text>
                </Button>
              </Box>
            ) : null}
          </Box>
          {canFold && isOpen ? answerDetail(ui, summary) : null}
        </Box>
      )}
    </Box>
  )
}

/**
 * 설정 미리보기의 예시 값 — 아직 잰 값 · 끝난 질문이 없을 때(새 세션). 빈 자리만 그리니 무엇이 어떻게 보일지 몰랐다. 진짜 바 · 칩 그리기에 넣어 고른 화면 · 칸 · 정보량이 그대로 반영된다. 화면에 "예시 값" 이라 적는다
 */
function sampleUsage(nowMs: number, model: string): Usage {
  return {
    model,
    contextTokens: 120_000,
    window: 1_000_000,
    percent: 12,
    costUsd: 3.4,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 30, resetsAt: new Date(nowMs + 3 * 3_600_000).toISOString() },
      { kind: 'seven_day', percentUsed: 20, resetsAt: new Date(nowMs + 4 * 86_400_000).toISOString() },
    ],
    categories: [],
    lastActivityMs: nowMs - 5 * 60_000,
    history: [100_000, 120_000],
    cacheTtlMin: 60,
    cacheTtlMeasured: true,
  }
}

function sampleTurn(nowMs: number, model: string): TurnSummary {
  const details = [
    { label: 'Read band.test.tsx', usd: 0.06 },
    { label: 'Edit register.tsx', usd: 0.14 },
    { label: L('Bash 시험 돌리기', 'Bash run tests'), usd: 0.09 },
    { label: L('답변 작성', 'Writing the answer'), usd: 0.07 },
  ]
  return { tail: '', steps: 4, cost: { usd: 0.36, read: 0.12, write: 0.1, output: 0.14, input: 0 }, prompt: '', atMs: nowMs, contextTokens: 120_000, details, model }
}

/**
 * 진단 덤프 — 이 세션의 패널 상태 · 질문 기록 · 사용량을 데이터 폴더 debug-<세션>.json 으로(이미 있는 폴더 — 하위 폴더는 안 만든다). 짝 없는 서로게이트 · 제어 문자 수도
 * 함께 센다(데스크톱이 그리기를 통째로 거부하는 글 후보). 답은 파일 경로 한 줄
 */
async function dumpState($: EngineInterface): Promise<string> {
  const state = {
    at: new Date(await $.clock.now()).toISOString(),
    settings: await currentSettings($),
    usageTab: await read($, usageTab),
    paneModeLocal: await read($, paneModeLocal),
    localPane: await read($, localPane),
    expandedTurn: await read($, expandedTurn),
    historyAll: await read($, historyAll),
    effectsAll: await read($, effectsAll),
    flowAll: await read($, flowAll),
    settingsOpen: await read($, settingsOpen),
    previewOpen: await read($, previewOpen),
    answerOpen: await read($, answerOpen),
    usage: await read($, usage),
    live: await read($, live),
    turnSummaries: await read($, turnSummaries),
  }
  const text = JSON.stringify(state, null, 2)
  const lone = (text.match(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g) ?? []).length
  const ctrl = (text.match(/\\u00[01][0-9a-f]/gi) ?? []).length
  const path = `${await dataDir($)}/debug-${await $.session.id()}.json`
  await $.fs.write(path, `${text}\n`)
  return `easy-compact dump: ${path} (${text.length} chars, lone surrogates ${lone}, control chars ${ctrl})`
}

/** 설정 미리보기의 질문 비용 견본을 펴고 접는다 */
async function togglePreview($: EngineInterface): Promise<void> {
  await update($, previewOpen, now => !now)
  $.ui.invalidate('ui.render')
}

/** 답변 아래 칩의 상세를 그 질문만 펴고 접는다(정보량 전부) — 패널 펼침과 같은 까닭으로 다시 그리기도 부른다 */
async function toggleAnswer($: EngineInterface, id: number): Promise<void> {
  await update($, answerOpen, now => (now.includes(id) ? now.filter(x => x !== id) : [...now, id].slice(-50)))
  $.ui.invalidate('ui.render')
}

/** 최근 · 전체 전환. 펼침과 같은 까닭으로 다시 그리기도 부른다 */
async function setHistoryAll($: EngineInterface, isAll: boolean): Promise<void> {
  await update($, historyAll, () => isAll)
  $.ui.invalidate('ui.render')
}

async function setEffectsAll($: EngineInterface, isAll: boolean): Promise<void> {
  await update($, effectsAll, () => isAll)
  $.ui.invalidate('ui.render')
}

async function setFlowAll($: EngineInterface, isAll: boolean): Promise<void> {
  await update($, flowAll, () => isAll)
  $.ui.invalidate('ui.render')
}

/**
 * 이 PC 의 최근 저장 턴 — 칸마다 가운데 값. 평균이면 0.3.x 가 남긴 식은 캐시의 저장 턴(대화 전체를 다시 써 새로 씀 25만,
 * 이 PC 2026-10-12) 하나가 새로 씀을 5만으로 부풀렸다. 없으면 null(가정 SAVE_GUESS)
 */
async function storedSaveOrNull($: EngineInterface): Promise<SaveTurn | null> {
  try {
    const list = (await $.store.get(SAVE_KEY)) as Partial<SaveTurn>[] | undefined
    const ok = (list ?? []).filter(
      (s): s is SaveTurn => typeof s?.steps === 'number' && typeof s.output === 'number' && typeof s.write === 'number',
    )
    if (ok.length === 0) return null
    const mid = (pick: (s: SaveTurn) => number) => {
      const v = ok.map(pick).sort((a, b) => a - b)
      const h = Math.floor(v.length / 2)
      return v.length % 2 === 1 ? v[h]! : (v[h - 1]! + v[h]!) / 2
    }
    return { steps: mid(s => s.steps), output: Math.round(mid(s => s.output)), write: Math.round(mid(s => s.write)) }
  } catch {
    return null
  }
}

/**
 * 끝난 저장 턴을 잰다(세션이 [컴팩트 진행] 으로 답했을 때만 — 보류 답은 저장을 안 해 짧다). 요청 수 · 출력 토큰 · 새로 쓴
 * 토큰(쓰기 값 ÷ 그 모델의 1시간 쓰기 요율). 캐시를 다시 쓴 몫(식은 캐시 · 모델 바꿈)은 뺀다 — 저장 턴이 늘 내는 값이 아니다.
 * 최근 SAVE_KEEP 개를 남긴다
 */
async function recordSaveTurn($: EngineInterface, turn: LiveTurn): Promise<void> {
  const r = turn.model ? ratesFor(turn.model, 0) : null
  if (!r || turn.steps <= 0) return
  const writeUsd = Math.max(0, turn.cost.write - (turn.rewriteUsd ?? 0))
  const one: SaveTurn = { steps: turn.steps, output: turn.outputTokens, write: Math.round((writeUsd / r.write1h) * 1e6) }
  try {
    const prev = ((await $.store.get(SAVE_KEY)) as SaveTurn[] | undefined) ?? []
    await $.store.set(SAVE_KEY, [...(Array.isArray(prev) ? prev : []), one].slice(-SAVE_KEEP))
  } catch {
    // 못 쓰면 다음 저장 턴에
  }
}

/**
 * 이 PC 에서 잰 마지막 컴팩트 요청의 입력 몫(캐시가 살아 있던 컴팩트만). 없으면 null(전부 캐시 읽기로 본다 — WARM_COMPACT).
 * 0.3.x 는 식은 캐시의 컴팩트도 남겼다 — 읽기가 절반 아래인 값은 그것으로 보고 버린다
 */
async function storedMixOrNull($: EngineInterface): Promise<CompactMix | null> {
  try {
    const m = (await $.store.get(MIX_KEY)) as Partial<CompactMix> | undefined
    if (m && typeof m.input === 'number' && typeof m.read === 'number' && typeof m.write === 'number' && isWarmMix(m as CompactMix)) return m as CompactMix
  } catch {
    // 못 읽으면 기본값
  }
  return null
}

/** 직접 쓴 문구 입력칸의 Enter: 저장하고 고른다. 누른 때의 설정 위에 — 그린 뒤 다른 세션이 바꿨을 수 있다 */
async function saveTidyCustom($: EngineInterface, text: string): Promise<void> {
  await update($, tidyDraft, () => null)
  await saveSettings($, setTidyCustom(await currentSettings($), text))
}

/**
 * 사용량 패널 안 탭 바꾸기(사용량 · 설정). 패널이 닫혀 있으면 연다. 탭 줄이 보이게 위로 붙잡는다 —
 * 긴 사용량에서 짧은 설정으로 오면 스크롤 자리가 내용 밖에 남는다. 다시 그린 뒤에 옮겨야 해 잠깐 기다린다
 */
async function openUsageTab($: EngineInterface, tab: UsageTab): Promise<void> {
  // 설정 탭에서 사용량 탭으로 돌아오면 패널 위 [간략][자세히] 로 잠깐 바꾼 보기는 정보량대로
  if (tab === 'main' && (await read($, usageTab)) !== 'main') await update($, paneModeLocal, () => null)
  await update($, usageTab, () => tab)
  if ((await read($, paneView)) !== 'usage') await switchView($, 'usage')
  $.ui.invalidate('ui.render')
  $.clock.after(120, () => {
    void $.ui.scroll({ to: { key: 'pane-tabs' }, in: PANE, block: 'start' }).catch(() => {})
  })
}

/** 설정의 컴팩트 문구 "보내는 글 전체" 펼치기 · 접기 */
async function toggleTidyRaw($: EngineInterface): Promise<void> {
  const next = !(await read($, tidyRawOpen))
  await update($, tidyRawOpen, () => next)
  $.ui.invalidate('ui.render')
}

/** 컴팩트가 얼마나 급한가: 없음 · 노랑 · 빨강 · 식은 캐시(바로 컴팩트 권장) — 접힌 바를 저절로 펼지 */
type Urgency = 'ok' | 'warn' | 'cut' | 'cold'
const URGENCY_RANK: Record<string, number> = { ok: 0, warn: 1, cut: 2, cold: 3 }

async function urgencyNow($: EngineInterface): Promise<Urgency> {
  const u = await read($, usage)
  if (!u) return 'ok'
  const inputs = (await read($, optimal))?.inputs ?? null
  const est = estimateFor(u, await $.clock.now())
  const cold = inputs && est.kind === 'cold' ? coldFor(u, inputs) : null
  if (cold !== null && cold.compactUsd < cold.continueUsd) return 'cold'
  return est.kind === 'cold' ? 'ok' : levelOf(u.contextTokens)
}

/**
 * 바가 접혀 있나: ✕ 로 접었고(bandFolded), 컴팩트할 때 자동으로 펴기가 꺼졌거나 아직 그때가 아니다(노랑 전 · 식은 캐시라도
 * 컴팩트가 손해). 저장 · 컴팩트 중 · 확인창이 열린 동안은 편다. 저절로 펴진 바를 ✕ 로 다시 접었으면 그보다 급해질 때까지
 * 접어 둔다(autoDismissed). 입력창 아래 [🔽 ⇱] 를 그릴지 — 바(AbovePrompt)가 같은 함수를 쓴다
 */
async function isBandTucked($: EngineInterface): Promise<boolean> {
  const mode = bandShowMode(await currentSettings($))
  if (mode === 'always') return false
  if (mode === 'never') return true
  const phase = await read($, compactPhase)
  if (phase === 'tidying' || phase === 'compacting' || (await read($, isConfirmingCompact))) return false
  const urgency = await urgencyNow($)
  if (urgency === 'ok') return true
  const dismissed = await read($, autoDismissed)
  return dismissed !== null && URGENCY_RANK[urgency]! <= (URGENCY_RANK[dismissed] ?? 0)
}

/**
 * 바의 ✕: 펼친 바면 접고(모든 세션) 다시 펴는 법을 알린다. 접힌 채 저절로 펴진 바면 지금 급한 정도까지는 다시 펴지 않는다(이
 * 세션) — 컴팩트하면 풀린다
 */
async function foldBand($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  const s = await currentSettings($)
  if (s.bandFolded) {
    const urgency = await urgencyNow($)
    await update($, autoDismissed, () => urgency)
    $.ui.invalidate('ui.render')
    return
  }
  const next = setFolded(s, true)
  await saveSettings($, next)
  $.ui.toast(hiddenNote(next), { timeoutMs: HIDDEN_NOTE_MS })
}

/** 설정 탭 칸 펼치기 · 접기(컴팩트 시점 · 문구 · 바 · 그 안 상세 조정 · 캐시 경고 · 언어) */
async function toggleFold($: EngineInterface, key: string): Promise<void> {
  const cur = await read($, settingsOpen)
  await update($, settingsOpen, () => ({ ...cur, [key]: !cur[key] }))
  $.ui.invalidate('ui.render')
}

/** 사용량 카드(컨텍스트 · 비용 · 질문별 비용 · 컴팩트) 접기 · 펼치기 */
async function toggleCard($: EngineInterface, which: 'now' | 'history' | 'compact'): Promise<void> {
  const cur = await read($, cardsOpen)
  await update($, cardsOpen, () => ({ ...cur, [which]: !cur[which] }))
  $.ui.invalidate('ui.render')
}

const setHelp = () =>
  L(
    '쓰는 법: /easy-compact set 권장 <30만|300k|구간> · set 구간 <시작> <끝> · set 캐시 <분>  예) set 권장 30만 · set 권장 구간 · set 구간 15만 25만 · set 캐시 10',
    'Usage: /easy-compact set compact <300k|range> · set range <start> <end> · set cache <minutes>  e.g. set compact 300k · set compact range · set range 150k 250k · set cache 10',
  )

const bandHelp = () =>
  L(
    '쓰는 법: /easy-compact 칸 <이름> <켜기|끄기> · 칸 모두 켜기  이름 = 5시간 · 7일 · 리셋 · 세션 · 평균 · 요청당 · 컨텍스트 · 구간 · 캐시 · 질문(바꾸면 화면이 커스텀으로)\n바 펴기 · 접기 · 크기 · 화면: /easy-compact 보이기 | 안보이기 | 자동펴기 켜기|끄기 | 최소 | 최대 | 화면 <간단|기본|자세히|커스텀>',
    'Usage: /easy-compact band <part> <on|off> · band all on  parts = 5h · 7d · reset · session · average · request · context · range · cache · question (switches the screen to Custom)\nOpen · fold · size · screen: /easy-compact show | hide | autoopen on|off | min | max | screen <simple|basic|detailed|custom>',
  )

/**
 * 띠 단축 명령 — 보이기 · 안보이기(메뉴 · 도움말에 보이는 건 이 둘뿐), 그리고 숨은 명령 자동숨김 켜기 · 끄기,
 * 최소 · 최대, 패널 열기 · 닫기(바의 버튼과 같은 일 — 테스트가 쓴다). 동사와 인자는 띄어쓰기를 무시하고 읽는다("자동 숨김 켜기" · "안 보이기"). 단축 명령이
 * 아니면 null. 크기 · 자동 숨김을 고르면 안 보이기도 푼다 — 보려고 고른 것이라
 */
async function bandShortcut($: EngineInterface, verb: string, rest: string): Promise<string | null> {
  const s = await currentSettings($)
  const words = `${verb} ${rest}`.trim().split(/\s+/)
  const bare = words.join('').toLowerCase()
  const onOff = words.length > 1 ? parseOnOff(words[words.length - 1]!) : null
  const head = onOff === null ? bare : words.slice(0, -1).join('').toLowerCase()
  // 보이기 = 늘 보이기(숨김 · 자동 숨김을 다 푼다) — 숨긴 뒤 안내는 다시 켜는 이 명령 하나만
  if (['show', '보이기', '보임', '늘보이기', '펴기', '펼치기'].includes(bare)) {
    const next = setBandShow(s, 'always')
    await saveSettings($, next)
    await update($, autoDismissed, () => null)
    return L(`이지 컴팩트 바를 폈습니다(${bandStateText(next)}).`, `Easy Compact bar open (${bandStateText(next)}).`)
  }
  if (['hide', '안보이기', '숨기기', '숨김', '접기', 'fold'].includes(bare)) {
    const next = setFolded(s, true)
    await saveSettings($, next)
    return hiddenNote(next)
  }
  // 화면 프리셋(설정 탭 맨 위와 같은 값): "화면 기본" · 그냥 "기본" · "커스텀". "자세히" 만 치면 패널 보기(아래) — 화면 자세히는 "화면 자세히"
  const screenWord = ['화면', 'screen', 'view'].includes(words[0]!.toLowerCase()) ? parseScreen(words.slice(1).join('')) : ['간단', '기본', '커스텀', 'basic', 'custom'].includes(bare) ? parseScreen(bare) : null
  if (screenWord) {
    await saveSettings($, chooseScreen(s, screenWord))
    return L(`화면을 ${screenName(screenWord)}(으)로 바꿨습니다.`, `Screen set to ${screenName(screenWord)}.`)
  }
  // 사용량 패널 보기(간략 · 자세히) — 패널 위 버튼과 같은 값, 이 세션만(화면 설정은 그대로)
  const paneMode = ['간략', 'simple', '패널간략'].includes(bare) ? 'simple' : ['자세히', 'detail', 'detailed', '패널자세히'].includes(bare) ? 'detail' : null
  if (paneMode) {
    await setPaneMode($, paneMode)
    return L(
      `사용량 패널을 잠깐 ${paneModeName(paneMode)} 보기로 바꿨습니다 — 패널을 닫거나 설정 탭에 다녀오면 정보량대로 돌아갑니다.`,
      `Usage pane switched to ${paneModeName(paneMode)} for now — it goes back to your detail level when you close the pane or visit Settings.`,
    )
  }
  const size = parseBandMode(bare)
  if (size) {
    const next = { ...s, band: size, bandFolded: false }
    await saveSettings($, next)
    return L(`바 크기를 ${bandModeName(size)}로 바꿨습니다(${bandStateText(next)}).`, `Bar size: ${bandModeName(size)} (${bandStateText(next)}).`)
  }
  // 컴팩트할 때 자동으로 펴기(설정 옵션)
  if (['자동펴기', '컴팩트할때펴기', '자동으로펴기', 'autoopen', 'autoreveal'].includes(head)) {
    const on = onOff ?? !s.bandAutoOpen
    await saveSettings($, { ...s, bandAutoOpen: on })
    return L(`컴팩트할 때 자동으로 펴기 ${on ? '켬' : '끔'}.`, `Open when compacting ${on ? 'on' : 'off'}.`)
  }
  // 예전 자동 숨김 명령: 켜기 = 접고 컴팩트할 때 펴기, 끄기 = 펴기
  if (isAutoWord(head)) {
    // 켜기 · 끄기를 안 주면 번갈아
    const on = onOff ?? bandShowMode(s) !== 'auto'
    await saveSettings($, setBandShow(s, on ? 'auto' : 'always'))
    return on
      ? L(
          `바를 접었습니다 — 컴팩트 구간(노랑) · 캐시 만료 때 저절로 펴집니다. 늘 펴 두기: 입력창 아래 [${revealLabel(false)}] 또는 /easy-compact 보이기`,
          `Bar folded — it opens by itself at the compact range (yellow) or when the cache expires. Keep it open: [${revealLabel(false)}] below the input or /easy-compact show`,
        )
      : L('이지 컴팩트 바를 폈습니다.', 'Easy Compact bar open.')
  }
  // 사용량 패널 옵션 둘(켜기 · 끄기 없이 치면 번갈아): 새 세션에서 자동으로 열기 · 모든 세션 같이 열고 닫기
  if (['패널자동', '패널자동열기', '패널자동으로열기', 'panelauto', 'paneauto', 'panelautoopen'].includes(head)) {
    const isOn = onOff ?? !s.paneAutoOpen
    await setPaneOption($, 'paneAutoOpen', isOn)
    return L(`새 세션에서 자동으로 열기 ${isOn ? '켬' : '끔'} — ${paneAutoUse(isOn)}`, `Auto-open in new sessions ${isOn ? 'on' : 'off'} — ${paneAutoUse(isOn)}`)
  }
  if (['패널같이', '패널공유', '패널모든세션', '패널같이열고닫기', 'panelshare', 'panelshared', 'panelsync', 'paneshare', 'panesync'].includes(head)) {
    const isOn = onOff ?? !s.paneShared
    await setPaneOption($, 'paneShared', isOn)
    return L(`모든 세션 같이 열고 닫기 ${isOn ? '켬' : '끔'} — ${paneSyncUse(isOn)}`, `Open/close together ${isOn ? 'on' : 'off'} — ${paneSyncUse(isOn)}`)
  }
  if (['panel', 'pane', 'usage', '패널', '사용량', '사용량패널', '사이드패널'].includes(head)) {
    // 열기 · 닫기를 안 주면 번갈아 — 어느 쪽이 됐는지 알린다("열거나 닫았습니다" 로는 닫힌 게 고장처럼 보였다)
    let isOpened: boolean
    if (onOff === null) isOpened = (await toggleView($, 'usage')) !== null
    else {
      await setWantedView($, onOff ? 'usage' : null)
      await syncPane($)
      isOpened = onOff
    }
    return isOpened ? L(`${paneTitle()} 패널을 열었습니다.`, `Opened the ${paneTitle()} pane.`) : L(`${paneTitle()} 패널을 닫았습니다.`, `Closed the ${paneTitle()} pane.`)
  }
  return null
}

/** 띠 명령: 최대 띠 칸 켜고 끄기(설정 탭 화면 → 세부 → "바 칸 켜고 끄기" 와 같은 값). 크기 · 자동 숨김도 받는다(band min · band auto on) */
async function bandCommand($: EngineInterface, rest: string): Promise<string> {
  const s = await currentSettings($)
  const words = rest.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    const shown = bandShowOf(s)
    const off = BAND_PARTS.filter(p => !shown[p.key]).map(p => bandPartName(p.key))
    return L(
      `이지 컴팩트 바: ${bandStateText(s)}${off.length ? ` · 뺀 칸: ${off.join(', ')}` : ''}\n${bandHelp()}`,
      `Easy Compact bar: ${bandStateText(s)}${off.length ? ` · hidden parts: ${off.join(', ')}` : ''}\n${bandHelp()}`,
    )
  }
  const [first = '', ...more] = words
  const short = await bandShortcut($, first, more.join(' '))
  if (short !== null) return short
  const on = parseOnOff(words[words.length - 1]!)
  const what = words.slice(0, -1).join('').toLowerCase()
  // 비용 · 질문 줄 칸을 바꾸면 화면이 커스텀이 된다(프리셋은 세부를 못 바꾼다) — 그렇다고 답에 적는다. 한도 줄 칸은
  // 화면과 따로라 그대로
  const toCustom = s.screen !== 'custom' ? L(' 화면을 커스텀으로 바꿨습니다.', ' The screen is now Custom.') : ''
  if (on !== null && ['all', '모두', '전부'].includes(what)) {
    const all = Object.fromEntries(Object.keys(viewOf(s).bandShow).map(k => [k, on])) as CostShow
    await saveSettings($, { ...editView(s, v => ({ ...v, bandShow: all })), limitShow: { fiveHour: on, sevenDay: on, resets: on } })
    return (on ? L('바의 칸을 모두 보입니다.', 'All bar parts are shown.') : L('바의 칸을 모두 뺐습니다.', 'All bar parts are hidden.')) + toCustom
  }
  const key = parseBandPart(what)
  if (on === null || key === null) return bandHelp()
  await saveSettings($, setBandPart(s, key, on))
  return (on ? L(`바에 "${bandPartName(key)}" 칸을 보입니다.`, `"${bandPartName(key)}" is shown on the bar.`) : L(`바에서 "${bandPartName(key)}" 칸을 뺐습니다.`, `"${bandPartName(key)}" is hidden on the bar.`)) + (isViewPart(key) ? toCustom : '')
}

/** 설정 명령(설정 화면의 버튼과 같은 함수). 설정 명령이 아니면 null */
async function settingsCommand($: EngineInterface, verb: string, rest: string): Promise<string | null> {
  const s = await currentSettings($)
  const short = await bandShortcut($, verb, rest)
  if (short !== null) return short
  // 예전 이름(띠 · 툴바 · 표시줄)도 받는다
  if (['band', 'part', 'bar', 'toolbar', '띠', '칸', '바', '툴바', '표시줄'].includes(verb)) return bandCommand($, rest)
  if (verb === 'settings' || verb === '설정') {
    // 사용량 패널을 열고 설정 탭으로
    await openUsageTab($, 'settings')
    return L('사용량 패널의 설정 탭을 열었습니다.', 'Opened the Settings tab of the Usage pane.')
  }
  if (verb === 'set') {
    const [name = '', value = '', value2 = ''] = rest.split(/\s+/)
    // 명령은 바로 저장한다(설정 화면에서 고르던 값은 버린다 — 저장된 값과 엇갈리지 않게)
    const rangeReply = async (next: Settings) => {
      await saveSettings($, next)
      await update($, cmpDraft, () => null)
      return L(
        `컴팩트 시점을 구간으로 바꿨습니다(${fmtTokens(next.rangeStart)} ~ ${fmtTokens(next.rangeEnd)}).`,
        `Compact timing is now a range (${fmtTokens(next.rangeStart)} – ${fmtTokens(next.rangeEnd)}).`,
      )
    }
    if (name === '권장' || name === 'compact') {
      // 예전 명령 "set 권장 최적" 도 구간으로 받는다
      if (value === '구간' || value === 'range' || value === '최적' || value === 'optimal') return rangeReply(setFollow(s, true))
      const n = parseTokens(value)
      if (n === null) return setHelp()
      const next = setCompactAt(s, n)
      await saveSettings($, next)
      await update($, cmpDraft, () => null)
      return L(`컴팩트 크기를 ${fmtTokens(next.compactAt)}로 직접 정했습니다.`, `Compact size set to ${fmtTokens(next.compactAt)}.`)
    }
    if (name === '구간' || name === 'range') {
      const start = parseTokens(value)
      const end = parseTokens(value2)
      if (start === null || end === null) return setHelp()
      const next = setRange(s, start, end)
      return next === s
        ? L(`시작(${fmtTokens(start)})이 끝(${fmtTokens(end)})보다 작아야 합니다.`, `The start (${fmtTokens(start)}) must be smaller than the end (${fmtTokens(end)}).`)
        : rangeReply(next)
    }
    if (name === '캐시' || name === 'cache') {
      const n = parseMinutes(value)
      if (n === null) return setHelp()
      // 지금 세션의 유지 시간 쪽 경고만(5분 캐시 · 1시간 캐시 따로)
      const ttl = ttlOf(await read($, usage))
      if (ttl < 60 && n >= ttl) return L(`5분 캐시라 ${ttl}분보다 작아야 합니다.`, `The cache lives ${ttl} min here, so it must be under ${ttl}.`)
      await saveSettings($, ttl < 60 ? { ...s, cacheWarnMin5m: n } : { ...s, cacheWarnMin: n })
      return L(`캐시(${ttl}분)가 ${n}분 남으면 노랑으로 알립니다.`, `Turns yellow with ${plural(n, 'minute')} of the ${ttl}-minute cache left.`)
    }
    return setHelp()
  }
  if (verb === 'lang' || verb === '언어' || verb === 'language') {
    const v = rest.trim().toLowerCase()
    const choice = ['ko', 'korean', '한국어', '한글'].includes(v) ? 'ko' : ['en', 'english', '영어'].includes(v) ? 'en' : ['auto', '자동'].includes(v) ? 'auto' : null
    if (choice === null) return L('쓰는 법: /easy-compact lang <auto|ko|en>', 'Usage: /easy-compact lang <auto|ko|en>')
    await saveLang($, choice)
    return choice === 'auto'
      ? L(`화면 언어를 자동으로 정합니다(지금 한국어).`, `Display language is now automatic (currently English).`)
      : L('화면 언어를 한국어로 고정했습니다.', 'Display language set to English.')
  }
  if (verb === '문구' || verb === 'prompt') {
    if (!rest) {
      const now = usesCustom(s)
        ? L('직접 쓴 문구', 'your custom text')
        : s.tidy === 'custom'
          ? L('직접(비어 있어 일반대로)', 'Custom (empty, so Normal is used)')
          : tidyStyles()[s.tidy].name
      return L(
        `지금 컴팩트 문구: ${now}. 바꾸려면 /easy-compact 문구 <일반|긴 세션 이어가기|마무리|직접|직접 쓸 글>`,
        `Current compact text: ${now}. To change: /easy-compact prompt <Normal|Long-session handoff|Wrap-up|Custom|your own text>`,
      )
    }
    const next = chooseTidy(s, rest)
    await saveSettings($, next)
    if (next.tidy !== 'custom') return L(`컴팩트 문구를 바꿨습니다: ${tidyStyles()[next.tidy].name}`, `Compact text changed: ${tidyStyles()[next.tidy].name}`)
    return usesCustom(next)
      ? L('직접 쓴 문구로 정리합니다. 잃을 정보 확인과 진행 표시는 mod가 앞뒤에 붙입니다.', 'Saving with your custom text. The mod adds the lost-information check and the go/hold marks around it.')
      : L('직접을 골랐습니다. 문구가 비어 있어 그동안 일반 문구대로 합니다.', 'Custom selected. The text is empty, so Normal is used meanwhile.')
  }
  return null
}

/** 도움말 — 남은 명령 둘과, 나머지는 어디서 하는지. 명령 출력은 기록에 남아 다음 요청이 같이 읽으니 짧게 */
const help = () =>
  L(
    [
      '/easy-compact 보이기 | 안보이기   입력창 위 이지 컴팩트 바 펴기 · 접기(모든 세션) — 영어: show | hide',
      `나머지는 바의 버튼: 📊 사용량 패널(⚙ 설정 탭) · — / □ 한 줄 / 전체 · ✕ 접기. 접어 두면 입력창 아래 [${revealLabel(false)}] — 컴팩트할 때 저절로 펴짐(설정)`,
    ].join('\n'),
    [
      '/easy-compact show | hide   open or fold the Easy Compact bar above the input (every session)',
      `Everything else is on the bar's buttons: 📊 Usage pane (⚙ Settings tab) · — / □ one line / full · ✕ fold. When folded: [${revealLabel(false)}] below the input — it opens by itself when it is time to compact (Settings)`,
    ].join('\n'),
  )

/** 설정 탭 저장 — 이번에 바를 접었으면 다시 펴는 법을 토스트로(바의 ✕ · 명령과 같은 말) */
async function saveFromSettings($: EngineInterface, next: Settings): Promise<void> {
  const wasFolded = (await currentSettings($)).bandFolded
  await saveSettings($, next)
  if (!next.bandFolded) await update($, autoDismissed, () => null)
  if (next.bandFolded && !wasFolded) $.ui.toast(hiddenNote(next), { timeoutMs: HIDDEN_NOTE_MS })
}

/** 설정 탭 커스텀의 캐시 유지 시간 [자동 · 1시간 · 5분] — 사용자 설정 파일의 promptCacheTtl. 못 바꾸면 까닭을 토스트로 */
async function setTtlFromSettings($: EngineInterface, value: '5m' | '1h' | null): Promise<void> {
  if ((await currentSettings($)).screen !== 'custom') return
  const why = await writeTtlSetting($, value)
  $.ui.toast(
    why ??
      (value === null
        ? L('캐시 유지 시간을 자동으로 — 다음 요청부터(구독 요금제 사용량 안이면 1시간, 그 밖 5분).', 'Cache lifetime set to automatic — from the next request (1 h within a subscription plan, 5 min otherwise).')
        : L(`캐시 유지 시간을 ${value === '1h' ? '1시간' : '5분'}으로 — 다음 요청부터. 바꾼 곳: 사용자 설정 promptCacheTtl`, `Cache lifetime set to ${value === '1h' ? '1 hour' : '5 minutes'} — from the next request. Changed: user setting promptCacheTtl`)),
  )
  $.ui.invalidate('ui.render')
}

/** 설정 화면 버튼 동작 묶음 — $ 를 쓰는 동작은 이 파일에 있어야 한다(엔진은 $ 를 import 너머로 따라가지 않아 모듈을 안 띄운다) */
function settingsActs($: EngineInterface): SettingsActions {
  return {
    save: next => void saveFromSettings($, next),
    editCmp: next => void update($, cmpDraft, () => next),
    applyCmp: () => void applyCmpDraft($),
    typeTidy: text => void update($, tidyDraft, () => text),
    saveTidy: text => void saveTidyCustom($, text),
    toggleRaw: () => void toggleTidyRaw($),
    toggleFold: key => void toggleFold($, key),
    setLang: choice => void saveLang($, choice),
    setPaneOption: (key, isOn) => void setPaneOption($, key, isOn),
    setTtl: value => void setTtlFromSettings($, value),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await ensureLang($)
    await checkEngine($)
    await $.command.register({
      name: 'easy-compact',
      // 메뉴 · 도움말엔 보이기 · 안보이기만 — 나머지는 바의 버튼 · 설정 탭이 다 한다(버튼은 기록에 안 남아 토큰 0).
      // 그 밖의 명령(패널 · settings · set · 문구 · 칸 · lang · 최소 · 최대 · 자동숨김 · 다시 읽기)은 지우지 않고 숨긴다 — 테스트가 쓴다
      description: L('입력창 위 이지 컴팩트 바 보이기 · 안보이기 — 나머지는 바의 버튼', 'Show or hide the Easy Compact bar above the input — everything else is on its buttons'),
      argumentHint: L('[보이기 | 안보이기]', '[show | hide]'),
    })
    // 재로드도 session.start 다 — 여기서 턴 비용을 세면 턴이 아닌 구간이 섞인다
    await refreshUsage($, { categories: false, pushHistory: false })
    await loadSettings($)
    // 사용량 패널: 이 세션이 시작한 때(같이 열고 닫기는 그 뒤 일만 따른다), 새 세션이면 자동으로 열기
    paneStartAt = await $.clock.now()
    await autoOpenPane($).catch(() => {})
    // 기록 파일(수 MB)은 시작을 막지 않게 뒤에서 읽는다. 다 읽으면 사용량을 다시 잰다 —
    // 컴팩트 뒤 첫 요청 전이면 엔진 값이 컴팩트 전 크기라 흐름의 컴팩트 기록을 보고 추정값으로 바꾼다
    // 기본 적재(/context 분류)도 이때 한 번 잰다 — 계산식 최적의 재료
    void loadFlow($)
      .then(() => refreshUsage($, { categories: true, pushHistory: false }))
      .catch(() => {})
    // 패널을 이 세션 값에 맞추고(같이 열고 닫기면 다른 데스크톱 세션이 연 · 닫은 것도), 바꾼 설정을 따라간다
    $.clock.every(1500, () => {
      void syncPane($).catch(() => {})
      void loadSettings($).catch(() => {})
      // 고른 모델을 따라간다(모델 피커는 알려 주는 이벤트가 없다)
      void followModel($).catch(() => {})
      // "도는 중" 에이전트가 정말 도는지(끝남을 못 들은 때 대비) — 도는 중이 없으면 바로 돌아온다
      void reconcileAgents($).catch(() => {})
    })
    // 캐시 남은 분을 갱신한다 — 그리기만 다시, 모델 호출 없음
    $.clock.every(60000, () => {
      $.ui.invalidate('ui.render')
    })
    return next(e)
  })

  // 한도(5시간 · 7일)는 응답마다 바뀐다 — 턴 끝에만 다시 읽으니 긴 턴 동안 띠가 앱의 사용량 창보다 낮았다(띠 12% ·
  // 앱 13%). 엔진이 한도가 1포인트 넘게 움직일 때 알려 주는 대로 그 줄만 바꾼다
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const rateLimits = e.rateLimits.map(r =>
        r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed },
      )
      await update($, usage, prev => (prev ? { ...prev, rateLimits } : prev))
    }
    return next(e)
  })

  // 서브에이전트 턴은 추이에 넣지 않는다
  on('turn.complete', async ($, e, next) => {
    // 질문 기록 · 동작 이름 글을 만드는 훅은 그리기 전에도 돈다 — 언어를 먼저 맞춘다
    await ensureLang($)
    const isMain = e.agentId === undefined
    // 하위 에이전트의 답 = 그 에이전트가 끝났다(엔진 문서: 에이전트 답은 그 agentId 의 turn.complete) — "도는 중" → 끝남
    if (!isMain) await markAgentsDone($, id => id === e.agentId)
    // 메인 턴 끝: 이번 요청들이 쓴 캐시 종류(유지 시간)를 기록에서 잰다 · 무엇이 유지 시간을 정하는지도 다시 읽는다(설정을
    // 바꿨을 수 있다)
    if (isMain) {
      await refreshTtl($)
      await update($, ttlConfig, () => null)
    }
    await refreshUsage($, { categories: false, pushHistory: isMain })
    // 저장 턴이면 닫기 전에 잰다(닫으면 진행 중 누적이 비워진다)
    const turnNow = isMain ? await read($, live) : null
    if (isMain) {
      await closeTurn($, e.answer)
      // 여기부터 다음 질문까지 엔진 집계가 는 만큼(우리가 본 요청을 빼고)이 앱 자체 요청
      await markIdle($)
    }
    // "정리 후 컴팩트": 정리 턴이 [컴팩트 진행] 으로 끝났을 때만 컴팩트. 세션이 보류했거나
    // 중단 · 오류 · 판정 없음이면 하지 않고 알린다. 훅 안에서 명령을 돌리면 이 턴을 기다리게 되니 턴이 끝난 뒤로 미룬다
    if (isMain && (await read($, compactPhase)) === 'tidying') {
      const verdict = tidyVerdict(e.reason, e.answer)
      if (verdict === 'go') {
        if (turnNow) await recordSaveTurn($, turnNow)
        await startCompacting($, kindTidy())
        $.clock.after(300, () => void compactNow($, compactKeep()))
      } else {
        await update($, compactPhase, () => (verdict === 'hold' ? 'held' : 'idle'))
        $.ui.toast(
          verdict === 'hold'
            ? L('세션이 지금은 컴팩트하지 않는 게 맞다고 답했습니다 — 답에 이유가 있습니다', 'The session answered that it should not compact now — the reason is in the answer')
            : verdict === 'stopped'
              ? L('저장이 끝나지 않아 컴팩트를 하지 않았습니다', 'Did not compact — the save did not finish')
              : L(`답에 ${markGo()} 표시가 없어 컴팩트를 하지 않았습니다`, `Did not compact — the answer has no ${markGo()} mark`),
        )
      }
    }
    return next(e)
  })

  // ③ 작업 중 표시: 메인 턴이 시작되면 누적을 비운다
  on('turn.start', async ($, e, next) => {
    await ensureLang($)
    // 보류 표시는 다음 질문까지만
    if (e.agentId === undefined && (await read($, compactPhase)) === 'held') await update($, compactPhase, () => 'idle')
    // 앞 답 뒤에 돈 앱 자체 요청은 앞 질문에 — 여기부터는 이 질문의 요청이라 기준을 거둔다
    await settleAppRequests($)
    idleMark = null
    // 흐름 그래프의 [최근 질문 40] 경계 — 메인 대화의 질문만(타입엔 agentId 가 없지만 하위 에이전트 턴이 오면 뺀다)
    if ((e as { agentId?: string }).agentId === undefined) await writeFlow($, withQuestion(await readFlow($), await $.clock.now()))
    await update($, live, () => ({
      turnId: e.turnId,
      steps: 0,
      cost: ZERO_COST,
      prompt: promptHead(e.text),
      contextTokens: 0,
      outputTokens: 0,
      details: [],
    }))
    return next(e)
  }).catch(($, e, next) => next(e))

  // 하위 에이전트를 띄울 때 작업 이름과 띄운 질문을 적어 둔다 — 그 에이전트의 요청 값을 그 질문에 더한다
  on('agent.spawn', async ($, e, next) => {
    await ensureLang($)
    const result = await next(e)
    if (result.agentId) {
      const now = await read($, live)
      agentInfo.set(result.agentId, { label: e.description || e.subagentType || L('하위 에이전트', 'subagent'), turnId: now?.turnId ?? null })
    }
    return result
  }).catch(($, e, next) => next(e))

  // 엔진이 다음 질문 제안을 만들어 띄운다 — 답 뒤 앱 자체 요청에 그 이름을 붙인다(보기만)
  on('prompt.suggest', async ($, e, next) => {
    if (e.origin.kind === 'suggestion') suggestedSinceMark = true
    return next(e)
  })

  // 요청 하나가 끝날 때마다 API 가 보고한 토큰으로 값을 더한다. 하위 에이전트 요청은 값만(컨텍스트 · 흐름엔 안 넣는다)
  on('turn.step', async function* ($, e, next) {
    await ensureLang($)
    const result = yield* next(e)
    if (e.agentId !== undefined && result.usage) {
      try {
        const cost = costOf(result.usage, result.usage.model, 5)
        if (cost) await recordAgentStep($, e.agentId, cost, result.usage.model)
      } catch {
        // 기록 실패가 턴을 멈추면 안 된다
      }
    }
    if (e.agentId === undefined && result.usage) {
      try {
        // 요율은 이 요청에 실제로 답한 모델 기준(API 가 보고한 model id), 쓰기는 이 세션 메인 대화의 유지 시간 요율
        const cost = costOf(result.usage, result.usage.model, ttlOf(await read($, usage)))
        // 모델을 바꾼 뒤 첫 요청인가 — 아래에서 "모델 바뀜" 표시를 지우기 전에 잡아 둔다
        const switchedFrom = (await read($, usage))?.switchedFrom ?? null
        if (cost) await recordStep($, e.turnId, cost, result.usage, stepLabel(result.toolUses), result.usage.model, e.effort, switchedFrom)
        const t = result.usage
        const ctxNow = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
        if (measureAfterCompact) {
          // 컴팩트 직후 크기와 그중 요약(= 이 요청이 캐시에서 못 읽고 새로 낸 몫, 흐름의 c.summary 와 같은 셈) — 이 PC 의 다음
          // 계산식 재료(이 세션에서 컴팩트하기 전 세션들이 쓴다). 예전엔 직후 − 기본 적재라 첫 질문 · 분류 차이만큼 작았다(3.5k)
          measureAfterCompact = false
          await $.store.set(AFTER_KEY, ctxNow)
          await fillCompactAfter($, ctxNow)
          // 흐름이 이 요청으로 적은 값(캐시가 식은 뒤의 첫 요청이면 전부 다시 써 안 적는다 — flow.ts addPoint)
          const summary = (await read($, compactions)).at(-1)?.summary
          if (typeof summary === 'number' && summary > 0) await $.store.set(SUMMARY_KEY, summary)
        }
        // 띠 · 패널 컨텍스트를 요청마다 바로(턴 끝까지 기다리지 않는다 — 작업 중에도 지금 크기). 요청당 실측(9a)도.
        // 캐시 타이머도 요청마다 처음부터 — 캐시를 읽은 요청이 유지 시간을 다시 시작한다(공식 문서 "Each request that hits the
        // cache resets the timer"). 예전엔 턴 끝에만 바꿔 긴 작업 중에 남은 분이 줄다가 "캐시 만료" 가 떴다
        const perCallExtraUsd = extraPerCall(await readFlow($), result.usage.model)
        const stepAt = await $.clock.now()
        await update($, usage, prev =>
          // 이 요청으로 지금 모델에 캐시가 생겼다 — 모델 바뀜 표시는 여기서 끝
          prev
            ? {
                ...prev,
                contextTokens: ctxNow,
                percent: prev.window > 0 ? (ctxNow / prev.window) * 100 : prev.percent,
                contextEstimated: false,
                switchedFrom: null,
                perCallExtraUsd,
                lastActivityMs: Math.max(prev.lastActivityMs ?? 0, stepAt),
                isAfterCompact: false,
              }
            : prev,
        )
        // 최적(요청당 증가 · 직후 크기)도 요청마다 — 띠가 작업 중에도 게이지와 같이 바뀐다
        await applyThresholds($)
      } catch {
        // 기록 실패가 턴을 멈추면 안 된다
      }
    }
    return result
  })

  // 도구 줄 아래 "요청 $" 는 뺐다(2026-10-11) — 금액이 답변 아래 · 도구 줄 · 띠 세 곳에 흩어져 있었다.
  // 요청마다 든 값은 질문별 비용 패널에(진행 중 질문은 맨 위에 늘 펼쳐서)

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    const now = await read($, live)
    if (!now || now.steps === 0) return next(e)
    const theirs = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    // 이 질문 값 · 그중 에이전트 몫 · 컨텍스트. 출력 토큰은 뺐다 — 판단에 안 쓰였다, 그 자리에 🤖.
    // 에이전트는 간단이면 개수만, 그 밖엔 "$ 포함"(답변 아래 · 패널과 같은 꼴)
    const agents = agentPart(now.details, viewOf(await currentSettings($)).info === 'full')
    return (
      <Box columnGap={1} alignItems="center">
        {theirs}
        <Text>
          <Text bold>
            {fmtUsd(now.cost.usd)}
          </Text>
          {agents ? <Text>{` · ${agents}`}</Text> : null}
          <Text dimColor>{L(' · 컨텍스트 ', ' · context ')}</Text>
          <Text color={LEVEL_TEXT[levelOf(now.contextTokens)]}>{fmtTokens(now.contextTokens)}</Text>
        </Text>
      </Box>
    )
  })

  // ① 턴 끝 답변 아래: 그 턴의 합계와 내역
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    if (e.props.isSummary) return next(e)
    const sums = await read($, turnSummaries)
    const summary = [...sums].reverse().find(s => endsWithTail(e.props.text, s.tail))
    if (!summary) return next(e)
    const theirs = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    const settings = await currentSettings($)
    const isFull = viewOf(settings).info === 'full'
    const line = answerLine($.ui.resolve(e), summary, isFull, e.surface)
    // 정보량 전부면 패널 "자세히" 의 펼친 질문처럼 상세(메인 · 에이전트 · 앱 자체 요청 분해 줄과 동작별 값)를 붙이되 처음엔 접힘 —
    // 늘 펼쳐 두니 답마다 길었다. 칩 첫 줄 끝 [▸ 자세히] 로 그 질문만 펴고 접는다. 동작 줄은 ├─ 같은 가지 표시
    // 없이 한 칸 들여 " - " 로. 요청 많은 질문은 비싼 동작 ANSWER_STEPS 개만(순서 그대로), 나머지는 한 줄.
    // 터미널은 칩 한 줄만 — 지난 대화 줄은 다시 그려지지 않아 누름이 안 먹을 수 있고, 상세는 사용량 패널에 있다
    const { Button } = $.ui.resolve(e)
    const canFold = isFull && e.surface !== 'terminal'
    const isOpen = canFold && (await read($, answerOpen)).includes(summary.atMs)
    // 버튼은 줄지 않게(flexShrink 0) — 첫 줄 글이 길면 "▸ / 자세히" 로 꺾였다
    const foldButton = canFold ? (
      <Box key="q-fold-box" flexShrink={0}>
        <Button key="q-fold" plain onPress={() => void toggleAnswer($, summary.atMs)}>
          <Text color={BRAND_HEX} dimColor>
            {isOpen ? L('▾ 접기', '▾ Hide') : L('▸ 자세히', '▸ Details')}
          </Text>
        </Button>
      </Box>
    ) : null
    const detailEl = isOpen ? answerDetail($.ui.resolve(e), summary) : null
    // 질문 강조: 칩이나 사용량 패널의 그 질문 줄에 마우스를 올리면 칩 · 패널 줄 · 그 답변이 함께 회색. 칩 ·
    // 패널 줄과 답변 밑 숨은 덮개가 한 hover 묶음(questionScope) — 덮개는 묶음이 빛날 때만 드러난다. 덮개(absolute)에 올린 마우스는
    // 부모에 올린 것이라 답변 글로는 반응 없음. 덮개는 답변보다 앞에 둔다 — absolute 는 앞의 것 위에 칠해져, 뒤에
    // 두면 회색이 글을 가린다. 반투명 배경(8자리 hex)을 깔았을 땐 데스크톱이 답변 아래 그리기를 통째로 받지 않았다(첫 시도 · 되돌림
    // fab644b). 한 조각씩 실물로 확인: 칩 배경 → 묶음 이름 → 테두리 덮개 → 회색 덮개. 데스크톱만, 설정으로 끈다
    const isHover = e.surface !== 'terminal' && settings.questionHover
    const scope = questionScope(summary.atMs)
    return (
      <Box flexDirection="column">
        {isHover ? (
          <Box key="q-ans" flexDirection="column">
            <Box key="q-glow" position="absolute" top={0} left={0} right={0} bottom={0} display="none" hover={{ scope, display: 'flex', backgroundColor: 'promptBorder' }} />
            {theirs}
          </Box>
        ) : (
          theirs
        )}
        {/* 데스크톱은 둥근 파란 테두리 칩(글 폭만큼) — 답변 글과 갈린다. 답변 글에 붙어 보여 한 칸 띄운다.
            터미널은 테두리가 답마다 두 줄을 늘려 글만 */}
        {e.surface === 'terminal' ? (
          line
        ) : (
          <Box key="q-cost" alignSelf="flex-start" flexDirection="column" marginTop={1} borderStyle="round" borderColor={BRAND_HEX} paddingX={1} {...(isHover ? { hover: { scope, backgroundColor: 'promptBorder' } } : {})}>
            <Box key="q-head" columnGap={2} alignItems="center">
              {line}
              {foldButton}
            </Box>
            {detailEl}
          </Box>
        )}
      </Box>
    )
  })

  // 버튼 · 자동 · /compact 어느 쪽이든 도는 동안은 띠에 "컴팩트 중" 을 그리고, 끝나면 숫자를 다시 잰다.
  // 버튼이 돌린 것은 이미 'compacting' 이고 이름도 세워 뒀다 — 그대로 둔다
  on('session.compact', async ($, e, next) => {
    await ensureLang($)
    const isMine = e.agentId === undefined && e.trigger !== 'precompute'
    if (isMine && (await read($, compactPhase)) !== 'compacting') await startCompacting($, compactKindOf(e.trigger))
    try {
      const result = await next(e)
      if (isMine && !result.skip) measureAfterCompact = true
      // 컴팩트 요청이 입력을 어떻게 냈는지(정가 · 캐시 읽기 · 쓰기 몫) — 다음 손익 계산에 쓴다
      // 컴팩트 미리 계산(엔진이 다음 컴팩트를 위해 미리 요약)도 대화 기록에 없는 요청 — 앱 자체 요청 줄로
      if (e.agentId === undefined && e.trigger === 'precompute' && !result.skip && result.usage) {
        const pre = costOf(result.usage, (await read($, usage))?.model ?? (await $.session.model()))
        if (pre) {
          trackedUsd += pre.usd
          await addAppCost($, pre.usd, L('컴팩트 미리 계산', 'compact precompute'))
        }
      }
      // 캐시가 살아 있던 컴팩트만 남긴다 — "지금 컴팩트하면" 셈(compactPayoff)은 캐시가 살아 있을 때만 쓰고, 식은 캐시는
      // coldCompact 가 따로 센다. 식은 캐시의 몫(정가 입력)이 남으면 다음 손익이 7배쯤 비싸 보였다
      const mix = isMine && !result.skip && result.usage ? compactMixOf(result.usage) : null
      if (mix && isWarmMix(mix)) await $.store.set(MIX_KEY, mix)
      // 요약을 쓴 출력 토큰 — 다음 계산식 재료(없으면 가정 OUTPUT_GUESS)
      if (isMine && !result.skip && result.usage && result.usage.output_tokens > 0) await $.store.set(OUTPUT_KEY, result.usage.output_tokens)
      // 컨텍스트 흐름에 컴팩트 한 번: 직전 크기와 실제 값(엔진이 준 토큰 × 요율). 직후 크기는 다음 요청이 채운다
      if (isMine && !result.skip) {
        const flow = await readFlow($)
        const before0 = await read($, usage)
        const parts = result.usage && before0 ? costOf(result.usage, before0.model) : null
        const measured = parts?.usd ?? null
        const before = result.tokensBefore ?? before0?.contextTokens ?? flow.points[flow.points.length - 1]?.ctx ?? 0
        const event = { atMs: await $.clock.now(), trigger: e.trigger, before, after: null, costUsd: measured, index: flow.points.length }
        await writeFlow($, { points: flow.points, compactions: [...flow.compactions, event] })
        // 저절로 펴진 바를 ✕ 로 접어 둔 것은 컴팩트로 끝난다 — 다음 컴팩트 때는 다시 펴진다
        await update($, autoDismissed, () => null)
        // 질문별 비용에도 한 줄(앱 자체 요청으로 세지 않게 우리가 본 값에 넣는다)
        if (parts) trackedUsd += parts.usd
        await addCompactStep($, parts, before)
      }
      await refreshUsage($, { categories: false, pushHistory: false })
      return result
    } finally {
      if (isMine) await update($, compactPhase, () => 'idle')
    }
  }).catch(($, e, next) => next(e)) // 다시 재기가 실패해도 컴팩트는 그대로 간다

  // 사람이 패널을 닫으면 닫아 둔다 — 같이 열기면 모든 데스크톱 세션에서, 아니면(기본 · 터미널) 이 세션만
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await setWantedView($, null)
      await update($, paneView, () => null)
      await update($, usageTab, () => 'main')
      await update($, paneModeLocal, () => null)
      await update($, settingsOpen, () => SETTINGS_OPEN_DEFAULT)
      await update($, previewOpen, () => false)
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // 저장이 실패해도 닫기는 그대로 간다

  on('command.run', { command: 'easy-compact' }, async ($, e) => {
    await ensureLang($)
    const args = e.args.trim()
    const [verb = ''] = args.split(/\s+/)
    // 동사 뒤 전부(줄바꿈 포함) — 직접 쓰는 컴팩트 문구 · 문구 프리셋 이름 · set 의 항목과 값에 쓴다
    const rest = args.slice(verb.length).trim()
    // 숨은 진단 명령: 이 세션의 패널 상태 · 질문 기록을 파일로. 도움말엔 안 싣는다
    if (['덤프', 'dump'].includes(verb.toLowerCase())) return { text: await dumpState($) }
    // 질문별 비용 최근 5 · 전체 — 패널 버튼과 같은 일(패널이 안 그려질 때 명령으로 되돌리는 길, 숨은 명령)
    if (['최근', 'recent'].includes(verb.toLowerCase()) || ['전체', 'all'].includes(verb.toLowerCase())) {
      const isAll = ['전체', 'all'].includes(verb.toLowerCase())
      await setHistoryAll($, isAll)
      return { text: isAll ? L('질문별 비용을 전체로 봅니다.', 'Cost per question: all.') : L('질문별 비용을 최근 5개로 봅니다.', 'Cost per question: last 5.') }
    }
    const settingsReply = await settingsCommand($, verb, rest)
    if (settingsReply !== null) return { text: settingsReply }
    // 보이기 · 안보이기(와 숨은 명령 — 최소 · 최대 · 자동숨김 · 패널)는 settingsCommand 의 bandShortcut 이 받는다
    if (['?', 'help', '-h', '--help', '도움말'].includes(verb.toLowerCase())) return { text: help() }
    // 모르는 말엔 한 줄만 — 명령 출력은 대화 기록에 남아 다음 요청이 같이 읽는다
    if (verb !== '')
      return {
        text: L(
          '모르는 명령입니다. 명령은 /easy-compact 보이기 · 안보이기 — 나머지는 바의 버튼(📊 패널 · ⚙ 설정 탭)',
          'Unknown command. Commands: /easy-compact show · hide — everything else is on the bar (📊 pane · ⚙ Settings tab)',
        ),
      }
    // 흐름 먼저 — 사용량은 컴팩트 직후인지를 흐름에서 본다
    await loadFlow($, { fromTranscript: true })
    // 다시 읽기: 기본 적재(/context 분류)도 다시 잰다 — 계산식 최적의 재료
    await refreshUsage($, { categories: true, pushHistory: false })
    await followModel($)
    return { text: L('사용량 · 세션 기록(컨텍스트 흐름)을 다시 읽었습니다.', 'Re-read usage · the session transcript (context flow).') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // 패널 그리기가 던지면 데스크톱은 "Nothing to show yet — has not drawn" 만 보여 원인을 알 수 없었다(2026-10-13: 한 세션에서만 패널이
    // 안 열림). 던진 것은 패널에 빨간 글로 보이고 로그에도 남긴다
    try {
    await ensureLang($)
    setSurface(e.surface)
    const ui = $.ui.resolve(e)
    if (oldEngine) return oldEngineNote(ui, oldEngine)
    const { Box, Button } = ui
    const isSettings = (await read($, usageTab)) === 'settings'
    // 탭: 고른 쪽은 채운 버튼 + ✓, 다른 쪽은 흐린 보조 버튼 — 흐림 차이만으론 지금 보는 쪽이 안 읽혔다
    const tab = (key: string, label: string, isOn: boolean, onPress: () => void) =>
      isOn ? (
        <Button key={`pane-${key}`} label={`✓ ${label}`} variant="primary" onPress={onPress} />
      ) : (
        <Button key={`pane-${key}`} label={label} variant="secondary" dimColor onPress={onPress} />
      )
    // 데스크톱 패널은 한글이 칸 계산보다 넓게 그려져 오른쪽 끝이 가려진다 — 폭의 1할가량을 비워 둔다
    // 터미널은 칸이 정확해 한 칸만(마지막 칸에 쓰면 줄이 넘어가는 터미널이 있다)
    const isTerminal = e.surface === 'terminal'
    const pad = isTerminal ? 1 : Math.max(3, Math.round(e.props.bodyColumns * 0.1))
    const cols = Math.max(24, e.props.bodyColumns - pad)
    // 막대 폭: 패널 글자 칸 수를 대략 px 로(데스크톱 SVG 용)
    // 그래프 · 막대는 카드 안에 그린다 — 카드 테두리 · 여백만큼 좁게. 터미널 칸 그림은 px ÷ 6 = 칸이라 상한 없이 카드 안 폭 그대로
    const widthPx = isTerminal ? Math.max(120, (cols - CARD_INSET) * 6) : Math.max(120, Math.min(320, Math.round((e.props.bodyColumns - pad - CARD_INSET) * 6)))
    const u = await read($, usage)
    const allSums = await read($, turnSummaries)
    const nowMs = u || allSums.length > 0 ? await $.clock.now() : 0
    const flowNow = await readFlow($)
    // 계산식 재료(컴팩트 직후 크기 · 요약 · 출력 · 입력 몫)와 최적 — 막대의 상주 · 컴팩트 판단 · 미룬 값 게이지 · 설정이 같은 값을 쓴다
    const opt = await read($, optimal)
    const inputsNow = opt?.inputs ?? null
    const perm = permanentOf(flowNow, (await read($, flowNote)) !== null, inputsNow?.after ?? null)
    const g = gridOf(e.surface)
    // 사용량 = 위에서부터: 컨텍스트 · 비용(다섯 줄 남짓, 자리 고정) → 질문별 비용(맨 위 진행 중 질문) → 컴팩트(게이지 · 판단 ·
    // 접힌 그래프) → 참고(요율 · 색 기준). 예전엔 진행 중 질문이 맨 아래라 안 보였다. 컴팩트 카드는 아래로
    // 내려가도 된다 — 띠의 컴팩트 버튼이 🟡/🔴 로 이미 알린다
    let body: unknown
    if (isSettings) {
      const sSet = await currentSettings($)
      const estSet = u ? estimateFor(u, nowMs) : null
      // 화면 칸 미리보기: 지금 고른 화면 · 한도 줄 · 금액 색으로 이 세션 값을 바처럼(최대 크기)
      // 아래에 답변 아래 칩 견본(마지막 질문, 접힌 꼴) — 정보량에 따라 [▸ 자세히] 가 있고 없다
      const lastSum = allSums.length > 0 ? allSums[allSums.length - 1]! : null
      // 아직 잰 값 · 끝난 질문이 없으면(새 세션) 예시 값으로 — 빈 자리만으론 무엇이 보일지 몰랐다
      const pvModel = u?.model ?? ((await $.session.model().catch(() => '')) || 'claude-opus-5-5')
      const pvTurn = lastSum ?? sampleTurn(nowMs, pvModel)
      const bandPreview = drawBandPreview(ui, e.surface, u ?? sampleUsage(nowMs, pvModel), nowMs, inputsNow, bandShowOf(sSet), sSet.sessionColors, pvTurn, sSet.screen === 'simple')
      const preview =
        bandPreview ? (
          <Box key="pv" flexDirection="column">
            {bandPreview ? <ui.Text>{L('바 — 세션 채팅 입력창 위(최대 크기)', "Bar — above the session's chat input (full size)")}</ui.Text> : null}
            {bandPreview ? (
              <ui.Text dimColor wrap="wrap">
                {L(
                  '채팅 입력창 바로 위에 늘 떠 있는 줄입니다. 세션 금액 · 컨텍스트 · 캐시와 이지 컴팩트 버튼이 있습니다.',
                  'Always shown right above the chat input: session cost, context, cache and the Easy Compact button.',
                )}
                {u
                  ? L(' 아래 견본은 이 세션 값입니다.', ' The sample below uses this session.')
                  : L(' 아래 견본은 예시 값입니다 — 첫 질문이 끝나면 이 세션 값으로 바뀝니다.', ' The sample below uses example values until the first question ends.')}
              </ui.Text>
            ) : null}
            {bandPreview}
            {answerPreview($, ui, pvTurn, lastSum === null, viewOf(sSet).info === 'full', e.surface, await read($, previewOpen), sSet.questionHover)}
          </Box>
        ) : null
      body = drawSettingsView(
        settingsActs($),
        ui,
        sSet,
        opt,
        await read($, tidyDraft),
        await read($, tidyRawOpen),
        await read($, compactPhase),
        await read($, compactKind),
        e.surface,
        await read($, cmpDraft),
        (await read($, usage))?.contextTokens ?? null,
        autoLang,
        cols,
        await read($, settingsOpen),
        {
          ttl: ttlOf(await read($, usage)),
          measured: (await read($, usage))?.cacheTtlMeasured === true,
          // 캐시 칸 "지금" 줄 — 바와 같은 셈(estimateFor)
          minsLeft: estSet?.kind === 'warm' ? estSet.minsLeft : null,
          isCold: estSet?.kind === 'cold',
          config: (await read($, ttlConfig)) ?? (await readTtlConfig($)),
        },
        preview,
        // 이 세션이 한도를 받나: 받았으면 true, 요청이 끝났는데도 비었으면 false, 첫 응답 전이면 모름(null — 구독도 비어 있다)
        u ? (u.rateLimits.length > 0 ? true : allSums.length > 0 ? false : null) : null,
      )
    } else {
      const nowTurn = await read($, live)
      const phase = await read($, compactPhase)
      const kind = await read($, compactKind)
      // 질문 내역은 패널 보기를 따른다: 간략이면 펼친 질문 · 진행 중 질문에 동작별 줄 없이 "요청 N회 · 총 $" 한 줄, 질문 글도
      // 줄여서
      const qDetail = (await paneModeNow($)) === 'simple' ? 'summary' : 'steps'
      // 진행 중 질문은 보내자마자(첫 요청이 끝나기 전에도) — 첫 요청이 끝나야 보이면 도구 없이 한 번에 끝나는 질문은
      // 끝날 때까지 안 보였다(2026-10-11 CLI)
      const liveEl =
        nowTurn
          ? liveBlock(ui, nowTurn, allSums[allSums.length - 1], cols - CARD_INSET, g, e.surface, phase, kind, qDetail)
          : phase === 'compacting'
            ? compactingBlock(ui, g, e.surface, kind)
            : null
      const flowParts = drawFlow(ui, e.surface, flowNow, await read($, flowLoaded), await read($, flowNote), u, widthPx, await read($, effectsAll), isAll => void setEffectsAll($, isAll), nowMs, opt, await read($, flowAll), isAll => void setFlowAll($, isAll), flowNow.questions ?? [])
      const effEl = u && inputsNow ? drawEfficiency(ui, u, allSums, nowMs, perm ? { ...inputsNow, after: perm.tokens } : inputsNow) : null
      // 카드 접기(간략 보기): 접으면 제목 줄의 요약만. 세션마다 따로 기억
      const open = await read($, cardsOpen)
      const foldOf = (which: 'now' | 'history' | 'compact'): Fold => ({ isOpen: open[which], onToggle: () => void toggleCard($, which) })
      const liveNote =
        nowTurn
          ? L(`진행 중 ${fmtUsd(nowTurn.cost.usd)}`, `running ${fmtUsd(nowTurn.cost.usd)}`)
          : phase === 'compacting'
            ? L('컴팩트 중', 'compacting')
            : null
      const history = drawHistory({ setAll: isAll => void setHistoryAll($, isAll), toggle: id => void toggleExpanded($, id) }, ui, allSums, nowMs, await read($, expandedTurn), await read($, historyAll), liveEl, cols - CARD_INSET, g, foldOf('history'), liveNote, qDetail, !isTerminal && (await currentSettings($)).questionHover)
      // 같은 질문들을 다른 모델 요율로(9c) — 간략은 비용 요약 안, 자세히는 컨텍스트 · 비용 카드 안
      const modelLine = u ? modelCompareText(allSums, u.model, ttlOf(u)) : null
      // 세션 금액 색 기준은 화면 값(바와 같은 색)
      const sPane = await currentSettings($)
      const colors = sPane.sessionColors
      // 간략(12): 비용 요약(세션 · 질문 · 메인/🤖/⚙ · 지금 한 줄 · 컴팩트 판단) + 질문별 비용. 자세히: 지금까지의 패널 전부.
      // "지금" 한 줄은 지금 화면의 바 비용 줄에서 이 세션 금액만 뺀 것(카드 제목에 있다) — 간단이면 컨텍스트 · 캐시만.
      // 간략엔 모델 견줌 줄을 안 붙인다(정보 최소), 자세히의 컨텍스트 · 비용 카드에
      const nowShow = { ...bandShowOf(sPane), session: false }
      body =
        (await paneModeNow($)) === 'simple' ? (
          <Box flexDirection="column">
            {drawSummary(ui, u, allSums, u ? drawEstimateLine(ui, u, nowMs, inputsNow, nowShow) : null, effEl, null, foldOf('now'), colors)}
            {history}
          </Box>
        ) : (
          <Box flexDirection="column">
            {drawNow(ui, e.surface, u, nowMs, widthPx, perm, inputsNow, foldOf('now'), modelLine, colors)}
            {history}
            {drawCompactCard(ui, flowParts, effEl, foldOf('compact'))}
            {drawReference(ui, u, allSums.length > 0 ? allSums[allSums.length - 1]! : null, nowMs)}
          </Box>
        )
    }
    const paneMode = await paneModeNow($)
    return (
      // 폭을 못 박는다 — 데스크톱은 줄을 안 바꾸는 글(버튼 이름 등)이 길면 안쪽 틀이 그만큼 넓어져 다른 글이
      // 넓어진 틀에서 줄을 바꾸고 패널 밖으로 잘렸다(화면 크기와 상관없이)
      <Box flexDirection="column" width={cols}>
        {/* 탭: 사용량 · 설정. 설정은 자주 안 열어 탭으로 — 자주 보는 건 사용량 한 줄기에 둔다(예전에 질문별
            비용을 따로 열었더니 오가기 불편했다) */}
        <Box key="pane-tabs" columnGap={1} flexWrap="wrap">
          {tab('usage', withIcon('📊', paneTitle()), !isSettings, () => void openUsageTab($, 'main'))}
          {tab('settings', withIcon('⚙', L('설정', 'Settings')), isSettings, () => void openUsageTab($, 'settings'))}
          {/* 사용량 탭에서 바로 간략 ⇄ 자세히 — 이 세션 보기만(기본은 설정 탭 "화면" 값, 프리셋은 세부를 못 바꾼다) */}
          {isSettings ? null : (
            <Box key="pane-mode" columnGap={1} marginLeft={2}>
              {tab('simple', paneModeName('simple'), paneMode === 'simple', () => void setPaneMode($, 'simple'))}
              {tab('detail', paneModeName('detail'), paneMode === 'detail', () => void setPaneMode($, 'detail'))}
            </Box>
          )}
        </Box>
        <Box marginTop={1}>{body}</Box>
      </Box>
    )
    } catch (err) {
      log($, `pane render failed: ${String((err as Error)?.stack ?? err)}`)
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box key="pane-error" flexDirection="column">
          <Text color="red" wrap="wrap">{L('easy-compact 패널을 그리다 오류가 났습니다 — 이 글을 알려 주세요', 'easy-compact failed to draw this pane — please report this text')}</Text>
          <Text dimColor wrap="wrap">{String((err as Error)?.stack ?? err).slice(0, 1500)}</Text>
        </Box>
      )
    }
  })

  // 바가 접혀 있으면(자동 숨김으로 노랑 전 · ✕ 로 닫음) 입력창 아래 오른쪽 모드 줄에 [🔽 이지 컴팩트 ⇱] 하나 — 누르면
  // 늘 보이기. 바가 통째로 사라지니 다시 켜려면 명령을 쳐야 했다. 입력창 위 자리는
  // 계속 빈다. 자동 숨김이면 강조 버튼(primary), 닫았으면 회색 + "닫힘"(revealLabel). 마우스 올리기 칩은 두지 않는다 — 이
  // 줄은 칩을 숨기지 못해 칩 글이 "자동 …" 으로 늘 보였다. 엔진 모드 글 · 다른 mod 버튼(next — 개인용
  // session-tree-viewer 의 🌳 등)은 앞에 그대로.
  // 이 줄(데스크톱 SessionMode, 엔진 문서상 "흐린 모드 글" 자리)의 규칙 — 여러 mod 가 같이 써도 안 깨지게:
  //   1) 버튼 하나만 넣는다. 버튼 밖 글자 · 상자는 줄 끝으로 모인다(파란 🗜 를 버튼 밖에 두자 🌳 뒤로 떨어졌다)
  //   2) 색은 원래 색이 있는 그림 글자로만(🌳 초록 · 🔽 파랑) — 버튼 안 글자는 테마 색 · hex 어느 쪽을 줘도 앱 버튼 색이다
  //   3) 폭이 좁다 — 글이 길면 뒤 버튼(🌳)이 밀린다. 강조(primary)도 흐리게 그려진다
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const inner = await next(e)
    if (!(await isBandTucked($))) return inner
    await ensureLang($)
    setSurface(e.surface)
    const { Box, Button } = $.ui.resolve(e)
    const isClosed = bandShowMode(await currentSettings($)) === 'never'
    return (
      <Box key="ec-mode" columnGap={1} alignItems="center">
        {inner}
        <Button
          key="band-reveal"
          label={revealLabel(isClosed)}
          {...(isClosed ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
          onPress={async () => {
            await update($, autoDismissed, () => null)
            await saveSettings($, setBandShow(await currentSettings($), 'always'))
          }}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    // 접힌 바(✕ — 모든 세션, 컴팩트할 때 자동으로 펴기면 그때까지) — 띠 자리를 엔진에 돌려준다. 입력창 아래 버튼과 같은 판단
    const sNow = await currentSettings($)
    if (e.props.hasSurvey || (await isBandTucked($))) {
      return next(e)
    }
    if (oldEngine) return oldEngineNote($.ui.resolve(e), oldEngine)

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const u = await read($, usage)
    const view = await read($, paneView)
    // 버튼엔 크기를 안 붙인다 — 바로 왼쪽 줄에 컨텍스트 · 컴팩트 구간이 있다. 이름은 mod 이름 "이지 컴팩트":
    // 띠에 mod 이름이 따로 없고, 앱 기본 컴팩트(진행 글 "클로드 기본 compact")와 갈린다
    const compactCore = L('이지 컴팩트', 'Easy Compact')
    // 바의 🗜 는 컴팩트 단계 색과 상관없이 진한 파랑(BRAND_HEX) 글자로, 버튼 · 진행 글 밖에 따로 둔다. 🗜 는 글자처럼 그려지는 기호라 감싼
    // 글의 색을 따라가 평소 흰색 · 답 도는 중 회색 · 컴팩트 중 청록 · 저장 중 노랑 · 확인창 파랑으로 바뀌었다 — 상태에
    // 영향 받지 않게 파랑. 상태는 깜빡이는 점 · 버튼 글 · 강조 버튼으로만 — 버튼 이름의 🟡 · 🔴 · 🧊 · 🔄 도 뺐다(🗜
    // 와 그림 둘이 붙는다). 아이콘은 버튼 밖. 터미널은 아이콘 없이. 답 도는 중엔 누를 수 없으니 색 없이 흐리게(offIcon) —
    // 비활성이면 색이 없어야 맞다. 저장 · 컴팩트 중은 이지 컴팩트가 하는 일이라 파랑 그대로
    const iconBox = (look: { color: string } | { dimColor: true }) =>
      iconOf('🗜') ? (
        <Box key="compact-icon">
          <Text {...look}>{iconOf('🗜')}</Text>
        </Box>
      ) : null
    const brandIcon = iconBox({ color: BRAND_HEX })
    const offIcon = iconBox({ dimColor: true })
    const isConfirming = !e.props.isWorking && (await read($, isConfirmingCompact))
    const nowMs = u ? await $.clock.now() : 0
    // 띠 크기(창 상태): 최대 = 세 줄, 최소 = 한 줄(이 세션 · 요청당 · 컨텍스트 · 컴팩트 구간). 칸은 화면 값(프리셋 · 커스텀)이 정한다.
    // 최대가 이미 한 줄이면(한도 줄 · 질문 줄 없음 — 간단 등) 최소와 같은 것: 최소여도 최대 한 줄을 그리고 [—] 를 뺀다. 예전엔
    // 최소가 줄은 그대로 캐시 칸만 빼 "캐시 보이기 · 안 보이기" 처럼 동작했다
    // 간단 화면은 한 줄 고정 — 한도 줄을 그리지 않고 [—] 도 없다
    const isLean = sNow.screen === 'simple'
    const fullShow = bandShowOf(sNow)
    const hasLimitsRow = !isLean && (u?.rateLimits ?? []).some(r => (r.kind === 'five_hour' ? fullShow.fiveHour : r.kind === 'seven_day' ? fullShow.sevenDay : true))
    const isOneRow = isLean || (!hasLimitsRow && !fullShow.lastTurn)
    const mode = isOneRow ? 'full' : sNow.band
    const show = mode === 'full' ? fullShow : minShowOf(fullShow)

    // 왼쪽 = 비용 영역(두 줄), 오른쪽 = 버튼 영역. 둘 사이에 세로줄을 둔다
    const sums = await read($, turnSummaries)
    const now = e.props.isWorking ? await read($, live) : null
    // 쉬는 동안 캐시가 식었거나 모델을 바꿨으면(다음 요청이 전체를 다시 씀) 지난 질문 줄은 숨긴다 — "캐시 만료 · 재작성"
    // 줄과 지난 질문의 "캐시 다시 씀" 이 같이 보여 어느 게 지금 일인지 헷갈렸다. 지난 질문 값은 사용량 패널에 있다.
    // 컴팩트 뒤 첫 요청 전도 같다 — 컴팩트 전 저장 턴의 "캐시 다시 씀" 이 지금 일처럼 읽혔다
    const lineEst = u && !e.props.isWorking ? estimateFor(u, nowMs) : null
    const lastLine =
      mode !== 'full' || !show.lastTurn || lineEst?.kind === 'cold' || u?.isAfterCompact ? null : drawLastTurnLine(ui, sums.length > 0 ? sums[sums.length - 1]! : null, now)
    // 컴팩트 직후 크기 · 입력 몫 등 계산식 재료(measureOptimal) — 식은 캐시 줄 · 버튼 판단 · 확인창이 같은 값을 쓴다.
    // 모르면(직후 크기를 못 잼) 컴팩트 손익을 안 보인다
    const inputs = (await read($, optimal))?.inputs ?? null
    const afterTokens = inputs?.after ?? u?.contextTokens ?? 0
    const estimateLine = u
      ? drawEstimateLine(ui, u, nowMs, inputs, show, sNow.sessionColors, mode !== 'full')
      : emptyLine(ui, 'b-none', L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes'))

    // 버튼: 패널(세션 트리 · 사용량)은 맨 윗줄 오른쪽, 컴팩트는 비용 줄 오른쪽. 확인은 띠 아래 한 덩어리로 펼친다
    const level = u ? levelOf(u.contextTokens) : 'ok'
    const phase = await read($, compactPhase)
    const look = phaseLook(phase, await read($, compactKind), false)
    const est = u ? estimateFor(u, nowMs) : null
    // 캐시가 없는 까닭: 60분 지나 만료 · 모델을 바꿔 새 모델엔 없음 — 버튼 · 확인창 글만 다르고 셈은 같다
    const isSwitched = est?.kind === 'cold' && est.reason === 'model'
    // 캐시가 식었고 바로 컴팩트가 그냥 이어 가기보다 싸면 버튼을 "바로 컴팩트 권장" 으로(정리 단계 없이)
    const cold = u && inputs && est?.kind === 'cold' ? coldFor(u, inputs) : null
    const isColdWin = cold !== null && cold.compactUsd < cold.continueUsd
    // 캐시가 식었는데 바로 컴팩트가 이어 가기보다 비싼 크기면 권장 · 강조를 띄우지 않는다(정리 후 컴팩트는 정리 질문이
    // 전체를 다시 써 더 비싸다). 줄인 만큼은 그 뒤 요청들에서 천천히 돌아올 뿐이다
    const shownLevel = est?.kind === 'cold' && !isColdWin ? 'ok' : level
    const pulse = (hex: string, alt: string) => pulseDot(ui, e.surface, hex, alt)
    // 마우스를 올리면 버튼 바로 왼쪽에 설명 칩: 엔진 문서의 꼴 그대로 — 키 있는 상자(버튼을 감싼다) 안에 display none 인
    // absolute 칸을 두고 hover 에 display flex. 칩엔 키를 주지 않는다(키가 있으면 칩 자신이 hover 범위가 돼 안 드러난다).
    // 처음엔 버튼 hover scope 로 다른 칸을 켜게 했는데 데스크톱에서 안 떴다. absolute 라 줄이 안 밀리고, 바탕색으로
    // 아래 글을 가린다. key 엔 버튼 상태를 붙인다(…-open · …-on 등) — 눌러서 패널이 열리고 닫혀 바 폭이 바뀌면 마우스가
    // 떠나도 칩이 켜진 채 남았다. 상태가 바뀌면 상자가 새것이라 hover 가 안 남는다
    const withTip = (key: string, button: unknown, text: string) => (
      <Box key={key}>
        {button}
        <Box position="absolute" top={0} right={4} display="none" hover={{ display: 'flex' }} backgroundColor="promptBorder" paddingX={1}>
          <Text wrap="truncate-end">{text}</Text>
        </Box>
      </Box>
    )
    // 컴팩트 시점(설정): 구간이면 시작부터 노랑 "컴팩트하기 좋은 때", 끝부터 빨강 "컴팩트 늦어짐" + 깜빡이는 점.
    // 직접 지정이면 그 80% 부터 노랑, 정한 크기부터 빨강 "컴팩트 권장"
    const isRange = thresholds().isRange === true
    // 손익(확인 카드와 같은 셈): 컴팩트로 요청 · 질문마다 얼마 아끼고 몇 번이면 본전인지
    const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
    const pay = u && inputs && est?.kind === 'warm' ? compactPayoff(u.contextTokens, inputs, u.model, callsPerQ) : null
    // 아낄 게 거의 없음(본전 없음 · 줄어드는 몫이 작음) — 툴팁 · 카드 · 저장 프롬프트가 같은 판정
    const isLittle = pay !== null && u !== null && isLittleToSave(u.contextTokens, afterTokens, pay.breakEvenCalls)
    // 컴팩트를 권하지 않는 동안(구간 전 · 방금 컴팩트함 · 식었어도 컴팩트가 더 비쌈) 🗜 는 회색, 까닭은 툴팁으로 — 대부분의
    // 시간이 이 상태라 글을 붙이면 바가 늘 길어진다. 처음엔 버튼을 흐리게(dimColor) 했는데 데스크톱은 버튼 흐림을 안
    // 그렸다 — 버튼 밖 아이콘은 색이 먹는다. 버튼의 dimColor 는 터미널(아이콘 없음)에서 흐리게 보여 남긴다.
    // 눌러 확인창을 여는 건 그대로
    const isNotNow = shownLevel === 'ok' && !isColdWin
    const thr = thresholds()
    // 식었는데 바로 컴팩트가 더 비싸 권하지 않는 때는 그 까닭으로 — "아직 컴팩트할 때가 아님 · 구간" 은 구간 안이어도 떠 카드의
    // "손해" 와 엇갈렸다
    const coldTip =
      est?.kind === 'cold' && !isColdWin
        ? cold
          ? L(
              `${isSwitched ? '모델 바뀜' : '캐시 만료'} · 지금 바로 컴팩트하면 ~${fmtUsd(cold.compactUsd - cold.continueUsd)} 더 듦 — 그냥 이어 가는 편이 쌈`,
              `${isSwitched ? 'Model switched' : 'Cache expired'} · compacting now costs ~${fmtUsd(cold.compactUsd - cold.continueUsd)} more — continuing as is is cheaper`,
            )
          : L(`${isSwitched ? '모델 바뀜' : '캐시 만료'} · 다음 요청이 다시 씀`, `${isSwitched ? 'Model switched' : 'Cache expired'} · the next request rewrites it`)
        : null
    const notNowTip =
      coldTip ??
      (isLittle
        ? L('지금 컴팩트하면 손해 — 아낄 게 거의 없음(컨텍스트가 이미 작음)', 'Compacting now is a loss — little to save, the context is already small')
        : thr.isRange
          ? L(`아직 컴팩트할 때가 아님 · 구간 ${fmtTokens(thr.ctxWarn)}~${fmtTokens(thr.ctxCut)}`, `Not time to compact yet · range ${fmtTokens(thr.ctxWarn)}–${fmtTokens(thr.ctxCut)}`)
          : L(`아직 컴팩트할 때가 아님 · 기준 ${fmtTokens(thr.ctxCut)}`, `Not time to compact yet · compact at ${fmtTokens(thr.ctxCut)}`))
    const compactText =
      shownLevel === 'cut'
        ? isRange
          ? L('컴팩트 늦어짐', 'Compact overdue')
          : L('컴팩트 권장', 'Compact advised')
        : shownLevel === 'warn' && isRange
          ? L('컴팩트하기 좋은 때', 'Good time to compact')
          : compactCore
    // 진행 중엔 버튼 대신 글자 — 눌러도 아무 일 없다
    const compactRow =
      phase === 'compacting' && look ? (
        <Box columnGap={1} alignItems="center">
          {brandIcon}
          {pulse(look.hex, L('컴팩트 중', 'Compacting'))}
          <Text color={look.color}>{look.text}</Text>
        </Box>
      ) : phase === 'tidying' && look ? (
        <Box columnGap={1} alignItems="center">
          {brandIcon}
          {pulse(look.hex, L('저장 중', 'Saving'))}
          <Text color={look.color}>{look.text}</Text>
          <Button key="compact-cancel" label={L('취소', 'Cancel')} variant="secondary" onPress={() => update($, compactPhase, () => 'idle')} />
        </Box>
      ) : e.props.isWorking ? (
        // 턴이 도는 중엔 누를 수 없다(버튼이 아니라 글자) — 끝나면 버튼으로 돌아온다
        <Box columnGap={1} alignItems="center">
          {offIcon}
          <Text dimColor>{L(`${compactCore} · 답이 끝나면 누를 수 있음`, `${compactCore} · available when the answer ends`)}</Text>
        </Box>
      ) : isConfirming ? (
        // 확인창이 열린 자리를 다시 누르면 닫힌다(글자였을 땐 눌러도 반응이 없었다)
        <Box columnGap={1} alignItems="center">
          {/* 아이콘은 버튼 밖 — 카드 제목 아이콘과 짝. 권하지 않는 동안 연 확인창이면 닫힌 바처럼 회색(회사 세션: 회색 🗜 를
              눌렀더니 파랑으로 바뀌어 권하는 것처럼 보였다) */}
          {isNotNow ? offIcon : brandIcon}
          {/* "컴팩트 열림" 은 컴팩트가 도는 것처럼 읽혔다 — 원래 이름에 닫기 표시만(상태는 아래 카드가 보인다) */}
          <Button key="compact-close" label={L('이지 컴팩트 ✕', 'Easy Compact ✕')} variant="secondary" onPress={() => update($, isConfirmingCompact, () => false)} />
        </Box>
      ) : (
        <Box columnGap={1} alignItems="center">
          {phase === 'held' ? <Text color="yellow">{withIcon('⏸', L('보류됨', 'On hold'))}</Text> : null}
          {/* 권하지 않는 동안 🗜 는 회색 — 데스크톱은 버튼 흐림(dimColor)을 안 그려 버튼으론 "아직" 이 안 보였다 */}
          {isNotNow ? offIcon : brandIcon}
          {/* 상태는 깜빡이는 점(파랑 = 식은 캐시 · 모델 바뀜, 빨강 = 늦어짐 · 권장, 노랑 = 좋은 때 · 곧)과 강조 버튼으로 */}
          {isColdWin
            ? pulse('#4c9be8', isSwitched ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired'))
            : shownLevel === 'cut'
              ? pulse('#e05555', isRange ? L('컴팩트 늦어짐', 'Compact overdue') : L('컴팩트 권장', 'Compact advised'))
              : shownLevel === 'warn'
                ? pulse('#e0b040', isRange ? L('컴팩트하기 좋은 때', 'Good time to compact') : L('곧 컴팩트할 때', 'Compact soon'))
                : null}
          {withTip(
            `band-compact-tip-${isNotNow ? 'not-now' : shownLevel}`,
            <Button
              key="compact"
              label={
                isColdWin
                  ? isSwitched
                    ? L('모델 바뀜 · 바로 컴팩트 권장', 'Model switched · compact now advised')
                    : L('캐시 만료 · 바로 컴팩트 권장', 'Cache expired · compact now advised')
                  : compactText
              }
              {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
              onPress={() => update($, isConfirmingCompact, () => true)}
            />,
            isNotNow ? notNowTip : L('누르면 컴팩트할까요?', 'Press to open Compact now?'),
          )}
        </Box>
      )

    // 확인창은 대화상자 꼴: 위에 선택지마다 "이름 · 하는 일"(한 줄에 들게 짧게), 맨 아래 오른쪽에 버튼
    // [저장하고 컴팩트] [바로 컴팩트] [✕ 취소] — 식은 캐시여도 자리는 같고 주 버튼(▶)만 바뀐다.
    // 버튼을 왼쪽에 세로로 두니 설명과 섞였고, 한 줄 왼쪽에 셋이면 탭처럼 읽혔다.
    // 띠에 여유가 있으면 줄 사이를 한 칸씩 띄운다(넘치면 띠가 스크롤된다)
    const tidyNow = tidySteps(sNow)
    // 띠 높이(maxRows)에서 남는 줄만큼 카드 안을 띄운다 — 넘치면 띠가 스크롤돼 버튼이 가려진다.
    // 기본 줄 수 = 띠 두 줄(+ 한도 줄) + 테두리 2 + 제목 + 효과 줄 + 문구 고르기 + 선택지 2 + 버튼, 좁으면 효과 줄 · 문구 고르기 ·
    // 선택지가 줄바꿈된다.
    // 띄우는 순서: 효과 줄 아래 → 효과 줄 위 → 버튼 위
    const isWide = e.props.bodyColumns >= 115
    // 한도 줄: 구독 세션만(엔진이 API 키 세션엔 한도를 안 준다), 5시간 · 7일을 다 빼도 없다 — 없으면 비용 줄이 맨 윗줄로 오른다
    const limitsLine = hasLimitsRow && u ? drawLimitsLine(ui, e.surface, u, nowMs, show) : null
    // 좁은 터미널이면 창 버튼을 한도 줄 위 따로 한 줄에(아래 그리기)
    const isNarrowTerminal = e.surface === 'terminal' && e.props.bodyColumns < 100
    const baseRows = (limitsLine ? (isNarrowTerminal ? 4 : 3) : 2) + 2 + 1 + (isWide ? 1 : 2) + (isWide ? 1 : 2) + (isWide ? 2 : 4) + 1
    // 데스크톱 띠는 maxRows 보다 넉넉히 그린다(12줄 확인창도 잘리지 않았다) — 계산대로면 늘 0 이하라 띄우기가 꺼져 있었다
    const spare = e.surface === 'desktop' ? 3 : e.props.maxRows - baseRows
    const gapBelowSummary = spare >= 1 ? 1 : 0
    const gapAboveSummary = spare >= 2 ? 1 : 0
    const gapAboveActions = spare >= 3 ? 1 : 0
    const explain = (key: string, name: string, desc: unknown) => (
      <Box key={key} columnGap={1}>
        <Box width={16} flexShrink={0}>
          <Text bold>{name}</Text>
        </Box>
        <Text dimColor>:</Text>
        <Box flexShrink={1} minWidth={0}>
          <Text wrap="wrap">{desc}</Text>
        </Box>
      </Box>
    )
    // 알림 카드: 제목(파랑) / 무엇이 얼마나 · 얼마 / 선택지 / 버튼 — 덩어리마다 한 칸 띄우고, 본문은 제목 아래로
    // 들여 쓴다(가운데 정렬은 긴 줄이 줄바꿈될 때 시작이 들쭉날쭉해 훑기 어렵다). 테두리는 흐린 회색이 잘 안 보여
    // 제목과 같은 파랑(테마 색 suggestion — 밝은 · 어두운 테마 둘 다 맞춘다)
    // 제목은 흰색, 아이콘만 파랑 — 테두리와 이어지고 글은 잘 읽힌다. 권하지 않는 동안(isNotNow)은 아이콘도 바처럼 회색
    const card = (key: string, icon: string, title: string, summary: unknown, rows: unknown[], isColdFirst: boolean) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={2}>
        {/* 아이콘과 글 사이는 공백 문자가 아니라 칸 간격 — 데스크톱은 글 조각 앞뒤 공백을(줄바꿈 없는 공백도) 잘라 붙어 보였다 */}
        <Box columnGap={1}>
          {iconOf(icon) ? (
            <Text bold {...(isNotNow ? { dimColor: true } : { color: ACCENT })}>
              {iconOf(icon)}
            </Text>
          ) : null}
          <Text bold>{title}</Text>
        </Box>
        <Box paddingLeft={3} marginTop={gapAboveSummary} marginBottom={gapBelowSummary}>
          {summary}
        </Box>
        <Box flexDirection="column" paddingLeft={3}>
          {rows}
        </Box>
        {actions(isColdFirst)}
      </Box>
    )
    // 버튼엔 크기 속성이 없다(높이는 앱이 정한다) — 굵은 글자와 양옆 여백으로 조금 크게 보인다.
    // 여백은 줄바꿈 없는 공백: 보통 공백은 데스크톱이 지워 버린다
    const pad = (text: string) => `\u00a0\u00a0${text}\u00a0\u00a0`
    const wide = (text: string) => <Text bold>{pad(text)}</Text>
    // 손해면(식었는데 바로 컴팩트가 이어 가기보다 비쌈 · 아낄 게 거의 없음) 컴팩트 버튼을 다 막고 "작업을 이어 가세요" 만 알린다.
    // 돈 판단은 mod 가 숫자로 한다 — 세션에 맡기면 정보 손실만 보고 진행했다. 바로 컴팩트도
    // 막는다: 버튼은 이득인 길을 쉽게 하는 것이고, 손해를 알고도 할 까닭이 있으면 /compact 를 직접 친다(카드에 적음).
    // 손익을 모르면(입력 값 없음) 막지 않는다
    const isLoss = (cold !== null && !isColdWin) || isLittle
    const actions = (isColdFirst: boolean) => (
      <Box key="actions" justifyContent="flex-end" alignItems="center" columnGap={2} marginTop={gapAboveActions}>
        {isLoss ? (
          // 닫기만 — 키는 취소와 같다(같은 일)
          <Button key="compact-no" label={pad(L('✓ 확인 · 이어 가기', '✓ OK · keep working'))} variant="primary" onPress={() => update($, isConfirmingCompact, () => false)}>
            {wide(L('✓ 확인 · 이어 가기', '✓ OK · keep working'))}
          </Button>
        ) : (
          [
            <Button
              key="compact-tidy"
              label={pad(isColdFirst ? L('저장하고 컴팩트', 'Save & compact') : L('▶ 저장하고 컴팩트', '▶ Save & compact'))}
              variant={isColdFirst ? 'secondary' : 'primary'}
              onPress={() => tidyThenCompact($)}
            >
              {wide(isColdFirst ? L('저장하고 컴팩트', 'Save & compact') : L('▶ 저장하고 컴팩트', '▶ Save & compact'))}
            </Button>,
            <Button
              key="compact-yes"
              label={pad(isColdFirst ? L('▶ 바로 컴팩트', '▶ Compact now') : L('바로 컴팩트', 'Compact now'))}
              variant={isColdFirst ? 'primary' : 'secondary'}
              onPress={() => compactNow($, directKeep())}
            >
              {wide(isColdFirst ? L('▶ 바로 컴팩트', '▶ Compact now') : L('바로 컴팩트', 'Compact now'))}
            </Button>,
            <Button key="compact-no" label={pad(L('✕ 취소', '✕ Cancel'))} variant="secondary" onPress={() => update($, isConfirmingCompact, () => false)}>
              {wide(L('✕ 취소', '✕ Cancel'))}
            </Button>,
          ]
        )}
      </Box>
    )
    // 손해일 때 카드 본문 — 버튼 대신 할 일만. 식은 캐시면 다음 질문 하나가 캐시를 다시 데운다(그 값은 위 줄에). /compact 직접
    // 입력은 막을 수 없지만 권하지도 않는다
    const keepRow = (isCold: boolean) => (
      <Box key="e-keep">
        <Text wrap="wrap">
          <Text bold color="green">
            {L('작업을 이어 가세요', 'Keep working')}
          </Text>
          <Text>
            {isCold
              ? L(' — 다음 질문이 캐시를 다시 데웁니다. 컴팩트할 때가 되면 바가 알려 줍니다.', ' — your next question warms the cache again. The bar tells you when it is time to compact.')
              : L(' — 컴팩트할 때가 되면 바가 알려 줍니다.', ' — the bar tells you when it is time to compact.')}
          </Text>
        </Text>
      </Box>
    )
    // 바로 컴팩트가 /compact 뒤에 붙이는 지시 — 무엇을 붙이는지 그대로 보인다
    const directNote = L(`/compact 지시 「${directKeep()}」`, `/compact instruction "${directKeep()}"`)
    // 화면엔 두 줄만: 무엇을 얻나(질문당 아끼는 값) · 얼마 드나. 본전 · 요청당 값은 투머치였다. 손해인지는 mod 가
    // 정한다(isLoss) — 저장 프롬프트엔 손익을 넘기지 않는다(세션은 잃을 정보만 본다)
    const saves = pay !== null && pay.saveCallUsd > 0 && !isLittle
    // 한 줄: 효과(컨텍스트 전 → 후 · 아끼는 값) · 드는 값 — 띠 높이가 모자라 버튼이 잘렸다
    const costLine =
      pay && u ? (
        // 숫자만 색: 컨텍스트는 수준 색 → 줄어든 크기 초록, 아끼는 값 초록, 드는 값은 금액 기준 색. 글은 흐리게
        <Text wrap="wrap">
          <Text>{L('컨텍스트 ', 'Context ')}</Text>
          <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>
            {fmtTokens(u.contextTokens)}
          </Text>
          <Text dimColor> → </Text>
          <Text bold color="green">
            ~{fmtTokens(Math.min(afterTokens, u.contextTokens))}
          </Text>
          <Text dimColor>{' · '}</Text>
          {!saves ? (
            // 바 툴팁과 같은 판정 · 같은 색 — 아낄 게 없으면 지금 컴팩트는 손해(빨강)
            <Text bold color="red">{L('아낄 게 거의 없음 — 지금 컴팩트하면 손해', 'little to save — compacting now is a loss')}</Text>
          ) : (
            <Text>
              <Text>{pay.saveQuestionUsd !== null ? L('질문 1개당 ', 'saves ') : L('요청 1회당 ', 'saves ')}</Text>
              <Text bold color="green">
                ~{fmtUsd(pay.saveQuestionUsd ?? pay.saveCallUsd)}
              </Text>
              <Text>{pay.saveQuestionUsd !== null ? L(' 아낌', ' per question') : L(' 아낌', ' per request')}</Text>
            </Text>
          )}
          <Text dimColor>{' · '}</Text>
          <Text>{L('저장 + 컴팩트 ', 'save + compact ')}</Text>
          <Text bold>
            ~{fmtUsd(pay.costUsd)}
          </Text>
        </Text>
      ) : null
    // 저장할 것은 여기서 바로 고른다 — 설정 탭에만 있으면 컴팩트할 때 어느 문구인지 안 보이고, 바꾸려면 탭을 오가야 했다
    //. 고르면 설정 값이 바뀐다 — 다음 컴팩트에도 그대로, 모든 세션 공통. 직접은 쓴 글이
    // 있을 때만(쓰기 · 고치기는 설정 탭). 누른 때의 설정 위에 — 그린 뒤 다른 세션이 바꿨을 수 있다
    const tidyPick = (key: string, label: string, isOn: boolean, choice: string) => {
      const onPress = async () => saveSettings($, chooseTidy(await currentSettings($), choice))
      return isOn ? (
        <Button key={key} label={`✓ ${label}`} variant="primary" onPress={onPress} />
      ) : (
        <Button key={key} label={label} variant="secondary" dimColor onPress={onPress} />
      )
    }
    const saveRow = (isCold: boolean) => (
      <Box key="e-save" columnGap={1}>
        <Box width={16} flexShrink={0}>
          <Text bold>{L('저장하고 컴팩트', 'Save & compact')}</Text>
        </Box>
        <Text dimColor>:</Text>
        <Box flexDirection="column" flexShrink={1} minWidth={0}>
          <Box key="e-save-pick" columnGap={1} flexWrap="wrap">
            {TIDY_IDS.map(id => tidyPick(`pick-${id}`, tidyStyles()[id].name, sNow.tidy === id, id))}
            {sNow.tidyCustom !== '' ? tidyPick('pick-custom', customName(), sNow.tidy === 'custom', customName()) : null}
          </Box>
          {isCold ? (
            <Text wrap="wrap">
              <Text bold>{L('지금은 더 비쌈', 'Costs more now')}</Text>
              <Text dimColor> — </Text>
              <Text>{L('저장 질문이 먼저 전체를 다시 씀', 'the save question rewrites everything first')}</Text>
            </Text>
          ) : (
            // 고른 문구마다 다른 곳(저장 · 답)만 — 설정 탭 단계 보기의 ② ③ 과 같은 글
            <Text wrap="wrap">
              <Text color="cyan">{L('저장 ', 'Save ')}</Text>
              <Text>{tidyNow.keep}</Text>
              <Text dimColor>{' · '}</Text>
              <Text color="cyan">{L('답 ', 'Reply ')}</Text>
              <Text>{tidyNow.reply}</Text>
              <Text dimColor>{' · '}</Text>
              <Text bold>{L('잃을 정보가 있으면 멈추고 알림', 'stops and tells you if information would be lost')}</Text>
            </Text>
          )}
        </Box>
      </Box>
    )
    const directRow = explain(
      'e-direct',
      L('바로 컴팩트', 'Compact now'),
      <Text>
        <Text bold>{L('저장 없이 지금', 'Now, without saving')}</Text>
        <Text dimColor> · </Text>
        <Text>{directNote}</Text>
      </Text>,
    )
    // 캐시가 식었으면(만료 · 모델 바꿈) 손익과 상관없이 이 카드 — 주 버튼은 ▶ 바로 컴팩트, 저장 줄엔 "지금은 더 비쌈". 예전엔
    // 바로 컴팩트가 손해인 크기면 보통 카드(▶ 저장하고 컴팩트)를 띄워, 회사 세션에서 저장 질문이 전체를 다시 써 $0.43 이 들었다.
    // 손해면 그냥 이어 가는 편이 싸다고 적고, 컴팩트 버튼 대신 "작업을 이어 가세요"(isLoss — 위 actions · keepRow)
    const coldConfirm =
      est?.kind === 'cold' && u
        ? card(
            'confirm-cold',
            isSwitched ? '🔄' : '🧊',
            isSwitched
              ? isLoss
                ? L('모델을 바꿔 새 모델엔 캐시가 없습니다 — 지금은 컴팩트하지 마세요', 'You switched models and the new one has no cache — hold off on compacting')
                : L('모델을 바꿔 새 모델엔 캐시가 없습니다 — 바로 컴팩트할까요?', 'You switched models and the new one has no cache — compact now?')
              : isLoss
                ? L('캐시가 만료됐습니다 — 지금은 컴팩트하지 마세요', 'The cache has expired — hold off on compacting')
                : L('캐시가 만료됐습니다 — 바로 컴팩트할까요?', 'The cache has expired — compact now?'),
            <Text wrap="wrap">
              {/* 공통 앞부분을 쟀으면 그만큼은 읽기라 "전체" 가 아니다 — 다시 쓰는 크기를 같이(금액과 말이 맞게) */}
              <Text>{L('그냥 이어 가면 첫 요청이 ', (u.sharedTokens ?? 0) > 0 ? 'Continuing as is, the first request rewrites ' : 'Continuing as is, the first request rewrites all ')}</Text>
              <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>
                {fmtTokens(u.contextTokens)}
              </Text>
              <Text>
                {(u.sharedTokens ?? 0) > 0
                  ? L(
                      ` 중 ~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} 를 다시 씀 `,
                      ` (~${fmtTokens(u.contextTokens - Math.min(u.sharedTokens!, u.contextTokens))} of it, the shared prefix is read) `,
                    )
                  : L(' 전체를 다시 씀 ', ' ')}
              </Text>
              {/* 금액엔 색 없음, 차이에만 이득 초록 · 손해 빨강 — 띠 줄 · 보통 카드와 같은 규칙 */}
              <Text bold>~{fmtUsd(cold?.continueUsd ?? est.rewriteUsd)}</Text>
              {cold === null ? null : (
                <Text>
                  <Text dimColor>{' · '}</Text>
                  <Text>{L('바로 컴팩트하면 ', 'compacting now ')}</Text>
                  <Text bold>~{fmtUsd(cold.compactUsd)}</Text>
                  <Text dimColor> → </Text>
                  <Text bold>~{fmtTokens(Math.min(afterTokens, u.contextTokens))}</Text>
                  <Text dimColor>{' · '}</Text>
                  {isColdWin ? (
                    <Text bold color="green">
                      {L(`${fmtUsd(cold.continueUsd - cold.compactUsd)} 이득`, `saves ${fmtUsd(cold.continueUsd - cold.compactUsd)}`)}
                    </Text>
                  ) : (
                    <Text>
                      <Text bold color="red">
                        {L(`~${fmtUsd(cold.compactUsd - cold.continueUsd)} 손해`, `~${fmtUsd(cold.compactUsd - cold.continueUsd)} more`)}
                      </Text>
                      <Text>{L(' · 그냥 이어 가는 편이 쌈', ' · continuing as is is cheaper')}</Text>
                    </Text>
                  )}
                </Text>
              )}
            </Text>,
            isLoss ? [keepRow(true)] : [saveRow(true), directRow],
            true,
          )
        : null
    // 저장 내용은 컴팩트 문구(일반 · 긴 세션 이어가기 · 마무리 · 직접 쓴 글)를 따른다 — 이 카드에서도 고른다
    const confirm = !isConfirming ? null : (coldConfirm ??
        (isLoss
          ? card('confirm', '🗜', L('지금은 컴팩트할 때가 아닙니다', 'Not a time to compact'), costLine, [keepRow(false)], false)
          : card('confirm', '🗜', L('컴팩트할까요?', 'Compact now?'), costLine, [saveRow(false), directRow], false)))
    // 패널 버튼: 버튼 하나에 상태와 동작을 같이 — 닫혀 있으면 "○○ 패널 ▸", 열려 있으면 "○○ 패널 열림 ✕".
    // "비용 닫기" 는 비용을 닫는 것처럼, 글자 + 작은 [닫기] 는 아래 컴팩트 버튼과 줄이 안 맞아 어색했다
    const panelButton = (key: PaneView, name: string) => (
      <Button
        key={key}
        // 좁은 터미널(패널을 연 CLI 등)은 짧게 — "사용량 패널 열림 ✕" 가 길어 최소 바의 왼쪽 글이 "이 세션…" 까지만 남았다(2026-10-13 CLI 확인)
        label={
          isNarrowTerminal
            ? view === key
              ? `${name} ✕`
              : `${name} ▸`
            : view === key
              ? L(`${name} 패널 열림 ✕`, `${name} pane open ✕`)
              : L(`${name} 패널 ▸`, `${name} pane ▸`)
        }
        variant="secondary"
        onPress={async () => {
          await toggleView($, key)
        }}
      />
    )
    // 바는 세 줄 격자: 1 = 한도 | 사용량 패널 · 창 버튼 묶음(⇲ 자동 숨김 · — 최소 / □ 최대 · ✕ 닫기), 2 = 요청당(식은 캐시)
    // 줄, 3 = 지난 질문 | 이지 컴팩트.
    // 왼쪽 글이 비어도(한도 없는 API 키 세션 · 식은 캐시라 지난 질문 숨김) 줄은 남아 버튼 자리가 늘 같다 — 버튼을 왼쪽 글
    // 덩어리의 세로 가운데에 두니 한도 줄이 넘어가거나 줄이 빠질 때마다 자리가 바뀌었고,
    // 패널 버튼과 컴팩트 버튼이 위아래로 붙어 누를 때 간섭했다. 같은 줄 가로로 붙여도 이지 컴팩트 옆이라 거슬렸다
    // — 패널 버튼은 윗줄 창 버튼 옆으로, 아랫줄엔 이지 컴팩트 하나.
    // 자동 숨김 · 크기 버튼은 창 제어 버튼처럼 아이콘 하나씩(⇲ · — 최소 / □ 최대) — 글 버튼 셋이 오른쪽 위에 몰려
    // 붐볐다.
    // 창 버튼에도 설명 칩(withTip — 위에 정의). 자동 숨김 ⇲ 는 뺐다 — ✕(접기)와 같아 보였다. 접힌 바가
    // 컴팩트할 때 저절로 펴질지는 설정의 "컴팩트할 때 자동으로 펴기"(기본 켬)
    const isAutoShown = sNow.bandFolded
    // 크기 버튼(맨 오른쪽 위): 최대 ↔ 최소. 안 보이기는 명령 · 설정 탭으로(바가 없을 때도 되게).
    // 바꾸면 열린 확인창은 닫는다(최소 바엔 자동 숨김이 아니면 확인창이 없다)
    const modeButton = withTip(`band-mode-box-${mode}`, (
      <Button
        key="band-mode"
        label={mode === 'full' ? '—' : '□'}
        variant="secondary"
        dimColor
        onPress={async () => {
          await update($, isConfirmingCompact, () => false)
          await saveSettings($, { ...(await currentSettings($)), band: mode === 'full' ? 'min' : 'full' })
        }}
      />
    ), mode === 'full' ? L('최소 · 한 줄로 줄이기', 'Minimize to one line') : L('최대 · 세 줄로 펴기', 'Maximize to three rows'))
    // 접기(창 버튼의 ✕): 입력창 아래 [🔽 이지 컴팩트 ⇱] 로 접고(모든 세션) 다시 펴는 법을 토스트로. 저절로 펴진 바면 지금보다
    // 급해질 때까지 다시 접어 둔다(foldBand)
    const closeButton = withTip(`band-close-box-${isAutoShown ? 'auto' : 'open'}`, (
      <Button key="band-close" label="✕" variant="secondary" dimColor onPress={async () => foldBand($)} />
    ), isAutoShown
      ? L('다시 접기 · 더 급해지면(빨강 · 캐시 만료) 다시 펴짐', 'Fold again · reopens when more urgent (red · cache expired)')
      : L(`접기 · 다시 펴기: 입력창 아래 [${revealLabel(!sNow.bandAutoOpen)}]`, `Fold · reopen: [${revealLabel(!sNow.bandAutoOpen)}] below the input`))
    // 사용량 패널 버튼: 데스크톱은 두 크기 모두 아이콘 📊 하나(열렸으면 밝게, 말은 툴팁)를 창 버튼 묶음 안 맨 앞에 —
    // 아이콘만이면 창 버튼과 같이 묶여야 한다. "열림" 글은 옆에 패널이 보이니 겹치는 말이고, 최대에서 글 버튼
    // (📊 사용량 패널 열림 ✕)을 두니 한도 줄이 두 줄로 밀려 꼴이 안 났다. 터미널은 마우스 올리기가 없어 글 버튼.
    // 다른 mod 가 이 바를 감싸면(next) key "b-panels" 칸 끝에 자기 패널 버튼을 넣을 수 있다(두 크기 모두 이 칸이 있다).
    // 바를 안 그리는 때(자동 숨김 · 안 보이기)엔 칸도 없다 — 늘 보여야 할 버튼은 바 밖에 둔다
    const isPanelIcon = e.surface !== 'terminal'
    const panels = (
      <Box key="b-panels" columnGap={1} alignItems="center" flexShrink={0}>
        {!isPanelIcon
          ? panelButton('usage', withIcon('📊', paneTitle()))
          : withTip(
              `band-panel-box-${view === 'usage' ? 'open' : 'closed'}`,
              // 열림 · 닫힘: 📊 는 색 그림이라 흐리게(dim)만으론 안 갈렸다 — 열렸으면 강조 버튼(설정 탭의 "✓ 고른 값" 과 같은 꼴)
              <Button key="usage" label="📊" {...(view === 'usage' ? { variant: 'primary' as const } : { variant: 'secondary' as const, dimColor: true })} onPress={async () => void (await toggleView($, 'usage'))} />,
              view === 'usage' ? L(`${paneTitle()} 패널 닫기`, `Close the ${paneTitle()} pane`) : L(`${paneTitle()} 패널 열기`, `Open the ${paneTitle()} pane`),
            )}
      </Box>
    )
    // 창 버튼은 한 칸(b-window)에 나란히 — 묶음 표시는 없다. 둥근 테두리는 데스크톱에서도 위아래 한 줄씩을 더 먹어 바가
    // 두꺼웠고, 바탕색 띠는 버튼 바탕과 색이 겹쳤다. 이지 컴팩트와는 줄이 달라 따로 묶지 않아도 갈린다
    const controls = (
      <Box key="b-r1-right" columnGap={1} alignItems="center" flexShrink={0}>
        {isPanelIcon ? null : panels}
        <Box key="b-window" columnGap={1} alignItems="center">
          {isPanelIcon ? panels : null}
          {isOneRow ? null : modeButton}
          {closeButton}
        </Box>
      </Box>
    )

    // 비용(왼쪽) · 버튼(오른쪽 끝 정렬)은 간격으로만 나눈다 — "│" 글자 세로줄은 줄 사이가 끊겨 싸 보였다
    const row = (key: string, left: unknown, rightEl: unknown, align: 'center' | 'flex-start') => (
      <Box key={key} flexWrap="nowrap" alignItems={align} columnGap={4}>
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {left ?? <Text> </Text>}
        </Box>
        {rightEl}
      </Box>
    )
    // 최소(한 줄): 왼쪽 요청당 · 컨텍스트 · 컴팩트 구간, 오른쪽 이지 컴팩트 → 창 버튼 묶음(📊 · ⇲ · □ · ✕).
    // 이지 컴팩트는 최소에서도 늘 둔다 — 처음엔 뺐는데 최소로 하면 컴팩트할 길이 안 보였다. 확인창도 그대로
    if (mode === 'min') {
      // 최소에선 이지 컴팩트를 파란 🗜 + 짧은 [컴팩트] 버튼으로 — 상태 글은 툴팁으로, 컴팩트할 때는 깜빡이는 점 색
      // (노랑 · 빨강 · 파랑)과 강조 버튼으로. 처음엔 아이콘 버튼 [🗜] 하나였는데 버튼 안
      // 글자는 앱 버튼 색이라 🗜 가 흰색이었다 — 🗜 를 버튼 밖으로 빼고 버튼엔 짧은 이름. 저장 · 컴팩트 중 글과
      // [취소]는 그대로(보고 눌러야 한다), 터미널은 마우스 올리기가 없어 글 그대로
      const isShort = e.surface !== 'terminal'
      const miniName = L('컴팩트', 'Compact')
      const compactTip = isColdWin
        ? isSwitched
          ? L('모델 바뀜 · 바로 컴팩트 권장', 'Model switched · compact now advised')
          : L('캐시 만료 · 바로 컴팩트 권장', 'Cache expired · compact now advised')
        : shownLevel === 'cut'
          ? isRange
            ? L('컴팩트 늦어짐', 'Compact overdue')
            : L('컴팩트 권장', 'Compact advised')
          : shownLevel === 'warn'
            ? isRange
              ? L('컴팩트하기 좋은 때', 'Good time to compact')
              : L('곧 컴팩트할 때', 'Compact soon')
            : L('이지 컴팩트', 'Easy Compact')
      const compactMini =
        !isShort || phase === 'compacting' || phase === 'tidying' ? (
          compactRow
        ) : e.props.isWorking ? (
          // 못 누르는 동안은 🗜 · 이름 둘 다 색 없이 흐리게(버튼 자리 폭은 그대로)
          <Box columnGap={1} alignItems="center">
            {offIcon}
            {withTip('band-compact-box-busy', <Text dimColor>{miniName}</Text>, L('이지 컴팩트 · 답이 끝나면 누를 수 있음', 'Easy Compact · available when the answer ends'))}
          </Box>
        ) : isConfirming ? (
          <Box columnGap={1} alignItems="center">
            {isNotNow ? offIcon : brandIcon}
            {withTip(
              'band-compact-box-open',
              <Button key="compact-close" label={`${miniName} ✕`} variant="secondary" onPress={() => update($, isConfirmingCompact, () => false)} />,
              L('확인창 닫기', 'Close the card'),
            )}
          </Box>
        ) : (
          <Box columnGap={1} alignItems="center">
            {/* 터미널은 그림 글자 대신 글(칸이 어긋난다 — glyph.ts) */}
            {phase === 'held' ? <Text color="yellow">{iconOf('⏸') || L('보류', 'Held')}</Text> : null}
            {isNotNow ? offIcon : brandIcon}
            {isColdWin
              ? pulse('#4c9be8', compactTip)
              : shownLevel === 'cut'
                ? pulse('#e05555', compactTip)
                : shownLevel === 'warn'
                  ? pulse('#e0b040', compactTip)
                  : null}
            {withTip(
              `band-compact-box-${shownLevel}${isColdWin ? '-cold' : ''}`,
              <Button
                key="compact"
                label={miniName}
                {...(isNotNow ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
                onPress={() => update($, isConfirmingCompact, () => true)}
              />,
              isNotNow ? notNowTip : `${compactTip} · ${L('누르면 컴팩트할까요?', 'press to open Compact now?')}`,
            )}
          </Box>
        )
      return (
        <Box flexDirection="column">
          {row(
            'b-r1',
            estimateLine,
            <Box key="b-one-right" columnGap={2} alignItems="center" flexShrink={0}>
              {compactMini}
              {controls}
            </Box>,
            'center',
          )}
          {confirm}
        </Box>
      )
    }
    // 질문 줄을 뺀 화면(간단 등)이면 이지 컴팩트는 비용 줄 오른쪽 — 왼쪽이 빈 셋째 줄에 버튼만 있었다. 한도 줄이 없으면 바가 한 줄. 질문 줄 글이 잠깐 비는 때(식은 캐시 · 컴팩트 직후)가 아니라 칸 설정으로 정한다 —
    // 버튼 자리가 그때그때 바뀌면 안 된다. 한도 줄만 있고 비용 줄 칸을 다 뺐으면 셋째 줄에 그대로
    const compactOnCost = !show.lastTurn && (!limitsLine || estimateLine !== null)
    const oneRight = (
      <Box key="b-one-right" columnGap={2} alignItems="center" flexShrink={0}>
        {compactRow}
        {controls}
      </Box>
    )
    return (
      <Box flexDirection="column">
        {/* 세션 한도 줄은 계정에 따라 저절로: 엔진은 구독 세션에만 5시간 · 7일을 알려 준다
            ("rateLimits is empty off a subscription") — API 키 세션엔 줄이 없다. 옵션을 두지 않는다.
            5시간 · 7일 · 리셋 시간은 설정 탭 화면 → 세부 → "바 칸 켜고 끄기" 에서 뺀다([한도 전체] 로 한꺼번에도). 한도 줄이 없으면(API 키 세션 · 둘 다 뺌) 비용
            줄이 창 버튼 옆 맨 윗줄로 오른다 — 예전엔 빈 윗줄을 남겨 API 모드에서 칸이 비어 보였다.
            좁으면 한도 줄이 두 줄로 넘어간다 — 패널 버튼은 그때도 오른쪽 위(위 정렬) */}
        {/* 좁은 터미널(패널을 연 CLI 등 — 창 버튼 묶음이 ~45칸이라 한도 줄 자리가 20칸 남짓)에선 창 버튼을 맨 윗줄에 혼자,
            한도 줄은 그 아래 전체 폭 — 한도 칸이 짓눌려 글자가 세로로 쪼개졌다(2026-10-12 CLI 확인) */}
        {limitsLine && isNarrowTerminal ? row('b-r0', null, controls, 'center') : null}
        {limitsLine && isNarrowTerminal
          ? row('b-r1', limitsLine, null, 'flex-start')
          : limitsLine
            ? row('b-r1', limitsLine, controls, 'flex-start')
            : row('b-r1', estimateLine, compactOnCost ? oneRight : controls, 'center')}
        {/* 비용 줄의 칸을 다 빼면 줄째 빠진다 */}
        {limitsLine && estimateLine ? row('b-r2', estimateLine, compactOnCost ? compactRow : null, 'center') : null}
        {compactOnCost ? null : row('b-r3', lastLine, compactRow, 'center')}
        {confirm}
      </Box>
    )
  })
}
