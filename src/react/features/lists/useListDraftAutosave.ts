import { useEffect } from 'react'
import { listDocumentDefaults } from './documentDefaults'
import { clearListDraft, saveListDraft, type ListDraft, type ListDraftItem } from './api'

// Реквизит считается нетронутым, если он пуст или совпадает с дефолтом ЛЮБОГО из
// языков: пользователь мог переключить язык, не притронувшись к полю.
function isDefaultDocumentValue(value: string, field: 'name' | 'clientName' | 'venue') {
  const trimmed = value.trim()
  return !trimmed || Object.values(listDocumentDefaults).some((item) => item[field] === trimmed)
}

// «Пустой» черновик не хранится и стирает уже записанный: иначе один заход на
// /lists/new без единого действия подсовывал бы плашку «черновик восстановлен».
// Дата в проверку не входит — у неё дефолт есть всегда.
function isDraftEmpty(draft: ListDraft) {
  return draft.items.length === 0
    && !draft.description.trim()
    && isDefaultDocumentValue(draft.name, 'name')
    && isDefaultDocumentValue(draft.clientName, 'clientName')
    && isDefaultDocumentValue(draft.venue, 'venue')
}

// Автосейв черновика: пауза 1 с после последнего изменения. Режим
// редактирования сюда не заходит — там «сохранить» пишет в базу.
// restoredRef — тот же флаг «восстановление закончилось», что и в редакторе:
// читается в момент срабатывания таймера, поэтому передаётся ссылкой.
export function useListDraftAutosave({ listId, restoredRef, name, clientName, venue, description, eventDate, items }: {
  listId: string | undefined
  restoredRef: { current: boolean }
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string
  items: ListDraftItem[]
}) {
  useEffect(() => {
    if (listId || !restoredRef.current) return
    const timer = window.setTimeout(() => {
      const draft: ListDraft = { name, clientName, venue, description, eventDate, items }
      if (isDraftEmpty(draft)) clearListDraft()
      else saveListDraft(draft)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [clientName, description, eventDate, items, listId, name, restoredRef, venue])
}
