import { atom, read, update } from 'claude-code'
import type { AgentRun } from './turns'
import type { EngineInterface, Register } from 'claude-code'
import type {
  AutoState,
  ChangeGroup,
  CompactEvent,
  CompactInputs,
  CostShow,
  CostParts,
  LiveTurn,
  Optimal,
  PaneMode,
  PaneView,
  QuestionCells,
  SaveTurn,
  Settings,
  Source,
  StepDetail,
  TtlConfig,
  TurnsOlder,
  TurnSummary,
  UpdateState,
  Usage,
  UsageTab,
} from '../types'
import {
  addCost,
  average,
  cacheWarnFor,
  compactMixOf,
  compactPayoff,
  costOf,
  endsWithTail,
  coldFor,
  estimateFor,
  isWarmMix,
  fmtTokens,
  levelOf,
  SESSION_TEXT,
  sessionColorOf,
  thresholds,
  spendDay,
  monthStartMs,
  projectSlug,
  spendUsd,
  extraUsd,
  engineOfLine,
  engineSince,
  compactOutputOf,
  retroUsd,
  modelKey,
  ratesFor,
  rewriteOf,
  tailOf,
  setThresholds,
  SAVE_GUESS,
  WARM_COMPACT,
  ZERO_COST,
  ttlOf,
  guessTtl,
  cacheRankOf,
} from './cost'
import type { CompactCalib, CompactMix, RetroCompacts, SpendDays } from './cost'
import { ARRIVE_SETTLE_MS, clearArrival, drawingBar, endFlash, FLASH_STEP_MS, markArrival, noteRank, stepFlash, takeArrival } from './flash'
import { BAND_PARTS, isSlim, parseSlim, slimCustom, spendOf, PARTS, setPart, parsePartKey, parsePartLevel, partName, levelName, slimViewOf, bandModeName, bandPartName, bandShowMode, bandShowOf, bandStateText, chooseScreen, editView, hiddenNote, isViewPart, HIDDEN_NOTE_MS, parseScreen, screenName, setFolded, viewOf, paneAutoUse, paneSyncUse, revealLabel, revealName, setBandShow, chooseTidy, isAutoWord, parseOnOff, DEFAULT_SETTINGS, normalizeSettings, NEW_INSTALL_SCREEN, UPDATE_SCREEN, paneModeName, paneModeOf, parseBandMode, parseBandPart, parseMinutes, parseTokens, setBandPart, setCompactAt, setFollow, setRange, setTidyCustom, thresholdsOf, tidyStyles, tidyBody, usesCustom, setCompactCustom, setContextWindow, setEngineAuto } from './settings'
import {
  baseOfCategories,
  GROWTH_GUESS,
  growthPerStep,
  keepOptimal,
  MIN_GROWTH_STEPS,
  onceUsd,
  optimalAt,
  OUTPUT_GUESS,
  SUMMARY_GUESS,
} from './optimal'
import { afterGuess, afterInNowTokens, compactSince, compactSummary, costScanFromLines, costScanOf, flowFromRecords, isNotShrunk, lacksModels, lastBoundaryAfter, lastCtxOf, lastMainTtl, MAX_POINTS, mergeMeasured, parseFlowFile, pendingCompact, recordsFromLines, restoredOf, scanTranscript, serializeFlow, sharedFor, syncCompactAfter, extraPerCall, ultraStateOf, withPoint, withQuestion, recordsFromTranscript } from './flow'
import type { Boundary } from './flow'
import type { CostScan, Flow, FlowRecord } from './flow'
import type { Tokens } from './cost'
import { APP_MIN_USD, agentPart, agentSum, attachHead, continuedName, ctxNumText, effortSplit, PLUGIN_SENT, promptHead, stepLabel, paneTitle } from './text'
import type { AttachCounts } from './text'
import { kindDirect, kindTidy, compactKindOf, markGo, tidyPrompt, compactKeep, directKeep, tidyVerdict, autoTurnOf, autoSavePrompt, autoContinuePrompt, autoCompactKeep, kindAuto, kindAutoSave, isAutoSaveKind } from './tidy'
import { AUTO_AGAIN_REQUESTS, AUTO_WAIT_MS, autoChipText, autoDraftNote, autoFromStore, autoKey, autoLossOf, autoNoteText, autoRangeText, autoToggleNote, freshAuto, isAutoActive, isChainStuck, isTooSoon } from './auto'
import { drawAutoNote } from './ui-auto'
import { CH_PX, oldEngineNote, questionScope, setGaugeShape, setMotion, row, gridOf, CARD_INSET, SVG_MAX_PX } from './ui-common'
import type { Ui } from './ui-common'
import { setBandOrder, setCtxUnit, slimButtonText, slimParts } from './ui-band'
import type { SpendShown } from './ui-band'
import { permanentOf, drawAllSpend, setPaneBarMotion } from './ui-usage'
import type { AllSpendLine, Tally } from './ui-usage'
import { drawSettingsView, drawUpdateDrawer } from './ui-settings'
import { cellMark, drawAnswerChip, liveStrip, sampleTurn, sampleUsage, spinnerCost } from './ui-answer'
import { drawBar } from './ui-bar'
import type { BarActions, BarData } from './ui-bar'
import { drawPaneHead, drawPaneMain, settingsPreviews } from './ui-pane'
import type { PaneMainActions } from './ui-pane'
import { statusLineText } from './status-line'
import { diagHead, dumpText, nativePath, redactDump, revealArgv } from './diag'
import type { DiagCounts, DiagView } from './diag'
import { isKorean, L, lang, plural, setLang } from './i18n'
import { setSurface } from './glyph'
import type { Lang } from './i18n'
import { changeRange, changelogItems, changelogVersionsBetween, engineBelow, installedFrom, marketVersionOf, MIN_ENGINE, pluginDataId, syncedFrom, versionGt } from './paths'
import type { SettingsActions, SettingsTab } from './ui-settings'
import { agentRunFromText, cellScopeOf, foldOlder, nextEffortOutput, nextQuestionCells, nextSwitches, NO_OLDER, olderFromRebuilt, olderOf, parseTurnsFile, parseTurnsOlder, serializeTurns, TURNS_KEEP, turnsFromRecords, withAgentStep, withAppStep, withCellScopes } from './turns'
import { AFTER_KEY, AGENT_LIST_TRIES, AGENT_QUIET_MS, APPLY_TOTAL_MS, APP_FIX_MS, CARDS_OPEN_DEFAULT, CHECK_TOTAL_MS, CTX_RANK, DIAG_CLOSED, GAUGE_NOTE_KEY, GAUGE_NOTE_MS, GAUGE_SHRINK_MS, KEPT_KEY, LEDGER_COMPACTS_MAX, LIMITS_FILE, MIX_KEY, OLD_DEFAULT_RANGE, OUTPUT_KEY, PANE, PANE_AUTO_KEEP, PANE_AUTO_KEY, PANE_EVENT_KEY, PANE_MODE_KEY, PER_Q_MIN, PER_Q_WINDOW, READ_LIMIT, SAVE_KEEP, SEEN_VERSION_KEY, SETTINGS_OPEN_DEFAULT, SPEND_RETRY_MS, SUMMARY_KEY, UPDATE_GRACE_MS, UPDATE_IDLE, URGENCY_RANK, agentInfo, freshestLimits, listedAgents, paneLog, parseSharedLimits, sessRankOf, spendColors } from './state'
import type { PaneEvent, Urgency } from './state'



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

async function dataDir($: EngineInterface): Promise<string> {
  const installed = installedFrom($.plugin.root) ?? syncedFrom($.plugin.root)
  if (installed) return `${installed.configDir}/plugins/data/${pluginDataId('easy-compact', installed.marketplace)}`
  return `${await claudeHome($)}/plugins/data/easy-compact`
}


async function installNow($: EngineInterface): Promise<{ configDir: string; marketplace: string } | null> {
  const real = installedFrom($.plugin.root) ?? syncedFrom($.plugin.root)
  if (real) return real
  try {
    const fake = await $.env.get('EASY_COMPACT_FAKE_INSTALL')
    if (fake) {
      const j = JSON.parse(fake) as { configDir?: unknown; marketplace?: unknown }
      if (typeof j.configDir === 'string' && typeof j.marketplace === 'string') return { configDir: j.configDir, marketplace: j.marketplace }
    }
  } catch {
  }
  return null
}

async function readJsonFile($: EngineInterface, path: string): Promise<unknown> {
  try {
    return JSON.parse(await $.fs.read(path)) as unknown
  } catch {
    return null
  }
}

