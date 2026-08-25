import {
  AudioLines,
  BriefcaseBusiness,
  Cable,
  HardDrive,
  Languages,
  Mic2,
  Monitor,
  Network,
  PackageOpen,
  Radio,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
// normalize и equipmentImageKey приходят из сгенерированного модуля: их исходник
// эмитит scripts/fetch-equipment-images.mjs тем же кодом, которым именует файлы
// в манифесте. Своей копии контракта у компонента больше нет.
import { equipmentImageKey, equipmentImages, normalize } from '../generated/equipmentImages'

export type EquipmentVisualData = {
  brand: string
  model: string
  type?: string | null
  subtype?: string | null
}

const loadedImageSources = new Set<string>()
const pendingImageSources = new Map<string, Promise<void>>()
const imageRatios = new Map<string, number>()

export function getEquipmentImageSrc(item: EquipmentVisualData) {
  return equipmentImages[equipmentImageKey(item.brand, item.model)]
}

export function preloadEquipmentImages(items: EquipmentVisualData[], limit = 24) {
  if (typeof Image === 'undefined') return
  const sources = [...new Set(items.map(getEquipmentImageSrc).filter((value): value is string => Boolean(value)))].slice(0, limit)

  for (const source of sources) {
    if (loadedImageSources.has(source) || pendingImageSources.has(source)) continue
    const request = new Promise<void>((resolve) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        loadedImageSources.add(source)
        if (image.naturalWidth > 0 && image.naturalHeight > 0) imageRatios.set(source, image.naturalWidth / image.naturalHeight)
        resolve()
      }
      image.onerror = () => resolve()
      image.src = source
    }).finally(() => pendingImageSources.delete(source))
    pendingImageSources.set(source, request)
  }
}

function categoryIcon(item: EquipmentVisualData): LucideIcon {
  const value = normalize(`${item.type ?? ''} ${item.subtype ?? ''}`)
  if (/кабел|адаптер|переходник|коммутац/.test(value)) return Cable
  if (/микроф/.test(value)) return Mic2
  if (/перевод|конференц|делегат|пульт/.test(value)) return Languages
  if (/передатчик|приемник|радиосистем/.test(value)) return Radio
  if (/аудио|акуст|микшер/.test(value)) return AudioLines
  if (/видео|камер|ptz|объектив|рекордер/.test(value)) return Video
  if (/сетев|wi fi|роутер|коммутатор|sfp/.test(value)) return Network
  if (/ssd|хранени|накопител|диск/.test(value)) return HardDrive
  if (/компьют|ноутбук|монитор|перифер|pci/.test(value)) return Monitor
  if (/транспорт|кейс|сумк|катуш|стойк/.test(value)) return BriefcaseBusiness
  return PackageOpen
}

// Значок категории без витрины: шапка карточки-профиля (ProfileHead) рисует
// плейсхолдер сама и ждёт готовый узел, а картинку модели берёт из
// getEquipmentImageSrc. Своей копии выбора значка у неё быть не должно — правило
// категорий одно на проект и живёт здесь.
export function EquipmentIcon({ item, size = 24 }: { item: EquipmentVisualData; size?: number }) {
  const Icon = categoryIcon(item)
  return <Icon size={size} aria-hidden="true" />
}

export function EquipmentVisual({ item, size = 'compact', alt = '' }: {
  item: EquipmentVisualData
  size?: 'compact' | 'large'
  alt?: string
}) {
  const image = getEquipmentImageSrc(item)
  const [hasImageError, setHasImageError] = useState(false)
  const [isImageLoaded, setIsImageLoaded] = useState(() => Boolean(image && loadedImageSources.has(image)))
  const [imageRatio, setImageRatio] = useState<number | null>(() => image ? imageRatios.get(image) ?? null : null)
  const Icon = categoryIcon(item)

  useEffect(() => {
    setHasImageError(false)
    setIsImageLoaded(Boolean(image && loadedImageSources.has(image)))
    setImageRatio(image ? imageRatios.get(image) ?? null : null)
  }, [image])

  const largeImageStyle = size === 'large' && imageRatio
    ? {
        '--equipment-image-ratio': imageRatio,
        '--equipment-image-width': `${Math.round(Math.min(520, Math.max(180, imageRatio * 260)))}px`,
      } as CSSProperties
    : undefined

  return (
    <span className={`equipment-thumb equipment-thumb--${size} ${image && !hasImageError ? 'equipment-thumb--photo' : ''} ${isImageLoaded ? 'equipment-thumb--ready' : ''}`} style={largeImageStyle}>
      <span className="equipment-thumb__placeholder"><Icon size={size === 'large' ? 34 : 19} aria-hidden="true" /></span>
      {image && !hasImageError && (
        <img
          src={image}
          alt={alt}
          loading={size === 'large' ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={size === 'large' ? 'high' : 'auto'}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget
            loadedImageSources.add(image)
            setIsImageLoaded(true)
            if (naturalWidth > 0 && naturalHeight > 0) {
              const ratio = naturalWidth / naturalHeight
              imageRatios.set(image, ratio)
              setImageRatio(ratio)
            }
          }}
          onError={() => {
            setHasImageError(true)
            setIsImageLoaded(false)
          }}
        />
      )}
    </span>
  )
}
