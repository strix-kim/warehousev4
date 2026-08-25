import { useEffect, useState, type ReactNode } from 'react'

// Адреса, которые браузер уже показал в этой вкладке. Без реестра фото
// проявлялось бы заново на каждый возврат в раздел: картинка приезжает из кэша
// браузера мгновенно, onLoad всё равно срабатывает, и анимация появления
// отыгрывала бы на готовом изображении — то самое мигание, ради которого её и
// заводили. Тот же приём, что у витрины оборудования (EquipmentVisual).
const shownPhotos = new Set<string>()

// Миниатюра-фотография строки: сотрудник, машина. Геометрию задаёт вызывающий
// своим классом (`employee-avatar` — кружок 36 px), здесь только появление:
// плейсхолдер до загрузки и плавный выход картинки поверх него. Свою рамку и
// размеры компонент не назначает намеренно — иначе на каждый новый размер
// пришлось бы заводить модификатор здесь.
export function PhotoThumb({ url, placeholder, className = '', alt = '' }: {
  // undefined — фото нет вовсе (или ссылка ещё не подписана): виден плейсхолдер.
  url?: string
  placeholder: ReactNode
  className?: string
  alt?: string
}) {
  const [isShown, setIsShown] = useState(() => Boolean(url && shownPhotos.has(url)))
  // Битая ссылка (протухла, файл удалён) — не повод показать пустой квадрат:
  // возвращаемся к плейсхолдеру, как будто фото и не было.
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
    setIsShown(Boolean(url && shownPhotos.has(url)))
  }, [url])

  function markShown() {
    if (!url) return
    shownPhotos.add(url)
    setIsShown(true)
  }

  return (
    <span className={`${className} photo-thumb ${isShown ? 'photo-thumb--ready' : ''}`.trim()}>
      <span className="photo-thumb__placeholder">{placeholder}</span>
      {url && !hasError && (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          // Картинка из кэша браузера успевает загрузиться ДО того, как React
          // повесит onLoad, и событие не приходит вовсе. Ref-колбэк выполняется
          // в коммите и такой снимок ловит: complete без naturalWidth — это
          // ошибка загрузки, а не готовая картинка.
          ref={(node) => { if (node?.complete && node.naturalWidth > 0) markShown() }}
          onLoad={markShown}
          onError={() => { setHasError(true); setIsShown(false) }}
        />
      )}
    </span>
  )
}
