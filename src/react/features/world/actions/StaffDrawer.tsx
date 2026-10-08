// Дровер состава поверх сцены (план world-game-s59.md, Э2): тот же блок «Состав», что
// на странице мероприятия, в раме дровера — на телефоне рама сама становится листом.
// Своих запросов и проверок нет: данные грузит и пишет ProjectStaffSection. Грузится
// только ленивым чанком из WorldActions — секция статически тянет xlsx-сборщик.
import { X } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { DrawerFrame } from '../../../components/DrawerFrame'
import { useLanguage } from '../../../lib/i18n'
import { useModalLayer } from '../../../lib/useModalLayer'
import { ProjectStaffSection } from '../../projects/ProjectStaffSection'
import type { WorldLot } from '../data/types'
import './world-actions.css'

// Esc в поле поиска при открытой выдаче закрывает только выдачу. EmployeePicker событие
// не гасит, а useModalLayer слушает window — без этого один Esc закрыл бы и дровер.
// Выдача к этому моменту ещё в DOM: пикер снимает её следующим рендером.
function keepPickerEsc(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Escape' || !(event.target instanceof Element)) return
  if (event.target.closest('.employee-picker')?.querySelector('.employee-picker__panel')) event.stopPropagation()
}

export function StaffDrawer({ lot, onClose, onChanged }: {
  // Участок мира: его реквизитов хватает и блоку, и шапке документа выгрузки
  lot: Pick<WorldLot, 'id' | 'name' | 'dateFrom' | 'dateTo'>
  onClose: () => void
  // Состав в базе изменился — мир перечитает реестр; дровер при этом остаётся открытым
  onChanged: () => void
}) {
  const { tr } = useLanguage()
  // Несохранённого здесь не бывает: каждая правка состава — сразу запись в базу
  useModalLayer(onClose)
  const title = tr('Состав', 'Tarkib')

  return (
    <DrawerFrame
      className="world-staff"
      ariaLabel={`${title}: ${lot.name}`}
      instant={false}
      onRequestClose={onClose}
      head={<>
        <div className="drawer__titles">
          <p className="eyebrow">{lot.name}</p>
          <h2>{title}</h2>
        </div>
        {/* Фокус на крестике, а не в поле поиска: автофокус поля сразу раскрыл бы выдачу */}
        <button autoFocus className="icon-button" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
    >
      <div className="w-staff" onKeyDown={keepPickerEsc}>
        <ProjectStaffSection project={{ id: lot.id, name: lot.name, date_from: lot.dateFrom, date_to: lot.dateTo }} onChanged={onChanged} />
      </div>
    </DrawerFrame>
  )
}
