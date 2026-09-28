import { Request, Response } from "express"

import { db } from "../db/index.js"

import { equipos } from "../db/schema.js"

import { eq, desc } from "drizzle-orm"

function parseEquipo(row: typeof equipos.$inferSelect) {
  let empleados: string[] = []

  try {
    const parsed = JSON.parse(row.empleados)

    if (Array.isArray(parsed)) empleados = parsed.map(String)
  } catch {
    empleados = []
  }

  return { ...row, empleados }
}

export function getAll(_req: Request, res: Response) {
  const rows = db
    .select()
    .from(equipos)
    .orderBy(desc(equipos.createdAt), desc(equipos.id))
    .all()

  res.json(rows.map(parseEquipo))
}

export function getById(req: Request, res: Response) {
  const row = db
    .select()
    .from(equipos)
    .where(eq(equipos.id, req.params.id as string))
    .get()

  if (!row) {
    res.status(404).json({ error: "Equipo no encontrado" })

    return
  }

  res.json(parseEquipo(row))
}

export function create(req: Request, res: Response) {
  const { nombre, encargado, empleados } = req.body

  const faltantes: string[] = []

  if (!nombre || String(nombre).trim() === "") faltantes.push("nombre")

  if (!encargado || String(encargado).trim() === "") faltantes.push("encargado")

  if (faltantes.length > 0) {
    res
      .status(400)
      .json({ error: `Faltan campos obligatorios: ${faltantes.join(", ")}` })

    return
  }

  let empleadosList: string[] = []

  if (empleados !== undefined && empleados !== null) {
    if (!Array.isArray(empleados)) {
      res.status(400).json({ error: "empleados debe ser una lista de nombres" })

      return
    }

    empleadosList = empleados
      .map((e) => String(e).trim())
      .filter((e) => e !== "")
  }

  const id = `eq_${Date.now()}`

  db.insert(equipos)
    .values({
      id,

      nombre: String(nombre).trim(),

      encargado: String(encargado).trim(),

      empleados: JSON.stringify(empleadosList),

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(equipos)
    .where(eq(equipos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Equipo no encontrado" })

    return
  }

  const { nombre, encargado, empleados } = req.body

  if (nombre !== undefined && String(nombre).trim() === "") {
    res.status(400).json({ error: "El nombre no puede estar vacío" })

    return
  }

  if (encargado !== undefined && String(encargado).trim() === "") {
    res.status(400).json({ error: "El encargado no puede estar vacío" })

    return
  }

  let empleadosList: string[] | undefined

  if (empleados !== undefined) {
    if (!Array.isArray(empleados)) {
      res.status(400).json({ error: "empleados debe ser una lista de nombres" })

      return
    }

    empleadosList = empleados
      .map((e) => String(e).trim())
      .filter((e) => e !== "")
  }

  db.update(equipos)
    .set({
      ...(nombre !== undefined && { nombre: String(nombre).trim() }),

      ...(encargado !== undefined && { encargado: String(encargado).trim() }),

      ...(empleadosList !== undefined && {
        empleados: JSON.stringify(empleadosList),
      }),
    })
    .where(eq(equipos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(equipos)
    .where(eq(equipos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Equipo no encontrado" })

    return
  }

  db.delete(equipos)
    .where(eq(equipos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
