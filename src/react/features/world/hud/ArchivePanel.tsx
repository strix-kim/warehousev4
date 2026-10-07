import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatEventDate, parseDateValue } from '../../../lib/date'
import { useLanguage } from '../../../lib/i18n'
import { ARCH_BLOCK, ARCH_EMPTY_ID, ARCH_MAX, archiveBlocks, type ArchiveBlock } from '../archiveBlocks'
import type { WorldArchiveKind, WorldArchivePlace } from '../data/types'
import { blockId, placeId, useWorldState, type WorldStore } from '../worldStore'
import { ruPlural } from './plural'
import './world-archive.css'

type Tr = (ru: string, uz: string) => string

type Props = {
  store: WorldStore
  places: WorldArchivePlace[]
}

const placesWord = (count: number, tr: Tr) => tr(ruPlural(count, 'место', 'места', 'мест'), 'joy')
const eventsWord = (count: number, tr: Tr) => tr(ruPlural(count, 'мероприятие', 'мероприятия', 'мероприятий'), 'tadbir')
const itemsWord = (count: number, tr: Tr) => tr(ruPlural(count, 'позиция', 'позиции', 'позиций'), 'pozitsiya')

function kindName(kind: WorldArchiveKind, tr: Tr) {
  if (kind === 'hotel') return tr('Отель', 'Mehmonxona')
  if (kind === 'arena') return tr('Арена', 'Arena')
  if (kind === 'hall') return tr('Конгресс-холл', 'Kongress-xoll')
  return tr('Дворец', 'Saroy')
}

// Календарный день словами; строка не дата — показываем как пришла
function dateText(iso: string, locale: string) {
  const date = parseDateValue(iso)
  return date ? formatEventDate(date, locale) : iso
}

// Подпись квартала: год или диапазон лет последних мероприятий его мест
const blockLabel = (block: ArchiveBlock) => block.yearFrom === block.yearTo ? String(block.yearTo) : `${block.yearFrom}–${block.yearTo}`
const blockName = (block: ArchiveBlock, tr: Tr) => tr(`Квартал ${blockLabel(block)}`, `${blockLabel(block)} kvartali`)

// Наведение и фокус на вывеске или строке — то же наведение, что указатель в сцене:
// кольцо под зданием, чип имени, тон участка. Уход снимает только своё (как у Sign).
function hoverOn(store: WorldStore, id: string) {
  const enter = () => store.setState({ hover: id })
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }
  return { onPointerEnter: enter, onPointerLeave: leave, onFocus: enter, onBlur: leave }
}

// Вывеска квартала — слабее вывесок зданий кампуса. Якорь w-sign: место ей ищет
// раскладка движка, в компактном виде слово «мест» прячет CSS.
function BlockSign({ store, block }: { store: WorldStore; block: ArchiveBlock }) {
  const { tr, locale } = useLanguage()
  const id = blockId(block.index)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const picked = useWorldState(store, (state) => state.pick === id)
  if (!anchor) return null
  const count = block.count.toLocaleString(locale), unit = placesWord(block.count, tr)

  return createPortal(
    <>
      <span className="w-sign__leg" />
      <button
        type="button"
        className="w-sign__board"
        aria-pressed={picked}
        aria-label={`${blockName(block, tr)}: ${count} ${unit}`}
        {...hoverOn(store, id)}
        onClick={() => store.setState({ pick: picked ? null : id })}
      >
        {blockLabel(block)}
        <span className="w-ablock__n">{count}<i> {unit}</i></span>
      </button>
    </>,
    anchor,
  )
}

// Чип имени над зданием: мышь не ловит, скринридеру не читается (aria-hidden ставит
// якорю движок) — текстовый путь к месту идёт через вывеску квартала и строки панели
function PlaceChip({ store, place }: { store: WorldStore; place: WorldArchivePlace }) {
  const { tr, locale } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(placeId(place.id)))
  if (!anchor) return null
  return createPortal(
    <span className="w-place__in">
      <b>{place.name}</b>
      <span>{place.events.toLocaleString(locale)} {eventsWord(place.events, tr)} · {dateText(place.last, locale)}</span>
    </span>,
    anchor,
  )
}

// Чипов на всю сцену не больше двух: под указателем (или в фокусе строки) и у выбранного
function PlaceChips({ store, byId }: { store: WorldStore; byId: Map<string, WorldArchivePlace> }) {
  const hover = useWorldState(store, (state) => state.hover)
  const pick = useWorldState(store, (state) => state.pick)
  const ids = [...new Set([pick, hover])].filter((id): id is string => !!id && byId.has(id))
  return ids.map((id) => <PlaceChip key={id} store={store} place={byId.get(id)!} />)
}

