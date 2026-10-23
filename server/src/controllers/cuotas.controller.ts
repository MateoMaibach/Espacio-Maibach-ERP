import { Request, Response } from "express"

import { idUnico } from "../utils/id.js"

import { db } from "../db/index.js"

import {
  ficheros,
  cuotas,
  clientes,
  cajas,
  movimientos,
} from "../db/schema.js"

import { eq, and } from "drizzle-orm"

import { assertMesAbierto, registrarDesvio } from "../services/periodos.service.js"

import { FECHA_REGEX, hoyISO, parseFecha } from "../utils/fecha.js"

import { ventaEnCentavos } from "../services/fichero.costs.js"

import { aCentavos, deCentavos } from "../services/money.js"

/** Categoria de ingresos donde cae el cobro de cuotas. */
const CATEGORIA_COBRO_CUOTA = "Cobro cuota"

function getFicheroByClienteId(clienteId: string) {
  return db
    .select()
    .from(ficheros)
    .where(eq(ficheros.clienteId, clienteId))
    .get()
}

/**
 * Resuelve la cuota indicada y verifica que pertenezca al cliente de la URL.
 * Sin este cruce, PUT/POST/DELETE /clientes/:id/fichero/cuotas/:cuotaId
 * permitian modificar o borrar cuotas de otro cliente.
 */
function getCuotaDeCliente(clienteId: string, cuotaId: string) {
  const cuota = db.select().from(cuotas).where(eq(cuotas.id, cuotaId)).get()

  if (!cuota) return undefined

  const fichero = db
    .select()
    .from(ficheros)
    .where(eq(ficheros.id, cuota.ficheroId))
    .get()

  if (!fichero || fichero.clienteId !== clienteId) return undefined

  return cuota
}

function getCurrentDateStr(): string {
  const now = new Date()

  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ]

  return `${String(now.getDate()).padStart(2, "0")} ${months[now.getMonth()]}, ${now.getFullYear()}`
}

export function registrarPagoInicial(req: Request, res: Response) {
  const cliente = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  const fichero = getFicheroByClienteId(req.params.id as string)

  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" })

    return
  }

  const { monto, metodo, comprobante, observaciones } = req.body

  const montoC = aCentavos(monto)

  if (montoC <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" })

    return
  }

  const montoFinal = deCentavos(montoC)

  const existing = db
    .select()
    .from(cuotas)
    .where(and(eq(cuotas.ficheroId, fichero.id), eq(cuotas.nroCuota, 0)))
    .get()

  if (existing) {
    db.update(cuotas)
      .set({
        montoPlanificado: montoFinal,

        montoPagado: montoFinal,

        estado: "Pagada",

        fechaPago: getCurrentDateStr(),

        metodo: metodo || existing.metodo,

        comprobante: comprobante || existing.comprobante,

        observaciones: observaciones || existing.observaciones,
      })
      .where(eq(cuotas.id, existing.id))
      .run()
  } else {
    db.insert(cuotas)
      .values({
        id: idUnico("cuo_initial"),

        ficheroId: fichero.id,

        nroCuota: 0,

        fechaVencimiento: getCurrentDateStr(),

        montoPlanificado: montoFinal,

        montoPagado: montoFinal,

        estado: "Pagada",

        fechaPago: getCurrentDateStr(),

        metodo: metodo || null,

        comprobante: comprobante || null,

        observaciones: observaciones || null,

        descripcion: "Pago Inicial",

        createdAt: new Date(),
      })
      .run()
  }

  db.update(ficheros)
    .set({ pagoInicial: montoFinal })
    .where(eq(ficheros.id, fichero.id))
    .run()

  res.json({ ok: true })
}

