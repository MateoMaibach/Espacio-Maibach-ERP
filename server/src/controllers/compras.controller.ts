import { Request, Response } from "express"
import { db } from "../db/index.js"
import { compras, proveedores, ordenesPago } from "../db/schema.js"
import { eq, desc } from "drizzle-orm"

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
    proveedorId,
    fecha,
    descripcion,
    moneda,
    tipoCambio,
    items,
    estado,
    observaciones,
  } = req.body

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
