/**
 * Orquestador de la suite de diagnostico de la API.
 *
 * Levanta una instancia AISLADA del servidor contra una base separada
 * (server/data/espacio.test.db, puerto 3002) para no tocar ni la base ni el
 * proceso del servidor de desarrollo (3001).
 *
 * Uso:
 *   node scripts/test-api-run.mjs              # reset + levantar + correr
 *   node scripts/test-api-run.mjs --keep       # no borra la base antes de correr
 *   node scripts/test-api-run.mjs --no-reset   # corre contra un server ya levantado
 */

import { spawn, execSync } from "node:child_process"
import { existsSync, rmSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVER = resolve(HERE, "..")
const DATA_DIR = join(SERVER, "data")
const TEST_DB = "./data/espacio.test.db"
const PORT = process.env.TEST_PORT || "3002"
const BASE = `http://localhost:${PORT}`
const PID_FILE = join(DATA_DIR, ".test-api-server.pid")
const LOG_FILE = join(DATA_DIR, ".test-api-server.log")

const argv = process.argv.slice(2)
const NO_RESET = argv.includes("--no-reset")
const KEEP_DB = argv.includes("--keep") || NO_RESET

let serverProc = null

/** Mate el server de test que haya quedado vivo de una corrida anterior. */
function killPrevious() {
  if (!existsSync(PID_FILE)) return

  const pid = Number(readFileSync(PID_FILE, "utf8").trim())
  rmSync(PID_FILE, { force: true })

  if (!pid) return

  try {
    process.kill(pid)
    console.log(`  server de test anterior detenido (pid ${pid})`)
  } catch {
    /* ya estaba muerto */
  }
}

/**
 * PIDs escuchando en el puerto de test.
 *
 * Multiplataforma: el CI corre en Linux y `netstat -ano` no existe ahi.
 */
function pidsDelPuerto(puerto) {
  if (process.platform === "win32") {
    try {
      const salida = execSync(
        `netstat -ano -p tcp | findstr LISTENING | findstr :${puerto}`,
        { encoding: "utf8" },
      )

      return salida
        .split("\n")
        .map(l => l.trim().match(/LISTENING\s+(\d+)\s*$/)?.[1])
        .filter(Boolean)
        .map(Number)
    } catch {
      return []
    }
  }

  for (const cmd of [`lsof -ti tcp:${puerto} -sTCP:LISTEN`, `fuser ${puerto}/tcp`]) {
    try {
      return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        .split("\n")
        .map(n => Number(n.trim()))
        .filter(n => Number.isInteger(n) && n > 0)
    } catch {
      /* siguiente estrategia */
    }
  }

  return []
}

/**
 * Libera el puerto de test.
 *
 * El PID file cubre las corridas anteriores, pero si alguien levanto el server
 * a mano queda huerfano y el reset de la base falla con EBUSY en Windows.
 * Por eso ademas matamos lo que este escuchando en el puerto.
 */
function killPort() {
  for (const pid of pidsDelPuerto(PORT)) {
    try {
      process.kill(pid)
      console.log(`  liberado el puerto ${PORT} (pid ${pid})`)
    } catch {
      /* ya estaba muerto o no es nuestro */
    }
  }
}

/** Espera N ms. Multiplataforma (el CI corre en Linux). */
function esperar(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Borra la base de test para arrancar desde el estado inicial real.
 *
 * En Windows el handle de SQLite no se libera al instante en que muere el
 * proceso, asi que reintentamos un rato antes de rendirnos.
 */
async function resetDb() {
  const archivos = ["", "-wal", "-shm"].map(s => `${DATA_DIR}/espacio.test.db${s}`)
  let ultimoError = null

  for (let intento = 0; intento < 20; intento++) {
    try {
      for (const a of archivos) rmSync(a, { force: true })
      console.log("  base de test borrada (arranca vacia)")
      return
    } catch (e) {
      ultimoError = e
      await esperar(250)
    }
  }

  throw new Error(
    `no se pudo borrar la base de test: ${ultimoError?.code ?? ultimoError?.message}. ` +
      "Cierra cualquier proceso node que tenga abierto espacio.test.db.",
  )
}

function startServer() {
  // server/data esta en .gitignore: en un checkout nuevo no existe.
  mkdirSync(DATA_DIR, { recursive: true })

  rmSync(LOG_FILE, { force: true })

  serverProc = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: SERVER,
    env: { ...process.env, PORT, DATABASE_URL: TEST_DB },
    stdio: ["ignore", "pipe", "pipe"],
  })

  serverProc.stdout.on("data", c => appendFileSync(LOG_FILE, c))
  serverProc.stderr.on("data", c => appendFileSync(LOG_FILE, c))

  writeFileSync(PID_FILE, String(serverProc.pid))
}

async function waitForHealth(attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`)
      if (res.ok) return true
    } catch {
      /* todavia no escucha */
    }

    await new Promise(r => setTimeout(r, 500))
  }

  return false
}

async function runSuite() {
  return new Promise(resolve => {
    const suite = spawn(process.execPath, [join(HERE, "test-api.mjs"), "--base", BASE], {
      cwd: SERVER,
      stdio: "inherit",
    })

    suite.on("exit", code => resolve(code ?? 1))
  })
}

/** Tests unitarios del modulo de dinero. Requieren tsx para importar el .ts. */
async function runUnit() {
  return new Promise(resolve => {
    const unit = spawn(process.execPath, ["--import", "tsx", join(HERE, "test-money.mjs")], {
      cwd: SERVER,
      stdio: "inherit",
    })

    unit.on("exit", code => resolve(code ?? 1))
  })
}

async function main() {
  console.log("\n=== Suite de diagnostico de la API ===")
  console.log(`  base: ${BASE}/api`)
  console.log(`  db  : ${TEST_DB}\n`)

  if (NO_RESET) {
    console.log("  --no-reset: se usa el server ya levantado\n")
  } else {
    killPrevious()
    killPort()

    if (!KEEP_DB) await resetDb()

    startServer()

    if (!(await waitForHealth())) {
      console.error("\n  ERROR: el server de test no respondio en /api/health")
      console.error(`  Revisa ${LOG_FILE}\n`)
      return 1
    }

    console.log("  server de test arriba\n")
  }

  const codeUnit = await runUnit()

  if (codeUnit !== 0) {
    console.error("\n  ERROR: los tests de money.ts fallaron. No se sigue con la API.\n")

    if (serverProc && !serverProc.killed) {
      serverProc.kill()
      rmSync(PID_FILE, { force: true })
    }

    return codeUnit
  }

  const code = await runSuite()

  if (serverProc && !serverProc.killed) {
    serverProc.kill()
    rmSync(PID_FILE, { force: true })
  }

  return code
}

process.exit(await main())