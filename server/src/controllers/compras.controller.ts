import { Request, Response } from "express"
import { db } from "../db/index.js"
import { compras, proveedores, ordenesPago, articulos, depositos, historialCostos } from "../db/schema.js"
import { eq, desc } from "drizzle-orm"
import {
  aplicarStock,
  crearMovimiento,
  hoy,
  idUnico,
} from "../services/stock.service.js"

export const ESTADOS_COMPRA = ["Pendiente", "En Tránsito", "Recibido"]
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface ItemCompra {
  detalle: string
  cantidad: number
  precioUnitario: number
}

function calcularTotal(items: unknown): { total: number; error: string | null } {
  if (!Array.isArray(items) || items.length === 0) {
    return { total: 0, error: "Debe indicar al menos un item de la compra" }
  }

  let total = 0
  for (const item of items as Partial<ItemCompra>[]) {
    const cantidad = Number(item?.cantidad)
    const precioUnitario = Number(item?.precioUnitario)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      return { total: 0, error: "La cantidad de cada item debe ser mayor a 0" }
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return {
        total: 0,
        error: "El precio unitario de cada item no puede ser negativo",
      }
    }
    total += cantidad * precioUnitario
  }
  return { total: Math.round(total), error: null }
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function limpiarItems(items: unknown): ItemCompra[] {
  return (items as Partial<ItemCompra>[]).map((item) => ({
    detalle: String(item?.detalle ?? "").trim(),
    cantidad: Number(item?.cantidad),
    precioUnitario: Number(item?.precioUnitario),
  }))
}

export function getByProveedor(req: Request, res: Response) {
  const proveedorId = req.params.id as string
  const existe = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, proveedorId))
    .get()
  if (!existe) {
    res.status(404).json({ error: "Proveedor no encontrado" })
    return
  }

  const rows = db
    .select()
    .from(compras)
    .where(eq(compras.proveedorId, proveedorId))
    .orderBy(desc(compras.fecha), desc(compras.createdAt))
    .all()
  res.json(rows)
}

export function getById(req: Request, res: Response) {
  const row = db
    .select()
    .from(compras)
    .where(eq(compras.id, req.params.id as string))
    .get()
  if (!row) {
    res.status(404).json({ error: "Compra no encontrada" })
    return
  }
  res.json(row)
}

export function create(req: Request, res: Response) {
  const {
    fecha,
    descripcion,
    moneda,
    tipoCambio,
    items,
    estado,
    observaciones,
  } = req.body

  const proveedorId = req.body.proveedorId ?? req.params.id

  if (!proveedorId) {
    res.status(400).json({ error: "El proveedor es obligatorio" })
    return
  }
  const proveedor = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, String(proveedorId)))
    .get()
  if (!proveedor) {
    res.status(400).json({ error: "El proveedor indicado no existe" })
    return
  }
  if (!fecha || !FECHA_REGEX.test(String(fecha))) {
    res
      .status(400)
      .json({ error: "La fecha es obligatoria (formato yyyy-mm-dd)" })
    return
  }

  const estadoFinal = estado || "Pendiente"
  if (!ESTADOS_COMPRA.includes(estadoFinal)) {
    res
      .status(400)
      .json({
        error: `Estado inválido. Debe ser: ${ESTADOS_COMPRA.join(", ")}`,
      })
    return
  }

  const monedaFinal =
    moneda && String(moneda).trim()
      ? String(moneda).trim().toUpperCase()
      : "ARS"
  const { total, error } = calcularTotal(items)
  if (error) {
    res.status(400).json({ error })
    return
  }

  const id = `cmp_${Date.now()}`
  db.insert(compras)
    .values({
      id,
      proveedorId: proveedor.id,
      fecha: String(fecha),
      descripcion: descripcion ? String(descripcion).trim() : null,
      moneda: monedaFinal,
      tipoCambio: tipoCambio ? Math.round(Number(tipoCambio)) : null,
      total,
      items: JSON.stringify(limpiarItems(items)),
      estado: estadoFinal,
      observaciones: observaciones ? String(observaciones).trim() : null,
      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id, total })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(compras)
    .where(eq(compras.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Compra no encontrada" })
    return
  }

  const {
    fecha,
    descripcion,
    moneda,
    tipoCambio,
    items,
    estado,
    observaciones,
  } = req.body

  if (fecha !== undefined && !FECHA_REGEX.test(String(fecha))) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })
    return
  }
  if (estado !== undefined && !ESTADOS_COMPRA.includes(estado)) {
    res
      .status(400)
      .json({
        error: `Estado inválido. Debe ser: ${ESTADOS_COMPRA.join(", ")}`,
      })
    return
  }

  let total = existing.total
  let itemsStr: string | undefined
  if (items !== undefined) {
    if (parseRecepciones(existing.recepciones).length > 0) {
      res.status(400).json({
        error:
          "No se pueden modificar los ítems: la compra ya tiene mercadería recibida.",
      })
      return
    }
    const resultado = calcularTotal(items)
    if (resultado.error) {
      res.status(400).json({ error: resultado.error })
      return
    }
    total = resultado.total
    itemsStr = JSON.stringify(limpiarItems(items))
  }

  db.update(compras)
    .set({
      ...(fecha !== undefined && { fecha: String(fecha) }),
      ...(descripcion !== undefined && {
        descripcion: descripcion ? String(descripcion).trim() : null,
      }),
      ...(moneda !== undefined && {
        moneda:
          moneda && String(moneda).trim()
            ? String(moneda).trim().toUpperCase()
            : "ARS",
      }),
      ...(tipoCambio !== undefined && {
        tipoCambio: tipoCambio ? Math.round(Number(tipoCambio)) : null,
      }),
      ...(items !== undefined && { total, items: itemsStr }),
      ...(estado !== undefined && { estado }),
      ...(observaciones !== undefined && {
        observaciones: observaciones ? String(observaciones).trim() : null,
      }),
    })
    .where(eq(compras.id, existing.id))
    .run()

  res.json({ ok: true, total })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(compras)
    .where(eq(compras.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Compra no encontrada" })
    return
  }

  const ordenes = db
    .select()
    .from(ordenesPago)
    .where(eq(ordenesPago.estado, "Pagada"))
    .all()
  const pagada = ordenes.some((o) => {
    try {
      const links = JSON.parse(o.comprasPagadas || "[]") as {
        compraId: string
      }[]
      return links.some((l) => l.compraId === existing.id)
    } catch {
      return false
    }
  })

  if (pagada) {
    res
      .status(400)
      .json({
        error:
          "No se puede eliminar: tiene pagos registrados en órdenes de pago.",
      })
    return
  }

  if (parseRecepciones(existing.recepciones).length > 0) {
    res.status(400).json({
      error:
        "No se puede eliminar: tiene mercadería recibida en un depósito.",
    })
    return
  }

  db.delete(compras).where(eq(compras.id, existing.id)).run()
  res.json({ ok: true })
}

