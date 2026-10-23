import express, { NextFunction, Request, Response } from "express"

import cors from "cors"

import { config } from "dotenv"

import { resolve } from "path"

import clientesRouter from "./routes/clientes.js"

import ficherosRouter from "./routes/ficheros.js"

import cuotasRouter from "./routes/cuotas.js"

import cajaRouter from "./routes/caja.js"

import cajasRouter from "./routes/cajas.js"

import chequesRouter from "./routes/cheques.js"

import bancosRouter from "./routes/bancos.js"

import equiposRouter from "./routes/equipos.js"

import instalacionesRouter from "./routes/instalaciones.js"

import veredasRouter from "./routes/veredas.js"

import proveedoresRouter from "./routes/proveedores.js"

import comprasRouter from "./routes/compras.js"

import ordenesPagoRouter from "./routes/ordenesPago.js"

import depositosRouter from "./routes/depositos.js"

import articulosRouter from "./routes/articulos.js"

import stockRouter from "./routes/stock.js"

import remitosRouter from "./routes/remitos.js"

import dashboardRouter from "./routes/dashboard.js"

import categoriasRouter from "./routes/categorias.js"

import periodosRouter from "./routes/periodos.js"

config({ path: resolve(import.meta.dirname, "../.env") })

const app = express()

const PORT = process.env.PORT || 3001

app.use(cors())

app.use(express.json())

app.use("/api/clientes", clientesRouter)

app.use("/api", ficherosRouter)

app.use("/api", cuotasRouter)

app.use("/api/caja", cajaRouter)

app.use("/api/cajas", cajasRouter)

app.use("/api/cheques", chequesRouter)

app.use("/api/bancos", bancosRouter)

app.use("/api/equipos", equiposRouter)

app.use("/api/instalaciones", instalacionesRouter)

app.use("/api/veredas", veredasRouter)

app.use("/api/proveedores", proveedoresRouter)

app.use("/api/compras", comprasRouter)

app.use("/api/ordenes-pago", ordenesPagoRouter)

app.use("/api/depositos", depositosRouter)

app.use("/api/articulos", articulosRouter)

app.use("/api/stock", stockRouter)

app.use("/api/remitos", remitosRouter)

app.use("/api/dashboard", dashboardRouter)

app.use("/api/categorias", categoriasRouter)

app.use("/api/periodos", periodosRouter)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Editar un mes cerrado es un conflicto de dominio, no una falla interna.
  const esMesCerrado = err.name === "MesCerradoError"

  /**
   * Violación de un UNIQUE.
   *
   * Los controllers validan duplicados en código, pero esa validación es
   * "leer y comparar": dos pedidos simultáneos pueden pasar los dos y el
   * segundo revienta contra el índice. Sin esto, eso se traducía en un 500
   * opaco de SQLite. Es un conflicto de estado, no una falla: 409.
   */
  const esUnico = (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE"

  if (!esMesCerrado && !esUnico) console.error(err)

  // Los errores de express.json() (body malformado) traen su propio status.

  const status = esMesCerrado
    ? 409
    : esUnico
      ? 409
      : ((err as { status?: number }).status ?? 500)

  const mensaje = esUnico
    ? "Ese valor ya existe (violación de unicidad)"
    : err.message || "Error interno del servidor"

  res.status(status).json({ error: mensaje })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
