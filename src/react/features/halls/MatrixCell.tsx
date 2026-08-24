import { Link2, Plus, UserPlus, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { cellKeyOf, hallPersonKeyOf, type HallPlanEditor } from './useHallPlanEditor'
import type { AssignmentWithEmployee } from './types'
import { EmployeePicker } from '../../components/EmployeePicker'
import { employeeDisplayName, employeeFullName, type EmployeeBrief } from '../employees/types'
import { useLanguage } from '../../lib/i18n'
import { computePopoverPosition } from '../../lib/popoverPosition'
import { useArmedAction } from '../../lib/useArmedAction'
import { usePopoverLayer } from '../../lib/usePopoverLayer'

// Клетка матрицы: РОВНО ОДИН человек на пересечении строки и зала или никто
// (миграция 20260824140000). Трое операторов в зале — это три строки матрицы,
// как три подстроки в бумажном образце, а не стопка чипов в одной клетке:
// иначе «сколько людей на позиции» имело бы два способа записи.
//
// Пустая клетка И ЕСТЬ вакансия: отдельной записи «место без человека» больше
// нет, и прочерк рисуется отсутствием ячейки, а не её содержимым. Третье
// состояние — слот «Наём» (с21): решение «берём внешнего оператора» принято,
// имени ещё нет. Это НЕ пустая клетка: место занято и в счёт найма идёт.
export function MatrixCell({ hallId, positionId, positionName, positionRole, hallName, hallColor, cell, editor }: {
  hallId: string
  positionId: string
  positionName: string
  // Роль СТРОКИ, а не ячейки: кнопка «Наём» появляется только у операторов
  // (решение прораба с21). База этого не проверяет — правило живёт здесь.
  positionRole: string
  hallName: string
  hallColor: string
  cell: AssignmentWithEmployee | undefined
  editor: HallPlanEditor
}) {
  const { tr } = useLanguage()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const armed = useArmedAction()
  const isBusy = editor.addingCell === cellKeyOf({ hallId, positionId })

  // Слот узнаём по отсутствию человека, а не по is_external: равенство держит
  // CHECK базы, а TS сужает тип именно по null — в ветке человека ниже
  // employee_id после такой проверки перестаёт быть nullable.
  const isSlot = Boolean(cell) && cell?.employee_id === null

  // Человек этой клетки убран из выдачи замены: выбрать того же — это ничего
  // не менять, а лишняя строка в списке только мешает искать нового. У слота
  // исключать некого.
  const excluded = useMemo(() => new Set(cell?.employee_id ? [cell.employee_id] : []), [cell])

  // Цвет зала уезжает в клетку той же переменной, что и в шапку колонки:
  // тонировку считает CSS, здесь только подстановка (с21, см. halls.css).
  const tint = { '--hall-color': hallColor } as CSSProperties

  // Связка «этот же человек на других позициях ЭТОГО зала» — объединённая
  // ячейка бумажного образца. Раскладку считает редактор один раз на весь
  // план; здесь остаётся выкинуть саму эту позицию.
  const linkedTo = useMemo(() => {
    if (!cell?.employee_id) return []
    const inHall = editor.linkedInHall.get(hallPersonKeyOf(hallId, cell.employee_id)) ?? []
    return inHall.filter((item) => item.positionId !== positionId).map((item) => item.name)
  }, [cell, editor.linkedInHall, hallId, positionId])

  function pick(employee: EmployeeBrief) {
    setAnchor(null)
    void editor.assign({ hallId, positionId }, employee)
  }

  // Кнопка наёма нужна только там, где слот вообще уместен: строка операторов
  // и клетка, в которой слота ещё нет. Обычная и пустая клетки её показывают,
  // сам слот — нет: ставить слот поверх слота нечем.
  const hire = positionRole === 'operator' && !isSlot
    ? () => { setAnchor(null); void editor.assignSlot({ hallId, positionId }) }
    : undefined

  function togglePicker(event: { currentTarget: HTMLElement }) {
    const target = event.currentTarget
    setAnchor((current) => current === target ? null : target)
  }

  if (!cell) {
    return (
      <div className="hall-matrix__cell" style={tint}>
        {/* Вся пустая клетка — одна кнопка: попадать в маленький «+» посреди
            таблицы на двенадцать залов человек будет дольше, чем расставлять. */}
        <button
          type="button"
          className="hall-matrix__empty"
          disabled={Boolean(editor.addingCell) && !isBusy}
          onClick={togglePicker}
          aria-label={tr(`Назначить: ${positionName}, ${hallName}`, `Tayinlash: ${positionName}, ${hallName}`)}
        >
          {isBusy
            ? <span className="hall-matrix__empty-busy">{tr('Добавляем…', 'Qo‘shilmoqda…')}</span>
            : (
              <>
                <span className="hall-matrix__dash" aria-hidden="true">—</span>
                <span className="hall-matrix__empty-hint" aria-hidden="true"><Plus size={13} /></span>
              </>
            )}
        </button>
        {anchor && <CellPicker anchor={anchor} exclude={excluded} editor={editor} onPick={pick} onHire={hire} onClose={() => setAnchor(null)} />}
      </div>
    )
  }

  if (cell.employee_id === null) {
    return (
      <div className={`hall-matrix__cell ${armed.armed ? 'is-armed' : ''}`} style={tint}>
        {/* Чип с пунктиром, а не имя: слот обязан читаться иначе, чем человек, —
            иначе «Наём» в клетке принимают за фамилию. Клик открывает тот же
            пикер: поставить человека вместо слота — обычный ход планирования.
            ×N и скрепки у слота нет: считать нечего и связывать некого. */}
        <button
          type="button"
          className="hall-matrix__slot"
          disabled={Boolean(editor.addingCell) && !isBusy}
          onClick={togglePicker}
          aria-label={tr(`Наём: ${positionName}, ${hallName}`, `Yollash: ${positionName}, ${hallName}`)}
          title={tr('Внешний оператор, имя пока неизвестно', 'Tashqi operator, ismi hozircha noma’lum')}
        >
          <UserPlus size={13} aria-hidden="true" />
          <span className="hall-matrix__slot-name">
            {isBusy ? tr('Меняем…', 'O‘zgartirilmoqda…') : tr('Наём', 'Yollash')}
          </span>
        </button>

        <button
          type="button"
          className="hall-matrix__clear"
          onClick={() => armed.fire(() => editor.clearCell(cell.id))}
          onBlur={armed.disarm}
          aria-label={armed.armed ? tr('Точно снять?', 'Aniq olib tashlansinmi?') : tr('Убрать слот наёма', 'Yollash slotini olib tashlash')}
          title={armed.armed ? tr('Точно снять?', 'Aniq olib tashlansinmi?') : tr('Убрать слот наёма', 'Yollash slotini olib tashlash')}
        >
          <X size={12} />
        </button>

        {anchor && <CellPicker anchor={anchor} exclude={excluded} editor={editor} onPick={pick} onHire={hire} onClose={() => setAnchor(null)} />}
      </div>
    )
  }

  const person = cell.employees
  // В клетке — «Имя Фамилия» (с21): на расстановку смотрят глазами, и своих
  // узнают по имени. Полное ФИО с отчеством осталось в title и в aria-label —
  // подробность по ховеру, а не в самой сетке.
  const displayName = person ? employeeDisplayName(person) : tr('Сотрудник скрыт', 'Xodim yashirin')
  const fullName = person ? employeeFullName(person) : displayName
  const planCount = editor.planCountByEmployee.get(cell.employee_id) ?? 1
  const linkHint = tr(`В этом зале также: ${linkedTo.join(', ')}`, `Bu zalda yana: ${linkedTo.join(', ')}`)

  return (
    <div className={`hall-matrix__cell ${linkedTo.length > 0 ? 'is-linked' : ''} ${armed.armed ? 'is-armed' : ''}`} style={tint}>
      {/* Имя занимает всю клетку и само же открывает замену: отдельной кнопки
          «заменить» нет — клик по человеку в расстановке всегда означает
          «поставить сюда другого». */}
      <button
        type="button"
        className="hall-matrix__person"
        disabled={Boolean(editor.addingCell) && !isBusy}
        onClick={togglePicker}
        aria-label={tr(`Заменить ${fullName}`, `${fullName} o‘rniga boshqa`)}
        title={linkedTo.length > 0 ? linkHint : fullName}
      >
        {linkedTo.length > 0 && (
          // Скрепка — та самая объединённая ячейка: человек ведёт в этом зале
          // не одну позицию. Подсказка называет, какие именно.
          <span className="hall-matrix__link" role="img" aria-label={linkHint}>
            <Link2 size={12} aria-hidden="true" />
          </span>
        )}
        <span className="hall-matrix__person-name">{isBusy ? tr('Меняем…', 'O‘zgartirilmoqda…') : displayName}</span>
        {planCount > 1 && (
          // ×N — по ВСЕМУ плану, в отличие от скрепки: страховка на четыре зала
          // это одна фамилия в четырёх клетках разных залов.
          <span className="hall-matrix__badge" title={tr(`В плане ${planCount} раз`, `Rejada ${planCount} marta`)}>×{planCount}</span>
        )}
      </button>

      <button
        type="button"
        className="hall-matrix__clear"
        onClick={() => armed.fire(() => editor.clearCell(cell.id))}
        onBlur={armed.disarm}
        aria-label={armed.armed ? tr('Точно снять?', 'Aniq olib tashlansinmi?') : tr('Снять сотрудника', 'Xodimni olib tashlash')}
        title={armed.armed ? tr('Точно снять?', 'Aniq olib tashlansinmi?') : tr('Снять сотрудника', 'Xodimni olib tashlash')}
      >
        <X size={12} />
      </button>

      {anchor && <CellPicker anchor={anchor} exclude={excluded} editor={editor} onPick={pick} onHire={hire} onClose={() => setAnchor(null)} />}
    </div>
  )
}

// Пикер клетки — порталом в body с абсолютными координатами, а не в потоке
// ячейки: матрица прокручивается по горизонтали (overflow: auto), и панель
// выдачи, нарисованная внутри неё, обрезалась бы краем контейнера.
function CellPicker({ anchor, exclude, editor, onPick, onHire, onClose }: {
  anchor: HTMLElement
  exclude: ReadonlySet<string>
  editor: HallPlanEditor
  onPick: (employee: EmployeeBrief) => void
  // undefined — слот здесь неуместен (не строка операторов либо слот уже стоит).
  onHire: (() => void) | undefined
  onClose: () => void
}) {
  const { tr } = useLanguage()
  const popoverRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(anchor)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 260 })

  anchorRef.current = anchor

  // Свободные наверх, занятые под ними (с21): ставят обычно того, кто ещё нигде
  // не стоит, и листать до него через полсотни занятых незачем. Внутри групп —
  // порядок API (фамилия), своя копия массива: editor.candidates принадлежит
  // редактору, и сортировать его на месте нельзя.
  const ordered = useMemo(() => {
    const free: EmployeeBrief[] = []
    const busy: EmployeeBrief[] = []
    for (const candidate of editor.candidates) {
      (editor.planCountByEmployee.has(candidate.id) ? busy : free).push(candidate)
    }
    return [...free, ...busy]
  }, [editor.candidates, editor.planCountByEmployee])

  useLayoutEffect(() => {
    // Восьми строк хватает, чтобы оценка высоты упёрлась в потолок расчёта:
    // выдача пикера всё равно длиннее экрана и прокручивается своей панелью.
    setPosition(computePopoverPosition(anchor.getBoundingClientRect(), 8, 260))
  }, [anchor])

  usePopoverLayer(true, onClose, [popoverRef, anchorRef])

  return createPortal(
    <div
      ref={popoverRef}
      className="hall-cell-picker"
      style={{ top: position.top, left: position.left, width: position.width }}
    >
      {/* «Наём» стоит НАД поиском, а не строкой в выдаче: выдача — это список
          людей, и внешний оператор, притворяющийся сотрудником, читался бы как
          ещё одна фамилия. Панель выдачи раскрывается ниже поля (absolute), так
          что кнопку она не перекрывает. */}
      {onHire && (
        <button type="button" className="button button--secondary button--wide hall-cell-picker__hire" onClick={onHire}>
          <UserPlus size={15} /> {tr('Наём — внешний оператор', 'Yollash — tashqi operator')}
        </button>
      )}

      <EmployeePicker
        autoFocus
        candidates={ordered}
        candidatesState={editor.candidatesState}
        onLoad={editor.loadCandidates}
        exclude={exclude}
        onPick={onPick}
        label={tr('Кого поставить', 'Kimni qo‘yish')}
        // Занятость в других клетках НЕ блокирует выбор: один человек на
        // нескольких залах — норма (страховка), вторая строка лишь называет,
        // где он уже стоит, чтобы это решалось до клика, а не по бейджу ×N
        // после него.
        renderOption={(employee) => {
          const planCount = editor.planCountByEmployee.get(employee.id) ?? 0
          const hallNames = editor.hallNamesByEmployee.get(employee.id) ?? []
          return (
            <>
              <span>{employeeDisplayName(employee)}</span>
              <small>
                {planCount > 0
                  // «×3 · Зал 1, Зал 3» — числом и залами, без слов: перевода
                  // здесь нет, потому что и переводить нечего. При одной клетке
                  // «×1» не пишем — множитель без множества только шумит.
                  ? `${planCount > 1 ? `×${planCount} · ` : ''}${hallNames.join(', ')}`
                  : employee.position
                    ? tr(`Свободен · ${employee.position}`, `Bo‘sh · ${employee.position}`)
                    : tr('Свободен', 'Bo‘sh')}
              </small>
            </>
          )
        }}
      />
    </div>,
    document.body,
  )
}
