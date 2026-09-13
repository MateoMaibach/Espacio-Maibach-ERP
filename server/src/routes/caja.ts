import { Router } from "express";
import * as cajaController from "../controllers/caja.controller.js";
import { db } from "../db/index.js";
import { cajas } from "../db/schema.js";

const router = Router();

router.get("/cajas", (_req, res) => {
  const all = db.select().from(cajas).all().filter((c) => c.activa === 1);
  all.sort((a, b) => a.orden - b.orden);
  res.json(all);
});

router.get("/movimientos", cajaController.getAllMovimientos);
router.get("/movimientos/:id", cajaController.getMovimiento);
router.post("/movimientos", cajaController.createMovimiento);
router.put("/movimientos/:id", cajaController.updateMovimiento);
router.delete("/movimientos/:id", cajaController.deleteMovimiento);
router.get("/cierres", cajaController.getCierres);
router.get("/cierres/preview", cajaController.getCierresPreview);
router.post("/cierres", cajaController.realizarCierre);
router.get("/resumen", cajaController.getResumenCaja);

export default router;
