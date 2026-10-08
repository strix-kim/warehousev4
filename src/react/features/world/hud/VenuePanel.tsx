import { Lock, Utensils } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../lib/i18n'
import type { WorldAction } from '../actions/useWorldActions'
import { LOT_MAX } from '../data/splitProjects'
import type { WorldLot } from '../data/types'
import { lotPartId, parseLotId, useWorldState, type WorldStore } from '../worldStore'
import { dateSpan, LotCard } from './LotCard'
import { ruPlural } from './plural'
import './world-venues.css'

// Вывеска участка — одна на участок, над зданием: дата в ячейке и имя мероприятия. Рисуется
// порталом в якорь движка (класс w-sign w-sign--lot). Якорю движок ставит is-hover и
// is-selected только по точному id, а участок отвечает наведению и выбору любой своей
// части (грузовик, план) — поэтому состояние ещё и классами на своих детях.
function LotSign({ store, lot }: { store: WorldStore; lot: WorldLot }) {
  const { locale } = useLanguage()
  const id = lotPartId('lot', lot.id)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const hot = useWorldState(store, (state) => parseLotId(state.hover)?.venueId === lot.id)
  const on = useWorldState(store, (state) => parseLotId(state.pick)?.venueId === lot.id)
  if (!anchor) return null

  const span = dateSpan(lot, locale)
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
        // Имя в вывеске обрезается, в компактной его нет вовсе — в имени кнопки оно целиком
        aria-label={span ? `${lot.name}, ${span.text}` : lot.name}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
        // Повторное нажатие снимает выбор — панель закрывается
        onClick={() => store.setState({ pick: on ? null : id })}
      >
        {span && <span className="w-cell"><b className="w-cell__num">{span.num}</b><span className="w-cell__unit">{span.unit}</span></span>}
        <span className="w-sign__name">{lot.name}</span>
      </button>
    </>,
    anchor,
  )
}

// Таблички кафе и отеля — только у выбранного участка: якоря (класс w-tag, свободная
// подпись) движок ставит у каждого, текст кладём порталом. Кафе — кнопка: выбирает
// свою часть, панель отмечает секцию «Обеды», а уводит со сцены ссылка в панели.
// Отель заперт: надпись с замком, мышь не ловит и в tab-порядок не входит.
function LotTags({ store, lot }: { store: WorldStore; lot: WorldLot }) {
  const { tr } = useLanguage()
  const cafeId = lotPartId('cafe', lot.id)
  const cafe = useWorldState(store, (state) => state.labels.get(cafeId))
  const stay = useWorldState(store, (state) => state.labels.get(lotPartId('stay', lot.id)))
  const on = useWorldState(store, (state) => state.pick === cafeId)
  const enter = () => store.setState({ hover: cafeId })
  const leave = () => { if (store.getState().hover === cafeId) store.setState({ hover: null }) }

  return (
    <>
      {cafe && createPortal(
        <button type="button" className="w-tag__btn" aria-pressed={on} onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} onClick={() => store.setState({ pick: cafeId })}>
          <Utensils size={13} aria-hidden="true" />
          {tr('Обеды', 'Ovqatlanish')}
        </button>,
        cafe,
      )}
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
