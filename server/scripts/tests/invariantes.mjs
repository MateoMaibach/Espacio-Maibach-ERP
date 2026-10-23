/**
 * Bloque 2 - Invariantes de dominio y coherencia entre endpoints.
 *
 * Cada test afirma una relacion que DEBERIA cumplirse entre tablas o entre
 * endpoints distintos. Si dos endpoints que deberian contar lo mismo cuentan
 * cosas distintas, hay un bug, aunque los dos devuelvan 200.
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
  mkFichero,
  mkCompra,
  mkMovimiento,
  mkChequeEmitido,
  mkChequeRecibido,
  mkClienteConCuotas,
  stockDe,
  kardex,
  snapshot,
  cerrarPeriodoTemporal,
  uid,
  isoMes,
  dmy,
  mesActual,
} from "../test-api-lib.mjs"

block("INVARIANTES")

/* ------------------------------------------------------------------ *
 * Caja: el resumen tiene que coincidir con los movimientos
 * ------------------------------------------------------------------ */

test(
  "IN1",
  "el resumen de caja cuadra con la suma de los movimientos",
  async ctx => {
    const { mes, anio } = mesActual()
    const fecha = isoMes(mes, anio, 12)
    const marca = uid()

    await mkMovimiento({ fecha, concepto: `${marca} ingreso`, monto: 12345, tipo: "ingreso", subCaja: "Efectivo" })
    await mkMovimiento({ fecha, concepto: `${marca} egreso`, monto: 2345, tipo: "egreso", subCaja: "Efectivo" })

    const resumen = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "GET resumen")
    const movs = await must(await GET(`/api/caja/movimientos?mes=${mes}&anio=${anio}`), "GET movimientos")

    const mios = movs.filter(m => m.concepto?.startsWith(marca))
    ctx.eq(mios.length, 2, "los dos movimientos se listan en el mes")

    const sub = resumen.subCajas?.Efectivo
    ctx.ok(sub, "el resumen trae la subCaja Efectivo")

    if (sub) {
      ctx.ok(
        sub.ingresos >= 12345,
        `los ingresos de la subCaja incluyen mi movimiento (${sub.ingresos} >= 12345)`,
      )
      ctx.ok(
        sub.egresos >= 2345,
        `los egresos de la subCaja incluyen mi movimiento (${sub.egresos} >= 2345)`,
      )
      ctx.eq(sub.total, sub.ingresos - sub.egresos, "el total de la subCaja es ingresos - egresos")
    }

    const total = resumen.totalIngresos - resumen.totalEgresos
    ctx.ok(Number.isFinite(total), "el total neto es un numero finito")
  },
  { sev: "ALTA", ref: "caja.controller.ts:575-579", nota: "subCajas vs totales generales" },
)

test(
  "IN2",
  "un movimiento en Dólares no altera los totales generales pero si su subCaja",
  async ctx => {
    const { mes, anio } = mesActual()
    const fecha = isoMes(mes, anio, 14)
    const marca = uid()

    const antes = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "resumen antes")

    await mkMovimiento({
      fecha,
      concepto: `${marca} usd`,
      monto: 100,
      tipo: "ingreso",
      subCaja: "Dólares",
      moneda: "USD",
      tipoCambio: 1000,
    })

    const despues = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "resumen despues")

    ctx.eq(
      despues.totalIngresos - antes.totalIngresos,
      0,
      `Dólares tiene afectaGeneral=0, no debe sumar al total general (subio ${despues.totalIngresos - antes.totalIngresos})`,
    )

    const subAntes = antes.subCajas?.["Dólares"]?.ingresos ?? 0
    const subDespues = despues.subCajas?.["Dólares"]?.ingresos ?? 0

    ctx.eq(
      subDespues - subAntes,
      100000,
      `la subCaja Dólares deberia subir 100 x 1000 = 100.000 (subio ${subDespues - subAntes})`,
    )
  },
  { sev: "ALTA", ref: "caja.controller.ts:559-579", nota: "afectaGeneral filtra totales pero no subCajas" },
)

