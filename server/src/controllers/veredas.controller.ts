import { Request, Response } from "express";
import { db } from "../db/index.js";
import { veredas, clientes, equipos } from "../db/schema.js";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const ESTADOS = ["Pendiente", "En Proceso", "Completada"];
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(fecha: unknown): string | null {
  if (fecha === undefined || fecha === null || String(fecha) === "") return "La fecha es obligatoria";
  if (!FECHA_REGEX.test(String(fecha))) return "La fecha debe tener formato yyyy-mm-dd";
  return null;
}

function validarCliente(clienteId: unknown): string | null {
  if (clienteId === undefined || clienteId === null || String(clienteId) === "") return "El cliente es obligatorio";
  const existe = db.select().from(clientes).where(eq(clientes.id, String(clienteId))).get();
  if (!existe) return "El cliente indicado no existe";
  return null;
}

function validarEquipo(equipoId: unknown): string | null {
  if (equipoId === undefined || equipoId === null || equipoId === "") return null;
  const existe = db.select().from(equipos).where(eq(equipos.id, String(equipoId))).get();
  if (!existe) return "El equipo indicado no existe";
  return null;
}

export function getAll(req: Request, res: Response) {
  const { desde, hasta } = req.query as { desde?: string; hasta?: string };

  const condiciones = [];
  if (desde && FECHA_REGEX.test(desde)) condiciones.push(gte(veredas.fecha, desde));
  if (hasta && FECHA_REGEX.test(hasta)) condiciones.push(lte(veredas.fecha, hasta));

  const rows = db
    .select({
      vereda: veredas,
      clienteNombre: clientes.nombre,
      clienteDireccion: clientes.direccion,
      equipoNombre: equipos.nombre,
      equipoEncargado: equipos.encargado,
    })
    .from(veredas)
    .innerJoin(clientes, eq(veredas.clienteId, clientes.id))
    .leftJoin(equipos, eq(veredas.equipoId, equipos.id))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(veredas.fecha), desc(veredas.id))
    .all();

  res.json(
    rows.map((r) => ({
      ...r.vereda,
      clienteNombre: r.clienteNombre,
      clienteDireccion: r.clienteDireccion ?? null,
      equipoNombre: r.equipoNombre ?? null,
      equipoEncargado: r.equipoEncargado ?? null,
    }))
  );
}

export function create(req: Request, res: Response) {
  const { clienteId, fecha, equipoId, estado, notas } = req.body;

  const errorCliente = validarCliente(clienteId);
  if (errorCliente) {
    res.status(400).json({ error: errorCliente });
    return;
  }

  const errorFecha = validarFecha(fecha);
  if (errorFecha) {
    res.status(400).json({ error: errorFecha });
    return;
  }

  const errorEquipo = validarEquipo(equipoId);
  if (errorEquipo) {
    res.status(400).json({ error: errorEquipo });
    return;
  }

  const estadoFinal = estado || "Pendiente";
  if (!ESTADOS.includes(estadoFinal)) {
    res.status(400).json({ error: `Estado inválido. Debe ser: ${ESTADOS.join(", ")}` });
    return;
  }

  const id = `ver_${Date.now()}`;
  db.insert(veredas).values({
    id,
    clienteId: String(clienteId),
    fecha: String(fecha),
    equipoId: equipoId || null,
    estado: estadoFinal,
    notas: notas ? String(notas) : null,
    createdAt: new Date(),
  }).run();

  res.status(201).json({ ok: true, id });
}

export function update(req: Request, res: Response) {
  const existing = db.select().from(veredas).where(eq(veredas.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Vereda no encontrada" });
    return;
  }

  const { clienteId, fecha, equipoId, estado, notas } = req.body;

  if (clienteId !== undefined) {
    const errorCliente = validarCliente(clienteId);
    if (errorCliente) {
      res.status(400).json({ error: errorCliente });
      return;
    }
  }

  if (fecha !== undefined) {
    const errorFecha = validarFecha(fecha);
    if (errorFecha) {
      res.status(400).json({ error: errorFecha });
      return;
    }
  }

  const errorEquipo = validarEquipo(equipoId);
  if (errorEquipo) {
    res.status(400).json({ error: errorEquipo });
    return;
  }

  if (estado !== undefined && !ESTADOS.includes(estado)) {
    res.status(400).json({ error: `Estado inválido. Debe ser: ${ESTADOS.join(", ")}` });
    return;
  }

  db.update(veredas).set({
    ...(clienteId !== undefined && { clienteId: String(clienteId) }),
    ...(fecha !== undefined && { fecha: String(fecha) }),
    ...(equipoId !== undefined && { equipoId: equipoId || null }),
    ...(estado !== undefined && { estado }),
    ...(notas !== undefined && { notas: notas ? String(notas) : null }),
  }).where(eq(veredas.id, req.params.id as string)).run();

  res.json({ ok: true });
}

export function remove(req: Request, res: Response) {
  const existing = db.select().from(veredas).where(eq(veredas.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Vereda no encontrada" });
    return;
  }

  db.delete(veredas).where(eq(veredas.id, req.params.id as string)).run();
  res.json({ ok: true });
}
