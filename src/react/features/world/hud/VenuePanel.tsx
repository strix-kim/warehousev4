import { X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { formatDayRange, formatMonthShort, parseDateValue } from '../../../lib/date'
import { useLanguage } from '../../../lib/i18n'
import { LOT_MAX } from '../data/splitProjects'
import type { WorldLot } from '../data/types'
import { lotPartId, parseLotId, useWorldState, type WorldLotPart, type WorldStore } from '../worldStore'
import { ruPlural } from './plural'
import './world-venues.css'

// Даты мероприятия: num и unit — ячейке вывески («7–8», «окт»), text — словами в панель.
// Года нет, как и у плашки дня. Нет dateTo — один день. null — даты нет или она не
// разобралась.
function dateSpan(lot: WorldLot, locale: string) {
  const from = lot.dateFrom ? parseDateValue(lot.dateFrom) : null, to = lot.dateTo ? parseDateValue(lot.dateTo) : from
  if (!from || !to) return null
  const d1 = from.getDate(), d2 = to.getDate(), m1 = formatMonthShort(from, locale), m2 = formatMonthShort(to, locale)
  return { num: d1 === d2 && m1 === m2 ? String(d1) : `${d1}–${d2}`, unit: m1 === m2 ? m1 : `${m1}–${m2}`, text: formatDayRange(from, to, locale) }
}

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

// Панель выбранного участка: мероприятие, заказчик, место, даты и секции. Секция
// выбранного блока сцены отмечена: грузовик → оборудование, стол плана → план залов.
// Только чтение: счётчики — из реестра мероприятий, действия по секциям — Э2 плана
// world-work-s58; отсюда один путь — на страницу мероприятия.
function LotCard({ store, lot, part }: { store: WorldStore; lot: WorldLot; part: WorldLotPart }) {
  const { tr, locale } = useLanguage()
  const titleId = useId()
  // Esc снимает выбор — как клик по пустой земле зоны
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') store.setState({ pick: null }) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [store])

  const span = dateSpan(lot, locale)
  const count = (n: number, ru: [string, string, string], uz: string) => `${n.toLocaleString(locale)} ${tr(ruPlural(n, ...ru), uz)}`
  const { place, lists, staff } = lot

  return (
    <aside className="w-plaque w-vpanel" aria-labelledby={titleId} data-w-chrome="panel">
      <header className="w-vpanel__head">
        <div>
          <h2 className="w-vpanel__name" id={titleId}>{lot.name}</h2>
          <p className="w-vpanel__kind">{tr('Мероприятие', 'Tadbir')}</p>
        </div>
        <button type="button" className="w-vpanel__close" aria-label={tr('Закрыть', 'Yopish')} onClick={() => store.setState({ pick: null })}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="w-vpanel__body">
        <dl className="w-vpanel__facts">
          <div><dt>{tr('Заказчик', 'Buyurtmachi')}</dt><dd>{lot.client ?? tr('Не указан', 'Ko‘rsatilmagan')}</dd></div>
          <div><dt>{tr('Место', 'Joy')}</dt><dd>{place ? `${place.name}, ${place.city}` : tr('Площадка не указана', 'Maydon ko‘rsatilmagan')}</dd></div>
          <div><dt>{tr('Даты', 'Sanalar')}</dt><dd>{span ? span.text : tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
        </dl>
        <section className={`w-vsec${part === 'truck' || part === 'addtruck' ? ' is-on' : ''}`}>
          <h3 className="w-vsec__head">
            <span>{tr('Оборудование', 'Uskunalar')}</span>
            {lists > 0 && <span className="w-vsec__count">{count(lists, ['список', 'списка', 'списков'], 'ro‘yxat')}</span>}
          </h3>
          {lists === 0 && <p className="w-vsec__note">{tr('Списков оборудования нет', 'Uskunalar ro‘yxatlari yo‘q')}</p>}
        </section>
        <section className="w-vsec">
          <h3 className="w-vsec__head">
            <span>{tr('Состав', 'Tarkib')}</span>
            {staff > 0 && <span className="w-vsec__count">{count(staff, ['человек', 'человека', 'человек'], 'kishi')}</span>}
          </h3>
          {staff === 0 && <p className="w-vsec__note">{tr('Состав не указан', 'Tarkib ko‘rsatilmagan')}</p>}
        </section>
        <section className={`w-vsec${part === 'plan' || part === 'addplan' ? ' is-on' : ''}`}>
          <h3 className="w-vsec__head">
            <span>{tr('План залов', 'Zallar rejasi')}</span>
            {lot.hasPlan && <span className="w-vsec__count">{tr('есть', 'bor')}</span>}
          </h3>
          {!lot.hasPlan && <p className="w-vsec__note">{tr('Плана залов нет', 'Zallar rejasi yo‘q')}</p>}
        </section>
        {/* Таблиц расселения в базе нет: секция честно говорит, что её ещё нет */}
        <section className={`w-vsec${part === 'stay' ? ' is-on' : ''}`}>
          <p className="w-vsec__note">{tr('Расселение появится с модулем расселения', 'Joylashtirish joylashtirish moduli bilan paydo bo‘ladi')}</p>
        </section>
        <p className="w-vpanel__open">
          <Link className="button button--secondary" to={`/projects/${lot.id}`}>{tr('Открыть мероприятие', 'Tadbirni ochish')}</Link>
        </p>
      </div>
    </aside>
  )
}

type Props = {
  store: WorldStore
  // Все идущие и будущие мероприятия по дате начала; в сцене — первые LOT_MAX
  venues: WorldLot[]
}

// HUD «Площадок»: вывески участков (порталами в якоря движка), панель выбранного
// участка. Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора:
// parseLotId(pick) даёт часть участка и id мероприятия (контракт — worldStore.ts).
// Вывески встают только у участков, которым движок дал якорь: в сетке их LOT_MAX.
export function VenuePanel({ store, venues }: Props) {
  const { tr, locale } = useLanguage()
  const pick = useWorldState(store, (state) => state.pick)
  const picked = parseLotId(pick)
  const lot = picked ? venues.find((item) => item.id === picked.venueId) : undefined
  const more = venues.length - LOT_MAX

  return (
    <>
      {venues.slice(0, LOT_MAX).map((item) => <LotSign key={item.id} store={store} lot={item} />)}
      {picked && lot && <LotCard key={lot.id} store={store} lot={lot} part={picked.part} />}
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
