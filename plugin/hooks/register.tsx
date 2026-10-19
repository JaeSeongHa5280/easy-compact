/**
 * easy-compact 훅 모듈 — 훅 등록 · 상태(atom · store) · 기록 읽기 · 요청/질문 집계 · 컴팩트 흐름 · 명령.
 *
 * $ 를 쓰는 함수는 모두 이 파일에 둔다: 엔진은 $ 를 import 너머로 따라가지 않아, 다른 파일 함수에 $ 를 넘기면 모듈이 안
 * 뜬다("$ is followed only into a function declared in this same file"). 화면 그리기는 ui-*.tsx(버튼 동작은 여기서 act 로
 * 묶어 넘긴다), 글 도우미는 text.ts, 컴팩트 지시문은 tidy.ts, 계산은 cost · flow · optimal · settings.ts
 */
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
  fmtUsd,
  LEVEL_TEXT,
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
import { BAND_PARTS, isSlim, parseSlim, slimCustom, spendOf, PARTS, setPart, parsePartKey, parsePartLevel, partName, levelName, slimViewOf, setLimits, bandModeName, bandPartName, bandShowMode, bandShowOf, bandStateText, chooseScreen, editView, hiddenNote, isViewPart, HIDDEN_NOTE_MS, parseScreen, screenName, setFolded, viewOf, paneAutoUse, paneSyncUse, revealLabel, revealName, setBandShow, chooseTidy, isAutoWord, parseOnOff, DEFAULT_SETTINGS, normalizeSettings, NEW_INSTALL_SCREEN, UPDATE_SCREEN, paneModeName, paneModeOf, parseBandMode, parseBandPart, parseMinutes, parseTokens, setBandPart, setCompactAt, setFollow, setRange, setTidyCustom, thresholdsOf, tidyStyles, tidyBody, usesCustom, setCompactCustom, setContextWindow, setEngineAuto } from './settings'
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
import { afterGuess, afterInNowTokens, compactSince, compactSummary, costScanFromLines, costScanOf, flowFromRecords, lacksModels, lastCtxOf, lastMainTtl, MAX_POINTS, mergeMeasured, parseFlowFile, pendingCompact, recordsFromLines, restoredOf, scanTranscript, serializeFlow, sharedFor, syncCompactAfter, extraPerCall, withPoint, withQuestion, recordsFromTranscript } from './flow'
import type { CostScan, Flow, FlowRecord } from './flow'
import type { Tokens } from './cost'
import { APP_MIN_USD, agentPart, agentSum, attachHead, continuedName, ctxNumText, PLUGIN_SENT, promptHead, stepLabel, paneTitle } from './text'
import type { AttachCounts } from './text'
import { kindDirect, kindTidy, compactKindOf, markGo, tidyPrompt, compactKeep, directKeep, tidyVerdict, autoTurnOf, autoSavePrompt, autoContinuePrompt, autoCompactKeep, kindAuto, kindAutoSave, isAutoSaveKind } from './tidy'
import { AUTO_AGAIN_REQUESTS, AUTO_LAST_KEY, AUTO_WAIT_MS, autoChipText, autoFromStore, autoKey, autoLossOf, autoNoteText, autoRangeText, autoToggleNote, freshAuto, isAutoActive, isChainStuck, isTooSoon } from './auto'
import { drawAutoNote } from './ui-auto'
import { BRAND_HEX, CH_PX, oldEngineNote, setGaugeShape, setMotion, row, gridOf, CARD_INSET, questionScope, SVG_MAX_PX } from './ui-common'
import type { Ui } from './ui-common'
import { setBandOrder, setCtxUnit, slimButtonText, slimParts } from './ui-band'
import type { SpendShown } from './ui-band'
import { permanentOf, drawAllSpend, setPaneBarMotion } from './ui-usage'
import type { AllSpendLine, Tally } from './ui-usage'
import { draftCompactAt, drawSettingsView, drawUpdateDrawer } from './ui-settings'
import { answerDetail, answerLine, liveStrip, sampleTurn, sampleUsage } from './ui-answer'
import { drawBar } from './ui-bar'
import type { BarActions, BarData } from './ui-bar'
import { drawPaneHead, drawPaneMain, settingsPreviews } from './ui-pane'
import type { PaneMainActions } from './ui-pane'
import { statusLineText } from './status-line'
import { diagHead, dumpText, redactDump } from './diag'
import type { DiagCounts, DiagView } from './diag'
import { isKorean, L, lang, plural, setLang } from './i18n'
import { setSurface } from './glyph'
import type { Lang } from './i18n'
import { changeRange, changelogItems, changelogVersionsBetween, engineBelow, installedFrom, marketVersionOf, MIN_ENGINE, pluginDataId, syncedFrom, versionGt } from './paths'
import type { SettingsActions, SettingsTab } from './ui-settings'
import { agentRunFromText, foldOlder, NO_OLDER, olderFromRebuilt, olderOf, parseTurnsFile, parseTurnsOlder, serializeTurns, TURNS_KEEP, turnsFromRecords, withAgentStep, withAppStep } from './turns'
import { AFTER_KEY, AGENT_LIST_TRIES, AGENT_QUIET_MS, APPLY_TOTAL_MS, APP_FIX_MS, CARDS_OPEN_DEFAULT, CHECK_TOTAL_MS, CTX_RANK, DIAG_CLOSED, GAUGE_NOTE_KEY, GAUGE_NOTE_MS, GAUGE_SHRINK_MS, KEPT_KEY, LEDGER_COMPACTS_MAX, LIMITS_FILE, MIX_KEY, OLD_DEFAULT_RANGE, OUTPUT_KEY, PANE, PANE_AUTO_KEEP, PANE_AUTO_KEY, PANE_EVENT_KEY, PANE_MODE_KEY, PER_Q_MIN, PER_Q_WINDOW, READ_LIMIT, SAVE_KEEP, SEEN_VERSION_KEY, SETTINGS_OPEN_DEFAULT, SPEND_RETRY_MS, SUMMARY_KEY, UPDATE_GRACE_MS, UPDATE_IDLE, URGENCY_RANK, agentInfo, freshestLimits, listedAgents, paneLog, parseSharedLimits, sessRankOf, spendColors } from './state'
import type { PaneEvent, Urgency } from './state'



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
 * 아닌 글자를 - 로(공식 문서 plugins/components). 업데이트해도 남고 /plugin uninstall 이 지운다. 디렉터리 설치본은
 * easy-compact-synced, 폴더로 불러온 개발본은 plugins/data/easy-compact
 */
async function dataDir($: EngineInterface): Promise<string> {
  const installed = installedFrom($.plugin.root) ?? syncedFrom($.plugin.root)
  if (installed) return `${installed.configDir}/plugins/data/${pluginDataId('easy-compact', installed.marketplace)}`
  return `${await claudeHome($)}/plugins/data/easy-compact`
}


// ── 업데이트 칸(설정 탭 맨 아래 easy-compact, 2026-10-14 사용자 결정: 1~3안 · 자동 확인 없음 · 개발본엔 숨김) ──
// ① [업데이트 확인] — 누를 때만 Claude Code 가 GitHub 의 마켓을 받아 온다(`claude plugin marketplace update` — 네트워크는 엔진의 git,
//    이 mod 는 스스로 통신하지 않는다), 새 판이면 같은 자리 [업데이트](`claude plugin update`) → 앱을 다시 켜면 적용
// ② 켤 때 받아 둔 마켓 사본과 판을 견줘 새 판이면 설정 탭 이름에 점 — 이 PC 파일만 읽는다
// ③ 업데이트 뒤 첫 실행이면 사용량 패널 맨 위에 "N 판으로 업데이트됨 · 바뀐 것" 한 줄, 닫으면 끝
// 실험(2026-10-14): 데스크톱 엔진 안에서 CLAUDE_CODE_EXECPATH 는 안 보이고 PATH 의 claude 는 돌았다(--version · marketplace list exit 0).
// 두 명령은 따로 된 설정 폴더(CLAUDE_CONFIG_DIR)에서 marketplace add → install → marketplace update → plugin update 로 확인

/**
 * 설치본이면 설정 폴더 · 마켓 이름(앤트로픽 디렉터리 설치본은 "synced"), 폴더로 불러온 개발본이면 null — 업데이트 칸은 설치본에만.
 * 시험 전용으로 개발본에서 설치본을 흉내 낸다: EASY_COMPACT_FAKE_INSTALL = {"configDir","marketplace"} JSON(엔진은 env 이름을 글자
 * 그대로만 받는다)
 */
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
    // 없음
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

/** 이 mod 의 판(plugin.json version) — 못 읽으면 null */
async function ownVersion($: EngineInterface): Promise<string | null> {
  const v = ((await readJsonFile($, `${$.plugin.root}/.claude-plugin/plugin.json`)) as { version?: unknown } | null)?.version
  return typeof v === 'string' ? v : null
}

/**
 * 받아 둔 마켓 사본 폴더: known_marketplaces.json 의 installLocation 먼저(N8 — Claude Code 가 실제로 둔 곳), 없으면
 * <설정 폴더>/plugins/marketplaces/<마켓>(예전엔 이 길을 직접 만들었다)
 */
async function marketDir($: EngineInterface, inst: { configDir: string; marketplace: string }): Promise<string> {
  const known = (await readJsonFile($, `${inst.configDir}/plugins/known_marketplaces.json`)) as Record<string, { installLocation?: unknown }> | null
  const loc = known?.[inst.marketplace]?.installLocation
  return typeof loc === 'string' && loc.trim() !== '' ? loc.replace(/\\/g, '/').replace(/\/$/, '') : `${inst.configDir}/plugins/marketplaces/${inst.marketplace}`
}

/** 받아 둔 마켓 사본의 판 · 받은 때 — 이 PC 파일만(Claude Code 의 마켓 사본 · known_marketplaces.json) */
async function readMarket($: EngineInterface, inst: { configDir: string; marketplace: string }): Promise<{ market: string | null; marketAt: string | null }> {
  const market = marketVersionOf(await readJsonFile($, `${await marketDir($, inst)}/.claude-plugin/marketplace.json`))
  const known = (await readJsonFile($, `${inst.configDir}/plugins/known_marketplaces.json`)) as Record<string, { lastUpdated?: unknown }> | null
  const at = known?.[inst.marketplace]?.lastUpdated
  return { market, marketAt: typeof at === 'string' ? at : null }
}

/**
 * 서랍에 보일 판들과 그 바뀐 것(U1 — 0.6.1 피드백 "내 판보다 높은 모든 판의 바뀐 것을 판별로"): 받아 둔 마켓 사본(디렉터리 설치본은 이
 * 판 플러그인 폴더)의 CHANGELOG 에서 from < v ≤ to 를 새 판부터. 이 PC 파일만 — 통신 없음. 글은 읽는 때 언어(언어를 바꾸면 ensureLang 이
 * 다시 읽는다 — L1)
 */
async function readChanges(
  $: EngineInterface,
  inst: { configDir: string; marketplace: string } | null,
  from: string | null,
  to: string | null,
): Promise<{ versions: string[]; changes: Record<string, ChangeGroup[]> }> {
  // 디렉터리 설치본은 마켓 사본이 없다 — 이 판 플러그인 폴더의 CHANGELOG(공개본이 plugin/ 에도 담는다, 0.6.0). 0.9.1: 폴더로 불러온
  // 개발본(inst = null)도 이 폴더 — 공개본 사본이면 뿌리에, 이 저장소 개발본이면 docs/public 에 있다
  const root = $.plugin.root.replace(/\\/g, '/')
  const dirs = !inst ? [root, `${root}/docs/public`] : inst.marketplace === 'synced' ? [root] : [await marketDir($, inst)]
  const names = lang() === 'ko' ? ['CHANGELOG.ko.md', 'CHANGELOG.md'] : ['CHANGELOG.md']
  for (const path of dirs.flatMap(dir => names.map(name => `${dir}/${name}`))) {
    let md: string
    try {
      md = await $.fs.read(path)
    } catch {
      continue // 다음 파일
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

/**
 * 켤 때 · 패널을 열 때 · 서랍을 열 때(설치본만): 지금 판과 받아 둔 사본 판 — 사본이 더 새로우면 newer(탭 줄 버튼 "새 판 N"). 본 판과
 * 지금 판이 다르면 업데이트 뒤 첫 실행(버튼 "N 바뀐 것"). U3(0.6.1 피드백): [업데이트] 로 받은 판이 이미 떴으면(지금 판 = 받은 판 — 앱을
 * 다시 켜지 않아도 새 판 모듈이 떴다) "받음" 에 머물지 않고 최신으로
 */
async function refreshUpdateInfo($: EngineInterface): Promise<void> {
  // 끝을 못 알린 업데이트 일은 버리고(시간 넘음), 일하는 모듈이 없는데 남은 확인 중 · 업데이트 중은 낡은 표시로 본다 — 다시 불러온 뒤에도
  // 그 글에 고정돼 버튼이 안 돌아왔다. 버전 버튼으로 서랍을 열 때 · 켤 때 · 패널을 열 때 여기를 지난다
  await dropStaleUpdateJob($)
  const isJobLive = updateJob !== null
  const inst = await installNow($)
  const own = await ownVersion($)
  // 0.9.1 U5: 폴더로 불러온 개발본도 버튼은
  // 늘 — 판 · 이 판 바뀐 것 · 문제 제보만(업데이트 명령은 마켓 설치본 것이라 없다)
  if (!inst) {
    const got = await readChanges($, null, null, own)
    // 개발자 모드가 꺼졌으면 판 표시를 공개판처럼(UpdateState.devOff) — 공개판엔 스위치가 없어 늘 false
    let devOff = false
    await update($, updateInfo, prev => ({ ...prev, own, updatedTo: null, ...got, phase: 'dev', devOff }))
    $.ui.invalidate('ui.render')
    return
  }
  const seen = await $.store.get(SEEN_VERSION_KEY).catch(() => undefined)
  const updatedTo = own && seen !== own ? own : null
  // 앤트로픽 디렉터리 설치본: 마켓 사본 · claude plugin 명령이 안 맞는다(Claude Code 가 켤 때 계정 동기화로 새 판을 받음 — 공식 문서
  // plugins/loading). 판 · 업데이트 뒤 바뀐 것만
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
      // N8: 켤 때 최신이었어도 그 뒤 사본이 새로워졌으면 새 판으로(패널을 열 때도 이 함수를 부른다). U3: 새 판 · 받음인데 지금 판이 따라왔으면 최신
      phase: (was === 'done' || was === 'newer') && !isAhead ? 'latest' : (was === 'idle' || was === 'latest') && isAhead ? 'newer' : was,
    }
  })
  $.ui.invalidate('ui.render')
}

/**
 * U4(0.6.1 피드백 "업데이트 확인을 위쪽 버튼으로, 누르면 내역 — 늘 내용이 보이면 불편"): 탭 줄 오른쪽 버튼이 서랍을 여닫는다. 열 때 받아
 * 둔 사본을 다시 읽는다(통신 없음). 닫으면(버튼 · 탭 바꾸기 · 패널 닫기 — U3 "탭을 닫고 열거나 설정에 다녀오면 사라지게") 업데이트 뒤 첫
 * 실행의 바뀐 것은 본 판으로 — 버튼이 평소 꼴로 돌아온다(이번 서랍엔 그 범위 그대로)
 */
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
  // 오류 원문 펼침도 처음대로 · 서랍 안 진단 카드도 닫는다
  await update($, updateInfo, prev => ({ ...prev, open: {} }))
  if ((await read($, diagCard)).where === 'drawer') {
    await update($, diagCard, prev => ({ ...prev, open: false, copiedLines: null, savedPath: null }))
    diagSnap = null
  }
  $.ui.invalidate('ui.render')
}

/** 서랍 안 펼침: 오류 원문(명령 출력) */
async function toggleUpdateOpen($: EngineInterface, key: 'changes' | 'error' | 'note'): Promise<void> {
  await update($, updateInfo, prev => ({ ...prev, open: { ...prev.open, [key]: !prev.open?.[key] } }))
  $.ui.invalidate('ui.render')
}

/**
 * Claude Code 실행 파일 후보: PATH 의 claude(CLI 를 깐 사람), 그다음 데스크톱 앱이 품은 엔진 <앱 폴더>/claude-code/<판>/<빌드>/claude(.exe)
 * — 판이 높은 것부터. mod 엔 엔진 경로를 주는 값이 없다(CLAUDE_CODE_EXECPATH 는 mod 에서 안 보였다 — 2026-10-14 실험)
 */
async function claudeCandidates($: EngineInterface): Promise<string[]> {
  const out = ['claude']
  const appDirs: string[] = []
  // env 이름은 글자 그대로(엔진 규칙 — 변수로 넘기면 모듈이 안 불린다)
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
              // 없음
            }
          }
        }
      }
    } catch {
      // 그 앱 폴더 없음
    }
  }
  return out
}

/**
 * claude 명령을 띄울 수 있는 첫 후보로 — 못 띄우면 null. 출력은 마지막 글 줄(성공 · 실패 까닭). 돌리는 명령은 둘뿐이라 글자 그대로
 * 적는다(디렉터리 검사가 명령 전체를 읽게 — 0.6.1 보류 "명령을 다 못 읽음"): 마켓 받아 오기 · 플러그인 업데이트. 마켓 이름은 공개
 * 마켓(marketplace.json name) easy-compact — 실행 파일 자리(bin)만 PC 마다 다르다.
 * totalMs = 후보 모두 합친 시간. 띄운 뒤 시간이 다 돼 끊긴 것(응답 없음)은 다음 후보로 또 돌리지 않는다 — 예전엔 못 띄운 것과 같이 보고
 * 후보마다 시간을 다 써 몇 분 동안 "확인 중"
 */
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
      // 시간이 다 돼 끊김(띄우긴 했다) — 멈춘다. 그 밖(없는 경로 · 못 띄움)은 다음 후보
      if ((await $.clock.now()) - t0 >= timeoutMs - 1000) return { exitCode: -1, last: '', isTimeout: true }
    }
  }
  return null
}

/**
 * 다음 버전(0.9.1 뒤, 사용자 2026-10-16 "업데이트 확인 중 연타하거나 확인하고 바로 하면 응답 없을 때 그 상태로 고정"): 지금 도는 업데이트
 * 일 — 이 모듈에 하나만. 누르자마자(첫 await 전에) 자리를 잡는다: 예전엔 설치본 읽기(await) 뒤에 "도는 중" 을 봐서 빨리 여러 번 누르면
 * 마켓 받기 명령이 여럿 같이 돌았다(같은 마켓 사본을 바꿔 서로 막힘). 화면의 확인 중 · 업데이트 중(updateInfo.phase)은 다시 불러와도
 * 남는 값이라, 일하던 모듈이 없어지면(다시 불러오기) 그대로 고정됐다 — 이 값이 없으면 그 표시는 낡은 것으로 본다(refreshUpdateInfo)
 */
let updateJob: { kind: 'check' | 'apply'; at: number } | null = null


/** 끝을 못 알린 업데이트 일은 버린다 — 시간이 넘었으면 다시 누를 수 있게 */
async function dropStaleUpdateJob($: EngineInterface): Promise<void> {
  // at 0 = 막 잡아 시각을 아직 못 적음(누른 직후) — 낡은 일이 아니다
  if (updateJob === null || updateJob.at === 0) return
  const limit = (updateJob.kind === 'check' ? CHECK_TOTAL_MS : APPLY_TOTAL_MS) + UPDATE_GRACE_MS
  if ((await $.clock.now()) - updateJob.at > limit) updateJob = null
}

/** [업데이트 확인]: 누를 때만 Claude Code 가 마켓을 받아 온다 — 그 뒤 받은 사본 판과 견준다. 도는 중에 또 누른 것은 무시. U2(0.6.1 피드백):
 * 받은 뒤(done)에도 다시 확인할 수 있다 */
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
    // 시간이 넘어 버린 일(그 사이 다시 누른 일이 있다)은 결과를 안 적는다
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
      // 못 띄웠으면(claude 없음) 원문 없이 — 화면이 "claude 명령을 못 찾았습니다" 로 가린다
      error: isFailed && r ? (r.isTimeout ? L(`${CHECK_TOTAL_MS / 1000}초 안에 끝나지 않음`, `did not finish in ${CHECK_TOTAL_MS / 1000}s`) : r.last || `exit ${r.exitCode}`) : undefined,
      failedOn: isFailed ? 'check' : undefined,
      isTimeout: isFailed && r?.isTimeout === true ? true : undefined,
    }))
    $.ui.invalidate('ui.render')
  } finally {
    if (updateJob === job) updateJob = null
  }
}

