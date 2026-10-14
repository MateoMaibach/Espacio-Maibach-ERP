import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { movimientos, cierres, cajas, categorias } from "../db/schema.js"

import { eq } from "drizzle-orm"

import { CAT_AJUSTE_CIERRE } from "./categorias.controller.js"

import { montoEnARS, sumarEnARS, sumarMontosEnARS } from "../services/moneda.js"

import { assertMesAbierto } from "../services/periodos.service.js"

function getCurrentDateStr(): string {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function parseFecha(fecha: string): { mes: number; anio: number } | null {
  const parts = fecha.split("-")

  if (parts.length < 3) return null

  const anio = parseInt(parts[0])

  const mes = parseInt(parts[1])

  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) return null

  return { mes, anio }
}

/**
 * Valida que la categoria exista en el catalogo y sea del tipo correcto del
 * movimiento. Devuelve el nombre limpio (o null para "sin categoría") y un
 * mensaje de error si no corresponde.
 */
function validarCategoria(
  valor: unknown,
  tipo: string,
): { valor: string | null; error: string | null } {
  if (valor === undefined || valor === null || valor === "") {
    return { valor: null, error: null }
  }

  const nombre = String(valor).trim()

  if (!nombre) return { valor: null, error: null }

  const categoria = db
    .select({ id: categorias.id, tipo: categorias.tipo })
    .from(categorias)
    .where(eq(categorias.nombre, nombre))
    .get()

  if (!categoria) {
    return { valor: null, error: `La categoría "${nombre}" no existe` }
  }

  if (categoria.tipo !== tipo) {
    return {
      valor: null,
      error: `La categoría "${nombre}" es de tipo ${categoria.tipo} y no puede usarse en un ${tipo}`,
    }
  }

  return { valor: nombre, error: null }
}

export function getMonedas(_req: Request, res: Response) {
  const filas = db
    .select({ moneda: movimientos.moneda })
    .from(movimientos)
    .all()

  const set = new Set<string>(["ARS"])

  for (const f of filas) {
    const m = (f.moneda || "").trim().toUpperCase()

    if (m) set.add(m)
  }

  res.json([...set])
}

export function getAllMovimientos(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1

  const anio = parseInt(req.query.anio as string) || new Date().getFullYear()

  const subCaja = req.query.subCaja as string | undefined

  let allMovimientos = db.select().from(movimientos).all()

  allMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha)

    if (!parsed) return false

    const matchMes = parsed.mes === mes && parsed.anio === anio

    const matchSubCaja =
      !subCaja || subCaja === "Todas" || m.subCaja === subCaja

    return matchMes && matchSubCaja
  })

  allMovimientos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  res.json(allMovimientos)
}

export function getMovimiento(req: Request, res: Response) {
  const movimiento = db
    .select()
    .from(movimientos)
    .where(eq(movimientos.id, req.params.id as string))
    .get()

  if (!movimiento) {
    res.status(404).json({ error: "Movimiento no encontrado" })

    return
  }

  res.json(movimiento)
}

