export interface FicheroItem {
  desc: string;

  cant: string;

  precioUnitario: string;
}

export interface FicheroForm {
  fecha: string;

  vendedor: string;

  comisionPct: string;

  items: FicheroItem[];

  proveedorPiscina: string;

  costoPiscina: string;

  costoInstalacion: string;

  equipoFiltrado: string;

  manoObraVereda: boolean;

  costoManoObra: string;

  tipoCobro: "libre" | "cuotas";

  cantCuotas: number;
}

export interface Cuota {
  id: number;

  nro: number;

  fechaVencimiento: string;

  montoPlanificado: number;

  montoPagado: number;

  fechaPago: string | null;

  metodo: string | null;

  comprobante: string;

  observaciones: string;

  estado: "Pendiente" | "Parcial" | "Pagada";

  descripcion?: string;
}

export const vendedores = ["Martín Maibach"];

export const metodosPago = [
  "Efectivo",
  "Transferencia",
  "Tarjeta de Crédito",
  "Tarjeta de Débito",
  "Cheque",
  "Mercado Pago",
  "Otro",
];

export {
  formatMonto as formatCurrency,
  parseMonto as parseCurrencyInput,
} from "@/utils/money";

export function getCurrentDate(): string {
  const now = new Date();

  const day = String(now.getDate()).padStart(2, "0");

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const year = now.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * DD/MM/YYYY (o YYYY-MM-DD) -> YYYY-MM-DD, que es lo que espera la API.
 *
 * Devuelve null si no se puede interpretar, para que el caller no mande una
 * fecha basura que el servidor iba a rechazar.
 */
export function parsearFechaCobro(value: string): string | null {
  const limpio = value.trim();

  if (!limpio) return null;

  const iso = limpio.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (iso) return limpio;

  const dmy = limpio.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (dmy) {
    const [, d, m, y] = dmy;

    if (!d || !m || !y) return null;

    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}
