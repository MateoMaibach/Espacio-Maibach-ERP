import { sqlite } from "./index.js"

function tablaExiste(nombre: string): boolean {
  const fila = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(nombre)

  return Boolean(fila)
}

/**
 * El esquema se crea al importar ./index.js, que corre en cada arranque del
 * server. Este script queda solo como verificacion y como punto de entrada
 * manual: los controllers ya importaron el bootstrap al cargar este modulo.
 */
async function migrate() {
  console.log("Verificando esquema...")

  const esperadas = [
    "clientes",
    "ficheros",
    "cuotas",
    "cajas",
    "movimientos",
    "cierres",
    "cheques",
    "bancos",
    "equipos",
    "instalaciones",
    "veredas",
    "proveedores",
    "compras",
    "ordenes_pago",
    "depositos",
    "articulos",
    "stock",
    "movimientos_stock",
    "remitos",
    "remito_items",
    "historial_costos",
  ]

  const faltantes = esperadas.filter((t) => !tablaExiste(t))

  if (faltantes.length > 0) {
    throw new Error(`Tablas faltantes: ${faltantes.join(", ")}`)
  }

  console.log(`Esquema correcto (${esperadas.length} tablas).`)
}

migrate().catch((e) => {
  console.error(e)

  process.exit(1)
})