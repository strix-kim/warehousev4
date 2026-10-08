// Память мира между заходами на страницу — на уровне модуля, живёт до перезагрузки
// вкладки. Без three: файл грузится во входном чанке. Движок (engine/) импортировать
// отсюда может, обратный импорт запрещён.
import type { CameraPose } from './worldStore'

// Поза камеры по location.key записи истории. Сохраняется при уходе со страницы мира,
// отдаётся только той же записи: шаг «назад» из интерьера возвращает тот же ракурс, а
// обычный заход (новая запись, новый ключ) начинается с рабочего ракурса. F5 память
// стирает — после перезагрузки ракурс тоже рабочий.
const POSES_MAX = 8
const poses = new Map<string, CameraPose>()

export function savePose(key: string, pose: CameraPose) {
  poses.delete(key)
  poses.set(key, pose)
  // Записи, на которые уже не вернутся, вытесняются самыми свежими
  for (const old of poses.keys()) {
    if (poses.size <= POSES_MAX) break
    poses.delete(old)
  }
}

// Позу забираем: повторный вход на ту же запись без нового ухода — рабочий ракурс
export function takePose(key: string): CameraPose | null {
  const pose = poses.get(key) ?? null
  poses.delete(key)
  return pose
}

// Id объектов, которые человек в этой вкладке уже видел в сцене: новому движок
// проигрывает появление (engine/appear.ts). Пусто — первый вход, анимации нет.
export const seenIds = new Set<string>()
export const hasSeen = (id: string) => seenIds.has(id)
export function markSeen(...ids: string[]) {
  for (const id of ids) seenIds.add(id)
}
export const resetSeen = () => seenIds.clear()
