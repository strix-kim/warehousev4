// Перезагрузка после выкатки висит на пути lazy, а не на глобальном vite:preloadError:
// глобальный слушатель срабатывает и на прогрев модулей (App.tsx), и перезагрузил бы
// вкладку под человеком, который прямо сейчас заполняет /equipment/new. Здесь же
// провал означает, что человек ТОЛЬКО ЧТО нажал на раздел и ещё ничего не набрал.
import { lazy, type ComponentType } from 'react'
import { reportAppError } from './reportAppError'

const RELOAD_KEY = 'argo:chunk-reload-at'
const RELOAD_COOLDOWN_MS = 60_000

// Метка — таймштамп, а не булев флаг: флаг потратился бы на первой же выкатке дня,
// и вторая выкатка досталась бы человеку экраном ошибки. Таймштамп даёт по одной
// перезагрузке на каждую минуту, а не одну на всю сессию вкладки.
function consumeReloadBudget(): boolean {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_KEY)
    const lastAt = raw ? Number(raw) : 0
    // Сравниваем метку с моментом старта ДОКУМЕНТА, а не с моментом отказа: чанк
    // умеет провалиться и через десять минут после загрузки (висящий коннект), и от
    // Date.now() бюджет к тому времени всегда выглядел бы свободным — вкладка ушла бы
    // в бесконечный круг перезагрузок. Метка, поставленная перед прошлой
    // перезагрузкой, всегда впритык к timeOrigin текущего документа.
    if (Number.isFinite(lastAt) && performance.timeOrigin - lastAt < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
    return true
  } catch {
    // sessionStorage умеет бросать (приватный режим Safari, запрет хранилища).
    // Без памяти о прошлой попытке перезагрузка стала бы бесконечным циклом,
    // поэтому отказ в бюджете: экран ошибки лучше, чем мигающая вкладка.
    return false
  }
}

// Сигнатура один в один с React.lazy: any в ограничении — её собственный, сузить его
// нельзя, иначе компонент с любыми пропсами перестанет подходить под T.
export function lazyWithReload<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(() => loader().catch((error: unknown) => {
    reportAppError(error, { scope: 'chunk', route: window.location.pathname })
    // Без сети перезагрузка не чинит ничего: чанк провалился не потому, что его
    // сменила выкатка, а потому что сети нет (прогрев провалился офлайн, человек
    // нажал на раздел позже). reload() убил бы вкладку вместе с кэшем и показал
    // браузерное «нет интернета»; граница хотя бы оставит приложение живым.
    if (!navigator.onLine) throw error
    // Бюджет исчерпан — значит перезагрузка уже была и не помогла: отдаём ошибку
    // границе (AppErrorBoundary), она покажет экран с кнопкой.
    if (!consumeReloadBudget()) throw error

    window.location.reload()
    // Промис, который не резолвится НИКОГДА, — это не заглушка, а требование:
    // reload() уводит страницу не мгновенно, и за оставшиеся ~100 мс React успел бы
    // отрисовать экран ошибки или прочитать .default у undefined. Вечно висящий
    // промис держит скелет Suspense до самой навигации.
    return new Promise<{ default: T }>(() => {})
  }))
}