async function ownVersion($: EngineInterface): Promise<string | null> {
  const v = ((await readJsonFile($, `${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: unknown } | null)?.version
  return typeof v === 'string' ? v : null
}

async function marketDir($: EngineInterface, inst: { configDir: string; marketplace: string }): Promise<string> {
  const known = (await readJsonFile($, `${inst.configDir}/plugins/known_marketplaces.json`)) as Record<string, { installLocation?: unknown }> | null
  const loc = known?.[inst.marketplace]?.installLocation
  return typeof loc === 'string' && loc.trim() !== '' ? loc.replace(/\\/g, '/').replace(/\/$/, '') : `${inst.configDir}/plugins/marketplaces/${inst.marketplace}`
}

async function readMarket($: EngineInterface, inst: { configDir: string; marketplace: string }): Promise<{ market: string | null; marketAt: string | null }> {
  const market = marketVersionOf(await readJsonFile($, `${await marketDir($, inst)}/.claude-plugin/marketplace.json`))
  const known = (await readJsonFile($, `${inst.configDir}/plugins/known_marketplaces.json`)) as Record<string, { lastUpdated?: unknown }> | null
  const at = known?.[inst.marketplace]?.lastUpdated
  return { market, marketAt: typeof at === 'string' ? at : null }
}

async function readChanges(
  $: EngineInterface,
  inst: { configDir: string; marketplace: string } | null,
  from: string | null,
  to: string | null,
): Promise<{ versions: string[]; changes: Record<string, ChangeGroup[]> }> {
  const root = $.plugin.root.replace(/\\/g, '/')
  const dirs = !inst ? [root, `${root}/docs/public`] : inst.marketplace === 'synced' ? [root] : [await marketDir($, inst)]
  const names = lang() === 'ko' ? ['CHANGELOG.ko.md', 'CHANGELOG.md'] : ['CHANGELOG.md']
  for (const path of dirs.flatMap(dir => names.map(name => `${dir}/${name}`))) {
    let md: string
    try {
      md = await $.fs.read(path)
    } catch {
      continue
    }
    const changes: Record<string, ChangeGroup[]> = {}
    const versions: string[] = []
    for (const v of changelogVersionsBetween(md, from, to)) {
      const groups = changelogItems(md, v)
      if (groups && groups.length > 0) {
        changes[v] = groups
        versions.push(v)
      }
    }
    return { versions, changes }
  }
  return { versions: [], changes: {} }
}

async function refreshUpdateInfo($: EngineInterface): Promise<void> {
  await dropStaleUpdateJob($)
  const isJobLive = updateJob !== null
  const inst = await installNow($)
  const own = await ownVersion($)
  if (!inst) {
    const got = await readChanges($, null, null, own)
    let devOff = false
    await update($, updateInfo, prev => ({ ...prev, own, updatedTo: null, ...got, phase: 'dev', devOff }))
    $.ui.invalidate('ui.render')
    return
  }
  const seen = await $.store.get(SEEN_VERSION_KEY).catch(() => undefined)
  const updatedTo = own && seen !== own ? own : null
  if (inst.marketplace === 'synced') {
    const r = changeRange(own, null, seen, updatedTo)
    const got = await readChanges($, inst, r.from, r.to)
    await update($, updateInfo, prev => ({ ...prev, own, updatedTo, ...got, phase: 'synced' }))
    $.ui.invalidate('ui.render')
    return
  }
  const m = await readMarket($, inst)
  const r = changeRange(own, m.market, seen, updatedTo)
  const got = await readChanges($, inst, r.from, r.to)
  const isAhead = versionGt(m.market, own)
  await update($, updateInfo, prev => {
    const was = !isJobLive && (prev.phase === 'checking' || prev.phase === 'updating') ? 'idle' : prev.phase
    return {
      ...prev,
      own,
      ...m,
      updatedTo,
      ...got,
      phase: (was === 'done' || was === 'newer') && !isAhead ? 'latest' : (was === 'idle' || was === 'latest') && isAhead ? 'newer' : was,
    }
  })
  $.ui.invalidate('ui.render')
}

async function toggleUpdateDrawer($: EngineInterface): Promise<void> {
  if (await read($, updDrawer)) return closeUpdateDrawer($)
  await update($, updDrawer, () => true)
  $.ui.invalidate('ui.render')
  void refreshUpdateInfo($).catch(() => {})
}

async function closeUpdateDrawer($: EngineInterface): Promise<void> {
  if (!(await read($, updDrawer))) return
  await update($, updDrawer, () => false)
  const upd = await read($, updateInfo)
  if (upd.updatedTo) {
    await $.store.set(SEEN_VERSION_KEY, upd.updatedTo).catch(() => {})
    void refreshUpdateInfo($).catch(() => {})
  }
  await update($, updateInfo, prev => ({ ...prev, open: {} }))
  if ((await read($, diagCard)).where === 'drawer') {
    await update($, diagCard, prev => ({ ...prev, open: false, copiedLines: null, savedPath: null }))
    diagSnap = null
  }
  $.ui.invalidate('ui.render')
}

async function toggleUpdateOpen($: EngineInterface, key: 'changes' | 'error' | 'note'): Promise<void> {
  await update($, updateInfo, prev => ({ ...prev, open: { ...prev.open, [key]: !prev.open?.[key] } }))
  $.ui.invalidate('ui.render')
}

async function claudeCandidates($: EngineInterface): Promise<string[]> {
  const out = ['claude']
  const appDirs: string[] = []
  const norm = (v: string | undefined) => v?.replace(/\\/g, '/') || null
  const appData = norm(await $.env.get('APPDATA').catch(() => undefined))
  if (appData) appDirs.push(`${appData}/Claude`)
  const home = norm(await $.env.get('HOME').catch(() => undefined)) ?? norm(await $.env.get('USERPROFILE').catch(() => undefined))
  if (home) appDirs.push(`${home}/Library/Application Support/Claude`, `${home}/.config/Claude`)
  for (const dir of appDirs) {
    try {
      const vers = (await $.fs.list(`${dir}/claude-code`)).filter(f => f.kind === 'dir' && /^\d+\.\d+\.\d+$/.test(f.name)).map(f => f.name)
      vers.sort((a, b) => (versionGt(a, b) ? -1 : versionGt(b, a) ? 1 : 0))
      for (const v of vers) {
        for (const build of await $.fs.list(`${dir}/claude-code/${v}`)) {
          if (build.kind !== 'dir') continue
          for (const exe of ['claude.exe', 'claude']) {
            const path = `${dir}/claude-code/${v}/${build.name}/${exe}`
            try {
              if ((await $.fs.stat(path)).kind === 'file') out.push(path)
            } catch {
            }
          }
        }
      }
    } catch {
    }
  }
  return out
}

async function runClaude(
  $: EngineInterface,
  cmd: 'marketplace-update' | 'plugin-update',
  totalMs: number,
): Promise<{ exitCode: number; last: string; isTimeout?: boolean } | null> {
  const start = await $.clock.now()
  for (const bin of await claudeCandidates($)) {
    const t0 = await $.clock.now()
    const timeoutMs = totalMs - (t0 - start)
    if (timeoutMs < 1000) return { exitCode: -1, last: '', isTimeout: true }
    try {
      const r =
        cmd === 'marketplace-update'
          ? await $.process.run([bin, 'plugin', 'marketplace', 'update', 'easy-compact'], { timeoutMs })
          : await $.process.run([bin, 'plugin', 'update', 'easy-compact@easy-compact'], { timeoutMs })
      const lines = `${r.stdout}\n${r.stderr}`.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
      return { exitCode: r.exitCode, last: lines[lines.length - 1] ?? '' }
    } catch {
      if ((await $.clock.now()) - t0 >= timeoutMs - 1000) return { exitCode: -1, last: '', isTimeout: true }
    }
  }
  return null
}

let updateJob: { kind: 'check' | 'apply'; at: number } | null = null


async function dropStaleUpdateJob($: EngineInterface): Promise<void> {
  if (updateJob === null || updateJob.at === 0) return
  const limit = (updateJob.kind === 'check' ? CHECK_TOTAL_MS : APPLY_TOTAL_MS) + UPDATE_GRACE_MS
  if ((await $.clock.now()) - updateJob.at > limit) updateJob = null
}

async function checkUpdate($: EngineInterface): Promise<void> {
  if (updateJob !== null) return
  const job = { kind: 'check' as const, at: 0 }
  updateJob = job
  try {
    job.at = await $.clock.now()
    const inst = await installNow($)
    if (!inst || inst.marketplace === 'synced') return
    const cur = await read($, updateInfo)
    await update($, updateInfo, prev => ({ ...prev, phase: 'checking', error: undefined, failedOn: undefined, isTimeout: undefined }))
    $.ui.invalidate('ui.render')
    const r = await runClaude($, 'marketplace-update', CHECK_TOTAL_MS)
    if (updateJob !== job) return
    const own = await ownVersion($)
    const m = await readMarket($, inst)
    const range = changeRange(own, m.market, await $.store.get(SEEN_VERSION_KEY).catch(() => undefined), cur.updatedTo)
    const got = await readChanges($, inst, range.from, range.to)
    const isFailed = !r || r.exitCode !== 0
    await update($, updateInfo, prev => ({
      ...prev,
      own,
      ...m,
      ...got,
      phase: isFailed ? 'failed' : versionGt(m.market, own) ? 'newer' : 'latest',
      error: isFailed && r ? (r.isTimeout ? L(`${CHECK_TOTAL_MS / 1000}초 안에 끝나지 않음`, `did not finish in ${CHECK_TOTAL_MS / 1000}s`) : r.last || `exit ${r.exitCode}`) : undefined,
      failedOn: isFailed ? 'check' : undefined,
      isTimeout: isFailed && r?.isTimeout === true ? true : undefined,
    }))
    $.ui.invalidate('ui.render')
  } finally {
    if (updateJob === job) updateJob = null
  }
}

async function applyUpdate($: EngineInterface): Promise<void> {
  if (updateJob !== null) return
  const job = { kind: 'apply' as const, at: 0 }
  updateJob = job
  try {
    job.at = await $.clock.now()
    const inst = await installNow($)
    if (!inst || inst.marketplace === 'synced') return
    await update($, updateInfo, prev => ({ ...prev, phase: 'updating', error: undefined, failedOn: undefined, isTimeout: undefined }))
    $.ui.invalidate('ui.render')
    const r = await runClaude($, 'plugin-update', APPLY_TOTAL_MS)
    if (updateJob !== job) return
    const isFailed = !r || r.exitCode !== 0
    await update($, updateInfo, prev => ({
      ...prev,
      phase: isFailed ? 'failed' : 'done',
      error: isFailed && r ? (r.isTimeout ? L(`${APPLY_TOTAL_MS / 1000}초 안에 끝나지 않음`, `did not finish in ${APPLY_TOTAL_MS / 1000}s`) : r.last || `exit ${r.exitCode}`) : undefined,
      failedOn: isFailed ? 'apply' : undefined,
      isTimeout: isFailed && r?.isTimeout === true ? true : undefined,
    }))
    $.ui.invalidate('ui.render')
  } finally {
    if (updateJob === job) updateJob = null
  }
}

let spendRunning = false
let spendFailAt = 0
let spendFailWhy = ''

async function wantsSpend($: EngineInterface, s: Settings): Promise<boolean> {
  const sp = spendOf(s)
  if (sp.today || sp.month) return true
  return (await read($, paneView)) !== null && (await paneModeNow($)) === 'detail'
}

async function refreshSpend($: EngineInterface, minGapMs = 30_000, isWanted = false, force = false): Promise<void> {
  const s = await currentSettings($)
  if (!isWanted && !(await wantsSpend($, s))) return
  if (spendRunning) return
  const nowMs = await $.clock.now()
  if (!force && spendFailAt > 0 && nowMs - spendFailAt < SPEND_RETRY_MS) return
  const prev = await read($, spend)
  if (prev && nowMs - prev.atMs < minGapMs && spendDay(prev.atMs) === spendDay(nowMs)) return
  spendRunning = true
  try {
    const ran = await $.process.run(
      ['node', `${$.plugin.root}/tools/scan-spend.mjs`, `${await claudeHome($)}/projects`, `${await dataDir($)}/spend-cache.json`, String(monthStartMs(nowMs)), await dataDir($)],
      { timeoutMs: 180_000 },
    )
    if (ran.exitCode !== 0) throw new Error(`exit ${ran.exitCode}`)
    const out = JSON.parse(String(ran.stdout ?? '')) as { days?: SpendDays; extra?: Record<string, number>; retro?: RetroCompacts; calib?: CompactCalib }
    if (!out.days) throw new Error('no days in output')
    const today = spendDay(nowMs)
    const first = `${today.slice(0, 8)}01`
    const mix = (await storedMixOrNull($)) ?? WARM_COMPACT
    const outTokens = compactOutputOf(out.calib, mix, (await storedCount($, OUTPUT_KEY)) ?? OUTPUT_GUESS)
    const retroMonth = retroUsd(out.retro, first, today, mix, outTokens)
    const since = engineSince(out.days)
    await update($, spend, () => ({
      atMs: nowMs,
      today: spendUsd(out.days!, today, today) + extraUsd(out.extra, today, today),
      month: spendUsd(out.days!, first, today) + extraUsd(out.extra, first, today),
      retroMonth: retroMonth.usd,
      ...(Object.keys(since).length > 0 ? { engineSince: since } : {}),
    }))
    await update($, spendFailed, () => false)
    spendFailAt = 0
    spendFailWhy = ''
    $.ui.invalidate('ui.render')
  } catch (err) {
    const why = String((err as Error)?.message ?? err)
    if (why !== spendFailWhy) log($, `spend scan failed: ${why}`)
    spendFailWhy = why
    spendFailAt = nowMs
    await update($, spendFailed, () => true)
    $.ui.invalidate('ui.render')
  } finally {
    spendRunning = false
  }
}

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
  }
  try {
    settingsFiles.push(`${await claudeHome($)}/settings.json`)
  } catch {
  }
  for (const path of settingsFiles) {
    const v = (await readJson(path))?.language
    if (typeof v === 'string' && v.trim()) return isKorean(v) ? 'ko' : 'en'
  }
  const appDirs: string[] = []
  try {
    const appData = await $.env.get('APPDATA')
    if (appData) appDirs.push(`${appData.replace(/\\/g, '/')}/Claude`)
  } catch {
  }
  try {
    const home = await $.env.get('HOME')
    if (home) appDirs.push(`${home.replace(/\\/g, '/')}/Library/Application Support/Claude`, `${home.replace(/\\/g, '/')}/.config/Claude`)
  } catch {
  }
  for (const dir of appDirs) {
    const v = (await readJson(`${dir}/config.json`))?.locale
    if (typeof v === 'string' && v.trim()) return isKorean(v) ? 'ko' : 'en'
  }
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

let autoLang: Lang | null = null

let langCheckedAt = Number.NEGATIVE_INFINITY

async function ensureLang($: EngineInterface): Promise<void> {
  let forced: string | undefined
  try {
    forced = await $.env.get('EASY_COMPACT_LANG')
  } catch {
    forced = undefined
  }
  let pick: Lang | null = forced === 'ko' || forced === 'en' ? forced : null
  if (pick === null) {
    const chosen = (await currentSettings($)).lang
    if (chosen === 'ko' || chosen === 'en') pick = chosen
  }
  if (pick === null) {
    const now = await $.clock.now()
    if (autoLang === null || now - langCheckedAt >= 30_000) {
      langCheckedAt = now
      autoLang = await detectLang($)
    }
    pick = autoLang
  }
  if (pick === lang()) return
  setLang(pick)
  $.ui.invalidate('ui.render')
  void refreshUpdateInfo($).catch(() => {})
}

async function saveLang($: EngineInterface, choice: Settings['lang']): Promise<void> {
  await saveSettings($, { ...(await currentSettings($)), lang: choice })
  langCheckedAt = Number.NEGATIVE_INFINITY
  await ensureLang($)
  $.ui.invalidate('ui.render')
}

let retitledTo: string | null = null


const SETTINGS_KEY = 'settings'

const SAVE_KEY = 'saveTurns'

const isConfirmingCompact = atom({ plugin: 'easy-compact', key: 'isConfirmingCompact' } as const, false)
const isAskingClear = atom({ plugin: 'easy-compact', key: 'isAskingClear' } as const, false)

const paneView = atom({ plugin: 'easy-compact', key: 'paneView' } as const, null)

const localPane = atom({ plugin: 'easy-compact', key: 'localPane' } as const, null)

const live = atom({ plugin: 'easy-compact', key: 'live' } as const, null)
const flashTick = atom({ plugin: 'easy-compact', key: 'flashTick' } as const, 0)

const turnSummaries = atom({ plugin: 'easy-compact', key: 'turnSummaries' } as const, [])

const cellScopes = atom({ plugin: 'easy-compact', key: 'cellScopes' } as const, {})

const turnsOlder = atom({ plugin: 'easy-compact', key: 'turnsOlder' } as const, null)

const compactPhase = atom({ plugin: 'easy-compact', key: 'compactPhase' } as const, 'idle')

const compactKind = atom({ plugin: 'easy-compact', key: 'compactKind' } as const, '')

const expandedTurn = atom({ plugin: 'easy-compact', key: 'expandedTurn' } as const, null)

const answerOpen = atom({ plugin: 'easy-compact', key: 'answerOpen' } as const, [])
const stepsFull = atom({ plugin: 'easy-compact', key: 'stepsFull' } as const, [])

const previewOpen = atom({ plugin: 'easy-compact', key: 'previewOpen' } as const, false)

const historyAll = atom({ plugin: 'easy-compact', key: 'historyAll' } as const, false)

const effectsAll = atom({ plugin: 'easy-compact', key: 'effectsAll' } as const, false)

const flowAll = atom({ plugin: 'easy-compact', key: 'flowAll' } as const, false)

const settings = atom({ plugin: 'easy-compact', key: 'settings' } as const, null)

const usageTab = atom({ plugin: 'easy-compact', key: 'usageTab' } as const, 'main')

const tidyRawOpen = atom({ plugin: 'easy-compact', key: 'tidyRawOpen' } as const, false)

const settingsOpen = atom({ plugin: 'easy-compact', key: 'settingsOpen' } as const, SETTINGS_OPEN_DEFAULT)
const settingsTab = atom({ plugin: 'easy-compact', key: 'settingsTab' } as const, 'bar' as SettingsTab)

const diagCard = atom({ plugin: 'easy-compact', key: 'diagCard' } as const, DIAG_CLOSED)

let diagSnap: { text: string; head: string; lines: number; turns: number; counts: DiagCounts; samples: string[] } | null = null

const cardsOpen = atom({ plugin: 'easy-compact', key: 'cardsOpen' } as const, CARDS_OPEN_DEFAULT)

const spend = atom({ plugin: 'easy-compact', key: 'spend' } as const, null)

const spendFailed = atom({ plugin: 'easy-compact', key: 'spendFailed' } as const, false)

const updateInfo = atom({ plugin: 'easy-compact', key: 'update' } as const, UPDATE_IDLE)

const updDrawer = atom({ plugin: 'easy-compact', key: 'updDrawer' } as const, false)

const tidyDraft = atom({ plugin: 'easy-compact', key: 'tidyDraft' } as const, null)

const compactDraft = atom({ plugin: 'easy-compact', key: 'compactDraft' } as const, null)

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

const summaryCard = atom({ plugin: 'easy-compact', key: 'summaryCard' } as const, false)

const auto = atom({ plugin: 'easy-compact', key: 'auto' } as const, null)

function log($: EngineInterface, text: string): void {
  try {
    $.ui.log(`easy-compact: ${text}`, { to: 'debug' })
  } catch {
  }
}

const compactChecks: { at: string; what: string }[] = []

async function noteCompact($: EngineInterface, what: string): Promise<void> {
  const atMs = await $.clock.now().catch(() => 0)
  compactChecks.push({ at: atMs > 0 ? new Date(atMs).toISOString() : '', what })
  if (compactChecks.length > 20) compactChecks.splice(0, compactChecks.length - 20)
  log($, what)
}

async function transcriptPath($: EngineInterface): Promise<string> {
  return `${await claudeHome($)}/projects/${projectSlug(await $.session.cwd())}/${await $.session.id()}.jsonl`
}

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

async function shareLimits($: EngineInterface, own: Usage['rateLimits'], ownAt: number | null): Promise<Usage['rateLimits']> {
  const file = `${await dataDir($)}/${LIMITS_FILE}`
  const pick = freshestLimits(own, ownAt, parseSharedLimits(await readJsonFile($, file)), await $.clock.now())
  if (pick.isOwn && ownAt !== null) await $.fs.write(file, `${JSON.stringify({ at: ownAt, rateLimits: own })}\n`).catch(() => {})
  return pick.rateLimits
}

let ttlNodeFailAt = 0

async function measureTtl($: EngineInterface): Promise<number | null> {
  try {
    const path = await transcriptPath($)
    const size = (await $.fs.stat(path)).size
    if (size <= READ_LIMIT) return lastMainTtl(await $.fs.read(path))
    const nowMs = await $.clock.now()
    if (ttlNodeFailAt > 0 && nowMs - ttlNodeFailAt < SPEND_RETRY_MS) return null
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/last-ttl.mjs`, path], { timeoutMs: 20_000 }).catch(() => null)
    if (!ran || ran.exitCode !== 0) {
      ttlNodeFailAt = nowMs
      return null
    }
    ttlNodeFailAt = 0
    const v = Number(ran.stdout.trim())
    return v === 5 || v === 60 ? v : null
  } catch {
    return null
  }
}

async function refreshTtl($: EngineInterface): Promise<void> {
  const v = await measureTtl($)
  if (v !== null) await update($, ttlMeasured, () => v)
}

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
  try {
    merged = (await $.settings.read()).promptCacheTtl
  } catch {
  }
  const force5m = await env(() => $.env.get('FORCE_PROMPT_CACHING_5M'))
  if (isOn(force5m)) return { source: 'force5m', value: '5m' }
  const envTtl = await env(() => $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'))
  if (isTtl(envTtl)) return { source: 'env', value: envTtl }
  if (isTtl(merged)) return { source: 'setting', value: merged }
  const enable1h = await env(() => $.env.get('ENABLE_PROMPT_CACHING_1H'))
  if (isOn(enable1h)) return { source: 'enable1h', value: '1h' }
  return { source: 'auto', value: null }
}


async function readFlow($: EngineInterface): Promise<Flow> {
  return { points: await read($, flowPoints), compactions: await read($, compactions), questions: await read($, flowQuestions), shared: await read($, flowShared) }
}

async function turnsFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/turns/${await $.session.id()}.json`
}

function saveTurns($: EngineInterface): void {
  void (async () => $.fs.write(await turnsFile($), serializeTurns(await read($, turnSummaries), await read($, turnsOlder))))().catch(() => {})
}



async function updateTurns($: EngineInterface, fn: (list: TurnSummary[]) => TurnSummary[]): Promise<void> {
  let dropped: TurnSummary[] = []
  await update($, turnSummaries, list => {
    const next = fn(list)
    const cut = Math.max(0, next.length - TURNS_KEEP)
    dropped = next.slice(0, cut)
    return next.slice(cut)
  })
  if (dropped.length > 0) await update($, turnsOlder, o => foldOlder(o ?? NO_OLDER, dropped))
  saveTurns($)
}

let isOlderUnknown = false

let isTurnsFresh = false

async function loadTurns($: EngineInterface): Promise<void> {
  let saved: TurnSummary[] | null = null
  let fileOlder: TurnsOlder | null = null
  try {
    const text = await $.fs.read(await turnsFile($))
    saved = parseTurnsFile(text)
    fileOlder = saved ? parseTurnsOlder(text) : null
  } catch {
    saved = null
  }
  const inMemory = await read($, turnSummaries)
  if (inMemory.length > 0) {
    if ((await read($, turnsOlder)) === null) await update($, turnsOlder, () => olderOf(fileOlder, inMemory))
    isOlderUnknown = (await read($, turnsOlder)) === null
    saveTurns($)
    return
  }
  let list: TurnSummary[]
  let older: TurnsOlder | null
  if (saved) {
    list = saved
    older = olderOf(fileOlder, saved)
  } else {
    const all = await rebuildTurns($).catch(() => null)
    if (!all) return
    isTurnsFresh = true
    list = all.slice(-TURNS_KEEP)
    older = all.length > TURNS_KEEP ? null : NO_OLDER
  }
  if ((await read($, turnSummaries)).length > 0) return
  await update($, turnSummaries, () => list)
  await update($, turnsOlder, () => older)
  isOlderUnknown = older === null
  if (!saved || (fileOlder === null && older !== null)) saveTurns($)
  await syncCompactSteps($)
  $.ui.invalidate('ui.render')
}

async function fillOlder($: EngineInterface): Promise<void> {
  if (!isOlderUnknown) return
  isOlderUnknown = false
  const all = await rebuildTurns($).catch(() => null)
  const engine = await ledgerUsd($)
  const kept = await read($, turnSummaries)
  if (engine === null) return
  const est = all ? olderFromRebuilt(all, kept) : null
  const cum = (costBase ?? 0) + engine
  const keptUsd = kept.reduce((sum, t) => sum + t.cost.usd, 0)
  const isFit = est !== null && keptUsd + est.usd <= cum + Math.max(0.5, cum * 0.03)
  await update($, turnsOlder, o => (isFit ? est : (o ?? NO_OLDER)))
  saveTurns($)
  $.ui.invalidate('ui.render')
}

async function rebuildTurns($: EngineInterface): Promise<TurnSummary[]> {
  const path = await transcriptPath($)
  const own = await $.session.id()
  let size: number
  try {
    size = (await $.fs.stat(path)).size
  } catch {
    return []
  }
  let records: FlowRecord[]
  if (size <= READ_LIMIT) records = recordsFromTranscript(await $.fs.read(path), own)
  else {
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path, own], { timeoutMs: 60_000 })
    if (ran.exitCode !== 0) throw new Error(`scan-transcript exit ${ran.exitCode}`)
    records = recordsFromLines(ran.stdout)
  }
  const runs: AgentRun[] = []
  const dir = `${path.replace(/\.jsonl$/, '')}/subagents`
  let entries: { name: string; kind: string; size: number }[] = []
  try {
    entries = await $.fs.list(dir)
  } catch {
    entries = []
  }
  for (const e of entries) {
    if (e.kind !== 'file' || !e.name.endsWith('.jsonl') || e.size > READ_LIMIT) continue
    try {
      const run = agentRunFromText(e.name.replace(/\.jsonl$/, ''), await $.fs.read(`${dir}/${e.name}`), own)
      if (run) runs.push(run)
    } catch {
    }
  }
  return turnsFromRecords(records, runs)
}

let costBase: number | null = null

let costSavedEngine = -1

let isCostChecked = false

async function costFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/cost/${await $.session.id()}.json`
}

function saveCost($: EngineInterface, engine: number): void {
  if (costBase === null || engine === costSavedEngine) return
  costSavedEngine = engine
  const body = JSON.stringify({ v: isCostChecked ? 2 : 1, base: costBase, engine })
  void (async () => $.fs.write(await costFile($), body))().catch(() => {
    costSavedEngine = -1
  })
}

async function costScan($: EngineInterface): Promise<CostScan | null> {
  try {
    const path = await transcriptPath($)
    const own = await $.session.id()
    if ((await $.fs.stat(path)).size <= READ_LIMIT) return costScanOf(await $.fs.read(path), own)
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path, own, '--costs'], { timeoutMs: 60_000 })
    return ran.exitCode === 0 ? costScanFromLines(ran.stdout) : null
  } catch {
    return null
  }
}

