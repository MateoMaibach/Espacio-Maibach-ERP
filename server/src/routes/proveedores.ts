import { Router } from "express"
import * as proveedoresController from "../controllers/proveedores.controller.js"
import * as comprasController from "../controllers/compras.controller.js"
import * as ordenesPagoController from "../controllers/ordenesPago.controller.js"

const router = Router()

router.get("/", proveedoresController.getAll)
router.get("/:id", proveedoresController.getById)
router.post("/", proveedoresController.create)
router.put("/:id", proveedoresController.update)
router.delete("/:id", proveedoresController.remove)

router.get("/:id/compras", comprasController.getByProveedor)
router.post("/:id/compras", comprasController.create)

router.get("/:id/ordenes-pago", ordenesPagoController.getByProveedor)
router.post("/:id/ordenes-pago", ordenesPagoController.create)

export default router
