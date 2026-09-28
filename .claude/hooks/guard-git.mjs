#!/usr/bin/env node
// PreToolUse(Bash): запрет слепого `git add` / `git commit -a` и файлов секретов `.env*` в коммите
// (CLAUDE.md правило 3 и «Рабочий процесс», /checkpoint — коммит поимённо).
// Плюс чинит две ловушки zsh (оболочка агента на macOS) — см. fixSeparators и fixGlobs.
// Сбой самого хука работу не блокирует — fail-open, выходим с 0 без решения.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { basename, resolve } from 'node:path'

const isSecretEnv = (p) => /^\.env(\..+)?$/.test(basename(p)) && !p.endsWith('.example')

// Команда → простые команды (массивы слов). Делим по ; | & ( ) и переводу строки вне кавычек.
// Грубо, но достаточно: тело heredoc в кавычках остаётся одним словом.
export function splitCommands(cmd) {
  const commands = []
  let words = []
  let word = ''
  let inWord = false
  let quote = null
  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endCmd = () => {
    endWord()
    if (words.length) commands.push(words)
    words = []
  }
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < cmd.length) word += cmd[++i]
      else word += c
      continue
    }
    if (c === "'" || c === '"') {
      quote = c
      inWord = true
    } else if (c === '\\' && i + 1 < cmd.length) {
      word += cmd[++i]
      inWord = true
    } else if (c === ' ' || c === '\t') endWord()
    else if ('\n;|&()'.includes(c)) endCmd()
    else {
      word += c
      inWord = true
    }
  }
  endCmd()
  return commands
}

const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])

// ['git', '-C', 'x', 'add', 'a'] → { sub: 'add', args: ['a'] }; не git → null
function parseGit(words) {
  let i = 0
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++
  if (words[i] !== 'git' && !words[i]?.endsWith('/git')) return null
  i++
  while (i < words.length && words[i].startsWith('-')) i += GIT_OPTS_WITH_VALUE.has(words[i]) ? 2 : 1
  return { sub: words[i], args: words.slice(i + 1) }
}

const BLIND_ADD = new Set(['-A', '--all', '-u', '--update', '--no-ignore-removal', '.', './', ':/', '*'])

function checkAdd(args, cwd) {
  for (const a of args) {
    if (BLIND_ADD.has(a) || (/^-[a-zA-Z]+$/.test(a) && /[Au]/.test(a))) {
      return `Хук харнесса: слепой \`git add ${a}\` запрещён — добавляй файлы чекпоинта поимённо: \`git add <файл> …\` (/checkpoint).`
    }
    if (isSecretEnv(a)) {
      return `Хук харнесса: \`${a}\` — файл секретов, в git ему нельзя (CLAUDE.md, правило 3). В git — только \`.env.example\`.`
    }
    // каталог целиком заберёт и неотслеживаемое — чужие черновики и файлы параллельного агента
    const abs = resolve(cwd, a)
    if (!a.startsWith('-') && existsSync(abs) && statSync(abs).isDirectory()) {
      const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', a], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .filter(Boolean)
      if (untracked.length) {
        return `Хук харнесса: \`git add ${a}\` заберёт неотслеживаемые файлы (${untracked.length}): ${untracked.slice(0, 5).join(', ')}${untracked.length > 5 ? ' …' : ''}. Добавляй файлы поимённо (/checkpoint).`
      }
    }
  }
  return null
}

const COMMIT_OPTS_WITH_VALUE = new Set(['-m', '-F', '-C', '-c', '-t', '--author', '--date', '--template', '--fixup', '--squash', '--cleanup', '--file', '--message'])

function checkCommit(args, cwd) {
  for (let j = 0; j < args.length; j++) {
    const a = args[j]
    if (a === '--') break
    if (COMMIT_OPTS_WITH_VALUE.has(a)) {
      j++
      continue
    }
    if (a === '-a' || a === '--all') return commitAllReason()
    if (/^-[a-zA-Z]+$/.test(a)) {
      // кластер коротких флагов: после m/F/C/c/t идёт значение, дальше буквы не флаги
      for (const ch of a.slice(1)) {
        if (ch === 'a') return commitAllReason()
        if ('mFCct'.includes(ch)) break
      }
    }
  }
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter((f) => f && isSecretEnv(f))
  if (staged.length) {
    return `Хук харнесса: в индексе файл секретов — ${staged.join(', ')}. Убери из индекса (\`git restore --staged <файл>\`) и коммить без него (CLAUDE.md, правило 3).`
  }
  return null
}

const commitAllReason = () =>
  'Хук харнесса: `git commit -a` запрещён — он забирает все изменённые файлы. Сначала `git add` поимённо, потом `git commit` (/checkpoint).'

export function verdict(command, cwd = process.cwd()) {
  if (!command.includes('git')) return null
  for (const words of splitCommands(command)) {
    const g = parseGit(words)
    if (!g) continue
    const reason = g.sub === 'add' ? checkAdd(g.args, cwd) : g.sub === 'commit' ? checkCommit(g.args, cwd) : null
    if (reason) return reason
  }
  return null
}

// zsh: слово, начинающееся с `=`, — подстановка `=cmd`; `echo =====` падает «==== not found» и рвёт
// цепочку `;`/`&&`. Переписываем разделитель на `-----`; решение о правах не выставляем — команда
// идёт обычной проверкой (автомод, запрос прораба).
export const fixSeparators = (cmd) => cmd.replace(/(\becho[ \t]+)(=+)(?=[ \t;&|)\n]|$)/g, (_, e, eq) => e + '-'.repeat(eq.length))
// zsh: `grep --include=*.ts` без кавычек — «no matches found» → берём глоб в кавычки.
// Только вне кавычек (внутри '…' / "…" это чужая строка — JSON, текст) и не в командах с heredoc.
const GLOB_OPT = /^[ \t]--(?:include|exclude|exclude-dir)=/
export function fixGlobs(cmd) {
  if (cmd.includes('<<')) return cmd
  let out = ''
  let quote = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) {
      if (c === quote) quote = null
      out += c
      continue
    }
    if (c === "'" || c === '"') quote = c
    const m = GLOB_OPT.exec(cmd.slice(i, i + 20))
    if (m) {
      const start = i + m[0].length
      let end = start
      while (end < cmd.length && !/[\s;|&)]/.test(cmd[end])) end++
      const val = cmd.slice(start, end)
      if (/[*?[]/.test(val) && !/['"\\]/.test(val)) {
        // `*.{ts,tsx}` в кавычках grep понял бы буквально — раскрываем в несколько опций
        const br = /^(.*)\{([^{}]*,[^{}]*)\}(.*)$/.exec(val)
        const vals = br ? br[2].split(',').map((x) => br[1] + x + br[3]) : [val]
        out += vals.map((v) => m[0] + `'${v}'`).join('')
        i = end - 1
        continue
      }
    }
    out += c
  }
  return out
}
export const fixShell = (cmd) => fixGlobs(fixSeparators(cmd))

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
  const command = input.tool_input?.command ?? ''
  const reason = verdict(command, input.cwd || process.cwd())
  if (!reason) {
    const fixed = fixShell(command)
    if (fixed !== command) {
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input.tool_input, command: fixed } } }),
      )
    }
    return
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }),
  )
}

try {
  main()
} catch {
  // fail-open
}
