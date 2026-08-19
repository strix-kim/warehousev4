import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const uzbekWeekdays = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya']

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate()
}

function formatSelectedDate(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return `${date.getDate()}-${uzbekMonths[date.getMonth()]} ${date.getFullYear()}-yil`
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

function formatMonth(date: Date, locale: string) {
  if (locale.toLowerCase().startsWith('uz')) return `${uzbekMonths[date.getMonth()]} ${date.getFullYear()}`
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

export function AppDatePicker({
  value,
  onChange,
  locale,
  placeholder,
  ariaLabel,
  todayLabel,
  clearLabel,
  previousMonthLabel,
  nextMonthLabel,
}: {
  value: string
  onChange: (value: string) => void
  locale: string
  placeholder: string
  ariaLabel: string
  todayLabel: string
  clearLabel: string
  previousMonthLabel: string
  nextMonthLabel: string
}) {
  const selectedDate = useMemo(() => parseDate(value), [value])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = selectedDate ?? new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const [position, setPosition] = useState({ top: 0, left: 0, width: 320 })

  useEffect(() => {
    if (selectedDate) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [selectedDate])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const estimatedHeight = 390
    const below = rect.bottom + 8
    const top = below + estimatedHeight <= window.innerHeight ? below : Math.max(12, rect.top - estimatedHeight - 8)
    setPosition({ top, left, width })
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const closeOnViewportChange = () => setOpen(false)
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange)
    }
  }, [open])

  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1)
  const today = new Date()
  const weekdays = locale.toLowerCase().startsWith('uz')
    ? uzbekWeekdays
    : Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' })
      .format(new Date(2024, 0, 1 + index)).replace('.', ''))
  const formattedValue = selectedDate
    ? formatSelectedDate(selectedDate, locale)
    : placeholder

  const chooseDate = (date: Date) => {
    onChange(toDateValue(date))
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={`app-date-picker__trigger ${value ? 'has-value' : ''}`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{formattedValue}</span>
        <CalendarDays size={18} />
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="app-date-picker__popover"
          role="dialog"
          aria-modal="false"
          aria-label={ariaLabel}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="app-date-picker__header">
            <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))} aria-label={previousMonthLabel}><ChevronLeft size={18} /></button>
            <strong>{formatMonth(visibleMonth, locale)}</strong>
            <button type="button" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))} aria-label={nextMonthLabel}><ChevronRight size={18} /></button>
          </div>
          <div className="app-date-picker__weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="app-date-picker__days">
            {days.map((day, index) => day === null ? <span key={`blank-${index}`} /> : (() => {
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day)
              const isSelected = selectedDate ? sameDay(date, selectedDate) : false
              const isToday = sameDay(date, today)
              return <button className={`${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`} type="button" onClick={() => chooseDate(date)} aria-pressed={isSelected} key={day}>{day}{isSelected && <Check size={11} />}</button>
            })())}
          </div>
          <div className="app-date-picker__footer">
            <button type="button" onClick={() => chooseDate(today)}>{todayLabel}</button>
            <button type="button" onClick={() => { onChange(''); setOpen(false); triggerRef.current?.focus() }} disabled={!value}>{clearLabel}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
