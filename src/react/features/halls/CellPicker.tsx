import { UserPlus } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HallPlanEditor } from './useHallPlanEditor'
import { EmployeePicker } from '../../components/EmployeePicker'
import { employeeDisplayName, type EmployeeBrief } from '../employees/types'
import { useLanguage } from '../../lib/i18n'
import { computePopoverPosition } from '../../lib/popoverPosition'
import { usePopoverLayer } from '../../lib/usePopoverLayer'

// Пикер клетки — порталом в body с абсолютными координатами, а не в потоке
// ячейки: матрица прокручивается по горизонтали (overflow: auto), и панель
// выдачи, нарисованная внутри неё, обрезалась бы краем контейнера.
//
// Живёт отдельным файлом с с21 (Ш3): его открывает и клетка редактора, и клетка
// ТВ-витрины — два одинаковых пикера в двух файлах разъехались бы на первой же
// правке выдачи.
export function CellPicker({ anchor, exclude, editor, onPick, onHire, onClose }: {
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
    // Целью портала body быть перестал (с21, Ш3): ТВ-витрину открывают во весь
    // экран, а в полноэкранном режиме браузер рисует ТОЛЬКО поддерево
    // fullscreenElement — панель, оставшаяся в body, там просто не появилась бы.
    // Вне полноэкранного режима fullscreenElement равен null, и цель прежняя.
    document.fullscreenElement ?? document.body,
  )
}
