import { Check, CircleAlert, Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
import type { ResolvedSelection } from './listDocument'

// Половина редактора «В списке»: позиции с количеством и серийниками, итог и
// очистка. Сама выборка живёт на странице — панель только просит её изменить.
// Действия и строка состояния приходят готовыми узлами: тот же набор стоит в шапке.
export function KitPanel({ panelRef, isMobileActive, resolvedSelection, selectedCount, onChangeCount, onSetCount, onToggleSerialPicker, onToggleSerial, onClear, actions, status }: {
  panelRef: RefObject<HTMLElement | null>
  isMobileActive: boolean
  resolvedSelection: ResolvedSelection
  selectedCount: number
  onChangeCount: (key: string, delta: number) => void
  onSetCount: (key: string, count: number) => void
  onToggleSerialPicker: (key: string) => void
  onToggleSerial: (key: string, equipmentId: string) => void
  onClear: () => void
  actions: ReactNode
  status: ReactNode | null
}) {
  const { tr, language } = useLanguage()
  // Количество, которое пользователь СЕЙЧАС набирает. Держим отдельно от выборки:
  // пустое поле — законное промежуточное состояние, а count = 0 выбросил бы позицию.
  const [countDraft, setCountDraft] = useState<{ key: string; text: string } | null>(null)
  // Оба действия необратимы и стоят рядом с обычными кнопками, поэтому спрашивают
  // подтверждение вторым нажатием. Экземпляры независимые: взведённая «Очистить»
  // не должна взводить «Начать заново».
  const clearArmed = useArmedAction()

  // Набранное число применяется ОДИН раз — на blur или Enter, а не на каждый символ:
  // иначе «12» поверх «5» проходило бы через count = 1 и резало бы выбранные S/N до
  // одного, восстановить которые нечем. Клик по любой кнопке сначала снимает фокус,
  // так что «Сохранить»/«Excel» всегда видят уже зафиксированное количество.
  function commitCountDraft(key: string) {
    if (countDraft?.key === key && Number(countDraft.text) >= 1) onSetCount(key, Number(countDraft.text))
    setCountDraft(null)
  }

  return (
    <section ref={panelRef} className={`data-panel selection-panel ${isMobileActive ? 'mobile-active' : ''}`}>
      <div className="panel-heading">
        <div><h2>{tr('Рабочий список', 'Ish ro‘yxati')}</h2><p>{tr('Количество сейчас, серийные номера — при необходимости.', 'Hozir miqdor, zarur bo‘lsa seriya raqamlari.')}</p></div>
        <strong className="selection-count">{selectedCount}</strong>
      </div>

      <div className="selection-list quick-selection-list">
        {resolvedSelection.length === 0 && (
          <EmptyState art title={tr('Список пока пуст', 'Ro‘yxat hozircha bo‘sh')} text={tr('Нажмите на нужную модель в каталоге.', 'Katalogdagi kerakli modelni bosing.')} />
        )}
        {resolvedSelection.map(({ item, group, label }, index) => (
          <article className="quick-selection-item" key={item.key}>
            <div className="quick-selection-item__main">
              <span className="equipment-row-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="quick-selection-item__copy">
                <strong>{label.brand} {label.model}</strong>
                <small>{translateEquipmentTaxonomy(label.subtype, language)} · {group
                  ? `${tr('на складе', 'omborda')} ${group.availableCount}`
                  : tr('нет в каталоге', 'katalogda yo‘q')}{item.serialIds.length > 0
                    ? tr(` · S/N ${item.serialIds.length} из ${item.count}`, ` · S/N ${item.serialIds.length} / ${item.count}`)
                    : ''}</small>
              </div>
              <div className="quantity-stepper">
                <button onClick={() => onChangeCount(item.key, -1)} aria-label={tr('Уменьшить', 'Kamaytirish')}><Minus size={14} /></button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  aria-label={tr('Количество', 'Miqdor')}
                  value={countDraft?.key === item.key ? countDraft.text : String(item.count)}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setCountDraft({ key: item.key, text: event.target.value.replace(/\D+/g, '').slice(0, 3) })}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
                  onBlur={() => commitCountDraft(item.key)}
                />
                <button onClick={() => onChangeCount(item.key, 1)} aria-label={tr('Увеличить', 'Ko‘paytirish')}><Plus size={14} /></button>
              </div>
              {group && group.serializedItems.length > 0 && (
                <button
                  className={`icon-button serial-button ${item.serialPickerOpen ? 'is-open' : ''}`}
                  type="button"
                  onClick={() => onToggleSerialPicker(item.key)}
                  aria-label={tr('Уточнить серийные номера', 'Seriya raqamlarini aniqlash')}
                  aria-expanded={item.serialPickerOpen}
                ><ScanBarcode size={16} /></button>
              )}
              <button className="icon-button" onClick={() => onChangeCount(item.key, -item.count)} aria-label={tr('Удалить модель', 'Modelni o‘chirish')}><Trash2 size={16} /></button>
            </div>
            {group && item.count > group.availableCount && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Больше текущего остатка — в Excel попадёт указанное количество.', 'Joriy qoldiqdan ko‘p — Excelga ko‘rsatilgan miqdor tushadi.')}</p>}
            {!group && <p className="quick-inline-warning"><CircleAlert size={13} /> {tr('Модели больше нет в каталоге — позиция уйдёт в документ как планируемая.', 'Model katalogda yo‘q — pozitsiya hujjatga rejalashtirilgan sifatida tushadi.')}</p>}
            {group && group.serializedItems.length > 0 && item.serialPickerOpen && (
              <div className="serial-picker">
                <p>{tr('Отметьте только те номера, которые точно поедут на мероприятие.', 'Tadbirga aniq olib boriladigan raqamlarni belgilang.')}</p>
                <div>{group.serializedItems.map((equipmentItem) => {
                  const active = item.serialIds.includes(equipmentItem.id)
                  return <button className={active ? 'active' : ''} onClick={() => onToggleSerial(item.key, equipmentItem.id)} key={equipmentItem.id} type="button"><span>{active && <Check size={13} />}</span>{equipmentItem.serialnumber || tr('Без номера', 'Raqamsiz')}</button>
                })}</div>
              </div>
            )}
          </article>
        ))}
      </div>

      <footer className="selection-footer">
        <div>
          <span className="selection-footer__total">{tr('Всего единиц', 'Jami birliklar')} <strong>{selectedCount}</strong></span>
          {resolvedSelection.length > 0 && (
            <button
              className={`clear-selection ${clearArmed.armed ? 'clear-selection--armed' : ''}`}
              onClick={() => clearArmed.fire(onClear)}
              onBlur={clearArmed.disarm}
              type="button"
            ><Trash2 size={14} /> {clearArmed.armed
              ? tr(`Да, очистить ${selectedCount}`, `Ha, ${selectedCount} ta tozalansin`)
              : tr('Очистить список', 'Ro‘yxatni tozalash')}</button>
          )}
        </div>
        {/* Дубль действий для телефона: на десктопе он скрыт CSS, там кнопки живут в
            липкой шапке. Сообщение о результате держим рядом с нажатой кнопкой. */}
        <div className="selection-footer__mobile">
          {actions}
          {status}
        </div>
      </footer>
    </section>
  )
}
