import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { periodos } from "../db/schema.js"

import { eq, desc } from "drizzle-orm"

import {
  calcularSnapshot,
  obtenerPeriodo,
  type Snapshot,
} from "../services/periodos.service.js"

import { hoyISO } from "../utils/fecha.js"

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string" || !raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function leerParametros(req: Request) {
  const mes = parseInt((req.params.mes ?? req.query.mes) as string, 10)
  const anio = parseInt((req.params.anio ?? req.query.anio) as string, 10)

  if (!mes || mes < 1 || mes > 12 || !anio || anio < 2000) {
    return null
  }

  return { mes, anio }
}

export function getAll(_req: Request, res: Response) {
  const rows = db
    .select()
    .from(periodos)
    .orderBy(desc(periodos.anio), desc(periodos.mes))
    .all()
    .map((p) => ({
      ...p,
      snapshot: undefined,
      snapshotCerrado: p.snapshot ? true : false,
    }))

  res.json(rows)
}

export function getByPeriodo(req: Request, res: Response) {
  const params = leerParametros(req)

  if (!params) {
    res.status(400).json({ error: "Mes o año inválidos" })

    return
  }

  const periodo = obtenerPeriodo(params.mes, params.anio)

  if (!periodo) {
    res.status(404).json({ error: "Ese mes no tiene período registrado" })

    return
  }

  res.json({ ...periodo, snapshot: parseJson<Snapshot>(periodo.snapshot) })
}

/**
 * Cierra el mes: congela el snapshot y bloquea la edición posterior.
 * Si ya estaba cerrado, no lo vuelve a cerrar ni pisa el snapshot previo.
 */
export function cerrar(req: Request, res: Response) {
  const params = leerParametros(req)

  if (!params) {
    res.status(400).json({ error: "Mes o año inválidos" })

    return
  }

  const { mes, anio } = params

  const existente = obtenerPeriodo(mes, anio)

  if (existente?.estado === "cerrado") {
    res.status(409).json({
      error: `El mes ${mes}/${anio} ya está cerrado. Reabrilo si necesitás volver a cerrarlo.`,
    })

    return
  }

  const snapshot = calcularSnapshot(mes, anio)

  const now = new Date()

  const fechaCierre = hoyISO()

  if (existente) {
    db.update(periodos)
      .set({
        estado: "cerrado",
        snapshot: JSON.stringify(snapshot),
        fechaCierre,
        observaciones:
          typeof req.body.observaciones === "string"
            ? req.body.observaciones.trim() || null
            : existente.observaciones,
        updatedAt: now,
      })
      .where(eq(periodos.id, existente.id))
      .run()

    return res.json({ ok: true, id: existente.id, snapshot })
  }

  const id = idUnico("per")

  db.insert(periodos)
    .values({
      id,
      mes,
      anio,
      estado: "cerrado",
      snapshot: JSON.stringify(snapshot),
      fechaCierre,
      observaciones:
        typeof req.body.observaciones === "string"
          ? req.body.observaciones.trim() || null
          : null,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  res.status(201).json({ ok: true, id, snapshot })
}

/**
 * Reabre el mes. Guarda el snapshot anterior en observaciones no aplica: se
 * reemplaza, así que quien necesite el dato viejo debería exportarlo antes.
 */
export function abrir(req: Request, res: Response) {
  const params = leerParametros(req)

  if (!params) {
    res.status(400).json({ error: "Mes o año inválidos" })

    return
  }

  const { mes, anio } = params

  const existente = obtenerPeriodo(mes, anio)

  if (!existente) {
    res.status(404).json({ error: "Ese mes no está registrado" })

    return
  }

  if (existente.estado !== "cerrado") {
    res.status(409).json({ error: `El mes ${mes}/${anio} ya está abierto` })

    return
  }

  db.update(periodos)
    .set({
      estado: "abierto",
      fechaCierre: null,
      updatedAt: new Date(),
    })
    .where(eq(periodos.id, existente.id))
    .run()

  res.json({ ok: true })
}

/** Compara un mes contra su snapshot para ver si los datos cambiaron. */
export function preview(req: Request, res: Response) {
  const params = leerParametros(req)

  if (!params) {
    res.status(400).json({ error: "Mes o año inválidos" })

    return
  }

  const actual = calcularSnapshot(params.mes, params.anio)

  res.json(actual)
}