import { useLayoutEffect, type RefObject } from 'react'

// Честная высота сетки редактора. Всё, что стоит над сеткой, плюс нижний отступ
// страницы пишется в CSS-переменную --editor-chrome, от которой styles.css считает
// clamp(420px, 100dvh − chrome, 900px). Константа в CSS (409 в с8, 246 по аудиту)
// врала при любом баннере над сеткой («черновик восстановлен», «список не открыт»)
// и при раскрытой панели реквизитов — измерение делает формулу верной по построению.
// Позиция берётся через цепочку offsetTop, а не getBoundingClientRect: у шапки и
// сетки анимация появления с transform, и прямоугольник на первом кадре сдвинут.
// На телефоне и планшете сетка высоты не имеет — переменная просто не читается.
export function useEditorChrome(gridRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const grid = gridRef.current
    const content = grid?.parentElement
    if (!grid || !content) return

    const measure = () => {
      // offsetTop отсчитывается от ВНУТРЕННЕЙ рамки offsetParent: рамок у body,
      // .app-shell и .app-content нет, появится — замер уедет на их толщину.
      let top = 0
      for (let node: HTMLElement | null = grid; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop
      const bottom = parseFloat(getComputedStyle(content).paddingBottom) || 0
      // Пишем только при изменении: высота сетки стоит ровно на пороге появления
      // вертикального скроллбара, а его приход меняет ширину соседей и будит
      // ResizeObserver — без этой проверки петля «замер → скроллбар → замер».
      const next = `${Math.round(top + bottom)}px`
      if (grid.style.getPropertyValue('--editor-chrome') !== next) grid.style.setProperty('--editor-chrome', next)
    }

    // Наблюдать сам контейнер страницы нельзя: он растянут оболочкой на высоту окна
    // и не меняет размер, когда реквизиты раскрываются. Наблюдаем соседей сетки;
    // баннеры появляются и исчезают — список соседей пересобирается по childList.
    const resize = new ResizeObserver(measure)
    const watchSiblings = () => {
      resize.disconnect()
      for (const child of content.children) if (child !== grid) resize.observe(child)
    }
    const mutation = new MutationObserver(() => { watchSiblings(); measure() })
    mutation.observe(content, { childList: true })
    watchSiblings()
    measure()
    window.addEventListener('resize', measure)

    return () => {
      mutation.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [gridRef])
}
