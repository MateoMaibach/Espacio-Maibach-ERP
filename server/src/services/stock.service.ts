import { db } from "../db/index.js"
import { stock, movimientosStock } from "../db/schema.js"
import { eq, and } from "drizzle-orm"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export function idUnico(prefijo: string): string {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
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
  const costo = Math.max(0, Math.round(costoUnitario))
  const actual = getStock(tx, depositoId, articuloId)

  if (!actual) {
    tx.insert(stock)
      .values({
        id: `stk_${Date.now()}_${articuloId.slice(-4)}`,
        depositoId,
        articuloId,
        cantidad: delta,
        costoPromedio: costo,
        createdAt: new Date(),
      })
      .run()
    return
  }

  const cantidad = actual.cantidad + delta
  let costoPromedio = actual.costoPromedio

  if (delta > 0) {
    if (actual.cantidad <= 0) {
      costoPromedio = costo
    } else {
      costoPromedio = Math.round(
        (actual.cantidad * actual.costoPromedio + delta * costo) / cantidad,
      )
    }
  }

  tx.update(stock)
    .set({ cantidad, costoPromedio })
    .where(eq(stock.id, actual.id))
    .run()
}

export function crearMovimiento(
  tx: Tx,
  params: {
    fecha: string
    tipo: "ingreso" | "egreso" | "transferencia" | "ajuste"
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
  const id = `mvt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  tx.insert(movimientosStock)
    .values({
      id,
      fecha: params.fecha,
      tipo: params.tipo,
      articuloId: params.articuloId,
      depositoOrigenId: params.depositoOrigenId ?? null,
      depositoDestinoId: params.depositoDestinoId ?? null,
      cantidad: params.cantidad,
      costoUnitario: Math.max(0, Math.round(params.costoUnitario)),
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
