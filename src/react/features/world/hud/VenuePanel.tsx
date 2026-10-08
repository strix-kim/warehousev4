import { Lock, Users, Utensils } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../lib/i18n'
import type { WorldAction } from '../actions/useWorldActions'
import { lotReadiness } from '../data/readiness'
import { LOT_MAX } from '../data/splitProjects'
import type { WorldLot } from '../data/types'
import { lotPartId, parseLotId, useWorldState, type WorldStore } from '../worldStore'
import { dateSpan, LotCard } from './LotCard'
import { ruPlural } from './plural'
import './world-venues.css'

// Вывеска участка — одна на участок, над зданием: дата в ячейке, имя мероприятия и
// готовность четырьмя точками (площадка, список, план, состав — data/readiness.ts;
// закрашенная — готово, контур — нет). Рисуется порталом в якорь движка (класс w-sign
// w-sign--lot); точки лежат внутри доски, своего якоря у них нет — раскладка меряет
// доску как есть. Якорю движок ставит is-hover и is-selected только по точному id, а
// участок отвечает наведению и выбору любой своей части (грузовик, план) — поэтому
// состояние ещё и классами на своих детях.
function LotSign({ store, lot }: { store: WorldStore; lot: WorldLot }) {
  const { tr, locale } = useLanguage()
  const id = lotPartId('lot', lot.id)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const hot = useWorldState(store, (state) => parseLotId(state.hover)?.venueId === lot.id)
  const on = useWorldState(store, (state) => parseLotId(state.pick)?.venueId === lot.id)
  if (!anchor) return null

  const span = dateSpan(lot, locale)
  const ready = lotReadiness(lot)
  const readyText = tr(`готово ${ready.done} из ${ready.items.length}`, `${ready.items.length} tadan ${ready.done} tasi tayyor`)
  const enter = () => store.setState({ hover: id })
  // Уход снимает наведение, только если оно всё ещё наше — как у вывески здания
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return createPortal(
    <>
      <span className={`w-sign__leg${on ? ' is-on' : ''}`} />
      <button
        type="button"
        className={`w-sign__board${hot ? ' is-hot' : ''}${on ? ' is-on' : ''}`}
        aria-pressed={on}
        // Имя в вывеске обрезается, в компактной его нет вовсе — в имени кнопки оно целиком;
        // точки готовности — там же словами
        aria-label={[lot.name, span?.text, readyText].filter(Boolean).join(', ')}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
        // Повторное нажатие снимает выбор — панель закрывается
        onClick={() => store.setState({ pick: on ? null : id })}
      >
        {span && <span className="w-cell"><b className="w-cell__num">{span.num}</b><span className="w-cell__unit">{span.unit}</span></span>}
        <span className="w-sign__name">{lot.name}</span>
        <span className="w-ready" aria-hidden="true">
          {ready.items.map((item) => <i key={item.key} className={item.done ? 'is-done' : undefined} />)}
        </span>
      </button>
    </>,
    anchor,
  )
}

