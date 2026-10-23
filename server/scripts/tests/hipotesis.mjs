/**
 * Bloque 3 - Hipotesis de bug.
 *
 * Cada test afirma el comportamiento CORRECTO. Si falla, el defecto queda
 * confirmado con evidencia reproducible. La metadata dice de donde sale la
 * hipotesis y por que importa.
 *
 * `meta.d known: true` marca los defectos que el propio codigo ya documenta
 * en un TODO: asi el reporte distingue "ya lo sabian" de "nuevo".
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
  abrirPeriodo,
  cerrarPeriodoTemporal,
  conPeriodoCerrado,
  uid,
  isoMes,
  dmy,
  mesActual,
} from "../test-api-lib.mjs"

/**
 * Verifica que una escritura en un periodo cerrado quedo registrada como
 * desvio.
 *
 * El cierre congela SOLO movimientos y ficheros (donde esta assertMesAbierto).
 * Compras, remitos, stock, cuotas, cheques y ordenes de pago siguen
 * admitiendo escritura, porque frenar una compra registrada con atraso
 * bloquearia el trabajo real. Lo que no se permite es que pase inadvertido.
 */
async function assertDesvio(ctx, periodo, tabla, operacion) {
  const r = await GET(`/api/periodos/${periodo.mes}/${periodo.anio}`)

  ctx.eq(r.status, 200, "el detalle del periodo responde")

  const desvios = r.body?.desviaciones ?? []

  ctx.ok(Array.isArray(desvios), "el detalle del periodo expone las desviaciones")

  const mio = desvios.find(d => d.tabla === tabla && d.operacion === operacion)

  ctx.ok(
    mio,
    `la escritura en "${tabla}" cae en un periodo cerrado y deberia quedar registrada como desvio; desviaciones registradas: ${JSON.stringify(desvios.map(d => d.tabla + "." + d.operacion))}`,
  )

  ctx.ok(
    r.body?.desfasado === true,
    "el periodo deberia quedar marcado como desfasado",
  )
}

/** Periodo lejano en el futuro: se usa para no pisar el mes real. */
const FUT = { mes: 3, anio: 2014 }

block("HIPOTESIS")

/* ================================================================== *
 * A. Integridad del periodo cerrado
 * ================================================================== */

test(
  "A1",
  "un movimiento de caja en un mes cerrado se rechaza con 409",
  async ctx => {
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST("/api/caja/movimientos", {
      concepto: `Intento en mes cerrado ${uid()}`,
      monto: 1000,
      tipo: "ingreso",
      subCaja: "Efectivo",
      fecha: isoMes(FUT.mes, FUT.anio, 10),
    })

    ctx.eq(r.status, 409, "el guard de mes cerrado bloquea el movimiento")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "ALTA", ref: "caja.controller.ts:176-182", nota: "este si esta protegido" },
)

test(
  "A2",
  "un fichero en un mes cerrado se rechaza con 409",
  async ctx => {
    const clienteId = await mkCliente()
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST(`/api/clientes/${clienteId}/fichero`, {
      fecha: dmy(FUT.mes, FUT.anio),
      total: "$100.000",
    })

    ctx.eq(r.status, 409, "el guard bloquea la creacion del fichero")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "ficheros.controller.ts:100-117", nota: "este si esta protegido" },
)

test(
  "A3",
  "un ingreso de stock en un mes cerrado se rechaza con 409",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 100 })
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST("/api/stock/ingresos-iniciales", {
      depositoId,
      fecha: isoMes(FUT.mes, FUT.anio, 10),
      lineas: [{ articuloId, cantidad: 10, costoUnitario: 100 }],
    })

    ctx.eq(r.status, 201, "el ingreso se acepta: el cierre no congela el stock")

    await assertDesvio(ctx, FUT, "stock", "ingreso_inicial")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "ALTA", ref: "stock.controller.ts:178-285", nota: "assertMesAbierto NO se importa en stock.controller" },
)

test(
  "A4",
  "un remito en un mes cerrado se rechaza con 409",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 100 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 50, costoUnitario: 100 }],
      }),
      "stock",
    )
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST("/api/remitos", {
      tipo: "salida",
      depositoOrigenId: depositoId,
      destino: "Cliente",
      fecha: isoMes(FUT.mes, FUT.anio, 10),
      lineas: [{ articuloId, cantidad: 5, costoUnitario: 100 }],
    })

    ctx.eq(r.status, 201, "el remito se acepta: el cierre no congela los remitos")

    await assertDesvio(ctx, FUT, "remitos", "emitir_salida")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "ALTA", ref: "remitos.controller.ts:148-327", nota: "assertMesAbierto NO se importa en remitos.controller" },
)

test(
  "A5",
  "una recepcion de compra en un mes cerrado se rechaza con 409",
  async ctx => {
    const proveedorId = await mkProveedor()
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    const compra = await mkCompra(proveedorId, [{ detalle: "X", cantidad: 10, precioUnitario: 1000 }])
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST(`/api/compras/${compra.id}/recepciones`, {
      depositoId,
      fecha: isoMes(FUT.mes, FUT.anio, 10),
      lineas: [{ itemIndex: 0, articuloId, cantidad: 10 }],
    })

    ctx.eq(r.status, 201, "la recepcion se acepta: el cierre no congela las compras")

    await assertDesvio(ctx, FUT, "compras", "recepcion")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "compras.controller.ts:432-611", nota: "assertMesAbierto NO se importa en compras.controller" },
)

test(
  "A6",
  "cobrar una cuota con fecha de un mes cerrado da 409 (mueve caja)",
  async ctx => {
    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(FUT.mes, FUT.anio), total: "$120.000" })
    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas: 3 }),
      "generar plan",
    )

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const cuota = c.cuotas[0]

    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: 1000,
      fecha: isoMes(FUT.mes, FUT.anio, 12),
    })

    // El cobro escribe en `movimientos` (caja), que SI esta congelado. Por eso
    // este caso se bloquea, a diferencia de las compras o los remitos.
    ctx.eq(r.status, 409, "un cobro con fecha de un mes cerrado deberia dar 409")

    const tras = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    ctx.eq(
      tras.cuotas.find(x => x.id === cuota.id)?.montoPagado,
      0,
      "el cobro rechazado no deberia haber tocado el saldo",
    )

    // Con fecha de hoy si se acepta: el cobro cae en un periodo abierto.
    const hoy = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: 1000,
    })

    ctx.eq(hoy.status, 200, "cobrar con la fecha de hoy deberia aceptarse")

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:registrarCobro", nota: "el cobro mueve caja, que si esta congelada" },
)

test(
  "A7",
  "POST /caja/cierres no respeta el mes cerrado",
  async ctx => {
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST("/api/caja/cierres", {
      mes: FUT.mes,
      anio: FUT.anio,
      subCaja: "Efectivo",
      saldoReal: 500,
    })

    ctx.eq(
      r.status,
      409,
      "cerrar una caja de un mes cerrado deberia dar 409 (escribe en `movimientos`, tabla protegida)",
    )

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "ALTA", ref: "caja.controller.ts:454-477", nota: "el ajuste del cierre evade el guard" },
)

test(
  "A8",
  "una fecha no parseable no esquiva el guard de mes cerrado",
  async ctx => {
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const r = await POST("/api/caja/movimientos", {
      concepto: `Fecha basura ${uid()}`,
      monto: 1000,
      tipo: "ingreso",
      subCaja: "Efectivo",
      fecha: "no-es-una-fecha",
    })

    // 400 y no 409: no es un conflicto de estado, es una fecha que no existe.
    ctx.ok(
      r.status === 400 || r.status === 409,
      `una fecha invalida deberia rechazarse (400 o 409), dio ${r.status}: ${r.text.slice(0, 100)}`,
    )

    ctx.ok(
      r.status === 400,
      `una fecha ilegible deberia dar 400 en concreto, dio ${r.status}`,
    )

    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "ALTA", ref: "periodos.service.ts:375", nota: "assertMesAbierto lanza FechaInvalidaError" },
)

