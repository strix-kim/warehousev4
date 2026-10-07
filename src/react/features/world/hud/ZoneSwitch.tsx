import { useLanguage } from '../../../lib/i18n'
import { gateId, useWorldState, type WorldStore, type WorldTexts, type WorldZone } from '../worldStore'

type Props = {
  store: WorldStore
  // Имена и подстрочники зон — те же строки, что на кнопках на земле
  texts: WorldTexts
  // Зоны с макетными данными (dev): на них висит метка
  mockZones: readonly WorldZone[]
  onGo: (zone: WorldZone) => void
}

// Переключатель зон — клавиатурный и текстовый путь по карте, дубль кнопок на земле:
// в узкой сцене их нет вовсе. Порядок — как зоны стоят в ряду, слева направо.
// data-w-chrome — неподвижная обвязка, вывески её обходят (контракт HUD в worldStore.ts).
export function ZoneSwitch({ store, texts, mockZones, onGo }: Props) {
  const { tr } = useLanguage()
  const zone = useWorldState(store, (state) => state.zone)
  const zones = useWorldState(store, (state) => state.zones)
  // Наведение и фокус поднимают кнопку этой зоны на земле
  const enter = (to: WorldZone) => store.setState({ hover: gateId(to, store.getState().zone) })
  const leave = (to: WorldZone) => { if (store.getState().hover === gateId(to, store.getState().zone)) store.setState({ hover: null }) }

  return (
    <div className="w-zones" data-w-chrome>
      <nav className="w-plaque w-zones__row" aria-label={tr('Зоны карты', 'Xarita zonalari')}>
        {zones.map((id) => {
          const current = id === zone, { name, sub } = texts.zones[id]
          return (
            <button
              key={id}
              type="button"
              aria-current={current ? 'true' : undefined}
              aria-label={`${name}${sub ? `: ${sub}` : ''}${current ? tr(' — вы здесь', ' — siz shu yerdasiz') : ''}`}
              onPointerEnter={current ? undefined : () => enter(id)}
              onPointerLeave={current ? undefined : () => leave(id)}
              onFocus={current ? undefined : () => enter(id)}
              onBlur={current ? undefined : () => leave(id)}
              onClick={current ? undefined : () => onGo(id)}
            >
              {name}
            </button>
          )
        })}
      </nav>
      {/* Честность dev-стенда: у зоны нет источника в базе, на экране — данные макета */}
      {mockZones.includes(zone) && <p className="w-mock">{tr('Макетные данные', 'Maket ma’lumotlari')}</p>}
    </div>
  )
}
