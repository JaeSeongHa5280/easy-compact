import type { ChangeGroup, CostShow, Optimal, ScreenView, Settings, Source, TidyStyleId, TtlConfig, UpdateState } from '../types'
import { cacheWarnFor, fmtTokens, fmtUsd, modelName, ratesFor, rewriteAllUsd, SESSION_TEXT, ttlName, writeRate } from './cost'
import { BAND_MODES, BAND_PARTS, bandModeName, bandAutoUse, bandStateText, bandModeUse, bandPartName, bandShowOf, chooseScreen, editView, foldName, fmtUsd0, nudgeSessionColor, SESSION_COLOR_STEPS, paneAutoUse, paneSyncUse, infoName, infoUse, resetCustom, SCREEN_PRESETS, screenName, screenUse, screenStateText, setBandPart, setFolded, setLimits, viewOf, chooseTidy, customName, customUse, DEFAULT_SETTINGS, nudgeCache, CACHE_STEPS, CACHE_STEPS_5M, parseTokens, RANGE_BANDS, RANGE_ROWS, setCompactAt, thresholdsOf, TIDY_IDS, tidyStyles, tidySteps, usesCustom, BAND_ORDER_DEFAULT, moveEarlier, normalizeOrder, MONEY_ORDERS, moneyOf, withMoney, compactText, tidyBody, rangeBands, rangeRows, compactMax, autoCompactAt } from './settings'
import { COMPACT_MIN, penaltyAt, rangeThresholdsFor, thresholdsFor, WARN_RATIO } from './optimal'
import { tidyScript } from './tidy'
import { L } from './i18n'
import type { Lang } from './i18n'
import { ACCENT, STAR_COLOR, SEG_ON_EDGE, hoverTip, tipRow, PEN_WARN_PCT, PEN_BAD_PCT, penColorOf, isNotRecommended, penVerdict, phaseLook, pickButton, pulseDot, CARD, CARD_INSET, decoIcon, LIVE_HEX, nameColW, isStackedFor, section, segButton, segGroup, appSection, settingRow, onOffControl, onOffW, buttonW, selectW } from './ui-common'
import type { Fold } from './ui-common'
import { fitLine } from './ui-band'
import type { LineCell } from './ui-band'
import { cellsOf, widthOf } from './text'
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
  /** 캐시 유지 시간(커스텀만): 사용자 설정 파일의 promptCacheTtl — null = 자동(키를 지움) */
  setTtl: (value: '5m' | '1h' | null) => void
  /** 업데이트 칸(설치본만): [업데이트 확인] · [업데이트] · 펼침(바뀐 것 · 오류 원문) */
  checkUpdate: () => void
  applyUpdate: () => void
  toggleUpdate: (key: 'changes' | 'error' | 'note') => void
  /** 컴팩트 시점 안내 줄의 [현황에서 고르기] — 현황 탭으로(0.6.0, 컴팩트 시점을 현황으로 옮김) */
  openOverview: () => void
}

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
  preview: unknown = null,
  hasLimits: boolean | null = null,
  compactDraft: string | null = null,
) {
  const { Box, Button, Code, Input, Markdown, Select, Text } = ui
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
    return tipRow(ui, key, name, control, extra, nameEl, desc, control !== null && stackFor(name, ctrlW, isOpen && desc !== null && desc !== undefined && desc !== ''), {
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
  // 따로(5분 캐시에 10분 경고면 늘 노랑). 유지 시간 바꾸기는 커스텀에서만 — 잘 모르고 바꾸면 손해만 본다
  const cfg = cache?.config ?? null
  const srcText = !cfg
    ? L('자동(구독 요금제 사용량 안 1시간 · API 키 · 사용량 초과 5분)', 'automatic (1 h within a subscription plan · 5 min on an API key or over the plan)')
    : cfg.source === 'force5m'
      ? L('환경 변수 FORCE_PROMPT_CACHING_5M(5분 고정)', 'env FORCE_PROMPT_CACHING_5M (5 min forced)')
      : cfg.source === 'env'
        ? L(`환경 변수 CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`, `env CLAUDE_CODE_PROMPT_CACHE_TTL = ${cfg.value}`)
        : cfg.source === 'setting'
          ? L(`설정 promptCacheTtl = ${cfg.value}`, `setting promptCacheTtl = ${cfg.value}`)
          : cfg.source === 'enable1h'
            ? L('환경 변수 ENABLE_PROMPT_CACHING_1H(1시간)', 'env ENABLE_PROMPT_CACHING_1H (1 h)')
            : L('자동(구독 요금제 사용량 안 1시간 · API 키 · 사용량 초과 5분)', 'automatic (1 h within a subscription plan · 5 min on an API key or over the plan)')
  // 환경 변수가 정하면 설정 파일을 바꿔도 안 먹는다(엔진 순서)
  const isEnvFixed = cfg?.source === 'force5m' || cfg?.source === 'env'
  const rNow = ctxNow !== null && ctxNow > 0 && modelId ? ratesFor(modelId, ctxNow) : null
  const minsLeft = cache?.minsLeft ?? null
  const isLateNow = minsLeft !== null && minsLeft < cacheWarnFor(s, ttl)
  const stateText = cache?.isCold
    ? L('캐시 만료 — 다음 요청이 대화 전체를 다시 씁니다', 'Cache expired — the next request rewrites the whole conversation')
    : minsLeft !== null
      ? L(`캐시 만료까지 ${minsLeft}분 남음`, `Cache expires in ${minsLeft} min`)
      : L('첫 요청 뒤부터 잽니다', 'Measured after the first request')
  const readNow = ctxNow !== null && ctxNow > 0 ? usdAt(ctxNow, 'read') : null
  const rewriteNow = rNow ? (ctxNow! * writeRate(rNow, ttl)) / 1e6 : null
  const whyText =
    readNow !== null && rewriteNow !== null
      ? L(
          `Claude 가 이 대화(${fmtTokens(ctxNow!)})를 ${ttlName(ttl)} 기억합니다. 그 안에 다음 질문을 보내면 캐시에서 읽어 요청당 ~${fmtUsd(readNow)}, 넘기면 전체를 다시 써 ~${fmtUsd(rewriteNow)} 가 한 번 더 듭니다. 그때 바로 컴팩트할지는 바 · 이지 컴팩트 버튼이 알려 줍니다.`,
          `Claude keeps this conversation (${fmtTokens(ctxNow!)}) for ${ttlName(ttl)}. Ask again within it and it is read from cache at ~${fmtUsd(readNow)} per request; after it, rewriting everything costs ~${fmtUsd(rewriteNow)} once. The bar and the Easy Compact button then tell you whether to compact right away.`,
        )
      : L(
          `Claude 가 이 대화를 ${ttlName(ttl)} 기억합니다. 그 안에 다음 질문을 보내면 싸게 읽고, 넘기면 대화 전체를 다시 써 비쌉니다. 그때 바로 컴팩트할지는 바 · 이지 컴팩트 버튼이 알려 줍니다.`,
          `Claude keeps this conversation for ${ttlName(ttl)}. Ask again within it and it is read cheaply; after it, the whole conversation is rewritten at a higher price. The bar and the Easy Compact button then tell you whether to compact right away.`,
        )
  // 유지 시간 [자동 · 1시간 · 5분]: 커스텀 · 설정 파일이 있으면 묶음 버튼, 못 바꾸면 흐린 묶음 버튼(앱의 흐림 — 사용자 2026-10-15) + 까닭은 풀이에
  const ttlOpts = [
    { key: 'ttl-auto', label: L('자동', 'Automatic'), value: null },
    { key: 'ttl-1h', label: L('1시간', '1 hour'), value: '1h' },
    { key: 'ttl-5m', label: L('5분', '5 min'), value: '5m' },
  ] as const
  const canSetTtl = s.screen === 'custom' && !isEnvFixed && !!cfg?.userFile
  const ttlNow = cfg?.userSetting ?? null
  const dimPick = (key: string, label: string, isOn: boolean) =>
    isTerminal ? (
      <Button key={key} label={`${isOn ? '✓' : ' '} ${label}`} variant="secondary" dimColor onPress={() => {}} />
    ) : isOn ? (
      <Button key={key} label={label} variant="secondary" dimColor onPress={() => {}} />
    ) : (
      <Button key={key} label={label} plain dimColor onPress={() => {}} />
    )
  const ttlSeg = segGroup(
    ui,
    'ttl-seg',
    ttlOpts.map(o => (canSetTtl ? one(o.key, o.label, ttlNow === o.value, () => act.setTtl(o.value)) : dimPick(o.key, o.label, ttlNow === o.value))),
  )
  const ttlWhy =
    s.screen !== 'custom'
      ? L('바꾸기는 화면 → 커스텀에서(모르고 바꾸면 손해라 간단 · 자세히 화면에선 막아 둠)', 'Change it under Screen → Custom (locked in presets — changing it blindly costs money)')
      : isEnvFixed
        ? L('환경 변수가 정해 여기서 못 바꿉니다', 'An environment variable decides it, so it cannot be changed here')
        : !cfg?.userFile
          ? L('설정 파일을 못 찾아 못 바꿉니다', 'Settings file not found, so it cannot be changed')
          : null
  const ttlRow = row(
    'cache-ttl',
    L('유지 시간', 'Lifetime'),
    <Box key="cache-ttl-desc" flexDirection="column">
      <Text dimColor wrap="wrap">
        {L(
          `지금 ${ttlName(ttl)}${cache?.measured ? '(이 세션 기록에서 잼)' : '(추정 — 첫 요청 뒤 기록으로 잽니다)'} · 정하는 곳: ${srcText}`,
          `Now ${ttlName(ttl)}${cache?.measured ? ' (measured from this session)' : ' (estimated — measured after the first request)'} · set by: ${srcText}`,
        )}
      </Text>
      {ttlWhy ? (
        <Text wrap="wrap" {...(isEnvFixed ? { color: 'warning' } : { dimColor: true })}>
          {ttlWhy}
        </Text>
      ) : null}
      <Text dimColor wrap="wrap">
        {L(
          '1시간 = 쓰기가 입력 요율의 2배 · 1시간 안에 돌아오면 다시 안 씀. 5분 = 쓰기 1.25배 · 5분 넘게 쉬면 컨텍스트 전체를 다시 씀.',
          '1 hour = writes cost 2× input · no rewrite if you are back within an hour. 5 min = writes cost 1.25× · a break over 5 min rewrites the whole context.',
        )}
      </Text>
    </Box>,
    ttlSeg,
    segW(ttlOpts.map(o => o.label)),
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
      // R2: 분 = 드롭다운(값 목록 — −/+ 를 여러 번 누르지 않게)
      <Select
        key={`${key}-pick`}
        options={steps.map((m, i) => ({ value: String(m), label: labels[i]! }))}
        value={String(v)}
        onSelect={x => save(forTtl < 60 ? { ...s, cacheWarnMin5m: Number(x) } : { ...s, cacheWarnMin: Number(x) })}
      />,
      selectW(labels),
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
  const cacheSection = appSection(ui, 'set-cache', L('캐시', 'Cache'), [stateLine, ttlRow, warnRow('cache', 60), warnRow('cache5', 5), whyLine])

  // ── 컴팩트 문구: 드롭다운으로 프리셋을 고르면
  // 두 칸이 그 글로 채워지고, 칸을 고쳐 저장하면 "직접 쓰기". ① 은 [저장하고 컴팩트] 저장 턴의 가운데(앞뒤 잃을 정보 확인 · [컴팩트 진행]
  // 표시는 mod 고정 — 흐름이 안 깨지게), ② 는 /compact 뒤(저장하고 컴팩트 = mod 의 "직전 답 남김" 뒤 · 바로 컴팩트 = 이 글만)
  const isCustom = s.tidy === 'custom'
  const steps = tidySteps(s)
  const tidyLabels = [...TIDY_IDS.map(id => tidyStyles()[id].name), L('직접 쓰기', 'Write my own')]
  const preText = isCustom ? s.tidyCustom : tidyBody(s).join(' ')
  // N5: 터미널은 입력칸이 흐린 예시 글 한 줄로만 보여 칸인지 몰랐다 → 테두리 칸
  const inputBox = (key: string, el: unknown) => (
    <Box key={key} {...(isTerminal ? { borderStyle: 'round', borderColor: 'promptBorder', paddingX: 1 } : {})}>
      {el}
    </Box>
  )
  const tidy = appSection(ui, 'set-tidy', L('컴팩트 문구', 'Compact text'), [
    row(
      'tidy-pick-row',
      L('문구', 'Text'),
      L('고르면 아래 두 칸이 그 글로 채워집니다 — 칸을 고쳐 저장하면 "직접 쓰기"', 'Picking fills the two boxes below — saving an edited box switches to "Write my own"'),
      <Select
        key="tidy-pick"
        options={[...TIDY_IDS.map(id => ({ value: id, label: tidyStyles()[id].name })), { value: 'custom', label: L('직접 쓰기', 'Write my own') }]}
        value={s.tidy}
        onSelect={v => save(v === 'custom' ? { ...s, tidy: 'custom' } : chooseTidy(s, v))}
      />,
      selectW(tidyLabels),
      [
        isCustom ? null : (
          <Text key="tidy-use" wrap="wrap">
            {tidyStyles()[s.tidy as TidyStyleId].use}
          </Text>
        ),
        isCustom ? (
          <Text key="tidy-steps" dimColor wrap="wrap">
            {L('아래 두 칸에 쓴 글대로 보냅니다(비운 칸은 일반 문구)', 'Sends what the two boxes below say (an empty box uses Normal)')}
          </Text>
        ) : (
          <Box key="tidy-steps" columnGap={1} flexWrap="wrap">
            <Text dimColor>{L('저장', 'Save')}</Text>
            <Text bold>{steps.keep}</Text>
            <Text dimColor>{L('· 답', '· Reply')}</Text>
            <Text bold>{steps.reply}</Text>
          </Box>
        ),
      ],
    ),
    row(
      'tidy-pre-row',
      L('① 컴팩트 전에 보낼 글', '① Text sent before compacting'),
      L('[저장하고 컴팩트]의 저장 턴에 보냅니다 — 잃을 정보 확인과 [컴팩트 진행] 표시는 mod 가 앞뒤에 붙입니다.', 'Sent in the save turn of [Save & compact] — the mod adds the lost-information check and the [Compact go] mark around it.'),
      null,
      0,
      [
        inputBox(
          'tidy-input-row',
          <Input
            key="tidy-input"
            placeholder={tidyStyles().default.body.join(' ')}
            value={draft ?? preText}
            submitLabel={L('저장', 'Save')}
            onInput={v => act.typeTidy(v)}
            onSubmit={v => act.saveTidy(v)}
          />,
        ),
      ],
    ),
    row(
      'tidy-post-row',
      L('② /compact 뒤에 붙일 글', '② Text after /compact'),
      L('요약에 남길 것 — [저장하고 컴팩트]는 mod 의 "직전 답 남김" 지시 뒤에, [바로 컴팩트]는 이 글만 붙습니다.', 'What the summary keeps — after the mod’s "keep the previous answer" for [Save & compact], alone for [Compact now].'),
      null,
      0,
      [
        inputBox(
          'compact-input-row',
          <Input
            key="compact-input"
            placeholder={tidyStyles().default.compact}
            value={compactDraft ?? compactText(s)}
            submitLabel={L('저장', 'Save')}
            onInput={v => act.typeCompact(v)}
            onSubmit={v => act.saveCompact(v)}
          />,
        ),
      ],
    ),
    // 보내는 글 전체(자세히 · R6 펼침): 앱 코드 칸 — 두 버튼이 실제로 보내는 글 그대로
    isLean ? null : (
      <Box key="tidy-raw-unit" flexDirection="column">
        <Box key="tidy-raw-row" columnGap={1} alignItems="center">
          <Button key="tidy-raw" label={rawOpen ? '▾' : '▸'} variant="secondary" onPress={onToggleRaw} />
          <Text>{L('보내는 글 전체', 'Full text sent')}</Text>
        </Box>
        {rawOpen ? <Code key="tidy-script" source={tidyScript(s).map(l => l.text).join('\n')} /> : null}
      </Box>
    ),
  ])

  // ── 화면: 프리셋 셋 — 간단 · 자세히 · 커스텀. 미리보기(자세히)로 고른 화면의 바를 이 세션 값으로 보인다
  const view = viewOf(s)
  const isCustomScreen = s.screen === 'custom'
  // 커스텀이면 고르기 버튼, 프리셋이면 같은 이름을 글로(✓ 켬 · · 끔)
  const choose = (key: string, label: string, isOn: boolean, onPress: () => void) =>
    isCustomScreen ? (
      pick(key, label, isOn, onPress)
    ) : (
      // 글은 키로 못 찾아(시험 · 다른 mod) 상자에 키를 단다
      <Box key={key}>
        <Text {...(isOn ? {} : { dimColor: true })}>{`${isOn ? '✓' : '·'} ${label}`}</Text>
      </Box>
    )
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
  const screenSection = appSection(ui, 'set-screen', L('화면', 'Screen'), [
    row(
      'screen-row',
      L('화면 종류', 'Screen type'),
      screenUse(s.screen),
      segGroup(ui, 'screen-seg', SCREEN_PRESETS.map(p => one(`screen-${p}`, screenName(p), s.screen === p, () => save(chooseScreen(s, p))))),
      segW(SCREEN_PRESETS.map(p => screenName(p))),
      // 미리보기: 고른 화면으로 이 세션 값을 바처럼 — 흐린 각진 테두리로 묶어 진짜 바 · 칩과 갈린다. 자세히에서만
      preview && !isLean
        ? [
            <Box key="screen-preview" flexDirection="column" marginTop={1} borderStyle="single" borderDimColor paddingX={1}>
              <Text dimColor>{L('미리보기 — 이 화면을 고르면 이렇게 보입니다', 'Preview — how this screen looks')}</Text>
              <Box key="screen-preview-body" flexDirection="column" paddingLeft={2}>
                {preview}
              </Box>
            </Box>,
          ]
        : [],
    ),
    // 0.5 묶음 2(N15): 바 돈 칸 순서 — 고르면 미리보기 · 입력창 위 바가 바로 바뀐다(모든 화면 공통)
    row(
      'money-order-row',
      L('비용 표시 순서', 'Cost order'),
      L('바 비용 줄의 세션 · 오늘 · 이번 달 순서', 'Order of session · today · this month on the cost row'),
      <Select key="money-order" options={MONEY_ORDERS.map(o => ({ value: o.join(','), label: moneyLabel(o) }))} value={moneyOf(s.bandOrder).join(',')} onSelect={v => save(withMoney(s, v.split(',')))} />,
      selectW(MONEY_ORDERS.map(moneyLabel)),
    ),
    // 한도 줄 · 질문 줄이 없는 화면(간단 등)은 바가 한 줄 — 최소 · 최대가 같다(바의 [—] 도 빠진다)
    row(
      'band-mode-row',
      L('바 크기', 'Bar size'),
      s.screen === 'simple' || (!bandShowOf(s).lastTurn && !s.limitShow.fiveHour && !s.limitShow.sevenDay)
        ? L('지금 화면은 바가 한 줄이라 전체 · 한 줄이 같습니다.', 'With this screen the bar is one row, so Full and One line look the same.')
        : bandModeUse(s.band),
      segGroup(ui, 'band-mode-seg', BAND_MODES.map(m => one(`band-${m}`, bandModeName(m), s.band === m, () => save({ ...s, band: m })))),
      segW(BAND_MODES.map(m => bandModeName(m))),
    ),
    // 0.5 묶음 2(N20 · WCAG 2.2.2): 모션 — 앱 설정의 "모션" 값은 mod 가 못 읽어 따로
    row(
      'motion-row',
      L('모션', 'Motion'),
      L('줄임이면 게이지와 점이 깜빡이거나 움직이지 않습니다. 앱 설정의 모션 값은 mod 가 읽지 못해 따로 둡니다.', 'With Reduce, the gauge and dots do not blink or move. The app’s Motion setting cannot be read by mods, so it is separate here.'),
      segGroup(ui, 'motion-seg', [
        one('motion-system', L('시스템', 'System'), s.motion !== 'reduce', () => save({ ...s, motion: 'system' })),
        one('motion-reduce', L('줄임', 'Reduce'), s.motion === 'reduce', () => save({ ...s, motion: 'reduce' })),
      ]),
      segW([L('시스템', 'System'), L('줄임', 'Reduce')]),
    ),
  ])

  // ── 바 · 패널(창 상태 — 켜기/끄기 = 스위치, R3): 바의 창 버튼(— · ✕) · 입력창 아래 버튼과 같은 값이라 어느 화면에서든 바꾼다
  const windowSection = appSection(ui, 'set-window', L('바 · 패널', 'Bar · pane'), [
    row(
      'band-fold-row',
      L('바 접어 두기', 'Keep the bar folded'),
      L('바 오른쪽 위 ✕ 와 같은 값 — 접으면 입력창 아래 버튼으로 다시 폅니다.', 'Same as the ✕ at the bar’s top right — when folded, reopen it with the button below the input.'),
      onOffControl(ui, 'bandFolded', s.bandFolded, on => save(setFolded(s, on))),
      onOffW(),
    ),
    row('band-autoopen-row', L('컴팩트할 때 바 펴기', 'Open the bar when compacting'), bandAutoUse(s.bandAutoOpen), onOffControl(ui, 'bandAutoOpen', s.bandAutoOpen, on => save({ ...s, bandAutoOpen: on })), onOffW()),
    row('pane-auto-row', L('새 세션에서 패널 열기', 'Open the pane in new sessions'), paneAutoUse(s.paneAutoOpen), onOffControl(ui, 'paneAutoOpen', s.paneAutoOpen, on => act.setPaneOption('paneAutoOpen', on)), onOffW()),
    // 같이 여닫기는 데스크톱 세션끼리 — 터미널 세션의 패널은 자기 것만이라 터미널에선 줄을 뺀다
    isTerminal
      ? null
      : row('pane-sync-row', L('모든 세션 패널 같이 여닫기', 'Open and close the pane in all sessions'), paneSyncUse(s.paneShared), onOffControl(ui, 'paneShared', s.paneShared, on => act.setPaneOption('paneShared', on)), onOffW()),
    // 질문 강조 — 마우스 올림은 데스크톱에만 있어 터미널에선 줄을 뺀다
    isTerminal
      ? null
      : row(
          'hover-row',
          L('질문 강조', 'Highlight'),
          L(
            '채팅창 답변 끝의 질문 비용 칩이나 패널의 그 질문 줄에 마우스를 올리면 칩 · 패널 줄 · 그 답변이 함께 회색이 됩니다 — 어느 답변의 값인지 보입니다. 지금 안 보이는 답변은 회색이 되어도 보이지 않습니다(채팅은 스크롤되지 않음).',
            'Hover the question-cost chip under an answer, or that question’s row in the pane, and the chip, the row and the answer turn gray together. An answer scrolled out of view stays out of view (the chat does not scroll).',
          ),
          onOffControl(ui, 'questionHover', s.questionHover, on => save({ ...s, questionHover: on })),
          onOffW(),
        ),
  ])

  // ── 바에 보일 칸: 정보량 · 비용 줄 · 질문 줄은 화면(간단 · 자세히)의 값 — 커스텀에서 고른다. 한도 줄 · 세션 금액 색 · 모든 세션은
  // 어느 화면에서나. 예전엔 "▸ 세부" 로 접혀 있었다 — 앱 꼴은 늘 펼침
  const groups = [
    { id: 'cost', name: L('비용 줄', 'Cost row') },
    { id: 'turn', name: L('질문 줄', 'Question row') },
  ] as const
  const limitsOn = s.limitShow.fiveHour || s.limitShow.sevenDay
  const limitParts = BAND_PARTS.filter(p => p.group === 'limits')
  const colorNames = [
    { name: L('노랑', 'yellow'), hex: SESSION_TEXT[0] },
    { name: L('주황', 'orange'), hex: SESSION_TEXT[1] },
    { name: L('빨강', 'red'), hex: SESSION_TEXT[2] },
  ]
  const colorsW = colorNames.length * (5 + selectW(['$100'])) + 2
  const infoIds = ['lean', 'full'] as const
  const partsSection = appSection(ui, 'set-parts', L('바에 보일 칸', 'What the bar shows'), [
    isCustomScreen ? (
      row(
        'custom-reset-row',
        L('처음 값 가져오기', 'Start from'),
        L('커스텀 값을 그 화면의 값으로 되돌립니다', 'Reset Custom to that screen’s values'),
        (['simple', 'detail'] as const).map(p => <Button key={`custom-from-${p}`} label={screenName(p)} variant="secondary" onPress={() => save(resetCustom(s, p))} />),
        chipsW((['simple', 'detail'] as const).map(p => screenName(p))),
      )
    ) : (
      <Text key="parts-locked" dimColor wrap="wrap">
        {L(`답변 칩 자세히 · 비용 줄 · 질문 줄은 ${screenName(s.screen)} 화면의 값입니다 — 바꾸려면 화면을 [커스텀]으로`, `Answer chip details, cost row and question row follow the ${screenName(s.screen)} screen — choose [Custom] to change them`)}
      </Text>
    ),
    // 0.6.0 실물: 칸마다 스위치 줄. 무리 이름 줄 아래 항목을 들여 쓴다.
    // 간단 · 자세히 화면이면 비용 줄 · 질문 줄 · 답변 칩 자세히는 그 화면 값이라 흐린 스위치(못 누름) — 위 한 줄이 까닭
    // 답변 칩 자세히(예전 "정보량" — 사용자 "현황에 간단 · 자세히가 따로 있으니 정보량 옵션 고찰"): 이제 답변 끝 칩의 [▸ 자세히] 만 정한다.
    // 현황 보기는 현황 위 [간단|자세히], 설정 탭은 늘 같은 꼴
    row(
      'info-row',
      L('답변 칩 자세히', 'Answer chip details'),
      L('답변 끝 질문 비용 칩에 [▸ 자세히] — 그 질문의 메인 · 에이전트 · 동작별 값', 'A [▸ Details] on the question-cost chip under each answer — its main, agent and per-step costs'),
      onOffControl(ui, 'chipDetail', view.info === 'full', on => editV(v => ({ ...v, info: on ? 'full' : 'lean' })), !isCustomScreen),
      onOffW(),
      [],
      subName(L('답변 칩 자세히', 'Answer chip details'), !isCustomScreen, 0),
    ),
    ...groups.map(g => {
      const parts = BAND_PARTS.filter(p => p.group === g.id)
      return unit(`band-g-${g.id}-unit`, [
        row(`band-g-${g.id}`, g.name, null, null, 0),
        ...parts.map(p => {
          const k = p.key as keyof CostShow
          return row(
            `show-${k}-row`,
            bandPartName(k),
            null,
            onOffControl(ui, `show-${k}`, view.bandShow[k], on => editV(v => ({ ...v, bandShow: { ...v.bandShow, [k]: on } })), !isCustomScreen),
            onOffW(),
            [],
            subName(bandPartName(k), !isCustomScreen),
          )
        }),
      ])
    }),
    // 요청이 끝났는데도 엔진이 한도를 안 준 세션(API 키 등 — 단정은 안 한다)엔 한도 줄 줄을 뺀다: 켜도 그릴 게 없다
    hasLimits === false
      ? null
      : unit('limits-unit', [
          row(
            'limits-row',
            L('한도 줄', 'Limits row'),
          L('구독 요금제의 5시간 · 7일 한도(계정 전체 — 다른 세션 몫도 들어 있음).', 'Your plan’s 5-hour and 7-day limits (whole account — other sessions count too).'),
            null,
            0,
            s.screen === 'simple'
              ? [
                <Text key="limits-simple" dimColor wrap="wrap">
                  {L('간단 화면은 바가 한 줄이라 한도 줄이 안 보입니다 — 자세히 · 커스텀에서 보입니다.', 'Hidden on the one-row Simple screen — shown on Detailed and Custom.')}
                </Text>,
                ]
              : [],
          ),
          row('show-limits-row', L('한도 전체', 'All limits'), null, onOffControl(ui, 'limits', limitsOn, on => save(setLimits(s, on))), onOffW(), [], subName(L('한도 전체', 'All limits'))),
          ...limitParts.map(p =>
            row(`show-${p.key}-row`, bandPartName(p.key), null, onOffControl(ui, `show-${p.key}`, bandShowOf(s)[p.key], on => save(setBandPart(s, p.key, on))), onOffW(), [], subName(bandPartName(p.key))),
          ),
        ]),
    row(
      'session-colors',
      L('세션 금액 색', 'Session cost'),
      L('바 · 패널의 세션 금액이 이 값을 넘으면 그 색.', 'The session cost on the bar and pane takes this color above each value.'),
      colorNames.map((c, i) => {
        const lo = i > 0 ? s.sessionColors[i - 1]! : 0
        const hi = i < 2 ? s.sessionColors[i + 1]! : Number.POSITIVE_INFINITY
        const vals = SESSION_COLOR_STEPS.filter(v => (v > lo && v < hi) || v === s.sessionColors[i])
        return (
          <Box key={`color-${i}`} columnGap={1} alignItems="center">
            <Text color={c.hex}>{c.name}</Text>
            <Select
              key={`color-${i}-pick`}
              options={vals.map(v => ({ value: String(v), label: fmtUsd0(v) }))}
              value={String(s.sessionColors[i])}
              onSelect={v => {
                const c2 = [...s.sessionColors] as [number, number, number]
                c2[i] = Number(v)
                save({ ...s, sessionColors: c2 })
              }}
            />
          </Box>
        )
      }),
      colorsW,
    ),
    // 오늘 · 이번 달 사용량(0.5.0) — 따로 켜고 끈다(기본 끔). 바 · 간단 패널에 보일지 — 자세히 패널엔 늘. 0.6.0: ✓ 칩 → 스위치 줄
    unit('spend-unit', [
    row(
      'spend-row',
      L('모든 세션', 'All sessions'),
      L(
        '켜면 바 비용 줄과 간단 패널에도 보입니다. 자세히 패널엔 늘 보입니다. 이 PC 모든 세션의 금액(API 정가 환산 · 추정)이고, 세션 기록에 없는 앱 자체 요청은 빠져 조금 적게 잡힙니다. 날짜는 Claude 사용량 화면처럼 UTC 로 나눕니다(한국은 오전 9시에 바뀜).',
        'When on, also shown on the bar’s cost row and the Simple pane. The Detailed pane always shows them. Cost of every session on this PC (API list prices, estimated); app-internal requests are not in the transcripts, so it runs a little low. Days are split in UTC, as on Claude’s usage page.',
      ),
      null,
      0,
    ),
    row('spend-today-row', L('오늘', 'Today'), null, onOffControl(ui, 'spendToday', s.spendToday, on => save({ ...s, spendToday: on })), onOffW(), [], subName(L('오늘', 'Today'))),
    row('spend-month-row', L('이번 달', 'This month'), null, onOffControl(ui, 'spendMonth', s.spendMonth, on => save({ ...s, spendMonth: on })), onOffW(), [], subName(L('이번 달', 'This month'))),
    ]),
  ])

  // 명령 안내 줄은 뺐다 — 화면에서 다 바꿀 수 있어 사족이었다. 명령은 /easy-compact 도움말에 있다.
  // 순서(앱 꼴, 2026-10-15 시안): 화면 → 바 · 패널 → 바에 보일 칸 → 컴팩트 시점 → 컴팩트 문구 → 캐시(언어는 맨 아래, drawSettingsView)
  return (
    <Box flexDirection="column">
      {screenSection}
      {windowSection}
      {partsSection}
      {tidy}
      {/* 정보량 최소(간단)면 캐시 칸을 뺀다 — 바꿀 것이 없고(노랑 기준은 기본값), 남은 시간은 바에 늘 있다 */}
      {isLean ? null : cacheSection}
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
/** 현황용 컴팩트 시점 동작 — 바로 저장 · 직접 입력 오류 한 줄 */
export type TimingActions = { save: (next: Settings) => void; sizeError: (msg: string | null) => void }

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
) {
  const { Box, Button, Input, Select, Text } = ui
  const ttl = cache?.ttl ?? 60
  const isTerminal = surface === 'terminal'
  const inputs = opt?.inputs ?? null
  const modelId = opt?.model ?? ''
  const model = opt?.model ? modelName(opt.model) : L('이 모델', 'this model')
  const stackFor = (name: string, ctrlW: number, hasDesc: boolean) => cols !== null && cols - 1 - Math.max(widthOf(name, isTerminal), hasDesc ? 24 : 12) - 2 < ctrlW
  // 터미널은 마우스 올림이 없어 줄 풀이를 뺀다 — 단 풀이가 곧 내용인 줄(★ 추천 · 비추천)은 이름 아래 흐린 글로(0.6.0 CLI 확인: "비추천" 이름만
  // 남고 어느 구간인지가 빠졌다)
  const row = (key: string, name: string, desc: unknown, control: unknown, ctrlW: number, extra: unknown[] = [], nameEl?: unknown, isContent = false) =>
    isTerminal && isContent
      ? settingRow(ui, key, nameEl ?? name, desc, control, extra, control !== null && stackFor(name, ctrlW, true))
      : tipRow(ui, key, name, control, extra, nameEl, isTerminal ? null : desc, control !== null && stackFor(name, ctrlW, false))
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
  const starLine = inputs && opt ? term('cmp-how', L('★ 최적', '★ Best'), L('읽기 + 컴팩트 비용이 가장 적은 크기(공식 요율 · 이 세션 값)', 'Size with the lowest read + compact cost (official rates · this session)'), STAR_COLOR) : null
  const capLine = capNote ? term('cmp-cap', model, capNote.trim()) : null
  // 간단 화면의 풀이는 한 줄 — 비용 칸 · 계산 값은 자세히 화면에
  // 글은 키로 못 찾아(시험 · 다른 mod) 상자에 키를 단다
  const leanNote = (
    <Box key="cmp-lean" marginTop={1}>
      <Text dimColor wrap="wrap">
        {L('★ 최적 · 좋음 · 보통 · 비추천은 이 세션 값으로 판정합니다. 크기별 비용 · 계산 값은 자세히 화면에서.', '★ Best, good, fair and not advised are judged from this session. Costs per size and the inputs are on the Detailed screen.')}
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
        `× (그 크기 읽기${perQAll ? ` + 요청마다 새로 쓰기 · 출력 ~${fmtUsd(perQAll.extraUsd)}` : ''}) · 에이전트 빼고 · ${model} 요율 — 작업량과 상관없이 크기끼리 견주는 기준.`,
        `× (read at that size${perQAll ? ` + ~${fmtUsd(perQAll.extraUsd)} writes · output per request` : ''}) · agents excluded · ${model} rates — a fixed yardstick across sizes.`,
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
  const bandName = (a: number, b: number) => `${fmtTokens(a)} ~ ${fmtTokens(b)}`
  // 드롭다운 이름은 구간만. 고른 구간의 판정은 바로 아래
  // 금액 줄 끝 색 글자가, 구간마다의 판정은 자세히의 크기별 비용 표가 말한다
  const bandLabels = rangeBands().map(([a, b]) => bandName(a, b))
  const manualLabel = L('직접 입력…', 'Enter a size…')
  const allNote = <Text key="cmp-all" dimColor>{L('모든 세션에 적용', 'All sessions')}</Text>
  const rangeSelect = (value: string) => (
    <Select
      key="cmp-range-select"
      options={[...rangeBands().map(([a, b], i) => ({ value: `${a}-${b}`, label: bandLabels[i]! })), { value: 'manual', label: manualLabel }]}
      value={value}
      onSelect={v => {
        act.sizeError(null)
        if (v === 'manual') {
          if (d.follow) edit({ ...d, follow: false, compactAt: d.rangeEnd })
          return
        }
        const [a, b] = v.split('-').map(Number)
        if (a && b) edit({ ...d, follow: true, rangeStart: a, rangeEnd: b })
      }}
    />
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
    const usd2 = (x: number | null, y: number | null) => (x === null || y === null ? '—' : `${fmtUsd(x)}~${fmtUsd(y).slice(1)}`)
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
        '컨텍스트가 이 크기 띠에 들면 컴팩트할 때 — 고르면 바로 모든 세션에 적용. 끝의 "직접 입력…" 은 크기 하나를 직접 정합니다',
        'Compact once the context is inside this band — applies to all sessions as soon as you pick. "Enter a size…" sets one size yourself',
      ),
      [allNote, rangeSelect(`${d.rangeStart}-${d.rangeEnd}`)],
      selectW([...bandLabels, manualLabel]) + widthOf(L('모든 세션에 적용', 'All sessions'), isTerminal) + 1,
      // 고른 구간 금액 · 판정 한 줄은 간단 보기에도
      [rangeNow, errLine].filter(x => x !== null),
    )
    // 추천: 최적이 든 띠 — 고른 띠가 아니면 한 줄 + [이 구간 고르기](고른 띠면 위 금액 줄 끝 "★ 최적" 이 말한다)
    const starBand = starAt >= 0 ? rangeBands()[starAt]! : null
    const isStarOn = starBand !== null && d.rangeStart === starBand[0] && d.rangeEnd === starBand[1]
    const pickStar = L('이 구간 고르기', 'Pick this range')
    const recommend =
      starBand && opt?.at != null && !isStarOn
        ? row(
            'cmp-recommend',
            L(`★ 추천 ${bandName(starBand[0], starBand[1])}`, `★ Suggested ${bandName(starBand[0], starBand[1])}`),
            L(`최적(${fmtTokens(opt.at)})이 든 구간`, `the range with the best size (${fmtTokens(opt.at)})`),
            <Button key="cmp-recommend-pick" label={pickStar} variant="secondary" onPress={() => edit({ ...d, follow: true, rangeStart: starBand[0], rangeEnd: starBand[1] })} />,
            buttonW(pickStar),
            [],
            <Text key="cmp-recommend-name" bold color={STAR_COLOR}>
              {L(`★ 추천 ${bandName(starBand[0], starBand[1])}`, `★ Suggested ${bandName(starBand[0], starBand[1])}`)}
            </Text>,
            true,
          )
        : null
    // 비추천(자세히): 최적 대비가 PEN_BAD_PCT 를 넘는 띠(이 세션 값) — 최적 위는 "N 이상", 최적 아래(너무 잦음)는 그 띠 이름으로.
    // 70만 ~ 100만은 자동 컴팩트(1M 창이면 약 96.7만)가 돌기 직전이라 고를 일이 거의 없다
    const highBad = rangeBands().find(([a], i) => i > starAt && isNotRecommended(penOf(a)))
    // 맨 끝 띠(1M 창이면 700k ~ 1M — 창이 크면 그 끝까지, N22)
    const lastBand = rangeBands()[rangeBands().length - 1]!
    const lastBandName = bandName(lastBand[0], lastBand[1])
    const lowBad = rangeBands().filter(([a], i) => i < starAt && isNotRecommended(penOf(a)))
    const badParts = [
      lowBad.length > 0 ? `${fmtTokens(lowBad[0]![0])} ~ ${fmtTokens(lowBad[lowBad.length - 1]![1])}` : null,
      highBad ? L(`${fmtTokens(highBad[0])} 이상`, `${fmtTokens(highBad[0])} and up`) : null,
    ].filter((p): p is string => p !== null)
    const notRecommended =
      badParts.length > 0 && !isLean
        ? row(
            'cmp-not-recommended',
            L('비추천', 'Not advised'),
            L(
              `${badParts.join(' · ')} — 최적보다 요청당 +${PEN_BAD_PCT}% 넘게${highBad ? ` · ${lastBandName} 은 자동 컴팩트(약 ${fmtTokens(autoCompactAt())}) 직전` : ''}`,
              `${badParts.join(' · ')} — over +${PEN_BAD_PCT}% per request vs best${highBad ? ` · ${lastBandName} is right before auto-compact (~${fmtTokens(autoCompactAt())})` : ''}`,
            ),
            null,
            0,
            [],
            <Text key="cmp-bad-name" bold color="error">
              {L('비추천', 'Not advised')}
            </Text>,
            true,
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
    const bandCol = colOf('band', L('크기 구간', 'Size range'), (a, b) => `${bandName(a, b)}${isTerminal && isOnBand(a, b) ? L(' (고름)', ' (chosen)') : ''}`)
    const verdictCol = colOf('verdict', L('판정', 'Verdict'), (a, _b, i) => (i === starAt ? L('★ 최적', '★ Best') : (penVerdict(penOf(a))?.word ?? '')))
    const extraCols = [
      colOf('read', L('요청 1회', 'One read'), (a, b) => usd2(usdAt(a, 'read'), usdAt(b, 'read'))),
      colOf('q', L(`질문 1개(${Q_STEPS}회 가정)`, `Question (${Q_STEPS} req)`), (a, b) => usd2(qAt(a), qAt(b))),
      colOf('cold', L('캐시 식으면', 'Cold cache'), (a, b) => usd2(usdAt(a, 'write1h'), usdAt(b, 'write1h'))),
      colOf('pen', L('최적보다', 'Over best'), (a, b) => pens(a, b)),
    ]
    const colW = (c: Col) => Math.max(widthOf(c.head, isTerminal), ...c.cells.map(x => widthOf(x, isTerminal))) + (isTerminal ? 3 : 2)
    const room = cols === null ? Number.POSITIVE_INFINITY : cols - 4
    let kept = extraCols
    while (kept.length > 0 && [bandCol, ...kept, verdictCol].reduce((sum, c) => sum + colW(c), 1) > room) kept = kept.slice(0, -1)
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
    const grid = (
      <Box key="cmp-grid" flexDirection="column" marginTop={1}>
        <Box key="cmp-grid-h">{shownCols.map(c => gcell(`h-${c.id}`, colW(c), <Text dimColor>{c.head}</Text>))}</Box>
        {rangeBands().map(([a, b], i) => {
          const cells = shownCols.map(c => {
            const col = cellColor(c, i)
            return gcell(
              `${i}-${c.id}`,
              colW(c),
              <Text {...(isOnBand(a, b) ? { bold: true } : {})} {...(col ? { color: col } : {})}>
                {c.cells[i]!}
              </Text>,
            )
          })
          // 고른 줄(데스크톱): 묶음 버튼 고른 칸과 같은 테두리 상자 — 테두리는 1px 라 열이 거의 안 밀린다. 줄 내용 폭에 붙인다(안 붙이면 열이
          // 적은 좁은 패널에서 테두리만 패널 끝까지 늘어났다)
          return isOnBand(a, b) && !isTerminal ? (
            <Box key={`cmp-grid-${i}`} alignSelf="flex-start" borderStyle="round" borderColor={SEG_ON_EDGE} paddingX={0} paddingY={0}>
              {cells}
            </Box>
          ) : (
            <Box key={`cmp-grid-${i}`}>{cells}</Box>
          )
        })}
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
                    `최적보다 = 예상 최적보다 요청당 더 드는 비율 · +${PEN_WARN_PCT}%까지 좋음 · +${PEN_BAD_PCT}%까지 보통 · 넘으면 비추천`,
                    `Over best = extra cost per request vs the estimated best · up to +${PEN_WARN_PCT}% good · up to +${PEN_BAD_PCT}% fair · beyond: not advised`,
                  )}
                </Text>
                <Text wrap="wrap">
                  {L(`질문 1개 = 요청 ${Q_STEPS}회 가정 · 캐시 식으면 = ${ttlName(ttl)} 넘게 쉬어 다시 쓰기 · ${model} 요율`, `Question = ${Q_STEPS} requests assumed · Cold cache = rewritten after ${ttlName(ttl)} idle · ${model} rates`)}
                </Text>
              </Box>,
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
    rows = isLean ? [rangePick] : [rangePick, recommend, notRecommended, tableUnit]
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
              : L(`최적 ${fmtTokens(opt.at)} — 차이 거의 없음`, `Best ${fmtTokens(opt.at)} — almost no difference`)}
          </Text>
          {pct >= 1 ? (
            <Text bold {...(penColorOf(pen) ? { color: penColorOf(pen) } : {})}>
              {L(`+${pct}% 더 듦`, `+${pct}% more`)}
            </Text>
          ) : null}
          {/* 판정 말(좋음 · 보통 · 비추천). 비추천은 알리기만 — 적용은 막지 않는다 */}
          {pct >= 1 && penVerdict(pen) ? (
            <Text bold color={penVerdict(pen)!.color}>
              {penVerdict(pen)!.color === 'error' ? L('· 비추천(적용은 됩니다)', '· not advised (still applies)') : `· ${penVerdict(pen)!.word}`}
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
      L(`컨텍스트가 이 크기에 닿으면 빨강 · 그 ${Math.round(WARN_RATIO * 100)}%부터 주황 — Enter 로 바로 모든 세션에 적용`, `Red once the context reaches this size · orange from ${Math.round(WARN_RATIO * 100)}% of it — Enter applies to all sessions`),
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
            if (n === null) return act.sizeError(L('크기를 못 읽었습니다 — 예: 300k', 'Could not read the size — e.g. 300k'))
            if (n > compactMax()) return act.sizeError(L(`최대 컨텍스트(${fmtTokens(compactMax())})보다 커서 저장하지 않았습니다`, `Larger than the max context (${fmtTokens(compactMax())}) — not saved`))
            // 가장 작은 크기 = COMPACT_MIN(setCompactAt 이 그 아래를 올려 버려 50k~99k 가 말없이 100k 로 저장됐다 — 시험 점검에서 찾음)
            if (n < COMPACT_MIN) return act.sizeError(L(`너무 작습니다 — ${fmtTokens(COMPACT_MIN)} 이상`, `Too small — ${fmtTokens(COMPACT_MIN)} or more`))
            act.sizeError(null)
            edit({ ...d, follow: false, compactAt: setCompactAt(s, n).compactAt, sizeText: undefined })
          }}
        />,
      ],
      selectW([...bandLabels, manualLabel]) + widthOf(L('모든 세션에 적용', 'All sessions'), isTerminal) + 12,
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
              L(`(주황 = 정한 크기의 ${Math.round(WARN_RATIO * 100)}%)`, `(orange = ${Math.round(WARN_RATIO * 100)}% of the set size)`),
            ),
          )}
          {starLine}
          {calcLine}
          {capLine}
        </Box>
      ),
    ]
  }

  void [applyArea, appliedRow, leanNote, ctxColor, draftText, dAt]
  return (
    <Box key="cmp-timing" flexDirection="column">
      {rows.filter(r => r !== null && r !== undefined)}
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
  preview: unknown = null,
  hasLimits: boolean | null = null,
  upd: UpdateState | null = null,
  nowMs = 0,
  compactDraft: string | null = null,
) {
  const { Box, Button, Select, Text } = ui
  const look = phaseLook(phase, kind)
  // 언어 줄: 이름은 늘 두 언어로 — 읽지 못하는 언어로 떴을 때도 찾을 수 있게. 자동은 지금 고른 언어를 같이 보인다
  // 아직 모르면 그냥 "자동" — "자동(?)" 은 고장처럼 보였다
  const autoName = autoLang === 'ko' ? '한국어' : autoLang === 'en' ? 'English' : null
  const autoLabel = autoName ? L(`자동(${autoName})`, `Auto (${autoName})`) : L('자동', 'Auto')
  const langPick = (key: string, label: string, choice: Settings['lang']) => pickButton(ui, key, label, s.lang === choice, () => act.setLang(choice))
  // 설정 탭의 칸은 모두 같은 테두리 카드(사용량 탭과 같은 꼴) — 언어 줄만 맨몸으로 떠 있었다.
  // 한 번 정하면 끝이라 맨 아래, 접힌 제목 줄엔 지금 언어
  const langName = s.lang === 'ko' ? '한국어' : s.lang === 'en' ? 'English' : autoLabel
  const langOpen = open.lang === true
  // 앱 설정 꼴(0.5 묶음 2): 언어도 줄 하나 — 이름 …… 드롭다운. 칸 제목은 늘 두 언어(읽지 못하는 언어로 떴을 때도 찾게)
  const langRow = appSection(ui, 'set-lang', '언어 · Language', [
    settingRow(
      ui,
      'lang-row',
      L('언어', 'Language'),
      null,
      <Select
        key="lang-pick"
        options={[
          { value: 'auto', label: autoLabel },
          { value: 'ko', label: '한국어' },
          { value: 'en', label: 'English' },
        ]}
        value={s.lang}
        onSelect={v => act.setLang(v as Settings['lang'])}
      />,
    ),
  ])
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
              `${phase === 'tidying' ? '지금 저장 중입니다 — 끝나면 컴팩트.' : `지금 ${typeof kind === 'string' && kind ? kind : '컴팩트'} 중입니다.`} 컴팩트 문구를 바꾸면 다음 [저장하고 컴팩트]부터 쓰입니다.`,
              `${phase === 'tidying' ? 'Saving now — compacts when done.' : `${typeof kind === 'string' && kind ? kind : 'Compact'} in progress.`} A changed compact text is used from the next [Save & compact].`,
            )}
          </Text>
        </Box>
      ) : (
        <Text dimColor wrap="wrap">
          {L('바꾸면 모든 세션에 바로 적용됩니다.', 'Changes apply to all sessions right away.')}
        </Text>
      )}
      {/* 0.5 묶음 2(N12): 업데이트 칸은 맨 위 — 맨 아래라 찾기 힘들었다(동료 s08). 마켓 설치본만(폴더로 불러온 개발본은 upd 가 null) */}
      {upd ? drawUpdateCard(act, ui, upd, nowMs, surface) : null}
      {drawSettings(act, ui, s, opt, draft, rawOpen, act.toggleRaw, cmp, ctxNow, surface, cols, open, cache, preview, hasLimits, compactDraft)}
      {langRow}
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
 * 설정 탭 맨 아래 easy-compact 칸(마켓 설치본만, 2026-10-14 사용자 1~3안 · 자동 확인 없음): 지금 판 · 마지막 확인과
 * [업데이트 확인] → 새 판이면 [바뀐 것 ▸] [업데이트] → "앱을 다시 켜면 적용". 확인 · 업데이트는 Claude Code 명령(claude plugin …)이
 * 하고 그때만 마켓 저장소(GitHub)를 받는다 — 이 mod 는 통신하지 않는다(README 약속). 실패면 까닭 한 줄 + [다시 시도], 명령 출력은 펼쳐 보기.
 * 상태 글 색: 진행 = 파랑(저장 중 · 컴팩트 중과 같은 점), 최신 · 받음 = 초록, 실패 = 빨강 — 제목 띠 아이콘은 다른 카드처럼 회색
 */
