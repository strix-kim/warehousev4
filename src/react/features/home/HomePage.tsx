import { ArrowUpRight, Boxes, CarFront, ClipboardList, Plus, Presentation, UsersRound } from 'lucide-react'
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

      {/* Два яруса, а не пять равных плиток (с25). Верхний — то, ради чего сюда
          заходят каждый день: собрать список и найти технику. Нижний — справочники
          и планирование. До этого «Автомобили» и «Залы» лежали слим-баннерами во
          всю ширину и читались вторым сортом просто потому, что арт для них ещё
          не отдан, — иерархия шла от наличия картинки, а не от смысла. */}
      <div className="home-destinations">
        <div className="home-row home-row--work">
          {/* Плитка — <article>, а не <a>: подпись-действие ведёт своим адресом, а вложить
              ссылку в ссылку нельзя. Тело плитки кликается растянутой .home-destination__link. */}
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
        </div>

        <div className="home-row home-row--refs">
          <article className="home-destination home-destination--employees">
            <img className="home-destination__art home-destination__art--employees" src="/illustrations/av-team.webp" alt="" aria-hidden="true" loading="eager" decoding="async" fetchPriority="high" />
            <Link className="home-destination__link" to="/employees">
              <span className="home-destination__icon"><UsersRound size={34} /></span>
              <span className="home-destination__arrow"><ArrowUpRight size={24} /></span>
              <span className="eyebrow">{tr('Команда на площадке', 'Maydondagi jamoa')}</span>
              <strong>{tr('Сотрудники', 'Xodimlar')}</strong>
              <p>{tr('Карточки сотрудников: контакты, документы, фото и сканы.', 'Xodimlar kartalari: kontaktlar, hujjatlar, foto va nusxalar.')}</p>
            </Link>
            <Link className="home-destination__action" to="/employees/new"><Plus size={16} /> {tr('Добавить сотрудника', 'Xodim qo‘shish')}</Link>
          </article>

          <article className="home-destination home-destination--vehicles">
            {/* Место под арт серии: сюда одной строкой встанет <img class="home-destination__art home-destination__art--vehicles" …>, когда прораб отдаст иллюстрацию */}
            <Link className="home-destination__link" to="/vehicles">
              <span className="home-destination__icon"><CarFront size={34} /></span>
              <span className="home-destination__arrow"><ArrowUpRight size={24} /></span>
              <span className="eyebrow">{tr('Транспорт на выезд', 'Safar transporti')}</span>
              <strong>{tr('Автомобили', 'Avtomobillar')}</strong>
              <p>{tr('База машин для пропусков на площадки: госномера, цвета и водители из базы сотрудников.', 'Maydonchalarga ruxsatnomalar uchun mashinalar bazasi: davlat raqamlari, ranglar va xodimlar bazasidagi haydovchilar.')}</p>
            </Link>
            <Link className="home-destination__action" to="/vehicles/new"><Plus size={16} /> {tr('Добавить машину', 'Mashina qo‘shish')}</Link>
          </article>

          <article className="home-destination home-destination--halls">
            {/* Место под арт серии — как у автомобилей: сюда встанет <img class="home-destination__art home-destination__art--halls" …>, когда прораб отдаст иллюстрацию */}
            <Link className="home-destination__link" to="/halls">
              <span className="home-destination__icon"><Presentation size={34} /></span>
              <span className="home-destination__arrow"><ArrowUpRight size={24} /></span>
              <span className="eyebrow">{tr('Планирование площадки', 'Maydonni rejalashtirish')}</span>
              <strong>{tr('Залы', 'Zallar')}</strong>
              <p>{tr('Расставить сотрудников по залам мероприятия и вывести на большой экран.', 'Xodimlarni tadbir zallari bo‘yicha taqsimlash va katta ekranga chiqarish.')}</p>
              {/* Создание плана живёт в дровере самого раздела, отдельного адреса у него нет — действие совпадает с плиткой */}
              <span className="home-destination__action">{tr('Открыть залы', 'Zallarni ochish')} <ArrowUpRight size={16} /></span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