// Таблички кафе, бригады и отеля — только у выбранного участка: якоря (класс w-tag,
// свободная подпись) ставит движок, текст кладём порталом. Кафе и бригада — кнопки:
// выбирают свою часть, панель отмечает секцию («Обеды», «Состав»), а действие — в
// панели. Якорь бригады движок ставит, только когда в составе кто-то есть; фигурок в
// сцене не больше CREW_MAX, число на табличке — весь состав. Отель заперт: надпись с
// замком, мышь не ловит и в tab-порядок не входит.
function LotTags({ store, lot }: { store: WorldStore; lot: WorldLot }) {
  const { tr, locale } = useLanguage()
  const cafeId = lotPartId('cafe', lot.id), crewId = lotPartId('crew', lot.id)
  const cafe = useWorldState(store, (state) => state.labels.get(cafeId))
  const crew = useWorldState(store, (state) => state.labels.get(crewId))
  const stay = useWorldState(store, (state) => state.labels.get(lotPartId('stay', lot.id)))
  const pick = useWorldState(store, (state) => state.pick)
  // name — имя кнопки там, где на табличке одно число
  const tag = (id: string, anchor: HTMLElement | undefined, body: ReactNode, name?: string) => anchor && createPortal(
    <button
      type="button"
      className="w-tag__btn"
      aria-label={name}
      aria-pressed={pick === id}
      onPointerEnter={() => store.setState({ hover: id })}
      onPointerLeave={() => { if (store.getState().hover === id) store.setState({ hover: null }) }}
      onFocus={() => store.setState({ hover: id })}
      onBlur={() => { if (store.getState().hover === id) store.setState({ hover: null }) }}
      onClick={() => store.setState({ pick: id })}
    >
      {body}
    </button>,
    anchor,
  )
  const people = lot.staff.toLocaleString(locale)

  return (
    <>
      {tag(cafeId, cafe, <><Utensils size={13} aria-hidden="true" />{tr('Обеды', 'Ovqatlanish')}</>)}
      {tag(crewId, crew, <><Users size={13} aria-hidden="true" />{people}</>, tr(`Состав: ${people} ${ruPlural(lot.staff, 'человек', 'человека', 'человек')}`, `Tarkib: ${people} kishi`))}
      {stay && createPortal(
        <span className="w-tag__lock"><Lock size={13} aria-hidden="true" />{tr('Расселение — скоро', 'Joylashtirish — tez orada')}</span>,
        stay,
      )}
    </>
  )
}

type Props = {
  store: WorldStore
  // Все идущие и будущие мероприятия по дате начала; в сцене — первые LOT_MAX
  venues: WorldLot[]
  // Действие дровером поверх сцены (хост — WorldStage); не передан — карточка участка
  // работает одними ссылками
  onAction?: (action: WorldAction) => void
  // id мероприятий с делом про обед на сегодня (data/quests.ts, meal-missing и
  // meal-collecting): над их кафе стоит маркер «!»
  mealAlerts?: ReadonlySet<string>
}

// HUD «Площадок»: вывески участков (порталами в якоря движка), таблички и панель
// выбранного участка (LotCard.tsx). Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора:
// parseLotId(pick) даёт часть участка и id мероприятия (контракт — worldStore.ts).
// Вывески встают только у участков, которым движок дал якорь: в сетке их LOT_MAX.
export function VenuePanel({ store, venues, onAction }: Props) {
  const { tr, locale } = useLanguage()
  const pick = useWorldState(store, (state) => state.pick)
  const picked = parseLotId(pick)
  const lot = picked ? venues.find((item) => item.id === picked.venueId) : undefined
  const more = venues.length - LOT_MAX

  return (
    <>
      {venues.slice(0, LOT_MAX).map((item) => <LotSign key={item.id} store={store} lot={item} />)}
      {lot && <LotTags key={`tags:${lot.id}`} store={store} lot={lot} />}
      {picked && lot && <LotCard key={lot.id} store={store} lot={lot} part={picked.part} onAction={onAction} />}
      {/* Пустая зона: в сцене только «плюс» нового мероприятия — словами, что здесь будет */}
      {venues.length === 0 && (
        <div className="w-plaque w-vnone" data-w-chrome>
          <b>{tr('Мероприятий впереди нет', 'Oldinda tadbirlar yo‘q')}</b>
          <span>{tr('Идущее или будущее мероприятие встанет здесь участком', 'Davom etayotgan yoki kelgusi tadbir shu yerda maydon bo‘lib turadi')}</span>
        </div>
      )}
      {/* В сетке шесть участков: остальные мероприятия — в реестре. Пока открыта панель
          участка, строка не показывается: в компактной сцене они делят низ кадра */}
      {more > 0 && !lot && (
        <div className="w-plaque w-vnone" data-w-chrome>
          <b>{tr(`Ещё ${more.toLocaleString(locale)} ${ruPlural(more, 'мероприятие', 'мероприятия', 'мероприятий')}`, `Yana ${more.toLocaleString(locale)} ta tadbir`)}</b>
          <Link to="/projects">{tr('Все мероприятия', 'Barcha tadbirlar')}</Link>
        </div>
      )}
    </>
  )
}
