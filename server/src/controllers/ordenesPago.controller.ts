import { Request, Response } from "express"
import { db } from "../db/index.js"
import {
  ordenesPago,
  proveedores,
  compras,
  movimientos,
  cajas,
  cheques,
} from "../db/schema.js"
import { eq, desc, sql } from "drizzle-orm"
import { contarPagos } from "./compras.controller.js"

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface DetalleLinea {
  subCaja: string
  moneda: string
  tipoCambio: number | null
  monto: number
  chequeId: string | null
  chequeAnterior: {
    estado: string
    fechaPago: string | null
    destinatario: string | null
    entregadoA: string | null
    fechaEntrega: string | null
    aplicaPagoProveedor: number
    proveedorId: string | null
  } | null
}

interface CompraLink {
  compraId: string
  monto: number
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function num(numero: number): string {
  return `OP-${String(numero).padStart(4, "0")}`
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
    .from(ordenesPago)
    .where(eq(ordenesPago.proveedorId, proveedorId))
    .orderBy(desc(ordenesPago.fecha), desc(ordenesPago.createdAt))
    .all()
  res.json(rows.map(mapearOrden))
}

export function getById(req: Request, res: Response) {
  const row = db
    .select()
    .from(ordenesPago)
    .where(eq(ordenesPago.id, req.params.id as string))
    .get()
  if (!row) {
    res.status(404).json({ error: "Orden de pago no encontrada" })
    return
  }
  res.json(mapearOrden(row))
}

function mapearOrden(row: typeof ordenesPago.$inferSelect) {
  return {
    ...row,
    etiqueta: num(row.numero),
    detalles: parseJson<DetalleLinea[]>(row.detalles, []),
    comprasPagadas: parseJson<CompraLink[]>(row.comprasPagadas, []),
    movimientoIds: parseJson<string[]>(row.movimientoIds, []),
  }
}

function validarDetalles(
  detalles: unknown,
): { ok: true; value: DetalleLinea[] } | { ok: false; error: string } {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return { ok: false, error: "La orden debe tener al menos un tramo de pago" }
  }

  const value: DetalleLinea[] = []
  const chequesUsados = new Set<string>()

  for (let i = 0; i < detalles.length; i++) {
    const d = (detalles as Partial<DetalleLinea>[])[i]
    const nro = i + 1

    const subCaja = String(d?.subCaja ?? "").trim()
    const moneda = String(d?.moneda ?? "")
      .trim()
      .toUpperCase()
    const monto = Math.round(Number(d?.monto))

    if (!subCaja)
      return { ok: false, error: `El tramo ${nro} debe indicar una caja` }
    if (!moneda)
      return { ok: false, error: `El tramo ${nro} debe indicar una moneda` }
    if (!Number.isFinite(monto) || monto <= 0)
      return {
        ok: false,
        error: `El monto del tramo ${nro} debe ser mayor a 0`,
      }

    const cajaEfector =
      subCaja === "Cheques" || d?.chequeId ? "Cheques" : subCaja
    const caja = db
      .select()
      .from(cajas)
      .where(eq(cajas.nombre, cajaEfector))
      .get()
    if (!caja) return { ok: false, error: `La caja "${cajaEfector}" no existe` }
    if (caja.activa !== 1)
      return { ok: false, error: `La caja "${cajaEfector}" está inactiva` }

    const tipoCambio =
      d?.tipoCambio === undefined || d?.tipoCambio === null
        ? null
        : Math.round(Number(d.tipoCambio))
    if (
      tipoCambio !== null &&
      (!Number.isFinite(tipoCambio) || tipoCambio <= 0)
    ) {
      return {
        ok: false,
        error: `El tipo de cambio del tramo ${nro} debe ser mayor a 0`,
      }
    }
    if (moneda !== "ARS" && tipoCambio === null) {
      return {
        ok: false,
        error: `El tramo ${nro} (${moneda}) debe indicar tipo de cambio`,
      }
    }

    const chequeId = d?.chequeId ? String(d.chequeId) : null
    let chequeAnterior: DetalleLinea["chequeAnterior"] = null

    if (chequeId) {
      if (moneda !== "ARS") {
        return {
          ok: false,
          error: `El tramo ${nro}: los cheques se pagan en ARS`,
        }
      }
      if (chequesUsados.has(chequeId)) {
        return {
          ok: false,
          error: `El tramo ${nro} repite un cheque ya usado en la orden`,
        }
      }
      chequesUsados.add(chequeId)

      const cheque = db
        .select()
        .from(cheques)
        .where(eq(cheques.id, chequeId))
        .get()
      if (!cheque)
        return { ok: false, error: `El tramo ${nro}: el cheque no existe` }

      const estadoValido =
        cheque.tipo === "emitido"
          ? cheque.estado === "Pendiente"
          : cheque.estado === "En Cartera"
      if (!estadoValido) {
        return {
          ok: false,
          error: `El tramo ${nro}: el cheque ${cheque.numero} no está disponible (estado: ${cheque.estado})`,
        }
      }
      if (cheque.importe !== monto) {
        return {
          ok: false,
          error: `El tramo ${nro}: el monto debe ser igual al importe del cheque (${cheque.importe})`,
        }
      }

      chequeAnterior = {
        estado: cheque.estado,
        fechaPago: cheque.fechaPago,
        destinatario: cheque.destinatario,
        entregadoA: cheque.entregadoA,
        fechaEntrega: cheque.fechaEntrega,
        aplicaPagoProveedor: cheque.aplicaPagoProveedor,
        proveedorId: cheque.proveedorId,
      }

      value.push({
        subCaja: "Cheques",
        moneda,
        tipoCambio,
        monto,
        chequeId,
        chequeAnterior,
      })
      continue
    }

    value.push({
      subCaja,
      moneda,
      tipoCambio,
      monto,
      chequeId: null,
      chequeAnterior: null,
    })
  }

