import { ArrowUpRight, Boxes, CalendarRange, CarFront, ChevronDown, ClipboardList, Ellipsis, House, ListPlus, LogOut, MapIcon, Presentation, RadioTower, Receipt, Users, Warehouse, X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, m, type Transition } from 'motion/react'
import { Link, matchPath, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppErrorBoundary } from '../components/AppErrorBoundary'
import { ArgoDots } from '../components/ArgoDots'
import { BottomSheet } from '../components/BottomSheet'
import { useAuth } from '../features/auth/AuthProvider'
import { fetchHomeSummary, readCachedHomeSummary, type HomeSummary } from '../features/home/api'
import { hasUnsavedListDraft } from '../features/lists/cacheKeys'
import { MOBILE_MEDIA_QUERY } from '../lib/breakpoints'
import { LanguageSwitcher, useLanguage } from '../lib/i18n'
import { lazyWithReload } from '../lib/lazyWithReload'
import { reportAppError } from '../lib/reportAppError'
import { hasUnsavedWork } from '../lib/unsavedRegistry'
import { useArmedAction } from '../lib/useArmedAction'
import { useModalLayer } from '../lib/useModalLayer'
import { usePopoverLayer } from '../lib/usePopoverLayer'

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
const loadProjectsPage = () => import('../features/projects/ProjectsPage').then((module) => ({ default: module.ProjectsPage }))
const loadProjectPage = () => import('../features/projects/ProjectPage').then((module) => ({ default: module.ProjectPage }))
const loadMealsPage = () => import('../features/meals/MealsPage').then((module) => ({ default: module.MealsPage }))
const loadHomePage = () => import('../features/home/HomePage').then((module) => ({ default: module.HomePage }))
const loadDelayCalculatorPage = () => import('../features/delay/DelayCalculatorPage').then((module) => ({ default: module.DelayCalculatorPage }))
const loadExpensesPage = () => import('../features/expenses/ExpensesPage').then((module) => ({ default: module.ExpensesPage }))

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
const ProjectsPage = lazyWithReload(loadProjectsPage)
const ProjectPage = lazyWithReload(loadProjectPage)
const MealsPage = lazyWithReload(loadMealsPage)
const HomePage = lazyWithReload(loadHomePage)
const DelayCalculatorPage = lazyWithReload(loadDelayCalculatorPage)
const ExpensesPage = lazyWithReload(loadExpensesPage)
// Мир в проде с с58 (план world-work-s58, Э1а). В общий прогрев moduleTimer
// не входит намеренно (решение 7 с51): чанк three тяжёлый, грузится только
// по заходу на /world.
const WorldPage = lazyWithReload(() => import('../features/world/WorldPage').then((module) => ({ default: module.WorldPage })))

// Пункты нижней панели телефона — m-обёртка над NavLink ради whileTap: сжатие
// должно ловиться по всей площади вкладки, а не только по значку.
const MotionNavLink = m.create(NavLink)

// Пять вкладок телефона (макет с31): четыре раздела и «Ещё». Мероприятия,
// Сотрудники, Автомобили, Задержки, Расходы и Мир на ≤820 живут в листе «Ещё», и
// на их адресах подсвечивается именно «Ещё».
type PhoneTab = 'home' | 'equipment' | 'lists' | 'halls' | 'more'

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

function phoneTabOf(pathname: string): PhoneTab {
  if (pathname === '/') return 'home'
  if (isUnder(pathname, '/equipment')) return 'equipment'
  if (isUnder(pathname, '/lists')) return 'lists'
  if (isUnder(pathname, '/halls')) return 'halls'
  return 'more'
}

// Разделы меню «Ещё» верхней полосы (десктоп): редкие инструменты, которым не
// хватило места в строке. На их адресах подсвечивается сама кнопка «Ещё».
// Список адресов один — по нему же рисуются пункты меню (DesktopMoreMenu).
const DESKTOP_MORE_PATHS = ['/delay', '/expenses', '/world']

function isDesktopMorePath(pathname: string) {
  return DESKTOP_MORE_PATHS.some((base) => isUnder(pathname, base))
}

// Режим «задача» (макет с31, решение прораба с35): редактор списка — как экран
// «Новое письмо», на телефоне (≤700) нижней панели нет, выход — стрелкой «←»
// в шапке. Шаблоны — те же, что у маршрутов редактора в App: правишь маршрут —
// правишь и здесь. Сама панель прячется в 06-responsive-shell.
const TASK_ROUTE_PATTERNS = ['/lists/new', '/lists/:listId/edit']

