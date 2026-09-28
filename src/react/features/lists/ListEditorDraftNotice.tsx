import { Info } from 'lucide-react'
import { formatDateTime } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
import type { DraftNotice } from './useListDraftRestore'

// Плашка восстановленного черновика с кнопкой сброса.
export function ListEditorDraftNotice({ notice, onDiscard }: {
  notice: DraftNotice
  onDiscard: () => void
}) {
  const { tr, locale } = useLanguage()
  // Оба действия необратимы и стоят рядом с обычными кнопками, поэтому спрашивают
  // подтверждение вторым нажатием. Экземпляры независимые: взведённая «Очистить»
  // не должна взводить «Начать заново».
  const restartArmed = useArmedAction()

  return (
    <div className="editor-draft-notice">
      <Info size={18} />
      <span>
        {/* У открытого списка формулировка другая: «Черновик восстановлен»
            читалось бы как «список не сохранён», а он в базе есть. */}
        <strong>{notice.kind === 'edits'
          ? tr('Восстановлены несохранённые правки', 'Saqlanmagan o‘zgarishlar tiklandi')
          : tr('Черновик восстановлен', 'Qoralama tiklandi')}</strong>
        {/* Что именно вернулось и когда: состав лежит на другой вкладке, и без
            этих двух чисел «восстановлен» относится непонятно к чему, а решение
            нажать «Начать заново» принимается вслепую. */}
        <small>{notice.touchedAt === null
          ? tr(`единиц: ${notice.units}`, `birliklar: ${notice.units}`)
          : tr(
            `единиц: ${notice.units} · изменён ${formatDateTime(notice.touchedAt, locale)}`,
            `birliklar: ${notice.units} · ${formatDateTime(notice.touchedAt, locale)} da o‘zgartirilgan`,
          )}</small>
        {notice.missingGroups > 0 && <small>{tr(
          `позиций больше нет в каталоге: ${notice.missingGroups}`,
          `katalogda qolmagan pozitsiyalar: ${notice.missingGroups}`,
        )}</small>}
      </span>
      <button className="button button--secondary" type="button" onClick={() => restartArmed.fire(onDiscard)} onBlur={restartArmed.disarm}>
        {notice.kind === 'edits'
          ? (restartArmed.armed ? tr('Да, отбросить правки', 'Ha, o‘zgarishlar tashlansin') : tr('Отбросить правки', 'O‘zgarishlarni tashlash'))
          : (restartArmed.armed ? tr('Да, начать заново', 'Ha, yangidan boshlansin') : tr('Начать заново', 'Yangidan boshlash'))}
      </button>
    </div>
  )
}