async function keepOwnTurns($: EngineInterface): Promise<void> {
  const list = await read($, turnSummaries)
  const old = list.filter(t => t.rebuilt)
  if (old.length === 0) return
  const until = Math.max(...old.map(t => t.atMs))
  const own = await rebuildTurns($).catch(() => null)
  if (!own) return
  const all = [...own.filter(t => t.atMs <= until), ...list.filter(t => !t.rebuilt)].sort((a, b) => a.atMs - b.atMs)
  const kept = all.slice(-TURNS_KEEP)
  await update($, turnSummaries, () => kept)
  await update($, turnsOlder, () => foldOlder(NO_OLDER, all.slice(0, all.length - kept.length)))
  isOlderUnknown = false
  saveTurns($)
  $.ui.invalidate('ui.render')
}

async function loadCostBase($: EngineInterface): Promise<void> {
  const engine = (await ledgerUsd($)) ?? 0
  let saved: { v: number; base: number; engine: number } | null = null
  try {
    const j = JSON.parse(await $.fs.read(await costFile($))) as { v?: unknown; base?: unknown; engine?: unknown }
    if ((j.v === 1 || j.v === 2) && typeof j.base === 'number' && typeof j.engine === 'number') saved = { v: j.v, base: j.base, engine: j.engine }
  } catch {
    saved = null
  }
  const isNew = saved !== null && engine + 1e-9 < saved.engine
  const scan = saved?.v === 2 && !(isNew && engine > 1e-9) ? null : await costScan($)
  isCostChecked = saved?.v === 2 || scan !== null
  if (saved && (saved.v === 2 || !scan?.isFork)) costBase = isNew ? saved.base + saved.engine - restoredOf(scan?.states ?? [], engine) : saved.base
  else {
    let inherited = 0
    if (scan?.isFork) {
      if (!isTurnsFresh) await keepOwnTurns($)
      void loadFlow($, { fromTranscript: true }).catch(() => {})
      if (restoredOf(scan.states, engine) >= scan.inherited - 1e-6) inherited = scan.inherited
    }
    const asked = (await read($, turnSummaries)).reduce((sum, t) => sum + t.cost.usd, 0) + ((await read($, turnsOlder))?.usd ?? 0)
    costBase = Math.max(0, asked - (engine - inherited)) - inherited
  }
  saveCost($, engine)
}