/** [업데이트]: 받아 둔 사본 판으로 — 엔진이 새 판 폴더를 읽어 들이면 적용(U3 — 그 뒤 켤 때 · 패널을 열 때 지금 판이 따라오면 최신) */
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
      // 못 띄웠으면(claude 없음) 원문 없이 — 화면이 "claude 명령을 못 찾았습니다" 로 가린다
      error: isFailed && r ? (r.isTimeout ? L(`${APPLY_TOTAL_MS / 1000}초 안에 끝나지 않음`, `did not finish in ${APPLY_TOTAL_MS / 1000}s`) : r.last || `exit ${r.exitCode}`) : undefined,
      failedOn: isFailed ? 'apply' : undefined,
      isTimeout: isFailed && r?.isTimeout === true ? true : undefined,
    }))
    $.ui.invalidate('ui.render')
  } finally {
    if (updateJob === job) updateJob = null
  }
}

// ── 오늘 · 이번 달 사용량(설정 "모든 화면 공통" 에서 켰을 때만, 입력창 위에 일일 · 이번 달 전체 사용량을 옵션으로) ──

let spendRunning = false
let spendFailAt = 0
let spendFailWhy = ''

/**
 * 오늘 · 이번 달을 잴 때인가 — 바 옵션을 켰거나, 사용량 패널이 열려 있고 자세히 보기일 때(자세히 패널은 옵션과 무관하게 "모든 세션"
 * 줄을 보인다 — 0.5.1). 옵션을 껐고 패널 자세히도 안 보는 동안엔 다른 세션 기록을 읽지 않는다
 */
async function wantsSpend($: EngineInterface, s: Settings): Promise<boolean> {
  const sp = spendOf(s)
  if (sp.today || sp.month) return true
  return (await read($, paneView)) !== null && (await paneModeNow($)) === 'detail'
}

/**
 * 오늘 · 이번 달 사용량을 잰다: tools/scan-spend.mjs(node)가 이 PC 의 모든 세션 기록(하위 에이전트 포함)의 요청 토큰을 날짜 · 모델별로
 * 합하고(파일마다 크기 · 시각 캐시 — 처음 켤 때만 이번 달 기록을 다 읽는다, 이 PC 1.4GB 4초), 값은 공식 요율표로 센다(cost.ts
 * spendUsd). 엔진 값(session.usage)은 이 세션 것뿐이라 다른 세션 · 이번 달 합을 줄 수 없다(d.ts 확인). minGapMs 안에 쟀으면 건너뛰고,
 * 잴 때가 아니면(wantsSpend) 안 돈다 — isWanted 는 패널이 지금 "모든 세션" 줄을 그리려는 때. 네트워크 없음 — 이 PC 파일만 읽는다
 */
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
      // 넷째 = mod 데이터 폴더: 대화 기록에 없는 요청(컴팩트 · 앱 자체 요청 — 장부 extra/ · 질문 기록 turns/)을 extra 로(M1)
      ['node', `${$.plugin.root}/tools/scan-spend.mjs`, `${await claudeHome($)}/projects`, `${await dataDir($)}/spend-cache.json`, String(monthStartMs(nowMs)), await dataDir($)],
      { timeoutMs: 180_000 },
    )
    if (ran.exitCode !== 0) throw new Error(`exit ${ran.exitCode}`)
    const out = JSON.parse(String(ran.stdout ?? '')) as { days?: SpendDays; extra?: Record<string, number>; retro?: RetroCompacts; calib?: CompactCalib }
    if (!out.days) throw new Error('no days in output')
    const today = spendDay(nowMs)
    const first = `${today.slice(0, 8)}01`
    // M2: 잰 값이 없는 컴팩트(장부 전 · 질문 기록 60개 밖) 어림 — 입력 몫은 이 PC 에서 잰 것(없으면 전부 캐시 읽기), 요약 출력은 잰 컴팩트에서
    // 거꾸로 구한 가운데 값(없으면 마지막 컴팩트 출력 · 가정)
    const mix = (await storedMixOrNull($)) ?? WARM_COMPACT
    const outTokens = compactOutputOf(out.calib, mix, (await storedCount($, OUTPUT_KEY)) ?? OUTPUT_GUESS)
    // 0.9.0: 어림은 오늘 · 이번 달 합계에 더하지 않고 따로 보이기만 — 회사 PC 대조 전(정본 M2 규칙 "차이 ≤ $5 → 따로": 아는 차이 $4.75 <
    // 그 PC 어림 $11.41 이라 더하면 설정 화면보다 높아질 수 있다). 대조 뒤 맞으면 다시 더한다
    const retroMonth = retroUsd(out.retro, first, today, mix, outTokens)
    // 0.9.3: 요율이 바뀐 판으로 이 PC 가 처음 요청한 날(패널 요율 줄 "이 PC 는 10월 16일") — 이번 달 기록에 옛 판 · 새 판이 다 있을 때만
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
    // node 가 없거나 기록을 못 읽음 — 바 칸은 비워 두고("~" 값을 지어내지 않는다) 패널 "모든 세션" 줄엔 못 잼 · 까닭
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
  // 업데이트 바뀐 것(CHANGELOG)은 읽을 때 언어로 담아 둔다 — 언어를 바꾸면 다시 읽는다(L1: 영어로 바꿔도 한글 바뀐 것이 남았다)
  void refreshUpdateInfo($).catch(() => {})
}

/** 설정 탭 언어 줄(개발본은 명령 lang 도) — 저장하고 바로 바꾼다(자동이면 다시 감지) */
async function saveLang($: EngineInterface, choice: Settings['lang']): Promise<void> {
  await saveSettings($, { ...(await currentSettings($)), lang: choice })
  langCheckedAt = Number.NEGATIVE_INFINITY
  await ensureLang($)
  $.ui.invalidate('ui.render')
}

/** 패널 제목을 마지막으로 바꾸려 한 값(L1 — 그릴 때 옛 제목이면 한 번만 다시 연다) */
let retitledTo: string | null = null


/** $.store 키: 설정(Settings). 모든 세션이 같이 쓰고 앱을 껐다 켜도 남는다 */
const SETTINGS_KEY = 'settings'

/**
 * 이 PC 의 최근 저장 턴들(SaveTurn[]) — 저장하고 컴팩트는 저장 턴을 먼저 돌린 뒤 컴팩트한다. 그 몫을 컴팩트 값에 넣어야
 * 권장 크기가 실제로 하는 흐름에 맞는다. 한 번마다 요청 1~4회로 들쭉날쭉해 최근 몇 번의 평균으로
 */
const SAVE_KEY = 'saveTurns'

const isConfirmingCompact = atom({ plugin: 'easy-compact', key: 'isConfirmingCompact' } as const, false)
/**
 * 확인 카드의 [클리어]를 눌러 같은 자리가 경고 카드로 바뀜. 확인 카드를 열 때마다 꺼진 채 시작
 */
const isAskingClear = atom({ plugin: 'easy-compact', key: 'isAskingClear' } as const, false)

const paneView = atom({ plugin: 'easy-compact', key: 'paneView' } as const, null)

const localPane = atom({ plugin: 'easy-compact', key: 'localPane' } as const, null)

const live = atom({ plugin: 'easy-compact', key: 'live' } as const, null)
/** 1.0 값 강조 시계(0.2초)가 올리는 수 — 바(AbovePrompt)만 읽어, 강조 동안 그 칸만 다시 그린다 */
const flashTick = atom({ plugin: 'easy-compact', key: 'flashTick' } as const, 0)

const turnSummaries = atom({ plugin: 'easy-compact', key: 'turnSummaries' } as const, [])

/**
 * 질문 기록 한도(TURNS_KEEP) 밖으로 밀린 질문들의 합(1.0 — 사용자 2026-10-18 "세부 내용은 질문 60개만 하고, 따로 총 질문 개수 · 메인 · 에이전트
 * 등 총 표기용 값이 따로 관리돼야"). 예전엔 61번째 질문부터 앞 질문이 합에서도 사라져 "질문 60개 $314 · 누적 $775" 였다
 */
const turnsOlder = atom({ plugin: 'easy-compact', key: 'turnsOlder' } as const, null)

const compactPhase = atom({ plugin: 'easy-compact', key: 'compactPhase' } as const, 'idle')

/** 도는 컴팩트의 이름(compactKindOf) — compactPhase 가 'compacting' 일 때만 읽는다 */
const compactKind = atom({ plugin: 'easy-compact', key: 'compactKind' } as const, '')

const expandedTurn = atom({ plugin: 'easy-compact', key: 'expandedTurn' } as const, null)

const answerOpen = atom({ plugin: 'easy-compact', key: 'answerOpen' } as const, [])
/** 질문별 비용 [글 다 보기] 로 편 질문들(1.0 시안 1017o 안 3) */
const stepsFull = atom({ plugin: 'easy-compact', key: 'stepsFull' } as const, [])

const previewOpen = atom({ plugin: 'easy-compact', key: 'previewOpen' } as const, false)

const historyAll = atom({ plugin: 'easy-compact', key: 'historyAll' } as const, false)

const effectsAll = atom({ plugin: 'easy-compact', key: 'effectsAll' } as const, false)

const flowAll = atom({ plugin: 'easy-compact', key: 'flowAll' } as const, false)

const settings = atom({ plugin: 'easy-compact', key: 'settings' } as const, null)

const usageTab = atom({ plugin: 'easy-compact', key: 'usageTab' } as const, 'main')

const tidyRawOpen = atom({ plugin: 'easy-compact', key: 'tidyRawOpen' } as const, false)

const settingsOpen = atom({ plugin: 'easy-compact', key: 'settingsOpen' } as const, SETTINGS_OPEN_DEFAULT)
/** 설정 안 탭(S10, 0.8.1) — 패널을 닫았다 열면 처음(바)으로, 설정 펼침과 같이 */
const settingsTab = atom({ plugin: 'easy-compact', key: 'settingsTab' } as const, 'bar' as SettingsTab)

const diagCard = atom({ plugin: 'easy-compact', key: 'diagCard' } as const, DIAG_CLOSED)

/** 카드에 보인 덤프 사본 — 연 때 · 빼기를 바꿀 때 한 번 만든다(그리기마다 만들면 무겁고, 본 것과 복사한 것이 달라질 수 있다) */
let diagSnap: { text: string; head: string; lines: number; turns: number; counts: DiagCounts; samples: string[] } | null = null

const cardsOpen = atom({ plugin: 'easy-compact', key: 'cardsOpen' } as const, CARDS_OPEN_DEFAULT)

const spend = atom({ plugin: 'easy-compact', key: 'spend' } as const, null)

const spendFailed = atom({ plugin: 'easy-compact', key: 'spendFailed' } as const, false)

const updateInfo = atom({ plugin: 'easy-compact', key: 'update' } as const, UPDATE_IDLE)

/** U4: 탭 줄 업데이트 버튼의 서랍이 열렸나(이 세션 — 탭을 바꾸거나 패널을 닫으면 닫힌다) */
const updDrawer = atom({ plugin: 'easy-compact', key: 'updDrawer' } as const, false)

const tidyDraft = atom({ plugin: 'easy-compact', key: 'tidyDraft' } as const, null)

const compactDraft = atom({ plugin: 'easy-compact', key: 'compactDraft' } as const, null)

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

/** 1.0 요약 카드(입력창 위 — 게이지 · 슬림 아래 버튼으로 엶)가 열려 있나 — 이 세션만 */
const summaryCard = atom({ plugin: 'easy-compact', key: 'summaryCard' } as const, false)

/** 이지 오토(이 세션 — auto.ts). null = 아직 안 읽음(session.start 의 loadAuto 가 채운다) */
const auto = atom({ plugin: 'easy-compact', key: 'auto' } as const, null)

/**
 * 진단 한 줄 — 엔진 디버그 로그에만(to: 'debug'). 기본(transcript)은 대화창에 시스템 안내 줄로 찍혀, 회사 PC 대화창에 "easy-compact:
 * compact the hook did not see — engine context went empty after 309069" 가 그대로 보였다. 사람이 볼 일은
 * 패널 글(못 잼 · 까닭 등)이 맡는다
 */
function log($: EngineInterface, text: string): void {
  try {
    $.ui.log(`easy-compact: ${text}`, { to: 'debug' })
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

/**
 * 한도를 세션끼리 나눠 쓴다:
 * 데이터 폴더 limits.json 과 견줘 더 최근 응답 것을 쓰고(state.ts freshestLimits — 리셋 지난 창은 뺌), 이 세션 것이 더 최근이면 파일에 쓴다.
 * ownAt = 이 세션 한도를 준 응답 시각(모르면 null — 파일 쪽을 믿는다)
 */
async function shareLimits($: EngineInterface, own: Usage['rateLimits'], ownAt: number | null): Promise<Usage['rateLimits']> {
  const file = `${await dataDir($)}/${LIMITS_FILE}`
  const pick = freshestLimits(own, ownAt, parseSharedLimits(await readJsonFile($, file)), await $.clock.now())
  if (pick.isOwn && ownAt !== null) await $.fs.write(file, `${JSON.stringify({ at: ownAt, rateLimits: own })}\n`).catch(() => {})
  return pick.rateLimits
}

// ── 캐시 유지 시간: 기록에서 잰다(단정하지 않는다), 못 쟀을 때만 설정 · 문서 기본값 ──────────
//
// 엔진은 요청마다 유지 시간을 정한다(공식 문서 prompt-caching "Which TTL each request gets"): 메인 대화 = 구독 요금제 사용량 안
// 1시간, 사용량 초과 · API 키 · 클라우드 5분, promptCacheTtl 설정 · 환경 변수로 바뀐다. 엔진이 플러그인에 주는 요청 사용량엔
// 종류가 없고(모델 전환 훅에만 cache_ttl), 기록의 usage.cache_creation 에 ephemeral_5m · 1h 로 남는다 — 그래서 턴 끝마다 기록
// 끝부분을 읽는다. 사용량 초과를 한도 % 로 짐작하지 않는다 — 바뀌면 다음 요청 기록에 보인다

/** 기록의 마지막 메인 요청이 쓴 캐시 종류(분). 작은 기록은 바로 읽고, 큰 기록은 tools/last-ttl.mjs(node)로 끝 2 MiB 만. 못 재면 null */
// N6: 큰 기록을 재는 node(last-ttl.mjs)가 실패하면 10분 동안 안 띄운다 — 턴마다 node 를 띄우고 실패했다. 그동안은 앞서 잰 값
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

/** 재고 남긴다 — 못 쟀으면 앞서 잰 값 그대로 */
async function refreshTtl($: EngineInterface): Promise<void> {
  const v = await measureTtl($)
  if (v !== null) await update($, ttlMeasured, () => v)
}

/**
 * 유지 시간을 무엇이 정하나(설정 탭 · 못 쟀을 때의 짐작). 엔진 순서 그대로: FORCE_PROMPT_CACHING_5M → CLAUDE_CODE_PROMPT_CACHE_TTL →
 * 설정 promptCacheTtl(합친 설정) → ENABLE_PROMPT_CACHING_1H → 자동. 읽기만 — 바꾸는 기능은 뺐다(0.6.1 피드백: 사용자 "의도 아니었음",
 * 디렉터리 검토 보류 "설정 파일 쓰기")
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
  try {
    merged = (await $.settings.read()).promptCacheTtl
  } catch {
    // 설정을 못 읽는 곳(시험 등) — 자동으로 본다
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


// ── 컨텍스트 흐름: 기록 파일에서 한 번 읽고, 그 뒤엔 요청 · 컴팩트마다 잇는다 ──────────

async function readFlow($: EngineInterface): Promise<Flow> {
  return { points: await read($, flowPoints), compactions: await read($, compactions), questions: await read($, flowQuestions), shared: await read($, flowShared) }
}

// ── 질문별 비용 기록 파일(N3, 0.6.0) — 세션마다 <데이터>/turns/<세션>.json. 다시 연 세션에서 읽고, 없으면(이 판 전 세션)
// 대화 기록에서 다시 만든다. 0.5.1 까지는 엔진 메모리에만 있어 앱을 다시 켜면 비었다

async function turnsFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/turns/${await $.session.id()}.json`
}

/** 지금 질문 기록(+ 밀린 질문 합)을 파일로(기다리지 않는다 — 쓰기가 실패해도 다음 바뀜에 다시) */
function saveTurns($: EngineInterface): void {
  void (async () => $.fs.write(await turnsFile($), serializeTurns(await read($, turnSummaries), await read($, turnsOlder))))().catch(() => {})
}



/** 질문 기록을 바꾸고 파일에도 남긴다 — 한도(TURNS_KEEP)를 넘은 앞 질문은 밀린 질문 합으로(모르던 합이면 지금 밀린 것부터) */
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

/** 밀린 질문 합을 모르는 1.0 전 기록(파일에 그 칸이 없는데 한도까지 참) — 켤 때 정하고 fillOlder 가 대화 기록에서 채운다 */
let isOlderUnknown = false

/** 이번에 켤 때 질문 목록을 대화 기록에서 새로 만들었다(자기 세션 줄만 — 갈라 온 세션도 바로잡을 게 없다, keepOwnTurns) */
let isTurnsFresh = false

/**
 * 세션 시작(다시 불러오기 포함): 이 프로세스에 기록이 있으면 파일만 맞추고, 없으면 파일에서 읽는다. 파일이 없거나 판이 다르면
 * 대화 기록에서 다시 만들어(rebuilt — "기록에서 다시 만듦") 파일로 남긴다(한도 밖은 밀린 질문 합으로). 기록 파일이 아직 없는 새 세션은 빈 목록
 */
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
    // mod 만 다시 불러옴 — 목록은 메모리 것, 밀린 질문 합은 메모리 → 파일 → 모름
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
    // 한도를 넘으면 밀린 합은 fillOlder 가 세션 누적과 견준 뒤 정한다(기록에서 다시 만든 어림이 누적을 넘으면 버린다)
    older = all.length > TURNS_KEEP ? null : NO_OLDER
  }
  // 그 사이 질문이 끝나 목록이 생겼으면 덮지 않는다
  if ((await read($, turnSummaries)).length > 0) return
  await update($, turnSummaries, () => list)
  await update($, turnsOlder, () => older)
  isOlderUnknown = older === null
  if (!saved || (fileOlder === null && older !== null)) saveTurns($)
  await syncCompactSteps($)
  $.ui.invalidate('ui.render')
}

/**
 * 1.0 전 기록이 한도(60개)까지 찬 세션: 밀린 질문의 합을 몰라 질문 합계가 세션 누적보다 한참 작았다. 대화 기록에서 다시 만든 질문 중 남긴 목록 첫 줄 앞 것을 밀린 합으로 어림한다(rebuilt — 앱 자체 요청 · 컴팩트 값은 기록에
 * 없어 빠진다). 어림이 세션 누적을 넘으면 버리고 밀린 것 없음으로(차이는 비용 요약의 "질문 밖" 줄이 말한다 — 1.0 전엔 갈라 온 세션 기록의 부모 줄까지
 * 세어 넘었다: 2026-10-18 이 PC 기록 $633 · 누적 $340, 지금 rebuildTurns 는 자기 줄만). 세션 누적과 견주려고 세션 금액(loadCostBase) 뒤에 돈다
 */
async function fillOlder($: EngineInterface): Promise<void> {
  if (!isOlderUnknown) return
  isOlderUnknown = false
  const all = await rebuildTurns($).catch(() => null)
  const engine = await ledgerUsd($)
  const kept = await read($, turnSummaries)
  // 세션 누적을 못 재면 정하지 않는다(파일에 칸이 없으니 다음에 켤 때 다시)
  if (engine === null) return
  const est = all ? olderFromRebuilt(all, kept) : null
  const cum = (costBase ?? 0) + engine
  const keptUsd = kept.reduce((sum, t) => sum + t.cost.usd, 0)
  // 요율 어긋남(기록은 날짜 · 판 요율, 엔진은 제 셈)만큼은 넘어도 받는다 — 3% · $0.50
  const isFit = est !== null && keptUsd + est.usd <= cum + Math.max(0.5, cum * 0.03)
  await update($, turnsOlder, o => (isFit ? est : (o ?? NO_OLDER)))
  saveTurns($)
  $.ui.invalidate('ui.render')
}

