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
  CompactInputs,
  CostParts,
  LiveTurn,
  Optimal,
  PaneView,
  SaveTurn,
  Settings,
  Source,
  StepDetail,
  TurnSummary,
  Usage,
  UsageTab,
} from '../types'
import {
  addCost,
  average,
  compactMixOf,
  compactPayoff,
  costOf,
  endsWithTail,
  coldCompact,
  estimate,
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
  UNCACHED_COMPACT,
  ZERO_COST,
} from './cost'
import type { CompactMix } from './cost'
import {
  chooseTidy,
  customName,
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseMinutes,
  parseTokens,
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
  mergeMeasured,
  parseFlowFile,
  pendingCompact,
  recordsFromLines,
  scanTranscript,
  serializeFlow,
  withPoint,
  withQuestion,
} from './flow'
import type { Flow } from './flow'
import type { Tokens } from './cost'
import { APP_MIN_USD, promptHead, isWide, fitCells, stepLabel } from './text'
import { kindDirect, kindTidy, compactKindOf, markGo, tidyPrompt, compactKeep, directKeep, tidyVerdict } from './tidy'
import { ACCENT, row, gridOf, phaseLook, pulseDot, CARD_INSET, emptyLine } from './ui-common'
import type { Ui, Fold } from './ui-common'
import { drawLimitsLine, drawEstimateLine, rewriteNote, drawLastTurnLine } from './ui-band'
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
} from './ui-usage'
import { draftCompactAt, drawSettingsView } from './ui-settings'
import { isKorean, L, lang, plural, setLang } from './i18n'
import { iconOf, setSurface, withIcon } from './glyph'
import type { Lang } from './i18n'
import { installedFrom, pluginDataId } from './paths'
import type { SettingsActions } from './ui-settings'


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

/** $.store 키: 사용량 패널을 열어 두었는가(StoredPane). 모든 데스크톱 세션이 따라 연다 — 터미널 세션은 localPane */
const PANE_KEY = 'pane'

// 사용량 = 지금(컨텍스트 · 비용) · 컴팩트 · 질문별 비용, 설정은 패널 안 탭(예전 이름 '비용' 은 내용보다 좁았다)
const paneTitle = () => L('사용량', 'Usage')

/** $.store 키: 설정(Settings). 모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다 */
const SETTINGS_KEY = 'settings'

// 이 PC 에서 잰 마지막 컴팩트 값($.store, 세션끼리 같이 쓴다). 이 세션에서 아직 컴팩트하지 않았을 때 쓰고, 그것도 없으면 가정
/** 컴팩트 뒤 첫 요청의 컨텍스트 — 기록 앞부분을 못 읽어 기본 적재를 모를 때만 */
const AFTER_KEY = 'afterCompactTokens'

/** 컴팩트 요청의 입력 몫(CompactMix). 없으면 전부 정가 입력으로 본다 */
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

const isHidden = atom({ plugin: 'easy-compact', key: 'isHidden' } as const, false)

const isConfirmingCompact = atom({ plugin: 'easy-compact', key: 'isConfirmingCompact' } as const, false)

const paneView = atom({ plugin: 'easy-compact', key: 'paneView' } as const, null)

const localPane = atom({ plugin: 'easy-compact', key: 'localPane' } as const, null)

const live = atom({ plugin: 'easy-compact', key: 'live' } as const, null)

const turnSummaries = atom({ plugin: 'easy-compact', key: 'turnSummaries' } as const, [])

const compactPhase = atom({ plugin: 'easy-compact', key: 'compactPhase' } as const, 'idle')

/** 도는 컴팩트의 이름(compactKindOf) — compactPhase 가 'compacting' 일 때만 읽는다 */
const compactKind = atom({ plugin: 'easy-compact', key: 'compactKind' } as const, '')

const expandedTurn = atom({ plugin: 'easy-compact', key: 'expandedTurn' } as const, null)

const historyAll = atom({ plugin: 'easy-compact', key: 'historyAll' } as const, false)

const effectsAll = atom({ plugin: 'easy-compact', key: 'effectsAll' } as const, false)

const flowAll = atom({ plugin: 'easy-compact', key: 'flowAll' } as const, false)

const settings = atom({ plugin: 'easy-compact', key: 'settings' } as const, null)

const usageTab = atom({ plugin: 'easy-compact', key: 'usageTab' } as const, 'main')

const tidyRawOpen = atom({ plugin: 'easy-compact', key: 'tidyRawOpen' } as const, false)

const cardsOpen = atom({ plugin: 'easy-compact', key: 'cardsOpen' } as const, { now: true, history: true, compact: true })

const tidyDraft = atom({ plugin: 'easy-compact', key: 'tidyDraft' } as const, null)

const cmpDraft = atom({ plugin: 'easy-compact', key: 'cmpDraft' } as const, null)

const flowPoints = atom({ plugin: 'easy-compact', key: 'flowPoints' } as const, [])

const compactions = atom({ plugin: 'easy-compact', key: 'compactions' } as const, [])

const flowQuestions = atom({ plugin: 'easy-compact', key: 'flowQuestions' } as const, [])

const flowLoaded = atom({ plugin: 'easy-compact', key: 'flowLoaded' } as const, false)

const flowNote = atom({ plugin: 'easy-compact', key: 'flowNote' } as const, null)

const usage = atom({ plugin: 'easy-compact', key: 'usage' } as const, null)

const optimal = atom({ plugin: 'easy-compact', key: 'optimal' } as const, null)

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

/** 트랜스크립트는 모델 호출마다 덧붙는다 — 그 수정 시각이 캐시 타이머의 기준 (statusline 과 같은 방식) */
async function lastActivity($: EngineInterface): Promise<number | null> {
  try {
    return (await $.fs.stat(await transcriptPath($))).mtimeMs
  } catch {
    return null
  }
}

// ── 컨텍스트 흐름: 기록 파일에서 한 번 읽고, 그 뒤엔 요청 · 컴팩트마다 잇는다 ──────────

async function readFlow($: EngineInterface): Promise<Flow> {
  return { points: await read($, flowPoints), compactions: await read($, compactions), questions: await read($, flowQuestions) }
}

/** $.fs.read 는 4 MiB 넘는 파일을 거부한다 — 그보다 큰 기록은 tools/scan-transcript.mjs(node)로 뽑는다 */
const READ_LIMIT = 4 * 1024 * 1024 - 64 * 1024

