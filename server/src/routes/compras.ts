import { Router } from "express"
import * as comprasController from "../controllers/compras.controller.js"

const router = Router()

router.get("/:id", comprasController.getById)
router.put("/:id", comprasController.update)
router.delete("/:id", comprasController.remove)

export default router
