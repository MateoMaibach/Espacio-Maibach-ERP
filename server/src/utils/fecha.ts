/**
 * La base de datos tiene fechas en tres formatos distintos, segun de donde
 * las escribio cada modulo:
 *
 *   YYYY-MM-DD       movimientos, instalaciones, veredas, compras, cheques,
 *                    movimientos_stock, cierres   (vienen de <input type="date">)
 *   DD/MM/YYYY       clientes.fecha_alta, ficheros.fecha   (getCurrentDate en
 *                    clienteDetalleData.ts)
 *   "DD Mon, YYYY"   cuotas.fecha_vencimiento     (getCurrentDateStr en
 *                    cuotas.controller.ts)
 *
 * Solo el primero es ordenable en SQL. Para agregar por mes o comparar
 * vencimientos hay que parsear en JS.
 */

const MESES = [
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

const MESES_INDEX = new Map(MESES.map((nombre, i) => [nombre.toLowerCase(), i]))

export interface Fecha {
  anio: number
  mes: number
  dia: number
}

/** Devuelve null si el string no esta en ninguno de los formatos conocidos. */
export function parseFecha(raw: unknown): Fecha | null {
  if (typeof raw !== "string") return null

  const s = raw.trim()

  if (!s) return null

  // YYYY-MM-DD
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }

  // DD/MM/YYYY
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return { anio: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) }

  // "10 Oct, 2026" / "10 Oct 2026"
  m = /^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/.exec(s)
  if (m) {
    const idx = MESES_INDEX.get(m[2].toLowerCase())

    if (idx !== undefined) {
      return { anio: Number(m[3]), mes: idx + 1, dia: Number(m[1]) }
    }
  }

  return null
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** "2026-10-10", para comparar contra hoy() y para ordenar. */
export function aISO(f: Fecha): string {
  return `${f.anio}-${pad(f.mes)}-${pad(f.dia)}`
}

/** "2026-10", la clave para agrupar por mes en los graficos. */
export function claveMes(f: Fecha): string {
  return `${f.anio}-${pad(f.mes)}`
}

export function mesEnEspanol(f: Fecha): string {
  return MESES[(f.mes - 1) % 12]
}

export function hoy(): Fecha {
  const now = new Date()

  return { anio: now.getFullYear(), mes: now.getMonth() + 1, dia: now.getDate() }
}

export function hoyISO(): string {
  return aISO(hoy())
}

/** Cantidad de dias entre dos fechas. Positivo si `a` es posterior a `b`. */
export function diasEntre(a: Fecha, b: Fecha): number {
  const fa = Date.UTC(a.anio, a.mes - 1, a.dia)
  const fb = Date.UTC(b.anio, b.mes - 1, b.dia)

  return Math.round((fa - fb) / 86_400_000)
}

/** Los ultimos `cantidad` meses inclusive el actual, de mas antiguo a mas nuevo. */
export function ultimosMeses(cantidad: number, desde: Fecha = hoy()): Fecha[] {
  const out: Fecha[] = []

  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(desde.anio, desde.mes - 1 - i, 1))

    out.push({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: 1 })
  }

  return out
}