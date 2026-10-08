import { Pencil, X } from 'lucide-react'
import { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../../../lib/i18n'
import { Plate } from '../../vehicles/Plate'
import { driverFullName, vehicleTitle, type VehicleWithDrivers } from '../../vehicles/types'
import type { WorldAction } from '../actions/useWorldActions'
import type { WorldStore } from '../worldStore'

// Панель выбранной машины гаража (контракт — worldStore.ts, «Гараж»): знак госномера,
// марка с моделью и водители по именам. Облик и место — панель участка (.w-vpanel из
// world-venues.css: справа снизу, в компактной сцене — лист снизу); своё — в
// world-garage.css. Строка — из выдачи машин (useWorldData.vehicles): имён водителей
// мир не возит. Действия: «Открыть карточку» — VehicleDrawer поверх сцены (хост
// действий), «Изменить» и «Назначить» — интерьер формы машины (там же назначают
// водителя), «Все машины» — реестр. Esc ведёт GaragePanel: у гаража он двухступенчатый.
type Props = {
  store: WorldStore
  vehicle: VehicleWithDrivers
  onAction: (action: WorldAction) => void
}

export function CarCard({ store, vehicle, onAction }: Props) {
  const { tr } = useLanguage()
  const titleId = useId()
  // Ссылки уводят со сцены push-переходом и несут адрес мира (с ?in=garage): форма по
  // state.from возвращает «назад» на эту же запись (lib/returnTo.ts)
  const { pathname, search } = useLocation()
  const leave = { from: pathname + search }
  const editPath = `/vehicles/${vehicle.id}/edit`
  const title = vehicleTitle(vehicle.brand, vehicle.model)

  return (
    <aside className="w-plaque w-vpanel w-vpanel--car" aria-labelledby={titleId} data-w-chrome="panel">
      <header className="w-vpanel__head">
        <div>
          {/* Заголовок — знак: машину опознают по номеру (как в VehicleDrawer) */}
          <h2 className="w-vpanel__name" id={titleId}><Plate value={vehicle.plate_number} /></h2>
          <p className="w-vpanel__kind">{[title, vehicle.color].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="w-vpanel__tools">
          <Link className="w-vpanel__edit" to={editPath} state={leave}>
            <Pencil size={16} aria-hidden="true" />
            {tr('Изменить', 'O‘zgartirish')}
          </Link>
          <button type="button" className="w-vpanel__close" aria-label={tr('Закрыть', 'Yopish')} onClick={() => store.setState({ pick: null })}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="w-vpanel__body">
        <dl className="w-vpanel__facts">
          <div>
            <dt>{tr('Водители', 'Haydovchilar')}</dt>
            {vehicle.drivers.length === 0 ? (
              <dd className="w-vpanel__gap">
                <span className="w-cnone">{tr('Не назначен', 'Tayinlanmagan')}</span>
                <span aria-hidden="true">·</span>
                <Link className="w-vlink" to={editPath} state={leave} aria-label={tr('Водитель не назначен. Назначить водителя', 'Haydovchi tayinlanmagan. Haydovchini tayinlash')}>{tr('Назначить', 'Tayinlash')}</Link>
              </dd>
            ) : (
              <dd>
                <ul className="w-cdrivers">
                  {vehicle.drivers.map((driver) => <li key={driver.id}>{driverFullName(driver)}</li>)}
                </ul>
              </dd>
            )}
          </div>
        </dl>
        <p className="w-vpanel__open">
          <button type="button" className="button button--secondary" onClick={() => onAction({ kind: 'car', carId: vehicle.id })}>{tr('Открыть карточку', 'Kartani ochish')}</button>
        </p>
        <p className="w-cmore">
          <Link className="w-vlink" to="/vehicles" state={leave}>{tr('Все машины', 'Barcha mashinalar')}</Link>
        </p>
      </div>
    </aside>
  )
}
