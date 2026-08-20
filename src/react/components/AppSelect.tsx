import { Check, ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePopoverLayer } from '../lib/usePopoverLayer'

export type AppSelectOption<T extends string> = {
  value: T
  label: string
}

export function AppSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  className = '',
}: {
  value: T
  options: AppSelectOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  icon?: ReactNode
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 })
  const selected = options.find((option) => option.value === value) ?? options[0]

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.max(rect.width, 220)
    const left = Math.min(rect.left, window.innerWidth - width - 12)
    const estimatedHeight = Math.min(options.length * 42 + 12, 330)
    const below = rect.bottom + 7
    const top = below + estimatedHeight <= window.innerHeight ? below : Math.max(12, rect.top - estimatedHeight - 7)
    setPosition({ top, left: Math.max(12, left), width })
  }, [open, options.length])

  usePopoverLayer(open, () => setOpen(false), [rootRef, popoverRef])

  return (
    <div className={`app-select ${className}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className="app-select__trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {icon && <span className="app-select__icon">{icon}</span>}
        <span>{selected?.label}</span>
        <ChevronDown className={open ? 'is-open' : ''} size={16} />
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="app-select__popover"
          role="listbox"
          aria-label={ariaLabel}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'is-selected' : ''}
              onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus() }}
              key={option.value}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
