# three.js — шпаргалка (r186, npm `three@0.186.1`)

Сверено с docs threejs.org (Context7 `/websites/threejs`) и исходниками r186 на jsdelivr.
Первое применение — макет `docs/project/design/voxel-s47.html` (с47). В продукт
по брифу пойдёт `react-three-fiber` + `drei` — для них будет своя шпаргалка.

## Подключение без сборки (макеты)
```html
<script type="importmap">{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
</script>
```
Аддоны — только явным импортом из `three/addons/...`, в `THREE.*` их нет.

## Рабочий API
- **Рендер:** `new WebGLRenderer({ antialias: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`,
  `setSize(w, h)`, `setAnimationLoop((now) => …)`. r186 требует **WebGL2** — проверка
  `canvas.getContext('webgl2')` до создания, иначе фолбэк текстом.
- **Время:** `THREE.Clock` в r186 устарел (предупреждение в консоли) → `new THREE.Timer()`,
  в цикле `timer.update(now)`, затем `getDelta()` / `getElapsed()` (секунды).
- **Ресайз:** `ResizeObserver` на контейнер (не `window`) → `renderer.setSize`, `css2d.setSize`,
  `camera.aspect = w / h; camera.updateProjectionMatrix()`.
- **OrbitControls:** `new OrbitControls(camera, renderer.domElement)`; `enableDamping` требует
  `controls.update()` в каждом кадре; ручная правка камеры → `controls.update()`.
  Границы: `minPolarAngle`/`maxPolarAngle` (не под землю, не в зенит), `minDistance`/`maxDistance`.
  Событие `'start'` — пользователь начал крутить.
- **CSS2DRenderer:** отдельный слой поверх canvas, `domElement` позиционируем сами,
  `css2d.render(scene, camera)` после WebGL-рендера. `CSS2DObject(el)`: `.center` — точка
  привязки (`(0.5, 1)` = низ по центру). Невидимый предок прячет табличку (рендерер ставит
  `display:none` сам — не перебивать `display` в CSS, прятать через `opacity`).
- **Raycast:** `raycaster.setFromCamera(ndcVec2, camera)`, `intersectObjects(list, false)`.
  Видимость НЕ проверяется — держать отдельные списки кликабельного на каждый вид.
  `LineSegments` ловятся с порогом 1 м — рёбра в список не класть.
- **Свет:** после r155 интенсивности физические: Lambert отдаёт `цвет × (ambient + dir·cos) / π`.
  Белый верх ≈ белый при `AmbientLight(…, 2)` + `DirectionalLight(…, 1.6)`.
- **Цвета:** `new Color('#EEF0F3')` трактуется как sRGB — токены можно отдавать как есть.
  Фон = земля 1:1 только с `MeshBasicMaterial` (без освещения).
- **Слияние геометрий:** `import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'`,
  `mergeGeometries(list, useGroups = false)` → `BufferGeometry` или `null`, если атрибуты несовместимы
  (все indexed либо все нет; `BoxGeometry.clone().applyMatrix4(m)` совместимы между собой).
  `applyMatrix4` сам пересчитывает нормали. Исходники после слияния — `dispose()`.
- **CSS2DObject + CSS-анимация:** рендерер каждый кадр пишет `transform` в style элемента —
  анимировать `transform` можно только на ВНУТРЕННЕМ блоке, иначе табличка прыгает.
  Смена `visible` → `display:none` и обратно перезапускает CSS-анимацию (появление «из коробки»).
- **Disposal:** `geometry.dispose()`, `material.dispose()`, `texture.dispose()`,
  `controls.dispose()`, `renderer.dispose()`; при размонтировании — `setAnimationLoop(null)`.

## Наши конвенции
- **Схема, не реализм.** `BoxGeometry` (одна общая `1×1×1`, размер — `scale` у отдельного меша
  или матрица в сборке `kit()`: детали здания копятся и сливаются в один меш на пару «материал + рёбра»;
  `k(..., rx)` — наклон по x для стёкол-клиньев), единственное исключение — колёса: `CylinderGeometry(1, 1, 1, 16)`
  через `k.cyl` (ось по x поворотом π/2 по z; сливается с кубами того же материала — атрибуты совместимы),
  `MeshLambertMaterial`/`MeshStandardMaterial` без текстур, теней нет, неба нет. Туман — только
  служебный (см. «Полёт камеры»).
