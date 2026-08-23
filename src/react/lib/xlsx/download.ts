// Отдача готового файла пользователю: временная ссылка на Blob, клик по ней и
// освобождение адреса. Секунда до revoke — запас на то, чтобы браузер успел
// начать саму загрузку.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Имя файла без символов, запрещённых файловыми системами. Пустой результат
// заменяется фолбэком — иначе получилось бы имя из одного расширения.
export function safeFileName(value: string, fallback = 'equipment-list') {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || fallback
}
