#!/usr/bin/env node
// UserPromptSubmit: агент не видит размер своего контекста, поэтому обязанность из CLAUDE.md
// «контекст раздулся — предложи закрыть сессию» сама не срабатывает. Хук берёт контекст
// последнего ответа из лога сессии и на каждом новом пороге один раз подсказывает агенту.
// Сбой хука молчит: выход 0 без вывода.
import { openSync, readSync, fstatSync, closeSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const THRESHOLDS = [250_000, 400_000, 550_000]
// Читаем только хвост лога — длинная сессия весит десятки мегабайт
const TAIL = 4 * 1024 * 1024

function lastCtx(path) {
  const fd = openSync(path, 'r')
  try {
    const size = fstatSync(fd).size
    const len = Math.min(size, TAIL)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    const lines = buf.toString('utf8').split('\n')
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].includes('"usage"')) continue
      let o
      try {
        o = JSON.parse(lines[i])
      } catch {
        continue
      }
      // ответы субагентов (isSidechain) и служебные сообщения — не контекст ведущего
      if (o.type !== 'assistant' || o.isSidechain || o.message?.model === '<synthetic>' || !o.message?.usage) continue
      const u = o.message.usage
      return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
    }
  } finally {
    closeSync(fd)
  }
  return null
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const ctx = lastCtx(input.transcript_path)
  if (ctx === null) process.exit(0)
  const state = join(tmpdir(), `argo-warehouse-ctx-${input.session_id}`)
  let warned = 0
  try {
    warned = Number(readFileSync(state, 'utf8')) || 0
  } catch {}
  if (ctx < 200_000) warned = 0 // после /compact пороги считаются заново
  const hit = THRESHOLDS.filter((t) => ctx >= t && t > warned).pop()
  if (hit) {
    console.log(
      `[хук контекста ARGO] контекст ~${Math.round(ctx / 1000)}k (порог ${hit / 1000}k). Ответь прорабу на его реплику, ` +
        'а в конце одной строкой предложи закрыть сессию после текущего шага (/session-close), не бросая начатое.',
    )
  }
  writeFileSync(state, String(hit ?? warned))
} catch {}
process.exit(0)
