import { ArrowLeft, CalendarRange, ChevronRight, CircleAlert, ClipboardList, ListPlus, Pencil, Presentation, Trash2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteProject, fetchProject, fetchProjectHallPlans, fetchProjectLists, projectErrorText, updateProject } from './api'
import { ProjectMetaDrawer } from './ProjectMetaDrawer'
import { ProjectStaffSection } from './ProjectStaffSection'
import { formatProjectPeriod, type ProjectHallPlanRow, type ProjectListRow, type ProjectWithVenue } from './types'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, RetryButton } from '../../components/ErrorState'
import { formatDateTime } from '../../lib/date'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import { useArmedAction } from '../../lib/useArmedAction'
import './projects.css'

type LoadState = 'loading' | 'ready' | 'missing' | 'failed'

// Страница мероприятия: реквизиты и три блока — «Оборудование», «Состав»,
// «Залы». Кэша у страницы нет: всё, что на ней, правят с трёх сторон (редактор
// списка, состав, залы), и показывать тут значение из кэша значит показать
// чужую правку как несделанную.
export function ProjectPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectWithVenue | null>(null)
  const [lists, setLists] = useState<ProjectListRow[]>([])
  const [hallPlans, setHallPlans] = useState<ProjectHallPlanRow[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [isMetaOpen, setMetaOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  // Текст отказа удаления: уже собран projectErrorText (ему нужен сам объект
  // ошибки) и живёт до следующей попытки.
  const [deleteErrorText, setDeleteErrorText] = useState('')
  const armed = useArmedAction()

  useDocumentTitle(project ? tr(`${project.name} — мероприятие`, `${project.name} — tadbir`) : '')

  useEffect(() => {
    if (!projectId) {
      setLoadState('missing')
      return
    }
    let isCurrent = true
    setLoadState('loading')
    // Три запроса разом и один исход на страницу: блок, показанный пустым из-за
    // отказа своего запроса, читался бы как «списков нет» (gotchas §11).
    Promise.all([fetchProject(projectId), fetchProjectLists(projectId), fetchProjectHallPlans(projectId)])
      .then(([row, listRows, planRows]) => {
        if (!isCurrent) return
        setProject(row)
        setLists(listRows)
        setHallPlans(planRows)
        setLoadState(row ? 'ready' : 'missing')
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLoadState('failed')
        reportAppError(error, { scope: 'loader', route: '/projects/:projectId' })
      })
    return () => { isCurrent = false }
  }, [projectId, reloadKey])

  if (loadState !== 'ready' || !project) {
    return (
      <section className="data-panel">
        {loadState === 'loading' && <div className="project-skeleton" role="status" aria-label={tr('Загружаем мероприятие…', 'Tadbir yuklanmoqda…')}><span /><span /><span /></div>}
        {/* 'missing' — строки нет (или её не видно политикой): честное состояние,
            иначе ссылка на удалённое мероприятие выглядела бы рабочей. */}
        {loadState === 'missing' && (
          <EmptyState
            icon={<CalendarRange size={27} />}
            title={tr('Мероприятие не найдено', 'Tadbir topilmadi')}
            text={tr('Возможно, его удалили или ссылка устарела.', 'Ehtimol, u o‘chirilgan yoki havola eskirgan.')}
            action={<button className="button button--secondary" onClick={() => navigate('/projects')}>{tr('К мероприятиям', 'Tadbirlarga')}</button>}
          />
        )}
        {loadState === 'failed' && (
          <ErrorState
            title={tr('Не удалось открыть мероприятие', 'Tadbirni ochib bo‘lmadi')}
            text={tr('Проверьте интернет и повторите. Само мероприятие не изменилось.', 'Internetni tekshiring va qayta urinib ko‘ring. Tadbirning o‘zi o‘zgarmadi.')}
            action={<RetryButton onClick={() => setReloadKey((current) => current + 1)} />}
          />
        )}
      </section>
    )
  }

  const current = project

  async function remove() {
    setIsDeleting(true)
    setDeleteErrorText('')
    try {
      await deleteProject(current.id)
      // replace: «назад» из реестра не должен вести на удалённое мероприятие.
      navigate('/projects', { replace: true })
    } catch (error) {
      setDeleteErrorText(projectErrorText(error, tr))
      reportAppError(error, { scope: 'loader', route: '/projects/:projectId', detail: { source: 'delete' } })
      setIsDeleting(false)
    }
  }

  return (
    <>
      <header className="editor-header editor-header--project">
        <button type="button" className="icon-button icon-button--bordered" onClick={() => navigate('/projects')} aria-label={tr('Назад к мероприятиям', 'Tadbirlarga qaytish')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p className="eyebrow">{tr('Мероприятие', 'Tadbir')} · {formatProjectPeriod(current.date_from, current.date_to, locale, tr)}</p>
          <h1>{current.name}</h1>
        </div>
        <div className="editor-header__actions">
          <button className="button button--secondary" onClick={() => setMetaOpen(true)}>
            <Pencil size={16} /> {tr('Изменить', 'O‘zgartirish')}
          </button>
          {/* Двухшаговое удаление в самой кнопке (useArmedAction): первый клик
              взводит, второй удаляет. onMouseDown — Safari: иначе onBlur гасит
              взвод раньше второго click (gotchas §6). */}
          <button
            className={`button ${armed.armed ? 'button--danger-ghost' : 'button--secondary'}`}
            disabled={isDeleting}
            onClick={() => armed.fire(() => { void remove() })}
            onBlur={armed.disarm}
            onMouseDown={(event) => { if (armed.armed) event.preventDefault() }}
          >
            <Trash2 size={16} />
            {isDeleting ? tr('Удаляем…', 'O‘chirilmoqda…') : armed.armed ? tr('Удалить мероприятие?', 'Tadbir o‘chirilsinmi?') : tr('Удалить', 'O‘chirish')}
          </button>
        </div>
      </header>

      {deleteErrorText && <p className="form-error project-error"><CircleAlert size={15} /> {deleteErrorText}</p>}

      <section className="data-panel project-facts-panel">
        <dl className="detail-list project-facts">
          <div><dt>{tr('Заказчик', 'Buyurtmachi')}</dt><dd>{current.client_name || tr('Не указан', 'Ko‘rsatilmagan')}</dd></div>
          <div><dt>{tr('Период', 'Davr')}</dt><dd>{formatProjectPeriod(current.date_from, current.date_to, locale, tr)}</dd></div>
          <div className="detail-list__wide">
            <dt>{tr('Площадка', 'Maydon')}</dt>
            <dd>{current.venue ? `${current.venue.name} · ${current.venue.city}, ${current.venue.country}` : tr('Не указана', 'Ko‘rsatilmagan')}</dd>
          </div>
          {current.description && (
            <div className="detail-list__wide"><dt>{tr('Описание', 'Tavsif')}</dt><dd className="project-facts__text">{current.description}</dd></div>
          )}
        </dl>
      </section>

      <section className="data-panel project-section">
        <header className="project-section__head">
          <h2>{tr('Оборудование', 'Uskunalar')}</h2>
          <span className="project-section__count">{lists.length.toLocaleString(locale)}</span>
          <Link className="button button--secondary" to={`/lists/new?project=${current.id}`}>
            <ListPlus size={16} /> {tr('Новый список', 'Yangi ro‘yxat')}
          </Link>
        </header>
        {lists.length === 0
          ? (
            <EmptyState
              icon={<ClipboardList size={27} />}
              title={tr('Списков оборудования пока нет', 'Hozircha uskunalar ro‘yxatlari yo‘q')}
              text={tr('У одного мероприятия может быть несколько списков — например, свет и звук отдельно.', 'Bitta tadbirda bir nechta ro‘yxat bo‘lishi mumkin — masalan, yorug‘lik va ovoz alohida.')}
            />
          )
          : (
            <ul className="project-rows">
              {lists.map((list) => (
                <li key={list.id}>
                  <Link className="project-row" to={`/lists/${list.id}/edit`}>
                    <ClipboardList size={17} />
                    <span className="project-row__name">{list.name}</span>
                    {/* created_at у списков nullable (наследие схемы) — без даты
                        подписи нет, а не «создан Invalid Date». */}
                    {list.created_at
                      ? <small>{tr(`создан ${formatDateTime(new Date(list.created_at).getTime(), locale)}`, `${formatDateTime(new Date(list.created_at).getTime(), locale)} da yaratilgan`)}</small>
                      : <small />}
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <ProjectStaffSection projectId={current.id} />

      <section className="data-panel project-section">
        <header className="project-section__head">
          <h2>{tr('Залы', 'Zallar')}</h2>
          <span className="project-section__count">{hallPlans.length.toLocaleString(locale)}</span>
        </header>
        {hallPlans.length === 0
          ? (
            <EmptyState
              icon={<Presentation size={27} />}
              title={tr('Плана залов пока нет', 'Hozircha zallar rejasi yo‘q')}
              text={tr('К этому мероприятию не привязан ни один план расстановки по залам.', 'Bu tadbirga zallar bo‘yicha taqsimot rejasi biriktirilmagan.')}
              action={<Link className="button button--secondary" to="/halls">{tr('К планам залов', 'Zallar rejalariga')}</Link>}
            />
          )
          : (
            <ul className="project-rows">
              {hallPlans.map((plan) => (
                <li key={plan.id}>
                  <Link className="project-row" to={`/halls/${plan.id}`}>
                    <Presentation size={17} />
                    <span className="project-row__name">{plan.name}</span>
                    <small>{formatProjectPeriod(plan.event_from, plan.event_to, locale, tr)}</small>
                    <ChevronRight size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>

      <AnimatePresence>
        {isMetaOpen && (
          <ProjectMetaDrawer
            key="meta"
            project={current}
            onClose={() => setMetaOpen(false)}
            onSubmit={async (input) => {
              // Отказ наверх не глотаем: его показывает сам дровер и оставляет
              // форму открытой с набранными полями. На экран кладём строку из
              // ответа базы — края и пустые поля нормализует триггер.
              setProject(await updateProject(current.id, input))
              setMetaOpen(false)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
