import { useLanguage } from '../../lib/i18n'

// ЗАГЛУШКА шага 5: маршруты /vehicles/new и /vehicles/:vehicleId/edit заведены
// сейчас, чтобы кнопки списка и дровера вели не в 404. Форму пишет шаг 6 —
// этот файл он заменяет целиком.
export function VehicleFormPage() {
  const { tr } = useLanguage()

  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{tr('Транспорт', 'Transport')}</p>
        <h1>{tr('Форма машины — в работе', 'Mashina shakli — ishlab chiqilmoqda')}</h1>
        <p className="page-description">{tr('Раздел уже читает базу; создание и правка карточки появятся следующим шагом.', 'Bo‘lim allaqachon bazani o‘qiydi; kartani yaratish va tahrirlash keyingi bosqichda paydo bo‘ladi.')}</p>
      </div>
    </header>
  )
}
