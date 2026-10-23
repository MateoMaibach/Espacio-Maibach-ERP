/**
 * Suite de diagnostico de la API de Espacio Maibach.
 *
 * No es una suite de cobertura: cada test afirma el COMPORTAMIENTO CORRECTO
 * del sistema. Un fallo no es "el test se rompio", es un hallazgo. Por eso cada
 * test lleva metadata (severidad, referencia, hipotesis) para que el reporte
 * diga que serompio y por que importa.
 *
 * Uso:
 *   node scripts/test-api.mjs --base http://localhost:3002
 *   node scripts/test-api.mjs --filter E      # solo tests cuyo id empieza con E
 */

const argv = process.argv.slice(2)

function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}

const BASE = argValue("--base") || "http://localhost:3002"
const FILTER = argValue("--filter")

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

const tests = []
let BLOCK = ""

function block(name) {
  BLOCK = name
}

/**
 * @param meta sev   CRITICA | ALTA | MEDIA | BAJA
 * @param meta ref   archivo:línea donde vive la causa sospechada
 * @param meta nota  que se espera observar si el fallo se confirma
 */
function test(id, name, fn, meta = {}) {
  tests.push({ block: BLOCK, id, name, fn, meta })
}

function makeCtx() {
  const failures = []
  const fmt = v => (typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v))

  return {
    failures,
    ok(cond, msg) {
      if (!cond) failures.push(msg)
    },
    eq(actual, expected, msg) {
      if (actual !== expected) {
        failures.push(`${msg} | esperaba ${fmt(expected)}, obtuvo ${fmt(actual)}`)
      }
    },
    ne(actual, forbidden, msg) {
      if (actual === forbidden) {
        failures.push(`${msg} | no debia ser ${fmt(forbidden)}`)
      }
    },
    near(actual, expected, msg, tol = 1) {
      if (typeof actual !== "number" || Math.abs(actual - expected) > tol) {
        failures.push(`${msg} | esperaba ~${expected} (+-${tol}), obtuvo ${fmt(actual)}`)
      }
    },
    desc(desc) {
      failures.push(`[${desc}]`)
    },
  }
}

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

async function api(method, path, body) {
  const init = { method, headers: {} }

  if (body !== undefined) {
    init.headers["content-type"] = "application/json"
    init.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE}${path}`, init)
  } catch (e) {
    return { status: 0, body: null, text: `FALLO DE RED: ${e.message}` }
  }

  const text = await res.text()
  let parsed = null

  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = null
  }

  return { status: res.status, body: parsed, text }
}

const GET = p => api("GET", p)
const POST = (p, b) => api("POST", p, b)
const PUT = (p, b) => api("PUT", p, b)
const DEL = p => api("DELETE", p)

async function firstId(path, key = "id") {
  const r = await GET(path)
  return Array.isArray(r.body) && r.body.length ? r.body[0][key] : null
}

/**
 * Borrado de fixture. Nunca tira: si un DELETE devuelve 400 porque el
 * recurso tiene dependencias, eso es informacion del test que lo creo, no un
 * fallo de la corrida. Tapar hallazgos reales con errores de limpieza seria
 * peor que dejar datos de mas.
 */
async function drop(path) {
  const r = await DEL(path)
  return r.status
}

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */

let seq = 0
const uid = () => `t${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** ISO de hoy y de meses pasados/futuros, para snapshots de periodo. */
function iso(d) {
  return d.toISOString().slice(0, 10)
}
function mesActual() {
  const d = new Date()
  return { mes: d.getMonth() + 1, anio: d.getFullYear() }
}
function isoMes(mes, anio, dia = 10) {
  return iso(new Date(Date.UTC(anio, mes - 1, dia)))
}
/** DD/MM/YYYY, el formato que espera clientes.fechaAlta y ficheros.fecha. */
function dmy(mes, anio, dia = 10) {
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`
}

async function must(res, what) {
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${what} fallo con ${res.status}: ${res.text}`)
  }

  return res.body
}

async function mkCliente(extra = {}) {
  const id = `cli_${uid()}`
  const body = { id, nombre: `Cliente ${id}`, fechaAlta: "01/01/2026", ...extra }
  await must(await POST("/api/clientes", body), "mkCliente")
  return id
}

async function mkProveedor(extra = {}) {
  const body = { razonSocial: `Proveedor ${uid()}`, ...extra }
  const r = await must(await POST("/api/proveedores", body), "mkProveedor")
  return r.id
}

async function mkDeposito(extra = {}) {
  const body = { nombre: `Deposito ${uid()}`, ...extra }
  const r = await must(await POST("/api/depositos", body), "mkDeposito")
  return r.id
}

async function mkArticulo(extra = {}) {
  const body = { nombre: `Articulo ${uid()}`, ...extra }
  const r = await must(await POST("/api/articulos", body), "mkArticulo")
  return r.id
}

async function mkCaja(extra = {}) {
  const body = { nombre: `Caja ${uid()}`, color: "#123456", ...extra }
  const r = await must(await POST("/api/cajas", body), "mkCaja")
  return { ...r, nombre: body.nombre }
}

async function mkCategoria(tipo = "egreso", extra = {}) {
  const body = { nombre: `Cat ${uid()}`, tipo, ...extra }
  const r = await must(await POST("/api/categorias", body), "mkCategoria")
  return r
}

async function mkBanco(extra = {}) {
  const body = { nombre: `Banco ${uid()}`, ...extra }
  const r = await must(await POST("/api/bancos", body), "mkBanco")
  return r.id
}