/**
 * 이 판 전 세션: 대화 기록(작으면 바로, 크면 scan-transcript.mjs) + 하위 에이전트 기록(4 MiB 아래 파일만)으로 질문별 비용을 다시 만든다. 이 세션 줄만 —
 * 갈라 온 세션 기록 앞부분 · 하위 에이전트 폴더의 부모 줄 복사본은 부모 몫
 */
async function rebuildTurns($: EngineInterface): Promise<TurnSummary[]> {
  const path = await transcriptPath($)
  const own = await $.session.id()
  let size: number
  try {
    size = (await $.fs.stat(path)).size
  } catch {
    return [] // 기록이 아직 없는 새 세션
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
    entries = [] // 하위 에이전트를 안 쓴 세션
  }
  for (const e of entries) {
    if (e.kind !== 'file' || !e.name.endsWith('.jsonl') || e.size > READ_LIMIT) continue
    try {
      const run = agentRunFromText(e.name.replace(/\.jsonl$/, ''), await $.fs.read(`${dir}/${e.name}`), own)
      if (run) runs.push(run)
    } catch {
      // 못 읽은 갈래는 뺀다
    }
  }
  return turnsFromRecords(records, runs)
}

// ── 세션 금액(B3, 0.6.1 피드백 — 사용자 2026-10-15 "앱을 껐다 켜면 바의 세션 금액이 처음부터"): 엔진 세션 비용은 프로세스마다 0 부터라
// 앞 프로세스까지 몫(base)을 세션 파일 <데이터>/cost/<세션>.json 에 {v, base, engine} 로 남기고, 바 · 패널 금액 = base + 지금 엔진 값.
// v2(1.0, 사용자 2026-10-18 "포크 세션은 자기 비용만 보이는 게 맞지 않아?") = 기록을 한 번 훑어 갈라 온 세션인지 본 파일 — 갈라 온 세션은 엔진
// 장부에 든 부모 몫을 base 에서 뺀다(그래서 base 가 음수일 수 있다). 엔진이 세션을 열 때 기록의 비용 상태 줄로 되살린 몫도 다시 더하지 않는다

/** 앞 프로세스까지의 세션 금액 — 켤 때 정한다(못 정했으면 null — 엔진 값만) */
let costBase: number | null = null

/** 마지막으로 파일에 남긴 엔진 값(같으면 다시 안 쓴다) */
let costSavedEngine = -1

/** 기록을 훑어 갈라 온 세션인지 봤다(파일 v2). 못 훑었으면(기록 없음 · node 없음) v1 로 남겨 다음에 켤 때 다시 */
let isCostChecked = false

