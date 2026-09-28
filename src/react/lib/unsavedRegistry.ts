// Реестр охраняемого несохранённого ввода: форма или дровер с поднятой защитой
// (useNavigationGuard с active) держат здесь свой токен. Нужен тем, кто уводит
// пользователя МИМО роутера и beforeunload, — выходу из системы: форма просто
// размонтируется, и ни блокер, ни диалог браузера её не спросят.
//
// Подписки нет намеренно: спрашивают в момент нажатия, а не рисуют по нему.
const activeGuards = new Set<object>()

// Возвращает снятие регистрации — ровно для cleanup эффекта.
export function registerUnsavedWork(): () => void {
  const token = {}
  activeGuards.add(token)
  return () => {
    activeGuards.delete(token)
  }
}

export function hasUnsavedWork() {
  return activeGuards.size > 0
}