/* ------------------------------------------------------------------ *
 * Stock: valuacion consistente
 * ------------------------------------------------------------------ */

test(
  "IN3",
  "el costo promedio ponderado se recalcula bien en cada ingreso",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 1000 }],
      }),
      "ingreso 1",
    )
    ctx.eq((await stockDe(depositoId, articuloId)).costoPromedio, 1000, "tras 10 u a 1000, promedio 1000")

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 30, costoUnitario: 2000 }],
      }),
      "ingreso 2",
    )

    const fila = await stockDe(depositoId, articuloId)
    ctx.eq(fila.cantidad, 40, "40 unidades en total")
    ctx.eq(
      fila.costoPromedio,
      1750,
      "promedio ponderado = (10*1000 + 30*2000) / 40 = 1750",
    )
  },
  { sev: "ALTA", ref: "stock.service.ts:59-66", nota: "formula del costo promedio ponderado" },
)

test(
  "IN4",
  "egresar unidades no cambia el costo promedio",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 100, costoUnitario: 1000 }],
      }),
      "ingreso",
    )

    await must(
      await POST("/api/stock/ajustes", {
        depositoId,
        motivo: "Egreso de prueba",
        lineas: [{ articuloId, cantidad: -40 }],
      }),
      "egreso",
    )

    const fila = await stockDe(depositoId, articuloId)
    ctx.eq(fila.cantidad, 60, "quedan 60 unidades")
    ctx.eq(fila.costoPromedio, 1000, "el costo promedio no se toca al egresar")
  },
  { sev: "ALTA", ref: "stock.service.ts:59", nota: "el promedio solo se recalcula con delta > 0" },
)

test(
  "IN5",
  "GET /stock y reportes/valorizacion dan el mismo total",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 25, costoUnitario: 400 }],
      }),
      "ingreso",
    )

    const existencias = await must(await GET("/api/stock"), "GET stock")
    const valorizacion = await must(await GET("/api/stock/reportes/valorizacion"), "GET valorizacion")

    const desdeExistencias = (existencias.rows ?? []).reduce((a, f) => a + (f.valor ?? 0), 0)
    const desdeValorizacion = (valorizacion.rows ?? []).reduce((a, f) => a + (f.valor ?? 0), 0)

    ctx.eq(existencias.valorTotal, desdeExistencias, "stock.valorTotal = suma de sus filas")

    ctx.eq(
      desdeValorizacion,
      desdeExistencias,
      `valorizacion suma ${desdeValorizacion} y existencias ${desdeExistencias}`,
    )

    ctx.ok(
      Math.abs((valorizacion.total ?? desdeValorizacion) - desdeExistencias) <= 1,
      `el total de valorizacion (${valorizacion.total}) no cuadra con sus filas (${desdeValorizacion})`,
    )
  },
  { sev: "ALTA", ref: "stock.controller.ts:85 vs :508", nota: "mismo calculo en dos endpoints" },
)

test(
  "IN6",
  "el saldo del kardex coincide con la existencia real",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 20, costoUnitario: 500 }],
      }),
      "ingreso",
    )

    await must(
      await POST("/api/stock/ajustes", {
        depositoId,
        motivo: "Ajuste de prueba",
        lineas: [{ articuloId, cantidad: -5 }],
      }),
      "ajuste",
    )

    const filas = await kardex(articuloId)
    const existencias = await stockDe(depositoId, articuloId)

    ctx.eq(
      filas[filas.length - 1]?.saldo,
      existencias.cantidad,
      `el kardex cierra en ${filas[filas.length - 1]?.saldo} pero la existencia es ${existencias.cantidad}`,
    )
  },
  { sev: "MEDIA", ref: "stock.controller.ts:133-165", nota: "kardex vs existencias" },
)

