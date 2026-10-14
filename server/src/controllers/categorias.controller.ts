import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { categorias, movimientos } from "../db/schema.js"

import { eq, sql, and, asc } from "drizzle-orm"

export const TIPOS_CATEGORIA = ["ingreso", "egreso"] as const

/**
 * Categorias que escribe la propia app. Si el usuario las renombra o borra
 * desde el CRUD, estas operaciones seguiran usando el nombre literal y la
 * categoria quedara huerfana; por eso se validan al escribir.
 */
export const CAT_PAGO_PROVEEDOR = "Pago proveedor"

export const CAT_AJUSTE_CIERRE = "Ajuste por cierre"

/**
 * Devuelve la categoria solo si existe en el catalogo, para no dejar valores
 * que el selector del front no pueda mostrar.
 */
export function categoriaValida(nombre: string | undefined | null): string | null {
  if (!nombre) return null

  const existe = db
    .select({ id: categorias.id })
    .from(categorias)
    .where(eq(categorias.nombre, nombre))
    .get()

  return existe ? nombre : null
}

function esTipo(valor: unknown): valor is (typeof TIPOS_CATEGORIA)[number] {
  return TIPOS_CATEGORIA.includes(valor as (typeof TIPOS_CATEGORIA)[number])
}

export function getAll(req: Request, res: Response) {
  const { tipo, incluirInactivas } = req.query as {
    tipo?: string
    incluirInactivas?: string
  }

  const conds = []

  if (tipo && esTipo(tipo)) conds.push(eq(categorias.tipo, tipo))

  if (incluirInactivas !== "1") conds.push(eq(categorias.activa, 1))

  const rows = db
    .select()
    .from(categorias)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(categorias.orden), asc(categorias.nombre))
    .all()

  res.json(rows)
}

/** Nombre de la categoria mas usada, para sugerir valores nuevos. */
export function getUsadas(_req: Request, res: Response) {
  const rows = db
    .select({
      categoria: movimientos.categoria,
      n: sql<number>`count(*)`,
    })
    .from(movimientos)
    .groupBy(movimientos.categoria)
    .all()
    .filter((r) => r.categoria)
    .sort((a, b) => b.n - a.n)

  res.json(rows)
}

export function create(req: Request, res: Response) {
  const { nombre, tipo, color, orden, activa } = req.body

  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre es obligatorio" })

    return
  }

  if (!esTipo(tipo)) {
    res
      .status(400)
      .json({ error: `El tipo debe ser ${TIPOS_CATEGORIA.join(" o ")}` })

    return
  }

  const nombreLimpio = String(nombre).trim()

  const dup = db
    .select()
    .from(categorias)
    .where(eq(categorias.nombre, nombreLimpio))
    .get()

  if (dup) {
    res.status(409).json({ error: "Ya existe una categoría con ese nombre" })

    return
  }

  const maxOrden =
    db
      .select()
      .from(categorias)
      .all()
      .reduce((max, c) => Math.max(max, c.orden), 0) + 1

  const id = idUnico("cat")

  db.insert(categorias)
    .values({
      id,
      nombre: nombreLimpio,
      tipo,
      activa: activa === undefined ? 1 : activa ? 1 : 0,
      color: color ? String(color).trim() : "#64748b",
      orden: orden ?? maxOrden,
      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(categorias)
    .where(eq(categorias.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Categoría no encontrada" })

    return
  }

  const { nombre, tipo, color, orden, activa } = req.body

  let nombreLimpio: string | undefined

  if (nombre !== undefined) {
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "El nombre no puede quedar vacío" })

      return
    }

    nombreLimpio = nombre.trim()

    if (nombreLimpio !== existing.nombre) {
      const dup = db
        .select()
        .from(categorias)
        .where(eq(categorias.nombre, nombreLimpio))
        .get()

      if (dup) {
        res.status(409).json({ error: "Ya existe una categoría con ese nombre" })

        return
      }
    }
  }

  if (tipo !== undefined && !esTipo(tipo)) {
    res
      .status(400)
      .json({ error: `El tipo debe ser ${TIPOS_CATEGORIA.join(" o ")}` })

    return
  }

  db.update(categorias)
    .set({
      ...(nombreLimpio !== undefined && { nombre: nombreLimpio }),
      ...(tipo !== undefined && { tipo }),
      ...(color !== undefined && { color: String(color).trim() }),
      ...(orden !== undefined && { orden }),
      ...(activa !== undefined && { activa: activa ? 1 : 0 }),
    })
    .where(eq(categorias.id, existing.id))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(categorias)
    .where(eq(categorias.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Categoría no encontrada" })

    return
  }

  const usos = db
    .select({ n: sql<number>`count(*)` })
    .from(movimientos)
    .where(eq(movimientos.categoria, existing.nombre))
    .get()

  if ((usos?.n ?? 0) > 0) {
    res.status(409).json({
      error: `No se puede eliminar: hay ${usos?.n} movimiento(s) con esta categoría. Desactivala en su lugar.`,
    })

    return
  }

  db.delete(categorias).where(eq(categorias.id, existing.id)).run()

  res.json({ ok: true })
}