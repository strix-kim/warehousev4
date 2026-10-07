import { useLanguage } from '../../../lib/i18n'
import { useWorldState, WORLD_SITES, type WorldSiteId, type WorldStore } from '../worldStore'
import { SiteIcon } from './icons'

type Props = {
  store: WorldStore
  names: Record<WorldSiteId, string>
  onActivate: (id: WorldSiteId) => void
}

// Клавиши-дубли: клавиатурный и текстовый путь к каждому зданию. data-w-chrome —
// неподвижная обвязка, вывески её обходят (контракт HUD в worldStore.ts).
export function Dock({ store, names, onActivate }: Props) {
  const { tr } = useLanguage()
  const hover = useWorldState(store, (state) => state.hover)
  const pick = useWorldState(store, (state) => state.pick)
  // Уход снимает наведение, только если оно всё ещё наше — как у вывески
  const leave = (id: WorldSiteId) => { if (store.getState().hover === id) store.setState({ hover: null }) }

  return (
    <div className="w-dock" role="group" aria-label={tr('Разделы', 'Bo‘limlar')} data-w-chrome>
      {WORLD_SITES.map((id) => (
        <button
          key={id}
          type="button"
          className={`w-plaque w-key${hover === id ? ' is-hover' : ''}`}
          aria-pressed={pick === id}
          onPointerEnter={() => store.setState({ hover: id })}
          onPointerLeave={() => leave(id)}
          onFocus={() => store.setState({ hover: id })}
          onBlur={() => leave(id)}
          onClick={() => onActivate(id)}
        >
          <SiteIcon id={id} />
          <span className="w-key__name">{names[id]}</span>
        </button>
      ))}
    </div>
  )
}
