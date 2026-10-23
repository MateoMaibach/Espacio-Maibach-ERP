import { Request, Response } from "express"

import { db } from "../db/index.js"

import { clientes, ficheros, cuotas } from "../db/schema.js"

import { eq } from "drizzle-orm"

import { conDerivados } from "./ficheros.controller.js"

import { aCentavos, deCentavos } from "../services/money.js"

/**
 * Estados validos de un cliente.
 *
 * `Moroso` no se persiste normalmente (lo calcula el front a partir de las
 * cuotas vencidas) pero aparece en la UI, asi que se acepta.
 */
const ESTADOS_CLIENTE = ["Activo", "Inactivo", "Moroso", "Potencial"]

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(clientes).all()

  res.json(all)
}

export function getById(req: Request, res: Response) {
  const cliente = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  const fichero = db
    .select()
    .from(ficheros)
    .where(eq(ficheros.clienteId, req.params.id as string))
    .get()

  let cuotasList: typeof cuotas.$inferSelect[] = []

  if (fichero) {
    cuotasList = db
      .select()
      .from(cuotas)
      .where(eq(cuotas.ficheroId, fichero.id))
      .all()
  }

  res.json({
    ...cliente,
    fichero: fichero ? conDerivados(fichero) : null,
    cuotas: cuotasList,
  })
}

export function create(req: Request, res: Response) {
  const {
    id,
    nombre,
    cuit,
    email,
    telefono,
    direccion,
    localidad,
    dni,
    estado,
    vendedor,
    metodoPago,
    notas,
    fechaAlta,
  } = req.body

  if (!id || !nombre || !fechaAlta) {
    res
      .status(400)
      .json({ error: "Faltan campos obligatorios: id, nombre, fechaAlta" })

    return
  }

  const existing = db.select().from(clientes).where(eq(clientes.id, id)).get()

  if (existing) {
    res.status(409).json({ error: "Ya existe un cliente con ese ID" })

    return
  }

  db.insert(clientes)
    .values({
      id,

      nombre,

      cuit: cuit || null,

      email: email || null,

      telefono: telefono || null,

      direccion: direccion || null,

      localidad: localidad || null,

      dni: dni || null,

      estado: estado || "Activo",

      vendedor: vendedor || "Martín Maibach",

      metodoPago: metodoPago || null,

      notas: notas || null,

      fechaAlta,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true })
}

export function update(req: Request, res: Response) {
  const existing = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  const {
    nombre,
    cuit,
    email,
    telefono,
    direccion,
    localidad,
    dni,
    estado,
    vendedor,
    metodoPago,
    notas,
  } = req.body

  /**
   * El POST valida que `nombre` venga; el PUT no validaba nada, asi que
   * `nombre: ""` dejaba al cliente sin nombre y `estado: "Banana"` se
   * guardaba tal cual. `fechaAlta` tampoco se lee (es identidad, no se toca).
   */
  if (nombre !== undefined) {
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "El nombre no puede quedar vacio" })

      return
    }

    if (nombre.trim().length > 200) {
      res.status(400).json({ error: "El nombre es demasiado largo" })

      return
    }
  }

  if (estado !== undefined && !ESTADOS_CLIENTE.includes(String(estado))) {
    res.status(400).json({
      error: `Estado inválido. Debe ser: ${ESTADOS_CLIENTE.join(", ")}`,
    })

    return
  }

  db.update(clientes)
    .set({
      ...(nombre !== undefined && { nombre: (nombre as string).trim() }),

      ...(cuit !== undefined && { cuit }),

      ...(email !== undefined && { email }),

      ...(telefono !== undefined && { telefono }),

      ...(direccion !== undefined && { direccion }),

      ...(localidad !== undefined && { localidad }),

      ...(dni !== undefined && { dni }),

      ...(estado !== undefined && { estado }),

      ...(vendedor !== undefined && { vendedor }),

      ...(metodoPago !== undefined && { metodoPago }),

      ...(notas !== undefined && { notas }),
    })
    .where(eq(clientes.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}

export function remove(req: Request, res: Response) {
  const existing = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  if (!existing) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  /**
   * El borrado cascada: clientes -> ficheros -> cuotas. Sin este chequeo,
   * borrar un cliente con historial de cobros eliminaba para siempre la
   * evidencia de lo que pagó, y no quedaba ni un registro de que existió.
   *
   * `?forzar=1` mantiene el comportamiento anterior para cuando el borrado es
   * deliberado y ya se verificó que no importa el historial.
   */
  const forzar = req.query.forzar === "1" || req.query.forzar === "true"

  const todasLasCuotas = db.select().from(cuotas).all()

  const delCliente = todasLasCuotas.filter(c => {
    const f = db
      .select()
      .from(ficheros)
      .where(eq(ficheros.id, c.ficheroId))
      .get()

    return f?.clienteId === existing.id
  })

  const cobradas = delCliente.filter(c => (c.montoPagado ?? 0) > 0)

  if (!forzar && cobradas.length > 0) {
    const total = deCentavos(
      cobradas.reduce((a, c) => a + aCentavos(c.montoPagado), 0),
    )

    res.status(409).json({
      error:
        `No se puede eliminar: el cliente tiene ${cobradas.length} cuota(s) cobradas ` +
        `(${total.toLocaleString("es-AR")} en total). ` +
        `Borrarlo destruiría el historial de pagos. ` +
        `Si realmente querés hacerlo, repetí con ?forzar=1.`,
    })

    return
  }

  db.delete(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .run()

  res.json({ ok: true })
}
