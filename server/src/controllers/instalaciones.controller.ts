import { Request, Response } from "express"

import { db } from "../db/index.js"

import { instalaciones, ficheros, clientes, equipos } from "../db/schema.js"

import { eq, and, gte, lte, desc } from "drizzle-orm"

const ESTADOS = ["Pendiente", "Confirmada", "En Proceso", "Completada"]

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

function validarFecha(fecha: unknown): string | null {
  if (fecha === undefined || fecha === null || String(fecha) === "")
    return "La fecha es obligatoria"

  if (!FECHA_REGEX.test(String(fecha)))
    return "La fecha debe tener formato yyyy-mm-dd"

  return null
}

function validarEquipo(equipoId: unknown): string | null {
  if (equipoId === undefined || equipoId === null || equipoId === "")
    return null

  const existe = db
    .select()
    .from(equipos)
    .where(eq(equipos.id, String(equipoId)))
    .get()

  if (!existe) return "El equipo indicado no existe"

  return null
}

function getFichero(ficheroId: string) {
  return db.select().from(ficheros).where(eq(ficheros.id, ficheroId)).get()
}

type Row = {
  instalacion: typeof instalaciones.$inferSelect

  clienteId: string

  clienteNombre: string

  clienteDireccion: string | null

  ficheroItems: string

  ficheroTotal: string

  ficheroFecha: string

  equipoNombre: string | null

  equipoEncargado: string | null
}

function mapRow(r: Row) {
  let items: unknown[] = []

  try {
    const parsed = JSON.parse(r.ficheroItems)

    if (Array.isArray(parsed)) items = parsed
  } catch {
    items = []
  }

  return {
    ...r.instalacion,

    clienteId: r.clienteId,

    clienteNombre: r.clienteNombre,

    clienteDireccion: r.clienteDireccion ?? null,

    ficheroItems: items,

    ficheroTotal: r.ficheroTotal,

    ficheroFecha: r.ficheroFecha,

    equipoNombre: r.equipoNombre ?? null,

    equipoEncargado: r.equipoEncargado ?? null,
  }
}

function queryBase() {
  return db

    .select({
      instalacion: instalaciones,

      clienteId: ficheros.clienteId,

      clienteNombre: clientes.nombre,

      clienteDireccion: clientes.direccion,

      ficheroItems: ficheros.items,

      ficheroTotal: ficheros.total,

      ficheroFecha: ficheros.fecha,

      equipoNombre: equipos.nombre,

      equipoEncargado: equipos.encargado,
    })

    .from(instalaciones)

    .innerJoin(ficheros, eq(instalaciones.ficheroId, ficheros.id))

    .innerJoin(clientes, eq(ficheros.clienteId, clientes.id))

    .leftJoin(equipos, eq(instalaciones.equipoId, equipos.id))
}

export function getAll(req: Request, res: Response) {
  const { desde, hasta } = req.query as { desde?: string; hasta?: string }

  const condiciones = []

  if (desde && FECHA_REGEX.test(desde))
    condiciones.push(gte(instalaciones.fecha, desde))

  if (hasta && FECHA_REGEX.test(hasta))
    condiciones.push(lte(instalaciones.fecha, hasta))

  const rows = queryBase()

    .where(condiciones.length > 0 ? and(...condiciones) : undefined)

    .orderBy(desc(instalaciones.fecha), desc(instalaciones.id))

    .all()

  res.json(rows.map(mapRow))
}

export function getById(req: Request, res: Response) {
  const row = queryBase()
    .where(eq(instalaciones.id, req.params.id as string))
    .get()

  if (!row) {
    res.status(404).json({ error: "Instalación no encontrada" })

    return
  }

  res.json(mapRow(row))
}

