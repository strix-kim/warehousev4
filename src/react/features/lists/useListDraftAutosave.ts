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

// Автосейв черновика: пауза 1 с после последнего изменения.
//
// Работает в ОБОИХ режимах, но условие записи разное (U3-M, с13):
//   /lists/new        — пишем всё непустое; источника правды в базе ещё нет;
//   /lists/:id/edit   — пишем ТОЛЬКО расхождение с последним сохранённым
//                       состоянием, и стираем черновик, как только расхождение
//                       исчезло (сохранили или откатили руками).
//
// Черновик открытого списка НЕ пишет в базу — это правило продукта, а не
// экономия: «Сохранить» остаётся единственным, что меняет прод-данные. Молчаливая
// запись была бы вдвойне опасна, потому что RLS не ограничивает правку чужого
// списка ни владельцем, ни статусом.
//
// restoredRef — флаг «восстановление закончилось»: читается в момент срабатывания
// таймера, поэтому передаётся ссылкой.
export function useListDraftAutosave({ listId, restoredRef, isDirty, name, clientName, venue, description, eventDate, items }: {
  listId: string | undefined
  restoredRef: { current: boolean }
  isDirty: boolean
  name: string
  clientName: string
  venue: string
  description: string
  eventDate: string
  items: ListDraftItem[]
}) {
  useEffect(() => {
    if (!restoredRef.current) return
    const timer = window.setTimeout(() => {
      const draft: ListDraft = { name, clientName, venue, description, eventDate, items }
      // У открытого списка «пусто» ничего не значит: пустым он быть не может,
      // а вот совпадение с базой значит «сохранять нечего».
      const shouldStore = listId ? isDirty : !isDraftEmpty(draft)
      if (shouldStore) saveListDraft(draft, listId)
      else clearListDraft(listId)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [clientName, description, eventDate, isDirty, items, listId, name, restoredRef, venue])
}
