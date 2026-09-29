import { Router } from "express"
import * as stockController from "../controllers/stock.controller.js"

const router = Router()

router.get("/movimientos", stockController.getMovimientos)

router.get("/reportes/negativos", stockController.getReporteNegativos)
router.get("/reportes/valorizacion", stockController.getReporteValorizacion)
router.get("/reportes/costos", stockController.getReporteCostos)

router.get("/", stockController.getExistencias)

router.post("/ingresos-iniciales", stockController.createIngresoInicial)
router.post("/ajustes", stockController.createAjuste)

export default router
