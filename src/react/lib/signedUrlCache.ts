import { primeCachedQuery, readCachedQuery } from './persistentCache'
import { supabase } from './supabase'

// Подписанная ссылка живёт час. Запас в пять минут — на разницу часов клиента и
// сервера и на медленный запрос: отдавать ссылку, которая протухнет через
// секунду, значит показать битую картинку вместо фото.
const SIGNED_URL_TTL_SECONDS = 3600
const SIGNED_URL_KEEP_MS = (SIGNED_URL_TTL_SECONDS - 300) * 1000

// Раньше эта память жила только в сессии вкладки, и довод был такой: запись,
// пережившая выкатку, отдала бы протухший URL как факт. Довод снят гейтом —
// у КАЖДОЙ ссылки своя метка истечения, и просроченная не отдаётся вовсе
// (см. lookup). Цена прежнего решения была видна в цифрах: после каждой
// перезагрузки браузер получал новые адреса тех же файлов и качал 931 КБ фото
// заново, хотя они лежали у него в кэше под старыми адресами (с26).
//
// Ключ уходит в persistentCache, а не в localStorage напрямую, ради ОДНОЙ вещи:
// там ключи именованы пользователем и стираются на выходе (purgeCacheScope).
// Подписанная ссылка открывает файл без авторизации — на общем ноутбуке она не
// должна пережить смену человека.
type SignedUrlEntry = { url: string; expiresAt: number }
// Словарь, а не Map: persistentCache кладёт значение через JSON.stringify,
// который превращает Map в `{}`.
type SignedUrlStore = Record<string, SignedUrlEntry>

// Своя память на каждый приватный бакет: путь внутри бакета уникален только там,
// и общий словарь смешал бы одинаковые пути из разных бакетов.
export function createSignedUrlCache(bucket: string) {
  const cacheKey = `signed-urls:${bucket}`

  function readStore(): SignedUrlStore {
    return readCachedQuery<SignedUrlStore>(cacheKey) ?? {}
  }

  function lookup(store: SignedUrlStore, path: string): string | null {
    const entry = store[path]
    return entry && entry.expiresAt > Date.now() ? entry.url : null
  }

  // Пишем весь словарь целиком: у persistentCache нет правки одного поля записи.
  // Заодно выметаем просроченное — иначе пути удалённых и перезалитых файлов
  // копились бы в localStorage до бесконечности (имя файла содержит uuid,
  // поэтому один и тот же путь второй раз не приходит).
  function remember(fresh: Array<[string, string]>) {
    if (fresh.length === 0) return
    const now = Date.now()
    const store = readStore()
    const next: SignedUrlStore = {}
    for (const [path, entry] of Object.entries(store)) {
      if (entry.expiresAt > now) next[path] = entry
    }
    for (const [path, url] of fresh) next[path] = { url, expiresAt: now + SIGNED_URL_KEEP_MS }
    primeCachedQuery(cacheKey, SIGNED_URL_KEEP_MS, next)
  }

  async function getSignedUrl(path: string): Promise<string> {
    if (!supabase) throw new Error('Supabase не настроен')
    const cached = lookup(readStore(), path)
    if (cached) return cached

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    if (!data?.signedUrl) throw new Error('Подписанная ссылка не получена')
    remember([[path, data.signedUrl]])
    return data.signedUrl
  }

  // Пачкой — для миниатюр списка: по ссылке на каждую строку вышло бы 200
  // запросов. Отказ по отдельному пути не роняет остальные: у такого файла
  // миниатюры просто не будет.
  async function getSignedUrls(paths: string[]): Promise<Map<string, string>> {
    if (!supabase) throw new Error('Supabase не настроен')
    const result = new Map<string, string>()
    const store = readStore()
    const missing: string[] = []
    for (const path of paths) {
      const cached = lookup(store, path)
      if (cached) result.set(path, cached)
      else missing.push(path)
    }
    if (missing.length === 0) return result

    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    const fresh: Array<[string, string]> = []
    for (const entry of data ?? []) {
      if (!entry.path || entry.error || !entry.signedUrl) continue
      fresh.push([entry.path, entry.signedUrl])
      result.set(entry.path, entry.signedUrl)
    }
    remember(fresh)
    return result
  }

  return { getSignedUrl, getSignedUrls }
}