test(
  "IN7",
  "una compra recepcionada deja historial de costos coherente",
  async ctx => {
    const proveedorId = await mkProveedor()
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 1000 })

    const compra = await mkCompra(proveedorId, [{ detalle: "Repuesto", cantidad: 10, precioUnitario: 2500 }])

    await must(
      await POST(`/api/compras/${compra.id}/recepciones`, {
        depositoId,
        fecha: "2026-01-12",
        lineas: [{ itemIndex: 0, articuloId, cantidad: 10 }],
      }),
      "recepcion",
    )

    const art = await must(await GET(`/api/articulos/${articuloId}`), "GET articulo")
    ctx.eq(art.costoUnitario, 2500, "el costo de referencia del articulo subio al de la compra")

    const hist = await must(await GET(`/api/articulos/${articuloId}/historial-costos`), "historial")
    const rows = hist.historial ?? hist

    const deCompra = rows.filter(r => r.origen === "compra")
    ctx.eq(deCompra.length, 1, "se registro un cambio de costo de origen compra")
    ctx.eq(deCompra[0]?.costo, 2500, "el historial guardo el costo correcto")
    ctx.eq(deCompra[0]?.referenciaId, compra.id, "el historial apunta a la compra")

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "MEDIA", ref: "compras.controller.ts:546-562", nota: "costo del articulo vs historial" },
)

test(
  "IN8",
  "el total del remito coincide con la suma de sus items",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 100, costoUnitario: 1000 }],
      }),
      "stock",
    )

    const r = await must(
      await POST("/api/remitos", {
        tipo: "salida",
        depositoOrigenId: depositoId,
        destino: "Cliente",
        lineas: [
          { articuloId, cantidad: 3, costoUnitario: 1000 },
          { articuloId, cantidad: 7, costoUnitario: 1000 },
        ],
      }),
      "remito",
    )

    const remito = await must(await GET(`/api/remitos/${r.id}`), "GET remito")
    const items = remito.items ?? []

    const sumaItems = items.reduce((a, i) => a + i.subtotal, 0)
    ctx.eq(remito.valorTotal, sumaItems, "valorTotal = suma de subtotales")

    const s = await stockDe(depositoId, articuloId)
    ctx.eq(s.cantidad, 90, "el remito descuenta del stock")
  },
  { sev: "ALTA", ref: "remitos.controller.ts:252,269", nota: "valorTotal vs suma de items" },
)

/* ------------------------------------------------------------------ *
 * Cheques y ordenes de pago
 * ------------------------------------------------------------------ */

test(
  "IN9",
  "pagar con cheque deja el cheque en Pagado",
  async ctx => {
    const proveedorId = await mkProveedor()
    const chequeId = await mkChequeEmitido({ importe: 30000 })

    await must(
      await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
        fecha: "2026-01-15",
        concepto: "Pago con cheque",
        detalles: [{ subCaja: "Cheques", moneda: "ARS", monto: 30000, chequeId }],
      }),
      "orden de pago",
    )

    const chq = await must(await GET(`/api/cheques/${chequeId}`), "GET cheque")
    ctx.eq(chq.estado, "Pagado", "el cheque paso a Pagado")

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "ordenesPago.controller.ts:380-403", nota: "estado del cheque tras la orden" },
)

