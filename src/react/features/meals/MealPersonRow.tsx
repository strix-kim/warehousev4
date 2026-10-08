import type { MealOrder } from './types'
import { formatSum } from '../expenses/format'
import { useLanguage } from '../../lib/i18n'

export type MealRowPending = 'saving' | 'failed'

// Строка списка людей приёма: имя, блюдо / «Не ест» / «—», ×порций, цена.
// Показывает строку базы, а не черновик: отказ записи оставляет прежнее
// значение и пометку «не сохранено, повторить» (план 3.2 — мобильный интернет
// на площадке). Без onClick — ввод заперт (обед в расходах): строка не кнопка.
export function MealPersonRow({ name, note, order, pending, onClick }: {
  name: string
  note?: 'outside' | 'guest' | null
  order: MealOrder | null
  pending?: MealRowPending
  onClick?: () => void
}) {
  const { tr } = useLanguage()
  const currency = tr('сум', 'so‘m')
  const content = (
    <>
      <span className="meal-row__who">
        <strong>{name}</strong>
        {note === 'outside' && <small>{tr('вне состава', 'tarkibdan tashqari')}</small>}
        {note === 'guest' && <small>{tr('гость', 'mehmon')}</small>}
        {pending === 'saving' && <small className="meal-row__pending">{tr('сохраняем…', 'saqlanmoqda…')}</small>}
        {pending === 'failed' && <small className="meal-row__pending meal-row__pending--failed">{tr('не сохранено, повторить', 'saqlanmadi, qayta urinish')}</small>}
      </span>
      <span className={`meal-row__dish ${order?.dish ? '' : 'meal-row__dish--empty'}`}>
        {!order ? '—' : order.dish === null ? tr('Не ест', 'Ovqatlanmaydi') : order.dish}
        {order?.dish && order.qty > 1 && <em> ×{order.qty}</em>}
      </span>
      <span className="meal-row__price">
        {order?.dish && order.price !== null ? `${formatSum(order.price)} ${currency}` : ''}
      </span>
    </>
  )

  if (!onClick) return <div className="meal-row">{content}</div>
  return (
    <button type="button" className="meal-row meal-row--button" aria-busy={pending === 'saving'} onClick={onClick}>
      {content}
    </button>
  )
}
