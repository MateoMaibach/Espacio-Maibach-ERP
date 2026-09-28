import { Request, Response } from "express"

import { db } from "../db/index.js"

import { bancos, cheques } from "../db/schema.js"

import { eq } from "drizzle-orm"

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(bancos).all()

  all.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  res.json(all)
}

export function create(req: Request, res: Response) {
  const { nombre } = req.body

  if (!nombre || !String(nombre).trim()) {
    res.status(400).json({ error: "El nombre es obligatorio" })

    return
  }

  const existing = db
    .select()
    .from(bancos)
    .where(eq(bancos.nombre, String(nombre).trim()))
    .get()

  if (existing) {
    res.status(400).json({ error: "Ya existe un banco con ese nombre" })

    return
  }

  const id = `bnk_${Date.now()}`

  db.insert(bancos)
    .values({
      id,

      nombre: String(nombre).trim(),

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(bancos)
    .where(eq(bancos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Banco no encontrado" })

    return
  }

  const { nombre } = req.body

  if (nombre !== undefined) {
    if (!String(nombre).trim()) {
      res.status(400).json({ error: "El nombre es obligatorio" })

      return
    }

    const dup = db
      .select()
      .from(bancos)
      .where(eq(bancos.nombre, String(nombre).trim()))
      .get()

    if (dup && dup.id !== existing.id) {
      res.status(400).json({ error: "Ya existe un banco con ese nombre" })

      return
    }
  }

  db.update(bancos)
    .set({
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),
    })
    .where(eq(bancos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(bancos)
    .where(eq(bancos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Banco no encontrado" })

    return
  }

  const enUso = db
    .select()
    .from(cheques)
    .where(eq(cheques.banco, existing.nombre))
    .all()

  if (enUso.length > 0) {
    res
      .status(400)
      .json({
        error: `No se puede eliminar: tiene ${enUso.length} cheque(s) asociados.`,
      })

    return
  }

  db.delete(bancos)
    .where(eq(bancos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
