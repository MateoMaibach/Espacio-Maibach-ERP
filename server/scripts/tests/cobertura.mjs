/**
 * Bloque 1 - Cobertura.
 *
 * Ejercita los 101 endpoints de los 21 routers para encontrar lo basico:
 * rutas rotas, 500s, endpoints que tiran la base vacia, y handlers que no
 * limpian lo que crean. No afirma reglas de negocio: solo que el endpoint
 * existe, responde y devuelve la forma esperada.
 */

import {
  GET,
  POST,
  PUT,
  DEL,
  drop,
  test,
  block,
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
  stockDe,
  uid,
  isoMes,
  mesActual,
} from "../test-api-lib.mjs"

block("COBERTURA")

/* --- estado vacio: la app recien arrancada --- */

test("V1", "GET /api/health responde ok", async ctx => {
  const r = await GET("/api/health")
  ctx.eq(r.status, 200, "status")
  ctx.eq(r.body?.status, "ok", "status ok")
})

test("V2", "listados vacios no rompen con la base recien creada", async ctx => {
  const endpoints = [
    "/api/clientes",
    "/api/proveedores",
    "/api/depositos",
    "/api/articulos",
    "/api/remitos",
    "/api/cheques",
    "/api/bancos",
    "/api/equipos",
    "/api/instalaciones",
    "/api/veredas",
    "/api/stock/movimientos",
    "/api/periodos",
  ]

  for (const p of endpoints) {
    const r = await GET(p)
    ctx.eq(r.status, 200, `${p} responde 200`)
    ctx.ok(Array.isArray(r.body), `${p} devuelve un arreglo (obtuvo ${typeof r.body})`)
    ctx.eq(r.body?.length, 0, `${p} arranca vacio`)
  }

  const stock = await GET("/api/stock")
  ctx.eq(stock.status, 200, "/api/stock responde 200")
  ctx.ok(Array.isArray(stock.body?.rows), "/api/stock devuelve { rows: [...] }")
  ctx.eq(stock.body?.rows?.length, 0, "/api/stock arranca vacio")
  ctx.eq(stock.body?.valorTotal, 0, "/api/stock arranca con valorTotal 0")
})

test("V3", "los defaults del bootstrap se crean solos", async ctx => {
  const cajas = await must(await GET("/api/cajas"), "GET cajas")
  ctx.eq(cajas.length, 4, "se siembran 4 cajas")

  const cats = await must(await GET("/api/categorias"), "GET categorias")
  ctx.eq(cats.length, 20, "se siembran 20 categorias")

  const nombres = cajas.map(c => c.nombre)
  for (const n of ["Efectivo", "Bancos", "Cheques", "Dólares"]) {
    ctx.ok(nombres.includes(n), `existe la caja "${n}"`)
  }

  const dolares = cajas.find(c => c.nombre === "Dólares")
  ctx.eq(dolares?.afectaGeneral, 0, "Dólares es la única caja que no afecta el general")
})

test("V4", "los reportes de stock vacios no rompen", async ctx => {
  for (const p of ["/api/stock/reportes/negativos", "/api/stock/reportes/valorizacion", "/api/stock/reportes/costos"]) {
    const r = await GET(p)
    ctx.eq(r.status, 200, `${p} responde 200`)
  }

  const dash = await GET("/api/dashboard")
  ctx.eq(dash.status, 200, "dashboard responde 200 con la base vacia")
})

/* --- lectura de catalogos --- */

test("V5", "GETs de catalogos y resumenes", async ctx => {
  const { mes, anio } = mesActual()

  const endpoints = [
    "/api/caja/monedas",
    `/api/caja/movimientos?mes=${mes}&anio=${anio}`,
    "/api/caja/cierres",
    `/api/caja/resumen?mes=${mes}&anio=${anio}`,
    "/api/instalaciones/ventas",
    "/api/dashboard",
  ]

  for (const p of endpoints) {
    const r = await GET(p)
    ctx.eq(r.status, 200, `${p} responde 200 (${r.status} ${r.text.slice(0, 120)})`)
  }
})

