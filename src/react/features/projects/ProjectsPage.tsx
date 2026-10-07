import { FolderOpen, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { createProject, fetchProjects, readCachedProjects, readCachedProjectsMeta } from './api'
import { ProjectMetaDrawer } from './ProjectMetaDrawer'
import { formatProjectPeriod, venueLabel, type ProjectInput, type ProjectListItem } from './types'
import { DataAge } from '../../components/DataAge'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState, RetryButton } from '../../components/ErrorState'
import { useDocumentTitle, useLanguage } from '../../lib/i18n'
import { reportAppError } from '../../lib/reportAppError'
import './projects.css'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { tr, locale } = useLanguage()
  useDocumentTitle(tr('Мероприятия', 'Tadbirlar'))
  // Первый кадр берём из кэша. Кэшируется ТОЛЬКО реестр: страница мероприятия
  // читает базу напрямую — там состав и привязки, которые правят с трёх сторон.
  const [cachedProjects] = useState(() => readCachedProjects())
  const [projects, setProjects] = useState<ProjectListItem[]>(() => cachedProjects ?? [])
  // Поиск клиентский и в адрес не едет: реестр приезжает целиком, фильтр
  // мгновенный, а запоминать его в истории незачем.
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(() => !cachedProjects)
  // Флаг, а не текст: строка в стейте потянула бы tr в зависимости эффекта, и
  // смена языка перезагружала бы реестр.
  const [hasError, setHasError] = useState(false)
  // Момент записи показанной выдачи. Значение принадлежит persistentCache —
  // здесь только перечитывается, ничего производного не храним.
  const [dataAt, setDataAt] = useState<number | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  // Исход ПОСЛЕДНЕГО запроса: бейдж обязан отличать «данные старые» от
  // «обновиться не удалось».
  const [lastFetchFailed, setLastFetchFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [isCreateOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    let isCurrent = true
    // Показали кэш — обязаны перепроверить у сервера; «Обновить» обходит кэш
    // всегда, потому что её жмут именно от недоверия к показанному.
    const bypassCache = reloadKey > 0 || Boolean(cachedProjects)
    // Метка ДО запроса: при живой записи cachedQuery подменяет провал последним
    // значением и промис РЕЗОЛВИТСЯ, поэтому единственный честный признак
    // «ответа не было» — несдвинувшаяся метка (gotchas §11).
    const ageBefore = readCachedProjectsMeta()?.touchedAt ?? null
    setIsLoading(!cachedProjects)
    setIsFetching(true)
    setHasError(false)
    setDataAt(null)
    fetchProjects({ bypassCache })
      .then((rows) => {
        if (!isCurrent) return
        setProjects(rows)
        const ageAfter = readCachedProjectsMeta()?.touchedAt ?? null
        setLastFetchFailed(ageAfter !== null && ageAfter === ageBefore)
        setDataAt(ageAfter)
      })
      .catch((error: unknown) => {
        if (!isCurrent) return
        setLastFetchFailed(true)
        setDataAt(readCachedProjectsMeta()?.touchedAt ?? null)
        // Кэш уже на экране — сбой обновления не повод рушить показанный реестр.
        if (!cachedProjects) setHasError(true)
        reportAppError(error, { scope: 'loader', route: '/projects' })
      })
      .finally(() => {
        if (!isCurrent) return
        setIsLoading(false)
        setIsFetching(false)
      })
    return () => { isCurrent = false }
  }, [reloadKey])

  const query = search.trim()
  const visible = useMemo(() => {
    if (!query) return projects
    const lowered = query.toLowerCase()
    return projects.filter((project) => [project.name, project.client_name, project.venue?.name, project.venue?.city]
      .some((value) => value?.toLowerCase().includes(lowered)))
  }, [projects, query])

  // Отказ уходит наружу — его показывает дровер и оставляет форму заполненной.
  // Успех уводит на страницу мероприятия: создают его, чтобы тут же собрать
  // состав и списки, а не чтобы посмотреть на карточку в реестре.
  async function createNew(input: ProjectInput) {
    const project = await createProject(input)
    navigate(`/projects/${project.id}`)
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{tr('Люди и площадка', 'Odamlar va maydon')}</p>
          <h1>{tr('Мероприятия', 'Tadbirlar')}</h1>
          <p className="page-description">{tr('Одно мероприятие — одни реквизиты: к нему привязаны списки оборудования, состав и планы залов.', 'Bitta tadbir — bitta rekvizitlar: unga uskunalar ro‘yxatlari, tarkib va zallar rejalari biriktiriladi.')}</p>
        </div>
        <button className="button button--primary" onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> {tr('Новое мероприятие', 'Yangi tadbir')}
        </button>
      </header>

      <section className="data-panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Название, заказчик или площадка…', 'Nomi, buyurtmachi yoki maydon…')}
              aria-label={tr('Поиск мероприятий', 'Tadbirlarni qidirish')}
            />
            {search && (
              <button className="icon-button" onClick={() => setSearch('')} aria-label={tr('Очистить поиск', 'Qidiruvni tozalash')}>
                <X size={16} />
              </button>
            )}
          </label>
          <span className="toolbar__count">
            {query
              ? tr(`Найдено: ${visible.length.toLocaleString(locale)} из ${projects.length.toLocaleString(locale)}`, `Topildi: ${projects.length.toLocaleString(locale)} tadan ${visible.length.toLocaleString(locale)} tasi`)
              : `${tr('Мероприятий', 'Tadbirlar')}: ${projects.length.toLocaleString(locale)}`}
          </span>
          {/* Рядом с блоком «Ошибка загрузки» бейдж не рисуем: на экране оказались
              бы два разных предложения обновиться. */}
          {!hasError && <DataAge touchedAt={dataAt} isRefreshing={isFetching} failed={lastFetchFailed} onRefresh={() => setReloadKey((current) => current + 1)} />}
        </div>

        {hasError ? (
          <ErrorState
            title={tr('Не удалось загрузить мероприятия', 'Tadbirlarni yuklab bo‘lmadi')}
            text={tr('Проверьте интернет и повторите. Мероприятия на месте — их просто не удалось показать.', 'Internetni tekshiring va qayta urinib ko‘ring. Tadbirlar joyida — ularni shunchaki ko‘rsatib bo‘lmadi.')}
            action={<RetryButton onClick={() => setReloadKey((value) => value + 1)} />}
          />
        ) : (
          <div className="list-grid" aria-busy={isLoading}>
            {isLoading && projects.length === 0
              ? Array.from({ length: 6 }, (_, index) => <div className="list-card list-card--loading" key={index} />)
              : visible.map((project) => (
                <ProjectCard key={project.id} project={project} onOpen={() => navigate(`/projects/${project.id}`)} />
              ))}
          </div>
        )}

        {!isLoading && !hasError && projects.length === 0 && (
          <EmptyState
            art
            roomy
            title={tr('Мероприятий пока нет', 'Hozircha tadbirlar yo‘q')}
            text={tr('Заведите мероприятие — название, даты и площадку. Списки и состав добавляются внутри.', 'Tadbir yarating — nomi, sanalari va maydoni. Ro‘yxatlar va tarkib ichida qo‘shiladi.')}
            action={(
              <button className="button button--secondary" onClick={() => setCreateOpen(true)}>
                <Plus size={18} /> {tr('Новое мероприятие', 'Yangi tadbir')}
              </button>
            )}
          />
        )}

        {!isLoading && !hasError && projects.length > 0 && visible.length === 0 && (
          <EmptyState
            icon={<Search size={27} />}
            title={tr(`Ничего не найдено по «${query}»`, `«${query}» bo‘yicha hech narsa topilmadi`)}
            text={tr('Поиск идёт по названию, заказчику и площадке.', 'Qidiruv nom, buyurtmachi va maydon bo‘yicha ishlaydi.')}
            action={<button className="button button--secondary" onClick={() => setSearch('')}>{tr('Сбросить поиск', 'Qidiruvni tozalash')}</button>}
          />
        )}
      </section>

      <AnimatePresence>
        {isCreateOpen && <ProjectMetaDrawer key="create" onClose={() => setCreateOpen(false)} onSubmit={createNew} />}
      </AnimatePresence>
    </>
  )
}

