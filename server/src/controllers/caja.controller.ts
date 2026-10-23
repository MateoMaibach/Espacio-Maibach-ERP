import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import { movimientos, cierres, cajas, categorias } from "../db/schema.js"

import { eq, and } from "drizzle-orm"

import { CAT_AJUSTE_CIERRE } from "./categorias.controller.js"

import { montoEnARS, sumarEnARS, sumarMontosEnARS } from "../services/moneda.js"

import { assertMesAbierto } from "../services/periodos.service.js"

import { FECHA_REGEX, parseMesAnio } from "../utils/fecha.js"

import {
  aCentavos,
  deCentavos,
  redondearTipoCambio,
} from "../services/money.js"

function getCurrentDateStr(): string {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

/**
 * `movimientos.sub_caja` es TEXT libre sin FK contra `cajas.nombre`. Un
 * movimiento contra una caja inexistente entra al listado pero
 * `calcularResumenCaja` solo recorre las cajas activas, asi que el movimiento
 * queda invisible en los totales. Conviene rechazarlo en el alta.
 *
 * Mismo criterio que `ordenesPago.validarDetalles` (`:130-139`).
 */
function validarSubCaja(nombre: unknown): string | null {
  const limpio = String(nombre ?? "").trim()

  if (!limpio) return "Falta indicar la caja"

  const caja = db.select().from(cajas).where(eq(cajas.nombre, limpio)).get()

  if (!caja) return `La caja "${limpio}" no existe`

  if (caja.activa !== 1) return `La caja "${limpio}" está inactiva`

  return null
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

/**
 * Lee un query param numérico.
 *
 * `parseInt(x) || default` hacia que `?mes=abc` devolviera silenciosamente los
 * movimientos del mes actual, y que `?mes=0` se convirtiera en el mes actual
 * (0 es falsy). Devolver null cuando viene y no es valido lets responde 400.
 */
function leerNumeroQuery(
  valor: unknown,
  nombre: string,
): { valor: number } | { error: string } {
  if (valor === undefined || valor === null || valor === "") {
    return { error: `Falta el parametro "${nombre}"` }
  }

  const n = Number(valor)

  if (!Number.isInteger(n)) {
    return { error: `El parametro "${nombre}" debe ser un numero entero` }
  }

  return { valor: n }
}

export function getAllMovimientos(req: Request, res: Response) {
  const mesRes = leerNumeroQuery(req.query.mes, "mes")

  if ("error" in mesRes) {
    res.status(400).json({ error: mesRes.error })

    return
  }

  const anioRes = leerNumeroQuery(req.query.anio, "anio")

  if ("error" in anioRes) {
    res.status(400).json({ error: anioRes.error })

    return
  }

  const mes = mesRes.valor

  const anio = anioRes.valor

  if (mes < 1 || mes > 12) {
    res.status(400).json({ error: 'El parametro "mes" debe estar entre 1 y 12' })

    return
  }

  const subCaja = req.query.subCaja as string | undefined

  let allMovimientos = db.select().from(movimientos).all()

  allMovimientos = allMovimientos.filter((m) => {
    const parsed = parseMesAnio(m.fecha)

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
    monto: montoRaw,
    tipo,
    subCaja,
    moneda,
    tipoCambio: tipoCambioRaw,
    categoria,
    comprobante,
    observaciones,
  } = req.body

  if (!concepto || montoRaw == null || montoRaw === "" || !tipo || !subCaja) {
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

  /**
   * El signo lo lleva `tipo`, no `monto`. Sin esto, `monto: "abc"` pasaba
   * el chequeo de presencia y se guardaba crudo en una columna INTEGER, y un
   * egreso de -500 se aceptaba y despues se restaba dos veces.
   */
  const montoNum = Number(montoRaw)

  if (!Number.isFinite(montoNum)) {
    res.status(400).json({ error: "El monto debe ser un numero" })

    return
  }

  const montoC = aCentavos(montoNum)

  if (montoC < 0) {
    res.status(400).json({
      error: "El monto no puede ser negativo: usá el tipo ingreso o egreso para el signo",
    })

    return
  }

  if (montoC === 0) {
    res.status(400).json({ error: "El monto debe ser mayor a 0" })

    return
  }

  const monto = deCentavos(montoC)

  // `subCaja` es el NOMBRE de una caja (columna TEXT sin FK). Sin validarlo,
  // un movimiento contra una caja inexistente entra al listado pero
  // `calcularResumenCaja` lo ignora, y el total general no lo ve.
  const errorCaja = validarSubCaja(subCaja)

  if (errorCaja) {
    res.status(400).json({ error: errorCaja })

    return
  }

  const categoriaFinal = validarCategoria(categoria, tipo)

  if (categoriaFinal.error) {
    res.status(400).json({ error: categoriaFinal.error })

    return
  }

  const id = idUnico("mov")

  const fechaStr = fecha || getCurrentDateStr()

  if (!FECHA_REGEX.test(fechaStr)) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })

    return
  }

  try {
    assertMesAbierto(fechaStr)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  const monedaStr = moneda || "ARS"

  const tipoCambio = redondearTipoCambio(tipoCambioRaw)

  if (tipoCambioRaw !== undefined && tipoCambioRaw !== null && tipoCambioRaw !== "" && tipoCambio === null) {
    res.status(400).json({ error: "El tipo de cambio debe ser un numero mayor a 0" })

    return
  }

  db.insert(movimientos)
    .values({
      id,

      fecha: fechaStr,

      concepto,

      monto,

      tipo,

      subCaja,

      moneda: monedaStr,

      tipoCambio,

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

  if (monto !== undefined) {
    const n = Number(monto)

    if (!Number.isFinite(n)) {
      res.status(400).json({ error: "El monto debe ser un numero" })

      return
    }

    if (n <= 0) {
      res.status(400).json({ error: "El monto debe ser mayor a 0" })

      return
    }
  }

  if (subCaja !== undefined) {
    const errorCaja = validarSubCaja(subCaja)

    if (errorCaja) {
      res.status(400).json({ error: errorCaja })

      return
    }
  }

  if (fecha !== undefined && !FECHA_REGEX.test(String(fecha))) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })

    return
  }

  if (
    tipoCambio !== undefined &&
    tipoCambio !== null &&
    tipoCambio !== "" &&
    redondearTipoCambio(tipoCambio) === null
  ) {
    res.status(400).json({ error: "El tipo de cambio debe ser un numero mayor a 0" })

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
      ...(fecha !== undefined && { fecha: String(fecha) }),

      ...(concepto !== undefined && { concepto }),

      ...(monto !== undefined && {
        monto: deCentavos(aCentavos(Number(monto))),
      }),

      ...(tipo !== undefined && { tipo }),

      ...(subCaja !== undefined && { subCaja }),

      ...(moneda !== undefined && { moneda }),

      ...(tipoCambio !== undefined && { tipoCambio: redondearTipoCambio(tipoCambio) }),

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
    const parsed = parseMesAnio(m.fecha)

    if (!parsed) return false

    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja
  })

  const { total: saldoFinalC } = sumarEnARS(mesMovimientos)

  const lastCierre = db
    .select()
    .from(cierres)
    .where(eq(cierres.subCaja, subCaja))
    .all()

    .sort((a, b) =>
      (b.fecha || b.fechaCierre).localeCompare(a.fecha || a.fechaCierre),
    )[0]

  const saldoInicialC = lastCierre ? aCentavos(lastCierre.saldoReal) : 0

  res.json({
    saldoInicial: deCentavos(saldoInicialC),
    saldoFinal: deCentavos(saldoFinalC),
    saldoEsperado: deCentavos(saldoInicialC + saldoFinalC),
  })
}

