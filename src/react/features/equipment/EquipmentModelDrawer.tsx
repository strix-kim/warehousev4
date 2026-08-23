import { CircleAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import { fetchEquipmentUnitsByModel, type EquipmentModelSummary } from './api'
import { equipmentAvailabilityView } from './availability'
import { equipmentIdentifier } from './format'
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
        <div className="model-drawer-stats">
          <span className="badge badge--neutral"><i />{tr(`Всего: ${summary.unitsTotal} шт.`, `Jami: ${summary.unitsTotal} dona`)}</span>
          <span className={`badge ${summary.unitsAvailable > 0 ? 'badge--success' : 'badge--danger'}`}><i />{tr(`Доступно: ${summary.unitsAvailable}`, `Mavjud: ${summary.unitsAvailable}`)}</span>
        </div>
        <EquipmentVisual item={summary} size="large" alt={`${summary.brand} ${summary.model}`} />
        <section className="unit-lists">
          <div className="panel-heading"><div><h3>{tr('Единицы', 'Birliklar')}</h3><p>{tr('Каждая строка — отдельная запись каталога. Откройте, чтобы посмотреть или изменить.', 'Har bir qator — katalogning alohida yozuvi. Ko‘rish yoki o‘zgartirish uchun oching.')}</p></div></div>
          {hasError
            ? <p className="form-error"><CircleAlert size={15} /> {tr('Не удалось загрузить единицы модели.', 'Model birliklarini yuklab bo‘lmadi.')}</p>
            : isLoading
              ? <p className="muted">{tr('Загружаем единицы…', 'Birliklar yuklanmoqda…')}</p>
              : units.length === 0
                ? <p className="muted">{tr('Единиц не нашлось — возможно, записи только что удалили.', 'Birliklar topilmadi — ehtimol, yozuvlar hozirgina o‘chirilgan.')}</p>
                : <ul className="unit-lists__items">
                  {units.map((unit) => {
                    const status = equipmentAvailabilityView(unit.availability, tr)
                    return (
                      <li key={unit.id}>
                        <button type="button" onClick={() => onOpenUnit(unit)}>
                          <span>
                            <strong className="mono">{equipmentIdentifier(unit, tr)}</strong>
                            <small>
                              {status.label}
                              {unit.location ? ` · ${unit.location}` : ''}
                              {unit.tracking_mode === 'quantity' ? ` · ${unit.count} ${tr('шт.', 'dona')}` : ''}
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
