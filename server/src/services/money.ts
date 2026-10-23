/**
 * Unidad del dinero.
 *
 * Regla unica de todo el servidor: DENTRO de la base y de los calculos la
 * unidad es CENTAVOS (entero). El API habla PESOS (puede ser decimal) y
 * convierte en el borde con `aCentavos` / `deCentavos`.
 *
 * Motivo: las columnas monetarias son INTEGER y cada `Math.round` a mitad de
 * camino perdia centavos. Con centavos enteros la aritmetica es exacta y el
 * redondeo solo aparece una vez, al mostrar.
 *
 * `parseMonto` (fichero.costs.ts) queda viejo a proposito: lee las columnas
 * TEXT legacy. No usar para valores nuevos.
 */

/** Cuantos centavos tiene un peso. */
export const CENTAVOS_POR_PESO = 100

/**
 * Convierte a centavos enteros.
 *
 * Acepta numero o texto en cualquiera de estos formatos:
 *   1950000            -> 195000000
 *   1950000.55         -> 195000055
 *   "$1.950.000"       -> 195000000
 *   "$1.950.000,50"    -> 195000050
 *   "1,950,000.50"     -> 195000050
 *   "1234,56"          -> 123456
 *   "1,234"            -> 123400
 *
 * Devuelve 0 para null/undefined/NaN/texto no parseable. No tira: un valor
 * ilegible tiene que ser visible en la respuesta, no romper el request.
 */
export function aCentavos(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0
    return Math.round(value * CENTAVOS_POR_PESO)
  }

  if (typeof value !== "string") return 0

  const limpio = value.replace(/[^\d.,-]/g, "")

  if (!limpio) return 0

  const normalizado = separarDecimales(limpio)

  const n = Number(normalizado)

  return Number.isFinite(n) ? Math.round(n * CENTAVOS_POR_PESO) : 0
}

/**
 * Centavos -> pesos. La API devuelve pesos; el front formatea a partir de aca.
 */
export function deCentavos(centavos: number): number {
  if (!Number.isFinite(centavos)) return 0
  return centavos / CENTAVOS_POR_PESO
}

/**
 * Igual que `deCentavos` pero para las respuestas que el front ya espera
 * redondeadas: los montos de caja son pesos enteros en la UI.
 */
export function deCentavosEntera(centavos: number): number {
  return Math.round(deCentavos(centavos))
}

/** Centavos -> "$1.234,56". Para logs y mensajes de error. */
export function formatearCentavos(centavos: number): string {
  const pesos = deCentavos(centavos)
  return (
    "$" +
    pesos.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

/**
 * Resuelve cual de `.` o `,` es el separador decimal.
 *
 * El separador decimal es el ULTIMO que aparece, salvo que este seguido de
 * exactamente 3 digitos: en ese caso es de miles.
 *
 *   "1.950.000"    -> 1950000     (3 digitos tras el ultimo punto = miles)
 *   "1,234"        -> 1234        (idem)
 *   "1.950.000,50" -> 1950000.50  (el ultimo es coma y son 2 digitos)
 *   "1,950,000.50" -> 1950000.50  (el ultimo es punto y son 2 digitos)
 */
function separarDecimales(valor: string): string {
  const ultimaComa = valor.lastIndexOf(",")
  const ultimoPunto = valor.lastIndexOf(".")

  if (ultimaComa === -1 && ultimoPunto === -1) return valor

  const sep = Math.max(ultimaComa, ultimoPunto) === ultimoPunto ? "." : ","
  const otro = sep === "." ? "," : "."

  const fin = valor.lastIndexOf(sep)

  // El ultimo separador con 3 digitos detras es de miles, no decimal.
  if (valor.length - fin - 1 === 3) {
    return valor.replace(/[.,]/g, "")
  }

  // Es decimal: el otro separador es de miles y se elimina.
  const entero = valor.slice(0, fin).split(otro).join("")

  return entero + "." + valor.slice(fin + 1)
}

/**
 * Redondea un tipo de cambio a 4 decimales.
 *
 * `tipo_cambio` NO va en centavos: es una tasa (1250,50 ARS por USD), no un
 * monto. Va en REAL. Lo que si estaba mal era el `Math.round` entero que lo
 * truncaba a 1250.
 */
export function redondearTipoCambio(tipoCambio: unknown): number | null {
  if (tipoCambio === null || tipoCambio === undefined || tipoCambio === "") return null

  const n = Number(tipoCambio)

  if (!Number.isFinite(n) || n <= 0) return null

  return Math.round(n * 10000) / 10000
}