export function generarPlan(req: Request, res: Response) {
  const cliente = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  if (!cliente) {
    res.status(404).json({ error: "Cliente no encontrado" })

    return
  }

  const fichero = getFicheroByClienteId(req.params.id as string)

  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" })

    return
  }

  const { cantCuotas, fechaPrimerVto } = req.body

  const totalC = ventaEnCentavos(fichero)

  const pagoInicialC = aCentavos(fichero.pagoInicial)

  const saldoC = totalC - pagoInicialC

  const nCrudo = cantCuotas ?? fichero.cantCuotas ?? 1

  // Sin esto, cantCuotas: -5 creaba 0 cuotas pero guardaba cantCuotas = -5 en
  // el fichero y respondia cuotasGeneradas: -5. Y un 3.5 generaba 4 cuotas
  // (for i < 3.5) sin aplicar nunca el remanente.
  const n = Math.trunc(Number(nCrudo))

  if (!Number.isFinite(n) || n < 1) {
    res
      .status(400)
      .json({ error: "La cantidad de cuotas debe ser un numero entero mayor a 0" })

    return
  }

  if (n > 120) {
    res
      .status(400)
      .json({ error: "La cantidad de cuotas no puede superar 120" })

    return
  }

  if (saldoC <= 0) {
    res
      .status(400)
      .json({
        error:
          "El saldo disponible es 0 o menor. No hay nada que dividir en cuotas.",
      })

    return
  }

  /**
 * `fechaPrimerVto` lo manda el front como `dd/mm/aaaa`
 * (`getCurrentDate` en clienteDetalleData.ts), pero este parser esperaba
 * `"10 Oct, 2026"`: dividia el string y buscaba `parts[1]` en un mapa de
 * nombres de mes. Con `"14/10/2026"` daba `"10"`, que no existe en el mapa,
 * asi que caia al mes actual Y al dia 1.
 *
 * O sea: el usuario elegia una fecha y el sistema usaba otra.
 *
 * `parseFecha` ya entiende los dos formatos, asi que se usa ese.
 */
const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

const now = new Date()

const dateStr = fechaPrimerVto || getCurrentDateStr()

const primera = parseFecha(dateStr)

const startDia = primera?.dia ?? 1
const startMonth = (primera?.mes ?? now.getMonth() + 1) - 1
const startYear = primera?.anio ?? now.getFullYear()

  const existingCuotas = db
    .select()
    .from(cuotas)
    .where(eq(cuotas.ficheroId, fichero.id))
    .all()

  /**
   * Regenerar el plan borra las cuotas existentes. Si alguna ya tiene plata
   * cobrada, eso es plata que se pierde: no queda ni registro ni saldo.
   *
   * Antes de existir este chequeo, regenerar desde la UI borraba en silencio
   * todo el historial de cobros de un fichero.
   */
  const cuotasCobradas = existingCuotas.filter(
    c => c.nroCuota > 0 && (c.montoPagado ?? 0) > 0,
  )

  if (cuotasCobradas.length > 0) {
    const cobradoC = cuotasCobradas.reduce(
      (a, c) => a + aCentavos(c.montoPagado),
      0,
    )

    res.status(409).json({
      error:
        `No se puede regenerar el plan: ya hay ${cuotasCobradas.length} cuota(s) cobradas ` +
        `($${deCentavos(cobradoC).toLocaleString("es-AR")}). Editá el importe de las cuotas existentes, ` +
        `o corregí los cobros antes de volver a generar el plan.`,
    })

    return
  }

  const montoPorCuotaC = Math.floor(saldoC / n)

  const montoUltimaC = saldoC - montoPorCuotaC * (n - 1)

  // Borrar e insertar tiene que ser una sola operacion: si fallara en el
  // medio, el fichero se quedaria sin ninguna cuota.
  db.transaction(tx => {
    for (const cuota of existingCuotas) {
      if (cuota.nroCuota > 0) {
        tx.delete(cuotas).where(eq(cuotas.id, cuota.id)).run()
      }
    }

    for (let i = 0; i < n; i++) {
      const fecha = new Date(startYear, startMonth + i, startDia)

      const day = String(fecha.getDate()).padStart(2, "0")

      const fechaVenc = `${day} ${MESES_CORTOS[fecha.getMonth()]}, ${fecha.getFullYear()}`

      tx.insert(cuotas)
        .values({
          id: idUnico("cuo"),

          ficheroId: fichero.id,

          nroCuota: i + 1,

          fechaVencimiento: fechaVenc,

          montoPlanificado:
            i === n - 1
              ? deCentavos(montoUltimaC)
              : deCentavos(montoPorCuotaC),

          montoPagado: 0,

          estado: "Pendiente",

          descripcion: `Cuota ${i + 1}/${n}`,

          createdAt: new Date(),
        })
        .run()
    }

    tx.update(ficheros)
      .set({ tipoCobro: "cuotas", cantCuotas: n })
      .where(eq(ficheros.id, fichero.id))
      .run()
  })

  res.json({ ok: true, cuotasGeneradas: n })
}

