import { CircleAlert, PackagePlus, Save, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import { addEquipmentUnit, fetchEquipmentUnitsByModel, type EquipmentModelSummary } from './api'
import { equipmentAvailabilityView, toEquipmentAvailability } from './availability'
import type { Equipment } from './types'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'

/**
 * Дровер модели (U29): строка каталога — модель, а её единицы человек смотрит
 * здесь. Клик по единице открывает существующую карточку (`?item=<id>`);
 * страница рисует В КАЖДЫЙ момент только один дровер — модели ИЛИ единицы, —
 * поэтому слоёв модалок два не бывает, а «назад» шагает карточка → модель →
 * каталог по записям истории.
 *
 * С с16 дровер отвечает на главный вопрос сам: информация об оборудовании
 * (категория, локация, характеристики, описание) видна сразу, без клика в
 * карточку. Серийник — опциональный атрибут единицы, а не её заголовок:
 * количественные записи показываются как «N шт. без серийного номера».
 */
export function EquipmentModelDrawer({ summary, reloadKey, onClose, onOpenUnit, onUnitsChanged, instant = false }: {
  summary: EquipmentModelSummary
  // Ключ перезагрузки страницы: правка единицы в карточке инвалидирует кэш и
  // поднимает его — дровер обязан перечитать список мимо кэша.
  reloadKey: number
  onClose: () => void
  onOpenUnit: (item: Equipment) => void
  // Добавление единицы меняет каталог: родитель поднимает reloadKey — выдача
  // перечитывается, а этот же ключ возвращается сюда и перечитывает единицы.
  onUnitsChanged: () => void
  // true — слой уже был открыт (возврат из карточки): анимацию появления не играем.
  instant?: boolean
}) {
  const { tr, language } = useLanguage()
  useModalLayer(onClose)
  // Замораживается на маунте — поздние ререндеры родителя анимацию не решают.
  const [skipEnterAnimation] = useState(instant)
  const [units, setUnits] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addSerial, setAddSerial] = useState('')
  const [addCount, setAddCount] = useState(1)
  const [isAddSaving, setIsAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => {
    let current = true
    setHasError(false)
    setIsLoading(true)
    fetchEquipmentUnitsByModel(summary.brand, summary.model, { bypassCache: reloadKey > 0 })
      .then((rows) => {
        if (!current) return
        setUnits(rows)
        setIsLoading(false)
      })
      .catch(() => {
        if (!current) return
        setHasError(true)
        setIsLoading(false)
      })
    return () => { current = false }
  }, [summary.brand, summary.model, reloadKey])

  // Серийные — вперёд, количественные — вниз: номер есть не у всех, и строки
  // «N шт. без номера» не должны перемешиваться с настоящими серийниками.
  const serializedUnits = units.filter((unit) => unit.tracking_mode === 'serialized')
  const quantityUnits = units.filter((unit) => unit.tracking_mode === 'quantity')
  const orderedUnits = [...serializedUnits, ...quantityUnits]
  // Общие поля модели показываем по образцу — первой единице выборки. Поля
  // единиц одной модели могут расходиться (исторические данные), выбирать
  // «правильную» здесь не из чего: точные значения — в карточке единицы.
  const sample = units[0]

  // Счётчики после загрузки — из единиц, а не из summary: summary — снапшот
  // строки каталога на момент открытия, и после «+1» он отстаёт от базы.
  const hasFreshUnits = !isLoading && !hasError
  const unitsTotal = hasFreshUnits ? units.reduce((sum, unit) => sum + Math.max(0, unit.count), 0) : summary.unitsTotal
  const unitsAvailable = hasFreshUnits
    ? units.reduce((sum, unit) => sum + (toEquipmentAvailability(unit.availability) === 'available' ? Math.max(0, unit.count) : 0), 0)
    : summary.unitsAvailable

  async function handleAddUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sample || isAddSaving) return
    setAddError('')
    setAddSuccess('')
    setIsAddSaving(true)
    try {
      const result = await addEquipmentUnit({
        sampleId: sample.id,
        serialNumber: addSerial,
        count: addCount,
      })
      if (result.status === 'duplicates') {
        setAddError(tr(`Такой серийный номер уже есть в каталоге: ${result.serials.join(', ')}.`, `Bunday seriya raqami katalogda allaqachon bor: ${result.serials.join(', ')}.`))
        return
      }
      setAddSuccess(tr(`Добавлено — теперь ${result.unitsTotal} шт.`, `Qo‘shildi — endi ${result.unitsTotal} dona.`))
      setIsAddOpen(false)
      setAddSerial('')
      setAddCount(1)
      // Кэш каталога уже сброшен самим addEquipmentUnit: поднятый reloadKey
      // перечитает и выдачу страницы, и список единиц этого дровера.
      onUnitsChanged()
    } catch {
      setAddError(tr('Не удалось добавить единицу — попробуйте ещё раз.', 'Birlikni qo‘shib bo‘lmadi — yana urinib ko‘ring.'))
    } finally {
      setIsAddSaving(false)
    }
  }

  return (
    <div className={`drawer-layer${skipEnterAnimation ? ' drawer-layer--instant' : ''}`} role="dialog" aria-modal="true" aria-label={tr('Модель оборудования', 'Uskuna modeli')} onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div>
            <p className="eyebrow">{translateEquipmentTaxonomy(summary.subtype, language)}</p>
            <h2>{summary.brand} {summary.model}</h2>
          </div>
          <div className="drawer__header-actions">
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>
        <EquipmentVisual item={summary} size="large" alt={`${summary.brand} ${summary.model}`} />
        <div className="model-drawer-stats">
          <span className="badge badge--neutral"><i />{tr(`Всего: ${unitsTotal} шт.`, `Jami: ${unitsTotal} dona`)}</span>
          <span className={`badge ${unitsAvailable > 0 ? 'badge--success' : 'badge--danger'}`}><i />{tr(`Доступно: ${unitsAvailable}`, `Mavjud: ${unitsAvailable}`)}</span>
          {/* «С серийником» — только когда номер есть не у всех штук: у полностью
              серийной модели бейдж дублировал бы «Всего». До загрузки единиц
              числа нет — бейдж появляется вместе со списком. */}
          {hasFreshUnits && serializedUnits.length < unitsTotal
            && <span className="badge badge--neutral"><i />{tr(`С серийником: ${serializedUnits.length}`, `Seriya raqami bilan: ${serializedUnits.length}`)}</span>}
        </div>
        {sample && (
          <dl className="detail-list">
            <div><dt>{tr('Категория', 'Toifa')}</dt><dd>{translateEquipmentTaxonomy(sample.type, language)}</dd></div>
            <div><dt>{tr('Подкатегория', 'Quyi toifa')}</dt><dd>{translateEquipmentTaxonomy(sample.subtype, language)}</dd></div>
            <div><dt>{tr('Локация', 'Joylashuv')}</dt><dd>{sample.location || '—'}</dd></div>
            {sample.lengthinmeters && sample.lengthinmeters !== 'N/A' && <div><dt>{tr('Длина', 'Uzunlik')}</dt><dd>{sample.lengthinmeters}</dd></div>}
            <div className="detail-list__wide"><dt>{tr('Характеристики', 'Xususiyatlar')}</dt><dd>{sample.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
            <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd>{sample.description || tr('Нет описания', 'Tavsif yo‘q')}</dd></div>
          </dl>
        )}
        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Единицы', 'Birliklar')}</h3><p>{tr('Каждая строка — отдельная запись каталога. Откройте, чтобы посмотреть или изменить.', 'Har bir qator — katalogning alohida yozuvi. Ko‘rish yoki o‘zgartirish uchun oching.')}</p></div></div>
          {addSuccess && <p className="form-success"><Save size={15} /> {addSuccess}</p>}
          {/* Добавление доступно, когда есть образец: сервер копирует из него
              общие поля модели. Пустая модель — заведение через форму каталога. */}
          {sample && !isAddOpen && (
            <button type="button" className="button button--secondary" onClick={() => { setIsAddOpen(true); setAddError(''); setAddSuccess('') }}>
              <PackagePlus size={16} /> {tr('Добавить единицу', 'Birlik qo‘shish')}
            </button>
          )}
          {sample && isAddOpen && (
            <form className="model-add-unit" onSubmit={handleAddUnit}>
              <div className="model-add-unit__fields">
                <label className="field">
                  <span>{tr('Серийный номер — если есть', 'Seriya raqami — bo‘lsa')}</span>
                  <input autoFocus className="input-mono" value={addSerial} onChange={(event) => setAddSerial(event.target.value)} placeholder={tr('Можно оставить пустым', 'Bo‘sh qoldirsa bo‘ladi')} />
                </label>
                <label className="field">
                  <span>{tr('Сколько', 'Nechta')}</span>
                  {/* С номером единица всегда одна: номер идентифицирует штуку. */}
                  <input type="number" min="1" max="9999" value={addSerial.trim() ? 1 : addCount} onChange={(event) => setAddCount(Math.max(1, Number(event.target.value) || 1))} disabled={Boolean(addSerial.trim())} />
                </label>
              </div>
              {addError && <p className="form-error"><CircleAlert size={15} /> {addError}</p>}
              <div className="model-add-unit__actions">
                <button type="button" className="button button--secondary" onClick={() => { setIsAddOpen(false); setAddError('') }} disabled={isAddSaving}>{tr('Отмена', 'Bekor qilish')}</button>
                <button type="submit" className="button button--primary" disabled={isAddSaving}>
                  {isAddSaving ? tr('Добавляем…', 'Qo‘shilmoqda…') : tr('Добавить', 'Qo‘shish')}
                </button>
              </div>
            </form>
          )}
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить единицы модели.', 'Model birliklarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <p className="muted">{tr('Загружаем единицы…', 'Birliklar yuklanmoqda…')}</p>
              : orderedUnits.length === 0
                ? <p className="muted">{tr('Единиц не нашлось — возможно, записи только что удалили.', 'Birliklar topilmadi — ehtimol, yozuvlar hozirgina o‘chirilgan.')}</p>
                : <ul className="unit-lists__items">
                  {orderedUnits.map((unit) => {
                    const status = equipmentAvailabilityView(unit.availability, tr)
                    const isQuantity = unit.tracking_mode === 'quantity'
                    return (
                      <li key={unit.id}>
                        <button type="button" onClick={() => onOpenUnit(unit)}>
                          <span>
                            {isQuantity
                              ? <strong>{unit.inventory_code
                                ? tr(`${unit.count} шт. · ${unit.inventory_code}`, `${unit.count} dona · ${unit.inventory_code}`)
                                : tr(`${unit.count} шт. без серийного номера`, `${unit.count} dona seriya raqamisiz`)}</strong>
                              : <strong className="mono">{unit.serialnumber || tr('Без серийного номера', 'Seriya raqamisiz')}</strong>}
                            <small>
                              {status.label}
                              {unit.location ? ` · ${unit.location}` : ''}
                            </small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>}
        </section>
      </aside>
    </div>
  )
}
