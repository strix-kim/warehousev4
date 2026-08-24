import { useRef, useState } from 'react'

// Правка имени прямо в строке: span превращается в input по клику. Отдельного
// диалога у имени зала и позиции нет намеренно — их правят по одному слову,
// и дровер на каждое слово был бы дороже самой правки.
//
// Живёт в features/halls, а не в components: потребитель пока один. Появится
// второй — переедет чистым переносом, а до тех пор общего компонента,
// подогнанного под один экран, в проекте не заводим.
export function InlineText({ value, onSave, ariaLabel, className = '' }: {
  value: string
  onSave: (next: string) => void
  ariaLabel: string
  className?: string
}) {
  const [draft, setDraft] = useState(value)
  const [isEditing, setEditing] = useState(false)
  // Escape снимает input с экрана, и браузер тут же шлёт blur — без этого флага
  // отмена сохраняла бы ровно то, что отменили.
  const skipBlurRef = useRef(false)

  function start() {
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const next = draft.trim()
    // Пустое имя не отправляем: его всё равно отобьёт CHECK базы
    // (btrim(name) <> ''), но отказ ради заведомо мёртвого запроса — не UX.
    // Возвращается прежнее значение, как при Escape.
    if (!next || next === value) return
    onSave(next)
  }

  if (!isEditing) {
    return (
      <button type="button" className={`inline-text ${className}`} onClick={start} title={value}>
        {value}
      </button>
    )
  }

  return (
    <input
      autoFocus
      className={`inline-text inline-text--editing ${className}`}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={() => {
        if (skipBlurRef.current) {
          skipBlurRef.current = false
          return
        }
        commit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          return
        }
        if (event.key !== 'Escape') return
        // Гасим всплытие: выше по дереву Escape ловят слои поповера и дровера,
        // и отмена правки имени не должна заодно закрывать окно.
        event.stopPropagation()
        skipBlurRef.current = true
        setEditing(false)
      }}
    />
  )
}
