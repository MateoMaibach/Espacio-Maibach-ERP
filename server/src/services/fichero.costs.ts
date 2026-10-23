/**
 * Costes e ingresos de un fichero.
 *
 * Solo los insumos se guardan en la tabla. Todo lo derivado se calcula
 * siempre desde aca, para que no exista la posibilidad de que el margen
 * guardado quede desfasado respecto del total real.
 */

import { aCentavos, deCentavos } from "./money.js"

/**
 * Lee un monto guardado como texto formateado y devuelve PESOS.
 *
 * Antes: `parseInt(valor.replace(/[^0-9]/g, ""))`. Eso borra los no-dígitos y
 * despues interpreta, asi que `"$1.950.000,50"` -> `"195000050"` -> 195.000.050:
 * una inflación de x100. Con `"100,50"` daba 10050 en vez de 100,50.
 *
 * La versión vieja vivía duplicada en 3 archivos
 * (`fichero.costs.ts`, `dashboard.controller.ts`, `cuotas.controller.ts`).
 * Las tres tienen el mismo defecto; ahora hay una sola y delega en `money.ts`.
 *
 * Nota: devuelve un numero con decimales. Solo se usa para leer las columnas
 * TEXT legacy; las columnas monetarias nuevas guardan centavos enteros.
 */
export function parseMonto(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value !== "string") return 0

  return deCentavos(aCentavos(value))
}

/**
 * Total del fichero en CENTAVOS.
 *
 * Usa la columna espejo `total_centavos`, que es la fuente de verdad nueva.
 * El fallback a `total` (TEXT) cubre filas viejas que todavia no pasaron por
 * el script de migracion.
 */
export function ventaEnCentavos(f: {
  total: string
  totalCentavos?: number | null
}): number {
  return f.totalCentavos ?? aCentavos(parseMonto(f.total))
}

/** Total del fichero en PESOS, para las respuestas del API. */
export function ventaEnPesos(f: {
  total: string
  totalCentavos?: number | null
}): number {
  return deCentavos(ventaEnCentavos(f))
}

export interface Insumos {
  costoPiscina: number
  costoInstalacion: number
  costoEquipoFiltrado: number
  costoManoObra: number
  comisionPct: number
}

export interface Derivados extends Insumos {
  venta: number
  comisionMonto: number
  totalCostos: number
  margenNeto: number
  margenPct: number
}

export function calcularDerivados(venta: number, insumos: Insumos): Derivados {
  const ventaC = aCentavos(venta)

  const comisionC = Math.round((ventaC * (insumos.comisionPct || 0)) / 100)

  const totalCostosC =
    aCentavos(insumos.costoPiscina) +
    aCentavos(insumos.costoInstalacion) +
    aCentavos(insumos.costoEquipoFiltrado) +
    aCentavos(insumos.costoManoObra) +
    comisionC

  const margenNetoC = ventaC - totalCostosC

  return {
    ...insumos,
    venta: deCentavos(ventaC),
    comisionMonto: deCentavos(comisionC),
    totalCostos: deCentavos(totalCostosC),
    margenNeto: deCentavos(margenNetoC),
    margenPct: ventaC > 0 ? Math.round((margenNetoC / ventaC) * 1000) / 10 : 0,
  }
}

const MONTO_MINIMO = 0

/**
 * Normaliza los insumos que llegan del body.
 *
 * Devuelve SOLO las claves presentes: en un update parcial, mandar solo el
 * total no debe borrar los costos que ya estaban cargados. Un valor enviado
 * pero no parseable se guarda como 0 (queda visible y es corregible), en
 * cambio una clave ausente no se toca y deja que el default de la columna
 * o el valor previo hagan su trabajo.
 */
export function leerInsumos(
  body: Record<string, unknown>,
): Partial<Insumos> {
  const out: Partial<Insumos> = {}

  const campos: [keyof Insumos, string][] = [
    ["costoPiscina", "costoPiscina"],
    ["costoInstalacion", "costoInstalacion"],
    ["costoEquipoFiltrado", "costoEquipoFiltrado"],
    ["costoManoObra", "costoManoObra"],
  ]

  for (const [clave, campo] of campos) {
    if (body[campo] === undefined || body[campo] === null) continue

    const n = parseMonto(body[campo])

    out[clave] = Number.isFinite(n) && n > MONTO_MINIMO ? n : 0
  }

  if (body.comisionPct !== undefined && body.comisionPct !== null) {
    const pct = Number(body.comisionPct)

    out.comisionPct =
      Number.isFinite(pct) && pct > 0 ? Math.round(pct * 100) / 100 : 0
  }

  return out
}