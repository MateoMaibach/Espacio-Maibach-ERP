/**
 * Carga datos de prueba para poder ver el dashboard con informacion.
 *
 * Usa los endpoints HTTP reales en vez de insertar SQL a mano, asi el seed
 * no puede dejar datos que la aplicacion despues rechace.
 *
 *   node scripts/seed.mjs            # contra http://localhost:3001
 *   API=http://localhost:3001 node scripts/seed.mjs
 *
 * Requiere el server corriendo (npm run dev en otra terminal).
 */

const BASE = process.env.API || "http://localhost:3001"

const MESES = [
  "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic",
]

function isoDe(mes, anio, dia) {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

function ddmmDe(mes, anio, dia) {
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`
}

function ddMonDe(mes, anio, dia) {
  return `${String(dia).padStart(2, "0")} ${MESES[mes - 1]}, ${anio}`
}

let creadas = 0

// Nombres de proveedor de insumos, usados antes de crearlos en la base para
// que el campo `proveedor` del fichero referencie algo coherente.
const PROVEEDORES_SEED = [
  "Química del Plata SRL",
  "Hierros San Juan SA",
  "Pisos y Revestimientos SA",
  "Bombas y Motores SRL",
]

async function api(path, method = "GET", body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const texto = await res.text()

    throw new Error(`${method} ${path} -> ${res.status} ${texto}`)
  }

  const texto = await res.text()

  return texto ? JSON.parse(texto) : {}
}

async function crear(path, method, body, etiqueta) {
  const r = await api(path, method, body)

  creadas += 1

  return r
}

// ---------------------------------------------------------------

const HOY = new Date()
const ANIO = HOY.getFullYear()
const MES = HOY.getMonth() + 1

/** Mes relativo al actual: 0 = este mes, -1 = el anterior. */
function mesRel(offset, dia = 15) {
  const d = new Date(Date.UTC(HOY.getFullYear(), HOY.getMonth() + offset, dia))

  return {
    mes: d.getUTCMonth() + 1,
    anio: d.getUTCFullYear(),
    iso: isoDe(d.getUTCMonth() + 1, d.getUTCFullYear(), dia),
    ddmm: ddmmDe(d.getUTCMonth() + 1, d.getUTCFullYear(), dia),
    ddMon: ddMonDe(d.getUTCMonth() + 1, d.getUTCFullYear(), dia),
  }
}

async function main() {
  console.log(`Seed contra ${BASE}`)

  // El seed crea clientes con id fijo, asi que correrlo dos veces fallaria
  // con 409. Si ya hay datos, avisamos y cortamos.

  const existentes = await api("/api/clientes")

  if (existentes.some((c) => String(c.id).startsWith("cli_seed_"))) {
    console.error(
      "\nYa existen datos de seed (clientes cli_seed_*).",
      "\nPara recargar: frená el server, borrá la carpeta server/data y volvé a levantarlo.",
      "\nO usá otra base: DATABASE_URL=./data/otra.db npm run dev",
    )
    process.exit(1)
  }

  // --- Bancos ---
  const bancos = [
    "Banco Nación",
    "Banco Provincia",
    "Nuevo Banco de Entre Ríos",
    "Banco Santander",
  ]

  const bancosOk = []

  for (const nombre of bancos) {
    try {
      bancosOk.push(await crear("/api/bancos", "POST", { nombre }, nombre))
    } catch {
      bancosOk.push({ nombre })
    }
  }

  // --- Depositos ---
  const depositos = []

  for (const nombre of ["Central", "Sucursal Norte", "Taller"]) {
    depositos.push(
      await crear("/api/depositos", "POST", { nombre }, `deposito ${nombre}`),
    )
  }

  // --- Articulos + stock inicial ---
  const catalogo = [
    ["Cloro granulado x 20kg", "kg", 1850],
    ["PinturaUniverse látex 4L", "un", 12400],
    ["Cemento CP 50kg", "kg", 9800],
    ["Hierro 12mm x 6m", "un", 5600],
    ["Arena lavada m3", "m3", 14200],
    ["Piedraazza canto rodado m2", "m2", 16800],
    ["FiltreUniverse filtrante 1\"", "un", 2350],
    ["Bomba centrífuga 1/2HP", "un", 89000],
    ["KitUniverse Universe 6x3", "un", 285000],
    ["BordeUniverse granítico", "m", 3200],
    ["ClavosUniverse 1\" x 5kg", "kg", 6400],
    ["Ladrillo hueco 12x18x18", "un", 780],
    ["Mortero de Peggy 25kg", "kg", 3900],
    ["Varilla roscada 16mm x 3m", "un", 7200],
    ["Placa Universe poliester 12x12", "m2", 41500],
  ]

  const articulos = []

  for (const [i, [nombre, unidad, costo]] of catalogo.entries()) {
    const a = await crear(
      "/api/articulos",
      "POST",
      { codigo: `ART-${1000 + i}`, nombre, unidad, costoUnitario: costo },
      `articulo ${nombre}`,
    )

    articulos.push({ id: a.id, nombre, costo })
  }

  for (const [i, a] of articulos.entries()) {
    const dep = depositos[i % depositos.length]

    await crear(
      "/api/stock/ingresos-iniciales",
      "POST",
      {
        depositoId: dep.id,
        fecha: mesRel(-5).iso,
        lineas: [{ articuloId: a.id, cantidad: 20 + ((i * 13) % 60), costoUnitario: a.costo }],
      },
      `ingreso inicial ${a.nombre}`,
    )
  }

  // --- Clientes con fichero y cuotas ---
  const clientes = [
    ["García, Roberto", "11-22334455", "pileta", 2450000, 3],
    ["Albornoz, Lucía", "11-22334466", "pileta", 1820000, 3],
    ["Rodríguez, Juan", "11-22334477", "deck", 980000, 2],
    ["Ferrer, Marta", "11-22334488", "pileta", 3150000, 4],
    ["Pérez, Diego", "11-22334499", "jardinera", 640000, 2],
    ["Sosa, Camila", "11-22334500", "pileta", 1580000, 3],
    ["Núñez, Axel", "11-22334511", "deck", 1120000, 3],
    ["Villalba, Paula", "11-22334522", "pileta", 2740000, 3],
  ]

  const fichas = []

  for (const [i, [nombre, tel, tipo, total, cantCuotas]] of clientes.entries()) {
    const id = `cli_seed_${i + 1}`

    await crear(
      "/api/clientes",
      "POST",
      {
        id,
        nombre,
        telefono: tel,
        estado: "Activo",
        vendedor: "Martín Maibach",
        fechaAlta: ddmmDe(mesRel(-6 - i).mes, mesRel(-6 - i).anio, 5),
      },
      `cliente ${nombre}`,
    )

    // 5 clientes con ficheros en los meses anteriores y 3 en el mes actual,
// para que el KPI "ventas del mes" tenga un valor real y una variacion
// comparable contra el mes pasado.
const mesFichero = mesRel(i < 5 ? -(5 - i) : 0)

    await crear(
      `/api/clientes/${id}/fichero`,
      "POST",
      {
        fecha: mesFichero.ddmm,
        vendedor: "Martín Maibach",
        tipoCobro: "cuotas",
        cantCuotas,
        total: `$${total.toLocaleString("es-AR")}`,
        items: [
          {
            desc: `Trabajo ${tipo} - cliente ${nombre}`,
            cant: "1",
            precio: `$${total.toLocaleString("es-AR")}`,
            precioUnitario: `$${total.toLocaleString("es-AR")}`,
          },
        ],

        // Insumos de obra. Varian por cliente para que el analisis de
        // costos en /finanzas tenga una dispersion realista y no todos los
        // margenes iguales.
        comisionPct: 8 + (i % 4),
        costoPiscina: Math.round(total * (0.34 + (i % 3) * 0.03)),
        costoInstalacion: Math.round(total * (0.12 + (i % 2) * 0.02)),
        costoEquipoFiltrado: Math.round(total * 0.08),
        costoManoObra: i % 4 === 3 ? 0 : Math.round(total * 0.06),
        manoObraVeredaAplica: i % 4 !== 3,
        proveedor: PROVEEDORES_SEED[i % PROVEEDORES_SEED.length],
      },
      `fichero ${nombre}`,
    )

    // Primer vencimiento en el mes del fichero, dia 10.
    const base = mesFichero

    await crear(
      `/api/clientes/${id}/fichero/cuotas/generar`,
      "POST",
      { cantCuotas, fechaPrimerVto: ddmmDe(base.mes, base.anio, 10) },
      `plan cuotas ${nombre}`,
    )

    const detalle = await api(`/api/clientes/${id}`)

    const cuotas = (detalle.cuotas || []).filter((c) => c.nroCuota > 0)

    // Al primer cliente no le cobramos nada: queda moroso por diseño.
    if (i > 0 && cuotas[0]) {
      await crear(
        `/api/clientes/${id}/fichero/cuotas/${cuotas[0].id}/cobrar`,
        "POST",
        { monto: Math.round(cuotas[0].montoPlanificado / 2), metodo: "Transferencia" },
        `cobro parcial ${nombre}`,
      )
    }

    if (i > 2 && cuotas[1]) {
      await crear(
        `/api/clientes/${id}/fichero/cuotas/${cuotas[1].id}/cobrar`,
        "POST",
        { monto: cuotas[1].montoPlanificado, metodo: "Efectivo" },
        `cobro total ${nombre}`,
      )
    }

    fichas.push({ clienteId: id, nombre })
  }

  // --- Equipos ---
  const equipos = []

  for (const [nombre, encargado] of [
    ["Equipo Alpha", "Carlos Ríos"],
    ["Equipo Beta", "Marta Sosa"],
    ["Equipo Gamma", "Julián Pérez"],
  ]) {
    equipos.push(
      await crear("/api/equipos", "POST", { nombre, encargado }, `equipo ${nombre}`),
    )
  }

  // --- Instalaciones (desde ventas disponibles) ---
  for (const [i, f] of fichas.entries()) {
    const ventas = await api("/api/instalaciones/ventas")

    const venta = ventas.find((v) => v.clienteId === f.clienteId)

    if (!venta) continue

    const fecha = mesRel(i - 2, 10 + i)

    await crear(
      "/api/instalaciones",
      "POST",
      {
        ficheroId: venta.ficheroId,
        fecha: fecha.iso,
        equipoId: equipos[i % equipos.length].id,
        estado: i % 3 === 0 ? "Confirmada" : i % 3 === 1 ? "En Proceso" : "Pendiente",
      },
      `instalacion ${f.nombre}`,
    )
  }

  // --- Veredas ---
  // Los estados de vereda son Pendiente / En Proceso / Completada. "Confirmada"
  // es solo de instalaciones.
  for (const [i, f] of fichas.entries()) {
    if (i % 2 !== 0) continue

    const fecha = mesRel(i - 1, 5 + i)

    await crear(
      "/api/veredas",
      "POST",
      {
        clienteId: f.clienteId,
        fecha: fecha.iso,
        equipoId: equipos[i % equipos.length].id,
        estado: i % 4 === 0 ? "En Proceso" : "Pendiente",
      },
      `vereda ${f.nombre}`,
    )
  }

  // --- Proveedores + compras ---
  const proveedores = [
    ["Química del Plata SRL", "30-71234567", "Químicos", ["Cloro granulado x 20kg", "KitUniverse Universe 6x3"]],
    ["Hierros San Juan SA", "30-71234568", "Construcción", ["Hierro 12mm x 6m", "Varilla roscada 16mm x 3m", "Cemento CP 50kg"]],
    ["Pisos y Revestimientos SA", "30-71234569", "Revestimientos", ["Piedraazza canto rodado m2", "Ladrillo hueco 12x18x18", "Mortero de Peggy 25kg"]],
    ["Bombas y Motores SRL", "30-71234570", "Equipamiento", ["Bomba centrífuga 1/2HP", "FiltreUniverse filtrante 1\""]],
    ["Transportes del Litoral", "30-71234571", "Logística", ["Placa Universe poliester 12x12"]],
  ]

  for (const [i, [razonSocial, cuit, rubro, articuloNombres]] of proveedores.entries()) {
    const prov = await crear(
      "/api/proveedores",
      "POST",
      { razonSocial, cuit, rubro, estado: "Activo", localidad: "Paraná" },
      `proveedor ${razonSocial}`,
    )

    const fecha = mesRel(-(2 + i), 20)

    const items = articuloNombres.map((nombre) => {
      const art = articulos.find((a) => a.nombre === nombre)

      return {
        detalle: nombre,
        cantidad: 5 + i * 3,
        precioUnitario: art ? art.costo : 10000,
      }
    })

    await crear(
      `/api/proveedores/${prov.id}/compras`,
      "POST",
      {
        fecha: fecha.iso,
        descripcion: `Compra a ${razonSocial}`,
        moneda: "ARS",
        estado: "Pendiente",
        items,
      },
      `compra ${razonSocial}`,
    )
  }

  // --- Cheques ---
  const cheques = [
    ["recibido", "Banco Nación", "En Cartera", 3, 480000],
    ["recibido", "Banco Provincia", "En Cartera", 5, 275000],
    ["recibido", "Nuevo Banco de Entre Ríos", "En Cartera", 6, 920000],
    ["recibido", "Banco Santander", "Depositado", -12, 150000],
    ["emitido", "Banco Nación", "Pendiente", 2, 380000],
    ["emitido", "Banco Provincia", "Pendiente", 4, 1150000],
    ["emitido", "Banco Santander", "Pagado", -20, 640000],
    ["emitido", "Nuevo Banco de Entre Ríos", "Pendiente", 12, 520000],
  ]

  for (const [i, [tipo, banco, estado, dias, importe]] of cheques.entries()) {
    const numero = `CHQ-${100000 + i * 37}`

    const d = new Date(HOY.getTime() + dias * 86400000)

    const base = {
      tipo,
      banco,
      numero,
      fechaCobro: isoDe(d.getMonth() + 1, d.getFullYear(), d.getDate()),
      importe,
      estado,
    }

    if (tipo === "recibido") {
      await crear(
        "/api/cheques",
        "POST",
        {
          ...base,
          recibidoDe: clientes[i % clientes.length][0],
          fechaRecepcion: mesRel(-(i % 4), 3).iso,
        },
        `cheque ${numero}`,
      )
    } else {
      await crear(
        "/api/cheques",
        "POST",
        {
          ...base,
          fechaEmision: base.fechaCobro,
          destinatario: proveedores[i % proveedores.length][0],
        },
        `cheque ${numero}`,
      )
    }
  }

  // --- Movimientos de caja: 6 meses ---
  let seed = 0

  for (let m = -5; m <= 0; m++) {
    const base = mesRel(m, 12)

    const cobros = 900000 + (m + 5) * 160000
    const gastos = 520000 + (m + 5) * 90000

    await crear("/api/caja/movimientos", "POST", {
      fecha: base.iso,
      concepto: `Cobros del mes ${MESES[base.mes - 1]}`,
      monto: cobros,
      tipo: "ingreso",
      subCaja: "Efectivo",
      categoria: "Cobro cliente",
    }, "cobros")

    await crear("/api/caja/movimientos", "POST", {
      fecha: base.iso,
      concepto: `Transferencias bancarias ${MESES[base.mes - 1]}`,
      monto: Math.round(cobros * 0.55),
      tipo: "ingreso",
      subCaja: "Bancos",
      categoria: "Cobro cliente",
    }, "bancos")

    await crear("/api/caja/movimientos", "POST", {
      fecha: base.iso,
      concepto: `Gastos de operacion ${MESES[base.mes - 1]}`,
      monto: gastos,
      tipo: "egreso",
      subCaja: "Efectivo",
      categoria: "Logística",
    }, "gastos")

    await crear("/api/caja/movimientos", "POST", {
      fecha: base.iso,
      concepto: `Pagos a proveedores ${MESES[base.mes - 1]}`,
      monto: Math.round(gastos * 0.7),
      tipo: "egreso",
      subCaja: "Bancos",
      categoria: "Pago proveedor",
    }, "proveedores")

    if (m === 0) {
      await crear("/api/caja/movimientos", "POST", {
        fecha: base.iso,
        concepto: "Carga de combustible",
        monto: 85000,
        tipo: "egreso",
        subCaja: "Efectivo",
        categoria: "Combustible",
      }, "combustible")

      await crear("/api/caja/movimientos", "POST", {
        fecha: base.iso,
        concepto: "Venta de combustible",
        monto: 180000,
        tipo: "egreso",
        subCaja: "Dólares",
        moneda: "USD",
        tipoCambio: 1250,
      }, "dolares")

      await crear("/api/caja/movimientos", "POST", {
        fecha: base.iso,
        concepto: "Cheques recibidos en cartera",
        monto: 340000,
        tipo: "ingreso",
        subCaja: "Cheques",
      }, "cheques")
    }

    seed += 1
  }

  console.log(`\nListo: ${creadas} registros creados en ${seed + 1} meses de caja.`)

  console.log("Abrí http://localhost:5173 y el Dashboard debería mostrar los datos.")
}

main().catch((e) => {
  console.error("\nSeed fallo:", e.message)
  process.exit(1)
})