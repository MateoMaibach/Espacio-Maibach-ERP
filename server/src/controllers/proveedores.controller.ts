import { Request, Response } from "express"
import { db } from "../db/index.js"
import { proveedores, compras, ordenesPago } from "../db/schema.js"
import { eq, sql } from "drizzle-orm"

export const ESTADOS_PROVEEDOR = [
  "Activo",
  "Inactivo",
  "Suspendido",
  "Pendiente",
]

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export interface SaldoMoneda {
  comprado: number
  pagado: number
  saldo: number
}

function calcularSaldos() {
  const comprado: Record<string, Record<string, number>> = {}
  const pagado: Record<string, Record<string, number>> = {}
  const ultimaCompra: Record<string, string> = {}
  const compraMoneda = new Map<string, { proveedorId: string; moneda: string }>()

  for (const c of db
    .select({
      id: compras.id,
      proveedorId: compras.proveedorId,
      moneda: compras.moneda,
      total: compras.total,
      fecha: compras.fecha,
    })
    .from(compras)
    .all()) {
    compraMoneda.set(c.id, { proveedorId: c.proveedorId, moneda: c.moneda })
    comprado[c.proveedorId] ??= {}
    comprado[c.proveedorId][c.moneda] =
      (comprado[c.proveedorId][c.moneda] ?? 0) + c.total
    if (!ultimaCompra[c.proveedorId] || c.fecha > ultimaCompra[c.proveedorId]) {
      ultimaCompra[c.proveedorId] = c.fecha
    }
  }

  for (const o of db
    .select({
      estado: ordenesPago.estado,
      comprasPagadas: ordenesPago.comprasPagadas,
    })
    .from(ordenesPago)
    .all()) {
    if (o.estado !== "Pagada") continue
    for (const link of parseJson<{ compraId: string; monto: number }[]>(
      o.comprasPagadas,
      [],
    )) {
      const meta = compraMoneda.get(link.compraId)
      if (!meta) continue
      pagado[meta.proveedorId] ??= {}
      pagado[meta.proveedorId][meta.moneda] =
        (pagado[meta.proveedorId][meta.moneda] ?? 0) + Number(link.monto || 0)
    }
  }

  return { comprado, pagado, ultimaCompra }
}

function armarSaldos(
  proveedorId: string,
  saldos: ReturnType<typeof calcularSaldos>,
): Record<string, SaldoMoneda> {
  const monedas = new Set([
    ...Object.keys(saldos.comprado[proveedorId] ?? {}),
    ...Object.keys(saldos.pagado[proveedorId] ?? {}),
  ])
  const resultado: Record<string, SaldoMoneda> = {}
  for (const moneda of monedas) {
    const comprado = saldos.comprado[proveedorId]?.[moneda] ?? 0
    const pagado = saldos.pagado[proveedorId]?.[moneda] ?? 0
    resultado[moneda] = { comprado, pagado, saldo: comprado - pagado }
  }
  return resultado
}

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(proveedores).all()
  const saldos = calcularSaldos()

  const rows = all.map((p) => ({
    ...p,
    saldos: armarSaldos(p.id, saldos),
    ultimaCompra: saldos.ultimaCompra[p.id] ?? null,
  }))

  rows.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, "es"))
  res.json(rows)
}

export function getById(req: Request, res: Response) {
  const existing = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Proveedor no encontrado" })
    return
  }

  const saldos = calcularSaldos()
  res.json({
    ...existing,
    saldos: armarSaldos(existing.id, saldos),
    ultimaCompra: saldos.ultimaCompra[existing.id] ?? null,
  })
}

function validarCuit(
  cuit: string | undefined | null,
  excludeId?: string,
): string | null {
  const limpio = (cuit ?? "").trim()
  if (!limpio) return null
  const dup = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.cuit, limpio))
    .get()
  if (dup && dup.id !== excludeId) return "Ya existe un proveedor con ese CUIT"
  return null
}

