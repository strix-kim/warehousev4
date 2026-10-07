import { Users } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { useLanguage } from '../../lib/i18n'

// Блок «Состав» на странице мероприятия. В шаге 4 — заглушка: рамка блока,
// место под счётчик и пустое состояние. Наполнение (добавить через
// EmployeePicker, убрать, счётчик, «Скачать Excel») — шаг 5а плана event-s53, и
// приходит оно СЮДА: блок отдельным компонентом, чтобы дописать его, не трогая
// страницу. Данные блок будет грузить сам по projectId — состав с паспортами не
// кэшируется и странице не нужен.
export function ProjectStaffSection({ projectId: _projectId }: { projectId: string }) {
  const { tr } = useLanguage()

  return (
    <section className="data-panel project-section">
      <header className="project-section__head">
        <h2>{tr('Состав', 'Tarkib')}</h2>
        {/* Место счётчика: шаг 5а кладёт сюда <span className="project-section__count">. */}
      </header>
      <EmptyState
        icon={<Users size={27} />}
        title={tr('Состав пока не собран', 'Tarkib hali yig‘ilmagan')}
        text={tr('Здесь будут сотрудники, которые едут на мероприятие, и выгрузка списка в Excel.', 'Bu yerda tadbirga boradigan xodimlar va ro‘yxatni Excelga yuklash bo‘ladi.')}
      />
    </section>
  )
}
