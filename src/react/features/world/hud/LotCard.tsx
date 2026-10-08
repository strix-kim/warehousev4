import { ChevronRight, Lock, Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatDayRange, formatMonthShort, parseDateValue } from '../../../lib/date'
import { useLanguage } from '../../../lib/i18n'
import { formatProjectPeriod } from '../../projects/types'
import type { WorldLot } from '../data/types'
import type { WorldLotPart, WorldStore } from '../worldStore'
import { ruPlural } from './plural'
import { useLotDetails, type LotSection } from './useLotDetails'

// Даты мероприятия: num и unit — ячейке вывески («7–8», «окт»), text — словами в панель.
// Года нет, как и у плашки дня. Нет dateTo — один день. null — даты нет или она не
// разобралась.
export function dateSpan(lot: WorldLot, locale: string) {
  const from = lot.dateFrom ? parseDateValue(lot.dateFrom) : null, to = lot.dateTo ? parseDateValue(lot.dateTo) : from
  if (!from || !to) return null
  const d1 = from.getDate(), d2 = to.getDate(), m1 = formatMonthShort(from, locale), m2 = formatMonthShort(to, locale)
  return { num: d1 === d2 && m1 === m2 ? String(d1) : `${d1}–${d2}`, unit: m1 === m2 ? m1 : `${m1}–${m2}`, text: formatDayRange(from, to, locale) }
}

// Сколько имён состава помещается строкой; остальные — «и ещё N»
const STAFF_NAMES_MAX = 6

// Содержимое секции по состоянию запроса. Скелет держит высоту будущих строк (rows ×
// row px), чтобы панель не прыгала на ответе; отказ — строка с повтором этой секции,
// а не «пусто» (gotchas §11). idle сюда не приходит пустым: его рисует сама секция.
function SectionBody<T>({ section, retry, rows = 1, row = 44, children }: { section: LotSection<T>; retry: () => void; rows?: number; row?: number; children: (data: T) => ReactNode }) {
  const { tr } = useLanguage()
  if (section.state === 'ready') return <>{children(section.data)}</>
  if (section.state === 'failed') {
    return (
      <p className="w-vsec__fail" role="status">
        <span>{tr('Не загрузилось', 'Yuklanmadi')}</span>
        <span aria-hidden="true">·</span>
        <button type="button" className="w-vlink" onClick={retry}>{tr('Повторить', 'Qayta urinish')}</button>
      </p>
    )
  }
  if (section.state === 'loading') {
    return <p className="w-vsec__skel" role="status" aria-label={tr('Загружаем…', 'Yuklanmoqda…')} style={{ '--rows': rows, '--row': `${row}px` } as CSSProperties} />
  }
  return null
}

