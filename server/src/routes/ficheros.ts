import { Router } from "express";
import { db } from "../db/index.js";
import { ficheros, clientes } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/clientes/:id/fichero", (req, res) => {
  const clienteId = req.params.id!;
  const cliente = db.select().from(clientes).where(eq(clientes.id, clienteId)).get();
  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" });
    return;
  }

  const existing = db.select().from(ficheros).where(eq(ficheros.clienteId, clienteId)).get();

  const { fecha, vendedor, comision, items, total, costos, tipoCobro, cantCuotas, estado } = req.body;

  if (existing) {
    db.update(ficheros).set({
      ...(fecha !== undefined && { fecha }),
      ...(vendedor !== undefined && { vendedor }),
      ...(comision !== undefined && { comision }),
      ...(items !== undefined && { items: typeof items === "string" ? items : JSON.stringify(items) }),
      ...(total !== undefined && { total }),
      ...(costos !== undefined && { costos: typeof costos === "string" ? costos : JSON.stringify(costos) }),
      ...(tipoCobro !== undefined && { tipoCobro }),
      ...(cantCuotas !== undefined && { cantCuotas }),
      ...(estado !== undefined && { estado }),
    }).where(eq(ficheros.id, existing.id)).run();
  } else {
    const id = `fich_${Date.now()}`;
    db.insert(ficheros).values({
      id,
      clienteId,
      fecha: fecha || "",
      vendedor: vendedor || "Martín Maibach",
      comision: comision || null,
      items: typeof items === "string" ? items : JSON.stringify(items || []),
      total: total || "$0",
      costos: costos ? (typeof costos === "string" ? costos : JSON.stringify(costos)) : null,
      tipoCobro: tipoCobro || "libre",
      cantCuotas: cantCuotas || 0,
      estado: estado || "pendiente",
      createdAt: new Date(),
    }).run();
  }

  res.json({ ok: true });
});

export default router;
