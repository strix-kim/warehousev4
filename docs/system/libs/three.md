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
- **Схема, не реализм.** Только `BoxGeometry` (одна общая `1×1×1`, размер — `scale` у отдельного меша
  или матрица в сборке `kit()`: детали здания копятся и сливаются в один меш на пару «материал + рёбра»),
  `MeshLambertMaterial`/`MeshStandardMaterial` без текстур, теней нет, неба и тумана нет.
- **Цвета — только из токенов ARGO**, читать через `getComputedStyle(:root)`: тела `--card`,
  `--select`; крыши/детали `--night-3` (чистый `--night` в мире не используем — тяжёлый, он только
  в HTML-хроме); пара для двух тёмных рядом (шина/диск, ворота/ламели) — `--night-3` + `--ctl`; рёбра `EdgesGeometry` + `LineSegments` цвета `--line`;
  акцент `--red` — знак и выбранный объект; статусы `--ok-dot` / `--warn-dot`.
- Подсветка наведения — свой материал корпуса на объект (`emissive`) + рёбра `--ink`.
- Каждый 3D-объект дублируется кнопкой в DOM (фокус = подсветка, Enter = выбор).
- `prefers-reduced-motion: reduce` → `enableDamping = false`, анимации стоят.
