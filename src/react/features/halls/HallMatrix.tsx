import { Plus, X } from 'lucide-react'
import { Fragment, useMemo, useRef, useState, type CSSProperties } from 'react'
import { HallColumnHeader } from './HallColumnHeader'
import { MatrixCell } from './MatrixCell'
import { PositionRowHeader } from './PositionRowHeader'
import type { PositionCatalogEntry } from './types'
import { cellKeyOf, type HallPlanEditor } from './useHallPlanEditor'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'

// Матрица распределения (с20, по образцу прораба): строки — позиции ВСЕГО
// мероприятия, колонки — залы, клетка — люди на пересечении. До образца
// редактор был доской колонок со своими позициями в каждой; так расстановку
// никто не ведёт — «Страховка» это одна строка на все залы, а не четыре
// одинаковых записи, которые надо держать синхронными руками.
//
// Раскладка — CSS-сеткой, а не таблицей: клетка это стек слотов переменной
// высоты, и выравнивать её по базовой линии строки таблицы не нужно. Липкими
// сделаны шапка и первая колонка, прокрутка — у контейнера: страница шире
// вьюпорта не становится ни при каком числе залов.
export function HallMatrix({ editor }: { editor: HallPlanEditor }) {
  const { tr } = useLanguage()

  // Сколько ячеек уйдёт вместе со строкой и вместе с залом — цена удаления
  // называется в подтверждении, и считать её в каждой шапке фильтром по всему
  // массиву незачем.
  const { byPosition, byHall } = useMemo(() => {
    const positionCounts = new Map<string, number>()
    const hallCounts = new Map<string, number>()
    for (const cell of editor.assignments) {
      positionCounts.set(cell.position_id, (positionCounts.get(cell.position_id) ?? 0) + 1)
      hallCounts.set(cell.hall_id, (hallCounts.get(cell.hall_id) ?? 0) + 1)
    }
    return { byPosition: positionCounts, byHall: hallCounts }
  }, [editor.assignments])

  // repeat(0, …) — недопустимое значение, и при плане без залов сетка сложилась
  // бы в ноль колонок вместо одной с заголовками строк.
  const columns = editor.halls.length > 0
    ? `var(--hall-head-w) repeat(${editor.halls.length}, minmax(180px, 1fr))`
    : 'var(--hall-head-w)'

  return (
    <>
      <div className="hall-matrix-scroll">
        <div className="hall-matrix-inner">
          <div className="hall-matrix" style={{ gridTemplateColumns: columns } as CSSProperties}>
            <div className="hall-matrix__corner">
              <span>{tr('Позиция', 'Lavozim')}</span>
              <small>{tr('строки — позиции, колонки — залы', 'qatorlar — lavozimlar, ustunlar — zallar')}</small>
            </div>

            {editor.halls.map((hall, index) => (
              <HallColumnHeader
                key={hall.id}
                hall={hall}
                index={index}
                cellCount={byHall.get(hall.id) ?? 0}
                editor={editor}
              />
            ))}

            {editor.positions.map((position) => (
              <Fragment key={position.id}>
                <PositionRowHeader
                  position={position}
                  cellCount={byPosition.get(position.id) ?? 0}
                  onRename={(name) => editor.renamePosition(position.id, name)}
                  onCycleRole={() => editor.cycleRole(position.id)}
                  onRemove={() => editor.removePosition(position.id)}
                />
                {editor.halls.map((hall) => (
                  <MatrixCell
                    key={hall.id}
                    hallId={hall.id}
                    positionId={position.id}
                    // Имена нужны клетке только для aria-label: «Назначить:
                    // Millumin, Зал 2» — на экране это пересечение видно
                    // глазами, скринридеру пересечения не видно.
                    positionName={position.name}
                    // Роль строки — ради кнопки «Наём»: слот ставят только в
                    // строке операторов (решение прораба с21).
                    positionRole={position.role}
                    hallName={hall.name}
                    // Цвет колонки — в саму клетку: тонировка держит колонку
                    // вместе на десятке залов, где шапка уже уехала за верх
                    // прокрутки (с21).
                    hallColor={hall.color}
                    cell={editor.cellMap.get(cellKeyOf({ hallId: hall.id, positionId: position.id }))}
                    editor={editor}
                  />
                ))}
              </Fragment>
            ))}
          </div>

          {/* «+ Зал» — колонка справа от матрицы, а не кнопка над ней: так видно,
              что новый зал встанет именно сюда. Живёт внутри прокручиваемого
              контейнера и уезжает вместе с последним залом. */}
          <button
            type="button"
            className="hall-add-column"
            disabled={editor.addingHall}
            onClick={() => { void editor.addHall() }}
          >
            <Plus size={18} />
            {editor.addingHall ? tr('Добавляем…', 'Qo‘shilmoqda…') : tr('Зал', 'Zal')}
          </button>
        </div>
      </div>

      {/* «+ Позиция» — под матрицей и ВНЕ прокрутки: строка добавляется в конец
          всегда, и уезжать вместе с горизонтальным скроллом ей незачем. */}
      <PositionAdd editor={editor} />
    </>
  )
}

