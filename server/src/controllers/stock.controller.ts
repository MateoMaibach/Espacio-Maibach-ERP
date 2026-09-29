import { Request, Response } from "express"
import { db } from "../db/index.js"
import {
  stock,
  articulos,
  depositos,
  movimientosStock,
  historialCostos,
} from "../db/schema.js"
import { eq, and, gte, lte, sql, desc } from "drizzle-orm"
import {
  aplicarStock,
  crearMovimiento,
  hoy,
  idUnico,
} from "../services/stock.service.js"

function existeDeposito(id: string) {
  return db.select().from(depositos).where(eq(depositos.id, id)).get()
}

function existeArticulo(id: string) {
  return db.select().from(articulos).where(eq(articulos.id, id)).get()
}

// --- Existencias ---

export function getExistencias(req: Request, res: Response) {
  const depositoId = req.query.depositoId as string | undefined
  const articuloId = req.query.articuloId as string | undefined

  const conds = []
  if (depositoId) conds.push(eq(stock.depositoId, depositoId))
  if (articuloId) conds.push(eq(stock.articuloId, articuloId))

  const rows = db
    .select({
      id: stock.id,
      depositoId: stock.depositoId,
      articuloId: stock.articuloId,
      cantidad: stock.cantidad,
      costoPromedio: stock.costoPromedio,
    })
    .from(stock)
    .where(conds.length ? and(...conds) : undefined)
    .all()

  const artMap = new Map(
    db.select().from(articulos).all().map((a) => [a.id, a]),
  )
  const depMap = new Map(
    db.select().from(depositos).all().map((d) => [d.id, d]),
  )

  const result = rows
    .map((r) => {
      const art = artMap.get(r.articuloId)
      const dep = depMap.get(r.depositoId)
      return {
        ...r,
        articuloNombre: art?.nombre ?? "—",
        codigo: art?.codigo ?? null,
        unidad: art?.unidad ?? "un",
        depositoNombre: dep?.nombre ?? "—",
        valor: r.cantidad * r.costoPromedio,
      }
    })
    .filter((r) => depMap.has(r.depositoId) && artMap.has(r.articuloId))

  result.sort(
    (a, b) =>
      a.depositoNombre.localeCompare(b.depositoNombre, "es") ||
      a.articuloNombre.localeCompare(b.articuloNombre, "es"),
  )

  const negativos = result.filter((r) => r.cantidad < 0).length

  res.json({
    rows: result,
    totalArticulos: result.length,
    valorTotal: result.reduce((s, r) => s + r.valor, 0),
    conStockNegativo: negativos,
  })
}

// --- Kardex / movimientos ---

export function getMovimientos(req: Request, res: Response) {
  const { desde, hasta, depositoId, articuloId, tipo } = req.query as Record<
    string,
    string | undefined
  >

  const conds = []
  if (desde) conds.push(gte(movimientosStock.fecha, desde))
  if (hasta) conds.push(lte(movimientosStock.fecha, hasta))
  if (tipo) conds.push(eq(movimientosStock.tipo, tipo))
  if (articuloId) conds.push(eq(movimientosStock.articuloId, articuloId))

  const rows = db
    .select()
    .from(movimientosStock)
    .where(conds.length ? and(...conds) : undefined)
    .all()

  const artMap = new Map(
    db.select().from(articulos).all().map((a) => [a.id, a]),
  )
  const depMap = new Map(
    db.select().from(depositos).all().map((d) => [d.id, d]),
  )

  let filtrados = rows

  if (depositoId) {
    filtrados = filtrados.filter(
      (m) =>
        m.depositoOrigenId === depositoId || m.depositoDestinoId === depositoId,
    )
  }

  filtrados.sort((a, b) =>
    a.fecha === b.fecha ? b.id.localeCompare(a.id) : b.fecha.localeCompare(a.fecha),
  )

  const saldos = new Map<string, number>()
  const conSaldo = Boolean(articuloId)

  const result = filtrados.map((m) => {
    const art = artMap.get(m.articuloId)
    let saldo = null

    if (conSaldo) {
      const previo = saldos.get(m.articuloId) ?? 0
      const delta =
        m.tipo === "ingreso"
          ? m.cantidad
          : m.tipo === "egreso"
            ? -m.cantidad
            : m.tipo === "transferencia"
              ? 0
              : m.cantidad
      const nuevo = previo + delta
      saldos.set(m.articuloId, nuevo)
      saldo = nuevo
    }

    return {
      ...m,
      articuloNombre: art?.nombre ?? "—",
      unidad: art?.unidad ?? "un",
      depositoOrigen: m.depositoOrigenId
        ? (depMap.get(m.depositoOrigenId)?.nombre ?? "—")
        : null,
      depositoDestino: m.depositoDestinoId
        ? (depMap.get(m.depositoDestinoId)?.nombre ?? "—")
        : null,
      valor: m.cantidad * m.costoUnitario * (m.tipo === "egreso" ? -1 : 1),
      saldo,
    }
  })

  res.json(result)
}

