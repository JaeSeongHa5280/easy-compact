import type { CompactInputs, Settings, TurnSummary, Usage } from '../types'
import { approxUsd, average, coldFor, compactPayoff, estimateFor, fmtTokens, fmtUsd, isLittleToSave, LEVEL_TEXT, levelOf } from './cost'
import { L } from './i18n'
import { TIDY_IDS, tidySteps, tidyStyles } from './settings'
import { fitCells } from './text'
import { directKeep } from './tidy'
import { segChoice, stageText } from './ui-common'
import type { Ui } from './ui-common'

export function cardCalc(u: Usage | null, inputs: CompactInputs | null, sums: readonly TurnSummary[], nowMs: number) {
  const afterTokens = inputs?.after ?? u?.contextTokens ?? 0
  const est = u ? estimateFor(u, nowMs) : null
  const isSwitched = est?.kind === 'cold' && est.reason === 'model'
  const cold = u && inputs && est?.kind === 'cold' ? coldFor(u, inputs) : null
  const isColdWin = cold !== null && cold.compactUsd < cold.continueUsd
  const callsPerQ = average(sums.slice(-10).map(t => t.steps).filter(n => n > 0))
  const pay = u && inputs && est?.kind === 'warm' ? compactPayoff(u.contextTokens, inputs, u.model, callsPerQ) : null
  const isLittle = pay !== null && u !== null && isLittleToSave(u.contextTokens, afterTokens, pay.breakEvenCalls)
  const isLoss = (cold !== null && !isColdWin) || isLittle
  return { afterTokens, est, isSwitched, cold, isColdWin, callsPerQ, pay, isLittle, isLoss }
}

export type CardCalc = ReturnType<typeof cardCalc>
export type TidyNow = { sNow: Settings; tidyDraft: string | null; compactDraft: string | null }
export type TidyActs = {
  pickTidy: (id: string) => Promise<unknown>
  typeTidy: (text: string) => Promise<unknown>
  typeCompact: (text: string) => Promise<unknown>
  saveTidy: (text: string) => Promise<unknown>
  saveCompact: (text: string) => Promise<unknown>
}

export function keepEl(ui: Ui, isCold: boolean) {
  const { Box, Text } = ui
  return (
    <Box key="e-keep">
      <Text wrap="wrap">
        <Text bold color="success">
          {L('작업을 이어 가세요', 'Keep working')}
        </Text>
        <Text>
          {isCold
            ? L('. 다음 질문이 캐시를 다시 데웁니다. 컴팩트할 때가 되면 바가 알려 줍니다.', '. Your next question warms the cache again. The bar tells you when it is time to compact.')
            : L('. 지금은 아낄 게 거의 없습니다.', '. There is little to save right now.')}
        </Text>
      </Text>
    </Box>
  )
}

export function costLineEl(ui: Ui, c: CardCalc, u: Usage | null) {
  const { Text } = ui
  const pay = c.pay
  if (!pay || !u) return null
  const saves = pay.saveCallUsd > 0 && !c.isLittle
  return (
    <Text wrap="wrap">
      <Text>{L('컨텍스트 ', 'Context ')}</Text>
      {stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true })}
      <Text dimColor> → </Text>
      <Text bold color="success">
        ~{fmtTokens(Math.min(c.afterTokens, u.contextTokens))}
      </Text>
      <Text dimColor>{' · '}</Text>
      {!saves ? (
        <Text bold color="error">{L('아낄 게 거의 없어 지금 컴팩트하면 손해입니다', 'little to save, so compacting now is a loss')}</Text>
      ) : (
        <Text>
          <Text>{pay.saveQuestionUsd !== null ? L('질문 1개당 ', 'saves ') : L('요청 1회당 ', 'saves ')}</Text>
          <Text bold color="success">
            ~{fmtUsd(pay.saveQuestionUsd ?? pay.saveCallUsd)}
          </Text>
          <Text>{pay.saveQuestionUsd !== null ? L(' 아낌', ' per question') : L(' 아낌', ' per request')}</Text>
        </Text>
      )}
      <Text dimColor>{' · '}</Text>
      <Text>{L('이지 컴팩트 ', 'Easy Compact ')}</Text>
      <Text bold>
        ~{fmtUsd(pay.costUsd)}
      </Text>
    </Text>
  )
}

