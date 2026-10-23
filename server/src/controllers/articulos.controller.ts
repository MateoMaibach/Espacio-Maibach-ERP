import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"
import { articulos, stock, movimientosStock, remitoItems, historialCostos } from "../db/schema.js"
import { eq, sql } from "drizzle-orm"

import { aCentavos, deCentavos } from "../services/money.js"

export function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

function buscarArticulo(id: string) {
  return db.select().from(articulos).where(eq(articulos.id, id)).get()
}

export function getAll(req: Request, res: Response) {
  const activo = req.query.activo as string | undefined
  const q = ((req.query.q as string) ?? "").trim().toLowerCase()

  let rows = db.select().from(articulos).all()

  if (activo === "1" || activo === "0") {
    rows = rows.filter((a) => a.activo === Number(activo))
  }

  if (q) {
    rows = rows.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        (a.codigo ?? "").toLowerCase().includes(q),
    )
  }

  const stockCount = db
    .select({ articuloId: stock.articuloId, n: sql<number>`count(*)` })
    .from(stock)
    .groupBy(stock.articuloId)
    .all()
  const counts = new Map(stockCount.map((r) => [r.articuloId, r.n]))

  const result = rows.map((a) => ({
    ...a,
    depositos: counts.get(a.id) ?? 0,
  }))

  result.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  res.json(result)
}

export function getById(req: Request, res: Response) {
  const existing = buscarArticulo(req.params.id as string)
  if (!existing) {
    res.status(404).json({ error: "Artículo no encontrado" })
    return
  }
  res.json(existing)
}

function validarCodigo(
  codigo: string | undefined | null,
  excludeId?: string,
): string | null {
  const limpio = (codigo ?? "").trim()
  if (!limpio) return null
  const dup = db
    .select()
    .from(articulos)
    .where(eq(articulos.codigo, limpio))
    .get()
  if (dup && dup.id !== excludeId)
    return "Ya existe un artículo con ese código"
  return null
}

export function create(req: Request, res: Response) {
  const { codigo, nombre, unidad, costoUnitario, activo } = req.body

  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre es obligatorio" })
    return
  }

  const errorCodigo = validarCodigo(codigo)
  if (errorCodigo) {
    res.status(400).json({ error: errorCodigo })
    return
  }

  const costoNum = Number(costoUnitario ?? 0)
  if (!Number.isFinite(costoNum) || costoNum < 0) {
    res.status(400).json({ error: "El costo de referencia no es válido" })
    return
  }

  const costo = deCentavos(aCentavos(costoNum))

  const id = idUnico("art")
  db.insert(articulos)
    .values({
      id,
      codigo: codigo ? String(codigo).trim() : null,
      nombre: String(nombre).trim(),
      unidad: unidad ? String(unidad).trim() : "un",
      costoUnitario: costo,
      activo: activo === undefined ? 1 : activo ? 1 : 0,
      createdAt: new Date(),
    })
    .run()

  if (costo > 0) {
    db.insert(historialCostos)
      .values({
        id: idUnico("hct"),
        articuloId: id,
        costo,
        fecha: hoy(),
        origen: "manual",
        createdAt: new Date(),
      })
      .run()
  }

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = buscarArticulo(req.params.id as string)
  if (!existing) {
    res.status(404).json({ error: "Artículo no encontrado" })
    return
  }

  const { codigo, nombre, unidad, costoUnitario, activo } = req.body

  if (nombre !== undefined && !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre no puede estar vacío" })
    return
  }

  const errorCodigo = validarCodigo(codigo, existing.id)
  if (errorCodigo) {
    res.status(400).json({ error: errorCodigo })
    return
  }

  let costoNuevo: number | null = null

  if (costoUnitario !== undefined) {
    const c = Number(costoUnitario)

    if (!Number.isFinite(c) || c < 0) {
      res.status(400).json({ error: "El costo de referencia no es válido" })
      return
    }

    costoNuevo = deCentavos(aCentavos(c))
  }

  // Mismo criterio que la recepcion de compras (compras.controller.ts): solo
  // se registra historial si el costo cambio de verdad, y el update del
  // articulo y la fila del historial van juntos en la misma transaccion.
  const cambioCosto =
    costoNuevo !== null &&
    aCentavos(costoNuevo) !== aCentavos(existing.costoUnitario)

  db.transaction((tx) => {
    tx.update(articulos)
      .set({
        ...(codigo !== undefined && { codigo: codigo ? String(codigo).trim() : null }),
        ...(nombre !== undefined && { nombre: String(nombre).trim() }),
        ...(unidad !== undefined && { unidad: unidad ? String(unidad).trim() : "un" }),
        ...(costoNuevo !== null && { costoUnitario: costoNuevo }),
        ...(activo !== undefined && { activo: activo ? 1 : 0 }),
      })
      .where(eq(articulos.id, existing.id))
      .run()

    if (cambioCosto) {
      tx.insert(historialCostos)
        .values({
          id: idUnico("hct"),
          articuloId: existing.id,
          costo: costoNuevo as number,
          fecha: hoy(),
          origen: "manual",
          createdAt: new Date(),
        })
        .run()
    }
  })

  res.json({ ok: true })
}

