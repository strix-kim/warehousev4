import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useLanguage } from '../../../lib/i18n'
import { vehicleTitle, type VehicleWithDrivers } from '../../vehicles/types'
import type { WorldAction } from '../actions/useWorldActions'
import type { WorldCar } from '../data/types'
import { carId, parseCarId, useWorldState, type WorldStore } from '../worldStore'
import { CarCard } from './CarCard'
import { TagButton } from './VenuePanel'
import './world-garage.css'

// Табличка машины — госномер кнопкой в якоре движка (класс w-tag, ключ — carId): она же
// дубль цели в сцене для клавиатуры и скринридера. Клик выбирает машину — карточка
// справа, действия в ней. У машины без водителя на углу таблички бейдж «!» (тот же знак,
// что у кафе с делом про обед — world-venues.css). Якоря нет (движок машину не поставил) —
// таблички нет. В компактной сцене шести номерам целиком тесно: невыбранная машина
// показывает короткий номер, выбранная — полный (world-garage.css); имя кнопки — всегда
// полный номер и марка.
// Короткий номер — трёхзначная группа цифр («01 T 769 MC» → «769», «01 439 SNA» → «439»):
// по ней машины и различают на слух. Нет такой группы — последние три знака без пробелов.
const shortPlate = (plate: string) => plate.split(/\D+/).find((group) => group.length === 3) ?? plate.replace(/\s/g, '').slice(-3)

function CarTag({ store, car }: { store: WorldStore; car: WorldCar }) {
  const { tr } = useLanguage()
  const id = carId(car.id)
  const anchor = useWorldState(store, (state) => state.labels.get(id))
  if (!anchor) return null

  const free = car.drivers === 0
  const name = `${car.plate}, ${vehicleTitle(car.brand, car.model)}`
  return (
    <TagButton store={store} id={id} anchor={anchor} plate name={free ? `${name}. ${tr('Водитель не назначен', 'Haydovchi tayinlanmagan')}` : name}>
      <span className="w-tag__full">{car.plate}</span>
      <span className="w-tag__short">{shortPlate(car.plate)}</span>
      {free && <span className="w-tag__bang" aria-hidden="true">!</span>}
    </TagButton>
  )
}

type Props = {
  store: WorldStore
  // Машины сцены (WorldData.cars) и строки той же выдачи с водителями (useWorldData)
  cars: readonly WorldCar[]
  vehicles: readonly VehicleWithDrivers[] | null
  // Действие дровером поверх сцены (хост — WorldStage)
  onAction: (action: WorldAction) => void
  // Выход к кампусу: снимает ?in (useGarage.leave)
  onLeave: () => void
}

// HUD гаража изнутри (контракт — worldStore.ts, «Гараж»). Смонтирован, пока адрес
// просит гараж; таблички, выход и карточка появляются по прибытии камеры (inside пишет
// движок). Выбранное — pick из стора: parseCarId(pick) даёт id машины.
export function GaragePanel({ store, cars, vehicles, onAction, onLeave }: Props) {
  const { tr } = useLanguage()
  const inside = useWorldState(store, (state) => state.inside === 'garage')
  const picked = useWorldState(store, (state) => parseCarId(state.pick))
  const vehicle = inside && picked !== null ? vehicles?.find((row) => row.id === picked) : undefined

  // Esc двухступенчатый: сначала снимает выбор машины, вторым нажатием — выход к
  // кампусу. Слушаем и до прибытия камеры: подъезд можно отменить. Под дровером
  // действия (modal) Esc принадлежит дроверу. Лист дел на телефоне флага modal не
  // ставит, а его Esc слушает window — позже document: запертая прокрутка страницы
  // (её держит useModalLayer любого слоя) значит, что Esc не наш.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || store.getState().modal || document.body.style.overflow === 'hidden') return
      if (parseCarId(store.getState().pick) !== null) store.setState({ pick: null })
      else onLeave()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [store, onLeave])

  return (
    <>
      {inside && cars.map((car) => <CarTag key={car.id} store={store} car={car} />)}
      {inside && (
        <button type="button" className="w-plaque w-gback" data-w-chrome onClick={onLeave}>
          <ArrowLeft size={18} aria-hidden="true" />
          {tr('К кампусу', 'Kampusga')}
        </button>
      )}
      {vehicle && <CarCard key={vehicle.id} store={store} vehicle={vehicle} onAction={onAction} />}
      {/* Скринридеру: выбранная машина — номером и маркой */}
      <p className="w-live" aria-live="polite">
        {vehicle ? tr(`Выбрана машина: ${vehicle.plate_number}, ${vehicleTitle(vehicle.brand, vehicle.model)}`, `Mashina tanlandi: ${vehicle.plate_number}, ${vehicleTitle(vehicle.brand, vehicle.model)}`) : ''}
      </p>
    </>
  )
}
