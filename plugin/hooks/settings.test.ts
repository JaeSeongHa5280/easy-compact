import { expect, test } from 'claude-code/testing'

import { setLang } from './i18n'

import { SESSION_HEX, sessionColorOf } from './cost'
import {
  chooseTidy,
  DEFAULT_SETTINGS,
  parseScreen,
  SCREEN_VIEWS,
  viewOf,
  normalizeSettings,
  nudgeCache,
  isAutoWord,
  parseBandMode,
  parseBandPart,
  parseOnOff,
  setBandPart,
  parseMinutes,
  parseTokens,
  RANGE_BANDS,
  RANGE_ROWS,
  setCompactAt,
  setFollow,
  setRange,
  tidyBody,
  tidySteps,
} from './settings'

// 이 시험의 글 기대값은 한국어 — 화면 글은 L(한, 영) 으로 언어를 따른다
setLang('ko')

test('직접 지정으로: 지금 빨강(구간 끝)을 그 크기로 — 바꾸자마자 값이 튀지 않게. 입력 · 명령 값은 범위 안으로', () => {
  const off = setFollow(DEFAULT_SETTINGS, false, 270_000)
  expect(off).toEqual({ ...DEFAULT_SETTINGS, follow: false, compactAt: 270_000 })
  expect(setFollow(off, true).follow).toBe(true)
  expect(setCompactAt(DEFAULT_SETTINGS, 50_000).compactAt).toBe(100_000)
  expect(setCompactAt(DEFAULT_SETTINGS, 2_000_000).compactAt).toBe(1_000_000)
  expect(setCompactAt(DEFAULT_SETTINGS, 300_000)).toEqual({ ...DEFAULT_SETTINGS, compactAt: 300_000, follow: false })
})

test('컴팩트 구간: 0~100만 비용표의 크기 띠 한 줄(처음 설치 값 20만 ~ 25만, 표의 한 줄). 명령은 값으로', () => {
  expect(RANGE_ROWS[0]).toBe(100_000)
  expect(RANGE_ROWS[RANGE_ROWS.length - 1]).toBe(1_000_000)
  // 띠 = 이웃 경계 사이
  expect(RANGE_BANDS[0]).toEqual([100_000, 150_000])
  expect(RANGE_BANDS[RANGE_BANDS.length - 1]).toEqual([700_000, 1_000_000])
  expect(RANGE_BANDS.length).toBe(RANGE_ROWS.length - 1)
  expect(DEFAULT_SETTINGS).toMatchObject({ follow: true, rangeStart: 200_000, rangeEnd: 250_000 })
  expect(RANGE_BANDS.some(([a, b]) => a === DEFAULT_SETTINGS.rangeStart && b === DEFAULT_SETTINGS.rangeEnd)).toBe(true)
  // 명령: 값으로(범위 안으로), 시작이 끝 이상이면 그대로
  const manual = setFollow(DEFAULT_SETTINGS, false, 250_000)
  expect(setRange(manual, 160_000, 230_000)).toEqual({ ...manual, follow: true, rangeStart: 160_000, rangeEnd: 230_000 })
  expect(setRange(manual, 50_000, 2_000_000)).toMatchObject({ rangeStart: 100_000, rangeEnd: 1_000_000 })
  expect(setRange(manual, 300_000, 200_000)).toBe(manual)
})

test('캐시 경고 −/+: 칸을 따라, 끝에서 멈춘다', () => {
  expect(nudgeCache(DEFAULT_SETTINGS, 1).cacheWarnMin).toBe(15)
  expect(nudgeCache(DEFAULT_SETTINGS, -1).cacheWarnMin).toBe(5)
  expect(nudgeCache({ ...DEFAULT_SETTINGS, cacheWarnMin: 0 }, -1).cacheWarnMin).toBe(0)
  expect(nudgeCache({ ...DEFAULT_SETTINGS, cacheWarnMin: 30 }, 1).cacheWarnMin).toBe(30)
})

