/**
 * Costes e ingresos de un fichero.
 *
 * Solo los insumos se guardan en la tabla. Todo lo derivado se calcula
 * siempre desde aca, para que no exista la posibilidad de que el margen
 * guardado quede desfasado respecto del total real.
 */

/** "$1.950.000" -> 1950000. Los totales se guardan como texto formateado. */
export function parseMonto(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

  if (typeof value !== "string") return 0

  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0
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
  const comisionMonto = Math.round((venta * (insumos.comisionPct || 0)) / 100)

  const totalCostos =
    insumos.costoPiscina +
    insumos.costoInstalacion +
    insumos.costoEquipoFiltrado +
    insumos.costoManoObra +
    comisionMonto

  const margenNeto = venta - totalCostos

  return {
    ...insumos,
    venta,
    comisionMonto,
    totalCostos,
    margenNeto,
    margenPct: venta > 0 ? Math.round((margenNeto / venta) * 1000) / 10 : 0,
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

    const n = Math.round(parseMonto(body[campo]))

    out[clave] = Number.isFinite(n) && n > MONTO_MINIMO ? n : 0
  }

  if (body.comisionPct !== undefined && body.comisionPct !== null) {
    const pct = Number(body.comisionPct)

    out.comisionPct =
      Number.isFinite(pct) && pct > 0 ? Math.round(pct * 100) / 100 : 0
  }

  return out
}