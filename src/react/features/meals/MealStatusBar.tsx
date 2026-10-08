import { ArrowRight, Check, ReceiptText, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { MEAL_STATUSES, type MealStatus } from './types'
import { ActionMenu } from '../../components/ActionMenu'
import { useLanguage } from '../../lib/i18n'

// Степпер статуса приёма (план meals-s56, шаг 5): «Собираем → Заказано →
// Привезли» одной большой кнопкой «Дальше». Сам в базу не пишет — зовёт
// страницу: строку обеда при первом «Дальше» создаёт она (ensureMeal), она же
// держит отказ. Порядок шагов — MEAL_STATUSES, другого источника нет.
export function MealStatusBar({ status, hasMeal, expenseId, expenseNote, busy, onAdvance, onStepBack, onCreateExpense }: {
  // Обеда в базе ещё нет — 'collecting'.
  status: MealStatus
  hasMeal: boolean
  expenseId: string | null
  // Хвост подписи «В расходах»: сумма, ссылка на /expenses или «внесено другим
  // аккаунтом» — решает страница, она знает, читается ли расход.
  expenseNote?: ReactNode
  busy: boolean
  onAdvance: (next: MealStatus) => void
  onStepBack: (prev: MealStatus) => void
  onCreateExpense: () => void
}) {
  const { tr } = useLanguage()
  const labels: Record<MealStatus, string> = {
    collecting: tr('Собираем', 'Yig‘ilmoqda'),
    ordered: tr('Заказано', 'Buyurtma berildi'),
    delivered: tr('Привезли', 'Olib kelindi'),
  }
  const index = MEAL_STATUSES.indexOf(status)
  const next = MEAL_STATUSES[index + 1]
  // Шаг назад — только у существующего обеда и пока он не в расходах: внесённый
  // назад не вернёт project_meals_expense_status_check, кнопка лишь не шлёт
  // заведомо мёртвый запрос.
  const prev = hasMeal && !expenseId && index > 0 ? MEAL_STATUSES[index - 1] : undefined

  return (
    <div className="meal-status">
      <ol className="meal-status__steps">
        {MEAL_STATUSES.map((step, stepIndex) => (
          <li
            key={step}
            className={stepIndex < index ? 'is-done' : stepIndex === index ? 'is-current' : ''}
            aria-current={stepIndex === index ? 'step' : undefined}
          >
            {stepIndex < index && <Check size={13} />}
            {labels[step]}
          </li>
        ))}
      </ol>

      <div className="meal-status__actions">
        {next && (
          <button type="button" className="button button--primary meal-status__main" disabled={busy} onClick={() => onAdvance(next)}>
            {tr('Дальше', 'Keyingi')}: {labels[next]} <ArrowRight size={17} />
          </button>
        )}
        {!next && !expenseId && (
          <button type="button" className="button button--primary meal-status__main" disabled={busy} onClick={onCreateExpense}>
            <ReceiptText size={17} /> {tr('В расходы', 'Xarajatlarga')}
          </button>
        )}
        {expenseId && (
          <p className="meal-status__expense">
            <ReceiptText size={16} /> {tr('В расходах', 'Xarajatlarda')}
            {expenseNote && <> · {expenseNote}</>}
          </p>
        )}
        {prev && (
          <ActionMenu
            label={tr('Вернуть', 'Qaytarish')}
            ariaLabel={tr('Вернуть статус назад', 'Holatni orqaga qaytarish')}
            icon={<Undo2 size={15} />}
            disabled={busy}
            items={[{
              id: prev,
              label: `${tr('Вернуть', 'Qaytarish')}: ${labels[prev]}`,
              onSelect: () => onStepBack(prev),
            }]}
          />
        )}
      </div>
    </div>
  )
}
