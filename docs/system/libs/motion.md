# motion — шпаргалка

**Версия:** `motion` 13.4.4 (точная, с33). Peer: React 18/19. Источник — motion.dev
(Context7 `/websites/motion_dev`), скилл `/motion` (`.claude/skills/motion/`).
Motion+ (платный) не берём: `motion-plus`, аудиты MotionScore, исходники Motion UI — нет.

## Когда motion, когда CSS

- **CSS** — hover, фокус, смена цвета, простое появление: `transition` в стилях, как было.
- **motion** — только то, чего CSS не умеет чисто: анимация **ухода** из DOM
  (`AnimatePresence`), шторка/дровер с жестом, перестройка раскладки (`layout`).
  Нет ухода и жеста — пиши CSS.

## Конвенции проекта

- Импорт **только** `from "motion/react"`. `framer-motion` не импортируем и не ставим
  (он приезжает транзитивно — это нормально, напрямую не трогать).
- **Облегчённый режим:** на корне `LazyMotion features={domAnimation} strict`, в коде —
  компонент `m.div`, а не `motion.div`. `strict` роняет рендер, если кто-то взял
  `motion.*`, — так вес не расползается (полный `motion` ≈34 КБ, `m` + `domAnimation`
  заметно меньше). `domMax` (drag, layout) подключать только когда понадобится, и
  записать сюда.
- **Уменьшение движения:** на корне `MotionConfig reducedMotion="user"` — при
  `prefers-reduced-motion` motion сам выключает transform/layout, оставляя
  opacity/цвет. Глобальный CSS-блок в `06-responsive.css` покрывает только CSS.
- Корневые обёртки ставятся в тот же шаг, где появляется первый `m.*`, — не раньше.

## Рабочий API

```tsx
import { LazyMotion, domAnimation, MotionConfig, AnimatePresence, m } from "motion/react"

<MotionConfig reducedMotion="user">
  <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
</MotionConfig>

// уход из DOM: прямой ребёнок AnimatePresence обязан иметь key
<AnimatePresence initial={false}>
  {open && (
    <m.div key="sheet"
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ duration: 0.2, ease: "easeOut" }} />
  )}
</AnimatePresence>
```

- `AnimatePresence` `mode`: `"sync"` (по умолчанию), `"wait"` — новый ждёт ухода
  старого, только один ребёнок; `"popLayout"`.
- `initial={false}` на `AnimatePresence` — без анимации входа при первом рендере.
- Ease — camelCase: `easeOut`, `easeInOut`, не `ease-out`.
- `MotionValue` не читать в рендере (`value.get()` в пропсах) — только в эффектах,
  колбэках, `useTransform`.
- `useTransform(value, inputRange, outputRange)`; форма `useTransform(value, fn)` —
  устарела, не использовать.
