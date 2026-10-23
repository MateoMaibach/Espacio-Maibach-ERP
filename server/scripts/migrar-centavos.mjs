/**
 * Migracion a centavos.
 *
 * Multiplica por 100 todas las columnas que guardan PESOS y las pasa a
 * CENTAVOS enteros. El API sigue hablando pesos: la conversion ocurre en el
 * tipo de columna `centavos` de `src/db/schema.ts`, en el borde con SQLite.
 *
 * Solo toca columnas de dinero. NO toca `created_at`/`updated_at` (epoch
 * millis), ni flags (`activa`, `afecta_general`, `aplica_pago_proveedor`,
 * `mano_obra_vereda_aplica`), ni contadores (`orden`, `cantidad`, `nro_cuota`,
 * `cant_cuotas`, `numero`, `mes`, `anio`).
 *
 * Los blobs JSON (`compras.items`, `ordenes_pago.detalles`,
 * `ordenes_pago.compras_pagadas`, `ficheros.costos` y `periodos.snapshot`)
 * quedan en PESOS: la app los lee y escribe en pesos, igual que el API. Solo
 * se convierten las columnas SQL.
 *
 * `tipo_cambio` es una TASA, no un monto: no se multiplica. En el esquema
 * nuevo la columna es REAL para no perder decimales.
 *
 * Uso:
 *   node scripts/migrar-centavos.mjs --dry-run
 *   node scripts/migrar-centavos.mjs
 */

import Database from "better-sqlite3"
import { existsSync, copyFileSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

const HERE = dirname(fileURLToPath(import.meta.url))
const SERVER = resolve(HERE, "..")

config({ path: resolve(SERVER, ".env") })

const DRY_RUN = process.argv.includes("--dry-run")
const dbPath = resolve(SERVER, process.env.DATABASE_URL || "./data/espacio.db")

if (!existsSync(dbPath)) {
  console.error(`No existe la base en ${dbPath}`)
  process.exit(1)
}

/**
 * Copia consistente de la base.
 *
 * No sirve con `copyFile`: el esquema y los datos viven en el `-wal`, y copiar
 * el `.db` pelado (o copiar el `-shm` de otro proceso) deja una base sin
 * tablas. `VACUUM INTO` hace checkpoint y escribe un archivo limpio.
 */
function snapshotLimpio(destino) {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${destino}${s}`, { force: true })

  const origen = new Database(dbPath, { readonly: true })
  origen.pragma("busy_timeout = 5000")
  origen.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`)
  origen.close()

  return destino
}

/**
 * En dry run trabajamos sobre una copia temporal.
 *
 * No alcanza con no ejecutar los ALTER: el resto del script consulta las
 * columnas que acaba de agregar, asi que la base necesita el mismo esquema
 * nuevo. La copia se tira al terminar y el archivo real no se toca.
 */
let dbFile = dbPath
let temporal = null

if (DRY_RUN) {
  temporal = join(dirname(dbPath), `.dryrun-centavos-${process.pid}.db`)
  snapshotLimpio(temporal)
  dbFile = temporal
}

const db = new Database(dbFile)

db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = OFF")

/* ------------------------------------------------------------------ *
 * Columnas de dinero. Todo lo demas queda intacto.
 * ------------------------------------------------------------------ */

const COLUMNAS = [
  // tabla, columna
  ["ficheros", "costo_piscina"],
  ["ficheros", "costo_instalacion"],
  ["ficheros", "costo_equipo_filtrado"],
  ["ficheros", "costo_mano_obra"],
  ["ficheros", "pago_inicial"],

  ["cuotas", "monto_planificado"],
  ["cuotas", "monto_pagado"],

  ["movimientos", "monto"],

  ["cierres", "saldo_inicial"],
  ["cierres", "saldo_final"],
  ["cierres", "saldo_real"],
  ["cierres", "diferencia"],

  ["compras", "total"],

  ["cheques", "importe"],

  ["articulos", "costo_unitario"],

  ["stock", "costo_promedio"],

  ["movimientos_stock", "costo_unitario"],

  ["remitos", "valor_total"],

  ["remito_items", "costo_unitario"],
  ["remito_items", "subtotal"],

  ["historial_costos", "costo"],
]

/**
 * `ficheros.total` es TEXT con formato ("$1.950.000"). Se agrega una columna
 * entera y se rellena con el parser correcto. La TEXT se conserva un release
 * para no romper readers viejos; el codigo nuevo usa `total_centavos`.
 */
const TOTAL_CENTAVOS = "total_centavos"

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function aCentavos(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0
    return Math.round(value * 100)
  }

  if (typeof value !== "string") return 0

  const limpio = value.replace(/[^\d.,-]/g, "")

  if (!limpio) return 0

  const ultimaComa = limpio.lastIndexOf(",")
  const ultimoPunto = limpio.lastIndexOf(".")

  let normalizado = limpio

  if (ultimaComa !== -1 || ultimoPunto !== -1) {
    const sep = Math.max(ultimaComa, ultimoPunto) === ultimoPunto ? "." : ","
    const otro = sep === "." ? "," : "."
    const fin = limpio.lastIndexOf(sep)

    normalizado =
      limpio.length - fin - 1 === 3
        ? limpio.replace(/[.,]/g, "")
        : limpio.slice(0, fin).split(otro).join("") + "." + limpio.slice(fin + 1)
  }

  const n = Number(normalizado)

  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Suma de una columna, ignorando nulls. */
function suma(tabla, columna) {
  const r = db.prepare(`SELECT COALESCE(SUM(${columna}), 0) AS s FROM ${tabla}`).get()
  return r.s
}

function contar(tabla) {
  return db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).get().n
}

function existeColumna(tabla, columna) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all()
  return cols.some(c => c.name === columna)
}

