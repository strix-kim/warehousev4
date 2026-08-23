// Картинки на листе: пересчёт координат Excel в EMU и разметка DrawingML.
// Модуль намеренно без DOM — сюда приходят уже готовые размеры кадра, а не Blob.
//
// EMU (English Metric Unit) — внутренняя единица длины OOXML. Все размеры и
// смещения якорей в drawing1.xml выражены только в ней.

import { xml } from './cells'

export const EMU_PER_PX = 9525
export const EMU_PER_PT = 12700

// Ширина колонки в файле задаётся в «символах», а якорь картинки — в пикселях.
// Формула Excel для MDW (максимальной ширины цифры) = 7 пикселей: ширина в
// символах превращается в целое число пикселей с тем же округлением, что делает
// сам Excel, иначе картинка уезжает от границы объединённой ячейки.
export function columnWidthToPx(chars: number) {
  return Math.trunc((256 * chars + Math.trunc(128 / 7)) / 256 * 7)
}

// Высота строки хранится в пунктах.
export function rowHeightToEmu(points: number) {
  return Math.round(points * EMU_PER_PT)
}

// Вписать кадр в прямоугольник, сохранив пропорции (contain): картинка целиком
// внутри бокса, поля по одной из осей. Результат сразу в EMU.
export function fitImage(image: { width: number; height: number }, box: { widthPx: number; heightPx: number }) {
  const scale = Math.min(box.widthPx / image.width, box.heightPx / image.height)
  return {
    cx: Math.round(image.width * scale * EMU_PER_PX),
    cy: Math.round(image.height * scale * EMU_PER_PX),
  }
}

export type OneCellAnchor = {
  // id — уникальный целый номер фигуры на листе; 1 занят самим листом, поэтому счёт с 2.
  id: number
  name: string
  descr: string
  // col/row — нулевые индексы: колонка A и строка 1 это 0 и 0.
  col: number
  row: number
  colOffEmu: number
  rowOffEmu: number
  cx: number
  cy: number
  // Номер связи в xl/drawings/_rels/drawing1.xml.rels — он же порядковый номер картинки.
  rId: number
}

// Якорь oneCellAnchor: точка привязки — левый верхний угол, размер задан явно.
// Картинка не тянется за размером ячейки, зато и не искажается при переносе строк.
export function oneCellAnchor(anchor: OneCellAnchor) {
  return `<xdr:oneCellAnchor><xdr:from><xdr:col>${anchor.col}</xdr:col><xdr:colOff>${anchor.colOffEmu}</xdr:colOff><xdr:row>${anchor.row}</xdr:row><xdr:rowOff>${anchor.rowOffEmu}</xdr:rowOff></xdr:from><xdr:ext cx="${anchor.cx}" cy="${anchor.cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${anchor.id}" name="${xml(anchor.name)}" descr="${xml(anchor.descr)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${anchor.rId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${anchor.cx}" cy="${anchor.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
}

export function drawingXml(anchors: string[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join('')}</xdr:wsDr>`
}
