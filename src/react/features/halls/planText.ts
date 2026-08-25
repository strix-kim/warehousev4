// Текстовая расстановка для мессенджера (с22). Матрица «позиции × залы» в чат
// не влезает: телефон покажет таблицу из десяти колонок кашей. Поэтому текст
// строится ПО ЗАЛАМ — человек находит свой зал и видит рядом всю бригаду.
//
// Разметки здесь нет намеренно. Telegram не разбирает markdown во ВСТАВЛЕННОМ
// тексте: `**Main**` прилетит в чат звёздочками. Пережить вставку способны
// только переносы строк и отступы — на них всё и держится.

import { employeeDisplayName } from '../employees/types'
import { cellKeyOf } from './useHallPlanEditor'
import { formatPlanPeriod, type AssignmentWithEmployee, type Hall, type HallPlan, type PlanPosition, type Tr } from './types'

// Залам и позициям нужны только имя и id: сузив вход до них, сборка текста
// перестаёт зависеть от того, полную строку таблицы отдал редактор или краткую.
export type PlanTextInput = {
  plan: HallPlan
  halls: Pick<Hall, 'id' | 'name'>[]
  positions: Pick<PlanPosition, 'id' | 'name'>[]
  cellMap: Map<string, AssignmentWithEmployee>
  counts: { totalPeople: number; hired: number }
  locale: string
  tr: Tr
}

export function buildPlanText({ plan, halls, positions, cellMap, counts, locale, tr }: PlanTextInput): string {
  // Имя и период — двумя строками, а не через тире: период сам бывает
  // диапазоном («24.08.2026 — 25.08.2026»), и в одну строку выходило два тире
  // подряд.
  const blocks: string[] = [`${plan.name}\n${formatPlanPeriod(plan, locale, tr)}`]

  for (const hall of halls) {
    const lines: string[] = []
    for (const position of positions) {
      const cell = cellMap.get(cellKeyOf({ hallId: hall.id, positionId: position.id }))
      if (!cell) continue
      // Слот «Наём» — это решение «берём внешнего», а не пустая клетка, и в
      // чате он обязан читаться так же явно, как в матрице.
      const who = cell.employees
        ? employeeDisplayName(cell.employees)
        : tr('Наём', 'Yollash')
      lines.push(`• ${position.name} — ${who}`)
    }
    // Пустой зал не выбрасываем: «зала нет в списке» и «в зал ещё никого не
    // поставили» — разные новости, и вторую бригада должна увидеть.
    blocks.push([hall.name, ...(lines.length > 0 ? lines : [`• ${tr('пусто', 'bo‘sh')}`])].join('\n'))
  }

  // Залов может не быть вовсе — план заводят с пустой сеткой.
  if (halls.length === 0) blocks.push(tr('Залов пока нет', 'Hozircha zallar yo‘q'))

  const total = tr(`Всего ${counts.totalPeople} человек`, `Jami ${counts.totalPeople} kishi`)
  blocks.push(counts.hired > 0
    ? `${total} · ${tr('наём', 'yollash')} ${counts.hired}`
    : total)

  return blocks.join('\n\n')
}