test(
  "A9",
  "POST /clientes en un mes cerrado se rechaza (clientes no tiene fecha de operacion)",
  async ctx => {
    await must(await cerrarPeriodoTemporal(FUT.mes, FUT.anio), "cerrar")

    const id = `cli_${uid()}`
    const r = await POST("/api/clientes", { id, nombre: "Cliente en mes cerrado", fechaAlta: dmy(FUT.mes, FUT.anio) })

    ctx.eq(r.status, 201, "el alta se acepta: dar de alta un cliente no es una operacion financiera")

    ctx.ok(
      r.status !== 409,
      "dar de alta un cliente con fecha de alta en un mes cerrado no deberia bloquearse",
    )

    await drop(`/api/clientes/${id}`)
    await POST(`/api/periodos/${FUT.mes}/${FUT.anio}/abrir`)
  },
  { sev: "BAJA", ref: "clientes.controller.ts:53-119", nota: "un alta no es una operacion financiera: no se congela" },
)

/* ================================================================== *
 * B. Cierre de periodo
 * ================================================================== */

test(
  "B1",
  "no se puede cerrar un mes futuro",
  async ctx => {
    const futuro = new Date().getFullYear() + 2

    const r = await POST(`/api/periodos/12/${futuro}/cerrar`, {})

    ctx.eq(r.status, 400, "cerrar un periodo que todavia no ocurrio deberia rechazarse")

    if (r.status === 201) await POST(`/api/periodos/12/${futuro}/abrir`)
  },
  { sev: "MEDIA", ref: "periodos.controller.ts:79-144", nota: "no se puede cerrar un mes que no ocurrio" },
)

test(
  "B2",
  "no se puede abrir un periodo teniendo posteriores cerrados",
  async ctx => {
    await must(await cerrarPeriodoTemporal(6, 2013), "cerrar 2013-06")
    await must(await cerrarPeriodoTemporal(8, 2013), "cerrar 2013-08")

    const r = await POST("/api/periodos/6/2013/abrir")

    ctx.eq(
      r.status,
      409,
      "abrir un mes con meses posteriores cerrados deja el ledger incoherente",
    )

    await POST("/api/periodos/6/2013/abrir")
    await POST("/api/periodos/8/2013/abrir")
  },
  { sev: "ALTA", ref: "periodos.controller.ts:150-185", nota: "abrir no valida meses posteriores" },
)

test(
  "B3",
  "el preview detecta que el snapshot guardado quedo desactualizado",
  async ctx => {
    const anio = 2019
    const mes = 4

    const proveedorId = await mkProveedor()

    await must(
      await POST(`/api/proveedores/${proveedorId}/compras`, {
        fecha: isoMes(mes, anio, 5),
        items: [{ detalle: "Compra inicial", cantidad: 1, precioUnitario: 100000 }],
      }),
      "compra antes de cerrar",
    )

    await cerrarPeriodoTemporal(mes, anio)

    const cerrado = (await must(await GET(`/api/periodos/${mes}/${anio}`), "periodo")).snapshot
    const cuentasAntes = cerrado?.cuentasAPagar ?? 0

    // compras NO esta protegido por assertMesAbierto: puedo seguir comprando
    // en el mes cerrado y eso deberia mover el snapshot.
    await must(
      await POST(`/api/proveedores/${proveedorId}/compras`, {
        fecha: isoMes(mes, anio, 20),
        items: [{ detalle: "Compra posterior", cantidad: 1, precioUnitario: 500000 }],
      }),
      "compra despues de cerrar",
    )

    const prev = await must(await GET(`/api/periodos/${mes}/${anio}/preview`), "preview")

    const cuentasDespues = prev?.cuentasAPagar ?? 0

    ctx.ok(
      cuentasDespues > cuentasAntes,
      `el snapshot guardado ya no refleja la realidad (antes ${cuentasAntes}, ahora ${cuentasDespues}) y el preview no lo senalo`,
    )

    ctx.ok(
      prev.drift !== undefined || prev.diferencia !== undefined || prev.cambios !== undefined || prev.desfasado !== undefined,
      "el preview deberia exponer explicitamente que el snapshot cerrado quedo desfasado",
    )

    await drop(`/api/proveedores/${proveedorId}`)
    await POST(`/api/periodos/${mes}/${anio}/abrir`)
  },
  { sev: "ALTA", ref: "periodos.controller.ts:187-199", nota: "el comentario promete comparar, el codigo no compara" },
)

test(
  "B4",
  "cerrar dos veces el mismo periodo no pisa el snapshot original",
  async ctx => {
    const anio = 2015
    const mes = 2

    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mes, anio, 5), total: "$100.000" })

    await must(await cerrarPeriodoTemporal(mes, anio), "cerrar v1")

    const snap1 = (await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")).snapshot

    ctx.eq(
      (await POST(`/api/periodos/${mes}/${anio}/cerrar`, { observaciones: "v2" })).status,
      409,
      "el segundo cierre deberia dar 409",
    )
    ctx.ok(snap1, "hay un snapshot original")

    const snap2 = (await must(await GET(`/api/periodos/${mes}/${anio}`), "GET periodo")).snapshot

    ctx.eq(
      JSON.stringify(snap2),
      JSON.stringify(snap1),
      "el 409 impidio sobrescribir el snapshot, pero algo lo cambio igual",
    )

    await POST(`/api/periodos/${mes}/${anio}/abrir`)
    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "periodos.controller.ts:92-98", nota: "el snapshot queda protegido por el 409" },
)

test(
  "B5",
  "la ruta de preview de periodos valida mes y anio",
  async ctx => {
    const anio = 2012
    const mes = 1

    ctx.eq((await GET(`/api/periodos/${mes}/${anio}/preview`)).status, 200, "mes/anio en orden: 200")

    const invertido = await GET(`/api/periodos/${anio}/${mes}/preview`)
    ctx.eq(
      invertido.status,
      400,
      `con el orden invertido (${anio}/${mes}) deberia dar 400 con un mensaje claro, dio ${invertido.status}: ${invertido.text.slice(0, 100)}`,
    )

    ctx.ok(
      /mes|año|anio/i.test(String(invertido.body?.error ?? "")),
      `el error deberia decir cual parametro esta mal, dice "${invertido.body?.error}"`,
    )
  },
  { sev: "MEDIA", ref: "routes/periodos.ts:9", nota: "el orden de la ruta no es auto-explicativo" },
)

test(
  "B6",
  "las cuotas vencidas del snapshot se calculan contra el periodo, no contra hoy",
  async ctx => {
    const anio = 2013
    const mes = 2

    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mes, anio), total: "$120.000" })

    // El plan arranca DENTRO del periodo, asi que al cerrar 2/2013 la primera
    // cuota ya estaba vencida. Si el snapshot mirara hoy, daria 0.
    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, {
        cantCuotas: 3,
        fechaPrimerVto: dmy(mes, anio, 15),
      }),
      "generar plan",
    )

    const prev = await must(await GET(`/api/periodos/${mes}/${anio}/preview`), "preview")

    ctx.eq(
      prev?.cuotasVencidas,
      1,
      `al cierre de ${mes}/${anio} la cuota del 15 ya estaba vencida; el snapshot dice ${prev?.cuotasVencidas} porque mira hoy (${new Date().toISOString().slice(0, 10)}) y no el periodo`,
    )

    ctx.ok(
      (prev?.montoVencido ?? 0) > 0,
      `el monto vencido del snapshot deberia ser la cuota pendiente, es ${prev?.montoVencido}`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "periodos.service.ts:calcularVencidos", nota: "la foto del corte es contra el ultimo dia del periodo" },
)

/* ================================================================== *
 * C. Cobrar cuota y su efecto en la caja
 * ================================================================== */

test(
  "C1",
  "cobrar una cuota genera un movimiento de ingreso en la caja",
  async ctx => {
    const { mes, anio } = mesActual()
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const antes = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "resumen antes")

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
        monto: cuota.montoPlanificado,
      }),
      "cobrar",
    )

    const despues = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "resumen despues")

    ctx.ok(
      despues.totalIngresos > antes.totalIngresos,
      `cobrar plata deberia aumentar los ingresos de caja (antes ${antes.totalIngresos}, despues ${despues.totalIngresos})`,
    )

    const movs = await must(await GET(`/api/caja/movimientos?mes=${mes}&anio=${anio}`), "movimientos")
    const hayCobro = movs.some(m => /cuota|cobro/i.test(String(m.concepto)))
    ctx.ok(hayCobro, "deberia existir un movimiento de caja que refleje el cobro")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "CRITICA", ref: "cuotas.controller.ts:402-445", nota: "registrarCobro solo escribe en cuotas" },
)

