import { X } from 'lucide-react'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { formatDayRange, formatMonthShort, parseDateValue } from '../../../lib/date'
import { useLanguage } from '../../../lib/i18n'
import type { WorldVenue } from '../data/types'
import { lotPartId, parseLotId, useWorldState, type WorldLotPart, type WorldStore } from '../worldStore'
import { ruPlural } from './plural'
import './world-venues.css'

type Tr = (ru: string, uz: string) => string

// Даты мероприятия: num и unit — ячейке вывески («7–8», «окт»), text — словами в панель.
// Года нет, как и у плашки дня. null — дата в данных не разобралась.
function dateSpan(venue: WorldVenue, locale: string) {
  const from = parseDateValue(venue.dateFrom), to = parseDateValue(venue.dateTo)
  if (!from || !to) return null
  const d1 = from.getDate(), d2 = to.getDate(), m1 = formatMonthShort(from, locale), m2 = formatMonthShort(to, locale)
  return { num: d1 === d2 && m1 === m2 ? String(d1) : `${d1}–${d2}`, unit: m1 === m2 ? m1 : `${m1}–${m2}`, text: formatDayRange(from, to, locale) }
}

function kindName(kind: WorldVenue['kind'], tr: Tr) {
  if (kind === 'hotel') return tr('Отель-конгресс', 'Kongress-mehmonxona')
  if (kind === 'arena') return tr('Арена', 'Arena')
  return tr('Конгресс-холл', 'Kongress-xoll')
}

// Вывеска участка — одна на участок, над зданием: дата в ячейке и имя места. Рисуется
// порталом в якорь движка (класс w-sign w-sign--lot). Якорю движок ставит is-hover и
// is-selected только по точному id, а участок отвечает наведению и выбору любой своей
// части (грузовик, отель, план) — поэтому состояние ещё и классами на своих детях.
function LotSign({ store, venue }: { store: WorldStore; venue: WorldVenue }) {
  const { locale } = useLanguage()
  const id = lotPartId('lot', venue.id)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const hot = useWorldState(store, (state) => parseLotId(state.hover)?.venueId === venue.id)
  const on = useWorldState(store, (state) => parseLotId(state.pick)?.venueId === venue.id)
  if (!anchor) return null

  const span = dateSpan(venue, locale)
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
        aria-label={span ? `${venue.name}, ${span.text}` : venue.name}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
        // Повторное нажатие снимает выбор — панель закрывается
        onClick={() => store.setState({ pick: on ? null : id })}
      >
        {span && <span className="w-cell"><b className="w-cell__num">{span.num}</b><span className="w-cell__unit">{span.unit}</span></span>}
        <span className="w-sign__name">{venue.name}</span>
      </button>
    </>,
    anchor,
  )
}