async function costFile($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/cost/${await $.session.id()}.json`
}

/** 이어 온 몫과 지금 엔진 값을 남긴다(기다리지 않는다 — 실패하면 다음 재기에 다시) */
function saveCost($: EngineInterface, engine: number): void {
  if (costBase === null || engine === costSavedEngine) return
  costSavedEngine = engine
  const body = JSON.stringify({ v: isCostChecked ? 2 : 1, base: costBase, engine })
  void (async () => $.fs.write(await costFile($), body))().catch(() => {
    costSavedEngine = -1
  })
}

/** 기록의 세션 금액 단서(flow.ts costScanOf — 큰 기록은 scan-transcript.mjs --costs). 기록이 아직 없거나 못 읽으면 null */
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

/**
 * 갈라 온 세션: 1.0 전엔 질문 목록을 기록에서 다시 만들며(rebuilt) 부모 줄까지 셌다 — 부모 질문이 다 들고, 갈라 올 때 돌던 부모 질문은 부모 요청까지
 * 한 줄에 셌다(2026-10-18 이 PC 포크: 그 줄 $2.60 중 자기 몫 $0). 그 줄들이 덮던 때까지는 자기 줄로 다시 만든 것으로 바꾸고, 앱이 잰 줄(그 뒤 질문)은 둔다
 */
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

/**
 * 켤 때(질문 기록을 읽은 뒤): 남긴 파일이 있으면 — 지금 엔진 값이 남긴 엔진 값보다 작으면 새 프로세스(앱을 다시 켬)라 앞 프로세스 몫까지 이어 온
 * 몫에 더하고(엔진이 기록의 비용 상태 줄로 되살린 몫은 지금 엔진 값에 이미 들었으니 뺀다 — 2026-10-18 이 세션 기록엔 10-15 의 $280.95 줄 하나라
 * 다시 열 때마다 그 값부터 센다), 같거나 크면 같은 프로세스(mod 만 다시 불러옴 · 엔진이 마지막 장부를 되살림)라 그대로. 파일이 없으면(이 판 전 세션)
 * 질문별 비용 합에서 이번 프로세스가 이미 센 몫(엔진 값)을 뺀 것 — 업데이트가 바로 적용돼 프로세스가 그대로일 때도 겹치지 않게. 갈라 온 세션은
 * 처음 한 번(파일이 없거나 v1) 질문을 자기 것만 남기고 엔진 값에 든 부모 몫을 뺀다 — 세션 금액 = 자기 몫
 */
async function loadCostBase($: EngineInterface): Promise<void> {
  const engine = (await ledgerUsd($)) ?? 0
  let saved: { v: number; base: number; engine: number } | null = null
  try {
    const j = JSON.parse(await $.fs.read(await costFile($))) as { v?: unknown; base?: unknown; engine?: unknown }
    if ((j.v === 1 || j.v === 2) && typeof j.base === 'number' && typeof j.engine === 'number') saved = { v: j.v, base: j.base, engine: j.engine }
  } catch {
    saved = null // 이 판 전 세션 · 새 세션
  }
  const isNew = saved !== null && engine + 1e-9 < saved.engine
  // 기록은 갈라 온 세션인지 아직 안 본 파일(없음 · v1)이거나, 새 프로세스의 엔진이 무언가 되살렸을 때(엔진 값이 0 이 아님)만 훑는다
  const scan = saved?.v === 2 && !(isNew && engine > 1e-9) ? null : await costScan($)
  isCostChecked = saved?.v === 2 || scan !== null
  if (saved && (saved.v === 2 || !scan?.isFork)) costBase = isNew ? saved.base + saved.engine - restoredOf(scan?.states ?? [], engine) : saved.base
  else {
    let inherited = 0
    if (scan?.isFork) {
      if (!isTurnsFresh) await keepOwnTurns($)
      // 그래프도 한 번 자기 줄로 다시 읽는다(1.0 전 판이 부모 대화까지 읽어 둔 흐름 파일 — 잰 컴팩트 값은 옮긴다)
      void loadFlow($, { fromTranscript: true }).catch(() => {})
      // 엔진 장부에 부모 몫이 들었나 — 갈라 온 뒤 첫 프로세스(되살린 값 = 부모 비용 상태)거나 그 값부터 센 자기 비용 상태를 되살렸다
      if (restoredOf(scan.states, engine) >= scan.inherited - 1e-6) inherited = scan.inherited
    }
    const asked = (await read($, turnSummaries)).reduce((sum, t) => sum + t.cost.usd, 0) + ((await read($, turnsOlder))?.usd ?? 0)
    costBase = Math.max(0, asked - (engine - inherited)) - inherited
  }
  saveCost($, engine)
}

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

/**
 * 기록 파일에서 흐름을 처음부터. 기록이 아직 없으면(첫 질문 전) 빈 흐름. 이 세션 줄만 — 갈라 온(포크) 세션 그래프는 자기 요청만 그린다
 */
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
    // 띄우지도 못함 — 대개 node 가 없거나 앱이 못 찾는다(맥 앱을 Dock 에서 켜면 셸 프로필의 PATH 만 읽는다). 깔면 된다고 알린다
    throw new Error(L(`기록이 ${mb}MB 라 node 가 있어야 앞 구간을 읽습니다. Node.js 14.8 이상을 깔고 앱을 다시 켜세요`, `the transcript is ${mb}MB, so the earlier part needs Node.js 14.8+. Install it and restart the app`))
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
    await syncCompactSteps($)
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
  // N22: 최대 컨텍스트 양 — 구간 목록 · 상한 · 자동 컴팩트 자리가 따른다(앞서 잰 값으로 먼저, 아래에서 새로 읽은 값으로 다시)
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
    // 0.9.1: 훅이 못 본 컴팩트를 먼저 적는다 — 아래 흐름이 그 컴팩트를 보고 컴팩트 전 크기를 안 띄운다
    await catchMissedCompact($, measured.context.tokens, measured.startedAt).catch(err => log($, `missed compact check failed — ${String(err)}`))
    const prev = await read($, usage)
    // 컨텍스트 크기는 우리가 잰 마지막 메인 요청 값(흐름의 마지막 점)이 기준 — 띠 · 패널 · 그래프 · 질문별 비용이
    // 같은 값을 보인다. 흐름이 비었으면(기록을 못 읽음 · 첫 요청 전) 엔진 값.
    // 컴팩트 직후 · 첫 요청 전엔 엔진 값이 마지막 응답 기준이라 컴팩트 전 크기 그대로다(띠가 "권장 54%" 를 띄웠다) —
    // 그 동안은 추정값(계산식 재료의 직후 크기 — 엔진이 준 남긴 대화 + 기본 적재, flow.ts afterGuess). 엔진 값이 이미 줄어 있으면(컴팩트
    // 전의 8할 아래) 그것을 믿는다. 엔진 값이 0 이어도(다시 연 세션의 컴팩트 직후 — 띠가 "컨텍스트 0" 이었다) 추정값.
    // 0.6.1: 엔진이 직후 크기를 준 컴팩트는 pendingCompact 가 안 잡아, 이 동안 흐름의 마지막 점(컴팩트 전 크기)을 썼다 — 방금
    // 저장하고 컴팩트했는데 띠가 "컨텍스트 255k · 컴팩트 늦어짐" 이었고 다음 요청에야 돌아왔다. 이제 직후는 첫
    // 요청만 적어(2026-10-19) 그 컴팩트도 pendingCompact 가 잡는다 — since.after 는 그 전 판이 남긴 흐름 대비
    const flow = await readFlow($)
    const since = compactSince(flow)
    const pending = pendingCompact(flow)
    const engineTokens = measured.context.tokens ?? 0
    const lastCtx = flow.points[flow.points.length - 1]?.ctx ?? null
    const isStale = pending !== null && pending.before > 0 && (engineTokens <= 0 || engineTokens >= pending.before * 0.8)
    // 추정값은 계산식 재료와 같은 직후 크기 — 막 읽은 흐름으로 바로 잰다(걸어 둔 최적은 이 함수 끝에서야 갱신된다)
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
    // 엔진 자동 컴팩트 기준값(분해를 잴 때만) — 이지 오토 구간은 그보다 앞만 고른다
    if (opts.categories && measured.context.breakdown) setEngineAuto(measured.context.breakdown.autoCompactThreshold, measured.context.breakdown.isAutoCompactEnabled)
    const categories = opts.categories
      ? (measured.context.breakdown?.categories ?? [])
          .filter(c => !c.isDeferred && c.kind !== 'deferred' && c.tokens > 0)
          .map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind === 'free' || c.kind === 'buffer' ? c.kind : 'used' }))
      : (prev?.categories ?? [])
    // 세션 금액 = 앞 프로세스까지 이어 온 몫 + 이번 프로세스 엔진 값(B3 — 엔진 값만이면 앱을 다시 켤 때 0 부터였다)
    const engineCost = measured.cost?.usd ?? null
    const costUsd = engineCost === null ? null : (costBase ?? 0) + engineCost
    if (engineCost !== null) saveCost($, engineCost)
    const model = await $.session.model()
    // 캐시 유지 시간: 기록에서 잰 값, 없으면 설정 · 문서 기본값으로 짐작(화면에 "추정")
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
      // 모델이 바뀐 상태는 followModel 이 정한다(턴 끝에 다시 재도 지우지 않는다)
      switchedFrom: prev?.switchedFrom ?? null,
      costUsd,
      // 한도는 세션끼리 가장 최근 응답 값(shareLimits — 이 세션 마지막 요청 시각과 견줌)
      rateLimits: await shareLimits(
        $,
        measured.rateLimits.map(r => (r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed })),
        lastAt,
      ),
      categories,
      // 캐시 타이머는 컴팩트 뒤 첫 요청 전에도 컴팩트 시각부터 — 컴팩트 요청이 시스템 · 도구 앞부분 캐시를 읽어(실측 98.6%) 시간이
      // 새로 시작된다. 0.3.1 은 그 동안 "캐시 없음(다음 요청이 새로 씀)" 을 띄웠는데 뜻을 모르겠고 필요 없다 — 늘 남은 시간(얼리버드)
      lastActivityMs: lastAt,
      isAfterCompact: since !== null,
      history: opts.pushHistory ? [...(prev?.history ?? []), tokens].slice(-12) : (prev?.history ?? []),
      sharedTokens: sharedFor(flow, model),
      perCallExtraUsd: extraPerCall(flow, model),
      cacheTtlMin,
      cacheTtlMeasured: measuredTtl !== null,
    }
    await update($, usage, () => nowUsage)
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

async function notePane($: EngineInterface, what: string): Promise<void> {
  let at = ''
  try {
    at = new Date(await $.clock.now()).toISOString().slice(11, 23)
  } catch {
    // 시계가 없는 곳 — 시각 없이
  }
  paneLog.push(`${at} ${what}`)
  if (paneLog.length > 50) paneLog.splice(0, paneLog.length - 50)
}

async function setWantedView($: EngineInterface, view: PaneView | null): Promise<void> {
  const prev = await read($, localPane)
  await update($, localPane, () => view)
  if (prev !== view) {
    await notePane($, `want ${prev ?? '-'} → ${view ?? '-'}`)
    // 아래 버튼의 ▸(현황 패널 열림)가 따라오게 — 사람이 패널 ✕ 로 닫을 때도
    $.ui.invalidate('ui.render')
  }
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
  await notePane($, `follow ${raw.view ?? '-'} from ${String(raw.from ?? '?').slice(0, 8)}`)
}

/**
 * 엔진 판이 MIN_ENGINE 보다 낮으면 그 판(예 "2.1.287") — 바 · 패널 대신 업데이트 안내 한 줄을 그린다. 판을 못 읽으면 null(그대로).
 * Homebrew 의 claude-code 는 늦은 stable 채널이라(2026-10-13 stable = 2.1.287) 설치는 돼도 그리기가 깨질 수 있다
 */
let oldEngine: string | null = null

/**
 * 지금 엔진 판(0.9.3 — 회사 PC 의뢰서: 앱 설정 화면은 요청을 보낸 판의 요율표로 센다). 이 세션 요청의 값을 그 판의 요율로 센다 — 못 읽으면
 * null(지금 요율). 모듈 변수라 다시 불러오면 비지만 session.start 가 다시 채운다
 */
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
  await notePane($, 'auto open')
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
      // 다시 열면 늘 사용량 탭부터 — 설정 탭을 보다 닫으면 다음에 설정으로 열렸다. 설정은 패널의 설정 탭으로.
      // 열려 있던 것이 닫힐 때만(열린 적 없는 패널엔 손대지 않는다). 이 세션 보기 값은 지우지만 고른 보기는 기억이 남는다(paneModeChoice, 0.6.0)
      await update($, usageTab, () => 'main')
      await update($, paneModeLocal, () => null)
      // 설정 칸 펼침도 처음대로(화면만) — 패널을 연 채 사용량 ↔ 설정을 오갈 땐 그대로 둔다(고치고 보고 다시 고칠 때 편하게)
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
  // 패널을 열면 "모든 세션" 줄 값을 새로 — 잴 때인지는 wantsSpend(옵션 켬 · 자세히 보기). 기다리지 않는다
  void refreshSpend($).catch(() => {})
  // 패널을 열 때 받아 둔 마켓 사본을 다시 읽는다(N8 — 통신 없음, 설치본만). 켤 때 한 번만 읽어 새 판이 늦게 보였다
  void refreshUpdateInfo($).catch(() => {})
  await $.ui.open({ id: PANE, title: paneTitle() })
  await notePane($, `open ${want}${isOpen ? ' (was open)' : ''}`)
  // 알려진 문제: 띠 버튼으로 패널을 연 뒤 패널 안 첫 클릭은 먹지 않는다(두 번 눌러야 함). 첫 클릭이 키보드
  // 포커스를 띠에서 패널로 옮기는 데 쓰이는 앱 동작으로 본다 — 연 뒤 다시 그리기로는 안 고쳐졌고, 포커스는 사람만 줄 수
  // 있어(open focus · ui.focus 는 띠가 쥐고 있으면 거부, hover 는 플러그인에 안 온다) mod 쪽에선 못 고친다
}

/** 띠 버튼 · usage 명령: 같은 화면이 열려 있으면 닫고, 아니면 그 화면으로 연다. 바뀐 뒤 화면(null = 닫음)을 돌려준다 */
async function toggleView($: EngineInterface, view: PaneView): Promise<PaneView | null> {
  const want = (await wantedView($)) === view ? null : view
  await setWantedView($, want)
  await syncPane($)
  // 보기 자리 하나(1.0): 현황 패널을 열면 입력창 위 요약은 닫는다
  if (want === 'usage' && (await read($, summaryCard))) await closeSummary($)
  return want
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
  if (view === 'usage' && (await read($, summaryCard))) await closeSummary($)
}

// ── 설정: $.store 한 곳, 모든 세션이 타이머로 따라 읽는다 ─────────────────

/** 마지막으로 반영한 설정(JSON). 같으면 다시 그리지 않는다 */
let appliedSettings = ''

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

/** 이 프로세스에서 띄울 안내: false = 없음(이미 봄 · 터미널), isUpdate = ◔ 를 쓰던 사람 */
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
  // 다른 세션이 먼저 띄웠으면 그만
  if (await $.store.get(GAUGE_NOTE_KEY)) return
  await $.store.set(GAUGE_NOTE_KEY, true)
  $.ui.toast(
    note.isUpdate
      ? L('◔ 버튼이 없어졌습니다. 바의 동그라미(게이지)를 누르면 이지 컴팩트 패널이 열립니다', 'The ◔ button is gone. Click the ring (gauge) on the bar to open the Easy Compact pane')
      : L('바의 동그라미(게이지)를 누르면 이지 컴팩트 패널이 열립니다', 'Click the ring (gauge) on the bar to open the Easy Compact pane'),
    { timeoutMs: GAUGE_NOTE_MS },
  )
}

/**
 * 저장된 설정이 없을 때 한 번: 구간 · 화면만 적어 둔다(나머지는 계속 기본값을 따른다) — 업데이트면 쓰던 구간, 새 설치면 새 기본
 * (20만 ~ 25만). 화면은 둘 다 간단(정보가 처음부터 많으면 낯설다)
 */
async function seedSettings($: EngineInterface): Promise<Partial<Settings>> {
  const isUpdate = await usedBefore($)
  const seed: Partial<Settings> = isUpdate
    ? { ...OLD_DEFAULT_RANGE, screen: UPDATE_SCREEN }
    : { rangeStart: DEFAULT_SETTINGS.rangeStart, rangeEnd: DEFAULT_SETTINGS.rangeEnd, screen: NEW_INSTALL_SCREEN }
  try {
    await $.store.set(SETTINGS_KEY, seed)
    // 처음 설치면 지금 판을 본 판으로 — 업데이트 알림(3안)은 전부터 쓰던 사람에게만
    const own = isUpdate ? null : await ownVersion($)
    if (own) await $.store.set(SEEN_VERSION_KEY, own)
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
  let norm = normalizeSettings(raw)
  // 이지 오토 구간을 처음 읽은 때 그때의 컴팩트 구간으로 적어 둔다 — 그 뒤 컴팩트 구간을 바꿔도 따라가지 않게(명세 "처음 값만")
  if (typeof raw === 'object' && raw !== null && typeof (raw as Partial<Settings>).autoStart !== 'number') {
    await $.store.set(SETTINGS_KEY, { ...raw, autoStart: norm.autoStart, autoEnd: norm.autoEnd }).catch(() => {})
  }
  const text = JSON.stringify(norm)
  if (text === appliedSettings) return
  appliedSettings = text
  // 움직임(S1) — 에이전트 캐릭터 · 게이지가 같이 따른다
  setMotion(norm.motion !== 'reduce')
  // 게이지 꼴(B8) — 바 · 패널 머리 · 확인 카드가 같이 따른다
  setGaugeShape(norm.gaugeShape)
  await update($, settings, () => norm)
  await applyThresholds($)
  $.ui.invalidate('ui.render')
}

// ── 컴팩트 권장 크기: 계산식 최적(hooks/optimal.ts) — 지금 세션의 사실 → 이 PC 의 지난 컴팩트 → 가정 순 ─────────────────

/**
 * 기본 적재: 엔진의 /context 분류(세션 시작 때 잼), 없으면 기록의 첫 요청(기록이 세션 처음부터일 때만 — 점이 MAX_POINTS 로 잘렸으면 첫
 * 점은 세션 중간이다). 모르면 null
 */
async function baseLoad($: EngineInterface, flow: Flow): Promise<number | null> {
  const first = (await read($, flowNote)) === null && flow.points.length < MAX_POINTS ? (flow.points[0] ?? null) : null
  return baseOfCategories((await read($, usage))?.categories ?? []) ?? first?.ctx ?? null
}

/**
 * 계산식 재료를 잰다. 컴팩트 직후 크기 = 방금 컴팩트(첫 요청 전)면 남긴 대화 + 기본 적재(flow.ts afterGuess), 아니면 이 세션에서 잰
 * 마지막 컴팩트 직후(지금 모델로 센 값), 아직 없으면 기본 적재 + 이 PC 의 남긴 대화(없으면 요약). 기본 적재는 baseLoad. 요약 · 출력 ·
 * 입력 몫은 이 PC 에서 잰 마지막 컴팩트, 없으면 가정. 요청당 증가는 이 세션 이웃 요청에서(MIN_GROWTH_STEPS 쌍 전엔 가정). 지난
 * 세션들의 기록은 쓰지 않는다
 */
async function measureOptimal($: EngineInterface, model: string): Promise<Optimal> {
  const flow = await readFlow($)
  const first = (await read($, flowNote)) === null ? (flow.points[0] ?? null) : null
  const base = await baseLoad($, flow)
  const measured = flow.compactions.filter(c => c.after !== null)
  const last = measured[measured.length - 1] ?? null
  const pcSummary = await storedCount($, SUMMARY_KEY)
  // 잰 요약(c.summary)은 기록 첫 요청이 없어도 쓴다 — 어림(직후 − 첫 요청)만 첫 요청이 필요하다
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
    // 기본 적재(이 세션) + 남긴 대화(이 PC 에서 잰 마지막 컴팩트의 엔진 값). 그 값이 없으면 요약 — 요약을 가정했으면 직후 크기도
    // 가정으로 보인다. 요약(새로 쓴 몫)은 메모리 · 새 질문 글까지 들어 남긴 대화보다 크다(이 PC 2026-10-18: 48k 대 18k)
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
 * 현황 보기(간단 · 자세히) — 패널 위 버튼 · 명령으로 고른 보기를 기억한다(모든 세션 · 다시 켜도, 0.6.0 — 사용자 "현황에 간단 · 자세히가
 * 따로 있으니 정보량 옵션 고찰"). 화면 종류를 바꾸면 지운다(saveSettings)
 */
async function setPaneMode($: EngineInterface, mode: PaneMode): Promise<void> {
  await update($, paneModeLocal, () => mode)
  // 0.6.0(정보량 옵션 정리 — 사용자 "현황에 간단 · 자세히 버튼이 따로 있으니"): 고른 보기를 기억한다(모든 세션 · 다시 켜도). 화면 종류를 바꾸면 지운다
  await $.store.set(PANE_MODE_KEY, mode).catch(() => {})
  $.ui.invalidate('ui.render')
  // 자세히로 바꾸면 "모든 세션" 줄이 보인다 — 옵션을 껐어도 바로 잰다(타이머를 기다리지 않게)
  if (mode === 'detail') void refreshSpend($, 5_000).catch(() => {})
}

/** 이 세션 패널 보기 — 패널 탭으로 바꿨으면 그 값, 아니면 화면 값 */
async function paneModeNow($: EngineInterface): Promise<PaneMode> {
  const kept = await $.store.get(PANE_MODE_KEY).catch(() => undefined)
  return (await read($, paneModeLocal)) ?? (kept === 'simple' || kept === 'detail' ? kept : paneModeOf(await currentSettings($)))
}

async function saveSettings($: EngineInterface, next: Settings): Promise<void> {
  const prev = await currentSettings($)
  // 화면 종류를 바꾸면 현황 보기는 그 화면의 처음 보기로(기억한 보기를 지운다)
  if (prev.screen !== next.screen) await $.store.set(PANE_MODE_KEY, null).catch(() => {})
  await $.store.set(SETTINGS_KEY, next)
  await loadSettings($)
  await syncStatusLine($)
  // 오늘 · 이번 달을 켰으면 바로 잰다(타이머를 기다리지 않게) — 방금 켠 때는 실패 뒤 쉬는 중이어도 바로(N6)
  const [spNext, spPrev] = [spendOf(next), spendOf(prev)]
  const turnedOn = (spNext.today && !spPrev.today) || (spNext.month && !spPrev.month)
  if (spNext.today || spNext.month) void refreshSpend($, 5_000, false, turnedOn).catch(() => {})
}

/**
 * 패널 맨 위 "모든 세션" 줄(drawAllSpend): 자세히 보기면 옵션과 무관하게 오늘 · 이번 달 둘 다, 간단이면 설정에서 켠 것만 — 안 켰으면
 * 줄 없음(정보 최소). 2026-10-14 사용자 확정 규칙. 아직 못 쟀으면 재는 중, 마지막 재기가 실패했으면 못 잼
 */
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

/** 바 · 미리보기에 보일 오늘 · 이번 달(켠 것만, 못 쟀으면 null — 그 칸을 안 그린다) */
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

/** B10: 지금 입력창 아래에 걸어 둔 한 줄(undefined = 없음) — 같은 글이면 다시 안 건다 */
let statusShown: string | undefined

/**
 * B10(0.9.0): 설정 "입력창 아래 한 줄" — 켜면 바의 요지를 $.ui.status 로 걸고, 끄면 지운다. 사용량 · 설정을 바꾼 뒤와 1.5초 타이머
 * (컴팩트 단계 · 다른 세션에서 바꾼 설정)에서 부른다. 글이 같으면 엔진을 안 부른다
 */
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
 * 0.9.1(회사 PC 0.9.0 — "컴팩트가 다 됐는데 컨텍스트가 컴팩트 전 크기 · 한 번 더 눌러야 맞음", 패널 "컴팩트 0회"): session.compact 훅이
 * 못 적은 컴팩트. 엔진은 우리 $ 호출 아래에서 일어난 이벤트엔 우리 훅을 안 부르고 .catch 만 부른다(재진입 — HookFailure 're-entry',
 * 그때 $ 는 거절). 그래서 .catch 는 결과만 받아 두고 다음 재기(refreshUsage)가 적는다
 */
let missedCompact: { trigger: string; result: CompactResultLike } | null = null
/** 이번 컴팩트를 훅이 이미 적었나 — .catch 가 같은 컴팩트를 겹쳐 적지 않게(훅이 적은 뒤 던진 때) */
let hookCompact: { isRecorded: boolean } | null = null
/**
 * 0.9.1: 이 프로세스에서 엔진 컨텍스트 값을 봤다. 엔진 값은 컴팩트 직후 다음 응답까지 빈다(엔진 문서 SessionContextUsage) — 본 뒤 비면
 * 훅도 .catch 도 못 본 컴팩트로 적는다(앞 크기 = 마지막 점, 뒤 크기는 다음 요청이 채운다)
 */
let engineHadTokens = false
/** 마지막으로 본 세션 시작 시각 — /clear 는 이 값을 바꾼다(그건 컴팩트로 적지 않는다) */
let startedAtSeen: number | null = null

/** 컴팩트 결과 중 적는 데 쓰는 것(엔진 SessionCompacted 의 일부) */
type CompactResultLike = { tokensBefore?: number; tokensAfter?: number; usage?: Tokens }
/**
 * 컴팩트 끝 줄어듦: 엔진이 컴팩트 결과를 돌려준 순간 앞 · 뒤 크기를 두고
 * 바 · 패널 머리 게이지가 앞 크기에서 뒤 크기로 1.3초 줄어든다. 그동안은 뒤 크기로 고정해 그린다 — 그림이 같아야 앱이 틀을 남겨 움직임이 이어진다
 */
let gaugeShrink: { from: number; to: number; at: number } | null = null
/** 현황 컴팩트 시점의 직접 입력이 못 받은 까닭(0.6.0) — 저장 안 하고 그 줄 아래 한 줄 */
let timingErr: string | null = null

/** 지금 줄어드는 중인가 — 타이머를 못 걸어도(시험 · 엔진 거절) 시각으로 끝난다 */
async function shrinkNow($: EngineInterface): Promise<{ from: number; to: number } | null> {
  if (gaugeShrink === null) return null
  return (await $.clock.now()) - gaugeShrink.at < GAUGE_SHRINK_MS ? gaugeShrink : null
}

/**
 * 1.0 값 강조 시계: 칸(0.3초)마다 flash.ts 칸을 넘기고(바가 그린 칸만 — 그리기가 밀려도 건너뛰거나 몰지 않는다) 강조 수를 올려 바만
 * 다시 그린다. 강조할 값이 없으면 멈춘다. 강조가 새로 설 때마다 새로 건다 — 앞 시계가 소리 없이 끝났어도(엔진은 거절된 주기에서 시계를
 * 끝낸다) 이어진다. 엔진은 다시 그리기를 초당 10번까지로 접는다
 */
let flashTimer: { cancel: () => void } | null = null
function startFlashTicker($: EngineInterface): void {
  flashTimer?.cancel()
  flashTimer = null
  try {
    const timer = $.clock.every(FLASH_STEP_MS, () => {
      const isMore = stepFlash()
      // 이 수를 읽는 바만 다시 그린다 — 예전엔 칸마다 앱의 모든 칸(대화의 답변 칩 전부까지)을 다시 그려, 작업 중 화면이 간헐적으로 깜빡였다
      void update($, flashTick, (k: number) => k + 1).catch(() => {})
      if (!isMore) {
        timer.cancel()
        if (flashTimer === timer) flashTimer = null
      }
    })
    flashTimer = timer
  } catch {
    // 시계를 못 걸면 강조 없이 — 켜진 칸이 그대로 남지 않게
    endFlash()
  }
}

/** 강조를 멈춘다(세션에서 나감) — 시계 · 칸 · 시작을 기다리던 값 모두 */
function stopFlashTicker(): void {
  flashTimer?.cancel()
  flashTimer = null
  endFlash()
}

/** 세션에 들어온 뒤 자리 잡으면 바를 한 번 다시 그리는 시계(flash.ts takeArrival) — 들어오고 나갈 때마다 앞 것을 지운다 */
let arriveTimer: { cancel: () => void } | null = null

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
  const rewrite = rewriteOf(tokens, model, lastCtxOf(flow), ttl ?? ttlOf(await read($, usage)), null, engineNow)
  // 기록을 다 읽은 흐름일 때만 공통 앞부분을 잰다(못 읽었거나 읽는 중이면 다시 연 세션의 첫 요청이 세션 첫 요청처럼 보인다)
  const isWhole = (await read($, flowLoaded)) && (await read($, flowNote)) === null
  await writeFlow(
    $,
    withPoint(flow, { atMs: await $.clock.now(), ctx: contextTokens, usd: cost.usd, model, ...(ttl !== null ? { ttl } : {}), ...(engineNow ? { engine: engineNow } : {}) }, tokens, isWhole),
  )
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
  // 다시 그리기는 위 상태(live 등)를 읽는 칸만(패널 진행 중 줄 · 바 · 작업 중 줄) — 예전엔 여기서 요청마다 앱의 모든 칸(대화의 답변 칩 전부까지)을 다시 그려, 작업 중 화면이 간헐적으로 깜빡였다
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
  await updateTurns($, list => list.map(s => (s.details?.some(d => d.agent && d.done === false) ? { ...s, details: mark(s.details) } : s)))
  // 다시 그리기는 이 상태를 읽는 칸만(recordStep 과 같은 까닭)
  return changed
}

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
 * 에이전트 이름 · 질문: 이름 = 엔진 목록의 설명(앱에 보이는 작업 이름), 목록에 없으면 "하위 에이전트" — 엔진 자체 갈래(메모리 정리 등)는
 * 목록에 없다(엔진 문서). 질문 = 처음 본 요청 때 도는 질문 — 에이전트 첫 요청은 띄운 질문 안에서 돈다. 0.6.1: 에이전트를 띄울 때 걸던 훅(이름 · 질문을 적었다)을 뺐다 — 디렉터리 검토 보류 항목, 같은 값을 목록 · 첫 요청으로 얻는다
 */
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
    // 목록을 못 읽으면 이름 없이
  }
  // 못 찾았으면 몇 번만 더 묻는다 — 목록에 없는 갈래(엔진 자체 · 워크플로우)는 요청마다 목록을 다시 물었다(리뷰)
  const turnId = info ? info.turnId : ((await read($, live))?.turnId ?? null)
  agentInfo.set(agentId, { label, turnId, ...(isFound ? {} : { tries: (info?.tries ?? 0) + 1 }) })
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
  // 다시 그리기는 이 상태를 읽는 칸만(recordStep 과 같은 까닭 — 에이전트 요청마다였다)
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

/**
 * 답이 끝난 때의 집계 기준. isFixed = 앞 질문 값을 고정함(답 뒤 APP_FIX_MS) — 그 뒤 는 몫은 다음 질문의 ⚙ 줄로 간다.
 * 예전엔 다음 질문이 시작될 때 잰 몫까지 끝난 앞 질문에 더해, 다음 질문을 입력하자 이미 끝난 질문 값(답변 칩 · 질문별 비용)이
 * 바뀌었다
 */
let idleMark: { ledger: number; tracked: number; atMs: number; isFixed: boolean } | null = null

/**
 * N7: 질문이 시작될 때의 집계 기준 — 끝에서 "집계 증가 − 우리가 본 요청" 을 그 질문 ⚙ 줄로(중단으로 도중 끊긴 요청은 요청 훅에
 * 안 보이고, 질문 도중 앱 자체 요청도 여기 든다). 예전엔 질문 끝 기준에 묻혀 다음 질문 쪽으로 갔다(시뮬레이션 $0.50)
 */
let turnMark: { turnId: string; ledger: number; tracked: number } | null = null

/** N7: 짝 질문이 없는 하위 에이전트 값(질문 기록이 아직 없을 때) — 버리지 않고 다음 질문에 더한다 */
let orphanAgent: { agentId: string; label: string; cost: CostParts; model: string; atMs: number }[] = []

/** 기준을 둔 뒤 엔진이 다음 질문 제안을 띄웠다(prompt.suggest) — 그러면 그 이름을 붙인다 */
let suggestedSinceMark = false

/**
 * 바로 앞에 보낸 질문(prompt.submit) — 그 질문이 시작될 때(turn.start) 쓰고 비운다. 그림 · 파일(attachments)은 글에 없어 이름 앞에 붙이고,
 * 엔진이 글 없이 턴을 시작하면(앞 답 직후 보내 앱이 줄에 넣었다 넘긴 질문 등) 보낼 때 받은 글을 이름으로. isIdle = 쉬는 동안 보낸 질문
 */
let pendingSubmit: { text: string; counts: AttachCounts | null; isIdle: boolean; atMs: number } | null = null

/**
 * 이 질문(메인 대화)에서 마지막으로 글이 있던 요청의 답 — 앱이 마무리 도구(다음 단계 칸 · 할 일 목록)로 턴을 끝내면 마지막 응답 글이 비어, 답변
 * 칩이 붙을 답을 못 찾았다. 턴 끝 답이
 * 비면 이 글로 칩 자리(tail)를 잡는다
 */
let lastStepAnswer = ''

async function ledgerUsd($: EngineInterface): Promise<number | null> {
  try {
    return (await $.session.usage()).cost?.usd ?? null
  } catch {
    return null
  }
}

/** 답이 끝났다: 지금 집계를 기준으로 두고 APP_FIX_MS 뒤 앞 질문 몫을 재어 고정한다 */
async function markIdle($: EngineInterface): Promise<void> {
  const ledger = await ledgerUsd($)
  const mark = ledger === null ? null : { ledger, tracked: trackedUsd, atMs: await $.clock.now(), isFixed: false }
  idleMark = mark
  suggestedSinceMark = false
  if (!mark) return
  try {
    // 그 사이 다음 질문이 시작되고 또 끝났으면(새 기준) 이 타이머는 아무것도 안 한다
    $.clock.after(APP_FIX_MS, () => void fixAppRequests($, mark))
  } catch {
    // 타이머가 없는 곳(테스트)에선 다음 질문이 시작될 때 지난 시간으로 가른다
  }
}

/** 기준 뒤 는 집계 − 우리가 본 값 = 앱 자체 요청(못 읽으면 null) */
async function appExtraSince($: EngineInterface, mark: { ledger: number; tracked: number }): Promise<{ extra: number; ledger: number } | null> {
  const ledger = await ledgerUsd($)
  return ledger === null ? null : { extra: ledger - mark.ledger - (trackedUsd - mark.tracked), ledger }
}

/** 답 뒤 APP_FIX_MS: 그 사이 앱 자체 요청을 끝난 질문(마지막 요약)에 한 줄로 더하고, 그 질문 값은 여기서 고정 */
async function fixAppRequests($: EngineInterface, mark: NonNullable<typeof idleMark>): Promise<void> {
  if (idleMark !== mark || mark.isFixed) return
  const got = await appExtraSince($, mark)
  // 그 사이 다음 질문이 시작됐다
  if (idleMark !== mark) return
  if (!got || got.extra < APP_MIN_USD) {
    // 작은 값은 버리지 않고 기준을 그대로 둔다 — 더 쌓이면 다음 질문 쪽에서 센다
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

/**
 * 다음 질문이 시작될 때: 답 뒤 APP_FIX_MS 안이면(아직 안 고정) 그때까지 몫을 앞 질문에, 지났으면 앞 질문은 그대로 두고 그 뒤
 * 몫을 돌려준다 — 부른 쪽이 새 질문에 ⚙ 줄로 더한다. 입력과 함께 도는 요청도 여기 든다
 */
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

/**
 * M1(0.7.0 피드백 "이번 달 금액이 Claude 화면보다 작음"): 대화 기록에 없는 요청(컴팩트 요청 · 앱 자체 요청)의 값을 세션 장부
 * <데이터>/extra/<세션>.json 에 그날(UTC)로 더한다 — 오늘 · 이번 달은 기록 합에 이 장부를 더한다(scan-spend extra). 장부가 없으면 이 세션
 * 질문 기록(앞 판이 남긴 컴팩트 · 앱 자체 요청 줄)에서 시작한다 — 업데이트 뒤 한 번 다시 모으기. 질문 기록에 더하기 전에 부른다
 * (시작 값에 이번 값이 두 번 들지 않게). 못 쓰면 로그만 — 다음 값에 다시. compactBefore = 컴팩트면 그 컴팩트 전 크기(M2 — 값이 0 이어도 남긴다)
 */
async function addExtraSpend($: EngineInterface, usd: number, compactBefore: number | null = null): Promise<void> {
  if (!(usd > 0) && compactBefore === null) return
  try {
    const path = `${await dataDir($)}/extra/${await $.session.id()}.json`
    let days: Record<string, number> | null = null
    // M2: 잰 컴팩트 [컴팩트 전 크기, 달러] — tools/scan-spend.mjs 가 대화 기록의 컴팩트 경계와 맞춰, 질문 기록이 60개로 잘린 뒤에도 어림(retro)으로
    // 또 세지 않는다. 값이 0 인 컴팩트(엔진이 미리 계산한 요약을 씀 — 그 요청은 앱 자체 요청 줄)도 남긴다
    let compacts: [number, number][] = []
    try {
      const j = JSON.parse(await $.fs.read(path)) as { v?: unknown; days?: Record<string, number>; compacts?: unknown }
      if (j.v === 1 && j.days) {
        days = { ...j.days }
        if (Array.isArray(j.compacts)) compacts = j.compacts.filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
      }
    } catch {
      // 처음 — 질문 기록에서 시작
    }
    if (!days) {
      days = {}
      // 메모리 목록이 아직 비었으면(켠 직후 — loadTurns 전) 질문 기록 파일에서
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

/**
 * 앱 자체 요청 값을 질문에 더한다: 도는 질문이 있으면 그 질문에, 없으면 끝난 마지막 질문에. 읽기 · 쓰기 · 출력으로 못 나눠
 * cost.usd 와 appUsd 에만
 */
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
  // 다시 그리기는 이 상태를 읽는 칸만(recordStep 과 같은 까닭)
}

/**
 * 컴팩트 한 번을 질문에 한 줄로 — 질문별 비용에서도 "얼마 들여 얼마로 줄었나" 가 보이게. 답 뒤 컴팩트면
 * 끝난 마지막 질문(저장하고 컴팩트면 그 저장 턴), 질문 도중 자동 컴팩트면 그 질문. 값은 질문 합에 더한다(읽기 · 쓰기 · 출력으로
 * 나뉜 값이라 내역도 맞는다)
 */
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

/**
 * 컴팩트 한 번을 적는다: 계산식 재료(섞임 · 출력 · 직후 크기) · 컨텍스트 흐름 · 질문별 비용 줄 · 끝 줄어듦. session.compact 훅이 본 컴팩트와
 * 훅이 못 본 컴팩트(0.9.1 — .catch 가 받아 둔 결과, 또는 엔진 값이 빈 것으로 안 컴팩트) 둘 다 이 길로. mark = 훅의 이번 디스패치 표시
 */
async function recordCompaction($: EngineInterface, trigger: string, result: CompactResultLike, mark?: { isRecorded: boolean }): Promise<void> {
  measureAfterCompact = true
  // 컴팩트 요청이 입력을 어떻게 냈는지(정가 · 캐시 읽기 · 쓰기 몫) — 다음 손익 계산에 쓴다.
  // 캐시가 살아 있던 컴팩트만 남긴다 — "지금 컴팩트하면" 셈(compactPayoff)은 캐시가 살아 있을 때만 쓰고, 식은 캐시는
  // coldCompact 가 따로 센다. 식은 캐시의 몫(정가 입력)이 남으면 다음 손익이 7배쯤 비싸 보였다
  const mix = result.usage ? compactMixOf(result.usage) : null
  if (mix && isWarmMix(mix)) await $.store.set(MIX_KEY, mix)
  // 요약을 쓴 출력 토큰 — 다음 계산식 재료(없으면 가정 OUTPUT_GUESS)
  if (result.usage && result.usage.output_tokens > 0) await $.store.set(OUTPUT_KEY, result.usage.output_tokens)
  // 컨텍스트 흐름에 컴팩트 한 번: 직전 크기와 실제 값(엔진이 준 토큰 × 요율). 직후 크기는 다음 요청이 채운다
  const flow = await readFlow($)
  const before0 = await read($, usage)
  const parts = result.usage && before0 ? costOf(result.usage, before0.model, undefined, null, engineNow) : null
  const measured = parts?.usd ?? null
  const before = result.tokensBefore ?? before0?.contextTokens ?? flow.points[flow.points.length - 1]?.ctx ?? 0
  // 엔진이 준 tokensAfter 는 남긴 대화(요약 + 다시 붙인 파일)뿐 — 시스템 지시 · 도구 · 메모리가 빠진다(엔진 2.1.299: postTokens = 경계 ·
  // 요약 · 첨부 · 훅 결과의 토큰 수). 0.6.0(N2) ~ 1.0 은 이 값을 직후 크기로 적어 상주가 "18k = 기본 적재 0 + 요약 18k" 였다. 이제 kept 로 두고, 직후는 첫 요청이 채운다 — 그 전엔
  // kept + 기본 적재로 어림(afterGuess)
  const kept = typeof result.tokensAfter === 'number' && result.tokensAfter > 0 ? result.tokensAfter : null
  if (kept !== null) await $.store.set(KEPT_KEY, kept)
  const event: CompactEvent = { atMs: await $.clock.now(), trigger, before, after: null, costUsd: measured, index: flow.points.length, ...(kept !== null ? { kept } : {}) }
  const withEvent: Flow = { points: flow.points, compactions: [...flow.compactions, event] }
  const after = afterGuess(withEvent, event, before0?.model ?? '', await baseLoad($, flow))
  // 엔진이 컴팩트를 끝낸 이 순간 게이지가 줄어든다(직후 어림을 낼 수 있을 때만 — 모르면 다음 요청까지 그대로)
  if (after !== null && before > after) {
    gaugeShrink = { from: before, to: after, at: await $.clock.now() }
    $.ui.invalidate('ui.render')
    try {
      $.clock.after(GAUGE_SHRINK_MS, () => {
        gaugeShrink = null
        $.ui.invalidate('ui.render')
      })
    } catch {
      // 타이머를 못 걸면 다음 그리기에서 시각으로 끝난다(shrinkNow)
    }
  }
  await writeFlow($, withEvent)
  if (mark) mark.isRecorded = true
  // 저절로 펴진 바를 ✕ 로 접어 둔 것은 컴팩트로 끝난다 — 다음 컴팩트 때는 다시 펴진다
  await update($, autoDismissed, () => null)
  // 질문별 비용에도 한 줄(앱 자체 요청으로 세지 않게 우리가 본 값에 넣는다) — 직후 크기는 다음 요청이 채운다(fillCompactAfter)
  if (parts) trackedUsd += parts.usd
  await addCompactStep($, parts, before)
}

/**
 * 0.9.1: 훅이 못 본 컴팩트를 적는다 — ① .catch 가 받아 둔 결과(엔진 값 그대로) ② 엔진 컨텍스트 값이 이 프로세스에서 보인 뒤 비었다(컴팩트
 * 직후 다음 응답 전 — 엔진 문서). ②는 앞 크기 = 마지막 점, 뒤 크기는 다음 요청이 채운다. /clear(세션 시작 시각이 바뀜)와 이미 적은
 * 컴팩트(마지막 점 뒤 컴팩트가 있음)는 적지 않는다. 돌려주는 값: 적었나
 */
async function catchMissedCompact($: EngineInterface, engineTokens: number | undefined, startedAt: number): Promise<boolean> {
  const isClear = startedAtSeen !== null && startedAt !== startedAtSeen
  startedAtSeen = startedAt
  if (missedCompact !== null) {
    const m = missedCompact
    missedCompact = null
    await recordCompaction($, m.trigger, m.result)
    log($, `compact the hook did not see (${m.trigger}) — recorded from .catch`)
    return true
  }
  if (typeof engineTokens === 'number' && engineTokens > 0) {
    engineHadTokens = true
    return false
  }
  if (!engineHadTokens) return false
  // 컴팩트가 도는 중이면 미룬다 — 훅이 곧 적거나(겹쳐 적지 않게), 우리 버튼이 명령을 아직 기다린다
  const phase = await read($, compactPhase)
  if (phase === 'compacting' || phase === 'tidying') return false
  engineHadTokens = false
  if (isClear) return false
  const flow = await readFlow($)
  const last = flow.points[flow.points.length - 1]
  if (!last || last.ctx <= 0 || compactSince(flow) !== null) return false
  // 누가 돌렸는지(사람 /compact · 자동)는 모른다 — 화면엔 그냥 "컴팩트"
  await recordCompaction($, 'manual', { tokensBefore: last.ctx })
  log($, `compact the hook did not see — engine context went empty after ${last.ctx}`)
  return true
}

/** 0.9.1: 1.5초마다 — 훅이 못 본 컴팩트가 있으면 바로 다시 잰다(.catch 가 결과를 받아 뒀거나, 본 엔진 값이 비었다). 아니면 그냥 돌아온다 */
async function watchCompact($: EngineInterface): Promise<void> {
  if (missedCompact === null) {
    if (!engineHadTokens) return
    const tokens = (await $.session.usage()).context.tokens
    if (typeof tokens === 'number' && tokens > 0) return
  }
  await refreshUsage($, { categories: false, pushHistory: false })
}

/**
 * 질문별 비용의 컴팩트 줄을 흐름의 직후 크기에 맞춘다(flow.ts syncCompactAfter — 0.6.0 ~ 1.0 이 적은 "933k → 18k"). 흐름 · 질문 기록은
 * 따로 읽혀 둘 다 읽은 쪽 끝에서 부른다
 */
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

/** 컴팩트 뒤 첫 메인 요청이 잰 직후 크기를 아직 비어 있는 컴팩트 줄에(진행 중 질문 · 끝난 질문) */
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

async function closeTurn($: EngineInterface, text: string, isAborted = false): Promise<void> {
  const now = await read($, live)
  await update($, live, () => null)
  // 요청 0개면 버린다 — 중단한 질문은 남긴다(N7: 붙어 있던 앱 자체 · 에이전트 값까지 줄째 사라졌다)
  if (!now || (now.steps === 0 && !isAborted)) return
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
    ...(isAborted ? { aborted: true as const } : {}),
  }
  // 한도(TURNS_KEEP)를 넘으면 맨 앞 질문은 updateTurns 가 밀린 질문 합으로
  await updateTurns($, list => [...list, summary])
}

async function startCompacting($: EngineInterface, kind: string): Promise<void> {
  await update($, compactKind, () => kind)
  await update($, compactPhase, () => 'compacting')
}

/**
 * /compact 명령을 사용자가 친 것처럼 돌린다. 데스크톱(SDK) 세션은 $.session.compact 를,
 * prompt.submit 은 / 로 시작하는 글을 막는다 — 엔진이 안내한 길이 $.command.run 이다.
 */
async function compactNow($: EngineInterface, args = '', kind?: string): Promise<boolean> {
  await update($, isConfirmingCompact, () => false)
  await startCompacting($, kind ?? (args === compactKeep(await currentSettings($)) ? kindTidy() : kindDirect()))
  let isDone = true
  try {
    await $.command.run(args ? { command: 'compact', args } : { command: 'compact' })
  } catch (err) {
    isDone = false
    $.ui.toast(L(`컴팩트 실패: ${String(err)}`, `Compact failed: ${String(err)}`))
  } finally {
    await update($, compactPhase, () => 'idle')
  }
  // 0.9.1: 우리가 돌린 /compact 는 우리 $ 호출 아래라 엔진이 session.compact 훅을 안 부를 수 있다(재진입) — 끝나면 바로 다시 재
  // 훅이 못 본 컴팩트를 적는다(회사 PC: 컴팩트가 끝났는데 바가 컴팩트 전 크기, 패널 "컴팩트 0회")
  await refreshUsage($, { categories: false, pushHistory: false }).catch(() => {})
  return isDone
}

/**
 * 클리어 경고 카드 [지우기](0.8.1 B9 · 2026-10-19 경고 한 번): /clear 를 사용자가 친 것처럼 — /compact 와 같은 길($.command.run,
 * prompt.submit 은 / 글을 막는다). 대화를 비우고 새로 시작(요약 없음). 엔진이 못 받으면 직접 치라고 알린다
 */
async function clearNow($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  await update($, isAskingClear, () => false)
  try {
    await $.command.run({ command: 'clear' })
  } catch (err) {
    $.ui.toast(L(`클리어하지 못했습니다(${String(err)}). 입력창에 /clear 를 직접 치세요`, `Clear failed (${String(err)}). Type /clear in the prompt`))
  }
}

/** "정리 후 컴팩트": 정리 프롬프트를 보내고, 그 턴이 [컴팩트 진행] 으로 끝나면 turn.complete 에서 /compact 를 돌린다 */
async function tidyThenCompact($: EngineInterface): Promise<void> {
  await update($, isConfirmingCompact, () => false)
  // 이름은 비운다 — 앞 이지 오토 저장의 이름(kindAutoSave)이 남아 "이지 오토 · 저장 중" 으로 보이지 않게
  await update($, compactKind, () => '')
  await update($, compactPhase, () => 'tidying')
  try {
    await $.prompt.submit({ text: tidyPrompt(tidyBody(await currentSettings($))) })
  } catch (err) {
    await update($, compactPhase, () => 'idle')
    $.ui.toast(L(`저장 요청 실패: ${String(err)}`, `Save request failed: ${String(err)}`))
  }
}

// ── 이지 오토(2026-10-19 — 정본 D:/Claude/easy-compact-auto.md §5): 세션 켬/끔 · 사슬. 판단 · 화면 글은 auto.ts, 보내는 글은 tidy.ts ──

/** plugin 아닌 출처(사람 · 다른 세션 · 알림)의 보내기를 마지막으로 받은 시각 — 답 끝 기다림 · 이어가기 판정 */
let otherAt = 0
/** 이 프로세스가 돌리는 오토 컴팩트(사슬 atMs) — 다시 불림 · 재시작으로 남은 컴팩트 단계만 autoWatch 가 정리 */
let autoCompacting: number | null = null
/** 우리 요약 턴 id — 그 턴이 끝날 때 사슬이 없으면(저장 중 [취소]) 답 끝 길을 다시 걸지 않는다 */
let autoSaveTurn: string | null = null

async function autoNow($: EngineInterface): Promise<AutoState> {
  return (await read($, auto)) ?? freshAuto(false, await $.clock.now())
}

/** 상태를 바꾸고 저장소에도 적는다(앱을 다시 켜도 이어받게). fn 이 받은 값을 그대로 돌려주면 안 바꾼다 — 바꿨으면 true */
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

/** 세션 시작: 다시 불림이면 그대로, 앱 재시작이면 저장소에서, 새 세션이면 마지막으로 직접 고른 켬/끔 */
async function loadAuto($: EngineInterface): Promise<void> {
  if ((await read($, auto)) !== null) return
  const nowMs = await $.clock.now()
  const stored = autoFromStore(await $.store.get(autoKey(await $.session.id())).catch(() => undefined), nowMs)
  let isLast = (await $.store.get(AUTO_LAST_KEY).catch(() => undefined)) === true
  await update($, auto, prev => prev ?? stored ?? freshAuto(isLast, nowMs))
}


/**
 * 켜고 끄기([컴팩트] 팝업 "이지 오토" 줄 · 멈춤 안내 [다시 켜기]): 멈춤이면 다시 켬. 고른 값은 새 세션의 처음 값으로 남긴다. 끌 때 도는
 * 저장 턴 · 컴팩트는 그 단계까지만(그 뒤로 안 간다), 기다림 · 이어가기는 바로 놓는다
 */
async function toggleAuto($: EngineInterface): Promise<void> {
  const isOn = !isAutoActive(await read($, auto))
  await $.store.set(AUTO_LAST_KEY, isOn).catch(() => {})
  await setAuto($, a => ({ ...a, on: isOn, stop: null, note: null, since: null, chain: isOn || a.chain?.stage === 'saving' || a.chain?.stage === 'compacting' ? a.chain : null }))
  const s = await currentSettings($)
  const u = await read($, usage)
  $.ui.toast(autoToggleNote(isOn, s, u?.window))
  // 켤 때 답이 끝나 쉬는 중이고 이미 앞쪽을 넘었으면 바로 시작(답 끝 길과 같다 — 0.5초 기다림부터)
  if (!isOn || (await read($, live)) || (await autoNow($)).chain || !u || u.contextTokens < s.autoStart || !(await autoMayStart($, u))) return
  const at = await $.clock.now()
  await setAuto($, x => ({ ...x, chain: { path: 'end', stage: 'wait', atMs: at, turnId: null, before: u.contextTokens } }))
  $.clock.after(AUTO_WAIT_MS, () => void autoBegin($, at))
}

/** 캐시 만료 · 모델 바뀜: 이 세션은 끈다(안내 한 줄 — 마지막으로 고른 값은 그대로라 새 세션엔 안 번진다) */
async function autoOff($: EngineInterface, why: 'cold' | 'model'): Promise<void> {
  await setAuto($, a => ({ ...a, on: false, stop: null, note: why, chain: null, since: null }))
}

/** 자동 멈춤(이 세션) — 안내 한 줄 [다시 켜기] */
async function autoHalt($: EngineInterface, why: 'stuck' | 'again'): Promise<void> {
  await setAuto($, a => ({ ...a, stop: why, note: why, chain: null, since: null }))
}

/** 사슬을 놓는다(이번엔 쉼) — 이지 오토 저장 중 표시도 거둔다 */
async function autoEnd($: EngineInterface): Promise<void> {
  await setAuto($, a => (a.chain ? { ...a, chain: null } : a))
  if ((await read($, compactPhase)) === 'tidying' && isAutoSaveKind(await read($, compactKind))) await update($, compactPhase, () => 'idle')
}

/** 사슬을 걸어도 되나: 다른 컴팩트가 안 돎 · 식은 캐시면 끔 · 자동 멈춤 ② · 손해면 이번만 쉼(안내 없음) */
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

/** 메인 턴 끝: 우리 요약 턴이면 컴팩트로, 이어가기 턴이면 끝, 사슬이 없으면 답 끝 길(앞쪽을 넘었나) */
async function autoAtTurnEnd($: EngineInterface, e: { turnId: string; reason: string; answer: string }, turnNow: LiveTurn | null): Promise<void> {
  const a = await autoNow($)
  const c = a.chain
  if (c?.stage === 'saving' && c.turnId === e.turnId) {
    // 답에 [컴팩트 진행] 이 없으면(사람 글이 겹쳐 다른 답 · 중단) 이번 사슬은 쉼. 끈 뒤면 저장까지만
    if (!a.on || tidyVerdict(e.reason, e.answer) !== 'go') return autoEnd($)
    // 저장 턴 몫도 이 PC 실측으로(이지 컴팩트 저장 턴과 같은 셈 — 컴팩트 손익 재료)
    if (turnNow) await recordSaveTurn($, turnNow)
    const at = await $.clock.now()
    autoCompacting = at
    await setAuto($, x => ({ ...x, chain: { ...c, stage: 'compacting', atMs: at, turnId: null } }))
    await startCompacting($, kindAuto())
    // 훅 안에서 명령을 돌리면 이 턴을 기다린다 — 턴이 끝난 뒤로(이지 컴팩트와 같다)
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

/** 답 끝 0.5초 뒤: 그사이 사람 · 다른 세션 글이 왔으면 쉼(다음 답 끝에 다시 봄), 아니면 요약 글 */
async function autoBegin($: EngineInterface, at: number): Promise<void> {
  const a = await autoNow($)
  if (a.chain?.stage !== 'wait' || a.chain.atMs !== at) return
  if (!isAutoActive(a) || otherAt >= at) return autoEnd($)
  await autoSave($, 'end')
}

/** 요약 글을 보낸다 — 바 · 진행 칸은 이지 컴팩트 저장 중과 같은 꼴(이름만 이지 오토) */
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

/** 긴 일 길: 메인 요청 직전 컨텍스트가 뒤쪽 이상이면 끊고 요약(시험 B — 훅 밖 시계에서 끊고 바로 보냄, 이 요청은 그대로 간다) */
async function autoAtStep($: EngineInterface, turnId: string): Promise<void> {
  const a = await read($, auto)
  // 우리 컴팩트 뒤 첫 요청 전엔 컨텍스트가 어림이다 — 그 요청이 재면(멈춤 ①이 본다) 다음 요청부터
  if (!a || !isAutoActive(a) || (a.chain && a.chain.stage !== 'continuing') || a.since?.requests === 0) return
  const u = await read($, usage)
  if (!u || u.contextTokens < (await currentSettings($)).autoEnd || !(await autoMayStart($, u))) return
  const at = await $.clock.now()
  await setAuto($, x => ({ ...x, chain: { path: 'mid', stage: 'saving', atMs: at, turnId: null, before: u.contextTokens } }))
  $.clock.after(0, () =>
    void (async () => {
      await $.turn.abort({ turnId }).catch(err => log($, `auto abort failed — ${String(err)}`))
      await autoSave($, 'mid')
    })(),
  )
}

/** 우리 컴팩트 뒤 메인 요청 수(자동 멈춤 ②) — 첫 요청이 여전히 앞쪽 이상이면 멈춤 ① */
async function autoAfterStep($: EngineInterface, ctx: number): Promise<void> {
  const a = await read($, auto)
  if (!a?.since) return
  const n = a.since.requests + 1
  if (n === 1 && isAutoActive(a) && ctx >= (await currentSettings($)).autoStart) return autoHalt($, 'stuck')
  await setAuto($, x => (x.since ? { ...x, since: n > AUTO_AGAIN_REQUESTS ? null : { ...x.since, requests: n } } : x))
}

/** 요약 턴이 [컴팩트 진행] 으로 끝났다 — /compact(이지 오토 지시) 뒤 이어 간다 */
async function autoCompact($: EngineInterface, at: number): Promise<void> {
  try {
    if ((await autoNow($)).chain?.stage !== 'compacting') return
    if (!(await compactNow($, autoCompactKeep(), kindAuto()))) return autoEnd($)
    await autoAfterCompact($)
  } finally {
    if (autoCompacting === at) autoCompacting = null
  }
}

/** 컴팩트 끝: 자동 멈춤 셈을 새로, 긴 일 길이면 이어가기(그사이 사람 · 다른 세션 글이 왔으면 안 보냄). 여러 길에서 불려도 한 번만 */
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
  try {
    await $.prompt.submit({ text: autoContinuePrompt() })
  } catch (err) {
    log($, `auto continue failed — ${String(err)}`)
    await autoEnd($)
  }
}

/** plugin 아닌 출처의 보내기: 답 끝 기다림은 쉬고, 컴팩트 뒤 이어가기는 안 보낸다 */
async function autoOnOther($: EngineInterface): Promise<void> {
  otherAt = await $.clock.now()
  const c = (await read($, auto))?.chain
  if (c && (c.stage === 'compacting' || (c.stage === 'continuing' && c.turnId === null))) await setAuto($, a => (a.chain ? { ...a, chain: { ...a.chain, isInterrupted: true } } : a))
}

/** 메인 턴 시작: 우리 요약 · 이어가기 턴을 알아 두고(글 머리표 — 우리 훅은 우리 보내기를 못 본다), 사슬 도중 다른 턴이 끼면 기다림은 쉬고 이어가기는 안 보낸다 */
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

/** 1.5초마다: 멈춘 사슬 정리(시계 · 턴이 다시 불림 · 재시작으로 사라짐) · 이 프로세스가 안 돌리는 컴팩트 단계 이어 가기 · 식은 캐시면 끔 */
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

// ── 그리기 ───────────────────────────────────────────────────────

/**
 * 펼친 질문을 바꾼다 — 패널(이 상태를 읽는 칸)만 다시 그린다. 예전(2026-10-11 엔진)엔 상태 쓰기만으론 데스크톱 패널이 안 다시 그려져 앱 전체 다시 그리기를 불렀는데, 앱 전체 다시 그리기를 부르면 대화의 답변 칩 · 질문 강조 덮개까지 다시 그려, 질문 강조가 켜진 채 누르면 채팅 쪽 강조가 깜빡였다. 지금 엔진은 그리는 동안 읽은 상태를 바꾸면 그 칸만 다시 그린다(엔진 문서 $.state)
 */
async function toggleExpanded($: EngineInterface, id: number): Promise<void> {
  await update($, expandedTurn, now => (now === id ? null : id))
}

/**
 * 진단 덤프 재료 — 이 세션의 버전 · 설치 · 설정 · 패널 상태 · 질문 기록 · 사용량. 파일은 데이터 폴더 debug-<세션>.json(이미 있는 폴더 —
 * 하위 폴더는 안 만든다, 같은 세션은 덮어쓴다)
 */
async function dumpObject($: EngineInterface): Promise<Record<string, unknown>> {
  const inst = await installNow($)
  return {
    at: new Date(await $.clock.now()).toISOString(),
    // 0.9.1: 제보를 받으면 어느 버전 · 어떤 설치(개발본 dev · 마켓 이름 · 디렉터리 synced)인지부터
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
    // N4: 패널 상태 · 여닫기 기록
    paneView: await read($, paneView),
    cardsOpen: await read($, cardsOpen),
    compactPhase: await read($, compactPhase),
    panes: await $.ui.panes().catch(() => null),
    paneLog,
    // N1 대조 재료: 엔진 집계(세션 비용) · 우리가 요청마다 잰 합 · 질문 합(질문별 비용 + 도는 질문)
    ledgerUsd: await ledgerUsd($),
    // B3: 앞 프로세스까지 이어 온 세션 금액(바 · 패널 금액 = 이것 + 엔진 값)
    costBase,
    trackedUsd,
    questionsUsd: (await read($, turnSummaries)).reduce((sum, t) => sum + t.cost.usd, 0) + ((await read($, turnsOlder))?.usd ?? 0) + ((await read($, live))?.cost.usd ?? 0),
  }
}

async function dumpPath($: EngineInterface): Promise<string> {
  return `${await dataDir($)}/debug-${await $.session.id()}.json`
}


/** 진단 카드 사본을 만든다(연 때 · 빼기를 바꿀 때) — 카드에 보이는 글 = [복사] · [파일로 저장] 하는 글 */
async function buildDiagSnap($: EngineInterface, redact: boolean): Promise<void> {
  const raw = await dumpObject($)
  const got = redactDump(raw, redact)
  const { text } = dumpText(got.state)
  const { head, lines } = diagHead(text)
  const turns = Array.isArray(raw.turnSummaries) ? raw.turnSummaries.length : 0
  diagSnap = { text, head, lines, turns, counts: got.counts, samples: got.samples }
}

/**
 * 진단 내용 보기(0.9.1 U6 — 사용자 "덤프는 뽑히는 내용을 사람한테 보여 줘야 · 복사해도 되는지 봐야"): 판 서랍 · 설정 › 일반 탭의 [진단 내용
 * 보기] 가 그 줄 아래 카드를 연다(같은 자리에서 다시 누르면 닫음). 파일은 [파일로 저장] 때만 — 대화엔 안 남긴다(명령 답은 기록에 남아 다음
 * 요청이 같이 읽는다). 밖으로는 안 보낸다(사용자가 직접 붙인다)
 */
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

/** 카드 그리기 재료 — 그 자리(판 서랍 · 일반 탭)에 열려 있을 때만, 아니면 null(줄 버튼은 [진단 내용 보기]) */
async function diagViewOf($: EngineInterface, where: 'drawer' | 'gen'): Promise<DiagView | null> {
  const c = await read($, diagCard)
  if (!c.open || c.where !== where || !diagSnap) return null
  return { where, redact: c.redact, head: diagSnap.head, lines: diagSnap.lines, turns: diagSnap.turns, counts: diagSnap.counts, samples: diagSnap.samples, copiedLines: c.copiedLines, savedPath: c.savedPath }
}

/** 질문 · 동작 글 빼기 — 사본을 다시 만든다(복사 · 저장 표시는 지움: 다른 글이 됐다) */
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
    $.ui.toast(L(`진단 파일을 만들었습니다: ${path}. 제보할 때 붙여 주세요`, `Saved a diagnostics file: ${path}. Attach it to your report`), { timeoutMs: HIDDEN_NOTE_MS })
  } catch (err) {
    $.ui.toast(L(`진단 파일을 만들지 못했습니다: ${String(err)}`, `Couldn't save the diagnostics file: ${String(err)}`))
  }
  $.ui.invalidate('ui.render')
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

