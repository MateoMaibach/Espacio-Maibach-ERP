import { db } from "../db/index.js"

import {
  periodos,
  ficheros,
  cuotas,
  movimientos,
  compras,
  ordenesPago,
  cheques,
  clientes,
} from "../db/schema.js"

import { eq, and } from "drizzle-orm"

import { calcularResumenCaja } from "../controllers/caja.controller.js"

import { calcularDerivados, parseMonto } from "./fichero.costs.js"

import { sumarMontosEnARS } from "./moneda.js"

import { claveMes, hoy, parseFecha } from "../utils/fecha.js"

/**
 * Congela un mes: guarda una foto de las cifras y bloquea editar lo que la
 * compuso.
 *
 * Es distinto del cierre por subcaja que ya existía. Ese es el arqueo físico
 * de una caja concreta; este es el cierre financiero global del mes.
 */

export interface SnapshotCostes {
  costoPiscina: number
  costoInstalacion: number
  costoEquipoFiltrado: number
  costoManoObra: number
  comision: number
  total: number
}

export interface Snapshot {
  mes: number
  anio: number
  generadoEn: string
  ventas: { total: number; cantidad: number }
  costes: SnapshotCostes
  resultado: { bruto: number; neto: number; margenPct: number }
  caja: {
    ingresos: number
    egresos: number
    gananciaNeta: number
    porSubCaja: Record<
      string,
      { ingresos: number; egresos: number; total: number }
    >
  }
  egresosPorCategoria: {
    categoria: string
    total: number
    movimientos: number
  }[]
  cuentasAPagar: number
  carteraCheques: number
  cuotasVencidas: number
  montoVencido: number
  avisos: string[]
}

function deEsteMes(fecha: string, mes: number, anio: number): boolean {
  const p = parseFecha(fecha)

  return p !== null && p.mes === mes && p.anio === anio
}

/** Cuotas vencidas a la fecha de hoy, con su atribución a cliente. */
export function calcularVencidos() {
  const hoyF = hoy()

  const clientePorFichero = new Map(
    db.select().from(ficheros).all().map((f) => [f.id, f.clienteId]),
  )

  const nombresCliente = new Map(
    db.select().from(clientes).all().map((c) => [c.id, c.nombre]),
  )

  let cuotasVencidas = 0

  let montoVencido = 0

  const porCliente = new Map<string, { nombre: string; cuotas: number; monto: number }>()

  for (const c of db.select().from(cuotas).all()) {
    if (c.nroCuota <= 0) continue

    if (c.estado === "Pagada") continue

    const venc = parseFecha(c.fechaVencimiento)

    if (!venc) continue

    if (diasEntre(hoyF, venc) <= 0) continue

    const pendiente = c.montoPlanificado - c.montoPagado

    if (pendiente <= 0) continue

    cuotasVencidas += 1

    montoVencido += pendiente

    const clienteId = clientePorFichero.get(c.ficheroId)

    if (!clienteId) continue

    const actual = porCliente.get(clienteId) ?? {
      nombre: nombresCliente.get(clienteId) ?? "(cliente borrado)",
      cuotas: 0,
      monto: 0,
    }

    actual.cuotas += 1

    actual.monto += pendiente

    porCliente.set(clienteId, actual)
  }

  return {
    cuotasVencidas,
    montoVencido,
    porCliente: [...porCliente.entries()]
      .map(([clienteId, v]) => ({ clienteId, ...v }))
      .sort((a, b) => b.monto - a.monto),
  }
}

function diasEntre(a: { anio: number; mes: number; dia: number }, b: {
  anio: number
  mes: number
  dia: number
}): number {
  const fa = Date.UTC(a.anio, a.mes - 1, a.dia)
  const fb = Date.UTC(b.anio, b.mes - 1, b.dia)

  return Math.round((fa - fb) / 86_400_000)
}

