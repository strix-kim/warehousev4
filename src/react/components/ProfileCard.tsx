import { Check, Copy, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PhotoThumb } from './PhotoThumb'
import { copyText } from '../lib/clipboard'
import { useLanguage } from '../lib/i18n'

// Карточка-профиль: общий контракт на дроверы сотрудника и машины (с27; рама и
// раскладка по макету с31 — с38). До неё обе карточки печатали ровный список пар
// «метка — значение», в котором ничего не выделено: человек читал двенадцать
// одинаковых строк, чтобы найти одну.
//
// Профиль отвечает на два вопроса по очереди. Сначала «тот ли это, кого я
// искал» — за это отвечает шапка: фото, имя и один главный факт. Потом «что с
// ним» — за это отвечают секции реквизитов и пилюли сроков.
//
// Шапка целиком лежит внутри .drawer__head рамы (DrawerFrame): крестик стоит
// в её же строке надзаголовка, поэтому закрытие отдельным блоком не рисуется.

// Копирование с подтверждением — один крючок на всю карточку. Ключ, а не булев
// флаг: подтверждение обязано гореть ровно на нажатом месте, а не на всех сразу.
function useCopyFeedback() {
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

  return { copiedKey, failedKey, copy }
}

// Подтверждение словом, а не только цветом; role=status даёт его и скринридеру,
// которому подсветка не видна. Пусто, пока по ключу ничего не копировали.
function CopyNote({ isCopied, hasFailed }: { isCopied: boolean, hasFailed: boolean }) {
  const { tr } = useLanguage()
  if (!isCopied && !hasFailed) return null
  return (
    <span className={`profile-note${hasFailed ? ' profile-note--failed' : ''}`} role="status">
      {isCopied ? tr('Скопировано', 'Nusxalandi') : tr('Не скопировалось', 'Nusxalanmadi')}
    </span>
  )
}

// Пилюля состояния: цвет несёт смысл, поэтому текст обязан повторять его словами —
// «Допуск истёк», а не красная точка без подписи. Класс приходит готовым
// (`expiryPillClass`), точку рисует сама .pill.
export type ProfileBadge = { key: string; className: string; label: string }

