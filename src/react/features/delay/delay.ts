// Расчёт задержки излучателей ITC. Чистый модуль без React: формула проверяется
// голым node, а страница только рисует то, что вернула computeDelays.
//
// Цепочка последовательная: процессор («мозги») → кабель → излучатель 1 →
// кабель → излучатель 2 → … Сигнал доходит до ближних излучателей раньше, чем
// до дальних. Чтобы все излучали одновременно, каждому ставят задержку, равную
// пути сигнала по кабелю от него до ПОСЛЕДНЕГО. Исходник — таблица прораба
// docs/reference/itc-emitter-delay.xlsx:
//   delay_steps[i] = CEILING((L[i+1] + … + L[n]) × 5.6 / 25), у последнего 0.
// Длина первого кабеля (от мозгов) в формулу не входит: она задерживает всех
// одинаково и разницы между излучателями не создаёт.

// Трактовка констант — гипотеза агента с30, прораб подтвердил схему цепочки.
// Задержка сигнала в кабеле, нс на метр.
export const CABLE_NS_PER_METER = 5.6
// Шаг задержки излучателя, нс: процессор выставляет задержку целыми шагами.
export const DELAY_STEP_NS = 25
// Столько строк в таблице прораба — больше излучателей в одну цепочку не ставят.
export const MAX_EMITTERS = 20

export type EmitterDelay = {
  // Шаг задержки, который выставляют на излучателе (целое).
  steps: number
  // Время пути сигнала по кабелю от этого излучателя до последнего, нс.
  ns: number
  // Длина кабеля от этого излучателя до последнего, м.
  downstreamMeters: number
}

// Плавающая точка: кабели 17.01 + 3.98 + 29.35 + 7.42 + 4.82 + 62.42 в сумме
// дают не 125, а 125.00000000000003, и × 5.6 / 25 = 28.000000000000004 — голый
// Math.ceil дал бы 29 там, где Excel показывает 28. Excel считает с 15
// значащими цифрами и такой хвост не видит, поэтому перед округлением вверх
// срезаем шум до 9 знаков после запятой — и у суммы, и у частного.
function trimFloatNoise(value: number) {
  return Math.round(value * 1e9) / 1e9
}

// lengths[i] — длина кабеля ДО излучателя i (от предыдущего, у первого — от
// мозгов), м. Отрицательное и нечисловое считается нулём, как пустая ячейка в
// SUM у Excel.
export function computeDelays(lengths: number[]): EmitterDelay[] {
  const safe = lengths.map((length) => (Number.isFinite(length) && length > 0 ? length : 0))
  const result: EmitterDelay[] = new Array(safe.length)
  // Идём с хвоста: у последнего путь до последнего нулевой, у каждого
  // предыдущего он длиннее на кабель, который идёт ОТ него к следующему.
  let downstream = 0
  for (let index = safe.length - 1; index >= 0; index -= 1) {
    const meters = trimFloatNoise(downstream)
    result[index] = {
      steps: Math.ceil(trimFloatNoise((meters * CABLE_NS_PER_METER) / DELAY_STEP_NS)),
      ns: trimFloatNoise(meters * CABLE_NS_PER_METER),
      downstreamMeters: meters,
    }
    downstream += safe[index] ?? 0
  }
  return result
}

// Длина из поля ввода. Запятая — десятичный разделитель наравне с точкой
// («12,5»): на телефоне в русской раскладке цифровая клавиатура даёт именно её.
// Пустое и нераспознанное — null; решать, считать ли это нулём, вызывающему.
export function parseLength(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized || normalized === '.') return null
  if (!/^\d*\.?\d*$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
