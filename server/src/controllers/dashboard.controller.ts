import { Request, Response } from "express"

import { db } from "../db/index.js"

import {
  clientes,
  ficheros,
  cuotas,
  cheques,
  compras,
  stock,
  articulos,
  depositos,
  instalaciones,
  veredas,
  equipos,
} from "../db/schema.js"

import { calcularResumenCaja } from "./caja.controller.js"

import { calcularSaldos } from "./proveedores.controller.js"

import {
  aISO,
  claveMes,
  diasEntre,
  hoy,
  hoyISO,
  mesEnEspanol,
  parseFecha,
  ultimosMeses,
} from "../utils/fecha.js"

import { ventaEnCentavos } from "../services/fichero.costs.js"

import { aCentavos, deCentavos } from "../services/money.js"

/** Un cheque "en juego" todavia no se cobro ni se deposited. */
const CHEQUES_VIGENTES = new Set(["Pendiente", "En Cartera"])

const DIAS_AVISO_CHEQUE = 7

const TOP = 5

export function getDashboard(_req: Request, res: Response) {
  const hoyF = hoy()

  const hoyStr = hoyISO()

  // --- Ventas por mes, desde ficheros ---
  // ficheros.fecha viene en DD/MM/YYYY, no se puede agrupar en SQL.

  const todosFicheros = db.select().from(ficheros).all()

  const ventasPorMes = new Map<string, number>()

  for (const f of todosFicheros) {
    const p = parseFecha(f.fecha)

    if (!p) continue

    const clave = claveMes(p)

    ventasPorMes.set(
      clave,
      (ventasPorMes.get(clave) ?? 0) + ventaEnCentavos(f),
    )
  }

  const meses = ultimosMeses(6, hoyF)

  const serieVentas = meses.map((m) => {
    const clave = claveMes(m)

    return {
      clave,
      mes: mesEnEspanol(m),
      anio: m.anio,
      total: deCentavos(ventasPorMes.get(clave) ?? 0),
    }
  })

  const totalMesActual = serieVentas[serieVentas.length - 1]?.total ?? 0

  const totalMesAnterior = serieVentas[serieVentas.length - 2]?.total ?? 0

  // --- Cartera y morosos ---

  const pagosIniciales = new Map<string, number>()

  for (const f of todosFicheros) {
    pagosIniciales.set(f.clienteId, f.pagoInicial || 0)
  }

  let porCobrarC = 0

  let totalFacturadoC = 0

  for (const f of todosFicheros) {
    const brutoC = ventaEnCentavos(f)

    const pagadoC = aCentavos(pagosIniciales.get(f.clienteId) ?? 0)

    totalFacturadoC += brutoC

    porCobrarC += Math.max(0, brutoC - pagadoC)
  }

  const clientesPorId = new Map(
    db.select().from(clientes).all().map((c) => [c.id, c]),
  )

  // Para atribuir cada cuota vencida a un cliente hay que pasar por su fichero.

  const clientePorFichero = new Map(
    todosFicheros.map((f) => [f.id, f.clienteId]),
  )

  const todasCuotas = db.select().from(cuotas).all()

  const morososPorCliente = new Map<
    string,
    { cuotas: number; montoC: number }
  >()

  let cuotasVencidas = 0

  let montoVencidoC = 0

  for (const c of todasCuotas) {
    // La cuota nroCuota 0 es el pago inicial, no un vencimiento.
    if (c.nroCuota <= 0) continue

    if (c.estado === "Pagada") continue

    const venc = parseFecha(c.fechaVencimiento)

    if (!venc) continue

    if (diasEntre(hoyF, venc) <= 0) continue

    const pendienteC =
      aCentavos(c.montoPlanificado) - aCentavos(c.montoPagado)

    if (pendienteC <= 0) continue

    cuotasVencidas += 1

    montoVencidoC += pendienteC

    const clienteId = clientePorFichero.get(c.ficheroId)

    if (!clienteId) continue

    const actual = morososPorCliente.get(clienteId) ?? {
      cuotas: 0,
      montoC: 0,
    }

    actual.cuotas += 1

    actual.montoC += pendienteC

    morososPorCliente.set(clienteId, actual)
  }

  const morosos = [...morososPorCliente.entries()]
    .map(([clienteId, v]) => ({
      clienteId,
      cliente: clientesPorId.get(clienteId)?.nombre ?? "(cliente borrado)",
      cuotas: v.cuotas,
      monto: deCentavos(v.montoC),
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, TOP)

  // --- Caja ---

  const resumenCaja = calcularResumenCaja(hoyF.mes, hoyF.anio)

  // --- Cuentas a pagar por proveedor ---

  const saldos = calcularSaldos()

  const proveedoresConSaldo: {
    proveedorId: string
    saldo: number
  }[] = []

  let cuentasAPagarC = 0

  for (const [proveedorId, porMoneda] of Object.entries(saldos.comprado)) {
    const pagadoPorMoneda = saldos.pagado[proveedorId] ?? {}

    const monedas = new Set([
      ...Object.keys(porMoneda),
      ...Object.keys(pagadoPorMoneda),
    ])

    for (const moneda of monedas) {
      const saldoC =
        aCentavos(porMoneda[moneda]) - aCentavos(pagadoPorMoneda[moneda])

      if (saldoC > 0) {
        proveedoresConSaldo.push({
          proveedorId,
          saldo: deCentavos(saldoC),
        })

        cuentasAPagarC += saldoC
      }
    }
  }

  // --- Stock ---

  const stockRows = db.select().from(stock).all()

  const valorStockC = stockRows.reduce(
    (acc, r) => acc + aCentavos(r.costoPromedio) * r.cantidad,
    0,
  )

  const itemsStockNegativo = stockRows.filter((r) => r.cantidad < 0).length

  const depositosActivos = db
    .select()
    .from(depositos)
    .all()
    .filter((d) => d.activo === 1).length

  const articulosActivos = db
    .select()
    .from(articulos)
    .all()
    .filter((a) => a.activo === 1).length

  // --- Cheques a vencer ---

  const todosCheques = db.select().from(cheques).all()

  const chequesAVencer = todosCheques
    .filter((c) => CHEQUES_VIGENTES.has(c.estado))
    .map((c) => {
      const p = parseFecha(c.fechaCobro)

      const dias = p ? diasEntre(p, hoyF) : null

      return {
        id: c.id,
        tipo: c.tipo,
        banco: c.banco,
        numero: c.numero,
        importe: c.importe,
        estado: c.estado,
        fechaCobro: p ? aISO(p) : null,
        diasParaCobro: dias,
      }
    })
    .filter(
      (c) =>
        c.diasParaCobro !== null &&
        c.diasParaCobro >= 0 &&
        c.diasParaCobro <= DIAS_AVISO_CHEQUE,
    )
    .sort((a, b) => (a.diasParaCobro ?? 0) - (b.diasParaCobro ?? 0))

  const carteraTotalC = todosCheques
    .filter((c) => c.tipo === "recibido" && c.estado === "En Cartera")
    .reduce((acc, c) => acc + aCentavos(c.importe), 0)

  // --- Agenda: instalaciones y veredas ---

  const equiposPorId = new Map(
    db.select().from(equipos).all().map((e) => [e.id, e]),
  )

  function agendaDeInstalaciones(limite: number) {
    interface Evento {
      id: string
      tipo: "instalacion" | "vereda"
      fecha: string
      estado: string
      notas: string | null
      equipoId: string | null
    }

    const eventos: Evento[] = []

    for (const i of db.select().from(instalaciones).all()) {
      eventos.push({
        id: i.id,
        tipo: "instalacion",
        fecha: i.fecha,
        estado: i.estado,
        notas: i.notas,
        equipoId: i.equipoId,
      })
    }

    for (const v of db.select().from(veredas).all()) {
      eventos.push({
        id: v.id,
        tipo: "vereda",
        fecha: v.fecha,
        estado: v.estado,
        notas: v.notas,
        equipoId: v.equipoId,
      })
    }

    return eventos
      .map((e) => {
        const p = parseFecha(e.fecha)

        return {
          id: e.id,
          tipo: e.tipo,
          fecha: p ? aISO(p) : null,
          estado: e.estado,
          notas: e.notas,
          equipo: e.equipoId
            ? (equiposPorId.get(e.equipoId)?.nombre ?? null)
            : null,
        }
      })
      .filter((x) => x.fecha !== null && x.estado !== "Completada")
      .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""))
      .slice(0, limite)
  }

  // --- Conteo por estado (para el semaforo del calendario) ---

  const instalacionesPendientes = db
    .select()
    .from(instalaciones)
    .all()
    .filter((i) => i.estado === "Pendiente").length

  const instalacionesConfirmadas = db
    .select()
    .from(instalaciones)
    .all()
    .filter((i) => i.estado === "Confirmada").length

  const veredasPendientes = db
    .select()
    .from(veredas)
    .all()
    .filter((v) => v.estado === "Pendiente").length

  // --- Compras ---

  const comprasDelMes = db
    .select()
    .from(compras)
    .all()
    .filter((c) => {
      const p = parseFecha(c.fecha)

      return p?.mes === hoyF.mes && p?.anio === hoyF.anio
    })

  const comprasPendientes = comprasDelMes.filter(
    (c) => c.ingresoEstado !== "Recibido",
  ).length

  res.json({
    generadoEn: new Date().toISOString(),
    hoy: hoyStr,
    kpis: {
      ventasMes: totalMesActual,
      ventasMesAnterior: totalMesAnterior,
      variacionVentas:
        totalMesAnterior > 0
          ? Math.round(
              ((totalMesActual - totalMesAnterior) / totalMesAnterior) * 1000,
            ) / 10
          : null,
      totalFacturado: deCentavos(totalFacturadoC),
      porCobrar: deCentavos(porCobrarC),
      clientesActivos: db
        .select()
        .from(clientes)
        .all()
        .filter((c) => c.estado === "Activo").length,
      totalClientes: clientesPorId.size,
      cuotasVencidas,
      montoVencido: deCentavos(montoVencidoC),
      cajaIngresos: resumenCaja.totalIngresos,
      cajaEgresos: resumenCaja.totalEgresos,
      gananciaNeta: resumenCaja.gananciaNeta,
      subCajas: resumenCaja.subCajas,
      cuentasAPagar: deCentavos(cuentasAPagarC),
      proveedoresConSaldo: proveedoresConSaldo.length,
      valorStock: deCentavos(valorStockC),
      itemsStockNegativo,
      articulosActivos,
      depositosActivos,
      carteraCheques: deCentavos(carteraTotalC),
      comprasMes: deCentavos(
        comprasDelMes.reduce((acc, c) => acc + aCentavos(c.total), 0),
      ),
      comprasPendientes,
    },
    serieVentas,
    morosos,
    chequesAVencer,
    agenda: agendaDeInstalaciones(TOP),
    contadores: {
      instalacionesPendientes,
      instalacionesConfirmadas,
      veredasPendientes,
    },
  })
}