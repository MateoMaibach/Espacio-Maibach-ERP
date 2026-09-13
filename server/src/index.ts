import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { resolve } from "path";
import clientesRouter from "./routes/clientes.js";
import ficherosRouter from "./routes/ficheros.js";
import cuotasRouter from "./routes/cuotas.js";
import cajaRouter from "./routes/caja.js";
import cajasRouter from "./routes/cajas.js";

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