export function ProfileHead({ eyebrow, photo, title, titleCopy, subtitle, mainFact, badges = [], extra, onClose }: {
  // Класс записи («Сотрудник», «Автомобиль»), а не повтор заголовка.
  eyebrow: string
  // Ссылка приезжает ГОТОВОЙ со страницы: там она уже подписана ради миниатюры
  // в строке. Свой запрос за тем же файлом отложил бы шапку на круг сети и
  // сломал бы первый кадр (с26). Портрет — человек, car — предмет.
  photo: { url?: string, placeholder: ReactNode, shape: 'portrait' | 'car' }
  // Имя. У машины его нет: заголовком служит знак госномера в главном факте.
  title?: string
  // Что копировать по значку у имени. ФИО переносят в чат и в документы не
  // реже телефона (находка прораба, с27).
  titleCopy?: string | null
  // Приглушённая строка под именем — должность, «Марка Модель · Цвет».
  subtitle?: string | null
  // Один главный факт: телефон, госномер. Ровно один — второй возвращает шапку
  // к списку. `display` — как показать значение (знак номера), копируется `value`.
  mainFact?: { value: string, label: string, display?: ReactNode } | null
  badges?: ProfileBadge[]
  // Чипы водителей у машины и т.п.
  extra?: ReactNode
  onClose: () => void
}) {
  const { tr } = useLanguage()
  const { copiedKey, failedKey, copy } = useCopyFeedback()
  const fact = mainFact?.value ? mainFact : null

  return (
    <div className={`profile-head profile-head--${photo.shape}`}>
      {/* alt пустой намеренно: имя или госномер стоят рядом, и скринридер
          прочитал бы их дважды. Фото здесь — опознание глазами. */}
      <PhotoThumb className="profile-head__photo" url={photo.url} alt="" placeholder={photo.placeholder} />
      <div className="profile-head__top">
        <p className="eyebrow">{eyebrow}</p>
        <button autoFocus type="button" className="icon-button profile-head__close" onClick={onClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </div>
      {title && (
        <h2 className="profile-head__title">
          {title}
          {titleCopy && (
            <button
              type="button"
              className="profile-head__copy"
              onClick={() => void copy('head:title', titleCopy)}
              aria-label={tr(`Скопировать: ${title}`, `Nusxalash: ${title}`)}
            >
              {copiedKey === 'head:title' ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
          <CopyNote isCopied={copiedKey === 'head:title'} hasFailed={failedKey === 'head:title'} />
        </h2>
      )}
      {subtitle && <p className="profile-head__sub">{subtitle}</p>}
      {fact && (
        // Один DOM на десктоп и лист: на листе CSS растягивает .copy на весь
        // .mainfact, прячет слово и оставляет значок — получается одна большая
        // кнопка «значение + значок» (макет, .p-btn).
        <div className="mainfact">
          <b>{fact.display ?? fact.value}</b>
          <button
            type="button"
            className={`copy${copiedKey === 'head:fact' ? ' copy--copied' : ''}`}
            onClick={() => void copy('head:fact', fact.value)}
            aria-label={tr(`Скопировать: ${fact.label}`, `Nusxalash: ${fact.label}`)}
          >
            {copiedKey === 'head:fact' ? <Check size={16} /> : <Copy size={16} />}
            <span>{tr('Копировать', 'Nusxalash')}</span>
          </button>
          <CopyNote isCopied={copiedKey === 'head:fact'} hasFailed={failedKey === 'head:fact'} />
        </div>
      )}
      {badges.length > 0 && (
        <div className="profile-head__badges">
          {badges.map((badge) => <span key={badge.key} className={badge.className}>{badge.label}</span>)}
        </div>
      )}
      {extra && <div className="profile-head__extra">{extra}</div>}
    </div>
  )
}

export type ProfileField = {
  key: string
  label: string
  value: string | null
  // Моноширинное начертание — паспорт, ПИНФЛ: цифры сверяют глазами.
  mono?: boolean
  // По умолчанию строка копируется; false — размер футболки в чат не переносят.
  copy?: boolean
}

export type ProfileSection = { key: string; title: string; fields: ProfileField[] }

// Секции реквизитов. Пустые поля и целиком пустые секции не рисуются вовсе:
// канон проекта — показывать только заполненное, «—» на два десятка полей
// превращает карточку в бланк.
//
// Строка копируется нажатием целиком. Паспорт и ПИНФЛ из карточки переносят в
// чат, в договор и в таблицу — руками их перебивали с экрана, и цифра в ПИНФЛ
// ошибается молча. Кнопка прозрачна и лежит поверх строки, а не спрятана значком
// в углу: целиться в неё не нужно. Цена — выделить значение мышью больше нельзя,
// и это осознанный размен: копирование нажатием и есть замена выделению. Значок
// в третьей колонке — только метка «здесь копируется».
export function ProfileSections({ sections }: { sections: ProfileSection[] }) {
  const { tr } = useLanguage()
  const { copiedKey, failedKey, copy } = useCopyFeedback()

  const filled = sections
    .map((section) => ({ ...section, fields: section.fields.filter((field) => Boolean(field.value)) }))
    .filter((section) => section.fields.length > 0)

  return (
    <>
      {filled.map((section) => (
        <section className="profile-section" key={section.key}>
          <h3 className="drawer-caps">{section.title}</h3>
          <dl className="kv-list">
            {section.fields.map((field) => {
              const key = `${section.key}:${field.key}`
              const isCopied = copiedKey === key
              const canCopy = field.copy !== false
              return (
                <div key={field.key} className={`kv${canCopy ? ' kv--copy' : ''}${field.mono ? ' kv--mono' : ''}${isCopied ? ' kv--copied' : ''}`}>
                  <dt>{field.label}</dt>
                  {/* Кнопка, значок и подтверждение живут ВНУТРИ <dd>, а не
                      соседями dt/dd: по спецификации обёртка div внутри <dl>
                      содержит только dt и dd. На вид это не влияет — они
                      позиционируются от .kv. */}
                  <dd>
                    {field.value}
                    {canCopy && (
                      <>
                        <button
                          type="button"
                          className="kv__copy"
                          onClick={() => void copy(key, field.value ?? '')}
                          aria-label={tr(`Скопировать: ${field.label}`, `Nusxalash: ${field.label}`)}
                        />
                        <span className="kv__mark" aria-hidden="true">
                          {isCopied ? <Check size={16} /> : <Copy size={16} />}
                        </span>
                      </>
                    )}
                    <CopyNote isCopied={isCopied} hasFailed={failedKey === key} />
                  </dd>
                </div>
              )
            })}
          </dl>
        </section>
      ))}
      {/* Подсказка нужна только на листе (там значка копирования нет), CSS
          показывает её лишь в .sheet--profile. */}
      {filled.length > 0 && <p className="profile-hint">{tr('Нажмите на поле — значение скопируется.', 'Maydonni bosing — qiymat nusxalanadi.')}</p>}
    </>
  )
}