// --- Ingreso inicial ---

interface LineaIngreso {
  articuloId?: string
  cantidad?: number
  costoUnitario?: number
}

export function createIngresoInicial(req: Request, res: Response) {
  const { depositoId, fecha, lineas } = req.body

  if (!depositoId || !existeDeposito(depositoId)) {
    res.status(400).json({ error: "Depósito inválido" })
    return
  }

  if (!Array.isArray(lineas) || lineas.length === 0) {
    res.status(400).json({ error: "Debe indicar al menos un artículo" })
    return
  }

  const fechaFinal = fecha || hoy()

  const normalizadas: {
    articuloId: string
    cantidad: number
    costoUnitario: number
  }[] = []

  for (const [i, raw] of (lineas as LineaIngreso[]).entries()) {
    const linea = raw ?? {}
    if (!linea.articuloId || !existeArticulo(linea.articuloId)) {
      res.status(400).json({ error: `Línea ${i + 1}: artículo inválido` })
      return
    }
    const cantidad = Math.trunc(Number(linea.cantidad))
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      res
        .status(400)
        .json({ error: `Línea ${i + 1}: la cantidad debe ser mayor a cero` })
      return
    }
    const articulo = existeArticulo(linea.articuloId)
    const costoUnitario =
      linea.costoUnitario === undefined || linea.costoUnitario === null
        ? (articulo?.costoUnitario ?? 0)
        : Math.round(Number(linea.costoUnitario))
    if (!Number.isFinite(costoUnitario) || costoUnitario < 0) {
      res.status(400).json({ error: `Línea ${i + 1}: costo inválido` })
      return
    }
    normalizadas.push({ articuloId: linea.articuloId, cantidad, costoUnitario })
  }

  const ids = db.transaction((tx) => {
    const creados: string[] = []

    for (const linea of normalizadas) {
      const movimientoId = crearMovimiento(tx, {
        fecha: fechaFinal,
        tipo: "ingreso",
        articuloId: linea.articuloId,
        depositoDestinoId: depositoId,
        cantidad: linea.cantidad,
        costoUnitario: linea.costoUnitario,
        referenciaTipo: "inicial",
        motivo: "Ingreso inicial",
      })

      aplicarStock(tx, {
        depositoId,
        articuloId: linea.articuloId,
        delta: linea.cantidad,
        costoUnitario: linea.costoUnitario,
      })

      const articulo = tx
        .select()
        .from(articulos)
        .where(eq(articulos.id, linea.articuloId))
        .get()

      if (articulo && articulo.costoUnitario !== linea.costoUnitario) {
        tx.update(articulos)
          .set({ costoUnitario: linea.costoUnitario })
          .where(eq(articulos.id, linea.articuloId))
          .run()

        tx.insert(historialCostos)
          .values({
            id: idUnico("hct"),
            articuloId: linea.articuloId,
            costo: linea.costoUnitario,
            fecha: fechaFinal,
            origen: "inicial",
            referenciaId: movimientoId,
            createdAt: new Date(),
          })
          .run()
      }

      creados.push(movimientoId)
    }

    return creados
  })

  res.status(201).json({ ok: true, movimientos: ids })
}