export function coldLineEl(ui: Ui, c: CardCalc, u: Usage | null) {
  const { Text } = ui
  const est = c.est
  if (!u || est?.kind !== 'cold') return null
  const cold = c.cold
  const shared = u.sharedTokens ?? 0
  return (
    <Text wrap="wrap">
      <Text>{L('그냥 이어 가면 첫 요청이 ', shared > 0 ? 'Continuing as is, the first request rewrites ' : 'Continuing as is, the first request rewrites all ')}</Text>
      {stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true })}
      <Text>
        {shared > 0
          ? L(
              ` 중 ~${fmtTokens(u.contextTokens - Math.min(shared, u.contextTokens))} 를 다시 씀 `,
              ` (~${fmtTokens(u.contextTokens - Math.min(shared, u.contextTokens))} of it, the shared prefix is read) `,
            )
          : L(' 전체를 다시 씀 ', ' ')}
      </Text>
      <Text bold>~{fmtUsd(cold?.continueUsd ?? est.rewriteUsd)}</Text>
      {cold === null ? null : (
        <Text>
          <Text dimColor>{' · '}</Text>
          <Text>{L('기본 컴팩트하면 ', 'a plain compact ')}</Text>
          <Text bold>~{fmtUsd(cold.compactUsd)}</Text>
          <Text dimColor> → </Text>
          <Text bold>~{fmtTokens(Math.min(c.afterTokens, u.contextTokens))}</Text>
          <Text dimColor>{' · '}</Text>
          {c.isColdWin ? (
            <Text bold color="success">
              {L(`${fmtUsd(cold.continueUsd - cold.compactUsd)} 이득`, `saves ${fmtUsd(cold.continueUsd - cold.compactUsd)}`)}
            </Text>
          ) : (
            <Text>
              <Text bold color="error">
                {L(`${approxUsd(cold.compactUsd - cold.continueUsd)} 손해`, `${approxUsd(cold.compactUsd - cold.continueUsd)} more`)}
              </Text>
              <Text>{L(' · 그냥 이어 가는 편이 쌉니다', ' · continuing as is is cheaper')}</Text>
            </Text>
          )}
        </Text>
      )}
    </Text>
  )
}

export function clearLeadEl(ui: Ui, u: Usage | null, lostQ: number | null) {
  const { Text } = ui
  const lead =
    L('요약 없이 새 대화로 시작합니다. 지금까지의 ', 'Starts a new conversation without a summary. Claude forgets everything so far') +
    (lostQ !== null ? L('', ': ') : u ? L('대화 ', ': ') : L('대화', ''))
  return (
    <Text wrap="wrap">
      <Text>{lead}</Text>
      {lostQ !== null ? <Text bold>{L(`질문 ${lostQ}개`, `${lostQ} question${lostQ === 1 ? '' : 's'}`)}</Text> : null}
      {u && lostQ !== null ? <Text dimColor>{' · '}</Text> : null}
      {u ? stageText(ui, 'ctx', LEVEL_TEXT[levelOf(u.contextTokens)], fmtTokens(u.contextTokens), { noFlash: true }) : null}
      <Text>{L(u ? ' 를 Claude 가 잊습니다.' : '를 Claude 가 잊습니다.', '.')}</Text>
    </Text>
  )
}

export function clearDescEl(ui: Ui, isCold: boolean) {
  const { Text } = ui
  return (
    <Text>
      <Text bold>{L('대화를 비우고 새로 시작(/clear)', 'Start over with an empty conversation (/clear)')}</Text>
      <Text dimColor> · </Text>
      <Text>
        {isCold
          ? L('비용 없음 · 요약 없음', 'no cost · no summary')
          : L('요약 없이 지웁니다. 남기지 않은 결정은 사라집니다.', 'Clears without a summary. Anything not saved yet is gone.')}
      </Text>
    </Text>
  )
}

export function tidyPickerEl(ui: Ui, t: TidyNow, act: TidyActs) {
  return segChoice(
    ui,
    'pick-tidy',
    [...TIDY_IDS.map(id => ({ value: id, label: tidyStyles()[id].name })), { value: 'custom', label: L('직접 쓰기', 'Write my own') }],
    t.sNow.tidy,
    v => void act.pickTidy(v),
  )
}

const inputOf = (ui: Ui, surface: string) => (surface === 'mobile' ? undefined : (ui as unknown as { Input?: (p: Record<string, unknown>) => unknown }).Input)

