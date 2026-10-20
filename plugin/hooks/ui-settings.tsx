import type { ChangeGroup, CostShow, Optimal, ScreenView, Settings, Source, TidyStyleId, TtlConfig, UpdateState } from '../types'
import { approxUsd, cacheWarnFor, isSubCent, fmtTokens, fmtUsd, modelName, ratesFor, rewriteAllUsd, SESSION_TEXT, thresholds, ttlName, writeRate } from './cost'
import { isSlim, LAYOUTS, layoutName, layoutUse, PARTS, levelName, partName, partUse, setPart, BAND_MODES, BAND_PARTS, bandModeName, bandAutoUse, bandStateText, bandModeUse, bandPartName, bandShowOf, chooseScreen, editView, foldName, fmtUsd0, MONEY_COLOR_STEPS, nudgeSessionColor, paneAutoUse, paneSyncUse, infoName, infoUse, resetCustom, SCREEN_PRESETS, screenName, screenUse, screenStateText, setBandPart, setFolded, setLimits, viewOf, chooseTidy, customName, customUse, DEFAULT_SETTINGS, nudgeCache, CACHE_STEPS, CACHE_STEPS_5M, parseTokens, RANGE_BANDS, RANGE_ROWS, setCompactAt, thresholdsOf, TIDY_IDS, tidyStyles, tidySteps, usesCustom, BAND_ORDER_DEFAULT, moveEarlier, normalizeOrder, MONEY_ORDERS, moneyOf, withMoney, compactText, tidyBody, rangeBands, rangeRows, compactMax, contextWindowNow, autoCompactAt, revealWhere, autoBands, setAutoRange } from './settings'
import type { MoneyColorKey } from './settings'
import { COMPACT_MIN, penaltyAt, rangeThresholdsFor, thresholdsFor, WARN_RATIO } from './optimal'
import { tidyScript } from './tidy'
import { L } from './i18n'
import type { Lang } from './i18n'
import { ACCENT, STAR_COLOR, SEG_ON_EDGE, hoverTip, tipRow, PEN_WARN_PCT, PEN_BAD_PCT, penColorOf, isNotRecommended, penVerdict, phaseLook, pickButton, pulseDot, CARD, CARD_INSET, decoIcon, LIVE_HEX, nameColW, isStackedFor, lockedSeg, section, segButton, segGroup, rowLine, appSection, settingRow, onOffControl, onOffW, buttonW, selectW, choiceControl, choiceW, plainCard, gaugeEl } from './ui-common'
import type { Fold } from './ui-common'
import { fitLine } from './ui-band'
import { onTerminal } from './glyph'
import type { LineCell } from './ui-band'
import { bandNumText, cellsOf, ctxNumText, paneTitle, widthOf } from './text'
import { GAUGE_SHAPES } from './gauge'
import { autoIcon } from './ui-auto'
import type { GaugeShape } from './gauge'
import { statusLineUse } from './status-line'
import { diagOwnText, diagSummary, ISSUE_URL, nativePath } from './diag'
import type { DiagView } from './diag'

/** 게이지 꼴 이름(B8) */
function gaugeShapeName(g: GaugeShape): string {
  return g === 'bar'
    ? L('가로 막대', 'Bar')
    : g === 'ring'
      ? L('고리', 'Ring')
      : g === 'vbar'
        ? L('세로 막대', 'Vertical bar')
        : g === 'vcells'
          ? L('칸 막대 세로', 'Vertical steps')
          : L('칸 막대', 'Steps')
}
import type { Ui } from './ui-common'

/** ⚙ 설정 탭 — 컴팩트 시점(구간 · 직접 지정)과 컴팩트 문구 */

/** 비용표 "질문 1개" 칸의 요청 수 — 작업량과 상관없는 고정 기준 */
export const Q_STEPS = 10

/** 설정의 컴팩트 시점에서 고르는 중인 값 — [적용] 전까지 저장하지 않는다 */
export type CmpDraft = Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'> & { sizeText?: string }

/** 직접 지정 입력칸에 친 글을 크기로(읽히면 10만 ~ 100만 안으로), 못 읽거나 안 쳤으면 고른 크기 그대로 */
export function draftCompactAt(s: Settings, d: CmpDraft): number {
  const typed = d.sizeText === undefined ? null : parseTokens(d.sizeText)
  return typed === null ? d.compactAt : setCompactAt(s, typed).compactAt
}

/**
 * 설정: 컴팩트 시점 → 캐시 경고 → 컴팩트 문구. 컴팩트 시점은 맨 위에 "적용 중" 값, 그 아래 두 방식 중 하나:
 * - 구간(기본): 0~100만 비용표의 크기 띠 한 줄을 고른다. 시작부터 노랑("컴팩트하기 좋은 때"), 끝부터 빨강. 예전엔 최적 한
 *   점을 권했는데 컴팩트할 때마다 움직여 "이게 맞나" 싶었다 — 바닥이 평평해 그 사이 어디서 해도 차이가 작다(optimal.ts 머리말)
 * - 직접 지정: 입력칸에 쓴 크기가 빨강, 그 80% 부터 노랑. 최적보다 요청당 몇 % 더 드는지를 보인다
 * 고르기만 해선 저장되지 않고 [▶ 적용] 으로. 설명은 이름 칸 + 짧은 풀이 한 줄씩, 중요한 데만 색
 */
/** 설정 화면의 버튼 동작 — 화면 코드는 $ 를 못 받아(엔진 규칙) register.tsx 가 묶어 넘긴다 */
export type SettingsActions = {
  save: (next: Settings) => void
  editCmp: (next: CmpDraft | null) => void
  applyCmp: () => void
  typeTidy: (text: string) => void
  saveTidy: (text: string) => void
  /** 컴팩트 문구 ② /compact 뒤에 붙일 글 칸: 치는 중 · Enter(저장) */
  typeCompact: (text: string) => void
  saveCompact: (text: string) => void
  toggleRaw: () => void
  /** 설정 칸 접기 · 펼치기: compact · tidy · band · layout(바 안 상세 조정) · cache · lang */
  toggleFold: (key: string) => void
  setLang: (choice: Settings['lang']) => void
  /** 사용량 패널 옵션: 새 세션에서 자동으로 열기(paneAutoOpen) · 모든 세션 같이 열고 닫기(paneShared) */
  setPaneOption: (key: 'paneAutoOpen' | 'paneShared', isOn: boolean) => void
  /** 업데이트 칸(설치본만): [업데이트 확인] · [업데이트] · 펼침(바뀐 것 · 오류 원문) */
  checkUpdate: () => void
  applyUpdate: () => void
  toggleUpdate: (key: 'changes' | 'error' | 'note') => void
  /**
   * 진단 내용 카드(0.9.1 U6): 판 서랍 · 설정 › 일반 탭의 문제 제보 줄에서 연다(같은 자리 다시 = 닫기) · 질문 · 동작 글 빼기 · [복사](누른
   * 표면의 클립보드) · [파일로 저장]
   */
  diagOpen: (where: 'drawer' | 'gen') => void
  diagClose: () => void
  diagRedact: (isOn: boolean) => void
  diagCopy: (surface?: string) => void
  diagSave: () => void
  /** 저장한 진단 파일(1.0.2): [폴더 열기](파일 탐색기) · [경로 복사](누른 표면의 클립보드) */
  diagReveal: () => void
  diagCopyPath: (surface?: string) => void
  /** 컴팩트 시점 안내 줄의 [현황에서 고르기] — 현황 탭으로(0.6.0, 컴팩트 시점을 현황으로 옮김) */
  openOverview: () => void
  /** 설정 안 탭(S10, 0.8.1) */
  setTab: (tab: SettingsTab) => void
  /** 컴팩트 탭 컴팩트 구간 칸의 직접 입력 오류 한 줄(현황 컴팩트 시점과 같은 값) */
  sizeError?: (msg: string | null) => void
}

/**
 * 설정 안 탭(S10 · S11, 0.8.1 — 사용자 "화면이 미리보기 내용인 바인데 뒤에 바 공통 · 바 · 패널 등이 따로 있어 안 맞음 · 큰 단위로 좌우 탭, 그
 * 화면 하나에서 하나의 미리보기" + "한 화면에 못 담으면 부분별로 나눠 그 구간만큼 미리보기", 시안 C): 바 · 답변 칩 · 패널 · 컴팩트(문구 · 캐시) · 일반
 */
export type SettingsTab = 'bar' | 'chip' | 'pane' | 'compact' | 'gen'
export const SETTINGS_TABS: readonly SettingsTab[] = ['bar', 'chip', 'pane', 'compact', 'gen']

export function settingsTabName(t: SettingsTab): string {
  return t === 'bar' ? L('바', 'Bar') : t === 'chip' ? L('답변 칩', 'Answer chip') : t === 'pane' ? L('패널', 'Pane') : t === 'compact' ? L('컴팩트', 'Compact') : L('일반', 'General')
}

/** 설정 탭 미리보기 — register 가 그린다($ 로 읽는 값): 바 전체(제목 "?" 포함) · 줄마다(한도 · 비용 · 질문) · 답변 칩 */
export type SettingsPreviews = { bar: unknown; limits: unknown; cost: unknown; turn: unknown; chip: unknown }

/** 설정 탭 캐시 칸의 재료: 이 세션 유지 시간(분) · 기록에서 쟀나 · 무엇이 정하나 */
export type CacheInfo = {
  ttl: number
  measured: boolean
  config: TtlConfig | null
  /** 만료까지 남은 분(따뜻할 때) · 식었나 — 캐시 칸 "지금" 줄. 모르면 null · false */
  minsLeft?: number | null
  isCold?: boolean
}