async function flowFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/flow/${await $.session.id()}.json`
}

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

async function importFlow($: EngineInterface): Promise<Flow> {
  const path = await transcriptPath($)
  const own = await $.session.id()
  let size: number
  try {
    size = (await $.fs.stat(path)).size
  } catch {
    return { points: [], compactions: [] }
  }
  if (size <= READ_LIMIT) return scanTranscript(await $.fs.read(path), own)
  const mb = Math.round(size / 1048576)
  let ran: Awaited<ReturnType<EngineInterface['process']['run']>>
  try {
    ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path, own], { timeoutMs: 60_000 })
  } catch {
    throw new Error(L(`기록이 ${mb}MB 라 node 가 있어야 앞 구간을 읽습니다. Node.js 14.8 이상을 깔고 앱을 다시 켜세요`, `the transcript is ${mb}MB, so the earlier part needs Node.js 14.8+. Install it and restart the app`))
  }
  if (ran.exitCode !== 0)
    throw new Error(L(`기록이 ${mb}MB 라 node 로 읽으려 했으나 실패(${ran.exitCode})`, `The transcript is ${mb}MB; reading it with node failed (${ran.exitCode})`))
  return flowFromRecords(recordsFromLines(ran.stdout))
}

async function loadFlow($: EngineInterface, opts: { fromTranscript: boolean } = { fromTranscript: false }): Promise<void> {
  const old = await read($, compactions)
  try {
    let flow: Flow | null = null
    let saved: Flow['compactions'] = []
    if (!opts.fromTranscript) {
      try {
        flow = parseFlowFile(await $.fs.read(await flowFile($)))
      } catch {
        flow = null
      }
      if (flow && (lacksModels(flow) || flow.questions === undefined || flow.shared === undefined)) {
        saved = flow.compactions
        flow = null
      }
    }
    flow ??= await importFlow($)
    await writeFlow($, { points: flow.points, compactions: mergeMeasured(flow.compactions, [...old, ...saved]), questions: flow.questions ?? [], shared: flow.shared ?? {} })
    await update($, flowNote, () => null)
    await syncCompactSteps($)
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

async function storedCount($: EngineInterface, key: string): Promise<number | null> {
  try {
    const v = await $.store.get(key)
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

async function refreshUsage($: EngineInterface, opts: { categories: boolean; pushHistory: boolean }): Promise<void> {
  setContextWindow((await read($, usage))?.window)
  try {
    await refreshUsageInner($, opts)
  } finally {
    setContextWindow((await read($, usage))?.window)
    await syncStatusLine($).catch(() => {})
  }
}

async function refreshUsageInner($: EngineInterface, opts: { categories: boolean; pushHistory: boolean }): Promise<void> {
  try {
    const measured = await $.session.usage(opts.categories ? { breakdown: 'summary' } : undefined)
    await catchMissedCompact($, measured.context.tokens, measured.startedAt).catch(err => log($, `missed compact check failed — ${String(err)}`))
    const prev = await read($, usage)
    const flow = await readFlow($)
    const since = compactSince(flow)
    const pending = pendingCompact(flow)
    const engineTokens = measured.context.tokens ?? 0
    const lastCtx = flow.points[flow.points.length - 1]?.ctx ?? null
    const isStale = pending !== null && pending.before > 0 && (engineTokens <= 0 || engineTokens >= pending.before * 0.8)
    const afterNow = isStale ? ((await measureOptimal($, prev?.model ?? (await $.session.model()))).inputs?.after ?? null) : null
    const tokens =
      since !== null && since.after !== null
        ? since.after
        : isStale
          ? engineTokens > 0
            ? Math.min(afterNow ?? engineTokens, engineTokens)
            : (afterNow ?? 0)
          : pending !== null
            ? engineTokens
            : (lastCtx ?? engineTokens)
    const window = measured.context.window
    const percent = window > 0 ? (tokens / window) * 100 : (measured.context.percent ?? null)
    if (opts.categories && measured.context.breakdown) setEngineAuto(measured.context.breakdown.autoCompactThreshold, measured.context.breakdown.isAutoCompactEnabled)
    const categories = opts.categories
      ? (measured.context.breakdown?.categories ?? [])
          .filter(c => !c.isDeferred && c.kind !== 'deferred' && c.tokens > 0)
          .map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind === 'free' || c.kind === 'buffer' ? c.kind : 'used' }))
      : (prev?.categories ?? [])
    const engineCost = measured.cost?.usd ?? null
    const costUsd = engineCost === null ? null : (costBase ?? 0) + engineCost
    if (engineCost !== null) saveCost($, engineCost)
    const model = await $.session.model()
    const measuredTtl = await read($, ttlMeasured)
    const cfg = (await read($, ttlConfig)) ?? (await readTtlConfig($))
    if ((await read($, ttlConfig)) === null) await update($, ttlConfig, () => cfg)
    const cacheTtlMin = measuredTtl ?? guessTtl(cfg)
    const lastAt = await lastActivity($)
    const nowUsage: Usage = {
      model,
      contextTokens: tokens,
      window,
      percent,
      contextEstimated: isStale,
      switchedFrom: prev?.switchedFrom ?? null,
      costUsd,
      rateLimits: await shareLimits(
        $,
        measured.rateLimits.map(r => (r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed })),
        lastAt,
      ),
      categories,
      lastActivityMs: lastAt,
      isAfterCompact: since !== null,
      history: opts.pushHistory ? [...(prev?.history ?? []), tokens].slice(-12) : (prev?.history ?? []),
      sharedTokens: sharedFor(flow, model),
      perCallExtraUsd: extraPerCall(flow, model),
      cacheTtlMin,
      cacheTtlMeasured: measuredTtl !== null,
    }
    await update($, usage, () => nowUsage)
    await applyThresholds($)
  } catch (err) {
    log($, `usage read failed — ${String(err)}`)
  }
}

async function isTerminalSession($: EngineInterface): Promise<boolean> {
  try {
    return (await $.session.surfaces()).includes('terminal')
  } catch {
    return false
  }
}

async function isPaneShared($: EngineInterface): Promise<boolean> {
  if (await isTerminalSession($)) return false
  return (await currentSettings($)).paneShared
}

async function wantedView($: EngineInterface): Promise<PaneView | null> {
  return read($, localPane)
}

let paneStartAt: number | null = null
let paneEventAt = 0

async function notePane($: EngineInterface, what: string): Promise<void> {
  let at = ''
  try {
    at = new Date(await $.clock.now()).toISOString().slice(11, 23)
  } catch {
  }
  paneLog.push(`${at} ${what}`)
  if (paneLog.length > 50) paneLog.splice(0, paneLog.length - 50)
}

async function setWantedView($: EngineInterface, view: PaneView | null): Promise<void> {
  const prev = await read($, localPane)
  await update($, localPane, () => view)
  if (prev !== view) {
    await notePane($, `want ${prev ?? '-'} → ${view ?? '-'}`)
    $.ui.invalidate('ui.render')
  }
  if (prev === view || !(await isPaneShared($))) return
  try {
    const at = await $.clock.now()
    paneEventAt = at
    await $.store.set(PANE_EVENT_KEY, { view, at, from: await $.session.id() })
  } catch {}
}

async function followPaneEvent($: EngineInterface): Promise<void> {
  if (!(await isPaneShared($))) return
  const raw = (await $.store.get(PANE_EVENT_KEY)) as Partial<PaneEvent> | undefined
  if (!raw || typeof raw.at !== 'number' || raw.at <= paneEventAt) return
  paneEventAt = raw.at
  if (raw.at < (paneStartAt ?? 0) || raw.from === (await $.session.id())) return
  await update($, localPane, () => (raw.view === 'usage' ? 'usage' : null))
  await notePane($, `follow ${raw.view ?? '-'} from ${String(raw.from ?? '?').slice(0, 8)}`)
}

let oldEngine: string | null = null

let engineNow: string | null = null

async function checkEngine($: EngineInterface): Promise<void> {
  try {
    const v = await $.session.version()
    const at = v.base ?? v.version
    oldEngine = engineBelow(at) ? at : null
    engineNow = engineOfLine(at) ?? null
  } catch {
    oldEngine = null
    engineNow = null
  }
}

async function autoOpenPane($: EngineInterface): Promise<void> {
  if (oldEngine) return
  if (!(await currentSettings($)).paneAutoOpen) return
  const id = await $.session.id()
  const raw = await $.store.get(PANE_AUTO_KEY)
  const seen = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  if (seen.includes(id)) return
  await $.store.set(PANE_AUTO_KEY, [...seen, id].slice(-PANE_AUTO_KEEP))
  await update($, localPane, () => 'usage')
  await notePane($, 'auto open')
}

let isPaneSeeded = false

async function syncPane($: EngineInterface): Promise<void> {
  if (paneStartAt === null) paneStartAt = await $.clock.now()
  const open = await $.ui.panes()
  const isOpen = open.some(pane => pane.id === PANE)
  if (!isPaneSeeded) {
    isPaneSeeded = true
    if (isOpen) {
      await update($, localPane, () => 'usage')
      await notePane($, 'seed: pane already open')
    }
  }
  await followPaneEvent($).catch(() => {})
  const want = await wantedView($)
  const have = await read($, paneView)
  if (want === null) {
    if (isOpen) {
      await $.ui.close({ id: PANE })
      await notePane($, 'close (sync)')
    }
    if (have !== null) {
      await update($, paneView, () => null)
      await update($, usageTab, () => 'main')
      await update($, paneModeLocal, () => null)
      await update($, settingsOpen, () => SETTINGS_OPEN_DEFAULT)
      await update($, settingsTab, () => 'bar')
      await update($, previewOpen, () => false)
      await update($, cardsOpen, () => CARDS_OPEN_DEFAULT)
      await closeUpdateDrawer($)
    }
    return
  }
  if (want === have && isOpen) return
  if (want === 'usage') await refreshUsage($, { categories: false, pushHistory: false })
  await update($, paneView, () => want)
  void refreshSpend($).catch(() => {})
  void refreshUpdateInfo($).catch(() => {})
  await $.ui.open({ id: PANE, title: paneTitle() })
  await notePane($, `open ${want}${isOpen ? ' (was open)' : ''}`)
}

async function toggleView($: EngineInterface, view: PaneView): Promise<PaneView | null> {
  const want = (await wantedView($)) === view ? null : view
  await setWantedView($, want)
  await syncPane($)
  if (want === 'usage' && (await read($, summaryCard))) await closeSummary($)
  return want
}

async function setPaneOption($: EngineInterface, key: 'paneAutoOpen' | 'paneShared', isOn: boolean): Promise<void> {
  await saveSettings($, { ...(await currentSettings($)), [key]: isOn })
  if (key === 'paneShared' && isOn) paneEventAt = Math.max(paneEventAt, await $.clock.now())
}

async function switchView($: EngineInterface, view: PaneView): Promise<void> {
  await setWantedView($, view)
  await syncPane($)
  if (view === 'usage' && (await read($, summaryCard))) await closeSummary($)
}

let appliedSettings = ''

async function usedBefore($: EngineInterface): Promise<boolean> {
  try {
    if ((await $.store.keys()).some(k => k !== SETTINGS_KEY)) return true
  } catch {
  }
  try {
    const mine = `${await $.session.id()}.json`
    return (await $.fs.list(`${await dataDir($)}/flow`)).some(f => f.kind === 'file' && f.name !== mine)
  } catch {
    return false
  }
}

let gaugeNote: { isUpdate: boolean } | false = false

async function prepareGaugeNote($: EngineInterface): Promise<{ isUpdate: boolean } | false> {
  if (await isTerminalSession($)) return false
  if (await $.store.get(GAUGE_NOTE_KEY)) return false
  return { isUpdate: await usedBefore($) }
}

async function showGaugeNote($: EngineInterface): Promise<void> {
  const note = gaugeNote
  if (!note) return
  gaugeNote = false
  if (await $.store.get(GAUGE_NOTE_KEY)) return
  await $.store.set(GAUGE_NOTE_KEY, true)
  $.ui.toast(
    note.isUpdate
      ? L('◔ 버튼이 없어졌습니다. 바의 동그라미(게이지)를 누르면 이지 컴팩트 패널이 열립니다', 'The ◔ button is gone. Click the ring (gauge) on the bar to open the Easy Compact pane')
      : L('바의 동그라미(게이지)를 누르면 이지 컴팩트 패널이 열립니다', 'Click the ring (gauge) on the bar to open the Easy Compact pane'),
    { timeoutMs: GAUGE_NOTE_MS },
  )
}

async function seedSettings($: EngineInterface): Promise<Partial<Settings>> {
  const isUpdate = await usedBefore($)
  const seed: Partial<Settings> = isUpdate
    ? { ...OLD_DEFAULT_RANGE, screen: UPDATE_SCREEN }
    : { rangeStart: DEFAULT_SETTINGS.rangeStart, rangeEnd: DEFAULT_SETTINGS.rangeEnd, screen: NEW_INSTALL_SCREEN }
  try {
    await $.store.set(SETTINGS_KEY, seed)
    const own = isUpdate ? null : await ownVersion($)
    if (own) await $.store.set(SEEN_VERSION_KEY, own)
  } catch {
  }
  return seed
}

async function loadSettings($: EngineInterface): Promise<void> {
  let raw: unknown
  try {
    raw = await $.store.get(SETTINGS_KEY)
    if (raw === undefined) raw = await seedSettings($)
  } catch {
    raw = undefined
  }
  let norm = normalizeSettings(raw)
  if (typeof raw === 'object' && raw !== null && typeof (raw as Partial<Settings>).autoStart !== 'number') {
    await $.store.set(SETTINGS_KEY, { ...raw, autoStart: norm.autoStart, autoEnd: norm.autoEnd }).catch(() => {})
  }
  const text = JSON.stringify(norm)
  if (text === appliedSettings) return
  appliedSettings = text
  setMotion(norm.motion !== 'reduce')
  setGaugeShape(norm.gaugeShape)
  await update($, settings, () => norm)
  await applyThresholds($)
  $.ui.invalidate('ui.render')
}

async function baseLoad($: EngineInterface, flow: Flow): Promise<number | null> {
  const first = (await read($, flowNote)) === null && flow.points.length < MAX_POINTS ? (flow.points[0] ?? null) : null
  return baseOfCategories((await read($, usage))?.categories ?? []) ?? first?.ctx ?? null
}

async function measureOptimal($: EngineInterface, model: string): Promise<Optimal> {
  const flow = await readFlow($)
  const first = (await read($, flowNote)) === null ? (flow.points[0] ?? null) : null
  const base = await baseLoad($, flow)
  const measured = flow.compactions.filter(c => c.after !== null)
  const last = measured[measured.length - 1] ?? null
  const pcSummary = await storedCount($, SUMMARY_KEY)
  const sessionSummary = last ? compactSummary(flow, last, first) : null
  const summary = sessionSummary ?? pcSummary ?? SUMMARY_GUESS
  const summarySrc: Source = sessionSummary !== null ? 'session' : pcSummary !== null ? 'pc' : 'guess'
  const pending = pendingCompact(flow)
  const guess = pending ? afterGuess(flow, pending, model, base) : null
  let after: number | null = null
  let afterSrc: Source = 'guess'
  if (guess !== null) {
    after = guess
    afterSrc = 'session'
  } else if (last && last.after !== null) {
    after = afterInNowTokens(flow, last.after)
    afterSrc = 'session'
  } else if (base !== null) {
    const pcKept = await storedCount($, KEPT_KEY)
    after = base + (pcKept ?? summary)
    afterSrc = pcKept !== null ? 'pc' : summarySrc === 'session' ? 'session' : summarySrc
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


async function perQuestionOf($: EngineInterface, flow: Flow, model: string): Promise<{ steps: number; extraUsd: number; agentUsd: number } | null> {
  const recent = (await read($, turnSummaries)).slice(-PER_Q_WINDOW).filter(t => t.steps > 0)
  const extraUsd = extraPerCall(flow, model)
  if (recent.length < PER_Q_MIN || extraUsd === null) return null
  const avg = (pick: (t: TurnSummary) => number) => recent.reduce((s, t) => s + pick(t), 0) / recent.length
  return { steps: avg(t => t.steps), extraUsd, agentUsd: avg(t => agentSum(t.details)?.usd ?? 0) }
}

async function applyThresholds($: EngineInterface): Promise<void> {
  const s = await currentSettings($)
  const u = await read($, usage)
  const model = u?.model ?? (await read($, flowPoints)).at(-1)?.model ?? ''
  const fresh = await measureOptimal($, model)
  const opt = { ...keepOptimal(await read($, optimal), fresh), shared: fresh.shared, perQuestion: fresh.perQuestion }
  await update($, optimal, () => opt)
  setThresholds(thresholdsOf(s, model))
}

async function setPaneMode($: EngineInterface, mode: PaneMode): Promise<void> {
  await update($, paneModeLocal, () => mode)
  await $.store.set(PANE_MODE_KEY, mode).catch(() => {})
  $.ui.invalidate('ui.render')
  if (mode === 'detail') void refreshSpend($, 5_000).catch(() => {})
}

async function paneModeNow($: EngineInterface): Promise<PaneMode> {
  const kept = await $.store.get(PANE_MODE_KEY).catch(() => undefined)
  return (await read($, paneModeLocal)) ?? (kept === 'simple' || kept === 'detail' ? kept : paneModeOf(await currentSettings($)))
}

async function saveSettings($: EngineInterface, next: Settings): Promise<void> {
  const prev = await currentSettings($)
  if (prev.screen !== next.screen) await $.store.set(PANE_MODE_KEY, null).catch(() => {})
  await $.store.set(SETTINGS_KEY, next)
  await loadSettings($)
  await syncStatusLine($)
  const [spNext, spPrev] = [spendOf(next), spendOf(prev)]
  const turnedOn = (spNext.today && !spPrev.today) || (spNext.month && !spPrev.month)
  if (spNext.today || spNext.month) void refreshSpend($, 5_000, false, turnedOn).catch(() => {})
}

async function allSpendOf($: EngineInterface, s: Settings, mode: PaneMode): Promise<AllSpendLine | null> {
  const isDetail = mode === 'detail'
  const sp = spendOf(s)
  if (!isDetail && !sp.today && !sp.month) return null
  const got = await read($, spend)
  if (!got) return { today: null, month: null, state: (await read($, spendFailed)) ? 'failed' : 'measuring' }
  const month = isDetail || sp.month ? got.month : null
  const today = isDetail || sp.today ? got.today : null
  return { today, month, ...spendColors(s, today, month), retro: month !== null ? (got.retroMonth ?? null) : null, state: 'ok' }
}

async function spendShownOf($: EngineInterface, s: Settings): Promise<SpendShown | null> {
  const sp = spendOf(s)
  if (!sp.today && !sp.month) return null
  const got = await read($, spend)
  if (!got) return null
  const today = sp.today ? got.today : null
  const month = sp.month ? got.month : null
  return { today, month, ...spendColors(s, today, month) }
}

async function currentSettings($: EngineInterface): Promise<Settings> {
  return (await read($, settings)) ?? DEFAULT_SETTINGS
}

let statusShown: string | undefined

async function syncStatusLine($: EngineInterface): Promise<void> {
  const s = await currentSettings($)
  let text: string | undefined
  if (s.statusLine) {
    const u = await read($, usage)
    const tokens = u && u.contextTokens > 0 ? u.contextTokens : null
    text = statusLineText({
      tokens,
      window: u?.window,
      level: tokens !== null ? levelOf(tokens) : null,
      thr: thresholds(),
      unit: s.ctxUnit,
      costUsd: u?.costUsd ?? null,
      phase: await read($, compactPhase),
    })
  }
  if (text === statusShown) return
  statusShown = text
  try {
    $.ui.status(text)
  } catch (err) {
    log($, `status line failed — ${String(err)}`)
  }
}

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
  $.ui.invalidate('ui.render')
}

let measureAfterCompact = false
let missedCompact: { trigger: string; result: CompactResultLike } | null = null
let hookCompact: { isRecorded: boolean } | null = null
let engineHadTokens = false
let suspectCompact: { before: number; atMs: number; since: number; checks: number } | null = null
const BOUNDARY_CHECKS = 3
let startedAtSeen: number | null = null

type CompactResultLike = { tokensBefore?: number; tokensAfter?: number; usage?: Tokens }
let gaugeShrink: { from: number; to: number; at: number } | null = null
let timingErr: string | null = null

async function shrinkNow($: EngineInterface): Promise<{ from: number; to: number } | null> {
  if (gaugeShrink === null) return null
  return (await $.clock.now()) - gaugeShrink.at < GAUGE_SHRINK_MS ? gaugeShrink : null
}

let flashTimer: { cancel: () => void } | null = null
function startFlashTicker($: EngineInterface): void {
  flashTimer?.cancel()
  flashTimer = null
  try {
    const timer = $.clock.every(FLASH_STEP_MS, () => {
      const isMore = stepFlash()
      void update($, flashTick, (k: number) => k + 1).catch(() => {})
      if (!isMore) {
        timer.cancel()
        if (flashTimer === timer) flashTimer = null
      }
    })
    flashTimer = timer
  } catch {
    endFlash()
  }
}

function stopFlashTicker(): void {
  flashTimer?.cancel()
  flashTimer = null
  endFlash()
}

let arriveTimer: { cancel: () => void } | null = null

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
  await settleSuspect($, contextTokens)
  const flow = await readFlow($)
  const ttl = await read($, ttlMeasured)
  const rewrite = rewriteOf(tokens, model, lastCtxOf(flow), ttl ?? ttlOf(await read($, usage)), null, engineNow)
  const isWhole = (await read($, flowLoaded)) && (await read($, flowNote)) === null
  const nextFlow = withPoint(flow, { atMs: await $.clock.now(), ctx: contextTokens, usd: cost.usd, model, ...(ttl !== null ? { ttl } : {}), ...(engineNow ? { engine: engineNow } : {}) }, tokens, isWhole)
  await writeFlow($, nextFlow)
  if (nextFlow.compactions.length < flow.compactions.length) await syncCompactSteps($)
  await update($, live, prev => {
    const base: LiveTurn =
      prev && prev.turnId === turnId
        ? prev
        : { turnId, steps: 0, cost: ZERO_COST, prompt: '', contextTokens: 0, outputTokens: 0, details: [], ...(ultraTurn?.turnId === turnId && ultraTurn.isOn ? { ultra: true as const } : {}) }
    const effortText = effort === undefined ? undefined : String(effort)
    const switches = nextSwitches(base, model, effortText)
    return {
      ...base,
      steps: base.steps + 1,
      cost: addCost(base.cost, cost),
      contextTokens,
      outputTokens: base.outputTokens + tokens.output_tokens,
      details: [...base.details, { label, usd: cost.usd, write: cost.write, ...(rewrite > 0 ? { rewrite } : {}) }].slice(-60),
      ...(rewrite > 0 ? { rewriteUsd: (base.rewriteUsd ?? 0) + rewrite } : {}),
      model,
      ...(effortText === undefined ? {} : { effort: effortText }),
      ...(switchedFrom && !base.switchedFrom ? { switchedFrom } : {}),
      ...(switches ? { switches } : {}),
      outputByEffort: nextEffortOutput(base.outputByEffort, effortText, cost.output),
    }
  })
}

async function markAgentsDone($: EngineInterface, isDone: (agentId: string) => boolean): Promise<boolean> {
  let changed = false
  const mark = (details: readonly StepDetail[] | undefined) =>
    (details ?? []).map(d => {
      if (!d.agent || d.done !== false || !isDone(d.agent)) return d
      changed = true
      return { ...d, done: true }
    })
  await update($, live, prev => (prev ? { ...prev, details: mark(prev.details) } : prev))
  await updateTurns($, list => list.map(s => (s.details?.some(d => d.agent && d.done === false) ? { ...s, details: mark(s.details) } : s)))
  return changed
}

async function reconcileAgents($: EngineInterface): Promise<void> {
  const open = new Set<string>()
  for (const d of [...((await read($, live))?.details ?? []), ...(await read($, turnSummaries)).flatMap(s => s.details ?? [])]) {
    if (d.agent && d.done === false) open.add(d.agent)
  }
  if (open.size === 0) return
  const listed = new Map((await $.agent.list()).map(a => [a.id, a.status] as const))
  for (const id of listed.keys()) listedAgents.add(id)
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

async function agentLabel($: EngineInterface, agentId: string): Promise<string> {
  const info = agentInfo.get(agentId)
  if (info && (info.tries === undefined || info.tries >= AGENT_LIST_TRIES)) return info.label
  let label = info?.label ?? L('하위 에이전트', 'subagent')
  let isFound = false
  try {
    const found = (await $.agent.list()).find(a => a.id === agentId)
    if (found) {
      label = found.description || found.type
      isFound = true
    }
  } catch {
  }
  const turnId = info ? info.turnId : ((await read($, live))?.turnId ?? null)
  agentInfo.set(agentId, { label, turnId, ...(isFound ? {} : { tries: (info?.tries ?? 0) + 1 }) })
  return label
}

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
    await updateTurns($, list => {
      let i = list.length - 1
      if (info?.turnId) {
        const found = list.findLastIndex(s => s.turnId === info.turnId)
        if (found >= 0) i = found
      }
      const s = list[i]
      if (!s) {
        orphanAgent = [...orphanAgent, { agentId, label, cost, model, atMs }]
        return list
      }
      const added = { ...s, cost: addCost(s.cost, cost), details: withAgentStep(s.details ?? [], agentId, label, cost, model, atMs) }
      return [...list.slice(0, i), added, ...list.slice(i + 1)]
    })
  }
}

let trackedUsd = 0

let idleMark: { ledger: number; tracked: number; atMs: number; isFixed: boolean } | null = null

let turnMark: { turnId: string; ledger: number; tracked: number } | null = null

let orphanAgent: { agentId: string; label: string; cost: CostParts; model: string; atMs: number }[] = []

let suggestedSinceMark = false

let pendingSubmit: { text: string; counts: AttachCounts | null; isIdle: boolean; atMs: number } | null = null

let lastStepAnswer = ''

let liveCells: QuestionCells | null = null

async function ledgerUsd($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

async function markIdle($: EngineInterface): Promise<void> {
  const ledger = await ledgerUsd($)
  const mark = ledger === null ? null : { ledger, tracked: trackedUsd, atMs: await $.clock.now(), isFixed: false }
  idleMark = mark
  suggestedSinceMark = false
  if (!mark) return
  try {
    $.clock.after(APP_FIX_MS, () => void fixAppRequests($, mark))
  } catch {
  }
}

async function appExtraSince($: EngineInterface, mark: { ledger: number; tracked: number }): Promise<{ extra: number; ledger: number } | null> {
  const ledger = await ledgerUsd($)
  return ledger === null ? null : { extra: ledger - mark.ledger - (trackedUsd - mark.tracked), ledger }
}

async function fixAppRequests($: EngineInterface, mark: NonNullable<typeof idleMark>): Promise<void> {
  if (idleMark !== mark || mark.isFixed) return
  const got = await appExtraSince($, mark)
  if (idleMark !== mark) return
  if (!got || got.extra < APP_MIN_USD) {
    idleMark = { ...mark, isFixed: true }
    return
  }
  idleMark = { ledger: got.ledger, tracked: trackedUsd, atMs: mark.atMs, isFixed: true }
  const label = suggestedSinceMark
    ? L('답 뒤 · 다음 질문 제안', 'after the answer · next-prompt suggestion')
    : L('답 뒤 · 다음 질문 제안 · 메모리 정리 등', 'after the answer · next-prompt suggestion · memory upkeep, etc.')
  suggestedSinceMark = false
  await addAppCost($, got.extra, label)
}

async function appCarryAtStart($: EngineInterface): Promise<number> {
  const mark = idleMark
  if (!mark) return 0
  if (!mark.isFixed && (await $.clock.now()) - mark.atMs < APP_FIX_MS) {
    await fixAppRequests($, mark)
    idleMark = null
    return 0
  }
  idleMark = null
  const got = await appExtraSince($, mark)
  return got && got.extra >= APP_MIN_USD ? got.extra : 0
}

async function addExtraSpend($: EngineInterface, usd: number, compactBefore: number | null = null): Promise<void> {
  if (!(usd > 0) && compactBefore === null) return
  try {
    const path = `${await dataDir($)}/extra/${await $.session.id()}.json`
    let days: Record<string, number> | null = null
    let compacts: [number, number][] = []
    try {
      const j = JSON.parse(await $.fs.read(path)) as { v?: unknown; days?: Record<string, number>; compacts?: unknown }
      if (j.v === 1 && j.days) {
        days = { ...j.days }
        if (Array.isArray(j.compacts)) compacts = j.compacts.filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
      }
    } catch {
    }
    if (!days) {
      days = {}
      let list: readonly TurnSummary[] = await read($, turnSummaries)
      if (list.length === 0) list = await $.fs.read(await turnsFile($)).then(parseTurnsFile, () => null) ?? []
      for (const s of list) {
        if (s.rebuilt) continue
        for (const d of s.details ?? []) {
          if (d.app || d.compact) days[spendDay(s.atMs)] = (days[spendDay(s.atMs)] ?? 0) + d.usd
          if (d.compact && d.compact.before > 0) compacts.push([d.compact.before, d.usd])
        }
      }
    }
    if (usd > 0) {
      const day = spendDay(await $.clock.now())
      days[day] = (days[day] ?? 0) + usd
    }
    if (compactBefore !== null && compactBefore > 0) compacts.push([compactBefore, usd > 0 ? usd : 0])
    await $.fs.write(path, JSON.stringify({ v: 1, days, ...(compacts.length > 0 ? { compacts: compacts.slice(-LEDGER_COMPACTS_MAX) } : {}) }))
  } catch (err) {
    log($, `extra spend write failed: ${String(err)}`)
  }
}

async function addAppCost($: EngineInterface, usd: number, label: string): Promise<void> {
  await addExtraSpend($, usd)
  const add = <T extends { cost: CostParts; appUsd?: number }>(t: T, details: readonly StepDetail[]) => ({
    ...t,
    cost: { ...t.cost, usd: t.cost.usd + usd },
    appUsd: (t.appUsd ?? 0) + usd,
    details: withAppStep(details, label, usd),
  })
  if (await read($, live)) await update($, live, prev => (prev ? add(prev, prev.details) : prev))
  else {
    await updateTurns($, list => {
      const s = list[list.length - 1]
      return s ? [...list.slice(0, -1), add(s, s.details ?? [])] : list
    })
  }
}

async function addCompactStep($: EngineInterface, parts: CostParts | null, before: number): Promise<void> {
  await addExtraSpend($, parts?.usd ?? 0, before)
  const add = <T extends { cost: CostParts }>(t: T, details: readonly StepDetail[]) => ({
    ...t,
    cost: parts ? addCost(t.cost, parts) : t.cost,
    details: [...details, { label: L('컴팩트', 'Compact'), usd: parts?.usd ?? 0, compact: { before, after: null } }],
  })
  if (await read($, live)) await update($, live, prev => (prev ? add(prev, prev.details) : prev))
  else {
    await updateTurns($, list => {
      const s = list[list.length - 1]
      return s ? [...list.slice(0, -1), add(s, s.details ?? [])] : list
    })
  }
  $.ui.invalidate('ui.render')
}

async function recordCompaction($: EngineInterface, trigger: string, result: CompactResultLike, via: string, mark?: { isRecorded: boolean }, atMs?: number): Promise<void> {
  measureAfterCompact = true
  suspectCompact = null
  const mix = result.usage ? compactMixOf(result.usage) : null
  if (mix && isWarmMix(mix)) await $.store.set(MIX_KEY, mix)
  if (result.usage && result.usage.output_tokens > 0) await $.store.set(OUTPUT_KEY, result.usage.output_tokens)
  const flow = await readFlow($)
  const before0 = await read($, usage)
  const parts = result.usage && before0 ? costOf(result.usage, before0.model, undefined, null, engineNow) : null
  const measured = parts?.usd ?? null
  const before = result.tokensBefore ?? before0?.contextTokens ?? flow.points[flow.points.length - 1]?.ctx ?? 0
  const kept = typeof result.tokensAfter === 'number' && result.tokensAfter > 0 ? result.tokensAfter : null
  if (kept !== null) await $.store.set(KEPT_KEY, kept)
  const event: CompactEvent = { atMs: atMs ?? (await $.clock.now()), trigger, before, after: null, costUsd: measured, index: flow.points.length, ...(kept !== null ? { kept } : {}), via }
  const withEvent: Flow = { points: flow.points, compactions: [...flow.compactions, event] }
  const after = afterGuess(withEvent, event, before0?.model ?? '', await baseLoad($, flow))
  if (after !== null && before > after) {
    gaugeShrink = { from: before, to: after, at: await $.clock.now() }
    $.ui.invalidate('ui.render')
    try {
      $.clock.after(GAUGE_SHRINK_MS, () => {
        gaugeShrink = null
        $.ui.invalidate('ui.render')
      })
    } catch {
    }
  }
  await writeFlow($, withEvent)
  if (mark) mark.isRecorded = true
  await update($, autoDismissed, () => null)
  if (parts) trackedUsd += parts.usd
  await addCompactStep($, parts, before)
}

async function catchMissedCompact($: EngineInterface, engineTokens: number | undefined, startedAt: number): Promise<boolean> {
  const isClear = startedAtSeen !== null && startedAt !== startedAtSeen
  startedAtSeen = startedAt
  if (isClear) suspectCompact = null
  if (missedCompact !== null) {
    const m = missedCompact
    missedCompact = null
    await recordCompaction($, m.trigger, m.result, 'catch')
    await noteCompact($, `compact the hook did not see (${m.trigger}) — recorded from .catch`)
    return true
  }
  if (typeof engineTokens === 'number' && engineTokens > 0) {
    engineHadTokens = true
    return false
  }
  if (!engineHadTokens) return false
  const phase = await read($, compactPhase)
  if (phase === 'compacting' || phase === 'tidying') return false
  if (!engineHadTokens) return false
  engineHadTokens = false
  if (isClear) return false
  const flow = await readFlow($)
  const last = flow.points[flow.points.length - 1]
  if (!last || last.ctx <= 0 || compactSince(flow) !== null) return false
  const b = await findBoundary($, last.atMs)
  if (b !== null) {
    if (await recordBoundary($, b, last.ctx, 'boundary')) await noteCompact($, `compact the hook did not see — engine context went empty after ${last.ctx}, the transcript has its boundary`)
    return true
  }
  suspectCompact = { before: last.ctx, atMs: await $.clock.now(), since: last.atMs, checks: 0 }
  await noteCompact($, `engine context went empty after ${last.ctx} — a compact if the transcript shows one or the next request is smaller`)
  return false
}

async function findBoundary($: EngineInterface, sinceMs: number): Promise<Boundary | null> {
  try {
    const path = await transcriptPath($)
    const own = await $.session.id()
    if ((await $.fs.stat(path)).size <= READ_LIMIT) return lastBoundaryAfter(await $.fs.read(path), own, sinceMs)
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/last-compact.mjs`, path, own, String(sinceMs)], { timeoutMs: 20_000 })
    if (ran.exitCode !== 0) await noteCompact($, `could not read the transcript for a boundary — node exit ${ran.exitCode} ${ran.stderr.trim().slice(0, 120)}`)
    const out = ran.exitCode === 0 ? ran.stdout.trim() : '-'
    if (out === '-' || out === '') return null
    const b = JSON.parse(out) as Boundary
    return typeof b.atMs === 'number' && b.atMs > sinceMs ? b : null
  } catch (err) {
    await noteCompact($, `could not read the transcript for a boundary — ${String(err).slice(0, 120)}`)
    return null
  }
}

