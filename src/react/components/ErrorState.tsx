import { CircleAlert, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLanguage } from '../lib/i18n'

type Props = {
  title: string
  text: string
  action?: ReactNode
  // Без обёртки на 260 px: карточка встаёт в поток как есть. Нужна там, где
  // ошибка — полоса над рабочим экраном, а не замена пустой панели.
  inline?: boolean
  className?: string
  children?: ReactNode
}

// Ошибка загрузки — «.err» макета с31 (§g «Состояния»). Хуков здесь нет
// намеренно: компонент рисует и корневая граница ошибок, а она стоит ВЫШЕ
// LanguageProvider, и useLanguage бросил бы прямо внутри того, что ловит ошибки.
// Поэтому тексты и кнопка приходят готовыми, а «Повторить» — отдельно, RetryButton.
export function ErrorState({ title, text, action, inline = false, className, children }: Props) {
  const card = (
    <div className={`error-card ${className ?? ''}`} role="alert">
      <span className="error-card__icon" aria-hidden="true"><CircleAlert size={18} /></span>
      <div>
        <h3 className="error-card__title">{title}</h3>
        <p className="error-card__text">{text}</p>
        {action && <div className="error-card__actions">{action}</div>}
        {children}
      </div>
    </div>
  )
  // Обёртка держит прежнюю высоту блока состояния: ошибка встаёт на место
  // таблицы или сетки карточек и не должна схлопывать панель до одной строки.
  return inline ? card : <div className="error-state">{card}</div>
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  const { tr } = useLanguage()
  return (
    <button className="button button--secondary" type="button" onClick={onClick}>
      <RotateCw size={16} /> {tr('Повторить', 'Qayta urinish')}
    </button>
  )
}