test("V6", "GET de detalle responde 404 con id inexistente", async ctx => {
  const noexiste = `no_existe_${uid()}`
  const endpoints = [
    `/api/clientes/${noexiste}`,
    `/api/proveedores/${noexiste}`,
    `/api/depositos/${noexiste}`,
    `/api/articulos/${noexiste}`,
    `/api/cheques/${noexiste}`,
    "/api/compras/" + noexiste,
    "/api/ordenes-pago/" + noexiste,
    "/api/remitos/" + noexiste,
    `/api/equipos/${noexiste}`,
    `/api/instalaciones/${noexiste}`,
    `/api/clientes/${noexiste}/fichero/cuotas/${noexiste}/cobrar`,
  ]

  for (const p of endpoints) {
    const r = await GET(p)
    ctx.eq(r.status, 404, `${p} responde 404 (${r.status})`)
  }
})

/* --- CRUD simple: bancos --- */

test("V7", "CRUD completo de bancos", async ctx => {
  const creado = await must(await POST("/api/bancos", { nombre: `Banco ${uid()}` }), "POST bancos")

  ctx.ok(creado?.id, `POST /bancos devuelve id (obtuvo ${JSON.stringify(creado)})`)

  const id = creado.id

  const lista = await must(await GET("/api/bancos"), "GET bancos")
  ctx.ok(lista.some(b => b.id === id), "el banco aparece en el listado")

  ctx.eq((await PUT(`/api/bancos/${id}`, { nombre: "Renombrado" })).status, 200, "PUT bancos")

  const uno = await must(await GET("/api/bancos"), "GET bancos")
  ctx.eq(uno.find(b => b.id === id)?.nombre, "Renombrado", "el PUT se persistio")

  ctx.eq((await DEL(`/api/bancos/${id}`)).status, 200, "DELETE bancos")

  const dos = await must(await GET("/api/bancos"), "GET bancos")
  ctx.ok(!dos.some(b => b.id === id), "el banco ya no esta")
})

/* --- CRUD simple: cajas y categorias --- */

test("V8", "CRUD completo de cajas", async ctx => {
  const { id } = await mkCaja({ orden: 90 })

  ctx.eq((await PUT(`/api/cajas/${id}`, { nombre: `Renom ${uid()}`, orden: 91 })).status, 200, "PUT cajas")
  ctx.eq((await DEL(`/api/cajas/${id}`)).status, 200, "DELETE cajas")

  const lista = await must(await GET("/api/cajas"), "GET cajas")
  ctx.ok(!lista.some(c => c.id === id), "la caja ya no esta")
})

test("V9", "CRUD completo de categorias", async ctx => {
  const { id } = await mkCategoria("ingreso")

  ctx.eq((await PUT(`/api/categorias/${id}`, { nombre: `Renom ${uid()}` })).status, 200, "PUT categorias")
  ctx.eq((await DEL(`/api/categorias/${id}`)).status, 200, "DELETE categorias")
})

test("V10", "CRUD completo de depositos", async ctx => {
  const id = await mkDeposito()

  ctx.eq((await PUT(`/api/depositos/${id}`, { nombre: `Renom ${uid()}` })).status, 200, "PUT depositos")

  const uno = await must(await GET(`/api/depositos/${id}`), "GET deposito por id")
  ctx.ok(uno, "GET deposito por id devuelve la fila")

  ctx.eq((await DEL(`/api/depositos/${id}`)).status, 200, "DELETE depositos")
})

test("V11", "CRUD completo de articulos", async ctx => {
  const id = await mkArticulo({ codigo: `COD-${uid()}`, costoUnitario: 2500 })

  const hist = await GET(`/api/articulos/${id}/historial-costos`)
  ctx.eq(hist.status, 200, "GET historial-costos responde 200")

  ctx.eq((await PUT(`/api/articulos/${id}`, { costoUnitario: 3000 })).status, 200, "PUT articulos")
  ctx.eq((await DEL(`/api/articulos/${id}`)).status, 200, "DELETE articulos")
})

/* --- CRUD de clientes con fichero y cuotas --- */

test("V12", "CRUD completo de clientes", async ctx => {
  const id = await mkCliente()

  ctx.eq((await GET(`/api/clientes/${id}`)).status, 200, "GET cliente por id")
  ctx.eq((await PUT(`/api/clientes/${id}`, { email: "a@b.com" })).status, 200, "PUT cliente")
  ctx.eq((await DEL(`/api/clientes/${id}`)).status, 200, "DELETE cliente")
})

test("V13", "POST /clientes duplicado devuelve 409", async ctx => {
  const id = await mkCliente()

  const r = await POST("/api/clientes", { id, nombre: "Otro", fechaAlta: "01/01/2026" })
  ctx.eq(r.status, 409, "crear dos veces el mismo id da 409")

  await drop(`/api/clientes/${id}`)
})

