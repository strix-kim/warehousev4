import { FileCheck2, FileSpreadsheet } from 'lucide-react'
import { useLanguage } from '../../lib/i18n'
import './export-choice.css'

export type ExportChoiceProps = {
  onWorking: () => void
  onApproval: () => void
  disabled: boolean
  // Какой файл готовится прямо сейчас: «Готовим…» горит на нажатой карточке, а не на обеих.
  exporting: '' | 'working' | 'approval'
  // Сколько из трёх реквизитов (название, заказчик, площадка) заполнено.
  requisitesFilled: number
}

/**
 * Выбор формата Excel (макет с31, V-01): две крупные карточки с объяснением
 * вместо трёх одинаковых кнопок. Красная — «Рабочий Excel»: ему ничего не нужно,
 * это самый частый путь. Одна разметка на две точки монтажа — подвал комплекта
 * (десктоп) и лист формата (телефон, ListExportSheet).
 */
export function ExportChoice({ onWorking, onApproval, disabled, exporting, requisitesFilled }: ExportChoiceProps) {
  const { tr } = useLanguage()
  // Пока файл готовится, вторая карточка тоже закрыта: два экспорта разом
  // гонялись бы за одной строкой состояния.
  const isLocked = disabled || exporting !== ''

  return (
    <div className="export-choice">
      <button type="button" className="export-choice__card export-choice__card--main" onClick={onWorking} disabled={isLocked} aria-busy={exporting === 'working'}>
        <FileSpreadsheet size={22} aria-hidden="true" />
        <b>{exporting === 'working' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('Рабочий Excel', 'Ishchi Excel')}</b>
        <small>{tr('Только оборудование, ничего заполнять не нужно', 'Faqat uskunalar, hech narsa to‘ldirish shart emas')}</small>
      </button>
      <button type="button" className="export-choice__card" onClick={onApproval} disabled={isLocked} aria-busy={exporting === 'approval'}>
        <FileCheck2 size={22} aria-hidden="true" />
        <b>{exporting === 'approval' ? tr('Готовим…', 'Tayyorlanmoqda…') : tr('С реквизитами', 'Rekvizitlar bilan')}</b>
        <small>{tr(`Для заказчика · реквизиты ${requisitesFilled} из 3`, `Buyurtmachi uchun · rekvizitlar ${requisitesFilled} / 3`)}</small>
      </button>
    </div>
  )
}
