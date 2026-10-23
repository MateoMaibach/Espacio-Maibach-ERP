import { db } from "../db/index.js"

import {
  periodos,
  periodosDesvios,
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

import { calcularDerivados, ventaEnCentavos } from "./fichero.costs.js"

import { sumarMontosEnARS } from "./moneda.js"

import { aCentavos, deCentavos } from "./money.js"

import { claveMes, hoy, parseFecha, diasEntre } from "../utils/fecha.js"

import { idUnico } from "../utils/id.js"

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

/**
 * Cuotas vencidas a una fecha de corte, con su atribución a cliente.
 *
 * Antes la fecha de corte era SIEMPRE hoy. Con eso, el snapshot de un mes
 * pasado decía "0 cuotas vencidas" porque ninguna cuota vencía todavía hoy,
 * cuando al momento del cierre de ese mes algunas ya lo estaban. Un cierre
 * mensual tiene que responder "¿cuánto estaba vencido al cierre?", no
 * "¿cuánto está vencido ahora?".
 *
 * Por defecto usa hoy (que es lo correcto para el mes en curso y para las
 * vistas operativas), pero el snapshot le pasa el último día del periodo.
 */
export function calcularVencidos(corte: { anio: number; mes: number; dia: number } = hoy()) {
  const hoyF = corte

  const clientePorFichero = new Map(
    db.select().from(ficheros).all().map((f) => [f.id, f.clienteId]),
  )

  const nombresCliente = new Map(
    db.select().from(clientes).all().map((c) => [c.id, c.nombre]),
  )

  let cuotasVencidas = 0

  let montoVencidoC = 0

  const porCliente = new Map<
    string,
    { nombre: string; cuotas: number; montoC: number }
  >()

  for (const c of db.select().from(cuotas).all()) {
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

    const actual = porCliente.get(clienteId) ?? {
      nombre: nombresCliente.get(clienteId) ?? "(cliente borrado)",
      cuotas: 0,
      montoC: 0,
    }

    actual.cuotas += 1

    actual.montoC += pendienteC

    porCliente.set(clienteId, actual)
  }

  return {
    cuotasVencidas,
    montoVencido: deCentavos(montoVencidoC),
    porCliente: [...porCliente.entries()]
      .map(([clienteId, v]) => ({
        clienteId,
        nombre: v.nombre,
        cuotas: v.cuotas,
        monto: deCentavos(v.montoC),
      }))
      .sort((a, b) => b.monto - a.monto),
  }
}

/**
 * Anota una escritura que cayo en un periodo cerrado.
 *
 * NO bloquea. El cierre congela `movimientos` y `ficheros`; el resto de las
 * tablas que alimentan el snapshot siguen escribiendo, porque frenar una
 * compra registrada con atraso bloquearia el trabajo real. Lo que no se
 * permite es que pase inadvertido: queda registrado y el `preview` del
 * periodo lo senala.
 *
 * Una fecha ilegible no genera desvio: se rechaza antes con 400, porque no se
 * puede saber a que periodo pertenecio.
 */
export function registrarDesvio(params: {
  fecha: string
  tabla: string
  operacion: string
  entidadId?: string | null
  detalle?: string | null
}): void {
  const p = parseFecha(params.fecha)

  if (!p) return

  const periodo = obtenerPeriodo(p.mes, p.anio)

  if (!periodo || periodo.estado !== "cerrado") return

  db.insert(periodosDesvios)
    .values({
      id: idUnico("desv"),
      periodoId: periodo.id,
      tabla: params.tabla,
      operacion: params.operacion,
      entidadId: params.entidadId ?? null,
      fecha: params.fecha,
      detalle: params.detalle ?? null,
      createdAt: new Date(),
    })
    .run()
}

/** Los desvios registrados de un periodo, del mas nuevo al mas viejo. */
export function desviosDePeriodo(periodoId: string) {
  return db
    .select()
    .from(periodosDesvios)
    .where(eq(periodosDesvios.periodoId, periodoId))
    .all()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** Cantidad de desvios de un periodo. Para el dashboard. */
export function contarDesvios(periodoId: string): number {
  return desviosDePeriodo(periodoId).length
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

  let ventasTotalC = 0
  let costoPiscinaC = 0
  let costoInstalacionC = 0
  let costoEquipoFiltradoC = 0
  let costoManoObraC = 0
  let comisionC = 0

  for (const f of ficherosDelMes) {
    const ventaC = ventaEnCentavos(f)

    const d = calcularDerivados(deCentavos(ventaC), {
      costoPiscina: f.costoPiscina,
      costoInstalacion: f.costoInstalacion,
      costoEquipoFiltrado: f.costoEquipoFiltrado,
      costoManoObra: f.manoObraVeredaAplica === 1 ? f.costoManoObra : 0,
      comisionPct: f.comisionPct,
    })

    ventasTotalC += ventaC
    costoPiscinaC += aCentavos(f.costoPiscina)
    costoInstalacionC += aCentavos(f.costoInstalacion)
    costoEquipoFiltradoC += aCentavos(f.costoEquipoFiltrado)
    costoManoObraC += aCentavos(d.costoManoObra)
    comisionC += aCentavos(d.comisionMonto)
  }

  const totalCostosC =
    costoPiscinaC +
    costoInstalacionC +
    costoEquipoFiltradoC +
    costoManoObraC +
    comisionC

  const ventasTotal = deCentavos(ventasTotalC)
  const totalCostos = deCentavos(totalCostosC)

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

  const cuentasAPagarC = comprasDelMes.reduce((acc, c) => {
    const pagado = pagadoPorCompra.get(c.id) ?? 0

    void comprasMap.get(c.id)

    return acc + Math.max(0, aCentavos(c.total) - aCentavos(pagado))
  }, 0)

  // --- Cartera y vencimientos ---

  const carteraChequesC = db
    .select()
    .from(cheques)
    .all()
    .filter((c) => c.tipo === "recibido" && c.estado === "En Cartera")
    .reduce((acc, c) => acc + aCentavos(c.importe), 0)

  // La foto del corte es contra el ULTIMO DIA del periodo, no contra hoy.
const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()

const vencidos = calcularVencidos({ anio, mes, dia: ultimoDia })

  return {
    mes,
    anio,
    generadoEn: new Date().toISOString(),
    ventas: { total: ventasTotal, cantidad: ficherosDelMes.length },
    costes: {
      costoPiscina: deCentavos(costoPiscinaC),
      costoInstalacion: deCentavos(costoInstalacionC),
      costoEquipoFiltrado: deCentavos(costoEquipoFiltradoC),
      costoManoObra: deCentavos(costoManoObraC),
      comision: deCentavos(comisionC),
      total: totalCostos,
    },
    resultado: {
      bruto: ventasTotal,
      neto: deCentavos(ventasTotalC - totalCostosC),
      margenPct:
        ventasTotalC > 0
          ? Math.round(
              ((ventasTotalC - totalCostosC) / ventasTotalC) * 1000,
            ) / 10
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
        total: deCentavos(v.total),
        movimientos: v.n,
      }))
      .sort((a, b) => b.total - a.total),
    cuentasAPagar: deCentavos(cuentasAPagarC),
    carteraCheques: deCentavos(carteraChequesC),
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
 * Error de fecha ilegible.
 *
 * Antes `assertMesAbierto` hacia `return` en silencio cuando la fecha no se
 * podia parsear, y eso abria el guard entero: mandar
 * `fecha: "no-es-una-fecha"` en un mes cerrado pasaba limpio. Una fecha que no
 * se entiende no puede verificarse contra el periodo, asi que hay que
 * rechazarla.
 */
export class FechaInvalidaError extends Error {
  constructor(fecha: unknown) {
    super(`La fecha "${String(fecha)}" no es válida. Se espera el formato yyyy-mm-dd.`)

    this.name = "FechaInvalidaError"
  }
}

/**
 * Lanza si la fecha cae en un mes cerrado, o si la fecha misma no es válida.
 *
 * Se usa antes de crear, editar o borrar. Throw, no retorno: el flujo tiene que
 * detenerse.
 */
export function assertMesAbierto(fecha: string): void {
  const p = parseFecha(fecha)

  if (!p) throw new FechaInvalidaError(fecha)

  if (mesCerrado(p.mes, p.anio)) {
    throw new MesCerradoError(p.mes, p.anio)
  }
}

/**
 * Igual que `assertMesAbierto`, pero devuelve el error en vez de tirar, para
 * los endpoints que escriben en tablas que el periodo no congela (stock,
 * remitos, compras, cuotas...). Esos no se bloquean: se anotan como desvio.
 */
export function chequearMesAbierto(
  fecha: string,
): { ok: true } | { ok: false; error: Error } {
  try {
    assertMesAbierto(fecha)

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e as Error }
  }
}