import { useEffect } from 'react'
import { clearListDraft, saveListDraft, type ListDraft, type ListDraftItem } from './api'

// «Пустой» черновик не хранится и стирает уже записанный: иначе один заход на
// /lists/new без единого действия подсовывал бы плашку «черновик восстановлен».
// Мероприятие считается работой, только если в него что-то ВНЕСЛИ: у нового —
// набранный реквизит (дата не в счёт, у неё дефолт есть всегда), у существующего
// — правка реквизитов. Просто выбранное мероприятие — не работа: с ним редактор
// открывает ссылка /lists/new?project=…, и один такой заход черновика не заводит.
function isProjectUntouched(project: ListDraft['project']) {
  if (!project) return true
  if (project.id) return !project.edited
  return !project.name.trim() && !project.clientName.trim() && !project.venue
}

function isDraftEmpty(draft: ListDraft) {
  return draft.items.length === 0
    && !draft.description.trim()
    && !draft.name.trim()
    && isProjectUntouched(draft.project)
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
export function useListDraftAutosave({ listId, restoredRef, isDirty, name, description, project, items }: {
  listId: string | undefined
  restoredRef: { current: boolean }
  isDirty: boolean
  name: string
  description: string
  project: ListDraft['project']
  items: ListDraftItem[]
}) {
  useEffect(() => {
    if (!restoredRef.current) return
    const timer = window.setTimeout(() => {
      const draft: ListDraft = { name, description, project, items }
      // У открытого списка «пусто» ничего не значит: пустым он быть не может,
      // а вот совпадение с базой значит «сохранять нечего».
      const shouldStore = listId ? isDirty : !isDraftEmpty(draft)
      if (shouldStore) saveListDraft(draft, listId)
      else clearListDraft(listId)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [description, isDirty, items, listId, name, project, restoredRef])
}