export function drawUpdateCard(act: SettingsActions, ui: Ui, upd: UpdateState, nowMs: number, surface: string) {
  const { Box, Button, Text } = ui
  const btn = (key: string, label: string, onPress: () => void, isMain = false) =>
    isMain ? <Button key={key} label={label} variant="primary" onPress={onPress} /> : <Button key={key} label={label} variant="secondary" onPress={onPress} />
  const checkBtn = btn('upd-check', L('업데이트 확인', 'Check for updates'), act.checkUpdate)
  const changes = upd.market ? upd.changes?.[upd.market] : undefined
  const busy = (key: string, text: string) => [
    <Box key={`${key}-dot`} flexShrink={0} alignItems="center">
      {pulseDot(ui, surface, LIVE_HEX, text)}
    </Box>,
    <Text key={key} color={ACCENT}>
      {text}
    </Text>,
  ]
  const ago = agoText(upd.marketAt, nowMs)
  // 앱 설정 꼴(0.5 묶음 2): 맨 위 한 줄 — 왼쪽 "easy-compact 판" + 상태 글(풀이 자리), 오른쪽 버튼만. 상태 글을 버튼 줄에 섞으면 좁은
  // 패널에서 버튼이 다음 줄로 밀렸다
  let state: unknown[] = []
  let buttons: unknown[] = []
  switch (upd.phase) {
    case 'checking':
      state = busy('upd-busy', L('새 판 확인 중…', 'Checking for a new version…'))
      break
    case 'updating':
      state = busy('upd-busy', L('업데이트 중…', 'Updating…'))
      break
    case 'latest':
      state = [
        <Text key="upd-state" color="success">
          {L(`최신 판입니다(${upd.own ?? '?'})`, `Up to date (${upd.own ?? '?'})`)}
        </Text>,
      ]
      buttons = [checkBtn]
      break
    case 'newer':
      state = [
        <Text key="upd-state" bold>
          {L(`새 판 ${upd.market} 있음`, `New version ${upd.market}`)}
        </Text>,
      ]
      buttons = [
        changes ? btn('upd-changes', `${L('바뀐 것', 'What changed')} ${upd.open?.changes ? '▾' : '▸'}`, () => act.toggleUpdate('changes')) : null,
        btn('upd-apply', L('업데이트', 'Update'), act.applyUpdate, true),
      ]
      break
    case 'done':
      state = [
        <Text key="upd-state" color="success" wrap="wrap">
          {L(`${upd.market ?? ''} 받음 — 앱을 다시 켜면 적용됩니다`, `${upd.market ?? ''} downloaded — restart the app to use it`)}
        </Text>,
      ]
      break
    case 'synced':
      // 앤트로픽 디렉터리에서 받은 판 — 마켓 명령이 안 맞아 버튼 없이(0.6.0). 새 판은 Claude Code 를 켤 때 계정 동기화로
      state = [
        <Text key="upd-state" dimColor wrap="wrap">
          {L('claude.ai 디렉터리에서 받은 판 — 새 판은 Claude Code 를 켤 때 저절로 받습니다', "Installed from Anthropic's directory — Claude Code picks up new versions by itself when it starts")}
        </Text>,
      ]
      break
    case 'failed':
      state = [
        <Text key="upd-state" color="error" wrap="wrap">
          {!upd.error
            ? L('claude 명령을 못 찾았습니다 — README 의 새 판 받기를 보세요', 'claude command not found — see Updating in the README')
            : upd.failedOn === 'apply'
              ? L('업데이트 못 함 — git · 네트워크를 확인하세요', 'Update failed — check git and your network')
              : L('확인 못 함 — git · 네트워크를 확인하세요', 'Check failed — check git and your network')}
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
  const canCheck = upd.phase === 'idle' || upd.phase === 'latest' || (upd.phase === 'failed' && upd.failedOn !== 'apply')
  const shown = buttons.filter(b => b !== null)
  return (
    <Box key="set-update" flexDirection="column" marginTop={1}>
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
                '[업데이트 확인] 을 누를 때만 Claude Code 가 GitHub 에서 마켓을 받아 옵니다 — easy-compact 는 스스로 통신하지 않습니다.',
                'Only when you press [Check for updates] does Claude Code fetch the marketplace from GitHub — easy-compact itself never goes online.',
              )}
            </Text>
          ) : null}
        </Box>,
        shown.length > 0 ? shown : null,
        [
          upd.phase === 'newer' && upd.open?.changes && changes ? changesList(ui, 'upd-changes-list', changes) : null,
          upd.phase === 'failed' && upd.open?.error && upd.error ? (
            <Box key="upd-error-text">
              <Text dimColor wrap="wrap">
                {upd.error}
              </Text>
            </Box>
          ) : null,
        ],
      )}
    </Box>
  )
}

