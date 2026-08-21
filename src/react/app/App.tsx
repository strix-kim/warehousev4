import { ArrowUpRight, Boxes, ChevronDown, ClipboardList, House, ListPlus, LogOut, PanelLeftClose, PanelLeftOpen, RadioTower, Warehouse } from 'lucide-react'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppErrorBoundary } from '../components/AppErrorBoundary'
import { useAuth } from '../features/auth/AuthProvider'
import { LanguageSwitcher, useLanguage } from '../lib/i18n'
import { lazyWithReload } from '../lib/lazyWithReload'
import { reportAppError } from '../lib/reportAppError'

const loadLoginPage = () => import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
const loadEquipmentPage = () => import('../features/equipment/EquipmentPage').then((module) => ({ default: module.EquipmentPage }))
const loadEquipmentCreatePage = () => import('../features/equipment/EquipmentCreatePage').then((module) => ({ default: module.EquipmentCreatePage }))
const loadListsPage = () => import('../features/lists/ListsPage').then((module) => ({ default: module.ListsPage }))
const loadListEditorPage = () => import('../features/lists/ListEditorPage').then((module) => ({ default: module.ListEditorPage }))
const loadHomePage = () => import('../features/home/HomePage').then((module) => ({ default: module.HomePage }))

const LoginPage = lazyWithReload(loadLoginPage)
const EquipmentPage = lazyWithReload(loadEquipmentPage)
const EquipmentCreatePage = lazyWithReload(loadEquipmentCreatePage)
const ListsPage = lazyWithReload(loadListsPage)
const ListEditorPage = lazyWithReload(loadListEditorPage)
const HomePage = lazyWithReload(loadHomePage)

export function App() {
  const { isLoading, session } = useAuth()

  // Dev-триггер корневой границы: бросок здесь выше любой постраничной границы, но
  // ниже корневой. window.location вместо useLocation — чтобы не подписывать App на
  // каждую навигацию ради ветки, которой в проде нет.
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('__crash') === 'app') {
    throw new Error('проверка границы: корень')
  }

  if (isLoading) return <AppLoader />

  return <Routes>
      <Route path="/login" element={<RouteBoundary variant="app"><LoginPage /></RouteBoundary>} />
      <Route element={session ? <AppShell /> : <LoginRedirect />}>
        <Route index element={<RouteBoundary><HomePage /></RouteBoundary>} />
        <Route path="/equipment" element={<RouteBoundary><EquipmentPage /></RouteBoundary>} />
        <Route path="/equipment/new" element={<RouteBoundary><EquipmentCreatePage /></RouteBoundary>} />
        <Route path="/lists" element={<RouteBoundary><ListsPage /></RouteBoundary>} />
        <Route path="/lists/new" element={<RouteBoundary><ListEditorPage /></RouteBoundary>} />
        <Route path="/lists/:listId/edit" element={<RouteBoundary><ListEditorPage /></RouteBoundary>} />
      </Route>
      <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
    </Routes>
}

// Гейт сессии уводил на /login простым Navigate, и адрес, за которым человек
// пришёл, терялся: после входа он всегда оказывался на главной. Путь кладём в
// state перехода — LoginPage вернёт на него.
function LoginRedirect() {
  const location = useLocation()
  const target = `${location.pathname}${location.search}${location.hash}`
  // Внутренним считаем только `/…`: строка вида `//host` читается браузером как
  // адрес другого сайта, и «возврат» после входа увёл бы наружу.
  const isInternal = target.startsWith('/') && !target.startsWith('//')
  return <Navigate to="/login" replace state={isInternal ? { from: target } : undefined} />
}

