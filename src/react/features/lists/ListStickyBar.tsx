import { FileSpreadsheet } from 'lucide-react'
import { useLanguage } from '../../lib/i18n'
import './export-choice.css'

type ListStickyBarProps = {
  unitCount: number
  onOpen: () => void
  disabled?: boolean
}

/**
 * Липкая нижняя плашка телефона (≤700, макет с31 `.p-dock`): «N единиц ·
 * Скачать Excel» под большим пальцем, кнопка открывает лист формата
 * (ListExportSheet). Шире 700 плашка скрыта стилями — там формат выбирают
 * карточками в подвале комплекта.
 *
 * ВАЖНО: рендерить ВНЕ `.editor-grid` и `.data-panel`. У них есть animation
 * с transform, а transform у предка делает `position: fixed` относительным
 * этому предку — плашка уехала бы вместе с панелью, а не прилипла к окну.
 */
export function ListStickyBar({ unitCount, onOpen, disabled = false }: ListStickyBarProps) {
  const { tr, locale } = useLanguage()

  return (
    <div className="list-sticky-bar">
      <div className="list-sticky-bar__sum">
        <b>{unitCount.toLocaleString(locale)}</b>
        <span>{tr('единиц', 'birlik')}</span>
      </div>
      <button type="button" className="button button--primary list-sticky-bar__action" onClick={onOpen} disabled={disabled} aria-haspopup="dialog">
        <FileSpreadsheet size={19} aria-hidden="true" />{tr('Скачать Excel', 'Excelni yuklab olish')}
      </button>
    </div>
  )
}
