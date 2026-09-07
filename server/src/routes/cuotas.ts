import { Router } from "express";
import { db } from "../db/index.js";
import { ficheros, cuotas, clientes } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const router = Router();

function getFicheroByClienteId(clienteId: string) {
  return db.select().from(ficheros).where(eq(ficheros.clienteId, clienteId)).get();
}

function parseCurrency(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

function getCurrentDateStr(): string {
  const now = new Date();
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${String(now.getDate()).padStart(2, "0")} ${months[now.getMonth()]}, ${now.getFullYear()}`;
}

// Registrar pago inicial (cuota nro 0)
router.post("/clientes/:id/fichero/pago-inicial", (req, res) => {
  const cliente = db.select().from(clientes).where(eq(clientes.id, req.params.id!)).get();
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const fichero = getFicheroByClienteId(req.params.id!);
  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" });
    return;
  }

  const { monto, metodo, comprobante, observaciones } = req.body;
  if (!monto || monto <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" });
    return;
  }

  const existing = db.select().from(cuotas).where(
    and(eq(cuotas.ficheroId, fichero.id), eq(cuotas.nroCuota, 0))
  ).get();

  if (existing) {
    db.update(cuotas).set({
      montoPlanificado: monto,
      montoPagado: monto,
      estado: "Pagada",
      fechaPago: getCurrentDateStr(),
      metodo: metodo || existing.metodo,
      comprobante: comprobante || existing.comprobante,
      observaciones: observaciones || existing.observaciones,
    }).where(eq(cuotas.id, existing.id)).run();
  } else {
    db.insert(cuotas).values({
      id: `cuo_${Date.now()}_initial`,
      ficheroId: fichero.id,
      nroCuota: 0,
      fechaVencimiento: getCurrentDateStr(),
      montoPlanificado: monto,
      montoPagado: monto,
      estado: "Pagada",
      fechaPago: getCurrentDateStr(),
      metodo: metodo || null,
      comprobante: comprobante || null,
      observaciones: observaciones || null,
      descripcion: "Pago Inicial",
      createdAt: new Date(),
    }).run();
  }

  db.update(ficheros).set({ pagoInicial: monto }).where(eq(ficheros.id, fichero.id)).run();

  res.json({ ok: true });
});

// Generar plan de cuotas
router.post("/clientes/:id/fichero/cuotas/generar", (req, res) => {
  const cliente = db.select().from(clientes).where(eq(clientes.id, req.params.id!)).get();
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const fichero = getFicheroByClienteId(req.params.id!);
  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" });
    return;
  }

  const { cantCuotas, fechaPrimerVto } = req.body;
  const total = parseCurrency(fichero.total);
  const pagoInicial = fichero.pagoInicial || 0;
  const saldo = total - pagoInicial;
  const n = cantCuotas || fichero.cantCuotas || 1;

  if (saldo <= 0) {
    res.status(400).json({ error: "El saldo disponible es 0 o menor. No hay nada que dividir en cuotas." });
    return;
  }

  const monthsMap: Record<string, number> = { Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5, Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11 };
  const monthsArr = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const now = new Date();

  const dateStr = fechaPrimerVto || getCurrentDateStr();
  const parts = dateStr.replace(/,/g, "").split(/[\s\/]/);
  let startMonth = now.getMonth();
  let startYear = now.getFullYear();
  if (parts.length >= 3) {
    startMonth = monthsMap[parts[1] ?? ""] ?? now.getMonth();
    startYear = parseInt(parts[2] ?? "", 10) || now.getFullYear();
  }

  // Borrar solo cuotas con nro > 0 (no borrar pago inicial)
  const existingCuotas = db.select().from(cuotas).where(eq(cuotas.ficheroId, fichero.id)).all();
  for (const cuota of existingCuotas) {
    if (cuota.nroCuota > 0) {
      db.delete(cuotas).where(eq(cuotas.id, cuota.id)).run();
    }
  }

  const montoPorCuota = Math.floor(saldo / n);
  const montoUltima = saldo - montoPorCuota * (n - 1);

  for (let i = 0; i < n; i++) {
    const fecha = new Date(startYear, startMonth + i, 1);
    const day = String(fecha.getDate()).padStart(2, "0");
    const fechaVenc = `${day} ${monthsArr[fecha.getMonth()]}, ${fecha.getFullYear()}`;

    db.insert(cuotas).values({
      id: `cuo_${Date.now()}_${i}`,
      ficheroId: fichero.id,
      nroCuota: i + 1,
      fechaVencimiento: fechaVenc,
      montoPlanificado: i === n - 1 ? montoUltima : montoPorCuota,
      montoPagado: 0,
      estado: "Pendiente",
      descripcion: `Cuota ${i + 1}/${n}`,
      createdAt: new Date(),
    }).run();
  }

  db.update(ficheros).set({ tipoCobro: "cuotas", cantCuotas: n }).where(eq(ficheros.id, fichero.id)).run();

  res.json({ ok: true, cuotasGeneradas: n });
});

// Agregar cargo individual
router.post("/clientes/:id/fichero/cuotas", (req, res) => {
  const fichero = getFicheroByClienteId(req.params.id!);
  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" });
    return;
  }

  const { fechaVencimiento, monto, descripcion } = req.body;
  if (!monto || monto <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" });
    return;
  }

  const existingCuotas = db.select().from(cuotas).where(eq(cuotas.ficheroId, fichero.id)).all();
  const maxNro = existingCuotas.reduce((max, c) => Math.max(max, c.nroCuota), 0);

  db.insert(cuotas).values({
    id: `cuo_${Date.now()}`,
    ficheroId: fichero.id,
    nroCuota: maxNro + 1,
    fechaVencimiento: fechaVencimiento || getCurrentDateStr(),
    montoPlanificado: monto,
    montoPagado: 0,
    estado: "Pendiente",
    descripcion: descripcion || null,
    createdAt: new Date(),
  }).run();

  res.status(201).json({ ok: true });
});

// Editar cuota
router.put("/clientes/:id/fichero/cuotas/:cuotaId", (req, res) => {
  const cuota = db.select().from(cuotas).where(eq(cuotas.id, req.params.cuotaId!)).get();
  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" });
    return;
  }

  const { fechaVencimiento, monto, descripcion, metodo, comprobante, observaciones } = req.body;

  db.update(cuotas).set({
    ...(fechaVencimiento !== undefined && { fechaVencimiento }),
    ...(monto !== undefined && { montoPlanificado: monto }),
    ...(descripcion !== undefined && { descripcion }),
    ...(metodo !== undefined && { metodo }),
    ...(comprobante !== undefined && { comprobante }),
    ...(observaciones !== undefined && { observaciones }),
  }).where(eq(cuotas.id, req.params.cuotaId!)).run();

  res.json({ ok: true });
});

// Registrar cobro
router.post("/clientes/:id/fichero/cuotas/:cuotaId/cobrar", (req, res) => {
  const cuota = db.select().from(cuotas).where(eq(cuotas.id, req.params.cuotaId!)).get();
  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" });
    return;
  }

  const { monto, metodo, comprobante, observaciones } = req.body;
  if (!monto || monto <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" });
    return;
  }

  const nuevoMontoPagado = cuota.montoPagado + monto;
  const nuevoEstado = nuevoMontoPagado >= cuota.montoPlanificado ? "Pagada" : "Parcial";

  db.update(cuotas).set({
    montoPagado: nuevoMontoPagado,
    estado: nuevoEstado,
    fechaPago: getCurrentDateStr(),
    ...(metodo !== undefined && { metodo }),
    ...(comprobante !== undefined && { comprobante }),
    ...(observaciones !== undefined && { observaciones }),
  }).where(eq(cuotas.id, req.params.cuotaId!)).run();

  res.json({ ok: true, nuevoEstado, montoPagado: nuevoMontoPagado });
});

// Eliminar cuota
router.delete("/clientes/:id/fichero/cuotas/:cuotaId", (req, res) => {
  const cuota = db.select().from(cuotas).where(eq(cuotas.id, req.params.cuotaId!)).get();
  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" });
    return;
  }

  // Si es pago inicial (nro 0), limpiar el campo pagoInicial del fichero
  if (cuota.nroCuota === 0) {
    const fichero = db.select().from(ficheros).where(eq(ficheros.id, cuota.ficheroId)).get();
    if (fichero) {
      db.update(ficheros).set({ pagoInicial: 0 }).where(eq(ficheros.id, fichero.id)).run();
    }
  }

  db.delete(cuotas).where(eq(cuotas.id, req.params.cuotaId!)).run();
  res.json({ ok: true });
});

export default router;
