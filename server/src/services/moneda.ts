import { movimientos } from "../db/schema.js"

type MovimientoLike = typeof movimientos.$inferSelect

/**
 * Convierte un movimiento a pesos. Hasta ahora todos los totales sumaban
 * `monto` crudo, asi que un movimiento de USD por 180.000 contaba como
 * 180.000 pesos y no 180.000 x 1250.
 *
 * `convertible: false` marca el caso de moneda distinta de ARS sin tipo de
 * cambio, para que el caller lo reporte en vez de sumar un numero sin
 * sentido en el total.
 */
export function montoEnARS(m: {
  monto: number
  moneda: string | null
  tipoCambio: number | null
}): { monto: number; convertible: boolean } {
  const moneda = (m.moneda || "ARS").toUpperCase()

  if (moneda === "ARS") return { monto: m.monto, convertible: true }

  if (m.tipoCambio && m.tipoCambio > 0) {
    return { monto: Math.round(m.monto * m.tipoCambio), convertible: true }
  }

  return { monto: 0, convertible: false }
}

/**
 * Suma con signo: ingresos positivos, egresos negativos. Es lo que usan los
 * saldos netos (saldoFinal de un cierre).
 */
export function sumarEnARS(lista: MovimientoLike[]): {
  total: number
  sinConvertir: number
} {
  let total = 0
  let sinConvertir = 0

  for (const m of lista) {
    const r = montoEnARS(m)

    if (!r.convertible) {
      sinConvertir += 1
      continue
    }

    total += m.tipo === "ingreso" ? r.monto : -r.monto
  }

  return { total, sinConvertir }
}

/**
 * Suma como magnitud, sin importar el signo del tipo. Lo usan los totales de
 * ingresos y egresos, que se muestran por separado y después se restan.
 */
export function sumarMontosEnARS(lista: MovimientoLike[]): {
  total: number
  sinConvertir: number
} {
  let total = 0
  let sinConvertir = 0

  for (const m of lista) {
    const r = montoEnARS(m)

    if (!r.convertible) {
      sinConvertir += 1
      continue
    }

    total += r.monto
  }

  return { total, sinConvertir }
}