export function drawSettings(
  act: SettingsActions,
  ui: Ui,
  s: Settings,
  opt: Optimal | null,
  draft: string | null,
  rawOpen = false,
  onToggleRaw: () => void = () => {},
  cmp: CmpDraft | null = null,
  ctxNow: number | null = null,
  surface = 'desktop',
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  previews: SettingsPreviews | null = null,
  hasLimits: boolean | null = null,
  compactDraft: string | null = null,
  tab: SettingsTab = 'bar',
  /** 일반 탭 끝에 붙일 줄(언어 — drawSettingsView 가 그린다) */
  genExtra: unknown[] = [],
  /** 컴팩트 탭 컴팩트 구간 칸의 직접 입력 오류(register timingErr) */
  sizeErr: string | null = null,
) {
  const { Box, Button, Code, Input, Select, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const save = act.save
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  // 고르기 버튼(방식 · 시작 · 끝 · 문구): 고른 것은 주 버튼(채움) — 공용 pickButton(데스크톱 ✓ 없음 · 터미널 ✓)
  const pick = (key: string, label: string, isOn: boolean, onPress: () => void) => pickButton(ui, key, label, isOn, onPress)
  // 하나만 고르는 줄의 칸(묶음 버튼 — segButton). 여러 개 켜는 칸은 pick 그대로
  const one = (key: string, label: string, isOn: boolean, onPress: () => void) => segButton(ui, key, label, isOn, onPress)
  // ── 앱 설정 꼴(0.5 묶음 2, 사용자 2026-10-15 "클로드 설정과 동질감 · 짜치는 띠 없이"): 줄 = 이름(+ 흐린 풀이 — 자세히에서만) ……
  // 오른쪽 부품. 부품이 넓어 이름 칸이 16칸보다 좁아지면 이름 아래로 내린다(ctrlW = 부품 폭 어림, 칸). nameEl = 이름을 색 글로 그릴 때
  // 0.6.0 실물: 줄 = 이름 …… 부품 한 줄. 풀이는
  // 데스크톱 = 이름에 마우스(앱 hover 카드 — 탭 초점에도 뜸), 터미널 = 맨 위 [풀이 보기] 를 켰을 때만 줄 아래 흐린 글
  const descOpen = isTerminal && open.descAll === true
  // 풀이가 있는 줄은 이름 칸을 24칸 넘게 남긴다 — 16칸이면 넓은 칩 줄(한도 줄)의 풀이가 한두 글자 폭으로 눌렸다(터미널)
  const stackFor = (name: string, ctrlW: number, hasDesc: boolean) => cols !== null && cols - 1 - Math.max(widthOf(name, isTerminal), hasDesc ? 24 : 12) - 2 < ctrlW
  const row = (key: string, name: string, desc: unknown, control: unknown, ctrlW: number, extra: unknown[] = [], nameEl?: unknown) => {
    const isOpen = open[`desc-${key}`] === true || descOpen
    // 풀이는 부품 아래에 펼친다(tipRow) — 열어도 줄을 쌓지 않아 부품이 제자리
    return tipRow(ui, key, name, control, extra, nameEl, desc, control !== null && stackFor(name, ctrlW, false), {
      isOpen,
      onToggle: () => act.toggleFold(`desc-${key}`),
    })
  }
  const segW = (labels: readonly string[]) => labels.reduce((sum, l) => sum + buttonW(l), 0) + 1
  const chipsW = (labels: readonly string[]) => labels.reduce((sum, l) => sum + buttonW(l) + 1, 0)

  // 0.6.0 실물: 설정 글 양은 정보량과 상관없이 같게 — 미리보기 · 캐시 칸 · 보내는 글은 늘, 줄 풀이는 마우스 올림 칩
  const isLean = false
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    if (!r) return null
    return which === 'write1h' ? rewriteAllUsd(size, r, opt?.shared ?? 0, ttl) : (size * r.read) / 1e6
  }
  // 컴팩트 시점은 현황 탭 컴팩트 카드에서 고른다(0.6.0) — 설정 탭엔 칸을 두지 않는다
  // ── 캐시: 유지 시간은 엔진이 요청마다 정한다(구독 요금제 사용량 안 1시간, API 키 · 사용량 초과 5분 —
  // 공식 문서 기본값, promptCacheTtl 설정 · 환경 변수로 바뀜). 기록에서 잰 값을 보이고, 못 쟀으면 "추정". 경고는 유지 시간마다
  // 따로(5분 캐시에 10분 경고면 늘 노랑). 유지 시간은 보이기만 — 바꾸던 칸은 0.6.1 피드백으로 뺐다(아래 ttlRow)
  const cfg = cache?.config ?? null
  const srcText = !cfg
    ? L('자동(구독은 1시간, API 키 · 초과 사용은 5분)', 'automatic (1 h on a subscription, 5 min on an API key or over the plan)')
    : cfg.source === 'force5m'
      ? L('환경 변수 FORCE_PROMPT_CACHING_5M(5분 고정)', 'env FORCE_PROMPT_CACHING_5M (5 min forced)')
      : cfg.source === 'env'
        ? L(`환경 변수 CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`, `env CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`)
        : cfg.source === 'setting'
          ? L(`설정 promptCacheTtl = ${cfg.value}`, `setting promptCacheTtl = ${cfg.value}`)
          : cfg.source === 'enable1h'
            ? L('환경 변수 ENABLE_PROMPT_CACHING_1H(1시간)', 'env ENABLE_PROMPT_CACHING_1H (1 h)')
            : L('자동(구독은 1시간, API 키 · 초과 사용은 5분)', 'automatic (1 h on a subscription, 5 min on an API key or over the plan)')
  const rNow = ctxNow !== null && ctxNow > 0 && modelId ? ratesFor(modelId, ctxNow) : null
  const minsLeft = cache?.minsLeft ?? null
  const isLateNow = minsLeft !== null && minsLeft < cacheWarnFor(s, ttl)
  const stateText = cache?.isCold
    ? L('캐시가 만료돼 다음 요청은 대화 전체를 다시 씁니다', 'The cache has expired, so the next request rewrites the whole conversation')
    : minsLeft !== null
      ? L(`캐시 만료까지 ${minsLeft}분 남음`, `Cache expires in ${minsLeft} min`)
      : L('첫 요청 뒤부터 잽니다', 'Measured after the first request')
  const readNow = ctxNow !== null && ctxNow > 0 ? usdAt(ctxNow, 'read') : null
  const rewriteNow = rNow ? (ctxNow! * writeRate(rNow, ttl)) / 1e6 : null
  const whyText =
    readNow !== null && rewriteNow !== null
      ? L(
          `이 대화(${fmtTokens(ctxNow!)})는 ${ttlName(ttl)} 동안 캐시에 남습니다. 그 안에 보내면 요청당 ${approxUsd(readNow)}, 넘기면 다시 써서 ${approxUsd(rewriteNow)} 가 한 번 더 듭니다.`,
          `This conversation (${fmtTokens(ctxNow!)}) stays cached for ${ttlName(ttl)}. Within it a request costs ${approxUsd(readNow)}; after it, rewriting costs ${approxUsd(rewriteNow)} once.`,
        )
      : L(
          `이 대화는 ${ttlName(ttl)} 동안 캐시에 남습니다. 그 안에 보내면 싸고, 넘기면 다시 써서 비쌉니다.`,
          `This conversation stays cached for ${ttlName(ttl)}. Within it requests are cheap; after it, a rewrite costs more.`,
        )
  // 유지 시간은 보이기만(0.6.1 피드백 — 사용자 "캐시 유지 시간 변경 기능은 빼줘, 의도 아니었음" · 디렉터리 검토 보류 "설정 파일 쓰기"): 지금 값 ·
  // 무엇이 정하나 · 1시간/5분의 대가. 바꾸려면 Claude Code 설정(promptCacheTtl) · 환경 변수에서 — mod 는 설정 파일을 쓰지 않는다
  const ttlRow = settingRow(
    ui,
    'cache-ttl',
    L('유지 시간', 'Lifetime'),
    <Box key="cache-ttl-desc" flexDirection="column">
      <Text dimColor wrap="wrap">
        {L(
          `지금 ${ttlName(ttl)}${cache?.measured ? '' : '(추정)'} · 정하는 곳: ${srcText}`,
          `Now ${ttlName(ttl)}${cache?.measured ? '' : ' (estimated)'} · set by: ${srcText}`,
        )}
      </Text>
      <Text dimColor wrap="wrap">
        {L(
          '1시간 캐시는 쓰기 값이 2배, 5분 캐시는 1.25배입니다. 그 시간을 넘겨 쉬면 다시 씁니다.',
          '1-hour cache writes cost 2×, 5-minute ones 1.25×. A longer break rewrites it.',
        )}
      </Text>
    </Box>,
    null,
  )
  const warnRow = (key: string, forTtl: number) => {
    const v = forTtl < 60 ? s.cacheWarnMin5m : s.cacheWarnMin
    const isNow = forTtl === (ttl < 60 ? 5 : 60)
    const steps = forTtl < 60 ? CACHE_STEPS_5M : CACHE_STEPS
    const labels = steps.map(m => L(`${m}분`, `${m} min`))
    return row(
      key,
      L(`${ttlName(forTtl)} 캐시 경고`, `${ttlName(forTtl)} cache warning`),
      L(`남은 시간이 이 값 아래면 노랑${isNow ? ' · 지금 이 세션' : ''}`, `Yellow below this much time left${isNow ? ' · this session' : ''}`),
      // R2: 분 = 드롭다운(값 목록 — −/+ 를 여러 번 누르지 않게). T1(0.7.0): 터미널은 가로 고르기 버튼
      choiceControl(
        ui,
        `${key}-pick`,
        steps.map((m, i) => ({ value: String(m), label: labels[i]! })),
        String(v),
        x => save(forTtl < 60 ? { ...s, cacheWarnMin5m: Number(x) } : { ...s, cacheWarnMin: Number(x) }),
      ),
      choiceW(labels),
    )
  }
  const stateLine = (
    <Box key="cache-state" columnGap={1} flexWrap="wrap">
      <Text bold {...(cache?.isCold ? { color: 'error' } : isLateNow ? { color: 'warning' } : {})}>
        {stateText}
      </Text>
      <Text dimColor>{L(`· ${ttlName(ttl)} 캐시${cache?.measured ? '' : ' 추정'}`, `· ${ttlName(ttl)} cache${cache?.measured ? '' : ' (est.)'}`)}</Text>
    </Box>
  )
  const whyLine = (
    <Box key="cache-why" flexDirection="column">
      <Text dimColor wrap="wrap">
        {whyText}
      </Text>
      {rNow ? (
        <Text dimColor wrap="wrap">
          {L(
            `지금 크기 ${fmtTokens(ctxNow!)} 를 다시 쓰면 1시간 ${fmtUsd((ctxNow! * writeRate(rNow, 60)) / 1e6)} · 5분 ${fmtUsd((ctxNow! * writeRate(rNow, 5)) / 1e6)}`,
            `Rewriting ${fmtTokens(ctxNow!)} now: 1 h ${fmtUsd((ctxNow! * writeRate(rNow, 60)) / 1e6)} · 5 min ${fmtUsd((ctxNow! * writeRate(rNow, 5)) / 1e6)}`,
          )}
        </Text>
      ) : null}
    </Box>
  )
  const cacheSection = plainCard(ui, 'set-cache', L('캐시', 'Cache'), [stateLine, ttlRow, warnRow('cache', 60), warnRow('cache5', 5), whyLine])

  // ── 컴팩트 문구: 1.0 부터 설정 칸이 아니라 [이지 컴팩트] 확인 팝업에서 고른다 — 찾으러 온 분께 한 줄 안내
  const tidyNote = (
    <Box key="tidy-note" flexDirection="column">
      <Text key="tidy-note-head" bold>
        {L('컴팩트 문구', 'Compact text')}
      </Text>
      <Text key="tidy-note-text" dimColor wrap="wrap">
        {L(
          `[이지 컴팩트]를 누르면 고를 수 있습니다. 고른 것은 다음에도 그대로입니다.`,
          `Pick one when you press [Easy Compact]. Your pick stays for next time.`,
        )}
      </Text>
    </Box>
  )

  // ── 화면 종류: 프리셋 셋 — 간단 · 자세히 · 커스텀. 바 칸 · 답변 칩을 같이 정해 탭 위에 둔다(S10 — 예전엔 "화면" 카드
  // 안에 미리보기 · 그 화면이 정하는 칸이 있고, 바 칸이 바 공통 · 바 · 패널 카드로 흩어져 있었다)
  const view = viewOf(s)
  const isCustomScreen = s.screen === 'custom'
  const editV = (change: (v: ScreenView) => ScreenView) => save(editView(s, change))
  // 무리 한 덩어리(이름 줄 + 들여 쓴 항목 줄) — 칸 안 선은 덩어리 사이에만
  const unit = (key: string, rows: unknown[]) => (
    <Box key={key} flexDirection="column">
      {rows}
    </Box>
  )
  // 스위치 줄 항목 이름: 무리 이름 아래 두 칸 들여(indent), 못 바꾸는 줄은 흐리게 — 글은 키로 못 찾아 상자에 키
  const subName = (name: string, isDim = false, indent = 2) => (
    <Box key={`sub-${name}`} paddingLeft={indent}>
      <Text {...(isDim ? { dimColor: true } : {})}>{name}</Text>
    </Box>
  )
  const moneyLabel = (o: readonly string[]) => o.map(k => (k === 'session' ? L('세션', 'Session') : k === 'today' ? L('오늘', 'Today') : L('이번 달', 'This month'))).join(' · ')
  // 화면 종류가 정하는 칸(간단 · 자세히 화면이면 흐린 스위치) — 그 칸이 있는 카드마다 까닭 한 줄
  const lockNote = (key: string) =>
    isCustomScreen ? null : (
      <Text key={key} dimColor wrap="wrap">
        {L(
          "현재는 프리셋 설정이라 바꿀 수 없습니다. 바꾸려면 화면 프리셋 설정에서 '커스텀'을 고르세요.",
          'This is a preset, so it can’t be changed here. Pick Custom under Screen preset to change it.',
        )}
      </Text>
    )
  // 1.0 칸 한 줄: 칸마다 끔 · 필요할 때 · 늘. 커스텀이면 묶음
  // 버튼, 정해 둔 화면(슬림 · 간단 · 자세히)이면 같은 칸들을 흐리게(lockedSeg — 못 바꿈, 바꾸려면 [커스텀]). 예전엔 고른 값 글 하나라 무엇을 고를 수
  // 있는지 몰랐다
  const partRow = (p: (typeof PARTS)[number]) => {
    const cur = view.parts[p.key]
    const control = isCustomScreen
      ? segGroup(ui, `part-${p.key}-seg`, p.states.map(v => one(`part-${p.key}-${v}`, levelName(p.key, v), cur === v, () => save(setPart(s, p.key, v)))))
      : lockedSeg(ui, `part-${p.key}-v`, p.states.map(v => ({ key: `part-${p.key}-${v}`, label: levelName(p.key, v), isOn: cur === v })))
    const w = segW(p.states.map(v => levelName(p.key, v)))
    return row(`part-${p.key}-row`, partName(p.key), partUse(p.key), control, w, [], subName(partName(p.key), !isCustomScreen))
  }
  const colorNames = [
    { name: L('노랑', 'yellow'), hex: SESSION_TEXT[0] },
    { name: L('주황', 'orange'), hex: SESSION_TEXT[1] },
    { name: L('빨강', 'red'), hex: SESSION_TEXT[2] },
  ]
  // T1(0.7.0): 터미널은 값 목록(최대 16개)을 늘어놓는 대신 [ − ] $100 [ + ] — 이름 · 버튼 둘 · 값 · 사이 칸
  const colorsW = onTerminal() ? colorNames.length * 22 + 2 : colorNames.length * (5 + selectW(['$100'])) + 2
  const units = [
    { id: 'size' as const, name: L('크기', 'Size') },
    { id: 'pct' as const, name: '%' },
    { id: 'both' as const, name: L('둘 다', 'Both') },
  ]

  // 금액 색 한 줄(세션 · 오늘 · 이번 달 — 1.0 오늘 · 이번 달 더함, 같은 꼴): 노랑 · 주황 · 빨강 기준을 고르는 칸 셋. 키는 세션 줄 그대로(color-0 …)
  const moneyColorsRow = (key: MoneyColorKey, rowKey: string, keyPrefix: string, name: string, use: string) =>
    row(
      rowKey,
      name,
      use,
      colorNames.map((c, i) => {
        const cur = s[key]
        const lo = i > 0 ? cur[i - 1]! : 0
        const hi = i < 2 ? cur[i + 1]! : Number.POSITIVE_INFINITY
        const vals = MONEY_COLOR_STEPS[key].filter(v => (v > lo && v < hi) || v === cur[i])
        const k = `${keyPrefix}-${i}`
        return (
          <Box key={k} columnGap={1} alignItems="center">
            <Text color={c.hex}>{c.name}</Text>
            {onTerminal() ? (
              <Box key={`${k}-step`} columnGap={1} alignItems="center">
                <Button key={`${k}-down`} label="−" variant="secondary" onPress={() => save(nudgeSessionColor(s, i as 0 | 1 | 2, -1, key))} />
                <Text>{fmtUsd0(cur[i]!)}</Text>
                <Button key={`${k}-up`} label="+" variant="secondary" onPress={() => save(nudgeSessionColor(s, i as 0 | 1 | 2, 1, key))} />
              </Box>
            ) : (
              <Select
                key={`${k}-pick`}
                options={vals.map(v => ({ value: String(v), label: fmtUsd0(v) }))}
                value={String(cur[i])}
                onSelect={v => {
                  const c2 = [...cur] as [number, number, number]
                  c2[i] = Number(v)
                  save({ ...s, [key]: c2 })
                }}
              />
            )}
          </Box>
        )
      }),
      colorsW,
    )
  // 세션 금액 색 · 컨텍스트 숫자 — 비용 줄 카드에 두고, 한눈 화면(비용 줄이 없다)은 바 전체 카드에(아이콘 바 칸도 이 값을 따른다)
  const sessionColorsRow = moneyColorsRow(
    'sessionColors',
    'session-colors',
    'color',
    L('세션 금액 색', 'Session cost'),
    L('바 · 패널의 세션 금액이 이 값을 넘으면 그 색.', 'The session cost on the bar and pane takes this color above each value.'),
  )
  // 1.0 오늘 · 이번 달 금액 색 — 세션 금액 바로 아래
  const todayColorsRow = moneyColorsRow(
    'todayColors',
    'today-colors',
    'today-color',
    L('오늘 금액 색', 'Today cost'),
    L(
      '오늘 금액(이 PC 모든 세션)이 이 값을 넘으면 이 색으로 바뀝니다.',
      'Today’s cost (all sessions on this PC) takes this color above this value.',
    ),
  )
  const monthColorsRow = moneyColorsRow(
    'monthColors',
    'month-colors',
    'month-color',
    L('이번 달 금액 색', 'This month cost'),
    L(
      '이번 달 금액(이 PC 모든 세션)이 이 값을 넘으면 이 색으로 바뀝니다.',
      'This month’s cost (all sessions on this PC) takes this color above this value.',
    ),
  )
  // B1(0.6.1 피드백 "컨텍스트 범위 값 · % 값으로 보이게 하는 옵션") · S9(0.8.1 — 현황 컴팩트 카드까지): 숫자 꼴. 비용 줄 칸(컨텍스트 · 컴팩트
  // 구간)을 바꾸니 비용 줄 미리보기 곁에
  const ctxUnitRow = row(
    'ctx-unit-row',
    L('컨텍스트 숫자', 'Context numbers'),
    L(
      '컨텍스트 크기를 281k 로 볼지, 28% 로 볼지, 둘 다 볼지 고릅니다.',
      'Show context sizes as 281k, as 28%, or both.',
    ),
    segGroup(ui, 'ctx-unit-seg', units.map(x => one(`ctx-unit-${x.id}`, x.name, s.ctxUnit === x.id, () => save({ ...s, ctxUnit: x.id })))),
    segW(units.map(x => x.name)),
  )
  // 아래 버튼 꼴(슬림 등): 늘 접힌 꼴이라 바 접기 · 펴기 · 입력창 아래 한 줄 칸이 없다
  const isButton = view.layout === 'button'
  // ── 탭 위: 화면 종류(+ 커스텀이면 처음 값 가져오기) → 탭 줄
  // 1.0(시안 preview-1017d 안 3 — 사용자 "슬림 화면 켜고 끄는 거에 따라서 화면 종류 설정이 … 양립할 수 없는 곳"): 슬림은 넷째 화면 — 한 줄에 넷,
  // 같이 켜질 수 없음이 꼴로 보인다(1.0 전 시안의 "슬림 화면 [끔 | 켬 | 커스텀]" 둘째 줄은 없앴다).
  // 시안 1017n ① 안 A: 화면 종류가 주인공 — 굵은 이름 아래 제
  // 줄에 묶음 버튼(왼쪽부터), 고른 화면의 한 줄 풀이는 늘 보인다("?" 없이). 아래 탭은 구분선 아래 한 단계(세부 설정 — 고른 화면)
  const screenBlock = (
    <Box key="screen-row" flexDirection="column" marginTop={1}>
      {/* 제목 글은 못 키운다 — 엔진 Text size(heading)를 데스크톱 실물이 안 받았다(2026-10-17). 층은 구분선 · "세부 설정 — 고른 화면" 제목으로 가른다 */}
      <Text bold>{L('화면 프리셋 설정', 'Screen preset')}</Text>
      <Box key="screen-row-seg">{segGroup(ui, 'screen-seg', SCREEN_PRESETS.map(p => one(`screen-${p}`, screenName(p), s.screen === p, () => save(chooseScreen(s, p)))))}</Box>
      <Box key="screen-use">
        <Text dimColor wrap="wrap">
          {screenUse(s.screen)}
        </Text>
      </Box>
    </Box>
  )
  const topRows = [
    screenBlock,
    isCustomScreen
      ? row(
          'custom-reset-row',
          L('처음 값 가져오기', 'Start from'),
          L('커스텀 값을 그 화면 값으로 되돌립니다', 'Reset Custom to that screen’s values'),
          (['slim', 'simple', 'detail'] as const).map(p => <Button key={`custom-from-${p}`} label={screenName(p)} variant="secondary" onPress={() => save(resetCustom(s, p))} />),
          chipsW((['slim', 'simple', 'detail'] as const).map(p => screenName(p))),
        )
      : null,
  ]
  // 탭 줄 — 화면 종류 아래 한 단계(시안 1017n 안 A → 실물 피드백 2026-10-17 "고른 바가 표시 안 됨 · '세부'도 누르는 것 같음 · 너무 딱 붙음 ·
  // 여기가 저기의 하위 메뉴라고 알 수 있게 구분선" → 안 1): 구분선(rowLine) 아래 "세부 설정 — <고른 화면> 화면" 제목, 탭은 화면 종류와 같은
  // 고름 꼴(고른 탭 테두리 — 묶음 틀은 없어 화면 종류보다 가볍다). plain 버튼 안 글 꼴(굵게 · 밑줄)은 데스크톱 실물이 안 그려 고른 표시가
  // 없었다. 한 번에 한 탭만 그린다
  const tabRow = (
    <Box key="set-tabs-row" flexDirection="column" marginBottom={1}>
      {rowLine(ui, 'set-tabs-line')}
      <Box key="set-tabs-head" columnGap={1} alignItems="center" flexWrap="wrap">
        <Text bold>{L('세부 설정', 'Detailed settings')}</Text>
        <Text dimColor>{L(`(${screenName(s.screen)} 화면)`, `(${screenName(s.screen)} screen)`)}</Text>
      </Box>
      <Box key="set-tabs" columnGap={1} alignItems="center" flexWrap="wrap">
        {SETTINGS_TABS.map(t => one(`set-tab-${t}`, settingsTabName(t), tab === t, () => act.setTab(t)))}
      </Box>
    </Box>
  )

  // ── 바 탭: 바의 줄 순서대로(전체 → 한도 → 비용 → 질문), 줄마다 그 줄 미리보기 바로 아래 그 줄을 바꾸는 칸(S11 — 맨 아래 칸을 바꿀 때도
  // 미리보기가 곁에 있다)
  // 바 꼴(1.0 안 3): 정해 둔 화면이면 그 꼴을 흐린 글로, 커스텀이면 [아래 버튼 | 한 줄 | 세 줄]
  const layoutRow = row(
    'bar-layout-row',
    L('바 꼴', 'Bar shape'),
    layoutUse(view.layout),
    isCustomScreen
      ? segGroup(ui, 'bar-layout-seg', LAYOUTS.map(l => one(`layout-${l}`, layoutName(l), view.layout === l, () => editV(v => ({ ...v, layout: l })))))
      : lockedSeg(ui, 'bar-layout-v', LAYOUTS.map(l => ({ key: `layout-${l}`, label: layoutName(l), isOn: view.layout === l }))),
    segW(LAYOUTS.map(layoutName)),
  )
  // ── 바 탭(1.0 — 시안 preview-1017d 안 3): 바(견본 · 바 꼴 · 크기 · 게이지 · 창 상태) → 입력창에 보일 것(칸마다 끔 · 필요할 때 · 늘) → 숫자 · 색.
  // 1.0 전엔 줄마다 카드(한도 줄 · 비용 줄 · 질문 줄 — 칸은 켬/끔, 한도 · 오늘 · 이번 달은 화면과 따로)였다
  const wholeBar = plainCard(ui, 'set-bar-all', L('바', 'Bar'), [
    previews?.bar ?? null,
    layoutRow,
    // 바 크기(전체 · 한 줄 — 바의 [—] · [□] 와 같은 값)는 세 줄 꼴에만
    view.layout === 'three'
      ? row(
          'band-mode-row',
          L('바 크기', 'Bar size'),
          bandModeUse(s.band),
          segGroup(ui, 'band-mode-seg', BAND_MODES.map(m => one(`band-${m}`, bandModeName(m), s.band === m, () => save({ ...s, band: m })))),
          segW(BAND_MODES.map(m => bandModeName(m))),
        )
      : null,
    // B8(0.8.1 사용자 "클로드 기본 컨텍스트 아이콘 말고 다른 아이콘 — 전부 제공해 주고 옵션으로, 기본은 가로 막대"): 게이지 꼴 — 바 · 패널 머리 ·
    // 확인 카드가 같이 바뀐다. 터미널엔 게이지 그림이 없어 줄을 뺀다(CLI 에서 안 쓰는 옵션은 안 보이게)
    isTerminal
      ? null
      : row(
          'gauge-shape-row',
          L('게이지 모양', 'Gauge shape'),
          L(
            '바와 패널에 나오는 컨텍스트 게이지 모양입니다. 고리는 앱의 컨텍스트 고리와 같은 모양입니다.',
            'The context gauge on the bar and pane. The ring matches the app’s own context ring.',
          ),
          choiceControl(ui, 'gauge-shape', GAUGE_SHAPES.map(g => ({ value: g, label: gaugeShapeName(g) })), s.gaugeShape, v => save({ ...s, gaugeShape: v as GaugeShape })),
          choiceW(GAUGE_SHAPES.map(gaugeShapeName)),
          // S12(0.9.1 — 사용자 "바 전체에 칸 막대 게이지 미리보기 표시 안 됨" · "게이지 모양별 컴팩트 중 · 완료"): 고른 꼴로 네 단계 견본 —
          // 평소 · 컴팩트할 때 · 늦어짐(깜빡) · 컴팩트 중(움직임). 크기는 지금 걸린 컴팩트 기준에서 단계마다 한 점
          [
            (() => {
              const t = thresholds()
              const motion = s.motion !== 'reduce'
              const isRange = t.isRange === true
              const samples = [
                { id: 'ok', ctx: t.ctxWarn * 0.5, name: L('평소', 'Normal'), blink: false, busy: false },
                { id: 'warn', ctx: (t.ctxWarn + t.ctxCut) / 2, name: isRange ? L('컴팩트할 때', 'Time to compact') : L('곧 컴팩트할 때', 'Compact soon'), blink: false, busy: false },
                { id: 'cut', ctx: t.ctxCut * 1.12, name: isRange ? L('늦어짐', 'Overdue') : L('권장', 'Advised'), blink: true, busy: false },
                { id: 'busy', ctx: t.ctxCut * 1.12, name: L('컴팩트 중', 'Compacting'), blink: false, busy: true },
              ]
              return (
                <Box key="gauge-strip" columnGap={2} rowGap={1} flexWrap="wrap" alignItems="center">
                  {samples.map(x => (
                    <Box key={`gauge-strip-${x.id}`} columnGap={1} alignItems="center">
                      {/* 범례는 그림(img) — 틀로 띄우면 패널을 열 때마다 빈 상자가 번쩍였다. 깜빡임 · 컴팩트 중 움직임은 그림 안에서만(다시 그리면 처음부터) */}
                      {gaugeEl(ui, surface, x.ctx, { key: `gauge-strip-${x.id}-svg`, alt: x.name, px: 16, blink: x.blink, busy: x.busy, motion })}
                      <Text dimColor>{x.name}</Text>
                    </Box>
                  ))}
                </Box>
              )
            })(),
          ],
        ),
    // 창 상태(켜기/끄기 = 스위치, R3): 바의 창 버튼 ✕ · 입력창 아래 버튼과 같은 값. 아래 버튼 꼴(슬림 등)은 늘 접힌 꼴이라 이 줄들이 없다
    isButton
      ? null
      : row(
          'band-fold-row',
          L('바 접어 두기', 'Keep the bar folded'),
          L(`바 오른쪽 위 ✕ 와 같습니다.`, `Same as the ✕ at the bar’s top right.`),
          onOffControl(ui, 'bandFolded', s.bandFolded, on => save(setFolded(s, on))),
          onOffW(),
        ),
    isButton ? null : row('band-autoopen-row', L('컴팩트할 때 바 펴기', 'Open the bar when compacting'), bandAutoUse(s.bandAutoOpen), onOffControl(ui, 'bandAutoOpen', s.bandAutoOpen, on => save({ ...s, bandAutoOpen: on })), onOffW()),
    // B10(0.9.0 사용자 "선택 버튼으로 물을 때 바가 내려가 내용이 안 보임"): 앱이 턴 끝 "다음 단계" 상자 동안 바를 뺀다(mod 로 못 막음) — 켜면
    // 입력창 아래 바닥 줄에 바의 요지 한 줄($.ui.status, hooks/status-line.ts). 기본 끔. 아래 버튼 꼴은 아래 버튼이 늘 있어 없다
    isButton ? null : row('status-line-row', L('입력창 아래 한 줄', 'Line below the input'), statusLineUse(), onOffControl(ui, 'statusLine', s.statusLine, on => save({ ...s, statusLine: on })), onOffW()),
  ])
  // 입력창에 보일 것(지금 바 꼴에 있는 칸만 — 지난 질문은 세 줄 꼴, 컴팩트 버튼 단계는 아래 버튼 꼴)
  // 요청이 끝났는데도 엔진이 한도를 안 준 세션(API 키 등 — 단정은 안 한다)엔 한도 · 리셋 칸을 뺀다: 켜도 그릴 게 없다
  const barParts = PARTS.filter(p => p.group === 'bar' && p.layouts.includes(view.layout) && !(hasLimits === false && (p.key === 'lim5' || p.key === 'lim7' || p.key === 'resets')))
  const partsCard = plainCard(ui, 'set-bar-parts', L('입력창에 보일 것', 'Shown at the input'), [
    unit('parts-unit', [
      <Text key="parts-head" dimColor wrap="wrap">
        {isButton
          ? L(
              "입력창 아래 버튼에는 컨텍스트와 두 칸까지 들어가고, 나머지는 위 알림에 나옵니다. '필요할 때'로 두면 주의가 필요할 때만 나타납니다.",
              "The button below the input holds the context and two parts; the rest show in the alert above. 'When needed' shows a value only when it needs attention.",
            )
          : L("'필요할 때'로 두면 주의가 필요할 때만 나타납니다.", "'When needed' shows a value only when it needs attention.")}
      </Text>,
      lockNote('parts-locked'),
      ...barParts.map(partRow),
    ]),
    row(
      'spend-row',
      L('모든 세션', 'All sessions'),
      L(
        '켜면 바 비용 줄과 간단 패널에도 보입니다. 이 PC 모든 세션 금액을 API 정가로 셈한 추정이고, 날짜는 UTC 기준이라 오전 9시에 바뀝니다.',
        'When on, also shown on the bar’s cost row and the Simple pane. It estimates every session on this PC at API list prices; days are split in UTC.',
      ),
      null,
      0,
    ),
  ])
  const looksCard = plainCard(ui, 'set-bar-cost', L('숫자 · 색', 'Numbers · colors'), [
    sessionColorsRow,
    todayColorsRow,
    monthColorsRow,
    row(
      'money-order-row',
      L('비용 표시 순서', 'Cost order'),
      L('바 비용 줄의 세션 · 오늘 · 이번 달 순서', 'Order of session · today · this month on the cost row'),
      choiceControl(ui, 'money-order', MONEY_ORDERS.map(o => ({ value: o.join(','), label: moneyLabel(o) })), moneyOf(s.bandOrder).join(','), v => save(withMoney(s, v.split(',')))),
      choiceW(MONEY_ORDERS.map(moneyLabel)),
    ),
    ctxUnitRow,
  ])
  const barTab = [wholeBar, partsCard, looksCard]

  // ── 답변 칩 탭: 견본 칩 · 답변 칩 자세히(화면 종류가 정함) · 질문 강조(데스크톱 — 마우스 올림)
  const chipTab = [
    plainCard(ui, 'set-chip', L('답변 끝 칩', 'Answer chip'), [
      previews?.chip ?? null,
      // 0.6.0 실물: 답변 칩 자세히(예전 "정보량")는 답변 끝 칩의 [▸ 자세히] 만
      unit('chip-unit', [
        lockNote('chip-locked'),
        // 1.0 채팅 칸(화면마다 — 슬림이던 칸): 답변 끝 칩 · 작업 중 금액 [끔 | 늘]
        ...PARTS.filter(p => p.group === 'chat').map(partRow),
        row(
          'info-row',
          L('답변 칩 자세히', 'Answer chip details'),
          L('답변 아래 칩에 [▸ 자세히]를 붙입니다.', 'Adds [▸ Details] to the chip under each answer.'),
          onOffControl(ui, 'chipDetail', view.info === 'full', on => editV(v => ({ ...v, info: on ? 'full' : 'lean' })), !isCustomScreen),
          onOffW(),
          [],
          subName(L('답변 칩 자세히', 'Answer chip details'), !isCustomScreen, 0),
        ),
      ]),
      // 질문 강조 — 마우스 올림은 데스크톱에만 있어 터미널에선 줄을 뺀다
      isTerminal
        ? null
        : row(
            'hover-row',
            L('질문 강조', 'Highlight'),
            L(
              '칩이나 패널의 질문 줄에 마우스를 올리면 그 답변에 파란 테두리가 생깁니다.',
              'Hover a chip or a question row in the pane to outline that answer in blue.',
            ),
            onOffControl(ui, 'questionHover', s.questionHover, on => save({ ...s, questionHover: on })),
            onOffW(),
          ),
    ]),
  ]

  // ── 패널 탭: 이 패널을 언제 여닫나
  const paneTab = [
    plainCard(ui, 'set-pane', paneTitle(), [
      row('pane-auto-row', L('새 세션에서 패널 열기', 'Open the pane in new sessions'), paneAutoUse(s.paneAutoOpen), onOffControl(ui, 'paneAutoOpen', s.paneAutoOpen, on => act.setPaneOption('paneAutoOpen', on)), onOffW()),
      // 같이 여닫기는 데스크톱 세션끼리 — 터미널 세션의 패널은 자기 것만이라 터미널에선 줄을 뺀다
      isTerminal
        ? null
        : row('pane-sync-row', L('모든 세션 패널 같이 여닫기', 'Open and close the pane in all sessions'), paneSyncUse(s.paneShared), onOffControl(ui, 'paneShared', s.paneShared, on => act.setPaneOption('paneShared', on)), onOffW()),
    ]),
  ]

  // ── 컴팩트 탭: 컴팩트 구간 · 바로 아래 이지 오토 구간(drawCompactTiming withAuto — 현황 컴팩트 시점과 같은 두 줄) · 컴팩트 문구 · 캐시.
  // 컴팩트 구간 칸은 현황 컴팩트 시점의 간단 줄과 같은 칸(같은 값)
  const zoneCard = plainCard(ui, 'set-zone', L('컴팩트 시점', 'When to compact'), [
    drawCompactTiming({ save, sizeError: msg => act.sizeError?.(msg), toggle: act.toggleFold }, ui, s, opt, ctxNow, surface, cols === null ? null : cols - CARD_INSET, cache, 'simple', sizeErr, open, null, true),
  ])
  const compactTab = [zoneCard, tidyNote, isLean ? null : cacheSection]

  // ── 일반 탭: 애니메이션(S1 — 게이지 · 점 · 캐릭터 · 현황 막대 · 값 깜빡임) · 문제 제보(0.9.1 U6) · 언어(drawSettingsView)
  const genTab = [
    plainCard(ui, 'set-gen', L('일반', 'General'), [
      // S1(0.6.1 피드백 "모션 시스템 / 줄임 용어가 안 맞음"): 앱 설정 낱말을 옮겼던 [시스템 | 줄임] → "움직임" 스위치. 앱 설정의 모션 값은 mod 가
      // 못 읽어 따로 — 켜도 OS 동작 줄이기면 그림은 멈춘다(그림 안 prefers-reduced-motion). 저장 값은 그대로(system = 켬, reduce = 끔).
      // 1.0: 값이 바뀔 때 바 글자 깜빡임(flash.ts)도 이 스위치 — 글자는 엔진이 다시 그려 OS 값을 못 읽으니 이 스위치로만. 이름은 "움직임" → "애니메이션"
      // 0.9.1: 터미널엔 움직이는 그림이 없어(게이지 · 캐릭터 · 막대 그림이 데스크톱만) 줄을 뺐다.
      // 1.0: 값 깜빡임은 터미널 바에서도 일어나 터미널에도 둔다 — 풀이는 터미널에서 하는 일(글자 깜빡임)만
      row(
        'motion-row',
        L('애니메이션', 'Animations'),
        isTerminal
          ? L('끄면 값이 바뀔 때 바 글자가 깜빡이지 않습니다.', 'Off: bar values no longer blink when they change.')
          : L(
              '끄면 게이지 · 진행 점 · 캐릭터 움직임과 글자 깜빡임이 멈춥니다.',
              'Off: the gauge, progress dots, character and value blink stay still.',
            ),
        onOffControl(ui, 'motion', s.motion !== 'reduce', on => save({ ...s, motion: on ? 'system' : 'reduce' })),
        onOffW(),
      ),
      ...genExtra,
    ]),
  ]

  // 명령 안내 줄은 뺐다 — 화면에서 다 바꿀 수 있어 사족이었다.
  const body = tab === 'chip' ? chipTab : tab === 'pane' ? paneTab : tab === 'compact' ? compactTab : tab === 'gen' ? genTab : barTab
  return (
    <Box flexDirection="column">
      {topRows}
      {tabRow}
      {body}
    </Box>
  )
}