- **Цвета — только из токенов ARGO**, читать через `getComputedStyle(:root)`: тела `--card`,
  `--select`; крыши/детали `--night-3` (чистый `--night` в мире не используем — тяжёлый, он только
  в HTML-хроме); пара для двух тёмных рядом (шина/диск, ворота/ламели) — `--night-3` + `--ctl`; рёбра `EdgesGeometry` + `LineSegments` цвета `--line`;
  акцент `--red` — знак и выбранный объект; статусы `--ok-dot` / `--warn-dot`.
- **Наведение и выбор — кольцо на полу, корпус не трогаем** (правка прораба с47): `RingGeometry`
  в группе мира, не в объекте (объект при выборе растёт/поднимается, кольцо лежит). Наведение/фокус —
  тонкое `--ctl` 0,6 за 150 мс; выбор — сплошной красный «пятак»: заливка круга (`CircleGeometry`,
  `--red` непрозрачность 1, но `transparent` + `depthWrite: false` — без z-файтинга с полом; на 5 мм выше
  кольца, `renderOrder` ниже кольца) растёт от центра за 300 мс, по краю кольцо того же `--red` делает пульс
  0,8 → 1,08 → 1 за 350 мс и в покое сливается с диском — один круг чуть шире серого; снятие — кольцо и заливка схлопываются за 150 мс. Радиус — половина диагонали основания + запас. Один код на машины и здания
  (`makeRing` / `showRing` / `selectRing` / `hideRing` + `tickRings`). Эмиссию и `--ink`-рёбра не используем.
- **Полёт камеры — руками**, без либ: позиция и `controls.target` — `lerpVectors` по `--ease-out`,
  `camera.lookAt`; на время полёта `controls.enabled = false` и `controls.update()` не зовём.
  Скрыть остальной мир — `THREE.Fog` цвета `--bg`: туман держим в сцене ВСЕГДА с near/far за
  горизонтом и в полёте двигаем только их — включение/выключение `scene.fog` пересобирает шейдеры
  (рывок на первом кадре). Смена сцены — под шторкой-`div` цвета `--bg`. Перед расчётом ракурса после
  переезда узла в другой слот — синхронный `setSize`/`aspect`, `ResizeObserver` придёт поздно.
- **Кадр под окно, а не окно под кадр** (правка прораба с47): рабочий ракурс вида = фиксированное
  направление + «рамка интереса» (углы габаритов КАЖДОГО объекта + точка над крышей под табличку;
  общий бокс не годится — его пустые углы съедают кадр). Дистанция — минимальная, при которой все
  точки в кадре по ширине и высоте с учётом `fov` и `aspect`; цель сдвигается к центру проекции.
  Направление задаём углами (`sph(polar, azimuth)`): гараж — справа-спереди (азимут 28°) и низко
  (62° от вертикали, два ряда — 55°), машины в три четверти. Раскладку кампуса проверяем проекцией:
  экранные прямоугольники «габарит здания ∪ табличка» не пересекаются на 1440×900 и 390×844.
  Пересчёт на каждом ресайзе (`ResizeObserver`), если пользователь не крутил камеру. Раскладка
  объектов может зависеть от `aspect` (гараж: ≥ 1,5 — ряд, иначе два ряда) — коробки обеих раскладок
  собраны заранее и переключаются `visible`.
- Каждый 3D-объект дублируется кнопкой в DOM (фокус = подсветка, Enter = выбор).
- `prefers-reduced-motion: reduce` → `enableDamping = false`, анимации стоят.
- **Миниатюра, а не макет района** (правка прораба с47): здание — 8–20 объёмов, машина — 11–16
  по `docs/project/design/voxel-cars-spec.md` (данные `SPEC`, одна `makeCar`; колёса круглые, шина `--night-3` +
  диск `--ctl`, размер колёс — фактический из спецификации, рёбра только на кузове),
  человек — 3 (ноги, тело, голова; ходьба — покачивание тела, без шарниров). Окна — 1–3 широкие
  ленты `--select` на фасад или один стеклянный объём, не сетка. Вход, знак, флаг — крупнее
  «реального». Рёбра — только у основных объёмов. Сомневаешься в детали — убрать.
- **Один renderer на приложение:** узел сцены переезжает между слотами страниц (`appendChild`),
  контекст WebGL при этом жив; размер подхватывает `ResizeObserver` на контейнере. При скрытом
  контейнере (`display:none`) он отдаёт 0 × 0 — такой ресайз пропускать.