function isTaskRoute(pathname: string) {
  return TASK_ROUTE_PATTERNS.some((pattern) => matchPath(pattern, pathname) !== null)
}

// Числа — из раздела «Решения» макета с31: индикатор вкладки переезжает за 200 мс,
// нажатие — 0,97. Числа листа «Ещё» — в components/BottomSheet.tsx.
const TAB_INDICATOR_TRANSITION: Transition = { duration: 0.2, ease: 'easeOut' }
const TAB_PRESS = { scale: 0.97 }

// Счётчики меню берутся из той же сводки, что и плитки главной (RPC home_summary,
// ключ home:summary): второго источника чисел нет. Спрашиваем на каждой смене
// раздела, но без bypass — в пределах минутного TTL это чтение кэша, а за ним
// один запрос, общий с главной (cachedQuery склеивает запросы в полёте). Так
// правка в разделе доезжает до меню не позже первого перехода после TTL.
// Отказ — меню без чисел: счётчик здесь подсказка, а не факт, ради которого стоит
// шуметь на экране; след остаётся в канале ошибок.
function useNavSummary(pathname: string) {
  const [summary, setSummary] = useState<HomeSummary | null>(() => readCachedHomeSummary())

  useEffect(() => {
    let isActive = true
    fetchHomeSummary()
      .then((value) => { if (isActive) setSummary(value) })
      .catch((error: unknown) => {
        if (isActive) setSummary(null)
        reportAppError(error, { scope: 'loader', detail: { batch: 'nav-summary' } })
      })
    return () => { isActive = false }
  }, [pathname])

  return summary
}

