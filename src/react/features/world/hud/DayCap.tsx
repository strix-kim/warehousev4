import { formatDayMonth } from '../../../lib/date'
import { useLanguage } from '../../../lib/i18n'

// Плашка дня: только дата. Про мероприятия молчим — источника «сегодня» нет до Ш8,
// «мероприятий нет» было бы утверждением, которого мы не знаем.
export function DayCap() {
  const { tr, locale } = useLanguage()
  // День — по Ташкенту, а не по часам устройства: с ним же будет сверяться «сегодня» из базы
  // Ташкент — UTC+5 круглый год: сдвигаем момент и читаем его как UTC
  const now = new Date(Date.now() + 5 * 3600_000)
  const date = formatDayMonth(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), locale)

  return (
    <div className="w-plaque w-day" data-w-chrome>
      <span className="w-flag" aria-hidden="true" />
      <span className="w-day__date">{tr(`Сегодня, ${date}`, `Bugun, ${date}`)}</span>
    </div>
  )
}
