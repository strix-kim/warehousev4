import { useLocation, useNavigate, type To } from 'react-router-dom'
import { useLanguage } from './i18n'

// Путь, за которым пришёл неавторизованный пользователь: его кладёт в state
// гейт сессии (LoginRedirect в App.tsx). State истории правится из консоли, так
// что здесь он перепроверяется заново — уводить после входа можно только внутрь
// приложения, и `//host` внутренним не считается.
export function readReturnPath(value: unknown) {
  if (typeof value !== 'string') return null
  return value.startsWith('/') && !value.startsWith('//') ? value : null
}

// Маршрут мира: сцена живёт на /world и на главной. Сравнивается только путь —
// query (?zone=, ?lot=) у мира свой и на ответ не влияет.
function isWorldPath(path: string) {
  const pathname = path.split(/[?#]/)[0] ?? ''
  return pathname === '/' || pathname === '/world' || pathname.startsWith('/world/')
}

// Возврат из «интерьера» (тяжёлый экран на весь маршрут) туда, откуда пришли.
// Мир открывает интерьер push-переходом с state: { from } — путь мира с query.
// Есть такой from — кнопка «назад» возвращает в мир, нет — ведёт на прежний
// запасной адрес с прежней подписью: прямая ссылка, новая вкладка и переход из
// реестра state не несут и работают как раньше.
//
// Назад в мир — navigate(-1), а НЕ navigate(from): мир запоминает позу камеры по
// location.key своей записи истории и восстанавливает её только при возврате на
// ТУ ЖЕ запись. navigate(from) завёл бы новую запись с новым key — человек
// вернулся бы на участок, но с рабочего ракурса, а «назад» браузера повёл бы
// его обратно в интерьер. Отсюда же условие: запись мира должна лежать в
// истории сразу перед интерьером, поэтому переходы ВНУТРИ интерьера, которые
// обязаны сохранить возврат, делаются replace с state: location.state.
// Сам from никуда не подставляется: он только отвечает на вопрос «пришли из
// мира?», и проверяется так же строго, как путь возврата после входа.
//
// POP-переход ловит тот же блокер несохранённого, что и обычный (useBlocker в
// data router откатывает history.go и ждёт ответа плашки) — защита форм не
// обходится.
export function useReturnTo(fallback: To, fallbackLabel: string) {
  const navigate = useNavigate()
  const location = useLocation()
  const { tr } = useLanguage()
  const from = readReturnPath((location.state as { from?: unknown } | null)?.from)
  const fromWorld = from !== null && isWorldPath(from)

  function goBack() {
    if (fromWorld) navigate(-1)
    else navigate(fallback)
  }

  return {
    fromWorld,
    label: fromWorld ? tr('Назад в мир', 'Dunyoga qaytish') : fallbackLabel,
    goBack,
  }
}
