import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { cajas, movimientos, cierres, ordenesPago } from "../db/schema.js"

import { eq } from "drizzle-orm"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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

/**
 * `activa` y `afecta_general` son flags enteros 0/1.
 *
 * Sin coerción, mandar `activa: 7` guardaba un 7. Las lecturas filtran con
 * `=== 1`, así que la caja desaparecía de `/caja/resumen`, del dashboard y de
 * los totales sin avisar. El front manda 0/1 (Caja.tsx compara con `=== 1`),
 * así que hay que seguir aceptando eso.
 */
function flagEntero(valor: unknown): 0 | 1 {
  return Number(valor) ? 1 : 0
}

/**
 * Renombrar una caja arrastra su historial.
 *
 * `movimientos.sub_caja`, `cierres.sub_caja` y
 * `ordenes_pago.detalles[].subCaja` guardan el NOMBRE de la caja en texto
 * plano, sin FK. Si se renombra la caja y no se actualizan, quedan apuntando
 * a un nombre que ya no existe: `calcularResumenCaja` solo recorre las cajas
 * activas, así que ese historial desaparece de los reportes sin avisar.
 */
function renombrarReferencias(tx: Tx, nombreViejo: string, nombreNuevo: string) {
  tx.update(movimientos)
    .set({ subCaja: nombreNuevo })
    .where(eq(movimientos.subCaja, nombreViejo))
    .run()

  tx.update(cierres)
    .set({ subCaja: nombreNuevo })
    .where(eq(cierres.subCaja, nombreViejo))
    .run()

  // Los tramos de una orden de pago viven en un JSON.
  for (const orden of tx.select().from(ordenesPago).all()) {
    let detalles: { subCaja?: string }[] = []

    try {
      const parsed = JSON.parse(orden.detalles)

      if (Array.isArray(parsed)) detalles = parsed
    } catch {
      continue
    }

    if (!detalles.some(d => d?.subCaja === nombreViejo)) continue

    const nuevos = detalles.map(d =>
      d?.subCaja === nombreViejo ? { ...d, subCaja: nombreNuevo } : d,
    )

    tx.update(ordenesPago)
      .set({ detalles: JSON.stringify(nuevos) })
      .where(eq(ordenesPago.id, orden.id))
      .run()
  }
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

  db.transaction(tx => {
    if (nombreLimpio !== undefined && nombreLimpio !== existing.nombre) {
      renombrarReferencias(tx, existing.nombre, nombreLimpio)
    }

    tx.update(cajas)
      .set({
        ...(nombreLimpio !== undefined && { nombre: nombreLimpio }),

        ...(color !== undefined && { color }),

        ...(orden !== undefined && { orden: Number(orden) || 0 }),

        ...(activa !== undefined && { activa: flagEntero(activa) }),

        ...(afectaGeneral !== undefined && { afectaGeneral: flagEntero(afectaGeneral) }),
      })
      .where(eq(cajas.id, req.params.id as string))
      .run()
  })

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
