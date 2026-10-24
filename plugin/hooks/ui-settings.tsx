import type { ChangeGroup, CostShow, Optimal, ScreenView, Settings, Source, TidyStyleId, TtlConfig, UpdateState } from '../types'
import { approxUsd, cacheWarnFor, fmtTokens, fmtUsd, fmtUsdRange, krwRateDate, krwRateText, modelName, ratesFor, rewriteAllUsd, SESSION_TEXT, thresholds, ttlName, writeRate } from './cost'
import { isSlim, LAYOUTS, layoutName, layoutUse, PARTS, levelName, partName, partUse, setPart, BAND_MODES, BAND_PARTS, bandModeName, bandAutoUse, bandStateText, bandModeUse, bandPartName, bandShowOf, chooseScreen, editView, foldName, fmtUsd0, MONEY_COLOR_STEPS, nudgeSessionColor, paneAutoUse, paneSyncUse, infoName, infoUse, resetCustom, SCREEN_PRESETS, screenName, screenUse, screenStateText, setBandPart, setFolded, setLimits, viewOf, chooseTidy, customName, customUse, DEFAULT_SETTINGS, nudgeCache, CACHE_STEPS, CACHE_STEPS_5M, parseTokens, RANGE_BANDS, RANGE_ROWS, setCompactAt, thresholdsOf, TIDY_IDS, tidyStyles, tidySteps, usesCustom, BAND_ORDER_DEFAULT, moveEarlier, normalizeOrder, MONEY_ORDERS, moneyOf, withMoney, compactText, tidyBody, rangeBands, rangeRows, compactMax, contextWindowNow, autoCompactAt, revealWhere, autoBands, autoRangeDefault, setAutoRange } from './settings'
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

export const Q_STEPS = 10

export type CmpDraft = Pick<Settings, 'follow' | 'rangeStart' | 'rangeEnd' | 'compactAt'> & { sizeText?: string }

export function draftCompactAt(s: Settings, d: CmpDraft): number {
  const typed = d.sizeText === undefined ? null : parseTokens(d.sizeText)
  return typed === null ? d.compactAt : setCompactAt(s, typed).compactAt
}

export type SettingsActions = {
  save: (next: Settings) => void
  typeTidy: (text: string) => void
  saveTidy: (text: string) => void
  typeCompact: (text: string) => void
  saveCompact: (text: string) => void
  toggleRaw: () => void
  toggleFold: (key: string) => void
  setLang: (choice: Settings['lang']) => void
  setPaneOption: (key: 'paneAutoOpen' | 'paneShared', isOn: boolean) => void
  checkUpdate: () => void
  applyUpdate: () => void
  toggleUpdate: (key: 'changes' | 'error' | 'note') => void
  diagOpen: (where: 'drawer' | 'gen') => void
  diagClose: () => void
  diagRedact: (isOn: boolean) => void
  diagCopy: (surface?: string) => void
  diagSave: () => void
  diagReveal: () => void
  diagCopyPath: (surface?: string) => void
  setTab: (tab: SettingsTab) => void
  sizeError?: (msg: string | null) => void
}

export type SettingsTab = 'bar' | 'chip' | 'pane' | 'compact' | 'gen'
export const SETTINGS_TABS: readonly SettingsTab[] = ['bar', 'chip', 'pane', 'compact', 'gen']

export function settingsTabName(t: SettingsTab): string {
  return t === 'bar' ? L('바', 'Bar') : t === 'chip' ? L('답변 칩', 'Answer chip') : t === 'pane' ? L('패널', 'Pane') : t === 'compact' ? L('컴팩트', 'Compact') : L('일반', 'General')
}

export type SettingsPreviews = { bar: unknown; chip: unknown }

