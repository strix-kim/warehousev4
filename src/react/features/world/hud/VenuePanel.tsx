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

// Кнопка-табличка в якоре движка (класс w-tag, свободная подпись): выбирает свою часть
// участка — панель отмечает секцию, а действие в панели. name — имя кнопки там, где
// слов на табличке нет или их мало (число, «!»). Ею же стоят номера машин в гараже
// (GaragePanel.tsx): plate — моноширинный текст, как на знаке.
export function TagButton({ store, id, anchor, name, alert, plate, children }: { store: WorldStore; id: string; anchor: HTMLElement; name?: string; alert?: boolean; plate?: boolean; children: ReactNode }) {
  const pressed = useWorldState(store, (state) => state.pick === id)
  const enter = () => store.setState({ hover: id })
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }
  return createPortal(
    <button
      type="button"
      className={`w-tag__btn${alert ? ' w-tag__btn--alert' : ''}${plate ? ' w-tag__btn--plate' : ''}`}
      aria-label={name}
      aria-pressed={pressed}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      onClick={() => store.setState({ pick: id })}
    >
      {children}
    </button>,
    anchor,
  )
}

// Табличка кафе — у каждого участка сетки свой якорь. У выбранного участка это «Обеды»;
// у участка с делом про обед на сегодня (alert) — маркер «!»: один, без слов, виден и
// без выбора. Выбран участок с делом — «!» переезжает бейджем внутрь таблички. Кнопка
// одна и та же в обоих видах: клик по маркеру выбирает кафе, и фокус остаётся на ней.
function CafeTag({ store, lot, alert }: { store: WorldStore; lot: WorldLot; alert: boolean }) {
  const { tr } = useLanguage()
  const id = lotPartId('cafe', lot.id)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const on = useWorldState(store, (state) => parseLotId(state.pick)?.venueId === lot.id)
  if (!anchor || (!on && !alert)) return null

  const bang = <span className="w-tag__bang" aria-hidden="true">!</span>
  const warning = tr(`Обед на сегодня не заказан: ${lot.name}`, `Bugungi tushlik buyurtma qilinmagan: ${lot.name}`)
  if (!on) return <TagButton store={store} id={id} anchor={anchor} name={warning} alert>{bang}</TagButton>
  return (
    <TagButton store={store} id={id} anchor={anchor} name={alert ? `${tr('Обеды', 'Ovqatlanish')}. ${warning}` : undefined}>
      <Utensils size={13} aria-hidden="true" />{tr('Обеды', 'Ovqatlanish')}{alert && bang}
    </TagButton>
  )
}

// Таблички бригады и отеля — только у выбранного участка: якоря (класс w-tag) ставит
// движок, текст кладём порталом. Якорь бригады движок ставит, только когда в составе
// кто-то есть; фигурок в сцене не больше CREW_MAX, число на табличке — весь состав.
// Отель заперт: надпись с замком, мышь не ловит и в tab-порядок не входит.
function LotTags({ store, lot }: { store: WorldStore; lot: WorldLot }) {
  const { tr, locale } = useLanguage()
  const crewId = lotPartId('crew', lot.id)
  const crew = useWorldState(store, (state) => state.labels.get(crewId))
  const stay = useWorldState(store, (state) => state.labels.get(lotPartId('stay', lot.id)))
  const people = lot.staff.toLocaleString(locale)

  return (
    <>
      {crew && (
        <TagButton store={store} id={crewId} anchor={crew} name={tr(`Состав: ${people} ${ruPlural(lot.staff, 'человек', 'человека', 'человек')}`, `Tarkib: ${people} kishi`)}>
          <Users size={13} aria-hidden="true" />{people}
        </TagButton>
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
  // id мероприятий с делом про обед на сегодня (data/quests.ts, meal-missing и
  // meal-collecting): над их кафе стоит маркер «!» (CafeTag)
  mealAlerts?: ReadonlySet<string>
}

// HUD «Площадок»: вывески участков (порталами в якоря движка), таблички, маркеры «!» и панель
// выбранного участка (LotCard.tsx). Смонтирован, пока камера стоит на зоне. Выбранное — pick из стора:
// parseLotId(pick) даёт часть участка и id мероприятия (контракт — worldStore.ts).
// Вывески встают только у участков, которым движок дал якорь: в сетке их LOT_MAX.
export function VenuePanel({ store, venues, onAction, mealAlerts }: Props) {
  const { tr, locale } = useLanguage()
  const pick = useWorldState(store, (state) => state.pick)
  const picked = parseLotId(pick)
  const lot = picked ? venues.find((item) => item.id === picked.venueId) : undefined
  const more = venues.length - LOT_MAX

  return (
    <>
      {venues.slice(0, LOT_MAX).map((item) => <LotSign key={item.id} store={store} lot={item} />)}
      {venues.slice(0, LOT_MAX).map((item) => <CafeTag key={`cafe:${item.id}`} store={store} lot={item} alert={mealAlerts?.has(item.id) ?? false} />)}
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
