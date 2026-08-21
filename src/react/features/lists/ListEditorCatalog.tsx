import { CircleAlert, Info, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import { AppSelect } from '../../components/AppSelect'
import { EquipmentVisual } from '../../components/EquipmentVisual'
import { translateEquipmentTaxonomy } from '../../lib/equipmentTaxonomy'
import { useLanguage } from '../../lib/i18n'
import { useModalLayer } from '../../lib/useModalLayer'
import type { CatalogGroup } from './catalogGroups'

// Каталогу нужен только счётчик уже добавленных единиц — тип элемента выборки
// он не знает и знать не должен: импорт идёт только в одну сторону.
type SelectionCount = { count: number }

// Каталожная половина редактора: поиск, фильтры, «показать ещё». Поиск,
// категория и лимит — собственное состояние панели, наружу они не нужны.
// Попап описания рисует СТРАНИЦА (onPreview): у .data-panel и .editor-grid
// есть анимация с fill-mode both, и её transform стал бы блоком-контейнером
// для position: fixed — drawer поехал бы внутрь панели.
export function CatalogPanel({ panelRef, isMobileActive, groups, equipmentCount, isLoading, hasLoadError, selectedKeys, selectedByKey, onPreview, onAdd }: {
  panelRef: RefObject<HTMLElement | null>
  isMobileActive: boolean
  groups: CatalogGroup[]
  equipmentCount: number
  isLoading: boolean
  hasLoadError: boolean
  selectedKeys: Set<string>
  selectedByKey: Map<string, SelectionCount>
  onPreview: (group: CatalogGroup) => void
  onAdd: (group: CatalogGroup) => void
}) {
  const { tr, language, locale } = useLanguage()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [catalogLimit, setCatalogLimit] = useState(60)

  const categories = useMemo(() => [...new Set(groups.map((group) => group.type))]
    .sort((a, b) => translateEquipmentTaxonomy(a, language).localeCompare(translateEquipmentTaxonomy(b, language), locale)), [groups, language, locale])
  const subcategories = useMemo(() => category
    ? [...new Set(groups.filter((group) => group.type === category).map((group) => group.subtype))]
      .sort((a, b) => translateEquipmentTaxonomy(a, language).localeCompare(translateEquipmentTaxonomy(b, language), locale))
    : [], [category, groups, language, locale])
  const filteredGroups = useMemo(() => {
    const terms = search.trim().toLocaleLowerCase(locale).split(/\s+/).filter(Boolean)
    return groups.filter((group) => {
      if (category && group.type !== category) return false
      if (subcategory && group.subtype !== subcategory) return false
      const haystack = `${group.brand} ${group.model} ${group.type} ${group.subtype} ${translateEquipmentTaxonomy(group.type, language)} ${translateEquipmentTaxonomy(group.subtype, language)}`.toLocaleLowerCase(locale)
      return terms.every((term) => haystack.includes(term))
    })
  }, [category, groups, language, locale, search, subcategory])
  const visibleGroups = filteredGroups.slice(0, catalogLimit)

  useEffect(() => { setSubcategory(''); setCatalogLimit(60) }, [category])
  useEffect(() => setCatalogLimit(60), [search, subcategory])

  return (
    <section ref={panelRef} className={`data-panel catalog-picker ${isMobileActive ? 'mobile-active' : ''}`}>
      <div className="panel-heading">
        <div><h2>{tr('Каталог по моделям', 'Modellar katalogi')}</h2><p>{tr('Одна модель — одна строка, независимо от количества серийных единиц.', 'Seriyali birliklar sonidan qat’i nazar, bir model — bir qator.')}</p></div>
        <span className="read-only-label">{isLoading && groups.length === 0 ? tr('Загружаем каталог…', 'Katalog yuklanmoqda…') : `${groups.length} ${tr('моделей', 'model')}`}</span>
      </div>
      <div className="quick-catalog-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Модель, бренд или категория…', 'Model, brend yoki toifa…')} aria-label={tr('Поиск оборудования', 'Uskunalarni qidirish')} />
        </label>
        <AppSelect
          value={category}
          options={[{ value: '', label: tr('Все категории', 'Barcha toifalar') }, ...categories.map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) }))]}
          onChange={setCategory}
          ariaLabel={tr('Категория', 'Toifa')}
        />
        {category && subcategories.length > 1 && (
          <AppSelect
            value={subcategory}
            options={[{ value: '', label: tr('Все подкатегории', 'Barcha quyi toifalar') }, ...subcategories.map((value) => ({ value, label: translateEquipmentTaxonomy(value, language) }))]}
            onChange={setSubcategory}
            ariaLabel={tr('Подкатегория', 'Quyi toifa')}
          />
        )}
      </div>
      <div className="picker-results">
        {hasLoadError && <div className="state-block state-block--error"><CircleAlert size={23} /><span>{tr('Не удалось загрузить каталог.', 'Katalogni yuklab bo‘lmadi.')}</span></div>}
        {isLoading && equipmentCount === 0 && Array.from({ length: 8 }, (_, index) => <div className="picker-skeleton" key={index} />)}
        {!hasLoadError && visibleGroups.map((group) => {
          const selectedAlready = selectedKeys.has(group.key)
          const selectedItem = selectedByKey.get(group.key)
          const serialCount = group.serializedItems.length
          const tracking = serialCount && group.quantityAvailable
            ? tr('смешанный учёт', 'aralash hisob')
            : serialCount ? tr('есть S/N', 'S/N mavjud') : tr('без S/N', 'S/N siz')
          return (
            <div className={`picker-item picker-item--grouped ${selectedAlready ? 'picker-item--selected' : ''}`} key={group.key}>
              <button className="picker-item__preview" type="button" onClick={() => onPreview(group)} aria-label={tr(`Открыть описание ${group.brand} ${group.model}`, `${group.brand} ${group.model} tavsifini ochish`)}>
                <EquipmentVisual item={group} />
                <span className="picker-item__copy">
                  <strong>{group.brand} {group.model}</strong>
                  <small>{translateEquipmentTaxonomy(group.subtype, language)} · {tracking}</small>
                </span>
                <span className={`picker-item__count ${group.availableCount === 0 ? 'picker-item__count--empty' : ''}`}>{group.availableCount > 0 ? `${tr('доступно', 'mavjud')} ${group.availableCount}` : tr('нет на складе', 'omborda yo‘q')}</span>
              </button>
              <button className="picker-item__action" type="button" onClick={() => onAdd(group)} aria-label={tr(`Добавить ещё ${group.brand} ${group.model}`, `${group.brand} ${group.model} yana qo‘shish`)}>
                <Plus size={17} />
                {selectedItem && <span>{selectedItem.count}</span>}
              </button>
            </div>
          )
        })}
        {!hasLoadError && filteredGroups.length > visibleGroups.length && (
          <div className="picker-load-more">
            <button className="button button--secondary" type="button" onClick={() => setCatalogLimit((current) => current + 60)}>
              {tr('Показать ещё', 'Yana ko‘rsatish')} · {filteredGroups.length - visibleGroups.length}
            </button>
          </div>
        )}
        {!isLoading && !hasLoadError && filteredGroups.length === 0 && <div className="state-block"><Search size={25} /><strong>{tr('Ничего не найдено', 'Hech narsa topilmadi')}</strong><span>{tr('Измените поиск или категорию.', 'Qidiruv yoki toifani o‘zgartiring.')}</span></div>}
      </div>
    </section>
  )
}

