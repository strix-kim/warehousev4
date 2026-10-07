// Состав мероприятия со стороны людей: отмеченных в реестре сотрудников
// дописываем в project_staff. Реквизиты мероприятия (projects) пишет
// features/projects — здесь только связка «человек на мероприятии».

import { supabase } from '../../lib/supabase'
import { invalidateProjectCounters } from '../projects/cacheKeys'
import type { Tr } from './types'

// Только ДОБАВЛЕНИЕ: дровер реестра не знает, кого с мероприятия сняли бы, —
// убирают людей на странице мероприятия.
// upsert с ignoreDuplicates: человек мог уже быть в составе (его добавили раньше
// или из другой вкладки), и 23505 по project_staff_member_key в ответ на «и так
// уже в составе» был бы ложной ошибкой. Заранее состав клиент не читает и дубли
// не отсеивает — правило «один раз» держит индекс.
// defaultToNull: false — это Prefer: missing=default. Без него пачечная вставка
// подставляет NULL в НЕ переданный created_by, а политика вставки требует
// created_by = auth.uid(): строка отлетела бы по RLS (та же грабля, что у
// saveVehicleDrivers).
export async function addEmployeesToProject(projectId: string, employeeIds: string[]): Promise<void> {
  if (!supabase) throw new Error('Supabase не настроен')
  if (employeeIds.length === 0) return
  const { error } = await supabase
    .from('project_staff')
    .upsert(employeeIds.map((employeeId) => ({ project_id: projectId, employee_id: employeeId })), {
      onConflict: 'project_id,employee_id',
      ignoreDuplicates: true,
      defaultToNull: false,
    })
  if (error) throw error
  // Реестр мероприятий показывает число людей в составе.
  invalidateProjectCounters()
}

// Сколько людей в составе уже есть. head: строки не едут, только счёт — id
// состава дроверу реестра не нужны. Мимо кэша: число нужно на сейчас.
export async function fetchProjectStaffCount(projectId: string): Promise<number> {
  if (!supabase) throw new Error('Supabase не настроен')
  const { count, error } = await supabase
    .from('project_staff')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  if (error) throw error
  return count ?? 0
}

// Отказ записи состава человеческой фразой. 23503 разбираем именем внешнего
// ключа: «мероприятие удалили» и «сотрудника удалили» лечатся по-разному.
export function rosterErrorText(error: unknown, tr: Tr): string {
  const candidate = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; message?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''

  if (code === '23503' && message.includes('project_staff_project_id_fkey')) {
    return tr('Этого мероприятия больше нет — его удалили. Выберите другое.', 'Bu tadbir endi yo‘q — u o‘chirilgan. Boshqasini tanlang.')
  }
  if (code === '23503' && message.includes('project_staff_employee_id_fkey')) {
    return tr('Кого-то из отмеченных сотрудников уже удалили. Обновите страницу и отметьте заново.', 'Belgilangan xodimlardan kimdir allaqachon o‘chirilgan. Sahifani yangilab, qayta belgilang.')
  }
  if (code === '23503') {
    return tr('Мероприятие или сотрудника успели удалить. Обновите страницу и повторите.', 'Tadbir yoki xodim o‘chirib yuborilgan. Sahifani yangilab, qayta urinib ko‘ring.')
  }
  if (code === '42501') {
    return tr('Недостаточно прав: состав мероприятия ведут техники, менеджеры и администраторы.', 'Huquq yetarli emas: tadbir tarkibini texniklar, menejerlar va administratorlar yuritadi.')
  }
  return tr('Не удалось сохранить состав. Проверьте интернет и повторите попытку.', 'Tarkibni saqlab bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.')
}
