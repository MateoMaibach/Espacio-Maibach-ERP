import { Request, Response } from "express";
import { db } from "../db/index.js";
import { movimientos, cierres, cajas } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

function getCurrentDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseFecha(fecha: string): { mes: number; anio: number } | null {
  const parts = fecha.split("-");
  if (parts.length < 3) return null;
  const anio = parseInt(parts[0]);
  const mes = parseInt(parts[1]);
  if (isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) return null;
  return { mes, anio };
}

export function getAllMovimientos(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
  const subCaja = req.query.subCaja as string | undefined;

  let allMovimientos = db.select().from(movimientos).all();

  allMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha);
    if (!parsed) return false;
    const matchMes = parsed.mes === mes && parsed.anio === anio;
    const matchSubCaja = !subCaja || subCaja === "Todas" || m.subCaja === subCaja;
    return matchMes && matchSubCaja;
  });

  allMovimientos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json(allMovimientos);
}

export function getMovimiento(req: Request, res: Response) {
  const movimiento = db.select().from(movimientos).where(eq(movimientos.id, req.params.id as string)).get();
  if (!movimiento) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }
  res.json(movimiento);
}

export function createMovimiento(req: Request, res: Response) {
  const { fecha, concepto, monto, tipo, subCaja, moneda, tipoCambio, categoria, comprobante, observaciones } = req.body;

  if (!concepto || monto == null || monto === "" || !tipo || !subCaja) {
    res.status(400).json({ error: "Faltan campos obligatorios: concepto, monto, tipo, subCaja" });
    return;
  }

  if (tipo !== "ingreso" && tipo !== "egreso") {
    res.status(400).json({ error: "Tipo debe ser 'ingreso' o 'egreso'" });
    return;
  }

  const id = `mov_${Date.now()}`;
  const fechaStr = fecha || getCurrentDateStr();
  const monedaStr = moneda || "ARS";

  db.insert(movimientos).values({
    id,
    fecha: fechaStr,
    concepto,
    monto,
    tipo,
    subCaja,
    moneda: monedaStr,
    tipoCambio: tipoCambio || null,
    categoria: categoria || null,
    comprobante: comprobante || null,
    observaciones: observaciones || null,
    createdAt: new Date(),
  }).run();

  res.status(201).json({ ok: true, id });
}

export function updateMovimiento(req: Request, res: Response) {
  const existing = db.select().from(movimientos).where(eq(movimientos.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }

  const { fecha, concepto, monto, tipo, subCaja, moneda, tipoCambio, categoria, comprobante, observaciones } = req.body;

  if (tipo !== undefined && tipo !== "ingreso" && tipo !== "egreso") {
    res.status(400).json({ error: "Tipo debe ser 'ingreso' o 'egreso'" });
    return;
  }

  db.update(movimientos).set({
    ...(fecha !== undefined && { fecha }),
    ...(concepto !== undefined && { concepto }),
    ...(monto !== undefined && { monto }),
    ...(tipo !== undefined && { tipo }),
    ...(subCaja !== undefined && { subCaja }),
    ...(moneda !== undefined && { moneda }),
    ...(tipoCambio !== undefined && { tipoCambio }),
    ...(categoria !== undefined && { categoria }),
    ...(comprobante !== undefined && { comprobante }),
    ...(observaciones !== undefined && { observaciones }),
  }).where(eq(movimientos.id, req.params.id as string)).run();

  res.json({ ok: true });
}

export function deleteMovimiento(req: Request, res: Response) {
  const existing = db.select().from(movimientos).where(eq(movimientos.id, req.params.id as string)).get();
  if (!existing) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }

  db.delete(movimientos).where(eq(movimientos.id, req.params.id as string)).run();
  res.json({ ok: true });
}

export function getCierres(req: Request, res: Response) {
  const subCaja = req.query.subCaja as string | undefined;

  let results;
  if (subCaja) {
    results = db.select().from(cierres).where(eq(cierres.subCaja, subCaja)).all();
  } else {
    results = db.select().from(cierres).all();
  }

  results.sort((a, b) => {
    const fa = a.fecha || a.fechaCierre;
    const fb = b.fecha || b.fechaCierre;
    return fb.localeCompare(fa);
  });

  res.json(results);
}