export function contarPagos(compraId: string): number {
  const ordenes = db
    .select({ comprasPagadas: ordenesPago.comprasPagadas })
    .from(ordenesPago)
    .where(eq(ordenesPago.estado, "Pagada"))
    .all()
  let total = 0
  for (const o of ordenes) {
    try {
      const links = JSON.parse(o.comprasPagadas || "[]") as {
        compraId: string
        monto: number
      }[]
      for (const l of links)
        if (l.compraId === compraId) total += Number(l.monto || 0)
    } catch {
      // ignorar JSON inválido
    }
  }
  return total
}

export function saldoCompras(
  proveedorId: string,
): Record<string, { total: number; pagado: number }> {
  const rows = db
    .select()
    .from(compras)
    .where(eq(compras.proveedorId, proveedorId))
    .all()
  const resultado: Record<string, { total: number; pagado: number }> = {}
  for (const c of rows) {
    resultado[c.id] = { total: c.total, pagado: contarPagos(c.id) }
  }
  return resultado
}

// --- Recepción de mercadería en depósito ---

export interface LineaRecepcion {
  itemIndex: number
  articuloId: string
  articuloNombre: string
  cantidad: number
}

export interface Recepcion {
  id: string
  fecha: string
  depositoId: string
  depositoNombre: string
  lineas: LineaRecepcion[]
  movimientoIds: string[]
}

function parseRecepciones(raw: unknown): Recepcion[] {
  if (typeof raw !== "string" || !raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Recepcion[]) : []
  } catch {
    return []
  }
}

function pendientesPorItem(compra: {
  items: string
  recepciones: string
}) {
  const items = parseJson<ItemCompra[]>(compra.items, [])
  const recepciones = parseRecepciones(compra.recepciones)

  return items.map((item, i) => {
    const recibido = recepciones.reduce(
      (suma, r) =>
        suma +
        r.lineas
          .filter((l) => l.itemIndex === i)
          .reduce((s, l) => s + Number(l.cantidad || 0), 0),
      0,
    )
    const cantidad = Number(item.cantidad || 0)
    return {
      itemIndex: i,
      detalle: item.detalle,
      cantidad,
      recibido,
      pendiente: Math.max(0, cantidad - recibido),
      precioUnitario: Number(item.precioUnitario || 0),
    }
  })
}

function estadoIngreso(pendientes: ReturnType<typeof pendientesPorItem>) {
  if (pendientes.length === 0) return "Pendiente"
  const recibidoTotal = pendientes.every((p) => p.recibido >= p.cantidad)
  if (recibidoTotal) return "Recibido"
  const alguno = pendientes.some((p) => p.recibido > 0)
  return alguno ? "Parcial" : "Pendiente"
}