/**
 * 설정 탭: 적용 범위 한 줄 + 권장 크기 · 캐시 경고 · 컴팩트 문구. 예전엔 비용 카드 안에서 펼쳤다 — 내용은 컴팩트 것인데 비용
 * 카드에 있었고, 펼치면 패널이 길어졌다. 자주 안 여는 곳이라 탭으로 뺐다.
 * 답이 도는 동안에도 잠그지 않는다 — 여기 버튼은 모두 값만 저장하고(질문을 보내거나 컴팩트하지 않는다) 다음 판단부터 쓰인다.
 * 저장하고 컴팩트가 도는 중이면 이미 보낸 문구는 안 바뀐다는 것만 알린다. 그 줄은 띠 · 진행 중 질문과
 * 같은 깜빡이는 점 · 색을 달고, 그동안 적용 범위 줄은 숨긴다 — 두 줄이 겹쳐 "바로 적용"과 "다음부터"가 엇갈려 읽혔다.
 * 글은 단계마다: 컴팩트 중은 /compact 직접 입력 · 자동 · [바로 컴팩트]도 같이 그리는데 거기엔 저장 턴이 없다 — 예전엔 늘
 * "저장하고 컴팩트가 도는 중" 이라 틀렸다. 컴팩트 문구는 [저장하고 컴팩트]의 저장 턴에만 쓰이니 둘 다 "다음 [저장하고 컴팩트]부터".
 * 컴팩트 중엔 띠와 같은 이름(compactKind): "지금 바로 컴팩트 중입니다." · "지금 /compact 중입니다."
 */