  return { ok: true, value }
}

function validarCompras(
  links: unknown,
  proveedorId: string,
): { ok: true; value: CompraLink[] } | { ok: false; error: string } {
  if (links === undefined || links === null) return { ok: true, value: [] }
  if (!Array.isArray(links))
    return { ok: false, error: "Compras vinculadas inválidas" }

  const value: CompraLink[] = []
  for (const raw of links as Partial<CompraLink>[]) {
    const compraId = String(raw?.compraId ?? "")
    if (!compraId) continue

    const compra = db
      .select()
      .from(compras)
      .where(eq(compras.id, compraId))
      .get()
    if (!compra)
      return { ok: false, error: "Una de las compras indicadas no existe" }
    if (compra.proveedorId !== proveedorId)
      return {
        ok: false,
        error: "Una de las compras no pertenece a este proveedor",
      }

    const monto = Math.round(Number(raw?.monto))
    if (!Number.isFinite(monto) || monto <= 0) {
      return {
        ok: false,
        error: `El monto a pagar de la compra debe ser mayor a 0`,
      }
    }

    const pagado = contarPagos(compra.id)
    const saldo = compra.total - pagado
    if (monto > saldo) {
      return {
        ok: false,
        error: `El pago supera el saldo de la compra (saldo disponible: ${saldo})`,
      }
    }

    value.push({ compraId: compra.id, monto })
  }
  return { ok: true, value }
}