export function getRecepciones(req: Request, res: Response) {
  const existing = db
    .select()
    .from(compras)
    .where(eq(compras.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Compra no encontrada" })
    return
  }

  const pendientes = pendientesPorItem(existing)

  res.json({
    recepciones: parseRecepciones(existing.recepciones),
    pendientes,
    ingresoEstado: estadoIngreso(pendientes),
  })
}

interface LineaRecepcionBody {
  itemIndex?: number
  articuloId?: string
  cantidad?: number
}

export function createRecepcion(req: Request, res: Response) {
  const existing = db
    .select()
    .from(compras)
    .where(eq(compras.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Compra no encontrada" })
    return
  }

  const { depositoId, fecha, lineas } = req.body

  const deposito = depositoId
    ? db.select().from(depositos).where(eq(depositos.id, String(depositoId))).get()
    : undefined
  if (!deposito) {
    res.status(400).json({ error: "Depósito inválido" })
    return
  }

  if (!Array.isArray(lineas) || lineas.length === 0) {
    res.status(400).json({ error: "Debe indicar al menos un artículo a recibir" })
    return
  }

  const pendientes = pendientesPorItem(existing)
  const items = parseJson<ItemCompra[]>(existing.items, [])
  const fechaFinal = fecha || hoy()

  const normalizadas: {
    itemIndex: number
    articuloId: string
    articuloNombre: string
    cantidad: number
    precioUnitario: number
  }[] = []

  for (const [i, raw] of (lineas as LineaRecepcionBody[]).entries()) {
    const linea = raw ?? {}
    const index = Math.trunc(Number(linea.itemIndex))
    const pendiente = pendientes[index]
    if (!pendiente) {
      res.status(400).json({ error: `Línea ${i + 1}: item de compra inválido` })
      return
    }

    const articulo = linea.articuloId
      ? db.select().from(articulos).where(eq(articulos.id, String(linea.articuloId))).get()
      : undefined
    if (!articulo) {
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
    if (cantidad > pendiente.pendiente) {
      res.status(400).json({
        error: `Línea ${i + 1}: sólo quedan ${pendiente.pendiente} pendiente(s) de "${pendiente.detalle || "item"}"`,
      })
      return
    }

    normalizadas.push({
      itemIndex: index,
      articuloId: articulo.id,
      articuloNombre: articulo.nombre,
      cantidad,
      precioUnitario: Number(items[index]?.precioUnitario ?? articulo.costoUnitario),
    })
  }

  const movimientoIds = db.transaction((tx) => {
    const creados: string[] = []

    for (const linea of normalizadas) {
      const movimientoId = crearMovimiento(tx, {
        fecha: fechaFinal,
        tipo: "ingreso",
        articuloId: linea.articuloId,
        depositoDestinoId: deposito.id,
        cantidad: linea.cantidad,
        costoUnitario: linea.precioUnitario,
        referenciaTipo: "compra",
        referenciaId: existing.id,
        motivo: existing.descripcion || "Ingreso por compra",
      })

      aplicarStock(tx, {
        depositoId: deposito.id,
        articuloId: linea.articuloId,
        delta: linea.cantidad,
        costoUnitario: linea.precioUnitario,
      })

      const art = tx
        .select()
        .from(articulos)
        .where(eq(articulos.id, linea.articuloId))
        .get()

      if (art && art.costoUnitario !== Math.round(linea.precioUnitario)) {
        tx.update(articulos)
          .set({ costoUnitario: Math.round(linea.precioUnitario) })
          .where(eq(articulos.id, linea.articuloId))
          .run()

        tx.insert(historialCostos)
          .values({
            id: idUnico("hct"),
            articuloId: linea.articuloId,
            costo: Math.round(linea.precioUnitario),
            fecha: fechaFinal,
            origen: "compra",
            referenciaId: existing.id,
            createdAt: new Date(),
          })
          .run()
      }

      creados.push(movimientoId)
    }

    const recepcion: Recepcion = {
      id: `rcp_${Date.now()}`,
      fecha: fechaFinal,
      depositoId: deposito.id,
      depositoNombre: deposito.nombre,
      lineas: normalizadas.map((l) => ({
        itemIndex: l.itemIndex,
        articuloId: l.articuloId,
        articuloNombre: l.articuloNombre,
        cantidad: l.cantidad,
      })),
      movimientoIds: creados,
    }

    const recepciones = [...parseRecepciones(existing.recepciones), recepcion]

    tx.update(compras)
      .set({ recepciones: JSON.stringify(recepciones) })
      .where(eq(compras.id, existing.id))
      .run()

    return { recepcionId: recepcion.id, movimientoIds: creados }
  })

  const actualizada = db
    .select()
    .from(compras)
    .where(eq(compras.id, existing.id))
    .get()
  const pendientesFinales = pendientesPorItem(actualizada ?? existing)
  const ingresoEstado = estadoIngreso(pendientesFinales)

  db.update(compras)
    .set({ ingresoEstado })
    .where(eq(compras.id, existing.id))
    .run()

  res.status(201).json({
    ok: true,
    id: movimientoIds.recepcionId,
    movimientos: movimientoIds.movimientoIds,
    ingresoEstado,
    pendientes: pendientesFinales,
  })
}