function inputBox(ui: Ui, surface: string, key: string, el: unknown) {
  const { Box } = ui
  return (
    <Box key={key} {...(surface === 'terminal' ? { borderStyle: 'round' as const, borderColor: 'promptBorder', paddingX: 1 } : {})}>
      {el}
    </Box>
  )
}

function tidyInputEl(ui: Ui, surface: string, t: TidyNow, act: TidyActs) {
  const InputEl = inputOf(ui, surface)
  return InputEl ? (
    <InputEl
      key="pick-tidy-text"
      placeholder={tidyStyles().default.body.join(' ')}
      value={t.tidyDraft ?? t.sNow.tidyCustom}
      submitLabel={L('저장', 'Save')}
      onInput={(v: string) => void act.typeTidy(v)}
      onSubmit={(v: string) => void act.saveTidy(v)}
    />
  ) : null
}

function compactInputEl(ui: Ui, surface: string, t: TidyNow, act: TidyActs) {
  const InputEl = inputOf(ui, surface)
  return InputEl ? (
    <InputEl
      key="pick-compact-text"
      placeholder={tidyStyles().default.compact}
      value={t.compactDraft ?? (t.sNow.compactCustom !== '' ? t.sNow.compactCustom : tidyStyles().default.compact)}
      submitLabel={L('저장', 'Save')}
      onInput={(v: string) => void act.typeCompact(v)}
      onSubmit={(v: string) => void act.saveCompact(v)}
    />
  ) : null
}

export function easyParts(ui: Ui, t: TidyNow, act: TidyActs, surface: string): unknown[] {
  const { Box, Text } = ui
  const s = t.sNow
  const steps = tidySteps(s)
  const sends = s.tidyCustom !== '' ? s.tidyCustom : tidyStyles().default.body.join(' ')
  return [
    s.tidy === 'custom' && inputOf(ui, surface) ? (
      <Box key="e-save-custom" flexDirection="column" rowGap={0.5}>
        <Text key="e-save-pre-name" dimColor>{L('① 컴팩트 전에 보낼 글(저장 턴)', '① Sent before compacting (save turn)')}</Text>
        {inputBox(ui, surface, 'e-save-pre', tidyInputEl(ui, surface, t, act))}
        <Text key="e-save-post-name" dimColor>{L('② /compact 뒤에 붙일 글', '② After /compact')}</Text>
        {inputBox(ui, surface, 'e-save-post', compactInputEl(ui, surface, t, act))}
      </Box>
    ) : s.tidy === 'custom' ? (
      <Text key="e-save-custom" wrap="wrap">
        <Text dimColor>{L('보낼 글 ', 'Sends ')}</Text>
        <Text>{L(`「${fitCells(sends, 44)}」`, `"${fitCells(sends, 44)}"`)}</Text>
      </Text>
    ) : (
      <Text key="e-save-keep" wrap="wrap">
        <Text dimColor>{L('저장 ', 'Save ')}</Text>
        <Text bold>{steps.keep}</Text>
      </Text>
    ),
    s.tidy === 'custom' ? null : (
      <Text key="e-save-reply" wrap="wrap">
        <Text dimColor>{L('답 ', 'Reply ')}</Text>
        <Text bold>{steps.reply}</Text>
      </Text>
    ),
  ]
}

export function plainParts(ui: Ui, t: TidyNow, act: TidyActs, surface: string): unknown[] {
  const { Box, Text } = ui
  const s = t.sNow
  return [
    s.tidy === 'custom' && inputOf(ui, surface) ? (
      <Box key="e-direct-custom" flexDirection="column">
        <Text key="e-direct-post-name" dimColor>{L('② /compact 뒤에 붙일 글', '② After /compact')}</Text>
        {inputBox(ui, surface, 'e-direct-post', compactInputEl(ui, surface, t, act))}
      </Box>
    ) : (
      <Text key="e-direct-text" wrap="wrap">
        <Text bold>{L('/compact 뒤 글로 컴팩트합니다', 'Runs /compact with the text after it')}</Text>
        <Text dimColor> · </Text>
        <Text>{L(`「${directKeep(s)}」`, `"${directKeep(s)}"`)}</Text>
      </Text>
    ),
    <Text key="e-direct-note" dimColor wrap="wrap">
      {L('저장 질문 없이 바로 컴팩트합니다.', 'Compacts right away, without the save question.')}
    </Text>,
  ]
}