// Инициалы для аватара — из почты: имени в профиле нет. «rls-test» → «RT»,
// «ivanov» → «IV».
function initialsOf(email: string) {
  const [first = '', second = ''] = (email.split('@')[0] ?? '').split(/[._\-\s]+/).filter(Boolean)
  return (second ? `${first.slice(0, 1)}${second.slice(0, 1)}` : first.slice(0, 2)).toUpperCase()
}

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
        <Route path="/projects" element={<RouteBoundary><ProjectsPage /></RouteBoundary>} />
        <Route path="/projects/:projectId" element={<RouteBoundary><ProjectPage /></RouteBoundary>} />
        <Route path="/projects/:projectId/meals" element={<RouteBoundary><MealsPage /></RouteBoundary>} />
        <Route path="/halls" element={<RouteBoundary><HallPlansPage /></RouteBoundary>} />
        <Route path="/halls/:planId" element={<RouteBoundary><HallPlanPage /></RouteBoundary>} />
        <Route path="/delay" element={<RouteBoundary><DelayCalculatorPage /></RouteBoundary>} />
        <Route path="/expenses" element={<RouteBoundary><ExpensesPage /></RouteBoundary>} />
        <Route path="/world" element={<RouteBoundary><WorldPage /></RouteBoundary>} />
      </Route>
      {/* ТВ-режим — вне AppShell: на экране в зале не нужны ни навигация, ни
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

// Выход с подтверждением, если что-то пропадёт. Взвод — единственная защита:
// форма на выходе просто размонтируется, и ни блокер роутера, ни beforeunload её
// не спросят, а черновик списка стирается вместе с кэшем (purgeCacheScope).
// Без несохранённого выход, как и был, — с первого нажатия.
function useSignOutConfirm(signOut: () => void) {
  const { armed, fire, disarm } = useArmedAction()

  function requestSignOut() {
    if (armed || hasUnsavedListDraft() || hasUnsavedWork()) fire(signOut)
    else signOut()
  }

  return { armed, requestSignOut, disarm }
}

function AppShell() {
  const { session, signOut } = useAuth()
  const { tr, locale } = useLanguage()
  const email = session?.user.email ?? tr('Сотрудник ARGO', 'ARGO xodimi')
  // «Ещё» — одна кнопка на оба вида: на телефоне открывает нижний лист, на
  // десктопе — выпадающее меню полосы. Состояние общее, слой выбирает isPhone.
  const [isMoreOpen, setMoreOpen] = useState(false)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const [isPhone, setPhone] = useState(() => window.matchMedia(MOBILE_MEDIA_QUERY).matches)
  const { pathname } = useLocation()
  const navSummary = useNavSummary(pathname)
  const signOutConfirm = useSignOutConfirm(() => void signOut())
  const signOutLabel = signOutConfirm.armed ? tr('Да, выйти', 'Ha, chiqish') : tr('Выйти', 'Chiqish')
  // Прогрев каталога — один раз на загрузку страницы, а не на каждый вход
  // в раздел: сама выгрузка кэшируется в памяти, но повторные заходы не должны
  // заново заводить таймер.
  const catalogWarmedRef = useRef(false)

  // Лист и меню закрываются на любую смену маршрута, а не только по своей ссылке:
  // жест «назад» увёл бы страницу из-под открытого листа, и он остался бы
  // висеть поверх чужого экрана.
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Индикатор вкладки и подпись «Техника» — только телефонные, поэтому граница
  // нужна в JS, а не одним CSS. «Ещё» при переходе границы закрывается в обе
  // стороны: лист и меню — разные слои, и открытый не должен превратиться в другой.
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const handleChange = () => {
      setPhone(media.matches)
      setMoreOpen(false)
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

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
        loadProjectsPage(),
        loadProjectPage(),
        loadMealsPage(),
        loadDelayCalculatorPage(),
        loadExpensesPage(),
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
        import('../features/projects/api'),
      ]).then(([equipmentApi, listsApi, employeesApi, vehiclesApi, hallsApi, projectsApi]) => Promise.allSettled([
        employeesApi.fetchEmployeeList(),
        vehiclesApi.fetchVehicles(),
        hallsApi.fetchHallPlans(),
        // Реестр мероприятий — числа и реквизиты, без состава: лёгкий и на диск годится.
        projectsApi.fetchProjects(),
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

  // Открытый лист забирает подсветку себе, как в макете: индикатор уезжает на
  // «Ещё», а вкладка текущего раздела гаснет до закрытия листа. Это телефон; на
  // десктопе открытое меню подсветку не трогает — раздел остаётся виден в строке.
  const isSheetOpen = isPhone && isMoreOpen
  const activeTab: PhoneTab = isSheetOpen ? 'more' : phoneTabOf(pathname)
  const isMoreActive = isPhone ? activeTab === 'more' : isDesktopMorePath(pathname)
  const tabClass = ({ isActive }: { isActive: boolean }) => (isActive && !isSheetOpen ? 'active' : '')
  const tabPress = isPhone ? TAB_PRESS : undefined
  // Один элемент с общим layoutId: motion переносит его из вкладки во вкладку.
  // На десктопе его нет вовсе — там подсветку рисует .active, как и раньше.
  const tabIndicator = (tab: PhoneTab) => (isPhone && activeTab === tab
    ? <m.span layoutId="phone-tab-indicator" className="appbar__tab-ind" transition={TAB_INDICATOR_TRANSITION} aria-hidden="true" />
    : null)
  // Число у пункта меню; сводки нет — нет и элемента. <em>, а не <span>: подпись
  // пункта — это span, и правила подписей в узкой полосе и в нижней панели
  // (06-responsive-shell) не должны задевать счётчик.
  const navCount = (value: number | undefined) => (value === undefined
    ? null
    : <em className="appbar__count">{value.toLocaleString(locale)}</em>)

  return (
    <div className={`app-shell${isTaskRoute(pathname) ? ' app-shell--task' : ''}`}>
      {/* Одна разметка на оба вида: на десктопе — тёмная полоса сверху (решение
          прораба с59, до него — сайдбар слева), на телефоне — нижняя панель из
          пяти вкладок. Вид переключает 06-responsive-shell. */}
      <header className="appbar">
        {/* Знак — SVG из точек (ArgoDots), а не картинка: растровых ассетов в
            продукте нет, и точки берут цвет из currentColor. */}
        <Link className="appbar__home" to="/" aria-label={tr('Вернуться на главную', 'Bosh sahifaga qaytish')}>
          <ArgoDots className="appbar__mark" />
          <small>{tr('Склад', 'Ombor')}</small>
        </Link>

        {/* layoutRoot — только на телефоне: там панель fixed, и без него motion
            прибавил бы к пути индикатора прокрутку страницы (смена раздела
            сбрасывает её между замерами). */}
        <m.nav className="appbar__nav" layoutRoot={isPhone} aria-label={tr('Основная навигация', 'Asosiy navigatsiya')}>
          <MotionNavLink to="/" end className={tabClass} whileTap={tabPress}>{tabIndicator('home')}<House size={19} /><span>{tr('Главная', 'Bosh sahifa')}</span></MotionNavLink>
          {/* На телефоне — «Техника»: в слоте шириной в пятую часть экрана
              «Оборудование» слипалось с соседями (V-05 макета). Счётчик —
              модели, а не строки: так считает сам каталог. */}
          <MotionNavLink to="/equipment" className={tabClass} whileTap={tabPress}>{tabIndicator('equipment')}<Boxes size={19} /><span>{isPhone ? tr('Техника', 'Texnika') : tr('Оборудование', 'Uskunalar')}</span>{navCount(navSummary?.equipment.models)}</MotionNavLink>
          {/* Счётчика у «Списков» нет: home_summary их не считает, а второй
              источник числа ради меню не заводим. */}
          <MotionNavLink to="/lists" className={tabClass} whileTap={tabPress}>{tabIndicator('lists')}<ClipboardList size={19} /><span>{tr('Списки', 'Ro‘yxatlar')}</span></MotionNavLink>
          {/* Мероприятия, Сотрудники и Автомобили на телефоне в нижнюю панель не
              входят: там ровно пять вкладок (Главная, Техника, Списки, Залы, Ещё),
              шестая ужала бы подписи до слипания. На ≤820 эти ссылки прячутся
              (appbar__nav-extra), а сами разделы живут в листе «Ещё».
              Мероприятия — перед людьми и залами: к ним привязаны и те, и другие.
              Счётчика нет: home_summary мероприятия не считает. */}
          <NavLink className="appbar__nav-extra" to="/projects"><CalendarRange size={19} /><span>{tr('Мероприятия', 'Tadbirlar')}</span></NavLink>
          <NavLink className="appbar__nav-extra" to="/employees"><Users size={19} /><span>{tr('Сотрудники', 'Xodimlar')}</span>{navCount(navSummary?.employees.count)}</NavLink>
          <NavLink className="appbar__nav-extra" to="/vehicles"><CarFront size={19} /><span>{tr('Автомобили', 'Avtomobillar')}</span>{navCount(navSummary?.vehicles.count)}</NavLink>
          <MotionNavLink to="/halls" className={tabClass} whileTap={tabPress}>{tabIndicator('halls')}<Presentation size={19} /><span>{tr('Залы', 'Zallar')}</span></MotionNavLink>
          {/* «Ещё»: на телефоне — пятый слот нижней панели (лист с языком,
              аккаунтом, новым списком и разделами сверх пяти), на десктопе —
              меню редких инструментов, которым не хватило строки. Горит и на
              адресах этих разделов. Раскрытие, а не role="menu": внутри обычные
              ссылки, и Tab по ним ходит без стрелочной навигации. */}
          <m.button
            ref={moreButtonRef}
            type="button"
            className={`appbar__more ${isMoreActive ? 'active' : ''}`}
            onClick={() => setMoreOpen((current) => (isPhone ? true : !current))}
            whileTap={tabPress}
            aria-haspopup={isPhone ? 'dialog' : undefined}
            aria-controls={isPhone ? undefined : DESKTOP_MORE_MENU_ID}
            aria-expanded={isMoreOpen}
          >
            {tabIndicator('more')}<Ellipsis size={19} /><span>{tr('Ещё', 'Yana')}</span>{!isPhone && <ChevronDown className="appbar__chevron" size={14} />}
          </m.button>
          {!isPhone && isMoreOpen && <DesktopMoreMenu buttonRef={moreButtonRef} onClose={() => setMoreOpen(false)} />}
        </m.nav>

        {/* Правый край полосы; на телефоне скрыт целиком — его содержимое живёт
            в листе «Ещё». */}
        <div className="appbar__end">
          {/* Подпись видна только на широком экране (06-responsive-shell), поэтому
              имя ссылки держит aria-label, а подсказку — title. */}
          <NavLink className="appbar__quick" to="/lists/new" aria-label={tr('Новый список', 'Yangi ro‘yxat')} title={tr('Новый список — собрать комплект', 'Yangi ro‘yxat — jamlanma tuzish')}>
            <span><ListPlus size={18} /></span>
            <strong>{tr('Новый список', 'Yangi ro‘yxat')}</strong>
          </NavLink>

          <div className="appbar__language"><LanguageSwitcher compact /></div>

          <div className="appbar__account">
            {/* Инициалы вместо фото: растровых картинок в продукте нет, а чужой
                портрет у каждого сотрудника врал бы. title — почта: подпись
                рядом видна только на широком экране. */}
            <div className="user-avatar" aria-hidden="true" title={email}>{initialsOf(email)}</div>
            <div className="user-copy"><strong>{email.split('@')[0]}</strong><span>{email}</span></div>
            {/* onMouseDown — Safari: иначе onBlur гасит взвод раньше второго click
                (gotchas §6). */}
            <button
              className="icon-button icon-button--dark"
              onClick={signOutConfirm.requestSignOut}
              onBlur={signOutConfirm.disarm}
              onMouseDown={(event) => { if (signOutConfirm.armed) event.preventDefault() }}
              aria-label={signOutLabel}
              title={signOutLabel}
            ><LogOut size={18} /></button>
            {/* Вопрос взвода — плашкой под кнопкой, а не вместо подписи: подпись
                на обычном ноутбуке скрыта, и взвод остался бы невидимым; а подмена
                текста в строке сдвинула бы кнопку из-под курсора перед вторым
                нажатием. */}
            {signOutConfirm.armed && <div className="appbar__confirm" role="status">
              <strong>{tr('Выйти? Несохранённое пропадёт', 'Chiqasizmi? Saqlanmagan ish yo‘qoladi')}</strong>
              <span>{tr('Нажмите ещё раз', 'Yana bir bor bosing')}</span>
            </div>}
          </div>
        </div>
      </header>

      {/* Сетку фона включает оболочка, а не страница: поле — вся колонка, а
          .home-screen кончается на паддингах .app-content, и линии обрывались бы. */}
      <main className={`app-content${pathname === '/' ? ' gridfield' : ''}`}>
        <Outlet />
      </main>

      {/* AnimatePresence держит лист в DOM, пока он уезжает вниз. */}
      <AnimatePresence>
        {isSheetOpen && <MobileMoreSheet key="more" email={email} onSignOut={() => void signOut()} onClose={() => setMoreOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}

// Меню «Ещё» верхней полосы (десктоп). Не портал и не fixed: абсолютный блок
// внутри липкой полосы едет вместе с ней, и координаты от getBoundingClientRect
// под zoom широкого экрана считать не нужно (gotchas §16). Пункты — полные имена
// разделов, как в листе телефона: места здесь хватает.
const DESKTOP_MORE_MENU_ID = 'appbar-more-menu'

function DesktopMoreMenu({ buttonRef, onClose }: { buttonRef: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const { tr } = useLanguage()
  const menuRef = useRef<HTMLDivElement>(null)
  // Клик мимо, Escape, прокрутка и смена размера окна — общий слой поповеров.
  usePopoverLayer(true, onClose, [buttonRef, menuRef])

  // Возврат фокуса на кнопку — на размонтировании, одной точкой для всех причин
  // закрытия (Escape, клик мимо, переход по пункту). Только если фокус потерян:
  // пункт исчез вместе с меню или клик пришёлся в нефокусируемое место. Нажали
  // на поле или кнопку — фокус уже там, и отбирать его нельзя. Таймер — потому
  // что клик мимо закрывает меню на pointerdown, а фокус браузер снимает позже,
  // на mousedown.
  useEffect(() => {
    const button = buttonRef.current
    return () => {
      window.setTimeout(() => {
        const active = document.activeElement
        if (button?.isConnected && (active === null || active === document.body)) button.focus({ preventScroll: true })
      }, 0)
    }
  }, [buttonRef])

  return (
    <div
      ref={menuRef}
      id={DESKTOP_MORE_MENU_ID}
      className="appbar__menu"
      // Tab увёл фокус за меню — оно закрывается. relatedTarget пуст при клике
      // мышью (в Safari — по любой ссылке): это не уход, клик мимо ловит слой.
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && !menuRef.current?.contains(next) && !buttonRef.current?.contains(next)) onClose()
      }}
    >
      {/* Порядок — как в DESKTOP_MORE_PATHS: по этому списку горит кнопка «Ещё». */}
      <NavLink to="/delay"><RadioTower size={18} /><span>{tr('Задержка излучателей', 'Nurlatgichlar kechikishi')}</span></NavLink>
      {/* Счётчика нет: home_summary расходы не считает, а журнал у каждого свой. */}
      <NavLink to="/expenses"><Receipt size={18} /><span>{tr('Производственные расходы', 'Ishlab chiqarish xarajatlari')}</span></NavLink>
      <NavLink to="/world"><MapIcon size={18} /><span>{tr('Мир', 'Dunyo')}</span></NavLink>
      {/* Локация одна на весь каталог, выбирать не из чего: строка осталась
          реквизитом склада. В полосе ей места нет — стоит подвалом меню. */}
      <p className="appbar__scope"><Warehouse size={16} /><span>{tr('Офис · Ташкент', 'Ofis · Toshkent')}</span></p>
    </div>
  )
}

