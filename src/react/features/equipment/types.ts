export type Equipment = {
  id: string
  model: string
  brand: string
  serialnumber: string | null
  tracking_mode: 'serialized' | 'quantity'
  inventory_code: string | null
  type: string
  subtype: string
  technicalspecification: string | null
  lengthinmeters: string | null
  count: number
  availability: string
  description: string | null
  location: string
  created_at: string
  updated_at: string
}

export type EquipmentPageResult = {
  rows: Equipment[]
  total: number
}
