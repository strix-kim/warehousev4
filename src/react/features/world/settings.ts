// Настройки мира: цвет, тон контура, вид главной. Файл живёт во входном чанке и
// three не импортирует.
//
// Это настройка УСТРОЙСТВА, а не пользователя, поэтому она вне persistentCache и вне
// очистки на выходе: кэш привязан к id пользователя и стирается вместе с сессией, а
// облик мира обязан пережить выход и общий у всех, кто сидит за этим компьютером.
// Владелец значения один — этот файл; копии в базе и в адресе нет.
import { useSyncExternalStore } from 'react'

export const WORLD_STYLE_KEY = 'argo-world-style'

export const WORLD_PALETTES = ['white', 'night'] as const
// Тон контура: три ступени от мягкого к самому бледному
export const WORLD_INKS = ['ink1', 'ink2', 'ink3'] as const
export const WORLD_HOMES = ['world', 'tiles'] as const

export type WorldPalette = (typeof WORLD_PALETTES)[number]
export type WorldInk = (typeof WORLD_INKS)[number]
export type WorldHome = (typeof WORLD_HOMES)[number]

export type WorldStyleSettings = { palette: WorldPalette; ink: WorldInk; home: WorldHome }
// Часть настроек, от которой зависит сцена: её и получает движок
export type WorldLook = Pick<WorldStyleSettings, 'palette' | 'ink'>

export const WORLD_STYLE_DEFAULT: WorldStyleSettings = { palette: 'white', ink: 'ink1', home: 'world' }

// Незнакомое значение оси (старый ключ, правка руками) — умолчание этой оси,
// остальные оси при этом сохраняются
function pick<T extends string>(table: readonly T[], value: unknown, fallback: T): T {
  return table.includes(value as T) ? (value as T) : fallback
}

function normalize(value: unknown): WorldStyleSettings {
  const saved = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  return {
    palette: pick(WORLD_PALETTES, saved.palette, WORLD_STYLE_DEFAULT.palette),
    ink: pick(WORLD_INKS, saved.ink, WORLD_STYLE_DEFAULT.ink),
    home: pick(WORLD_HOMES, saved.home, WORLD_STYLE_DEFAULT.home),
  }
}

// Что лежит в хранилище прямо сейчас. Хранилище недоступно (приватный режим,
// запрет в настройках браузера) или значение испорчено — умолчания.
export function readWorldStyle(): WorldStyleSettings {
  try {
    const raw = window.localStorage.getItem(WORLD_STYLE_KEY)
    return normalize(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...WORLD_STYLE_DEFAULT }
  }
}

// Значение этой вкладки. Отдельно от хранилища по двум причинам: снимок для
// useSyncExternalStore обязан быть стабильным по ссылке, и выбор должен работать
// до конца сеанса, даже когда запись в хранилище не удалась.
let current: WorldStyleSettings | null = null
// Последняя запись не удалась: значение вкладки новее хранилища, сверять с ним нельзя
let unsaved = false
const listeners = new Set<() => void>()

const same = (a: WorldStyleSettings, b: WorldStyleSettings) => a.palette === b.palette && a.ink === b.ink && a.home === b.home

function getSnapshot(): WorldStyleSettings {
  return current ??= readWorldStyle()
}

function publish(next: WorldStyleSettings) {
  if (same(getSnapshot(), next)) return
  current = next
  listeners.forEach((listener) => listener())
}

// false — выбор применён, но не запомнится: хранилище недоступно или переполнено
export function saveWorldStyle(patch: Partial<WorldStyleSettings>): boolean {
  const next = normalize({ ...getSnapshot(), ...patch })
  publish(next)
  try {
    window.localStorage.setItem(WORLD_STYLE_KEY, JSON.stringify(next))
    unsaved = false
  } catch {
    unsaved = true
  }
  return !unsaved
}

// Другая вкладка сменила облик. key === null — хранилище очищено целиком.
function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === WORLD_STYLE_KEY) publish(readWorldStyle())
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage)
    // Пока подписчиков не было, события других вкладок шли мимо — сверяемся с хранилищем
    if (!unsaved) publish(readWorldStyle())
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

export function useWorldStyle(): WorldStyleSettings {
  return useSyncExternalStore(subscribe, getSnapshot)
}
