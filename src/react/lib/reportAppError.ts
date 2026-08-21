// Единственный канал, через который отказ оставляет след: сборщика ошибок в проекте
// нет, поэтому «след» — это строка в консоли плюс шов setErrorSink, в который позже
// воткнётся Sentry, не трогая вызывающие места.
import { isAuthError } from './persistentCache'

export type ErrorScope = 'boundary' | 'chunk' | 'window' | 'promise' | 'react' | 'loader' | 'prefetch'

export type ErrorContext = {
  scope: ErrorScope
  route?: string
  componentStack?: string
  detail?: Record<string, string | number | boolean | null>
}

export type ReportedError = ErrorContext & {
  message: string
  // Код PostgREST или HTTP-статус: единственное опознавательное поле, которое можно
  // показывать в проде — в отличие от details/hint, где лежит содержимое строк.
  code: string | null
  // auth — «разлогинило / прав нет»: штатная ветка отказа, а не падение приложения.
  level: 'error' | 'auth'
  at: number
}

// Весь шов под сборщик ошибок — одна функция. Никакого Sentry-образного API в проекте
// не заводим: подключат сборщик — здесь появится ровно один setErrorSink на старте.
let sink: ((event: ReportedError) => void) | null = null

export function setErrorSink(next: ((event: ReportedError) => void) | null): void {
  sink = next
}

// Окно дедупа: два прогревочных батча (App.tsx) при мёртвой сети дают пять-шесть
// одинаковых строк подряд, за которыми не видно первой — настоящей.
const DEDUP_WINDOW_MS = 5_000
const lastReportedAt = new Map<string, number>()

function describeError(error: unknown): { message: string; code: string | null } {
  if (typeof error === 'string') return { message: error, code: null }
  if (!error || typeof error !== 'object') return { message: String(error), code: null }

  const candidate = error as { message?: unknown; code?: unknown; status?: unknown }
  const message = typeof candidate.message === 'string' && candidate.message ? candidate.message : 'Unknown error'
  const code = typeof candidate.code === 'string'
    ? candidate.code
    : typeof candidate.status === 'number' ? String(candidate.status) : null
  return { message, code }
}

export function reportAppError(error: unknown, context: ErrorContext): void {
  // Тело целиком в try/catch: канал зовут из фолбэка границы ошибок, и упади он сам —
  // границе прилетит новая ошибка, а из этого цикла выхода уже нет.
  try {
    const { message, code } = describeError(error)

    const signature = `${context.scope}:${message}`
    const now = Date.now()
    const seenAt = lastReportedAt.get(signature)
    for (const [key, at] of lastReportedAt) {
      if (now - at > DEDUP_WINDOW_MS) lastReportedAt.delete(key)
    }
    lastReportedAt.set(signature, now)
    if (seenAt !== undefined && now - seenAt <= DEDUP_WINDOW_MS) return

    const event: ReportedError = {
      ...context,
      message,
      code,
      // Список кодов «тебя разлогинило» один на проект и живёт в persistentCache —
      // канал переиспользует его, а не заводит вторую копию (правило 5 CLAUDE.md).
      level: isAuthError(error) ? 'auth' : 'error',
      at: now,
    }

    const label = `[argo] ${event.scope}${event.route ? ` ${event.route}` : ''}: ${message}`
    if (import.meta.env.DEV) {
      console[event.level === 'auth' ? 'warn' : 'error'](label, error, event)
    } else {
      // В прод-консоль уходят только message и code: у PostgrestError в details/hint
      // лежит содержимое строк базы, и публиковать его нельзя (правило 3 CLAUDE.md).
      console[event.level === 'auth' ? 'warn' : 'error'](label, { code: event.code })
    }

    // Отказ авторизации в sink не идёт: сборщик считал бы истёкший JWT падением
    // приложения. Уводом на /login по-прежнему занимается только persistentCache.
    if (event.level === 'auth') return
    sink?.(event)
  } catch {
    // Канал молчит о собственных сбоях: жаловаться ему некуда, кроме самого себя.
  }
}

let globalListenersInstalled = false

export function installGlobalErrorReporting(): void {
  // Идемпотентно: повторный вызов (перезапуск рута, HMR) не вешает второй набор
  // слушателей — иначе каждая ошибка печаталась бы столько раз, сколько было вызовов.
  if (globalListenersInstalled || typeof window === 'undefined') return
  globalListenersInstalled = true

  window.addEventListener('error', (event) => {
    // Провал загрузки ресурса (<img>, <script>) всплывает тем же событием, но с
    // error === null: отчёт по нему был бы строкой без содержимого.
    if (!event.error) return
    reportAppError(event.error, { scope: 'window', route: window.location.pathname })
  })

  window.addEventListener('unhandledrejection', (event) => {
    reportAppError(event.reason, { scope: 'promise', route: window.location.pathname })
  })

  // vite:preloadError — cancelable-событие, и preventDefault() заставил бы preload()
  // резолвиться undefined: lazy тут же упал бы на чтении .default. Поэтому только
  // отчёт, событие не гасим и вкладку не перезагружаем.
  window.addEventListener('vite:preloadError', (event) => {
    reportAppError(event.payload, { scope: 'chunk', route: window.location.pathname })
  })
}
