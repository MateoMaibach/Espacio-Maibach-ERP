import { Request, Response } from "express"

import { db } from "../db/index.js"

import { cheques, clientes, proveedores } from "../db/schema.js"

import { eq, desc } from "drizzle-orm"

const ESTADOS_POR_TIPO: Record<string, string[]> = {
  emitido: ["Pendiente", "Pagado", "Rechazado"],

  recibido: ["En Cartera", "Depositado", "Entregado", "Rechazado"],
}

const CAMPOS_OBLIGATORIOS: Record<string, string[]> = {
  emitido: [
    "banco",
    "numero",
    "fechaEmision",
    "fechaCobro",
    "destinatario",
    "importe",
  ],

  recibido: [
    "recibidoDe",
    "banco",
    "numero",
    "fechaCobro",
    "fechaRecepcion",
    "importe",
  ],
}

function validarCliente(clienteId: unknown): string | null {
  if (clienteId === undefined || clienteId === null || clienteId === "")
    return null

  const existe = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, String(clienteId)))
    .get()

  if (!existe) return "El cliente indicado no existe"

  return null
}

function validarProveedor(proveedorId: unknown): string | null {
  if (proveedorId === undefined || proveedorId === null || proveedorId === "")
    return null

  const existe = db
    .select()
    .from(proveedores)
    .where(eq(proveedores.id, String(proveedorId)))
    .get()

  if (!existe) return "El proveedor indicado no existe"

  return null
}

export function getAll(req: Request, res: Response) {
  const tipo = req.query.tipo as string | undefined

  if (tipo && !(tipo in ESTADOS_POR_TIPO)) {
    res
      .status(400)
      .json({ error: "Tipo inválido: debe ser 'emitido' o 'recibido'" })

    return
  }

  const rows = db

    .select({ cheque: cheques, clienteNombre: clientes.nombre })

    .from(cheques)

    .leftJoin(clientes, eq(cheques.clienteId, clientes.id))

    .orderBy(desc(cheques.createdAt), desc(cheques.id))

    .all()

    .filter((r) => !tipo || r.cheque.tipo === tipo)

    .map((r) => ({ ...r.cheque, clienteNombre: r.clienteNombre ?? null }))

  res.json(rows)
}

export function getById(req: Request, res: Response) {
  const row = db

    .select({ cheque: cheques, clienteNombre: clientes.nombre })

    .from(cheques)

    .leftJoin(clientes, eq(cheques.clienteId, clientes.id))

    .where(eq(cheques.id, req.params.id as string))

    .get()

  if (!row) {
    res.status(404).json({ error: "Cheque no encontrado" })

    return
  }

  res.json({ ...row.cheque, clienteNombre: row.clienteNombre ?? null })
}

