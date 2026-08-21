// Ключи кэша собираются как `<CACHE_PREFIX><id пользователя>:<ключ>`: кэш принадлежит
// человеку, а не браузеру. Раскладка v3 хранила ключи без id, поэтому на общем ноутбуке
// первый кадр следующего пользователя рисовался данными предыдущего.
const CACHE_PREFIX = 'argo-warehouse:v4:'
// Ключи прошлой раскладки в новую не переезжают: выметаем их один раз при первой
// установке scope. Заодно освобождается квота — там лежал каталог на ~1.4 МБ.
const LEGACY_CACHE_PREFIX = 'argo-warehouse:v3:'
const MAX_PERSISTED_ENTRIES = 64

type CacheEntry<T> = {
  value: T
  expiresAt: number
  // Момент записи. TTL решает, показывать ли значение; touchedAt остаётся полем
  // записи, чтобы возраст («данные от 12:40») можно было прочитать без запроса.
  touchedAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const pendingLoads = new Map<string, Promise<unknown>>()

// Текущий владелец кэша: id пользователя из сессии либо null, когда сессии нет.
// Без scope не персистим НИЧЕГО: «ничей» ключ в localStorage достался бы первому,
// кто войдёт следующим. Память при этом работает — она и так живёт до перезагрузки
// и сбрасывается на смене scope.
let cacheScope: string | null = null

// Поколение растёт на каждой инвалидации и на смене scope. Ответ загрузчика,
// стартовавшего в прошлом поколении, в кэш не пишется: иначе запрос, застрявший
// в полёте, возвращает только что сброшенное значение обратно.
let cacheGeneration = 0

let legacyEntriesSwept = false

// Коды «тебя разлогинило / прав нет»: PGRST301 — истёкший JWT, 42501 — отказ RLS,
// 401 — ответ без валидного ключа.
const authErrorCodes = new Set(['401', 'PGRST301', '42501'])

// Экспортируется, потому что тот же список кодов нужен каналу ошибок
// (reportAppError): отказ авторизации там помечается level: 'auth' и не считается
// падением. Копии списка не заводим — источник правды один.
export function isAuthError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; status?: unknown }
  if (typeof candidate.code === 'string' && authErrorCodes.has(candidate.code)) return true
  return candidate.status === 401
}

// null — писать и читать в localStorage нельзя: владелец кэша неизвестен.
function storageKey(key: string): string | null {
  return cacheScope === null ? null : `${CACHE_PREFIX}${cacheScope}:${key}`
}

function sweepLegacyEntries() {
  if (legacyEntriesSwept || typeof window === 'undefined') return
  legacyEntriesSwept = true

  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(LEGACY_CACHE_PREFIX)) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}

// Вызывается из AuthProvider на инициализации сессии и на каждом onAuthStateChange,
// ДО setSession: прогрев в AppShell стартует уже после того, как scope установлен.
export function setCacheScope(userId: string | null) {
  sweepLegacyEntries()
  if (cacheScope === userId) return

  cacheScope = userId
  // Смена пользователя — полный сброс: ни память, ни запросы в полёте не должны
  // пережить вход другого человека.
  cacheGeneration += 1
  memoryCache.clear()
  pendingLoads.clear()
}

// Кэш вышедшего пользователя стирается из localStorage целиком.
export function purgeCacheScope(userId: string) {
  if (typeof window === 'undefined') return

  const prefix = `${CACHE_PREFIX}${userId}:`
  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(prefix)) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  const memoryEntry = memoryCache.get(key) as CacheEntry<T> | undefined
  if (memoryEntry) return memoryEntry
  if (typeof window === 'undefined') return null

  const storedKey = storageKey(key)
  if (!storedKey) return null

  try {
    const raw = window.localStorage.getItem(storedKey)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (!entry || typeof entry.expiresAt !== 'number') return null
    memoryCache.set(key, entry)
    return entry
  } catch {
    return null
  }
}

// Первый кадр: просроченная запись — это отсутствие значения, а не «старое сойдёт».
// Просроченное значение остаётся в памяти и всё ещё работает как страховка при
// сбое сети внутри cachedQuery, но рисовать его без проверки TTL мы не даём.
export function readCachedQuery<T>(key: string): T | null {
  const entry = readEntry<T>(key)
  if (!entry || entry.expiresAt <= Date.now()) return null
  return entry.value
}

