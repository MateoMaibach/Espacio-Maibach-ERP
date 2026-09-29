import { Router } from "express"
import * as comprasController from "../controllers/compras.controller.js"

const router = Router()

router.get("/:id", comprasController.getById)
router.get("/:id/recepciones", comprasController.getRecepciones)
router.post("/:id/recepciones", comprasController.createRecepcion)
router.put("/:id", comprasController.update)
router.delete("/:id", comprasController.remove)

export default router
