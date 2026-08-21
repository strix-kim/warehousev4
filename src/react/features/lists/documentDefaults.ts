// Дефолты рабочего документа и реквизиты компании: один источник и для формы
// редактора, и для выгрузки в Excel. Раньше строки лежали двумя копиями, и
// «Заказчик не указан» в форме мог разъехаться с тем же полем в файле.

export const listDocumentDefaults = {
  ru: {
    name: 'Техническое обеспечение мероприятия',
    clientName: 'Заказчик не указан',
    venue: 'Площадка мероприятия',
  },
  uz: {
    name: 'Tadbirni texnik ta’minlash',
    clientName: 'Buyurtmachi ko‘rsatilmagan',
    venue: 'Tadbir maydoni',
  },
} as const

// Единственное написание юрлица. В коде было два («ARGO-MEDIA» в шапке бланка
// и «ARGO MEDIA» в грифе утверждения, колонтитулах и заголовке) — оставлено
// частотное «ARGO MEDIA».
export const companyLegalName = {
  ru: 'ООО «ARGO MEDIA»',
  uz: '“ARGO MEDIA” MChJ',
} as const

export const companyDetails = 'Адрес: г. Ташкент, Яшнабадский район, ул. Алимкент, пр. 1, д. 33/1, телефон: (+99890) 175-55-89\nр/с 2020 8000 8055 5124 2001 в ЧАКБ «ORIENT FINANS», МФО: 01071, ИНН: 309 737 673, ОКЭД: 62090'