export function getVentas(_req: Request, res: Response) {
  const rows = db

    .select({
      fichero: ficheros,

      clienteNombre: clientes.nombre,

      clienteDireccion: clientes.direccion,
    })

    .from(ficheros)

    .innerJoin(clientes, eq(ficheros.clienteId, clientes.id))

    .orderBy(desc(ficheros.createdAt), desc(ficheros.id))

    .all()

  const programadas = db.select().from(instalaciones).all()

  const porFichero = new Map(programadas.map((i) => [i.ficheroId, i.id]))

  res.json(
    rows.map((r) => {
      let items: unknown[] = []

      try {
        const parsed = JSON.parse(r.fichero.items)

        if (Array.isArray(parsed)) items = parsed
      } catch {
        items = []
      }

      return {
        ficheroId: r.fichero.id,

        clienteId: r.fichero.clienteId,

        clienteNombre: r.clienteNombre,

        clienteDireccion: r.clienteDireccion ?? null,

        fechaVenta: r.fichero.fecha,

        items,

        total: r.fichero.total,

        estado: r.fichero.estado,

        instalacionId: porFichero.get(r.fichero.id) ?? null,
      }
    }),
  )
}

export function create(req: Request, res: Response) {
  const { ficheroId, fecha, equipoId, estado, notas } = req.body

  const faltantes: string[] = []

  if (!ficheroId || String(ficheroId).trim() === "") faltantes.push("ficheroId")

  if (validarFecha(fecha)) faltantes.push("fecha")

  if (faltantes.length > 0) {
    res
      .status(400)
      .json({ error: `Faltan campos obligatorios: ${faltantes.join(", ")}` })

    return
  }

  const fichero = getFichero(String(ficheroId))

  if (!fichero) {
    res.status(404).json({ error: "La venta (fichero) indicada no existe" })

    return
  }

  const duplicada = db
    .select()
    .from(instalaciones)
    .where(eq(instalaciones.ficheroId, String(ficheroId)))
    .get()

  if (duplicada) {
    res
      .status(409)
      .json({ error: "Esta venta ya tiene una instalación programada" })

    return
  }

  const errorEquipo = validarEquipo(equipoId)

  if (errorEquipo) {
    res.status(400).json({ error: errorEquipo })

    return
  }

  const estadoFinal = estado || "Pendiente"

  if (!ESTADOS.includes(estadoFinal)) {
    res
      .status(400)
      .json({ error: `Estado inválido. Debe ser: ${ESTADOS.join(", ")}` })

    return
  }

  const id = `ins_${Date.now()}`

  db.insert(instalaciones)
    .values({
      id,

      ficheroId: String(ficheroId),

      fecha: String(fecha),

      equipoId: equipoId || null,

      estado: estadoFinal,

      notas: notas ? String(notas) : null,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(instalaciones)
    .where(eq(instalaciones.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Instalación no encontrada" })

    return
  }

  const { ficheroId, fecha, equipoId, estado, notas } = req.body

  if (fecha !== undefined) {
    const errorFecha = validarFecha(fecha)

    if (errorFecha) {
      res.status(400).json({ error: errorFecha })

      return
    }
  }

  if (ficheroId !== undefined) {
    const fichero = getFichero(String(ficheroId))

    if (!fichero) {
      res.status(404).json({ error: "La venta (fichero) indicada no existe" })

      return
    }

    const duplicada = db

      .select()

      .from(instalaciones)

      .where(eq(instalaciones.ficheroId, String(ficheroId)))

      .all()

      .find((i) => i.id !== existing.id)

    if (duplicada) {
      res
        .status(409)
        .json({ error: "Esta venta ya tiene una instalación programada" })

      return
    }
  }

  const errorEquipo = validarEquipo(equipoId)

  if (errorEquipo) {
    res.status(400).json({ error: errorEquipo })

    return
  }

  if (estado !== undefined && !ESTADOS.includes(estado)) {
    res
      .status(400)
      .json({ error: `Estado inválido. Debe ser: ${ESTADOS.join(", ")}` })

    return
  }

  db.update(instalaciones)
    .set({
      ...(ficheroId !== undefined && { ficheroId: String(ficheroId) }),

      ...(fecha !== undefined && { fecha: String(fecha) }),

      ...(equipoId !== undefined && { equipoId: equipoId || null }),

      ...(estado !== undefined && { estado }),

      ...(notas !== undefined && { notas: notas ? String(notas) : null }),
    })
    .where(eq(instalaciones.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(instalaciones)
    .where(eq(instalaciones.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Instalación no encontrada" })

    return
  }

  db.delete(instalaciones)
    .where(eq(instalaciones.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
