/**
 * Tests unitarios de los modulos de dinero.
 *
 * Se corren con tsx porque importan archivos .ts del server.
 * Van aparte de la suite HTTP porque no necesitan base ni servidor.
 */

import { aCentavos, deCentavos, formatearCentavos, redondearTipoCambio } from "../src/services/money.ts"

import { calcularDerivados, parseMonto } from "../src/services/fichero.costs.ts"

const RED = "\x1b[31m"
const VERDE = "\x1b[32m"
const GRIS = "\x1b[90m"
const NEGRITA = "\x1b[1m"
const RESET = "\x1b[0m"

let fallos = 0
let total = 0

function eq(actual, esperado, msg) {
  total++

  if (actual !== esperado) {
    fallos++
    console.log(`  ${RED}x${RESET} ${GRIS}money${RESET} ${msg}`)
    console.log(`      ${RED}esperaba ${esperado}, obtuvo ${actual}${RESET}`)
  } else {
    console.log(`  ${VERDE}o${RESET} ${GRIS}money${RESET} ${msg}`)
  }
}

console.log(`\n${NEGRITA}Tests de dinero${RESET}\n`)

/* --- aCentavos: formatos que produce la app --- */
eq(aCentavos("$1.950.000"), 195000000, '"$1.950.000" -> 195.000.000 centavos')
eq(aCentavos("$0"), 0, '"$0" -> 0')
eq(aCentavos(1950000), 195000000, 'numero entero -> centavos')
eq(aCentavos(0), 0, 'cero')

/* --- aCentavos: el bug de la inflation x100 --- */
eq(aCentavos("$1.950.000,50"), 195000050, '"$1.950.000,50" -> 195.000.050 (NO 195.000.000.000)')
eq(aCentavos("100,50"), 10050, '"100,50" -> 10.050 (NO 10.050.000)')
eq(aCentavos(100.5), 10050, '100.5 -> 10.050 centavos')

/* --- aCentavos: formato en-US --- */
eq(aCentavos("1,950,000.50"), 195000050, '"1,950,000.50" -> 195.000.050')
eq(aCentavos("1,234"), 123400, '"1,234" -> 123.400 (3 digitos = miles)')

/* --- aCentavos: entradas degeneradas --- */
eq(aCentavos(null), 0, "null -> 0")
eq(aCentavos(undefined), 0, "undefined -> 0")
eq(aCentavos(""), 0, '"" -> 0')
eq(aCentavos("abc"), 0, '"abc" -> 0')
eq(aCentavos(NaN), 0, "NaN -> 0")
eq(aCentavos(Infinity), 0, "Infinity -> 0")
eq(aCentavos({}), 0, "{} -> 0")

/* --- deCentavos --- */
eq(deCentavos(195000050), 1950000.5, "centavos -> pesos con decimales")
eq(deCentavos(195000000), 1950000, "centavos -> pesos enteros")
eq(deCentavos(0), 0, "0")

/* --- round trip --- */
eq(deCentavos(aCentavos("$1.234.567,89")), 1234567.89, "ida y vuelta conserva los centavos")
eq(deCentavos(aCentavos(12345.67)), 12345.67, "ida y vuelta desde numero")

/* --- formato --- */
eq(formatearCentavos(195000050), "$1.950.000,50", 'formatea "$1.950.000,50"')
eq(formatearCentavos(0), "$0,00", 'formatea "$0,00"')

/* --- tipo de cambio --- */
eq(redondearTipoCambio(1250), 1250, "tipo de cambio entero se mantiene")
eq(redondearTipoCambio(1250.5), 1250.5, "tipo de cambio con decimales ya no se trunca")
eq(redondearTipoCambio(1250.5555), 1250.5555, "tipo de cambio con 4 decimales")
eq(redondearTipoCambio(0), null, "tipo de cambio 0 -> null")
eq(redondearTipoCambio(-5), null, "tipo de cambio negativo -> null")
eq(redondearTipoCambio(null), null, "tipo de cambio null -> null")

/* --- fichero.costs: parseMonto legacy y derivados en centavos --- */
eq(parseMonto("$1.950.000,50"), 1950000.5, 'costs: parseMonto("$1.950.000,50")')
eq(parseMonto(100.5), 100.5, "costs: parseMonto de un numero conserva decimales")
eq(parseMonto("no-es-un-monto"), 0, "costs: parseMonto invalido -> 0")

const derivados = calcularDerivados(100.5, {
  costoPiscina: 10.25,
  costoInstalacion: 5.1,
  costoEquipoFiltrado: 2.05,
  costoManoObra: 1,
  comisionPct: 10,
})

eq(derivados.comisionMonto, 10.05, "costs: comision 10% de 100,50 = 10,05")
eq(derivados.totalCostos, 28.45, "costs: total de costos exacto")
eq(derivados.margenNeto, 72.05, "costs: margen neto exacto")
eq(derivados.margenPct, 71.7, "costs: margen porcentual")

const total2 = total

console.log(
  `\n${NEGRITA}money + costs${RESET}  ${fallos ? RED : VERDE}${total2 - fallos} ok${RESET}  ${fallos ? RED : GRIS}${fallos} fallos${RESET}\n`,
)

process.exit(fallos ? 1 : 0)