import { CircleAlert, ClipboardList, Pencil, Plus, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { fetchUnitLists, readCachedUnitLists, type UnitListUsage } from '../lists/unitUsage'
import { appendEquipmentToList, fetchAppendTargets, readCachedAppendTargets, type AppendResult, type AppendTarget } from '../lists/listAppend'
import { formatEventDate, parseDateValue } from '../../lib/date'
import { equipmentAvailabilityOptions, equipmentAvailabilityView } from './availability'
import { equipmentCode, equipmentIdentifier, formatUnitCount } from './format'
import type { Equipment } from './types'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'

// parseDateValue отдаёт null на мусоре в колонке: дата мероприятия nullable и
// приходит строкой из базы, а не из нашего пикера.
function eventDateLabel(value: string | null, locale: string) {
  if (!value) return null
  const date = parseDateValue(value)
  return date ? formatEventDate(date, locale) : null
}

// Конфликт версий приходит ДВУМЯ кодами, и оба обязаны распознаваться.
// PT409 — актуальный: PostgREST маппит PTxyz прямо в HTTP-статус, здесь 409 Conflict.
// 40001 — прежний, и он был ошибкой выбора: это serialization_failure, то есть
// «повтори транзакцию», и PostgREST повторял её бесконечно, потому что условие
// детерминированное. Запрос не возвращался никогда, кнопка сохранения гасла
// навсегда, а база писала по сотне тысяч исключений на один клик. Проверку 40001
// оставляем: пока миграция не доехала, старая RPC отвечает именно так.
function isStaleCardError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = (error as { code?: unknown }).code
  return code === 'PT409' || code === '40001'
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

export function EquipmentDrawer({ item, onClose, onRefreshed, onUpdated, instant = false }: { item: Equipment; onClose: () => void; onRefreshed: (item: Equipment) => void; onUpdated: (item: Equipment) => void; instant?: boolean }) {
  const { tr, locale, language } = useLanguage()
  useModalLayer(onClose)
  // Замораживается на маунте: анимацию появления решает то, был ли слой уже
  // открыт В МОМЕНТ открытия карточки, а не поздние ререндеры родителя.
  const [skipEnterAnimation] = useState(instant)
  const status = equipmentAvailabilityView(item.availability, tr)
  const [movements, setMovements] = useState<EquipmentMovement[]>(() => readCachedEquipmentMovements(item.id) ?? [])
  // Флаг вместо текста: иначе tr попадает в зависимости эффекта и смена языка
  // перезапрашивает историю движения.
  const [hasHistoryError, setHasHistoryError] = useState(false)
  // Списки, в которых стоит эта единица. Флаг ошибки, а не текст — по той же
  // причине, что и у истории.
  const [unitLists, setUnitLists] = useState<UnitListUsage[]>(() => readCachedUnitLists(item.id) ?? [])
  const [hasUnitListsError, setHasUnitListsError] = useState(false)
  // Кнопка «В список» (U35-б). Результат хранит имя и id списка, а не готовый
  // текст — по той же причине, что и флаги ошибок: смена языка не должна
  // оставлять сообщение на прежнем языке.
  const [isAppendOpen, setIsAppendOpen] = useState(false)
  const [appendTargets, setAppendTargets] = useState<AppendTarget[]>([])
  const [isLoadingTargets, setIsLoadingTargets] = useState(false)
  const [hasTargetsError, setHasTargetsError] = useState(false)
  const [appendBusyId, setAppendBusyId] = useState<string | null>(null)
  const [hasAppendError, setHasAppendError] = useState(false)
  const [appendResult, setAppendResult] = useState<({ listId: string; name: string } & AppendResult) | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSuccess, setEditSuccess] = useState('')
  // null — числа НЕТ: счёт ещё идёт или отказал. Единица по умолчанию делала из
  // отказа факт «правка заденет одну запись», хотя их могло быть 596.
  const [modelUnitCount, setModelUnitCount] = useState<number | null>(null)
  const [draft, setDraft] = useState(() => toEditDraft(item))
  // 'stale' — перечитать карточку не удалось, на экране данные из каталога;
  // 'missing' — записи в базе больше нет.
  const [refreshState, setRefreshState] = useState<'fresh' | 'stale' | 'missing'>('fresh')
  // Ответ, пришедший после закрытия, игнорируем: onRefreshed поднимает запись
  // наверх и заново открыл бы уже закрытый drawer.
  const isOpenRef = useRef(true)
  // Дровер — сам себе скролл-контейнер (.drawer overflow-y: auto), поэтому
  // прокрутка к подтверждению идёт по нему, а не по window.
  const drawerRef = useRef<HTMLElement>(null)
  const { brand, model, type, subtype, specification, length, description, availability, location, count } = draft
  const canSave = Boolean(brand.trim() && model.trim() && type.trim() && subtype.trim() && count >= 0)
  // Серийная единица в этих списках уже стоит — пикер блокирует их строки.
  const unitListIds = new Set(unitLists.map((list) => list.id))

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
    setModelUnitCount(null)
    countEquipmentModelUnits(item.brand, item.model)
      .then((value) => { if (current) setModelUnitCount(Math.max(1, value)) })
      .catch(() => { if (current) setModelUnitCount(null) })
    return () => { current = false }
  }, [item.brand, item.model])

  // Смена карточки — чужой результат добавления не имеет права остаться на экране.
  useEffect(() => {
    setIsAppendOpen(false)
    setAppendResult(null)
    setHasAppendError(false)
    setAppendBusyId(null)
  }, [item.id])

  useEffect(() => {
    let current = true
    const cached = readCachedUnitLists(item.id)
    if (cached) {
      setUnitLists(cached)
      setHasUnitListsError(false)
    } else {
      setUnitLists([])
    }
    fetchUnitLists(item.id)
      .then((rows) => {
        if (!current) return
        setUnitLists(rows)
        setHasUnitListsError(false)
      })
      .catch(() => {
        // Пустой раздел и отказ — разные вещи: «ни в одном списке» это ответ,
        // а молчание после сбоя выдало бы отказ за ответ.
        if (current && !cached) setHasUnitListsError(true)
      })
    return () => { current = false }
  }, [item.id])

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

  // Прокрутка к подтверждению — ПОСЛЕ коммита, а не в обработчике сохранения.
  // Панель правки схлопывается тем же обновлением состояния, и высота контента
  // резко падает уже после старта анимации: smooth-прокрутка, запущенная по
  // старому DOM, обрывалась на середине пути. Здесь DOM уже финальный.
  useEffect(() => {
    if (!editSuccess) return
    drawerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [editSuccess])

  function cancelEditing() {
    setDraft(toEditDraft(item))
    setEditError('')
    setIsEditing(false)
  }

  function toggleAppendPicker() {
    setAppendResult(null)
    setHasAppendError(false)
    if (isAppendOpen) {
      setIsAppendOpen(false)
      return
    }
    setIsAppendOpen(true)
    const cached = readCachedAppendTargets()
    if (cached) setAppendTargets(cached)
    setIsLoadingTargets(!cached)
    setHasTargetsError(false)
    fetchAppendTargets()
      .then((rows) => {
        if (!isOpenRef.current) return
        setAppendTargets(rows)
        setIsLoadingTargets(false)
      })
      .catch(() => {
        if (!isOpenRef.current) return
        setIsLoadingTargets(false)
        // Кэш — ответ, пусть и вчерашний; отказ показываем только без него.
        if (!cached) setHasTargetsError(true)
      })
  }

  async function appendToList(target: AppendTarget) {
    setAppendBusyId(target.id)
    setHasAppendError(false)
    try {
      const result = await appendEquipmentToList(target.id, item.id, item.tracking_mode)
      if (!isOpenRef.current) return
      setAppendResult({ listId: target.id, name: target.name, ...result })
      setIsAppendOpen(false)
      // «Сейчас в списках» обязан отразить добавление сразу: кэш префикса уже
      // сброшен самим appendEquipmentToList, запрос уйдёт в базу.
      fetchUnitLists(item.id)
        .then((rows) => {
          if (!isOpenRef.current) return
          setUnitLists(rows)
          setHasUnitListsError(false)
        })
        .catch(() => {})
    } catch {
      if (isOpenRef.current) setHasAppendError(true)
    } finally {
      if (isOpenRef.current) setAppendBusyId(null)
    }
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
    <div className={`drawer-layer${skipEnterAnimation ? ' drawer-layer--instant' : ''}`} role="dialog" aria-modal="true" aria-label={tr('Карточка оборудования', 'Uskuna kartasi')} onMouseDown={onClose}>
      <aside className="drawer" ref={drawerRef} onMouseDown={(event) => event.stopPropagation()}>
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
                {/* Без числа бейдж честно говорит «у всех», а не выдаёт неизвестное
                    за единицу: цена ошибки — правка описания у 596 единиц под видом одной. */}
                <span className="read-only-label">{modelUnitCount === null
                  ? tr('у всех единиц этой модели', 'bu modelning barcha birliklarida')
                  : formatUnitCount(modelUnitCount, tr)}</span>
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
                {/* У серийной единицы количество всегда 1 и в базу не уезжает —
                    показывать заблокированное поле незачем. */}
                {item.tracking_mode === 'quantity' && (
                  <label className="field"><span>{tr('Количество', 'Miqdor')}</span><input type="number" min="0" max="9999" value={count} onChange={(event) => changeDraft('count', Number(event.target.value))} /></label>
                )}
              </div>
            </section>
            {/* Ошибка и кнопки — один липкий блок: порознь сообщение о конфликте
                версий уезжало вверх за экран, а решение по нему принимают прямо
                у кнопки «Сохранить». */}
            <div className="equipment-edit-footer">
            {editError && <p className="form-error"><CircleAlert size={15} /> {editError}</p>}
            <div className="equipment-edit-actions">
              <button className="button button--secondary" type="button" onClick={cancelEditing} disabled={isSaving}>{tr('Отмена', 'Bekor qilish')}</button>
              <button className="button button--primary" type="button" onClick={() => void saveChanges()} disabled={!canSave || isSaving}><Save size={17} /> {isSaving ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить изменения', 'O‘zgarishlarni saqlash')}</button>
            </div>
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
        {/* U35-б: путь «нашёл в каталоге → добавил в список». Секция стоит перед
            «Сейчас в списках»: действие — над справкой о его результате. */}
        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('В список', 'Ro‘yxatga')}</h3><p>{tr('Добавить эту единицу в сохранённый список', 'Bu birlikni saqlangan ro‘yxatga qo‘shish')}</p></div></div>
          {appendResult && (
            <p className="form-success">
              <ClipboardList size={15} />
              <span>
                {appendResult.status !== 'added'
                  ? tr(`Эта единица уже в списке «${appendResult.name}».`, `Bu birlik «${appendResult.name}» ro‘yxatida allaqachon bor.`)
                  // Число называем со второй штуки: «теперь 1 шт.» — шум,
                  // а «теперь 3 шт.» — ответ на вопрос «сколько уже набрал».
                  : appendResult.count !== null && appendResult.count > 1
                    ? tr(`Добавлено в «${appendResult.name}» — теперь ${appendResult.count} шт.`, `«${appendResult.name}» ro‘yxatiga qo‘shildi — endi ${appendResult.count} dona.`)
                    : tr(`Добавлено в «${appendResult.name}».`, `«${appendResult.name}» ro‘yxatiga qo‘shildi.`)}
                {' '}<Link to={`/lists/${appendResult.listId}/edit`}>{tr('Открыть', 'Ochish')}</Link>
              </span>
            </p>
          )}
          {hasAppendError && <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось добавить в список. Список не изменён.', 'Ro‘yxatga qo‘shib bo‘lmadi. Ro‘yxat o‘zgarmadi.')}</p>}
          <button className="button button--secondary" type="button" onClick={toggleAppendPicker}>
            <Plus size={16} /> {tr('Добавить в список', 'Ro‘yxatga qo‘shish')}
          </button>
          {isAppendOpen && (
            hasTargetsError
              ? <p className="form-error">{tr('Не удалось загрузить списки.', 'Ro‘yxatlarni yuklab bo‘lmadi.')}</p>
              : isLoadingTargets && appendTargets.length === 0
                ? <p className="muted">{tr('Загружаем списки…', 'Ro‘yxatlar yuklanmoqda…')}</p>
                : appendTargets.length === 0
                  ? <p className="muted">{tr('Сохранённых списков пока нет.', 'Saqlangan ro‘yxatlar hali yo‘q.')} <Link to="/lists/new">{tr('Создать список', 'Ro‘yxat yaratish')}</Link></p>
                  : <ul className="unit-lists__items">
                    {appendTargets.map((target) => {
                      // Дубль серийной единицы сервер отвергнет и сам ('already'),
                      // но заблокированная строка честнее кнопки-обманки.
                      const alreadyIn = item.tracking_mode === 'serialized' && unitListIds.has(target.id)
                      return (
                        <li key={target.id}>
                          <button type="button" onClick={() => void appendToList(target)} disabled={alreadyIn || appendBusyId !== null}>
                            <ClipboardList size={16} />
                            <span>
                              <strong>{target.name}</strong>
                              <small>{alreadyIn
                                ? tr('Уже в этом списке', 'Bu ro‘yxatda allaqachon bor')
                                : appendBusyId === target.id
                                  ? tr('Добавляем…', 'Qo‘shilmoqda…')
                                  : eventDateLabel(target.reservation_start, locale) ?? tr('Дата не указана', 'Sana ko‘rsatilmagan')}</small>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
          )}
        </section>
        {/* «Где единица сейчас» — вопрос настоящего, поэтому стоит ПЕРЕД журналом:
            тот отвечает про прошлое. Раздел скрыт целиком, когда единица ни в
            одном списке и запрос при этом прошёл: пустой блок «ни в одном» —
            шум на каждой из 1 481 карточки. */}
        {(unitLists.length > 0 || hasUnitListsError) && (
          <section className="unit-lists">
            <div className="panel-heading"><div><h3>{tr('Сейчас в списках', 'Hozir ro‘yxatlarda')}</h3><p>{tr('Сохранённые документы, куда включена эта единица', 'Ushbu birlik kiritilgan saqlangan hujjatlar')}</p></div></div>
            {hasUnitListsError
              ? <p className="form-error">{tr('Не удалось проверить, в каких списках стоит единица.', 'Birlik qaysi ro‘yxatlarda turganini tekshirib bo‘lmadi.')}</p>
              : <ul className="unit-lists__items">
                {unitLists.map((list) => (
                  <li key={list.id}>
                    <Link to={`/lists/${list.id}/edit`}>
                      <ClipboardList size={16} />
                      <span>
                        {/* «× 3» — со второй штуки: одна подразумевается самим фактом строки. */}
                        <strong>{list.name}{list.count !== null && list.count > 1 ? ` × ${list.count}` : ''}</strong>
                        <small>{eventDateLabel(list.reservation_start, locale) ?? tr('Дата не указана', 'Sana ko‘rsatilmagan')}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>}
          </section>
        )}
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
