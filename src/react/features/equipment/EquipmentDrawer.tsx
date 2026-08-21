import { CircleAlert, Pencil, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import {
  countEquipmentModelUnits,
  fetchEquipmentById,
  fetchEquipmentMovements,
  readCachedEquipmentMovements,
  updateEquipmentModelAndUnit,
  type EquipmentMovement,
} from './api'
import { equipmentAvailabilityOptions, equipmentAvailabilityView } from './availability'
import { equipmentCode, equipmentIdentifier } from './format'
import type { Equipment } from './types'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'

// 40001 (serialization_failure) серверная RPC поднимает, когда карточку изменили
// после того, как её открыли: правка не применена ни в одном поле.
function isStaleCardError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === '40001'
}

// Черновик формы в drawer'е: одним объектом, чтобы сброс к записи был одной
// операцией, а не десятью setState в двух местах.
type EquipmentEditDraft = {
  brand: string
  model: string
  type: string
  subtype: string
  specification: string
  length: string
  description: string
  availability: string
  location: string
  count: number
}

function toEditDraft(item: Equipment): EquipmentEditDraft {
  return {
    brand: item.brand,
    model: item.model,
    type: item.type,
    subtype: item.subtype,
    specification: item.technicalspecification ?? '',
    // 'N/A' — способ базы сказать «длина не применима»; в поле это пусто.
    length: item.lengthinmeters === 'N/A' ? '' : item.lengthinmeters ?? '',
    description: item.description ?? '',
    availability: item.availability,
    location: item.location,
    count: item.count,
  }
}

