import { Router } from "express"
import * as remitosController from "../controllers/remitos.controller.js"

const router = Router()

router.get("/", remitosController.getAll)
router.get("/:id", remitosController.getById)
router.post("/", remitosController.create)
router.post("/:id/anular", remitosController.anular)

export default router