test("V14", "POST /clientes sin campos obligatorios devuelve 400", async ctx => {
  ctx.eq((await POST("/api/clientes", {})).status, 400, "body vacio")
  ctx.eq((await POST("/api/clientes", { id: `cli_${uid()}`, fechaAlta: "01/01/2026" })).status, 400, "sin nombre")
})

test("V15", "fichero: upsert, lectura y borrado", async ctx => {
  const clienteId = await mkCliente()

  const r1 = await POST(`/api/clientes/${clienteId}/fichero`, { fecha: "10/01/2026", total: "$100.000" })
  ctx.eq(r1.status, 201, "el primer POST crea el fichero")

  const r2 = await POST(`/api/clientes/${clienteId}/fichero`, { total: "$150.000" })
  ctx.eq(r2.status, 200, "el segundo POST actualiza (upsert)")

  const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
  ctx.ok(c.fichero, "el fichero quedo asociado")

  ctx.eq((await DEL(`/api/clientes/${clienteId}/fichero`)).status, 200, "DELETE fichero")

  await drop(`/api/clientes/${clienteId}`)
})

test("V16", "cuotas: generar plan, agregar cargo, editar y eliminar", async ctx => {
  const clienteId = await mkCliente()
  await mkFichero(clienteId, { total: "$120.000" })

  const gen = await must(
    await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas: 3 }),
    "generar plan",
  )
  ctx.eq(gen.cuotasGeneradas, 3, "genero 3 cuotas")

  let c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
  ctx.eq(c.cuotas.length, 3, "hay 3 cuotas")

  await must(await POST(`/api/clientes/${clienteId}/fichero/cuotas`, { monto: 5000 }), "agregar cargo")
  c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
  ctx.eq(c.cuotas.length, 4, "el cargo extra suma una cuota")

  const extra = c.cuotas[c.cuotas.length - 1]

  ctx.eq((await PUT(`/api/clientes/${clienteId}/fichero/cuotas/${extra.id}`, { monto: 7500 })).status, 200, "PUT cuota")
  ctx.eq((await DEL(`/api/clientes/${clienteId}/fichero/cuotas/${extra.id}`)).status, 200, "DELETE cuota")

  await drop(`/api/clientes/${clienteId}`)
})

test("V17", "pago inicial crea y actualiza la cuota 0", async ctx => {
  const clienteId = await mkCliente()
  await mkFichero(clienteId, { total: "$120.000" })

  ctx.eq((await POST(`/api/clientes/${clienteId}/fichero/pago-inicial`, { monto: 20000 })).status, 200, "POST pago-inicial")

  const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
  ctx.eq(c.fichero.pagoInicial, 20000, "se guardo el pago inicial")

  const inicial = c.cuotas.find(x => x.nroCuota === 0)
  ctx.ok(inicial, "existe la cuota de pago inicial")
  ctx.eq(inicial.montoPagado, 20000, "la cuota 0 quedo abonada")

  await drop(`/api/clientes/${clienteId}`)
})

/* --- proveedores, compras, ordenes de pago --- */

test("V18", "CRUD completo de proveedores", async ctx => {
  const id = await mkProveedor()

  ctx.eq((await GET(`/api/proveedores/${id}`)).status, 200, "GET proveedor")
  ctx.eq((await PUT(`/api/proveedores/${id}`, { telefono: "11" })).status, 200, "PUT proveedor")
  ctx.eq((await DEL(`/api/proveedores/${id}`)).status, 200, "DELETE proveedor")
})

test("V19", "compra: crear, listar, leer, editar y borrar", async ctx => {
  const proveedorId = await mkProveedor()
  const compra = await mkCompra(proveedorId, [{ detalle: "Cloro", cantidad: 10, precioUnitario: 1000 }])

  ctx.eq(compra.total, 10000, "el total lo calcula el servidor (10 x 1000)")

  ctx.eq((await GET(`/api/proveedores/${proveedorId}/compras`)).status, 200, "GET compras del proveedor")
  ctx.eq((await GET(`/api/compras/${compra.id}`)).status, 200, "GET compra por id")
  ctx.eq((await GET(`/api/compras/${compra.id}/recepciones`)).status, 200, "GET recepciones")

  ctx.eq((await PUT(`/api/compras/${compra.id}`, { descripcion: "Editada" })).status, 200, "PUT compra")
  ctx.eq((await DEL(`/api/compras/${compra.id}`)).status, 200, "DELETE compra")

  await drop(`/api/proveedores/${proveedorId}`)
})

