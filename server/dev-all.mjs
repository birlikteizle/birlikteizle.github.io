import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')

if (!existsSync(viteBin)) {
  console.error('Vite bulunamadı. Önce "npm install" çalıştır.')
  process.exit(1)
}

const children = [
  spawn(process.execPath, [join(root, 'server', 'index.mjs')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, [viteBin], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
]

let shuttingDown = false

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill()
  }

  setTimeout(() => process.exit(code), 500)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown) shutdown(code ?? 0)
  })
}
