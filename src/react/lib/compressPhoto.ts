// Фото с телефона весит 4–8 МБ, а бакет держит потолок 10 МБ на файл и белый
// список типов (jpeg/png/webp/pdf). Ужимаем в браузере: у сотрудника фото — это
// портрет для опознания, а не исходник для печати.
//
// Сканы и PDF через это НЕ проходят: мелкий шрифт в паспорте от пережатия
// становится нечитаемым, а PDF браузер декодировать и не умеет.

const MAX_SIDE = 1600
const JPEG_QUALITY = 0.85

export type CompressOptions = {
  maxSide?: number
  quality?: number
}

export type CompressResult =
  // width/height — размеры уже сжатого кадра: вызывающему они нужны, чтобы
  // посчитать место под картинку, не декодируя файл второй раз.
  | { status: 'ok'; file: File; width: number; height: number }
  // Декодировать не удалось. Самый частый случай — HEIC с айфона на десктопе:
  // Safari его открывает, Chrome и Firefox — нет.
  | { status: 'unsupported' }

function jpegName(name: string) {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base || 'photo'}.jpg`
}

export async function compressPhoto(file: File, options?: CompressOptions): Promise<CompressResult> {
  const maxSide = options?.maxSide ?? MAX_SIDE
  const quality = options?.quality ?? JPEG_QUALITY
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { status: 'unsupported' }
  }

  try {
    // Уменьшаем только вниз: апскейл маленькой фотографии добавил бы вес, а не
    // качество.
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return { status: 'unsupported' }
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return { status: 'unsupported' }
    return { status: 'ok', file: new File([blob], jpegName(file.name), { type: 'image/jpeg' }), width, height }
  } finally {
    // Битмап держит декодированный кадр в памяти — на пачке фотографий это
    // десятки мегабайт, и сборщик до них доберётся не сразу.
    bitmap.close()
  }
}
