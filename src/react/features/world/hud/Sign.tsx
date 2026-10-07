import { createPortal } from 'react-dom'
import { useLanguage } from '../../../lib/i18n'
import { useWorldState, type WorldSiteId, type WorldStore } from '../worldStore'

type Tr = (ru: string, uz: string) => string

// Склонение для русского — то же правило, что у ruPlural на главной (HomePage.tsx):
// там хелпер локальный и не экспортируется. В узбекском счётное слово не склоняется.
function ruPlural(count: number, one: string, few: string, many: string) {
  const rule = new Intl.PluralRules('ru').select(count)
  return rule === 'one' ? one : rule === 'few' ? few : many
}

// Единица под числом. Склад — слово плитки главной («штук» / «dona»)
function unitWord(id: WorldSiteId, count: number, tr: Tr) {
  if (id === 'office') return tr(ruPlural(count, 'список', 'списка', 'списков'), 'ro‘yxat')
  if (id === 'warehouse') return tr(ruPlural(count, 'штука', 'штуки', 'штук'), 'dona')
  return tr(ruPlural(count, 'машина', 'машины', 'машин'), 'avtomobil')
}

type Props = {
  store: WorldStore
  id: WorldSiteId
  name: string
  // null — источника числа нет: вывеска без ячейки, только имя
  count: number | null
  onActivate: (id: WorldSiteId) => void
}

// Вывеска здания («Знаки B2»). Рисуется порталом в элемент-якорь движка: сам якорь
// (классы, --shift, --lift) не трогаем — только дети. Движок меряет board.
export function Sign({ store, id, name, count, onActivate }: Props) {
  const { tr, locale } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  const picked = useWorldState(store, (state) => state.pick === id)
  if (!anchor) return null

  const number = count === null ? null : count.toLocaleString(locale)
  const unit = count === null ? null : unitWord(id, count, tr)
  const enter = () => store.setState({ hover: id })
  // Уход снимает наведение, только если оно всё ещё наше: указатель мог уже перейти
  // на здание в сцене, и hover к этому моменту поставил движок
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return createPortal(
    <>
      <span className="w-sign__leg" />
      <button
        type="button"
        className="w-sign__board"
        aria-pressed={picked}
        // В компактном виде единицу прячет CSS — в имени кнопки она остаётся
        aria-label={number === null ? undefined : `${name}: ${number} ${unit}`}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
        onClick={() => onActivate(id)}
      >
        {number !== null && (
          <span className="w-cell"><b className="w-cell__num">{number}</b><span className="w-cell__unit">{unit}</span></span>
        )}
        <span className="w-sign__name">{name}</span>
      </button>
    </>,
    anchor,
  )
}