let isRecordingMissed = false

async function recordMissedOnce($: EngineInterface, trigger: string, result: CompactResultLike, atMs: number, via: string): Promise<boolean> {
  if (isRecordingMissed) return false
  isRecordingMissed = true
  try {
    if (compactSince(await readFlow($)) !== null) return false
    await recordCompaction($, trigger, result, via, undefined, atMs)
    return true
  } finally {
    isRecordingMissed = false
  }
}

function recordBoundary($: EngineInterface, b: Boundary, before: number, via: string): Promise<boolean> {
  return recordMissedOnce($, b.trigger, { tokensBefore: b.pre > 0 ? b.pre : before, ...(b.post !== undefined ? { tokensAfter: b.post } : {}) }, b.atMs, via)
}

async function settleSuspect($: EngineInterface, ctx: number): Promise<void> {
  const s = suspectCompact
  if (s === null) return
  suspectCompact = null
  if (isRecordingMissed) return
  if (isNotShrunk(s.before, ctx)) {
    await noteCompact($, `not a compact — engine context went empty but the next request is ${ctx} (before ${s.before})`)
    return
  }
  await recordCompaction($, 'manual', { tokensBefore: s.before }, 'shrink', undefined, s.atMs)
  await noteCompact($, `compact the hook did not see — engine context went empty after ${s.before}, next request ${ctx}`)
}

async function watchCompact($: EngineInterface): Promise<void> {
  const s = suspectCompact
  if (s !== null && s.checks < BOUNDARY_CHECKS) {
    s.checks += 1
    const b = await findBoundary($, s.since)
    if (b !== null && suspectCompact === s && (await recordBoundary($, b, s.before, 'watch'))) {
      await noteCompact($, `compact the hook did not see — the transcript has its boundary (look ${s.checks})`)
      await refreshUsage($, { categories: false, pushHistory: false })
      return
    }
    if (b === null && s.checks === BOUNDARY_CHECKS && suspectCompact === s) await noteCompact($, `no boundary after ${BOUNDARY_CHECKS} looks — the next request decides`)
  }
  if (missedCompact === null) {
    if (!engineHadTokens) return
    const tokens = (await $.session.usage()).context.tokens
    if (typeof tokens === 'number' && tokens > 0) return
  }
  await refreshUsage($, { categories: false, pushHistory: false })
}

async function syncCompactSteps($: EngineInterface): Promise<void> {
  const list = await read($, compactions)
  if (list.length === 0) return
  const turns = await read($, turnSummaries)
  const next = turns.map(t => {
    const details = t.details ? syncCompactAfter(t.details, list) : undefined
    return details === t.details ? t : { ...t, details }
  })
  if (next.some((t, i) => t !== turns[i])) await updateTurns($, () => next)
  await update($, live, prev => {
    if (!prev) return prev
    const details = syncCompactAfter(prev.details, list)
    return details === prev.details ? prev : { ...prev, details }
  })
}

async function fillCompactAfter($: EngineInterface, after: number): Promise<void> {
  const fill = (details: readonly StepDetail[]) =>
    details.map(d => (d.compact?.after === null ? { ...d, compact: { ...d.compact, after } } : d))
  const isEmpty = (details: readonly StepDetail[] | undefined) => (details ?? []).some(d => d.compact?.after === null)
  await update($, live, prev => (prev && isEmpty(prev.details) ? { ...prev, details: fill(prev.details) } : prev))
  await updateTurns($, list => {
    const i = list.findLastIndex(s => isEmpty(s.details))
    if (i < 0) return list
    const s = list[i]!
    return [...list.slice(0, i), { ...s, details: fill(s.details ?? []) }, ...list.slice(i + 1)]
  })
}

let ultraScan: { path: string; size: number; isOn: boolean } | null = null

async function ultraNow($: EngineInterface): Promise<boolean> {
  const path = await transcriptPath($)
  const size = (await $.fs.stat(path)).size
  const prev = ultraScan && ultraScan.path === path && ultraScan.size <= size ? ultraScan : null
  if (prev && prev.size === size) return prev.isOn
  let isOn: boolean
  if (size <= READ_LIMIT) isOn = ultraStateOf(await $.fs.read(path)) ?? false
  else {
    const ran = await $.process.run(['node', `${$.plugin.root}/tools/scan-transcript.mjs`, path, '--ultra', String(prev?.size ?? 0)], { timeoutMs: 60_000 })
    if (ran.exitCode !== 0) return prev?.isOn ?? false
    const v = ran.stdout.trim()
    isOn = v === 'on' ? true : v === 'off' ? false : (prev?.isOn ?? false)
  }
  ultraScan = { path, size, isOn }
  return isOn
}

let ultraTurn: { turnId: string; isOn: boolean } | null = null

async function watchUltra($: EngineInterface, turnId: string): Promise<void> {
  const isOn = await ultraNow($)
  ultraTurn = { turnId, isOn }
  if (isOn) await update($, live, prev => (prev && prev.turnId === turnId && !prev.ultra ? { ...prev, ultra: true as const } : prev))
}

async function markUltra($: EngineInterface, turnId: string): Promise<void> {
  if (!(await ultraNow($))) return
  await updateTurns($, list => list.map(t => (t.turnId === turnId ? { ...t, ultra: true as const } : t)))
}

async function cellScope($: EngineInterface, surface: string, cell: { toolIds?: readonly (string | undefined)[]; text?: string }): Promise<string | null> {
  if (surface === 'terminal') return null
  const s = await currentSettings($)
  if (!s.questionHover || slimViewOf(s).chip === 'off') return null
  return cellScopeOf(await read($, cellScopes), cell)
}

async function closeTurn($: EngineInterface, text: string, isAborted = false): Promise<void> {
  const now = await read($, live)
  await update($, live, () => null)
  if (!now || (now.steps === 0 && !isAborted)) return
  const measured = await read($, usage)
  const split = effortSplit(now.outputByEffort)
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
    ...(now.switches ? { switches: now.switches } : {}),
    ...(split ? { outputByEffort: split } : {}),
    ...(now.ultra ? { ultra: true as const } : {}),
    turnId: now.turnId,
    ...(isAborted ? { aborted: true as const } : {}),
  }
  await updateTurns($, list => [...list, summary])
  const cells = liveCells?.turnId === now.turnId ? liveCells : null
  liveCells = null
  if (cells) await update($, cellScopes, prev => withCellScopes(prev, cells, questionScope(summary.atMs)))
  if (!now.ultra) void markUltra($, now.turnId).catch(() => {})
}

async function startCompacting($: EngineInterface, kind: string): Promise<void> {
  await update($, compactKind, () => kind)
  await update($, compactPhase, () => 'compacting')
}

async function compactNow($: EngineInterface, args = '', kind?: string): Promise<boolean> {
  await update($, isConfirmingCompact, () => false)
  await startCompacting($, kind ?? (args === compactKeep(await currentSettings($)) ? kindTidy() : kindDirect()))
  const startMs = await $.clock.now()
  const countBefore = (await read($, compactions)).length
  let isDone = true
  try {
    await $.command.run(args ? { command: 'compact', args } : { command: 'compact' })
  } catch (err) {
    isDone = false
    $.ui.toast(L(`컴팩트 실패: ${String(err)}`, `Compact failed: ${String(err)}`))
  } finally {
    await update($, compactPhase, () => 'idle')
  }
  await refreshUsage($, { categories: false, pushHistory: false }).catch(() => {})
  if (isDone) await confirmOwnCompact($, startMs, countBefore).catch(err => log($, `own compact check failed — ${String(err)}`))
  return isDone
}

async function confirmOwnCompact($: EngineInterface, startMs: number, countBefore: number): Promise<void> {
  if ((await read($, compactions)).length > countBefore) return
  const s = suspectCompact
  const b = await findBoundary($, startMs)
  let how: string
  if (b !== null) {
    if (!(await recordBoundary($, b, (await read($, flowPoints)).at(-1)?.ctx ?? 0, 'own-boundary'))) return
    how = 'the transcript has its boundary'
  } else if (s !== null && suspectCompact === s) {
    if (!(await recordMissedOnce($, 'manual', { tokensBefore: s.before }, s.atMs, 'own-empty'))) return
    how = `engine context went empty after ${s.before}`
  } else {
    await noteCompact($, 'our /compact finished but shows no compact (engine context still there, no boundary)')
    return
  }
  await noteCompact($, `our /compact — the hook did not see it, ${how}`)
  await refreshUsage($, { categories: false, pushHistory: false })
}

async function clearNow($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await update($, isAskingClear, () => false)
  try {
    await $.command.run({ command: 'clear' })
  } catch (err) {
    $.ui.toast(L(`클리어하지 못했습니다(${String(err)}). 입력창에 /clear 를 직접 치세요`, `Clear failed (${String(err)}). Type /clear in the prompt`))
  }
}

async function tidyThenCompact($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await update($, compactKind, () => '')
  await update($, compactPhase, () => 'tidying')
  try {
    await $.prompt.submit({ text: tidyPrompt(tidyBody(await currentSettings($))) })
  } catch (err) {
    await update($, compactPhase, () => 'idle')
    $.ui.toast(L(`저장 요청 실패: ${String(err)}`, `Save request failed: ${String(err)}`))
  }
}

let otherAt = 0
let autoCompacting: number | null = null
let autoSaveTurn: string | null = null

async function autoNow($: EngineInterface): Promise<AutoState> {
  return (await read($, auto)) ?? freshAuto(false, await $.clock.now())
}

async function setAuto($: EngineInterface, fn: (a: AutoState) => AutoState): Promise<boolean> {
  const nowMs = await $.clock.now()
  const box: { next: AutoState | null } = { next: null }
  await update($, auto, prev => {
    const cur = prev ?? freshAuto(false, nowMs)
    const out = fn(cur)
    if (out === cur) return prev
    box.next = { ...out, atMs: nowMs }
    return box.next
  })
  const saved = box.next
  if (saved === null) return false
  void (async () => $.store.set(autoKey(await $.session.id()), saved))().catch(() => {})
  return true
}

async function loadAuto($: EngineInterface): Promise<void> {
  if ((await read($, auto)) !== null) return
  const nowMs = await $.clock.now()
  const stored = autoFromStore(await $.store.get(autoKey(await $.session.id())).catch(() => undefined), nowMs)
  let isOn = false
  await update($, auto, prev => prev ?? stored ?? freshAuto(isOn, nowMs))
}


async function toggleAuto($: EngineInterface): Promise<void> {
  const isOn = !isAutoActive(await read($, auto))
  await setAuto($, a => ({ ...a, on: isOn, stop: null, note: null, since: null, chain: isOn || a.chain?.stage === 'saving' || a.chain?.stage === 'compacting' ? a.chain : null }))
  const s = await currentSettings($)
  const u = await read($, usage)
  $.ui.toast(autoToggleNote(isOn, s, u?.window))
  if (!isOn || (await read($, live)) || (await autoNow($)).chain || !u || u.contextTokens < s.autoStart || !(await autoMayStart($, u))) return
  const at = await $.clock.now()
  await setAuto($, x => ({ ...x, chain: { path: 'end', stage: 'wait', atMs: at, turnId: null, before: u.contextTokens } }))
  $.clock.after(AUTO_WAIT_MS, () => void autoBegin($, at))
}

async function autoOff($: EngineInterface, why: 'cold' | 'model'): Promise<void> {
  await setAuto($, a => ({ ...a, on: false, stop: null, note: why, chain: null, since: null }))
}

async function autoHalt($: EngineInterface, why: 'stuck' | 'again'): Promise<void> {
  await setAuto($, a => ({ ...a, stop: why, note: why, chain: null, since: null }))
}

async function autoEnd($: EngineInterface): Promise<void> {
  await setAuto($, a => (a.chain ? { ...a, chain: null } : a))
  if ((await read($, compactPhase)) === 'tidying' && isAutoSaveKind(await read($, compactKind))) await update($, compactPhase, () => 'idle')
}

async function autoMayStart($: EngineInterface, u: Usage): Promise<boolean> {
  const phase = await read($, compactPhase)
  if (phase === 'tidying' || phase === 'compacting') return false
  const why = autoLossOf(u, (await read($, optimal))?.inputs ?? null, await read($, turnSummaries), await $.clock.now())
  if (why === 'cold' || why === 'model') {
    await autoOff($, why)
    return false
  }
  if (isTooSoon(await autoNow($))) {
    await autoHalt($, 'again')
    return false
  }
  return why !== 'loss'
}

async function autoAtTurnEnd($: EngineInterface, e: { turnId: string; reason: string; answer: string }, turnNow: LiveTurn | null): Promise<void> {
  const a = await autoNow($)
  const c = a.chain
  if (c?.stage === 'saving' && c.turnId === e.turnId) {
    if (!a.on || tidyVerdict(e.reason, e.answer) !== 'go') return autoEnd($)
    if (turnNow) await recordSaveTurn($, turnNow)
    const at = await $.clock.now()
    autoCompacting = at
    await setAuto($, x => ({ ...x, chain: { ...c, stage: 'compacting', atMs: at, turnId: null } }))
    await startCompacting($, kindAuto())
    $.clock.after(300, () => void autoCompact($, at))
    return
  }
  if (c?.stage === 'continuing' && c.turnId === e.turnId) await setAuto($, x => ({ ...x, chain: null }))
  else if (c || e.turnId === autoSaveTurn) return
  if (!isAutoActive(a) || e.reason !== 'answer') return
  const u = await read($, usage)
  if (!u || u.contextTokens < (await currentSettings($)).autoStart || !(await autoMayStart($, u))) return
  const at = await $.clock.now()
  await setAuto($, x => ({ ...x, chain: { path: 'end', stage: 'wait', atMs: at, turnId: null, before: u.contextTokens } }))
  $.clock.after(AUTO_WAIT_MS, () => void autoBegin($, at))
}

async function hasDraft($: EngineInterface): Promise<boolean> {
  try {
    return (await $.prompt.read()).text.trim() !== ''
  } catch {
    return false
  }
}

const DRAFT_POLL_MS = 2_000

async function autoBegin($: EngineInterface, at: number, isHeld = false): Promise<void> {
  const a = await autoNow($)
  if (a.chain?.stage !== 'wait' || a.chain.atMs !== at) return
  if (!isAutoActive(a) || otherAt >= at) return autoEnd($)
  if (await hasDraft($)) {
    const next = await $.clock.now()
    await setAuto($, x => (x.chain?.stage === 'wait' && x.chain.atMs === at ? { ...x, chain: { ...x.chain, atMs: next, isDraftHeld: true } } : x))
    if (!isHeld) $.ui.toast(autoDraftNote('save'))
    $.clock.after(DRAFT_POLL_MS, () => void autoBegin($, next, true))
    return
  }
  await autoSave($, 'end')
}

async function autoSave($: EngineInterface, path: 'end' | 'mid'): Promise<void> {
  const s = await currentSettings($)
  const u = await read($, usage)
  const at = await $.clock.now()
  await setAuto($, a => ({ ...a, chain: { path, stage: 'saving', atMs: at, turnId: null, before: u?.contextTokens ?? 0 } }))
  await update($, isConfirmingCompact, () => false)
  await update($, summaryCard, () => false)
  await update($, compactKind, () => kindAutoSave())
  await update($, compactPhase, () => 'tidying')
  try {
    await $.prompt.submit({ text: autoSavePrompt(path, fmtTokens(path === 'mid' ? s.autoEnd : s.autoStart)) })
  } catch (err) {
    log($, `auto save failed — ${String(err)}`)
    await autoEnd($)
  }
}