/** 질문별 비용 [글 다 보기] — 그 질문의 잘린 동작 줄을 모두 그 자리에서 줄 바꿈(1.0 시안 1017o 안 3, 사용자 "질문마다 하나") */
async function toggleStepsFull($: EngineInterface, id: number | 'live'): Promise<void> {
  // 패널(이 상태를 읽는 칸)만 다시 그린다 — toggleExpanded 와 같은 까닭
  await update($, stepsFull, now => (now.includes(id) ? now.filter(x => x !== id) : [...now, id].slice(-50)))
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
      const half = Math.floor(v.length / 2)
      return v.length % 2 === 1 ? v[half]! : (v[half - 1]! + v[half]!) / 2
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
  const r = turn.model ? ratesFor(turn.model, 0, null, engineNow) : null
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

/** 컴팩트 문구 ② /compact 뒤에 붙일 글(설정 칸의 Enter) — 직접 쓰기로 바뀐다(settings setCompactCustom) */
async function saveCompactCustom($: EngineInterface, text: string): Promise<void> {
  await update($, compactDraft, () => null)
  await saveSettings($, setCompactCustom(await currentSettings($), text))
}

/**
 * 사용량 패널 안 탭 바꾸기(사용량 · 설정). 패널이 닫혀 있으면 연다. 탭 줄이 보이게 위로 붙잡는다 —
 * 긴 사용량에서 짧은 설정으로 오면 스크롤 자리가 내용 밖에 남는다. 다시 그린 뒤에 옮겨야 해 잠깐 기다린다
 */
async function openUsageTab($: EngineInterface, tab: UsageTab): Promise<void> {
  // 설정 탭에서 현황 탭으로 돌아와도 고른 보기는 기억이 남는다(paneModeChoice — 0.6.0, 정보량 옵션 정리)
  if (tab === 'main' && (await read($, usageTab)) !== 'main') await update($, paneModeLocal, () => null)
  // 업데이트 서랍은 탭을 바꾸면 닫힌다(U3 — 0.6.1 피드백 "설정에 다녀오면 사라지게")
  if ((await read($, usageTab)) !== tab) await closeUpdateDrawer($)
  await update($, usageTab, () => tab)
  if ((await read($, paneView)) !== 'usage') await switchView($, 'usage')
  $.ui.invalidate('ui.render')
  // 대상은 그 탭 단추 — 상자 키(pane-tabs)는 실제 앱이 "no element of its own is drawn under that key" 로 거절했다(O2 진단 2026-10-15,
  // 엔진은 상자 키로 스크롤하지 않는다 — 이 우회는 그동안 늘 거절됐다)
  $.clock.after(120, () => {
    void $.ui.scroll({ to: { key: tab === 'settings' ? 'pane-settings' : 'pane-usage' }, in: PANE, block: 'start' }).catch(() => {})
  })
}

/**
 * 설정 안 탭 바꾸기(S10, 0.8.1): 긴 바 탭에서 짧은 탭으로 오면 스크롤 자리가 내용 밖에 남는다 — 현황 · 설정 탭과 같이 그 탭 단추로 스크롤
 * (상자 키는 엔진이 거절한다 — O2 진단)
 */
async function openSettingsTab($: EngineInterface, tab: SettingsTab): Promise<void> {
  await update($, settingsTab, () => tab)
  $.ui.invalidate('ui.render')
  $.clock.after(120, () => {
    void $.ui.scroll({ to: { key: `set-tab-${tab}` }, in: PANE, block: 'start' }).catch(() => {})
  })
}

/** 설정의 컴팩트 문구 "보내는 글 전체" 펼치기 · 접기 */
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

/**
 * 바가 접혀 있나: ✕ 로 접었고(bandFolded), 컴팩트할 때 자동으로 펴기가 꺼졌거나 아직 그때가 아니다(노랑 전 · 식은 캐시라도
 * 컴팩트가 손해). 저장 · 컴팩트 중 · 확인창이 열린 동안은 편다. 저절로 펴진 바를 ✕ 로 다시 접었으면 그보다 급해질 때까지
 * 접어 둔다(autoDismissed). 입력창 아래 [🔽 ⇱] 를 그릴지 — 바(AbovePrompt)가 같은 함수를 쓴다
 */
async function isBandTucked($: EngineInterface): Promise<boolean> {
  const mode = bandShowMode(await currentSettings($))
  if (mode === 'always') return false
  // 0.10.0: 꺼 둔 바도 확인 카드를 열면 편다 — 바 밖(명령 등)에서 카드를 열 수 있다
  if (mode === 'never') return !(await read($, isConfirmingCompact))
  const phase = await read($, compactPhase)
  if (phase === 'tidying' || phase === 'compacting' || (await read($, isConfirmingCompact))) return false
  const urgency = await urgencyNow($)
  // 이지 오토가 일하는 중이면 컴팩트할 때 · 늦어짐으로는 안 편다 — 알림은 오토에 맡긴다(명세 ③, 식은 캐시는 오토가 꺼지니 그대로 편다)
  if (urgency === 'ok' || (urgency !== 'cold' && isAutoActive(await read($, auto)))) return true
  const dismissed = await read($, autoDismissed)
  return dismissed !== null && URGENCY_RANK[urgency]! <= (URGENCY_RANK[dismissed] ?? 0)
}

/**
 * 접힌 바를 펴는 버튼 — 데스크톱은 입력창 아래 모드 줄(SessionMode), 터미널은 바 자리 한 줄(0.9.0). 0.8.1 B7: 네모 색 = 지금 크기
 * 단계(설정을 읽은 뒤라 levelOf 의 기준이 맞다) — 닫아도 색은 그대로, 닫힘은 글로
 */
/** 접힌 바 버튼 글 — 0.10.0 접힘 C: 단계 색 네모 + 지금 컨텍스트(설정 숫자 꼴), 모르면 이름. 알림 · 칩도 같은 글 */
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
  const folded = setFolded(s, true)
  await saveSettings($, folded)
  $.ui.toast(hiddenNote(folded, await revealLabelOf($, folded)), { timeoutMs: HIDDEN_NOTE_MS })
}

