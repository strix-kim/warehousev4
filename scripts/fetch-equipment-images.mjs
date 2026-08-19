import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const execFileAsync = promisify(execFile)
const root = new URL('../', import.meta.url)
const outputDirectory = new URL('../public/equipment-images/', import.meta.url)
const generatedDirectory = new URL('../src/react/generated/', import.meta.url)
const manifestUrl = new URL('../public/equipment-images/manifest.json', import.meta.url)
const reportUrl = new URL('../public/equipment-images/report.json', import.meta.url)
const generatedUrl = new URL('../src/react/generated/equipmentImages.ts', import.meta.url)
const catalogUrl = new URL('./equipment-catalog.json', import.meta.url)
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36'
const blockedDomains = ['pinterest.', 'facebook.', 'instagram.', 'youtube.', 'free3d.', 'amazon.', 'ebay.', 'aliexpress.', 'shutterstock.', 'dreamstime.']
const genericBrands = new Set([
  'bnc', 'cable box', 'custom', 'dongle hub', 'dp cabel', 'dp out to hdmi adapter',
  'hdmi cabel', 'hdmi optic', 'lan', 'mini dp to hdmi adapter', 'mini hdmi', 'minidp',
  'noname', 'type c', 'usb mouse', 'utp',
])

function parseEnv(source) {
  return Object.fromEntries(source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=')
      const key = line.slice(0, separator).trim()
      const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
      return [key, value]
    }))
}

function normalize(value) {
  return value
    .toLocaleLowerCase('ru')
    .normalize('NFKD')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function equipmentKey(brand, model) {
  return `${normalize(brand)}::${normalize(model)}`
}

function isGenericEquipment(item) {
  return genericBrands.has(normalize(item.brand)) || normalize(item.model) === 'custom'
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'equipment'
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) })
      if (response.ok) return response
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error
    }
    await delay(600 * attempt)
  }
  throw lastError
}

async function searchImages(query) {
  const searchUrl = `https://duckduckgo.com/?${new URLSearchParams({ q: query, iax: 'images', ia: 'images' })}`
  const htmlResponse = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': userAgent } })
  const html = await htmlResponse.text()
  const token = html.match(/vqd=([^&"'\s]+)/)?.[1]
    ?? html.match(/vqd=['"]([^'"]+)/)?.[1]
  if (!token) throw new Error('DuckDuckGo did not return an image token')

  const apiUrl = new URL('https://duckduckgo.com/i.js')
  apiUrl.search = new URLSearchParams({ l: 'us-en', o: 'json', q: query, vqd: token, f: ',,,,,', p: '1' }).toString()
  const response = await fetchWithRetry(apiUrl, {
    headers: { 'User-Agent': userAgent, Referer: 'https://duckduckgo.com/' },
  })
  const data = await response.json()
  return Array.isArray(data.results) ? data.results : []
}

function scoreCandidate(candidate, equipment, allEquipment) {
  const title = normalize(candidate.title ?? '')
  const pageUrl = normalize(candidate.url ?? '')
  const imageUrl = normalize(candidate.image ?? '')
  const combined = `${title} ${pageUrl} ${imageUrl}`
  const brand = normalize(equipment.brand)
  const model = normalize(equipment.model)
  const brandTokens = brand.split(' ').filter((token) => token.length > 1)
  const modelTokens = model.split(' ').filter((token) => token.length > 1)
  const host = (() => {
    try { return new URL(candidate.url).hostname.toLowerCase() } catch { return '' }
  })()

  if (!candidate.image || blockedDomains.some((domain) => host.includes(domain))) return -100
  if (!modelTokens.length || !modelTokens.every((token) => combined.includes(token))) return -50

  let score = 0
  score += modelTokens.reduce((sum, token) => sum + (title.includes(token) ? 12 : 4), 0)
  if (title.includes(model)) score += 30
  if (imageUrl.includes(model)) score += 18
  if (brand && title.includes(brand)) score += 16
  if (brandTokens.some((token) => host.includes(token))) score += 18
  if (brandTokens.every((token) => combined.includes(token))) score += 8
  const moreSpecificSibling = allEquipment.find((other) => {
    if (equipmentKey(other.brand, '') !== equipmentKey(equipment.brand, '')) return false
    const siblingModel = normalize(other.model)
    return siblingModel !== model && siblingModel.startsWith(`${model} `) && combined.includes(siblingModel)
  })
  if (moreSpecificSibling) score -= 90
  if (/logo|manual|datasheet|diagram|drawing|icon/.test(title)) score -= 30
  if (/family|series|system/.test(title) && !title.includes(model)) score -= 12
  return score
}

async function downloadAndOptimize(candidate, equipment, filename) {
  const response = await fetchWithRetry(candidate.image, {
    headers: { 'User-Agent': userAgent, Referer: candidate.url },
  })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < 2_000 || bytes.byteLength > 15_000_000) throw new Error(`Unexpected image size: ${bytes.byteLength}`)

  const tempBase = join(tmpdir(), `argo-equipment-${createHash('sha1').update(equipmentKey(equipment.brand, equipment.model)).digest('hex').slice(0, 10)}`)
  const downloaded = `${tempBase}.source`
  const resized = `${tempBase}.png`
  const temporaryWebp = `${tempBase}.webp`
  const destination = new URL(filename, outputDirectory)

  try {
    await writeFile(downloaded, bytes)
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '640', downloaded, '--out', resized])
    await execFileAsync('/opt/homebrew/bin/cwebp', ['-quiet', '-q', '72', '-m', '5', resized, '-o', temporaryWebp])
    await rename(temporaryWebp, destination)
  } finally {
    await Promise.allSettled([rm(downloaded, { force: true }), rm(resized, { force: true }), rm(temporaryWebp, { force: true })])
  }
}

async function loadEquipment() {
  const rows = []
  try {
    const env = parseEnv(await readFile(new URL('.env', root), 'utf8'))
    const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
    if (url && key && process.argv.includes('--live')) {
      const supabase = createClient(url, key, { auth: { persistSession: false } })
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('equipment')
          .select('brand,model,type,subtype')
          .range(from, from + 999)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
    }
  } catch (error) {
    console.warn(`Live catalog is unavailable; using the exported catalog: ${error instanceof Error ? error.message : error}`)
  }

  if (!rows.length) rows.push(...JSON.parse(await readFile(catalogUrl, 'utf8')))

  return [...new Map(rows
    .filter((item) => item.brand?.trim() && item.model?.trim())
    .map((item) => [equipmentKey(item.brand, item.model), item])).values()]
    .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, 'ru'))
}