export function agregarCargo(req: Request, res: Response) {
  const fichero = getFicheroByClienteId(req.params.id as string)

  if (!fichero) {
    res.status(400).json({ error: "El cliente no tiene fichero" })

    return
  }

  const { fechaVencimiento, monto, descripcion } = req.body

  const montoC = aCentavos(monto)

  if (montoC <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" })

    return
  }

  const existingCuotas = db
    .select()
    .from(cuotas)
    .where(eq(cuotas.ficheroId, fichero.id))
    .all()

  const maxNro = existingCuotas.reduce((max, c) => Math.max(max, c.nroCuota), 0)

  db.insert(cuotas)
    .values({
      id: idUnico("cuo"),

      ficheroId: fichero.id,

      nroCuota: maxNro + 1,

      fechaVencimiento: fechaVencimiento || getCurrentDateStr(),

      montoPlanificado: deCentavos(montoC),

      montoPagado: 0,

      estado: "Pendiente",

      descripcion: descripcion || null,

      createdAt: new Date(),
    })
    .run()

  res.status(201).json({ ok: true })
}

/**
 * El front manda `montoPlanificado` (ClienteDetalle.tsx), pero esto leia
 * `monto`. Como las dos claves no coinciden, editar el importe de una cuota
 * devolvia {ok:true} sin cambiar nada: el modal se cerraba, la pantalla se
 * recargaba y el importe viejo seguia ahi. Se aceptan las dos claves para no
 * romper clientes viejos.
 */
export function editarCuota(req: Request, res: Response) {
  const cuota = getCuotaDeCliente(
    req.params.id as string,
    req.params.cuotaId as string,
  )

  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" })

    return
  }

  const {
    fechaVencimiento,
    montoPlanificado,
    monto,
    descripcion,
    metodo,
    comprobante,
    observaciones,
  } = req.body

  const nuevoMonto = montoPlanificado !== undefined ? montoPlanificado : monto

  if (nuevoMonto !== undefined) {
    const n = Number(nuevoMonto)

    if (!Number.isFinite(n)) {
      res.status(400).json({ error: "El monto planificado debe ser un numero" })

      return
    }

    const nC = aCentavos(n)
    const pagadoC = aCentavos(cuota.montoPagado)

    if (nC < 0) {
      res.status(400).json({ error: "El monto planificado no puede ser negativo" })

      return
    }

    // Bajar el planificado por debajo de lo ya cobrado dejaba la cuota en un
    // estado imposible: pagado 40.000 sobre un planificado de 1.
    if (nC < pagadoC) {
      res.status(400).json({
        error:
          `El monto planificado no puede ser menor a lo ya cobrado ` +
          `(${deCentavos(pagadoC).toLocaleString("es-AR")})`,
      })

      return
    }
  }

  const cambios = {
    ...(fechaVencimiento !== undefined && { fechaVencimiento }),

    ...(nuevoMonto !== undefined && {
      montoPlanificado: deCentavos(aCentavos(Number(nuevoMonto))),
    }),

    ...(descripcion !== undefined && { descripcion }),

    ...(metodo !== undefined && { metodo }),

    ...(comprobante !== undefined && { comprobante }),

    ...(observaciones !== undefined && { observaciones }),
  }

  if (Object.keys(cambios).length === 0) {
    res.status(400).json({ error: "No se envio ningun campo para actualizar" })

    return
  }

  db.update(cuotas)
    .set(cambios)
    .where(eq(cuotas.id, req.params.cuotaId as string))
    .run()

  res.json({ ok: true })
}

/**
 * Registrar un cobro de cuota.
 *
 * Antes escribia SOLO en `cuotas`: el sistema registraba que el cliente pago
 * pero la caja no se enteraba. `/caja/resumen`, el dashboard y el snapshot del
 * periodo no incluian ese ingreso, asi que el efectivo y las cuentas por
 * cobrar nunca cuadraban.
 *
 * Ahora escribe la cuota y su movimiento de caja en una sola transaccion.
 */
