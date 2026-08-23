// Сборка пакета OOXML: служебные части (типы содержимого, связи, книга,
// реквизиты документа) одинаковы для любой нашей выгрузки, меняется только лист.
// Отсюда же подключается слой картинок — если он передан.

import { xml } from './cells'
import { workbookStyles } from './styles'
import { zip } from './zip'

export type WorkbookPackageInput = {
  // Имя вкладки; оно же подставляется в имена областей печати.
  sheetName: string
  // Заголовок документа в docProps/core.xml.
  title: string
  // Готовый xl/worksheets/sheet1.xml целиком.
  sheetXml: string
  // Диапазон области печати без имени листа, в абсолютной форме: '$A$1:$E$42'.
  printArea: string
  // Строки, повторяемые на каждой странице, в той же форме: '$18:$18'.
  printTitles: string
  // Слой картинок. Ответственность за `<drawing r:id="rId1"/>` внутри sheetXml и
  // за `xmlns:r` на корне worksheet — у того, кто строит лист: по схеме
  // CT_Worksheet элемент drawing идёт ПОСЛЕ headerFooter, иначе Excel объявляет
  // файл повреждённым и предлагает «восстановить». Все картинки — JPEG.
  drawing?: { xml: string; images: Uint8Array[] }
}

export function buildWorkbookPackage(input: WorkbookPackageInput) {
  const { drawing } = input
  // Без картинок вставки пустые, и служебные части остаются байт в байт прежними.
  const jpegDefault = drawing ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''
  const drawingOverride = drawing ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''

  const files: Array<{ name: string; content: string | Uint8Array }> = [
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${jpegDefault}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${drawingOverride}</Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'docProps/app.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>ARGO Warehouse</Application></Properties>` },
    { name: 'docProps/core.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(input.title)}</dc:title><dc:creator>ARGO Warehouse</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${input.sheetName}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">&apos;${input.sheetName}&apos;!${input.printArea}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">&apos;${input.sheetName}&apos;!${input.printTitles}</definedName></definedNames><calcPr fullCalcOnLoad="1" forceFullCalc="1"/></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', content: workbookStyles },
    { name: 'xl/worksheets/sheet1.xml', content: input.sheetXml },
  ]

  if (drawing) {
    files.push(
      { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>` },
      { name: 'xl/drawings/drawing1.xml', content: drawing.xml },
      // Нумерация rId и имён файлов сквозная с единицы: якорь ссылается на
      // rId{n}, связь ведёт на image{n}.jpeg — тот же n, что индекс в массиве.
      { name: 'xl/drawings/_rels/drawing1.xml.rels', content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawing.images.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.jpeg"/>`).join('')}</Relationships>` },
    )
    drawing.images.forEach((bytes, index) => {
      files.push({ name: `xl/media/image${index + 1}.jpeg`, content: bytes })
    })
  }

  return zip(files)
}
