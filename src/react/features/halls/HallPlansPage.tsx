import { CircleAlert, Copy, Ellipsis, PanelsTopLeft, Plus, Presentation, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { createHallPlan, deleteHallPlan, duplicateHallPlan, fetchHallPlans, type HallPlanInput, type HallPlanWithHalls } from './api'
import { HallPlanMetaDrawer } from './HallPlanMetaDrawer'
import { formatPlanPeriod, sortHalls } from './types'
import { ActionMenu } from '../../components/ActionMenu'
import { formatDateTime } from '../../lib/date'
import { useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useArmedAction } from '../../lib/useArmedAction'
import './halls.css'

export function HallPlansPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const [plans, setPlans] = useState<HallPlanWithHalls[]>([])
  // Поиск клиентский и в адрес не едет: выдача полная (сто планов), фильтр
  // мгновенный, а запоминать его в истории незачем.
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы список.
  const [hasError, setHasError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [deleteFailed, setDeleteFailed] = useState(false)
  // Копирование — один план за раз: id копируемого держит меню в состоянии
  // «Копируем…», а отказ показывается той же полосой, что и отказ удаления.
  const [copyingId, setCopyingId] = useState('')
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setHasError(false)
    fetchHallPlans()
      .then((rows) => {
        if (isCurrent) setPlans(rows)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/halls' })
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const query = search.trim()
  const visible = useMemo(() => {
    if (!query) return plans
    const lowered = query.toLowerCase()
    return plans.filter((plan) => plan.name.toLowerCase().includes(lowered))
  }, [plans, query])

  // Создание двухступенчатое: план и залы. Отказ ПЕРВОЙ ступени уходит наружу —
  // его показывает дровер и оставляет форму заполненной. Отказ второй означает,
  // что план уже в базе: увести человека к нему всё равно правильнее, чем
  // оставить на списке с ошибкой, — залы добавляются в редакторе кнопкой «+ Зал».
  async function createPlan(input: HallPlanInput, hallCount: number) {
    const { plan, hallsError } = await createHallPlan(input, hallCount, tr)
    if (hallsError) {
      reportAppError(hallsError, { scope: 'loader', route: '/halls', detail: { source: 'create-halls', plan: plan.id } })
    }
    navigate(`/halls/${plan.id}`)
  }

  // Копия открывается в редакторе сразу: копируют, чтобы править, а не чтобы
  // любоваться карточкой в списке. Отказ оставляет человека здесь — половина
  // копии, если она успела лечь, видна в списке после перезагрузки.
  async function copyPlan(id: string) {
    setCopyingId(id)
    setCopyFailed(false)
    try {
      const copy = await duplicateHallPlan(id, tr)
      navigate(`/halls/${copy.id}`)
    } catch (error) {
      setCopyFailed(true)
      reportAppError(error, { scope: 'loader', route: '/halls', detail: { source: 'duplicate', plan: id } })
      setCopyingId('')
    }
  }

  async function deletePlan(id: string) {
    setDeletingId(id)
    setDeleteFailed(false)
    try {
      await deleteHallPlan(id)
      // Строку убираем из показанного списка, а не перезапрашиваем страницу:
      // каскад в базе уже унёс залы и позиции, и второй запрос вернул бы то же
      // самое минус одна карточка.
      setPlans((current) => current.filter((plan) => plan.id !== id))
    } catch (error) {
      setDeleteFailed(true)
      reportAppError(error, { scope: 'loader', route: '/halls', detail: { source: 'delete', plan: id } })
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Планирование площадки', 'Maydonni rejalashtirish')}</p>
          <h1>{tr('Залы', 'Zallar')}</h1>
          <p className="page-description">{tr('Расстановка людей по залам мероприятия: кто где стоит и кого не хватает.', 'Tadbir zallari bo‘yicha odamlarni taqsimlash: kim qayerda va kim yetishmayapti.')}</p>
        </div>
        <button className="button button--primary" onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> {tr('Новый план', 'Yangi reja')}
        </button>
      </header>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Название плана…', 'Reja nomi…')}
              aria-label={tr('Поиск планов', 'Rejalarni qidirish')}
            />
          </label>
          <span className="toolbar__count">{tr('Планов', 'Rejalar')}: {visible.length.toLocaleString(locale)}</span>
        </div>

        {deleteFailed && (
          <p className="form-error hall-plans-error"><CircleAlert size={15} /> {tr('Не удалось удалить план. Повторите попытку.', 'Rejani o‘chirib bo‘lmadi. Qayta urinib ko‘ring.')}</p>
        )}

        {copyFailed && (
          <p className="form-error hall-plans-error"><CircleAlert size={15} /> {tr('Не удалось скопировать план. Повторите попытку.', 'Rejadan nusxa olib bo‘lmadi. Qayta urinib ko‘ring.')}</p>
        )}

        {hasError ? (
          <div className="state-block state-block--error">
            <CircleAlert size={24} />
            <strong>{tr('Ошибка загрузки', 'Yuklash xatosi')}</strong>
            <span>{tr('Не удалось загрузить планы залов. Повторите попытку.', 'Zallar rejalarini yuklab bo‘lmadi. Qayta urinib ko‘ring.')}</span>
            <button className="button button--secondary" onClick={() => setReloadKey((value) => value + 1)}>{tr('Повторить', 'Qayta urinish')}</button>
          </div>
        ) : (
          <div className="list-grid" aria-busy={isLoading}>
            {isLoading && plans.length === 0
              ? Array.from({ length: 6 }, (_, index) => <div className="list-card list-card--loading" key={index} />)
              : visible.map((plan) => (
                <HallPlanCard
                  key={plan.id}
                  plan={plan}
                  isDeleting={deletingId === plan.id}
                  isCopying={copyingId === plan.id}
                  onOpen={() => navigate(`/halls/${plan.id}`)}
                  onCopy={() => { void copyPlan(plan.id) }}
                  onDelete={() => { void deletePlan(plan.id) }}
                />
              ))}
          </div>
        )}

        {!isLoading && !hasError && plans.length === 0 && (
          <div className="state-block">
            <Presentation size={27} />
            <strong>{tr('Планов пока нет', 'Hozircha rejalar yo‘q')}</strong>
            <span>{tr('Заведите план мероприятия — залы и позиции добавляются внутри.', 'Tadbir rejasini yarating — zallar va lavozimlar ichida qo‘shiladi.')}</span>
            <button className="button button--primary" onClick={() => setCreateOpen(true)}>
              <Plus size={18} /> {tr('Новый план', 'Yangi reja')}
            </button>
          </div>
        )}

        {!isLoading && !hasError && plans.length > 0 && visible.length === 0 && (
          <div className="state-block">
            <Search size={27} />
            <strong>{tr(`Ничего не найдено по «${query}»`, `«${query}» bo‘yicha hech narsa topilmadi`)}</strong>
            <span>{tr('Поиск идёт по названию плана.', 'Qidiruv reja nomi bo‘yicha ishlaydi.')}</span>
            <button className="button button--secondary" onClick={() => setSearch('')}>{tr('Сбросить поиск', 'Qidiruvni tozalash')}</button>
          </div>
        )}
      </section>

      {isCreateOpen && <HallPlanMetaDrawer onClose={() => setCreateOpen(false)} onSubmit={createPlan} />}
    </>
  )
}

// Карточка плана. Отдельным компонентом ради взведённого удаления: useArmedAction
// хранит состояние ОДНОЙ кнопки, и общий на весь список хук взвёл бы «Удалить»
// сразу у всех карточек.
function HallPlanCard({ plan, isDeleting, isCopying, onOpen, onCopy, onDelete }: {
  plan: HallPlanWithHalls
  isDeleting: boolean
  isCopying: boolean
  onOpen: () => void
  onCopy: () => void
  onDelete: () => void
}) {
  const { tr, locale } = useLanguage()
  const armed = useArmedAction()
  const halls = sortHalls(plan.halls)
  const changedAt = formatDateTime(new Date(plan.updated_at).getTime(), locale)

  return (
    // Карточка плана — та же .list-card, что у списков (с25): жанр один
    // (работа со своей идентичностью и двумя действиями), и второй экземпляр
    // уже успел разъехаться с оригиналом по высоте и анимации. Своё у плана
    // только одно — ряд цветных точек на месте описания.
    <article className="list-card list-card--plan">
      <div className="list-card__top">
        <div className="list-card__identity">
          {/* Период — крупной строкой, как дата у списков: план узнают по числам
              мероприятия, а не по названию, которое у всех похожее. */}
          <p className="list-card__date">{formatPlanPeriod(plan, locale, tr)}</p>
          {/* Название — вход в редактор: его псевдоэлемент растянут на карточку,
              поэтому «клик куда угодно» открывает план. */}
          <h3><button type="button" className="list-card__title" onClick={onOpen}>{plan.name}</button></h3>
        </div>
      </div>

      <div className="hall-plan-dots">
        {halls.length === 0
          ? <span className="hall-plan-dots__empty">{tr('Залов пока нет', 'Hozircha zallar yo‘q')}</span>
          : halls.map((hall) => (
            <span className="hall-plan-dot" key={hall.id} style={{ '--hall-color': hall.color } as CSSProperties}>
              <i aria-hidden="true" />{hall.name}
            </span>
          ))}
      </div>

      <div className="list-card__meta">
        <span><strong>{halls.length.toLocaleString(locale)}</strong> {tr('залов', 'zal')}</span>
        <span>{tr(`изменён ${changedAt}`, `${changedAt} da o‘zgartirilgan`)}</span>
      </div>

      <div className="list-card__actions">
        <button className="button button--primary list-card__open" onClick={onOpen}>
          <PanelsTopLeft size={16} /> {tr('Открыть', 'Ochish')}
        </button>
        {armed.armed ? (
          // Подтверждение видимой кнопкой, а не вторым заходом в меню: взвод
          // гаснет через четыре секунды, и человек не успел бы открыть меню
          // заново. Первый клик — пункт меню, второй — вот эта кнопка.
          <button
            autoFocus
            className="button button--secondary hall-plan-confirm"
            onClick={() => armed.fire(onDelete)}
            onBlur={armed.disarm}
            // Safari: mousedown не фокусирует кнопку, а блюрит её же (autoFocus)
            // — взвод гас до click; см. одноимённый фикс в HallColumnHeader.
            onMouseDown={(event) => event.preventDefault()}
          >
            <Trash2 size={16} /> {tr('Удалить план?', 'Reja o‘chirilsinmi?')}
          </button>
        ) : (
          <ActionMenu
            className="hall-plan-menu"
            label={isDeleting ? tr('Удаляем…', 'O‘chirilmoqda…') : isCopying ? tr('Копируем…', 'Nusxa olinmoqda…') : tr('Ещё', 'Yana')}
            ariaLabel={tr('Действия с планом', 'Reja bilan amallar')}
            icon={<Ellipsis size={16} />}
            disabled={isDeleting || isCopying}
            items={[
              {
                id: 'copy',
                label: tr('Сделать копию', 'Nusxa olish'),
                hint: tr('Залы, позиции и расстановка', 'Zallar, lavozimlar va taqsimot'),
                icon: <Copy size={16} />,
                onSelect: onCopy,
              },
              {
                id: 'delete',
                label: tr('Удалить план', 'Rejani o‘chirish'),
                hint: tr('Вместе с залами и расстановкой', 'Zallar va taqsimot bilan birga'),
                icon: <Trash2 size={16} />,
                onSelect: () => armed.fire(onDelete),
              },
            ]}
          />
        )}
      </div>
    </article>
  )
}
