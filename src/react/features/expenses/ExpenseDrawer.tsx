import { CalendarDays, CircleAlert, Plus, Save, Trash2, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { createExpense, deleteExpense, EXPENSE_NOT_APPLIED, expenseErrorText, updateExpense } from './api'
import { caretAfterDigits, EXPENSE_AMOUNT_MAX, EXPENSE_NAME_MAX, formatSum, groupDigits, isSumInRange, parseSum, sumDigits } from './format'
import type { Expense, ExpenseInput } from './types'
import { AppDatePicker } from '../../components/AppDatePicker'
import { DrawerFrame } from '../../components/DrawerFrame'
import { EmployeePicker } from '../../components/EmployeePicker'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { employeeFullName, type EmployeeBrief } from '../employees/types'
import { todayDateValue } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useArmedAction } from '../../lib/useArmedAction'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'

// Цифр в поле суммы — не больше, чем в самом пределе: одиннадцатая заведомо
// за границей, и набирать её незачем.
const AMOUNT_MAX_DIGITS = String(EXPENSE_AMOUNT_MAX).length
const NO_EXCLUDED: ReadonlySet<string> = new Set()

type Draft = {
  name: string
  // Цифры без разрядки: разрядка — вид, а не значение.
  amountDigits: string
  spentOn: string
  spentBy: string | null
}

