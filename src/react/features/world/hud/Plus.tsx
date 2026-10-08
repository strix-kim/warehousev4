import { createPortal } from 'react-dom'
import { useLanguage } from '../../../lib/i18n'
import { ADD_CAR_ID, ADD_LOT_ID, useWorldState, type WorldStore } from '../worldStore'

// «Плюс» над пустым местом — кнопка в якоре движка (класс w-plus, свободная подпись):
// она же дубль цели в сцене для клавиатуры и скринридера. Подпись — по виду места.
// busy — «строится»: мероприятие пишется в базу и мир ждёт свежий реестр. Кнопка занята
// (aria-busy), но не disabled: фокус с неё не слетает, а повторный клик гасит диспетчер.
export function Plus({ store, id, busy = false, onActivate }: { store: WorldStore; id: string; busy?: boolean; onActivate: (id: string) => void }) {
  const { tr } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  if (!anchor) return null
  // name — что произойдёт (скринридеру), cap — короткая подпись на плашке
  const [name, cap] = id === ADD_LOT_ID ? [tr('Добавить мероприятие', 'Tadbir qo‘shish'), tr('Новое мероприятие', 'Yangi tadbir')]
    : id === ADD_CAR_ID ? [tr('Добавить машину', 'Mashina qo‘shish'), tr('Новая машина', 'Yangi mashina')]
    : id.startsWith('addtruck:') ? [tr('Добавить список оборудования', 'Uskunalar ro‘yxatini qo‘shish'), tr('Список', 'Ro‘yxat')]
      : id.startsWith('addcrew:') ? [tr('Добавить состав', 'Tarkib qo‘shish'), tr('Состав', 'Tarkib')]
        : [tr('Добавить план залов', 'Zallar rejasini qo‘shish'), tr('План залов', 'Zallar rejasi')]
  // У выбранного участка подписи трёх «плюсов» расходятся от кружков в разные стороны
  // (world-hud.css): места стоят рядом, и подписи по центру якоря перекрывались.
  // Грузовик спереди — влево, стол плана справа — вправо, бригада у входа — вверх.
  const side = id.startsWith('addtruck:') ? ' w-plus__btn--left' : id.startsWith('addcrew:') ? ' w-plus__btn--up' : ''
  const enter = () => store.setState({ hover: id })
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return createPortal(
    <button type="button" className={`w-plus__btn${side}${busy ? ' is-busy' : ''}`} aria-label={busy ? tr('Мероприятие создаётся', 'Tadbir yaratilmoqda') : name} aria-busy={busy} aria-disabled={busy} onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} onClick={() => { if (!busy) onActivate(id) }}>
      <span className="w-plus__ico" aria-hidden="true" />
      <span className="w-plus__cap">{busy ? tr('Строится…', 'Qurilmoqda…') : cap}</span>
    </button>,
    anchor,
  )
}
