import { ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { computePopoverPosition } from '../lib/popoverPosition'
import { usePopoverLayer } from '../lib/usePopoverLayer'

export type ActionMenuItem = {
  id: string
  label: string
  icon?: ReactNode
  // Подсказка пункта: одной строкой объясняет, чем этот вариант отличается от
  // соседнего. На карточке это единственное место, где видно разницу между
  // рабочим документом и бланком на согласование.
  hint?: string
  disabled?: boolean
  onSelect: () => void
}

/**
 * Меню ДЕЙСТВИЙ рядом с кнопкой. Не AppSelect: тот выбирает значение и помечает
 * выбранное галочкой, а здесь выбранного не существует — каждый пункт что-то
 * делает и меню закрывается. Отсюда и роль menu/menuitem вместо listbox/option.
 */
export function ActionMenu({
  label,
  ariaLabel,
  icon,
  items,
  disabled = false,
  className = '',
}: {
  label: string
  ariaLabel: string
  icon?: ReactNode
  items: ActionMenuItem[]
  disabled?: boolean
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 220 })

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    setPosition(computePopoverPosition(triggerRef.current.getBoundingClientRect(), items.length))
  }, [open, items.length])

  usePopoverLayer(open, () => setOpen(false), [rootRef, popoverRef])

  return (
    <div className={`action-menu ${className}`} ref={rootRef}>
      <button
        ref={triggerRef}
        className="button button--secondary action-menu__trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className={open ? 'is-open' : ''} size={15} />
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="app-select__popover action-menu__popover"
          role="menu"
          aria-label={ariaLabel}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          {items.map((item) => (
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              // Фокус возвращается на кнопку: пункт исчезает вместе с меню, и
              // без возврата фокус ушёл бы в body, а Tab начал бы обход с начала
              // страницы.
              onClick={() => { item.onSelect(); setOpen(false); triggerRef.current?.focus() }}
              key={item.id}
            >
              {item.icon}
              <span className="action-menu__label">
                {item.label}
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
