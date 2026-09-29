import { Request, Response } from "express"
import { db } from "../db/index.js"
import { depositos, stock, movimientosStock } from "../db/schema.js"
import { eq, sql, or } from "drizzle-orm"

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(depositos).all()

  const stockCount = db
    .select({ depositoId: stock.depositoId, n: sql<number>`count(*)` })
    .from(stock)
    .groupBy(stock.depositoId)
    .all()

  const counts = new Map(stockCount.map((r) => [r.depositoId, r.n]))

  const rows = all.map((d) => ({
    ...d,
    articulosConStock: counts.get(d.id) ?? 0,
  }))

  rows.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  res.json(rows)
}

export function getById(req: Request, res: Response) {
  const existing = db
    .select()
    .from(depositos)
    .where(eq(depositos.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Depósito no encontrado" })
    return
  }

  res.json(existing)
}

function validarNombre(
  nombre: string | undefined | null,
  excludeId?: string,
): string | null {
  const limpio = (nombre ?? "").trim()
  if (!limpio) return null
  const dup = db
    .select()
    .from(depositos)
    .where(eq(depositos.nombre, limpio))
    .get()
  if (dup && dup.id !== excludeId)
    return "Ya existe un depósito con ese nombre"
  return null
}

export function create(req: Request, res: Response) {
  const { nombre, direccion } = req.body

  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre es obligatorio" })
    return
  }

  const errorNombre = validarNombre(nombre)
  if (errorNombre) {
    res.status(400).json({ error: errorNombre })
    return
  }

  const id = `dep_${Date.now()}`
  db.insert(depositos)
    .values({
      id,
      nombre: String(nombre).trim(),
      direccion: direccion ? String(direccion).trim() : null,
      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(depositos)
    .where(eq(depositos.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Depósito no encontrado" })
    return
  }

  const { nombre, direccion, activo } = req.body

  if (nombre !== undefined && !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre no puede estar vacío" })
    return
  }

  const errorNombre = validarNombre(nombre, existing.id)
  if (errorNombre) {
    res.status(400).json({ error: errorNombre })
    return
  }

  db.update(depositos)
    .set({
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
      ...(direccion !== undefined && {
        direccion: direccion ? String(direccion).trim() : null,
      }),
      ...(activo !== undefined && { activo: activo ? 1 : 0 }),
    })
    .where(eq(depositos.id, existing.id))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(depositos)
    .where(eq(depositos.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Depósito no encontrado" })
    return
  }

  const conStock = db
    .select({ n: sql<number>`count(*)` })
    .from(stock)
    .where(eq(stock.depositoId, existing.id))
    .get()

  if ((conStock?.n ?? 0) > 0) {
    res.status(400).json({
      error: "No se puede eliminar: tiene artículos con stock registrados.",
    })
    return
  }

  const conMovimientos = db
    .select({ n: sql<number>`count(*)` })
    .from(movimientosStock)
    .where(
      or(
        eq(movimientosStock.depositoOrigenId, existing.id),
        eq(movimientosStock.depositoDestinoId, existing.id),
      ),
    )
    .get()

  if ((conMovimientos?.n ?? 0) > 0) {
    res.status(400).json({
      error: "No se puede eliminar: tiene movimientos de stock asociados.",
    })
    return
  }

  db.delete(depositos).where(eq(depositos.id, existing.id)).run()
  res.json({ ok: true })
}
