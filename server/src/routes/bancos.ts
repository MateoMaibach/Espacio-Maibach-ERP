import { Router } from "express"

import * as bancosController from "../controllers/bancos.controller.js"

const router = Router()

router.get("/", bancosController.getAll)

router.post("/", bancosController.create)

router.put("/:id", bancosController.update)

router.delete("/:id", bancosController.remove)

export default router
