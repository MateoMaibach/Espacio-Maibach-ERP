/**
 * Runner de la suite de diagnostico de la API.
 *
 * Cada test afirma el comportamiento correcto. Un fallo es un hallazgo, no un
 * error del test: el reporte clasifica lo que se confirmo, lo que ya estaba
 * documentado en el codigo y lo que quedo refutado.
 *
 * Uso:
 *   node scripts/test-api.mjs --base http://localhost:3002
 *   node scripts/test-api.mjs --filter E1
 */

import { tests, makeCtx, BASE } from "./test-api-lib.mjs"

await import("./tests/cobertura.mjs")
await import("./tests/invariantes.mjs")
await import("./tests/hipotesis.mjs")

const argv = process.argv.slice(2)
const filterIdx = argv.indexOf("--filter")
const FILTER = filterIdx >= 0 ? argv[filterIdx + 1] : null

const VERDE = "\x1b[32m"
const ROJO = "\x1b[31m"
const AMARILLO = "\x1b[33m"
const GRIS = "\x1b[90m"
const NEGRITA = "\x1b[1m"
const RESET = "\x1b[0m"

const sevColor = {
  CRITICA: ROJO,
  ALTA: ROJO,
  MEDIA: AMARILLO,
  BAJA: GRIS,
}

const seleccion = FILTER
  ? tests.filter(t => t.id.toUpperCase().startsWith(FILTER.toUpperCase()))
  : tests

if (seleccion.length === 0) {
  console.log(`\n ningun test coincide con --filter ${FILTER}\n`)
  process.exit(1)
}

console.log(`\n${NEGRITA}Suite de diagnostico${RESET}  ${GRIS}${BASE}/api${RESET}`)
console.log(`${GRIS}${seleccion.length} tests${RESET}\n`)

const results = []
const startedAll = Date.now()

for (const t of seleccion) {
  const ctx = makeCtx()
  const started = Date.now()

  try {
    await t.fn(ctx)
  } catch (e) {
    ctx.failures.push(`EXCEPCION: ${e.message}`)
  }

  const ms = Date.now() - started
  const failed = ctx.failures.length > 0

  results.push({ ...t, failures: ctx.failures, ms })

  if (failed) {
    console.log(`  ${ROJO}x${RESET} ${NEGRITA}${t.id}${RESET} ${t.name} ${GRIS}(${ms}ms)${RESET}`)
    for (const f of ctx.failures) {
      console.log(`      ${ROJO}->${RESET} ${f}`)
    }
  } else {
    console.log(`  ${VERDE}o${RESET} ${GRIS}${t.id}${RESET} ${t.name} ${GRIS}(${ms}ms)${RESET}`)
  }
}

/* ------------------------------------------------------------------ *
 * Reporte
 * ------------------------------------------------------------------ */

const elapsed = ((Date.now() - startedAll) / 1000).toFixed(1)
const fallos = results.filter(r => r.failures.length > 0)
const ok = results.length - fallos.length

const confirmados = fallos.filter(r => !r.meta.known)
const conocidos = fallos.filter(r => r.meta.known)

console.log(`\n${NEGRITA}${"=".repeat(72)}${RESET}`)
console.log(
  `${NEGRITA}RESULTADO${RESET}  ${VERDE}${ok} ok${RESET}  ${fallos.length ? ROJO : GRIS}${fallos.length} con hallazgo${RESET}  ${GRIS}${elapsed}s${RESET}\n`,
)

function grupo(titulo, lista, color) {
  if (!lista.length) return

  console.log(`${NEGRITA}${titulo} (${lista.length})${RESET}`)

  const porSev = {}
  for (const r of lista) {
    const sev = r.meta.sev || "SIN SEV"
    ;(porSev[sev] ||= []).push(r)
  }

  const orden = ["CRITICA", "ALTA", "MEDIA", "BAJA", "SIN SEV"]

  for (const sev of orden) {
    const items = porSev[sev]
    if (!items) continue

    console.log(`\n  ${color}${sev}${RESET}`)

    for (const r of items) {
      console.log(`\n  ${NEGRITA}${r.id}${RESET} ${r.name}`)
      if (r.meta.ref) console.log(`    ${GRIS}ref: ${r.meta.ref}${RESET}`)
      if (r.meta.nota) console.log(`    ${GRIS}hipotesis: ${r.meta.nota}${RESET}`)
      for (const f of r.failures) console.log(`    ${ROJO}${f}${RESET}`)
      console.log(`    ${GRIS}bloque: ${r.block}${RESET}`)
    }
  }

  console.log("")
}

grupo("HALLAZGOS NUEVOS (no estaban documentados)", confirmados, ROJO)
grupo("HALLAZGOS CONFIRMADOS (ya documentados en el codigo)", conocidos, AMARILLO)

if (!fallos.length) {
  console.log(`${VERDE}Ningun test fallo.${RESET}\n`)
}

process.exit(fallos.length ? 1 : 0)