import type { Json } from '../../lib/database.types'
import { cachedQuery, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import { supabase } from '../../lib/supabase'

// Сводка главной — ответ RPC home_summary (миграция 20260928133529). Форму задаёт
// функция; здесь она сужается из Json с проверкой, а не приведением: разъедется
// RPC с клиентом — главная покажет «нет фактов», а не undefined в числах.
export type HomeSummary = {
  equipment: {
    rows: number
    models: number
    units: number
    available: number
    // issued и незнакомые статусы база кладёт сюда же: три доли дают ровно units.
    unavailable: number
    diagnostics: number
  }
  employees: {
    count: number
    // Голые даты YYYY-MM-DD; порог «скоро» считает lib/expiry.ts.
    expiries: string[]
    faces: string[]
  }
  vehicles: {
    count: number
    firstPlate: string | null
    drivers: number
  }
  hallPlan: {
    id: string
    name: string
    eventFrom: string | null
    eventTo: string | null
    halls: Array<{ name: string; color: string }>
    hires: number
  } | null
}

// Правило сброса — ТОЛЬКО TTL. Запись в любом разделе этот ключ не трогает
// намеренно: сводка — пять чисел на витрине, и минута расхождения после правки
// дешевле, чем пять точек инвалидации в чужих фичах. Главная к тому же всегда
// перепроверяет показанный кэш у сервера (bypass), так что минута — потолок
// только для первого кадра.
const HOME_SUMMARY_CACHE_KEY = 'home:summary'
const HOME_SUMMARY_TTL_MS = 60 * 1000

type JsonObject = { [key: string]: Json | undefined }

function asObject(value: Json | undefined): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function asNumber(value: Json | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('home_summary: число не пришло')
  return value
}

function asStringOrNull(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asStringArray(value: Json | undefined): string[] {
  if (!Array.isArray(value)) throw new Error('home_summary: массив не пришёл')
  return value.filter((item): item is string => typeof item === 'string')
}

function parseHomeSummary(data: Json): HomeSummary {
  const root = asObject(data)
  const equipment = asObject(root?.equipment)
  const employees = asObject(root?.employees)
  const vehicles = asObject(root?.vehicles)
  if (!root || !equipment || !employees || !vehicles) throw new Error('home_summary: неожиданная форма ответа')

  // null — плана нет вовсе; объект без нужных полей — поломка, а не «плана нет».
  const plan = asObject(root.hall_plan)
  let hallPlan: HomeSummary['hallPlan'] = null
  if (root.hall_plan !== null && root.hall_plan !== undefined) {
    if (!plan || typeof plan.id !== 'string' || typeof plan.name !== 'string' || !Array.isArray(plan.halls)) {
      throw new Error('home_summary: неожиданная форма плана')
    }
    hallPlan = {
      id: plan.id,
      name: plan.name,
      eventFrom: asStringOrNull(plan.event_from),
      eventTo: asStringOrNull(plan.event_to),
      halls: plan.halls.flatMap((hall) => {
        const item = asObject(hall)
        return item && typeof item.name === 'string' && typeof item.color === 'string' ? [{ name: item.name, color: item.color }] : []
      }),
      hires: asNumber(plan.hires),
    }
  }

  return {
    equipment: {
      rows: asNumber(equipment.rows),
      models: asNumber(equipment.models),
      units: asNumber(equipment.units),
      available: asNumber(equipment.available),
      unavailable: asNumber(equipment.unavailable),
      diagnostics: asNumber(equipment.diagnostics),
    },
    employees: {
      count: asNumber(employees.count),
      expiries: asStringArray(employees.expiries),
      faces: asStringArray(employees.faces),
    },
    vehicles: {
      count: asNumber(vehicles.count),
      firstPlate: asStringOrNull(vehicles.first_plate),
      drivers: asNumber(vehicles.drivers),
    },
    hallPlan,
  }
}

export function readCachedHomeSummary() {
  return readCachedQuery<HomeSummary>(HOME_SUMMARY_CACHE_KEY)
}

export function readCachedHomeSummaryMeta() {
  return readCachedQueryMeta(HOME_SUMMARY_CACHE_KEY)
}

// Значение крошечное (пять чисел, до трёх инициалов, даты без имён) — лежит на
// диске, и главная после перезагрузки рисуется с фактами с первого кадра.
export async function fetchHomeSummary({ bypassCache = false } = {}): Promise<HomeSummary> {
  if (!supabase) throw new Error('Supabase не настроен')
  const client = supabase
  return cachedQuery(HOME_SUMMARY_CACHE_KEY, HOME_SUMMARY_TTL_MS, async () => {
    const { data, error } = await client.rpc('home_summary')
    if (error) throw error
    return parseHomeSummary(data)
  }, { bypass: bypassCache })
}