test("V20", "orden de pago: crear, leer y anular", async ctx => {
  const proveedorId = await mkProveedor()
  const compra = await mkCompra(proveedorId, [{ detalle: "Cloro", cantidad: 10, precioUnitario: 1000 }])

  const r = await must(
    await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
      fecha: "2026-01-15",
      concepto: "Pago prueba",
      detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 10000 }],
      comprasPagadas: [{ compraId: compra.id, monto: 10000 }],
    }),
    "POST orden de pago",
  )

  ctx.ok(r.id, "la orden devuelve id")
  ctx.eq((await GET(`/api/ordenes-pago/${r.id}`)).status, 200, "GET orden de pago")
  ctx.eq((await GET(`/api/proveedores/${proveedorId}/ordenes-pago`)).status, 200, "GET ordenes del proveedor")

  ctx.eq((await POST(`/api/ordenes-pago/${r.id}/anular`)).status, 200, "POST anular")

  await drop(`/api/proveedores/${proveedorId}`)
})

/* --- caja --- */

test("V21", "caja: CRUD de movimientos", async ctx => {
  const id = await mkMovimiento()

  ctx.eq((await GET(`/api/caja/movimientos/${id}`)).status, 200, "GET movimiento por id")

  ctx.eq((await PUT(`/api/caja/movimientos/${id}`, { concepto: "Editado", monto: 20000 })).status, 200, "PUT movimiento")

  const uno = await must(await GET(`/api/caja/movimientos/${id}`), "GET movimiento")
  ctx.eq(uno.monto, 20000, "el PUT se persistió")

  ctx.eq((await DEL(`/api/caja/movimientos/${id}`)).status, 200, "DELETE movimiento")
})

test("V22", "caja: preview y cierre de sub-caja", async ctx => {
  const { mes, anio } = mesActual()

  const prev = await GET(`/api/caja/cierres/preview?subCaja=Efectivo&mes=${mes}&anio=${anio}`)
  ctx.eq(prev.status, 200, "preview responde 200")
  ctx.ok(typeof prev.body?.saldoInicial === "number", "preview trae saldoInicial")
  ctx.ok(typeof prev.body?.saldoFinal === "number", "preview trae saldoFinal")

  const cierre = await must(
    await POST("/api/caja/cierres", { mes, anio, subCaja: "Efectivo", saldoReal: 0 }),
    "POST cierre",
  )
  ctx.ok(cierre.id, "el cierre devuelve id")

  ctx.eq((await GET("/api/caja/cierres")).status, 200, "GET cierres")
})

/* --- cheques --- */

test("V23", "CRUD de cheque emitido", async ctx => {
  const id = await mkChequeEmitido()

  ctx.eq((await GET(`/api/cheques/${id}`)).status, 200, "GET cheque")
  ctx.eq((await PUT(`/api/cheques/${id}`, { estado: "Pagado" })).status, 200, "PUT cheque")
  ctx.eq((await DEL(`/api/cheques/${id}`)).status, 200, "DELETE cheque")
})

test("V24", "CRUD de cheque recibido", async ctx => {
  const id = await mkChequeRecibido()

  ctx.eq((await GET(`/api/cheques/${id}`)).status, 200, "GET cheque")
  ctx.eq((await PUT(`/api/cheques/${id}`, { estado: "Depositado" })).status, 200, "PUT cheque")
  ctx.eq((await DEL(`/api/cheques/${id}`)).status, 200, "DELETE cheque")
})

test("V25", "POST /cheques sin campos obligatorios da 400", async ctx => {
  const r = await POST("/api/cheques", { tipo: "emitido" })
  ctx.eq(r.status, 400, "faltan campos")
  ctx.ok(String(r.body?.error).includes("banco"), "el error nombra el campo faltante")
})

/* --- calendario: equipos, instalaciones, veredas --- */