export type CacheInfo = {
  ttl: number
  measured: boolean
  config: TtlConfig | null
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
  ctxNow: number | null = null,
  surface = 'desktop',
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  previews: SettingsPreviews | null = null,
  hasLimits: boolean | null = null,
  compactDraft: string | null = null,
  tab: SettingsTab = 'bar',
  genExtra: unknown[] = [],
  sizeErr: string | null = null,
) {
  const { Box, Button, Code, Input, Select, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const save = act.save
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  const pick = (key: string, label: string, isOn: boolean, onPress: () => void) => pickButton(ui, key, label, isOn, onPress)
  const one = (key: string, label: string, isOn: boolean, onPress: () => void) => segButton(ui, key, label, isOn, onPress)
  const descOpen = isTerminal && open.descAll === true
  const stackFor = (name: string, ctrlW: number, hasDesc: boolean) => cols !== null && cols - 1 - Math.max(widthOf(name, isTerminal), hasDesc ? 24 : 12) - 2 < ctrlW
  const row = (key: string, name: string, desc: unknown, control: unknown, ctrlW: number, extra: unknown[] = [], nameEl?: unknown) => {
    const isOpen = open[`desc-${key}`] === true || descOpen
    return tipRow(ui, key, name, control, extra, nameEl, desc, control !== null && stackFor(name, ctrlW, false), {
      isOpen,
      onToggle: () => act.toggleFold(`desc-${key}`),
    })
  }
  const segW = (labels: readonly string[]) => labels.reduce((sum, l) => sum + buttonW(l), 0) + 1
  const chipsW = (labels: readonly string[]) => labels.reduce((sum, l) => sum + buttonW(l) + 1, 0)

  const isLean = false
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    if (!r) return null
    return which === 'write1h' ? rewriteAllUsd(size, r, opt?.shared ?? 0, ttl) : (size * r.read) / 1e6
  }
  const cfg = cache?.config ?? null
  const srcText = !cfg
    ? L('자동(로그인 방식 · 사용량에 따라 1시간 또는 5분)', 'automatic (1 h or 5 min, by how you sign in and your usage)')
    : cfg.source === 'force5m'
      ? L('환경 변수 FORCE_PROMPT_CACHING_5M(5분 고정)', 'env FORCE_PROMPT_CACHING_5M (5 min forced)')
      : cfg.source === 'env'
        ? L(`환경 변수 CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`, `env CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`)
        : cfg.source === 'setting'
          ? L(`설정 promptCacheTtl = ${cfg.value}`, `setting promptCacheTtl = ${cfg.value}`)
          : cfg.source === 'enable1h'
            ? L('환경 변수 ENABLE_PROMPT_CACHING_1H(1시간)', 'env ENABLE_PROMPT_CACHING_1H (1 h)')
            : L('자동(로그인 방식 · 사용량에 따라 1시간 또는 5분)', 'automatic (1 h or 5 min, by how you sign in and your usage)')
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

  const view = viewOf(s)
  const isCustomScreen = s.screen === 'custom'
  const editV = (change: (v: ScreenView) => ScreenView) => save(editView(s, change))
  const unit = (key: string, rows: unknown[]) => (
    <Box key={key} flexDirection="column">
      {rows}
    </Box>
  )
  const subName = (name: string, isDim = false, indent = 2) => (
    <Box key={`sub-${name}`} paddingLeft={indent}>
      <Text {...(isDim ? { dimColor: true } : {})}>{name}</Text>
    </Box>
  )
  const moneyLabel = (o: readonly string[]) => o.map(k => (k === 'session' ? L('세션', 'Session') : k === 'today' ? L('오늘', 'Today') : L('이번 달', 'This month'))).join(' · ')
  const lockNote = (key: string) =>
    isCustomScreen ? null : (
      <Text key={key} dimColor wrap="wrap">
        {L(
          "현재는 프리셋 설정이라 바꿀 수 없습니다. 바꾸려면 화면 프리셋 설정에서 '커스텀'을 고르세요.",
          'This is a preset, so it can’t be changed here. Pick Custom under Screen preset to change it.',
        )}
      </Text>
    )
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
  const colorsW = onTerminal() ? colorNames.length * 22 + 2 : colorNames.length * (5 + selectW(['$100'])) + 2
  const units = [
    { id: 'size' as const, name: L('크기', 'Size') },
    { id: 'pct' as const, name: '%' },
    { id: 'both' as const, name: L('둘 다', 'Both') },
  ]

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
  const sessionColorsRow = moneyColorsRow(
    'sessionColors',
    'session-colors',
    'color',
    L('세션 금액 색', 'Session cost'),
    L('바 · 패널의 세션 금액이 이 값을 넘으면 그 색.', 'The session cost on the bar and pane takes this color above each value.'),
  )
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
  const isButton = view.layout === 'button'
  const screenBlock = (
    <Box key="screen-row" flexDirection="column" marginTop={1}>
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

  const layoutRow = row(
    'bar-layout-row',
    L('바 꼴', 'Bar shape'),
    layoutUse(view.layout),
    isCustomScreen
      ? segGroup(ui, 'bar-layout-seg', LAYOUTS.map(l => one(`layout-${l}`, layoutName(l), view.layout === l, () => editV(v => ({ ...v, layout: l })))))
      : lockedSeg(ui, 'bar-layout-v', LAYOUTS.map(l => ({ key: `layout-${l}`, label: layoutName(l), isOn: view.layout === l }))),
    segW(LAYOUTS.map(layoutName)),
  )
  const wholeBar = plainCard(ui, 'set-bar-all', L('바', 'Bar'), [
    previews?.bar ?? null,
    layoutRow,
    view.layout === 'three'
      ? row(
          'band-mode-row',
          L('바 크기', 'Bar size'),
          bandModeUse(s.band),
          segGroup(ui, 'band-mode-seg', BAND_MODES.map(m => one(`band-${m}`, bandModeName(m), s.band === m, () => save({ ...s, band: m })))),
          segW(BAND_MODES.map(m => bandModeName(m))),
        )
      : null,
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
                      {gaugeEl(ui, surface, x.ctx, { key: `gauge-strip-${x.id}-svg`, alt: x.name, px: 16, blink: x.blink, busy: x.busy, motion })}
                      <Text dimColor>{x.name}</Text>
                    </Box>
                  ))}
                </Box>
              )
            })(),
          ],
        ),
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
    isButton ? null : row('status-line-row', L('입력창 아래 한 줄', 'Line below the input'), statusLineUse(), onOffControl(ui, 'statusLine', s.statusLine, on => save({ ...s, statusLine: on })), onOffW()),
  ])
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

  const chipTab = [
    plainCard(ui, 'set-chip', L('답변 끝 칩', 'Answer chip'), [
      previews?.chip ?? null,
      unit('chip-unit', [
        lockNote('chip-locked'),
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
      isTerminal
        ? null
        : row(
            'hover-row',
            L('질문 강조', 'Highlight'),
            L(
              '칩이나 패널의 질문 줄에 마우스를 올리면 그 답변의 칸마다 왼쪽에 파란 막대가 생깁니다.',
              'Hover a chip or a question row in the pane to mark each block of that answer with a blue bar on the left.',
            ),
            onOffControl(ui, 'questionHover', s.questionHover, on => save({ ...s, questionHover: on })),
            onOffW(),
          ),
    ]),
  ]

  const paneTab = [
    plainCard(ui, 'set-pane', paneTitle(), [
      row('pane-auto-row', L('새 세션에서 패널 열기', 'Open the pane in new sessions'), paneAutoUse(s.paneAutoOpen), onOffControl(ui, 'paneAutoOpen', s.paneAutoOpen, on => act.setPaneOption('paneAutoOpen', on)), onOffW()),
      isTerminal
        ? null
        : row('pane-sync-row', L('모든 세션 패널 같이 여닫기', 'Open and close the pane in all sessions'), paneSyncUse(s.paneShared), onOffControl(ui, 'paneShared', s.paneShared, on => act.setPaneOption('paneShared', on)), onOffW()),
    ]),
  ]

  const zoneCard = plainCard(ui, 'set-zone', L('컴팩트 시점', 'When to compact'), [
    drawCompactTiming({ save, sizeError: msg => act.sizeError?.(msg), toggle: act.toggleFold }, ui, s, opt, ctxNow, surface, cols === null ? null : cols - CARD_INSET, cache, 'simple', sizeErr, open, null, true),
  ])
  const compactTab = [zoneCard, tidyNote, isLean ? null : cacheSection]

  const genTab = [
    plainCard(ui, 'set-gen', L('일반', 'General'), [
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

  const body = tab === 'chip' ? chipTab : tab === 'pane' ? paneTab : tab === 'compact' ? compactTab : tab === 'gen' ? genTab : barTab
  return (
    <Box flexDirection="column">
      {topRows}
      {tabRow}
      {body}
    </Box>
  )
}

export type TimingActions = { save: (next: Settings) => void; sizeError: (msg: string | null) => void; toggle?: (key: string) => void }

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
  autoBand: { start: number; end: number } | null = null,
  withAuto = false,
) {
  const { Box, Button, Input, Select, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  const stackFor = (name: string, ctrlW: number, hasDesc: boolean) => cols !== null && cols - 1 - Math.max(widthOf(name, isTerminal), hasDesc ? 24 : 12) - 2 < ctrlW
  const toggleOf = (key: string) => (act.toggle ? { isOpen: open[`desc-${key}`] === true, onToggle: () => act.toggle!(`desc-${key}`) } : undefined)
  const row = (key: string, name: string, desc: unknown, control: unknown, ctrlW: number, extra: unknown[] = [], nameEl?: unknown, isContent = false) =>
    isTerminal && isContent
      ? settingRow(ui, key, nameEl ?? name, desc, control, extra, control !== null && stackFor(name, ctrlW, true))
      : tipRow(ui, key, name, control, extra, nameEl, isTerminal && !act.toggle ? null : desc, control !== null && stackFor(name, ctrlW, false), toggleOf(key))
  const d: CmpDraft = { follow: s.follow, rangeStart: s.rangeStart, rangeEnd: s.rangeEnd, compactAt: s.compactAt }
  const dAt = s.compactAt
  const edit = (next: CmpDraft) => act.save({ ...s, follow: next.follow, rangeStart: next.rangeStart, rangeEnd: next.rangeEnd, compactAt: draftCompactAt(s, next) })
  const dt = d.follow ? rangeThresholdsFor(d.rangeStart, d.rangeEnd, modelId, s.cacheWarnMin) : thresholdsFor(dAt, modelId, s.cacheWarnMin)
  const leadW = nameColW([L('질문', 'Questions'), L('지금', 'Now')])
  const textW = cols === null ? null : mode === 'simple' ? (isStackedFor(cols + CARD_INSET, leadW) ? cols : cols - leadW - 1) : cols - CARD_INSET

  const capNote =
    opt?.capped != null
      ? L(` ${model}는 ${fmtTokens(opt.capped)}를 넘으면 요금이 5배라 그 아래로 묶습니다.`, ` ${model} costs 5× above ${fmtTokens(opt.capped)}, so it stays below that.`)
      : ''
  const penOf = (size: number) => (inputs && opt?.model ? (penaltyAt(size, opt.model, inputs, opt.growth)?.pct ?? null) : null)

  const cell = (key: string, width: number, el: unknown) => (
    <Box key={key} width={width} flexShrink={0}>
      {el}
    </Box>
  )
  const usdAt = (size: number, which: 'read' | 'write1h') => {
    const r = modelId ? ratesFor(modelId, size) : null
    if (!r) return null
    return which === 'write1h' ? rewriteAllUsd(size, r, opt?.shared ?? 0, ttl) : (size * r.read) / 1e6
  }
  const pctText = (p: number | null) => (p === null ? '—' : p < 0.5 ? '0' : `+${Math.round(p)}`)
  const pad = (text: string) => `  ${text}  `
  const appliedText = s.follow
    ? L(`구간 ${fmtTokens(s.rangeStart)} ~ ${fmtTokens(s.rangeEnd)}`, `range ${fmtTokens(s.rangeStart)} – ${fmtTokens(s.rangeEnd)}`)
    : L(`직접 지정 ${fmtTokens(s.compactAt)}`, `fixed ${fmtTokens(s.compactAt)}`)
  const appliedT = thresholdsOf(s, modelId)
  const isLean = mode === 'simple'
  const ctxColor = ctxNow === null ? undefined : ctxNow >= appliedT.ctxCut ? 'error' : ctxNow >= appliedT.ctxWarn ? '#d9722b' : undefined
  const appliedRow = !(ctxNow !== null && ctxNow > 0) ? null : (
    <Box key="cmp-applied" columnGap={1} alignItems="center" flexWrap="wrap">
      {ctxNow !== null && ctxNow > 0 ? <Text>{L('현재 컨텍스트', 'Current context')}</Text> : null}
      {ctxNow !== null && ctxNow > 0 ? (
        <Text bold {...(ctxColor ? { color: ctxColor } : {})}>
          {fmtTokens(ctxNow)}
        </Text>
      ) : null}
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
  let termW = 12
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
      <Box key={key} columnGap={1} alignItems={isTerminal ? 'flex-start' : 'center'}>
        {cell('t', termW, <Text {...(nameColor ? { color: nameColor, bold: true } : {})}>{name}</Text>)}
        <Box flexShrink={1} minWidth={0} columnGap={1} flexWrap="wrap">
          {descEl(desc)}
        </Box>
      </Box>
    )
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
  const leanNote = (
    <Box key="cmp-lean" marginTop={1}>
      <Text dimColor wrap="wrap">
        {L('★ 최적 · 좋음 · 보통 · 비추천은 이 세션 값으로 판정합니다.', '★ Best, good, fair and not advised are judged from this session.')}
      </Text>
    </Box>
  )
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

  const starAt = opt?.at != null && inputs ? rangeBands().findIndex(([a, b]) => opt.at! >= a && opt.at! < b) : -1
  const bandName = (a: number, b: number) => bandNumText(a, b, contextWindowNow(), s.ctxUnit)
  const num = (n: number) => ctxNumText(n, contextWindowNow(), s.ctxUnit)
  const bandLabels = rangeBands().map(([a, b]) => bandName(a, b))
  const manualLabel = L('직접 입력…', 'Enter a size…')
  const allNote = <Text key="cmp-all" dimColor>{L('모든 세션에 적용', 'All sessions')}</Text>
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
    const perQ = opt?.perQuestion ?? null
    const qExtra = perQ?.extraUsd ?? 0
    const qAt = (size: number) => {
      const read = usdAt(size, 'read')
      return read !== null ? Q_STEPS * (read + qExtra) : null
    }
    const usd2 = (x: number | null, y: number | null) => (x === null || y === null ? '—' : fmtUsdRange(x, y))
    const curVerdict = penVerdict(penOf(d.rangeStart))
    const curStar = starAt >= 0 && rangeBands().findIndex(([a, b]) => a === d.rangeStart && b === d.rangeEnd) === starAt
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
      [isLean ? rangeNow : null, errLine].filter(x => x !== null),
    )
    const starBand = starAt >= 0 ? rangeBands()[starAt]! : null
    const isStarOn = starBand !== null && d.rangeStart === starBand[0] && d.rangeEnd === starBand[1]
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
    const highBad = rangeBands().find(([a], i) => i > starAt && isNotRecommended(penOf(a)))
    const lastBand = rangeBands()[rangeBands().length - 1]!
    const lastBandName = bandName(lastBand[0], lastBand[1])
    const lowBad = rangeBands().filter(([a], i) => i < starAt && isNotRecommended(penOf(a)))
    const badParts = [
      lowBad.length > 0 ? bandName(lowBad[0]![0], lowBad[lowBad.length - 1]![1]) : null,
      highBad ? L(`${num(highBad[0])} 이상`, `${num(highBad[0])} and up`) : null,
    ].filter((p): p is string => p !== null)
    const badDesc =
      badParts.length > 0
        ? L(
            `${badParts.join(' · ')} 구간으로, 최적보다 요청당 +${PEN_BAD_PCT}% 넘게 듭니다${highBad ? `. ${lastBandName} 구간은 자동 컴팩트(약 ${fmtTokens(autoCompactAt())}) 바로 앞입니다` : ''}`,
            `${badParts.join(' · ')}: over +${PEN_BAD_PCT}% per request vs best${highBad ? `. ${lastBandName} is right before auto-compact (~${fmtTokens(autoCompactAt())})` : ''}`,
          )
        : null
    const tableOpen = true
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
    const nowTagText = ctxNow !== null && ctxNow > 0 ? L(`지금 ${num(ctxNow)}`, `Now ${num(ctxNow)}`) : null
    const chosenTag = L('고른 구간', 'Chosen')
    const autoTag = L('오토', 'Auto')
    const isAutoBand = (a: number, b: number) => autoBand !== null && autoBand.start === a && autoBand.end === b
    const nowIdx = nowTagText === null ? -1 : rangeBands().findIndex(([a, b], i, all) => ctxNow! >= a && (ctxNow! < b || (i === all.length - 1 && ctxNow! <= b)))
    const nowAtBand = (i: number) => i === nowIdx
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
    const hasPen = kept.some(c => c.id === 'pen')
    const shownCols = hasPen
      ? [bandCol, ...kept.map(c => (c.id === 'pen' ? { ...c, head: L('최적보다 · 판정', 'Over best · verdict'), cells: c.cells.map((x, i) => `${x} ${verdictCol.cells[i]}`.trim()) } : c))]
      : [bandCol, ...kept, verdictCol]
    const has = (id: string) => kept.some(c => c.id === id)
    const showRead = has('read')
    const showQ = has('q')
    const showCold = has('cold')
    const rowColor = (i: number): string | undefined => {
      const [a] = rangeBands()[i]!
      return i === starAt ? STAR_COLOR : (penVerdict(penOf(a))?.color ?? penColorOf(penOf(a)) ?? undefined)
    }
    const cellColor = (c: Col, i: number): string | undefined => (c.id === 'band' ? (i === starAt ? STAR_COLOR : undefined) : rowColor(i))
    const gcell = (key: string, width: number, el: unknown) => (
      <Box key={key} width={width} flexShrink={0} justifyContent="center">
        {el}
      </Box>
    )
    const bands = rangeBands()
    const hasNow = ctxNow !== null && ctxNow > 0
    const nowAt = !hasNow ? -1 : bands.findIndex(([a, b], i) => ctxNow! >= a && (ctxNow! < b || (i === bands.length - 1 && ctxNow! <= b)))
    const isBelowFirst = hasNow && nowAt < 0 && ctxNow! < bands[0]![0]
    const nowBg = isTerminal ? 'userMessageBackground' : 'rgba(109,167,236,0.08)'
    const nowNote = isBelowFirst ? (
        <Box key="cmp-now-note" marginTop={1}>
          <Text dimColor wrap="wrap">
            {L(`지금 컨텍스트 ${num(ctxNow!)} 는 첫 구간(${num(bands[0]![0])})보다 작습니다`, `Now ${num(ctxNow!)}, below the first range (${num(bands[0]![0])})`)}
          </Text>
        </Box>
      ) : null
    const cw = (c: Col) => colW(c)
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
        <Box key="cmp-table-row" marginTop={1}>
          {isTerminal ? <Text bold>{L('크기별 비용', 'Cost by size')}</Text> : hoverTip(
              ui,
              'cmp-table-tip',
              <Text bold>{L('크기별 비용', 'Cost by size')}</Text>,
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
        <Input
          key="cmp-size-input"
          value={fmtTokens(s.compactAt)}
          placeholder="300k"
          onSubmit={v => {
            const n = parseTokens(v)
            if (n === null) return act.sizeError(L('크기를 읽지 못했습니다. 예: 300k', 'Couldn’t read the size. Example: 300k'))
            if (n > compactMax()) return act.sizeError(L(`최대 컨텍스트(${fmtTokens(compactMax())})보다 커서 저장하지 않았습니다`, `Larger than the max context (${fmtTokens(compactMax())}) — not saved`))
            if (n < COMPACT_MIN) return act.sizeError(L(`너무 작습니다. ${fmtTokens(COMPACT_MIN)} 이상으로 정하세요.`, `Too small. Use ${fmtTokens(COMPACT_MIN)} or more.`))
            act.sizeError(null)
            edit({ ...d, follow: false, compactAt: setCompactAt(s, n).compactAt, sizeText: undefined })
          }}
        />,
      ],
      choiceW([...bandLabels, manualLabel]) + widthOf(L('모든 세션에 적용', 'All sessions'), isTerminal) + 12,
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

  const autoNowValue = `${s.autoStart}-${s.autoEnd}`
  const autoName = (a: number, b: number) => bandNumText(a, b, contextWindowNow(), s.ctxUnit)
  const autoOpts = autoBands().map(([a, b]) => ({ value: `${a}-${b}`, label: autoName(a, b) }))
  const autoChoices = autoOpts.some(o => o.value === autoNowValue) ? autoOpts : [...autoOpts, { value: autoNowValue, label: autoName(s.autoStart, s.autoEnd) }]
  const autoFresh = autoRangeDefault()
  const autoRow = withAuto
    ? row(
        'auto-range-pick',
        L('이지 오토 구간', 'Easy Auto range'),
        L(
          `이 세션에만 적용되고, 새 세션은 ${autoName(autoFresh.start, autoFresh.end)}에서 시작합니다. 답이 끝났을 때 앞쪽을 넘었으면 저장하고 컴팩트합니다. 일하는 도중 뒤쪽을 넘으면 멈추고 저장, 컴팩트한 뒤 이어서 합니다. 켜기는 [컴팩트] 팝업에서 합니다.`,
          `Applies to this session only; a new session starts at ${autoName(autoFresh.start, autoFresh.end)}. When an answer ends past the start, it saves and compacts. If work goes past the end, it pauses, saves, compacts and then continues. Turn it on from the [Compact] popup.`,
        ),
        [
          <Text key="auto-this" dimColor>
            {L('이 세션', 'This session')}
          </Text>,
          choiceControl(ui, 'auto-range-select', autoChoices, autoNowValue, v => {
            const [a, b] = v.split('-').map(Number)
            if (a && b) act.save(setAutoRange(s, a, b))
          }),
        ],
        choiceW(autoChoices.map(o => o.label)) + widthOf(L('이 세션', 'This session'), isTerminal) + 2,
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
  ctxNow: number | null = null,
  autoLang: Lang | null = null,
  cols: number | null = null,
  open: Record<string, boolean> = {},
  cache: CacheInfo | null = null,
  previews: SettingsPreviews | null = null,
  hasLimits: boolean | null = null,
  compactDraft: string | null = null,
  tab: SettingsTab = 'bar',
  diag: DiagView | null = null,
  sizeErr: string | null = null,
) {
  const { Box, Text } = ui
  const look = phaseLook(phase, kind)
  const autoName = autoLang === 'ko' ? '한국어' : autoLang === 'en' ? 'English' : null
  const autoLabel = autoName ? L(`자동(${autoName})`, `Auto (${autoName})`) : L('자동', 'Auto')
  const langPick = (key: string, label: string, choice: Settings['lang']) => pickButton(ui, key, label, s.lang === choice, () => act.setLang(choice))
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
  const isWon = s.currency === 'krw'
  const currencyRow = settingRow(
    ui,
    'currency-row',
    L('금액 단위', 'Currency'),
    isWon
      ? L('달러 금액을 아래 환율로 바꾼 어림입니다. 앱 사용량 화면은 달러입니다.', "Dollar amounts converted at the rate below, so they are estimates. The app's usage screen stays in dollars.")
      : L('바 · 패널 · 답변 칩의 금액을 이 단위로 보입니다.', 'Shows bar, pane and answer chip amounts in this unit.'),
    choiceControl(
      ui,
      'currency-pick',
      [
        { value: 'usd', label: L('달러($)', 'Dollar ($)') },
        { value: 'krw', label: L('원(₩)', 'Won (₩)') },
      ],
      s.currency,
      v => act.save({ ...s, currency: v === 'krw' ? 'krw' : 'usd' }),
    ),
  )
  const fxDate = krwRateDate()
  const rateRow = isWon
    ? settingRow(
        ui,
        'krw-rate-row',
        L('환율(1달러)', 'Rate (per $1)'),
        fxDate
          ? L(`${fxDate.slice(5)} 유럽중앙은행 기준(frankfurter.app)입니다. 그날 값이 한국 시간 자정 무렵 나와서 보통 전날 값이고, 오늘 받은 적이 없을 때만 받습니다. 카드 청구는 카드사 환율과 수수료로 조금 다릅니다.`, `ECB reference rate of ${fxDate} (frankfurter.app). The ECB publishes around 16:00 CET, so this is often the previous day's rate; it is fetched only when it hasn't been fetched today. Card charges differ slightly.`)
          : L('아직 환율을 받지 못해 들어 있는 값으로 셉니다. 1시간마다 다시 받습니다.', 'Not fetched yet, so the built-in rate is used. Retries every hour.'),
        <Text key="krw-rate-value" bold>
          {krwRateText()}
        </Text>,
      )
    : null
  const dot = look ? pulseDot(ui, surface, look.hex, look.text) : null
  return (
    <Box key="s-settings" flexDirection="column">
      {look ? (
        <Box key="s-busy" columnGap={1} alignItems="flex-start">
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
      {drawSettings(act, ui, s, opt, draft, rawOpen, act.toggleRaw, ctxNow, surface, cols, open, cache, previews, hasLimits, compactDraft, tab, [diagRow(act, ui, 'gen', diag, surface), langRow, currencyRow, ...(rateRow ? [rateRow] : [])], sizeErr)}
    </Box>
  )
}

function agoText(iso: string | null, nowMs: number): string | null {
  const at = iso ? Date.parse(iso) : Number.NaN
  if (!Number.isFinite(at) || nowMs <= 0) return null
  const days = Math.floor((nowMs - at) / 86_400_000)
  if (days <= 0) return L('오늘', 'today')
  return L(`${days}일 전`, `${days} ${days === 1 ? 'day' : 'days'} ago`)
}

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

const DRAWER_VERSIONS = 6

const DIAG_HEAD_TERMINAL = 20

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
      state = [
        <Text key="upd-state" color="success" wrap="wrap">
          {L(`${upd.market ?? ''} 버전을 받았습니다. 곧 적용되고, 그대로면 앱을 다시 켜세요.`, `Downloaded ${upd.market ?? ''}. It applies shortly; restart the app if it doesn’t.`)}
        </Text>,
      ]
      buttons = [checkBtn]
      break
    case 'synced':
      state = [
        <Text key="upd-state" dimColor wrap="wrap">
          {L('claude.ai 디렉터리에서 받은 버전입니다. 새 버전은 Claude Code 를 켤 때 저절로 받습니다.', "Installed from Anthropic's directory. Claude Code picks up new versions by itself when it starts.")}
        </Text>,
      ]
      break
    case 'dev':
      state = [
        <Text key="upd-state" dimColor wrap="wrap">
          {upd.devOff
            ? L('개발자 모드가 꺼져 공개 버전처럼 보이는 중입니다. 폴더에서 불러온 버전이라 업데이트 버튼은 없습니다.', 'Dev mode is off, so it looks like the public build. Loaded from a folder, so there is no Update button.')
            : L('개발자 모드입니다. 폴더에서 불러온 버전이라 업데이트 버튼이 없으니 저장소에서 받으세요.', 'Dev mode. Loaded from a folder, so there is no Update button. Pull it from the repository.')}
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
  const canCheck = buttons.includes(checkBtn) || (upd.phase === 'failed' && upd.failedOn !== 'apply')
  const shown = buttons.filter(b => b !== null)
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
                '[업데이트 확인]을 누를 때만 Claude Code 가 GitHub 에서 마켓을 받아 옵니다. easy-compact 는 스스로 통신하지 않습니다(금액 단위가 원이면 오늘 받은 환율이 없을 때 환율만 받습니다).',
                'Claude Code fetches the marketplace from GitHub only when you press [Check for updates]. easy-compact itself never goes online (except the exchange rate, when amounts are in won and today’s rate hasn’t been fetched yet).',
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