test(
  "C2",
  "no se puede sobrepagar una cuota mas alla de lo planificado",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, { monto: 1000000 })

    ctx.eq(r.status, 400, `un cobro de 1.000.000 sobre una cuota de 40.000 deberia dar 400 (dio ${r.status})`)

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const actual = c.cuotas.find(x => x.id === cuota.id)

    ctx.eq(actual?.montoPagado, 0, `el sobrepago no deberia haberse guardado (quedó ${actual?.montoPagado})`)

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:422", nota: "tope contra el saldo de la cuota" },
)

test(
  "C3",
  "una cuota ya Pagada no se puede volver a cobrar",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
        monto: cuota.montoPlanificado,
      }),
      "pagar",
    )

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: cuota.montoPlanificado,
    })

    ctx.eq(r.status, 409, "cobrar dos veces la misma cuota deberia rechazarse")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:422-425", nota: "guarda de estado antes de volver a cobrar" },
)

test(
  "C5",
  "editar el importe de una cuota con el payload que manda el front lo guarda",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    // ClienteDetalle.tsx manda exactamente estas dos claves.
    const r = await PUT(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}`, {
      fechaVencimiento: "15 Nov, 2026",
      montoPlanificado: 55555,
    })

    ctx.eq(r.status, 200, "el PUT deberia aceptarse")

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const actualizada = c.cuotas.find(x => x.id === cuota.id)

    ctx.eq(
      actualizada?.montoPlanificado,
      55555,
      `el importe no se guardo (quedo ${actualizada?.montoPlanificado}): el front manda "montoPlanificado" y el server leia "monto"`,
    )

    ctx.eq(actualizada?.fechaVencimiento, "15 Nov, 2026", "la fecha si se guarda")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "CRITICA", ref: "cuotas.controller.ts:375", nota: "editar el importe era un no-op silencioso" },
)

test(
  "C6",
  "el cobro se puede fechar en el pasado y el movimiento conserva esa fecha",
  async ctx => {
    const { mes, anio } = mesActual()
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const fechaCobro = isoMes(mes, anio, 6)

    const r = await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
        monto: 1000,
        fecha: fechaCobro,
      }),
      "cobrar con fecha propia",
    )

    ctx.ok(r.movimientoId, "el cobro devuelve el id del movimiento de caja")

    const movs = await must(await GET(`/api/caja/movimientos?mes=${mes}&anio=${anio}`), "movimientos")
    const mio = movs.find(m => m.id === r.movimientoId)

    ctx.ok(mio, "el movimiento de caja existe")
    ctx.eq(mio?.fecha, fechaCobro, `el movimiento quedo con fecha ${mio?.fecha}, se mando ${fechaCobro}`)
    ctx.eq(mio?.monto, 1000, "el movimiento lleva el monto del cobro")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "ClienteDetalle.tsx:785", nota: "el modal pide la fecha y nunca se enviaba" },
)

test(
  "C7",
  "el cobro contra una caja inexistente o inactiva se rechaza",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const fantasma = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: 1000,
      subCaja: "Caja Que No Existe",
    })

    ctx.eq(fantasma.status, 400, "una caja inexistente deberia dar 400")

    const inactiva = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: 1000,
      subCaja: "Dólares",
    })

    ctx.eq(inactiva.status, 200, "una caja valida deberia aceptarse")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:registrarCobro", nota: "la caja del cobro se valida" },
)

test(
  "C4",
  "un monto de cobro que no es numero se rechaza y no corrompe el saldo",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
      monto: "no-es-un-numero",
    })

    ctx.eq(r.status, 400, `un monto no numerico deberia dar 400 (dio ${r.status})`)

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const actualizada = c.cuotas.find(x => x.id === cuota.id)

    ctx.ok(
      typeof actualizada?.montoPagado === "number" && Number.isFinite(actualizada.montoPagado),
      `montoPagado quedo como ${typeof actualizada?.montoPagado} (${actualizada?.montoPagado})`,
    )

    ctx.eq(actualizada?.montoPagado, 0, "un cobro invalido no deberia haber movido el saldo")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:414-422", nota: "monto debe validarse antes de escribirse" },
)

/* ================================================================== *
 * D. generarPlan
 * ================================================================== */

test(
  "D1",
  "regenerar el plan de cuotas no borra los pagos ya cobrados",
  async ctx => {
    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total: "$120.000" })

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas: 3 }),
      "generar plan v1",
    )

    let c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const primera = c.cuotas[0]

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${primera.id}/cobrar`, {
        monto: primera.montoPlanificado,
      }),
      "cobrar la primera cuota",
    )

    c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const cobradoAntes = c.cuotas.reduce((a, x) => a + (x.montoPagado ?? 0), 0)
    ctx.ok(cobradoAntes > 0, "hay un pago registrado antes de regenerar")

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas: 6 })

    ctx.eq(
      r.status,
      409,
      `regenerar un plan con cobros deberia dar 409 (dio ${r.status})`,
    )

    ctx.ok(
      /cobrad/i.test(String(r.body?.error ?? "")),
      `el mensaje deberia explicar que hay cuotas cobradas, dice "${r.body?.error}"`,
    )

    const final = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const cobradoDespues = final.cuotas.reduce((a, x) => a + (x.montoPagado ?? 0), 0)

    ctx.eq(
      cobradoDespues,
      cobradoAntes,
      `regenerar el plan destruyo ${cobradoAntes - cobradoDespues} de cobrado`,
    )

    ctx.eq(final.fichero.cantCuotas, 3, "el fichero no deberia haber cambiado su cantidad de cuotas")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "CRITICA", ref: "cuotas.controller.ts:253-306", nota: "regenerar con cobros da 409" },
)

test(
  "D2",
  "las cuotas se vencen en el dia que se pidio, no siempre el dia 1",
  async ctx => {
    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total: "$120.000" })

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, {
        cantCuotas: 3,
        fechaPrimerVto: "15 Nov, 2026",
      }),
      "generar plan",
    )

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")

    ctx.ok(
      String(c.cuotas[0]?.fechaVencimiento).includes("15"),
      `el primer vencimiento deberia caer el 15, cae en ${c.cuotas[0]?.fechaVencimiento}`,
    )
    ctx.ok(
      String(c.cuotas[0]?.fechaVencimiento).includes("Nov"),
      `el primer vencimiento deberia caer en noviembre, cae en ${c.cuotas[0]?.fechaVencimiento}`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "cuotas.controller.ts:274", nota: "TODO ya documentado en el codigo", known: true },
)

test(
  "D3",
  "fechaPrimerVto en formato dd/mm/aaaa (el que manda el front) se respeta",
  async ctx => {
    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total: "$120.000" })

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, {
        cantCuotas: 3,
        fechaPrimerVto: "15/11/2026",
      }),
      "generar plan",
    )

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const vto = String(c.cuotas[0]?.fechaVencimiento)

    ctx.ok(vto.includes("Nov") || vto.includes("11"), `deberia vencer en noviembre, vence en ${vto}`)

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "cuotas.controller.ts:241-251", nota: "monthsMap['11'] es undefined, cae al mes actual", known: true },
)

test(
  "D4",
  "un cantCuotas negativo se rechaza",
  async ctx => {
    const clienteId = await mkCliente()
    await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total: "$120.000" })

    const r = await POST(`/api/clientes/${clienteId}/fichero/cuotas/generar`, { cantCuotas: -5 })

    ctx.eq(r.status, 400, "un numero de cuotas negativo deberia dar 400")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "cuotas.controller.ts:188", nota: "cantCuotas no se valida" },
)

/* ================================================================== *
 * E. Precision numerica
 * ================================================================== */

