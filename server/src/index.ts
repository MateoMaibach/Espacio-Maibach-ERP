import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { resolve } from "path";
import clientesRouter from "./routes/clientes.js";
import ficherosRouter from "./routes/ficheros.js";
import cuotasRouter from "./routes/cuotas.js";
import cajaRouter from "./routes/caja.js";
import cajasRouter from "./routes/cajas.js";
import chequesRouter from "./routes/cheques.js";
import bancosRouter from "./routes/bancos.js";
import equiposRouter from "./routes/equipos.js";
import instalacionesRouter from "./routes/instalaciones.js";
import veredasRouter from "./routes/veredas.js";

config({ path: resolve(import.meta.dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/clientes", clientesRouter);
app.use("/api", ficherosRouter);
app.use("/api", cuotasRouter);
app.use("/api/caja", cajaRouter);
app.use("/api/cajas", cajasRouter);
app.use("/api/cheques", chequesRouter);
app.use("/api/bancos", bancosRouter);
app.use("/api/equipos", equiposRouter);
app.use("/api/instalaciones", instalacionesRouter);
app.use("/api/veredas", veredasRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