export function createMovimiento(req: Request, res: Response) {
  const {
    fecha,
    concepto,
    monto,
    tipo,
    subCaja,
    moneda,
    tipoCambio,
    categoria,
    comprobante,
    observaciones,
  } = req.body

  if (!concepto || monto == null || monto === "" || !tipo || !subCaja) {
    res
      .status(400)
      .json({
        error: "Faltan campos obligatorios: concepto, monto, tipo, subCaja",
      })

    return
  }

  if (tipo !== "ingreso" && tipo !== "egreso") {
    res.status(400).json({ error: "Tipo debe ser 'ingreso' o 'egreso'" })

    return
  }

  const categoriaFinal = validarCategoria(categoria, tipo)

  if (categoriaFinal.error) {
    res.status(400).json({ error: categoriaFinal.error })

    return
  }

  const id = idUnico("mov")

  const fechaStr = fecha || getCurrentDateStr()

  try {
    assertMesAbierto(fechaStr)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  const monedaStr = moneda || "ARS"

  db.insert(movimientos)
    .values({
      id,

      fecha: fechaStr,

      concepto,

      monto,

      tipo,

      subCaja,

      moneda: monedaStr,

      tipoCambio: tipoCambio || null,

      categoria: categoriaFinal.valor,

      comprobante: comprobante || null,

      observaciones: observaciones || null,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function updateMovimiento(req: Request, res: Response) {
  const existing = db
    .select()
    .from(movimientos)
    .where(eq(movimientos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Movimiento no encontrado" })

    return
  }

  const {
    fecha,
    concepto,
    monto,
    tipo,
    subCaja,
    moneda,
    tipoCambio,
    categoria,
    comprobante,
    observaciones,
  } = req.body

  // Bloquea tanto mover el movimiento hacia un mes cerrado como editarlo si
  // ya está en uno.
  try {
    if (fecha !== undefined) assertMesAbierto(String(fecha))

    assertMesAbierto(existing.fecha)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  if (tipo !== undefined && tipo !== "ingreso" && tipo !== "egreso") {
    res.status(400).json({ error: "Tipo debe ser 'ingreso' o 'egreso'" })

    return
  }

  // "" o null significan "quitar la categoría". Antes el front mandaba
  // undefined y el spread lo salteaba, así que no se podía limpiar.
  const tocaCategoria = "categoria" in req.body
  const categoriaFinal = tocaCategoria
    ? validarCategoria(categoria, tipo ?? existing.tipo)
    : { valor: undefined, error: null as string | null }

  if (categoriaFinal.error) {
    res.status(400).json({ error: categoriaFinal.error })

    return
  }

  db.update(movimientos)
    .set({
      ...(fecha !== undefined && { fecha }),

      ...(concepto !== undefined && { concepto }),

      ...(monto !== undefined && { monto }),

      ...(tipo !== undefined && { tipo }),

      ...(subCaja !== undefined && { subCaja }),

      ...(moneda !== undefined && { moneda }),

      ...(tipoCambio !== undefined && { tipoCambio }),

      ...(tocaCategoria && { categoria: categoriaFinal.valor }),

      ...(comprobante !== undefined && { comprobante }),

      ...(observaciones !== undefined && { observaciones }),
    })
    .where(eq(movimientos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function deleteMovimiento(req: Request, res: Response) {
  const existing = db
    .select()
    .from(movimientos)
    .where(eq(movimientos.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Movimiento no encontrado" })

    return
  }

  try {
    assertMesAbierto(existing.fecha)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  db.delete(movimientos)
    .where(eq(movimientos.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function getCierres(req: Request, res: Response) {
  const subCaja = req.query.subCaja as string | undefined

  let results

  if (subCaja) {
    results = db
      .select()
      .from(cierres)
      .where(eq(cierres.subCaja, subCaja))
      .all()
  } else {
    results = db.select().from(cierres).all()
  }

  results.sort((a, b) => {
    const fa = a.fecha || a.fechaCierre

    const fb = b.fecha || b.fechaCierre

    return fb.localeCompare(fa)
  })

  res.json(results)
}

export function getCierresPreview(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1

  const anio = parseInt(req.query.anio as string) || new Date().getFullYear()

  const subCaja = req.query.subCaja as string

  if (!subCaja) {
    res.status(400).json({ error: "Faltan campos obligatorios: subCaja" })

    return
  }

  const allMovimientos = db.select().from(movimientos).all()

  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha)

    if (!parsed) return false

    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja
  })

  const { total: saldoFinal } = sumarEnARS(mesMovimientos)

  const lastCierre = db
    .select()
    .from(cierres)
    .where(eq(cierres.subCaja, subCaja))
    .all()

    .sort((a, b) =>
      (b.fecha || b.fechaCierre).localeCompare(a.fecha || a.fechaCierre),
    )[0]

  const saldoInicial = lastCierre ? lastCierre.saldoReal : 0

  res.json({
    saldoInicial,
    saldoFinal,
    saldoEsperado: saldoInicial + saldoFinal,
  })
}

export function realizarCierre(req: Request, res: Response) {
  const { mes, anio, subCaja, saldoReal, observaciones, fecha } = req.body

  if (!mes || !anio || !subCaja || saldoReal === undefined) {
    res
      .status(400)
      .json({
        error: "Faltan campos obligatorios: mes, anio, subCaja, saldoReal",
      })

    return
  }

  const allMovimientos = db.select().from(movimientos).all()

  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha)

    if (!parsed) return false

    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja
  })

  const { total: saldoFinal, sinConvertir } = sumarEnARS(mesMovimientos)

  if (sinConvertir > 0) {
    console.warn(
      `[caja] ${sinConvertir} movimiento(s) en moneda extranjera sin tipo de cambio quedan fuera del cierre`,
    )
  }

  const lastCierre = db
    .select()
    .from(cierres)
    .where(eq(cierres.subCaja, subCaja))
    .all()

    .sort((a, b) =>
      (b.fecha || b.fechaCierre).localeCompare(a.fecha || a.fechaCierre),
    )[0]

  const saldoInicial = lastCierre ? lastCierre.saldoReal : 0

  const diff = saldoReal - (saldoInicial + saldoFinal)

  if (diff !== 0) {
    const ajusteTipo = diff > 0 ? "ingreso" : "egreso"

    const ajusteMonto = Math.abs(diff)

    // TODO(calculos): el ajuste se fecha con getCurrentDateStr() en vez de la
  // fecha del periodo cerrado, asi que al cerrar un mes pasado la diferencia
  // aparece en el mes actual y altera el resumen de ese mes.

    db.insert(movimientos)
      .values({
        id: idUnico("mov_ajuste"),

        fecha: getCurrentDateStr(),

        concepto: `Ajuste por cierre ${subCaja} - ${fecha || getCurrentDateStr()}`,

        monto: ajusteMonto,

        tipo: ajusteTipo,

        subCaja,

        moneda: "ARS",

        categoria: CAT_AJUSTE_CIERRE,

        observaciones:
          observaciones || `Diferencia de $${diff.toLocaleString("es-AR")}`,

        createdAt: new Date(),
      })
      .run()
  }

  const id = idUnico("cierre")

  db.insert(cierres)
    .values({
      id,

      mes,

      anio,

      subCaja,

      saldoInicial,

      saldoFinal,

      saldoReal,

      diferencia: diff,

      fecha: fecha || getCurrentDateStr(),

      fechaCierre: getCurrentDateStr(),

      observaciones: observaciones || null,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id, diferencia: diff })
}

export interface ResumenCaja {
  subCajas: Record<string, { total: number; ingresos: number; egresos: number }>
  totalIngresos: number
  totalEgresos: number
  gananciaNeta: number
}

/**
 * Logica compartida entre GET /api/caja/resumen y el dashboard, para que la
 * regla de afectaGeneral no quede duplicada en dos lugares.
 */
export function calcularResumenCaja(mes: number, anio: number): ResumenCaja {
  const allMovimientos = db.select().from(movimientos).all()

  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha)

    if (!parsed) return false

    return parsed.mes === mes && parsed.anio === anio
  })

  const cajasActivas = db
    .select()
    .from(cajas)
    .all()
    .filter((c) => c.activa === 1)

  // Todos los montos se convierten a ARS con el tipo de cambio del
  // movimiento. Los que no se pueden convertir se informs por log para que
  // no contaminen el total en silencio.
  const sinConvertir = mesMovimientos.filter((m) => !montoEnARS(m).convertible)

  if (sinConvertir.length > 0) {
    console.warn(
      `[caja] ${sinConvertir.length} movimiento(s) sin tipo de cambio quedan fuera del resumen: ` +
        sinConvertir.map((m) => `${m.id} (${m.moneda} ${m.monto})`).join(", "),
    )
  }

  const resumen: Record<string, {
    total: number
    ingresos: number
    egresos: number
  }> = {}

  for (const cajaItem of cajasActivas) {
    const scMovimientos = mesMovimientos.filter(
      (m) => m.subCaja === cajaItem.nombre,
    )

    const ingresos = sumarMontosEnARS(
      scMovimientos.filter((m) => m.tipo === "ingreso"),
    ).total

    const egresos = sumarMontosEnARS(
      scMovimientos.filter((m) => m.tipo === "egreso"),
    ).total

    resumen[cajaItem.nombre] = { total: ingresos - egresos, ingresos, egresos }
  }

  const generalMovimientos = mesMovimientos.filter((m) => {
    const caja = cajasActivas.find((c) => c.nombre === m.subCaja)

    return caja ? caja.afectaGeneral === 1 : true
  })

  const totalIngresos = sumarMontosEnARS(
    generalMovimientos.filter((m) => m.tipo === "ingreso"),
  ).total

  const totalEgresos = sumarMontosEnARS(
    generalMovimientos.filter((m) => m.tipo === "egreso"),
  ).total

  return {
    subCajas: resumen,
    totalIngresos,
    totalEgresos,
    gananciaNeta: totalIngresos - totalEgresos,
  }
}

export function getResumenCaja(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1

  const anio = parseInt(req.query.anio as string) || new Date().getFullYear()

  res.json(calcularResumenCaja(mes, anio))
}