// Один дровер на ввод и на правку (как HallPlanMetaDrawer): разъедься они,
// правка показывала бы не те поля, которыми расход заводили. Пишет в базу сам
// и зовёт страницу уже по факту: журнал перечитывается, кэш сброшен в api.
export function ExpenseDrawer({ expense, defaultSpentBy, candidates, candidatesState, onLoadCandidates, onClose, onSaved, onDeleted, onStale }: {
  expense?: Expense
  // Активный фильтр «Кто потратил»: новая запись под фильтром иначе не
  // появилась бы в том журнале, из которого её заводят.
  defaultSpentBy: string
  // Сотрудники приходят от страницы: она владеет источником и отчётом об отказе.
  candidates: EmployeeBrief[]
  candidatesState: 'idle' | 'loading' | 'ready' | 'failed'
  onLoadCandidates: () => void
  onClose: () => void
  onSaved: (saved: ExpenseInput) => void
  onDeleted: () => void
  // Запись не применилась (её уже нет): показанный журнал устарел.
  onStale: () => void
}) {
  const { tr, locale } = useLanguage()
  const isEditing = Boolean(expense)
  const currency = tr('сум', 'so‘m')

  // Снимок на момент открытия: журнал под дровером может перечитаться, и
  // «несохранённое» не должно от этого появляться или исчезать.
  const [initialDraft] = useState<Draft>(() => ({
    name: expense?.name ?? '',
    amountDigits: expense ? String(expense.amount) : '',
    // Default в базе нет намеренно (current_date там UTC) — дату шлёт клиент.
    spentOn: expense?.spent_on ?? todayDateValue(),
    spentBy: expense ? expense.spent_by : (defaultSpentBy || null),
  }))
  const [draft, setDraft] = useState<Draft>(initialDraft)
  // 'saving' и 'deleting' после успеха НЕ снимаются: дровер закрывает страница,
  // и кнопка не должна ожить на кадр перед этим.
  const [busy, setBusy] = useState<'idle' | 'saving' | 'deleting'>('idle')
  // Текст отказа базы — строкой, уже собранной expenseErrorText.
  const [errorText, setErrorText] = useState('')
  const deleteConfirm = useArmedAction()

  const patch = (fields: Partial<Draft>) => setDraft((current) => ({ ...current, ...fields }))

  // Живая разрядка двигает текст под кареткой: запоминаем, сколько цифр стояло
  // слева от неё, и возвращаем каретку туда же после рендера. Счётчик нужен,
  // когда набранное отброшено (буква): значение не изменилось, рендера не было
  // бы, а React всё равно переставил бы каретку в конец.
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

  // Клиентские проверки — подсказка: границы держат expenses_name_check и
  // expenses_amount_check, роль и владельца — политики. Кнопку они запирают
  // только чтобы не слать заведомо мёртвый запрос.
  const amount = parseSum(draft.amountDigits)
  const nameEmpty = !draft.name.trim()
  const amountOutOfRange = amount !== null && !isSumInRange(amount)
  const canSave = !nameEmpty && isSumInRange(amount) && Boolean(draft.spentOn) && busy === 'idle'

  const isDirty = draft.name !== initialDraft.name
    || draft.amountDigits !== initialDraft.amountDigits
    || draft.spentOn !== initialDraft.spentOn
    || draft.spentBy !== initialDraft.spentBy
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && busy === 'idle', onClose)
  useModalLayer(requestClose)

  function fail(error: unknown, action: 'save' | 'delete') {
    reportAppError(error, { scope: 'loader', route: '/expenses', detail: { source: action } })
    setErrorText(expenseErrorText(error, tr, action))
    setBusy('idle')
    if (error instanceof Error && error.message === EXPENSE_NOT_APPLIED) onStale()
  }

  async function save() {
    if (!canSave || !isSumInRange(amount)) return
    const input: ExpenseInput = { name: draft.name, spentOn: draft.spentOn, amount, spentBy: draft.spentBy }
    setBusy('saving')
    setErrorText('')
    try {
      if (expense) await updateExpense(expense.id, input)
      else await createExpense(input)
      onSaved(input)
    } catch (error) {
      fail(error, 'save')
    }
  }

  async function remove() {
    if (!expense || busy !== 'idle') return
    setBusy('deleting')
    setErrorText('')
    try {
      await deleteExpense(expense.id)
      onDeleted()
    } catch (error) {
      fail(error, 'delete')
    }
  }

  function saveOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void save()
  }

  // Имя выбранного — из справочника страницы. Справочник ещё не приехал или не
  // приехал вовсе — человек всё равно выбран, и снять его можно.
  const spender = draft.spentBy ? candidates.find((candidate) => candidate.id === draft.spentBy) : undefined
  const title = isEditing ? tr('Изменить расход', 'Xarajatni o‘zgartirish') : tr('Новый расход', 'Yangi xarajat')

  return (
    <DrawerFrame
      className="expenses"
      ariaLabel={title}
      instant={false}
      onRequestClose={requestClose}
      head={<>
        <div className="drawer__titles">
          <p className="eyebrow">{tr('Производственные расходы', 'Ishlab chiqarish xarajatlari')}</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
      foot={<>
        {expense && (
          // onMouseDown — Safari: иначе onBlur гасит взвод раньше второго click
          // (gotchas §6).
          <button
            type="button"
            className="button button--danger-ghost expenses-drawer__delete"
            disabled={busy !== 'idle'}
            onClick={() => deleteConfirm.fire(() => void remove())}
            onBlur={deleteConfirm.disarm}
            onMouseDown={(event) => { if (deleteConfirm.armed) event.preventDefault() }}
          >
            <Trash2 size={16} /> {busy === 'deleting'
              ? tr('Удаляем…', 'O‘chirilmoqda…')
              : deleteConfirm.armed ? tr('Точно удалить?', 'Aniq o‘chirilsinmi?') : tr('Удалить', 'O‘chirish')}
          </button>
        )}
        <button type="button" className="button button--primary" disabled={!canSave} onClick={() => void save()}>
          {isEditing ? <Save size={17} /> : <Plus size={17} />} {busy === 'saving'
            ? tr('Сохраняем…', 'Saqlanmoqda…')
            : isEditing ? tr('Сохранить', 'Saqlash') : tr('Добавить расход', 'Xarajat qo‘shish')}
        </button>
      </>}
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
        <span>{tr('Наименование расхода', 'Xarajat nomi')} *</span>
        <input
          autoFocus
          value={draft.name}
          maxLength={EXPENSE_NAME_MAX}
          onChange={(event) => patch({ name: event.target.value })}
          onKeyDown={saveOnEnter}
          placeholder={tr('Например, напитки для команды', 'Masalan, jamoa uchun ichimliklar')}
        />
      </label>

      <label className="field">
        <span>{tr('Сумма', 'Summa')} *</span>
        <div className="expenses-sum">
          <input
            ref={amountRef}
            inputMode="numeric"
            autoComplete="off"
            value={amountText}
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

      <div className="field">
        <span><CalendarDays size={13} /> {tr('Дата', 'Sana')} *</span>
        <AppDatePicker
          value={draft.spentOn}
          onChange={(next) => patch({ spentOn: next })}
          locale={locale}
          placeholder={tr('Не указана', 'Ko‘rsatilmagan')}
          ariaLabel={tr('Дата расхода', 'Xarajat sanasi')}
          todayLabel={tr('Сегодня', 'Bugun')}
          clearLabel={tr('Очистить', 'Tozalash')}
          previousMonthLabel={tr('Предыдущий месяц', 'Oldingi oy')}
          nextMonthLabel={tr('Следующий месяц', 'Keyingi oy')}
        />
        {!draft.spentOn && <small className="field-hint field-hint--error">{tr('Укажите дату расхода', 'Xarajat sanasini ko‘rsating')}</small>}
      </div>

      {draft.spentBy
        ? (
          <div className="field">
            <span>{tr('Кто потратил', 'Kim sarfladi')}</span>
            <ul className="driver-chips expenses-spender">
              <li>
                <span>{spender ? employeeFullName(spender) : tr('Сотрудник', 'Xodim')}</span>
                <button type="button" className="icon-button" disabled={busy !== 'idle'} onClick={() => patch({ spentBy: null })} aria-label={tr('Убрать сотрудника', 'Xodimni olib tashlash')}>
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
            onLoad={onLoadCandidates}
            exclude={NO_EXCLUDED}
            onPick={(employee) => patch({ spentBy: employee.id })}
            label={tr('Кто потратил — необязательно', 'Kim sarfladi — ixtiyoriy')}
            disabled={busy !== 'idle'}
          />
        )}

      {errorText && <p className="form-error" role="alert"><CircleAlert size={15} /> {errorText}</p>}
    </DrawerFrame>
  )
}
