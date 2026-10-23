import { db } from "../db/index.js"
import { stock, movimientosStock } from "../db/schema.js"
import { eq, and } from "drizzle-orm"
import { idUnico } from "../utils/id.js"

import { aCentavos, deCentavos } from "./money.js"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function getStock(tx: Tx, depositoId: string, articuloId: string) {
  return tx
    .select()
    .from(stock)
    .where(and(eq(stock.depositoId, depositoId), eq(stock.articuloId, articuloId)))
    .get()
}

/**
 * Aplica un delta de stock (positivo = ingreso, negativo = egreso).
 * No valida saldo: el sistema permite stock negativo y se reporta aparte.
 */
export function aplicarStock(
  tx: Tx,
  params: {
    depositoId: string
    articuloId: string
    delta: number
    costoUnitario: number
  },
) {
  const { depositoId, articuloId, delta, costoUnitario } = params
  const costoC = Math.max(0, aCentavos(costoUnitario))
  const actual = getStock(tx, depositoId, articuloId)

  if (!actual) {
    tx.insert(stock)
      .values({
        id: idUnico("stk"),
        depositoId,
        articuloId,
        cantidad: delta,
        costoPromedio: deCentavos(costoC),
        createdAt: new Date(),
      })
      .run()
    return
  }

  const cantidad = actual.cantidad + delta
  let costoPromedioC = aCentavos(actual.costoPromedio)

  // TODO(calculos): deberia ser `=== 0`, no `<= 0`. Cuando el deposito sigue
  // en negativo y entra mercaderia, esto descarta el costo promedio real de
  // las unidades que quedan y lo reemplaza por el costo de la entrada.
  // Corregirlo cambia los numeros de valorizacion.

  if (delta > 0) {
    if (actual.cantidad <= 0) {
      costoPromedioC = costoC
    } else {
      costoPromedioC = Math.round(
        (actual.cantidad * costoPromedioC + delta * costoC) / cantidad,
      )
    }
  }

  tx.update(stock)
    .set({ cantidad, costoPromedio: deCentavos(costoPromedioC) })
    .where(eq(stock.id, actual.id))
    .run()
}

/**
 * `anulacion` es un tipo de movimiento, no un borrado.
 *
 * Cuando se anula un remito no se borra la fila original: se agrega un
 * movimiento de tipo `anulacion` con el mismo `referenciaId`. Asi el kardex
 * muestra la salida y su compensating, en vez de fingir que nunca ocurrio.
 */
export function crearMovimiento(
  tx: Tx,
  params: {
    fecha: string
    tipo: "ingreso" | "egreso" | "transferencia" | "ajuste" | "anulacion"
    articuloId: string
    depositoOrigenId?: string | null
    depositoDestinoId?: string | null
    cantidad: number
    costoUnitario: number
    referenciaTipo?: string | null
    referenciaId?: string | null
    motivo?: string | null
  },
): string {
  const id = idUnico("mvt")

  tx.insert(movimientosStock)
    .values({
      id,
      fecha: params.fecha,
      tipo: params.tipo,
      articuloId: params.articuloId,
      depositoOrigenId: params.depositoOrigenId ?? null,
      depositoDestinoId: params.depositoDestinoId ?? null,
      cantidad: params.cantidad,
      costoUnitario: deCentavos(
        Math.max(0, aCentavos(params.costoUnitario)),
      ),
      referenciaTipo: params.referenciaTipo ?? null,
      referenciaId: params.referenciaId ?? null,
      motivo: params.motivo ?? null,
      createdAt: new Date(),
    })
    .run()

  return id
}

export function eliminarMovimiento(tx: Tx, id: string) {
  tx.delete(movimientosStock).where(eq(movimientosStock.id, id)).run()
}
