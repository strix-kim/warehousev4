import type { ReactNode } from 'react'
import { PhotoThumb } from './PhotoThumb'

// Карточка-профиль: общий контракт на дроверы сотрудника и машины (с27). До неё
// обе карточки печатали ровный список пар «метка — значение», в котором ничего
// не выделено: человек читал двенадцать одинаковых строк, чтобы найти одну.
//
// Профиль отвечает на два вопроса по очереди. Сначала «тот ли это, кого я
// искал» — за это отвечает шапка: фото, имя и один главный факт. Потом «что с
// ним» — за это отвечают секции реквизитов и бейджи состояния.
//
// Компонент НЕ рисует кнопки шапки: они остаются вторым потомком .drawer__header,
// потому что на ширине до 520 px правило в 04-data.css раскладывает шапку по
// структуре «первый div — текст, второй div — действия». Сломаем структуру —
// молча поедет телефонная раскладка всех дроверов.

export function ProfileHead({ eyebrow, title, fact, photoUrl, photoAlt, photoPlaceholder, photoShape = 'round' }: {
  // Класс записи («Сотрудник», «Автомобиль»), а не повтор заголовка.
  eyebrow: string
  // Главный опознавательный признак: ФИО, госномер.
  title: ReactNode
  // Один главный факт под именем — должность, марка с моделью. Ровно один:
  // второй превращает шапку в тот же список, от которого мы уходим.
  fact?: string | null
  // Ссылка приезжает ГОТОВОЙ со страницы: там она уже подписана ради миниатюры
  // в строке. Свой запрос за тем же файлом отложил бы шапку на круг сети и
  // сломал бы первый кадр (с26).
  photoUrl?: string
  photoAlt: string
  photoPlaceholder: ReactNode
  // Круг — человек, прямоугольник — предмет. Третьей формы не заводим.
  photoShape?: 'round' | 'wide'
}) {
  return (
    <div className="profile-head">
      <PhotoThumb
        className={`profile-head__photo profile-head__photo--${photoShape}`}
        url={photoUrl}
        alt={photoAlt}
        placeholder={photoPlaceholder}
      />
      <div className="profile-head__text">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {fact && <p className="profile-head__fact">{fact}</p>}
      </div>
    </div>
  )
}

// Бейдж состояния: цвет несёт смысл, поэтому текст обязан повторять его словами —
// «Допуск истёк», а не красная точка без подписи.
export type ProfileBadge = { key: string; className: string; label: string }

export function ProfileBadges({ badges }: { badges: ProfileBadge[] }) {
  if (badges.length === 0) return null
  return (
    <div className="profile-badges">
      {badges.map((badge) => (
        // Пустой <i /> обязателен — это точка-индикатор из общего правила .badge.
        <span key={badge.key} className={badge.className}><i />{badge.label}</span>
      ))}
    </div>
  )
}

export type ProfileField = {
  key: string
  label: string
  value: string | null
  icon?: ReactNode
  // Поле на всю ширину: длинный адрес в колонке ~220 px переносится пять раз.
  wide?: boolean
  // Ключевое значение секции — крупнее остальных. На секцию таких максимум одно,
  // иначе акцент перестаёт быть акцентом.
  strong?: boolean
}

export type ProfileSection = { key: string; title: string; fields: ProfileField[] }

// Секции реквизитов. Пустые поля и целиком пустые секции не рисуются вовсе:
// канон проекта — показывать только заполненное, «—» на два десятка полей
// превращает карточку в бланк.
export function ProfileSections({ sections }: { sections: ProfileSection[] }) {
  const filled = sections
    .map((section) => ({ ...section, fields: section.fields.filter((field) => Boolean(field.value)) }))
    .filter((section) => section.fields.length > 0)

  return (
    <>
      {filled.map((section) => (
        <section className="profile-section" key={section.key}>
          <h3 className="profile-section__title">{section.title}</h3>
          <dl className="detail-list detail-list--profile">
            {section.fields.map((field) => (
              <div key={field.key} className={field.wide ? 'detail-list__wide' : undefined}>
                <dt>{field.icon}{field.label}</dt>
                <dd className={field.strong ? 'detail-list__value--strong' : undefined}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}