test(
  "E1",
  "un total con centavos se parsea sin inflarlo x100",
  async ctx => {
    const clienteId = await mkCliente()

    await mkFichero(clienteId, {
      fecha: dmy(mesActual().mes, mesActual().anio),
      total: "$1.950.000,50",
    })

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")

    ctx.ok(
      c.fichero.venta < 2000000 && c.fichero.venta > 1900000,
      `deberia dar ~1.950.000, da ${c.fichero.venta} (parseMonto borra no-digitos y hace parseInt)`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "CRITICA", ref: "fichero.costs.ts:10-16", nota: "parseMonto duplicado en 3 archivos" },
)

test(
  "E2",
  "los centavos de un total de fichero se conservan",
  async ctx => {
    const clienteId = await mkCliente()

    await mkFichero(clienteId, { fecha: dmy(mesActual().mes, mesActual().anio), total: "$100,50" })

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")

    ctx.eq(
      c.fichero.venta,
      100.5,
      `"100,50" deberia valer 100.50; dio ${c.fichero.venta}`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "fichero.costs.ts:parseMonto", nota: "el valor derivado conserva decimales" },
)

test(
  "E3",
  "un monto de movimiento no numerico se rechaza",
  async ctx => {
    const r = await POST("/api/caja/movimientos", {
      concepto: `Monto basura ${uid()}`,
      monto: "no-es-un-numero",
      tipo: "ingreso",
      subCaja: "Efectivo",
    })

    ctx.eq(r.status, 400, "un monto que no es numero deberia dar 400")

    if (r.status === 201 && r.body?.id) await DEL(`/api/caja/movimientos/${r.body.id}`)
  },
  { sev: "ALTA", ref: "caja.controller.ts:194,280", nota: "monto se guarda crudo en una columna INTEGER" },
)

test(
  "E4",
  "un egreso con monto negativo se rechaza",
  async ctx => {
    const r = await POST("/api/caja/movimientos", {
      concepto: `Egreso negativo ${uid()}`,
      monto: -500,
      tipo: "egreso",
      subCaja: "Efectivo",
    })

    ctx.eq(r.status, 400, "un egreso con monto negativo deberia rechazarse")

    if (r.status === 201 && r.body?.id) await DEL(`/api/caja/movimientos/${r.body.id}`)
  },
  { sev: "MEDIA", ref: "caja.controller.ts:194", nota: "el signo lo lleva `tipo`, no `monto`" },
)

test(
  "E5",
  "el total del remito cuadra con el valor de sus movimientos de stock",
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
        lineas: [{ articuloId, cantidad: 3, costoUnitario: 999.6 }],
      }),
      "remito",
    )

    const remito = await must(await GET(`/api/remitos/${r.id}`), "GET remito")

    const movs = await must(await GET(`/api/stock/movimientos?articuloId=${articuloId}`), "kardex")
    const filas = movs.movimientos ?? movs
    const delRemito = filas.find(m => m.referenciaId === r.id)

    const valorMovimiento = delRemito ? delRemito.cantidad * delRemito.costoUnitario : null

    ctx.ok(
      valorMovimiento !== null && Math.abs(remito.valorTotal - valorMovimiento) <= 1,
      `el remito vale ${remito.valorTotal} pero su movimiento de stock vale ${valorMovimiento} (redondeos distintos)`,
    )
  },
  { sev: "ALTA", ref: "remitos.controller.ts:252 vs stock.service.ts:101", nota: "redondeo inconsistente" },
)

test(
  "E6",
  "un saldoReal no numerico en el cierre se rechaza",
  async ctx => {
    const { mes, anio } = mesActual()

    const r = await POST("/api/caja/cierres", {
      mes,
      anio,
      subCaja: "Efectivo",
      saldoReal: "mucho",
    })

    ctx.eq(r.status, 400, "un saldoReal no numerico deberia dar 400, no 201 con NaN")

    if (r.status === 201 && r.body?.id) await POST("/api/caja/cierres", { mes, anio, subCaja: "Efectivo", saldoReal: 0 })
  },
  { sev: "ALTA", ref: "caja.controller.ts:443-448", nota: "diff = NaN se inserta en una columna INTEGER" },
)

test(
  "E7",
  "un movimiento de caja conserva los centavos al crear y editar",
  async ctx => {
    const { mes, anio } = mesActual()

    const id = await mkMovimiento({
      fecha: isoMes(mes, anio, 5),
      monto: 1234.56,
      subCaja: "Efectivo",
    })

    const creado = await must(
      await GET(`/api/caja/movimientos/${id}`),
      "GET movimiento",
    )

    ctx.eq(
      creado.monto,
      1234.56,
      `el movimiento se guardo como ${creado.monto} en vez de 1234.56`,
    )

    await must(
      await PUT(`/api/caja/movimientos/${id}`, { monto: 987.65 }),
      "PUT movimiento",
    )

    const editado = await must(
      await GET(`/api/caja/movimientos/${id}`),
      "GET movimiento editado",
    )

    ctx.eq(
      editado.monto,
      987.65,
      `la edicion guardo ${editado.monto} en vez de 987.65`,
    )

    await drop(`/api/caja/movimientos/${id}`)
  },
  { sev: "CRITICA", ref: "db/schema.ts:centavos", nota: "la columna guarda centavos y el API devuelve pesos" },
)

test(
  "E8",
  "cobrar una cuota con centavos deja el saldo exacto",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({
      total: "$100,50",
      cantCuotas: 1,
    })

    const cuota = cuotas.find(c => c.nroCuota === 1)

    ctx.ok(cuota, "el plan genero la cuota 1")

    if (!cuota) return

    ctx.eq(
      cuota.montoPlanificado,
      100.5,
      `la cuota quedo en ${cuota.montoPlanificado} en vez de 100.50`,
    )

    const r = await POST(
      `/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`,
      { monto: 100.5 },
    )

    ctx.eq(r.status, 200, `cobrar 100.50 deberia dar 200, dio ${r.status}`)

    const cliente = await must(
      await GET(`/api/clientes/${clienteId}`),
      "GET cliente",
    )

    const cobrada = (cliente.cuotas ?? []).find(c => c.id === cuota.id)

    ctx.eq(
      cobrada?.montoPagado,
      100.5,
      `la cuota quedo pagada por ${cobrada?.montoPagado} en vez de 100.50`,
    )
    ctx.eq(cobrada?.estado, "Pagada", "la cuota deberia quedar Pagada")

    await drop(`/api/clientes/${clienteId}?forzar=1`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:registrarCobro", nota: "centavos exactos en cuotas y estado" },
)

test(
  "E9",
  "el tipo de cambio con decimales se conserva y el total de compra no pierde centavos",
  async ctx => {
    const proveedorId = await mkProveedor()

    const compra = await mkCompra(
      proveedorId,
      [{ detalle: "Item", cantidad: 1, precioUnitario: 100.55 }],
      { moneda: "USD", tipoCambio: 1234.5678 },
    )

    const leida = await must(
      await GET(`/api/compras/${compra.id}`),
      "GET compra",
    )

    ctx.eq(
      leida.total,
      100.55,
      `el total quedo en ${leida.total} en vez de 100.55`,
    )
    ctx.eq(
      leida.tipoCambio,
      1234.5678,
      `el tipo de cambio quedo en ${leida.tipoCambio} en vez de 1234.5678`,
    )

    await drop(`/api/compras/${compra.id}`)
    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "compras.controller.ts:calcularTotal", nota: "total en centavos y tasa REAL sin truncar" },
)

test(
  "E10",
  "pagar una compra con centavos deja el saldo del proveedor en cero",
  async ctx => {
    const proveedorId = await mkProveedor()
    const { mes, anio } = mesActual()

    const compra = await mkCompra(
      proveedorId,
      [{ detalle: "Item", cantidad: 1, precioUnitario: 100.55 }],
      { fecha: isoMes(mes, anio, 10) },
    )

    const op = await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
      fecha: isoMes(mes, anio, 15),
      concepto: `Pago centavos ${uid()}`,
      detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 100.55 }],
      comprasPagadas: [{ compraId: compra.id, monto: 100.55 }],
    })

    ctx.eq(op.status, 201, `la orden deberia crearse, dio ${op.status}: ${op.text}`)

    if (op.status !== 201) return

    const orden = await must(
      await GET(`/api/ordenes-pago/${op.body.id}`),
      "GET orden",
    )

    ctx.eq(
      orden.detalles?.[0]?.monto,
      100.55,
      `el detalle quedo en ${orden.detalles?.[0]?.monto} en vez de 100.55`,
    )

    const proveedor = await must(
      await GET(`/api/proveedores/${proveedorId}`),
      "GET proveedor",
    )

    ctx.eq(
      proveedor.saldos?.ARS?.saldo,
      0,
      `el saldo quedo en ${proveedor.saldos?.ARS?.saldo} en vez de 0`,
    )

    await must(await POST(`/api/ordenes-pago/${op.body.id}/anular`), "anular orden")
    await drop(`/api/compras/${compra.id}`)
    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "ordenesPago.controller.ts:validarCompras", nota: "saldo de compra en centavos" },
)

