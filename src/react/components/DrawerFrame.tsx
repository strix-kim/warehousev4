import { Children, useSyncExternalStore, type ReactNode, type Ref } from 'react'
import { BottomSheet } from './BottomSheet'
import { DrawerLayer } from './DrawerLayer'
import { MOBILE_MEDIA_QUERY } from '../lib/breakpoints'

function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(MOBILE_MEDIA_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isMobileNow() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

/**
 * Рама дроверов-карточек (макет с31; с35 — оборудование, с37 — общая): шапка —
 * фото, название, крестик; тело прокручивается само; подвал с действиями
 * прибит к низу. На десктопе рама — боковой дровер, на телефоне (≤820, та же
 * граница, что у карточек каталога) — нижний лист с хватом.
 *
 * Состояние дровера живёт в вызывающем, а не здесь: смена раскладки на лету
 * (поворот планшета через 820) пересобирает только DOM рамы, черновик правки
 * и открытые формы остаются. Esc, блокировку прокрутки и защиту несохранённого
 * держит вызывающий (useModalLayer + useGuardedClose) — в обоих вариантах
 * закрытие идёт через один и тот же onRequestClose.
 *
 * Уход (слой и лист) играет, когда вызывающий держит раму в AnimatePresence;
 * смена одного дровера другим — AnimatePresence custom={true}, старый уходит
 * мгновенно (DrawerExitCustom в DrawerLayer).
 *
 * Тело без содержимого не рисуется вовсе: пустой прокручиваемый блок держал бы
 * между шапкой и подвалом дыру (профиль машины без фото и файлов).
 */
export function DrawerFrame({ ariaLabel, instant, onRequestClose, head, foot, bodyRef, className, children }: {
  ariaLabel: string
  // true — слой уже был открыт (модель ↔ карточка): появление не анимируем.
  instant: boolean
  onRequestClose: () => void
  head: ReactNode
  foot?: ReactNode
  // Тело — единственный скролл рамы: прокрутка к сообщению идёт по нему.
  bodyRef?: Ref<HTMLDivElement>
  // Суффикс модификатора рамы: 'profile' даёт drawer--profile (ширина 500) на
  // десктопе и sheet--profile на листе. Стили модификатора — у вызывающего.
  className?: string
  children: ReactNode
}) {
  const isMobile = useSyncExternalStore(subscribeMobile, isMobileNow)
  const content = (
    <>
      <div className="drawer__head">{head}</div>
      {Children.toArray(children).length > 0 && <div className="drawer__body" ref={bodyRef}>{children}</div>}
      {foot && <div className="drawer__foot">{foot}</div>}
    </>
  )

  if (isMobile) {
    return (
      <BottomSheet ariaLabel={ariaLabel} onClose={onRequestClose} className={`sheet--drawer${className ? ` sheet--${className}` : ''}`} instant={instant}>
        {content}
      </BottomSheet>
    )
  }

  return (
    <DrawerLayer ariaLabel={ariaLabel} instant={instant} onRequestClose={onRequestClose} className={`drawer drawer--split${className ? ` drawer--${className}` : ''}`}>
      {content}
    </DrawerLayer>
  )
}
