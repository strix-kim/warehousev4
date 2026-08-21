import { RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatAge } from '../lib/date'
import { useLanguage } from '../lib/i18n'

// Моложе минуты возраст не показываем: при живой сети страница дозапрашивает свежее
// на каждый заход, и бейдж мигал бы «только что» вообще всегда. Он должен означать
// ровно одно — «сеть не ответила, перед тобой старое».
const MIN_VISIBLE_AGE_MS = 60_000
const TICK_MS = 30_000

type Props = {
  // null — возраст неизвестен (записи в кэше нет). Владелец значения —
  // persistentCache; страница только перечитывает его и ничего производного не хранит.
  touchedAt: number | null
  isRefreshing: boolean
  onRefresh: () => void
}

export function DataAge({ touchedAt, isRefreshing, onRefresh }: Props) {
  const { tr, locale } = useLanguage()
  // Тик существует только чтобы вызвать перерисовку: сама строка считается на
  // рендере из touchedAt. Держать готовый текст в стейте — это вторая копия
  // значения, у которого уже есть владелец.
  const [, setTick] = useState(0)

  useEffect(() => {
    if (touchedAt === null) return
    const timer = window.setInterval(() => setTick((value) => value + 1), TICK_MS)
    return () => window.clearInterval(timer)
  }, [touchedAt])

  if (touchedAt === null || Date.now() - touchedAt < MIN_VISIBLE_AGE_MS) return null

  // Фраза собирается целиком внутри tr, а не склейкой «причастие + возраст»: в
  // узбекском причастие идёт в конец («40 daqiqa oldin yangilangan»), и склейка
  // давала бы порядок слов русского предложения.
  const age = formatAge(touchedAt, locale, tr)

  return (
    <div className="data-age" role="status">
      <span>{tr(`Обновлено ${age}`, `${age} yangilangan`)}</span>
      <button type="button" onClick={onRefresh} disabled={isRefreshing}>
        <RotateCw size={14} />
        {isRefreshing ? tr('Обновляем…', 'Yangilanmoqda…') : tr('Обновить', 'Yangilash')}
      </button>
    </div>
  )
}