export function getCierresPreview(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
  const subCaja = req.query.subCaja as string;

  if (!subCaja) {
    res.status(400).json({ error: "Faltan campos obligatorios: subCaja" });
    return;
  }

  const allMovimientos = db.select().from(movimientos).all();
  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha);
    if (!parsed) return false;
    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja;
  });

  const saldoFinal = mesMovimientos.reduce((acc, m) => {
    return acc + (m.tipo === "ingreso" ? m.monto : -m.monto);
  }, 0);

  const lastCierre = db.select().from(cierres).where(eq(cierres.subCaja, subCaja)).all()
    .sort((a, b) => (b.fecha || b.fechaCierre).localeCompare(a.fecha || a.fechaCierre))[0];
  const saldoInicial = lastCierre ? lastCierre.saldoReal : 0;

  res.json({ saldoInicial, saldoFinal, saldoEsperado: saldoInicial + saldoFinal });
}

export function realizarCierre(req: Request, res: Response) {
  const { mes, anio, subCaja, saldoReal, observaciones, fecha } = req.body;

  if (!mes || !anio || !subCaja || saldoReal === undefined) {
    res.status(400).json({ error: "Faltan campos obligatorios: mes, anio, subCaja, saldoReal" });
    return;
  }

  const monthsArr = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const mesStr = monthsArr[mes - 1];

  const allMovimientos = db.select().from(movimientos).all();
  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha);
    if (!parsed) return false;
    return parsed.mes === mes && parsed.anio === anio && m.subCaja === subCaja;
  });

  const saldoFinal = mesMovimientos.reduce((acc, m) => {
    return acc + (m.tipo === "ingreso" ? m.monto : -m.monto);
  }, 0);

  const lastCierre = db.select().from(cierres).where(eq(cierres.subCaja, subCaja)).all()
    .sort((a, b) => (b.fecha || b.fechaCierre).localeCompare(a.fecha || a.fechaCierre))[0];
  const saldoInicial = lastCierre ? lastCierre.saldoReal : 0;

  const diff = saldoReal - (saldoInicial + saldoFinal);

  if (diff !== 0) {
    const ajusteTipo = diff > 0 ? "ingreso" : "egreso";
    const ajusteMonto = Math.abs(diff);

    db.insert(movimientos).values({
      id: `mov_${Date.now()}_ajuste`,
      fecha: getCurrentDateStr(),
      concepto: `Ajuste por cierre ${subCaja} - ${fecha || getCurrentDateStr()}`,
      monto: ajusteMonto,
      tipo: ajusteTipo,
      subCaja,
      moneda: "ARS",
      categoria: "Ajuste por cierre",
      observaciones: observaciones || `Diferencia de $${diff.toLocaleString("es-AR")}`,
      createdAt: new Date(),
    }).run();
  }

  const id = `cierre_${Date.now()}`;
  db.insert(cierres).values({
    id,
    mes,
    anio,
    subCaja,
    saldoInicial,
    saldoFinal,
    saldoReal,
    diferencia: diff,
    fecha: fecha || getCurrentDateStr(),
    fechaCierre: getCurrentDateStr(),
    observaciones: observaciones || null,
    createdAt: new Date(),
  }).run();

  res.status(201).json({ ok: true, id, diferencia: diff });
}

export function getResumenCaja(req: Request, res: Response) {
  const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
  const anio = parseInt(req.query.anio as string) || new Date().getFullYear();

  const allMovimientos = db.select().from(movimientos).all();
  const mesMovimientos = allMovimientos.filter((m) => {
    const parsed = parseFecha(m.fecha);
    if (!parsed) return false;
    return parsed.mes === mes && parsed.anio === anio;
  });

  const cajasActivas = db.select().from(cajas).all().filter((c) => c.activa === 1);
  const resumen: Record<string, { total: number; ingresos: number; egresos: number }> = {};

  for (const cajaItem of cajasActivas) {
    const scMovimientos = mesMovimientos.filter((m) => m.subCaja === cajaItem.nombre);
    const ingresos = scMovimientos.filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + m.monto, 0);
    const egresos = scMovimientos.filter((m) => m.tipo === "egreso").reduce((acc, m) => acc + m.monto, 0);
    resumen[cajaItem.nombre] = { total: ingresos - egresos, ingresos, egresos };
  }

  const generalMovimientos = mesMovimientos.filter((m) => {
    const caja = cajasActivas.find((c) => c.nombre === m.subCaja);
    return caja ? caja.afectaGeneral === 1 : true;
  });
  const totalIngresos = generalMovimientos.filter((m) => m.tipo === "ingreso").reduce((acc, m) => acc + m.monto, 0);
  const totalEgresos = generalMovimientos.filter((m) => m.tipo === "egreso").reduce((acc, m) => acc + m.monto, 0);

  res.json({ subCajas: resumen, totalIngresos, totalEgresos, gananciaNeta: totalIngresos - totalEgresos });
}