// Панель выбранного участка — рабочая карточка мероприятия: шапка (заказчик, место,
// даты, переход на страницу мероприятия) и секции. Каждый объект участка в сцене имеет
// здесь секцию с действием-ссылкой: клик в сцене только отмечает секцию (is-on), а
// уводит со сцены ссылка — пальцу промах по сцене ничего не стоит, клавиатуре Tab
// проходит все действия по порядку. Счётчики — из реестра мероприятий, строки секций —
// useLotDetails.
export function LotCard({ store, lot, part }: { store: WorldStore; lot: WorldLot; part: WorldLotPart }) {
  const { tr, locale } = useLanguage()
  const titleId = useId()
  const bodyRef = useRef<HTMLDivElement>(null)
  const { lists, plans, meals, staff } = useLotDetails(lot)
  // Esc снимает выбор — как клик по пустой земле зоны
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') store.setState({ pick: null }) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [store])
  // Отмеченная секция обязана быть видна: в листе на телефоне ниже шапки помещается
  // одна-две секции. Крутим только тело панели — scrollIntoView потащил бы и страницу.
  useEffect(() => {
    const body = bodyRef.current, marked = body?.querySelector<HTMLElement>('.w-vsec.is-on')
    if (!body || !marked) return
    const top = marked.offsetTop - body.offsetTop
    if (top < body.scrollTop || top + marked.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = Math.max(0, top - 8)
  }, [part])

  const span = dateSpan(lot, locale)
  const count = (n: number, ru: [string, string, string], uz: string) => `${n.toLocaleString(locale)} ${tr(ruPlural(n, ...ru), uz)}`
  const { place } = lot
  const projectPath = `/projects/${lot.id}`
  const newListPath = `/lists/new?project=${lot.id}`
  const onClass = (...parts: WorldLotPart[]) => `w-vsec${parts.includes(part) ? ' is-on' : ''}`
  // Счётчик в заголовке: пока ответа нет — число реестра, пришёл — число строк из базы
  const listCount = lists.section.state === 'ready' ? lists.section.data.length : lot.lists
  const staffCount = staff.section.state === 'ready' ? staff.section.data.length : lot.staff

  // Пустая секция: слова и одно действие. Она же — когда счётчик реестра устарел и
  // база ответила нулём строк.
  const empty = (note: string, action: string, to: string) => (
    <>
      <p className="w-vsec__note">{note}</p>
      <Link className="button button--secondary" to={to}>{action}</Link>
    </>
  )
  const noLists = empty(tr('Списков нет', 'Ro‘yxatlar yo‘q'), tr('Создать список', 'Ro‘yxat yaratish'), newListPath)
  const noPlan = empty(tr('Плана нет', 'Reja yo‘q'), tr('Создать план', 'Reja yaratish'), `/halls?new=1&project=${lot.id}`)
  const noStaff = empty(tr('Состав не указан', 'Tarkib ko‘rsatilmagan'), tr('Добавить состав', 'Tarkib qo‘shish'), projectPath)

  return (
    <aside className="w-plaque w-vpanel" aria-labelledby={titleId} data-w-chrome="panel">
      <header className="w-vpanel__head">
        <div>
          <h2 className="w-vpanel__name" id={titleId}>{lot.name}</h2>
          <p className="w-vpanel__kind">{tr('Мероприятие', 'Tadbir')}</p>
        </div>
        <button type="button" className="w-vpanel__close" aria-label={tr('Закрыть', 'Yopish')} onClick={() => store.setState({ pick: null })}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="w-vpanel__body" ref={bodyRef}>
        <dl className="w-vpanel__facts">
          <div><dt>{tr('Заказчик', 'Buyurtmachi')}</dt><dd>{lot.client ?? tr('Не указан', 'Ko‘rsatilmagan')}</dd></div>
          <div>
            <dt>{tr('Место', 'Joy')}</dt>
            {/* Площадка выбирается в реквизитах мероприятия — туда и ведёт строка */}
            <dd>{place ? `${place.name}, ${place.city}` : <Link className="w-vlink" to={projectPath} aria-label={tr('Площадка не указана. Указать площадку', 'Maydon ko‘rsatilmagan. Maydonni ko‘rsatish')}>{tr('Указать площадку', 'Maydonni ko‘rsatish')}</Link>}</dd>
          </div>
          <div><dt>{tr('Даты', 'Sanalar')}</dt><dd>{span ? span.text : tr('Не указаны', 'Ko‘rsatilmagan')}</dd></div>
        </dl>
        <p className="w-vpanel__open">
          <Link className="button button--secondary" to={projectPath}>{tr('Открыть мероприятие', 'Tadbirni ochish')}</Link>
        </p>

        <section className={onClass('truck', 'addtruck')}>
          <h3 className="w-vsec__head">
            <span>{tr('Оборудование', 'Uskunalar')}</span>
            {listCount > 0 && <span className="w-vsec__count">{count(listCount, ['список', 'списка', 'списков'], 'ro‘yxat')}</span>}
          </h3>
          {lists.section.state === 'idle' ? noLists : (
            <SectionBody section={lists.section} retry={lists.retry} rows={lot.lists + 1}>
              {(rows) => rows.length === 0 ? noLists : (
                <ul className="w-vrows">
                  {rows.map((list) => (
                    <li key={list.id}>
                      <Link className="w-vrow" to={`/lists/${list.id}/edit`}>
                        <span className="w-vrow__name">{list.name}</span>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link className="w-vrow w-vrow--add" to={newListPath}>
                      <Plus size={16} aria-hidden="true" />
                      <span className="w-vrow__name">{tr('Добавить список', 'Ro‘yxat qo‘shish')}</span>
                    </Link>
                  </li>
                </ul>
              )}
            </SectionBody>
          )}
        </section>

        <section className={onClass('plan', 'addplan')}>
          <h3 className="w-vsec__head"><span>{tr('План залов', 'Zallar rejasi')}</span></h3>
          {plans.section.state === 'idle' ? noPlan : (
            <SectionBody section={plans.section} retry={plans.retry}>
              {(rows) => rows.length === 0 ? noPlan : (
                <ul className="w-vrows">
                  {rows.map((plan) => (
                    <li key={plan.id}>
                      <Link className="w-vrow" to={`/halls/${plan.id}`}>
                        <span className="w-vrow__name">{plan.name}</span>
                        <small>{formatProjectPeriod(plan.event_from, plan.event_to, locale, tr)}</small>
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionBody>
          )}
        </section>

        <section className={onClass('cafe')}>
          <h3 className="w-vsec__head"><span>{tr('Обеды', 'Ovqatlanish')}</span></h3>
          {/* Счётчика обедов в реестре нет — подстрочник целиком из запроса */}
          <SectionBody section={meals.section} retry={meals.retry} row={20}>
            {(rows) => {
              const days = new Set(rows.map((meal) => meal.meal_on)).size
              return (
                <p className="w-vsec__note">
                  {rows.length === 0
                    ? tr('Обедов ещё нет', 'Ovqatlar hali yo‘q')
                    : `${count(rows.length, ['приём', 'приёма', 'приёмов'], 'ta ovqat')} · ${count(days, ['день', 'дня', 'дней'], 'kun')}`}
                </p>
              )
            }}
          </SectionBody>
          <ul className="w-vrows">
            <li>
              <Link className="w-vrow" to={`${projectPath}/meals`}>
                <span className="w-vrow__name">{tr('Открыть обеды', 'Ovqatlanishni ochish')}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </section>

        <section className="w-vsec">
          <h3 className="w-vsec__head">
            <span>{tr('Состав', 'Tarkib')}</span>
            {staffCount > 0 && <span className="w-vsec__count">{count(staffCount, ['человек', 'человека', 'человек'], 'kishi')}</span>}
          </h3>
          {staff.section.state === 'idle' || (staff.section.state === 'ready' && staff.section.data.length === 0) ? noStaff : (
            <>
              <SectionBody section={staff.section} retry={staff.retry} row={20}>
                {(rows) => {
                  const names = rows.slice(0, STAFF_NAMES_MAX).map((member) => `${member.employee.last_name} ${member.employee.first_name}`.trim()).join(', ')
                  const rest = rows.length - STAFF_NAMES_MAX
                  return <p className="w-vsec__line">{rest > 0 ? tr(`${names} и ещё ${rest.toLocaleString(locale)}`, `${names} va yana ${rest.toLocaleString(locale)} kishi`) : names}</p>
                }}
              </SectionBody>
              <ul className="w-vrows">
                <li>
                  <Link className="w-vrow" to={projectPath}>
                    <span className="w-vrow__name">{tr('Открыть состав', 'Tarkibni ochish')}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </>
          )}
        </section>

        {/* Таблиц расселения в базе нет: секция честно говорит, что её ещё нет, и
            действия в ней нет — как у запертого отеля в сцене */}
        <section className={onClass('stay')}>
          <h3 className="w-vsec__head w-vsec__head--off">
            <Lock size={15} aria-hidden="true" />
            <span>{tr('Расселение — скоро', 'Joylashtirish — tez orada')}</span>
          </h3>
        </section>
      </div>
    </aside>
  )
}
