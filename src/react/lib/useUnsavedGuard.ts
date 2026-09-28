import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router-dom'

// Защита несохранённого ввода. Два канала, потому что уход бывает двух родов:
// переход внутри приложения ловит роутер (useBlocker), а перезагрузку и закрытие
// вкладки — только браузер (beforeunload). Вызывающий передаёт в active
// «есть несохранённое И сейчас не сохраняем»: навигация после успешного
// сохранения идёт при поднятом isSaving и проходит без вопроса, а провал снимает
// isSaving в finally — и защита включается снова.
//
// ИНВАРИАНТ: на экране ОДИН охраняемый компонент — форма ИЛИ дровер. Роутер
// держит один блокер: useBlocker регистрируется самим маунтом, независимо от
// active, и при двух смонтированных роутер спрашивает только последний, а
// первый молча не работает (в разработке — предупреждение в консоль). Поэтому
// страница-хозяин дровера защиту не ставит — её ставит сам дровер.

// Закрытие и перезагрузка вкладки. Текст диалога свой у каждого браузера,
// задать его нельзя.
export function useUnloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
    const warnOnUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Хвост для Chrome/Edge младше 119: они не смотрят на preventDefault, а
      // диалог показывают, только если returnValue стал НЕ пустой строкой
      // (пустая — его же значение по умолчанию, то есть присвоение впустую).
      event.returnValue = true
    }
    window.addEventListener('beforeunload', warnOnUnload)
    return () => window.removeEventListener('beforeunload', warnOnUnload)
  }, [active])
}

// Переход внутри приложения. Заблокированный «назад» браузера роутер откатывает
// сам — адрес возвращается к форме, и решение остаётся за плашкой.
export function useNavigationGuard(active: boolean) {
  // Колбэк блокера стабилен, а свежее active читается из ref: навигация после
  // сохранения вызывается из async-функции, и важно то, что УЖЕ отрисовано
  // (isSaving поднят), а не то, что замкнул колбэк прошлого рендера.
  // useLayoutEffect, а не useEffect: ref обновляется сразу после коммита, до
  // любого следующего клика.
  const activeRef = useRef(active)
  useLayoutEffect(() => {
    activeRef.current = active
  })

  // search сравнивается наравне с pathname: дроверы открываются через ?item=, и
  // закрытие дровера — это смена одного search.
  const shouldBlock = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => (
    activeRef.current
    && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  ), [])
  const blocker = useBlocker(shouldBlock)

  // Пока плашка висела, несохранённое исчезло (например, нажали «Сохранить») —
  // вопрос больше не актуален, переход отменяем и плашку снимаем.
  useEffect(() => {
    if (blocker.state === 'blocked' && !active) blocker.reset()
  }, [active, blocker])

  const leave = useCallback(() => blocker.proceed?.(), [blocker])
  const stay = useCallback(() => blocker.reset?.(), [blocker])

  // Свой уход мимо блокера: на вопрос уже ответили «без сохранения», а уход
  // сам оказался переходом — дровер оборудования живёт в адресе (?item=), и его
  // закрытие есть setParams. Роутер спрашивает блокер синхронно, внутри
  // navigate, — до рендера, в котором activeRef погас бы сам; без обхода дровер
  // заблокировал бы собственное закрытие. Защита снимается ровно на время
  // вызова: navigate(-1) так не пройдёт (его проверка — на popstate, позже).
  const bypass = useCallback((action: () => void) => {
    const wasActive = activeRef.current
    activeRef.current = false
    try {
      action()
    } finally {
      activeRef.current = wasActive
    }
  }, [])

  return { isBlocked: blocker.state === 'blocked', leave, stay, bypass }
}

export function useUnsavedGuard(active: boolean) {
  useUnloadWarning(active)
  return useNavigationGuard(active)
}
