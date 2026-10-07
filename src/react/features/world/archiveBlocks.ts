// «Где работали»: нарезка мест на кварталы — одна на движок (сколько зданий и кварталов
// встаёт в сцену) и на HUD (подписи кварталов, строки панели). Без three и React:
// файл грузится во входном чанке вместе с оболочкой.
import type { WorldArchivePlace } from './data/types'

// Мест в квартале и мест в сцене: шесть кварталов по пять, остальные — только списком
export const ARCH_BLOCK = 5
export const ARCH_MAX = 30

// Ключ подписи пустого архива (вывеска посреди зоны); объектом выбора не бывает
export const ARCH_EMPTY_ID = 'archive:empty'

// Квартал: номер по порядку нарезки (он же blockId), первое место и число мест, годы
// последних мероприятий его мест — подпись на вывеске («2026» или «2025–2026»)
export type ArchiveBlock = { index: number; from: number; count: number; yearFrom: number; yearTo: number }

// Порядок мест — от свежих к старым (так приходит выдача): он и есть нарезка
export function archiveBlocks(places: WorldArchivePlace[]): ArchiveBlock[] {
  const scene = places.slice(0, ARCH_MAX), blocks: ArchiveBlock[] = []
  for (let from = 0; from < scene.length; from += ARCH_BLOCK) {
    const years = scene.slice(from, from + ARCH_BLOCK).map((place) => Number(place.last.slice(0, 4)))
    blocks.push({ index: blocks.length, from, count: years.length, yearFrom: Math.min(...years), yearTo: Math.max(...years) })
  }
  return blocks
}
