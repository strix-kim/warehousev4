import { ArrowRight, CircleAlert, Minus, Plus, Save, Trash2, X } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react'
import { mealErrorText, type MealDishHint } from './api'
import { MEAL_DISH_MAX, MEAL_GUEST_MAX, MEAL_PRICE_MAX, MEAL_QTY_MAX, type MealOrder, type MealOrderInput } from './types'
import { DrawerFrame } from '../../components/DrawerFrame'
import { UnsavedPrompt } from '../../components/UnsavedPrompt'
import { caretAfterDigits, formatSum, groupDigits, parseSum, sumDigits } from '../expenses/format'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'
import { useGuardedClose } from '../../lib/useGuardedClose'
import { useModalLayer } from '../../lib/useModalLayer'

// Цифр в поле цены — не больше, чем в самом пределе (как AMOUNT_MAX_DIGITS
// в ExpenseDrawer).
const PRICE_MAX_DIGITS = String(MEAL_PRICE_MAX).length
// Чипов подсказок — один-два ряда на 390: больше — уже список, а не подсказка.
const HINTS_SHOWN = 8

type Draft = {
  dish: string
  qty: number
  // Цифры без разрядки: разрядка — вид, а не значение.
  priceDigits: string
  guestName: string
}

// Клавиатура телефона. Лист прибит к низу окна (position: fixed), а экранная
// клавиатура на iOS и в Chrome под Android (resizes-visual) окно не сжимает —
// она ложится поверх, и поле цены с кнопками подвала уходили бы под неё.
// Высоту клавиатуры считаем по visualViewport и отдаём в CSS-переменную:
// .sheet--meal-order поднимается на неё (meals.css).
function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--meal-keyboard', `${Math.round(inset)}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--meal-keyboard')
    }
  }, [])
}

