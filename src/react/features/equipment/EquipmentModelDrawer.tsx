import { CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import { fetchEquipmentUnitsByModel, type EquipmentModelSummary } from './api'
import { equipmentAvailabilityView } from './availability'
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
export function EquipmentModelDrawer({ summary, reloadKey, onClose, onOpenUnit }: {
  summary: EquipmentModelSummary
  // Ключ перезагрузки страницы: правка единицы в карточке инвалидирует кэш и
  // поднимает его — дровер обязан перечитать список мимо кэша.
  reloadKey: number
  onClose: () => void
  onOpenUnit: (item: Equipment) => void
}) {
  const { tr, language } = useLanguage()
  useModalLayer(onClose)
  const [units, setUnits] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

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

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Модель оборудования', 'Uskuna modeli')} onMouseDown={onClose}>
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
          <span className="badge badge--neutral"><i />{tr(`Всего: ${summary.unitsTotal} шт.`, `Jami: ${summary.unitsTotal} dona`)}</span>
          <span className={`badge ${summary.unitsAvailable > 0 ? 'badge--success' : 'badge--danger'}`}><i />{tr(`Доступно: ${summary.unitsAvailable}`, `Mavjud: ${summary.unitsAvailable}`)}</span>
          {/* «С серийником» — только когда номер есть не у всех штук: у полностью
              серийной модели бейдж дублировал бы «Всего». До загрузки единиц
              числа нет — бейдж появляется вместе со списком. */}
          {!isLoading && !hasError && serializedUnits.length < summary.unitsTotal
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