function existeTabla(tabla) {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tabla))
}

/* ------------------------------------------------------------------ *
 * 1. Total de ficheros: columna entera nueva
 * ------------------------------------------------------------------ */

function migrarTotalFicheros() {
  // En dry run la base es una copia, asi que el ALTER se puede ejecutar igual:
  // hace falta para que el resto de este script vea el esquema nuevo.
  if (!existeColumna("ficheros", TOTAL_CENTAVOS)) {
    db.exec(`ALTER TABLE ficheros ADD COLUMN ${TOTAL_CENTAVOS} INTEGER`)
  }

  const pendiente = db
    .prepare(`SELECT COUNT(*) AS n FROM ficheros WHERE ${TOTAL_CENTAVOS} IS NULL`)
    .get().n

  if (pendiente === 0) {
    console.log(`  ficheros.${TOTAL_CENTAVOS}: nada que rellenar`)
    return 0
  }

  const filas = db.prepare(`SELECT id, total FROM ficheros WHERE ${TOTAL_CENTAVOS} IS NULL`).all()

  const upd = db.prepare(`UPDATE ficheros SET ${TOTAL_CENTAVOS} = ? WHERE id = ?`)

  for (const f of filas) upd.run(aCentavos(f.total), f.id)

  console.log(`  ficheros.${TOTAL_CENTAVOS}: ${filas.length} ficheros`)
  for (const f of filas.slice(0, 3)) console.log(`      "${f.total}" -> ${aCentavos(f.total)}`)

  return filas.length
}

/* ------------------------------------------------------------------ *
 * 2. Columnas numericas x100
 * ------------------------------------------------------------------ */

/**
 * Marca de la migracion, para no correrla dos veces sobre la misma base.
 *
 * Ojo: no se puede usar la mera existencia de `total_centavos` como señal,
 * porque la columna se crea antes de rellenarse y una corrida interrumpida
 * dejaria la base a medio camino.
 */
function migracionRegistrada() {
  if (!existeTabla("_migraciones")) return false
  return Boolean(db.prepare(`SELECT nombre FROM _migraciones WHERE nombre = ?`).get("centavos_v1"))
}

function marcarMigracion() {
  db.exec(`CREATE TABLE IF NOT EXISTS _migraciones (nombre TEXT PRIMARY KEY, aplicada_en TEXT)`)
  db.prepare(`INSERT INTO _migraciones (nombre, aplicada_en) VALUES (?, ?)`).run(
    "centavos_v1",
    new Date().toISOString(),
  )
}

/* ------------------------------------------------------------------ *
 * Corrida
 * ------------------------------------------------------------------ */

console.log("\n=== Migracion a centavos ===")
console.log(`  base: ${dbPath}`)
console.log(`  modo: ${DRY_RUN ? "DRY RUN (no se escribe nada)" : "APLICANDO"}\n`)

function cerrar() {
  db.close()

  if (temporal) {
    for (const s of ["", "-wal", "-shm"]) rmSync(`${temporal}${s}`, { force: true })
  }
}

if (migracionRegistrada()) {
  console.log("  La base ya fue migrada a centavos. Salida.")
  cerrar()
  process.exit(0)
}

console.log("ANTES\n")
const antes = {}

for (const [t, c] of COLUMNAS) {
  if (!existeColumna(t, c)) continue
  antes[`${t}.${c}`] = { n: contar(t), s: suma(t, c) }
  console.log(`  ${t}.${c}: suma ${antes[`${t}.${c}`].s}`)
}

if (!DRY_RUN) {
  const backup = `${dbPath}.bak`

  if (!existsSync(backup)) {
    snapshotLimpio(backup)
    console.log(`\n  backup consistente creado en ${backup}`)
  }
}

console.log("\nMIGRANDO\n")

let totalCambios = 0

const correr = () => {
  totalCambios += migrarTotalFicheros()

  for (const [t, c] of COLUMNAS) {
    if (!existeColumna(t, c)) {
      console.log(`  ${t}.${c}: la columna no existe, se saltea`)
      continue
    }

    if (!DRY_RUN) db.exec(`UPDATE ${t} SET ${c} = ${c} * 100`)
    totalCambios += 1
    console.log(`  ${t}.${c}: x100`)
  }
}

if (DRY_RUN) {
  db.transaction(correr)()
} else {
  db.transaction(() => {
    correr()
    marcarMigracion()
  })()
}

console.log("\nDESPUES\n")

const errores = []

for (const [t, c] of COLUMNAS) {
  if (!existeColumna(t, c)) continue

  const ahora = { n: contar(t), s: suma(t, c) }
  const prev = antes[`${t}.${c}`]

  if (!prev) continue

  if (ahora.n !== prev.n) errores.push(`${t}.${c}: cambio el numero de filas (${prev.n} -> ${ahora.n})`)

  // Los enteros de la DB no tienen decimales, asi que comparamos con margen.
  if (Math.abs(ahora.s - prev.s * 100) > Math.max(1, Math.abs(prev.s) * 0.001)) {
    errores.push(`${t}.${c}: suma inesperada ${ahora.s} (esperaba ~${prev.s * 100})`)
  } else {
    console.log(`  ${t}.${c}: suma ${ahora.s} (era ${prev.s}, x100 = ${prev.s * 100})`)
  }
}

cerrar()

console.log("")

if (errores.length) {
  console.error("  ERRORES DE VERIFICACION:\n")

  for (const e of errores) console.error(`    - ${e}`)

  cerrar()
  process.exit(1)
}

console.log(`  ${totalCambios} cambios. Verificacion OK.`)

if (DRY_RUN) console.log("\n  (dry run: no se escribio nada)\n")
else console.log("\n  Migracion aplicada. Reinicia el server.\n")