export function create(req: Request, res: Response) {
  const {
    tipo,
    banco,
    sucursal,
    numero,
    recibidoDe,
    destinatario,
    fechaEmision,
    fechaCobro,
    fechaPago,
    fechaRecepcion,
    entregadoA,
    fechaEntrega,
    importe,
    estado,
    clienteId,
    aplicaPagoProveedor,
    proveedorId,
  } = req.body

  if (!tipo || !(tipo in ESTADOS_POR_TIPO)) {
    res
      .status(400)
      .json({ error: "Tipo inválido: debe ser 'emitido' o 'recibido'" })

    return
  }

  const faltantes = CAMPOS_OBLIGATORIOS[tipo].filter((campo) => {
    const valor = (req.body as Record<string, unknown>)[campo]

    return valor === undefined || valor === null || valor === ""
  })

  if (faltantes.length > 0) {
    res
      .status(400)
      .json({ error: `Faltan campos obligatorios: ${faltantes.join(", ")}` })

    return
  }

  const importeNum = Number(importe)

  if (!Number.isFinite(importeNum) || importeNum <= 0) {
    res.status(400).json({ error: "El importe debe ser un número mayor a 0" })

    return
  }

  const estadoFinal = estado || ESTADOS_POR_TIPO[tipo][0]

  if (!ESTADOS_POR_TIPO[tipo].includes(estadoFinal)) {
    res
      .status(400)
      .json({
        error: `Estado inválido para cheques ${tipo}es. Debe ser: ${ESTADOS_POR_TIPO[tipo].join(", ")}`,
      })

    return
  }

  const errorCliente = validarCliente(clienteId)

  if (errorCliente) {
    res.status(400).json({ error: errorCliente })

    return
  }

  const errorProveedor = validarProveedor(proveedorId)

  if (errorProveedor) {
    res.status(400).json({ error: errorProveedor })

    return
  }

  const aplicaPago = tipo === "emitido" && Boolean(aplicaPagoProveedor)

  if (aplicaPago && !proveedorId) {
    res
      .status(400)
      .json({
        error:
          "Debe indicar el proveedor cuando el cheque aplica a un pago a proveedores",
      })

    return
  }

  const id = `chq_${Date.now()}`

  db.insert(cheques)
    .values({
      id,

      tipo,

      banco,

      sucursal: sucursal || null,

      numero,

      recibidoDe: tipo === "recibido" ? recibidoDe || null : null,

      destinatario: tipo === "emitido" ? destinatario || null : null,

      fechaEmision: tipo === "emitido" ? fechaEmision || null : null,

      fechaCobro,

      fechaPago: tipo === "emitido" ? fechaPago || null : null,

      fechaRecepcion: tipo === "recibido" ? fechaRecepcion || null : null,

      entregadoA: tipo === "recibido" ? entregadoA || null : null,

      fechaEntrega: tipo === "recibido" ? fechaEntrega || null : null,

      importe: Math.round(importeNum),

      estado: estadoFinal,

      clienteId: clienteId || null,

      aplicaPagoProveedor: aplicaPago ? 1 : 0,

      proveedorId: aplicaPago ? proveedorId : null,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true, id })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(cheques)
    .where(eq(cheques.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Cheque no encontrado" })

    return
  }

  const {
    tipo,
    banco,
    sucursal,
    numero,
    recibidoDe,
    destinatario,
    fechaEmision,
    fechaCobro,
    fechaPago,
    fechaRecepcion,
    entregadoA,
    fechaEntrega,
    importe,
    estado,
    clienteId,
    aplicaPagoProveedor,
    proveedorId,
  } = req.body

  const tipoFinal = tipo ?? existing.tipo

  if (!(tipoFinal in ESTADOS_POR_TIPO)) {
    res
      .status(400)
      .json({ error: "Tipo inválido: debe ser 'emitido' o 'recibido'" })

    return
  }

  if (estado !== undefined && !ESTADOS_POR_TIPO[tipoFinal].includes(estado)) {
    res
      .status(400)
      .json({
        error: `Estado inválido para cheques ${tipoFinal}es. Debe ser: ${ESTADOS_POR_TIPO[tipoFinal].join(", ")}`,
      })

    return
  }

  if (
    importe !== undefined &&
    (!Number.isFinite(Number(importe)) || Number(importe) <= 0)
  ) {
    res.status(400).json({ error: "El importe debe ser un número mayor a 0" })

    return
  }

  let clienteIdFinal: string | null | undefined

  if (clienteId !== undefined) {
    const errorCliente = validarCliente(clienteId)

    if (errorCliente) {
      res.status(400).json({ error: errorCliente })

      return
    }

    clienteIdFinal = clienteId || null
  }

  if (proveedorId !== undefined) {
    const errorProveedor = validarProveedor(proveedorId)

    if (errorProveedor) {
      res.status(400).json({ error: errorProveedor })

      return
    }
  }

  let aplicaPagoFinal: number | undefined

  let proveedorIdFinal: string | null | undefined

  if (
    aplicaPagoProveedor !== undefined ||
    proveedorId !== undefined ||
    tipo !== undefined
  ) {
    const aplica =
      tipoFinal === "emitido" &&
      Boolean(
        aplicaPagoProveedor !== undefined
          ? aplicaPagoProveedor
          : existing.aplicaPagoProveedor,
      )

    const provId =
      proveedorId !== undefined ? proveedorId || null : existing.proveedorId

    if (aplica && !provId) {
      res
        .status(400)
        .json({
          error:
            "Debe indicar el proveedor cuando el cheque aplica a un pago a proveedores",
        })

      return
    }

    aplicaPagoFinal = aplica ? 1 : 0

    proveedorIdFinal = aplica ? provId : null
  }

  db.update(cheques)
    .set({
      ...(tipo !== undefined && { tipo: tipoFinal }),

      ...(banco !== undefined && { banco }),

      ...(sucursal !== undefined && { sucursal: sucursal || null }),

      ...(numero !== undefined && { numero }),

      ...(recibidoDe !== undefined && { recibidoDe: recibidoDe || null }),

      ...(destinatario !== undefined && { destinatario: destinatario || null }),

      ...(fechaEmision !== undefined && { fechaEmision: fechaEmision || null }),

      ...(fechaCobro !== undefined && { fechaCobro }),

      ...(fechaPago !== undefined && { fechaPago: fechaPago || null }),

      ...(fechaRecepcion !== undefined && {
        fechaRecepcion: fechaRecepcion || null,
      }),

      ...(entregadoA !== undefined && { entregadoA: entregadoA || null }),

      ...(fechaEntrega !== undefined && { fechaEntrega: fechaEntrega || null }),

      ...(importe !== undefined && { importe: Math.round(Number(importe)) }),

      ...(estado !== undefined && { estado }),

      ...(clienteIdFinal !== undefined && { clienteId: clienteIdFinal }),

      ...(aplicaPagoFinal !== undefined && {
        aplicaPagoProveedor: aplicaPagoFinal,
      }),

      ...(proveedorIdFinal !== undefined && { proveedorId: proveedorIdFinal }),
    })
    .where(eq(cheques.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(cheques)
    .where(eq(cheques.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Cheque no encontrado" })

    return
  }

  db.delete(cheques)
    .where(eq(cheques.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
