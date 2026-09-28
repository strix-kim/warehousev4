import { CircleAlert, PackagePlus, Save, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import { AnimatePresence } from 'motion/react'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { addEquipmentUnit, fetchEquipmentUnitsByModel, type EquipmentModelSummary } from './api'
import { countUnitsByAvailability, equipmentAvailabilityView, toEquipmentAvailability } from './availability'
import { AvailabilityTicks } from './AvailabilityTicks'
import { DrawerFrame } from '../../components/DrawerFrame'
import type { Equipment } from './types'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useGuardedClose } from '../../lib/useGuardedClose'
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

  // Терять есть что только в открытой форме добавления: сам дровер — справка.
  // Открытая, но нетронутая форма (пустой номер, одна штука) — не потеря.
  const isDirty = isAddOpen && (addSerial.trim() !== '' || addCount !== 1)
  // Дровер живёт в адресе (?mbrand&mmodel): закрытие и переход в карточку
  // единицы — это setParams, и блокер ловит их наравне с «назад» браузера.
  // Поэтому оба идут через плашку, а подтверждённый уход — мимо блокера.
  const { requestClose, requestLeave, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && !isAddSaving, onClose)
  useModalLayer(requestClose)

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

  // Шкала и «большой факт» — из единиц, как только они пришли: у них настоящие
  // статусы. До загрузки — из снапшота строки каталога, где известно только
  // «свободно из всего».
  const breakdown = hasFreshUnits
    ? countUnitsByAvailability(units)
    : { free: unitsAvailable, warn: 0, bad: 0, rest: Math.max(0, unitsTotal - unitsAvailable) }
  const location = sample?.location

  return (
    <DrawerFrame
      ariaLabel={tr('Модель оборудования', 'Uskuna modeli')}
      instant={skipEnterAnimation}
      onRequestClose={requestClose}
      head={<>
        <div className="drawer__photo"><EquipmentVisual item={summary} alt={`${summary.brand} ${summary.model}`} /></div>
        <div className="drawer__titles">
          <p className="eyebrow">{translateEquipmentTaxonomy(summary.subtype, language)}</p>
          <h2>{summary.brand} {summary.model}</h2>
          <p className="drawer__meta">{translateEquipmentTaxonomy(summary.type, language)}{location ? ` · ${location}` : ''}</p>
        </div>
        <button autoFocus className="icon-button" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
      // Добавление доступно, когда есть образец: сервер копирует из него общие
      // поля модели. Пустая модель — заведение через форму каталога.
      foot={sample && !isAddOpen && (
        <button type="button" className="button button--secondary" onClick={() => { setIsAddOpen(true); setAddError(''); setAddSuccess('') }}>
          <PackagePlus size={16} /> {tr('Добавить единицу', 'Birlik qo‘shish')}
        </button>
      )}
    >
      <AnimatePresence>
        {isPrompting && (
          <UnsavedPrompt
            key="unsaved"
            message={tr('Есть несохранённые изменения.', 'Saqlanmagan o‘zgarishlar bor.')}
            stayLabel={tr('Продолжить правку', 'Tahrirni davom ettirish')}
            leaveLabel={tr('Закрыть без сохранения', 'Saqlamasdan yopish')}
            onStay={keepEditing}
            onLeave={confirmClose}
          />
        )}
      </AnimatePresence>
      {/* Главный факт модели — сколько свободно. Отклонения — строками под
          числом, каждая со словом: цвет шкалы без слова не читается. */}
      <div className="bigfact">
        <b>{unitsAvailable}</b>
        <span>
          {tr('из', '')} <strong>{unitsTotal}</strong> {tr('на складе', 'tadan omborda')}
          {breakdown.warn > 0 && <><br />{tr(`${breakdown.warn} на диагностике`, `${breakdown.warn} diagnostikada`)}</>}
          {breakdown.bad > 0 && <><br />{tr(`${breakdown.bad} нет на складе`, `${breakdown.bad} omborda yo‘q`)}</>}
          {breakdown.rest > 0 && hasFreshUnits && <><br />{tr(`${breakdown.rest} выдано или без статуса`, `${breakdown.rest} berilgan yoki holatsiz`)}</>}
          {/* «С серийником» — только когда номер есть не у всех штук: у полностью
              серийной модели строка дублировала бы «всего». */}
          {hasFreshUnits && serializedUnits.length < unitsTotal
            && <><br />{tr(`с серийным номером: ${serializedUnits.length}`, `seriya raqami bilan: ${serializedUnits.length}`)}</>}
        </span>
      </div>
      <AvailabilityTicks {...breakdown} />
      <section className="drawer-section">
        <h3 className="drawer-caps">{tr('Единицы', 'Birliklar')}</h3>
        {addSuccess && <p className="form-success"><Save size={15} /> {addSuccess}</p>}
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
              // Каждая строка — отдельная запись каталога: нажатие открывает её карточку.
              : <ul className="unit-rows">
                {orderedUnits.map((unit) => {
                  const status = equipmentAvailabilityView(unit.availability, tr)
                  const isQuantity = unit.tracking_mode === 'quantity'
                  return (
                    <li key={unit.id}>
                      <button type="button" onClick={() => requestLeave(() => onOpenUnit(unit))}>
                        {isQuantity
                          ? <strong>{unit.inventory_code
                            ? tr(`${unit.count} шт. · ${unit.inventory_code}`, `${unit.count} dona · ${unit.inventory_code}`)
                            : tr(`${unit.count} шт. без серийного номера`, `${unit.count} dona seriya raqamisiz`)}</strong>
                          : <strong className="mono">{unit.serialnumber || tr('Без серийного номера', 'Seriya raqamisiz')}</strong>}
                        <small>{unit.location}</small>
                        <span className={`badge badge--${status.tone}`}><i />{status.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>}
      </section>
      {sample && (
        <>
          {sample.lengthinmeters && sample.lengthinmeters !== 'N/A' && (
            <section className="drawer-section">
              <h3 className="drawer-caps">{tr('Длина', 'Uzunlik')}</h3>
              <p className="drawer-text">{sample.lengthinmeters}</p>
            </section>
          )}
          <section className="drawer-section">
            <h3 className="drawer-caps">{tr('Характеристики', 'Xususiyatlar')}</h3>
            <p className="drawer-text">{sample.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</p>
          </section>
          <section className="drawer-section">
            <h3 className="drawer-caps">{tr('Описание', 'Tavsif')}</h3>
            <p className="drawer-text">{sample.description || tr('Нет описания', 'Tavsif yo‘q')}</p>
          </section>
        </>
      )}
    </DrawerFrame>
  )
}