async function autoAtStep($: EngineInterface, turnId: string): Promise<void> {
  const a = await read($, auto)
  if (!a || !isAutoActive(a) || (a.chain && a.chain.stage !== 'continuing') || a.since?.requests === 0) return
  const u = await read($, usage)
  if (!u || u.contextTokens < (await currentSettings($)).autoEnd || !(await autoMayStart($, u))) return
  if (await hasDraft($)) return
  const at = await $.clock.now()
  await setAuto($, x => ({ ...x, chain: { path: 'mid', stage: 'saving', atMs: at, turnId: null, before: u.contextTokens } }))
  $.clock.after(0, () =>
    void (async () => {
      await $.turn.abort({ turnId }).catch(err => log($, `auto abort failed — ${String(err)}`))
      await autoSave($, 'mid')
    })(),
  )
}

async function autoAfterStep($: EngineInterface, ctx: number): Promise<void> {
  const a = await read($, auto)
  if (!a?.since) return
  const n = a.since.requests + 1
  if (n === 1 && isAutoActive(a) && ctx >= (await currentSettings($)).autoStart) return autoHalt($, 'stuck')
  await setAuto($, x => (x.since ? { ...x, since: n > AUTO_AGAIN_REQUESTS ? null : { ...x.since, requests: n } } : x))
}

async function autoCompact($: EngineInterface, at: number, isHeld = false): Promise<void> {
  let isHolding = false
  try {
    if ((await autoNow($)).chain?.stage !== 'compacting') return
    if (await hasDraft($)) {
      isHolding = true
      if (!isHeld) {
        await update($, compactPhase, () => 'idle')
        await setAuto($, x => (x.chain?.stage === 'compacting' ? { ...x, chain: { ...x.chain, isDraftHeld: true } } : x))
        $.ui.toast(autoDraftNote('compact'))
      }
      $.clock.after(DRAFT_POLL_MS, () => void autoCompact($, at, true))
      return
    }
    if (isHeld) await setAuto($, x => (x.chain?.isDraftHeld ? { ...x, chain: { ...x.chain, isDraftHeld: false } } : x))
    if (!(await compactNow($, autoCompactKeep(), kindAuto()))) return autoEnd($)
    await autoAfterCompact($)
  } finally {
    if (!isHolding && autoCompacting === at) autoCompacting = null
  }
}

async function autoAfterCompact($: EngineInterface): Promise<void> {
  const nowMs = await $.clock.now()
  const go = { next: false }
  const did = await setAuto($, a => {
    const c = a.chain
    if (c?.stage !== 'compacting') return a
    go.next = c.path === 'mid' && a.on && c.isInterrupted !== true && otherAt < c.atMs
    return { ...a, since: { atMs: nowMs, requests: 0 }, chain: go.next ? { ...c, stage: 'continuing', atMs: nowMs, turnId: null } : null }
  })
  if (!did || !go.next) return
  if (await hasDraft($)) {
    await setAuto($, a => (a.chain?.stage === 'continuing' ? { ...a, chain: null } : a))
    $.ui.toast(autoDraftNote('continue'))
    return
  }
  try {
    await $.prompt.submit({ text: autoContinuePrompt() })
  } catch (err) {
    log($, `auto continue failed — ${String(err)}`)
    await autoEnd($)
  }
}

async function autoOnOther($: EngineInterface): Promise<void> {
  otherAt = await $.clock.now()
  const c = (await read($, auto))?.chain
  if (c && (c.stage === 'compacting' || (c.stage === 'continuing' && c.turnId === null))) await setAuto($, a => (a.chain ? { ...a, chain: { ...a.chain, isInterrupted: true } } : a))
}

async function autoOnTurnStart($: EngineInterface, turnId: string, text: string): Promise<void> {
  const kind = autoTurnOf(text.replace(PLUGIN_SENT, ''))
  if (kind === 'save') autoSaveTurn = turnId
  const c = (await read($, auto))?.chain
  if (!c) return
  if (((kind === 'save' && c.stage === 'saving') || (kind === 'continue' && c.stage === 'continuing')) && c.turnId === null) {
    await setAuto($, a => (a.chain ? { ...a, chain: { ...a.chain, turnId } } : a))
    return
  }
  if (kind !== null) return
  if (c.stage === 'wait') return autoEnd($)
  if (c.stage === 'compacting' || (c.stage === 'continuing' && c.turnId === null)) await setAuto($, a => (a.chain ? { ...a, chain: { ...a.chain, isInterrupted: true } } : a))
}

async function autoWatch($: EngineInterface): Promise<void> {
  const a = await read($, auto)
  if (!a) return
  const nowMs = await $.clock.now()
  const c = a.chain
  if (c?.stage === 'compacting' && autoCompacting !== c.atMs && (await read($, compactPhase)) !== 'compacting' && (await read($, flowLoaded))) {
    if ((await read($, compactions)).some(x => x.atMs >= c.atMs)) return autoAfterCompact($)
    return autoEnd($)
  }
  if (c) {
    if (isChainStuck(c, nowMs)) await autoEnd($)
    return
  }
  const u = isAutoActive(a) ? await read($, usage) : null
  const est = u ? estimateFor(u, nowMs) : null
  if (est?.kind === 'cold') await autoOff($, est.reason === 'model' ? 'model' : 'cold')
}

async function toggleExpanded($: EngineInterface, id: number): Promise<void> {
  await update($, expandedTurn, now => (now === id ? null : id))
}

async function dumpObject($: EngineInterface): Promise<Record<string, unknown>> {
  const inst = await installNow($)
  return {
    at: new Date(await $.clock.now()).toISOString(),
    version: await ownVersion($),
    install: inst ? inst.marketplace : 'dev',
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
    turnsOlder: await read($, turnsOlder),
    paneView: await read($, paneView),
    cardsOpen: await read($, cardsOpen),
    compactPhase: await read($, compactPhase),
    compactVia: (await read($, compactions)).slice(-10).map(c => ({ at: new Date(c.atMs).toISOString(), trigger: c.trigger, via: c.via ?? null, before: c.before, after: c.after })),
    compactChecks,
    panes: await $.ui.panes().catch(() => null),
    paneLog,
    ledgerUsd: await ledgerUsd($),
    costBase,
    trackedUsd,
    questionsUsd: (await read($, turnSummaries)).reduce((sum, t) => sum + t.cost.usd, 0) + ((await read($, turnsOlder))?.usd ?? 0) + ((await read($, live))?.cost.usd ?? 0),
  }
}

async function dumpPath($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/debug-${await $.session.id()}.json`
}


async function buildDiagSnap($: EngineInterface, redact: boolean): Promise<void> {
  const raw = await dumpObject($)
  const got = redactDump(raw, redact)
  const { text } = dumpText(got.state)
  const { head, lines } = diagHead(text)
  const turns = Array.isArray(raw.turnSummaries) ? raw.turnSummaries.length : 0
  diagSnap = { text, head, lines, turns, counts: got.counts, samples: got.samples }
}

async function openDiag($: EngineInterface, where: 'drawer' | 'gen'): Promise<void> {
  const cur = await read($, diagCard)
  if (cur.open && cur.where === where) return closeDiag($)
  try {
    await buildDiagSnap($, cur.redact)
  } catch (err) {
    $.ui.toast(L(`진단 내용을 만들지 못했습니다: ${String(err)}`, `Couldn't build the diagnostics: ${String(err)}`))
    return
  }
  await update($, diagCard, prev => ({ ...prev, open: true, where, copiedLines: null, savedPath: null }))
  $.ui.invalidate('ui.render')
}

async function closeDiag($: EngineInterface): Promise<void> {
  await update($, diagCard, prev => ({ ...prev, open: false, copiedLines: null, savedPath: null }))
  diagSnap = null
  $.ui.invalidate('ui.render')
}

async function diagViewOf($: EngineInterface, where: 'drawer' | 'gen'): Promise<DiagView | null> {
  const c = await read($, diagCard)
  if (!c.open || c.where !== where || !diagSnap) return null
  return { where, redact: c.redact, head: diagSnap.head, lines: diagSnap.lines, turns: diagSnap.turns, counts: diagSnap.counts, samples: diagSnap.samples, copiedLines: c.copiedLines, savedPath: c.savedPath }
}

async function setDiagRedact($: EngineInterface, isOn: boolean): Promise<void> {
  await buildDiagSnap($, isOn)
  await update($, diagCard, prev => ({ ...prev, redact: isOn, copiedLines: null, savedPath: null }))
  $.ui.invalidate('ui.render')
}

async function copyDiag($: EngineInterface, surface?: string): Promise<void> {
  if (!diagSnap) await buildDiagSnap($, (await read($, diagCard)).redact)
  const snap = diagSnap!
  let isCopied = false
  try {
    const got = await $.ui.copy({ text: snap.text, ...(surface ? { surface: surface as Parameters<typeof $.ui.copy>[0]['surface'] } : {}) })
    isCopied = got.isCopied
  } catch {
    isCopied = false
  }
  if (isCopied) {
    await update($, diagCard, prev => ({ ...prev, copiedLines: snap.lines }))
    $.ui.toast(L('복사했습니다. 제보 글에 붙여 넣으세요', 'Copied. Paste it into your report'))
  } else {
    $.ui.toast(L('복사하지 못했습니다. [파일로 저장] 으로 만든 파일을 붙여 주세요', "Couldn't copy. Use [Save as file] and attach the file"))
  }
  $.ui.invalidate('ui.render')
}

async function saveDiag($: EngineInterface): Promise<void> {
  if (!diagSnap) await buildDiagSnap($, (await read($, diagCard)).redact)
  const snap = diagSnap!
  try {
    const path = await dumpPath($)
    await $.fs.write(path, `${snap.text}\n`)
    await update($, diagCard, prev => ({ ...prev, savedPath: path }))
    $.ui.toast(L(`진단 파일을 만들었습니다: ${nativePath(path)}. 제보할 때 붙여 주세요`, `Saved a diagnostics file: ${nativePath(path)}. Attach it to your report`), { timeoutMs: HIDDEN_NOTE_MS })
  } catch (err) {
    $.ui.toast(L(`진단 파일을 만들지 못했습니다: ${String(err)}`, `Couldn't save the diagnostics file: ${String(err)}`))
  }
  $.ui.invalidate('ui.render')
}

async function revealDiag($: EngineInterface): Promise<void> {
  const path = (await read($, diagCard)).savedPath
  if (!path) return
  const argvs = revealArgv(path)
  if (argvs.length === 0) {
    $.ui.toast(L('경로에 특수 문자가 있어 폴더를 바로 열 수 없습니다. [경로 복사] 로 경로를 붙여 넣으세요', "The path has special characters, so the folder can't be opened directly. Use [Copy path] and paste it"))
    return
  }
  let why = ''
  for (const argv of argvs) {
    try {
      const ran = await $.process.run(argv, { timeoutMs: 15_000 })
      if (ran.exitCode === 0) return
      why = `${argv[0]} exit ${ran.exitCode}`
    } catch (err) {
      why = String(err)
    }
  }
  $.ui.toast(L(`폴더를 열지 못했습니다(${why}). [경로 복사] 로 경로를 붙여 넣으세요`, `Couldn't open the folder (${why}). Use [Copy path] and paste it`))
}

async function copyDiagPath($: EngineInterface, surface?: string): Promise<void> {
  const path = (await read($, diagCard)).savedPath
  if (!path) return
  let isCopied = false
  try {
    isCopied = (await $.ui.copy({ text: nativePath(path), ...(surface ? { surface: surface as Parameters<typeof $.ui.copy>[0]['surface'] } : {}) })).isCopied
  } catch {
    isCopied = false
  }
  $.ui.toast(isCopied ? L('경로를 복사했습니다', 'Copied the path') : L('경로를 복사하지 못했습니다', "Couldn't copy the path"))
}

async function togglePreview($: EngineInterface): Promise<void> {
  await update($, previewOpen, now => !now)
  $.ui.invalidate('ui.render')
}

async function toggleAnswer($: EngineInterface, id: number): Promise<void> {
  await update($, answerOpen, now => (now.includes(id) ? now.filter(x => x !== id) : [...now, id].slice(-50)))
  $.ui.invalidate('ui.render')
}

async function toggleStepsFull($: EngineInterface, id: number | 'live'): Promise<void> {
  await update($, stepsFull, now => (now.includes(id) ? now.filter(x => x !== id) : [...now, id].slice(-50)))
}

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

async function storedSaveOrNull($: EngineInterface): Promise<SaveTurn | null> {
  try {
    const list = (await $.store.get(SAVE_KEY)) as Partial<SaveTurn>[] | undefined
    const ok = (list ?? []).filter(
      (s): s is SaveTurn => typeof s?.steps === 'number' && typeof s.output === 'number' && typeof s.write === 'number',
    )
    if (ok.length === 0) return null
    const mid = (pick: (s: SaveTurn) => number) => {
      const v = ok.map(pick).sort((a, b) => a - b)
      const half = Math.floor(v.length / 2)
      return v.length % 2 === 1 ? v[half]! : (v[half - 1]! + v[half]!) / 2
    }
    return { steps: mid(s => s.steps), output: Math.round(mid(s => s.output)), write: Math.round(mid(s => s.write)) }
  } catch {
    return null
  }
}

async function recordSaveTurn($: EngineInterface, turn: LiveTurn): Promise<void> {
  const r = turn.model ? ratesFor(turn.model, 0, null, engineNow) : null
  if (!r || turn.steps <= 0) return
  const writeUsd = Math.max(0, turn.cost.write - (turn.rewriteUsd ?? 0))
  const one: SaveTurn = { steps: turn.steps, output: turn.outputTokens, write: Math.round((writeUsd / r.write1h) * 1e6) }
  try {
    const prev = ((await $.store.get(SAVE_KEY)) as SaveTurn[] | undefined) ?? []
    await $.store.set(SAVE_KEY, [...(Array.isArray(prev) ? prev : []), one].slice(-SAVE_KEEP))
  } catch {
  }
}

async function storedMixOrNull($: EngineInterface): Promise<CompactMix | null> {
  try {
    const m = (await $.store.get(MIX_KEY)) as Partial<CompactMix> | undefined
    if (m && typeof m.input === 'number' && typeof m.read === 'number' && typeof m.write === 'number' && isWarmMix(m as CompactMix)) return m as CompactMix
  } catch {
  }
  return null
}

async function saveTidyCustom($: EngineInterface, text: string): Promise<void> {
  await update($, tidyDraft, () => null)
  await saveSettings($, setTidyCustom(await currentSettings($), text))
}

async function saveCompactCustom($: EngineInterface, text: string): Promise<void> {
  await update($, compactDraft, () => null)
  await saveSettings($, setCompactCustom(await currentSettings($), text))
}

async function openUsageTab($: EngineInterface, tab: UsageTab): Promise<void> {
  if (tab === 'main' && (await read($, usageTab)) !== 'main') await update($, paneModeLocal, () => null)
  if ((await read($, usageTab)) !== tab) await closeUpdateDrawer($)
  await update($, usageTab, () => tab)
  if ((await read($, paneView)) !== 'usage') await switchView($, 'usage')
  $.ui.invalidate('ui.render')
  $.clock.after(120, () => {
    void $.ui.scroll({ to: { key: tab === 'settings' ? 'pane-settings' : 'pane-usage' }, in: PANE, block: 'start' }).catch(() => {})
  })
}

async function openSettingsTab($: EngineInterface, tab: SettingsTab): Promise<void> {
  await update($, settingsTab, () => tab)
  $.ui.invalidate('ui.render')
  $.clock.after(120, () => {
    void $.ui.scroll({ to: { key: `set-tab-${tab}` }, in: PANE, block: 'start' }).catch(() => {})
  })
}

async function toggleTidyRaw($: EngineInterface): Promise<void> {
  const isOpen = !(await read($, tidyRawOpen))
  await update($, tidyRawOpen, () => isOpen)
  $.ui.invalidate('ui.render')
}


async function urgencyNow($: EngineInterface): Promise<Urgency> {
  const u = await read($, usage)
  if (!u) return 'ok'
  const inputs = (await read($, optimal))?.inputs ?? null
  const est = estimateFor(u, await $.clock.now())
  const cold = inputs && est.kind === 'cold' ? coldFor(u, inputs) : null
  if (cold !== null && cold.compactUsd < cold.continueUsd) return 'cold'
  return est.kind === 'cold' ? 'ok' : levelOf(u.contextTokens)
}

async function isBandTucked($: EngineInterface): Promise<boolean> {
  const mode = bandShowMode(await currentSettings($))
  if (mode === 'always') return false
  if (mode === 'never') return !(await read($, isConfirmingCompact))
  const phase = await read($, compactPhase)
  if (phase === 'tidying' || phase === 'compacting' || (await read($, isConfirmingCompact))) return false
  const urgency = await urgencyNow($)
  if (urgency === 'ok' || (urgency !== 'cold' && isAutoActive(await read($, auto)))) return true
  const dismissed = await read($, autoDismissed)
  return dismissed !== null && URGENCY_RANK[urgency]! <= (URGENCY_RANK[dismissed] ?? 0)
}

async function revealLabelOf($: EngineInterface, s: Settings): Promise<string> {
  const u = await read($, usage)
  const level = u && u.contextTokens > 0 ? levelOf(u.contextTokens) : null
  const value = u && u.contextTokens > 0 ? `${u.contextEstimated ? '~' : ''}${ctxNumText(u.contextTokens, u.window, s.ctxUnit)}` : null
  return revealLabel(bandShowMode(s) === 'never', level, value)
}

async function revealButton($: EngineInterface, ui: Ui) {
  const sNow = await currentSettings($)
  const isClosed = bandShowMode(sNow) === 'never'
  return (
    <ui.Button
      key="band-reveal"
      label={await revealLabelOf($, sNow)}
      {...(isClosed ? { variant: 'secondary' as const, dimColor: true } : { variant: 'primary' as const })}
      onPress={async () => {
        await update($, autoDismissed, () => null)
        await saveSettings($, setBandShow(await currentSettings($), 'always'))
      }}
    />
  )
}