// --- Ajustes por inventario ---

interface LineaAjuste {
  articuloId?: string
  cantidad?: number
}

export function createAjuste(req: Request, res: Response) {
  const { depositoId, fecha, motivo, lineas } = req.body

  if (!depositoId || !existeDeposito(depositoId)) {
    res.status(400).json({ error: "Depósito inválido" })
    return
  }

  if (!motivo || !String(motivo).trim()) {
    res.status(400).json({ error: "El motivo del ajuste es obligatorio" })
    return
  }

  if (!Array.isArray(lineas) || lineas.length === 0) {
    res.status(400).json({ error: "Debe indicar al menos un artículo" })
    return
  }

  const fechaFinal = fecha || hoy()

  const normalizadas: { articuloId: string; cantidad: number }[] = []

  for (const [i, raw] of (lineas as LineaAjuste[]).entries()) {
    const linea = raw ?? {}
    if (!linea.articuloId || !existeArticulo(linea.articuloId)) {
      res.status(400).json({ error: `Línea ${i + 1}: artículo inválido` })
      return
    }
    const cantidad = Math.trunc(Number(linea.cantidad))
    if (!Number.isFinite(cantidad) || cantidad === 0) {
      res
        .status(400)
        .json({ error: `Línea ${i + 1}: la cantidad no puede ser cero` })
      return
    }
    normalizadas.push({ articuloId: linea.articuloId, cantidad })
  }

  const ids = db.transaction((tx) => {
    const creados: string[] = []

    for (const linea of normalizadas) {
      const fila = tx
        .select()
        .from(stock)
        .where(
          and(
            eq(stock.depositoId, depositoId),
            eq(stock.articuloId, linea.articuloId),
          ),
        )
        .get()

      const articulo = tx
        .select()
        .from(articulos)
        .where(eq(articulos.id, linea.articuloId))
        .get()

      const costo = fila?.costoPromedio ?? articulo?.costoUnitario ?? 0

      const movimientoId = crearMovimiento(tx, {
        fecha: fechaFinal,
        tipo: "ajuste",
        articuloId: linea.articuloId,
        depositoDestinoId: depositoId,
        cantidad: linea.cantidad,
        costoUnitario: costo,
        referenciaTipo: "ajuste",
        motivo: String(motivo).trim(),
      })

      aplicarStock(tx, {
        depositoId,
        articuloId: linea.articuloId,
        delta: linea.cantidad,
        costoUnitario: costo,
      })

      creados.push(movimientoId)
    }

    return creados
  })

  res.status(201).json({ ok: true, movimientos: ids })
}

// --- Reporte: stock negativo ---

export function getReporteNegativos(_req: Request, res: Response) {
  const rows = db
    .select({
      id: stock.id,
      depositoId: stock.depositoId,
      articuloId: stock.articuloId,
      cantidad: stock.cantidad,
      costoPromedio: stock.costoPromedio,
    })
    .from(stock)
    .where(sql`cantidad < 0`)
    .all()

  const artMap = new Map(db.select().from(articulos).all().map((a) => [a.id, a]))
  const depMap = new Map(db.select().from(depositos).all().map((d) => [d.id, d]))

  const result = rows.map((r) => {
    const art = artMap.get(r.articuloId)
    const dep = depMap.get(r.depositoId)
    const ultimos = db
      .select()
      .from(movimientosStock)
      .where(
        and(
          eq(movimientosStock.articuloId, r.articuloId),
          eq(movimientosStock.depositoDestinoId, r.depositoId),
        ),
      )
      .orderBy(desc(movimientosStock.fecha), desc(movimientosStock.id))
      .limit(1)
      .all()

    return {
      ...r,
      articuloNombre: art?.nombre ?? "—",
      unidad: art?.unidad ?? "un",
      depositoNombre: dep?.nombre ?? "—",
      valor: r.cantidad * r.costoPromedio,
      ultimoMovimiento: ultimos[0] ?? null,
    }
  })

  result.sort((a, b) => a.cantidad - b.cantidad)

  res.json({
    rows: result,
    totalUnidades: result.reduce((s, r) => s + r.cantidad, 0),
    valorTotal: result.reduce((s, r) => s + r.valor, 0),
  })
}

