import { createPortal } from 'react-dom'
import { useLanguage } from '../../../lib/i18n'
import { ADD_LOT_ID, useWorldState, type WorldStore } from '../worldStore'

// «Плюс» над пустым местом — кнопка в якоре движка (класс w-plus, свободная подпись):
// она же дубль цели в сцене для клавиатуры и скринридера. Подпись — по виду места.
export function Plus({ store, id, onActivate }: { store: WorldStore; id: string; onActivate: (id: string) => void }) {
  const { tr } = useLanguage()
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  if (!anchor) return null
  const name = id === ADD_LOT_ID ? tr('Новая площадка', 'Yangi maydon')
    : id.startsWith('addstay:') ? tr('Добавить расселение', 'Joylashtirishni qo‘shish')
      : tr('Добавить план залов', 'Zallar rejasini qo‘shish')
  const enter = () => store.setState({ hover: id })
  const leave = () => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return createPortal(
    <button type="button" className="w-plus__btn" aria-label={name} onPointerEnter={enter} onPointerLeave={leave} onFocus={enter} onBlur={leave} onClick={() => onActivate(id)}>
      <span className="w-plus__ico" aria-hidden="true" />
      <span className="w-plus__cap">{name}</span>
    </button>,
    anchor,
  )
}