async function foldBand($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  const s = await currentSettings($)
  if (s.bandFolded) {
    const urgency = await urgencyNow($)
    await update($, autoDismissed, () => urgency)
    $.ui.invalidate('ui.render')
    return
  }
  const folded = setFolded(s, true)
  await saveSettings($, folded)
  $.ui.toast(hiddenNote(folded, await revealLabelOf($, folded)), { timeoutMs: HIDDEN_NOTE_MS })
}

async function toggleSummary($: EngineInterface): Promise<void> {
  const wasOpen = await read($, summaryCard)
  if (!wasOpen && (await wantedView($)) === 'usage') {
    await setWantedView($, null)
    await syncPane($)
    $.ui.invalidate('ui.render')
    return
  }
  await update($, summaryCard, () => !wasOpen)
  if (wasOpen) await update($, isConfirmingCompact, () => false)
  $.ui.invalidate('ui.render')
}

async function closeSummary($: EngineInterface): Promise<void> {
  await update($, summaryCard, () => false)
  await update($, isConfirmingCompact, () => false)
  $.ui.invalidate('ui.render')
}

async function dismissSlim($: EngineInterface): Promise<void> {
  const urgency = await urgencyNow($)
  await update($, isConfirmingCompact, () => false)
  await update($, autoDismissed, () => urgency)
  $.ui.invalidate('ui.render')
}

async function isSlimDismissedNow($: EngineInterface): Promise<boolean> {
  const dismissed = await read($, autoDismissed)
  if (dismissed === null) return false
  return URGENCY_RANK[await urgencyNow($)]! <= (URGENCY_RANK[dismissed] ?? 0)
}

async function slimButton($: EngineInterface, ui: Ui, s: Settings) {
  const u = await read($, usage)
  const view = slimViewOf(s)
  const parts = u ? slimParts(ui, u, await $.clock.now(), view, s.sessionColors, await spendShownOf($, s)) : []
  const isOpen = await read($, summaryCard)
  const isSide = !isOpen && (await wantedView($)) === 'usage'
  const level = u && u.contextTokens > 0 ? levelOf(u.contextTokens) : 'ok'
  return (
    <ui.Button
      key="slim-open"
      label={slimButtonText(u, parts, view, s.ctxUnit, isOpen ? true : isSide ? 'side' : false)}
      {...(level === 'ok' ? { variant: 'secondary' as const } : { variant: 'primary' as const })}
      onPress={() => void toggleSummary($)}
    />
  )
}

async function autoChip($: EngineInterface, ui: Ui, s: Settings, surface: string) {
  const a = await read($, auto)
  if (!a?.on) return null
  const u = await read($, usage)
  const text = autoChipText(a, s, u?.contextTokens ?? null, u?.window)
  return <ui.Button key="auto-chip" label={surface === 'terminal' ? text : `🔄 ${text}`} variant="secondary" {...(a.stop ? { dimColor: true } : {})} onPress={() => void barActs($).openConfirm()} />
}

async function autoBarOf($: EngineInterface, s: Settings, u: Usage | null): Promise<NonNullable<BarData['auto']>> {
  const a = await read($, auto)
  const range = autoRangeText(s, u?.window)
  return { isOn: isAutoActive(a), label: autoChipText(a, s, u?.contextTokens ?? null, u?.window), tip: L(`이지 오토 구간 ${range}`, `Easy Auto range ${range}`) }
}

async function autoNoteOf($: EngineInterface, ui: Ui, s: Settings) {
  const note = (await read($, auto))?.note ?? null
  if (note === null) return null
  const isStop = note === 'stuck' || note === 'again'
  return drawAutoNote(ui, autoNoteText(note, s, (await read($, usage))?.window), {
    resume: isStop ? () => void toggleAuto($) : null,
    dismiss: () => void setAuto($, a => ({ ...a, note: null })),
  })
}

async function toggleFold($: EngineInterface, key: string): Promise<void> {
  const cur = await read($, settingsOpen)
  await update($, settingsOpen, () => ({ ...cur, [key]: !cur[key] }))
  $.ui.invalidate('ui.render')
}

async function toggleCard($: EngineInterface, which: 'now' | 'history' | 'compact'): Promise<void> {
  const cur = await read($, cardsOpen)
  await update($, cardsOpen, () => ({ ...cur, [which]: !cur[which] }))
  $.ui.invalidate('ui.render')
}


async function saveFromSettings($: EngineInterface, chosen: Settings): Promise<void> {
  const wasFolded = (await currentSettings($)).bandFolded
  await saveSettings($, chosen)
  if (!chosen.bandFolded) await update($, autoDismissed, () => null)
  if (chosen.bandFolded && !wasFolded) $.ui.toast(hiddenNote(chosen, await revealLabelOf($, chosen)), { timeoutMs: HIDDEN_NOTE_MS })
}

function settingsActs($: EngineInterface): SettingsActions {
  return {
    save: chosen => void saveFromSettings($, chosen),
    setTab: tab => void openSettingsTab($, tab),
    typeTidy: text => void update($, tidyDraft, () => text),
    saveTidy: text => void saveTidyCustom($, text),
    typeCompact: text => void update($, compactDraft, () => text),
    saveCompact: text => void saveCompactCustom($, text),
    toggleRaw: () => void toggleTidyRaw($),
    toggleFold: key => void toggleFold($, key),
    setLang: choice => void saveLang($, choice),
    setPaneOption: (key, isOn) => void setPaneOption($, key, isOn),
    checkUpdate: () => void checkUpdate($),
    applyUpdate: () => void applyUpdate($),
    toggleUpdate: key => void toggleUpdateOpen($, key),
    diagOpen: where => void openDiag($, where),
    diagClose: () => void closeDiag($),
    diagRedact: isOn => void setDiagRedact($, isOn),
    diagCopy: surface => void copyDiag($, surface),
    diagSave: () => void saveDiag($),
    diagReveal: () => void revealDiag($),
    diagCopyPath: surface => void copyDiagPath($, surface),
    sizeError: msg => {
      timingErr = msg
      $.ui.invalidate('ui.render')
    },
  }
}

function paneMainActs($: EngineInterface): PaneMainActions {
  return {
    toggleFull: id => void toggleStepsFull($, id),
    setEffectsAll: isAll => void setEffectsAll($, isAll),
    setFlowAll: isAll => void setFlowAll($, isAll),
    toggleCard: which => void toggleCard($, which),
    setHistoryAll: isAll => void setHistoryAll($, isAll),
    toggleExpanded: id => void toggleExpanded($, id),
    save: chosen => void saveFromSettings($, chosen),
    sizeError: msg => {
      timingErr = msg
      $.ui.invalidate('ui.render')
    },
    toggleFold: key => void toggleFold($, key),
  }
}

function barActs($: EngineInterface): BarActions {
  return {
    toggleView: view => toggleView($, view),
    openConfirm: async () => {
      await update($, isAskingClear, () => false)
      return update($, isConfirmingCompact, () => true)
    },
    closeConfirm: () => update($, isConfirmingCompact, () => false),
    askClear: () => update($, isAskingClear, () => true),
    backFromClear: () => update($, isAskingClear, () => false),
    cancelTidy: async () => {
      await autoEnd($)
      return update($, compactPhase, () => 'idle')
    },
    toggleAuto: async () => {
      await update($, isConfirmingCompact, () => false)
      return toggleAuto($)
    },
    tidyThenCompact: async () => {
      await update($, summaryCard, () => false)
      await flushTidyDrafts($)
      return tidyThenCompact($)
    },
    compactNow: async keep => {
      await update($, summaryCard, () => false)
      const isCustom = await flushTidyDrafts($)
      return compactNow($, isCustom ? directKeep(await currentSettings($)) : keep)
    },
    clearNow: async () => {
      await update($, summaryCard, () => false)
      return clearNow($)
    },
    pickTidy: async id => {
      const s0 = await currentSettings($)
      await saveSettings($, id === 'custom' ? { ...s0, tidy: 'custom' } : chooseTidy(s0, id))
    },
    setBand: async band => {
      await update($, isConfirmingCompact, () => false)
      await saveSettings($, { ...(await currentSettings($)), band })
    },
    foldBand: () => foldBand($),
    toggleSummary: () => toggleSummary($),
    dismissSlim: () => dismissSlim($),
    typeTidy: text => update($, tidyDraft, () => text),
    typeCompact: text => update($, compactDraft, () => text),
    saveTidy: text => saveTidyCustom($, text),
    saveCompact: text => saveCompactCustom($, text),
  }
}