function EmptySign({ store }: { store: WorldStore }) {
  const { tr } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(ARCH_EMPTY_ID))
  if (!anchor) return null
  return createPortal(
    <>
      <span className="w-aempty__leg" />
      <div className="w-aempty__board">
        <b>{tr('Здесь появятся места, где мы работали', 'Bu yerda biz ishlagan joylar paydo bo‘ladi')}</b>
        <span>{tr('Место попадает сюда после первого мероприятия', 'Joy bu yerga birinchi tadbirdan keyin tushadi')}</span>
      </div>
    </>,
    anchor,
  )
}

type RowProps = {
  store: WorldStore
  place: WorldArchivePlace
  // Место не встало в сцену — есть только в списке
  outside: boolean
  onOpen: (id: string) => void
}

// Строка места — одна на квартал и на список: число мероприятий, имя, итог
function PlaceRow({ store, place, outside, onOpen }: RowProps) {
  const { tr, locale } = useLanguage()
  const id = placeId(place.id)
  return (
    <button type="button" className="w-arow" data-place={id} {...hoverOn(store, id)} onClick={() => onOpen(id)}>
      <span className="w-arow__n" aria-hidden="true">{place.events.toLocaleString(locale)}</span>
      <span className="w-arow__t">
        <b>{place.name}</b>
        <small>{place.events.toLocaleString(locale)} {eventsWord(place.events, tr)} · {dateText(place.last, locale)}{outside ? tr(' · вне сцены', ' · sahnadan tashqarida') : ''}</small>
      </span>
      <span className="w-arow__chev" aria-hidden="true" />
    </button>
  )
}

