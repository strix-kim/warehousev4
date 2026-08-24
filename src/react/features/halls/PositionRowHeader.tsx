import { Asterisk, Trash2, Video, Wrench } from 'lucide-react'
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
            всех залах сразу, и держать её в каждой клетке было бы дублем.
            Подписи у чипа нет (с21): «Видеоинженер» под «Millumin» дублировал
            очевидное — роль это служебное поле счётчиков, а не текст строки.
            Имя роли осталось в подсказке. */}
        <button
          type="button"
          className={`hall-role hall-role--${position.role}`}
          onClick={onCycleRole}
          aria-label={tr(`Роль: ${roleLabel(position.role, tr)} — сменить`, `Rol: ${roleLabel(position.role, tr)} — almashtirish`)}
          title={tr(`Роль: ${roleLabel(position.role, tr)} — сменить`, `Rol: ${roleLabel(position.role, tr)} — almashtirish`)}
        >
          {position.role === 'technician' && <Wrench size={13} />}
          {position.role === 'operator' && <Video size={13} />}
          {position.role !== 'technician' && position.role !== 'operator' && <Asterisk size={13} />}
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
          // Safari: mousedown по кнопке не даёт ей фокус, но снимает его с
          // текущего держателя — а держатель и есть эта кнопка (autoFocus).
          // Без preventDefault её же onBlur гасил взвод раньше click, и
          // подтверждение «не нажималось» (та же природа, что у свотчей цвета).
          onMouseDown={(event) => event.preventDefault()}
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