test(
  "IN10",
  "anular una orden de pago restaura el saldo del proveedor",
  async ctx => {
    const proveedorId = await mkProveedor()
    const compra = await mkCompra(proveedorId, [{ detalle: "Material", cantidad: 10, precioUnitario: 5000 }])

    const saldoAntes = (await must(await GET(`/api/proveedores/${proveedorId}`), "GET proveedor")).saldos

    const op = await must(
      await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
        fecha: "2026-01-15",
        concepto: "Pago total",
        detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 50000 }],
        comprasPagadas: [{ compraId: compra.id, monto: 50000 }],
      }),
      "orden de pago",
    )

    const durante = (await must(await GET(`/api/proveedores/${proveedorId}`), "GET proveedor")).saldos
    ctx.ok(
      JSON.stringify(durante) !== JSON.stringify(saldoAntes),
      `tras pagar, los saldos del proveedor deberian cambiar (antes ${JSON.stringify(saldoAntes)}, despues ${JSON.stringify(durante)})`,
    )

    await must(await POST(`/api/ordenes-pago/${op.id}/anular`), "anular")

    const despues = (await must(await GET(`/api/proveedores/${proveedorId}`), "GET proveedor")).saldos
    ctx.eq(
      JSON.stringify(despues),
      JSON.stringify(saldoAntes),
      `anular no restauro los saldos del proveedor (antes ${JSON.stringify(saldoAntes)}, despues ${JSON.stringify(despues)})`,
    )

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "CRITICA", ref: "ordenesPago.controller.ts:433-492", nota: "la anulacion es una compensacion real" },
)

/* ------------------------------------------------------------------ *
 * Ficheros y derivados
 * ------------------------------------------------------------------ */

test(
  "IN11",
  "los derivados del fichero (margen, comision) se calculan bien",
  async ctx => {
    const clienteId = await mkCliente()

    await mkFichero(clienteId, {
      fecha: "10/01/2026",
      total: "$1.000.000",
      costoPiscina: 100000,
      costoInstalacion: 200000,
      costoEquipoFiltrado: 50000,
      costoManoObra: 150000,
      comisionPct: 10,
    })

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const f = c.fichero

    ctx.eq(f.venta, 1000000, "la venta parsea el total formateado")
    ctx.eq(f.comisionMonto, 100000, "comision = 10% de 1.000.000")
    ctx.eq(
      f.totalCostos,
      600000,
      "insumos 100k+200k+50k+150k = 500k, mas 100k de comision = 600k",
    )
    ctx.eq(f.margenNeto, 400000, "margen = venta - costos = 400k")
    ctx.eq(f.margenPct, 40, "margen% = 40")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "fichero.costs.ts:34-53", nota: "calculo de derivados" },
)

test(
  "IN12",
  "un update parcial de insumos no borra los costos ya cargados",
  async ctx => {
    const clienteId = await mkCliente()

    await mkFichero(clienteId, {
      fecha: "10/01/2026",
      total: "$1.000.000",
      costoPiscina: 100000,
      costoInstalacion: 200000,
    })

    await must(
      await POST(`/api/clientes/${clienteId}/fichero`, { costoManoObra: 50000 }),
      "update parcial",
    )

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    ctx.eq(c.fichero.costoPiscina, 100000, "costoPiscina sigue ahi")
    ctx.eq(c.fichero.costoInstalacion, 200000, "costoInstalacion sigue ahi")
    ctx.eq(c.fichero.costoManoObra, 50000, "costoManoObra se cargo")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "fichero.costs.ts:67-94", nota: "leerInsumos devuelve solo claves presentes" },
)

/* ------------------------------------------------------------------ *
 * Cuotas
 * ------------------------------------------------------------------ */

test(
  "IN13",
  "las cuotas suman exactamente el saldo por dividir",
  async ctx => {
    const total = 120000
    const cantCuotas = 3
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas })

    const suma = cuotas.reduce((a, c) => a + c.montoPlanificado, 0)
    ctx.eq(suma, total, `las cuotas suman el total (${suma} vs ${total})`)

    const primera = cuotas[0]
    const ultima = cuotas[cuotas.length - 1]
    ctx.eq(primera.montoPlanificado, Math.floor(total / cantCuotas), "todas menos la ultima son el floor")
    ctx.eq(
      ultima.montoPlanificado,
      total - Math.floor(total / cantCuotas) * (cantCuotas - 1),
      "la ultima absorbe el remanente",
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:265-290", nota: "reparto del saldo en cuotas" },
)

