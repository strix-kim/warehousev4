// Машина из базы → облик в мире: марка и модель → силуэт, цвет-текст → hex.
// Чистые функции без three: сверяются скриптом без сцены.

// Силуэты, собранные по docs/project/design/voxel-cars-spec.md (SPEC в engine/cars.ts)
export type CarKind = 'lynk' | 'bongo' | 'cobalt' | 'nexia' | 'chazor'

// Неизвестная модель — седан Cobalt: самый массовый кузов страны, ошибка наименее заметна
export const FALLBACK_KIND: CarKind = 'cobalt'
// Неизвестный цвет — белый: четыре машины из шести белые
export const FALLBACK_HEX = '#F5F6F8'

// Марку и модель в базе пишут руками: сверяем по слову в склейке «марка модель»,
// без регистра, пробелов и знаков («Lynk & Co» → «lynkco»). Порядок — от частного к общему.
const KINDS: ReadonlyArray<readonly [CarKind, readonly string[]]> = [
  ['lynk', ['lynk', 'линк']],
  ['bongo', ['bongo', 'бонго']],
  ['cobalt', ['cobalt', 'кобальт']],
  ['nexia', ['nexia', 'нексия']],
  ['chazor', ['chazor', 'чазор']],
]

// Буквы и цифры в нижнем регистре; «ё» = «е» — в карточках пишут и так, и так
const squash = (text: string) => text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')

export function carKind(brand: string, model: string | null): CarKind {
  const name = squash(`${brand} ${model ?? ''}`)
  for (const [kind, words] of KINDS) if (words.some((word) => name.includes(word))) return kind
  return FALLBACK_KIND
}

// Цвета кузова — данные машины, а не палитра мира: смена облика их не трогает.
// Значения — из принятого макета (voxel-world-s50, CARS.hex).
const COLORS: Readonly<Record<string, string>> = {
  белый: '#F5F6F8',
  темносерый: '#3A3E46',
  серебристый: '#C9CDD4',
}

export function carHex(color: string | null): string {
  return COLORS[squash(color ?? '')] ?? FALLBACK_HEX
}
