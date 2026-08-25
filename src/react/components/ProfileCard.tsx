import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PhotoThumb } from './PhotoThumb'
import { copyText } from '../lib/clipboard'
import { useLanguage } from '../lib/i18n'

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
  // Ключевое значение секции — крупнее остальных. На секцию таких максимум одно,
  // иначе акцент перестаёт быть акцентом.
  strong?: boolean
}

export type ProfileSection = { key: string; title: string; fields: ProfileField[] }

// Секции реквизитов. Пустые поля и целиком пустые секции не рисуются вовсе:
// канон проекта — показывать только заполненное, «—» на два десятка полей
// превращает карточку в бланк.
//
// Каждое поле копируется нажатием. Телефон, ПИНФЛ и номер паспорта из карточки
// переносят в чат, в договор и в таблицу — руками их перебивали с экрана, и
// цифра в ПИНФЛ ошибается молча. Кнопка растянута на всю ячейку, а не спрятана
// иконкой в углу: целиться в неё не нужно.
export function ProfileSections({ sections }: { sections: ProfileSection[] }) {
  const { tr } = useLanguage()
  // Какое поле только что скопировано. Ключ, а не булев флаг: подтверждение
  // обязано гореть ровно на нажатой ячейке, а не на всех сразу.
  const [copiedKey, setCopiedKey] = useState('')
  const [failedKey, setFailedKey] = useState('')
  const timer = useRef<number | undefined>(undefined)

  // Таймер живёт дольше карточки: не сняв его, получим setState на размонтированном
  // дровере — закрыли карточку сразу после копирования, и в консоли предупреждение.
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(key: string, value: string) {
    const ok = await copyText(value)
    window.clearTimeout(timer.current)
    setCopiedKey(ok ? key : '')
    setFailedKey(ok ? '' : key)
    // Полторы секунды: меньше — подтверждение не успевает попасть в глаз,
    // больше — оно ещё горит, когда человек копирует следующее поле.
    timer.current = window.setTimeout(() => { setCopiedKey(''); setFailedKey('') }, 1500)
  }

  const filled = sections
    .map((section) => ({ ...section, fields: section.fields.filter((field) => Boolean(field.value)) }))
    .filter((section) => section.fields.length > 0)

  return (
    <>
      {filled.map((section) => (
        <section className="profile-section" key={section.key}>
          <h3 className="profile-section__title">{section.title}</h3>
          <dl className="detail-list detail-list--profile">
            {section.fields.map((field) => {
              const key = `${section.key}:${field.key}`
              const isCopied = copiedKey === key
              const hasFailed = failedKey === key
              return (
                <div key={field.key} className={`detail-list__cell${isCopied ? ' detail-list__cell--copied' : ''}`}>
                  <dt>{field.icon}{field.label}</dt>
                  <dd className={field.strong ? 'detail-list__value--strong' : undefined}>{field.value}</dd>
                  {/* Кнопка прозрачная и лежит поверх всей ячейки: нажатие куда
                      угодно по ней копирует. Цена решения — выделить значение
                      мышью больше нельзя, и это осознанный размен: копирование
                      нажатием и есть замена выделению, а промахнуться мимо цели
                      размером с ячейку невозможно. Внутри <dl> допустимы только
                      dt/dd и обёртка div, поэтому кнопка живёт здесь, а не
                      оборачивает содержимое. */}
                  <button
                    type="button"
                    className="detail-list__copy"
                    onClick={() => void copy(key, field.value ?? '')}
                    aria-label={tr(`Скопировать: ${field.label}`, `Nusxalash: ${field.label}`)}
                  />
                  <span className="detail-list__copy-mark" aria-hidden="true">
                    {isCopied ? <Check size={14} /> : <Copy size={13} />}
                  </span>
                  {/* Подтверждение словом, а не только цветом; role=status даёт
                      его и скринридеру, которому подсветка ячейки не видна. */}
                  {(isCopied || hasFailed) && (
                    <span className={`detail-list__copy-note${hasFailed ? ' detail-list__copy-note--failed' : ''}`} role="status">
                      {isCopied ? tr('Скопировано', 'Nusxalandi') : tr('Не скопировалось', 'Nusxalanmadi')}
                    </span>
                  )}
                </div>
              )
            })}
          </dl>
        </section>
      ))}
    </>
  )
}
