import { CircleAlert, ReceiptText, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { createMealExpense, mealErrorText } from './api'
import { buildExpenseComment, type MealSummary, type MealTextContext } from './mealSummary'
import { DrawerFrame } from '../../components/DrawerFrame'
import { EmployeePicker } from '../../components/EmployeePicker'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { fetchEmployeeBriefs } from '../employees/api'
import { employeeFullName, type EmployeeBrief } from '../employees/types'
import { invalidateExpensesCache } from '../expenses/api'
import { caretAfterDigits, EXPENSE_AMOUNT_MAX, EXPENSE_COMMENT_MAX, EXPENSE_NAME_MAX, formatSum, groupDigits, isSumInRange, parseSum, sumDigits } from '../expenses/format'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'

const ROUTE = '/projects/:projectId/meals'
// Как в ExpenseDrawer: цифр не больше, чем в самом пределе.
const AMOUNT_MAX_DIGITS = String(EXPENSE_AMOUNT_MAX).length
const NO_EXCLUDED: ReadonlySet<string> = new Set()
// Последний «Кто потратил» — удобство одного зрителя (раздел 3.3 плана), не
// данные: пропал или недоступен — поле просто пустое.
const LAST_SPENT_BY_KEY = 'meals:lastSpentBy'

function readLastSpentBy(): string | null {
  try {
    return window.localStorage.getItem(LAST_SPENT_BY_KEY) || null
  } catch {
    return null
  }
}

function writeLastSpentBy(id: string | null) {
  try {
    if (id) window.localStorage.setItem(LAST_SPENT_BY_KEY, id)
    else window.localStorage.removeItem(LAST_SPENT_BY_KEY)
  } catch {
    // Хранилище заперто (приватное окно) — удобство теряется, расход уже внесён.
  }
}

// Обрезка кодовыми точками, как char_length в Postgres (expenses_name_check):
// срез по UTF-16 мог бы разрезать суррогатную пару.
function clip(value: string, max: number) {
  const chars = Array.from(value)
  return chars.length <= max ? value : chars.slice(0, max).join('').trimEnd()
}

type Draft = {
  name: string
  // Цифры без разрядки: разрядка — вид, а не значение.
  amountDigits: string
  spentBy: string | null
  comment: string
}

// «В расходы» (план meals-s56, шаг 6): расход ложится в журнал ВЫЗЫВАЮЩЕГО
// аккаунта с датой обеда — дату ставит база (meal_on), поэтому поля даты нет.
// Сумма предзаполнена итогом цен, но её вводит человек: у кафе бывает
// обслуживание и чек без цен по блюдам (раздел 1.5). Один расход на обед, статус
// и владельца держит create_meal_expense — клиентские проверки здесь только
// запирают кнопку перед заведомо мёртвым запросом.
export function MealExpenseDrawer({ mealId, summary, ctx, onRequestClose, onCreated }: {
  mealId: string
  summary: MealSummary
  ctx: MealTextContext
  onRequestClose: () => void
  onCreated: (expenseId: string) => void
}) {
  const { tr } = useLanguage()
  const currency = tr('сум', 'so‘m')

  // Снимок на момент открытия: экран под дровером может перечитаться, и
  // предзаполненное не должно от этого меняться или становиться «несохранённым».
  const [initialDraft, setInitialDraft] = useState<Draft>(() => {
    const slot = ctx.slot === 'lunch' ? tr('Обед', 'Tushlik') : tr('Ужин', 'Kechki ovqat')
    return {
      name: clip([slot, ctx.projectName.trim()].filter(Boolean).join(' · '), EXPENSE_NAME_MAX),
      amountDigits: summary.total > 0 ? String(summary.total) : '',
      spentBy: readLastSpentBy(),
      comment: buildExpenseComment(summary, ctx, tr, EXPENSE_COMMENT_MAX),
    }
  })
  const [draft, setDraft] = useState<Draft>(initialDraft)
  // 'saving' после успеха НЕ снимается: дровер закрывает страница, и кнопка не
  // должна ожить на кадр перед этим. Второе нажатие держит ещё и база (for update).
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState('')

  const patch = (fields: Partial<Draft>) => setDraft((current) => ({ ...current, ...fields }))

  // Сотрудники для «Кто потратил» — дровер грузит сам: страница обедов
  // справочник всех сотрудников не держит (у неё состав мероприятия). Отказ не
  // мешает внести расход: у пикера своя кнопка повтора.
  const [candidates, setCandidates] = useState<EmployeeBrief[]>([])
  const [candidatesState, setCandidatesState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  function loadCandidates() {
    setCandidatesState('loading')
    fetchEmployeeBriefs()
      .then((rows) => {
        if (!mountedRef.current) return
        setCandidates(rows)
        setCandidatesState('ready')
      })
      .catch((error: unknown) => {
        reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'meal-expense-employees' } })
        if (mountedRef.current) setCandidatesState('failed')
      })
  }

  // Сразу, а не по фокусу пикера: запомненного человека надо показать по имени.
  useEffect(loadCandidates, [])

  // Запомненного сотрудника уже нет в справочнике (удалили) — снимаем и из
  // снимка, и из черновика: иначе внос упал бы на внешнем ключе, а снятие
  // выглядело бы несохранённой правкой.
  const rememberedSpentBy = initialDraft.spentBy
  useEffect(() => {
    if (candidatesState !== 'ready' || !rememberedSpentBy) return
    if (candidates.some((candidate) => candidate.id === rememberedSpentBy)) return
    setInitialDraft((current) => ({ ...current, spentBy: null }))
    setDraft((current) => current.spentBy === rememberedSpentBy ? { ...current, spentBy: null } : current)
  }, [candidatesState, candidates, rememberedSpentBy])

  // Поле суммы — копия ExpenseDrawer: каретка возвращается к тем же цифрам
  // после живой разрядки.
  const amountRef = useRef<HTMLInputElement>(null)
  const caretDigitsRef = useRef<number | null>(null)
  const [caretTick, setCaretTick] = useState(0)
  const amountText = groupDigits(draft.amountDigits)

  useLayoutEffect(() => {
    if (caretDigitsRef.current === null || !amountRef.current) return
    const position = caretAfterDigits(amountText, caretDigitsRef.current)
    caretDigitsRef.current = null
    amountRef.current.setSelectionRange(position, position)
  }, [amountText, caretTick])

  function changeAmount(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const caret = event.target.selectionStart ?? raw.length
    const digits = sumDigits(raw).slice(0, AMOUNT_MAX_DIGITS)
    caretDigitsRef.current = Math.min(sumDigits(raw.slice(0, caret)).length, digits.length)
    patch({ amountDigits: digits })
    setCaretTick((value) => value + 1)
  }

  // Подсказка: границы держат expenses_name_check, expenses_amount_check и
  // expenses_comment_check внутри RPC.
  const amount = parseSum(draft.amountDigits)
  const nameEmpty = !draft.name.trim()
  const amountOutOfRange = amount !== null && !isSumInRange(amount)
  const canSave = !nameEmpty && isSumInRange(amount) && !busy

  const isDirty = draft.name !== initialDraft.name
    || draft.amountDigits !== initialDraft.amountDigits
    || draft.spentBy !== initialDraft.spentBy
    || draft.comment !== initialDraft.comment
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !busy, onRequestClose)
  useModalLayer(requestClose)

  async function save() {
    if (!canSave || !isSumInRange(amount)) return
    setBusy(true)
    setErrorText('')
    try {
      // RPC пишет как пришло: края названия и пустой комментарий режем здесь,
      // как expenseRow в expenses/api (иначе «   » ушло бы в журнал).
      const expenseId = await createMealExpense(mealId, {
        name: draft.name.trim(),
        amount,
        spentBy: draft.spentBy,
        comment: draft.comment.trim() || null,
      })
      invalidateExpensesCache()
      writeLastSpentBy(draft.spentBy)
      onCreated(expenseId)
    } catch (error) {
      reportAppError(error, { scope: 'loader', route: ROUTE, detail: { source: 'create-meal-expense' } })
      setErrorText(mealErrorText(error, tr))
      setBusy(false)
    }
  }

  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void save()
  }

  const spender = draft.spentBy ? candidates.find((candidate) => candidate.id === draft.spentBy) : undefined
  const title = tr('Внести в расходы', 'Xarajatlarga kiritish')

  return (
    <DrawerFrame
      className="meal-expense"
      ariaLabel={title}
      instant={false}
      onRequestClose={requestClose}
      head={<>
        <div className="drawer__titles">
          <p className="eyebrow">{tr('Обеды', 'Ovqatlanish')}</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
      foot={
        <button type="button" className="button button--primary" disabled={!canSave} onClick={() => void save()}>
          <ReceiptText size={17} /> {busy ? tr('Вносим…', 'Kiritilmoqda…') : tr('Внести', 'Kiritish')}
        </button>
      }
    >
      <AnimatePresence>
        {isPrompting && (
          <UnsavedPrompt
            key="unsaved"
            message={tr('Есть несохранённые изменения.', 'Saqlanmagan o‘zgarishlar bor.')}
            stayLabel={tr('Продолжить правку', 'Tahrirni davom ettirish')}
            leaveLabel={tr('Закрыть без сохранения', 'Saqlamasdan yopish')}
            onStay={keepEditing}
            onLeave={confirmClose}
          />
        )}
      </AnimatePresence>

      <label className="field">
        <span>{tr('Название', 'Nomi')} *</span>
        <input
          value={draft.name}
          maxLength={EXPENSE_NAME_MAX}
          disabled={busy}
          onChange={(event) => patch({ name: event.target.value })}
          onKeyDown={saveOnEnter}
        />
        {nameEmpty && <small className="field-hint field-hint--error">{tr('Укажите название', 'Nomini ko‘rsating')}</small>}
      </label>

      {/* «Строк без цены: N», а не «У N строк»: без склонения по числу. */}
      {summary.unpriced > 0 && (
        <p className="field-hint meal-expense__unpriced">
          <CircleAlert size={13} /> {tr(
            `Строк без цены: ${summary.unpriced} — проверьте сумму по чеку`,
            `Narxsiz qatorlar: ${summary.unpriced} — summani chek bo‘yicha tekshiring`,
          )}
        </p>
      )}

      {/* Автофокус на сумме: её чаще всего правят по чеку, название готово. */}
      <label className="field">
        <span>{tr('Сумма, сум', 'Summa, so‘m')} *</span>
        <div className="meal-expense__sum">
          <input
            ref={amountRef}
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            value={amountText}
            disabled={busy}
            onChange={changeAmount}
            onKeyDown={saveOnEnter}
            placeholder="0"
            aria-label={tr('Сумма в сумах', 'Summa so‘mda')}
          />
          <span aria-hidden="true">{currency}</span>
        </div>
        {amountOutOfRange && (
          <small className="field-hint field-hint--error">
            {tr(`От 1 до ${formatSum(EXPENSE_AMOUNT_MAX)} сум`, `1 dan ${formatSum(EXPENSE_AMOUNT_MAX)} so‘mgacha`)}
          </small>
        )}
      </label>

      {draft.spentBy
        ? (
          <div className="field">
            <span>{tr('Кто потратил', 'Kim sarfladi')}</span>
            <ul className="driver-chips meal-expense__spender">
              <li>
                <span>{spender ? employeeFullName(spender) : tr('Сотрудник', 'Xodim')}</span>
                <button type="button" className="icon-button" disabled={busy} onClick={() => patch({ spentBy: null })} aria-label={tr('Убрать сотрудника', 'Xodimni olib tashlash')}>
                  <X size={14} />
                </button>
              </li>
            </ul>
          </div>
        )
        : (
          <EmployeePicker
            candidates={candidates}
            candidatesState={candidatesState}
            onLoad={loadCandidates}
            exclude={NO_EXCLUDED}
            onPick={(employee) => patch({ spentBy: employee.id })}
            label={tr('Кто потратил — необязательно', 'Kim sarfladi — ixtiyoriy')}
            disabled={busy}
          />
        )}

      {/* Enter здесь — перенос строки, а не внос: поле многострочное. */}
      <label className="field">
        <span>{tr('Комментарий — необязательно', 'Izoh — ixtiyoriy')}</span>
        <textarea
          value={draft.comment}
          maxLength={EXPENSE_COMMENT_MAX}
          rows={4}
          disabled={busy}
          onChange={(event) => patch({ comment: event.target.value })}
        />
      </label>

      {errorText && <p className="form-error" role="alert"><CircleAlert size={15} /> {errorText}</p>}
    </DrawerFrame>
  )
}
