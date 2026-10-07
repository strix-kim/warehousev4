import { todayDateValue } from '../date'

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

export type ExportFileKind = 'equipment' | 'equipmentApproval' | 'staff' | 'vehicles' | 'expenses'

// Тип документа в имени — на языке самого документа: узбекский — латиницей,
// русский — кириллицей. Рабочий список и список на согласование обязаны
// различаться: иначе второй файл ложится в загрузки как «… (1)», и понять, где
// рабочий, а где с реквизитами, можно только открыв оба.
const KIND_LABELS: Record<ExportFileKind, { ru: string; uz: string; fallback: string }> = {
  equipment: { ru: 'Список_оборудования', uz: 'Uskunalar_royxati', fallback: 'equipment-list' },
  equipmentApproval: { ru: 'Список_оборудования_на_согласование', uz: 'Uskunalar_royxati_kelishuvga', fallback: 'equipment-list' },
  staff: { ru: 'Список_сотрудников', uz: 'Xodimlar_royxati', fallback: 'event' },
  vehicles: { ru: 'Список_автомобилей', uz: 'Avtomobillar_royxati', fallback: 'event' },
  expenses: { ru: 'Производственные_расходы', uz: 'Ishlab_chiqarish_xarajatlari', fallback: 'expenses' },
}

// Единая схема имени всех выгрузок: ARGOMEDIA_<Тип>_<Название>_<Дата>.xlsx.
// Пробелы в названии — подчёркивания, чтобы имя читалось одним словом в любом
// проводнике и не рвалось при пересылке. Нет даты — сегодняшняя: файл без даты
// в загрузках не отличить от прошлогоднего с тем же названием.
export function exportFileName({ kind, name, date, language }: {
  kind: ExportFileKind
  name: string
  date: string | null
  language: 'ru' | 'uz'
}) {
  const label = KIND_LABELS[kind]
  // Кавычки и слэши safeFileName заменяет дефисами, вокруг них стоят пробелы —
  // без склейки «Гала-ужин: "VIP" / зал» даёт «Гала-ужин-_-VIP-_-_зал».
  const title = safeFileName(name, label.fallback).replace(/ /g, '_').replace(/[-_]{2,}/g, '_')
  return `ARGOMEDIA_${label[language]}_${title}_${date || todayDateValue()}.xlsx`
}
