import { Save } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { BottomSheet } from '../../components/BottomSheet'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'
import { ExportChoice, type ExportChoiceProps } from './ExportChoice'
import './export-choice.css'

type ListExportSheetProps = {
  open: boolean
  onClose: () => void
  choice: ExportChoiceProps
  // Нет onSave — нет и кнопки «Сохранить в системе».
  onSave?: () => void
  saveDisabled?: boolean
  saving?: boolean
}

/**
 * Лист формата Excel на телефоне (макет с31): «Скачать Excel» в липкой плашке
 * открывает его, формат выбирается двумя карточками ExportChoice, сохранение
 * в системе — третьей тихой кнопкой с подписью «необязательно».
 *
 * Лист закрывается и действие вызывается в ОДНОМ обработчике, синхронно:
 * exportList прокручивает к пустым реквизитам и ставит в них фокус, и
 * отложенный вызов (rAF, эффект по закрытию) проиграл бы фокус уходящему листу.
 */
export function ListExportSheet({ open, ...props }: ListExportSheetProps) {
  // AnimatePresence держит лист в DOM, пока он уезжает вниз (как лист «Ещё» в App).
  return (
    <AnimatePresence>
      {open && <ListExportSheetLayer key="export" {...props} />}
    </AnimatePresence>
  )
}

// Отдельный компонент, а не ветка внутри ListExportSheet: useModalLayer берёт
// Esc и блокировку прокрутки на время жизни слоя, поэтому слой монтируется
// только открытым.
function ListExportSheetLayer({ onClose, choice, onSave, saveDisabled = false, saving = false }: Omit<ListExportSheetProps, 'open'>) {
  const { tr } = useLanguage()
  useModalLayer(onClose)

  function closeThen(action: () => void) {
    onClose()
    action()
  }

  return (
    <BottomSheet ariaLabelledBy="list-export-sheet-title" onClose={onClose} className="export-sheet">
      <h2 id="list-export-sheet-title" className="export-sheet__title">{tr('Какой файл скачать?', 'Qaysi faylni yuklab olish kerak?')}</h2>
      <ExportChoice
        {...choice}
        onWorking={() => closeThen(choice.onWorking)}
        onApproval={() => closeThen(choice.onApproval)}
      />
      <div className="export-sheet__foot">
        {onSave && (
          <button type="button" className="button button--secondary export-sheet__save" onClick={() => closeThen(onSave)} disabled={saveDisabled || saving}>
            <Save size={17} aria-hidden="true" />
            <span>{saving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить в системе', 'Tizimda saqlash')}</span>
            <small>{tr('необязательно', 'ixtiyoriy')}</small>
          </button>
        )}
        {/* Хват листа с клавиатуры недоступен (tabIndex -1), поэтому явная
            «Отмена» — единственный путь закрыть лист, кроме Esc. На ней же
            стартовый фокус: случайный Enter не должен скачать файл. */}
        <button autoFocus type="button" className="button button--secondary export-sheet__cancel" onClick={onClose}>{tr('Отмена', 'Bekor qilish')}</button>
      </div>
    </BottomSheet>
  )
}
