import { Trash2, Video, Wrench } from 'lucide-react'
import { InlineText } from './InlineText'
import { roleLabel, type PlanPosition } from './types'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'

// Первая колонка матрицы: имя строки, чип роли, удаление. Компонент отдельный
// из-за взведённого удаления — useArmedAction хранит состояние ОДНОЙ кнопки,
// и общий на матрицу хук взвёл бы «Удалить» сразу у всех строк.
export function PositionRowHeader({ position, cellCount, onRename, onCycleRole, onRemove }: {
  position: PlanPosition
  cellCount: number
  onRename: (name: string) => void
  onCycleRole: () => void
  onRemove: () => void
}) {
  const { tr } = useLanguage()
  const armed = useArmedAction()

  return (
    <div className="hall-matrix__rowhead">
      <div className="hall-matrix__rowhead-main">
        <InlineText
          value={position.name}
          onSave={onRename}
          ariaLabel={tr('Название позиции', 'Lavozim nomi')}
        />

        {/* Роль перебирается кликом, а не выбирается из списка: значений три,
            и круг техник → оператор → другое короче любого выпадающего меню.
            Роль стоит у СТРОКИ, а не у ячейки: «Операторы» — это оператор во
            всех залах сразу, и держать её в каждой клетке было бы дублем. */}
        <button
          type="button"
          className={`hall-role hall-role--${position.role}`}
          onClick={onCycleRole}
          title={tr('Сменить роль', 'Rolni almashtirish')}
        >
          {position.role === 'technician' && <Wrench size={12} />}
          {position.role === 'operator' && <Video size={12} />}
          {roleLabel(position.role, tr)}
        </button>
      </div>

      {armed.armed ? (
        // Предупреждение называет цену: со строкой уходят ВСЕ её ячейки во всех
        // залах — это каскад базы, и отменить его нечем.
        <button
          autoFocus
          type="button"
          className="hall-matrix__row-delete hall-matrix__row-delete--armed"
          onClick={() => armed.fire(onRemove)}
          onBlur={armed.disarm}
        >
          {cellCount > 0
            ? tr(`Удалить строку и её ячейки (${cellCount})?`, `Qator va uning kataklari (${cellCount}) o‘chirilsinmi?`)
            : tr('Удалить строку?', 'Qator o‘chirilsinmi?')}
        </button>
      ) : (
        <button
          type="button"
          className="hall-matrix__row-delete"
          onClick={() => armed.fire(onRemove)}
          aria-label={tr('Удалить строку', 'Qatorni o‘chirish')}
          title={tr('Удалить строку', 'Qatorni o‘chirish')}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
