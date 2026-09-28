import { Router } from "express"
import * as ordenesPagoController from "../controllers/ordenesPago.controller.js"

const router = Router()

router.get("/:id", ordenesPagoController.getById)
router.post("/:id/anular", ordenesPagoController.anular)

export default router