function AppShell() {
  const { session, signOut } = useAuth()
  const { tr } = useLanguage()
  const email = session?.user.email ?? tr('Сотрудник ARGO', 'ARGO xodimi')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('argo:sidebar-collapsed') === 'true')

  useEffect(() => {
    window.localStorage.setItem('argo:sidebar-collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    const moduleTimer = window.setTimeout(() => {
      void Promise.allSettled([
        loadHomePage(),
        loadEquipmentPage(),
        loadEquipmentCreatePage(),
        loadListsPage(),
        loadListEditorPage(),
      ])
    }, 0)
    const primaryDataTimer = window.setTimeout(() => {
      void Promise.all([
        import('../features/equipment/api'),
        import('../features/lists/api'),
      ]).then(([equipmentApi, listsApi]) => Promise.allSettled([
        equipmentApi.fetchEquipment({
          page: 1,
          search: '',
          availability: '',
          // Размер страницы входит в ключ кэша: прогрев обязан спросить его у самой фичи,
          // иначе страница промахнётся мимо прогретой записи.
          pageSize: equipmentApi.preferredEquipmentPageSize(),
        }),
        listsApi.fetchEquipmentLists({
          page: 1,
          search: '',
          status: 'all',
          // Тот же довод, что и у каталога: размер страницы входит в ключ кэша,
          // и прогрев обязан спросить его у самой фичи.
          pageSize: listsApi.preferredListsPageSize(),
        }),
      ])).then((results) => {
        // Promise.allSettled не отклоняется НИКОГДА: провал запроса виден только в
        // статусе элемента, и внешний .catch про него не узнает. Отчёт собираем здесь,
        // по каждому отказу отдельно.
        results.forEach((result) => {
          if (result.status === 'rejected') reportAppError(result.reason, { scope: 'prefetch', detail: { batch: 'primary-data' } })
        })
      // Внешний .catch остаётся: он ловит то, что случилось ДО allSettled — провал
      // самого import() модулей api.
      }).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', detail: { batch: 'primary-data' } }))
    }, 120)
    const editorDataTimer = window.setTimeout(() => {
      void Promise.all([
        import('../features/equipment/api'),
        import('../components/EquipmentVisual'),
      ]).then(async ([equipmentApi, visuals]) => {
        const [equipment] = await Promise.all([
          equipmentApi.fetchAllEquipment(),
          equipmentApi.fetchEquipmentTaxonomy(),
        ])
        visuals.preloadEquipmentImages(equipment, 32)
      }).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', detail: { batch: 'editor-data' } }))
    }, 700)
    return () => {
      window.clearTimeout(moduleTimer)
      window.clearTimeout(primaryDataTimer)
      window.clearTimeout(editorDataTimer)
    }
  }, [])

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Link className="brand-lockup brand-lockup--light brand-lockup--home" to="/" aria-label={tr('Вернуться на главную', 'Bosh sahifaga qaytish')}>
            <span className="brand-mark">A</span>
            <span className="brand-name">ARGO</span>
          </Link>
          <button
            className="icon-button icon-button--dark sidebar__toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? tr('Развернуть меню', 'Menyuni ochish') : tr('Свернуть меню', 'Menyuni yig‘ish')}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? tr('Развернуть меню', 'Menyuni ochish') : tr('Свернуть меню', 'Menyuni yig‘ish')}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="sidebar__nav" aria-label={tr('Основная навигация', 'Asosiy navigatsiya')}>
          <p className="nav-section-label">{tr('Склад', 'Ombor')}</p>
          <NavLink to="/" end><House size={19} /><span>{tr('Главная', 'Bosh sahifa')}</span></NavLink>
          <NavLink to="/equipment"><Boxes size={19} /><span>{tr('Оборудование', 'Uskunalar')}</span></NavLink>
          <NavLink to="/lists"><ClipboardList size={19} /><span>{tr('Списки', 'Ro‘yxatlar')}</span></NavLink>
        </nav>

        <div className="sidebar__utility">
          <NavLink className="sidebar__quick-action" to="/lists/new">
            <span><ListPlus size={19} /></span>
            <div><strong>{tr('Новый список', 'Yangi ro‘yxat')}</strong><small>{tr('Собрать комплект', 'Jamlanma tuzish')}</small></div>
            <ArrowUpRight size={16} />
          </NavLink>
          <div className="sidebar__flow" aria-hidden="true">
            <p>{tr('Быстрый процесс', 'Tezkor jarayon')}</p>
            <ol>
              <li><i>01</i><span>{tr('Найти технику', 'Uskunani topish')}</span></li>
              <li><i>02</i><span>{tr('Собрать комплект', 'Jamlanma tuzish')}</span></li>
              <li><i>03</i><span>{tr('Скачать Excel', 'Excel yuklash')}</span></li>
            </ol>
          </div>
        </div>

        <div className="sidebar__signal sidebar__signal--bottom"><RadioTower size={14} /><span>{tr('Склад в рабочем режиме', 'Ombor ish rejimida')}</span><i /></div>

        <div className="sidebar__scope">
          <Warehouse size={18} />
          <span><small>{tr('Текущая локация', 'Joriy joylashuv')}</small><strong>{tr('Офис · Ташкент', 'Ofis · Toshkent')}</strong></span>
          <ChevronDown size={16} />
        </div>

        <div className="sidebar__language"><LanguageSwitcher compact /></div>

        <div className="sidebar__footer">
          <div className="user-avatar"><img src="/brand/video-engineer-avatar.png" alt={tr('Видеоинженер', 'Video muhandis')} loading="eager" decoding="async" /></div>
          <div className="user-copy"><strong>{email.split('@')[0]}</strong><span>{email}</span></div>
          <button className="icon-button icon-button--dark" onClick={() => void signOut()} aria-label={tr('Выйти', 'Chiqish')}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="app-content">
        {/* Минимум U5: на телефоне и планшете sidebar__footer скрыт, и выйти из аккаунта
            негде. Полоса видна только до 820 px и уйдёт, когда в нижнюю навигацию
            добавится пункт «Ещё». */}
        <div className="mobile-account">
          <span>{email}</span>
          <button className="button button--secondary mobile-account__signout" onClick={() => void signOut()}><LogOut size={16} />{tr('Выйти', 'Chiqish')}</button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}

function RouteBoundary({ children, variant = 'page' }: { children: ReactNode; variant?: 'app' | 'page' }) {
  const location = useLocation()
  const { tr } = useLanguage()

  return (
    // resetKey — путь: экран ошибки гаснет при уходе на другой раздел. Экземпляр
    // границы переживает смену маршрута (useRoutes сверяет элементы по позиции),
    // поэтому без явного сброса ошибка залипла бы на всём приложении.
    <AppErrorBoundary variant={variant} resetKey={location.pathname} tr={tr}>
      <Suspense fallback={variant === 'app' ? <AppLoader /> : <RouteLoader />}>
        {import.meta.env.DEV && <CrashTrigger search={location.search} />}
        {children}
      </Suspense>
    </AppErrorBoundary>
  )
}

// Dev-триггер постраничной границы. Отдельный компонент, а не проверка в теле
// RouteBoundary: бросок обязан случиться ВНУТРИ границы, иначе его поймает
// вышестоящая корневая и унесёт сайдбар.
function CrashTrigger({ search }: { search: string }) {
  if (new URLSearchParams(search).get('__crash') === '1') throw new Error('проверка границы')
  return null
}

function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-label="Загрузка раздела">
      <span className="route-loader__title" />
      <span className="route-loader__panel" />
    </div>
  )
}

function AppLoader() {
  return (
    <main className="app-loader">
      <div className="brand-lockup"><span className="brand-mark">A</span><span className="brand-name">ARGO</span></div>
      <span className="loader-line" />
    </main>
  )
}