// Нижний лист телефона: то, что на десктопе стоит в верхней полосе постоянно.
// Отдельный слой, а не выпадашка: панель навигации фиксирована у нижнего края,
// и попап пришлось бы позиционировать вручную поверх safe-area.
function MobileMoreSheet({ email, onSignOut, onClose }: { email: string; onSignOut: () => void; onClose: () => void }) {
  const { tr } = useLanguage()
  useModalLayer(onClose)
  // Свой взвод, а не полосы: лист закрылся — взвод ушёл вместе с ним.
  const signOutConfirm = useSignOutConfirm(onSignOut)

  return (
    <BottomSheet ariaLabel={tr('Ещё', 'Yana')} onClose={onClose}>
      <div className="sheet__header">
        <strong>{tr('Ещё', 'Yana')}</strong>
        <button autoFocus className="icon-button icon-button--bordered" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </div>
      {/* Тот же путь, что у быстрого действия верхней полосы: на телефоне её
          правый край скрыт, и одношаговый вход в сборку комплекта пропадал.
          Единственный красный значок листа — главное действие (V-17 макета). */}
      <Link className="sheet__action" to="/lists/new" onClick={onClose}>
        <span><ListPlus size={19} /></span>
        <div><strong>{tr('Новый список', 'Yangi ro‘yxat')}</strong><small>{tr('Собрать комплект', 'Jamlanma tuzish')}</small></div>
        <ArrowUpRight size={16} />
      </Link>
      {/* Разделы, которым нет слота в нижней панели (см. appbar__nav-extra).
          Значки серые: красный остаётся за «Новым списком». */}
      <nav className="sheet__nav" aria-label={tr('Другие разделы', 'Boshqa bo‘limlar')}>
        <NavLink to="/projects" onClick={onClose}><span><CalendarRange size={19} /></span>{tr('Мероприятия', 'Tadbirlar')}</NavLink>
        <NavLink to="/employees" onClick={onClose}><span><Users size={19} /></span>{tr('Сотрудники', 'Xodimlar')}</NavLink>
        <NavLink to="/vehicles" onClick={onClose}><span><CarFront size={19} /></span>{tr('Автомобили', 'Avtomobillar')}</NavLink>
        <NavLink to="/delay" onClick={onClose}><span><RadioTower size={19} /></span>{tr('Задержка излучателей', 'Nurlatgichlar kechikishi')}</NavLink>
        <NavLink to="/expenses" onClick={onClose}><span><Receipt size={19} /></span>{tr('Производственные расходы', 'Ishlab chiqarish xarajatlari')}</NavLink>
        <NavLink to="/world" onClick={onClose}><span><MapIcon size={19} /></span>{tr('Мир', 'Dunyo')}</NavLink>
      </nav>
      <div className="sheet__row">
        <span>{tr('Язык интерфейса', 'Interfeys tili')}</span>
        <LanguageSwitcher />
      </div>
      <div className="sheet__account">
        <span>{email}</span>
        <button
          className="button button--secondary"
          onClick={signOutConfirm.requestSignOut}
          onBlur={signOutConfirm.disarm}
          onMouseDown={(event) => { if (signOutConfirm.armed) event.preventDefault() }}
        ><LogOut size={16} />{signOutConfirm.armed
          ? tr('Да, выйти — несохранённое пропадёт', 'Ha, chiqish — saqlanmagan ish yo‘qoladi')
          : tr('Выйти', 'Chiqish')}</button>
      </div>
    </BottomSheet>
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
// вышестоящая корневая и унесёт навигацию.
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
