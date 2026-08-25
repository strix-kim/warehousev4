# Бриф на изображения

Что нужно от прораба, чтобы закрыть хвост вида (Ш5 и Ш9 плана с25). Три позиции:
одно РЕАЛЬНОЕ фото машины и две иллюстрации серии. Требования сняты с кода, а не
придуманы: ссылки на файлы даны рядом с каждым числом.

---

## 1. Фото машины — реальный снимок, не генерация

**Зачем.** `vehicle_files` в проде пуста: фото-путь машин ни разу не отработал на
настоящем снимке. Пока его нет, шаг «машина перестаёт выглядеть человеком»
(миниатюра в машинной геометрии вместо круглого аватара) проверять не на чем.

**Требования — минимальные, потому что клиент сам всё ужимает:**

| Что | Значение | Откуда |
|---|---|---|
| Формат на входе | JPEG, PNG или WebP | белый список бакета, `lib/compressPhoto.ts` |
| Вес на входе | до 10 МБ | политика бакета |
| Ориентация | **горизонтальная** (ландшафт) | ради этого шаг и делается |
| Что ужмёт браузер | большая сторона → 1600 px, JPEG качества 0.85 | `MAX_SIDE`, `JPEG_QUALITY` в `lib/compressPhoto.ts` |

**Грабля, из-за которой снимок может не загрузиться: HEIC с айфона.** Safari его
открывает, Chrome и Firefox — нет (`compressPhoto.ts`, статус `unsupported`).
Если фото снято на iPhone, переключи камеру на «Наиболее совместимый» либо
сохрани в JPEG перед загрузкой.

**Композиция.** Машина целиком, вид три четверти, госномер читается. Снимок
пойдёт в двух размерах: 52×48 в строке реестра и крупно в карточке — значит
машина должна узнаваться и в мелком кадре, поэтому кадрируй не слишком широко.

**Куда:** «Автомобили» → любая карточка → «Изменить» → блок «03 Фото».

---

## 2 и 3. Иллюстрации «Автомобили» и «Залы» — арт серии

**Зачем.** Каждый файл закрывает СРАЗУ ДВЕ роли: арт плитки на главной и
картинку пустого состояния раздела. Сейчас из пяти плиток арт есть у трёх, и
пока его нет, «Автомобили» и «Залы» читаются вторым сортом — иерархия на главной
идёт от наличия картинки, а не от смысла.

**После того как файлы лягут в `public/illustrations/`, вёрстку править почти не
придётся:** резерв полосы под арт завязан на его фактическое наличие через
`:not(:has(.home-destination__art))` (`styles/05-features.css`), место под `<img>`
размечено комментарием прямо в `HomePage.tsx`.

### Технические требования — сняты с трёх существующих файлов

| Что | Значение |
|---|---|
| Формат | **WebP с прозрачностью** (alpha). Все три существующих — `VP8X` с альфой |
| Размер | **900×600** (эталон: `av-warehouse` 900×600, `av-team` 960×640, `equipment-kit` 820×657) |
| Пропорции | около **3:2**, горизонтальные |
| Вес | **50–90 КБ** (сейчас 51 / 70 / 84 КБ) |
| Фон | **строго прозрачный**, без подложки и без белого прямоугольника |
| Тень | мягкая контактная тень допустима, но она часть картинки и тоже на прозрачном |

### Композиция — важнее формата

Картинка ложится в **правый нижний угол** плитки, обрезается её краем и
растворяется слева под градиентной маской (`.home-destination__art`,
`object-position: right bottom`, `mask-image`). Отсюда правила:

1. **Главный объект — в правой части кадра.** Левая треть уйдёт под растворение.
2. **Низ и правый край могут быть срезаны** — ничего смыслового туда не ставить.
3. **Читаемость в 250 px.** В пустом состоянии картинка показывается мелко
   (`state-block--illustrated`), поэтому силуэт должен узнаваться без деталей.
4. **Ни одной надписи, логотипа и бренда** — картинка живёт в двух языках.

### Стиль серии

Фотореалистичный предметный рендер на прозрачном фоне: графитово-серая техника,
приглушённая палитра, мягкий студийный свет сверху-слева, красный акцент точками
(он у нас фирменный, `--accent #ef1236`). Не иллюстрация-флэт, не мультяшность,
не изометрия. Ориентир — три файла в `public/illustrations/`, открой их рядом.

---

## Промпты для генерации

Писать в англоязычную модель (Midjourney, Flux, DALL·E, Imagen). После генерации
фон вырезать и сохранить в WebP — см. «Что делать с результатом».

### «Автомобили» → `public/illustrations/av-fleet.webp`

```
Professional product photograph of a white cargo van and a white pickup truck
parked at a three-quarter front angle, loaded with black road cases and
equipment trunks with red accents. Clean studio lighting from upper left, soft
contact shadows, muted graphite and silver color palette with subtle red
highlights. Photorealistic, high detail, commercial catalog style, isolated on
a plain white background, no text, no logos, no license plates, no people.
Horizontal composition, vehicles positioned toward the right side of the frame.
```

### «Залы» → `public/illustrations/av-halls.webp`

```
Professional product photograph of a conference hall stage setup: a large
widescreen presentation display on a truss stand, a video switcher console on
a table, and two studio lights on tripods. Dark graphite and black equipment
with subtle red accent lights, clean studio lighting from upper left, soft
contact shadows, muted color palette. Photorealistic, high detail, commercial
catalog style, isolated on a plain white background, no text, no logos, no
people, no audience seats. Horizontal composition, equipment grouped toward the
right side of the frame.
```

### Негативный промпт (если модель его принимает)

```
text, watermark, logo, brand name, letters, numbers, people, faces, cartoon,
flat illustration, isometric, low detail, cluttered background, gradient
background, drop shadow box, frame, border
```

### Если генератор не умеет прозрачный фон

Это норма: проси **plain white background**, фон вырежется отдельным шагом.
Ключевое — чтобы фон был РОВНЫЙ и однотонный, тогда вырезание чистое.

---

## Что делать с результатом

Отдай мне файлы в любом виде — PNG, JPEG, хоть с белым фоном. Я:

1. вырежу фон и приведу к прозрачности;
2. пережму в WebP до 900×600 и веса в пределах серии;
3. положу в `public/illustrations/` и подключу обе роли — плитку главной и пустое
   состояние раздела;
4. прогоню на 1920 / 1440 / 390 и покажу.

Отдельная библиотека для этого не нужна: изображения лежат в `public/` и в бандл
не попадают.

---

## Статус

- [ ] Фото машины залито в карточку → разблокирует Ш5
- [ ] `av-fleet.webp` → плитка «Автомобили» + пустое состояние раздела
- [ ] `av-halls.webp` → плитка «Залы» + пустое состояние раздела

Пока не закрыто — оба шага стоят, и это единственное, что их держит.
