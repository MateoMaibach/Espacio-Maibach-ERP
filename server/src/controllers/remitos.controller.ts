import { Request, Response } from "express"
import { db } from "../db/index.js"
import {
  remitos,
  remitoItems,
  depositos,
  articulos,
  movimientosStock,
} from "../db/schema.js"
import { eq, desc, sql, and } from "drizzle-orm"
import {
  aplicarStock,
  crearMovimiento,
  eliminarMovimiento,
  hoy,
} from "../services/stock.service.js"

export const TIPOS_REMITO = ["salida", "transferencia"]
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface LineaRemito {
  articuloId: string
  cantidad: number
  costoUnitario: number
}

function existeDeposito(id: string) {
  return db.select().from(depositos).where(eq(depositos.id, id)).get()
}

function existeArticulo(id: string) {
  return db.select().from(articulos).where(eq(articulos.id, id)).get()
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getAll(req: Request, res: Response) {
  const { tipo, depositoId, desde, hasta } = req.query as Record<
    string,
    string | undefined
  >

  const conds = []
  if (tipo) conds.push(eq(remitos.tipo, tipo))
  if (desde) conds.push(sql`${remitos.fecha} >= ${desde}`)
  if (hasta) conds.push(sql`${remitos.fecha} <= ${hasta}`)

  let rows = db
    .select()
    .from(remitos)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(remitos.fecha), desc(remitos.numero))
    .all()

  if (depositoId) {
    rows = rows.filter(
      (r) =>
        r.depositoOrigenId === depositoId || r.depositoDestinoId === depositoId,
    )
  }

  const depMap = new Map(
    db.select().from(depositos).all().map((d) => [d.id, d]),
  )

  const itemsCount = db
    .select({ remitoId: remitoItems.remitoId, n: sql<number>`count(*)` })
    .from(remitoItems)
    .groupBy(remitoItems.remitoId)
    .all()
  const counts = new Map(itemsCount.map((r) => [r.remitoId, r.n]))

  const result = rows.map((r) => ({
    ...r,
    etiqueta: `REM-${String(r.numero).padStart(4, "0")}`,
    depositoOrigen: depMap.get(r.depositoOrigenId)?.nombre ?? "—",
    depositoDestino: r.depositoDestinoId
      ? (depMap.get(r.depositoDestinoId)?.nombre ?? "—")
      : null,
    articulos: counts.get(r.id) ?? 0,
  }))

  res.json(result)
}

export function getById(req: Request, res: Response) {
  const row = db
    .select()
    .from(remitos)
    .where(eq(remitos.id, req.params.id as string))
    .get()
  if (!row) {
    res.status(404).json({ error: "Remito no encontrado" })
    return
  }

  const items = db
    .select({
      id: remitoItems.id,
      articuloId: remitoItems.articuloId,
      cantidad: remitoItems.cantidad,
      costoUnitario: remitoItems.costoUnitario,
      subtotal: remitoItems.subtotal,
      articuloNombre: articulos.nombre,
      unidad: articulos.unidad,
      codigo: articulos.codigo,
    })
    .from(remitoItems)
    .leftJoin(articulos, eq(remitoItems.articuloId, articulos.id))
    .where(eq(remitoItems.remitoId, row.id))
    .all()

  const depOrigen = existeDeposito(row.depositoOrigenId)
  const depDestino = row.depositoDestinoId ? existeDeposito(row.depositoDestinoId) : null

  const movimientos = db
    .select()
    .from(movimientosStock)
    .where(eq(movimientosStock.referenciaId, row.id))
    .all()

  res.json({
    ...row,
    etiqueta: `REM-${String(row.numero).padStart(4, "0")}`,
    depositoOrigen: depOrigen?.nombre ?? "—",
    depositoDestino: depDestino?.nombre ?? null,
    items,
    movimientos,
  })
}

interface LineaRemitoBody {
  articuloId?: string
  cantidad?: number
  costoUnitario?: number
}

