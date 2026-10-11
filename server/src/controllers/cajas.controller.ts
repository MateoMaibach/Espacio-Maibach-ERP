import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { cajas, movimientos } from "../db/schema.js"

import { eq } from "drizzle-orm"

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(cajas).all()

  all.sort((a, b) => a.orden - b.orden)

  res.json(all)
}

export function create(req: Request, res: Response) {
  const { nombre, color, orden, afectaGeneral } = req.body

  if (typeof nombre !== "string" || !nombre.trim() || !color) {
    res.status(400).json({ error: "Faltan campos obligatorios: nombre, color" })

    return
  }

  const nombreLimpio = nombre.trim()

  const existing = db
    .select()
    .from(cajas)
    .where(eq(cajas.nombre, nombreLimpio))
    .get()

  if (existing) {
    res.status(400).json({ error: "Ya existe una caja con ese nombre" })

    return
  }

  const maxOrden = db
    .select()
    .from(cajas)
    .all()
    .reduce((max, c) => Math.max(max, c.orden), 0)

  const id = idUnico("caj")

  db.insert(cajas)
    .values({
      id,

      nombre: nombreLimpio,

      color,

      orden: orden ?? maxOrden + 1,

      activa: 1,

      afectaGeneral: afectaGeneral ?? 1,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(cajas)
    .where(eq(cajas.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Caja no encontrada" })

    return
  }

  const { nombre, color, orden, activa, afectaGeneral } = req.body

  let nombreLimpio: string | undefined

  if (nombre !== undefined) {
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "El nombre no puede quedar vacio" })

      return
    }

    nombreLimpio = nombre.trim()

    if (nombreLimpio !== existing.nombre) {
      const dup = db
        .select()
        .from(cajas)
        .where(eq(cajas.nombre, nombreLimpio))
        .get()

      if (dup) {
        res.status(400).json({ error: "Ya existe una caja con ese nombre" })

        return
      }
    }
  }

  db.update(cajas)
    .set({
      ...(nombreLimpio !== undefined && { nombre: nombreLimpio }),

      ...(color !== undefined && { color }),

      ...(orden !== undefined && { orden }),

      ...(activa !== undefined && { activa }),

      ...(afectaGeneral !== undefined && { afectaGeneral }),
    })
    .where(eq(cajas.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(cajas)
    .where(eq(cajas.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Caja no encontrada" })

    return
  }

  const movCount = db
    .select()
    .from(movimientos)
    .where(eq(movimientos.subCaja, existing.nombre))
    .all()

  if (movCount.length > 0) {
    res
      .status(400)
      .json({
        error:
          "No se puede eliminar: tiene movimientos asociados. Podés desactivarla en su lugar.",
      })

    return
  }

  db.delete(cajas)
    .where(eq(cajas.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
