import { Router } from "express"

import * as controller from "../controllers/periodos.controller.js"

const router = Router()

router.get("/", controller.getAll)
router.get("/:mes/:anio", controller.getByPeriodo)
router.get("/:mes/:anio/preview", controller.preview)
router.post("/:mes/:anio/cerrar", controller.cerrar)
router.post("/:mes/:anio/abrir", controller.abrir)

export default router