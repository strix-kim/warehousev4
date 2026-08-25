// Копирование в буфер обмена. Жило в features/halls (текст плана для чата, с22),
// с27 переехало сюда без единой правки поведения: копировать умеет и карточка
// профиля, а общему компоненту нельзя зависеть от чужой фичи.

// Копирование в буфер. Путь через navigator.clipboard требует защищённого
// контекста и живого жеста пользователя; там, где его нет (старая Safari,
// http-адрес в локальной сети), остаётся приём со скрытым полем и
// document.execCommand — устаревший, но работающий именно в этих случаях.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyViaTextarea(text)
  }
}

function copyViaTextarea(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  // Поле обязано быть в документе и доступным для выделения, иначе копировать
  // нечего; уводим его за пределы экрана, а не прячем display: none.
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.top = '-1000px'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  field.remove()
  return ok
}
