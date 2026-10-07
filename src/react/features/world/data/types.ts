// WorldData — единственный вход движка. Здесь только то, что мир уже рисует:
// машины, люди и числа вывесок; «сегодня», площадки и архив добавятся со своими шагами.
// Поля — как в выдаче vehicles и employees, без копий сверх нужного миру.
import type { WorldSiteId } from '../worldStore'

export type WorldCar = {
  id: string
  brand: string
  model: string | null
  // Свободный текст из карточки машины: в hex его переводит carKinds.ts
  color: string | null
  plate: string
}

// Только имя для чипа: телефон, должность и документы сотрудника в мир не едут
export type WorldPerson = {
  id: string
  firstName: string
  lastName: string
}

export type WorldData = {
  cars: WorldCar[]
  people: WorldPerson[]
  // Число на вывеске здания: списки, единицы оборудования, машины. null — источник
  // этого числа не ответил, вывеска показывает только имя: ноль был бы ложью, а не
  // пустым состоянием
  sites: Record<WorldSiteId, number | null>
}