// --- Reporte: valorización ---

export function getReporteValorizacion(req: Request, res: Response) {
  const depositoId = req.query.depositoId as string | undefined

  const conds = depositoId ? [eq(stock.depositoId, depositoId)] : []
  const rows = db
    .select({
      depositoId: stock.depositoId,
      articuloId: stock.articuloId,
      cantidad: stock.cantidad,
      costoPromedio: stock.costoPromedio,
    })
    .from(stock)
    .where(conds.length ? and(...conds) : undefined)
    .all()

  const artMap = new Map(db.select().from(articulos).all().map((a) => [a.id, a]))
  const depMap = new Map(db.select().from(depositos).all().map((d) => [d.id, d]))

  const porDeposito = new Map<
    string,
    { depositoId: string; depositoNombre: string; articulos: number; valor: number }
  >()

  const detalle = rows
    .map((r) => {
      const art = artMap.get(r.articuloId)
      const dep = depMap.get(r.depositoId)
      const valor = r.cantidad * r.costoPromedio

      const acc = porDeposito.get(r.depositoId) ?? {
        depositoId: r.depositoId,
        depositoNombre: dep?.nombre ?? "—",
        articulos: 0,
        valor: 0,
      }
      acc.articulos += 1
      acc.valor += valor
      porDeposito.set(r.depositoId, acc)

      return {
        depositoId: r.depositoId,
        depositoNombre: dep?.nombre ?? "—",
        articuloId: r.articuloId,
        articuloNombre: art?.nombre ?? "—",
        codigo: art?.codigo ?? null,
        unidad: art?.unidad ?? "un",
        cantidad: r.cantidad,
        costoPromedio: r.costoPromedio,
        valor,
      }
    })
    .filter((r) => depMap.has(r.depositoId) && artMap.has(r.articuloId))

  detalle.sort(
    (a, b) =>
      a.depositoNombre.localeCompare(b.depositoNombre, "es") ||
      b.valor - a.valor,
  )

  res.json({
    rows: detalle,
    resumen: [...porDeposito.values()].sort((a, b) =>
      a.depositoNombre.localeCompare(b.depositoNombre, "es"),
    ),
    total: detalle.reduce((s, r) => s + r.valor, 0),
  })
}

// --- Reporte: evolución de costos ---

export function getReporteCostos(_req: Request, res: Response) {
  const arts = db.select().from(articulos).all()

  const result = arts.map((a) => {
    const historial = db
      .select()
      .from(historialCostos)
      .where(eq(historialCostos.articuloId, a.id))
      .orderBy(desc(historialCostos.createdAt), desc(historialCostos.id))
      .limit(2)
      .all()

    const actual = historial[0]?.costo ?? a.costoUnitario
    const anterior = historial[1]?.costo ?? null
    const variacion =
      anterior === null || anterior === 0
        ? null
        : Math.round(((actual - anterior) / anterior) * 1000) / 10

    return {
      ...a,
      costoActual: actual,
      costoAnterior: anterior,
      variacion,
      registros: db
        .select({ n: sql<number>`count(*)` })
        .from(historialCostos)
        .where(eq(historialCostos.articuloId, a.id))
        .get()?.n ?? 0,
    }
  })

  result.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  res.json(result)
}