/**
 * 업데이트 뒤 첫 실행(3안): 사용량 패널 맨 위 한 줄 카드 "N 판으로 업데이트됨 · [바뀐 것 ▸] [닫기]" — 닫으면 다시 안 보인다
 * (본 판을 저장소에 적는다). 바뀐 것은 받아 둔 마켓 사본의 CHANGELOG(네트워크 없음), 없으면 버튼을 뺀다
 */
/**
 * 새 판 카드(N12, 0.6.0): 받아 둔 마켓 사본에 새 판이 있으면 현황 맨 위 한 줄 "새 판 N 있음 [바뀐 것 ▸] [업데이트] [닫기]" — 설정 탭
 * 맨 위 업데이트 줄과 같은 동작. [업데이트] 를 누르면 그 자리에서 "업데이트 중…" → "받음 — 앱을 다시 켜면 적용". 닫으면 그 판은 다시 안 알린다
 */
export function drawNewerNote(ui: Ui, upd: UpdateState, act: { toggle: () => void; apply: () => void; close: () => void }) {
  const { Box, Button, Text } = ui
  const v = upd.market ?? ''
  const changes = upd.changes?.[v]
  const state =
    upd.phase === 'updating'
      ? L('업데이트 중…', 'Updating…')
      : upd.phase === 'done'
        ? L(`${v} 받음 — 앱을 다시 켜면 적용됩니다`, `${v} downloaded — restart the app to use it`)
        : L(`새 판 ${v} 있음`, `New version ${v}`)
  return (
    <Box key="upd-newer" flexDirection="column" marginTop={1} {...CARD}>
      <Box key="upd-newer-row" columnGap={1} alignItems="center" flexWrap="wrap">
        {decoIcon(ui, 'update', LIVE_HEX, L('새 판', 'New version'), 'upd-newer-icon')}
        <Text {...(upd.phase === 'done' ? { color: 'success' } : {})}>{state}</Text>
        {upd.phase === 'newer' && changes ? (
          <Button key="upd-newer-changes" label={`${L('바뀐 것', 'What changed')} ${upd.open?.changes ? '▾' : '▸'}`} variant="secondary" onPress={act.toggle} />
        ) : null}
        {upd.phase === 'newer' ? <Button key="upd-newer-apply" label={L('업데이트', 'Update')} variant="primary" onPress={act.apply} /> : null}
        {upd.phase === 'newer' ? <Button key="upd-newer-close" label={L('닫기', 'Close')} variant="secondary" onPress={act.close} /> : null}
      </Box>
      {upd.phase === 'newer' ? (
        <Text key="upd-newer-hint" dimColor wrap="wrap">
          {L('[닫기]면 이 판은 다시 알리지 않습니다 — 설정 탭 맨 위에서도 업데이트할 수 있습니다.', 'Press [Close] to stop reminders for this version — you can also update from the top of the Settings tab.')}
        </Text>
      ) : null}
      {upd.phase === 'newer' && upd.open?.changes && changes ? changesList(ui, 'upd-newer-list', changes) : null}
    </Box>
  )
}

