import express from "express"

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
