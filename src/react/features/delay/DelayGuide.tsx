import { useLanguage } from '../../lib/i18n'
import { CABLE_NS_PER_METER, DELAY_STEP_NS } from './delay'

// «Как читать» и формула под цепочкой. Тексты зависят от топологии: в одной
// линии кабель от мозгов на задержки не влияет, при двух — входит в расчёт.

// Число с единицей не рвём по строкам: «5,6 нс/» на одной и «м» на другой (замечено на 1440).
const NBSP = ' '
const WJ = '⁠'

export function DelayGuide({ twoLines }: { twoLines: boolean }) {
  const { tr, locale } = useLanguage()
  const perMeter = CABLE_NS_PER_METER.toLocaleString(locale)
  const step = DELAY_STEP_NS.toLocaleString(locale)

  return (
    <div className="delay-side">
      <aside className="delay-guide" aria-label={tr('Как читать', 'Qanday o‘qish kerak')}>
        <p className="delay-guide__title">{tr('Как читать', 'Qanday o‘qish kerak')}</p>
        {twoLines ? (
          <ol>
            <li>{tr('Сигнал уходит из мозгов сразу в обе линии и до ближних излучателей доходит раньше.', 'Signal protsessordan ikkala liniyaga birdan chiqadi va yaqin nurlatgichlarga oldinroq yetadi.')}</li>
            <li>{tr('Путь до излучателя — кабель от мозгов плюс кабели линии до него. Самый дальний не ждёт.', 'Nurlatgichgacha yo‘l — protsessordan kabel va liniyadagi undan oldingi kabellar. Eng uzoqdagisi kutmaydi.')}</li>
            <li>{tr('Каждому ставим задержку — на сколько метров его путь короче самого длинного.', 'Har biriga kechikish qo‘yamiz — uning yo‘li eng uzun yo‘ldan necha metr qisqa bo‘lsa, shuncha.')}</li>
            <li>{tr('Обе линии звучат одновременно, поэтому кабель от мозгов тоже в расчёте.', 'Ikkala liniya bir vaqtda yangraydi, shuning uchun protsessordan kabel ham hisobga olinadi.')}</li>
          </ol>
        ) : (
          <ol>
            <li>{tr('Сигнал идёт от мозгов по цепочке и до ближних излучателей доходит раньше.', 'Signal protsessordan zanjir bo‘ylab boradi va yaqin nurlatgichlarga oldinroq yetadi.')}</li>
            <li>{tr('Каждому ставим задержку — сколько сигнал ещё идёт от него до последнего.', 'Har biriga kechikish qo‘yamiz — signal undan oxirgisigacha qancha yursa, shuncha.')}</li>
            <li>{tr('Первый ждёт дольше всех, последний не ждёт — все излучают одновременно.', 'Birinchisi hammadan uzoq kutadi, oxirgisi kutmaydi — hammasi bir vaqtda nurlatadi.')}</li>
            <li>{tr('Кабель от мозгов до первого на задержки не влияет.', 'Protsessordan birinchisigacha bo‘lgan kabel kechikishlarga ta’sir qilmaydi.')}</li>
          </ol>
        )}
      </aside>
      <p className="delay-formula">
        {twoLines ? (
          <>
            {tr('путь = кабель от мозгов + кабели линии до излучателя', 'yo‘l = protsessordan kabel + liniyadagi kabellar')}
            <br />
            {tr(
              `шаг = ⌈${NBSP}(самый длинный путь − путь) × ${perMeter}${NBSP}нс/${WJ}м ÷ ${step}${NBSP}нс${NBSP}⌉`,
              `qadam = ⌈${NBSP}(eng uzun yo‘l − yo‘l) × ${perMeter}${NBSP}ns/${WJ}m ÷ ${step}${NBSP}ns${NBSP}⌉`,
            )}
          </>
        ) : tr(
          `шаг = ⌈${NBSP}кабель после излучателя × ${perMeter}${NBSP}нс/${WJ}м ÷ ${step}${NBSP}нс${NBSP}⌉`,
          `qadam = ⌈${NBSP}nurlatgichdan keyingi kabel × ${perMeter}${NBSP}ns/${WJ}m ÷ ${step}${NBSP}ns${NBSP}⌉`,
        )}
      </p>
    </div>
  )
}
