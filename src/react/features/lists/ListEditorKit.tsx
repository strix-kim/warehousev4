import { Check, CircleAlert, Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
import type { ResolvedSelection } from './listDocument'
import { MAX_ITEM_COUNT } from './listSelection'

// Половина редактора «Комплект»: позиции с количеством и серийниками, итог,
// очистка и экспорт. Сама выборка живёт на странице — панель только просит её
// изменить. Выбор формата приходит готовым узлом (ExportChoice; на телефоне
// скрыт — там его показывает лист). Строка состояния — только на телефоне.
export function KitPanel({ panelRef, isMobileActive, resolvedSelection, selectedCount, shownUnits, shownPositions, freshKeys, onFreshSettled, onChangeCount, onSetCount, onToggleSerialPicker, onToggleSerial, onClear, exportActions, status }: {
  panelRef: RefObject<HTMLElement | null>
  isMobileActive: boolean
  resolvedSelection: ResolvedSelection
  selectedCount: number
  // Числа для показа — докрученные страницей (useCountUp); selectedCount — точное.
  shownUnits: number
  shownPositions: number
  freshKeys: Set<string>
  onFreshSettled: (key: string) => void
  onChangeCount: (key: string, delta: number) => void
  onSetCount: (key: string, count: number) => void
  onToggleSerialPicker: (key: string) => void
  onToggleSerial: (key: string, equipmentId: string) => void
  onClear: () => void
  exportActions: ReactNode
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
        <div><h2>{tr('Комплект', 'Komplekt')}</h2><p>{tr('Количество сейчас, серийные номера — при необходимости', 'Hozir miqdor, zarur bo‘lsa seriya raqamlari')}</p></div>
        <span className="count" title={tr('Позиций в комплекте', 'Komplektdagi pozitsiyalar')}>{shownPositions}</span>
      </div>

      <div className="selection-list quick-selection-list">
        {resolvedSelection.length === 0 && (
          <EmptyState art title={tr('Список пока пуст', 'Ro‘yxat hozircha bo‘sh')} text={tr('Нажмите на нужную модель в каталоге.', 'Katalogdagi kerakli modelni bosing.')} />
        )}
        {resolvedSelection.map(({ item, group, label }) => (
          <KitItemFrame key={item.key} itemKey={item.key} fresh={freshKeys.has(item.key)} onSettled={onFreshSettled}>
            <div className="quick-selection-item__main">
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
                <button onClick={() => onChangeCount(item.key, 1)} disabled={item.count >= MAX_ITEM_COUNT} aria-label={tr('Увеличить', 'Ko‘paytirish')}><Plus size={14} /></button>
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
                  return <button aria-pressed={active} onClick={() => onToggleSerial(item.key, equipmentItem.id)} key={equipmentItem.id} type="button">{active && <Check size={13} strokeWidth={2.6} />}{equipmentItem.serialnumber || tr('Без номера', 'Raqamsiz')}</button>
                })}</div>
              </div>
            )}
          </KitItemFrame>
        ))}
      </div>

      <footer className="selection-footer">
        <div className="selection-footer__summary">
          <span className="selection-footer__total">{tr('Всего единиц', 'Jami birliklar')} <strong>{shownUnits}</strong></span>
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
        <div className="selection-footer__export">{exportActions}</div>
        {/* Результат действия на телефоне: шапка со строкой состояния там
            уезжает вверх, а экспорт и сохранение жмут из листа внизу. Шире 700
            узел скрыт — там тот же текст стоит в липкой шапке. */}
        {status}
      </footer>
    </section>
  )
}

// Рамка позиции комплекта. Свежая (только что добавленная из каталога) позиция
// раскрывается по высоте и вспыхивает подсветкой, 200 мс (макет с31). Свежесть
// фиксируется на монтировании: страница снимает ключ сразу после него, а
// перерисовки не должны ни запускать въезд заново, ни обрывать подсветку.
// Ухода нет намеренно: удалённая позиция на 150 мс осталась бы поверх пустого
// состояния и под живыми кнопками.
function KitItemFrame({ itemKey, fresh, onSettled, children }: {
  itemKey: string
  fresh: boolean
  onSettled: (key: string) => void
  children: ReactNode
}) {
  // MotionConfig reducedMotion="user" гасит только сдвиги — высоту и прозрачность
  // при уменьшении движения выключаем сами.
  const reduceMotion = useReducedMotion()
  const [enter] = useState(() => fresh && !reduceMotion)

  useEffect(() => {
    if (fresh) onSettled(itemKey)
  }, [fresh, itemKey, onSettled])

  return (
    <m.article
      className={`quick-selection-item ${enter ? 'quick-selection-item--fresh' : ''}`}
      initial={enter ? { height: 0, opacity: 0 } : false}
      animate={{ height: 'auto', opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </m.article>
  )
}