/**
 * 현황용 컴팩트 시점 동작 — 바로 저장 · 직접 입력 오류 한 줄 · 줄 풀이 펼치기(O1, 0.6.1 피드백: 현황 "?" 가 글이라 안 눌렸다 — 설정 탭
 * "?" 처럼 누르면 줄 아래 펼침, 펼침 값은 설정 탭과 같은 settingsOpen 의 desc-<줄 키>)
 */
export type TimingActions = { save: (next: Settings) => void; sizeError: (msg: string | null) => void; toggle?: (key: string) => void }

/**
 * 컴팩트 시점(0.6.0 — 설정 탭에서 현황 탭으로, 사용자 2026-10-15): 간단 = 구간 드롭다운 한 줄(끝에 "직접 입력…" → 숫자 입력칸), 자세히 =
 * 그 줄 + 고른 구간 금액 · ★ 추천 · 비추천 · 색 있는 크기별 비용 표 · 풀이. 고르는 순간 저장(적용 · 취소 없음). 현황 보기
 * [간단|자세히] 가 손잡이 하나(정보량 옵션과 무관)
 */
export function drawCompactTiming(
  act: TimingActions,
  ui: Ui,
  s: Settings,
  opt: Optimal | null,
  ctxNow: number | null,
  surface: string,
  cols: number | null,
  cache: CacheInfo | null,
  mode: 'simple' | 'detail',
  sizeErr: string | null = null,
  open: Record<string, boolean> = {},
  /** 이지 오토가 이 세션에서 일하는 중이면 그 구간 — 크기별 비용 표 그 줄 끝에 아이콘 + "오토" */
  autoBand: { start: number; end: number } | null = null,
  /** 컴팩트 구간 줄 바로 아래 이지 오토 구간 줄 — 설정 컴팩트 탭 · 현황 컴팩트 시점 */
  withAuto = false,
) {
  const { Box, Button, Input, Select, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  const stackFor = (name: string, ctrlW: number, hasDesc: boolean) => cols !== null && cols - 1 - Math.max(widthOf(name, isTerminal), hasDesc ? 24 : 12) - 2 < ctrlW
  // 터미널은 마우스 올림이 없어 줄 풀이를 뺀다 — 단 풀이가 곧 내용인 줄(★ 추천 · 비추천)은 이름 아래 흐린 글로(0.6.0 CLI 확인: "비추천" 이름만
  // 남고 어느 구간인지가 빠졌다). O1(0.6.1 피드백): "?" 는 설정 탭처럼 누르는 버튼 — 누르면 줄 아래 펼침(터미널도 [ ? ] 로 같은 길)
  const toggleOf = (key: string) => (act.toggle ? { isOpen: open[`desc-${key}`] === true, onToggle: () => act.toggle!(`desc-${key}`) } : undefined)
  const row = (key: string, name: string, desc: unknown, control: unknown, ctrlW: number, extra: unknown[] = [], nameEl?: unknown, isContent = false) =>
    isTerminal && isContent
      ? settingRow(ui, key, nameEl ?? name, desc, control, extra, control !== null && stackFor(name, ctrlW, true))
      : tipRow(ui, key, name, control, extra, nameEl, isTerminal && !act.toggle ? null : desc, control !== null && stackFor(name, ctrlW, false), toggleOf(key))
  // 0.6.0: 고르는 순간 저장. 예전 "고르는 도중 띠가 따라 움직임" 불만은
  // 구간 줄 버튼으로 둘러볼 때였다 — 드롭다운은 고름 = 결정
  const d: CmpDraft = { follow: s.follow, rangeStart: s.rangeStart, rangeEnd: s.rangeEnd, compactAt: s.compactAt }
  const dAt = s.compactAt
  const edit = (next: CmpDraft) => act.save({ ...s, follow: next.follow, rangeStart: next.rangeStart, rangeEnd: next.rangeEnd, compactAt: draftCompactAt(s, next) })
  // 고르는 값으로 걸릴 기준(노랑 · 빨강) — 긴 프롬프트 경계(Haiku 5.5)로 묶인 값까지
  const dt = d.follow ? rangeThresholdsFor(d.rangeStart, d.rangeEnd, modelId, s.cacheWarnMin) : thresholdsFor(dAt, modelId, s.cacheWarnMin)
  // 금액 · 판정 줄을 나눌 폭(칸): 간단 = 이 세션 카드 "지금" 이름 칸 옆(drawSummary — 좁으면 이름을 위에 쌓아 카드 폭), 자세히 = 컴팩트
  // 카드 타일 안. cols = 패널 − 카드
  const leadW = nameColW([L('질문', 'Questions'), L('지금', 'Now')])
  const textW = cols === null ? null : mode === 'simple' ? (isStackedFor(cols + CARD_INSET, leadW) ? cols : cols - leadW - 1) : cols - CARD_INSET

  // 방식 묶음 버튼은 뺐다(0.6.0) — 구간 드롭다운 끝 "직접 입력…" 이 같은 일
  const capNote =
    opt?.capped != null
      ? L(` ${model}는 ${fmtTokens(opt.capped)}를 넘으면 요금이 5배라 그 아래로 묶습니다.`, ` ${model} costs 5× above ${fmtTokens(opt.capped)}, so it stays below that.`)
      : ''
  // 최적 대비(이 세션 값): 그 크기에서 컴팩트하면 요청당 평균이 비용이 가장 적은 크기보다 몇 % 더 드나
  const penOf = (size: number) => (inputs && opt?.model ? (penaltyAt(size, opt.model, inputs, opt.growth)?.pct ?? null) : null)

  // 비용표 칸(데스크톱은 칸 폭을 상자로 맞춘다) · 크기에서 요청 1회(캐시 읽기) · 캐시 식으면(이 세션 유지 시간의 쓰기 요율로 전체 다시)
  const cell = (key: string, width: number, el: unknown) => (
    <Box key={key} width={width} flexShrink={0}>
      {el}
    </Box>
  )
  // 캐시 식으면 = 공통 앞부분(다른 세션이 데워 둠)은 읽기, 나머지 다시 쓰기 — 띠 · 확인 카드와 같은 셈(cost.ts rewriteAllUsd)
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    if (!r) return null
    return which === 'write1h' ? rewriteAllUsd(size, r, opt?.shared ?? 0, ttl) : (size * r.read) / 1e6
  }
  const pctText = (p: number | null) => (p === null ? '—' : p < 0.5 ? '0' : `+${Math.round(p)}`)
  // 바꾼 값이 있으면 확인창처럼: 무엇으로 바뀌는지 한 줄 + 오른쪽 아래 큰 [▶ 적용] [✕ 취소] — 작은 버튼 둘이 줄 끝에 붙어
  // 있으니 눈에 안 들어왔다. 버튼 크기는 앱이 정해 굵은 글자와 양옆 여백(줄바꿈 없는 공백)으로 키운다
  const pad = (text: string) => `  ${text}  `
  // 적용 중인 값은 카드 맨 위 한 줄 — 방식 버튼 아래 녹색 "지금 구간" 은 왜 녹색인지, 무엇이 "지금" 인지(지금 컨텍스트 줄과)
  // 헷갈렸다
  const appliedText = s.follow
    ? L(`구간 ${fmtTokens(s.rangeStart)} ~ ${fmtTokens(s.rangeEnd)}`, `range ${fmtTokens(s.rangeStart)} – ${fmtTokens(s.rangeEnd)}`)
    : L(`직접 지정 ${fmtTokens(s.compactAt)}`, `fixed ${fmtTokens(s.compactAt)}`)
  // 지금 컨텍스트도 이 줄에 크기만 — 비용표 사이에 끼운 줄은 띠 버튼 줄처럼 생겨 눌러 보게 됐다. 색은 적용 중인
  // 기준으로: 시작(노랑)을 넘으면 노랑, 끝(빨강)을 넘으면 빨강
  const appliedT = thresholdsOf(s, modelId)
  // 정보량 최소(간단 · 커스텀에서 고름)면 컴팩트 시점도 최소로 — 표는 크기 구간 · 판정 · 적용 중만,
  // 읽기 1회 · 질문 1개 · 캐시 식으면 · 최적 대비 % · 계산 값 풀이는 자세히에서
  const isLean = mode === 'simple'
  const ctxColor = ctxNow === null ? undefined : ctxNow >= appliedT.ctxCut ? 'error' : ctxNow >= appliedT.ctxWarn ? '#d9722b' : undefined
  // 적용 중인 값은 카드 제목 띠로 옮겼다(접든 펴든 늘 — 표 줄 끝 "적용 중" 칸 대신, 2026-10-14 uxi 1.1). 여기엔 지금 크기 · 읽기 1회만
  const appliedRow = !(ctxNow !== null && ctxNow > 0) ? null : (
    <Box key="cmp-applied" columnGap={1} alignItems="center" flexWrap="wrap">
      {ctxNow !== null && ctxNow > 0 ? <Text>{L('현재 컨텍스트', 'Current context')}</Text> : null}
      {ctxNow !== null && ctxNow > 0 ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtTokens(ctxNow)}
        </Text>
      ) : null}
      {/* 지금 크기에서 읽기 1회 — 비용표의 "읽기 1회" 칸과 같은 값. 바의 "요청당" 은 실제 값(9a)이라 이름을 갈랐다 */}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text dimColor>·</Text> : null}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? <Text>{L('읽기 1회', 'One read')}</Text> : null}
      {!isLean && ctxNow !== null && ctxNow > 0 && usdAt(ctxNow, 'read') !== null ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtUsd(usdAt(ctxNow, 'read')!)}
        </Text>
      ) : null}
    </Box>
  )
  const draftText = d.follow
    ? L(`구간 ${fmtTokens(dt.ctxWarn)} ~ ${fmtTokens(dt.ctxCut)}`, `range ${fmtTokens(dt.ctxWarn)} – ${fmtTokens(dt.ctxCut)}`)
    : L(`직접 지정 ${fmtTokens(dt.ctxCut)}`, `fixed ${fmtTokens(dt.ctxCut)}`)
  const applyArea = null
  // 설명은 이름 칸 + 짧은 풀이 한 줄씩 — 한 문단 긴 글은 읽히지 않았다.
  // 이름 칸 = 그 카드에서 가장 긴 이름 + 1(termW — 카드마다 그리기 직전에 정한다). 예전 12칸 고정은 짧은 이름엔 비고 영어 긴 이름은
  // 두 줄로 꺾였다(2026-10-14 uxi C · fb A2). 좁은 패널이면 이름을 위에 쌓는다 — 값 · 버튼 자리가 15칸 남짓으로 줄었다
  let termW = 12
  // 이름을 쌓을지는 그 카드 이름 폭(termW)으로 — 그리는 때마다 본다
  const stacked = () => isStackedFor(cols, termW)
  const descEl = (desc: unknown) =>
    typeof desc === 'string' ? (
      <Text dimColor wrap="wrap">
        {desc}
      </Text>
    ) : (
      desc
    )
  const term = (key: string, name: string, desc: unknown, nameColor?: string) =>
    stacked() ? (
      <Box key={key} flexDirection="column">
        <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>
        <Box columnGap={1} flexWrap="wrap">
          {descEl(desc)}
        </Box>
      </Box>
    ) : (
      // 터미널은 풀이가 두 줄이면 이름이 가운데(둘째 줄)로 내려가 엇갈려 보였다 — 첫 줄에 맞춘다
      <Box key={key} columnGap={1} alignItems={isTerminal ? 'flex-start' : 'center'}>
        {cell('t', termW, <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>)}
        <Box flexShrink={1} minWidth={0} columnGap={1} flexWrap="wrap">
          {descEl(desc)}
        </Box>
      </Box>
    )
  // 컴팩트 시점 칸의 이름들 — 이 칸을 그리는 동안의 이름 칸 폭
  termW = nameColW([
    L('★ 추천', '★ Suggested'),
    L('비추천', 'Not advised'),
    L('최적보다', 'Over best'),
    L('읽기 1회', 'One read'),
    L('질문 1개', 'Question'),
    L('캐시 식으면', 'Cold cache'),
    L('★ 최적', '★ Best'),
    L('계산 값', 'Inputs'),
    model,
    L('기본 구간', 'Default range'),
    L('색', 'Colors'),
  ])
  // 색 문턱 설명: 노랑 · 빨강 글자에 그 색. 문턱(+10 · +50%)은 잰 값이 아니라 정한 규칙이라 "가정" 을 달지 않는다 — 숫자가
  // 그대로 보인다. 추정인 건 최적 쪽이라 "예상 최적"
  const colorDesc = (lead: string, warn: string, bad: string, tail: string) => [
    lead ? (
      <Text key="l" dimColor>
        {lead}
      </Text>
    ) : null,
    <Text key="w" color="warning">
      {warn}
    </Text>,
    <Text key="s" dimColor>
      ·
    </Text>,
    <Text key="b" color="error">
      {bad}
    </Text>,
    tail ? (
      <Text key="n" dimColor>
        {tail}
      </Text>
    ) : null,
  ]
  // 계산 값: 가정인 것만 "(가정)" — 잰 값의 출처까지 다 적으니 줄이 길었다
  const guess = L('(가정)', ' (assumed)')
  const guessMark = (src: Source | undefined) => (src === 'guess' ? guess : '')
  const calcLine =
    inputs && opt
      ? term(
          'cmp-inputs',
          L('계산 값', 'Inputs'),
          L(
            `${model} · 컴팩트 후 ${fmtTokens(inputs.after)}${guessMark(opt.src.after)} · 요청당 +${fmtTokens(opt.growth)}${opt.growthSrc === 'session' ? '' : guess}${opt.onceUsd !== null ? ` · 컴팩트 한 번 ${fmtUsd(opt.onceUsd)}${opt.src.output === 'guess' || opt.src.save === 'guess' ? guess : ''}` : ''}`,
            `${model} · after compact ${fmtTokens(inputs.after)}${guessMark(opt.src.after)} · +${fmtTokens(opt.growth)} per request${opt.growthSrc === 'session' ? '' : guess}${opt.onceUsd !== null ? ` · one compact ${fmtUsd(opt.onceUsd)}${opt.src.output === 'guess' || opt.src.save === 'guess' ? guess : ''}` : ''}`,
          ),
        )
      : null
  const starLine = inputs && opt ? term('cmp-how', L('★ 최적', '★ Best'), L('읽기와 컴팩트 비용을 합쳐 가장 적게 드는 크기', 'Size with the lowest read and compact cost combined'), STAR_COLOR) : null
  const capLine = capNote ? term('cmp-cap', model, capNote.trim()) : null
  // 간단 화면의 풀이는 한 줄 — 비용 칸 · 계산 값은 자세히 화면에
  // 글은 키로 못 찾아(시험 · 다른 mod) 상자에 키를 단다
  const leanNote = (
    <Box key="cmp-lean" marginTop={1}>
      <Text dimColor wrap="wrap">
        {L('★ 최적 · 좋음 · 보통 · 비추천은 이 세션 값으로 판정합니다.', '★ Best, good, fair and not advised are judged from this session.')}
      </Text>
    </Box>
  )
  // 질문 1개 풀이(자세히): 10회 가정 · 이 세션 실제 평균 요청 수로 센 100k ~ 1M 범위 — 숫자에 색
  const perQAll = opt?.perQuestion ?? null
  const qRange = (steps: number) => {
    const lo = usdAt(rangeRows()[0]!, 'read')
    const hi = usdAt(rangeRows()[rangeRows().length - 1]!, 'read')
    const extra = perQAll?.extraUsd ?? 0
    return lo === null || hi === null ? null : ([steps * (lo + extra), steps * (hi + extra)] as const)
  }
  const sessionQ = perQAll ? qRange(perQAll.steps) : null
  const qDesc = [
    <Text key="q-a" bold color={ACCENT}>
      {L(`요청 ${Q_STEPS}회 가정`, `${Q_STEPS} requests assumed`)}
    </Text>,
    <Text key="q-b" dimColor>
      {L(
        `그 크기로 요청 ${Q_STEPS}회를 읽는 값입니다(에이전트 빼고). 크기끼리 견주는 기준입니다.`,
        `Reading that size for ${Q_STEPS} requests (agents excluded). A yardstick for comparing sizes.`,
      )}
    </Text>,
    ...(perQAll && sessionQ
      ? [
          <Text key="q-c">{L('이 세션 질문은 평균', 'This session averages')}</Text>,
          <Text key="q-d" bold color="warning">
            {L(`요청 ${perQAll.steps.toFixed(1)}회`, `${perQAll.steps.toFixed(1)} requests`)}
          </Text>,
          <Text key="q-e">{L(`→ 질문 1개 ${fmtTokens(rangeRows()[0]!)} ~ ${fmtTokens(rangeRows()[rangeRows().length - 1]!)}`, `→ one question at ${fmtTokens(rangeRows()[0]!)} – ${fmtTokens(rangeRows()[rangeRows().length - 1]!)}`)}</Text>,
          <Text key="q-f" bold color="warning">
            {`${fmtUsd(sessionQ[0])} ~ ${fmtUsd(sessionQ[1])}`}
          </Text>,
        ]
      : []),
  ]

  // ★ 최적 = 이 세션에서 비용이 가장 적은 크기(계산식 최적, optimal.ts)가 든 띠 — 구간 · 직접 입력 두 방식의 드롭다운이 같이 쓴다
  const starAt = opt?.at != null && inputs ? rangeBands().findIndex(([a, b]) => opt.at! >= a && opt.at! < b) : -1
  // 0.8.1 S9: 구간 이름 · 지금 크기 글은 설정 숫자 꼴(크기 · % · 둘 다)을 따른다 — 표는 둘 다여도 크기만(칸이 넘친다)
  const bandName = (a: number, b: number) => bandNumText(a, b, contextWindowNow(), s.ctxUnit)
  const num = (n: number) => ctxNumText(n, contextWindowNow(), s.ctxUnit)
  // 드롭다운 이름은 구간만. 고른 구간의 판정은 바로 아래
  // 금액 줄 끝 색 글자가, 구간마다의 판정은 자세히의 크기별 비용 표가 말한다
  const bandLabels = rangeBands().map(([a, b]) => bandName(a, b))
  const manualLabel = L('직접 입력…', 'Enter a size…')
  const allNote = <Text key="cmp-all" dimColor>{L('모든 세션에 적용', 'All sessions')}</Text>
  // T1(0.7.0): 터미널은 가로 고르기 버튼(choiceControl)
  const rangeSelect = (value: string) =>
    choiceControl(
      ui,
      'cmp-range-select',
      [...rangeBands().map(([a, b], i) => ({ value: `${a}-${b}`, label: bandLabels[i]! })), { value: 'manual', label: manualLabel }],
      value,
      v => {
        act.sizeError(null)
        if (v === 'manual') {
          if (d.follow) edit({ ...d, follow: false, compactAt: d.rangeEnd })
          return
        }
        const [a, b] = v.split('-').map(Number)
        if (a && b) edit({ ...d, follow: true, rangeStart: a, rangeEnd: b })
      },
    )
  const errLine = sizeErr ? (
    <Text key="cmp-size-err" color="error" wrap="wrap">
      {sizeErr}
    </Text>
  ) : null
  let rows: unknown[]
  if (d.follow) {
    // 질문 1개(9b): 요청 10회로 가정 × (그 크기 읽기 + 요청마다 읽기 말고 드는 값 — 새로 쓰기 · 출력, 이 세션 실측). 에이전트는 뺀다(작업마다
    // 다르다). 이 세션의 실제 평균 요청 수로 센 값은 표 풀이(qDesc)에
    const perQ = opt?.perQuestion ?? null
    const qExtra = perQ?.extraUsd ?? 0
    const qAt = (size: number) => {
      const read = usdAt(size, 'read')
      return read !== null ? Q_STEPS * (read + qExtra) : null
    }
    // 범위 꼴 "$0.03~0.04" — 이 물결은 어림이 아니라 범위. 끝도 1센트가 안 되면 "$0.01 이하" 하나(Haiku 요율이면 작은 크기 칸이 그렇다),
    // 앞만 안 되면 앞은 $0.00
    const usd2 = (x: number | null, y: number | null) => {
      if (x === null || y === null) return '—'
      if (y < 0.005) return fmtUsd(y)
      return `${isSubCent(x) ? '$0.00' : fmtUsd(x)}~${fmtUsd(y).slice(1)}`
    }
    // R2: 구간 = 드롭다운(구간 이름만), 고른 구간의 금액 · 판정은
    // 바로 아래 한 줄(간단 · 자세히 둘 다)
    const curVerdict = penVerdict(penOf(d.rangeStart))
    const curStar = starAt >= 0 && rangeBands().findIndex(([a, b]) => a === d.rangeStart && b === d.rangeEnd) === starAt
    // 판정을 맨 앞에(끝에 두니 좁으면 "· ★ 최적" 만 다음 줄로 떨어졌다), 이름 · 금액은 한 칸으로 묶어 칸 사이에서만 꺾는다 — 줄 머리엔
    // " · " 없이(fitLine, 0.6.0 CLI 확인)
    const dot = (isFirst: boolean) => (isFirst ? null : <Text dimColor>{' · '}</Text>)
    const pair = (key: string, label: string, value: string): LineCell => ({
      key,
      text: `${label} ${value}`,
      el: (isFirst: boolean) => (
        <Text>
          {dot(isFirst)}
          <Text dimColor>{`${label} `}</Text>
          <Text bold>{value}</Text>
        </Text>
      ),
    })
    const verdictText = curStar ? L('★ 최적', '★ Best') : (curVerdict?.word ?? null)
    const rangeCells: LineCell[] = [
      ...(verdictText !== null
        ? [
            {
              key: 'cmp-now-verdict',
              text: verdictText,
              // 늘 줄 맨 앞(점 없음) — 색 글 하나로(바깥 Text 로 감싸면 그 글을 찾는 쪽이 색 없는 바깥을 먼저 만났다)
              el: () => <Text {...(curStar ? { bold: true, color: STAR_COLOR } : { color: curVerdict!.color })}>{verdictText}</Text>,
            },
          ]
        : []),
      pair('cmp-now-read', L('요청 1회', 'One read'), usd2(usdAt(d.rangeStart, 'read'), usdAt(d.rangeEnd, 'read'))),
      pair('cmp-now-q', L('질문 1개', 'Question'), usd2(qAt(d.rangeStart), qAt(d.rangeEnd))),
      pair('cmp-now-cold', L('캐시 식으면', 'Cold cache'), usd2(usdAt(d.rangeStart, 'write1h'), usdAt(d.rangeEnd, 'write1h'))),
    ]
    const rangeNow = (
      <Box key="cmp-range-now" flexDirection="column">
        {fitLine(ui, rangeCells, null, textW).el}
      </Box>
    )
    const rangePick = row(
      'cmp-range-pick',
      L('컴팩트 구간', 'Compact range'),
      L(
        '컨텍스트가 이 크기에 들면 컴팩트할 때입니다. 모든 세션에 바로 적용됩니다.',
        'It’s time to compact once the context is inside this band. Applies to all sessions right away.',
      ),
      [allNote, rangeSelect(`${d.rangeStart}-${d.rangeEnd}`)],
      choiceW([...bandLabels, manualLabel]) + widthOf(L('모든 세션에 적용', 'All sessions'), isTerminal) + 1,
      // 고른 구간 금액 · 판정 한 줄은 간단 보기에. 0.9.4 카드 A: 자세히는 뺀다 —
      // 바로 아래 크기별 비용 표의 테두리 줄이 같은 값 · 같은 판정이라 두 번 보였다
      [isLean ? rangeNow : null, errLine].filter(x => x !== null),
    )
    // 추천: 최적이 든 띠 — 고른 띠가 아니면 한 줄 + [이 구간 고르기](고른 띠면 위 금액 줄 끝 "★ 최적" 이 말한다)
    const starBand = starAt >= 0 ? rangeBands()[starAt]! : null
    const isStarOn = starBand !== null && d.rangeStart === starBand[0] && d.rangeEnd === starBand[1]
    // 0.9.4 카드 A: 한 줄 "★ 추천 10 ~ 15% · 최적(12%)이 든 구간 [이 구간으로]" — 버튼은 글 바로 뒤(예전엔 줄 오른쪽 끝에 떨어져 어느 구간을
    // 고르는지 멀었고, 풀이는 "?" 안에 숨었다 — 사용자 빨간 표시). 터미널도 같은 꼴(버튼 = [ 이 구간으로 ])
    const pickStar = L('이 구간으로', 'Use this range')
    const recommend =
      starBand && opt?.at != null && !isStarOn ? (
        <Box key="cmp-recommend" columnGap={1} alignItems="center" flexWrap="wrap" marginTop={1}>
          <Box key="cmp-recommend-name">
            <Text bold color={STAR_COLOR}>
              {L(`★ 추천 ${bandName(starBand[0], starBand[1])}`, `★ Suggested ${bandName(starBand[0], starBand[1])}`)}
            </Text>
          </Box>
          <Text dimColor>{L(`· 최적(${num(opt.at)})이 든 구간`, `· has the best size (${num(opt.at)})`)}</Text>
          <Button key="cmp-recommend-pick" label={pickStar} variant="secondary" onPress={() => edit({ ...d, follow: true, rangeStart: starBand[0], rangeEnd: starBand[1] })} />
        </Box>
      ) : null
    // 비추천(자세히): 최적 대비가 PEN_BAD_PCT 를 넘는 띠(이 세션 값) — 최적 위는 "N 이상", 최적 아래(너무 잦음)는 그 띠 이름으로.
    // 70만 ~ 100만은 자동 컴팩트(1M 창이면 약 96.7만)가 돌기 직전이라 고를 일이 거의 없다
    const highBad = rangeBands().find(([a], i) => i > starAt && isNotRecommended(penOf(a)))
    // 맨 끝 띠(1M 창이면 700k ~ 1M — 창이 크면 그 끝까지, N22)
    const lastBand = rangeBands()[rangeBands().length - 1]!
    const lastBandName = bandName(lastBand[0], lastBand[1])
    const lowBad = rangeBands().filter(([a], i) => i < starAt && isNotRecommended(penOf(a)))
    const badParts = [
      lowBad.length > 0 ? bandName(lowBad[0]![0], lowBad[lowBad.length - 1]![1]) : null,
      highBad ? L(`${num(highBad[0])} 이상`, `${num(highBad[0])} and up`) : null,
    ].filter((p): p is string => p !== null)
    // 0.9.4 카드 A: "비추천 [?]" 줄은 뺐다 — 이름만 보이고 내용은 "?" 안에 숨었고, 표의 빨강 "비추천" 줄이 같은 말.
    // 어느 구간인지 · 자동 컴팩트 직전이라는 풀이는 표 제목 칩(데스크톱) · 표 아래 풀이(터미널)에
    const badDesc =
      badParts.length > 0
        ? L(
            `${badParts.join(' · ')} 구간으로, 최적보다 요청당 +${PEN_BAD_PCT}% 넘게 듭니다${highBad ? `. ${lastBandName} 구간은 자동 컴팩트(약 ${fmtTokens(autoCompactAt())}) 바로 앞입니다` : ''}`,
            `${badParts.join(' · ')}: over +${PEN_BAD_PCT}% per request vs best${highBad ? `. ${lastBandName} is right before auto-compact (~${fmtTokens(autoCompactAt())})` : ''}`,
          )
        : null
    // 크기별 비용(자세히 · R6 펼침): 앱 표(Markdown — 사용자 2026-10-15 "앱 UI 기능을 쓰자"). 고르기는 위 드롭다운이라 표는 보기만, 고른 줄은
    // 굵게 + "◀ 고름". 칸이 좁으면 열을 뺀다(최적보다 → 캐시 식으면 → 질문 1개 → 요청 1회). 표 글의 $ ~ | * _ 는 마크다운 기호라 막는다
    const tableOpen = true
    // 열 = 머리 + 칸 글. 패널 폭에 안 들면 뒤에서부터 뺀다(최적보다 → 캐시 식으면 → 질문 1개 → 요청 1회) — 실제 글 폭으로 센다(칸 사이:
    // 데스크톱 약 2칸 · 터미널 "│ " 3칸). 고른 줄 표시는 데스크톱 = 그 줄 테두리, 터미널 = 굵게 +
    // "(고름)" — 터미널 테두리는 칸 하나 · 위아래 두 줄을 먹어 열이 어긋나고, "◀" 처럼 폭이 애매한 글자도 칸이 어긋났다
    const pens = (a: number, b: number) => (penOf(a) === null || penOf(b) === null ? '—' : `${pctText(penOf(a))}~${pctText(penOf(b))}%`)
    const isOnBand = (a: number, b: number) => d.rangeStart === a && d.rangeEnd === b
    type Col = { id: string; head: string; cells: string[] }
    const colOf = (id: string, head: string, cell: (a: number, b: number, i: number) => string): Col => ({ id, head, cells: rangeBands().map(([a, b], i) => cell(a, b, i)) })
    const bandCol = colOf('band', L('크기 구간', 'Size range'), (a, b) => bandNumText(a, b, contextWindowNow(), s.ctxUnit === 'both' ? 'size' : s.ctxUnit))
    const verdictCol = colOf('verdict', L('판정', 'Verdict'), (a, _b, i) => (i === starAt ? L('★ 최적', '★ Best') : (penVerdict(penOf(a))?.word ?? '')))
    const extraCols = [
      colOf('read', L('요청 1회', 'One read'), (a, b) => usd2(usdAt(a, 'read'), usdAt(b, 'read'))),
      colOf('q', L(`질문 1개(${Q_STEPS}회 가정)`, `Question (${Q_STEPS} req)`), (a, b) => usd2(qAt(a), qAt(b))),
      colOf('cold', L('캐시 식으면', 'Cold cache'), (a, b) => usd2(usdAt(a, 'write1h'), usdAt(b, 'write1h'))),
      colOf('pen', L('최적보다', 'Over best'), (a, b) => pens(a, b)),
    ]
    const colW = (c: Col) => Math.max(widthOf(c.head, isTerminal), ...c.cells.map(x => widthOf(x, isTerminal))) + (isTerminal ? 3 : 2)
    // 1.0: 지금 줄 끝에
    // "지금 73%"(파란 바탕 — 터미널은 뒤집은 색), 고른 줄 끝에 "고른 구간". 글이 스스로 말해 표 아래 풀이 줄(● = … · 테두리 = …)과 터미널
    // "(고름)" 을 뺐다. 꼬리표는 폭 고정 끝 칸 — 판정 칸 안에 넣으면 그 줄 판정 글만 옆으로 밀렸다
    const nowTagText = ctxNow !== null && ctxNow > 0 ? L(`지금 ${num(ctxNow)}`, `Now ${num(ctxNow)}`) : null
    const chosenTag = L('고른 구간', 'Chosen')
    // 이지 오토(2026-10-19 — 시안 1019c ① 둘 다 보이기): 겹치면 한 줄에 "고른 구간 · 오토 · [지금 X]"(예전엔 지금이 들면 "고른 구간" 이 빠졌다)
    const autoTag = L('오토', 'Auto')
    const isAutoBand = (a: number, b: number) => autoBand !== null && autoBand.start === a && autoBand.end === b
    // 지금이 든 줄(아래 nowAt 과 같은 셈 — 폭을 먼저 재야 해서 여기서 한 번 더)
    const nowIdx = nowTagText === null ? -1 : rangeBands().findIndex(([a, b], i, all) => ctxNow! >= a && (ctxNow! < b || (i === all.length - 1 && ctxNow! <= b)))
    const nowAtBand = (i: number) => i === nowIdx
    // 오토 아이콘 칸(데스크톱 그림 12px ≈ 20px = 3칸 · 터미널은 글만)
    const autoTagW = widthOf(autoTag, isTerminal) + (isTerminal ? 0 : 3)
    const tagsW = (i: number, isChosen: boolean, isAuto: boolean) => {
      const parts = [isChosen ? widthOf(chosenTag, isTerminal) : 0, isAuto ? autoTagW : 0, nowAtBand(i) ? widthOf(nowTagText!, isTerminal) + 2 : 0].filter(w => w > 0)
      return parts.reduce((s, w) => s + w, 0) + Math.max(0, parts.length - 1) * 3
    }
    const tagMax = Math.max(0, ...rangeBands().map(([a, b], i) => tagsW(i, isOnBand(a, b), isAutoBand(a, b))))
    const tagW = tagMax > 0 ? tagMax + (isTerminal ? 3 : 2) : 0
    const room = cols === null ? Number.POSITIVE_INFINITY : cols - 4
    let kept = extraCols
    while (kept.length > 0 && [bandCol, ...kept, verdictCol].reduce((sum, c) => sum + colW(c), 1 + tagW) > room) kept = kept.slice(0, -1)
    // 최적보다 열이 남으면 판정 말을 그 칸에 붙여 열 하나를 던다(현황 패널 크기 한도 — 0.6.0), 빠졌으면 판정 열을 따로
    const hasPen = kept.some(c => c.id === 'pen')
    const shownCols = hasPen
      ? [bandCol, ...kept.map(c => (c.id === 'pen' ? { ...c, head: L('최적보다 · 판정', 'Over best · verdict'), cells: c.cells.map((x, i) => `${x} ${verdictCol.cells[i]}`.trim()) } : c))]
      : [bandCol, ...kept, verdictCol]
    const has = (id: string) => kept.some(c => c.id === id)
    const showRead = has('read')
    const showQ = has('q')
    const showCold = has('cold')
    // P3(0.6.0 실물 "크기별 비용 안 색이 다 빠짐"): 상자 표 — 판정 열 · 최적보다 열은 그 색, ★ 최적 줄 초록, 적용 중 줄 굵게
    // 줄 색 = 그 구간 판정: 금액 칸까지 그 줄 판정 색 —
    // ★ 최적 줄은 STAR, 판정이 없으면(셈 재료 없음) 색 없음. 구간 이름 칸은 ★ 줄만 색(이름은 읽혀야)
    const rowColor = (i: number): string | undefined => {
      const [a] = rangeBands()[i]!
      return i === starAt ? STAR_COLOR : (penVerdict(penOf(a))?.color ?? penColorOf(penOf(a)) ?? undefined)
    }
    const cellColor = (c: Col, i: number): string | undefined => (c.id === 'band' ? (i === starAt ? STAR_COLOR : undefined) : rowColor(i))
    // 칸 가운데 정렬
    const gcell = (key: string, width: number, el: unknown) => (
      <Box key={key} width={width} flexShrink={0} justifyContent="center">
        {el}
      </Box>
    )
    // O5(0.8.1 사용자 "현재 컨텍스트 구간도 따로 같이 — 설정된 목표랑 지금 컨텍스트양 같이", 시안 ③): 지금 컨텍스트가 든 줄은 바탕색 —
    // 데스크톱 = 앱 강조 파랑(#6da7ec) 옅게(raw rgba — 맞는 테마 키가 없다), 터미널 = 테마 바탕 키(rgba 를 못 그린다). 적용 중 구간은
    // 예전처럼 테두리 · (고름). 표가 100k 부터라 그보다 작으면 든 줄이 없다 — 표 위 한 줄로
    const bands = rangeBands()
    const hasNow = ctxNow !== null && ctxNow > 0
    const nowAt = !hasNow ? -1 : bands.findIndex(([a, b], i) => ctxNow! >= a && (ctxNow! < b || (i === bands.length - 1 && ctxNow! <= b)))
    const isBelowFirst = hasNow && nowAt < 0 && ctxNow! < bands[0]![0]
    // 0.9.4 카드 A: 데스크톱 바탕을 옅게(18% → 8%) + 크기 칸 앞 파란 ● — 18% 바탕 위 초록 · 주황 · 빨강 글이 3.4 ~ 3.9:1 로 글 대비
    // 4.5:1 에 못 미쳤다(uxi accessibility-review 계산). 8% 면 4.6:1 이상 · 바탕만으론 덜 보이니 ● 가 지금 줄을 맡는다
    const nowBg = isTerminal ? 'userMessageBackground' : 'rgba(109,167,236,0.08)'
    // 풀이 줄은 표 상자 밖(표 글에 "적용 중" 이 섞이면 예전 적용 중 열을 지킨 시험이 깨진다) · 키는 상자에(엔진 시험은 글의 키로 못 찾는다).
    // 다음 버전: "지금" 과 "적용 중" 이 둘 다 지금처럼
    // 읽혀 어느 쪽이 지금 컨텍스트인지 헷갈렸다 — 바탕은 "지금 컨텍스트", 테두리는 위 드롭다운 이름 그대로 "고른 컴팩트 구간"
    const nowNote = isBelowFirst ? (
        <Box key="cmp-now-note" marginTop={1}>
          <Text dimColor wrap="wrap">
            {L(`지금 컨텍스트 ${num(ctxNow!)} 는 첫 구간(${num(bands[0]![0])})보다 작습니다`, `Now ${num(ctxNow!)}, below the first range (${num(bands[0]![0])})`)}
          </Text>
        </Box>
      ) : null
    const cw = (c: Col) => colW(c)
    // 끝 칸 꼬리표(위 tagW) — 왼쪽 맞춤, 없는 줄은 빈 칸(열이 어긋나지 않게). 고른 구간 · 오토 · 지금 순서로 다 보인다
    const tagCell = (i: number, isChosen: boolean, isAuto: boolean) => {
      if (tagW === 0) return null
      const tags: unknown[] = []
      const dot = (k: string) => (tags.length > 0 ? <Text key={k} dimColor>·</Text> : null)
      if (isChosen) tags.push(<Text key="t-chosen" dimColor>{chosenTag}</Text>)
      if (isAuto) {
        tags.push(dot('t-dot-a'))
        tags.push(
          <Box key="t-auto" columnGap={1} alignItems="center">
            {autoIcon(ui, surface, 't-auto-icon', 12)}
            <Text dimColor>{autoTag}</Text>
          </Box>,
        )
      }
      if (nowAtBand(i)) {
        tags.push(dot('t-dot-n'))
        tags.push(
          <Text key="t-now" bold {...(isTerminal ? { inverse: true } : { backgroundColor: '#4c9be8', color: '#06121f' })}>
            {` ${nowTagText} `}
          </Text>,
        )
      }
      return (
        <Box key={`${i}-tag`} width={tagW} flexShrink={0} paddingLeft={1} columnGap={1} alignItems="center">
          {tags.filter(t => t !== null)}
        </Box>
      )
    }
    const gridBox = (
      <Box key="cmp-grid" flexDirection="column" marginTop={isBelowFirst ? 0 : 1}>
        <Box key="cmp-grid-h">
          {shownCols.map(c => gcell(`h-${c.id}`, cw(c), <Text dimColor>{c.head}</Text>))}
          {tagW > 0 ? <Box key="h-tag" width={tagW} flexShrink={0} /> : null}
        </Box>
        {rangeBands().map(([a, b], i) => {
          const cells = shownCols.map(c => {
            const col = cellColor(c, i)
            return gcell(
              `${i}-${c.id}`,
              cw(c),
              <Text {...(isOnBand(a, b) ? { bold: true } : {})} {...(col ? { color: col } : {})}>
                {c.cells[i]!}
              </Text>,
            )
          })
          // 고른 줄(데스크톱): 묶음 버튼 고른 칸과 같은 테두리 상자 — 테두리는 1px 라 열이 거의 안 밀린다. 줄 내용 폭에 붙인다(안 붙이면 열이
          // 적은 좁은 패널에서 테두리만 패널 끝까지 늘어났다)
          const bg = i === nowAt ? { backgroundColor: nowBg } : {}
          return isOnBand(a, b) && !isTerminal ? (
            <Box key={`cmp-grid-${i}`} alignSelf="flex-start" borderStyle="round" borderColor={SEG_ON_EDGE} paddingX={0} paddingY={0} {...bg}>
              {cells}
              {tagCell(i, true, isAutoBand(a, b))}
            </Box>
          ) : (
            <Box key={`cmp-grid-${i}`} alignSelf="flex-start" {...bg}>
              {cells}
              {tagCell(i, isOnBand(a, b), isAutoBand(a, b))}
            </Box>
          )
        })}
      </Box>
    )
    const grid = (
      <Box key="cmp-grid-unit" flexDirection="column">
        {isBelowFirst ? nowNote : null}
        {gridBox}
      </Box>
    )
    const tableUnit = isLean ? null : (
      <Box key="cmp-table-unit" flexDirection="column">
        {/* 표 풀이(열 뜻 · 계산 값)는 데스크톱이면 제목에 마우스 올림 칩 — 현황 자세히의 글 양 · 패널 크기 한도(0.6.0, 사용자 "설명은 툴팁") */}
        <Box key="cmp-table-row" marginTop={1}>
          {isTerminal ? <Text bold>{L('크기별 비용', 'Cost by size')}</Text> : hoverTip(
              ui,
              'cmp-table-tip',
              <Text bold>{L('크기별 비용', 'Cost by size')}</Text>,
              // 칩 안 글도 패널 크기에 든다 — 두 줄로(열 뜻 · 가정). 계산 값 · 기본 구간 같은 자세한 풀이는 터미널 표 아래에만
              <Box key="cmp-legend-s" flexDirection="column">
                <Text wrap="wrap">
                  {L(
                    `'최적보다'는 예상 최적보다 요청당 더 드는 비율입니다. +${PEN_WARN_PCT}%까지 좋음, +${PEN_BAD_PCT}%까지 보통, 그보다 크면 비추천입니다.`,
                    `"Over best" is the extra cost per request vs the estimated best: up to +${PEN_WARN_PCT}% good, up to +${PEN_BAD_PCT}% fair, beyond that not advised.`,
                  )}
                </Text>
                <Text wrap="wrap">
                  {L(`질문 1개는 요청 ${Q_STEPS}회로 잡았습니다. 캐시가 식으면(${ttlName(ttl)} 넘게 쉬었을 때) 다시 쓰는 값으로 셉니다. ${model} 요율입니다.`, `One question is taken as ${Q_STEPS} requests. A cold cache (idle over ${ttlName(ttl)}) counts as a rewrite. ${model} rates.`)}
                </Text>
                {badDesc ? <Text wrap="wrap">{`${L('비추천', 'Not advised')}: ${badDesc}`}</Text> : null}
              </Box>,
              toggleOf('cmp-table-tip'),
            )}
        </Box>
        {grid}
        {isTerminal && tableOpen ? legendOf() : null}
      </Box>
    )
    function legendOf() {
      return (
          <Box key="cmp-legend" flexDirection="column" marginTop={isTerminal ? 1 : 0}>
            {term('cmp-range-how', L('최적보다', 'Over best'), [
              <Text key="l" dimColor>
                {L('예상 최적보다 요청당 더 드는 비율 ·', 'Extra cost per request vs the estimated best ·')}
              </Text>,
              <Text key="g" color="success">{L(`+${PEN_WARN_PCT}%까지 좋음`, `up to +${PEN_WARN_PCT}% good`)}</Text>,
              <Text key="s1" dimColor>
                ·
              </Text>,
              <Text key="y" color="warning">{L(`+${PEN_BAD_PCT}%까지 보통`, `up to +${PEN_BAD_PCT}% fair`)}</Text>,
              <Text key="s2" dimColor>
                ·
              </Text>,
              <Text key="r" color="error">
                {L('넘으면 비추천', 'beyond: not advised')}
              </Text>,
            ])}
            {showRead ? term('cmp-read', L('요청 1회', 'One read'), L('그 크기를 캐시에서 한 번 읽는 값(새로 쓰기 · 출력 빼고)', 'reading that size from cache once (no writes or output)')) : null}
            {showQ ? term('cmp-q', L(`질문 1개`, `Question`), qDesc) : null}
            {showCold
              ? term(
                  'cmp-cold',
                  L('캐시 식으면', 'Cold cache'),
                  (opt?.shared ?? 0) > 0
                    ? L(`${ttlName(ttl)} 넘게 쉬어 다시 쓰기(공통 앞부분 ${fmtTokens(opt!.shared!)} 은 읽기)`, `idle over ${ttlName(ttl)}, rewritten (the shared ${fmtTokens(opt!.shared!)} prefix is read)`)
                    : L(`${ttlName(ttl)} 넘게 쉬어 전부 다시 쓰기`, `idle over ${ttlName(ttl)}, everything rewritten`),
                )
              : null}
            {badDesc ? term('cmp-bad', L('비추천', 'Not advised'), badDesc, 'error') : null}
            {starLine}
            {calcLine}
            {capLine}
            {term(
              'cmp-range-src',
              L('기본 구간', 'Default range'),
              L(`${fmtTokens(DEFAULT_SETTINGS.rangeStart)} ~ ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)}(처음 설치 값)`, `${fmtTokens(DEFAULT_SETTINGS.rangeStart)} – ${fmtTokens(DEFAULT_SETTINGS.rangeEnd)} (initial value)`),
            )}
          </Box>
      )
    }
    rows = isLean ? [rangePick] : [rangePick, recommend, tableUnit]
  } else {
    // 직접 정한 크기의 대가: 최적보다 요청당 몇 % 더 드나 — % 에 최적 대비 색
    const pen = penOf(dt.ctxCut)
    const pct = pen === null ? null : Math.round(pen)
    const status =
      opt?.at != null && pct !== null ? (
        <Box key="cmp-status" columnGap={1} flexWrap="wrap">
          <Text>
            {pct >= 1
              ? L(`최적 ${fmtTokens(opt.at)}보다 요청당`, `Per request vs best ${fmtTokens(opt.at)}:`)
              : L(`최적(${fmtTokens(opt.at)})과 거의 차이가 없습니다`, `Almost no difference from the best (${fmtTokens(opt.at)})`)}
          </Text>
          {pct >= 1 ? (
            <Text bold {...(penColorOf(pen) ? { color: penColorOf(pen) } : {})}>
              {L(`+${pct}% 더 듦`, `+${pct}% more`)}
            </Text>
          ) : null}
          {/* 판정 말(좋음 · 보통 · 비추천). 비추천은 알리기만 — 적용은 막지 않는다 */}
          {pct >= 1 && penVerdict(pen) ? (
            <Text bold color={penVerdict(pen)!.color}>
              {penVerdict(pen)!.color === 'error' ? L('· 비추천이지만 적용됩니다', '· not advised, but it applies') : `· ${penVerdict(pen)!.word}`}
            </Text>
          ) : null}
        </Box>
      ) : inputs && dt.ctxCut <= inputs.after ? (
        <Text key="cmp-status" wrap="wrap" color="warning">
          {L(`컴팩트 후 크기(${fmtTokens(inputs.after)})보다 작아 컴팩트해도 줄지 않습니다`, `Smaller than the post-compact size (${fmtTokens(inputs.after)}), so compacting would not shrink it`)}
        </Text>
      ) : null
    const sizeRow = row(
      'cmp-size',
      L('컴팩트 크기', 'Compact size'),
      L(`컨텍스트가 이 크기에 닿으면 빨강, 그 ${Math.round(WARN_RATIO * 100)}%부터 주황입니다.`, `Red once the context reaches this size, orange from ${Math.round(WARN_RATIO * 100)}% of it.`),
      [
        allNote,
        rangeSelect('manual'),
        // 숫자 입력: Enter 가 곧 저장 — 300k · 300000 · 0.3m. 못 받는 값은 저장 안 하고 까닭 한 줄
        <Input
          key="cmp-size-input"
          value={fmtTokens(s.compactAt)}
          placeholder="300k"
          onSubmit={v => {
            const n = parseTokens(v)
            if (n === null) return act.sizeError(L('크기를 읽지 못했습니다. 예: 300k', 'Couldn’t read the size. Example: 300k'))
            if (n > compactMax()) return act.sizeError(L(`최대 컨텍스트(${fmtTokens(compactMax())})보다 커서 저장하지 않았습니다`, `Larger than the max context (${fmtTokens(compactMax())}) — not saved`))
            // 가장 작은 크기 = COMPACT_MIN(setCompactAt 이 그 아래를 올려 버려 50k~99k 가 말없이 100k 로 저장됐다 — 시험 점검에서 찾음)
            if (n < COMPACT_MIN) return act.sizeError(L(`너무 작습니다. ${fmtTokens(COMPACT_MIN)} 이상으로 정하세요.`, `Too small. Use ${fmtTokens(COMPACT_MIN)} or more.`))
            act.sizeError(null)
            edit({ ...d, follow: false, compactAt: setCompactAt(s, n).compactAt, sizeText: undefined })
          }}
        />,
      ],
      choiceW([...bandLabels, manualLabel]) + widthOf(L('모든 세션에 적용', 'All sessions'), isTerminal) + 12,
      // 직접 정한 크기의 판정 한 줄도 간단 보기에(구간 방식 금액 줄과 같게)
      [status, errLine].filter(x => x !== null),
    )
    rows = [
      sizeRow,
      isLean ? null : (
        <Box key="cmp-legend" flexDirection="column">
          {term(
            'cmp-warn',
            L('색', 'Colors'),
            colorDesc(
              '',
              L(`${fmtTokens(dt.ctxWarn)}부터 주황`, `orange from ${fmtTokens(dt.ctxWarn)}`),
              L(`${fmtTokens(dt.ctxCut)}부터 빨강`, `red from ${fmtTokens(dt.ctxCut)}`),
              L(`(주황은 정한 크기의 ${Math.round(WARN_RATIO * 100)}%부터)`, `(orange starts at ${Math.round(WARN_RATIO * 100)}% of the set size)`),
            ),
          )}
          {starLine}
          {calcLine}
          {capLine}
        </Box>
      ),
    ]
  }

  // 이지 오토 구간(시안 1019c ② · 1019d — 컴팩트 구간과 같은 꼴 칸 · 끔 없음, 켜기는 [컴팩트] 팝업 — 사용자 2026-10-19 "설정에선 구간만,
  // 켜고 끄기는 컴팩트 누르면"): 컴팩트 구간(또는 직접 정한 크기) 줄 바로 아래. 예전엔 설정 탭만 카드 끝에 따로 붙였다
  const autoNowValue = `${s.autoStart}-${s.autoEnd}`
  const autoName = (a: number, b: number) => bandNumText(a, b, contextWindowNow(), s.ctxUnit)
  const autoOpts = autoBands().map(([a, b]) => ({ value: `${a}-${b}`, label: autoName(a, b) }))
  // 지금 값이 목록에 없으면(엔진 자동 컴팩트를 낮춤 · 명령으로 고른 구간) 그 값도 보인다
  const autoChoices = autoOpts.some(o => o.value === autoNowValue) ? autoOpts : [...autoOpts, { value: autoNowValue, label: autoName(s.autoStart, s.autoEnd) }]
  const autoRow = withAuto
    ? row(
        'auto-range-pick',
        L('이지 오토 구간', 'Easy Auto range'),
        L(
          '답이 끝났을 때 앞쪽을 넘었으면 저장하고 컴팩트합니다. 일하는 도중 뒤쪽을 넘으면 멈추고 저장, 컴팩트한 뒤 이어서 합니다. 켜기는 [컴팩트] 팝업에서 합니다.',
          'When an answer ends past the start, it saves and compacts. If work goes past the end, it pauses, saves, compacts and then continues. Turn it on from the [Compact] popup.',
        ),
        choiceControl(ui, 'auto-range-select', autoChoices, autoNowValue, v => {
          const [a, b] = v.split('-').map(Number)
          if (a && b) act.save(setAutoRange(s, a, b))
        }),
        choiceW(autoChoices.map(o => o.label)),
        [],
        <Box key="auto-range-name" columnGap={1} alignItems="center">
          {autoIcon(ui, surface, 'auto-range-icon', 12)}
          <Text>{L('이지 오토 구간', 'Easy Auto range')}</Text>
        </Box>,
      )
    : null
  void [applyArea, appliedRow, leanNote, ctxColor, draftText, dAt]
  return (
    <Box key="cmp-timing" flexDirection="column">
      {[rows[0], autoRow, ...rows.slice(1)].filter(r => r !== null && r !== undefined)}
    </Box>
  )

}

