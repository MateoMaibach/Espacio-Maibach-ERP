import { Router } from "express";
import * as controller from "../controllers/ficheros.controller.js";

const router = Router();

router.post("/clientes/:id/fichero", controller.upsert);
router.delete("/clientes/:id/fichero", controller.remove);

export default router;
