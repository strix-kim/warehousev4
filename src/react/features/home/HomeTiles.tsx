import { ArrowRight, ArrowUpRight, Boxes, CarFront, ClipboardList, Plus, Presentation, Search, UsersRound } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { expiryState } from '../../lib/expiry'
import { useLanguage } from '../../lib/i18n'
import { equipmentAvailabilityLabel } from '../equipment/availability'
import { formatPlanPeriod } from '../halls/types'
import { listSize, type EquipmentList, type EquipmentListsPage } from '../lists/api'
import type { HomeSummary } from './api'

type Tr = (ru: string, uz: string) => string

// Склонение для русского: «1 паспорт», «2 паспорта», «5 паспортов». Движок знает
// правило (21 — «one», 12 — «many»), своя таблица окончаний его бы повторяла.
// В узбекском счётное слово не склоняется, поэтому хелпер русский и локальный.
function ruPlural(count: number, one: string, few: string, many: string) {
  const rule = new Intl.PluralRules('ru').select(count)
  return rule === 'one' ? one : rule === 'few' ? few : many
}

// Госномер Узбекистана — «01 439 SNA», «10 D 412 GB»: две цифры региона, пробел,
// остальное. Только в этом однозначном виде номер делится на ячейки плашки;
// всё прочее (номер без пробела, иностранный) рисуется целиком одной ячейкой —
// угадывать границу региона в чужом формате значит показать номер, которого нет.
function splitPlate(plate: string) {
  const match = /^(\d{2}) (.+)$/.exec(plate)
  return match ? { region: match[1], rest: match[2] } : null
}

// Дата начала мероприятия списка числами. Полдень в разборе — чтобы Ташкент (UTC+5) не
// увёл календарный день на сутки назад.
function formatListDate(value: string | null, locale: string) {
  return value ? new Intl.DateTimeFormat(locale).format(new Date(`${value}T12:00:00`)) : null
}

function listSubtitle(list: EquipmentList, tr: Tr) {
  // Реквизиты — у мероприятия списка; у списка без него их нет вовсе.
  if (!list.project) return tr('Без мероприятия', 'Tadbirsiz')
  return [list.project.client_name, list.project.venue?.name].filter(Boolean).join(' · ') || tr('Заказчик не указан', 'Buyurtmachi ko‘rsatilmagan')
}

// Сколько сроков истекло и сколько истекает скоро. Порог — только expiryState:
// база отдаёт голые даты, чтобы правило «скоро» не жило в двух местах.
function countExpiries(expiries: string[]) {
  let expired = 0
  let soon = 0
  for (const value of expiries) {
    const state = expiryState(value)
    if (state === 'expired') expired += 1
    else if (state === 'soon') soon += 1
  }
  return { expired, soon }
}

// Сколько последних списков показывать: три на десктопе, две строки на телефоне.
const RECENT_LISTS = 3
const PHONE_RECENT_LISTS = 2
// Сколько цветных квадратиков залов влезает в широкую плитку телефона; остальные — «+N».
const PHONE_HALL_DOTS = 4

type Props = {
  // Данные грузит HomePage (она же держит возраст и «Обновить» в шапке) — плитки
  // только рисуют. null — ответа ещё нет.
  summary: HomeSummary | null
  lists: EquipmentListsPage | null
  summaryFailed: boolean
  listsFailed: boolean
}

