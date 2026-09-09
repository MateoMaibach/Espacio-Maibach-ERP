import { Request, Response } from "express";
import { db } from "../db/index.js";
import { clientes, ficheros, cuotas } from "../db/schema.js";
import { eq } from "drizzle-orm";

export function getAll(_req: Request, res: Response) {
  const all = db.select().from(clientes).all();
  res.json(all);
}

export function getById(req: Request, res: Response) {
  const cliente = db.select().from(clientes).where(eq(clientes.id, req.params.id as string)).get();
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const fichero = db.select().from(ficheros).where(eq(ficheros.clienteId, req.params.id as string)).get();
  let cuotasList: typeof cuotas.$inferSelect[] = [];
  if (fichero) {
    cuotasList = db.select().from(cuotas).where(eq(cuotas.ficheroId, fichero.id)).all();
  }

  res.json({ ...cliente, fichero, cuotas: cuotasList });
}

export function create(req: Request, res: Response) {
  const { id, nombre, cuit, email, telefono, direccion, localidad, dni, estado, vendedor, metodoPago, notas, fechaAlta } = req.body;
  if (!id || !nombre || !fechaAlta) {
    res.status(400).json({ error: "Faltan campos obligatorios: id, nombre, fechaAlta" });
    return;
  }

  const existing = db.select().from(clientes).where(eq(clientes.id, id)).get();
  if (existing) {
    res.status(409).json({ error: "Ya existe un cliente con ese ID" });
    return;
  }

  db.insert(clientes).values({
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
  }).run();

  res.status(201).json({ ok: true });
}

export function update(req: Request, res: Response) {
  const existing = db.select().from(clientes).where(eq(clientes.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const { nombre, cuit, email, telefono, direccion, localidad, dni, estado, vendedor, metodoPago, notas } = req.body;

  db.update(clientes).set({
    ...(nombre !== undefined && { nombre }),
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
  }).where(eq(clientes.id, req.params.id as string)).run();

  res.json({ ok: true });
}

export function remove(req: Request, res: Response) {
  const existing = db.select().from(clientes).where(eq(clientes.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  db.delete(clientes).where(eq(clientes.id, req.params.id as string)).run();
  res.json({ ok: true });
}
