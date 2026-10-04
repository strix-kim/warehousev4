// Расчёт задержки излучателей ITC. Чистый модуль без React: формула проверяется
// голым node, а страница только рисует то, что вернула computeDelays.
//
// Топология: процессор («мозги») → кабель → излучатель 1 → кабель → излучатель 2 →
// … Линий от мозгов одна или две; в каждой излучатели идут последовательно, и все
// излучатели всех линий звучат в один момент. Сигнал доходит до ближних раньше,
// чем до дальних, поэтому каждому ставят задержку, равную разнице между самым
// длинным путём в системе и его собственным:
//   приход[i] = L[1] + … + L[i]          (накопленная длина от мозгов, м)
//   T         = max приход по ВСЕМ линиям
//   delay_steps[i] = CEILING((T − приход[i]) × 5.6 / 25).
// Исходник — таблица прораба docs/reference/itc-emitter-delay.xlsx. В одной линии
// это ровно её формула «кабель от него до последнего»: кабель от мозгов
// сокращается и на задержки не влияет. При двух линиях он входит в расчёт: путь
// до излучателя одной линии сравнивается с путём в другой.

// Трактовка констант — гипотеза агента с30, прораб подтвердил схему цепочки.
// Задержка сигнала в кабеле, нс на метр.
export const CABLE_NS_PER_METER = 5.6
// Шаг задержки излучателя, нс: процессор выставляет задержку целыми шагами.
export const DELAY_STEP_NS = 25
// Защита разбора адреса: длиннее строки в таблице прораба (20) из ссылки не берём.
export const MAX_FROM_ADDRESS = 20
// Предел кнопки «добавить излучатель» в одной линии. Старая ссылка с большим числом
// не обрезается — предел держит только кнопка.
export const MAX_PER_LINE = 6
// Линий от мозгов не больше двух.
export const MAX_LINES = 2

export type EmitterDelay = {
  // Шаг задержки, который выставляют на излучателе (целое).
  steps: number
  // Время, на которое путь до этого излучателя короче самого длинного, нс.
  ns: number
  // На сколько метров путь до излучателя короче самого длинного; в одной линии
  // это кабель от него до последнего.
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

// Безопасная длина: отрицательное и нечисловое считается нулём, как пустая ячейка
// в SUM у Excel.
function safeLength(length: number) {
  return Number.isFinite(length) && length > 0 ? length : 0
}

// line[i] — длина кабеля ДО излучателя i (от предыдущего, у первого — от мозгов), м.
// Возвращает приход к каждому излучателю, м: накопленная сумма, каждая через
// trimFloatNoise. Нужна и анимации сигнала — шкала времени строится по приходам.
export function lineArrivals(line: number[]): number[] {
  let sum = 0
  return line.map((length) => {
    sum += safeLength(length)
    return trimFloatNoise(sum)
  })
}

// lines — одна или две линии; результат той же формы. Порядок операций у steps и
// ns дословно как у прежней однолинейной формулы: на одной линии числа те же.
export function computeDelays(lines: number[][]): EmitterDelay[][] {
  const arrivals = lines.map(lineArrivals)
  const longest = Math.max(0, ...arrivals.flat())
  return arrivals.map((line) => line.map((arrival) => {
    const meters = trimFloatNoise(longest - arrival)
    return {
      steps: Math.ceil(trimFloatNoise((meters * CABLE_NS_PER_METER) / DELAY_STEP_NS)),
      ns: trimFloatNoise(meters * CABLE_NS_PER_METER),
      downstreamMeters: meters,
    }
  }))
}

// Длина из поля ввода. Запятая — десятичный разделитель наравне с точкой
// («12,5»): на телефоне в русской раскладке цифровая клавиатура даёт именно её.
// Пустое и нераспознанное — null; решать, считать ли это нулём, вызывающему.
// Что остаётся в поле после нажатия: цифры и ОДИН разделитель. Буквы, пробелы и
// второй разделитель отбрасываются на входе (с42) — раньше поле их принимало,
// краснело и писало «не число»; не дать ввести честнее, чем объяснять. Вставка
// «12,5 м» из мессенджера превращается в «12,5».
export function sanitizeLength(raw: string): string {
  const kept = raw.replace(/[^\d.,]/g, '')
  const first = kept.search(/[.,]/)
  return first < 0 ? kept : kept.slice(0, first + 1) + kept.slice(first + 1).replace(/[.,]/g, '')
}

export function parseLength(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized || normalized === '.') return null
  if (!/^\d*\.?\d*$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}
