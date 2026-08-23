import { supabase } from './supabase'

// Подписанные ссылки живут час и в persistentCache им не место: пережившая
// выкатку запись отдала бы протухший URL как факт. Память — только на сессию
// вкладки, с запасом в пять минут до истечения.
const SIGNED_URL_TTL_SECONDS = 3600
const SIGNED_URL_KEEP_MS = (SIGNED_URL_TTL_SECONDS - 300) * 1000

// Своя память на каждый приватный бакет: путь внутри бакета уникален только там,
// и общая карта смешала бы одинаковые пути из разных бакетов.
export function createSignedUrlCache(bucket: string) {
  const signedUrls = new Map<string, { url: string; expiresAt: number }>()

  async function getSignedUrl(path: string): Promise<string> {
    if (!supabase) throw new Error('Supabase не настроен')
    const cached = signedUrls.get(path)
    if (cached && cached.expiresAt > Date.now()) return cached.url

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    if (!data?.signedUrl) throw new Error('Подписанная ссылка не получена')
    signedUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_KEEP_MS })
    return data.signedUrl
  }

  // Пачкой — для миниатюр списка: по ссылке на каждую строку вышло бы 200
  // запросов. Отказ по отдельному пути не роняет остальные: у такого файла
  // миниатюры просто не будет.
  async function getSignedUrls(paths: string[]): Promise<Map<string, string>> {
    if (!supabase) throw new Error('Supabase не настроен')
    const result = new Map<string, string>()
    const missing: string[] = []
    for (const path of paths) {
      const cached = signedUrls.get(path)
      if (cached && cached.expiresAt > Date.now()) result.set(path, cached.url)
      else missing.push(path)
    }
    if (missing.length === 0) return result

    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, SIGNED_URL_TTL_SECONDS)
    if (error) throw error
    for (const entry of data ?? []) {
      if (!entry.path || entry.error || !entry.signedUrl) continue
      signedUrls.set(entry.path, { url: entry.signedUrl, expiresAt: Date.now() + SIGNED_URL_KEEP_MS })
      result.set(entry.path, entry.signedUrl)
    }
    return result
  }

  return { getSignedUrl, getSignedUrls }
}