test("V26", "CRUD de equipos", async ctx => {
  const r = await must(
    await POST("/api/equipos", { nombre: `Equipo ${uid()}`, encargado: "Juan", empleados: ["Ana"] }),
    "POST equipos",
  )

  ctx.eq((await GET(`/api/equipos/${r.id}`)).status, 200, "GET equipo")
  ctx.eq((await PUT(`/api/equipos/${r.id}`, { encargado: "Pedro" })).status, 200, "PUT equipo")
  ctx.eq((await DEL(`/api/equipos/${r.id}`)).status, 200, "DELETE equipo")
})

test("V27", "CRUD de instalaciones", async ctx => {
  const clienteId = await mkCliente()
  const ficheroId = await mkFichero(clienteId, { fecha: "10/01/2026" })

  const r = await must(
    await POST("/api/instalaciones", { ficheroId, fecha: "2026-01-10" }),
    "POST instalaciones",
  )

  ctx.eq((await GET(`/api/instalaciones/${r.id}`)).status, 200, "GET instalacion")
  ctx.eq((await GET("/api/instalaciones/ventas")).status, 200, "GET ventas")
  ctx.eq((await PUT(`/api/instalaciones/${r.id}`, { estado: "Completada" })).status, 200, "PUT instalacion")
  ctx.eq((await DEL(`/api/instalaciones/${r.id}`)).status, 200, "DELETE instalacion")

  await drop(`/api/clientes/${clienteId}`)
})

test("V28", "CRUD de veredas", async ctx => {
  const clienteId = await mkCliente()

  const r = await must(
    await POST("/api/veredas", {
      nombre: `Vereda ${uid()}`,
      ubicacion: "Calle 123",
      clienteId,
      fecha: "2026-01-10",
    }),
    "POST veredas",
  )

  ctx.eq((await PUT(`/api/veredas/${r.id}`, { notas: "Nota de prueba" })).status, 200, "PUT veredas")
  ctx.eq((await DEL(`/api/veredas/${r.id}`)).status, 200, "DELETE veredas")

  await drop(`/api/clientes/${clienteId}`)
})

/* --- stock y remitos --- */

test("V29", "stock: ingreso inicial, ajuste y reportes", async ctx => {
  const depositoId = await mkDeposito()
  const articuloId = await mkArticulo({ costoUnitario: 1000 })

  const ing = await must(
    await POST("/api/stock/ingresos-iniciales", {
      depositoId,
      lineas: [{ articuloId, cantidad: 100, costoUnitario: 1000 }],
    }),
    "POST ingresos-iniciales",
  )
  ctx.ok(Array.isArray(ing.movimientos), "devuelve el arreglo movimientos")

  const trasIngreso = await stockDe(depositoId, articuloId)
  ctx.eq(trasIngreso.cantidad, 100, "el ingreso sumo las unidades")
  ctx.eq(trasIngreso.costoPromedio, 1000, "el costo promedio quedo en 1000")

  await must(
    await POST("/api/stock/ajustes", {
      depositoId,
      motivo: "Merma de prueba",
      lineas: [{ articuloId, cantidad: -10 }],
    }),
    "POST ajustes",
  )

  const trasAjuste = await stockDe(depositoId, articuloId)
  ctx.eq(trasAjuste.cantidad, 90, "el ajuste descconto las unidades")

  ctx.eq((await GET("/api/stock/movimientos")).status, 200, "GET kardex")
  ctx.eq((await GET(`/api/stock/movimientos?articuloId=${articuloId}`)).status, 200, "GET kardex con filtro")
})

test("V30", "remito de salida: crear, listar, leer y anular", async ctx => {
  const depositoId = await mkDeposito()
  const articuloId = await mkArticulo({ costoUnitario: 500 })

  await must(
    await POST("/api/stock/ingresos-iniciales", {
      depositoId,
      lineas: [{ articuloId, cantidad: 50, costoUnitario: 500 }],
    }),
    "stock inicial",
  )

  const r = await must(
    await POST("/api/remitos", {
      tipo: "salida",
      depositoOrigenId: depositoId,
      destino: "Cliente Final",
      lineas: [{ articuloId, cantidad: 10, costoUnitario: 500 }],
    }),
    "POST remitos",
  )

  ctx.ok(r.id, "el remito devuelve id")
  ctx.ok(r.numero > 0, "el remito devuelve numero")

  const detalle = await must(await GET(`/api/remitos/${r.id}`), "GET remito")
  ctx.ok(Array.isArray(detalle.items), "el detalle del remito trae sus items")

  ctx.eq((await POST(`/api/remitos/${r.id}/anular`)).status, 200, "POST anular remito")
})

