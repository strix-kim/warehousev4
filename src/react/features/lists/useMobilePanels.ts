import { useRef, useState } from 'react'

// Высота липкой полосы табов на телефоне (8 сверху + кнопка 44 + 4 снизу + рамка 1).
// Держится в паре с .mobile-editor-tabs и .quick-catalog-toolbar в styles.css:
// разъедется — таб «В списке» снова приземлится под срезанным заголовком.
const MOBILE_TABS_HEIGHT = 57

// Две вкладки редактора на телефоне: каталог и выборка.
export function useMobilePanels() {
  const [mobilePanel, setMobilePanel] = useState<'catalog' | 'selection'>('catalog')
  const catalogRef = useRef<HTMLElement>(null)
  const selectionRef = useRef<HTMLElement>(null)
  // Прокрутка каждой вкладки телефона на момент ухода с неё: возврат в каталог
  // приводит к той же модели, а не к первой.
  const panelScrollRef = useRef<Partial<Record<'catalog' | 'selection', number>>>({})

  function moveToMobilePanel(panel: 'catalog' | 'selection') {
    const switching = panel !== mobilePanel
    if (switching) panelScrollRef.current[mobilePanel] = window.scrollY
    setMobilePanel(panel)
    window.requestAnimationFrame(() => {
      // Вкладка уже открывалась — возвращаемся туда, где с неё ушли. Повторное
      // нажатие на активную вкладку — к её заголовку, как и первое открытие.
      const remembered = switching ? panelScrollRef.current[panel] : undefined
      if (remembered !== undefined) {
        window.scrollTo({ top: remembered })
        return
      }
      const target = panel === 'catalog' ? catalogRef.current : selectionRef.current
      if (!target) return
      // scrollIntoView прижимал панель к самому верху окна — липкие табы накрывали
      // её заголовок. Скроллим руками, оставляя ровно высоту полосы табов.
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - MOBILE_TABS_HEIGHT, behavior: 'smooth' })
    })
  }

  return { mobilePanel, moveToMobilePanel, catalogRef, selectionRef }
}
