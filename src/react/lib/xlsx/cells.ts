// Ячейки листа и экранирование XML: текст едет inlineStr, поэтому таблицы
// общих строк (sharedStrings) в пакете нет вовсе.

export function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function textCell(reference: string, value: string, style: number) {
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
}

export function numberCell(reference: string, value: number, style: number) {
  return `<c r="${reference}" s="${style}"><v>${value}</v></c>`
}

export function formulaCell(reference: string, formula: string, cachedValue: number, style: number) {
  return `<c r="${reference}" s="${style}"><f>${xml(formula)}</f><v>${cachedValue}</v></c>`
}