async function flushTidyDrafts($: EngineInterface): Promise<boolean> {
  const pre = await read($, tidyDraft)
  const post = await read($, compactDraft)
  if (pre !== null) await saveTidyCustom($, pre)
  if (post !== null) await saveCompactCustom($, post)
  return (await currentSettings($)).tidy === 'custom'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await ensureLang($)
    await checkEngine($)
    gaugeNote = await prepareGaugeNote($).catch(() => false as const)
    await refreshUsage($, { categories: false, pushHistory: false })
    await loadSettings($)
    await loadAuto($).catch(() => {})
    await syncStatusLine($).catch(() => {})
    paneStartAt = await $.clock.now()
    await autoOpenPane($).catch(() => {})
    void loadTurns($)
      .catch(() => {})
      .then(() => loadCostBase($))
      .then(() => refreshUsage($, { categories: false, pushHistory: false }))
      .catch(() => {})
      .then(() => fillOlder($))
      .catch(() => {})
    void loadFlow($)
      .then(() => refreshUsage($, { categories: true, pushHistory: false }))
      .catch(() => {})
    void refreshUpdateInfo($).catch(() => {})
    $.clock.every(1500, () => {
      void syncPane($).catch(() => {})
      void loadSettings($).catch(() => {})
      void followModel($).catch(() => {})
      void reconcileAgents($).catch(() => {})
      void syncStatusLine($).catch(() => {})
      void watchCompact($).catch(() => {})
      void autoWatch($).catch(() => {})
    })
    $.clock.every(60000, () => {
      $.ui.invalidate('ui.render')
      void refreshSpend($, 300_000).catch(() => {})
    })
    void refreshSpend($).catch(() => {})
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    try {
      if (e.surface === 'desktop') {
        markArrival(await $.clock.now())
        void update($, flashTick, (k: number) => k + 1).catch(() => {})
        arriveTimer?.cancel()
        arriveTimer = $.clock.after(ARRIVE_SETTLE_MS + 50, () => void update($, flashTick, (k: number) => k + 1).catch(() => {}))
        const u0 = await read($, usage)
        if (u0) {
          const rateLimits = await shareLimits($, u0.rateLimits, u0.lastActivityMs)
          if (JSON.stringify(rateLimits) !== JSON.stringify(u0.rateLimits)) await update($, usage, prev => (prev ? { ...prev, rateLimits } : prev))
        }
      }
    } catch {
    }
    return r
  })
  on('session.detach', async ($, e, next) => {
    const r = await next(e)
    try {
      if (e.surface === 'desktop') {
        clearArrival()
        arriveTimer?.cancel()
        arriveTimer = null
        stopFlashTicker()
        void update($, flashTick, (k: number) => k + 1).catch(() => {})
      }
    } catch {
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const rateLimits = await shareLimits(
        $,
        e.rateLimits.map(r => (r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed })),
        await $.clock.now(),
      )
      await update($, usage, prev => (prev ? { ...prev, rateLimits } : prev))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await ensureLang($)
    const isMain = e.agentId === undefined
    if (!isMain) await markAgentsDone($, id => id === e.agentId)
    if (isMain) {
      await refreshTtl($)
      await update($, ttlConfig, () => null)
    }
    await refreshUsage($, { categories: false, pushHistory: isMain })
    const turnNow = isMain ? await read($, live) : null
    if (isMain) {
      const mark = turnMark
      turnMark = null
      if (mark && mark.turnId === e.turnId) {
        const got = await appExtraSince($, mark)
        if (got && got.extra >= APP_MIN_USD) {
          await addAppCost($, got.extra, e.isAborted ? L('중단 · 도중 끊긴 요청 등', 'stopped · interrupted requests, etc.') : L('질문 도중 · 앱 자체 요청', 'during the question · app requests'))
        }
      }
      await closeTurn($, e.answer.trim() !== '' ? e.answer : lastStepAnswer, e.isAborted)
      lastStepAnswer = ''
      await markIdle($)
      void refreshSpend($).catch(() => {})
      await autoAtTurnEnd($, e, turnNow).catch(err => log($, `auto turn end failed — ${String(err)}`))
    }
    if (isMain && (await read($, compactPhase)) === 'tidying' && !isAutoSaveKind(await read($, compactKind))) {
      const verdict = tidyVerdict(e.reason, e.answer)
      if (verdict === 'go') {
        if (turnNow) await recordSaveTurn($, turnNow)
        await startCompacting($, kindTidy())
        $.clock.after(300, () => void currentSettings($).then(s2 => compactNow($, compactKeep(s2))))
      } else {
        await update($, compactPhase, () => (verdict === 'hold' ? 'held' : 'idle'))
        $.ui.toast(
          verdict === 'hold'
            ? L('세션이 지금은 컴팩트하지 않는 게 맞다고 답했습니다. 이유는 답에 있습니다', 'The session answered that it should not compact now. The reason is in the answer')
            : verdict === 'stopped'
              ? L('저장이 끝나지 않아 컴팩트를 하지 않았습니다', 'Did not compact — the save did not finish')
              : L(`답에 ${markGo()} 표시가 없어 컴팩트를 하지 않았습니다`, `Did not compact — the answer has no ${markGo()} mark`),
        )
      }
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await ensureLang($)
    if (e.agentId === undefined && (await read($, summaryCard))) await update($, summaryCard, () => false)
    if (gaugeNote && (e as { agentId?: string }).agentId === undefined) void showGaugeNote($).catch(() => {})
    if (e.agentId === undefined && (await read($, compactPhase)) === 'held') await update($, compactPhase, () => 'idle')
    const appCarry = await appCarryAtStart($)
    if ((e as { agentId?: string }).agentId === undefined) await writeFlow($, withQuestion(await readFlow($), await $.clock.now()))
    const submitAt = await $.clock.now()
    if (e.agentId === undefined) await autoOnTurnStart($, e.turnId, e.text).catch(() => {})
    if (e.agentId === undefined) lastStepAnswer = ''
    if (e.agentId === undefined) liveCells = { turnId: e.turnId, tools: [], tails: [] }
    const sent = e.agentId === undefined && pendingSubmit && submitAt - pendingSubmit.atMs < 60_000 ? pendingSubmit : null
    if (e.agentId === undefined) pendingSubmit = null
    const ownHead = promptHead(e.text)
    const head = ownHead || (sent ? promptHead(sent.text) : '')
    const attach = sent && (sent.isIdle || !ownHead) ? sent.counts : null
    await update($, live, () => ({
      turnId: e.turnId,
      steps: 0,
      cost: ZERO_COST,
      prompt: attachHead(head, attach) || (e.agentId === undefined ? continuedName() : ''),
      contextTokens: 0,
      outputTokens: 0,
      details: [],
    }))
    if (appCarry > 0) await addAppCost($, appCarry, L('앞 답 30초 뒤 ~ 이 질문 시작', 'from 30s after the last answer to this question'))
    if (orphanAgent.length > 0) {
      const carried = orphanAgent
      orphanAgent = []
      await update($, live, prev =>
        prev ? carried.reduce((t, a) => ({ ...t, cost: addCost(t.cost, a.cost), details: withAgentStep(t.details, a.agentId, a.label, a.cost, a.model, a.atMs) }), prev) : prev,
      )
    }
    const ledgerNow = await ledgerUsd($)
    turnMark = ledgerNow === null ? null : { turnId: e.turnId, ledger: ledgerNow, tracked: trackedUsd }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind !== 'plugin') await autoOnOther($).catch(() => {})
    const r = await next(e)
    try {
      if (r.drop === undefined) {
        const files = e.attachments ?? []
        const image = files.filter(a => a.type === 'image').length
        pendingSubmit = { text: e.text, counts: files.length > 0 ? { image, other: files.length - image } : null, isIdle: e.turnId === undefined, atMs: await $.clock.now() }
      }
    } catch {
    }
    return r
  }).catch(($, e, next) => next(e))

  on('prompt.suggest', async ($, e, next) => {
    if (e.origin.kind === 'suggestion') suggestedSinceMark = true
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined && liveCells && typeof e.tool_use_id === 'string') liveCells = nextQuestionCells(liveCells, { tool: e.tool_use_id })
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    await ensureLang($)
    if (e.agentId === undefined) await autoAtStep($, e.turnId).catch(() => {})
    if (e.agentId === undefined && e.index === 0) void watchUltra($, e.turnId).catch(() => {})
    const result = yield* next(e)
    if (e.agentId === undefined && typeof result.answer === 'string' && result.answer.trim() !== '') {
      lastStepAnswer = result.answer
      if (liveCells?.turnId === e.turnId) liveCells = nextQuestionCells(liveCells, { answer: result.answer })
    }
    if (e.agentId !== undefined && result.usage) {
      try {
        const cost = costOf(result.usage, result.usage.model, 5, null, engineNow)
        if (cost) await recordAgentStep($, e.agentId, cost, result.usage.model)
      } catch {
      }
    }
    if (e.agentId === undefined && result.usage) {
      try {
        const cost = costOf(result.usage, result.usage.model, ttlOf(await read($, usage)), null, engineNow)
        const switchedFrom = (await read($, usage))?.switchedFrom ?? null
        if (cost) await recordStep($, e.turnId, cost, result.usage, stepLabel(result.toolUses), result.usage.model, e.effort, switchedFrom)
        const t = result.usage
        const ctxNow = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
        if (measureAfterCompact) {
          measureAfterCompact = false
          await $.store.set(AFTER_KEY, ctxNow)
          await fillCompactAfter($, ctxNow)
          const summary = (await read($, compactions)).at(-1)?.summary
          if (typeof summary === 'number' && summary > 0) await $.store.set(SUMMARY_KEY, summary)
        }
        const perCallExtraUsd = extraPerCall(await readFlow($), result.usage.model)
        const stepAt = await $.clock.now()
        await update($, usage, prev =>
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
        await applyThresholds($)
        await autoAfterStep($, ctxNow)
      } catch {
      }
    }
    return result
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    if (e.surface !== 'terminal') return next(e)
    const now = await read($, live)
    if (!now || now.steps === 0) {
      return next(e)
    }
    const sSpin = await currentSettings($)
    if (slimViewOf(sSpin).spin === 'off') {
      return next(e)
    }
    const agents = agentPart(now.details, viewOf(sSpin).info === 'full')
    const theirs = await next(e)
    return spinnerCost($.ui.resolve(e), theirs, now, agents)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    if (e.props.isSummary) return next(e)
    const sums = await read($, turnSummaries)
    const summary = [...sums].reverse().find(s => endsWithTail(e.props.text, s.tail))
    if (!summary) {
      const scope = await cellScope($, e.surface, { text: e.props.text })
      return scope ? cellMark($.ui.resolve(e), await next(e), scope) : next(e)
    }
    const theirs = await next(e)
    const settings = await currentSettings($)
    if (slimViewOf(settings).chip === 'off') return theirs
    const isFull = viewOf(settings).info === 'full'
    const isOpen = isFull && e.surface !== 'terminal' && (await read($, answerOpen)).includes(summary.atMs)
    const isHover = e.surface !== 'terminal' && settings.questionHover
    return drawAnswerChip($.ui.resolve(e), { theirs, summary, isFull, surface: e.surface, isOpen, isHover }, { toggle: () => void toggleAnswer($, summary.atMs) })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const scope = await cellScope($, e.surface, { toolIds: [e.props.tool_use_id] })
    return scope ? cellMark($.ui.resolve(e), await next(e), scope) : next(e)
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const scope = await cellScope($, e.surface, { toolIds: [e.props.tool_use_id] })
    return scope ? cellMark($.ui.resolve(e), await next(e), scope) : next(e)
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const scope = await cellScope($, e.surface, { toolIds: e.props.calls.map(c => c.tool_use_id) })
    return scope ? cellMark($.ui.resolve(e), await next(e), scope) : next(e)
  })

  on('session.compact', async ($, e, next) => {
    const mark = { isRecorded: false }
    hookCompact = mark
    await ensureLang($)
    const isMine = e.agentId === undefined && e.trigger !== 'precompute'
    if (isMine && (await read($, compactPhase)) !== 'compacting') await startCompacting($, compactKindOf(e.trigger))
    try {
      const result = await next(e)
      if (e.agentId === undefined && e.trigger === 'precompute' && !result.skip && result.usage) {
        const pre = costOf(result.usage, (await read($, usage))?.model ?? (await $.session.model()), undefined, null, engineNow)
        if (pre) {
          trackedUsd += pre.usd
          await addAppCost($, pre.usd, L('컴팩트 미리 계산', 'compact precompute'))
        }
      }
      if (isMine && !result.skip) {
        await recordCompaction($, e.trigger, result, 'hook', mark)
        await noteCompact($, `compact (${e.trigger}) — the session.compact hook saw it`)
      }
      await refreshUsage($, { categories: false, pushHistory: false })
      return result
    } finally {
      if (isMine) await update($, compactPhase, () => 'idle')
    }
  }).catch(async (_$, e, next) => {
    const mark = hookCompact
    const result = await next(e)
    const wasRecorded = next.called && mark !== null && mark.isRecorded
    if (e.agentId === undefined && e.trigger !== 'precompute' && result && !result.skip && !wasRecorded) missedCompact = { trigger: e.trigger, result }
    return result
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await notePane($, 'closed by person')
      await setWantedView($, null)
      await update($, paneView, () => null)
      await update($, usageTab, () => 'main')
      await update($, paneModeLocal, () => null)
      await update($, settingsOpen, () => SETTINGS_OPEN_DEFAULT)
      await update($, settingsTab, () => 'bar')
      await update($, previewOpen, () => false)
      await update($, cardsOpen, () => CARDS_OPEN_DEFAULT)
      await closeUpdateDrawer($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.message', async ($, e, next) => {
    if (!e.module.endsWith('switch.tsx') || !e.element.startsWith('sw-')) return next(e)
    const id = e.element.slice(3)
    const s = await currentSettings($)
    let isOn: boolean
    switch (id) {
      case 'bandFolded':
        isOn = !s.bandFolded
        await saveFromSettings($, setFolded(s, isOn))
        break
      case 'bandAutoOpen':
        isOn = !s.bandAutoOpen
        await saveFromSettings($, { ...s, bandAutoOpen: isOn })
        break
      case 'statusLine':
        isOn = !s.statusLine
        await saveFromSettings($, { ...s, statusLine: isOn })
        break
      case 'paneAutoOpen':
      case 'paneShared':
        isOn = !s[id]
        await setPaneOption($, id, isOn)
        break
      case 'questionHover':
        isOn = !s.questionHover
        await saveFromSettings($, { ...s, questionHover: isOn })
        break
      case 'diagRedact':
        isOn = !(await read($, diagCard)).redact
        await setDiagRedact($, isOn)
        break
      case 'motion':
        isOn = s.motion === 'reduce'
        await saveFromSettings($, { ...s, motion: isOn ? 'system' : 'reduce' })
        break
      case 'chipDetail': {
        if (s.screen !== 'custom') return { props: { on: viewOf(s).info === 'full', disabled: true } }
        isOn = viewOf(s).info !== 'full'
        await saveFromSettings($, editView(s, v => ({ ...v, info: isOn ? 'full' : 'lean' })))
        break
      }
      default:
        return next(e)
    }
    return { props: { on: isOn, disabled: false } }
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    try {
    await ensureLang($)
    setSurface(e.surface)
    const ui = $.ui.resolve(e)
    const wantTitle = paneTitle()
    if (typeof e.props.title === 'string' && e.props.title !== wantTitle && retitledTo !== wantTitle) {
      retitledTo = wantTitle
      void $.ui.open({ id: PANE, title: wantTitle }).catch(() => {})
    }
    if (oldEngine) return oldEngineNote(ui, oldEngine)
    const { Box, Button } = ui
    const sNowPane = await currentSettings($)
    setCtxUnit(sNowPane.ctxUnit)
    const isSettings = (await read($, usageTab)) === 'settings'
    const updInst = await installNow($)
    const updNow = await read($, updateInfo)
    const upd: UpdateState = !updInst ? { ...updNow, phase: 'dev' } : updInst.marketplace === 'synced' ? { ...updNow, phase: 'synced' } : updNow
    const isTerminal = e.surface === 'terminal'
    const pad = isTerminal ? 1 : 2
    const cols = Math.max(24, e.props.bodyColumns - pad)
    const widthPx = isTerminal ? Math.max(120, (cols - CARD_INSET) * 6) : Math.max(120, Math.min(SVG_MAX_PX, Math.floor((cols - CARD_INSET) * CH_PX)))
    const u = await read($, usage)
    const allSums = await read($, turnSummaries)
    const nowMs = u || allSums.length > 0 ? await $.clock.now() : 0
    const flowNow = await readFlow($)
    const opt = await read($, optimal)
    const inputsNow = opt?.inputs ?? null
    const permRaw = permanentOf(flowNow, (await read($, flowNote)) !== null, inputsNow?.after ?? null)
    const ctxForPerm = u?.contextTokens ?? null
    const perm = permRaw && ctxForPerm !== null && ctxForPerm > 0 ? { ...permRaw, tokens: Math.min(permRaw.tokens, ctxForPerm) } : permRaw
    const g = gridOf(e.surface)
    let body: unknown
    if (isSettings) {
      const sSet = sNowPane
      const estSet = u ? estimateFor(u, nowMs) : null
      const lastSum = allSums.length > 0 ? allSums[allSums.length - 1]! : null
      const pvModel = u?.model ?? ((await $.session.model().catch(() => '')) || 'claude-opus-5-5')
      const pvTurn = lastSum ?? sampleTurn(nowMs, pvModel)
      setBandOrder(sSet.bandOrder)
      const setTab = await read($, settingsTab)
      const pvU = u ?? sampleUsage(nowMs, pvModel)
      const pvPhase = setTab === 'bar' && sSet.statusLine && !isSlim(sSet) ? await read($, compactPhase) : null
      const spendSet = setTab === 'bar' ? await spendShownOf($, sSet) : null
      const openSet = await read($, settingsOpen)
      const previews = settingsPreviews(
        ui,
        e.surface,
        { setTab, s: sSet, u, pvU, pvTurn, isSample: lastSum === null, nowMs, inputs: inputsNow, spend: spendSet, cols, phase: pvPhase, open: openSet, isPreviewOpen: setTab === 'chip' ? await read($, previewOpen) : false },
        { toggleFold: key => void toggleFold($, key), togglePreview: () => void togglePreview($) },
      )
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
        (await read($, usage))?.contextTokens ?? null,
        autoLang,
        cols,
        await read($, settingsOpen),
        {
          ttl: ttlOf(await read($, usage)),
          measured: (await read($, usage))?.cacheTtlMeasured === true,
          minsLeft: estSet?.kind === 'warm' ? estSet.minsLeft : null,
          isCold: estSet?.kind === 'cold',
          config: (await read($, ttlConfig)) ?? (await readTtlConfig($)),
        },
        previews,
        u ? (u.rateLimits.length > 0 ? true : allSums.length > 0 ? false : null) : null,
        await read($, compactDraft),
        setTab,
        await diagViewOf($, 'gen'),
        timingErr,
      )
    } else {
      const nowTurn = await read($, live)
      const phase = await read($, compactPhase)
      const kind = await read($, compactKind)
      setPaneBarMotion({ compacting: phase === 'compacting', shrink: await shrinkNow($), on: sNowPane.motion !== 'reduce' })
      const qDetail = (await paneModeNow($)) === 'simple' ? 'summary' : 'steps'
      const tally: Tally = { older: await read($, turnsOlder), liveUsd: nowTurn?.cost.usd ?? 0, costUsd: u?.costUsd ?? null }
      const fullIds = await read($, stepsFull)
      const flowLoadedNow = await read($, flowLoaded)
      const flowNoteNow = await read($, flowNote)
      const effectsAllNow = await read($, effectsAll)
      const flowAllNow = await read($, flowAll)
      const open = await read($, cardsOpen)
      const expanded = await read($, expandedTurn)
      const historyAllNow = await read($, historyAll)
      const openNow = await read($, settingsOpen)
      const autoBand = isAutoActive(await read($, auto)) ? { start: sNowPane.autoStart, end: sNowPane.autoEnd } : null
      const shownMode = await paneModeNow($)
      const allLine = await allSpendOf($, sNowPane, shownMode)
      if (allLine?.state === 'measuring') void refreshSpend($, 5_000, true).catch(() => {})
      const rateSince = (await read($, spend))?.engineSince ?? null
      body = drawPaneMain(
        ui,
        e.surface,
        { u, sums: allSums, nowMs, now: nowTurn, phase, kind, detail: qDetail, tally, fullIds, flow: flowNow, flowLoaded: flowLoadedNow, flowNote: flowNoteNow, widthPx, effectsAll: effectsAllNow, flowAll: flowAllNow, opt, inputs: inputsNow, perm, cardsOpen: open, expanded, historyAll: historyAllNow, s: sNowPane, cols, g, timingErr, open: openNow, autoBand, mode: shownMode, allLine, rateSince },
        paneMainActs($),
      )
    }
    const paneMode = await paneModeNow($)
    const isDrawerOpen = await read($, updDrawer)
    const paneShrink = await shrinkNow($)
    const headPhase = await read($, compactPhase)
    return (
      <Box flexDirection="column" width={cols}>
        {drawPaneHead(
          ui,
          e.surface,
          { u, isSettings, paneMode, upd, isDrawerOpen, motion: sNowPane.motion !== 'reduce', shrink: paneShrink, phase: headPhase },
          { openTab: which => void openUsageTab($, which), setMode: mode => void setPaneMode($, mode), toggleDrawer: () => void toggleUpdateDrawer($) },
        )}
        {isDrawerOpen ? drawUpdateDrawer(settingsActs($), ui, upd, await $.clock.now(), e.surface, await diagViewOf($, 'drawer')) : null}
        <Box marginTop={1} flexDirection="column">
          {body}
        </Box>
      </Box>
    )
    } catch (err) {
      log($, `pane render failed: ${String((err as Error)?.stack ?? err)}`)
      const { Box, Text } = $.ui.resolve(e)
      return (
        <Box key="pane-error" flexDirection="column">
          <Text color="error" wrap="wrap">{L('easy-compact 패널을 그리다 오류가 났습니다. 이 글을 알려 주세요', 'easy-compact failed to draw this pane. Please report this text')}</Text>
          <Text dimColor wrap="wrap">{String((err as Error)?.stack ?? err).slice(0, 1500)}</Text>
        </Box>
      )
    }
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const inner = await next(e)
    if (e.surface === 'terminal') return inner
    const sMode = await currentSettings($)
    const isTucked = !isSlim(sMode) && (await isBandTucked($))
    await ensureLang($)
    setSurface(e.surface)
    const { Box } = $.ui.resolve(e)
    return (
      <Box key="ec-mode" columnGap={1} alignItems="center">
        {inner}
        {isSlim(sMode) ? await slimButton($, $.ui.resolve(e), sMode) : isTucked ? await revealButton($, $.ui.resolve(e)) : null}
        {isSlim(sMode) || isTucked ? await autoChip($, $.ui.resolve(e), sMode, e.surface) : null}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await ensureLang($)
    setSurface(e.surface)
    const sNow = await currentSettings($)
    setBandOrder(sNow.bandOrder)
    if (e.props.hasSurvey || (!isSlim(sNow) && (await isBandTucked($)))) {
      if (e.surface !== 'terminal') {
        const ui = $.ui.resolve(e)
        const live0 = !e.props.hasSurvey && e.props.isWorking && slimViewOf(sNow).spin !== 'off' ? await read($, live) : null
        return (
          <ui.Box key="ec-band" flexDirection="column">
            {await next(e)}
            {e.props.hasSurvey ? null : await autoNoteOf($, ui, sNow)}
            {live0 ? liveStrip(ui, live0, viewOf(sNow).info === 'full', e.surface, { isAlone: true }) : null}
          </ui.Box>
        )
      }
      if (e.props.hasSurvey) return next(e)
      const ui = $.ui.resolve(e)
      return (
        <ui.Box key="band-folded-t" flexDirection="column">
          {await autoNoteOf($, ui, sNow)}
          <ui.Box key="band-folded" justifyContent="flex-end" columnGap={1}>
            {await autoChip($, ui, sNow, e.surface)}
            {await revealButton($, ui)}
          </ui.Box>
        </ui.Box>
      )
    }
    if (oldEngine) return oldEngineNote($.ui.resolve(e), oldEngine)

    const ui = $.ui.resolve(e)
    const u = await read($, usage)
    const view = await read($, paneView)
    const isConfirming = !e.props.isWorking && (await read($, isConfirmingCompact))
    const nowMs = u ? await $.clock.now() : 0
    const autoBar = await autoBarOf($, sNow, u)
    if (u) {
      const isMotion = sNow.motion !== 'reduce'
      const ranks = {
        ctx: autoBar.isOn ? 0 : CTX_RANK[levelOf(u.contextTokens)],
        sess: u.costUsd !== null ? sessRankOf(sessionColorOf(u.costUsd, sNow.sessionColors)) : 0,
        cache: cacheRankOf(u, nowMs),
      }
      const isCtxUp = noteRank('ctx', ranks.ctx, isMotion)
      const isSessUp = u.costUsd !== null && noteRank('sess', ranks.sess, isMotion)
      const isCacheUp = noteRank('cache', ranks.cache, isMotion)
      const isArrive = takeArrival(nowMs, ranks, isMotion)
      if (isCtxUp || isSessUp || isCacheUp || isArrive) startFlashTicker($)
    }
    await read($, flashTick)
    const sums = await read($, turnSummaries)
    const now = e.props.isWorking ? await read($, live) : null
    const inputs = (await read($, optimal))?.inputs ?? null
    const phase = await read($, compactPhase)
    const kind = await read($, compactKind)
    const just = u?.isAfterCompact ? ((await read($, compactions)).at(-1) ?? null) : null
    const shrink = await shrinkNow($)
    const spendNow = await spendShownOf($, sNow)
    const isBusy = phase === 'compacting' || phase === 'tidying'
    const isSumOpen = e.surface !== 'terminal' && !isBusy && (await read($, summaryCard))
    const isSlimSummary = isSumOpen && isSlim(sNow)
    const isSlimDismissed = isSlim(sNow) ? await isSlimDismissedNow($) : false
    const drafts = { tidyDraft: await read($, tidyDraft), compactDraft: await read($, compactDraft) }
    const older = isConfirming && (await read($, isAskingClear)) ? await read($, turnsOlder) : undefined
    const clearAsk = older === undefined ? null : { questions: older === null ? null : sums.length + older.count }
    const isStrip = e.surface !== 'terminal' && slimViewOf(sNow).spin !== 'off'
    const bar = drawingBar(nowMs, () => drawBar(ui, e, { sNow, u, view, isConfirming, nowMs, sums, inputs, phase, kind, just, shrink, spendNow, isSlimDismissed, isSlimSummary, ...drafts, clearAsk, auto: autoBar }, barActs($)))
    const noteEl = await autoNoteOf($, ui, sNow)
    const others = await next(e).catch(() => null)
    if (e.surface === 'terminal') {
      return bar || noteEl ? (
        <ui.Box key="ec-band-t" flexDirection="column">
          {others}
          {noteEl}
          {bar}
        </ui.Box>
      ) : (
        others
      )
    }
    return (
      <ui.Box key="ec-band" flexDirection="column">
        {others}
        {noteEl}
        {bar}
        {isStrip && now ? liveStrip(ui, now, viewOf(sNow).info === 'full', e.surface, { isAlone: !bar }) : null}
      </ui.Box>
    )
  })
}
