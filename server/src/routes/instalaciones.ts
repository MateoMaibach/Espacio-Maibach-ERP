import { Router } from "express"

import * as controller from "../controllers/instalaciones.controller.js"

const router = Router()

router.get("/ventas", controller.getVentas)

router.get("/", controller.getAll)

router.get("/:id", controller.getById)

router.post("/", controller.create)

router.put("/:id", controller.update)

router.delete("/:id", controller.remove)

export default router