export function CatalogPreviewDrawer({ group, onClose, onAdd }: { group: CatalogGroup; onClose: () => void; onAdd: () => void }) {
  const { tr, language } = useLanguage()
  useModalLayer(onClose)
  const representative = group.allItems[0]
  const hasSerialized = group.allItems.some((item) => item.tracking_mode === 'serialized')
  const hasQuantity = group.allItems.some((item) => item.tracking_mode === 'quantity')
  const tracking = hasSerialized && hasQuantity
    ? tr('Смешанный учёт', 'Aralash hisob')
    : hasSerialized ? tr('По серийным номерам', 'Seriya raqamlari bo‘yicha') : tr('По количеству', 'Miqdor bo‘yicha')

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={tr('Описание модели', 'Model tavsifi')} onMouseDown={onClose}>
      <aside className="drawer catalog-preview-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer__header">
          <div><p className="eyebrow">{translateEquipmentTaxonomy(group.type, language)}</p><h2>{group.brand} {group.model}</h2></div>
          <div className="drawer__header-actions">
            <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
          </div>
        </div>
        <span className={`badge badge--${group.availableCount > 0 ? 'success' : 'neutral'}`}><i />{group.availableCount > 0 ? tr(`На складе: ${group.availableCount}`, `Omborda: ${group.availableCount}`) : tr('Сейчас нет на складе', 'Hozir omborda yo‘q')}</span>
        <EquipmentVisual item={group} size="large" alt={`${group.brand} ${group.model}`} />
        <dl className="detail-list">
          <div><dt>{tr('Категория', 'Toifa')}</dt><dd>{translateEquipmentTaxonomy(group.type, language)}</dd></div>
          <div><dt>{tr('Подкатегория', 'Quyi toifa')}</dt><dd>{translateEquipmentTaxonomy(group.subtype, language)}</dd></div>
          <div><dt>{tr('Способ учёта', 'Hisob turi')}</dt><dd>{tracking}</dd></div>
          <div><dt>{tr('Всего заведено', 'Jami kiritilgan')}</dt><dd>{group.totalCount} {tr('шт.', 'dona')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Характеристики', 'Xususiyatlar')}</dt><dd>{representative?.technicalspecification || tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
          <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd>{representative?.description || tr('Описание пока не заполнено', 'Tavsif hali kiritilmagan')}</dd></div>
        </dl>
        {group.availableCount === 0 && <p className="availability-warning"><Info size={15} />{tr('Модель можно добавить в документ: нехватка будет отмечена предупреждением.', 'Modelni hujjatga qo‘shish mumkin: yetishmovchilik ogohlantirish bilan ko‘rsatiladi.')}</p>}
        <div className="catalog-preview-drawer__footer">
          <button className="button button--primary catalog-preview-drawer__add" onClick={onAdd}><Plus size={17} /> {tr('Добавить в список', 'Ro‘yxatga qo‘shish')}</button>
        </div>
      </aside>
    </div>
  )
}