/** 세션별 흐름 저장 파일. mod 폴더 밖이라 저장해도 mod 가 다시 불러와지지 않는다 */
async function flowFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/flow/${await $.session.id()}.json`
}

/** 상태에 쓰고 파일에도 남긴다(파일 쓰기 실패는 다음 쓰기에 다시 — 그리기를 막지 않는다). 질문이 없는 흐름이면 있던 질문 그대로 */
async function writeFlow($: EngineInterface, flow: Flow): Promise<void> {
  const questions = flow.questions ?? (await read($, flowQuestions))
  await update($, flowPoints, () => flow.points)
  await update($, compactions, () => flow.compactions)
  await update($, flowQuestions, () => questions)
  void flowFile($)
    .then(path => $.fs.write(path, serializeFlow({ ...flow, questions })))
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
  const ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path], { timeoutMs: 60_000 })
  if (ran.exitCode !== 0)
    throw new Error(L(`기록이 ${Math.round(size / 1048576)}MB 라 node 로 읽으려 했으나 실패(${ran.exitCode})`, `The transcript is ${Math.round(size / 1048576)}MB; reading it with node failed (${ran.exitCode})`))
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
      // 모델 · 질문을 적기 전 판 저장 파일이면 기록에서 한 번 다시 읽는다(모델 바꾼 시점 · 최근 질문 경계를 그리려고) —
      // 잰 컴팩트 값은 옮긴다
      if (flow && (lacksModels(flow) || flow.questions === undefined)) {
        saved = flow.compactions
        flow = null
      }
    }
    flow ??= await importFlow($)
    await writeFlow($, { points: flow.points, compactions: mergeMeasured(flow.compactions, [...old, ...saved]), questions: flow.questions ?? [] })
    await update($, flowNote, () => null)
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
    // 그 동안은 추정값. 엔진 값이 이미 줄어 있으면(컴팩트 전의 8할 아래) 그것을 믿는다
    const flow = await readFlow($)
    const pending = pendingCompact(flow)
    const engineTokens = measured.context.tokens ?? 0
    const lastCtx = flow.points[flow.points.length - 1]?.ctx ?? null
    const isStale = pending !== null && pending.before > 0 && engineTokens >= pending.before * 0.8
    // 추정값은 계산식 재료와 같은 직후 크기 — 막 읽은 흐름으로 바로 잰다(걸어 둔 최적은 이 함수 끝에서야 갱신된다)
    const afterNow = isStale ? ((await measureOptimal($, prev?.model ?? (await $.session.model()))).inputs?.after ?? null) : null
    const tokens = isStale
      ? Math.min(afterNow ?? engineTokens, engineTokens)
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
    const next: Usage = {
      model: await $.session.model(),
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
      lastActivityMs: await lastActivity($),
      history: opts.pushHistory ? [...(prev?.history ?? []), tokens].slice(-12) : (prev?.history ?? []),
    }
    await update($, usage, () => next)
    // 최적은 모델 · 직후 크기 · 요청당 증가를 따라 바뀐다(컴팩트 직후 · 턴 끝 · 흐름을 다 읽은 뒤)
    await applyThresholds($)
  } catch (err) {
    log($, `usage read failed — ${String(err)}`)
  }
}

// ── 사이드 패널: 데스크톱 세션은 $.store 의 화면을 같이 따라 열고, 터미널 세션은 혼자 연다 ─────────

/**
 * 터미널(CLI) 세션인가. 앱에선 세션을 옮겨 다녀도 패널이 따라와야 하지만 터미널 창은 저마다 따로 보여 따라갈 까닭이 없다 —
 * 같이 따르면 CLI 에서 열 때 앱의 모든 세션에 패널이 뜨고, 앱에서 닫으면 CLI 패널도 닫혔다(2026-10-11: CLI 에서 settings 가
 * "열었다"고 답했는데 앱에서 닫힌 상태를 따라 패널이 사라짐). 못 읽으면 같이 따르는 쪽(예전 동작)
 */
async function isTerminalSession($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.surfaces()).includes('terminal')
  } catch {
    return false
  }
}

async function wantedView($: EngineInterface): Promise<PaneView | null> {
  if (await isTerminalSession($)) return read($, localPane)
  return (await $.store.get(PANE_KEY)) ? 'usage' : null
}

/** 열 화면을 정한다(null = 닫기). 터미널은 이 세션에만, 데스크톱은 $.store 에 두어 모든 데스크톱 세션이 따라간다 */
async function setWantedView($: EngineInterface, view: PaneView | null): Promise<void> {
  if (await isTerminalSession($)) await update($, localPane, () => view)
  else if (view === null) await $.store.delete(PANE_KEY)
  else await $.store.set(PANE_KEY, { view })
}

/** 이 세션의 패널을 저장된 화면에 맞춘다. 타이머가 계속 불러 세션을 옮겨도 따라 열린다 */
async function syncPane($: EngineInterface): Promise<void> {
  const want = await wantedView($)
  const have = await read($, paneView)
  const open = await $.ui.panes()
  const isOpen = open.some(pane => pane.id === PANE)
  if (want === null) {
    if (isOpen) await $.ui.close({ id: PANE })
    if (have !== null) await update($, paneView, () => null)
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

/** 패널 안 탭: 닫지 않고 화면만 바꾼다 */
async function switchView($: EngineInterface, view: PaneView): Promise<void> {
  await setWantedView($, view)
  await syncPane($)
}

// ── 설정: $.store 한 곳, 모든 세션이 타이머로 따라 읽는다 ─────────────────

/** 마지막으로 반영한 설정(JSON). 같으면 다시 그리지 않는다 */
let appliedSettings = ''

async function loadSettings($: EngineInterface): Promise<void> {
  let raw: unknown
  try {
    raw = await $.store.get(SETTINGS_KEY)
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
  const sessionSummary = last && first ? compactSummary(flow, last, first) : null
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
      : { after, summary: Math.min(summary, after), output: pcOutput ?? OUTPUT_GUESS, mix: pcMix ?? UNCACHED_COMPACT, save: pcSave ?? SAVE_GUESS }
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
  }
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
  const opt = keepOptimal(await read($, optimal), await measureOptimal($, model))
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
 * 요청당 값 · 다음 요청 값도 새 모델 요율로 바로 바뀐다. 노력도는 쉬는 동안 읽을 길이 없다(요청이 시작될 때만 엔진이 알려 준다)
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
  await update($, usage, prev => (prev ? { ...prev, model, switchedFrom } : prev))
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
  const rewrite = rewriteOf(tokens, model, lastCtxOf(flow))
  await writeFlow($, withPoint(flow, { atMs: await $.clock.now(), ctx: contextTokens, usd: cost.usd, model }))
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

/** 동작 목록에 에이전트 몫 더하기 — 에이전트마다 한 줄, 요청이 끝날 때마다 값 · 요청 수가 는다 */
function withAgentStep(details: readonly StepDetail[], agentId: string, label: string, cost: CostParts, model: string): StepDetail[] {
  const i = details.findIndex(d => d.agent === agentId)
  if (i < 0) return [...details, { label, usd: cost.usd, write: cost.write, agent: agentId, steps: 1, model }]
  const d = details[i]!
  const next = { ...d, usd: d.usd + cost.usd, write: (d.write ?? 0) + cost.write, steps: (d.steps ?? 0) + 1, model }
  return [...details.slice(0, i), next, ...details.slice(i + 1)]
}

/**
 * 하위 에이전트 요청 하나: 띄운 질문의 값에 더한다(작업 중에도 바로 — 전엔 메인 요청만 세어 에이전트 값이 안 보였다).
 * 컨텍스트 · 흐름 그래프엔 넣지 않는다(에이전트 대화는 따로라 메인 컨텍스트와 무관). 질문이 끝난 뒤에도 도는
 * 백그라운드 에이전트면 끝난 그 질문의 요약에 더한다
 */
async function recordAgentStep($: EngineInterface, agentId: string, cost: CostParts, model: string): Promise<void> {
  trackedUsd += cost.usd
  const info = agentInfo.get(agentId)
  const label = info?.label ?? L('하위 에이전트', 'subagent')
  const now = await read($, live)
  if (now && (!info?.turnId || info.turnId === now.turnId)) {
    await update($, live, prev =>
      prev ? { ...prev, cost: addCost(prev.cost, cost), details: withAgentStep(prev.details, agentId, label, cost, model) } : prev,
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
      const next = { ...s, cost: addCost(s.cost, cost), details: withAgentStep(s.details ?? [], agentId, label, cost, model) }
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
async function tidyThenCompact($: EngineInterface, payoff: string | null): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await update($, compactPhase, () => 'tidying')
  try {
    await $.prompt.submit({ text: tidyPrompt(payoff, tidyBody(await currentSettings($))) })
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

/** 이 PC 의 최근 저장 턴 평균. 없으면 null(가정 SAVE_GUESS) */
async function storedSaveOrNull($: EngineInterface): Promise<SaveTurn | null> {
  try {
    const list = (await $.store.get(SAVE_KEY)) as Partial<SaveTurn>[] | undefined
    const ok = (list ?? []).filter(
      (s): s is SaveTurn => typeof s?.steps === 'number' && typeof s.output === 'number' && typeof s.write === 'number',
    )
    if (ok.length === 0) return null
    const avg = (pick: (s: SaveTurn) => number) => ok.reduce((sum, s) => sum + pick(s), 0) / ok.length
    return { steps: avg(s => s.steps), output: Math.round(avg(s => s.output)), write: Math.round(avg(s => s.write)) }
  } catch {
    return null
  }
}

/**
 * 끝난 저장 턴을 잰다(세션이 [컴팩트 진행] 으로 답했을 때만 — 보류 답은 저장을 안 해 짧다). 요청 수 · 출력 토큰 · 새로 쓴
 * 토큰(쓰기 값 ÷ 그 모델의 1시간 쓰기 요율). 최근 SAVE_KEEP 개를 남긴다
 */
async function recordSaveTurn($: EngineInterface, turn: LiveTurn): Promise<void> {
  const r = turn.model ? ratesFor(turn.model, 0) : null
  if (!r || turn.steps <= 0) return
  const one: SaveTurn = { steps: turn.steps, output: turn.outputTokens, write: Math.round((turn.cost.write / r.write1h) * 1e6) }
  try {
    const prev = ((await $.store.get(SAVE_KEY)) as SaveTurn[] | undefined) ?? []
    await $.store.set(SAVE_KEY, [...(Array.isArray(prev) ? prev : []), one].slice(-SAVE_KEEP))
  } catch {
    // 못 쓰면 다음 저장 턴에
  }
}

/** 지난 컴팩트에서 잰 컴팩트 요청의 입력 몫 — 없으면 정가 입력(띠 확인창과 같은 값) */
/** 이 PC 에서 잰 마지막 컴팩트 요청의 입력 몫. 없으면 null(전부 정가 입력으로 본다) */
async function storedMixOrNull($: EngineInterface): Promise<CompactMix | null> {
  try {
    const m = (await $.store.get(MIX_KEY)) as Partial<CompactMix> | undefined
    if (m && typeof m.input === 'number' && typeof m.read === 'number' && typeof m.write === 'number') return m as CompactMix
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

/** 설정 명령(설정 화면의 버튼과 같은 함수). 설정 명령이 아니면 null */
async function settingsCommand($: EngineInterface, verb: string, rest: string): Promise<string | null> {
  const s = await currentSettings($)
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
      await saveSettings($, { ...s, cacheWarnMin: n })
      return L(`캐시가 ${n}분 남으면 노랑으로 알립니다.`, `Turns yellow with ${plural(n, 'minute')} of cache left.`)
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
      ? L('직접 쓴 문구로 정리합니다. 손해 판단과 진행 표시는 mod가 앞뒤에 붙입니다.', 'Saving with your custom text. The mod adds the loss check and the go/hold marks around it.')
      : L('직접을 골랐습니다. 문구가 비어 있어 그동안 일반 문구대로 합니다.', 'Custom selected. The text is empty, so Normal is used meanwhile.')
  }
  return null
}

const help = () =>
  L(
    [
      '/easy-compact            사용량 · 세션 기록(컨텍스트 흐름) 다시 읽기',
      '/easy-compact usage      사용량 패널(컨텍스트 · 비용 · 질문별 비용) 열기 · 닫기',
      '/easy-compact settings   사용량 패널의 설정 탭 열기',
      '/easy-compact set 권장 <크기|구간>   컴팩트 크기 직접 지정(예: set 권장 30만) · 구간 방식(set 권장 구간)',
      '/easy-compact set 구간 <시작> <끝>   컴팩트 구간(예: set 구간 15만 25만) — 시작부터 노랑, 끝부터 빨강',
      '/easy-compact set 캐시 <분>   캐시 남은 분이 이보다 적으면 노랑',
      '/easy-compact 문구 <일반|긴 세션 이어가기|마무리|직접|직접 쓸 글>   저장하고 컴팩트 문구',
      '/easy-compact hide|show  띠 숨기기 · 보이기',
      '/easy-compact lang <auto|ko|en>   화면 언어(자동 = Claude 설정 → 앱 언어 → OS 언어)',
    ].join('\n'),
    [
      '/easy-compact            re-read usage · the session transcript (context flow)',
      '/easy-compact usage      open · close the Usage pane (context · cost · per-question cost)',
      '/easy-compact settings   open the Settings tab of the Usage pane',
      '/easy-compact set compact <size|range>   set a compact size (e.g. set compact 300k) · range mode (set compact range)',
      '/easy-compact set range <start> <end>   compact range (e.g. set range 150k 250k) — yellow from start, red from end',
      '/easy-compact set cache <minutes>   yellow when fewer cache minutes remain',
      '/easy-compact prompt <Normal|Long-session handoff|Wrap-up|Custom|your own text>   Save & compact text',
      '/easy-compact hide|show  hide · show the band',
      '/easy-compact lang <auto|ko|en>   display language (auto = Claude settings → app language → OS language)',
    ].join('\n'),
  )

/** 설정 화면 버튼 동작 묶음 — $ 를 쓰는 동작은 이 파일에 있어야 한다(엔진은 $ 를 import 너머로 따라가지 않아 모듈을 안 띄운다) */
function settingsActs($: EngineInterface): SettingsActions {
  return {
    save: next => void saveSettings($, next),
    editCmp: next => void update($, cmpDraft, () => next),
    applyCmp: () => void applyCmpDraft($),
    typeTidy: text => void update($, tidyDraft, () => text),
    saveTidy: text => void saveTidyCustom($, text),
    toggleRaw: () => void toggleTidyRaw($),
    setLang: choice => void saveLang($, choice),
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await ensureLang($)
    await $.command.register({
      name: 'easy-compact',
      description: L(
        '컨텍스트 · 비용 · 컴팩트 띠와 설정: usage · settings · set 권장|구간|캐시 · 문구 · hide/show',
        'Context · cost · compact band and settings: usage · settings · set compact|range|cache · prompt · hide/show',
      ),
      argumentHint: L(
        '[usage | settings | set 권장 <크기|구간> | set 구간 <시작> <끝> | set 캐시 <분> | 문구 <글> | hide | show]',
        '[usage | settings | set compact <size|range> | set range <start> <end> | set cache <min> | prompt <text> | hide | show]',
      ),
    })
    // 재로드도 session.start 다 — 여기서 턴 비용을 세면 턴이 아닌 구간이 섞인다
    await refreshUsage($, { categories: false, pushHistory: false })
    await loadSettings($)
    // 기록 파일(수 MB)은 시작을 막지 않게 뒤에서 읽는다. 다 읽으면 사용량을 다시 잰다 —
    // 컴팩트 뒤 첫 요청 전이면 엔진 값이 컴팩트 전 크기라 흐름의 컴팩트 기록을 보고 추정값으로 바꾼다
    // 기본 적재(/context 분류)도 이때 한 번 잰다 — 계산식 최적의 재료
    void loadFlow($)
      .then(() => refreshUsage($, { categories: true, pushHistory: false }))
      .catch(() => {})
    // 다른 데스크톱 세션에서 열고 닫은 패널 · 바꾼 설정을 따라간다(터미널 세션의 패널은 자기 것만)
    $.clock.every(1500, () => {
      void syncPane($).catch(() => {})
      void loadSettings($).catch(() => {})
      // 고른 모델을 따라간다(모델 피커는 알려 주는 이벤트가 없다)
      void followModel($).catch(() => {})
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
        const cost = costOf(result.usage, result.usage.model, '5m')
        if (cost) await recordAgentStep($, e.agentId, cost, result.usage.model)
      } catch {
        // 기록 실패가 턴을 멈추면 안 된다
      }
    }
    if (e.agentId === undefined && result.usage) {
      try {
        // 요율은 이 요청에 실제로 답한 모델 기준(API 가 보고한 model id)
        const cost = costOf(result.usage, result.usage.model)
        // 모델을 바꾼 뒤 첫 요청인가 — 아래에서 "모델 바뀜" 표시를 지우기 전에 잡아 둔다
        const switchedFrom = (await read($, usage))?.switchedFrom ?? null
        if (cost) await recordStep($, e.turnId, cost, result.usage, stepLabel(result.toolUses), result.usage.model, e.effort, switchedFrom)
        const t = result.usage
        const ctxNow = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
        if (measureAfterCompact) {
          // 컴팩트 직후 크기와 그중 요약(= 직후 − 기본 적재) — 이 PC 의 다음 계산식 재료(이 세션에서 컴팩트하기 전 세션들이 쓴다)
          measureAfterCompact = false
          await $.store.set(AFTER_KEY, ctxNow)
          await fillCompactAfter($, ctxNow)
          const first = (await read($, flowNote)) === null ? ((await read($, flowPoints))[0] ?? null) : null
          const base = baseOfCategories((await read($, usage))?.categories ?? []) ?? first?.ctx ?? null
          if (base !== null && ctxNow > base) await $.store.set(SUMMARY_KEY, ctxNow - base)
        }
        // 띠 · 패널 컨텍스트를 요청마다 바로(턴 끝까지 기다리지 않는다 — 작업 중에도 지금 크기)
        await update($, usage, prev =>
          // 이 요청으로 지금 모델에 캐시가 생겼다 — 모델 바뀜 표시는 여기서 끝
          prev
            ? {
                ...prev,
                contextTokens: ctxNow,
                percent: prev.window > 0 ? (ctxNow / prev.window) * 100 : prev.percent,
                contextEstimated: false,
                switchedFrom: null,
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
    return (
      <Box columnGap={1} alignItems="center">
        {theirs}
        <Text>
          <Text bold>
            {fmtUsd(now.cost.usd)}
          </Text>
          <Text dimColor>{L(' · 컨텍스트 ', ' · context ')}</Text>
          <Text color={LEVEL_TEXT[levelOf(now.contextTokens)]}>{fmtTokens(now.contextTokens)}</Text>
          <Text dimColor>{L(' · 출력 ', ' · output ')}</Text>
          <Text>{fmtTokens(now.outputTokens)}</Text>
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
    // 이 질문 값에 든 컴팩트 · 앱 자체 요청(질문별 비용에선 🗜 · ⚙ 줄)은 이름으로 — 예전 "엔진 집계 − 우리 합" 은 무엇인지
    // 몰랐다. 앱 자체 요청은 답 뒤에 재 이 줄이 나중에 는다
    const compactUsd = (summary.details ?? []).reduce((sum, d) => sum + (d.compact ? d.usd : 0), 0)
    const parts = [
      compactUsd >= APP_MIN_USD ? L(`컴팩트 ${fmtUsd(compactUsd)}`, `compact ${fmtUsd(compactUsd)}`) : '',
      (summary.appUsd ?? 0) >= APP_MIN_USD ? L(`앱 자체 요청 ${fmtUsd(summary.appUsd!)}`, `app's own requests ${fmtUsd(summary.appUsd!)}`) : '',
    ].filter(Boolean)
    const extra = parts.length > 0 ? L(` · ${parts.join(' · ')} 포함`, ` · incl. ${parts.join(' · ')}`) : ''
    return (
      <Box flexDirection="column">
        {theirs}
        <Text>
          <Text dimColor>{L('이 질문 ', 'This question ')}</Text>
          <Text bold>
            {fmtUsd(summary.cost.usd)}
          </Text>
          <Text dimColor>{L(` · 요청 ${summary.steps}회`, ` · ${plural(summary.steps, 'request')}`)}</Text>
          {rewriteNote($.ui.resolve(e), summary.rewriteUsd)}
          {extra ? <Text dimColor>{extra}</Text> : null}
        </Text>
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
      const mix = isMine && !result.skip && result.usage ? compactMixOf(result.usage) : null
      if (mix) await $.store.set(MIX_KEY, mix)
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

  // 사람이 패널을 닫으면 닫아 둔다 — 데스크톱이면 모든 데스크톱 세션에서, 터미널이면 이 세션만
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await setWantedView($, null)
      await update($, paneView, () => null)
    }
    return next(e)
  }).catch(($, e, next) => next(e)) // 저장이 실패해도 닫기는 그대로 간다

  on('command.run', { command: 'easy-compact' }, async ($, e) => {
    await ensureLang($)
    const args = e.args.trim()
    const [verb = ''] = args.split(/\s+/)
    // 동사 뒤 전부(줄바꿈 포함) — 직접 쓰는 컴팩트 문구 · 문구 프리셋 이름 · set 의 항목과 값에 쓴다
    const rest = args.slice(verb.length).trim()
    const settingsReply = await settingsCommand($, verb, rest)
    if (settingsReply !== null) return { text: settingsReply }
    if (verb === 'hide' || verb === 'show') {
      await update($, isHidden, () => verb === 'hide')
      return { text: verb === 'hide' ? L('띠를 숨겼습니다.', 'Band hidden.') : L('띠를 다시 보입니다.', 'Band shown again.') }
    }
    if (verb === 'usage') {
      // 번갈아 여닫으니 어느 쪽이 됐는지 알린다 — "열거나 닫았습니다" 로는 닫힌 게 고장처럼 보였다
      const isOpened = (await toggleView($, 'usage')) !== null
      return {
        text: isOpened
          ? L(`${paneTitle()} 패널을 열었습니다.`, `Opened the ${paneTitle()} pane.`)
          : L(`${paneTitle()} 패널을 닫았습니다.`, `Closed the ${paneTitle()} pane.`),
      }
    }
    if (verb !== '') return { text: help() }
    // 흐름 먼저 — 사용량은 컴팩트 직후인지를 흐름에서 본다
    await loadFlow($, { fromTranscript: true })
    // 다시 읽기: 기본 적재(/context 분류)도 다시 잰다 — 계산식 최적의 재료
    await refreshUsage($, { categories: true, pushHistory: false })
    await followModel($)
    return { text: L('사용량 · 세션 기록(컨텍스트 흐름)을 다시 읽었습니다.', 'Re-read usage · the session transcript (context flow).') }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await ensureLang($)
    setSurface(e.surface)
    const ui = $.ui.resolve(e)
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
      body = drawSettingsView(
        settingsActs($),
        ui,
        await currentSettings($),
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
      )
    } else {
      const nowTurn = await read($, live)
      const phase = await read($, compactPhase)
      const kind = await read($, compactKind)
      // 진행 중 질문은 보내자마자(첫 요청이 끝나기 전에도) — 첫 요청이 끝나야 보이면 도구 없이 한 번에 끝나는 질문은
      // 끝날 때까지 안 보였다(CLI)
      const liveEl =
        nowTurn
          ? liveBlock(ui, nowTurn, allSums[allSums.length - 1], cols - CARD_INSET, g, e.surface, phase, kind)
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
      body = (
        <Box flexDirection="column">
          {drawNow(ui, e.surface, u, nowMs, widthPx, perm, inputsNow, foldOf('now'))}
          {drawHistory({ setAll: isAll => void setHistoryAll($, isAll), toggle: id => void toggleExpanded($, id) }, ui, allSums, nowMs, await read($, expandedTurn), await read($, historyAll), liveEl, cols - CARD_INSET, g, foldOf('history'), liveNote)}
          {drawCompactCard(ui, flowParts, effEl, foldOf('compact'))}
          {drawReference(ui, u, allSums.length > 0 ? allSums[allSums.length - 1]! : null, nowMs)}
        </Box>
      )
    }
    return (
      // 폭을 못 박는다 — 데스크톱은 줄을 안 바꾸는 글(버튼 이름 등)이 길면 안쪽 틀이 그만큼 넓어져 다른 글이
      // 넓어진 틀에서 줄을 바꾸고 패널 밖으로 잘렸다(화면 크기와 상관없이)
      <Box flexDirection="column" width={cols}>
        {/* 탭: 사용량 · 설정. 설정은 자주 안 열어 탭으로 — 자주 보는 건 사용량 한 줄기에 둔다(예전에 질문별
            비용을 따로 열었더니 오가기 불편했다) */}
        <Box key="pane-tabs" columnGap={1} flexWrap="wrap">
          {tab('usage', withIcon('📊', paneTitle()), !isSettings, () => void openUsageTab($, 'main'))}
          {tab('settings', withIcon('⚙', L('설정', 'Settings')), isSettings, () => void openUsageTab($, 'settings'))}
        </Box>
        <Box marginTop={1}>{body}</Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    if (e.props.hasSurvey || (await read($, isHidden))) {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const u = await read($, usage)
    const view = await read($, paneView)
    // 버튼엔 크기를 안 붙인다 — 바로 왼쪽 줄에 컨텍스트 · 컴팩트 구간이 있다. 이름은 mod 이름 "이지 컴팩트":
    // 띠에 mod 이름이 따로 없고, 앱 기본 컴팩트(진행 글 "클로드 기본 compact")와 갈린다
    const compactCore = L('이지 컴팩트', 'Easy Compact')
    const compactLabel = withIcon('🗜', compactCore)
    const isConfirming = !e.props.isWorking && (await read($, isConfirmingCompact))
    const nowMs = u ? await $.clock.now() : 0

    // 왼쪽 = 비용 영역(두 줄), 오른쪽 = 버튼 영역. 둘 사이에 세로줄을 둔다
    const sums = await read($, turnSummaries)
    const now = e.props.isWorking ? await read($, live) : null
    // 쉬는 동안 캐시가 식었거나 모델을 바꿨으면(다음 요청이 전체를 다시 씀) 지난 질문 줄은 숨긴다 — "캐시 만료 · 재작성"
    // 줄과 지난 질문의 "캐시 다시 씀" 이 같이 보여 어느 게 지금 일인지 헷갈렸다. 지난 질문 값은 사용량 패널에 있다
    const lineEst = u && !e.props.isWorking ? estimate(u.contextTokens, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom)) : null
    const lastLine = lineEst?.kind === 'cold' ? null : drawLastTurnLine(ui, sums.length > 0 ? sums[sums.length - 1]! : null, now)
    // 컴팩트 직후 크기 · 입력 몫 등 계산식 재료(measureOptimal) — 식은 캐시 줄 · 버튼 판단 · 확인창이 같은 값을 쓴다.
    // 모르면(직후 크기를 못 잼) 컴팩트 손익을 안 보인다
    const inputs = (await read($, optimal))?.inputs ?? null
    const afterTokens = inputs?.after ?? u?.contextTokens ?? 0
    const estimateLine = u ? drawEstimateLine(ui, u, nowMs, inputs) : emptyLine(ui, 'b-none', L('질문이 한 번 끝나면 비용이 보입니다', 'Costs appear after the first question finishes'))

    // 버튼: 패널(세션 트리 · 사용량)은 맨 윗줄 오른쪽, 컴팩트는 비용 줄 오른쪽. 확인은 띠 아래 한 덩어리로 펼친다
    const level = u ? levelOf(u.contextTokens) : 'ok'
    const phase = await read($, compactPhase)
    const look = phaseLook(phase, await read($, compactKind))
    const est = u ? estimate(u.contextTokens, u.model, u.lastActivityMs, nowMs, Boolean(u.switchedFrom)) : null
    // 캐시가 없는 까닭: 60분 지나 만료 · 모델을 바꿔 새 모델엔 없음 — 버튼 · 확인창 글만 다르고 셈은 같다
    const isSwitched = est?.kind === 'cold' && est.reason === 'model'
    // 캐시가 식었고 바로 컴팩트가 그냥 이어 가기보다 싸면 버튼을 "바로 컴팩트 권장" 으로(정리 단계 없이)
    const cold = u && inputs && est?.kind === 'cold' ? coldCompact(u.contextTokens, inputs, u.model) : null
    const isColdWin = cold !== null && cold.compactUsd < cold.continueUsd
    // 캐시가 식었는데 바로 컴팩트가 이어 가기보다 비싼 크기면 권장 · 강조를 띄우지 않는다(정리 후 컴팩트는 정리 질문이
    // 전체를 다시 써 더 비싸다). 줄인 만큼은 그 뒤 요청들에서 천천히 돌아올 뿐이다
    const shownLevel = est?.kind === 'cold' && !isColdWin ? 'ok' : level
    const pulse = (hex: string, alt: string) => pulseDot(ui, e.surface, hex, alt)
    // 컴팩트 시점(설정): 구간이면 시작부터 노랑 "컴팩트하기 좋은 때", 끝부터 빨강 "컴팩트 늦어짐" + 깜빡이는 점.
    // 직접 지정이면 그 80% 부터 노랑, 정한 크기부터 빨강 "컴팩트 권장"
    const isRange = thresholds().isRange === true
    const compactText =
      shownLevel === 'cut'
        ? withIcon('🔴', isRange ? L('컴팩트 늦어짐', 'Compact overdue') : L('컴팩트 권장', 'Compact advised'))
        : shownLevel === 'warn'
          ? isRange
            ? withIcon('🟡', L('컴팩트하기 좋은 때', 'Good time to compact'))
            : withIcon('🟡', compactCore)
          : compactLabel
    // 진행 중엔 버튼 대신 글자 — 눌러도 아무 일 없다
    const compactRow =
      phase === 'compacting' && look ? (
        <Box columnGap={1} alignItems="center">
          {pulse(look.hex, L('컴팩트 중', 'Compacting'))}
          <Text color={look.color}>{look.text}</Text>
        </Box>
      ) : phase === 'tidying' && look ? (
        <Box columnGap={1} alignItems="center">
          {pulse(look.hex, L('저장 중', 'Saving'))}
          <Text color={look.color}>{look.text}</Text>
          <Button key="compact-cancel" label={L('취소', 'Cancel')} variant="secondary" onPress={() => update($, compactPhase, () => 'idle')} />
        </Box>
      ) : e.props.isWorking ? (
        // 턴이 도는 중엔 누를 수 없다(버튼이 아니라 글자) — 끝나면 버튼으로 돌아온다
        <Text dimColor>{L(`${compactLabel} · 답이 끝나면 누를 수 있음`, `${compactLabel} · available when the answer ends`)}</Text>
      ) : isConfirming ? (
        // 확인창이 열린 자리를 다시 누르면 닫힌다(글자였을 땐 눌러도 반응이 없었다)
        <Box columnGap={1} alignItems="center">
          {/* 아이콘은 버튼 밖 — 버튼 이름은 앱이 자기 색으로 그려 일부만 칠할 수 없다. 카드 제목의 파란 아이콘과 짝 */}
          {iconOf('🗜') ? <Text color={ACCENT}>{iconOf('🗜')}</Text> : null}
          {/* "컴팩트 열림" 은 컴팩트가 도는 것처럼 읽혔다 — 원래 이름에 닫기 표시만(상태는 아래 카드가 보인다) */}
          <Button key="compact-close" label={L('이지 컴팩트 ✕', 'Easy Compact ✕')} variant="secondary" onPress={() => update($, isConfirmingCompact, () => false)} />
        </Box>
      ) : (
        <Box columnGap={1} alignItems="center">
          {phase === 'held' ? <Text color="yellow">{withIcon('⏸', L('보류됨', 'On hold'))}</Text> : null}
          {isColdWin
            ? pulse('#4c9be8', isSwitched ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired'))
            : shownLevel === 'cut'
              ? pulse('#e05555', isRange ? L('컴팩트 늦어짐', 'Compact overdue') : L('컴팩트 권장', 'Compact advised'))
              : // 터미널은 버튼 이름의 🟡 를 빼서 노랑 표시가 없다 — 같은 자리 점(● 노랑)으로
                shownLevel === 'warn' && e.surface === 'terminal'
                ? pulse('#e0b040', isRange ? L('컴팩트하기 좋은 때', 'Good time to compact') : L('곧 컴팩트할 때', 'Compact soon'))
                : null}
          <Button
            key="compact"
            label={
              isColdWin
                ? isSwitched
                  ? withIcon('🔄', L('모델 바뀜 · 바로 컴팩트 권장', 'Model switched · compact now advised'))
                  : withIcon('🧊', L('캐시 만료 · 바로 컴팩트 권장', 'Cache expired · compact now advised'))
                : compactText
            }
            {...(shownLevel === 'ok' && !isColdWin ? {} : { variant: 'primary' as const })}
            onPress={() => update($, isConfirmingCompact, () => true)}
          />
        </Box>
      )

    // 확인창은 대화상자 꼴: 위에 선택지마다 "이름 · 하는 일"(한 줄에 들게 짧게), 맨 아래 오른쪽에 버튼
    // [저장하고 컴팩트] [바로 컴팩트] [✕ 취소] — 식은 캐시여도 자리는 같고 주 버튼(▶)만 바뀐다.
    // 버튼을 왼쪽에 세로로 두니 설명과 섞였고, 한 줄 왼쪽에 셋이면 탭처럼 읽혔다.
    // 띠에 여유가 있으면 줄 사이를 한 칸씩 띄운다(넘치면 띠가 스크롤된다)
    const sNow = await currentSettings($)
    const tidyNow = tidySteps(sNow)
    // 띠 높이(maxRows)에서 남는 줄만큼 카드 안을 띄운다 — 넘치면 띠가 스크롤돼 버튼이 가려진다.
    // 기본 줄 수 = 띠 두 줄(+ 한도 줄) + 테두리 2 + 제목 + 효과 줄 + 문구 고르기 + 선택지 2 + 버튼, 좁으면 효과 줄 · 문구 고르기 ·
    // 선택지가 줄바꿈된다.
    // 띄우는 순서: 효과 줄 아래 → 효과 줄 위 → 버튼 위
    const isWide = e.props.bodyColumns >= 115
    // 맨 윗줄(한도 · 패널 버튼)은 한도가 없어도 있다
    const baseRows = 3 + 2 + 1 + (isWide ? 1 : 2) + (isWide ? 1 : 2) + (isWide ? 2 : 4) + 1
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
    // 제목은 흰색, 아이콘만 파랑 — 테두리와 이어지고 글은 잘 읽힌다
    const card = (key: string, icon: string, title: string, summary: unknown, rows: unknown[], isColdFirst: boolean) => (
      <Box key={key} flexDirection="column" borderStyle="round" borderColor={ACCENT} paddingX={2}>
        {/* 아이콘과 글 사이는 공백 문자가 아니라 칸 간격 — 데스크톱은 글 조각 앞뒤 공백을(줄바꿈 없는 공백도) 잘라 붙어 보였다 */}
        <Box columnGap={1}>
          {iconOf(icon) ? (
            <Text bold color={ACCENT}>
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
    const actions = (isColdFirst: boolean) => (
      <Box key="actions" justifyContent="flex-end" columnGap={2} marginTop={gapAboveActions}>
        <Button
          key="compact-tidy"
          label={pad(isColdFirst ? L('저장하고 컴팩트', 'Save & compact') : L('▶ 저장하고 컴팩트', '▶ Save & compact'))}
          variant={isColdFirst ? 'secondary' : 'primary'}
          onPress={() => tidyThenCompact($, payoffNote)}
        >
          {wide(isColdFirst ? L('저장하고 컴팩트', 'Save & compact') : L('▶ 저장하고 컴팩트', '▶ Save & compact'))}
        </Button>
        <Button
          key="compact-yes"
          label={pad(isColdFirst ? L('▶ 바로 컴팩트', '▶ Compact now') : L('바로 컴팩트', 'Compact now'))}
          variant={isColdFirst ? 'primary' : 'secondary'}
          onPress={() => compactNow($, directKeep())}
        >
          {wide(isColdFirst ? L('▶ 바로 컴팩트', '▶ Compact now') : L('바로 컴팩트', 'Compact now'))}
        </Button>
        <Button key="compact-no" label={pad(L('✕ 취소', '✕ Cancel'))} variant="secondary" onPress={() => update($, isConfirmingCompact, () => false)}>
          {wide(L('✕ 취소', '✕ Cancel'))}
        </Button>
      </Box>
    )
    // 바로 컴팩트가 /compact 뒤에 붙이는 지시 — 무엇을 붙이는지 그대로 보인다
    const directNote = L(`/compact 지시 「${directKeep()}」`, `/compact instruction "${directKeep()}"`)
    // 손익: 드는 값만으론 와닿지 않는다 — 컴팩트로 질문마다 얼마 아끼고 몇 질문이면 본전인지
    const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
    const pay = u && inputs && est?.kind === 'warm' ? compactPayoff(u.contextTokens, inputs, u.model, callsPerQ) : null
    const verdict = !pay
      ? null
      : pay.breakEvenCalls === null
        ? { text: L('아낄 게 거의 없음 — 컨텍스트가 이미 작습니다', 'Little to save — the context is already small'), color: 'red' }
        : pay.breakEvenQuestions !== null
          ? {
              text:
                pay.breakEvenQuestions <= 1
                  ? L('다음 질문 하나로 본전', 'breaks even with the next question')
                  : L(`질문 ${pay.breakEvenQuestions}개면 본전`, `breaks even after ${pay.breakEvenQuestions} questions`),
              color: pay.breakEvenQuestions <= 2 ? 'green' : pay.breakEvenQuestions <= 5 ? 'yellow' : 'red',
            }
          : {
              text: L(`요청 ${pay.breakEvenCalls}회면 본전`, `breaks even after ${plural(pay.breakEvenCalls, 'request')}`),
              color: pay.breakEvenCalls <= 10 ? 'green' : pay.breakEvenCalls <= 30 ? 'yellow' : 'red',
            }
    // 정리 프롬프트에 같이 넘길 손익 한 줄 — 세션이 "곧 끝날 일이라 손해" 를 판단하는 근거
    const payoffNote =
      pay && u && verdict
        ? [
            L(`컨텍스트 ${fmtTokens(u.contextTokens)} → ~${fmtTokens(Math.min(afterTokens, u.contextTokens))}`, `context ${fmtTokens(u.contextTokens)} → ~${fmtTokens(Math.min(afterTokens, u.contextTokens))}`),
            L(`요청 1회 ${fmtUsd(pay.nowCallUsd)} → ${fmtUsd(pay.afterCallUsd)}`, `per request ${fmtUsd(pay.nowCallUsd)} → ${fmtUsd(pay.afterCallUsd)}`),
            pay.saveQuestionUsd !== null && pay.saveCallUsd > 0 ? L(`질문 1개당 ~${fmtUsd(pay.saveQuestionUsd)} 아낌`, `saves ~${fmtUsd(pay.saveQuestionUsd)} per question`) : null,
            L(`저장 + 컴팩트 ~${fmtUsd(pay.costUsd)}`, `save + compact ~${fmtUsd(pay.costUsd)}`),
            verdict.text,
          ]
            .filter(Boolean)
            .join(' · ')
        : null
    // 화면엔 두 줄만: 무엇을 얻나(질문당 아끼는 값) · 얼마 드나. 본전 · 요청당 값은 투머치였다 —
    // 그 계산은 정리 프롬프트로 세션에 넘겨 "손해인가" 판단에만 쓴다
    const saves = pay !== null && pay.saveCallUsd > 0 && pay.breakEvenCalls !== null
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
            <Text color="yellow">{L('아낄 게 거의 없음', 'little to save')}</Text>
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
      ) : est?.kind === 'cold' ? (
        // 캐시가 식었으면 다음 요청이 전부 다시 쓴다 — 작게 줄여 두면 그 값이 준다
        <Text wrap="wrap">
          <Text>{isSwitched ? L('모델 바뀜', 'Model switched') : L('캐시 만료', 'Cache expired')}</Text>
          <Text dimColor>{' · '}</Text>
          <Text>{L('그냥 이어 가면 첫 요청 ', 'continuing as is, the first request costs ')}</Text>
          <Text bold color="red">
            ~{fmtUsd(est.rewriteUsd)}
          </Text>
          <Text>{L('(전체 다시 쓰기)', ' (full rewrite)')}</Text>
          <Text dimColor>{' · '}</Text>
          <Text>{L('컴팩트하면 ', 'compacting ')}</Text>
          <Text bold color="green">
            ~{fmtUsd((afterTokens * est.rates.write1h) / 1e6)}
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
              <Text bold>{L('손해면 멈추고 알림', 'stops and tells you if it is a loss')}</Text>
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
    const coldConfirm =
      isColdWin && cold && u
        ? card(
            'confirm-cold',
            isSwitched ? '🔄' : '🧊',
            isSwitched
              ? L('모델을 바꿔 새 모델엔 캐시가 없습니다 — 바로 컴팩트할까요?', 'You switched models and the new one has no cache — compact now?')
              : L('캐시가 만료됐습니다 — 바로 컴팩트할까요?', 'The cache has expired — compact now?'),
            <Text wrap="wrap">
              <Text>{L('그냥 이어 가면 첫 요청이 ', 'Continuing as is, the first request rewrites all ')}</Text>
              <Text bold color={LEVEL_TEXT[levelOf(u.contextTokens)]}>
                {fmtTokens(u.contextTokens)}
              </Text>
              <Text>{L(' 전체를 다시 씀 ', ' ')}</Text>
              <Text bold color="red">
                ~{fmtUsd(cold.continueUsd)}
              </Text>
              <Text dimColor>{' · '}</Text>
              <Text>{L('바로 컴팩트하면 ', 'compacting now ')}</Text>
              <Text bold color="green">
                ~{fmtUsd(cold.compactUsd)}
              </Text>
              <Text dimColor> → </Text>
              <Text bold color="green">
                ~{fmtTokens(Math.min(afterTokens, u.contextTokens))}
              </Text>
            </Text>,
            [saveRow(true), directRow],
            true,
          )
        : null
    // 저장 내용은 컴팩트 문구(일반 · 긴 세션 이어가기 · 마무리 · 직접 쓴 글)를 따른다 — 이 카드에서도 고른다
    const confirm = !isConfirming ? null : (coldConfirm ?? card('confirm', '🗜', L('컴팩트할까요?', 'Compact now?'), costLine, [saveRow(false), directRow], false))
    // 패널 버튼: 버튼 하나에 상태와 동작을 같이 — 닫혀 있으면 "○○ 패널 ▸", 열려 있으면 "○○ 패널 열림 ✕".
    // "비용 닫기" 는 비용을 닫는 것처럼, 글자 + 작은 [닫기] 는 아래 컴팩트 버튼과 줄이 안 맞아 어색했다
    const panelButton = (key: PaneView, name: string) => (
      <Button
        key={key}
        label={view === key ? L(`${name} 패널 열림 ✕`, `${name} pane open ✕`) : L(`${name} 패널 ▸`, `${name} pane ▸`)}
        variant="secondary"
        onPress={async () => {
          await toggleView($, key)
        }}
      />
    )
    // 띠는 세 줄 격자: 1 = 한도 | 패널 버튼, 2 = 요청당(식은 캐시) 줄, 3 = 지난 질문 | 컴팩트 버튼.
    // 왼쪽 글이 비어도(한도 없는 API 키 세션 · 식은 캐시라 지난 질문 숨김) 줄은 남아 버튼 자리가 늘 같다 — 버튼을 왼쪽 글
    // 덩어리의 세로 가운데에 두니 한도 줄이 넘어가거나 줄이 빠질 때마다 자리가 바뀌었고,
    // 패널 버튼과 컴팩트 버튼이 위아래로 붙어 누를 때 간섭했다. 둘 사이엔 늘 2줄이 낀다.
    // 다른 mod 가 이 띠를 감싸면(next) key "b-panels" 칸 끝에 자기 패널 버튼을 넣을 수 있다 — 오른쪽 끝이 컴팩트 버튼과 맞는다
    // (session-tree-viewer 의 🌳). key 를 바꾸면 그쪽도
    const panels = (
      <Box key="b-panels" columnGap={1} alignItems="center" flexShrink={0}>
        {panelButton('usage', withIcon('📊', paneTitle()))}
      </Box>
    )
    const right = (
      <Box flexDirection="column" flexShrink={0} alignItems="flex-end">
        {compactRow}
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
    return (
      <Box flexDirection="column">
        {/* 세션 한도 줄은 계정에 따라 저절로: 엔진은 구독 세션에만 5시간 · 7일을 알려 준다
            ("rateLimits is empty off a subscription") — API 키 세션엔 줄이 없다. 옵션을 두지 않는다.
            좁으면 한도 줄이 두 줄로 넘어간다 — 패널 버튼은 그때도 오른쪽 위(위 정렬) */}
        {row('b-r1', u && u.rateLimits.length > 0 ? drawLimitsLine(ui, e.surface, u, nowMs) : null, panels, 'flex-start')}
        {row('b-r2', estimateLine, null, 'center')}
        {row('b-r3', lastLine, right, 'center')}
        {confirm}
      </Box>
    )
  })
}
