import { invalidateCachePrefix, primeCachedQuery, readCachedQuery, readCachedQueryMeta } from '../../lib/persistentCache'
import { LINE_PARAMS, lineLengths, linesFromSearch, searchFromLines } from './lengthsParam'

// «Последний расчёт на этом устройстве». Владелец расчёта — АДРЕС (?l=…&l2=…), и
// только он; здесь лежит указатель на него: строка поиска в формате searchFromLines.
// Линии отсюда в состояние страницы не попадают никогда — указатель открывают явным
// тапом, переходом на адрес, и дальше страница читает адрес как обычно.
//   Пишет   — страница, пока на экране расчёт с ненулевым кабелем (в том числе
//             открытый по чужой ссылке); новое состояние перезаписывает старое.
//   Стирает — «Сбросить» (человек сбросил сознательно), выход из системы (кэш
//             привязан к пользователю и стирается целиком) и TTL.
// Форма значения сменится — менять ключ (…:v2), а не читать старое (gotchas §4).
const LAST_CALC_KEY = 'delay:last-calc:v1'
const LAST_CALC_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type LastCalc = { search: string; touchedAt: number }
export type LastCalcSummary = { search: string; emitters: number; totalMeters: number }

// Та же строка повторно не пишется: расчёт, который просто открыли, не должен
// выглядеть только что посчитанным — время в плашке говорит о последней правке.
export function rememberLastCalc(search: string) {
  if (readCachedQuery<unknown>(LAST_CALC_KEY) === search) return
  primeCachedQuery(LAST_CALC_KEY, LAST_CALC_TTL_MS, search)
}

// Запись в localStorage правится руками и приезжает из другой вкладки: не строка
// или без времени записи — указателя нет.
export function readLastCalc(): LastCalc | null {
  const search = readCachedQuery<unknown>(LAST_CALC_KEY)
  if (typeof search !== 'string' || !search) return null
  const meta = readCachedQueryMeta(LAST_CALC_KEY)
  return meta ? { search, touchedAt: meta.touchedAt } : null
}

export function forgetLastCalc() {
  invalidateCachePrefix(LAST_CALC_KEY)
}

// Сводка для плашки — из самого указателя, тем же разбором, что и у адреса. search
// в ответе собран заново из разобранных линий: на адрес уходит он, а не сырая
// строка, и чужих параметров из испорченной записи туда не попадёт. Мусор (не
// строка, пусто, без l, кабеля ноль) — null: такой расчёт мы бы и не записали.
// Разбор заводит id строк и линий (makeRow) — звать через useMemo, не на каждом рендере.
export function summarizeLastCalc(value: unknown): LastCalcSummary | null {
  if (typeof value !== 'string' || !value) return null
  const params = new URLSearchParams(value)
  const first = params.get(LINE_PARAMS[0])
  if (first === null) return null
  const lines = linesFromSearch(first, params.get(LINE_PARAMS[1]))
  const lengths = lines.map(lineLengths).flat()
  const totalMeters = lengths.reduce((sum, meters) => sum + meters, 0)
  const search = searchFromLines(lines)
  if (!search || !(totalMeters > 0)) return null
  return { search, emitters: lengths.length, totalMeters }
}
