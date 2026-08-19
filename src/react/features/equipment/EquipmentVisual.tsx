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
import { equipmentImages } from '../../generated/equipmentImages'

export type EquipmentVisualData = {
  brand: string
  model: string
  type?: string | null
  subtype?: string | null
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('ru')
    .normalize('NFKD')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function imageKey(item: EquipmentVisualData) {
  return `${normalize(item.brand)}::${normalize(item.model)}`
}

const loadedImageSources = new Set<string>()
const pendingImageSources = new Map<string, Promise<void>>()
const imageRatios = new Map<string, number>()

export function getEquipmentImageSrc(item: EquipmentVisualData) {
  return equipmentImages[imageKey(item)]
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
