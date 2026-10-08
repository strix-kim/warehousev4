import { ChevronRight, Lock, Pencil, Plus } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../../lib/i18n'
import { formatProjectPeriod } from '../../projects/types'
import type { WorldAction } from '../actions/useWorldActions'
import type { WorldLot } from '../data/types'
import type { WorldLotPart } from '../worldStore'
import { ruPlural } from './plural'
import { useLotDetails, type LotSection } from './useLotDetails'

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

// Секции карточки участка (LotCard.tsx) — по одной на объект участка в сцене:
// оборудование (грузовик), план залов (стол), обеды (кафе), состав (бригада), расселение
// (запертый отель). Кто действует кнопкой хоста, а кто ссылкой-интерьером — в комментарии
// над Props карточки.
type Props = {
  lot: WorldLot
  // Выбранная часть участка: её секция отмечена (is-on)
  part: WorldLotPart
  // state ссылок-интерьеров: адрес мира для возврата (собирает карточка)
  leave: { from: string }
  onAction?: (action: WorldAction) => void
}

export function LotSections({ lot, part, leave, onAction }: Props) {
  const { tr, locale } = useLanguage()
  const { lists, plans, meals, staff } = useLotDetails(lot)
  const count = (n: number, ru: [string, string, string], uz: string) => `${n.toLocaleString(locale)} ${tr(ruPlural(n, ...ru), uz)}`
  const projectPath = `/projects/${lot.id}`
  const newPlan = onAction && (() => onAction({ kind: 'plan-new', lotId: lot.id }))
  const editStaff = onAction && (() => onAction({ kind: 'staff', lotId: lot.id }))
  const newListPath = `/lists/new?project=${lot.id}`
  const onClass = (...parts: WorldLotPart[]) => `w-vsec${parts.includes(part) ? ' is-on' : ''}`
  // Счётчик в заголовке: пока ответа нет — число реестра, пришёл — число строк из базы
  const listCount = lists.section.state === 'ready' ? lists.section.data.length : lot.lists
  const staffCount = staff.section.state === 'ready' ? staff.section.data.length : lot.staff

  // Пустая секция: слова и одно действие — кнопка хоста (run) или, без неё, ссылка.
  // Она же — когда счётчик реестра устарел и база ответила нулём строк.
  const empty = (note: string, action: string, to: string, run?: () => void) => (
    <>
        <p className="w-vsec__note">{note}</p>
        {run
          ? <button type="button" className="button button--secondary" onClick={run}>{action}</button>
          : <Link className="button button--secondary" to={to} state={leave}>{action}</Link>}
    </>
  )
  const noLists = empty(tr('Списков нет', 'Ro‘yxatlar yo‘q'), tr('Создать список', 'Ro‘yxat yaratish'), newListPath)
  const noPlan = empty(tr('Плана нет', 'Reja yo‘q'), tr('Создать план', 'Reja yaratish'), `/halls?new=1&project=${lot.id}`, newPlan)
  const noStaff = empty(tr('Состав не указан', 'Tarkib ko‘rsatilmagan'), tr('Добавить состав', 'Tarkib qo‘shish'), projectPath, editStaff)

  return (
    <>
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
                  <Link className="w-vrow" to={`/lists/${list.id}/edit`} state={leave}>
                    <span className="w-vrow__name">{list.name}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link className="w-vrow w-vrow--add" to={newListPath} state={leave}>
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
                  <Link className="w-vrow" to={`/halls/${plan.id}`} state={leave}>
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
          <Link className="w-vrow" to={`${projectPath}/meals`} state={leave}>
            <span className="w-vrow__name">{tr('Открыть обеды', 'Ovqatlanishni ochish')}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </section>

    <section className={onClass('crew', 'addcrew')}>
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
              {editStaff ? (
                <button type="button" className="w-vrow" onClick={editStaff}>
                  <span className="w-vrow__name">{tr('Изменить состав', 'Tarkibni o‘zgartirish')}</span>
                  <Pencil size={16} aria-hidden="true" />
                </button>
              ) : (
                <Link className="w-vrow" to={projectPath} state={leave}>
                  <span className="w-vrow__name">{tr('Открыть состав', 'Tarkibni ochish')}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              )}
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
    </>
  )
}