export function realizarCierre(req: Request, res: Response) {
  const {
    mes: mesRaw,
    anio: anioRaw,
    subCaja,
    saldoReal: saldoRealRaw,
    observaciones,
    fecha,
  } = req.body

  if (!mesRaw || !anioRaw || !subCaja || saldoRealRaw === undefined) {
    res
      .status(400)
      .json({
        error: "Faltan campos obligatorios: mes, anio, subCaja, saldoReal",
      })

    return
  }

  const mes = Number(mesRaw)

  const anio = Number(anioRaw)

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    res.status(400).json({ error: "El mes debe ser un numero entre 1 y 12" })

    return
  }

  if (!Number.isInteger(anio) || anio < 2000) {
    res.status(400).json({ error: "El año debe ser un numero valido" })

    return
  }

  /**
   * Sin este chequeo, `saldoReal: "mucho"` producia `diff = NaN` y se
   * insertaba `Math.abs(NaN)` en una columna INTEGER, reventando con un 500.
   */
  const saldoReal = Number(saldoRealRaw)

  if (!Number.isFinite(saldoReal)) {
    res.status(400).json({ error: "El saldo real debe ser un numero" })

    return
  }

  const saldoRealC = aCentavos(saldoReal)

  const errorCaja = validarSubCaja(subCaja)

  if (errorCaja) {
    res.status(400).json({ error: errorCaja })

    return
  }

  if (fecha !== undefined && !FECHA_REGEX.test(String(fecha))) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })

    return
  }

  // Cerrar dos veces el mismo mes y sub-caja encadena saldos sobre un cierre
  // ya dado, sin que quede registro de que fue un error.
  const yaCerrado = db
    .select()
    .from(cierres)
    .where(
      and(
        eq(cierres.mes, mes),
        eq(cierres.anio, anio),
        eq(cierres.subCaja, subCaja),
      ),
    )
    .get()

  if (yaCerrado) {
    res.status(409).json({
      error: `Ya existe un cierre de "${subCaja}" para ${mes}/${anio}`,
    })

    return
  }

  const allMovimientos = db.select().from(movimientos).all()

  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseMesAnio(m.fecha)

    if (!parsed) return false

    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja
  })

  const { total: saldoFinalC, sinConvertir } = sumarEnARS(mesMovimientos)

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

  const saldoInicialC = lastCierre ? aCentavos(lastCierre.saldoReal) : 0

  const diffC = saldoRealC - (saldoInicialC + saldoFinalC)

  if (diffC !== 0) {
    // El ajuste va con la fecha del periodo que se esta cerrando, no con la de
    // hoy. Con la de hoy, al cerrar un mes pasado la diferencia aparecia en el
    // mes en curso y alteraba un resumen que no le correspondia.
    //
    // `movimientos` es justamente la tabla que el guard de mes cerrado
    // protege. Sin este chequeo, cerrar una caja de un mes cerrado escribia el
    // ajuste igual y se colaba por la puerta de atrás del propio guard.
    try {
      assertMesAbierto(`${anio}-${String(mes).padStart(2, "0")}-01`)
    } catch (e) {
      res.status(409).json({ error: (e as Error).message })

      return
    }
  }

  const id = idUnico("cierre")

  // Ajuste y fila de cierre en una sola transaccion. Antes eran dos escrituras
  // sueltas: si fallaba la segunda, quedaba un movimiento de ajuste sin
  // ningun cierre que lo justificara, y al reintentar se duplicaba el ajuste.
  db.transaction(tx => {
    if (diffC !== 0) {
      const diff = deCentavos(diffC)

      tx.insert(movimientos)
        .values({
          id: idUnico("mov_ajuste"),

          fecha: `${anio}-${String(mes).padStart(2, "0")}-01`,

          concepto: `Ajuste por cierre ${subCaja} - ${mes}/${anio}`,

          monto: deCentavos(Math.abs(diffC)),

          tipo: diffC > 0 ? "ingreso" : "egreso",

          subCaja,

          moneda: "ARS",

          categoria: CAT_AJUSTE_CIERRE,

          observaciones:
            observaciones || `Diferencia de $${diff.toLocaleString("es-AR")}`,

          createdAt: new Date(),
        })
        .run()
    }

    tx.insert(cierres)
      .values({
        id,

        mes,

        anio,

        subCaja,

        saldoInicial: deCentavos(saldoInicialC),

        saldoFinal: deCentavos(saldoFinalC),

        saldoReal: deCentavos(saldoRealC),

        diferencia: deCentavos(diffC),

        fecha: fecha || getCurrentDateStr(),

        fechaCierre: getCurrentDateStr(),

        observaciones: observaciones || null,

        createdAt: new Date(),
      })
      .run()
  })

  res.status(201).json({ ok: true, id, diferencia: deCentavos(diffC) })
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
    const parsed = parseMesAnio(m.fecha)

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

    const ingresosC = sumarMontosEnARS(
      scMovimientos.filter((m) => m.tipo === "ingreso"),
    ).total

    const egresosC = sumarMontosEnARS(
      scMovimientos.filter((m) => m.tipo === "egreso"),
    ).total

    resumen[cajaItem.nombre] = {
      total: deCentavos(ingresosC - egresosC),
      ingresos: deCentavos(ingresosC),
      egresos: deCentavos(egresosC),
    }
  }

  const generalMovimientos = mesMovimientos.filter((m) => {
    const caja = cajasActivas.find((c) => c.nombre === m.subCaja)

    return caja ? caja.afectaGeneral === 1 : true
  })

  const totalIngresosC = sumarMontosEnARS(
    generalMovimientos.filter((m) => m.tipo === "ingreso"),
  ).total

  const totalEgresosC = sumarMontosEnARS(
    generalMovimientos.filter((m) => m.tipo === "egreso"),
  ).total

  return {
    subCajas: resumen,
    totalIngresos: deCentavos(totalIngresosC),
    totalEgresos: deCentavos(totalEgresosC),
    gananciaNeta: deCentavos(totalIngresosC - totalEgresosC),
  }
}

export function getResumenCaja(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1

  const anio = parseInt(req.query.anio as string) || new Date().getFullYear()

  res.json(calcularResumenCaja(mes, anio))
}
