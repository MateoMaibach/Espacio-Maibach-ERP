import { Router } from "express";
import * as cajasController from "../controllers/cajas.controller.js";

const router = Router();

router.get("/", cajasController.getAll);
router.post("/", cajasController.create);
router.put("/:id", cajasController.update);
router.delete("/:id", cajasController.remove);

export default router;
