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
- **Облегчённый режим:** на корне `LazyMotion ... strict`, в коде — компонент `m.div`,
  а не `motion.div`. `strict` роняет рендер, если кто-то взял `motion.*`, — так вес не
  расползается.
- **Подключён `domMax`, асинхронно (с33).** Корневые обёртки — `MotionProvider` в
  `src/react/lib/motion.tsx`, стоит в `main.tsx` вокруг `<App />`. Набор — отдельный
  модуль `src/react/lib/motionFeatures.ts` (`export default domMax`), грузится
  `features={() => import('./motionFeatures').then((m) => m.default)}` после первого
  рендера; провал чанка — отчёт `reportAppError` и интерфейс без анимаций. `domMax`
  нужен ради `layoutId` (индикатор нижней панели) и `drag` (лист «Ещё»). До загрузки
  `m.*` рисуются обычными тегами без движения.
- **Цена (замер с33, gzip):** чанк `motionFeatures` ≈28 КБ — асинхронно; входной
  чанк `index` вырос ≈17 КБ (11,3 → 28,6). Из них ≈8 КБ — не наш код, а Rollup:
  модули, достижимые из входа через бочку `motion/react`, он кладёт во вход, даже
  если нужны они только `domMax` (опыт: `m` + `LazyMotion` без динамического
  импорта — 9,5 КБ, с ним — 17,6 КБ). Пока принимаем; тянуть глубокие пути в обход
  `motion/react` конвенция не разрешает.
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

## Приёмы, которые уже живут в коде (с33, `app/App.tsx`)

- **Чужой компонент с жестами** — `m.create(NavLink)` на уровне модуля (не в рендере).
  `className`-функция NavLink проходит насквозь; `children`-функцию NavLink motion
  не пропускает по типам — активность считать снаружи.
- **Общий индикатор** — один `m.span layoutId="…"`, рендерится только в активном пункте.
  Внутри `position: fixed` на контейнере — `layoutRoot`, иначе к пути прибавится
  прокрутка страницы.
- **Лист с хватом** — `drag="y"` + `useDragControls()` + `dragListener={false}`,
  `dragControls.start(event)` в `onPointerDown` хвата; у хвата `touch-action: none`.
  Закрытие — в `onDragEnd` по `info.offset.y` / `info.velocity.y` (px/с). Хват после
  протяжки всё равно получает `click` — отмечать протяжку в `onDragStart`.
- **Уход с подложкой** — подложка и лист двумя `m.div`, у каждого свой `exit`;
  `AnimatePresence` ждёт оба. `useIsPresent()` — снять `pointer-events` с уходящего слоя.
- **CSS-keyframes на элементе, который ведёт motion, — нельзя:** анимация CSS перебивает
  inline-`transform`.
- В dev motion пишет в консоль предупреждение «You have Reduced Motion enabled» при
  `prefers-reduced-motion` — это его справка, не ошибка.