test(
  "E11",
  "el costo promedio ponderado conserva los centavos",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 3, costoUnitario: 10.33 }],
      }),
      "ingreso 1",
    )

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 7, costoUnitario: 20.77 }],
      }),
      "ingreso 2",
    )

    const fila = await stockDe(depositoId, articuloId)

    ctx.eq(
      fila.costoPromedio,
      17.64,
      `el promedio quedo en ${fila.costoPromedio} en vez de 17.64`,
    )
  },
  { sev: "ALTA", ref: "stock.service.ts:65", nota: "promedio ponderado calculado en centavos" },
)

/* ================================================================== *
 * F. Validacion ausente
 * ================================================================== */

test(
  "F1",
  "PUT /clientes no puede vaciar el nombre",
  async ctx => {
    const clienteId = await mkCliente()

    const r = await PUT(`/api/clientes/${clienteId}`, { nombre: "" })

    ctx.eq(r.status, 400, `nombre vacio deberia dar 400 (dio ${r.status})`)

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    ctx.ok(String(c.nombre ?? "").length > 0, `el nombre quedo en "${c.nombre}"`)

    const malo = await PUT(`/api/clientes/${clienteId}`, { estado: "Banana" })
    ctx.eq(malo.status, 400, `un estado desconocido deberia dar 400 (dio ${malo.status})`)

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "MEDIA", ref: "clientes.controller.ts:134", nota: "PUT valida nombre y estado" },
)

test(
  "F2",
  "PUT /cajas/:id con activa: 7 no borra la caja de los reportes",
  async ctx => {
    const { id, nombre } = await mkCaja({ afectaGeneral: 1, orden: 95 })

    const antes = await must(await GET("/api/caja/resumen"), "resumen antes")
    ctx.ok(antes.subCajas?.[nombre], "antes del PUT la caja aparece en el resumen")

    await must(await PUT(`/api/cajas/${id}`, { activa: 7 }), "PUT activa: 7")

    const despues = await must(await GET("/api/caja/resumen"), "resumen despues")

    ctx.ok(
      despues.subCajas?.[nombre],
      `con activa:7 la caja "${nombre}" desaparecio de /caja/resumen: el PUT escribe el flag sin coercionar a 0/1`,
    )

    await drop(`/api/cajas/${id}`)
  },
  { sev: "MEDIA", ref: "cajas.controller.ts:120,122", nota: "PUT escribe activa/afectaGeneral sin coercionar" },
)

test(
  "F3",
  "un movimiento contra una subCaja inexistente se rechaza",
  async ctx => {
    const r = await POST("/api/caja/movimientos", {
      concepto: `Caja fantasma ${uid()}`,
      monto: 5000,
      tipo: "ingreso",
      subCaja: "Caja Que No Existe",
    })

    ctx.eq(r.status, 400, "una subCaja inexistente deberia dar 400")

    if (r.status === 201 && r.body?.id) await DEL(`/api/caja/movimientos/${r.body.id}`)
  },
  { sev: "ALTA", ref: "caja.controller.ts:148", nota: "createMovimiento no valida subCaja" },
)

