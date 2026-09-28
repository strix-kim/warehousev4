import type { ReactNode } from 'react'
import { ArgoDots } from './ArgoDots'

type Props = {
  title: string
  text?: string
  // art — «здесь пока ничего нет»: силуэт ARGO. icon — «ничего не найдено» и
  // «карточки нет»: иконка по смыслу. Одно из двух, рамка у всех одна.
  art?: boolean
  icon?: ReactNode
  // Действие — вторичная кнопка: основная у раздела уже стоит в шапке страницы,
  // вторая красная рядом спорила бы с ней за внимание.
  action?: ReactNode
  // Высокая версия для раздела, где пустота — весь экран (реестр без единой
  // записи). Высота держит место под будущий контент, чтобы первая запись не
  // дёргала раскладку.
  roomy?: boolean
}

export function EmptyState({ title, text, art = false, icon, action, roomy = false }: Props) {
  return (
    <div className={`empty-state gridfield ${roomy ? 'empty-state--roomy' : ''}`}>
      <div>
        {art ? <ArgoDots className="empty-state__art" /> : icon && <span className="empty-state__icon" aria-hidden="true">{icon}</span>}
        <h3 className="empty-state__title">{title}</h3>
        {text && <p className="empty-state__text">{text}</p>}
        {action && <div className="empty-state__action">{action}</div>}
      </div>
    </div>
  )
}
