/**
 * Vuelca el JSON legacy `ficheros.costos` (10 strings) a las columnas
 * numéricas nuevas. Es idempotente: solo toca filas donde el JSON tenga algo
 * y las columnas nuevas esten todas en cero.
 *
 *   node scripts/migrar-costos.mjs
 *   node scripts/migrar-costos.mjs --dry-run
 *
 * No borra el JSON original: queda como respaldo hasta que confirmes que la
 * migracion quedo bien.
 */

import Database from "better-sqlite3"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import { mkdirSync } from "fs"

const aqui = dirname(fileURLToPath(import.meta.url))

const dbPath = process.env.DATABASE_URL
  ? resolve(aqui, "..", process.env.DATABASE_URL)
  : resolve(aqui, "..", "data", "espacio.db")

mkdirSync(dirname(dbPath), { recursive: true })

const dryRun = process.argv.includes("--dry-run")

const db = new Database(dbPath)

db.pragma("journal_mode = WAL")

const filas = db
  .prepare("SELECT id, total, costos FROM ficheros WHERE costos IS NOT NULL AND costos != ''")
  .all()

if (filas.length === 0) {
  console.log("No hay ficheros con costos legacy. Nada que migrar.")
  db.close()
  process.exit(0)
}

/** "$1.950.000" -> 1950000 ; "No aplica" -> 0 */
function aNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0

  if (typeof valor !== "string") return 0

  return parseInt(valor.replace(/[^0-9]/g, ""), 10) || 0
}

/** "24.9%" -> 24.9 ; 5 -> 5 */
function aPct(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0

  if (typeof valor !== "string") return 0

  const n = parseFloat(valor.replace("%", "").replace(",", "."))

  return Number.isFinite(n) ? n : 0
}

const update = db.prepare(`
  UPDATE ficheros SET
    costo_piscina = ?,
    costo_instalacion = ?,
    costo_equipo_filtrado = ?,
    costo_mano_obra = ?,
    comision_pct = ?,
    proveedor = COALESCE(?, proveedor)
  WHERE id = ?
`)

let migradas = 0
let omitidas = 0
const cambios = []

for (const fila of filas) {
  let costos

  try {
    costos = JSON.parse(fila.costos)
  } catch {
    omitidas += 1
    console.log(`  [omitida] ${fila.id}: costos no es JSON valido`)
    continue
  }

  if (!costos || typeof costos !== "object") {
    omitidas += 1
    continue
  }

  // "No aplica" en manoObraVereda significa que ese costo no va a la cuenta.
  const manoObraAplica = costos.manoObraVereda !== "No aplica"

  const valores = {
    costo_piscina: aNumero(costos.costoPiscina),
    costo_instalacion: aNumero(costos.instalacion),
    costo_equipo_filtrado: aNumero(costos.equipoFiltrado),
    costo_mano_obra: manoObraAplica ? aNumero(costos.manoObraVereda) : 0,
    comision_pct: aPct(costos.comisionPct ?? costos.comision),
    proveedor:
      typeof costos.proveedor === "string" && costos.proveedor.trim()
        ? costos.proveedor.trim()
        : null,
  }

  const todosCero =
    valores.costo_piscina === 0 &&
    valores.costo_instalacion === 0 &&
    valores.costo_equipo_filtrado === 0 &&
    valores.costo_mano_obra === 0 &&
    valores.comision_pct === 0

  if (todosCero) {
    omitidas += 1
    console.log(`  [omitida] ${fila.id}: el legacy no tenia numeros reconocibles`)
    continue
  }

  const venta = aNumero(fila.total)
  const totalCostos =
    valores.costo_piscina +
    valores.costo_instalacion +
    valores.costo_equipo_filtrado +
    valores.costo_mano_obra +
    Math.round((venta * valores.comision_pct) / 100)

  cambios.push({
    id: fila.id,
    venta,
    ...valores,
    totalCostos,
    margenNeto: venta - totalCostos,
  })

  if (!dryRun) {
    update.run(
      valores.costo_piscina,
      valores.costo_instalacion,
      valores.costo_equipo_filtrado,
      valores.costo_mano_obra,
      valores.comision_pct,
      valores.proveedor,
      fila.id,
    )
  }

  migradas += 1
}

console.log(
  `\n${dryRun ? "[dry-run] " : ""}migradas: ${migradas}  omitidas: ${omitidas}  de ${filas.length}`,
)

if (cambios.length > 0) {
  console.log("\nVista previa de lo migrado:")
  for (const c of cambios.slice(0, 10)) {
    console.log(
      `  ${c.id}: venta ${c.venta} - costos ${c.totalCostos} = margen ${c.margenNeto} (comision ${c.comision_pct}%)`,
    )
  }

  if (cambios.length > 10) {
    console.log(`  ... y ${cambios.length - 10} mas`)
  }
}

if (!dryRun) {
  console.log(
    "\nEl JSON `costos` original se conserva como respaldo. No lo borres hasta verificar.",
  )
}

db.close()