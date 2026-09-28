import { LazyMotion, MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { reportAppError } from './reportAppError'

// Возможности грузятся асинхронно: domMax (drag, layout) — самая тяжёлая часть
// motion, а первому экрану анимации не нужны. До загрузки m.* рисуются как
// обычные теги — без движения, но целиком рабочие.
// Провал чанка (выкатка сменила имена файлов) не роняет ничего: отчёт в канал и
// промис, который не разрешится никогда, — интерфейс так и останется без
// анимаций. Перезагружать вкладку ради них незачем.
const loadMotionFeatures = () => import('./motionFeatures')
  .then((module) => module.default)
  .catch((error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: window.location.pathname })
    return new Promise<never>(() => {})
  })

// Корневые обёртки motion (конвенции — docs/system/libs/motion.md): при
// prefers-reduced-motion motion сам гасит сдвиги и layout, strict роняет рендер
// на полном motion.* — в коде только m.*.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>{children}</LazyMotion>
    </MotionConfig>
  )
}
