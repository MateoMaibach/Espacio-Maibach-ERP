import { Router } from "express"
import * as depositosController from "../controllers/depositos.controller.js"

const router = Router()

router.get("/", depositosController.getAll)
router.get("/:id", depositosController.getById)
router.post("/", depositosController.create)
router.put("/:id", depositosController.update)
router.delete("/:id", depositosController.remove)

export default router