export function historialCostosByArticulo(req: Request, res: Response) {
  const existing = buscarArticulo(req.params.id as string)
  if (!existing) {
    res.status(404).json({ error: "Artículo no encontrado" })
    return
  }

  const rows = db
    .select()
    .from(historialCostos)
    .where(eq(historialCostos.articuloId, existing.id))
    .all()

  const serie = [...rows].sort((a, b) => {
    const ta = a.createdAt?.getTime?.() ?? 0
    const tb = b.createdAt?.getTime?.() ?? 0
    if (ta !== tb) return ta - tb
    return a.id.localeCompare(b.id)
  })

  // Los articulos editados antes de que update anotara el historial tienen el
  // costo real fuera de la serie. Se antepone una fila sintetica con el costo
  // vigente para que el modal no muestre un valor que ya no existe. No se
  // escribe nada en la base: es solo lectura.

  const ultimo = serie[serie.length - 1]

  if (
    existing.costoUnitario > 0 &&
    aCentavos(ultimo?.costo) !== aCentavos(existing.costoUnitario)
  ) {
    serie.push({
      id: `hct_sintetico_${existing.id}`,
      articuloId: existing.id,
      costo: existing.costoUnitario,
      fecha: hoy(),
      origen: "manual",
      referenciaId: null,
      createdAt: new Date(),
    })
  }

  const conVariacion = serie.map((r, i) => {
    const anterior = i > 0 ? serie[i - 1].costo : null
    const variacion =
      anterior === null || anterior === 0
        ? null
        : Math.round(((r.costo - anterior) / anterior) * 1000) / 10
    return { ...r, costoAnterior: anterior, variacion }
  })

  res.json({
    articulo: existing,
    historial: conVariacion.reverse(),
  })
}

export function remove(req: Request, res: Response) {
  const existing = buscarArticulo(req.params.id as string)
  if (!existing) {
    res.status(404).json({ error: "Artículo no encontrado" })
    return
  }

  const conStock = db
    .select({ total: sql<number>`coalesce(sum(cantidad), 0)` })
    .from(stock)
    .where(eq(stock.articuloId, existing.id))
    .get()

  if ((conStock?.total ?? 0) !== 0) {
    res.status(400).json({
      error: "No se puede eliminar: tiene existencias registradas.",
    })
    return
  }

  const movs = db
    .select({ n: sql<number>`count(*)` })
    .from(movimientosStock)
    .where(eq(movimientosStock.articuloId, existing.id))
    .get()

  const remitos = db
    .select({ n: sql<number>`count(*)` })
    .from(remitoItems)
    .where(eq(remitoItems.articuloId, existing.id))
    .get()

  if ((movs?.n ?? 0) > 0 || (remitos?.n ?? 0) > 0) {
    res.status(400).json({
      error: `No se puede eliminar: tiene ${movs?.n ?? 0} movimiento(s) y ${remitos?.n ?? 0} remito(s) asociados. Podés desactivarlo.`,
    })
    return
  }

  db.delete(articulos).where(eq(articulos.id, existing.id)).run()
  res.json({ ok: true })
}
