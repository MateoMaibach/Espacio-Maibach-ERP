import { parseMonto } from "./money";

/** Item del formulario de fichero: cantidad y precio unitario como texto. */
export interface ItemFichero {
  cant: string;
  precioUnitario: string;
}

/** Campos del formulario que entran en el calculo de costos. */
export interface CostosFicheroForm {
  items: ItemFichero[];
  comisionPct: string;
  costoPiscina: string;
  costoInstalacion: string;
  equipoFiltrado: string;
  manoObraVereda: boolean;
  costoManoObra: string;
}

export interface TotalesFichero {
  itemsSubtotales: number[];
  importeTotal: number;
  comision: number;
  costoPiscina: number;
  costoInstalacion: number;
  costoEquipo: number;
  costoManoObra: number;
  totalCostos: number;
  margenNeto: number;
  margenPct: number;
}

/**
 * Totales del fichero a partir del formulario.
 *
 * Es la cuenta que decide el margen de la venta, asi que vive fuera del
 * componente y con tests propios: un error aca no rompe la pantalla, muestra
 * una ganancia equivocada.
 */
export function calcularTotalesFichero(form: CostosFicheroForm): TotalesFichero {
  const itemsSubtotales = form.items.map(
    (item) => parseMonto(item.cant) * parseMonto(item.precioUnitario),
  );

  const importeTotal = itemsSubtotales.reduce((sum, sub) => sum + sub, 0);

  const comision = importeTotal * (parseMonto(form.comisionPct) / 100);

  const costoPiscina = parseMonto(form.costoPiscina);
  const costoInstalacion = parseMonto(form.costoInstalacion);
  const costoEquipo = parseMonto(form.equipoFiltrado);

  // La mano de obra de vereda solo cuenta si el check esta tildado.
  const costoManoObra = form.manoObraVereda ? parseMonto(form.costoManoObra) : 0;

  const totalCostos =
    costoPiscina + costoInstalacion + costoEquipo + costoManoObra + comision;

  const margenNeto = importeTotal - totalCostos;

  // Sin venta no hay porcentaje: evita NaN y Infinity en pantalla.
  const margenPct = importeTotal > 0 ? (margenNeto / importeTotal) * 100 : 0;

  return {
    itemsSubtotales,
    importeTotal,
    comision,
    costoPiscina,
    costoInstalacion,
    costoEquipo,
    costoManoObra,
    totalCostos,
    margenNeto,
    margenPct,
  };
}

/** Cuota tal como la necesita el resumen de cobros. */
export interface CuotaResumen {
  nro: number;
  montoPlanificado: number;
  montoPagado: number;
}

export interface ResumenCobros {
  ficheroTotal: number;
  tienePagoInicial: boolean;
  pagoInicialMonto: number;
  totalCostoCobros: number;
  totalIngresos: number;
  saldoPendienteTotal: number;
  saldoParaCuotas: number;
  porcentajePagado: number;
  estaPagado: boolean;
}

/**
 * Resumen de cobros del fichero.
 *
 * `nro === 0` es el pago inicial: no entra en el plan de cuotas, por eso se
 * resta del saldo a financiar pero si cuenta como ingreso.
 */
export function calcularResumenCobros(
  totalTexto: unknown,
  cuotas: CuotaResumen[],
): ResumenCobros {
  const ficheroTotal = parseMonto(totalTexto);

  const cuotasPlan = cuotas.filter((c) => c.nro > 0);

  const inicial = cuotas.find((c) => c.nro === 0);

  const pagoInicialMonto = inicial?.montoPlanificado ?? 0;

  const totalCostoCobros = cuotasPlan.reduce((sum, c) => sum + c.montoPlanificado, 0);

  const totalIngresos = cuotas.reduce((sum, c) => sum + c.montoPagado, 0);

  const saldoPendienteTotal = ficheroTotal - totalIngresos;

  const saldoParaCuotas = ficheroTotal - pagoInicialMonto;

  const porcentajePagado = ficheroTotal > 0 ? (totalIngresos / ficheroTotal) * 100 : 0;

  return {
    ficheroTotal,
    tienePagoInicial: inicial !== undefined,
    pagoInicialMonto,
    totalCostoCobros,
    totalIngresos,
    saldoPendienteTotal,
    saldoParaCuotas,
    porcentajePagado,
    // Un fichero sin total no esta pago: seria "0 de 0" y mostraria el tilde.
    estaPagado: ficheroTotal > 0 && saldoPendienteTotal <= 0,
  };
}
