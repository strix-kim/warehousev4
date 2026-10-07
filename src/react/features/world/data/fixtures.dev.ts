// Макетные данные мира (voxel-world-s50: CARS, EMPLOYEES). Только для dev-стенда:
// импортируется динамически под import.meta.env.DEV и в прод-бандл не попадает.
// Живой адаптер (useWorldData) заменит их на данные vehicles и employees.
import type { WorldData } from './types'

const CARS: ReadonlyArray<readonly [brand: string, model: string, plate: string, color: string]> = [
  ['Lynk & Co', '900', '01 439 SNA', 'Белый'],
  ['KIA', 'Bongo 3', '10 D 412 GB', 'Белый'],
  ['Chevrolet', 'Cobalt', '30 T 815 TB', 'Белый'],
  ['Chevrolet', 'Cobalt', '01 H 235 JC', 'Тёмно-серый'],
  ['Daewoo', 'Nexia', '01 S 569 GC', 'Серебристый'],
  ['BYD', 'Chazor', '01 T 769 MC', 'Белый'],
]

const EMPLOYEES: ReadonlyArray<readonly [firstName: string, lastName: string]> = [
  ['Шахзод', 'Исмоилов'], ['Тимур', 'Каримов'], ['Азиз', 'Юлдашев'], ['Сардор', 'Назаров'],
  ['Жасур', 'Абдуллаев'], ['Алексей', 'Ким'], ['Малика', 'Усманова'], ['Рустам', 'Хасанов'],
  ['Нодира', 'Мирзаева'], ['Игорь', 'Соколов'], ['Бекзод', 'Турсунов'], ['Камила', 'Ахмедова'],
]

export const FIXTURES: WorldData = {
  cars: CARS.map(([brand, model, plate, color], i) => ({ id: `fixture-car-${i}`, brand, model, plate, color })),
  people: EMPLOYEES.map(([firstName, lastName], i) => ({ id: `fixture-person-${i}`, firstName, lastName })),
}