test('저장된 값을 관대하게 읽는다: 빠진 키는 기본, 깨진 값은 버림, 예전 판(프리셋 · 자동)은 옮긴다', () => {
  expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  const s = normalizeSettings({ compactAt: 'x', follow: 'y', rangeStart: 300_000, rangeEnd: 200_000, cacheWarnMin: -1, tidy: 'nope' })
  expect(s).toEqual(DEFAULT_SETTINGS)
  expect(normalizeSettings({ rangeStart: 200_000, rangeEnd: 400_000 })).toMatchObject({ rangeStart: 200_000, rangeEnd: 400_000 })
  // 예전 판의 폭(rangePct)은 버리고 기본 구간
  expect(normalizeSettings({ rangePct: 20 })).toEqual(DEFAULT_SETTINGS)
  // 예전 판 자동(auto 없음 · true) → 최적 따라감, 캐시 경고는 그 값 그대로
  const auto = normalizeSettings({ preset: 'tight', values: { usdWarn: 0.1, usdCut: 0.5, ctxWarn: 100_000, ctxCut: 200_000, cacheWarnMin: 15 } })
  expect(auto.follow).toBe(true)
  expect(auto.cacheWarnMin).toBe(15)
  // 예전 판 고정(auto: false) → 그 권장 크기를 고정으로
  const fixed = normalizeSettings({ auto: false, preset: 'custom', values: { ctxWarn: 100_000, ctxCut: 400_000, cacheWarnMin: 10 } })
  expect(fixed.follow).toBe(false)
  expect(fixed.compactAt).toBe(400_000)
})

test('바 접기 · 화면: 처음엔 펼침 · 컴팩트할 때 펴기 켬 · 최대 · 자세히(저장소를 못 읽을 때), 0.4.0 전 값은 옮긴다, 이름은 영 · 한', () => {
  expect(DEFAULT_SETTINGS).toMatchObject({ band: 'full', bandFolded: false, bandAutoOpen: true, screen: 'detail', custom: null })
  expect(Object.values(viewOf(DEFAULT_SETTINGS).bandShow).every(Boolean)).toBe(true)
  expect(normalizeSettings({ band: 'tiny', bandFolded: 'y', bandAutoOpen: 1, screen: 'x', custom: 'x' })).toMatchObject({ band: 'full', bandFolded: false, bandAutoOpen: true, screen: 'detail', custom: null })
  // 0.2.0 의 auto(컴팩트할 때만) → 최소 + 접고 컴팩트할 때 펴기. 칸을 하나라도 껐으면 그 칸 그대로 커스텀
  const s = normalizeSettings({ band: 'auto', bandShow: { resets: false, fiveHour: 'no' } })
  expect(s).toMatchObject({ band: 'min', bandFolded: true, bandAutoOpen: true, screen: 'custom' })
  expect(s.custom!.bandShow).toEqual({ ...SCREEN_VIEWS.basic.bandShow, resets: false })
  // 0.4.0 전 안 보이기 → 접고 안 펴기, 자동 숨김 → 접고 펴기, 늘 보이기 → 펼침(✕ 와 ⇲ 를 하나로)
  expect(normalizeSettings({ bandHidden: true, bandAuto: true })).toMatchObject({ bandFolded: true, bandAutoOpen: false })
  expect(normalizeSettings({ bandAuto: true })).toMatchObject({ bandFolded: true, bandAutoOpen: true })
  expect(normalizeSettings({ bandAuto: false, bandHidden: false })).toMatchObject({ bandFolded: false, bandAutoOpen: true })
  // 칸 다 켬 + 패널 간략(0.4.0 개발판) → 기본, 패널 값 없음(0.3.x) → 자세히(보던 그대로)
  expect(normalizeSettings({ paneMode: 'simple' }).screen).toBe('basic')
  expect(normalizeSettings({ bandShow: { cache: true } }).screen).toBe('detail')
  // 새 저장값은 그대로 · 깨진 커스텀 색 기준(오름차순 아님)은 처음 값
  expect(normalizeSettings({ screen: 'simple', bandFolded: true, bandAutoOpen: false })).toMatchObject({ screen: 'simple', bandFolded: true, bandAutoOpen: false })
  expect(normalizeSettings({ screen: 'custom', custom: { sessionColors: [50, 10, 100] } }).custom!.sessionColors).toEqual([10, 50, 100])
  expect(normalizeSettings({ screen: 'custom', custom: { sessionColors: [5, 20, 40], agentLine: false } }).custom).toMatchObject({ sessionColors: [5, 20, 40], agentLine: false })
  // 칸 명령(setBandPart)은 지금 보이는 값에서 커스텀으로 옮겨 바꾼다
  const c = setBandPart(DEFAULT_SETTINGS, 'cache', false)
  expect(c.screen).toBe('custom')
  expect(viewOf(c).bandShow.cache).toBe(false)
  expect(viewOf(c).bandShow.sessionAvg).toBe(true)
  // 화면 이름(영 · 한, "전문가" 도 자세히로)
  expect(parseScreen('간단')).toBe('simple')
  expect(parseScreen('Basic')).toBe('basic')
  expect(parseScreen('전문가')).toBe('detail')
  expect(parseScreen('커스텀')).toBe('custom')
  expect(parseScreen('nope')).toBe(null)
  // 세션 금액 색: 노랑 · 주황 · 빨강, 그 아래는 기본 글색
  expect(sessionColorOf(9.99, [10, 50, 100])).toBe(undefined)
  expect(sessionColorOf(10, [10, 50, 100])).toBe(SESSION_HEX.yellow)
  expect(sessionColorOf(75, [10, 50, 100])).toBe(SESSION_HEX.orange)
  expect(sessionColorOf(100, [10, 50, 100])).toBe(SESSION_HEX.red)
  // 캐시 경고: 유지 시간마다 따로(5분 캐시는 0 ~ 4분)
  expect(nudgeCache(DEFAULT_SETTINGS, 1, 5)).toMatchObject({ cacheWarnMin5m: 3, cacheWarnMin: 10 })
  expect(nudgeCache({ ...DEFAULT_SETTINGS, cacheWarnMin5m: 4 }, 1, 5).cacheWarnMin5m).toBe(4)
  expect(nudgeCache(DEFAULT_SETTINGS, 1)).toMatchObject({ cacheWarnMin: 15, cacheWarnMin5m: 2 })
  expect(parseBandMode('최소')).toBe('min')
  expect(parseBandMode('최대')).toBe('full')
  expect(parseBandMode('MAX')).toBe('full')
  expect(parseBandMode('cache')).toBe(null)
  expect(isAutoWord('필요할 때만')).toBe(true)
  expect(isAutoWord('auto')).toBe(true)
  expect(parseOnOff('켜기')).toBe(true)
  expect(parseOnOff('OFF')).toBe(false)
  expect(parseOnOff('닫기')).toBe(false)
  expect(parseOnOff('maybe')).toBe(null)
  expect(parseBandPart('5시간')).toBe('fiveHour')
  expect(parseBandPart('7D')).toBe('sevenDay')
  expect(parseBandPart('컴팩트 구간')).toBe('range')
  expect(parseBandPart('nope')).toBe(null)
})