export function calcularSnapshot(mes: number, anio: number): Snapshot {
  const avisos: string[] = []

  const clave = `${anio}-${String(mes).padStart(2, "0")}`

  // --- Ventas y costos de obra ---

  const ficherosDelMes = db
    .select()
    .from(ficheros)
    .all()
    .filter((f) => {
      const p = parseFecha(f.fecha)

      return p !== null && claveMes(p) === clave
    })

  let ventasTotal = 0
  let costoPiscina = 0
  let costoInstalacion = 0
  let costoEquipoFiltrado = 0
  let costoManoObra = 0
  let comision = 0

  for (const f of ficherosDelMes) {
    const venta = parseMonto(f.total)

    const d = calcularDerivados(venta, {
      costoPiscina: f.costoPiscina,
      costoInstalacion: f.costoInstalacion,
      costoEquipoFiltrado: f.costoEquipoFiltrado,
      costoManoObra: f.manoObraVeredaAplica === 1 ? f.costoManoObra : 0,
      comisionPct: f.comisionPct,
    })

    ventasTotal += venta
    costoPiscina += f.costoPiscina
    costoInstalacion += f.costoInstalacion
    costoEquipoFiltrado += f.costoEquipoFiltrado
    costoManoObra += d.costoManoObra
    comision += d.comisionMonto
  }

  const totalCostos =
    costoPiscina +
    costoInstalacion +
    costoEquipoFiltrado +
    costoManoObra +
    comision

  // --- Caja ---

  const resumenCaja = calcularResumenCaja(mes, anio)

  const movimientosDelMes = db
    .select()
    .from(movimientos)
    .all()
    .filter((m) => deEsteMes(m.fecha, mes, anio))

  const sinConvertir = movimientosDelMes.filter(
    (m) => sumarMontosEnARS([m]).sinConvertir > 0,
  ).length

  if (sinConvertir > 0) {
    avisos.push(
      `${sinConvertir} movimiento(s) en moneda extranjera sin tipo de cambio quedaron fuera de los totales.`,
    )
  }

  // --- Egresos agrupados por categoría ---

  const porCategoria = new Map<string, { total: number; n: number }>()

  let sinCategoria = 0

  for (const m of movimientosDelMes) {
    if (m.tipo !== "egreso") continue

    if (!m.categoria) {
      sinCategoria += 1
      continue
    }

    const actual = porCategoria.get(m.categoria) ?? { total: 0, n: 0 }

    actual.total += sumarMontosEnARS([m]).total

    actual.n += 1

    porCategoria.set(m.categoria, actual)
  }

  if (sinCategoria > 0) {
    avisos.push(
      `${sinCategoria} egreso(s) sin categoría no se pueden imputar a ningún rubro.`,
    )
  }

  // --- Cuentas a pagar: compras del mes menos lo ya pagado ---

  const comprasTodas = db.select().from(compras).all()

  const comprasMap = new Map(
    comprasTodas.map((c) => [c.id, c.proveedorId]),
  )

  const pagadoPorCompra = new Map<string, number>()

  for (const o of db.select().from(ordenesPago).all()) {
    if (o.estado !== "Pagada") continue

    let links: { compraId: string; monto: number }[] = []

    try {
      links = JSON.parse(o.comprasPagadas || "[]")
    } catch {
      links = []
    }

    for (const link of links) {
      pagadoPorCompra.set(
        link.compraId,
        (pagadoPorCompra.get(link.compraId) ?? 0) + Number(link.monto || 0),
      )
    }
  }

  const comprasDelMes = comprasTodas.filter((c) =>
    deEsteMes(c.fecha, mes, anio),
  )

  const cuentasAPagar = comprasDelMes.reduce((acc, c) => {
    const pagado = pagadoPorCompra.get(c.id) ?? 0

    void comprasMap.get(c.id)

    return acc + Math.max(0, c.total - pagado)
  }, 0)

  // --- Cartera y vencimientos ---

  const carteraCheques = db
    .select()
    .from(cheques)
    .all()
    .filter((c) => c.tipo === "recibido" && c.estado === "En Cartera")
    .reduce((acc, c) => acc + c.importe, 0)

  const vencidos = calcularVencidos()

  return {
    mes,
    anio,
    generadoEn: new Date().toISOString(),
    ventas: { total: ventasTotal, cantidad: ficherosDelMes.length },
    costes: {
      costoPiscina,
      costoInstalacion,
      costoEquipoFiltrado,
      costoManoObra,
      comision,
      total: totalCostos,
    },
    resultado: {
      bruto: ventasTotal,
      neto: ventasTotal - totalCostos,
      margenPct:
        ventasTotal > 0
          ? Math.round(((ventasTotal - totalCostos) / ventasTotal) * 1000) / 10
          : 0,
    },
    caja: {
      ingresos: resumenCaja.totalIngresos,
      egresos: resumenCaja.totalEgresos,
      gananciaNeta: resumenCaja.gananciaNeta,
      porSubCaja: resumenCaja.subCajas,
    },
    egresosPorCategoria: [...porCategoria.entries()]
      .map(([categoria, v]) => ({
        categoria,
        total: v.total,
        movimientos: v.n,
      }))
      .sort((a, b) => b.total - a.total),
    cuentasAPagar,
    carteraCheques,
    cuotasVencidas: vencidos.cuotasVencidas,
    montoVencido: vencidos.montoVencido,
    avisos,
  }
}

export function obtenerPeriodo(mes: number, anio: number) {
  return db
    .select()
    .from(periodos)
    .where(and(eq(periodos.mes, mes), eq(periodos.anio, anio)))
    .get()
}

export function mesCerrado(mes: number, anio: number): boolean {
  return obtenerPeriodo(mes, anio)?.estado === "cerrado"
}

/**
 * Error de dominio para cuando se toca un mes cerrado. El middleware lo
 * traduce a 409 en vez del 500 genérico.
 */
export class MesCerradoError extends Error {
  constructor(mes: number, anio: number) {
    super(
      `El mes ${mes}/${anio} está cerrado y sus datos no se pueden modificar. Reabrilo desde Finanzas si necesitás corregir algo.`,
    )

    this.name = "MesCerradoError"
  }
}

/**
 * Lanza si la fecha cae en un mes cerrado. La usan los controladores de
 * movimientos y ficheros antes de crear, editar o borrar.
 */
export function assertMesAbierto(fecha: string): void {
  const p = parseFecha(fecha)

  if (!p) return

  if (mesCerrado(p.mes, p.anio)) {
    throw new MesCerradoError(p.mes, p.anio)
  }
}