async function mkFichero(clienteId, extra = {}) {
  const body = { fecha: "10/01/2026", total: "$120.000", ...extra }
  const r = await must(await POST(`/api/clientes/${clienteId}/fichero`, body), "mkFichero")
  return r.id
}

/** Compra simple. OJO: las lineas de compra NO llevan articuloId. */
async function mkCompra(proveedorId, items = [{ detalle: "Item", cantidad: 10, precioUnitario: 100 }], extra = {}) {
  const body = { fecha: "2026-01-10", items, ...extra }
  const r = await must(await POST(`/api/proveedores/${proveedorId}/compras`, body), "mkCompra")
  return r
}

async function mkMovimiento(extra = {}) {
  const body = {
    concepto: `Mov ${uid()}`,
    monto: 10000,
    tipo: "ingreso",
    subCaja: "Efectivo",
    fecha: isoMes(mesActual().mes, mesActual().anio, 5),
    ...extra,
  }
  const r = await must(await POST("/api/caja/movimientos", body), "mkMovimiento")
  return r.id
}

async function mkChequeEmitido(extra = {}) {
  const body = {
    tipo: "emitido",
    banco: "Galicia",
    numero: String(Math.floor(Math.random() * 1e9)),
    fechaEmision: "2026-01-05",
    fechaCobro: "2026-02-05",
    destinatario: "Proveedor Test",
    importe: 50000,
    ...extra,
  }
  const r = await must(await POST("/api/cheques", body), "mkChequeEmitido")
  return r.id
}

async function mkChequeRecibido(extra = {}) {
  const body = {
    tipo: "recibido",
    recibidoDe: "Cliente Test",
    banco: "Galicia",
    numero: String(Math.floor(Math.random() * 1e9)),
    fechaCobro: "2026-02-05",
    fechaRecepcion: "2026-01-20",
    importe: 50000,
    ...extra,
  }
  const r = await must(await POST("/api/cheques", body), "mkChequeRecibido")
  return r.id
}

/** Cliente con fichero y plan de cuotas listo para cobrar. */
async function mkClienteConCuotas({ total = "$120.000", cantCuotas = 3 } = {}) {
  const clienteId = await mkCliente()
  await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total })
  await must(
    await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas }),
    "generarPlan",
  )

  const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")

  return { clienteId, cuotas: c.cuotas ?? [], fichero: c.fichero }
}

/** Estado de un articulo en un deposito, via GET /api/stock. */
async function stockDe(depositoId, articuloId) {
  const r = await must(await GET("/api/stock"), "GET stock")
  const filas = r.rows ?? []
  const fila = filas.find(f => f.depositoId === depositoId && f.articuloId === articuloId)
  return fila ?? { cantidad: 0, costoPromedio: 0, valor: 0 }
}

/**
 * Deja un período cerrado en un estado conocido, sin depender del orden de
 * los tests.
 *
 * Hace falta porque el server ahora rechaza abrir un período que tenga meses
 * posteriores cerrados: si un test previo dejo alguno abierto, el `cerrar`
 * del siguiente falla con 409 y el fallo se propaga a toda la suite.
 */
async function abrirPeriodo(mes, anio) {
  // Primero los posteriores, del mas nuevo al mas viejo.
  const clave = (y, m) => y * 100 + m

  for (let y = anio + 2; y >= anio; y--) {
    for (let m = 12; m >= 1; m--) {
      if (y === anio && m < mes) continue

      await POST(`/api/periodos/${m}/${y}/abrir`)
    }
  }

  return POST(`/api/periodos/${mes}/${anio}/abrir`)
}

/** Cierra un período y garantiza que al terminar quede abierto. */
async function cerrarPeriodoTemporal(mes, anio, observaciones) {
  await abrirPeriodo(mes, anio)

  const r = await POST(`/api/periodos/${mes}/${anio}/cerrar`, { observaciones })

  return r
}

/** @param fn recibe un callback para correr con el período ya cerrado */
async function conPeriodoCerrado(mes, anio, fn) {
  await abrirPeriodo(mes, anio)

  const cerrar = await POST(`/api/periodos/${mes}/${anio}/cerrar`, {})

  try {
    return await fn(cerrar)
  } finally {
    await POST(`/api/periodos/${mes}/${anio}/abrir`)
  }
}

/** Kardex. GET /api/stock/movimientos devuelve un arreglo plano. */
async function kardex(articuloId) {
  const q = articuloId ? `?articuloId=${articuloId}` : ""
  const r = await must(await GET(`/api/stock/movimientos${q}`), "GET kardex")
  return r.rows ?? r
}

/** Snapshot guardado de un periodo (GET /api/periodos/:mes/:anio). */
async function snapshot(mes, anio) {
  const r = await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")
  return r.snapshot
}

export {
  api,
  GET,
  POST,
  PUT,
  DEL,
  firstId,
  drop,
  must,
  mkCliente,
  mkProveedor,
  mkDeposito,
  mkArticulo,
  mkCaja,
  mkCategoria,
  mkBanco,
  mkFichero,
  mkCompra,
  mkMovimiento,
  mkChequeEmitido,
  mkChequeRecibido,
  mkClienteConCuotas,
  stockDe,
  kardex,
  snapshot,
  abrirPeriodo,
  cerrarPeriodoTemporal,
  conPeriodoCerrado,
  uid,
  iso,
  isoMes,
  dmy,
  mesActual,
  test,
  block,
  makeCtx,
  tests,
  BASE,
}