async function readManifest() {
  try { return JSON.parse(await readFile(manifestUrl, 'utf8')) } catch { return {} }
}

async function saveArtifacts(manifest, failures, equipment) {
  const total = equipment.length
  const orderedManifest = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, 'ru')))
  const failureReasons = new Map(failures.map((failure) => [equipmentKey(failure.brand, failure.model), failure.reason]))
  const missingItems = equipment
    .filter((item) => !manifest[equipmentKey(item.brand, item.model)])
    .map((item) => ({
      brand: item.brand,
      model: item.model,
      type: item.type,
      subtype: item.subtype,
      reason: failureReasons.get(equipmentKey(item.brand, item.model)) ?? 'No reliable downloadable image found',
    }))
  await writeFile(manifestUrl, `${JSON.stringify(orderedManifest, null, 2)}\n`)
  await writeFile(reportUrl, `${JSON.stringify({ generatedAt: new Date().toISOString(), total, downloaded: Object.keys(manifest).length, missing: missingItems.length, missingItems }, null, 2)}\n`)
  const clientManifest = Object.fromEntries(Object.entries(orderedManifest).map(([key, entry]) => [key, entry.src]))
  await writeFile(generatedUrl, `// Generated from public/equipment-images/manifest.json. Keep the client bundle limited to local paths.\nexport const equipmentImages: Record<string, string> = ${JSON.stringify(clientManifest, null, 2)}\n`)

  const referencedFiles = new Set(Object.values(manifest).map((entry) => entry.src.split('/').at(-1)))
  const orphanedFiles = (await readdir(outputDirectory))
    .filter((filename) => filename.endsWith('.webp') && !referencedFiles.has(filename))
  await Promise.all(orphanedFiles.map((filename) => rm(new URL(filename, outputDirectory), { force: true })))
}

async function main() {
  await mkdir(outputDirectory, { recursive: true })
  await mkdir(generatedDirectory, { recursive: true })
  const equipment = await loadEquipment()
  const manifest = await readManifest()
  const genericItems = equipment.filter(isGenericEquipment)
  genericItems.forEach((item) => delete manifest[equipmentKey(item.brand, item.model)])
  const failures = genericItems.map((item) => ({ brand: item.brand, model: item.model, reason: 'Generic inventory record; category icon is safer than an arbitrary product photo' }))
  const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='))
  const limit = limitArgument ? Number(limitArgument.split('=')[1]) : equipment.length
  const pending = equipment.filter((item) => !isGenericEquipment(item) && !manifest[equipmentKey(item.brand, item.model)]).slice(0, limit)

  console.log(`Equipment models: ${equipment.length}; cached images: ${Object.keys(manifest).length}; pending this run: ${pending.length}`)

  for (let index = 0; index < pending.length; index += 1) {
    const item = pending[index]
    const key = equipmentKey(item.brand, item.model)
    try {
      const query = `"${item.brand}" "${item.model}" product equipment`
      const candidates = await searchImages(query)
      const ranked = candidates
        .map((candidate) => ({ candidate, score: scoreCandidate(candidate, item, equipment) }))
        .sort((a, b) => b.score - a.score)
      const hash = createHash('sha1').update(key).digest('hex').slice(0, 8)
      const filename = `${slug(`${item.brand}-${item.model}`)}-${hash}.webp`
      const reliable = ranked.filter((entry) => entry.score >= 50).slice(0, 5)
      if (!reliable.length) throw new Error(`No reliable match (best score ${ranked[0]?.score ?? 'none'})`)

      let selected
      const sourceErrors = []
      for (const entry of reliable) {
        try {
          await downloadAndOptimize(entry.candidate, item, filename)
          selected = entry
          break
        } catch (error) {
          sourceErrors.push(error instanceof Error ? error.message : String(error))
        }
      }
      if (!selected) throw new Error(`All reliable image sources failed: ${sourceErrors.join('; ')}`)

      manifest[key] = {
        src: `/equipment-images/${filename}`,
        sourcePage: selected.candidate.url,
        sourceImage: selected.candidate.image,
        title: selected.candidate.title,
      }
      console.log(`[${index + 1}/${pending.length}] ✓ ${item.brand} ${item.model}`)
    } catch (error) {
      failures.push({ brand: item.brand, model: item.model, reason: error instanceof Error ? error.message : String(error) })
      console.log(`[${index + 1}/${pending.length}] – ${item.brand} ${item.model}: ${failures.at(-1).reason}`)
    }

    if ((index + 1) % 10 === 0) await saveArtifacts(manifest, failures, equipment)
    await delay(180)
  }

  await saveArtifacts(manifest, failures, equipment)
  console.log(`Done. Images: ${Object.keys(manifest).length}/${equipment.length}; fallback icons: ${equipment.length - Object.keys(manifest).length}`)
}

await main()
