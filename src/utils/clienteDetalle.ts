import { parseMonto } from "@/utils/money";

export interface Cuota {
  id: string;

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

export interface FicheroData {
  fecha: string;

  vendedor: string;

  comision: string;

  items: { desc: string; cant: string; precio: string }[];

  total: string;

  // Insumos: numerico en la base, se formatea solo para mostrar.
  costoPiscina: number;

  costoInstalacion: number;

  costoEquipoFiltrado: number;

  costoManoObra: number;

  manoObraVeredaAplica: number;

  comisionPct: number;

  proveedor: string | null;

  // Derivados: los calcula el server en cada lectura, no se guardan.
  venta: number;

  comisionMonto: number;

  totalCostos: number;

  margenNeto: number;

  margenPct: number;

  cuotas: Cuota[];
}

export interface ClienteData {
  id: string;

  nombre: string;

  direccion: string;

  localidad: string;

  telefono: string;

  email: string;

  dni: string;

  fechaAlta: string;

  estado: string;

  fichero: FicheroData | null;

  cuotas: any[];
}

export function mapCuota(c: any): Cuota {
  return {
    id: c.id,

    nro: c.nroCuota,

    fechaVencimiento: c.fechaVencimiento,

    montoPlanificado: c.montoPlanificado,

    montoPagado: c.montoPagado,

    fechaPago: c.fechaPago || null,

    metodo: c.metodo || null,

    comprobante: c.comprobante || "",

    observaciones: c.observaciones || "",

    estado: c.estado,

    descripcion: c.descripcion || undefined,
  };
}

export function mapFichero(raw: any, cuotasRaw: any[]): FicheroData {
  let items: { desc: string; cant: string; precio: string }[] = [];

  try {
    const parsed = JSON.parse(raw.items || "[]");

    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    /* items corrupto: se muestra el fichero sin articulos, no se rompe la pagina */
  }

  /**
   * `Number("$1.950.000")` es NaN, no 1950000. Por eso los montos que llegan
   * como texto formateado hay que pasarlos por `parseMonto` y no por `num`:
   * con `num`, la venta y el margen colapsaban a 0 en silencio.
   */
  const num = (v: unknown) => {
    const n = Number(v);

    return Number.isFinite(n) ? n : 0;
  };

  const monto = (v: unknown) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    return parseMonto(String(v ?? ""));
  };

  return {
    fecha: raw.fecha,

    vendedor: raw.vendedor,

    comision: raw.comision || "",

    items,

    total: raw.total || "$0",

    costoPiscina: num(raw.costoPiscina),

    costoInstalacion: num(raw.costoInstalacion),

    costoEquipoFiltrado: num(raw.costoEquipoFiltrado),

    costoManoObra: num(raw.costoManoObra),

    manoObraVeredaAplica: num(raw.manoObraVeredaAplica) === 0 ? 0 : 1,

    comisionPct: num(raw.comisionPct),

    proveedor: raw.proveedor ?? null,

    venta: monto(raw.venta ?? raw.total),

    comisionMonto: num(raw.comisionMonto),

    totalCostos: num(raw.totalCostos),

    margenNeto: num(raw.margenNeto),

    margenPct: num(raw.margenPct),

    cuotas: cuotasRaw.map(mapCuota),
  };
}