// Лист заказа одного человека (план meals-s56, шаг 3). Пишет не сам — зовёт
// страницу: строку в списке после записи страница кладёт из ответа базы
// (план 3.3), здесь только черновик и текст отказа. Отказ лист не закрывает:
// набранное остаётся, «Сохранить» можно нажать ещё раз.
//
// «Сохранить → следующий» не перемонтирует лист, а меняет draftKey: черновик
// сбрасывается, поля монтируются заново (autoFocus). Два смонтированных листа
// на время смены дали бы два useModalLayer, и снятие старого вернуло бы
// прокрутку страницы под открытым новым.
export function MealOrderSheet({ draftKey, title, order, initialInput, dishHints, hasNext, guestNameEditable = false, onSave, onNotEating, onDelete, onRequestClose }: {
  // Чей черновик: смена = другой человек в том же открытом листе.
  draftKey: string
  // Имя человека; в режиме гостя — заголовок листа.
  title: string
  order: MealOrder | null
  // Черновик неудавшейся записи (строка «не сохранено, повторить»): лист
  // открывается с ним, а не со строкой базы, — набранное не теряется.
  initialInput?: MealOrderInput | null
  // Уже отсортированы страницей: блюда приёма по частоте, затем мероприятия.
  dishHints: MealDishHint[]
  hasNext: boolean
  // Новый гость: поле имени над блюдом, guestName приходит в onSave.
  guestNameEditable?: boolean
  onSave: (input: MealOrderInput, andNext: boolean, guestName: string | null) => Promise<void>
  // Нет у нового гостя: гостя, который не ест, незачем и заводить.
  onNotEating?: () => Promise<void>
  // Только гостям и строкам вне состава: у человека состава строку не удаляют,
  // ему ставят «Не ест».
  onDelete?: () => Promise<void>
  onRequestClose: () => void
}) {
  const { tr } = useLanguage()
  const currency = tr('сум', 'so‘m')
  useKeyboardInset()

  const makeDraft = (): Draft => {
    const source = initialInput ?? order
    return {
      dish: source?.dish ?? '',
      qty: source?.qty ?? 1,
      priceDigits: source?.price ? String(source.price) : '',
      guestName: '',
    }
  }
  // Снимок на момент открытия: список под листом может обновиться ответом
  // записи, и «несохранённое» не должно от этого появляться или исчезать.
  const [initialDraft, setInitialDraft] = useState<Draft>(makeDraft)
  const [draft, setDraft] = useState<Draft>(initialDraft)
  // После успеха busy НЕ снимается: лист закрывает (или переводит на
  // следующего) страница, и кнопка не должна ожить на кадр перед этим.
  const [busy, setBusy] = useState<'idle' | 'saving' | 'saving-next' | 'not-eating' | 'deleting'>('idle')
  const [errorText, setErrorText] = useState('')

  // Следующий человек — сброс в рендере, а не в эффекте (приём «состояние от
  // пропса» из документации React): кадра со старым черновиком под новым
  // именем не бывает.
  const [draftOwner, setDraftOwner] = useState(draftKey)
  if (draftOwner !== draftKey) {
    const fresh = makeDraft()
    setDraftOwner(draftKey)
    setInitialDraft(fresh)
    setDraft(fresh)
    setBusy('idle')
    setErrorText('')
  }
  const deleteConfirm = useArmedAction()
  // id, а не строка-константа: при «→ следующий» два листа на миг смонтированы разом.
  const dishId = useId()

  const patch = (fields: Partial<Draft>) => setDraft((current) => ({ ...current, ...fields }))

  // Живая разрядка цены — тот же приём с кареткой, что у суммы в ExpenseDrawer.
  const priceRef = useRef<HTMLInputElement>(null)
  const caretDigitsRef = useRef<number | null>(null)
  const [caretTick, setCaretTick] = useState(0)
  const priceText = groupDigits(draft.priceDigits)

  useLayoutEffect(() => {
    if (caretDigitsRef.current === null || !priceRef.current) return
    const position = caretAfterDigits(priceText, caretDigitsRef.current)
    caretDigitsRef.current = null
    priceRef.current.setSelectionRange(position, position)
  }, [priceText, caretTick])

  function changePrice(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    const caret = event.target.selectionStart ?? raw.length
    const digits = sumDigits(raw).slice(0, PRICE_MAX_DIGITS)
    caretDigitsRef.current = Math.min(sumDigits(raw.slice(0, caret)).length, digits.length)
    patch({ priceDigits: digits })
    setCaretTick((value) => value + 1)
  }

  // Подсказка, не правило: цена блюда подставляется, только пока своя не введена.
  function pickHint(hint: MealDishHint) {
    patch({
      dish: hint.dish,
      ...(draft.priceDigits === '' && hint.price !== null ? { priceDigits: String(hint.price) } : {}),
    })
  }

  // Клиентские проверки — подсказка с парой в базе: project_meal_orders_dish_check
  // (без блюда цены нет), _price_check, _qty_check, _guest_check. Кнопку они
  // запирают, только чтобы не слать заведомо мёртвый запрос.
  const dish = draft.dish.trim()
  const guestName = draft.guestName.trim()
  const price = parseSum(draft.priceDigits)
  const priceOutOfRange = price !== null && (price < 1 || price > MEAL_PRICE_MAX)
  const priceWithoutDish = price !== null && !dish
  const isIdle = busy === 'idle'
  const canSave = Boolean(dish) && !priceOutOfRange && (!guestNameEditable || Boolean(guestName)) && isIdle

  const isDirty = draft.dish !== initialDraft.dish
    || draft.qty !== initialDraft.qty
    || draft.priceDigits !== initialDraft.priceDigits
    || draft.guestName !== initialDraft.guestName
  const { requestClose, isPrompting, confirmClose, keepEditing } = useGuardedClose(isDirty && isIdle, onRequestClose)
  useModalLayer(requestClose)

  async function run(kind: Exclude<typeof busy, 'idle'>, action: () => Promise<void>) {
    setBusy(kind)
    setErrorText('')
    try {
      await action()
    } catch (error) {
      // В канал отказ отправляет страница — она же помечает строку.
      setErrorText(mealErrorText(error, tr))
      setBusy('idle')
    }
  }

  function save(andNext: boolean) {
    if (!canSave) return
    const input: MealOrderInput = { dish, qty: draft.qty, price }
    void run(andNext ? 'saving-next' : 'saving', () => onSave(input, andNext, guestNameEditable ? guestName : null))
  }

  const nextLabel = tr('Сохранить → следующий', 'Saqlash → keyingisi')

  return (
    <DrawerFrame
      className="meal-order"
      ariaLabel={guestNameEditable ? tr('Новый гость', 'Yangi mehmon') : tr(`Заказ: ${title}`, `Buyurtma: ${title}`)}
      instant={false}
      onRequestClose={requestClose}
      head={<>
        <div className="drawer__titles">
          <p className="eyebrow">{guestNameEditable ? tr('Обеды · гость', 'Ovqatlanish · mehmon') : tr('Заказ', 'Buyurtma')}</p>
          <h2>{title}</h2>
        </div>
        <button className="icon-button" onClick={requestClose} aria-label={tr('Закрыть', 'Yopish')}><X size={19} /></button>
      </>}
      foot={<>
        {onNotEating && (
          <button type="button" className="button button--secondary" disabled={!isIdle} onClick={() => void run('not-eating', onNotEating)}>
            {busy === 'not-eating' ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Не ест', 'Ovqatlanmaydi')}
          </button>
        )}
        <button type="button" className={`button ${hasNext ? 'button--secondary' : 'button--primary'}`} disabled={!canSave} onClick={() => save(false)}>
          <Save size={17} /> {busy === 'saving' ? tr('Сохраняем…', 'Saqlanmoqda…') : tr('Сохранить', 'Saqlash')}
        </button>
        {hasNext && (
          <button type="button" className="button button--primary meal-order__next" disabled={!canSave} onClick={() => save(true)} aria-label={nextLabel}>
            {busy === 'saving-next'
              ? tr('Сохраняем…', 'Saqlanmoqda…')
              : <>{tr('Сохранить', 'Saqlash')} <ArrowRight size={17} /> {tr('следующий', 'keyingisi')}</>}
          </button>
        )}
      </>}
    >
      <AnimatePresence>
        {isPrompting && (
          <UnsavedPrompt
            key="unsaved"
            message={tr('Заказ не сохранён.', 'Buyurtma saqlanmagan.')}
            stayLabel={tr('Продолжить ввод', 'Kiritishni davom ettirish')}
            leaveLabel={tr('Закрыть без сохранения', 'Saqlamasdan yopish')}
            onStay={keepEditing}
            onLeave={confirmClose}
          />
        )}
      </AnimatePresence>

      {/* Отказ — вверху тела: внизу его закрыла бы клавиатура. */}
      {errorText && <p className="form-error" role="alert"><CircleAlert size={15} /> {errorText}</p>}

      {/* Ключ — человек: поля монтируются заново, autoFocus срабатывает на каждом. */}
      <Fragment key={draftKey}>
        {guestNameEditable && (
          <label className="field">
            <span>{tr('Имя гостя', 'Mehmon ismi')} *</span>
            <input
              autoFocus
              value={draft.guestName}
              maxLength={MEAL_GUEST_MAX}
              onChange={(event) => patch({ guestName: event.target.value })}
              placeholder={tr('Например, водитель или «Общее: лепёшки»', 'Masalan, haydovchi yoki «Umumiy: non»')}
            />
          </label>
        )}

        <div className="field">
          <label htmlFor={dishId}>{tr('Блюдо', 'Taom')} *</label>
          <input
            id={dishId}
            autoFocus={!guestNameEditable}
            autoComplete="off"
            value={draft.dish}
            maxLength={MEAL_DISH_MAX}
            onChange={(event) => patch({ dish: event.target.value })}
            placeholder={tr('Например, плов', 'Masalan, osh')}
          />
          {dishHints.length > 0 && (
            <div className="meal-hints" role="group" aria-label={tr('Подсказки блюд', 'Taom takliflari')}>
              {dishHints.slice(0, HINTS_SHOWN).map((hint) => (
                <button
                  key={hint.dish.toLowerCase()}
                  type="button"
                  className="chip"
                  aria-pressed={dish.toLowerCase() === hint.dish.toLowerCase()}
                  disabled={!isIdle}
                  onClick={() => pickHint(hint)}
                >
                  {hint.dish}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="meal-order__row">
          <div className="field">
            <span>{tr('Порций', 'Porsiya')}</span>
            <div className="meal-qty">
              <button type="button" className="icon-button icon-button--bordered" disabled={!isIdle || draft.qty <= 1} onClick={() => patch({ qty: Math.max(1, draft.qty - 1) })} aria-label={tr('Меньше', 'Kamroq')}>
                <Minus size={18} />
              </button>
              <output aria-live="polite">{draft.qty}</output>
              <button type="button" className="icon-button icon-button--bordered" disabled={!isIdle || draft.qty >= MEAL_QTY_MAX} onClick={() => patch({ qty: Math.min(MEAL_QTY_MAX, draft.qty + 1) })} aria-label={tr('Больше', 'Ko‘proq')}>
                <Plus size={18} />
              </button>
            </div>
          </div>

          <label className="field">
            <span>{tr('Цена за порцию', 'Porsiya narxi')}</span>
            <div className="meal-price">
              <input
                ref={priceRef}
                inputMode="numeric"
                autoComplete="off"
                value={priceText}
                onChange={changePrice}
                placeholder="0"
                aria-label={tr('Цена за порцию в сумах', 'Porsiya narxi so‘mda')}
              />
              <span aria-hidden="true">{currency}</span>
            </div>
          </label>
        </div>
        {priceOutOfRange && (
          <small className="field-hint field-hint--error">
            {tr(`Цена — от 1 до ${formatSum(MEAL_PRICE_MAX)} сум`, `Narx — 1 dan ${formatSum(MEAL_PRICE_MAX)} so‘mgacha`)}
          </small>
        )}
        {priceWithoutDish && !priceOutOfRange && (
          <small className="field-hint field-hint--error">{tr('Без блюда цена не ставится — впишите блюдо.', 'Taomsiz narx qo‘yilmaydi — taomni yozing.')}</small>
        )}
      </Fragment>

      {onDelete && (
        // onMouseDown — Safari: иначе onBlur гасит взвод раньше второго click
        // (gotchas §6).
        <button
          type="button"
          className="button button--danger-ghost meal-order__delete"
          disabled={!isIdle}
          onClick={() => deleteConfirm.fire(() => void run('deleting', onDelete))}
          onBlur={deleteConfirm.disarm}
          onMouseDown={(event) => { if (deleteConfirm.armed) event.preventDefault() }}
        >
          <Trash2 size={16} /> {busy === 'deleting'
            ? tr('Удаляем…', 'O‘chirilmoqda…')
            : deleteConfirm.armed ? tr('Точно удалить строку?', 'Qator aniq o‘chirilsinmi?') : tr('Удалить строку', 'Qatorni o‘chirish')}
        </button>
      )}
    </DrawerFrame>
  )
}