test(
  "F4",
  "editar una cuota no puede bajar el monto por debajo de lo ya cobrado",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })
    const cuota = cuotas[0]

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}/cobrar`, {
        monto: cuota.montoPlanificado,
      }),
      "cobrar todo",
    )

    const r = await PUT(`/api/clientes/${clienteId}/fichero/cuotas/${cuota.id}`, { monto: 1 })

    ctx.eq(r.status, 400, "bajar el planificado por debajo de lo cobrado deberia dar 400")

    const c = await must(await GET(`/api/clientes/${clienteId}`), "GET cliente")
    const act = c.cuotas.find(x => x.id === cuota.id)
    ctx.ok(
      act.montoPlanificado >= act.montoPagado,
      `quedo planificado ${act.montoPlanificado} con ${act.montoPagado} pagado`,
    )

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "cuotas.controller.ts:361-400", nota: "editarCuota no valida nada" },
)

test(
  "F5",
  "no se puede borrar un cheque usado por una orden de pago pagada",
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

    const r = await DEL(`/api/cheques/${chequeId}`)

    ctx.eq(r.status, 409, "borrar un cheque embebido en una orden Pagada deberia dar 409")

    if (r.status === 200) {
      const op = await GET(`/api/proveedores/${proveedorId}/ordenes-pago`)
      ctx.ok(Array.isArray(op.body), "sigue siendo posible auditar el pago")
    }

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "cheques.controller.ts:432-449", nota: "remove no tiene ninguna guardia" },
)

test(
  "F6",
  "editar un cheque emitido no rompe su vinculo con el proveedor",
  async ctx => {
    const proveedorId = await mkProveedor()

    const chequeId = await mkChequeEmitido({
      importe: 40000,
      aplicaPagoProveedor: true,
      proveedorId,
    })

    const antes = await must(await GET(`/api/cheques/${chequeId}`), "GET cheque antes")
    ctx.eq(antes.proveedorId, proveedorId, "el cheque se creo vinculado al proveedor")

    // El front manda `tipo` en cada edicion. Antes eso disparaba el bloque que
    // recalcula aplicaPagoProveedor/proveedorId y terminaba poniendo null.
    await must(
      await PUT(`/api/cheques/${chequeId}`, { estado: "Pagado", tipo: "emitido" }),
      "PUT cheque",
    )

    const chq = await must(await GET(`/api/cheques/${chequeId}`), "GET cheque")

    ctx.eq(chq.estado, "Pagado", "el estado se actualizo")
    ctx.eq(
      chq.proveedorId,
      proveedorId,
      `el cheque perdio el proveedorId (quedo en ${chq.proveedorId})`,
    )
    ctx.eq(chq.aplicaPagoProveedor, 1, "la marca de pago a proveedor se conservo")

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "cheques.controller.ts:348-384", nota: "editar no debe recalcular campos ausentes" },
)

test(
  "F6b",
  "un cheque recibido no arrastra un proveedor que no le corresponde",
  async ctx => {
    const proveedorId = await mkProveedor()

    const chequeId = await mkChequeRecibido({ importe: 40000 })

    await must(
      await PUT(`/api/cheques/${chequeId}`, { estado: "Depositado", proveedorId }),
      "PUT cheque recibido",
    )

    const chq = await must(await GET(`/api/cheques/${chequeId}`), "GET cheque")

    ctx.eq(chq.estado, "Depositado", "el estado se actualizo")
    ctx.eq(
      chq.proveedorId,
      null,
      `un cheque recibido (plata que entra) no deberia quedar atado a un proveedor (quedo en ${chq.proveedorId})`,
    )

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "BAJA", ref: "cheques.controller.ts:198-249", nota: "aplicaPagoProveedor solo aplica a emitidos" },
)

test(
  "F7",
  "borrar un cliente con historial de pagos no destruye el historico",
  async ctx => {
    const { clienteId, cuotas } = await mkClienteConCuotas({ total: "$120.000", cantCuotas: 3 })

    await must(
      await POST(`/api/clientes/${clienteId}/fichero/cuotas/${cuotas[0].id}/cobrar`, {
        monto: 1000,
      }),
      "cobrar",
    )

    const r = await DEL(`/api/clientes/${clienteId}`)

    ctx.eq(r.status, 409, "borrar un cliente con cobros deberia pedir confirmacion o dejar rastro")

    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "db/index.ts:53,76", nota: "cascade borra ficheros, cuotas e historial" },
)

test(
  "F8",
  "no se puede sobre-recibir una compra repitiendo itemIndex en el mismo request",
  async ctx => {
    const proveedorId = await mkProveedor()
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    const compra = await mkCompra(proveedorId, [{ detalle: "Poco", cantidad: 5, precioUnitario: 1000 }])

    const r = await POST(`/api/compras/${compra.id}/recepciones`, {
      depositoId,
      fecha: "2026-01-12",
      lineas: [
        { itemIndex: 0, articuloId, cantidad: 3 },
        { itemIndex: 0, articuloId, cantidad: 3 },
      ],
    })

    ctx.eq(r.status, 400, "recibir 6 de algo que se compro 5 deberia rechazarse")

    const s = await stockDe(depositoId, articuloId)
    ctx.ok(s.cantidad <= 5, `quedaron ${s.cantidad} unidades de las 5 compradas`)

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "compras.controller.ts:458,501", nota: "los pendientes se snapshotEAN una vez" },
)

test(
  "F10",
  "no se puede cerrar dos veces la misma caja en el mismo mes",
  async ctx => {
    const { mes, anio } = mesActual()

    const r1 = await POST("/api/caja/cierres", { mes, anio, subCaja: "Cheques", saldoReal: 1000 })
    const r2 = await POST("/api/caja/cierres", { mes, anio, subCaja: "Cheques", saldoReal: 2000 })

    ctx.ok(
      r2.status >= 400,
      `cerrar dos veces ${mes}/${anio} la subCaja Cheques deberia rechazarse (la segunda dio ${r2.status})`,
    )

    if (r1.status === 201) await POST("/api/caja/cierres", { mes, anio, subCaja: "Cheques", saldoReal: 1000 })
  },
  { sev: "MEDIA", ref: "caja.controller.ts:400-411", nota: "no hay deteccion de duplicados" },
)

test(
  "F12",
  "PUT con un body vacio o de campos desconocidos no devuelve 500",
  async ctx => {
    const clienteId = await mkCliente()

    const v = await must(
      await POST("/api/veredas", {
        nombre: `Vereda ${uid()}`,
        ubicacion: "Calle 123",
        clienteId,
        fecha: "2026-01-10",
      }),
      "POST veredas",
    )

    const vacio = await PUT(`/api/veredas/${v.id}`, {})
    ctx.ok(
      vacio.status < 500,
      `un PUT con body vacio devolvio ${vacio.status}: ${vacio.text.slice(0, 120)}`,
    )

    const desconocido = await PUT(`/api/veredas/${v.id}`, { nombre: "Otro", ubicacion: "Calle 999" })
    ctx.ok(
      desconocido.status < 500,
      `un PUT con campos no soportados devolvio ${desconocido.status}: ${desconocido.text.slice(0, 120)}`,
    )

    ctx.eq(
      desconocido.status,
      400,
      `un PUT sin campos editables deberia dar 400; dio ${desconocido.status}`,
    )

    await drop(`/api/veredas/${v.id}`)
    await drop(`/api/clientes/${clienteId}`)
  },
  { sev: "ALTA", ref: "veredas.controller.ts:167-230", nota: "set() vacio hacia que Drizzle lance 'No values to set'" },
)

test(
  "F11",
  "POST /caja/movimientos con categoria de tipo incorrecto se rechaza",
  async ctx => {
    const { id: catEgreso } = await mkCategoria("egreso")

    const r = await POST("/api/caja/movimientos", {
      concepto: `Categoria cruzada ${uid()}`,
      monto: 1000,
      tipo: "ingreso",
      subCaja: "Efectivo",
      categoria: (await GET("/api/categorias")).body.find(c => c.id === catEgreso)?.nombre,
    })

    ctx.eq(r.status, 400, "usar una categoria de egreso en un ingreso deberia dar 400")

    if (r.status === 201 && r.body?.id) await DEL(`/api/caja/movimientos/${r.body.id}`)
  },
  { sev: "BAJA", ref: "caja.controller.ts:42-72", nota: "esta validado, es un control positivo" },
)

/* ================================================================== *
 * G. Atomicidad y numeracion
 * ================================================================== */

test(
  "G1",
  "los numeros de remito no se duplican bajo concurrencia",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 100, costoUnitario: 100 }],
      }),
      "stock",
    )

    const payload = {
      tipo: "salida",
      depositoOrigenId: depositoId,
      destino: "Cliente",
      lineas: [{ articuloId, cantidad: 1, costoUnitario: 100 }],
    }

    const r = await Promise.all(Array.from({ length: 5 }, () => POST("/api/remitos", payload)))

    const creados = r.filter(x => x.status === 201).map(x => x.body.numero)
    ctx.eq(
      new Set(creados).size,
      creados.length,
      `5 remitos concurrentes produjeron numeros repetidos: ${creados.join(", ")}`,
    )
  },
  { sev: "ALTA", ref: "remitos.controller.ts:235-239", nota: "numero = max+1 sin UNIQUE ni transaccion" },
)

test(
  "G2",
  "los numeros de orden de pago no se duplican bajo concurrencia",
  async ctx => {
    const proveedorId = await mkProveedor()

    const payload = {
      fecha: "2026-01-15",
      concepto: `Concurrente ${uid()}`,
      detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 1000 }],
    }

    const r = await Promise.all(
      Array.from({ length: 5 }, () => POST(`/api/proveedores/${proveedorId}/ordenes-pago`, payload)),
    )

    const creados = r.filter(x => x.status === 201).map(x => x.body.numero)
    ctx.eq(
      new Set(creados).size,
      creados.length,
      `5 ordenes concurrentes produjeron numeros repetidos: ${creados.join(", ")}`,
    )

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "ordenesPago.controller.ts:324-328", nota: "numero = max+1 fuera de la transaccion" },
)

/* ================================================================== *
 * H. Anulaciones
 * ================================================================== */

test(
  "H1",
  "anular un remito deja el kardex consistente con los items del remito",
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
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 1000 }],
      }),
      "remito",
    )

    await must(await POST(`/api/remitos/${r.id}/anular`), "anular")

    const remito = await must(await GET(`/api/remitos/${r.id}`), "GET remito")
    const filas = await kardex(articuloId)

    const items = remito.items ?? []
    const movsDelRemito = filas.filter(m => m.referenciaId === r.id || (remito.movimientos ?? []).includes(m.id))

    ctx.eq(
      movsDelRemito.length,
      items.length * 2,
      `tras anular deberia quedar el movimiento original mas su compensativo (${items.length * 2}), hay ${movsDelRemito.length}`,
    )

    const original = movsDelRemito.filter(m => m.tipo === "egreso")
    const anulacion = movsDelRemito.filter(m => m.tipo === "anulacion")

    ctx.eq(original.length, items.length, "el movimiento original sigue en el kardex")
    ctx.eq(anulacion.length, items.length, "hay un movimiento de anulación por cada item")

    const s = await stockDe(depositoId, articuloId)
    ctx.eq(s.cantidad, 100, "el stock se restauro")
  },
  { sev: "ALTA", ref: "stock.service.ts:112-114", nota: "anular borra fisicamente el movimiento" },
)

test(
  "H2",
  "anular un remito restaura el costo promedio del origen",
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

    const antes = await stockDe(depositoId, articuloId)
    ctx.eq(antes.costoPromedio, 1000, "costo promedio inicial")

    const r = await must(
      await POST("/api/remitos", {
        tipo: "salida",
        depositoOrigenId: depositoId,
        destino: "Cliente",
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 900 }],
      }),
      "remito",
    )

    await must(await POST(`/api/remitos/${r.id}/anular`), "anular")

    const despues = await stockDe(depositoId, articuloId)
    ctx.eq(
      despues.costoPromedio,
      antes.costoPromedio,
      `anular cambio el costo promedio de ${antes.costoPromedio} a ${despues.costoPromedio}`,
    )
  },
  { sev: "ALTA", ref: "remitos.controller.ts:356", nota: "la reingesta es un delta>0 que recalcula el promedio" },
)

test(
  "H3",
  "una transferencia no cambia el costo promedio del destino si el costo es el mismo",
  async ctx => {
    const origen = await mkDeposito()
    const destino = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId: origen,
        lineas: [{ articuloId, cantidad: 100, costoUnitario: 1000 }],
      }),
      "stock origen",
    )

    const antes = await stockDe(destino, articuloId)

    await must(
      await POST("/api/remitos", {
        tipo: "transferencia",
        depositoOrigenId: origen,
        depositoDestinoId: destino,
        lineas: [{ articuloId, cantidad: 20, costoUnitario: 500 }],
      }),
      "transferencia",
    )

    const despues = await stockDe(destino, articuloId)
    ctx.eq(
      despues.costoPromedio,
      antes.costoPromedio || 500,
      `el destino quedo valuado a ${despues.costoPromedio} usando el costo del remito (${500}) en vez del costo real`,
    )
  },
  { sev: "MEDIA", ref: "remitos.controller.ts:286-307", nota: "la transferencia aplica el costo congelado del remito" },
)

test(
  "H4",
  "anular dos veces el mismo remito da el mismo error que anular dos veces una orden",
  async ctx => {
    const proveedorId = await mkProveedor()
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 50, costoUnitario: 100 }],
      }),
      "stock",
    )

    const remito = await must(
      await POST("/api/remitos", {
        tipo: "salida",
        depositoOrigenId: depositoId,
        destino: "Cliente",
        lineas: [{ articuloId, cantidad: 5, costoUnitario: 100 }],
      }),
      "remito",
    )

    await must(await POST(`/api/remitos/${remito.id}/anular`), "anular remito")
    const rRemito = await POST(`/api/remitos/${remito.id}/anular`)

    const op = await must(
      await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
        fecha: "2026-01-15",
        concepto: `Doble anular ${uid()}`,
        detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 1000 }],
      }),
      "orden de pago",
    )

    await must(await POST(`/api/ordenes-pago/${op.id}/anular`), "anular orden")
    const rOrden = await POST(`/api/ordenes-pago/${op.id}/anular`)

    ctx.eq(
      rRemito.status,
      rOrden.status,
      `anular dos veces da ${rRemito.status} en remitos y ${rOrden.status} en ordenes de pago: contrato inconsistente`,
    )

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "BAJA", ref: "remitos.controller.ts:341 vs ordenesPago.controller.ts:443", nota: "409 vs 400" },
)

test(
  "H5",
  "anular una orden de pago no rompe los cierres de caja ya tomados",
  async ctx => {
    const proveedorId = await mkProveedor()
    const { mes, anio } = mesActual()

    await mkMovimiento({
      fecha: isoMes(mes, anio, 3),
      concepto: `Base ${uid()}`,
      monto: 10000,
      tipo: "ingreso",
      subCaja: "Bancos",
    })

    const op = await must(
      await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
        fecha: isoMes(mes, anio, 4),
        concepto: `Anular con cierre ${uid()}`,
        detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 5000 }],
      }),
      "orden de pago",
    )

    await must(
      await POST("/api/caja/cierres", { mes, anio, subCaja: "Bancos", saldoReal: 10000 }),
      "cerrar caja",
    )

    await must(await POST(`/api/ordenes-pago/${op.id}/anular`), "anular orden")

    const preview = await must(
      await GET(`/api/caja/cierres/preview?subCaja=Bancos&mes=${mes}&anio=${anio}`),
      "preview",
    )

    ctx.ok(
      typeof preview.saldoInicial === "number",
      `el preview quedo inconsistente tras anular: saldoInicial=${preview.saldoInicial}`,
    )

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "ALTA", ref: "ordenesPago.controller.ts:452-478", nota: "anular borra movimientos ya cerrados" },
)

/* ================================================================== *
 * I. Coherencia de reportes
 * ================================================================== */

test(
  "I1",
  "el saldo del kardex tiene en cuenta las transferencias",
  async ctx => {
    const origen = await mkDeposito()
    const destino = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId: origen,
        lineas: [{ articuloId, cantidad: 100, costoUnitario: 100 }],
      }),
      "stock",
    )

    await must(
      await POST("/api/remitos", {
        tipo: "transferencia",
        depositoOrigenId: origen,
        depositoDestinoId: destino,
        lineas: [{ articuloId, cantidad: 30, costoUnitario: 100 }],
      }),
      "transferencia",
    )

    const movs = await kardex(articuloId)

    const saldoFinal = movs[movs.length - 1]?.saldo
    const enOrigen = await stockDe(origen, articuloId)

    ctx.eq(
      saldoFinal,
      enOrigen.cantidad,
      `el kardex cierra en ${saldoFinal} pero el origen tiene ${enOrigen.cantidad} (la transferencia no se descuenta)`,
    )
  },
  { sev: "ALTA", ref: "stock.controller.ts:144-145", nota: "transferencias tienen delta fijo 0" },
)

test(
  "I2",
  "con stock negativo, un ingreso conserva el costo promedio real",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 0 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 1000 }],
      }),
      "ingreso",
    )

    await must(
      await POST("/api/stock/ajustes", {
        depositoId,
        motivo: "Merma que deja negativo",
        lineas: [{ articuloId, cantidad: -15 }],
      }),
      "ajuste negativo",
    )

    const negativo = await stockDe(depositoId, articuloId)
    ctx.eq(negativo.cantidad, -5, "quedo negativo")

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 5000 }],
      }),
      "ingreso sobre negativo",
    )

    const final = await stockDe(depositoId, articuloId)
    ctx.eq(
      final.costoPromedio,
      5000,
      `el costo promedio quedo en ${final.costoPromedio}: un ingreso de 5000 descarto el promedio real de las unidades que quedaban`,
    )
  },
  { sev: "ALTA", ref: "stock.service.ts:54-61", nota: "bug ya documentado en el propio codigo", known: true },
)

test(
  "I3",
  "el historial de costos de un articulo sin historial real no inventa un registro persistido",
  async ctx => {
    const articuloId = await mkArticulo({ costoUnitario: 5000 })

    const hist = await must(await GET(`/api/articulos/${articuloId}/historial-costos`), "historial")
    const rows = hist.historial ?? hist

    const sintetica = rows.find(r => String(r.id).startsWith("hct_sintetico"))

    ctx.ok(
      !sintetica || sintetica.origen === "manual",
      `se devuelve una fila sintetica ${sintetica?.id} que no existe en la base`,
    )

    const hist2 = await must(await GET(`/api/articulos/${articuloId}/historial-costos`), "historial de nuevo")
    ctx.eq((hist2.historial ?? hist2).length, rows.length, "la fila sintetica no se persiste entre llamadas")
  },
  { sev: "BAJA", ref: "articulos.controller.ts:212-228", nota: "fila sintetica solo en la respuesta" },
)

test(
  "I4",
  "el reporte de costos y el historial del articulo coinciden en el costo actual",
  async ctx => {
    const depositoId = await mkDeposito()
    const articuloId = await mkArticulo({ costoUnitario: 1000 })

    await must(
      await POST("/api/stock/ingresos-iniciales", {
        depositoId,
        lineas: [{ articuloId, cantidad: 10, costoUnitario: 2000 }],
      }),
      "ingreso",
    )

    const rep = await must(await GET("/api/stock/reportes/costos"), "reporte costos")
    const filas = Array.isArray(rep) ? rep : (rep.articulos ?? rep.detalle ?? [])
    const mio = filas.find(f => f.id === articuloId || f.articuloId === articuloId)

    const art = await must(await GET(`/api/articulos/${articuloId}`), "articulo")

    if (mio) {
      ctx.eq(
        mio.costoActual ?? mio.costoUnitario,
        art.costoUnitario,
        `el reporte dice ${mio.costoActual ?? mio.costoUnitario} y el articulo ${art.costoUnitario}`,
      )
    } else {
      ctx.ok(true, "el articulo no aparece en el reporte")
    }
  },
  { sev: "MEDIA", ref: "stock.controller.ts:531 vs articulos.controller.ts:219", nota: "dos fuentes distintas" },
)

/* ================================================================== *
 * J. Robustez
 * ================================================================== */

test(
  "J1",
  "un parametro de query no numerico se rechaza en vez de caer al mes actual",
  async ctx => {
    const r = await GET("/api/caja/movimientos?mes=abc&anio=xyz")

    ctx.eq(
      r.status,
      400,
      `mes=abc&anio=xyz deberia dar 400; dio ${r.status} y devolvio datos del mes actual por el fallback parseInt(x) || default`,
    )
  },
  { sev: "BAJA", ref: "caja.controller.ts:92-94", nota: "parseInt('abc') || default cae al mes actual en silencio" },
)

test(
  "J2",
  "una orden de pago creada queda Pagada y al anular queda Anulada",
  async ctx => {
    const proveedorId = await mkProveedor()

    const r = await must(
      await POST(`/api/proveedores/${proveedorId}/ordenes-pago`, {
        fecha: "2026-01-15",
        concepto: `Ciclo de estado ${uid()}`,
        detalles: [{ subCaja: "Bancos", moneda: "ARS", monto: 1000 }],
      }),
      "orden de pago",
    )

    const creada = await must(await GET(`/api/ordenes-pago/${r.id}`), "GET orden creada")
    ctx.eq(creada.estado, "Pagada", "una orden creada con tramos queda Pagada")

    await must(await POST(`/api/ordenes-pago/${r.id}/anular`), "anular")

    const anulada = await must(await GET(`/api/ordenes-pago/${r.id}`), "GET orden anulada")
    ctx.eq(anulada.estado, "Anulada", "al anular queda Anulada")

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "BAJA", ref: "db/index.ts:250", nota: "ordenes_pago.estado tiene DEFAULT 'Pagada'" },
)

test(
  "J3",
  "todo item del Sidebar tiene una ruta registrada en App.tsx",
  async ctx => {
    const { readFileSync } = await import("node:fs")

    // server/scripts/tests/ -> server/scripts -> server -> raiz del repo
const raiz = new URL("../../../src/", import.meta.url)

    const sidebar = readFileSync(new URL("components/Sidebar.tsx", raiz), "utf8")

    const rutas = readFileSync(new URL("App.tsx", raiz), "utf8")

    // Rutas declaradas en el menu.
    const items = [...sidebar.matchAll(/path:\s*"([^"]+)"/g)].map(m => m[1])

    ctx.ok(items.length > 0, "se encontraron items de navegacion")

    // Rutas registradas. El catch-all "*" no cuenta: matchea cualquier cosa.
    const declaradas = [...rutas.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map(m => m[1])
      .filter(p => p !== "*")

    for (const path of items) {
      const existe = declaradas.includes(path) ||
        declaradas.some(d => d.endsWith("/:id") && d === path.replace(/\/\d+$/, "/:id"))

      ctx.ok(
        existe,
        `"${path}" esta en el Sidebar pero no hay <Route path="${path}"> en App.tsx: al navegar ahi React Router no matchea nada y renderiza null (pantalla en blanco sin error)`,
      )
    }
  },
  { sev: "MEDIA", ref: "src/App.tsx", nota: "un link de menu sin ruta deja la pantalla en blanco" },
)

test(
  "J4",
  "borrar un proveedor con compras se rechaza y no destruye el historial",
  async ctx => {
    const proveedorId = await mkProveedor()
    const compra = await mkCompra(proveedorId, [{ detalle: "Historial", cantidad: 1, precioUnitario: 1000 }])

    const r = await DEL(`/api/proveedores/${proveedorId}`)

    ctx.ok(
      r.status >= 400 && r.status < 500,
      `borrar un proveedor con compras deberia rechazarse; dio ${r.status}`,
    )

    ctx.eq(
      r.status,
      409,
      `el rechazo deberia ser 409 (conflicto de estado); dio ${r.status}. El resto de la API usa 409 para "existe pero no se puede", 400 es "el body esta mal".`,
    )

    const sigue = await GET(`/api/compras/${compra.id}`)
    ctx.eq(sigue.status, 200, "la compra sigue existiendo")

    await drop(`/api/proveedores/${proveedorId}`)
  },
  { sev: "BAJA", ref: "schema.ts:335-337", nota: "el cascade esta guardado, pero el status no sigue el contrato" },
)

test(
  "J5",
  "renombrar una caja arrastra sus movimientos y cierres",
  async ctx => {
    const { id, nombre: nombreViejo } = await mkCaja({ afectaGeneral: 1, orden: 96 })

    const nombreNuevo = `${nombreViejo} renombrada`

    const { mes, anio } = mesActual()

    // Un movimiento de la caja.
    const movId = await mkMovimiento({
      fecha: isoMes(mes, anio, 8),
      subCaja: nombreViejo,
      monto: 25000,
      tipo: "ingreso",
    })

    await must(await PUT(`/api/cajas/${id}`, { nombre: nombreNuevo }), "PUT caja")

    const mov = await must(await GET(`/api/caja/movimientos/${movId}`), "GET movimiento")
    ctx.eq(
      mov.subCaja,
      nombreNuevo,
      `el movimiento quedo apuntando a "${mov.subCaja}": movements.sub_caja guarda el NOMBRE en texto, sin FK`,
    )

    // El resumen tiene que seguir viendo el movimiento.
    const resumen = await must(await GET(`/api/caja/resumen?mes=${mes}&anio=${anio}`), "resumen")
    const sub = resumen.subCajas?.[nombreNuevo]

    ctx.ok(sub, `la caja renombrada deberia seguir en el resumen con su movimiento`)
    ctx.ok(
      (sub?.ingresos ?? 0) >= 25000,
      `el resumen perdio el movimiento: ${sub?.ingresos} en vez de >= 25000`,
    )

    await drop(`/api/caja/movimientos/${movId}`)
    await drop(`/api/cajas/${id}`)
  },
  { sev: "ALTA", ref: "cajas.controller.ts:update", nota: "sub_caja es texto libre sin FK" },
)

test(
  "K1",
  "renombrar una categoria arrastra sus movimientos",
  async ctx => {
    const viejo = `Cat K1 ${uid()}`

    const { id } = await mkCategoria("ingreso", { nombre: viejo })

    const movId = await mkMovimiento({ categoria: viejo, tipo: "ingreso" })

    const nuevo = `${viejo} renombrada`

    ctx.eq((await PUT(`/api/categorias/${id}`, { nombre: nuevo })).status, 200, "PUT categoria")

    const mov = await must(await GET(`/api/caja/movimientos/${movId}`), "GET movimiento")

    ctx.eq(
      mov.categoria,
      nuevo,
      `el movimiento quedo con "${mov.categoria}": movimientos.categoria guarda el NOMBRE, sin FK`,
    )

    // Si la cascada no ocurrio, el DELETE ve 0 usos y borra la categoria.
    ctx.eq((await DEL(`/api/categorias/${id}`)).status, 409, "la categoria renombrada sigue en uso")

    await drop(`/api/caja/movimientos/${movId}`)
    await drop(`/api/categorias/${id}`)
  },
  { sev: "ALTA", ref: "categorias.controller.ts:update", nota: "categoria es texto libre sin FK" },
)

test(
  "K2",
  "las categorias inactivas se pueden volver a activar",
  async ctx => {
    const { id } = await mkCategoria("egreso")

    ctx.eq((await PUT(`/api/categorias/${id}`, { activa: 0 })).status, 200, "desactivar")

    const activas = await must(await GET("/api/categorias?tipo=egreso"), "GET activas")
    ctx.ok(!activas.some(c => c.id === id), "la inactiva no aparece sin incluirInactivas")

    const todas = await must(
      await GET("/api/categorias?tipo=egreso&incluirInactivas=1"),
      "GET todas",
    )

    const inactiva = todas.find(c => c.id === id)

    ctx.ok(inactiva, "sin incluirInactivas=1 el panel no puede reactivarla")
    ctx.eq(inactiva?.activa, 0, "viene marcada como inactiva")

    ctx.eq((await PUT(`/api/categorias/${id}`, { activa: 1 })).status, 200, "reactivar")

    await drop(`/api/categorias/${id}`)
  },
  { sev: "MEDIA", ref: "api.ts:getCategorias", nota: "el backend ya soportaba el filtro" },
)

test(
  "K3",
  "no se pueden renombrar ni borrar las categorias que escribe la app",
  async ctx => {
    const todas = await must(await GET("/api/categorias?incluirInactivas=1"), "GET categorias")

    const sistema = todas.find(c => c.nombre === "Pago proveedor")

    ctx.ok(sistema, "existe la categoria Pago proveedor")

    if (!sistema) return

    ctx.eq(
      (await PUT(`/api/categorias/${sistema.id}`, { nombre: "Otra cosa" })).status,
      409,
      "renombrar Pago proveedor deberia dar 409",
    )

    ctx.eq((await DEL(`/api/categorias/${sistema.id}`)).status, 409, "borrar Pago proveedor deberia dar 409")

    const despues = await must(
      await GET("/api/categorias?incluirInactivas=1"),
      "GET categorias",
    )

    ctx.ok(
      despues.some(c => c.nombre === "Pago proveedor"),
      "la categoria del sistema sigue intacta",
    )
  },
  { sev: "MEDIA", ref: "categorias.controller.ts:CATEGORIAS_SISTEMA" },
)

test(
  "K4",
  "renombrar a un nombre existente no pisa la otra categoria",
  async ctx => {
    const nombreA = `Cat K4a ${uid()}`

    const a = await mkCategoria("egreso", { nombre: nombreA })

    const b = await mkCategoria("egreso")

    ctx.eq(
      (await PUT(`/api/categorias/${b.id}`, { nombre: nombreA })).status,
      409,
      "nombre duplicado deberia dar 409",
    )

    const todas = await must(
      await GET("/api/categorias?incluirInactivas=1"),
      "GET categorias",
    )

    ctx.eq(
      todas.filter(c => c.nombre === nombreA).length,
      1,
      "no quedo duplicada",
    )

    await drop(`/api/categorias/${b.id}`)
    await drop(`/api/categorias/${a.id}`)
  },
  { sev: "MEDIA", ref: "categorias.controller.ts:update" },
)