// Плитки главной: вся витрина разделов под шапкой. Отдельным модулем с с58 — второй
// вид главной рядом с миром (выбраны «Плитки») и её запасной вид (нет WebGL2, отказ движка).
// Стили — home.css, его импортирует HomePage.
export function HomeTiles({ summary, lists, summaryFailed, listsFailed }: Props) {
  const { tr, locale } = useLanguage()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Каталог читает поиск из ?q= (EquipmentPage) — главная просто открывает его
    // с уже заданным запросом.
    const query = search.trim()
    navigate(query ? `/equipment?${new URLSearchParams({ q: query }).toString()}` : '/equipment')
  }

  const number = (value: number) => value.toLocaleString(locale)
  const equipment = summary?.equipment ?? null
  const employees = summary?.employees ?? null
  const vehicles = summary?.vehicles ?? null
  const hallPlan = summary?.hallPlan ?? null
  const expiries = employees ? countExpiries(employees.expiries) : { expired: 0, soon: 0 }
  const recent = lists?.rows ?? []
  const isListsLoading = lists === null && !listsFailed
  const plate = vehicles?.firstPlate ?? null
  const plateParts = plate ? splitPlate(plate) : null
  // «Последний» на плитке телефона — когда создан самый свежий список (выдача
  // отсортирована по created_at desc), день и месяц без года.
  const lastCreated = recent[0]?.created_at
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(new Date(recent[0].created_at))
    : null

  const documentWord = (count: number) => ruPlural(count, 'документ', 'документа', 'документов')
  const expiredLabel = tr(
    `${number(expiries.expired)} ${documentWord(expiries.expired)} ${ruPlural(expiries.expired, 'истёк', 'истекли', 'истекли')}`,
    `${number(expiries.expired)} ta hujjat muddati o‘tgan`,
  )
  const soonLabel = tr(
    `${number(expiries.soon)} ${documentWord(expiries.soon)} ${ruPlural(expiries.soon, 'истекает', 'истекают', 'истекают')}`,
    `${number(expiries.soon)} ta hujjat muddati tugayapti`,
  )
  const hiresLabel = (count: number) => tr(`${number(count)} ${ruPlural(count, 'наём', 'наёма', 'наёмов')}`, `${number(count)} ta yollash`)
  // Пилюля — только при отклонении: пустые сроки у всех — это не «проблема», а молчание.
  const expiryPills = (
    <>
      {expiries.expired > 0 && <span className="pill pill--bad">{expiredLabel}</span>}
      {expiries.soon > 0 && <span className="pill pill--warn">{soonLabel}</span>}
    </>
  )
  const planLine = hallPlan ? `${hallPlan.name} · ${formatPlanPeriod({ event_from: hallPlan.eventFrom, event_to: hallPlan.eventTo }, locale, tr)}` : null
  const hallDots = (limit: number) => {
    if (!hallPlan) return null
    const shown = hallPlan.halls.slice(0, limit)
    const rest = hallPlan.halls.length - shown.length
    return (
      <span className="hallsdots" aria-hidden="true">
        {shown.map((hall, index) => <i key={index} style={{ '--hall-color': hall.color } as CSSProperties} title={hall.name}>{index + 1}</i>)}
        {rest > 0 && <i className="hallsdots__rest">+{rest}</i>}
      </span>
    )
  }

  return (
    <>
      {/* Десктоп и планшет (≥ 600). Телефонная раскладка ниже — отдельное дерево,
          а не перестановка этого: у телефона другой состав (плитки 2×2 вместо
          панелей, без поиска), и CSS-перестановкой его не собрать. */}
      <div className="home">
        <section className="home-list">
          <p className="eyebrow">{tr('Быстрый документ', 'Tezkor hujjat')}</p>
          <h2>{tr('Собрать список на выезд', 'Safar uchun ro‘yxat tuzish')}</h2>
          <p className="home-list__lead">{tr(
            'Модели, количество, серийные номера — и готовый Excel. Сохранять в системе необязательно.',
            'Modellar, miqdor, seriya raqamlari — va tayyor Excel. Tizimda saqlash shart emas.',
          )}</p>
          <div className="home-list__cta">
            {/* Единственная красная кнопка экрана (A-04, V-13). */}
            <Link className="button button--primary home-list__new" to="/lists/new"><Plus size={18} />{tr('Новый список', 'Yangi ro‘yxat')}</Link>
            <Link className="home-quiet-link" to="/lists">{tr('Все списки', 'Barcha ro‘yxatlar')}<ArrowRight size={16} /></Link>
          </div>
          <div className="recent">
            {isListsLoading && Array.from({ length: RECENT_LISTS }, (_, index) => <span className="recent__skeleton" key={index} />)}
            {listsFailed && recent.length === 0 && <p className="recent__note">{tr('Не удалось загрузить последние списки.', 'Oxirgi ro‘yxatlarni yuklab bo‘lmadi.')}</p>}
            {!isListsLoading && !listsFailed && recent.length === 0 && <p className="recent__note">{tr('Списков пока нет — первый соберётся за пару минут.', 'Hozircha ro‘yxatlar yo‘q — birinchisi bir necha daqiqada tuziladi.')}</p>}
            {recent.slice(0, RECENT_LISTS).map((list) => (
              <Link key={list.id} to={`/lists/${list.id}/edit`}>
                <span className="recent__name"><b>{list.name}</b><small>{listSubtitle(list, tr)}</small></span>
                <small className="recent__date">{formatListDate(list.project?.date_from ?? null, locale) ?? tr('без даты', 'sanasiz')}</small>
                <span className="count count--soft" title={tr('Позиций в списке', 'Ro‘yxatdagi birliklar')}>{number(listSize(list))}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-eq">
          <p className="eyebrow">{tr('Склад и карточки', 'Ombor va kartalar')}</p>
          <h2>{tr('Оборудование', 'Uskunalar')}</h2>
          <form className="home-eq__search" role="search" onSubmit={submitSearch}>
            <Search size={19} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Модель, бренд или серийный номер…', 'Model, brend yoki seriya raqami…')}
              aria-label={tr('Поиск по складу', 'Ombor bo‘yicha qidiruv')}
              enterKeyHint="search"
            />
          </form>
          {/* Факты — только при ответе сводки. Нет данных и нет отказа — прочерки
              той же геометрии (без прыжка раскладки); отказ без кэша — факты
              исчезают целиком, панель остаётся поиском и ссылкой. */}
          {(equipment || !summaryFailed) && (
            <>
              <div className="eqfacts">
                <div><b>{equipment ? number(equipment.rows) : '—'}</b><span>{equipment ? tr(ruPlural(equipment.rows, 'запись', 'записи', 'записей'), 'yozuv') : tr('записей', 'yozuv')}</span></div>
                <div><b>{equipment ? number(equipment.models) : '—'}</b><span>{equipment ? tr(ruPlural(equipment.models, 'модель', 'модели', 'моделей'), 'model') : tr('моделей', 'model')}</span></div>
                <div><b>{equipment ? number(equipment.units) : '—'}</b><span>{equipment ? tr(ruPlural(equipment.units, 'штука', 'штуки', 'штук'), 'dona') : tr('штук', 'dona')}</span></div>
              </div>
              {/* Полоса — доли ШТУК: available + unavailable + diagnostics = units
                  (так считает home_summary). Норма серая, цвет — только у отклонений. */}
              <div className="eqbar" aria-hidden="true">
                {equipment && equipment.available > 0 && <i className="eqbar__ok" style={{ flexGrow: equipment.available }} />}
                {equipment && equipment.unavailable > 0 && <i className="eqbar__bad" style={{ flexGrow: equipment.unavailable }} />}
                {equipment && equipment.diagnostics > 0 && <i className="eqbar__warn" style={{ flexGrow: equipment.diagnostics }} />}
              </div>
              <div className="eqlegend">
                <span className="eqlegend__ok">{equipmentAvailabilityLabel('available', tr)} {equipment ? number(equipment.available) : '—'}</span>
                <span className="eqlegend__bad">{equipmentAvailabilityLabel('unavailable', tr)} {equipment ? number(equipment.unavailable) : '—'}</span>
                <span className="eqlegend__warn">{equipmentAvailabilityLabel('diagnostics', tr)} {equipment ? number(equipment.diagnostics) : '—'}</span>
              </div>
            </>
          )}
        </section>

        {/* Плитки нейтральные все три: цвет несут только факты — пилюли
            отклонений и номера залов из плана (V-16). */}
        <div className="home-dests">
          <Link className="dest" to="/employees">
            <div className="dest__top"><span className="dest__icon"><UsersRound size={19} /></span><ArrowUpRight className="dest__go" size={19} /></div>
            <div><h3>{tr('Сотрудники', 'Xodimlar')}</h3><p>{tr('Карточки, документы, списки на пропуск', 'Kartalar, hujjatlar, ruxsatnoma ro‘yxatlari')}</p></div>
            {employees && employees.count > 0 && (
              <div className="dest__fact">
                <span className="faces" aria-hidden="true">
                  {employees.faces.map((face, index) => <span key={index}>{face}</span>)}
                  {employees.count > employees.faces.length && <span>+{employees.count - employees.faces.length}</span>}
                </span>
                {expiryPills}
              </div>
            )}
          </Link>
          <Link className="dest" to="/vehicles">
            <div className="dest__top"><span className="dest__icon"><CarFront size={19} /></span><ArrowUpRight className="dest__go" size={19} /></div>
            <div><h3>{tr('Автомобили', 'Avtomobillar')}</h3><p>{tr('Госномера и водители для пропусков', 'Ruxsatnomalar uchun davlat raqamlari va haydovchilar')}</p></div>
            {vehicles && plate && (
              <div className="dest__fact">
                {plateParts
                  ? <span className="plate"><b>{plateParts.region}</b><span>{plateParts.rest}</span><i>UZ</i></span>
                  : <span className="plate"><span>{plate}</span></span>}
                {vehicles.count > 1 && <span className="dest__more">{tr(`и ещё ${number(vehicles.count - 1)}`, `yana ${number(vehicles.count - 1)} ta`)}</span>}
              </div>
            )}
          </Link>
          <Link className="dest" to="/halls">
            <div className="dest__top"><span className="dest__icon"><Presentation size={19} /></span><ArrowUpRight className="dest__go" size={19} /></div>
            <div><h3>{tr('Залы', 'Zallar')}</h3><p>{summary ? planLine ?? tr('Планов пока нет', 'Hozircha rejalar yo‘q') : tr('Расстановка людей по залам', 'Odamlarni zallar bo‘yicha taqsimlash')}</p></div>
            {hallPlan && (hallPlan.halls.length > 0 || hallPlan.hires > 0) && (
              <div className="dest__fact">
                {hallDots(hallPlan.halls.length)}
                {hallPlan.hires > 0 && <span className="pill pill--dashed">{hiresLabel(hallPlan.hires)}</span>}
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Телефон (< 600, макет с31): главное действие карточкой, разделы плитками 2×2
          и широкая «Залы», ниже два последних списка. Поиска здесь нет — на
          телефоне он живёт во вкладке «Техника». */}
      <div className="home-phone">
        <div className="p-home-cta">
          <h2>{tr('Собрать список на выезд', 'Safar uchun ro‘yxat tuzish')}</h2>
          <p>{tr('Модели, серийные номера и готовый Excel.', 'Modellar, seriya raqamlari va tayyor Excel.')}</p>
          <Link className="button button--primary button--wide p-home-cta__new" to="/lists/new"><Plus size={18} />{tr('Новый список', 'Yangi ro‘yxat')}</Link>
        </div>
        <div className="p-tiles">
          <Link className="p-tile p-tile--dark" to="/equipment">
            <Boxes size={22} />
            <span><b>{equipment ? number(equipment.rows) : '—'}</b>{equipment && <small>{tr(`${ruPlural(equipment.rows, 'запись', 'записи', 'записей')} · ${number(equipment.models)} ${ruPlural(equipment.models, 'модель', 'модели', 'моделей')}`, `yozuv · ${number(equipment.models)} model`)}</small>}</span>
            <span className="p-tile__name">{tr('Техника', 'Texnika')}</span>
          </Link>
          <Link className="p-tile" to="/lists">
            <ClipboardList size={22} />
            <span><b>{lists ? number(lists.total) : '—'}</b>{lastCreated && <small>{tr(`последний ${lastCreated}`, `oxirgisi ${lastCreated}`)}</small>}</span>
            <span className="p-tile__name">{tr('Списки', 'Ro‘yxatlar')}</span>
          </Link>
          <Link className="p-tile" to="/employees">
            <UsersRound size={22} />
            <span><b>{employees ? number(employees.count) : '—'}</b>
              {expiries.expired > 0 && <small className="p-tile__bad">{expiredLabel}</small>}
              {expiries.soon > 0 && <small className="p-tile__warn">{soonLabel}</small>}
            </span>
            <span className="p-tile__name">{tr('Сотрудники', 'Xodimlar')}</span>
          </Link>
          <Link className="p-tile" to="/vehicles">
            <CarFront size={22} />
            <span><b>{vehicles ? number(vehicles.count) : '—'}</b>{vehicles && vehicles.drivers > 0 && <small>{tr(`${number(vehicles.drivers)} ${ruPlural(vehicles.drivers, 'водитель', 'водителя', 'водителей')}`, `${number(vehicles.drivers)} ta haydovchi`)}</small>}</span>
            <span className="p-tile__name">{tr('Авто', 'Avto')}</span>
          </Link>
          <Link className="p-tile p-tile--wide" to="/halls">
            <span>
              <span className="p-tile__name">{tr('Залы', 'Zallar')}</span>
              {summary && <small>{hallPlan
                ? [
                    hallPlan.name,
                    tr(`${number(hallPlan.halls.length)} ${ruPlural(hallPlan.halls.length, 'зал', 'зала', 'залов')}`, `${number(hallPlan.halls.length)} ta zal`),
                    hallPlan.hires > 0 ? hiresLabel(hallPlan.hires) : '',
                  ].filter(Boolean).join(' · ')
                : tr('Планов пока нет', 'Hozircha rejalar yo‘q')}</small>}
            </span>
            {hallDots(PHONE_HALL_DOTS)}
          </Link>
        </div>
        <div className="p-sectiont"><span>{tr('Последние списки', 'Oxirgi ro‘yxatlar')}</span><Link to="/lists">{tr('Все', 'Barchasi')}</Link></div>
        <div className="p-list">
          {isListsLoading && Array.from({ length: PHONE_RECENT_LISTS }, (_, index) => <span className="p-row p-row--skeleton" key={index} />)}
          {listsFailed && recent.length === 0 && <p className="p-list__note">{tr('Не удалось загрузить последние списки.', 'Oxirgi ro‘yxatlarni yuklab bo‘lmadi.')}</p>}
          {!isListsLoading && !listsFailed && recent.length === 0 && <p className="p-list__note">{tr('Списков пока нет.', 'Hozircha ro‘yxatlar yo‘q.')}</p>}
          {recent.slice(0, PHONE_RECENT_LISTS).map((list) => (
            <Link className="p-row" key={list.id} to={`/lists/${list.id}/edit`}>
              <span className="thumb"><ClipboardList size={18} /></span>
              <span className="p-row__body"><b>{list.name}</b><small>{[formatListDate(list.project?.date_from ?? null, locale), list.project?.venue?.name ?? list.project?.client_name].filter(Boolean).join(' · ') || listSubtitle(list, tr)}</small></span>
              <span className="count count--soft">{number(listSize(list))}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
