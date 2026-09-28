#!/usr/bin/env node
// SessionStart: то, чего нет в git-сводке самого Claude Code (ветка, статус и 5 коммитов там
// уже есть) — невлитые в main ветки сессий, расхождение с origin, указатель на handoff и бюджет
// current-state. После /compact — напоминание перечитать CLAUDE.md.
// Сбой хука старт не блокирует: каждая проверка ловит свою ошибку, общий сбой — строка и выход 0.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const CURRENT_STATE = 'docs/project/current-state.md'
const HANDOFFS = 'docs/handoffs'
// Диета с30: 39,6 → 12,4 КБ (каноны уехали в canons.md). Порог с запасом на рост —
// превышение режем, а не раздвигаем бюджет.
const BUDGET_KB = 16
const TAG = '[хук старта ARGO]'

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

function tryGit(...args) {
  try {
    return git(...args)
  } catch {
    return null
  }
}

// Ветки сессий, не влитые в main, и расхождение с origin (без fetch — по последнему известному состоянию)
function branchLines() {
  const head = git('branch', '--show-current') || '(detached HEAD)'
  const lines = []
  const unmerged = tryGit('branch', '--no-merged', 'main', '--list', 'session-*', '--format=%(refname:short)')
  if (unmerged === null) lines.push('[!] локальной ветки main нет — невлитые ветки не посчитаны.')
  else {
    const list = unmerged.split('\n').filter(Boolean)
    lines.push(
      list.length
        ? `Не влито в main: ${list.map((b) => `${b} (+${tryGit('rev-list', '--count', `main..${b}`) ?? '?'})${b === head ? ' <- HEAD' : ''}`).join(', ')}`
        : 'Ветки session-*: всё влито в main.',
    )
  }

  const counts = tryGit('rev-list', '--left-right', '--count', '@{u}...HEAD')
  if (counts === null) lines.push(`origin: у ${head} нет upstream (ветка не запушена).`)
  else {
    const [behind, ahead] = counts.split(/\s+/).map(Number)
    if (behind || ahead) lines.push(`origin (без fetch): ${head} впереди на ${ahead}, позади на ${behind}.`)
  }
  const mainBehind = tryGit('rev-list', '--count', 'main..origin/main')
  if (mainBehind && Number(mainBehind) > 0) lines.push(`Локальный main позади origin/main на ${mainBehind} — прод ушёл вперёд.`)
  return lines
}

// docs/handoffs/YYYY-MM-DD-N-тема.md → по возрастанию N. Сортировка числовая: лексически 9 встаёт после 10.
function lastHandoff() {
  return readdirSync(join(ROOT, HANDOFFS))
    .map((file) => {
      const m = file.match(/^\d{4}-\d{2}-\d{2}-(\d+)-.+\.md$/)
      return m ? { n: Number(m[1]), file } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.n - b.n)
    .at(-1)
}

function checkPointer() {
  const m = readFileSync(join(ROOT, CURRENT_STATE), 'utf8').match(/\*\*Актуальный handoff:\*\*\s*`([^`]+)`/)
  if (!m) return '[x] в current-state нет строки «**Актуальный handoff:**» с путём в обратных кавычках'
  const rel = m[1]
  if (!existsSync(join(ROOT, rel))) return `[x] указатель «Актуальный handoff» ведёт на несуществующий ${rel}`
  const last = lastHandoff()
  if (last && !rel.endsWith(`/${last.file}`)) return `[x] указатель ведёт на ${rel}, а последний handoff (по номеру) — ${last.file}`
  return `[ok] указатель -> ${rel}`
}

function checkBudget() {
  const kb = statSync(join(ROOT, CURRENT_STATE)).size / 1024
  const shown = kb.toFixed(1).replace('.', ',')
  return kb <= BUDGET_KB
    ? `[ok] current-state ${shown} КБ из ${BUDGET_KB}`
    : `[x] current-state ${shown} КБ — бюджет ${BUDGET_KB} КБ превышен, резать (не раздвигать бюджет)`
}

// Одна упавшая проверка не глушит остальные
function safe(name, fn) {
  try {
    return [fn()].flat()
  } catch (e) {
    return [`[!] ${name}: не проверено — ${e.message}`]
  }
}

function main() {
  let source = ''
  try {
    source = JSON.parse(readFileSync(0, 'utf8') || '{}').source ?? ''
  } catch {}

  const lines = [
    TAG,
    ...safe('ветки', branchLines),
    ...safe('указатель handoff', checkPointer),
    ...safe('бюджет current-state', checkBudget),
  ]
  if (source === 'compact') lines.push('После /compact: перечитать CLAUDE.md и доки текущей задачи (CLAUDE.md, «Рабочий процесс»).')
  console.log(lines.join('\n'))
}

try {
  main()
} catch (e) {
  console.log(`${TAG} сбой хука: ${e.message} — сводку собрать вручную по /session-start.`)
}