test('값 읽기: 30만 · 300k · 300000 · 10분', () => {
  expect(parseTokens('30만')).toBe(300_000)
  expect(parseTokens('300k')).toBe(300_000)
  expect(parseTokens('300,000')).toBe(300_000)
  expect(parseTokens('비쌈')).toBe(null)
  // 화면이 100만을 "1M" 으로 보이니 M 도, 한글 자판 그대로 친 k(ㅏ) · m(ㅡ)도, 단위 없는 1만 아래 수는 k 로
  //
  expect(parseTokens('1M')).toBe(1_000_000)
  expect(parseTokens('0.5m')).toBe(500_000)
  expect(parseTokens('100만')).toBe(1_000_000)
  expect(parseTokens('400ㅏ')).toBe(400_000)
  expect(parseTokens('1ㅡ')).toBe(1_000_000)
  expect(parseTokens('400')).toBe(400_000)
  expect(parseTokens('450000')).toBe(450_000)
  expect(parseMinutes('10분')).toBe(10)
  expect(parseMinutes('10')).toBe(10)
  expect(parseMinutes('열')).toBe(null)
})

test('컴팩트 문구: 프리셋 이름이면 프리셋, 그 밖의 글이면 직접 쓴 문구', () => {
  const thorough = chooseTidy(DEFAULT_SETTINGS, '꼼꼼하게')
  expect(thorough.tidy).toBe('thorough')
  expect(tidyBody(thorough).join('\n')).toContain('5~10줄')
  const mine = chooseTidy(DEFAULT_SETTINGS, '결정만 남겨')
  expect(mine.tidy).toBe('custom')
  expect(tidyBody(mine)).toEqual(['결정만 남겨'])
  expect(tidySteps(mine).save).toBe('직접 쓴 문구대로')
  // 직접 쓴 글이 있으면 "커스텀" 으로 다시 고를 수 있다
  expect(chooseTidy(chooseTidy(mine, '기본'), '커스텀').tidy).toBe('custom')
  // 이름은 쓰는 때로(일반 · 긴 세션 이어가기 · 마무리), 띄어쓰기는 무시, 예전 이름(기본 · 가볍게 · 꼼꼼하게)도 받는다
  expect(chooseTidy(mine, '일반').tidy).toBe('default')
  expect(chooseTidy(mine, '긴세션 이어가기').tidy).toBe('thorough')
  expect(chooseTidy(mine, '마무리').tidy).toBe('light')
  expect(chooseTidy(mine, '가볍게').tidy).toBe('light')
  // 객체 기본 키 이름은 문구 이름이 아니다 — 직접 쓴 글로
  expect(chooseTidy(DEFAULT_SETTINGS, 'constructor')).toMatchObject({ tidy: 'custom', tidyCustom: 'constructor' })
  expect(tidySteps(chooseTidy(DEFAULT_SETTINGS, '마무리')).keep).toBe('저장 안 함')
})
