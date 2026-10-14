import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { ficheros, clientes } from "../db/schema.js"

import { eq } from "drizzle-orm"

import { calcularDerivados, leerInsumos, parseMonto } from "../services/fichero.costs.js"

import { assertMesAbierto } from "../services/periodos.service.js"

/**
 * Agrega a un fichero los derivados (comisionMonto, totalCostos, margenNeto,
 * margenPct) sin guardarlos, para que el front no los recalcule ni el total
 * congelado pueda quedar viejo.
 */
export function conDerivados<T extends typeof ficheros.$inferSelect>(
  fila: T,
): T & {
  venta: number
  comisionMonto: number
  totalCostos: number
  margenNeto: number
  margenPct: number
} {
  return {
    ...fila,
    ...calcularDerivados(parseMonto(fila.total), {
      costoPiscina: fila.costoPiscina,
      costoInstalacion: fila.costoInstalacion,
      costoEquipoFiltrado: fila.costoEquipoFiltrado,
      costoManoObra: fila.manoObraVeredaAplica === 1 ? fila.costoManoObra : 0,
      comisionPct: fila.comisionPct,
    }),
  }
}

export function upsert(req: Request, res: Response) {
  const clienteId = req.params.id as string

  const cliente = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, clienteId))
    .get()

  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  const existing = db
    .select()
    .from(ficheros)
    .where(eq(ficheros.clienteId, clienteId))
    .get()

  const {
    fecha,
    vendedor,
    items,
    total,
    tipoCobro,
    cantCuotas,
    estado,
  } = req.body

  const insumos = leerInsumos(req.body as Record<string, unknown>)

  const proveedorEnviado = "proveedor" in req.body
  const proveedor = proveedorEnviado
    ? req.body.proveedor
      ? String(req.body.proveedor).trim()
      : null
    : undefined

  const manoObraEnviado = "manoObraVeredaAplica" in req.body
  const manoObraVeredaAplica = manoObraEnviado
    ? req.body.manoObraVeredaAplica
      ? 1
      : 0
    : undefined

  const comisionTexto =
    insumos.comisionPct !== undefined
      ? `${insumos.comisionPct}%`
      : "comision" in req.body
        ? req.body.comision
          ? String(req.body.comision)
          : null
        : undefined

  if (existing) {
    // No se puede tocar un fichero de un mes cerrado, ni tampoco mover su
    // fecha hacia uno cerrado.
    try {
      assertMesAbierto(existing.fecha)

      if (fecha !== undefined) assertMesAbierto(String(fecha))
    } catch (e) {
      res.status(409).json({ error: (e as Error).message })

      return
    }
  }

  try {
    assertMesAbierto(fecha ? String(fecha) : "")
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  if (existing) {
    db.update(ficheros)
      .set({
        ...(fecha !== undefined && { fecha }),

        ...(vendedor !== undefined && { vendedor }),

        ...(comisionTexto !== undefined && { comision: comisionTexto }),

        ...(items !== undefined && {
          items: typeof items === "string" ? items : JSON.stringify(items),
        }),

        ...(total !== undefined && { total }),

        ...insumos,

        ...(proveedor !== undefined && { proveedor }),

        ...(manoObraVeredaAplica !== undefined && { manoObraVeredaAplica }),

        ...(tipoCobro !== undefined && { tipoCobro }),

        ...(cantCuotas !== undefined && { cantCuotas }),

        ...(estado !== undefined && { estado }),
      })
      .where(eq(ficheros.id, existing.id))
      .run()
  } else {
    const id = idUnico("fich")

    db.insert(ficheros)
      .values({
        id,

        clienteId,

        fecha: fecha || "",

        vendedor: vendedor || "Martín Maibach",

        comision: comisionTexto,

        items: typeof items === "string" ? items : JSON.stringify(items || []),

        total: total || "$0",

        ...insumos,

        proveedor,

        manoObraVeredaAplica,

        tipoCobro: tipoCobro || "libre",

        cantCuotas: cantCuotas || 0,

        estado: estado || "pendiente",

        createdAt: new Date(),
      })
      .run()

    return res.status(201).json({ ok: true, id })
  }

  res.json({ ok: true, id: existing.id })
}

export function remove(req: Request, res: Response) {
  const clienteId = req.params.id as string

  const existing = db
    .select()
    .from(ficheros)
    .where(eq(ficheros.clienteId, clienteId))
    .get()

  if (!existing) {
    res.status(404).json({ error: "El cliente no tiene fichero" })

    return
  }

  try {
    assertMesAbierto(existing.fecha)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  db.delete(ficheros).where(eq(ficheros.id, existing.id)).run()

  res.json({ ok: true })
}