// Панель выбранного места: имя целиком, мероприятие, зал, даты и три секции. Секция
// выбранного блока сцены отмечена: грузовик → оборудование, отель → расселение, стол
// плана → залы. Только чтение: списка, расселения и плана как разделов у места ещё нет.
function LotCard({ store, venue, part }: { store: WorldStore; venue: WorldVenue; part: WorldLotPart }) {
  const { tr, locale } = useLanguage()
  const titleId = useId()
  // Esc снимает выбор — как клик по пустой земле зоны
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') store.setState({ pick: null }) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [store])

  const span = dateSpan(venue, locale)
  const count = (n: number, ru: [string, string, string], uz: string) => `${n.toLocaleString(locale)} ${tr(ruPlural(n, ...ru), uz)}`
  const { gearCount, stay, halls } = venue

  return (
    <aside className="w-plaque w-vpanel" aria-labelledby={titleId} data-w-chrome="panel">
      <header className="w-vpanel__head">
        <div>
          <h2 className="w-vpanel__name" id={titleId}>{venue.name}</h2>
          <p className="w-vpanel__kind">{tr('Площадка', 'Maydon')} · {kindName(venue.kind, tr)}</p>
        </div>
        <button type="button" className="w-vpanel__close" aria-label={tr('Закрыть', 'Yopish')} onClick={() => store.setState({ pick: null })}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="w-vpanel__body">
        <dl className="w-vpanel__facts">
          <div><dt>{tr('Мероприятие', 'Tadbir')}</dt><dd>{venue.title}</dd></div>
          <div><dt>{tr('Зал', 'Zal')}</dt><dd>{venue.hall}</dd></div>
          {span && <div><dt>{tr('Даты', 'Sanalar')}</dt><dd>{span.text}</dd></div>}
        </dl>
        <section className={`w-vsec${part === 'truck' ? ' is-on' : ''}`}>
          <h3 className="w-vsec__head">
            <span>{tr('Оборудование', 'Uskunalar')}</span>
            {gearCount !== null && <span className="w-vsec__count">{count(gearCount, ['позиция', 'позиции', 'позиций'], 'pozitsiya')}</span>}
          </h3>
          {gearCount === null && <p className="w-vsec__note">{tr('Список к месту не привязан', 'Joyga ro‘yxat biriktirilmagan')}</p>}
        </section>
        <section className={`w-vsec${part === 'stay' ? ' is-on' : ''}`}>
          <h3 className="w-vsec__head">
            <span>{tr('Расселение', 'Joylashtirish')}</span>
            {stay && <span className="w-vsec__count">{count(stay.people, ['человек', 'человека', 'человек'], 'kishi')}</span>}
          </h3>
          {stay
            ? <p className="w-vsec__line">{stay.hotel} · {count(stay.rooms, ['номер', 'номера', 'номеров'], 'xona')}</p>
            : <p className="w-vsec__note">{tr('Расселения нет', 'Joylashtirish yo‘q')}</p>}
        </section>
        <section className={`w-vsec${part === 'plan' ? ' is-on' : ''}`}>
          <h3 className="w-vsec__head">
            <span>{tr('Залы', 'Zallar')}</span>
            {halls.length > 0 && <span className="w-vsec__count">{halls.length.toLocaleString(locale)}</span>}
          </h3>
          {halls.length > 0
            ? <ul className="w-vsec__halls">{halls.map((hall, i) => <li key={i}>{hall}</li>)}</ul>
            : <p className="w-vsec__note">{tr('Залы не заведены', 'Zallar kiritilmagan')}</p>}
          <p className="w-vsec__note">{venue.hasPlan ? tr('План залов есть', 'Zallar rejasi bor') : tr('Плана залов нет', 'Zallar rejasi yo‘q')}</p>
        </section>
      </div>
    </aside>
  )
}

type Props = {
  store: WorldStore
  venues: WorldVenue[]
}

// HUD «Площадок»: вывески участков (порталами в якоря движка), панель выбранного места.
// Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора: parseLotId(pick)
// даёт часть участка и id места (контракт — worldStore.ts). Вывески встают только у
// мест, которым движок дал якорь: в сетке шесть участков.
export function VenuePanel({ store, venues }: Props) {
  const { tr } = useLanguage()
  const pick = useWorldState(store, (state) => state.pick)
  const lot = parseLotId(pick)
  const venue = lot ? venues.find((item) => item.id === lot.venueId) : undefined

  return (
    <>
      {venues.map((item) => <LotSign key={item.id} store={store} venue={item} />)}
      {lot && venue && <LotCard key={venue.id} store={store} venue={venue} part={lot.part} />}
      {/* Пустая зона: в сцене только «плюс» новой площадки — словами, что здесь будет */}
      {venues.length === 0 && (
        <div className="w-plaque w-vnone" data-w-chrome>
          <b>{tr('Площадок пока нет', 'Hozircha maydonlar yo‘q')}</b>
          <span>{tr('Место появится здесь, когда к нему привяжут список оборудования или расселение', 'Joy unga uskunalar ro‘yxati yoki joylashtirish biriktirilganda shu yerda paydo bo‘ladi')}</span>
        </div>
      )}
    </>
  )
}