export function drawUpdateNote(ui: Ui, upd: UpdateState, act: { toggle: () => void; close: () => void }) {
  const { Box, Button, Text } = ui
  const v = upd.updatedTo ?? ''
  const changes = upd.changes?.[v]
  return (
    <Box key="upd-note" flexDirection="column" marginTop={1} {...CARD}>
      <Box key="upd-note-row" columnGap={1} alignItems="center" flexWrap="wrap">
        {decoIcon(ui, 'update', LIVE_HEX, L('업데이트', 'Update'), 'upd-note-icon')}
        <Text>{L(`${v} 판으로 업데이트됨`, `Updated to ${v}`)}</Text>
        {changes ? <Button key="upd-note-changes" label={`${L('바뀐 것', 'What changed')} ${upd.open?.note ? '▾' : '▸'}`} variant="secondary" onPress={act.toggle} /> : null}
        <Button key="upd-note-close" label={L('닫기', 'Close')} variant="secondary" onPress={act.close} />
      </Box>
      {/* 0.5 묶음 2(N12): 닫기 전까지 남고 닫으면 다시 안 나온다는 것을 말한다 — 모르고 두면 늘 거기 있었다(동료 s09) */}
      <Text key="upd-note-hint" dimColor wrap="wrap">
        {L('확인했으면 [닫기] — 그때까지 이 자리에 남습니다.', 'Press [Close] once you have seen it — it stays here until then.')}
      </Text>
      {upd.open?.note && changes ? changesList(ui, 'upd-note-list', changes) : null}
    </Box>
  )
}