test(
  "IN14",
  "cobrar una cuota completa la marca como Pagada",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const r = await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
        monto: cuota.montoPlanificado,
      }),
      "cobrar cuota",
    )

    ctx.eq(r.nuevoEstado, "Pagada", "al pagar el total queda Pagada")
    ctx.eq(r.montoPagado, cuota.montoPlanificado, "montoPagado acumulado correcto")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:422-425", nota: "transicion de estado de la cuota" },
)

test(
  "IN15",
  "cobrar una cuota parcial la deja en Parcial",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const r = await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, { monto: 1000 }),
      "cobrar parcial",
    )

    ctx.eq(r.nuevoEstado, "Parcial", "un pago parcial queda Parcial")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "cuotas.controller.ts:424", nota: "estado Parcial" },
)

/* ------------------------------------------------------------------ *
 * Dashboard y periodos
 * ------------------------------------------------------------------ */

test(
  "IN16",
  "las ventas del dashboard reflejan los ficheros del mes",
  async ctx => {
    const { mes, anio } = mesActual()
    const clienteId = await mkCliente()

    const antes = await must(await GET("/api/dashboard"), "dashboard antes")

    await mkFichero(clienteId, { fecha: dmy(mes, anio, 7), total: "$300.000" })

    const despues = await must(await GET("/api/dashboard"), "dashboard despues")

    ctx.eq(
      despues.kpis.ventasMes - antes.kpis.ventasMes,
      300000,
      `las ventas del mes subieron ${despues.kpis.ventasMes - antes.kpis.ventasMes} en vez de 300.000`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "dashboard.controller.ts:40", nota: "parseMonto duplicado en dashboard" },
)

test(
  "IN17",
"reabrir y volver a cerrar un periodo deja el snapshot consistente",
  async ctx => {
    const anio = 2017
    const mes = 3

    await must(await cerrarPeriodoTemporal(mes, anio, "Snapshot inicial"), "cerrar")

    const p1 = await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")
    ctx.eq(p1.estado, "cerrado", "el periodo quedo cerrado")
    ctx.ok(p1.snapshot, "tiene snapshot guardado")

    await must(await POST(`/api/periodos/${mes}/${anio}/abrir`), "abrir")
    await must(await cerrarPeriodoTemporal(mes, anio, "Snapshot nuevo"), "cerrar de nuevo")

    const p2 = await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")
    ctx.eq(p2.observaciones, "Snapshot nuevo", "las observaciones se actualizaron")

    for (const key of ["ventas", "costes", "resultado", "caja"]) {
      ctx.ok(p2.snapshot?.[key] !== undefined, `el snapshot nuevo trae "${key}"`)
    }

    await POST(`/api/periodos/${mes}/${anio}/abrir`)
  },
  { sev: "MEDIA", ref: "periodos.controller.ts:106-124", nota: "el snapshot se sobreescribe" },
)

test(
  "IN18",
  "el preview expone la misma forma que el snapshot guardado",
  async ctx => {
    const anio = 2018
    const mes = 5

    await must(await cerrarPeriodoTemporal(mes, anio), "cerrar")

    const guardado = (await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")).snapshot
    const prev = await must(await GET(`/api/periodos/${mes}/${anio}/preview`), "preview")

    for (const key of ["ventas", "costes", "resultado", "caja", "generadoEn"]) {
      ctx.ok(prev[key] !== undefined, `el preview trae "${key}"`)
    }

    ctx.ok(guardado, "el snapshot guardado existe")

    ctx.ok(
      prev.desfasado !== undefined,
      "el preview deberia decir si el snapshot guardado quedo desfasado respecto del estado actual",
    )

    await POST(`/api/periodos/${mes}/${anio}/abrir`)
  },
  { sev: "ALTA", ref: "periodos.controller.ts:187-199", nota: "preview deberia comparar contra el snapshot" },
)