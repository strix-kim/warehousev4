import { m, useIsPresent, usePresenceData, type Transition, type Variants } from 'motion/react'
import type { ReactNode } from 'react'

// Числа — из раздела «Решения» макета с31: панель въезжает сдвигом 24 px за
// 200 мс и уходит за 160 мс, кривая (.2,.8,.2,1); затемнение — 160 мс.
const DRAWER_EASE: Transition['ease'] = [0.2, 0.8, 0.2, 1]
const ENTER: Transition = { duration: 0.2, ease: DRAWER_EASE }
const EXIT: Transition = { duration: 0.16, ease: DRAWER_EASE }
const INSTANT: Transition = { duration: 0 }

// Уход — функцией от custom: снятый слой не получает новых пропсов, поэтому
// «уйти мгновенно» ему передаёт AnimatePresence вызывающего (custom={true}).
// Нужно при смене одного дровера другим (модель ↔ карточка): новый встаёт
// сразу (instant), и старый, уезжая 160 мс, удвоил бы затемнение.
export type DrawerExitCustom = boolean | undefined

const scrimVariants: Variants = {
  hidden: { opacity: 0 },
  shown: { opacity: 1, transition: { duration: 0.16 } },
  exit: (instantExit: DrawerExitCustom) => ({ opacity: 0, transition: instantExit ? INSTANT : { duration: 0.16 } }),
}

const panelVariants: Variants = {
  hidden: { x: 24, opacity: 0 },
  shown: { x: 0, opacity: 1, transition: ENTER },
  exit: (instantExit: DrawerExitCustom) => ({ x: 24, opacity: 0, transition: instantExit ? INSTANT : EXIT }),
}

/**
 * Боковой слой дровера на десктопе: затемнение и панель справа. Уход играет,
 * только если вызывающий держит дровер в AnimatePresence (у ребёнка — key);
 * без неё слой просто исчезает, как раньше. Esc, блокировку прокрутки и
 * возврат фокуса держит вызывающий (useModalLayer) — пока слой уезжает, они
 * ещё живы, и это нормально: 160 мс.
 */
export function DrawerLayer({ ariaLabel, instant = false, onRequestClose, className, children }: {
  ariaLabel: string
  // true — слой уже был открыт (модель ↔ карточка): появление не анимируем.
  instant?: boolean
  onRequestClose: () => void
  // Классы панели целиком: 'drawer reservation-drawer', 'drawer drawer--split'.
  className: string
  children: ReactNode
}) {
  // Пока слой уезжает, он ещё в DOM и накрывает экран: без этого первое
  // нажатие после закрытия тонуло бы в уходящем затемнении.
  const isPresent = useIsPresent()
  // Мгновенный уход прячем прямо в рендере снятия: переход duration 0 motion
  // применяет только на следующем кадре, и на 1–2 кадра затемнений было два.
  const presenceData = usePresenceData() as DrawerExitCustom
  const instantExit = !isPresent && presenceData === true

  return (
    <div
      className="drawer-layer"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={isPresent ? undefined : { pointerEvents: 'none', visibility: instantExit ? 'hidden' : undefined }}
      onMouseDown={(event) => {
        // Без preventDefault нажатие на подложку увело бы фокус в body уже ПОСЛЕ
        // того, как плашка несохранённого его забрала, — и Enter перестал бы
        // значить «продолжить».
        event.preventDefault()
        onRequestClose()
      }}
    >
      <m.div className="drawer-layer__scrim" variants={scrimVariants} initial={instant ? false : 'hidden'} animate="shown" exit="exit" />
      <m.aside className={className} variants={panelVariants} initial={instant ? false : 'hidden'} animate="shown" exit="exit" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </m.aside>
    </div>
  )
}