export function drawSettingsView(
  act: SettingsActions,
  ui: Ui,
  s: Settings,
  opt: Optimal | null,
  draft: string | null,
  rawOpen: boolean,
  phase: unknown,
  kind: unknown,
  surface: string,
  cmp: CmpDraft | null = null,
  ctxNow: number | null = null,
  autoLang: Lang | null = null,
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  previews: SettingsPreviews | null = null,
  hasLimits: boolean | null = null,
  compactDraft: string | null = null,
  tab: SettingsTab = 'bar',
  /** 0.9.1 U6: 일반 탭 진단 카드(그 자리에 열려 있을 때만) */
  diag: DiagView | null = null,
  /** 컴팩트 탭 컴팩트 구간 칸의 직접 입력 오류 */
  sizeErr: string | null = null,
) {
  const { Box, Text } = ui
  const look = phaseLook(phase, kind)
  // 언어 줄: 이름은 늘 두 언어로 — 읽지 못하는 언어로 떴을 때도 찾을 수 있게. 자동은 지금 고른 언어를 같이 보인다
  // 아직 모르면 그냥 "자동" — "자동(?)" 은 고장처럼 보였다
  const autoName = autoLang === 'ko' ? '한국어' : autoLang === 'en' ? 'English' : null
  const autoLabel = autoName ? L(`자동(${autoName})`, `Auto (${autoName})`) : L('자동', 'Auto')
  const langPick = (key: string, label: string, choice: Settings['lang']) => pickButton(ui, key, label, s.lang === choice, () => act.setLang(choice))
  // 앱 설정 꼴(0.5 묶음 2): 언어도 줄 하나 — 이름 …… 드롭다운. 이름은 늘 두 언어(읽지 못하는 언어로 떴을 때도 찾게). S10(0.8.1): 일반 탭
  const langRow = settingRow(
    ui,
    'lang-row',
    '언어 · Language',
    null,
    choiceControl(
      ui,
      'lang-pick',
      [
        { value: 'auto', label: autoLabel },
        { value: 'ko', label: '한국어' },
        { value: 'en', label: 'English' },
      ],
      s.lang,
      v => act.setLang(v as Settings['lang']),
    ),
  )
  const dot = look ? pulseDot(ui, surface, look.hex, look.text) : null
  return (
    <Box key="s-settings" flexDirection="column">
      {look ? (
        <Box key="s-busy" columnGap={1} alignItems="flex-start">
          {/* 빈 글 한 칸을 곁들여 줄 높이를 잡는다 — 점이 첫 줄 글의 세로 가운데에 온다 */}
          {dot ? (
            <Box key="s-busy-dot" flexShrink={0} alignItems="center">
              {dot}
              <Text> </Text>
            </Box>
          ) : null}
          <Text color={look.color} wrap="wrap">
            {L(
              `${phase === 'tidying' ? '지금 저장 중입니다. 끝나면 컴팩트합니다.' : `지금 ${typeof kind === 'string' && kind ? kind : '컴팩트'} 중입니다.`} 컴팩트 문구를 바꾸면 다음 [이지 컴팩트]부터 쓰입니다.`,
              `${phase === 'tidying' ? 'Saving now. It compacts when done.' : `${typeof kind === 'string' && kind ? kind : 'Compact'} in progress.`} A changed compact text is used from the next [Easy Compact].`,
            )}
          </Text>
        </Box>
      ) : (
        <Text dimColor wrap="wrap">
          {L('바꾸면 모든 세션에 바로 적용됩니다.', 'Changes apply to all sessions right away.')}
        </Text>
      )}
      {/* 업데이트 칸은 뺐다 — 탭 줄 업데이트 버튼 · 서랍(U4, 0.6.1 피드백: 늘 보이는 칸이 불편 · 위쪽 버튼으로) */}
      {drawSettings(act, ui, s, opt, draft, rawOpen, act.toggleRaw, cmp, ctxNow, surface, cols, open, cache, previews, hasLimits, compactDraft, tab, [diagRow(act, ui, 'gen', diag, surface), langRow], sizeErr)}
    </Box>
  )
}