export function EquipmentDrawer({ item, onClose, onRefreshed, onUpdated }: { item: Equipment; onClose: () => void; onRefreshed: (item: Equipment) => void; onUpdated: (item: Equipment) => void }) {
  const { tr, locale, language } = useLanguage()
  useModalLayer(onClose)
  const status = equipmentAvailabilityView(item.availability, tr)
  const [movements, setMovements] = useState<EquipmentMovement[]>(() => readCachedEquipmentMovements(item.id) ?? [])
  // Флаг вместо текста: иначе tr попадает в зависимости эффекта и смена языка
  // перезапрашивает историю движения.
  const [hasHistoryError, setHasHistoryError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')
  const [modelUnitCount, setModelUnitCount] = useState(1)
  const [draft, setDraft] = useState(() => toEditDraft(item))
  // 'stale' — перечитать карточку не удалось, на экране данные из каталога;
  // 'missing' — записи в базе больше нет.
  const [refreshState, setRefreshState] = useState<'fresh' | 'stale' | 'missing'>('fresh')
  // Ответ, пришедший после закрытия, игнорируем: onRefreshed поднимает запись
  // наверх и заново открыл бы уже закрытый drawer.
  const isOpenRef = useRef(true)
  const { brand, model, type, subtype, specification, length, description, availability, location, count } = draft
  const canSave = Boolean(brand.trim() && model.trim() && type.trim() && subtype.trim() && count >= 0)

  function changeDraft<K extends keyof EquipmentEditDraft>(field: K, value: EquipmentEditDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => () => { isOpenRef.current = false }, [])

  useEffect(() => {
    // Пока идёт правка, черновик не пересобираем: перечитывание карточки — в том
    // числе после конфликта версий — не имеет права стереть введённое.
    if (isEditing) return
    setDraft(toEditDraft(item))
  }, [isEditing, item])

  // Перечитывание карточки с сервера: общее для открытия drawer'а и для отказа
  // 40001 — в обоих случаях нужна свежая строка вместе с её updated_at.
  async function reloadCard() {
    try {
      const fresh = await fetchEquipmentById(item.id)
      if (!isOpenRef.current) return
      if (!fresh) {
        setRefreshState('missing')
        return
      }
      setRefreshState('fresh')
      onRefreshed(fresh)
    } catch {
      // Отказ не выдаём за «данных нет»: карточка остаётся на данных каталога,
      // но пользователь видит, что они могут быть устаревшими.
      if (isOpenRef.current) setRefreshState('stale')
    }
  }

  // Карточку открывают на данных каталога, а им до десяти минут. Свежая строка
  // сжимает окно, в котором устаревшая вкладка перезапишет чужую правку, и даёт
  // актуальный updated_at для сверки версии на сервере.
  useEffect(() => {
    void reloadCard()
    // Зависимость только от id: reloadCard замыкает onRefreshed, которую родитель
    // пересоздаёт на каждом рендере, и эффект зациклился бы на своём же обновлении.
  }, [item.id])

  useEffect(() => {
    let current = true
    countEquipmentModelUnits(item.brand, item.model)
      .then((value) => { if (current) setModelUnitCount(Math.max(1, value)) })
      .catch(() => { if (current) setModelUnitCount(1) })
    return () => { current = false }
  }, [item.brand, item.model])

  useEffect(() => {
    let current = true
    const cached = readCachedEquipmentMovements(item.id)
    if (cached) {
      setMovements(cached)
      setHasHistoryError(false)
    } else {
      setMovements([])
    }
    fetchEquipmentMovements(item.id, { bypassCache: Boolean(cached) })
      .then((data) => {
        if (!current) return
        setMovements(data)
        setHasHistoryError(false)
      })
      .catch(() => {
        if (current && !cached) setHasHistoryError(true)
      })
    return () => { current = false }
  }, [item.id])

  function cancelEditing() {
    setDraft(toEditDraft(item))
    setEditError('')
    setIsEditing(false)
  }

  async function saveChanges() {
    if (!canSave) return
    // Локация в базе NOT NULL: пустое поле называем сами, иначе пользователь получит безымянный отказ RPC.
    if (!location.trim()) {
      setEditError(tr('Укажите локацию — без неё сохранить нельзя.', 'Joylashuvni ko‘rsating — usiz saqlab bo‘lmaydi.'))
      return
    }
    setIsSaving(true)
    setEditError('')
    setEditSuccess('')
    try {
      const { item: updated, updatedModelUnits } = await updateEquipmentModelAndUnit({
        id: item.id,
        brand,
        model,
        type,
        subtype,
        technicalspecification: specification,
        lengthinmeters: length,
        description,
        availability,
        location,
        // Серийная карточка количеством не управляет: параметр не уезжает вовсе,
        // и база оставляет count прежним. Принудительная единица раньше писала
        // фантомную строку в журнал движения при правке одного описания.
        count: item.tracking_mode === 'quantity' ? count : undefined,
        updatedAt: item.updated_at,
      })
      onUpdated(updated)
      setIsEditing(false)
      setEditSuccess(updatedModelUnits === null
        ? tr('Изменения сохранены.', 'O‘zgarishlar saqlandi.')
        : tr(
          `Изменения сохранены. Данные модели обновлены у ${updatedModelUnits} единиц.`,
          `O‘zgarishlar saqlandi. Model ma’lumotlari ${updatedModelUnits} ta birlikda yangilandi.`,
        ))
    } catch (error) {
      if (isStaleCardError(error)) {
        setEditError(tr(
          'Карточку уже изменили в другой вкладке или другим сотрудником. Данные обновлены — проверьте и сохраните ещё раз.',
          'Karta boshqa oynada yoki boshqa xodim tomonidan o‘zgartirilgan. Ma’lumotlar yangilandi — tekshiring va yana saqlang.',
        ))
        // Введённые значения остаются на экране: пользователь предупреждён и решает
        // сам, а повторное сохранение уйдёт уже с новым updated_at.
        await reloadCard()
      } else {
        setEditError(tr('Не удалось сохранить изменения. Данные не изменены.', 'O‘zgarishlarni saqlab bo‘lmadi. Ma’lumotlar o‘zgarmadi.'))
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Карточка оборудования', 'Uskuna kartasi')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{equipmentCode(item.id)}</p>
            <h2>{item.brand} {item.model}</h2>
          </div>
          <div className="drawer__header-actions">
            {!isEditing && <button className="button button--secondary" onClick={() => { setIsEditing(true); setEditSuccess('') }}><Pencil size={16} /> {tr('Редактировать', 'Tahrirlash')}</button>}
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>
        <span className={`badge badge--${status.tone}`}><i />{status.label}</span>
        {refreshState !== 'fresh' && (
          <p className="form-error"><CircleAlert size={15} /> {refreshState === 'missing'
            ? tr('Записи больше нет в базе — возможно, её удалили.', 'Yozuv bazada yo‘q — ehtimol, u o‘chirilgan.')
            : tr('Не удалось обновить карточку с сервера — показаны данные из каталога.', 'Kartani serverdan yangilab bo‘lmadi — katalogdagi ma’lumotlar ko‘rsatilmoqda.')}</p>
        )}
        <EquipmentVisual item={isEditing ? { brand, model, type, subtype } : item} size="large" alt={`${brand} ${model}`} />
        {editSuccess && <p className="form-success"><Save size={15} /> {editSuccess}</p>}
        {isEditing ? (
          <div className="equipment-edit-panel">
            <section className="equipment-edit-section">
              <div className="equipment-edit-section__heading">
                <div><h3>{tr('Данные модели', 'Model ma’lumotlari')}</h3><p>{tr('Изменятся у всех экземпляров с тем же брендом и моделью.', 'Xuddi shu brend va modeldagi barcha nusxalarda o‘zgaradi.')}</p></div>
                <span className="read-only-label">{modelUnitCount} {tr('единиц', 'birlik')}</span>
              </div>
              <div className="equipment-edit-grid">
                <label className="field"><span>{tr('Бренд', 'Brend')} *</span><input value={brand} onChange={(event) => changeDraft('brand', event.target.value)} /></label>
                <label className="field"><span>{tr('Модель', 'Model')} *</span><input value={model} onChange={(event) => changeDraft('model', event.target.value)} /></label>
                <label className="field"><span>{tr('Категория', 'Toifa')} *</span><input value={type} onChange={(event) => changeDraft('type', event.target.value)} /></label>
                <label className="field"><span>{tr('Подкатегория', 'Quyi toifa')} *</span><input value={subtype} onChange={(event) => changeDraft('subtype', event.target.value)} /></label>
                <label className="field"><span>{tr('Длина, м', 'Uzunlik, m')}</span><input value={length} onChange={(event) => changeDraft('length', event.target.value)} placeholder={tr('Только если применимо', 'Faqat tegishli bo‘lsa')} /></label>
                <label className="field field--wide"><span>{tr('Технические характеристики', 'Texnik xususiyatlar')}</span><textarea value={specification} onChange={(event) => changeDraft('specification', event.target.value)} rows={3} /></label>
                <label className="field field--wide"><span>{tr('Описание', 'Tavsif')}</span><textarea value={description} onChange={(event) => changeDraft('description', event.target.value)} rows={3} /></label>
              </div>
            </section>
            <section className="equipment-edit-section">
              <div className="equipment-edit-section__heading">
                <div><h3>{tr('Конкретная единица', 'Muayyan birlik')}</h3><p>{tr('Статус и локация изменятся только у этой записи. Серийный номер останется прежним.', 'Holat va joylashuv faqat shu yozuvda o‘zgaradi. Seriya raqami o‘zgarmaydi.')}</p></div>
              </div>
              <div className="equipment-edit-grid">
                <div className="field"><span>{tr('Статус', 'Holat')}</span><AppSelect value={availability} onChange={(value) => changeDraft('availability', value)} ariaLabel={tr('Статус оборудования', 'Uskuna holati')} options={equipmentAvailabilityOptions(tr)} /></div>
                <label className="field"><span>{tr('Локация', 'Joylashuv')} *</span><input value={location} onChange={(event) => changeDraft('location', event.target.value)} required /></label>
                <label className="field"><span>{item.tracking_mode === 'quantity' ? tr('Внутренний код', 'Ichki kod') : tr('Серийный номер', 'Seriya raqami')}</span><input value={equipmentIdentifier(item, tr)} readOnly /></label>
                <label className="field"><span>{tr('Количество', 'Miqdor')}</span><input type="number" min="0" max="9999" value={item.tracking_mode === 'serialized' ? 1 : count} onChange={(event) => changeDraft('count', Number(event.target.value))} disabled={item.tracking_mode === 'serialized'} /></label>
              </div>
            </section>
            {editError && <p className="form-error"><CircleAlert size={15} /> {editError}</p>}
            <div className="equipment-edit-actions">
              <button className="button button--secondary" type="button" onClick={cancelEditing} disabled={isSaving}>{tr('Отмена', 'Bekor qilish')}</button>
              <button className="button button--primary" type="button" onClick={() => void saveChanges()} disabled={!canSave || isSaving}><Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить изменения', 'O‘zgarishlarni saqlash')}</button>
            </div>
          </div>
        ) : <><dl className="detail-list">
          <div><dt>{tr('Категория', 'Toifa')}</dt><dd>{translateEquipmentTaxonomy(item.type, language)}</dd></div>
          <div><dt>{tr('Подкатегория', 'Quyi toifa')}</dt><dd>{translateEquipmentTaxonomy(item.subtype, language)}</dd></div>
          <div><dt>{tr('Способ учёта', 'Hisob turi')}</dt><dd>{item.tracking_mode === 'quantity' ? tr('По количеству', 'Miqdor bo‘yicha') : tr('По серийному номеру', 'Seriya raqami bo‘yicha')}</dd></div>
          <div><dt>{item.tracking_mode === 'quantity' ? tr('Внутренний код', 'Ichki kod') : tr('Серийный номер', 'Seriya raqami')}</dt><dd className="mono">{equipmentIdentifier(item, tr)}</dd></div>
          <div><dt>{tr('Количество', 'Miqdor')}</dt><dd>{item.count} {tr('шт.', 'dona')}</dd></div>
          <div><dt>{tr('Локация', 'Joylashuv')}</dt><dd>{item.location || '—'}</dd></div>
          {item.lengthinmeters && item.lengthinmeters !== 'N/A' && <div><dt>{tr('Длина', 'Uzunlik')}</dt><dd>{item.lengthinmeters}</dd></div>}
          <div className="detail-list__wide"><dt>{tr('Характеристики', 'Xususiyatlar')}</dt><dd>{item.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd>{item.description || tr('Нет описания', 'Tavsif yo‘q')}</dd></div>
        </dl>
        <section className="history-section">
          <div className="panel-heading"><div><h3>{tr('История движения', 'Harakat tarixi')}</h3><p>{tr('Количество, статус, выдачи и возвраты', 'Miqdor, holat, berish va qaytarish')}</p></div></div>
          <div className="timeline">
            {movements.map((movement) => (
              <div className="timeline__item" key={movement.id}>
                <i />
                <div>
                  <strong>{movementLabel(movement, tr)}</strong>
                  <span>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.changed_at))}</span>
                  {(movement.quantity_before !== movement.quantity_after) && <p>{movement.quantity_before ?? '—'} → {movement.quantity_after ?? '—'} {tr('шт.', 'dona')} ({movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta})</p>}
                  {movement.note && <p>{movement.note}</p>}
                </div>
              </div>
            ))}
            {!hasHistoryError && movements.length === 0 && <p className="muted">{tr('История пока пуста. После подключения журнала здесь появятся изменения количества, выдачи и возвраты.', 'Tarix hozircha bo‘sh. Jurnal ulangach, bu yerda miqdor o‘zgarishi, berish va qaytarishlar ko‘rinadi.')}</p>}
            {hasHistoryError && <p className="form-error">{tr('История временно недоступна.', 'Tarix vaqtincha mavjud emas.')}</p>}
          </div>
        </section></>}
      </aside>
    </div>
  )
}

function movementLabel(movement: EquipmentMovement, tr: (ru: string, uz: string) => string) {
  switch (movement.movement_type) {
    case 'created': return tr('Добавлено на склад', 'Omborga qo‘shildi')
    case 'issued': return tr('Выдано по списку', 'Ro‘yxat bo‘yicha berildi')
    case 'returned': return tr('Возвращено на склад', 'Omborga qaytarildi')
    case 'status_normalized': return tr('Старый статус нормализован', 'Eski holat me’yorlashtirildi')
    case 'quantity_changed': return tr('Изменено количество', 'Miqdor o‘zgartirildi')
    case 'status_changed': return tr('Изменён статус', 'Holat o‘zgartirildi')
    case 'quantity_and_status_changed': return tr('Изменены количество и статус', 'Miqdor va holat o‘zgartirildi')
  }
}
