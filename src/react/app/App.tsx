import { ArrowUpRight, Boxes, CarFront, ClipboardList, Ellipsis, House, ListPlus, LogOut, PanelLeftClose, PanelLeftOpen, Presentation, Users, Warehouse, X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppErrorBoundary } from '../components/AppErrorBoundary'
import { useAuth } from '../features/auth/AuthProvider'
import { LanguageSwitcher, useLanguage } from '../lib/i18n'
import { lazyWithReload } from '../lib/lazyWithReload'
import { reportAppError } from '../lib/reportAppError'
import { useModalLayer } from '../lib/useModalLayer'

const loadLoginPage = () => import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
const loadEquipmentPage = () => import('../features/equipment/EquipmentPage').then((module) => ({ default: module.EquipmentPage }))
const loadEquipmentCreatePage = () => import('../features/equipment/EquipmentCreatePage').then((module) => ({ default: module.EquipmentCreatePage }))
const loadListsPage = () => import('../features/lists/ListsPage').then((module) => ({ default: module.ListsPage }))
const loadListEditorPage = () => import('../features/lists/ListEditorPage').then((module) => ({ default: module.ListEditorPage }))
const loadEmployeesPage = () => import('../features/employees/EmployeesPage').then((module) => ({ default: module.EmployeesPage }))
const loadEmployeeFormPage = () => import('../features/employees/EmployeeFormPage').then((module) => ({ default: module.EmployeeFormPage }))
const loadVehiclesPage = () => import('../features/vehicles/VehiclesPage').then((module) => ({ default: module.VehiclesPage }))
const loadVehicleFormPage = () => import('../features/vehicles/VehicleFormPage').then((module) => ({ default: module.VehicleFormPage }))
const loadHallPlansPage = () => import('../features/halls/HallPlansPage').then((module) => ({ default: module.HallPlansPage }))
const loadHallPlanPage = () => import('../features/halls/HallPlanPage').then((module) => ({ default: module.HallPlanPage }))
const loadHallTvPage = () => import('../features/halls/HallTvPage').then((module) => ({ default: module.HallTvPage }))
const loadHomePage = () => import('../features/home/HomePage').then((module) => ({ default: module.HomePage }))