export function registrarCobro(req: Request, res: Response) {
  const cuota = getCuotaDeCliente(
    req.params.id as string,
    req.params.cuotaId as string,
  )

  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" })

    return
  }

  const { monto: montoRaw, metodo, comprobante, observaciones, fecha, subCaja } = req.body

  // Sin validacion, mandar "abc" guardaba la cadena "0abc" en una columna
  // INTEGER y el saldo quedaba corrupto para siempre. `aCentavos` devuelve 0
  // para cualquier entrada ilegible, asi que el chequeo de abajo la corta.
  const montoC = aCentavos(montoRaw)

  if (montoC <= 0) {
    res.status(400).json({ error: "Monto obligatorio mayor a 0" })

    return
  }

  const monto = deCentavos(montoC)

  if (cuota.estado === "Pagada") {
    res.status(409).json({
      error:
        `Esta cuota ya esta Pagada (monto pagado: ` +
        `${(cuota.montoPagado ?? 0).toLocaleString("es-AR")}). ` +
        `No se puede volver a cobrar.`,
    })

    return
  }

  const pagadoC = aCentavos(cuota.montoPagado)

  const saldoC = aCentavos(cuota.montoPlanificado) - pagadoC

  if (montoC > saldoC) {
    res.status(400).json({
      error:
        `El monto supera el saldo de la cuota. ` +
        `Planificado: ${cuota.montoPlanificado.toLocaleString("es-AR")}, ` +
        `pagado: ${deCentavos(pagadoC).toLocaleString("es-AR")}, ` +
        `saldo: ${deCentavos(saldoC).toLocaleString("es-AR")}`,
    })

    return
  }

  const fechaCobro = fecha ? String(fecha) : hoyISO()

  if (!FECHA_REGEX.test(fechaCobro)) {
    res.status(400).json({ error: "La fecha debe tener formato yyyy-mm-dd" })

    return
  }

  const cajaNombre = subCaja ? String(subCaja).trim() : "Efectivo"

  const caja = db
    .select()
    .from(cajas)
    .where(eq(cajas.nombre, cajaNombre))
    .get()

  if (!caja) {
    res.status(400).json({ error: `La caja "${cajaNombre}" no existe` })

    return
  }

  if (caja.activa !== 1) {
    res.status(400).json({ error: `La caja "${cajaNombre}" esta inactiva` })

    return
  }

  try {
    assertMesAbierto(fechaCobro)
  } catch (e) {
    res.status(409).json({ error: (e as Error).message })

    return
  }

  // El cobro escribe en `movimientos` (protegido por el guard) y en `cuotas`
  // (que no lo esta). Si el periodo esta cerrado, el guard de arriba ya
  // corto; este registro cubre el caso de que la cuota sea de otro periodo.
  registrarDesvio({
    fecha: fechaCobro,
    tabla: "cuotas",
    operacion: "cobro",
    entidadId: cuota.id,
    detalle: `${monto.toLocaleString("es-AR")} a la cuota ${cuota.nroCuota}`,
  })

  const nuevoMontoPagadoC = pagadoC + montoC

  const nuevoEstado =
    nuevoMontoPagadoC >= aCentavos(cuota.montoPlanificado)
      ? "Pagada"
      : "Parcial"

  const nuevoMontoPagado = deCentavos(nuevoMontoPagadoC)

  const fichero = db
    .select()
    .from(ficheros)
    .where(eq(ficheros.id, cuota.ficheroId))
    .get()

  const cliente = db
    .select()
    .from(clientes)
    .where(eq(clientes.id, req.params.id as string))
    .get()

  const movimientoId = idUnico("mov")

  const concepto = `Cobro cuota ${cuota.nroCuota}/${fichero?.cantCuotas ?? "?"}${
    cliente ? ` - ${cliente.nombre}` : ""
  }`

  try {
    db.transaction(tx => {
      tx.update(cuotas)
        .set({
          montoPagado: nuevoMontoPagado,

          estado: nuevoEstado,

          fechaPago: getCurrentDateStr(),

          ...(metodo !== undefined && { metodo }),

          ...(comprobante !== undefined && { comprobante }),

          ...(observaciones !== undefined && { observaciones }),
        })
        .where(eq(cuotas.id, req.params.cuotaId as string))
        .run()

      tx.insert(movimientos)
        .values({
          id: movimientoId,

          fecha: fechaCobro,

          concepto,

          monto,

          tipo: "ingreso",

          subCaja: cajaNombre,

          categoria: CATEGORIA_COBRO_CUOTA,

          ...(comprobante !== undefined && { comprobante }),

          createdAt: new Date(),
        })
        .run()
    })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })

    return
  }

  res.json({
    ok: true,
    nuevoEstado,
    montoPagado: nuevoMontoPagado,
    movimientoId,
  })
}

export function eliminarCuota(req: Request, res: Response) {
  const cuota = getCuotaDeCliente(
    req.params.id as string,
    req.params.cuotaId as string,
  )

  if (!cuota) {
    res.status(404).json({ error: "Cuota no encontrada" })

    return
  }

  if (cuota.nroCuota === 0) {
    const fichero = db
      .select()
      .from(ficheros)
      .where(eq(ficheros.id, cuota.ficheroId))
      .get()

    if (fichero) {
      db.update(ficheros)
        .set({ pagoInicial: 0 })
        .where(eq(ficheros.id, fichero.id))
        .run()
    }
  }

  db.delete(cuotas)
    .where(eq(cuotas.id, req.params.cuotaId as string))
    .run()

  res.json({ ok: true })
}
