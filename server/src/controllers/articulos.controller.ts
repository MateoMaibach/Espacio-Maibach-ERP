import { Request, Response } from "express"
import { db } from "../db/index.js"
import { articulos, stock, movimientosStock, remitoItems, historialCostos } from "../db/schema.js"
import { eq, sql } from "drizzle-orm"
import { idUnico } from "../services/stock.service.js"

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

  const costo = Math.round(Number(costoUnitario ?? 0))
  if (!Number.isFinite(costo) || costo < 0) {
    res.status(400).json({ error: "El costo de referencia no es válido" })
    return
  }

  const id = `art_${Date.now()}`
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

  if (costoUnitario !== undefined) {
    const costo = Math.round(Number(costoUnitario))
    if (!Number.isFinite(costo) || costo < 0) {
      res.status(400).json({ error: "El costo de referencia no es válido" })
      return
    }
  }

  db.update(articulos)
    .set({
      ...(codigo !== undefined && { codigo: codigo ? String(codigo).trim() : null }),
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(unidad !== undefined && { unidad: unidad ? String(unidad).trim() : "un" }),
      ...(costoUnitario !== undefined && { costoUnitario: Math.round(Number(costoUnitario)) }),
      ...(activo !== undefined && { activo: activo ? 1 : 0 }),
    })
    .where(eq(articulos.id, existing.id))
    .run()

  res.json({ ok: true })
}

export function updateCosto(req: Request, res: Response) {
  const existing = buscarArticulo(req.params.id as string)
  if (!existing) {
    res.status(404).json({ error: "Artículo no encontrado" })
    return
  }

  const costo = Math.round(Number(req.body.costoUnitario ?? req.body.costo))
  if (!Number.isFinite(costo) || costo < 0) {
    res.status(400).json({ error: "El costo de referencia no es válido" })
    return
  }

  if (costo === existing.costoUnitario) {
    res.json({ ok: true, costo })
    return
  }

  db.transaction((tx) => {
    tx.update(articulos)
      .set({ costoUnitario: costo })
      .where(eq(articulos.id, existing.id))
      .run()

    tx.insert(historialCostos)
      .values({
        id: idUnico("hct"),
        articuloId: existing.id,
        costo,
        fecha: hoy(),
        origen: req.body.origen === "compra" ? "compra" : "manual",
        referenciaId: req.body.referenciaId ?? null,
        createdAt: new Date(),
      })
      .run()
  })

  res.json({ ok: true, costo })
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