/** 마켓을 받아 둔 때 → "오늘" · "N일 전"(모르면 null) */
function agoText(iso: string | null, nowMs: number): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN
  if (!Number.isFinite(at) || nowMs <= 0) return null
  const days = Math.floor((nowMs - at) / 86_400_000)
  if (days <= 0) return L('오늘', 'today')
  return L(`${days}일 전`, `${days} ${days === 1 ? 'day' : 'days'} ago`)
}

/** CHANGELOG 한 판의 바뀐 것(펼친 꼴): 절 이름은 흐리게, 항목은 "· " 로 */
function changesList(ui: Ui, key: string, groups: ChangeGroup[]) {
  const { Box, Text } = ui
  return (
    <Box key={key} flexDirection="column" marginTop={1}>
      {groups.map((g, gi) => (
        <Box key={`${key}-g${gi}`} flexDirection="column" marginTop={gi > 0 ? 1 : 0}>
          {g.head ? <Text dimColor>{g.head}</Text> : null}
          {g.items.map((item, ii) => (
            <Text key={`${key}-g${gi}-${ii}`} wrap="wrap">
              {`· ${item}`}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

/**
 * U4(0.6.1 피드백 "업데이트 확인을 위쪽에 버튼으로, 누르면 내역 — 늘 내용이 보이면 불편"): 패널 탭 줄 오른쪽 버튼. 평소엔 버전만 흐리게
 * ("v0.6.1"), 알릴 것이 있으면 칩 — 새 버전 "0.6.2 업데이트" · 업데이트 뒤 첫 실행 "0.6.2 바뀐 것" · 받음 · 확인 못 함. 누르면 탭 줄 아래
 * 서랍(drawUpdateDrawer). 0.9.1 U5: 폴더로 불러온 개발본도 늘 — "v0.9.0 개발본".
 * 0.9.1 사용자 "새판이라는 단어는 안 익숙함": 화면 글의 "판" → "버전", 새 버전 칩은 "0.9.1 업데이트"
 */
export function updateButton(ui: Ui, upd: UpdateState, isOpen: boolean, onPress: () => void) {
  const { Button } = ui
  const label =
    upd.phase === 'checking'
      ? L('확인 중…', 'Checking…')
      : upd.phase === 'updating'
        ? L('업데이트 중…', 'Updating…')
        : upd.phase === 'newer' && upd.market
          ? L(`${upd.market} 업데이트`, `Update ${upd.market}`)
          : upd.phase === 'done' && upd.market
            ? L(`${upd.market} 받음`, `${upd.market} downloaded`)
            : upd.phase === 'failed'
              ? L('업데이트 확인 못 함', 'Update check failed')
              : upd.updatedTo
                ? L(`${upd.updatedTo} 바뀐 것`, `What's new in ${upd.updatedTo}`)
                : upd.phase === 'dev' && upd.own && !upd.devOff
                  ? L(`v${upd.own} 개발자 모드`, `v${upd.own} dev mode`)
                  : upd.own
                    ? `v${upd.own}`
                    : L('버전', 'Version')
  const isHot = upd.phase === 'newer' || upd.phase === 'done' || upd.phase === 'failed' || Boolean(upd.updatedTo)
  const text = `${label} ${isOpen ? '▾' : '▸'}`
  return isHot || isOpen ? <Button key="upd-btn" label={text} variant="secondary" onPress={onPress} /> : <Button key="upd-btn" label={text} plain dimColor onPress={onPress} />
}

/** 서랍에 판별 바뀐 것을 몇 판까지 — 패널 크기 한도(직렬화 ~10만 자)와 읽을 양 */
const DRAWER_VERSIONS = 6

/** 터미널은 패널 높이가 정해져 있어 진단 글을 덜 보인다(버튼은 글 위라 스크롤 없이 닿는다) */
const DIAG_HEAD_TERMINAL = 20

/**
 * 문제 제보 줄(0.9.1 U6 — 판 서랍 · 설정 › 일반 탭 같은 줄): [진단 내용 보기] 가 그 줄 바로 아래 진단 카드를 연다 · 열려 있으면 [접기].
 * 0.9.0 의 [진단](누르면 바로 파일 · 경로만 알림)을 바꿨다 — 사용자 "뽑히는 내용을 사람한테 보여 줘야 · 복사해도 되는지 봐야"
 */
export function diagRow(act: SettingsActions, ui: Ui, where: 'drawer' | 'gen', view: DiagView | null, surface: string) {
  const { Box, Button, Text } = ui
  const isOpen = view !== null
  return (
    <Box key={`diag-${where}`} flexDirection="column">
      {settingRow(
        ui,
        `diag-row-${where}`,
        <Text key="diag-name" bold>
          {L('문제 제보', 'Report a problem')}
        </Text>,
        <Text key="diag-use" dimColor wrap="wrap">
          {L('보내기 전에 진단 내용을 먼저 보여 드립니다', 'Shows you the diagnostics before anything leaves')}
        </Text>,
        [<Button key={`diag-btn-${where}`} label={isOpen ? L('접기', 'Hide') : L('진단 내용 보기', 'Show diagnostics')} variant="secondary" onPress={() => (isOpen ? act.diagClose() : act.diagOpen(where))} />],
      )}
      {view ? drawDiagCard(act, ui, view, surface) : null}
    </Box>
  )
}

/**
 * 진단 카드: 무엇이 들어 있나 · [질문 · 동작 글 빼기](처음 켬 — 끄면 나갈 내 글을 노랗게) · [복사] [파일로 저장] [이슈 쓰기] · 처음 몇 줄(Code).
 * 버튼을 글 위에 둔다 — 터미널은 패널 높이가 정해져 있어 글 아래면 스크롤해야 닿았다. 복사 · 저장하는 글 = 보이는 사본(register diagSnap)
 */
export function drawDiagCard(act: SettingsActions, ui: Ui, v: DiagView, surface: string) {
  const { Box, Button, Code, Link, Text } = ui as Ui & { Link: (p: { key?: string; href: string; label?: string }) => unknown }
  const isTerm = surface === 'terminal'
  const shownLines = isTerm ? Math.min(DIAG_HEAD_TERMINAL, v.lines) : Math.min(v.head.split('\n').length, v.lines)
  const head = isTerm ? v.head.split('\n').slice(0, DIAG_HEAD_TERMINAL).join('\n') : v.head
  return (
    <Box key="diag-card" flexDirection="column" marginTop={1} {...CARD}>
      <Text key="diag-title" bold>
        {L('공유하기 전에 진단 내용을 확인하세요', 'Check the diagnostics before you share')}
      </Text>
      <Text key="diag-sum" dimColor wrap="wrap">
        {diagSummary(v)}
      </Text>
      {settingRow(ui, 'diag-redact-row', L('질문 · 동작 글 빼기', 'Leave out questions and step names'), null, onOffControl(ui, 'diagRedact', v.redact, isOn => act.diagRedact(isOn)))}
      {v.redact ? (
        <Text key="diag-redact-use" dimColor wrap="wrap">
          {L('내가 쓴 글(질문 · 답 끝 · 동작 이름 · 직접 쓴 문구)은 (뺌)으로 바꿉니다.', 'Your own text (questions, answer endings, step names, custom texts) becomes (removed).')}
        </Text>
      ) : (
        <Box key="diag-own" flexDirection="column">
          <Text key="diag-own-head" color="warning" wrap="wrap">
            {diagOwnText(v.counts)}
          </Text>
          {v.samples.map((s, i) => (
            <Text key={`diag-own-${i}`} color="warning" wrap="truncate-end">
              {`· ${s}`}
            </Text>
          ))}
        </Box>
      )}
      <Box key="diag-acts" columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center" marginTop={1}>
        <Button key="diag-copy" label={L('복사', 'Copy')} variant="primary" onPress={(p?: { surface?: string }) => act.diagCopy(p?.surface ?? surface)} />
        <Button key="diag-save" label={L('파일로 저장', 'Save as file')} variant="secondary" onPress={() => act.diagSave()} />
        {/* 이슈 쓰기 — 공개 저장소 새 이슈. 터미널은 링크를 못 여는 곳도 있어 주소 글자 그대로 —
            엔진은 터미널에서 이름 있는 링크를 '이름 주소' 로 그려서, 이름 없이 줘야 주소가 한 번만 나온다(0.9.1 CLI 실측) */}
        {isTerm
          ? <Link key="diag-issue" href={ISSUE_URL} />
          : <Link key="diag-issue" href={ISSUE_URL} label={L('이슈 쓰기 ↗', 'Open an issue ↗')} />}
      </Box>
      {v.copiedLines !== null ? (
        <Text key="diag-copied" color="success" wrap="wrap">
          {L(`복사함 · ${v.copiedLines.toLocaleString()}줄${v.redact ? '(질문 · 동작 글 뺌)' : ''}`, `Copied · ${v.copiedLines.toLocaleString()} lines${v.redact ? ' (questions and step names left out)' : ''}`)}
        </Text>
      ) : null}
      {v.savedPath ? (
        <Box key="diag-saved" flexDirection="column">
          <Text key="diag-saved-path" color="success" wrap="wrap">
            {L(`저장: ${nativePath(v.savedPath)}`, `Saved: ${nativePath(v.savedPath)}`)}
          </Text>
          {/* 1.0.2: 패널 글은 끌어 고를 수 없어 버튼으로 */}
          <Box key="diag-saved-acts" columnGap={1} rowGap={1} flexWrap="wrap" alignItems="center">
            <Button key="diag-reveal" label={L('폴더 열기', 'Open folder')} variant="secondary" onPress={() => act.diagReveal()} />
            <Button key="diag-copy-path" label={L('경로 복사', 'Copy path')} variant="secondary" onPress={(p?: { surface?: string }) => act.diagCopyPath(p?.surface ?? surface)} />
          </Box>
        </Box>
      ) : null}
      <Box key="diag-code-box" marginTop={1} flexDirection="column">
        <Code key="diag-code" source={head} language="json" startLine={1} wrap="truncate-end" />
      </Box>
      <Text key="diag-more" dimColor wrap="wrap">
        {L(`처음 ${shownLines}줄만 보입니다(전체 ${v.lines.toLocaleString()}줄). 복사하거나 파일로 저장하면 전체가 들어갑니다.`, `Showing the first ${shownLines} of ${v.lines.toLocaleString()} lines. Copy and Save as file take all of it.`)}
      </Text>
    </Box>
  )
}

/**
 * 업데이트 서랍(U4): 한 줄 = "easy-compact 판" + 상태 · 오른쪽 버튼, 그 아래 판별 바뀐 것(U1 — 새 판이면 지금 판 위 모든 판, 업데이트 뒤
 * 첫 실행이면 본 판 위 모든 판, 그 밖엔 지금 판). [업데이트 확인] 은 바쁠 때(확인 · 업데이트 중)와 새 판이 있을 때 빼고 늘(U2 — 받은 뒤에도).
 * 확인 · 업데이트는 Claude Code 명령(claude plugin …)이 하고 그때만 마켓 저장소(GitHub)를 받는다 — 이 mod 는 통신하지 않는다(README 약속).
 * 상태 글 색: 진행 = 파랑 점, 최신 · 받음 = 초록, 실패 = 빨강
 */
export function drawUpdateDrawer(act: SettingsActions, ui: Ui, upd: UpdateState, nowMs: number, surface: string, diag: DiagView | null = null) {
  const { Box, Button, Text } = ui
  const btn = (key: string, label: string, onPress: () => void, isMain = false) =>
    isMain ? <Button key={key} label={label} variant="primary" onPress={onPress} /> : <Button key={key} label={label} variant="secondary" onPress={onPress} />
  const checkBtn = btn('upd-check', L('업데이트 확인', 'Check for updates'), act.checkUpdate)
  const busy = (key: string, text: string) => [
    <Box key={`${key}-dot`} flexShrink={0} alignItems="center">
      {pulseDot(ui, surface, LIVE_HEX, text)}
    </Box>,
    <Text key={key} color={ACCENT}>
      {text}
    </Text>,
  ]
  const ago = agoText(upd.marketAt, nowMs)
  let state: unknown[] = []
  let buttons: unknown[] = []
  switch (upd.phase) {
    case 'checking':
      state = busy('upd-busy', L('업데이트 확인 중…', 'Checking for updates…'))
      break
    case 'updating':
      state = busy('upd-busy', L('업데이트 중…', 'Updating…'))
      break
    case 'latest':
      state = [
        <Text key="upd-state" color="success">
          {L(`최신 버전입니다(${upd.own ?? '?'})`, `Up to date (${upd.own ?? '?'})`)}
        </Text>,
      ]
      buttons = [checkBtn]
      break
    case 'newer':
      state = [
        <Text key="upd-state" bold>
          {L(`${upd.market} 업데이트가 있습니다`, `Version ${upd.market} is available`)}
        </Text>,
      ]
      buttons = [btn('upd-apply', L('업데이트', 'Update'), act.applyUpdate, true)]
      break
    case 'done':
      // U3(0.6.1 피드백): 앱을 다시 켜지 않아도 곧 새 판이 뜨는 일이 많다 — 뜨면(지금 판 = 받은 판) 최신으로 바뀐다
      state = [
        <Text key="upd-state" color="success" wrap="wrap">
          {L(`${upd.market ?? ''} 판을 받았습니다. 곧 적용되고, 그대로면 앱을 다시 켜세요.`, `Downloaded ${upd.market ?? ''}. It applies shortly; restart the app if it doesn’t.`)}
        </Text>,
      ]
      buttons = [checkBtn]
      break
    case 'synced':
      // 앤트로픽 디렉터리에서 받은 판 — 마켓 명령이 안 맞아 버튼 없이(0.6.0). 새 판은 Claude Code 를 켤 때 계정 동기화로
      state = [
        <Text key="upd-state" dimColor wrap="wrap">
          {L('claude.ai 디렉터리에서 받은 버전입니다. 새 버전은 Claude Code 를 켤 때 저절로 받습니다.', "Installed from Anthropic's directory. Claude Code picks up new versions by itself when it starts.")}
        </Text>,
      ]
      break
    case 'dev':
      // 0.9.1 U5: 폴더로 불러온 개발본 — 업데이트 명령(claude plugin)은 마켓 설치본 것이라 버튼 없이. 2026-10-17: 말을 "개발자 모드" 로,
      // 스위치가 꺼졌으면(devOff — 공개판처럼 보는 중) 그것부터
      state = [
        <Text key="upd-state" dimColor wrap="wrap">
          {upd.devOff
            ? L('개발자 모드가 꺼져 공개판처럼 보이는 중입니다. 폴더에서 불러온 판이라 업데이트 버튼은 없습니다.', 'Dev mode is off, so it looks like the public build. Loaded from a folder, so there is no Update button.')
            : L('개발자 모드입니다. 폴더에서 불러온 판이라 업데이트 버튼이 없으니 저장소에서 받으세요.', 'Dev mode. Loaded from a folder, so there is no Update button. Pull it from the repository.')}
        </Text>,
      ]
      break
    case 'failed':
      state = [
        <Text key="upd-state" color="error" wrap="wrap">
          {!upd.error
            ? L('claude 명령을 찾지 못했습니다. README 의 업데이트 받기를 보세요.', 'Couldn’t find the claude command. See Updating in the README.')
            : upd.isTimeout
              ? L('응답이 없어 멈췄습니다. 다시 시도하고, git과 네트워크도 확인하세요.', 'No response, so it stopped. Try again, and check git and your network too.')
              : upd.failedOn === 'apply'
                ? L('업데이트하지 못했습니다. git과 네트워크를 확인하세요.', 'Update failed. Check git and your network.')
                : L('확인하지 못했습니다. git과 네트워크를 확인하세요.', 'Couldn’t check for updates. Check git and your network.')}
        </Text>,
      ]
      buttons = [
        btn('upd-retry', L('다시 시도', 'Try again'), upd.failedOn === 'apply' ? act.applyUpdate : act.checkUpdate),
        upd.error ? btn('upd-error', `${L('명령 출력', 'Output')} ${upd.open?.error ? '▾' : '▸'}`, () => act.toggleUpdate('error')) : null,
      ]
      break
    default:
      state = ago
        ? [
            <Text key="upd-state" dimColor>
              {L(`마지막 확인 ${ago}`, `Last checked ${ago}`)}
            </Text>,
          ]
        : []
      buttons = [checkBtn]
  }
  // 누를 수 있는 [업데이트 확인] 곁에만 — 통신은 Claude Code 가 그때만 한다는 풀이
  const canCheck = buttons.includes(checkBtn) || (upd.phase === 'failed' && upd.failedOn !== 'apply')
  const shown = buttons.filter(b => b !== null)
  // 판별 바뀐 것(U1): 새 판부터 DRAWER_VERSIONS 판까지 — 그 앞은 한 줄
  const versions = (upd.versions ?? []).filter(v => (upd.changes?.[v]?.length ?? 0) > 0)
  const listed = versions.slice(0, DRAWER_VERSIONS)
  const more = versions.length - listed.length
  return (
    <Box key="upd-drawer" flexDirection="column" marginTop={1} {...CARD}>
      {settingRow(
        ui,
        'upd-row',
        <Box key="upd-name" columnGap={1} alignItems="center">
          <Text bold>easy-compact</Text>
          {upd.own ? <Text dimColor>{upd.own}</Text> : null}
        </Box>,
        <Box key="upd-desc" flexDirection="column">
          {state.length > 0 ? (
            <Box key="upd-state-row" columnGap={1} alignItems="center" flexWrap="wrap">
              {state}
            </Box>
          ) : null}
          {canCheck ? (
            <Text key="upd-net" dimColor wrap="wrap">
              {L(
                '[업데이트 확인]을 누를 때만 Claude Code 가 GitHub 에서 마켓을 받아 옵니다. easy-compact 는 스스로 통신하지 않습니다.',
                'Claude Code fetches the marketplace from GitHub only when you press [Check for updates]. easy-compact itself never goes online.',
              )}
            </Text>
          ) : null}
        </Box>,
        shown.length > 0 ? shown : null,
        [
          upd.phase === 'failed' && upd.open?.error && upd.error ? (
            <Box key="upd-error-text">
              <Text dimColor wrap="wrap">
                {upd.error}
              </Text>
            </Box>
          ) : null,
        ],
      )}
      {/* 0.9.1 U6: 문제 제보 줄 + 진단 카드(0.9.0 의 [진단] 을 바꿈 — 보고 나서 복사 · 저장) */}
      {diagRow(act, ui, 'drawer', diag, surface)}
      {listed.length > 0 ? (
        <Box key="upd-list" flexDirection="column">
          {listed.map(v => (
            <Box key={`upd-v-${v}`} flexDirection="column" marginTop={1}>
              <Box key={`upd-v-${v}-head`} columnGap={1} alignItems="center">
                <Text bold>{`v${v}`}</Text>
                {v === upd.own ? <Text dimColor>{L('· 지금 버전', '· this version')}</Text> : null}
              </Box>
              {changesList(ui, `upd-v-${v}-list`, upd.changes![v]!)}
            </Box>
          ))}
          {more > 0 ? (
            <Text key="upd-more" dimColor wrap="wrap">
              {L(`그 앞 ${more}개 버전은 CHANGELOG 에`, `${more} earlier ${more === 1 ? 'version' : 'versions'} in the CHANGELOG`)}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )
}