const LoginPage = lazyWithReload(loadLoginPage)
const EquipmentPage = lazyWithReload(loadEquipmentPage)
const EquipmentCreatePage = lazyWithReload(loadEquipmentCreatePage)
const ListsPage = lazyWithReload(loadListsPage)
const ListEditorPage = lazyWithReload(loadListEditorPage)
const EmployeesPage = lazyWithReload(loadEmployeesPage)
const EmployeeFormPage = lazyWithReload(loadEmployeeFormPage)
const VehiclesPage = lazyWithReload(loadVehiclesPage)
const VehicleFormPage = lazyWithReload(loadVehicleFormPage)
const HallPlansPage = lazyWithReload(loadHallPlansPage)
const HallPlanPage = lazyWithReload(loadHallPlanPage)
const HallTvPage = lazyWithReload(loadHallTvPage)
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
        <Route path="/employees" element={<RouteBoundary><EmployeesPage /></RouteBoundary>} />
        <Route path="/employees/new" element={<RouteBoundary><EmployeeFormPage /></RouteBoundary>} />
        <Route path="/employees/:employeeId/edit" element={<RouteBoundary><EmployeeFormPage /></RouteBoundary>} />
        <Route path="/vehicles" element={<RouteBoundary><VehiclesPage /></RouteBoundary>} />
        <Route path="/vehicles/new" element={<RouteBoundary><VehicleFormPage /></RouteBoundary>} />
        <Route path="/vehicles/:vehicleId/edit" element={<RouteBoundary><VehicleFormPage /></RouteBoundary>} />
        <Route path="/halls" element={<RouteBoundary><HallPlansPage /></RouteBoundary>} />
        <Route path="/halls/:planId" element={<RouteBoundary><HallPlanPage /></RouteBoundary>} />
      </Route>
      {/* ТВ-режим — вне AppShell: на экране в зале не нужны ни сайдбар, ни
          отступы приложения. Гейт сессии у маршрута свой, как у шелла. */}
      <Route path="/halls/:planId/tv" element={session ? <RouteBoundary variant="app"><HallTvPage /></RouteBoundary> : <LoginRedirect />} />
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
  const [isMoreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  // Прогрев каталога — один раз на загрузку страницы, а не на каждый вход
  // в раздел: сама выгрузка кэшируется в памяти, но повторные заходы не должны
  // заново заводить таймер.
  const catalogWarmedRef = useRef(false)

  // Лист закрывается на любую смену маршрута, а не только по своей ссылке:
  // жест «назад» увёл бы страницу из-под открытого листа, и он остался бы
  // висеть поверх чужого экрана.
  useEffect(() => { setMoreOpen(false) }, [pathname])

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
        loadEmployeesPage(),
        loadEmployeeFormPage(),
        loadVehiclesPage(),
        loadVehicleFormPage(),
        loadHallPlansPage(),
        loadHallPlanPage(),
      ])
    }, 0)
    // Прогрев выдач всех шести разделов, а не только двух старых (решение прораба,
    // с26: «чтобы данные были загружены заранее»). Сюда попадает только ЛЁГКОЕ —
    // реестры на 1–3 КБ, которые всё равно спросят через секунду. Тяжёлое остаётся
    // за порогом: полный каталог (109 КБ) греется ниже и только под /lists, фото
    // сотрудников (около мегабайта) не греются вовсе — их качает тот, кто открыл
    // раздел. Реестр сотрудников безопасен для диска: паспортных полей в нём нет.
    const primaryDataTimer = window.setTimeout(() => {
      void Promise.all([
        import('../features/equipment/api'),
        import('../features/lists/api'),
        import('../features/employees/api'),
        import('../features/vehicles/api'),
        import('../features/halls/api'),
      ]).then(([equipmentApi, listsApi, employeesApi, vehiclesApi, hallsApi]) => Promise.allSettled([
        employeesApi.fetchEmployeeList(),
        vehiclesApi.fetchVehicles(),
        hallsApi.fetchHallPlans(),
        // Таксономия переехала сюда из тяжёлой пачки ниже: она весит пару
        // килобайт, живёт сутки и лежит на диске — греть её стоит везде, а вот
        // тащить ради неё полный каталог (см. ниже) не стоит нигде.
        equipmentApi.fetchEquipmentTaxonomy(),
        // Каталог модельный с U29 — греем агрегат, а не построчную выдачу.
        equipmentApi.fetchEquipmentModels({
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
    return () => {
      window.clearTimeout(moduleTimer)
      window.clearTimeout(primaryDataTimer)
    }
  }, [])

  // Полная выгрузка каталога — 109 КБ сжатого JSON, и она приезжает НА КАЖДЫЙ
  // заход: persist: false, в localStorage ей не место (equipment/api.ts). Нужна
  // она ровно одному экрану — редактору списка, а грелась на всех шести, включая
  // сотрудников и залы, где каталога нет вовсе. Гейт по адресу: под /lists она
  // приезжает заранее, в остальных разделах не приезжает совсем.
  useEffect(() => {
    if (!pathname.startsWith('/lists') || catalogWarmedRef.current) return
    const editorDataTimer = window.setTimeout(() => {
      // Отметку ставим здесь, а не в теле эффекта: уход с /lists раньше 700 мс
      // снимает таймер, и прогрев должен остаться несделанным, а не считаться
      // выполненным.
      catalogWarmedRef.current = true
      void Promise.all([
        import('../features/equipment/api'),
        import('../components/EquipmentVisual'),
      ]).then(async ([equipmentApi, visuals]) => {
        const equipment = await equipmentApi.fetchAllEquipment()
        visuals.preloadEquipmentImages(equipment, 32)
      }).catch((error: unknown) => reportAppError(error, { scope: 'prefetch', detail: { batch: 'editor-data' } }))
    }, 700)
    return () => window.clearTimeout(editorDataTimer)
  }, [pathname])

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
          <NavLink to="/employees"><Users size={19} /><span>{tr('Сотрудники', 'Xodimlar')}</span></NavLink>
          <NavLink to="/vehicles"><CarFront size={19} /><span>{tr('Автомобили', 'Avtomobillar')}</span></NavLink>
          {/* Шестой раздел на телефоне в нижнюю панель не влезает: слотов там
              пять плюс «Ещё», и седьмой ужал бы каждый до сорока пикселей.
              Поэтому на ≤820 ссылка прячется, а «Залы» уходят в лист «Ещё». */}
          <NavLink className="sidebar__nav-extra" to="/halls"><Presentation size={19} /><span>{tr('Залы', 'Zallar')}</span></NavLink>
          {/* Четвёртый слот нижней панели, на десктопе скрыт: язык, аккаунт и
              быстрый переход в новый список живут в сайдбаре, которого на
              телефоне нет. Раньше этот слот занимал постоянный RU/UZ. */}
          <button
            type="button"
            className={`sidebar__more ${isMoreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isMoreOpen}
          >
            <Ellipsis size={19} /><span>{tr('Ещё', 'Yana')}</span>
          </button>
        </nav>

        <div className="sidebar__utility">
          <NavLink className="sidebar__quick-action" to="/lists/new">
            <span><ListPlus size={19} /></span>
            <div><strong>{tr('Новый список', 'Yangi ro‘yxat')}</strong><small>{tr('Собрать комплект', 'Jamlanma tuzish')}</small></div>
            <ArrowUpRight size={16} />
          </NavLink>
        </div>

        {/* Локация одна на весь каталог, выбирать не из чего: строка осталась
            реквизитом склада — без подписи «текущая» и без шеврона, который
            ничего не открывал. */}
        <div className="sidebar__scope">
          <Warehouse size={18} />
          <span><strong>{tr('Офис · Ташкент', 'Ofis · Toshkent')}</strong></span>
        </div>

        <div className="sidebar__language"><LanguageSwitcher compact /></div>

        <div className="sidebar__footer">
          <div className="user-avatar"><img src="/brand/video-engineer-avatar.png" alt={tr('Видеоинженер', 'Video muhandis')} loading="eager" decoding="async" /></div>
          <div className="user-copy"><strong>{email.split('@')[0]}</strong><span>{email}</span></div>
          <button className="icon-button icon-button--dark" onClick={() => void signOut()} aria-label={tr('Выйти', 'Chiqish')}><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="app-content">
        <Outlet />
      </main>

      {isMoreOpen && <MobileMoreSheet email={email} onSignOut={() => void signOut()} onClose={() => setMoreOpen(false)} />}
    </div>
  )
}

// Нижний лист телефона: то, что на десктопе висит в сайдбаре постоянно.
// Отдельный слой, а не выпадашка: панель навигации фиксирована у нижнего края,
// и попап пришлось бы позиционировать вручную поверх safe-area.
function MobileMoreSheet({ email, onSignOut, onClose }: { email: string; onSignOut: () => void; onClose: () => void }) {
  const { tr } = useLanguage()
  useModalLayer(onClose)

  return (
    <div className="sheet-layer" role="dialog" aria-modal="true" aria-label={tr('Ещё', 'Yana')} onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sheet__header">
          <strong>{tr('Ещё', 'Yana')}</strong>
          <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
        </div>
        {/* Тот же путь, что у быстрого действия сайдбара: на телефоне сайдбар
            скрыт, и одношаговый вход в сборку комплекта пропадал. */}
        <Link className="sheet__action" to="/lists/new" onClick={onClose}>
          <span><ListPlus size={19} /></span>
          <div><strong>{tr('Новый список', 'Yangi ro‘yxat')}</strong><small>{tr('Собрать комплект', 'Jamlanma tuzish')}</small></div>
          <ArrowUpRight size={16} />
        </Link>
        {/* «Залы» показываются только здесь: в нижней панели телефона для них
            нет слота (см. sidebar__nav-extra). */}
        <Link className="sheet__action" to="/halls" onClick={onClose}>
          <span><Presentation size={19} /></span>
          <div><strong>{tr('Залы', 'Zallar')}</strong><small>{tr('Расстановка по залам', 'Zallar bo‘yicha taqsimot')}</small></div>
          <ArrowUpRight size={16} />
        </Link>
        <div className="sheet__row">
          <span>{tr('Язык интерфейса', 'Interfeys tili')}</span>
          <LanguageSwitcher />
        </div>
        <div className="sheet__account">
          <span>{email}</span>
          <button className="button button--secondary" onClick={onSignOut}><LogOut size={16} />{tr('Выйти', 'Chiqish')}</button>
        </div>
      </div>
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
