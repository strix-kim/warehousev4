import { ArrowUpRight, Boxes, ClipboardList, Clock3, Plus, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../../lib/i18n'

export function HomePage() {
  const { tr } = useLanguage()

  return (
    <section className="home-page">
      <header className="home-page__header">
        <p className="eyebrow">ARGO WAREHOUSE</p>
        <h1>{tr('Что нужно сделать?', 'Nima qilish kerak?')}</h1>
        <p>{tr('Выберите рабочий раздел — без лишних промежуточных экранов.', 'Kerakli ish bo‘limini tanlang — ortiqcha oraliq ekranlarsiz.')}</p>
      </header>

      <div className="home-destinations">
        {/* Плитка — <article>, а не <a>: подпись-действие ведёт своим адресом, а вложить
            ссылку в ссылку нельзя. Тело плитки кликается растянутой .home-destination__link. */}
        <article className="home-destination home-destination--equipment">
          <img className="home-destination__art home-destination__art--equipment" src="/illustrations/av-warehouse.webp" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
          <Link className="home-destination__link" to="/equipment">
            <span className="home-destination__icon"><Boxes size={34} /></span>
            <span className="home-destination__arrow"><ArrowUpRight size={24} /></span>
            <span className="eyebrow">{tr('Склад и карточки', 'Ombor va kartalar')}</span>
            <strong>{tr('Оборудование', 'Uskunalar')}</strong>
            <p>{tr('Найти технику, проверить количество, серийный номер, описание и расположение.', 'Uskunani topish, miqdor, seriya raqami, tavsif va joylashuvni tekshirish.')}</p>
            {/* Каталогу отдельная цель не нужна — действие совпадает с самой плиткой */}
            <span className="home-destination__action">{tr('Открыть каталог', 'Katalogni ochish')} <ArrowUpRight size={16} /></span>
          </Link>
        </article>

        <article className="home-destination home-destination--lists">
          <img className="home-destination__art home-destination__art--lists" src="/illustrations/equipment-kit.webp" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
          <Link className="home-destination__link" to="/lists">
            <span className="home-destination__icon"><ClipboardList size={34} /></span>
            <span className="home-destination__arrow"><ArrowUpRight size={24} /></span>
            <span className="eyebrow">{tr('Быстрый документ', 'Tezkor hujjat')}</span>
            <strong>{tr('Списки оборудования', 'Uskunalar ro‘yxatlari')}</strong>
            <p>{tr('Быстро собрать комплект, указать количество и скачать готовый Excel.', 'Jamlanmani tez yig‘ish, miqdorni ko‘rsatish va tayyor Excelni yuklash.')}</p>
          </Link>
          <Link className="home-destination__action" to="/lists/new"><Plus size={16} /> {tr('Создать список', 'Ro‘yxat yaratish')}</Link>
        </article>

        <article className="home-destination home-destination--employees home-destination--coming-soon" aria-label={tr('Сотрудники — раздел готовится', 'Xodimlar — bo‘lim tayyorlanmoqda')}>
          <img className="home-destination__art home-destination__art--employees" src="/illustrations/av-team.webp" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
          <span className="home-destination__icon"><UsersRound size={34} /></span>
          <span className="home-destination__status">{tr('Скоро', 'Tez orada')}</span>
          <span className="eyebrow">{tr('Команда на площадке', 'Maydondagi jamoa')}</span>
          <strong>{tr('Сотрудники', 'Xodimlar')}</strong>
          <p>{tr('Составлять списки сотрудников и назначать специалистов на точки монтажа.', 'Xodimlar ro‘yxatini tuzish va mutaxassislarni montaj nuqtalariga biriktirish.')}</p>
          <span className="home-destination__action"><Clock3 size={16} /> {tr('Раздел готовится', 'Bo‘lim tayyorlanmoqda')}</span>
        </article>
      </div>
    </section>
  )
}
