import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { DataAge } from '../../components/DataAge'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { fetchEquipmentLists, preferredListsPageSize, readCachedEquipmentLists, type EquipmentListsPage } from '../lists/api'
import { saveWorldStyle, useWorldStyle, WORLD_HOMES, type WorldHome, type WorldLook } from '../world/settings'
import { hasWebGL2 } from '../world/support'
import { fetchHomeSummary, readCachedHomeSummary, readCachedHomeSummaryMeta, type HomeSummary } from './api'
import { HomeTiles } from './HomeTiles'
import './home.css'

// Сцена мира — своим чанком: обвязка мира и three (его WorldStage тянет сам через
// loadWorld) не входят в чанк главной и не запрашиваются, пока на устройстве выбраны
// «Плитки». Не lazyWithReload: тот при провале чанка перезагружает страницу, а главная —
// прежде всего навигация. Отказ оставляет след и отдаёт пустой компонент: слот
// схлопывается, плитки под ним остаются как были.
const WorldStage = lazy((): Promise<{ default: ComponentType<{ look: WorldLook }> }> => import('../world/WorldStage').then(
  (module) => ({ default: module.WorldStage }),
  (error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: '/', detail: { chunk: 'world-stage' } })
    return { default: () => null }
  },
))

export function HomePage() {
  const { tr } = useLanguage()
  // Вид главной — настройка устройства (settings.ts), палитра мира — оттуда же:
  // переключатели цвета и контура живут только на /world. Без WebGL2 выбирать не из
  // чего — переключателя нет, чанк мира не запрашивается.
  const style = useWorldStyle()
  const [canWorld] = useState(hasWebGL2)
  const showWorld = canWorld && style.home === 'world'
  const homeNames: Record<WorldHome, string> = { world: tr('3D-вид', '3D ko‘rinish'), tiles: tr('Плитки', 'Plitkalar') }

  // Первый кадр — из кэша, затем свежий ответ (как в реестрах разделов). Ключ
  // списков — тот же, что у первой страницы /lists и у прогрева в App.tsx:
  // размер страницы спрашиваем у самой фичи, иначе кэш был бы не общий.
  const [listsQuery] = useState(() => ({ page: 1, search: '', pageSize: preferredListsPageSize() }))
  const [cachedSummary] = useState(() => readCachedHomeSummary())
  const [cachedLists] = useState(() => readCachedEquipmentLists(listsQuery))
  const [summary, setSummary] = useState<HomeSummary | null>(cachedSummary)
  const [lists, setLists] = useState<EquipmentListsPage | null>(cachedLists)
  const [summaryFailed, setSummaryFailed] = useState(false)
  const [listsFailed, setListsFailed] = useState(false)
  // Возраст сводки. Владелец — persistentCache; здесь только перечитывается.
  const [dataAt, setDataAt] = useState<number | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCurrent = true
    // Показали кэш — обязаны перепроверить у сервера; «Обновить» обходит кэш всегда.
    const bypassCache = reloadKey > 0
    // Метка ДО запроса: при живой записи cachedQuery подменяет отказ сети старым
    // значением и промис резолвится. Несдвинувшаяся метка — единственный честный
    // признак «ответа не было» (gotchas §4).
    const ageBefore = readCachedHomeSummaryMeta()?.touchedAt ?? null
    setIsFetching(true)
    setDataAt(null)

    const summaryLoad = fetchHomeSummary({ bypassCache: bypassCache || Boolean(cachedSummary) })
      .then((value) => {
        if (!isCurrent) return
        setSummary(value)
        const ageAfter = readCachedHomeSummaryMeta()?.touchedAt ?? null
        setSummaryFailed(ageAfter !== null && ageAfter === ageBefore)
        setDataAt(ageAfter)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        // Главная — прежде всего навигация: отказ сводки прячет факты, но ссылки
        // остаются. Показанный кэш не стираем — у него есть возраст в DataAge.
        setSummaryFailed(true)
        setDataAt(readCachedHomeSummaryMeta()?.touchedAt ?? null)
        reportAppError(error, { scope: 'loader', route: '/', detail: { source: 'home-summary', servedFromCache: Boolean(cachedSummary) } })
      })

    const listsLoad = fetchEquipmentLists({ ...listsQuery, bypassCache: bypassCache || Boolean(cachedLists) })
      .then((value) => {
        if (!isCurrent) return
        setLists(value)
        setListsFailed(false)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setListsFailed(true)
        reportAppError(error, { scope: 'loader', route: '/', detail: { source: 'recent-lists', servedFromCache: Boolean(cachedLists) } })
      })

    void Promise.allSettled([summaryLoad, listsLoad]).then(() => { if (isCurrent) setIsFetching(false) })
    return () => { isCurrent = false }
  }, [cachedLists, cachedSummary, listsQuery, reloadKey])

  return (
    <section className="home-screen">
      <header className="home-screen__head">
        <div>
          <p className="eyebrow">ARGO Warehouse</p>
          <h1>{tr('Что нужно сделать?', 'Nima qilish kerak?')}</h1>
        </div>
        <div className="home-screen__tools">
          {canWorld && (
            <div className="segmented" role="group" aria-label={tr('Вид главной', 'Bosh sahifa ko‘rinishi')}>
              {WORLD_HOMES.map((id) => (
                <button key={id} type="button" aria-pressed={style.home === id} onClick={() => saveWorldStyle({ home: id })}>
                  {style.home === id && <span className="segmented__thumb" />}
                  {homeNames[id]}
                </button>
              ))}
            </div>
          )}
          <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={summaryFailed} onRefresh={() => setReloadKey((value) => value + 1)} />
        </div>
      </header>

      {/* Мир над плитками. Плитки его не ждут: они вне Suspense и рисуются из кэша
          первым кадром; пока чанк сцены едет, слот держит высоту скелетом. */}
      {showWorld && (
        <div className="home-world">
          <Suspense fallback={<span className="home-world__skeleton" role="status" aria-label={tr('Загружаем мир…', 'Dunyo yuklanmoqda…')} />}>
            <WorldStage look={style} />
          </Suspense>
        </div>
      )}

      <HomeTiles summary={summary} lists={lists} summaryFailed={summaryFailed} listsFailed={listsFailed} />
    </section>
  )
}
