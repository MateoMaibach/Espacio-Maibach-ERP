import { Router } from "express";
import * as controller from "../controllers/cuotas.controller.js";

const router = Router();

router.post("/clientes/:id/fichero/pago-inicial", controller.registrarPagoInicial);
router.post("/clientes/:id/fichero/cuotas/generar", controller.generarPlan);
router.post("/clientes/:id/fichero/cuotas", controller.agregarCargo);
router.put("/clientes/:id/fichero/cuotas/:cuotaId", controller.editarCuota);
router.post("/clientes/:id/fichero/cuotas/:cuotaId/cobrar", controller.registrarCobro);
router.delete("/clientes/:id/fichero/cuotas/:cuotaId", controller.eliminarCuota);

export default router;
