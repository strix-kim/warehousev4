import type { Tables } from '../../lib/database.types'

// Строка таблицы equipment ровно в том виде, в каком её отдаёт база.
export type EquipmentRow = Tables<'equipment'>

// Доменная запись: строка базы плюс поля, которые вычисляет normalizeEquipment.
// Три колонки переопределены осознанно, остальные приходят из схемы как есть:
// - serialnumber в базе NOT NULL и для количественного учёта хранит служебный
//   идентификатор (QTY::…), а наружу нормализация отдаёт null;
// - availability и count в схеме nullable, но весь интерфейс считает их строкой
//   и числом — пустые значения нормализация приводит к '' и 0.
export type Equipment = Omit<EquipmentRow, 'serialnumber' | 'availability' | 'count'> & {
  serialnumber: string | null
  availability: string
  count: number
  tracking_mode: 'serialized' | 'quantity'
  inventory_code: string | null
}