test("V31", "remito de transferencia entre depositos", async ctx => {
  const origen = await mkDeposito()
  const destino = await mkDeposito()
  const articuloId = await mkArticulo({ costoUnitario: 300 })

  await must(
    await POST("/api/stock/ingresos-iniciales", {
      depositoId: origen,
      lineas: [{ articuloId, cantidad: 40, costoUnitario: 300 }],
    }),
    "stock inicial",
  )

  await must(
    await POST("/api/remitos", {
      tipo: "transferencia",
      depositoOrigenId: origen,
      depositoDestinoId: destino,
      lineas: [{ articuloId, cantidad: 10, costoUnitario: 300 }],
    }),
    "POST transferencia",
  )

  const enOrigen = await stockDe(origen, articuloId)
  const enDestino = await stockDe(destino, articuloId)

  ctx.eq(enOrigen.cantidad, 30, "el origen descuenta")
  ctx.eq(enDestino.cantidad, 10, "el destino suma")
})

test("V32", "compra: recepcion parcial y completa", async ctx => {
  const proveedorId = await mkProveedor()
  const depositoId = await mkDeposito()
  const articuloId = await mkArticulo({ costoUnitario: 0 })

  const compra = await mkCompra(proveedorId, [{ detalle: "Filtro", cantidad: 20, precioUnitario: 2000 }])

  await must(
    await POST(`/api/compras/${compra.id}/recepciones`, {
      depositoId,
      fecha: "2026-01-12",
      lineas: [{ itemIndex: 0, articuloId, cantidad: 8 }],
    }),
    "recepcion parcial",
  )

  const trasParcial = await stockDe(depositoId, articuloId)
  ctx.eq(trasParcial.cantidad, 8, "la recepcion ingreso 8 unidades")

  const rec = await must(await GET(`/api/compras/${compra.id}/recepciones`), "GET recepciones")
  ctx.ok(rec.recepciones?.length === 1, "quedo registrada una recepcion")

  await must(
    await POST(`/api/compras/${compra.id}/recepciones`, {
      depositoId,
      fecha: "2026-01-13",
      lineas: [{ itemIndex: 0, articuloId, cantidad: 12 }],
    }),
    "recepcion completa",
  )

  const trasTotal = await stockDe(depositoId, articuloId)
  ctx.eq(trasTotal.cantidad, 20, "el total recibido es 20")

  await drop(`/api/proveedores/${proveedorId}`)
})

/* --- periodos y dashboard --- */

test("V33", "periodos: listar, preview, cerrar y abrir", async ctx => {
  const anio = 2016
  const mes = 6

  ctx.eq((await GET("/api/periodos")).status, 200, "GET periodos")

  const prev = await GET(`/api/periodos/${mes}/${anio}/preview`)
  ctx.eq(prev.status, 200, "GET preview")
  ctx.ok(prev.body?.ventas, "el preview trae ventas")

  const cierre = await POST(`/api/periodos/${mes}/${anio}/cerrar`, {})
  ctx.eq(cierre.status, 201, "POST cerrar (201 al crear)")

  ctx.eq((await POST(`/api/periodos/${mes}/${anio}/cerrar`, {})).status, 409, "cerrar dos veces da 409")

  ctx.eq((await POST(`/api/periodos/${mes}/${anio}/abrir`)).status, 200, "POST abrir")
  ctx.eq((await POST(`/api/periodos/${mes}/${anio}/abrir`)).status, 409, "abrir dos veces da 409")

  ctx.eq((await POST(`/api/periodos/13/${anio}/cerrar`, {})).status, 400, "mes 13 da 400")
  ctx.eq((await POST(`/api/periodos/0/${anio}/cerrar`, {})).status, 400, "mes 0 da 400")

  await POST(`/api/periodos/${mes}/${anio}/abrir`)
})

test("V34", "dashboard responde con todos sus bloques", async ctx => {
  const r = await must(await GET("/api/dashboard"), "GET dashboard")

  for (const key of ["kpis", "serieVentas", "morosos", "chequesAVencer", "agenda", "contadores"]) {
    ctx.ok(r[key] !== undefined, `el dashboard trae "${key}"`)
  }

  for (const key of ["ventasMes", "cajaIngresos", "cajaEgresos", "valorStock", "porCobrar", "cuentasAPagar"]) {
    ctx.ok(r.kpis?.[key] !== undefined, `kpis trae "${key}"`)
  }
})