// Карточка мероприятия — та же .list-card, что у списков и планов залов: жанр
// один. Удаления здесь нет намеренно: оно живёт на странице мероприятия, где
// видно, что именно уйдёт вместе с ним.
function ProjectCard({ project, onOpen }: { project: ProjectListItem; onOpen: () => void }) {
  const { tr, locale } = useLanguage()

  return (
    <article className="list-card list-card--project">
      <div className="list-card__top">
        <div className="list-card__identity">
          {/* Период — крупной строкой, как дата у списков: мероприятие узнают по
              числам раньше, чем по названию. */}
          <p className="list-card__date">{formatProjectPeriod(project.date_from, project.date_to, locale, tr)}</p>
          {project.client_name && <p className="list-card__client">{project.client_name}</p>}
          {/* Название — вход на страницу: его псевдоэлемент растянут на
              карточку, поэтому «клик куда угодно» открывает мероприятие. */}
          <h3><button type="button" className="list-card__title" onClick={onOpen}>{project.name}</button></h3>
        </div>
      </div>

      <p className="list-card__description">
        {project.venue ? venueLabel(project.venue) : tr('Площадка не указана', 'Maydon ko‘rsatilmagan')}
      </p>

      {/* «Списков: 2», а не «2 списка»: форма без склонения, своего словаря
          окончаний на два языка в проекте нет (см. PlanCounts в залах). */}
      <div className="list-card__meta project-card__meta">
        <span>{tr('Списков', 'Ro‘yxatlar')}: <strong>{project.listCount.toLocaleString(locale)}</strong></span>
        <span>{tr('В составе', 'Tarkibda')}: <strong>{project.staffCount.toLocaleString(locale)}</strong></span>
        <span>{tr('План залов', 'Zallar rejasi')}: <strong>{project.hasHallPlan ? tr('есть', 'bor') : tr('нет', 'yo‘q')}</strong></span>
      </div>

      <div className="list-card__actions project-card__actions">
        <button className="button button--primary list-card__open" onClick={onOpen}>
          <FolderOpen size={16} /> {tr('Открыть', 'Ochish')}
        </button>
      </div>
    </article>
  )
}
