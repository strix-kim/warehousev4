import { useEffect } from 'react'
import { clearListDraft, saveListDraft, type ListDraft, type ListDraftItem } from './api'

// «Пустой» черновик не хранится и стирает уже записанный: иначе один заход на
// /lists/new без единого действия подсовывал бы плашку «черновик восстановлен».
// Дата в проверку не входит — у неё дефолт есть всегда. Реквизиты сравнивать не
// с чем: подставленных значений у полей больше нет, нетронутое поле просто пусто.
function isDraftEmpty(draft: ListDraft) {
  return draft.items.length === 0
    && !draft.description.trim()
    && !draft.name.trim()
    && !draft.clientName.trim()
    && !draft.venue.trim()
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
