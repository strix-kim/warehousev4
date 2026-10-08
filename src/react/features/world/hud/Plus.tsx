import { createPortal } from 'react-dom'
import { useLanguage } from '../../../lib/i18n'
import { ADD_LOT_ID, useWorldState, type WorldStore } from '../worldStore'

// «Плюс» над пустым местом — кнопка в якоре движка (класс w-plus, свободная подпись):
// она же дубль цели в сцене для клавиатуры и скринридера. Подпись — по виду места.
export function Plus({ store, id, onActivate }: { store: WorldStore; id: string; onActivate: (id: string) => void }) {
  const { tr } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  if (!anchor) return null
  // name — что произойдёт (скринридеру), cap — короткая подпись на плашке
  const [name, cap] = id === ADD_LOT_ID ? [tr('Добавить мероприятие', 'Tadbir qo‘shish'), tr('Новое мероприятие', 'Yangi tadbir')]
    : id.startsWith('addtruck:') ? [tr('Добавить список оборудования', 'Uskunalar ro‘yxatini qo‘shish'), tr('Список', 'Ro‘yxat')]
      : [tr('Добавить план залов', 'Zallar rejasini qo‘shish'), tr('План залов', 'Zallar rejasi')]
  const enter = () => store.setState({ hover: id })
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return createPortal(
    <button type="button" className="w-plus__btn" aria-label={name} onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} onClick={() => onActivate(id)}>
      <span className="w-plus__ico" aria-hidden="true" />
      <span className="w-plus__cap">{cap}</span>
    </button>,
    anchor,
  )
}
