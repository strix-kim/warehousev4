// Словарь статусов единицы оборудования: один источник кодов, подписей и тона
// бейджа. Набор кодов задаёт база — CHECK equipment_availability_check
// (baseline_remote_schema.sql) и проверка p_availability в update_equipment_model_and_unit.

export type EquipmentAvailability = 'available' | 'unavailable' | 'diagnostics' | 'issued'

type Tr = (ru: string, uz: string) => string

export const equipmentAvailabilityCodes: EquipmentAvailability[] = ['available', 'unavailable', 'diagnostics', 'issued']

const availabilityDictionary: Record<EquipmentAvailability, { tone: string; label: (tr: Tr) => string }> = {
  // «На складе», а не «В наличии»: код означает «не выдано», а не «свободно на
  // нужную дату» — бронь на будущее статус не видит.
  available: { tone: 'success', label: (tr) => tr('На складе', 'Omborda') },
  unavailable: { tone: 'neutral', label: (tr) => tr('Нет на складе', 'Omborda yo‘q') },
  diagnostics: { tone: 'warning', label: (tr) => tr('Диагностика', 'Diagnostika') },
  issued: { tone: 'danger', label: (tr) => tr('Выдано', 'Berilgan') },
}

// В базе колонка — обычный nullable text, и в старых записях лежат русские
// формулировки. Сужаем на границе отображения; неопознанное значение остаётся
// неопознанным, а не подменяется «в наличии».
export function toEquipmentAvailability(value: string): EquipmentAvailability | null {
  const normalized = value.toLowerCase()
  if (normalized === 'available' || normalized.includes('налич')) return 'available'
  if (normalized === 'diagnostics' || normalized.includes('диагност')) return 'diagnostics'
  if (normalized === 'issued') return 'issued'
  if (normalized === 'unavailable' || normalized.includes('не на складе')) return 'unavailable'
  return null
}

export function equipmentAvailabilityLabel(status: EquipmentAvailability, tr: Tr) {
  return availabilityDictionary[status].label(tr)
}

// Подпись и тон бейджа для сырого значения из базы: непонятный статус показываем
// как есть, нейтральным тоном.
export function equipmentAvailabilityView(value: string, tr: Tr) {
  const status = toEquipmentAvailability(value)
  if (!status) return { label: value || tr('Не указано', 'Ko‘rsatilmagan'), tone: 'neutral' }
  return { label: equipmentAvailabilityLabel(status, tr), tone: availabilityDictionary[status].tone }
}

// Опции для селектов. Набор кодов передаётся явно: в форме создания записи
// статуса «выдано» быть не может — его проставляет только выдача списка.
export function equipmentAvailabilityOptions(tr: Tr, codes: EquipmentAvailability[] = equipmentAvailabilityCodes) {
  return codes.map((status) => ({ value: status, label: equipmentAvailabilityLabel(status, tr) }))
}
