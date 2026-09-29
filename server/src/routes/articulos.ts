import { Router } from "express"
import * as articulosController from "../controllers/articulos.controller.js"

const router = Router()

router.get("/", articulosController.getAll)
router.get("/:id", articulosController.getById)
router.get("/:id/historial-costos", articulosController.historialCostosByArticulo)
router.post("/", articulosController.create)
router.put("/:id/costo", articulosController.updateCosto)
router.put("/:id", articulosController.update)
router.delete("/:id", articulosController.remove)

export default router