export function create(req: Request, res: Response) {
  const {
    razonSocial,
    cuit,
    contacto,
    email,
    telefono,
    direccion,
    localidad,
    rubro,
    estado,
    cbu,
    alias,
    notas,
  } = req.body

  if (!razonSocial || !String(razonSocial).trim()) {
    res.status(400).json({ error: "La razón social es obligatoria" })
    return
  }

  const estadoFinal = estado || "Activo"
  if (!ESTADOS_PROVEEDOR.includes(estadoFinal)) {
    res
      .status(400)
      .json({
        error: `Estado inválido. Debe ser: ${ESTADOS_PROVEEDOR.join(", ")}`,
      })
    return
  }

  const errorCuit = validarCuit(cuit)
  if (errorCuit) {
    res.status(400).json({ error: errorCuit })
    return
  }

  const id = `prv_${Date.now()}`
  db.insert(proveedores)
    .values({
      id,
      razonSocial: String(razonSocial).trim(),
      cuit: cuit ? String(cuit).trim() : null,
      contacto: contacto ? String(contacto).trim() : null,
      email: email ? String(email).trim() : null,
      telefono: telefono ? String(telefono).trim() : null,
      direccion: direccion ? String(direccion).trim() : null,
      localidad: localidad ? String(localidad).trim() : null,
      rubro: rubro ? String(rubro).trim() : null,
      estado: estadoFinal,
      cbu: cbu ? String(cbu).trim() : null,
      alias: alias ? String(alias).trim() : null,
      notas: notas ? String(notas).trim() : null,
      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Proveedor no encontrado" })
    return
  }

  const {
    razonSocial,
    cuit,
    contacto,
    email,
    telefono,
    direccion,
    localidad,
    rubro,
    estado,
    cbu,
    alias,
    notas,
  } = req.body

  if (razonSocial !== undefined && !String(razonSocial).trim()) {
    res.status(400).json({ error: "La razón social no puede estar vacía" })
    return
  }

  if (estado !== undefined && !ESTADOS_PROVEEDOR.includes(estado)) {
    res
      .status(400)
      .json({
        error: `Estado inválido. Debe ser: ${ESTADOS_PROVEEDOR.join(", ")}`,
      })
    return
  }

  const errorCuit = validarCuit(cuit, existing.id)
  if (errorCuit) {
    res.status(400).json({ error: errorCuit })
    return
  }

  db.update(proveedores)
    .set({
      ...(razonSocial !== undefined && {
        razonSocial: String(razonSocial).trim(),
      }),
      ...(cuit !== undefined && { cuit: cuit ? String(cuit).trim() : null }),
      ...(contacto !== undefined && {
        contacto: contacto ? String(contacto).trim() : null,
      }),
      ...(email !== undefined && {
        email: email ? String(email).trim() : null,
      }),
      ...(telefono !== undefined && {
        telefono: telefono ? String(telefono).trim() : null,
      }),
      ...(direccion !== undefined && {
        direccion: direccion ? String(direccion).trim() : null,
      }),
      ...(localidad !== undefined && {
        localidad: localidad ? String(localidad).trim() : null,
      }),
      ...(rubro !== undefined && {
        rubro: rubro ? String(rubro).trim() : null,
      }),
      ...(estado !== undefined && { estado }),
      ...(cbu !== undefined && { cbu: cbu ? String(cbu).trim() : null }),
      ...(alias !== undefined && {
        alias: alias ? String(alias).trim() : null,
      }),
      ...(notas !== undefined && {
        notas: notas ? String(notas).trim() : null,
      }),
    })
    .where(eq(proveedores.id, existing.id))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, req.params.id as string))
    .get()
  if (!existing) {
    res.status(404).json({ error: "Proveedor no encontrado" })
    return
  }

  const comprasCount = db
    .select({ n: sql<number>`count(*)` })
    .from(compras)
    .where(eq(compras.proveedorId, existing.id))
    .get()
  const ordenesCount = db
    .select({ n: sql<number>`count(*)` })
    .from(ordenesPago)
    .where(eq(ordenesPago.proveedorId, existing.id))
    .get()

  if ((comprasCount?.n ?? 0) > 0 || (ordenesCount?.n ?? 0) > 0) {
    res.status(400).json({
      error: `No se puede eliminar: tiene ${comprasCount?.n ?? 0} compra(s) y ${ordenesCount?.n ?? 0} orden(es) de pago asociadas.`,
    })
    return
  }

  db.delete(proveedores).where(eq(proveedores.id, existing.id)).run()
  res.json({ ok: true })
}