export type CacheEntryMeta = { touchedAt: number }

// Возраст записи читается БЕЗ гейта по TTL — в отличие от readCachedQuery выше.
// Спрашивают его ровно про то значение, которое отдала ветка отказа cachedQuery,
// а она отдаёт просроченное: гейт вернул бы null именно тогда, когда возраст нужен.
export function readCachedQueryMeta(key: string): CacheEntryMeta | null {
  const entry = readEntry<unknown>(key)
  // touchedAt появился в раскладке v4, но запись в localStorage правится руками и
  // приезжает из другой вкладки: без числа возраст неизвестен, и врать нечем.
  if (!entry || typeof entry.touchedAt !== 'number') return null
  return { touchedAt: entry.touchedAt }
}

function trimStorage() {
  if (typeof window === 'undefined') return

  const ownedKeys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(CACHE_PREFIX)) ownedKeys.push(key)
  }
  // Разбор значений стоит дорого и происходит на КАЖДОЙ записи, поэтому пока записей
  // не больше лимита, содержимое не трогаем вовсе.
  if (ownedKeys.length <= MAX_PERSISTED_ENTRIES) return

  const entries: Array<{ key: string; touchedAt: number }> = []
  for (const key of ownedKeys) {
    try {
      const entry = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<CacheEntry<unknown>>
      entries.push({ key, touchedAt: entry.touchedAt ?? 0 })
    } catch {
      window.localStorage.removeItem(key)
    }
  }

  entries
    .sort((a, b) => b.touchedAt - a.touchedAt)
    .slice(MAX_PERSISTED_ENTRIES)
    .forEach((entry) => window.localStorage.removeItem(entry.key))
}

function writeEntry<T>(key: string, value: T, ttlMs: number, persist: boolean) {
  const now = Date.now()
  const entry: CacheEntry<T> = {
    value,
    expiresAt: now + ttlMs,
    touchedAt: now,
  }
  memoryCache.set(key, entry)

  if (!persist || typeof window === 'undefined') return
  const storedKey = storageKey(key)
  if (!storedKey) return

  try {
    window.localStorage.setItem(storedKey, JSON.stringify(entry))
    trimStorage()
  } catch {
    // The app remains fully functional if storage is unavailable or full.
  }
}

// Значение, которое уже есть на руках, кладём в кэш без запроса.
export function primeCachedQuery<T>(key: string, ttlMs: number, value: T) {
  writeEntry(key, value, ttlMs, true)
}

export async function cachedQuery<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  // persist: false — значение живёт только в памяти сессии (крупные выгрузки,
  // которым нечего делать в localStorage с его квотой).
  options: { bypass?: boolean; persist?: boolean } = {},
): Promise<T> {
  const cached = readEntry<T>(key)
  if (!options.bypass && cached && cached.expiresAt > Date.now()) return cached.value

  // bypass обязан дать свежий ответ, поэтому к запросу в полёте он не присоединяется:
  // тот мог стартовать до записи, которую bypass как раз и хочет увидеть.
  if (!options.bypass) {
    const pending = pendingLoads.get(key) as Promise<T> | undefined
    if (pending) return pending
  }

  const generation = cacheGeneration
  const load: Promise<T> = loader()
    .then((value) => {
      // Инвалидация или смена пользователя, случившаяся пока запрос летел, старше
      // ответа: значение отдаём вызвавшему, но в кэш не кладём.
      if (generation === cacheGeneration) writeEntry(key, value, ttlMs, options.persist !== false)
      return value
    })
    .catch((error: unknown) => {
      // «Разлогинило» и «прав нет» подменять старыми данными нельзя: это враньё,
      // после которого пользователь работает с экраном, за которым нет доступа.
      if (isAuthError(error)) throw error
      if (cached) return cached.value
      throw error
    })
    .finally(() => {
      if (pendingLoads.get(key) === load) pendingLoads.delete(key)
    })

  pendingLoads.set(key, load)
  return load
}

export function invalidateCachePrefix(prefix: string) {
  // Поколение растёт до чистки: ответы, летящие прямо сейчас, в кэш уже не попадут.
  cacheGeneration += 1

  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key)
  }
  if (typeof window === 'undefined') return

  const storedPrefix = storageKey(prefix)
  if (!storedPrefix) return

  const keysToRemove: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(storedPrefix)) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => window.localStorage.removeItem(key))
}
