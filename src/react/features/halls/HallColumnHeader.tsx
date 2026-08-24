import { Ellipsis, Palette, Trash2 } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { InlineText } from './InlineText'
import { HALL_PALETTE } from './types'
import type { HallBrief } from './api'
import type { HallPlanEditor } from './useHallPlanEditor'
import { ActionMenu } from '../../components/ActionMenu'
import { useLanguage } from '../../lib/i18n'
import { useArmedAction } from '../../lib/useArmedAction'

// Шапка колонки-зала: номер, имя и меню. Цвет уезжает в CSS переменной
// --hall-color инлайном — из базы он приходит готовым к подстановке (нижний
// регистр, `#rrggbb`), и парсить его незачем.
//
// Номер — ИНДЕКС в порядке залов, а не часть имени: имена правят руками
// («Media Center»), и нумерация обязана держаться отдельно от них.
export function HallColumnHeader({ hall, index, cellCount, editor }: {
  hall: HallBrief
  index: number
  cellCount: number
  editor: HallPlanEditor
}) {
  const { tr } = useLanguage()
  const armed = useArmedAction()
  const [isColorOpen, setColorOpen] = useState(false)

  return (
    <div className="hall-matrix__colhead" style={{ '--hall-color': hall.color } as CSSProperties}>
      <div className="hall-matrix__colhead-row">
        <span className="hall-matrix__number" aria-hidden="true">{index + 1}</span>
        <InlineText
          value={hall.name}
          onSave={(name) => editor.renameHall(hall.id, name)}
          ariaLabel={tr('Название зала', 'Zal nomi')}
          className="inline-text--head"
        />
        {armed.armed ? (
          // Подтверждение видимой кнопкой, а не вторым заходом в меню: взвод
          // гаснет через четыре секунды, и открыть меню заново человек не успеет.
          <button
            autoFocus
            type="button"
            className="hall-matrix__confirm"
            onClick={() => armed.fire(() => editor.removeHall(hall.id))}
            onBlur={armed.disarm}
            // Safari: mousedown по кнопке не фокусирует её, но блюрит текущий
            // фокус — то есть ЕЁ САМУ (autoFocus): onBlur гасил взвод раньше
            // click, и «Удалить зал?» не срабатывал (найдено прорабом, с21).
            onMouseDown={(event) => event.preventDefault()}
          >
            <Trash2 size={14} /> {tr('Удалить зал?', 'Zal o‘chirilsinmi?')}
          </button>
        ) : (
          <ActionMenu
            className="hall-matrix__menu"
            label=""
            ariaLabel={tr('Действия с залом', 'Zal bilan amallar')}
            icon={<Ellipsis size={16} />}
            items={[
              {
                id: 'color',
                label: tr('Цвет', 'Rang'),
                hint: tr('Восемь цветов палитры', 'Palitradagi sakkiz rang'),
                icon: <Palette size={16} />,
                // Переключатель, а не «открыть»: полоса свотчей закрывается тем
                // же пунктом, Escape'ом и выбором цвета. Закрытия по клику мимо
                // здесь намеренно НЕТ — в Safari кнопка по клику фокус не берёт,
                // и blur успел бы снять полосу раньше, чем сработает выбор.
                onSelect: () => setColorOpen((current) => !current),
              },
              {
                id: 'delete',
                label: tr('Удалить зал', 'Zalni o‘chirish'),
                hint: cellCount > 0
                  ? tr(`Вместе с ячейками: ${cellCount}`, `Kataklar bilan birga: ${cellCount}`)
                  : tr('Ячейки зала пусты', 'Zal kataklari bo‘sh'),
                icon: <Trash2 size={16} />,
                onSelect: () => armed.fire(() => editor.removeHall(hall.id)),
              },
            ]}
          />
        )}
      </div>

      {isColorOpen && (
        // Свотчи разворачиваются полосой в самой шапке, а не вторым поповером:
        // цвет выбирают глазами и рядом с залом, который он красит, — портал в
        // body увёл бы образцы от него на другой конец экрана.
        <div
          className="hall-colors"
          role="group"
          aria-label={tr('Цвет зала', 'Zal rangi')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setColorOpen(false)
          }}
        >
          {HALL_PALETTE.map((color, colorIndex) => (
            <button
              key={color}
              autoFocus={colorIndex === 0}
              type="button"
              className={color === hall.color ? 'is-current' : ''}
              style={{ '--hall-color': color } as CSSProperties}
              aria-label={color}
              aria-pressed={color === hall.color}
              onClick={() => {
                setColorOpen(false)
                editor.recolorHall(hall.id, color)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