// HUD «Где работали»: вывески кварталов и чипы мест (порталами в якоря движка), плашка
// итога и панель — строки квартала, список всех мест или карточка места с историей.
// Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора: placeId(place.id)
// или blockId(n) (контракт — worldStore.ts); у места вне сцены якоря и кольца нет.
export function ArchivePanel({ store, places }: Props) {
  const { tr, locale } = useLanguage()
  const pick = useWorldState(store, (state) => state.pick)
  const compact = useWorldState(store, (state) => state.hudCompact)
  // Кварталы и итог считаются из мест: порядок выдачи — от свежих к старым
  const blocks = useMemo(() => archiveBlocks(places), [places])
  const byId = useMemo(() => new Map(places.map((place) => [placeId(place.id), place])), [places])
  const events = useMemo(() => places.reduce((sum, place) => sum + place.events, 0), [places])
  const more = Math.max(0, places.length - ARCH_MAX)
  // Открыт список всех мест — он же путь к местам, не вставшим в сцену
  const [list, setList] = useState(false)
  // Откуда открыта карточка места id: из списка или из строк квартала (его номер)
  const [origin, setOrigin] = useState<{ id: string; from: 'list' | number } | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const overRef = useRef<HTMLButtonElement>(null)
  // Что сфокусировать после перерисовки панели: 'head' — первую кнопку шапки, иначе id строки
  const focusRef = useRef<string | null>(null)

  const place = pick ? byId.get(pick) : undefined
  const block = blocks.find((item) => blockId(item.index) === pick)
  const mode = place ? 'place' : block ? 'block' : list ? 'list' : null
  // Карточку открыли кликом по зданию в сцене — шага назад нет
  const from = place && origin?.id === pick ? origin.from : null
  const fromBlock = typeof from === 'number' ? blocks[from] : undefined

  const openPlace = (id: string) => {
    setOrigin({ id, from: block ? block.index : 'list' })
    focusRef.current = 'head'
    store.setState({ pick: id })
  }
  const goBack = () => {
    focusRef.current = pick
    store.setState({ pick: fromBlock ? blockId(fromBlock.index) : null })
  }
  const close = () => {
    // Фокус из закрытой панели — туда, откуда она открывается: вывеска квартала или «ещё N»
    if (panelRef.current?.contains(document.activeElement)) {
      const at = place ? places.indexOf(place) : -1
      const n = block ? block.index : at >= 0 && at < ARCH_MAX ? Math.floor(at / ARCH_BLOCK) : null
      const target = n === null ? overRef.current : store.getState().labels.get(blockId(n))?.querySelector('button')
      target?.focus()
    }
    setList(false)
    setOrigin(null)
    store.setState({ pick: null })
  }
  const toggleList = () => {
    if (mode === 'list') return close()
    focusRef.current = 'head'
    setList(true)
    store.setState({ pick: null })
  }

  useEffect(() => {
    const want = focusRef.current
    if (!want) return
    focusRef.current = null
    const rows = panelRef.current?.querySelectorAll<HTMLElement>('[data-place]') ?? []
    const target = want === 'head' ? panelRef.current?.querySelector('button') : [...rows].find((row) => row.dataset.place === want)
    target?.focus()
  })

  // Escape: из карточки — шаг назад, иначе панель закрывается. Обработчик — через ref:
  // слушатель один на всё время жизни, а замыкание свежее.
  const escapeRef = useRef(() => {})
  useEffect(() => { escapeRef.current = () => { if (from !== null) goBack(); else if (mode) close() } })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') escapeRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const rest = place ? place.events - place.history.length : 0

  return (
    <>
      {blocks.map((item) => <BlockSign key={item.index} store={store} block={item} />)}
      <PlaceChips store={store} byId={byId} />
      <EmptySign store={store} />
      {/* В компактной сцене лист панели встаёт на место итога */}
      {places.length > 0 && !(compact && mode) && (
        <div className="w-atotal" data-w-chrome>
          <p className="w-plaque w-atotal__cap">
            <span className="w-cell"><b className="w-cell__num">{places.length.toLocaleString(locale)}</b><span className="w-cell__unit">{placesWord(places.length, tr)}</span></span>
            <span className="w-cell"><b className="w-cell__num">{events.toLocaleString(locale)}</b><span className="w-cell__unit">{eventsWord(events, tr)}</span></span>
          </p>
          {more > 0 && (
            <button type="button" className="w-plaque w-atotal__over" ref={overRef} aria-expanded={mode === 'list'} onClick={toggleList}>
              {tr(`Ещё ${more} ${placesWord(more, tr)} — списком`, `Yana ${more} ta joy — ro‘yxat bilan`)}
            </button>
          )}
        </div>
      )}
      {/* Одна панель на все режимы: смена содержимого не перезапускает её появление */}
      {mode && (
        <section
          className="w-plaque w-apanel"
          data-w-chrome="panel"
          ref={panelRef}
          aria-label={place ? tr(`Место: ${place.name}`, `Joy: ${place.name}`) : block ? blockName(block, tr) : tr('Все места', 'Barcha joylar')}
        >
          <div className="w-apanel__head">
            {from !== null && (
              <button type="button" className="w-apanel__back" onClick={goBack}>
                {fromBlock ? blockName(fromBlock, tr) : tr('Все места', 'Barcha joylar')}
              </button>
            )}
            {place ? (
              <div>
                <p className="w-apanel__kicker">{kindName(place.kind, tr)} · {place.city}</p>
                <h2 className="w-apanel__name">{place.name}</h2>
              </div>
            ) : block ? (
              <div>
                <p className="w-apanel__kicker">{tr('Квартал · последнее мероприятие', 'Kvartal · oxirgi tadbir')}</p>
                <h2 className="w-apanel__name">{blockLabel(block)} <span className="w-apanel__count">{block.count.toLocaleString(locale)}</span></h2>
              </div>
            ) : (
              <h2 className="w-apanel__name">{tr('Все места', 'Barcha joylar')} <span className="w-apanel__count">{places.length.toLocaleString(locale)}</span></h2>
            )}
            <button type="button" className="w-apanel__close" aria-label={tr('Закрыть', 'Yopish')} onClick={close}>×</button>
          </div>
          {!place && (
            <div className="w-apanel__rows">
              {(block ? places.slice(block.from, block.from + block.count) : places).map((item) => (
                <PlaceRow key={item.id} store={store} place={item} outside={places.indexOf(item) >= ARCH_MAX} onOpen={openPlace} />
              ))}
            </div>
          )}
          {place && (
            <>
              <div className="w-apanel__stats">
                <span className="w-cell w-apanel__cell"><b className="w-cell__num">{place.events.toLocaleString(locale)}</b><span className="w-cell__unit">{eventsWord(place.events, tr)}</span></span>
                <p className="w-apanel__last"><span>{tr('Последнее', 'Oxirgisi')}</span><b>{dateText(place.last, locale)}</b></p>
                {places.indexOf(place) >= ARCH_MAX && (
                  <p className="w-apanel__note">{tr(`В сцене стоят ${ARCH_MAX} самых свежих мест — это место есть только в списке.`, `Sahnada eng so‘nggi ${ARCH_MAX} ta joy turadi — bu joy faqat ro‘yxatda bor.`)}</p>
                )}
              </div>
              <div className="w-apanel__body">
                <h3 className="w-apanel__sub">{tr('История', 'Tarix')}</h3>
                <ol className="w-apanel__hist">
                  {place.history.map((entry, i) => (
                    <li key={i}>
                      <b>{entry.title}</b>
                      <span>{dateText(entry.date, locale)} · {entry.items.toLocaleString(locale)} {itemsWord(entry.items, tr)}</span>
                    </li>
                  ))}
                </ol>
                {rest > 0 && <p className="w-apanel__more">{tr(`Ещё ${rest} раньше — в разделе «Списки»`, `Yana ${rest} ta avvalroq — «Ro‘yxatlar» bo‘limida`)}</p>}
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}