/**
 * 1.0 슬림 요약 줄 열고 닫기(아래 버튼 · 요약 줄 ✕). 닫으면 그 줄에 붙은 확인 카드도 닫는다
 */
async function toggleSummary($: EngineInterface): Promise<void> {
  const wasOpen = await read($, summaryCard)
  // 이동 흐름 A: 현황 패널이 열려 있으면(아래
  // 버튼 ▸) 누르면 패널만 닫는다 — 위는 그대로. 한 번 더 누르면 요약. 보기 자리 하나(요약 ↔ 현황 패널, 시안 1017l)는 그대로라 요약이 열린
  // 채 패널이 열리지 않는다(패널을 열면 요약을 닫는다 — toggleView · switchView)
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

/** 요약 카드 ✕ — 바(보통 화면) · 아래 버튼(슬림)만 남는다 */
async function closeSummary($: EngineInterface): Promise<void> {
  await update($, summaryCard, () => false)
  await update($, isConfirmingCompact, () => false)
  $.ui.invalidate('ui.render')
}

/** 슬림 알림 ✕ — 지금 급한 정도까지는 다시 안 띄운다(더 급해지면 다시 · 컴팩트하면 풀림 — 접힌 바 자동 펴기와 같은 규칙) */
async function dismissSlim($: EngineInterface): Promise<void> {
  const urgency = await urgencyNow($)
  await update($, isConfirmingCompact, () => false)
  await update($, autoDismissed, () => urgency)
  $.ui.invalidate('ui.render')
}

/** 슬림 알림을 닫아 둔 급한 정도를 아직 안 넘었나 */
async function isSlimDismissedNow($: EngineInterface): Promise<boolean> {
  const dismissed = await read($, autoDismissed)
  if (dismissed === null) return false
  return URGENCY_RANK[await urgencyNow($)]! <= (URGENCY_RANK[dismissed] ?? 0)
}

/**
 * 1.0 슬림 아래 버튼(데스크톱 SessionMode — 시안 2판 "아래에서 시작"): 단계 색 네모 + 컨텍스트 + 보일 칸 두 개까지(slimButtonText). 누르면
 * 요약 카드(입력창 위) 열고 닫기 — 보통 화면 게이지와 같은 손짓. 컴팩트할 때부터는 강조 버튼
 */
async function slimButton($: EngineInterface, ui: Ui, s: Settings) {
  const u = await read($, usage)
  const view = slimViewOf(s)
  const parts = u ? slimParts(ui, u, await $.clock.now(), view, s.sessionColors, await spendShownOf($, s)) : []
  const isOpen = await read($, summaryCard)
  // 보기 자리 하나(1.0): 요약이 위에 열렸으면 ▴, 현황이 옆 패널에 열렸으면 ▸ — 누르면 그 둘이 바뀐다
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

/**
 * 이지 오토 상태 칩: 바가 접혔거나 슬림일 때만 입력창 아래 툴바(터미널은 접힌 바
 * 줄)에, 켜 둔 동안만(멈춤 포함). 앱이 이 줄 버튼을 다 같은 색으로 그려 상태는 글이 말한다. 누르면 [컴팩트] 팝업(바가 펴진다)
 */
async function autoChip($: EngineInterface, ui: Ui, s: Settings, surface: string) {
  const a = await read($, auto)
  if (!a?.on) return null
  const u = await read($, usage)
  // 데스크톱 툴바는 버튼 글색 · 그림을 앱이 지운다 — 제 색이 남는 그림 글자 🔄 로 파랑을 낸다(시안 1019e ③, 접힌 바 버튼 🟦 과 같은 수)
  const text = autoChipText(a, s, u?.contextTokens ?? null, u?.window)
  return <ui.Button key="auto-chip" label={surface === 'terminal' ? text : `🔄 ${text}`} variant="secondary" {...(a.stop ? { dimColor: true } : {})} onPress={() => void barActs($).openConfirm()} />
}

/** 바에 넘길 이지 오토 몫: 켜졌나(켬 · 안 멈춤) · 버튼 글 · 칩(구간 — 사용자 "구간은 칩으로 확인") */
async function autoBarOf($: EngineInterface, s: Settings, u: Usage | null): Promise<NonNullable<BarData['auto']>> {
  const a = await read($, auto)
  const range = autoRangeText(s, u?.window)
  return { isOn: isAutoActive(a), label: autoChipText(a, s, u?.contextTokens ?? null, u?.window), tip: L(`이지 오토 구간 ${range}`, `Easy Auto range ${range}`) }
}

/** 입력창 위 안내 한 줄(멈춤 · 저절로 꺼짐) — ✕ 로 닫는다, 멈춤이면 [다시 켜기] */
async function autoNoteOf($: EngineInterface, ui: Ui, s: Settings) {
  const note = (await read($, auto))?.note ?? null
  if (note === null) return null
  const isStop = note === 'stuck' || note === 'again'
  return drawAutoNote(ui, autoNoteText(note, s, (await read($, usage))?.window), {
    resume: isStop ? () => void toggleAuto($) : null,
    dismiss: () => void setAuto($, a => ({ ...a, note: null })),
  })
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


/** 설정 탭 저장 — 이번에 바를 접었으면 다시 펴는 법을 토스트로(바의 ✕ · 명령과 같은 말) */
async function saveFromSettings($: EngineInterface, chosen: Settings): Promise<void> {
  const wasFolded = (await currentSettings($)).bandFolded
  await saveSettings($, chosen)
  if (!chosen.bandFolded) await update($, autoDismissed, () => null)
  if (chosen.bandFolded && !wasFolded) $.ui.toast(hiddenNote(chosen, await revealLabelOf($, chosen)), { timeoutMs: HIDDEN_NOTE_MS })
}

/** 설정 화면 버튼 동작 묶음 — $ 를 쓰는 동작은 이 파일에 있어야 한다(엔진은 $ 를 import 너머로 따라가지 않아 모듈을 안 띄운다) */
function settingsActs($: EngineInterface): SettingsActions {
  return {
    save: chosen => void saveFromSettings($, chosen),
    setTab: tab => void openSettingsTab($, tab),
    editCmp: draftNow => void update($, cmpDraft, () => draftNow),
    applyCmp: () => void applyCmpDraft($),
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
    openOverview: () => void openUsageTab($, 'main'),
    sizeError: msg => {
      timingErr = msg
      $.ui.invalidate('ui.render')
    },
  }
}

/** 패널 현황 본문 버튼 동작 묶음(ui-pane drawPaneMain) — barActs 와 같은 까닭으로 여기서 묶는다 */
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

/** 바 버튼 동작 묶음 — 바 짜기(ui-bar.tsx)는 $ 를 못 받아(import 너머로 못 넘김, 엔진 규칙) 여기서 묶어 넘긴다. 약속을 그대로 돌려준다 */
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
    // 이지 오토 저장 중 [취소]면 그 사슬도 놓는다(이번엔 쉼)
    cancelTidy: async () => {
      await autoEnd($)
      return update($, compactPhase, () => 'idle')
    },
    // 팝업 버튼 줄 왼쪽 끝 [오토 켜기 | 오토 끄기] — 누르면 팝업을 닫고 켠다
    toggleAuto: async () => {
      await update($, isConfirmingCompact, () => false)
      return toggleAuto($)
    },
    // 1.0: 컴팩트 · 클리어가 시작되면 요약 카드를 닫는다(그 자리에 진행 줄). 직접 쓰기 두 칸에 친 글(초안)은 먼저 저장하고 그 글로 보낸다
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
    // 누른 때의 설정 위에 — 그린 뒤 다른 세션이 바꿨을 수 있다
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

/** 확인 팝업 직접 쓰기 두 칸의 초안을 저장한다(누른 때의 설정 위에). 직접 쓰기를 골랐으면 참 */
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
    // B5 안내: ◔ 를 쓰던 사람인지는 다른 저장값을 쓰기 전에(띄우는 건 첫 질문 때 — turn.start)
    gaugeNote = await prepareGaugeNote($).catch(() => false as const)
    // 재로드도 session.start 다 — 여기서 턴 비용을 세면 턴이 아닌 구간이 섞인다
    await refreshUsage($, { categories: false, pushHistory: false })
    await loadSettings($)
    await loadAuto($).catch(() => {})
    await syncStatusLine($).catch(() => {})
    // 사용량 패널: 이 세션이 시작한 때(같이 열고 닫기는 그 뒤 일만 따른다), 새 세션이면 자동으로 열기
    paneStartAt = await $.clock.now()
    await autoOpenPane($).catch(() => {})
    // 기록 파일(수 MB)은 시작을 막지 않게 뒤에서 읽는다. 다 읽으면 사용량을 다시 잰다 —
    // 컴팩트 뒤 첫 요청 전이면 엔진 값이 컴팩트 전 크기라 흐름의 컴팩트 기록을 보고 추정값으로 바꾼다
    // 기본 적재(/context 분류)도 이때 한 번 잰다 — 계산식 최적의 재료
    // 질문별 비용 기록(N3): 파일에서 읽거나, 없으면 대화 기록에서 다시 만든다 — 기다리지 않는다
    // 세션 금액(B3)은 질문 기록을 읽은 뒤 정한다 — 옛 세션은 질문별 비용 합에서 시작
    // 1.0 전 기록이 한도까지 찼으면 밀린 질문 합을 대화 기록에서 채운다(fillOlder — 세션 누적과 견주니 맨 뒤)
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
    // 업데이트 칸(설치본만): 받아 둔 마켓 사본과 판을 견주고(네트워크 없음, 2안), 업데이트 뒤 첫 실행이면 패널 맨 위 한 줄(3안)
    void refreshUpdateInfo($).catch(() => {})
    // 패널을 이 세션 값에 맞추고(같이 열고 닫기면 다른 데스크톱 세션이 연 · 닫은 것도), 바꾼 설정을 따라간다
    $.clock.every(1500, () => {
      void syncPane($).catch(() => {})
      void loadSettings($).catch(() => {})
      // 고른 모델을 따라간다(모델 피커는 알려 주는 이벤트가 없다)
      void followModel($).catch(() => {})
      // "도는 중" 에이전트가 정말 도는지(끝남을 못 들은 때 대비) — 도는 중이 없으면 바로 돌아온다
      void reconcileAgents($).catch(() => {})
      // B10: 입력창 아래 한 줄(컴팩트 단계 · 다른 세션에서 바꾼 설정을 따라간다 — 글이 같으면 그냥 돌아온다)
      void syncStatusLine($).catch(() => {})
      // 0.9.1: 훅이 못 본 컴팩트(사람 /compact · 앱이 돌린 것 포함) — 컴팩트 뒤 다음 요청까지 컴팩트 전 크기가 남지 않게
      void watchCompact($).catch(() => {})
      // 이지 오토: 멈춘 사슬 정리 · 식은 캐시면 끔
      void autoWatch($).catch(() => {})
    })
    // 캐시 남은 분을 갱신한다 — 그리기만 다시, 모델 호출 없음. 오늘 · 이번 달 사용량을 켰으면 5분마다 다시 잰다(다른 세션 몫 · 날짜 넘김)
    $.clock.every(60000, () => {
      $.ui.invalidate('ui.render')
      void refreshSpend($, 300_000).catch(() => {})
    })
    void refreshSpend($).catch(() => {})
    return next(e)
  })

  // 세션에 들어옴(1.0 — 사용자 "세션 변경해서 들어갔을 때 깜빡이는 거 1회 · 빠르게 전환할 때 버그 안 생기게"): 데스크톱이 이 세션에
  // 붙으면 화면이 자리 잡은 뒤(flash.ts ARRIVE_SETTLE_MS — 세션을 바꾸는 동안은 앱이 대화를 그리느라 바 그리기가 밀려 깜빡임이 몰렸다,
  // 사용자 "급하게 밀리듯이") 바를 다시 그려 그때 급한 값을 한 번 강조(takeArrival). 나가면 기다리던 들어옴 · 도는 강조를 지운다.
  // 개발자 모드면 붙고 떨어지는 때를 적는다 — 앱이 세션을 바꿀 때 이 신호를 주는지 실물 확인용
  on('session.attach', async ($, e, next) => {
    const r = await next(e)
    try {
      if (e.surface === 'desktop') {
        markArrival(await $.clock.now())
        // 들어온 순간 한 번 다시 그린다 — 자리 잡기 · 글자 깜빡 동안 게이지를 가만히(ui-bar isFlashBusy)
        void update($, flashTick, (k: number) => k + 1).catch(() => {})
        arriveTimer?.cancel()
        // 자리 잡는 때를 조금 넘겨(시계가 일찍 와도 기다림에 걸리지 않게) 바만 다시 그린다
        arriveTimer = $.clock.after(ARRIVE_SETTLE_MS + 50, () => void update($, flashTick, (k: number) => k + 1).catch(() => {}))
        // 오래 쉰 세션에 들어오면 한도를 다른 세션의 더 최근 값으로(shareLimits) — 쉬는 동안 이 세션은 한도를 새로 못 받는다
        const u0 = await read($, usage)
        if (u0) {
          const rateLimits = await shareLimits($, u0.rateLimits, u0.lastActivityMs)
          if (JSON.stringify(rateLimits) !== JSON.stringify(u0.rateLimits)) await update($, usage, prev => (prev ? { ...prev, rateLimits } : prev))
        }
      }
    } catch {
      // 보기만 — 세션 붙기를 막지 않는다
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
        // 켜진 칸으로 그려 둔 바가 돌아왔을 때 그대로 보이지 않게 한 번 다시 그린다
        void update($, flashTick, (k: number) => k + 1).catch(() => {})
      }
    } catch {
      // 보기만
    }
    return r
  })

  // 한도(5시간 · 7일)는 응답마다 바뀐다 — 턴 끝에만 다시 읽으니 긴 턴 동안 띠가 앱의 사용량 창보다 낮았다(띠 12% ·
  // 앱 13%). 엔진이 한도가 1포인트 넘게 움직일 때 알려 주는 대로 그 줄만 바꾼다
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      // 방금 받은 응답 값이라 이 세션 것이 가장 최근 — 다른 세션도 쓰게 파일에(shareLimits)
      const rateLimits = await shareLimits(
        $,
        e.rateLimits.map(r => (r.resetsAt ? { kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt } : { kind: r.kind, percentUsed: r.percentUsed })),
        await $.clock.now(),
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
      // N7: 이 질문 동안 집계가 는 만큼에서 우리가 본 요청을 뺀 몫(중단으로 도중 끊긴 요청 · 질문 도중 앱 자체 요청)을 그 질문 ⚙ 줄로
      const mark = turnMark
      turnMark = null
      if (mark && mark.turnId === e.turnId) {
        const got = await appExtraSince($, mark)
        if (got && got.extra >= APP_MIN_USD) {
          await addAppCost($, got.extra, e.isAborted ? L('중단 · 도중 끊긴 요청 등', 'stopped · interrupted requests, etc.') : L('질문 도중 · 앱 자체 요청', 'during the question · app requests'))
        }
      }
      // 마지막 응답 글이 비면(마무리 도구로 끝난 턴) 글이 있던 마지막 요청의 답으로 칩 자리를 잡는다
      await closeTurn($, e.answer.trim() !== '' ? e.answer : lastStepAnswer, e.isAborted)
      lastStepAnswer = ''
      // 여기부터 다음 질문까지 엔진 집계가 는 만큼(우리가 본 요청을 빼고)이 앱 자체 요청
      await markIdle($)
      // 오늘 · 이번 달 사용량(켰을 때만) — 답이 끝날 때 기록이 늘었다. 기다리지 않는다
      void refreshSpend($).catch(() => {})
      // 이지 오토: 요약 턴 → 컴팩트, 이어가기 끝, 답 끝 길
      await autoAtTurnEnd($, e, turnNow).catch(err => log($, `auto turn end failed — ${String(err)}`))
    }
    // "정리 후 컴팩트": 정리 턴이 [컴팩트 진행] 으로 끝났을 때만 컴팩트. 세션이 보류했거나
    // 중단 · 오류 · 판정 없음이면 하지 않고 알린다. 훅 안에서 명령을 돌리면 이 턴을 기다리게 되니 턴이 끝난 뒤로 미룬다.
    // 이지 오토 저장 중은 위에서(autoAtTurnEnd)
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

  // ③ 작업 중 표시: 메인 턴이 시작되면 누적을 비운다
  on('turn.start', async ($, e, next) => {
    await ensureLang($)
    // 1.0 요약은 엿보기 — 사람이 다음 질문을 보내면 저절로 닫힘(시안 preview-1017d ★ · 사용자 "나머진 추천방향으로")
    if (e.agentId === undefined && (await read($, summaryCard))) await update($, summaryCard, () => false)
    // B5 안내 — 사람이 이 세션 화면에서 질문을 보낸 때 한 번
    if (gaugeNote && (e as { agentId?: string }).agentId === undefined) void showGaugeNote($).catch(() => {})
    // 보류 표시는 다음 질문까지만
    if (e.agentId === undefined && (await read($, compactPhase)) === 'held') await update($, compactPhase, () => 'idle')
    // 앞 답 뒤 30초 안에 돈 앱 자체 요청은 앞 질문에, 그 뒤(앞 질문 값을 고정한 뒤)는 이 질문에 — 여기부터는 이 질문의 요청이라
    // 기준을 거둔다
    const appCarry = await appCarryAtStart($)
    // 흐름 그래프의 [최근 질문 40] 경계 — 메인 대화의 질문만(타입엔 agentId 가 없지만 하위 에이전트 턴이 오면 뺀다)
    if ((e as { agentId?: string }).agentId === undefined) await writeFlow($, withQuestion(await readFlow($), await $.clock.now()))
    // 이 질문 이름(메인 대화만): 바로 앞에 보낸 질문(prompt.submit, 1분 안)의 그림 · 파일 수, 엔진이 글 없이 시작했으면 그때 받은 글.
    // 사용자(2026-10-17 "(이어서 진행) 이건 뭔지 모르겠음"): 빈 글 질문은 실제로 그림만 보낸 질문 · 앞 답 직후 보내 줄에 들어갔던 질문이었다
    const submitAt = await $.clock.now()
    if (e.agentId === undefined) await autoOnTurnStart($, e.turnId, e.text).catch(() => {})
    if (e.agentId === undefined) lastStepAnswer = ''
    const sent = e.agentId === undefined && pendingSubmit && submitAt - pendingSubmit.atMs < 60_000 ? pendingSubmit : null
    if (e.agentId === undefined) pendingSubmit = null
    const ownHead = promptHead(e.text)
    const head = ownHead || (sent ? promptHead(sent.text) : '')
    const attach = sent && (sent.isIdle || !ownHead) ? sent.counts : null
    await update($, live, () => ({
      turnId: e.turnId,
      steps: 0,
      cost: ZERO_COST,
      // 그래도 글도 그림도 없으면(엔진의 이어 가기) 그 이름으로 — 빈 글이면 질문별 비용에서 무엇인지 몰랐다
      prompt: attachHead(head, attach) || (e.agentId === undefined ? continuedName() : ''),
      contextTokens: 0,
      outputTokens: 0,
      details: [],
    }))
    if (appCarry > 0) await addAppCost($, appCarry, L('앞 답 30초 뒤 ~ 이 질문 시작', 'from 30s after the last answer to this question'))
    // N7: 짝 질문이 없던 하위 에이전트 값은 이 질문에
    if (orphanAgent.length > 0) {
      const carried = orphanAgent
      orphanAgent = []
      await update($, live, prev =>
        prev ? carried.reduce((t, a) => ({ ...t, cost: addCost(t.cost, a.cost), details: withAgentStep(t.details, a.agentId, a.label, a.cost, a.model, a.atMs) }), prev) : prev,
      )
    }
    // N7: 이 질문의 집계 기준(앞 몫을 센 뒤에 둔다 — 그 몫은 기준 앞이라 안 겹친다)
    const ledgerNow = await ledgerUsd($)
    turnMark = ledgerNow === null ? null : { turnId: e.turnId, ledger: ledgerNow, tracked: trackedUsd }
    return next(e)
  }).catch(($, e, next) => next(e))

  // 보낸 질문을 다음 질문 이름에 쓴다(위 pendingSubmit): 그림 · 파일은 글에 없어(엔진이 따로 준다) "🖼 그림 N장" — 그림만 보낸 질문이
  // "(글 없음)" 이었다. 엔진이 글 없이 턴을 시작하면 이 글이 이름. 도는 턴 안으로 들어간 글(turnId 있음)의 그림은
  // 그 뒤 질문이 글 없이 시작할 때만 붙인다
  on('prompt.submit', async ($, e, next) => {
    // 이지 오토: 사람 · 다른 세션 · 알림(plugin 아닌 출처)이 보냈다 — 우리 보내기는 이 훅에 안 온다
    if (e.origin?.kind !== 'plugin') await autoOnOther($).catch(() => {})
    const r = await next(e)
    try {
      if (r.drop === undefined) {
        const files = e.attachments ?? []
        const image = files.filter(a => a.type === 'image').length
        pendingSubmit = { text: e.text, counts: files.length > 0 ? { image, other: files.length - image } : null, isIdle: e.turnId === undefined, atMs: await $.clock.now() }
      }
    } catch {
      // 이름 붙이기는 보기만 — 질문 보내기를 막거나 두 번 보내지 않게 여기서 삼킨다
    }
    return r
  }).catch(($, e, next) => next(e))

  // 엔진이 다음 질문 제안을 만들어 띄운다 — 답 뒤 앱 자체 요청에 그 이름을 붙인다(보기만)
  on('prompt.suggest', async ($, e, next) => {
    if (e.origin.kind === 'suggestion') suggestedSinceMark = true
    return next(e)
  })

  // 요청 하나가 끝날 때마다 API 가 보고한 토큰으로 값을 더한다. 하위 에이전트 요청은 값만(컨텍스트 · 흐름엔 안 넣는다)
  on('turn.step', async function* ($, e, next) {
    await ensureLang($)
    // 이지 오토 긴 일 길: 요청 직전 뒤쪽을 넘었으면 끊는다(시계로 — 이 요청은 그대로 보낸다)
    if (e.agentId === undefined) await autoAtStep($, e.turnId).catch(() => {})
    const result = yield* next(e)
    // 글이 있던 메인 요청의 답을 기억한다(위 lastStepAnswer — 마무리 도구로 끝난 턴의 칩 자리)
    if (e.agentId === undefined && typeof result.answer === 'string' && result.answer.trim() !== '') lastStepAnswer = result.answer
    if (e.agentId !== undefined && result.usage) {
      try {
        const cost = costOf(result.usage, result.usage.model, 5, null, engineNow)
        if (cost) await recordAgentStep($, e.agentId, cost, result.usage.model)
      } catch {
        // 기록 실패가 턴을 멈추면 안 된다
      }
    }
    if (e.agentId === undefined && result.usage) {
      try {
        // 요율은 이 요청에 실제로 답한 모델 기준(API 가 보고한 model id), 쓰기는 이 세션 메인 대화의 유지 시간 요율
        const cost = costOf(result.usage, result.usage.model, ttlOf(await read($, usage)), null, engineNow)
        // 모델을 바꾼 뒤 첫 요청인가 — 아래에서 "모델 바뀜" 표시를 지우기 전에 잡아 둔다
        const switchedFrom = (await read($, usage))?.switchedFrom ?? null
        if (cost) await recordStep($, e.turnId, cost, result.usage, stepLabel(result.toolUses), result.usage.model, e.effort, switchedFrom)
        const t = result.usage
        const ctxNow = t.input_tokens + t.cache_read_input_tokens + t.cache_creation_input_tokens
        if (measureAfterCompact) {
          // 컴팩트 직후 크기(이 요청 — 기본 적재 + 남긴 대화 + 새 질문 글)와 그중 요약(= 이 요청이 캐시에서 못 읽고 새로 낸 몫, 흐름의
          // c.summary 와 같은 셈) — 이 PC 의 다음 계산식 재료(이 세션에서 컴팩트하기 전 세션들이 쓴다). 예전엔 직후 − 기본 적재라 첫
          // 질문 · 분류 차이만큼 작았다(3.5k). 0.6.0(N2) ~ 1.0 은 엔진 tokensAfter 가 있으면 이 요청을 안 썼다 — 그 값은 남긴 대화뿐이었다
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
        // 이지 오토: 우리 컴팩트 뒤 요청 수 · 첫 요청이 여전히 앞쪽 이상이면 멈춤
        await autoAfterStep($, ctxNow)
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
    // 1.0 데스크톱은 앱 작업 줄을 앱 그대로 — 이 질문 값은 입력창 바로 위 진행 칸(ui-answer liveStrip)에.
    // 예전엔 앱 글 칸에 금액을 붙여 썼는데, 도구 묶음이 돌기 시작하면 턴 표시가 앱의 도구 묶음 상태 줄(LiveGroupStatus)로 옮겨 가고 그 줄은 글
    // 고쳐 쓰기만 받고 그림은 버려(파란 점을 붙이자 금액째 사라짐 — 앱 코드 확인) "처음엔 보이다 꺼짐" 이었다. 터미널은 작업 줄 그대로
    if (e.surface !== 'terminal') return next(e)
    const now = await read($, live)
    if (!now || now.steps === 0) {
      return next(e)
    }
    // 1.0 칸 "진행 중 질문 칸"(spin — 터미널은 이 작업 줄 금액) — 끔이면 엔진 그대로(어느 화면이든)
    const sSpin = await currentSettings($)
    if (slimViewOf(sSpin).spin === 'off') {
      return next(e)
    }
    // 이 질문 값 · 그중 에이전트 몫 · 컨텍스트. 출력 토큰은 뺐다 — 판단에 안 쓰였다, 그 자리에 🤖.
    // 에이전트는 간단이면 개수만, 그 밖엔 "$ 포함"(답변 아래 · 패널과 같은 꼴)
    const agents = agentPart(now.details, viewOf(sSpin).info === 'full')
    const theirs = await next(e)
    const { Box, Text } = $.ui.resolve(e)
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
    // 1.0 슬림: "답변 끝 칩" 끔이면 앱 답변 그대로, 켜도 한 줄(자세히 펼침 없음 — 정말 최소)
    // 1.0 칸 "답변 끝 칩" — 끔이면 칩 없음(어느 화면이든), [▸ 자세히] 펼침은 정보량 전부일 때(슬림은 정보량 최소라 한 줄)
    if (slimViewOf(settings).chip === 'off') return theirs
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
    const mark = { isRecorded: false }
    hookCompact = mark
    await ensureLang($)
    const isMine = e.agentId === undefined && e.trigger !== 'precompute'
    if (isMine && (await read($, compactPhase)) !== 'compacting') await startCompacting($, compactKindOf(e.trigger))
    try {
      const result = await next(e)
      // 컴팩트 미리 계산(엔진이 다음 컴팩트를 위해 미리 요약)도 대화 기록에 없는 요청 — 앱 자체 요청 줄로
      if (e.agentId === undefined && e.trigger === 'precompute' && !result.skip && result.usage) {
        const pre = costOf(result.usage, (await read($, usage))?.model ?? (await $.session.model()), undefined, null, engineNow)
        if (pre) {
          trackedUsd += pre.usd
          await addAppCost($, pre.usd, L('컴팩트 미리 계산', 'compact precompute'))
        }
      }
      if (isMine && !result.skip) await recordCompaction($, e.trigger, result, mark)
      await refreshUsage($, { categories: false, pushHistory: false })
      return result
    } finally {
      if (isMine) await update($, compactPhase, () => 'idle')
    }
  }).catch(async (_$, e, next) => {
    // 다시 재기가 실패해도 컴팩트는 그대로 간다. 0.9.1: 훅이 못 돈 컴팩트(재진입 — 우리 $ 호출 아래, 또는 적기 전에 던짐)는 결과만
    // 받아 두고 다음 재기가 적는다 — 여기선 $ 가 거절될 수 있다
    const mark = hookCompact
    const result = await next(e)
    const wasRecorded = next.called && mark !== null && mark.isRecorded
    if (e.agentId === undefined && e.trigger !== 'precompute' && result && !result.skip && !wasRecorded) missedCompact = { trigger: e.trigger, result }
    return result
  })

  // 사람이 패널을 닫으면 닫아 둔다 — 같이 열기면 모든 데스크톱 세션에서, 아니면(기본 · 터미널) 이 세션만
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
  }).catch(($, e, next) => next(e)) // 저장이 실패해도 닫기는 그대로 간다

  // 설정의 켜기/끄기 스위치(0.5 묶음 2 R3 — Client 모듈 hooks/switch.tsx): 누르면 element "sw-<설정 키>" 로 온다. 값은 지금 설정에서
  // 뒤집고(스위치가 들고 있던 값이 낡았어도 맞게), 바뀐 값을 그 스위치의 새 props 로 바로 돌려준다(다시 그리기를 기다리지 않게)
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
      case 'paneAutoOpen':
      case 'paneShared':
        isOn = !s[id]
        await setPaneOption($, id, isOn)
        break
      case 'questionHover':
        isOn = !s.questionHover
        await saveFromSettings($, { ...s, questionHover: isOn })
        break
      // 0.9.1 U6: 진단 카드 질문 · 동작 글 빼기(설정이 아니라 이 카드 값)
      case 'diagRedact':
        isOn = !(await read($, diagCard)).redact
        await setDiagRedact($, isOn)
        break
      // S1(0.6.1 피드백): 애니메이션 스위치(옛 이름 움직임) — 켬 = system(OS 동작 줄이기는 따름), 끔 = reduce
      case 'motion':
        isOn = s.motion === 'reduce'
        await saveFromSettings($, { ...s, motion: isOn ? 'system' : 'reduce' })
        break
      // 0.6.0 바에 보일 칸 스위치 줄(✓ 칩 대신): 한도 전체 · 모든 세션 오늘 · 이번 달 · 답변 칩 자세히 · 칸 하나씩
      case 'limits':
        isOn = viewOf(s).parts.lim5 === 'off' && viewOf(s).parts.lim7 === 'off'
        await saveFromSettings($, setLimits(s, isOn))
        break
      case 'spendToday':
      case 'spendMonth': {
        const k = id === 'spendToday' ? 'today' : 'month'
        isOn = viewOf(s).parts[k] === 'off'
        await saveFromSettings($, setPart(s, k, isOn ? 'on' : 'off'))
        break
      }
      case 'chipDetail': {
        // 간단 · 자세히 화면이면 그 화면 값 — 못 바꾼다(스위치는 흐림)
        if (s.screen !== 'custom') return { props: { on: viewOf(s).info === 'full', disabled: true } }
        isOn = viewOf(s).info !== 'full'
        await saveFromSettings($, editView(s, v => ({ ...v, info: isOn ? 'full' : 'lean' })))
        break
      }
      default: {
        const part = id.startsWith('show-') ? BAND_PARTS.find(p => p.key === id.slice(5)) : undefined
        if (!part) return next(e)
        if (part.group === 'limits') {
          isOn = !bandShowOf(s)[part.key]
          await saveFromSettings($, setBandPart(s, part.key, isOn))
          break
        }
        // 비용 줄 · 질문 줄 칸은 커스텀 화면에서만(정해 둔 화면은 그 화면 값 — 흐린 스위치)
        if (s.screen !== 'custom') return { props: { on: bandShowOf(s)[part.key], disabled: true } }
        isOn = !bandShowOf(s)[part.key]
        await saveFromSettings($, setBandPart(s, part.key, isOn))
      }
    }
    return { props: { on: isOn, disabled: false } }
  })


  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // 패널 그리기가 던지면 데스크톱은 "Nothing to show yet — has not drawn" 만 보여 원인을 알 수 없었다(2026-10-13: 한 세션에서만 패널이
    // 안 열림). 던진 것은 패널에 빨간 글로 보이고 로그에도 남긴다
    try {
    await ensureLang($)
    setSurface(e.surface)
    const ui = $.ui.resolve(e)
    // 패널 제목은 열 때만 정해진다 — 앱이 기억한 옛 제목(옛 판 "사용량" · 다른 언어)이면 제목만 다시(엔진: 열린 id 를 다시 열면 제목만 바뀜,
    // L1 — 영어로 바꿔도 "사용량"). 같은 제목을 거듭 묻지 않게 마지막으로 바꾸려 한 제목을 둔다
    const wantTitle = paneTitle()
    if (typeof e.props.title === 'string' && e.props.title !== wantTitle && retitledTo !== wantTitle) {
      retitledTo = wantTitle
      void $.ui.open({ id: PANE, title: wantTitle }).catch(() => {})
    }
    if (oldEngine) return oldEngineNote(ui, oldEngine)
    const { Box, Button } = ui
    // 0.8.1 S9: 현황 컴팩트 카드 · 설정 미리보기도 설정 숫자 꼴로 — 바가 안 그려지는 동안(접힘)에도 맞게 패널이 직접 넣는다
    const sNowPane = await currentSettings($)
    setCtxUnit(sNowPane.ctxUnit)
    const isSettings = (await read($, usageTab)) === 'settings'
    // 업데이트 칸(설치본만 — 개발본은 null): 설정 탭 맨 아래 칸 · 새 판이면 설정 탭 이름에 점(2안) · 업데이트 뒤 첫 실행 알림(3안)
    // 디렉터리 설치본은 켤 때 읽기 전에도 "저절로 받음" 칸(버튼 없음) — idle 의 [업데이트 확인] 이 잠깐이라도 나오지 않게
    // 0.9.1 U5: 개발본(설치 자리 없음)도 버튼 · 서랍은 늘 — 단계는 dev(판 · 바뀐 것 · 문제 제보만)
    const updInst = await installNow($)
    const updNow = await read($, updateInfo)
    const upd: UpdateState = !updInst ? { ...updNow, phase: 'dev' } : updInst.marketplace === 'synced' ? { ...updNow, phase: 'synced' } : updNow
    // 오른쪽 여백: 터미널은 한 칸(마지막 칸에 쓰면 줄이 넘어가는 터미널이 있다), 데스크톱은 두 칸. 예전 데스크톱 1할(넓은 패널이면
    // 8칸 넘게)은 글 폭 어림이 실제보다 넓던 때의 땜질 — 렌더러 보정(1칸 = 1ch = CH_PX, 2026-10-14)으로 어림을 맞추고 줄였다(fb A1 오른쪽 빔)
    const isTerminal = e.surface === 'terminal'
    const pad = isTerminal ? 1 : 2
    const cols = Math.max(24, e.props.bodyColumns - pad)
    // 그림(막대 · 그래프) 폭 = 카드 안쪽 폭 — 카드 테두리 · 여백만큼 좁게. 터미널 칸 그림은 px ÷ 6 = 칸이라 상한 없이, 데스크톱은
    // 1칸 = CH_PX 로 SVG_MAX_PX 까지(예전 칸당 6px · 320px 상한이라 넓은 패널에서 오른쪽이 비었다 — fb A1)
    const widthPx = isTerminal ? Math.max(120, (cols - CARD_INSET) * 6) : Math.max(120, Math.min(SVG_MAX_PX, Math.floor((cols - CARD_INSET) * CH_PX)))
    const u = await read($, usage)
    const allSums = await read($, turnSummaries)
    const nowMs = u || allSums.length > 0 ? await $.clock.now() : 0
    const flowNow = await readFlow($)
    // 계산식 재료(컴팩트 직후 크기 · 요약 · 출력 · 입력 몫)와 최적 — 막대의 상주 · 컴팩트 판단 · 미룬 값 게이지 · 설정이 같은 값을 쓴다
    const opt = await read($, optimal)
    const inputsNow = opt?.inputs ?? null
    // 상주(처음부터 있던 몫 + 요약)는 지금 크기를 넘지 않게(N2 — 직후 추정이 지금보다 크면 막대가 넘쳤다)
    const permRaw = permanentOf(flowNow, (await read($, flowNote)) !== null, inputsNow?.after ?? null)
    const ctxForPerm = u?.contextTokens ?? null
    const perm = permRaw && ctxForPerm !== null && ctxForPerm > 0 ? { ...permRaw, tokens: Math.min(permRaw.tokens, ctxForPerm) } : permRaw
    const g = gridOf(e.surface)
    // 사용량 = 위에서부터: 컨텍스트 · 비용(다섯 줄 남짓, 자리 고정) → 질문별 비용(맨 위 진행 중 질문) → 컴팩트(게이지 · 판단 ·
    // 접힌 그래프) → 참고(요율 · 색 기준). 예전엔 진행 중 질문이 맨 아래라 안 보였다. 컴팩트 카드는 아래로
    // 내려가도 된다 — 띠의 컴팩트 버튼이 🟡/🔴 로 이미 알린다
    let body: unknown
    if (isSettings) {
      const sSet = sNowPane
      const estSet = u ? estimateFor(u, nowMs) : null
      // 화면 칸 미리보기: 지금 고른 화면 · 한도 줄 · 금액 색으로 이 세션 값을 바처럼(최대 크기)
      // 아래에 답변 아래 칩 견본(마지막 질문, 접힌 꼴) — 정보량에 따라 [▸ 자세히] 가 있고 없다
      const lastSum = allSums.length > 0 ? allSums[allSums.length - 1]! : null
      // 아직 잰 값 · 끝난 질문이 없으면(새 세션) 예시 값으로 — 빈 자리만으론 무엇이 보일지 몰랐다
      const pvModel = u?.model ?? ((await $.session.model().catch(() => '')) || 'claude-opus-5-5')
      const pvTurn = lastSum ?? sampleTurn(nowMs, pvModel)
      setBandOrder(sSet.bandOrder)
      const setTab = await read($, settingsTab)
      const pvU = u ?? sampleUsage(nowMs, pvModel)
      // 견본 짜기는 ui-pane settingsPreviews — 여기선 읽기만(떼어 내기 전 순서 그대로: 단계는 입력창 아래 한 줄 견본이 있을 때만)
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
        previews,
        // 이 세션이 한도를 받나: 받았으면 true, 요청이 끝났는데도 비었으면 false, 첫 응답 전이면 모름(null — 구독도 비어 있다)
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
      // O4: 현황 막대 둘(컨텍스트 · 컴팩트 시점)의 움직임 — 컴팩트 중 숨쉬기 · 끝에 옛 크기에서 줄어듦(설정 "애니메이션" 끔이면 글만)
      setPaneBarMotion({ compacting: phase === 'compacting', shrink: await shrinkNow($), on: sNowPane.motion !== 'reduce' })
      // 질문 내역은 패널 보기를 따른다: 간략이면 펼친 질문 · 진행 중 질문에 동작별 줄 없이 "요청 N회 · 총 $" 한 줄, 질문 글도
      // 줄여서
      const qDetail = (await paneModeNow($)) === 'simple' ? 'summary' : 'steps'
      // 질문 합계(1.0): 한도 밖으로 밀린 질문 합 · 도는 질문 · 세션 누적 — 비용 요약 · 질문별 비용 머리가 같은 값("질문 밖" 은 화면마다 한 곳)
      const tally: Tally = { older: await read($, turnsOlder), liveUsd: nowTurn?.cost.usd ?? 0, costUsd: u?.costUsd ?? null }
      // 짜기는 ui-pane drawPaneMain — 여기선 읽기만(떼어 내기 전 순서 그대로)
      const fullIds = await read($, stepsFull)
      const flowLoadedNow = await read($, flowLoaded)
      const flowNoteNow = await read($, flowNote)
      const effectsAllNow = await read($, effectsAll)
      const flowAllNow = await read($, flowAll)
      const open = await read($, cardsOpen)
      const expanded = await read($, expandedTurn)
      const historyAllNow = await read($, historyAll)
      const openNow = await read($, settingsOpen)
      // 이지 오토가 일하는 중이면 크기별 비용 표 그 구간 줄에 "오토"
      const autoBand = isAutoActive(await read($, auto)) ? { start: sNowPane.autoStart, end: sNowPane.autoEnd } : null
      // 맨 위 "모든 세션" 줄(0.5.1): 자세히 = 늘 오늘 · 이번 달, 간단 = 설정에서 켠 것만 — 바로 아래 "이 세션 · 누적 $" 와 짝.
      // 아직 아무도 안 쟀으면(모듈 다시 불러옴 등) 지금 잰다 — 도는 중이면 refreshSpend 가 건너뛴다
      const shownMode = await paneModeNow($)
      const allLine = await allSpendOf($, sNowPane, shownMode)
      if (allLine?.state === 'measuring') void refreshSpend($, 5_000, true).catch(() => {})
      // 패널 맨 아래 요율 줄의 "이 PC 는 10월 16일"(0.9.3) — 이번 달을 잰 값에서
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
      // 폭을 못 박는다 — 데스크톱은 줄을 안 바꾸는 글(버튼 이름 등)이 길면 안쪽 틀이 그만큼 넓어져 다른 글이
      // 넓어진 틀에서 줄을 바꾸고 패널 밖으로 잘렸다(화면 크기와 상관없이)
      <Box flexDirection="column" width={cols}>
        {/* 탭: 사용량 · 설정. 설정은 자주 안 열어 탭으로 — 자주 보는 건 사용량 한 줄기에 둔다(예전에 질문별
            비용을 따로 열었더니 오가기 불편했다) */}
        {drawPaneHead(
          ui,
          e.surface,
          { u, isSettings, paneMode, upd, isDrawerOpen, motion: sNowPane.motion !== 'reduce', shrink: paneShrink, phase: headPhase },
          { openTab: which => void openUsageTab($, which), setMode: mode => void setPaneMode($, mode), toggleDrawer: () => void toggleUpdateDrawer($) },
        )}
        {/* 업데이트 서랍(U4): 버전 · 상태 · [업데이트 확인]/[업데이트] · 문제 제보 · 버전별 바뀐 것(U1) — 탭을 바꾸거나 패널을 닫으면 닫힌다(U3) */}
        {isDrawerOpen ? drawUpdateDrawer(settingsActs($), ui, upd, await $.clock.now(), e.surface, await diagViewOf($, 'drawer')) : null}
        {/* 세로 상자라 본문이 패널 폭을 꽉 채운다 — 가로 상자(예전)면 본문이 내용 폭이라 카드 끝선이 탭 · 보기마다 달랐다(fb A3) */}
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
    // 0.9.0: 터미널은 이 줄에 키보드 초점이 안 가서(엔진 초점 고리는 바 · 패널만) 바 자리 한 줄(AbovePrompt)이 펴는 버튼을 맡는다
    if (e.surface === 'terminal') return inner
    const sMode = await currentSettings($)
    const isTucked = !isSlim(sMode) && (await isBandTucked($))
    await ensureLang($)
    setSurface(e.surface)
    const { Box } = $.ui.resolve(e)
    // 바가 펴져 있어도 같은 뿌리(ec-mode)로 감싼다 — 접혔을 때만 감싸면 바를 접고 펼 때마다 이 줄이 엔진 그대로 ↔ 우리 상자로 바뀌어
    // 앱이 입력창 아랫줄을 새로 만들었다
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
    // 접힌 바(✕ — 모든 세션, 컴팩트할 때 자동으로 펴기면 그때까지) — 띠 자리를 엔진에 돌려준다. 입력창 아래 버튼과 같은 판단
    const sNow = await currentSettings($)
    setBandOrder(sNow.bandOrder)
    // 엔진 설문(빈 입력창에서 숫자로 답하는 "1: Yes" 줄)이 띠 자리를 쓰는 동안도 비켜 준다
    if (e.props.hasSurvey || (!isSlim(sNow) && (await isBandTucked($)))) {
      // 데스크톱은 접혀도 펴져도 · 설문이 떠도 같은 뿌리(ec-band) — 엔진 몫(next)을 그 안에, 펴짐 = 바. 뿌리가 엔진 그대로 ↔ 바로 바뀌면
      // 앱이 입력창 위 자리를 통째로 새로 만들어 입력창이 깜빡였다. 터미널은 그대로. 1.0 진행 칸은 바를 접어도 대답하는 동안 보인다(설문 땐 비킴)
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
      // 0.9.0 터미널: 펴는 버튼을 바 자리에 한 줄로(ctrl+x tab 으로 닿는다) — 입력창 아래 모드 줄엔 키보드 초점이 안 가고, 마켓 판엔 단축
      // 명령도 없어 접은 바를 되살릴 길이 없었다(실제 CLI 로 확인). 데스크톱은 자리를 엔진에 돌려준다(모드 줄 버튼은 눌린다). 이지 오토 칩도 이 줄
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
    // 바 짜기는 ui-bar.tsx(drawBar) — 여기선 $ 로 읽는 값만 모아(읽는 순서는 떼어 내기 전 그대로) 넘기고, 버튼 동작은 barActs 로 묶는다
    const u = await read($, usage)
    const view = await read($, paneView)
    const isConfirming = !e.props.isWorking && (await read($, isConfirmingCompact))
    const nowMs = u ? await $.clock.now() : 0
    // 1.0 값 강조(flash.ts): 컨텍스트 · 세션 금액 · 캐시 색 단계가 오르면 값 글자 바탕 3번 깜빡 — 그리기마다 단계를 견주고(처음 본 값 ·
    // 내려감은 조용히), 오르면 0.3초 시계를 건다. 칸은 아래 drawingBar 가 그린 칸만 넘어간다
    // 이지 오토가 일하는 중이면 컨텍스트 값 깜빡임은 쉰다 — 사람을 부르는 알림은 오토에 맡긴다(명세 ③)
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
      // 세션에 들어와 자리 잡은 뒤 첫 그리기면(session.attach) 그때 오른 값이 아니어도 급한 값을 한 번(flash.ts takeArrival)
      const isArrive = takeArrival(nowMs, ranks, isMotion)
      if (isCtxUp || isSessUp || isCacheUp || isArrive) startFlashTicker($)
    }
    // 값 강조 시계가 올리는 수를 읽어 둔다 — 강조 동안 이 칸만 다시 그린다
    await read($, flashTick)
    const sums = await read($, turnSummaries)
    const now = e.props.isWorking ? await read($, live) : null
    const inputs = (await read($, optimal))?.inputs ?? null
    const phase = await read($, compactPhase)
    const kind = await read($, compactKind)
    const just = u?.isAfterCompact ? ((await read($, compactions)).at(-1) ?? null) : null
    const shrink = await shrinkNow($)
    const spendNow = await spendShownOf($, sNow)
    // 1.0 슬림 요약 한 줄(슬림 알림 자리 — 사용자 "슬림도 한 줄 볼 수 있어야"): 아래 버튼으로 연다. 저장 · 컴팩트 중엔 닫는다(진행 줄).
    // 보통 화면엔 요약이 없다 — 이동 흐름 A: 바가 곧 짧은 판, 게이지 = 사이드 패널 문(한 걸음)
    const isBusy = phase === 'compacting' || phase === 'tidying'
    const isSumOpen = e.surface !== 'terminal' && !isBusy && (await read($, summaryCard))
    const isSlimSummary = isSumOpen && isSlim(sNow)
    const isSlimDismissed = isSlim(sNow) ? await isSlimDismissedNow($) : false
    const drafts = { tidyDraft: await read($, tidyDraft), compactDraft: await read($, compactDraft) }
    // 클리어 경고 카드: 무엇을 잃는지 — 이 세션 질문 수(밀린 질문 포함, 밀린 수를 모르면 null)
    const older = isConfirming && (await read($, isAskingClear)) ? await read($, turnsOlder) : undefined
    const clearAsk = older === undefined ? null : { questions: older === null ? null : sums.length + older.count }
    // 1.0 진행 칸(데스크톱 · 칸 "진행 중 질문 칸" 켬): 이 질문 값은 바 아래 진행 칸에. 바 질문 줄(칸 "지난 질문 줄")은 진행 칸과 상관없이 늘 지난
    // 질문만 — 두 칸은 서로 독립, 처음 값은 예전 칸(작업 중 금액 ·
    // 지난 · 진행 중 질문) 값을 잇는다
    const isStrip = e.surface !== 'terminal' && slimViewOf(sNow).spin !== 'off'
    // 값 강조는 바를 그리는 동안만 읽힌다(flash.ts drawingBar — 그린 칸을 적어 두면 시계가 다음 칸으로)
    const bar = drawingBar(nowMs, () => drawBar(ui, e, { sNow, u, view, isConfirming, nowMs, sums, inputs, phase, kind, just, shrink, spendNow, isSlimDismissed, isSlimSummary, ...drafts, clearAsk, auto: autoBar }, barActs($)))
    const noteEl = await autoNoteOf($, ui, sNow)
    // 1.0 다른 플러그인 몫: 입력창 위 자리는 하나라 우리가 바만 돌려주면 체인에서 우리 아래 플러그인의 그림이 사라졌다(공식 code-modernization 도
    // 터미널에서 이 자리를 씀 — 사용자 2026-10-18 "나중에 다른 플러그인 왔을 때 간섭 고려해줘") — 그 몫(next)을 우리 바 위에 같이 그린다(진행 칸이
    // 입력창 바로 위에 붙게). 슬림이 위에 그릴 게 없으면(평소) 그 몫만 — 같은 뿌리(ec-band) 안에(접힌 바와 같은 까닭 — 입력창 깜빡임)
    // 아래 몫이 실패해도(그 플러그인 오류 · 아래에 답할 것이 없는 시험 세계) 우리 바는 그린다
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