export function create(req: Request, res: Response) {
  const { tipo, depositoOrigenId, depositoDestinoId, destino, fecha, observaciones, lineas } =
    req.body

  const tipoFinal = String(tipo ?? "").trim()
  if (!TIPOS_REMITO.includes(tipoFinal)) {
    res
      .status(400)
      .json({ error: `Tipo inválido. Debe ser: ${TIPOS_REMITO.join(", ")}` })
    return
  }

  const origen = depositoOrigenId ? existeDeposito(String(depositoOrigenId)) : undefined
  if (!origen) {
    res.status(400).json({ error: "Depósito de origen inválido" })
    return
  }

  let destinoDep = undefined
  if (tipoFinal === "transferencia") {
    destinoDep = depositoDestinoId ? existeDeposito(String(depositoDestinoId)) : undefined
    if (!destinoDep) {
      res.status(400).json({ error: "Depósito de destino inválido" })
      return
    }
    if (destinoDep.id === origen.id) {
      res.status(400).json({ error: "El depósito de destino debe ser distinto al de origen" })
      return
    }
  } else {
    if (!destino || !String(destino).trim()) {
      res.status(400).json({ error: "El destino (cliente u obra) es obligatorio" })
      return
    }
    if (depositoDestinoId) {
      res.status(400).json({ error: "Una salida no tiene depósito de destino" })
      return
    }
  }

  if (fecha && !FECHA_REGEX.test(String(fecha))) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })
    return
  }

  if (!Array.isArray(lineas) || lineas.length === 0) {
    res.status(400).json({ error: "Debe incluir al menos un artículo" })
    return
  }

  const normalizadas: LineaRemito[] = []
  for (const [i, raw] of (lineas as LineaRemitoBody[]).entries()) {
    const linea = raw ?? {}
    const articulo = linea.articuloId ? existeArticulo(String(linea.articuloId)) : undefined
    if (!articulo) {
      res.status(400).json({ error: `Línea ${i + 1}: artículo inválido` })
      return
    }
    const cantidad = Math.trunc(Number(linea.cantidad))
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      res
        .status(400)
        .json({ error: `Línea ${i + 1}: la cantidad debe ser mayor a cero` })
      return
    }
    normalizadas.push({
      articuloId: articulo.id,
      cantidad,
      costoUnitario:
        linea.costoUnitario === undefined || linea.costoUnitario === null
          ? articulo.costoUnitario
          : Math.max(0, Math.round(Number(linea.costoUnitario))),
    })
  }

  const fechaFinal = fecha || hoy()

  const result = db.transaction((tx) => {
    const maxRow = tx
      .select({ max: sql<number>`coalesce(max(numero), 0)` })
      .from(remitos)
      .get()
    const numero = (maxRow?.max ?? 0) + 1
    const remitoId = `rem_${Date.now()}`

    tx.insert(remitos)
      .values({
        id: remitoId,
        numero,
        tipo: tipoFinal,
        depositoOrigenId: origen.id,
        depositoDestinoId: destinoDep?.id ?? null,
        destino: destino ? String(destino).trim() : null,
        fecha: fechaFinal,
        estado: "Emitido",
        valorTotal: normalizadas.reduce((s, l) => s + l.cantidad * l.costoUnitario, 0),
        observaciones: observaciones ? String(observaciones).trim() : null,
        movimientoIds: "[]",
        createdAt: new Date(),
      })
      .run()

    const movimientoIds: string[] = []

    for (const linea of normalizadas) {
      tx.insert(remitoItems)
        .values({
          id: `rit_${Date.now()}_${movimientoIds.length}`,
          remitoId,
          articuloId: linea.articuloId,
          cantidad: linea.cantidad,
          costoUnitario: linea.costoUnitario,
          subtotal: linea.cantidad * linea.costoUnitario,
        })
        .run()

      const movimientoId = crearMovimiento(tx, {
        fecha: fechaFinal,
        tipo: tipoFinal === "transferencia" ? "transferencia" : "egreso",
        articuloId: linea.articuloId,
        depositoOrigenId: origen.id,
        depositoDestinoId: destinoDep?.id ?? null,
        cantidad: linea.cantidad,
        costoUnitario: linea.costoUnitario,
        referenciaTipo: "remito",
        referenciaId: remitoId,
        motivo: destinoDep ? `Transferencia a ${destinoDep.nombre}` : (destino ?? null),
      })

      aplicarStock(tx, {
        depositoId: origen.id,
        articuloId: linea.articuloId,
        delta: -linea.cantidad,
        costoUnitario: linea.costoUnitario,
      })

      if (destinoDep) {
        aplicarStock(tx, {
          depositoId: destinoDep.id,
          articuloId: linea.articuloId,
          delta: linea.cantidad,
          costoUnitario: linea.costoUnitario,
        })
      }

      movimientoIds.push(movimientoId)
    }

    tx.update(remitos)
      .set({ movimientoIds: JSON.stringify(movimientoIds) })
      .where(eq(remitos.id, remitoId))
      .run()

    return { remitoId, numero, movimientoIds }
  })

  res.status(201).json({
    ok: true,
    id: result.remitoId,
    numero: result.numero,
    etiqueta: `REM-${String(result.numero).padStart(4, "0")}`,
    movimientos: result.movimientoIds,
  })
}

export function anular(req: Request, res: Response) {
  const existing = db
    .select()
    .from(remitos)
    .where(eq(remitos.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Remito no encontrado" })
    return
  }

  if (existing.estado !== "Emitido") {
    res.status(409).json({ error: "El remito ya fue anulado" })
    return
  }

  const items = db
    .select()
    .from(remitoItems)
    .where(eq(remitoItems.remitoId, existing.id))
    .all()

  const movimientos = parseJson<string[]>(existing.movimientoIds, [])

  db.transaction((tx) => {
    for (const item of items) {
      if (existing.depositoOrigenId) {
        aplicarStock(tx, {
          depositoId: existing.depositoOrigenId,
          articuloId: item.articuloId,
          delta: item.cantidad,
          costoUnitario: item.costoUnitario,
        })
      }

      if (existing.depositoDestinoId) {
        aplicarStock(tx, {
          depositoId: existing.depositoDestinoId,
          articuloId: item.articuloId,
          delta: -item.cantidad,
          costoUnitario: item.costoUnitario,
        })
      }
    }

    for (const movimientoId of movimientos) {
      eliminarMovimiento(tx, movimientoId)
    }

    tx.update(remitos)
      .set({ estado: "Anulado" })
      .where(eq(remitos.id, existing.id))
      .run()
  })

  res.json({ ok: true, estado: "Anulado" })
}
