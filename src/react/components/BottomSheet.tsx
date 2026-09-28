import { m, useDragControls, useIsPresent, type Transition } from 'motion/react'
import { useRef, type ReactNode } from 'react'

// Числа — из раздела «Решения» макета с31: лист выезжает пружиной bounce .18 / .4 с,
// уходит за 200 мс ускорением. Порог свайпа — тоже макетный: 90 px или быстрый
// рывок (0,6 px/мс).
const SHEET_ENTER: Transition = { type: 'spring', bounce: 0.18, duration: 0.4 }
const SHEET_EXIT: Transition = { duration: 0.2, ease: [0.4, 0, 1, 1] }
const SHEET_CLOSE_OFFSET = 90
const SHEET_CLOSE_VELOCITY = 600

type BottomSheetProps = {
  onClose: () => void
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  // Модификатор листа: дроверы оборудования (с35) — лист с шапкой, прокручиваемым
  // телом и подвалом, а не короткое меню. Без него лист «Ещё» остаётся как был.
  className?: string
  // true — слой уже был открыт (модель ↔ карточка): въезд не играем, это смена
  // содержимого, а не появление листа. Тот же смысл, что у drawer-layer--instant.
  instant?: boolean
  children: ReactNode
}

// Нижний лист телефона: подложка, пружина на входе, свайп вниз за хват.
// Уход анимируется, только если вызывающий держит лист в AnimatePresence
// (лист «Ещё» в App.tsx); без неё лист просто исчезает. Esc и блокировку
// прокрутки лист не берёт на себя — это useModalLayer вызывающего.
export function BottomSheet({ onClose, role = 'dialog', ariaLabel, ariaLabelledBy, className, instant = false, children }: BottomSheetProps) {
  // Тянуть лист можно только за хват: вся площадь листа — это ссылки и кнопки,
  // и перетаскивание с любой точки съедало бы их нажатия.
  const dragControls = useDragControls()
  // Отпущенный после протяжки хват всё равно получает click (палец поднят над
  // ним же — лист ехал вместе с пальцем). Без отметки протяжка вниз на 30 px с
  // возвратом закрывала бы лист «кликом».
  const draggedRef = useRef(false)
  // Пока лист уезжает, слой ещё в DOM и накрывает экран: без этого первое
  // нажатие после закрытия тонуло бы в уходящей подложке.
  const isPresent = useIsPresent()

  return (
    <div className="sheet-layer" role={role} aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} onMouseDown={onClose} style={isPresent ? undefined : { pointerEvents: 'none' }}>
      <m.div className="sheet-layer__scrim" initial={instant ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.18 } }} exit={{ opacity: 0, transition: { duration: 0.16 } }} />
      <m.div
        className={className ? `sheet ${className}` : 'sheet'}
        onMouseDown={(event) => event.stopPropagation()}
        initial={instant ? false : { y: '100%' }}
        animate={{ y: 0, transition: SHEET_ENTER }}
        exit={{ y: '100%', transition: SHEET_EXIT }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        // Вниз лист идёт за пальцем один в один, вверх — упирается (четверть хода).
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.25, bottom: 1 }}
        onDragStart={() => { draggedRef.current = true }}
        onDragEnd={(_event, info) => {
          if (info.offset.y > SHEET_CLOSE_OFFSET || info.velocity.y > SHEET_CLOSE_VELOCITY) onClose()
        }}
      >
        {/* Хват — только для пальца и мыши: с клавиатуры лист закрывают кнопки
            листа и Esc, второй такой же кнопке в порядке фокуса делать нечего. */}
        <button
          type="button"
          className="sheet__grab"
          tabIndex={-1}
          aria-hidden="true"
          onPointerDown={(event) => { draggedRef.current = false; dragControls.start(event) }}
          onClick={() => { if (!draggedRef.current) onClose() }}
        />
        {children}
      </m.div>
    </div>
  )
}
