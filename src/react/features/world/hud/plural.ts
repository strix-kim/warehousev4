// Склонение для русского — то же правило, что у ruPlural на главной (HomePage.tsx):
// там хелпер локальный и не экспортируется. В узбекском счётное слово не склоняется.
export function ruPlural(count: number, one: string, few: string, many: string) {
  const rule = new Intl.PluralRules('ru').select(count)
  return rule === 'one' ? one : rule === 'few' ? few : many
}
