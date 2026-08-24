import { CircleAlert, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { employeeFullName, type EmployeeBrief } from '../features/employees/types'
import { useLanguage } from '../lib/i18n'

// Поиск сотрудника с выпадающей выдачей: общее поле для мест, где человека
// назначают на запись (водители машины, ответственные зала). Данные компонент не
// грузит сам — список и его состояние приходят от страницы, которая владеет
// источником и своим отчётом об отказе; здесь только выдача и выбор.
export function EmployeePicker({ candidates, candidatesState, onLoad, exclude, onPick, label, placeholder, disabled, autoFocus, renderOption }: {
  candidates: EmployeeBrief[]
  candidatesState: 'idle' | 'loading' | 'ready' | 'failed'
  onLoad: () => void
  exclude: ReadonlySet<string>
  onPick: (employee: EmployeeBrief) => void
  label: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  renderOption?: (employee: EmployeeBrief) => ReactNode
}) {
  const { tr } = useLanguage()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  function openPicker() {
    setIsOpen(true)
    if (candidatesState === 'idle') onLoad()
  }

  // Уже выбранные из выдачи убраны: их место — в чипах над полем.
  const options = useMemo(() => {
    const lowered = query.trim().toLowerCase()
    return candidates.filter((candidate) => !exclude.has(candidate.id)
      && (!lowered || employeeFullName(candidate).toLowerCase().includes(lowered)))
  }, [candidates, exclude, query])

  function pick(employee: EmployeeBrief) {
    onPick(employee)
    setQuery('')
  }

  return (
    /* Выдача стоит в потоке под инпутом (position: absolute к обёртке), а не
       в портале: форма не лежит в дровере, и фиксированные координаты
       пришлось бы пересчитывать на каждой прокрутке. Закрытие — по уходу
       фокуса из обёртки; mousedown внутри панели гасится, иначе Safari
       снимал бы фокус ДО клика и выбор не доезжал. */
    <div className="employee-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false) }}>
      <label className="field">
        <span>{label}</span>
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); openPicker() }}
          onFocus={openPicker}
          onKeyDown={(event) => { if (event.key === 'Escape') setIsOpen(false) }}
          placeholder={placeholder ?? tr('Найти сотрудника…', 'Xodimni topish…')}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={tr('Найти сотрудника', 'Xodimni topish')}
        />
      </label>

      {isOpen && (
        <div className="employee-picker__panel" onMouseDown={(event) => event.preventDefault()}>
          {candidatesState === 'failed'
            ? (
              // Обёрткой, а не двумя детьми: прямые кнопки панели — это
              // строки выдачи, и «Повторить» получила бы их вид.
              <div>
                <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить сотрудников.', 'Xodimlarni yuklab bo‘lmadi.')}</p>
                <button type="button" className="button button--secondary button--wide" onClick={onLoad}>{tr('Повторить', 'Qayta urinish')}</button>
              </div>
            )
            : candidatesState !== 'ready'
              ? <p className="muted">{tr('Загружаем сотрудников…', 'Xodimlar yuklanmoqda…')}</p>
              : options.length === 0
                ? <p className="muted">{tr('Никого не нашли.', 'Hech kim topilmadi.')}</p>
                : options.map((candidate) => (
                  <button type="button" key={candidate.id} onClick={() => pick(candidate)}>
                    {renderOption
                      ? renderOption(candidate)
                      : (
                        <>
                          <span>{employeeFullName(candidate)}</span>
                          <small>{candidate.position || tr('Должность не указана', 'Lavozim ko‘rsatilmagan')}</small>
                        </>
                      )}
                  </button>
                ))}
          <p className="employee-picker__footer">
            <UserPlus size={14} />
            {/* Новая вкладка — чтобы черновик записи не потерялся: человек
                заводит сотрудника рядом и возвращается к заполненной форме. */}
            <Link to="/employees/new" target="_blank" rel="noreferrer">{tr('Не нашли? Сначала заведите сотрудника', 'Topilmadimi? Avval xodimni kiriting')}</Link>
          </p>
        </div>
      )}
    </div>
  )
}