export function create(req: Request, res: Response) {
  const proveedorId = req.params.id as string
  const proveedor = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, proveedorId))
    .get()
  if (!proveedor) {
    res.status(404).json({ error: "Proveedor no encontrado" })
    return
  }

  const { fecha, concepto, detalles, comprasPagadas, observaciones } = req.body

  if (!fecha || !FECHA_REGEX.test(String(fecha))) {
    res
      .status(400)
      .json({ error: "La fecha es obligatoria (formato yyyy-mm-dd)" })
    return
  }
  if (!concepto || !String(concepto).trim()) {
    res.status(400).json({ error: "El concepto es obligatorio" })
    return
  }

  const validDetalles = validarDetalles(detalles)
  if (!validDetalles.ok) {
    res.status(400).json({ error: validDetalles.error })
    return
  }

  const validCompras = validarCompras(comprasPagadas, proveedorId)
  if (!validCompras.ok) {
    res.status(400).json({ error: validCompras.error })
    return
  }

  const id = `op_${Date.now()}`
  const etiquetaAnterior = db
    .select({ max: sql<number>`coalesce(max(numero), 0)` })
    .from(ordenesPago)
    .get()
  const numero = (etiquetaAnterior?.max ?? 0) + 1
  const etiqueta = num(numero)
  const movimientosIds: string[] = []

  try {
    db.transaction((tx) => {
      tx.insert(ordenesPago)
        .values({
          id,
          numero,
          proveedorId,
          fecha: String(fecha),
          concepto: String(concepto).trim(),
          estado: "Pagada",
          detalles: JSON.stringify(validDetalles.value),
          comprasPagadas: JSON.stringify(validCompras.value),
          movimientoIds: "[]",
          observaciones: observaciones ? String(observaciones).trim() : null,
          createdAt: new Date(),
        })
        .run()

      validDetalles.value.forEach((linea, i) => {
        const movId = `mov_${Date.now()}_${i}`
        const cheque = linea.chequeId
          ? db
              .select()
              .from(cheques)
              .where(eq(cheques.id, linea.chequeId))
              .get()
          : undefined

        tx.insert(movimientos)
          .values({
            id: movId,
            fecha: String(fecha),
            concepto: `${etiqueta} · ${proveedor.razonSocial}`,
            monto: linea.monto,
            tipo: "egreso",
            subCaja: linea.subCaja,
            moneda: linea.moneda,
            tipoCambio: linea.tipoCambio,
            categoria: "Pago proveedor",
            comprobante: etiqueta,
            observaciones: cheque
              ? `Cheque ${cheque.tipo} ${cheque.banco} N° ${cheque.numero}`
              : "Orden de pago",
            createdAt: new Date(),
          })
          .run()
        movimientosIds.push(movId)

        if (linea.chequeId && cheque && linea.chequeAnterior) {
          if (cheque.tipo === "emitido") {
            tx.update(cheques)
              .set({
                estado: "Pagado",
                fechaPago: String(fecha),
                destinatario: proveedor.razonSocial,
                aplicaPagoProveedor: 1,
                proveedorId,
              })
              .where(eq(cheques.id, cheque.id))
              .run()
          } else {
            tx.update(cheques)
              .set({
                estado: "Entregado",
                entregadoA: proveedor.razonSocial,
                fechaEntrega: String(fecha),
                proveedorId,
              })
              .where(eq(cheques.id, cheque.id))
              .run()
          }
        }
      })

      tx.update(ordenesPago)
        .set({ movimientoIds: JSON.stringify(movimientosIds) })
        .where(eq(ordenesPago.id, id))
        .run()
    })
  } catch (err) {
    res
      .status(400)
      .json({
        error:
          err instanceof Error
            ? err.message
            : "No se pudo crear la orden de pago",
      })
    return
  }

  res
    .status(201)
    .json({
      ok: true,
      id,
      numero: etiqueta,
      movimientos: movimientosIds.length,
    })
}

export function anular(req: Request, res: Response) {
  const existing = db
    .select()
    .from(ordenesPago)
    .where(eq(ordenesPago.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Orden de pago no encontrada" })
    return
  }
  if (existing.estado !== "Pagada") {
    res.status(400).json({ error: "La orden ya está anulada" })
    return
  }

  const detalles = parseJson<DetalleLinea[]>(existing.detalles, [])
  const movimientoIds = parseJson<string[]>(existing.movimientoIds, [])

  try {
    db.transaction((tx) => {
      for (const movId of movimientoIds) {
        tx.delete(movimientos).where(eq(movimientos.id, movId)).run()
      }

      for (const linea of detalles) {
        if (!linea.chequeId || !linea.chequeAnterior) continue
        const previo = linea.chequeAnterior
        tx.update(cheques)
          .set({
            estado: previo.estado,
            fechaPago: previo.fechaPago,
            destinatario: previo.destinatario,
            entregadoA: previo.entregadoA,
            fechaEntrega: previo.fechaEntrega,
            aplicaPagoProveedor: previo.aplicaPagoProveedor,
            proveedorId: previo.proveedorId,
          })
          .where(eq(cheques.id, linea.chequeId))
          .run()
      }

      tx.update(ordenesPago)
        .set({ estado: "Anulada" })
        .where(eq(ordenesPago.id, existing.id))
        .run()
    })
  } catch (err) {
    res
      .status(400)
      .json({
        error:
          err instanceof Error
            ? err.message
            : "No se pudo anular la orden de pago",
      })
    return
  }

  res.json({ ok: true, movimientosEliminados: movimientoIds.length })
}