// Добавление строк: ряд чипов справочника и поле свободного ввода.
//
// Enter создаёт строку и ОСТАВЛЯЕТ фокус в поле: позиции заводят пачкой
// («Millumin ⏎ Страховка ⏎»), и возврат мышью в поле после каждой строки убил бы
// весь смысл.
//
// Поле не блокируется на время запроса намеренно: disabled снял бы фокус, и
// пачка прервалась бы каждой вставкой. Вместо этого Enter во время полёта
// игнорируется — вставка внутренней сети занимает доли секунды, а набранное имя
// остаётся в поле до подтверждения базы, поэтому потеряться оно не может.
function PositionAdd({ editor }: { editor: HallPlanEditor }) {
  const { tr } = useLanguage()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isBusy = editor.addingPosition

  // Чипы показывают ВЕСЬ справочник, а не только то, чего в плане нет: одна
  // ячейка держит одного человека, поэтому трое операторов в зале — это три
  // строки «Операторы», и второй клик по чипу обязан добавлять ещё одну.
  // Счётчик рядом с именем говорит, сколько таких строк уже стоит.
  const suggestions = useMemo(() => {
    const used = new Map<string, number>()
    for (const position of editor.positions) {
      const key = position.name.trim().toLowerCase()
      used.set(key, (used.get(key) ?? 0) + 1)
    }
    return editor.catalog.map((entry) => ({ entry, count: used.get(entry.name.trim().toLowerCase()) ?? 0 }))
  }, [editor.catalog, editor.positions])

  async function submit() {
    const name = value.trim()
    // Пустой Enter — не команда, а привычка добивать строку: молча игнорируем.
    if (!name || isBusy) return
    if (await editor.addPosition(name)) setValue('')
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Ряда нет, когда предлагать нечего: пустой справочник или он не
          отдался (catalogState === 'failed') — поле ввода при этом работает как
          работало, чипы лишь ускоряют набор. */}
      {suggestions.length > 0 && (
        <div
          className="position-suggestions"
          role="group"
          aria-label={tr('Готовые позиции', 'Tayyor lavozimlar')}
        >
          {suggestions.map(({ entry, count }) => (
            <CatalogChip
              key={entry.id}
              entry={entry}
              count={count}
              isBusy={isBusy}
              onAdd={() => { void editor.addFromCatalog(entry) }}
              onRemove={() => editor.removeCatalogEntry(entry.id)}
            />
          ))}
        </div>
      )}

      <div className="hall-add-position">
        <Plus size={15} aria-hidden="true" />
        <input
          ref={inputRef}
          value={value}
          placeholder={isBusy ? tr('Добавляем…', 'Qo‘shilmoqda…') : tr('Добавить позицию: Millumin, Страховка…', 'Lavozim qo‘shish: Millumin, Zaxira…')}
          aria-label={tr('Добавить позицию', 'Lavozim qo‘shish')}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
              return
            }
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setValue('')
          }}
        />
      </div>
    </>
  )
}

// Чип готовой позиции: клик по имени добавляет строку, крестик убирает позицию
// из ОБЩЕГО справочника. Отдельным компонентом из-за взведённого удаления —
// useArmedAction хранит состояние ОДНОЙ кнопки, и общий на ряд хук взвёл бы
// крестик сразу у всех чипов.
//
// Удаление здесь дороже, чем выглядит: справочник общий на всех, и позиция
// исчезнет из чипов у каждого. Поэтому подтверждение не крестиком в другом
// состоянии, а словом «Удалить?» — красный крестик читается как «убрать из
// этого плана», а это не так: строки планов справочник не трогает.
function CatalogChip({ entry, count, isBusy, onAdd, onRemove }: {
  entry: PositionCatalogEntry
  count: number
  isBusy: boolean
  onAdd: () => void
  onRemove: () => void
}) {
  const { tr } = useLanguage()
  const armed = useArmedAction()

  return (
    <span className={`position-chip ${armed.armed ? 'is-armed' : ''}`}>
      <button
        type="button"
        className="position-chip__add"
        // Взведён крестик — имя не кликается: чип красный и спрашивает про
        // удаление, и добавить строку тем же кликом человек не ждёт.
        disabled={isBusy || armed.armed}
        onClick={onAdd}
        aria-label={count > 0
          ? tr(`Добавить ещё строку «${entry.name}», в плане уже ${count}`, `Yana «${entry.name}» qatori qo‘shilsin, rejada allaqachon ${count} ta`)
          : tr(`Добавить позицию «${entry.name}»`, `«${entry.name}» lavozimini qo‘shish`)}
        title={count > 0
          ? tr('Добавить ещё одну такую строку', 'Yana shunday qator qo‘shish')
          : tr('Добавить строку', 'Qator qo‘shish')}
      >
        <Plus size={12} aria-hidden="true" />
        <span className="position-chip__name">{entry.name}</span>
        {/* Счётчик, а не исчезновение чипа: строки с одним именем — законный
            сценарий («три оператора в зале» = три строки), и чип обязан
            остаться под рукой. */}
        {count > 0 && <span className="position-chip__count" aria-hidden="true">·{count}</span>}
      </button>
      <button
        type="button"
        className="position-chip__drop"
        onClick={() => armed.fire(onRemove)}
        onBlur={armed.disarm}
        aria-label={armed.armed
          ? tr(`Точно удалить «${entry.name}» из справочника?`, `«${entry.name}» ma’lumotnomadan aniq o‘chirilsinmi?`)
          : tr(`Удалить «${entry.name}» из справочника`, `«${entry.name}»ni ma’lumotnomadan o‘chirish`)}
        title={armed.armed
          ? tr('Позиция исчезнет из справочника у всех', 'Lavozim hammada ma’lumotnomadan yo‘qoladi')
          : tr('Удалить из справочника', 'Ma’lumotnomadan o‘chirish')}
      >
        {armed.armed ? tr('Удалить?', 'O‘chirilsinmi?') : <X size={12} aria-hidden="true" />}
      </button>
    </span>
  )
}
