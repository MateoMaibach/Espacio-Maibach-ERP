import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { periodos } from "../db/schema.js"

import { eq, desc } from "drizzle-orm"

import {
  calcularSnapshot,
  obtenerPeriodo,
  desviosDePeriodo,
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

function parseSnapshot(raw: string): Snapshot | null {
  return parseJson<Snapshot>(raw)
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

  const desvios = desviosDePeriodo(periodo.id)

  res.json({
    ...periodo,
    snapshot: parseJson<Snapshot>(periodo.snapshot),
    desviaciones: desvios,
    desfasado: desvios.length > 0,
  })
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

  /**
   * No tiene sentido cerrar un mes que todavia no ocurrio: el snapshot queda
   * congelado con los datos parciales del mes en curso, y cuando el mes
   * termine nadie lo vuelve a cerrar porque ya figura como cerrado.
   */
  const hoy = new Date()

  if (anio > hoy.getFullYear() || (anio === hoy.getFullYear() && mes > hoy.getMonth() + 1)) {
    res.status(400).json({
      error: `No se puede cerrar ${mes}/${anio}: ese mes todavía no ocurrió.`,
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

  /**
   * Abrir no revierte nada: solo baja el flag. Si quedan meses posteriores
   * cerrados, el resultado es un ledger donde un mes abierto tiene meses
   * cerrados encima, y no se sabe cual de los dosSnapshot es el bueno.
   */
  const posteriores = db
    .select()
    .from(periodos)
    .all()
    .filter(
      p =>
        p.estado === "cerrado" &&
        (p.anio > anio || (p.anio === anio && p.mes > mes)),
    )

  if (posteriores.length > 0) {
    const lista = posteriores
      .map(p => `${p.mes}/${p.anio}`)
      .sort()
      .join(", ")

    res.status(409).json({
      error:
        `No se puede abrir ${mes}/${anio}: hay meses posteriores cerrados (${lista}). ` +
        `Reabrilos en orden inverso, empezando por ${lista.split(", ").pop()?.trim()}.`,
    })

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

/**
 * Compara el estado actual de un mes contra su snapshot guardado.
 *
 * El comentario de arriba prometía esta comparación desde antes, pero el
 * código solo recalculaba y devolvía el estado actual: no decía si el
 * período cerrado seguía reflejando la realidad. Como varias tablas que
 * alimentan el snapshot (compras, remitos, stock, cuotas, cheques) no están
 * congeladas, ese desfase es real y hay que verlo.
 *
 * `generadoEn` se excluye de la comparación porque cambia en cada corrida.
 */
export function preview(req: Request, res: Response) {
  const params = leerParametros(req)

  if (!params) {
    res.status(400).json({ error: "Mes o año inválidos" })

    return
  }

  const actual = calcularSnapshot(params.mes, params.anio)

  const periodo = obtenerPeriodo(params.mes, params.anio)

  const guardado = periodo?.snapshot ? parseSnapshot(periodo.snapshot) : null

  if (!guardado) {
    return res.json({ ...actual, desfasado: false, diferencias: [] })
  }

  const diferencias: {
    campo: string
    guardado: unknown
    actual: unknown
  }[] = []

  const recorrer = (a: unknown, b: unknown, prefijo: string) => {
    if (typeof a === "number" && typeof b === "number") {
      if (a !== b) {
        diferencias.push({
          campo: prefijo,
          guardado: a,
          actual: b,
        })
      }

      return
    }

    if (a && b && typeof a === "object" && typeof b === "object") {
      for (const clave of new Set([
        ...Object.keys(a as object),
        ...Object.keys(b as object),
      ])) {
        const va = (a as Record<string, unknown>)[clave]

        const vb = (b as Record<string, unknown>)[clave]

        if (clave === "generadoEn") continue

        recorrer(va, vb, prefijo ? `${prefijo}.${clave}` : clave)
      }
    }
  }

  recorrer(guardado, actual, "")

  res.json({
    ...actual,
    desfasado: diferencias.length > 0,
    diferencias,
    snapshotGuardadoEn: guardado.generadoEn ?? null,
  })
}