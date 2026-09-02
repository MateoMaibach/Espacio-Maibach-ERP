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
}

export interface Pago {
  id: number;
  fecha: string;
  monto: number;
  metodo: string;
  comprobante: string;
  observaciones: string;
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
}

export interface FicheroGuardado {
  fecha: string;
  vendedor: string;
  comision: string;
  items: { desc: string; cant: string; precio: string }[];
  total: string;
  costos: {
    venta: string;
    proveedor: string;
    costoPiscina: string;
    instalacion: string;
    equipoFiltrado: string;
    manoObraVereda: string;
    comision: string;
    totalCostos: string;
    margenNeto: string;
    margenPct: string;
  };
  pagos: Pago[];
  cuotas: Cuota[];
}

export interface HistorialEntry {
  fecha: string;
  vendedor: string;
  articulos: string;
  importe: string;
  isCurrent?: boolean;
}

export interface ClienteCompleto {
  nombre: string;
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  dni: string;
  fechaAlta: string;
  estado: string;
  ficheroActual: FicheroGuardado | null;
  historial: HistorialEntry[];
}

export const clientesDataInit: Record<string, ClienteCompleto> = {
  "1": {
    nombre: "García, Roberto", direccion: "Calle Los Jacarandás 451", localidad: "Paraná, Entre Ríos",
    telefono: "343-4552912", email: "rgarcia@gmail.com", dni: "30.412.552", fechaAlta: "12 Ene, 2024", estado: "Activo",
    ficheroActual: {
      fecha: "05 Ago, 2024", vendedor: "Martín Maibach", comision: "5% ($242.500)",
      items: [
        { desc: "Pileta Modelo Roma 6x3 (Instalada)", cant: "Cant: 1 × $3.900.000", precio: "$3.900.000" },
        { desc: "Bomba Vulcano 1HP + Accesorios", cant: "Cant: 1 × $450.000", precio: "$450.000" },
        { desc: "Kit de Luces Led RGB + Tablero", cant: "Cant: 1 × $500.000", precio: "$500.000" },
      ],
      total: "$4.850.000",
      costos: {
        venta: "$4.850.000", proveedor: "Piletecno SA", costoPiscina: "$1.950.000", instalacion: "$800.000",
        equipoFiltrado: "$450.000", manoObraVereda: "$200.000", comision: "$242.500",
        totalCostos: "$3.642.500", margenNeto: "$1.207.500", margenPct: "24.9%",
      },
      pagos: [
        { id: 1, fecha: "10 Ago, 2024", monto: 1000000, metodo: "Transferencia", comprobante: "TR-45812", observaciones: "Seña inicial" },
        { id: 2, fecha: "20 Ago, 2024", monto: 500000, metodo: "Efectivo", comprobante: "", observaciones: "Segundo pago" },
      ],
      cuotas: [],
    },
    historial: [
      { fecha: "12 Ene, 2024", vendedor: "Martín M.", articulos: "Bomba Vulcano 1/2 HP + Accesorios", importe: "$18.500" },
      { fecha: "05 Ago, 2024", vendedor: "Martín M.", articulos: "Fichero Actual: Pileta Roma 6x3 + Kit", importe: "$4.850.000", isCurrent: true },
    ],
  },
  "2": {
    nombre: "Rodríguez, Juan", direccion: "San Martín 892", localidad: "Santa Fe, Santa Fe",
    telefono: "342-5129381", email: "jrodriguez@hotmail.com", dni: "28.914.512", fechaAlta: "20 Mar, 2024", estado: "Moroso",
    ficheroActual: {
      fecha: "02 Ago, 2024", vendedor: "Martín Maibach", comision: "5% ($157.500)",
      items: [
        { desc: "Pileta Modelo Venecia 5x2.5 (Instalada)", cant: "Cant: 1 × $2.500.000", precio: "$2.500.000" },
        { desc: "Bomba Vulcano 1/2 HP + Accesorios", cant: "Cant: 1 × $340.000", precio: "$340.000" },
        { desc: "Skimmer plástico + Escalera", cant: "Cant: 1 × $180.000", precio: "$180.000" },
        { desc: "Kit de limpieza completo", cant: "Cant: 1 × $45.000", precio: "$45.000" },
      ],
      total: "$3.150.000",
      costos: {
        venta: "$3.150.000", proveedor: "Piletecno SA", costoPiscina: "$1.300.000", instalacion: "$550.000",
        equipoFiltrado: "$340.000", manoObraVereda: "No aplica", comision: "$157.500",
        totalCostos: "$2.347.500", margenNeto: "$802.500", margenPct: "25.5%",
      },
      pagos: [
        { id: 101, fecha: "05 Ago, 2024", monto: 500000, metodo: "Efectivo", comprobante: "", observaciones: "Seña para arrancar" },
        { id: 102, fecha: "20 Ago, 2024", monto: 300000, metodo: "Transferencia", comprobante: "TR-78234", observaciones: "" },
      ],
      cuotas: [],
    },
    historial: [
      { fecha: "02 Ago, 2024", vendedor: "Martín M.", articulos: "Fichero Actual: Pileta Venecia 5×2.5 + Kit", importe: "$3.150.000", isCurrent: true },
    ],
  },
  "3": {
    nombre: "Fernández, María", direccion: "Av. Libertador 1250", localidad: "Rosario, Santa Fe",
    telefono: "341-5558923", email: "mfernandez@gmail.com", dni: "27.654.321", fechaAlta: "10 Jun, 2024", estado: "Activo",
    ficheroActual: {
      fecha: "15 Jun, 2024", vendedor: "Martín Maibach", comision: "5% ($100.000)",
      items: [
        { desc: "Pileta Modelo Florencia 7x3.5 (Instalada)", cant: "Cant: 1 × $2.000.000", precio: "$2.000.000" },
      ],
      total: "$2.000.000",
      costos: {
        venta: "$2.000.000", proveedor: "Piletecno SA", costoPiscina: "$900.000", instalacion: "$400.000",
        equipoFiltrado: "$300.000", manoObraVereda: "No aplica", comision: "$100.000",
        totalCostos: "$1.700.000", margenNeto: "$300.000", margenPct: "15.0%",
      },
      pagos: [],
      cuotas: [
        { id: 301, nro: 1, fechaVencimiento: "15 Jul, 2024", montoPlanificado: 500000, montoPagado: 500000, fechaPago: "14 Jul, 2024", metodo: "Transferencia", comprobante: "TR-11223", observaciones: "Cuota 1", estado: "Pagada" },
        { id: 302, nro: 2, fechaVencimiento: "15 Ago, 2024", montoPlanificado: 500000, montoPagado: 500000, fechaPago: "15 Ago, 2024", metodo: "Efectivo", comprobante: "", observaciones: "Cuota 2", estado: "Pagada" },
        { id: 303, nro: 3, fechaVencimiento: "15 Sep, 2024", montoPlanificado: 500000, montoPagado: 200000, fechaPago: "18 Sep, 2024", metodo: "Efectivo", comprobante: "", observaciones: "Pago parcial", estado: "Parcial" },
        { id: 304, nro: 4, fechaVencimiento: "15 Oct, 2024", montoPlanificado: 500000, montoPagado: 0, fechaPago: null, metodo: null, comprobante: "", observaciones: "", estado: "Pendiente" },
      ],
    },
    historial: [
      { fecha: "15 Jun, 2024", vendedor: "Martín M.", articulos: "Fichero Actual: Pileta Florencia 7×3.5", importe: "$2.000.000", isCurrent: true },
    ],
  },
};

export const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Moroso: { bg: "#fef3c7", color: "#f59e0b" },
  Inactivo: { bg: "#fee2e2", color: "#ef4444" },
};

export const vendedores = ["Martín Maibach"];

export const metodosPago = ["Efectivo", "Transferencia", "Tarjeta de Crédito", "Tarjeta de Débito", "Cheque", "Mercado Pago", "Otro"];

export const metodoColor: Record<string, string> = {
  Efectivo: "#10b981",
  Transferencia: "#0ea5e9",
  "Tarjeta de Crédito": "#8b5cf6",
  "Tarjeta de Débito": "#6366f1",
  Cheque: "#f59e0b",
  "Mercado Pago": "#00befc",
  Otro: "#64748b",
};

export function formatCurrency(value: number): string {
  return "$" + value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}

export function getCurrentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

export function getFicheroResumen(items: FicheroItem[]): string {
  const descs = items.filter((i) => i.desc.trim()).map((i) => i.desc.trim());
  if (descs.length === 0) return "Sin artículos";
  if (descs.length <= 2) return descs.join(" + ");
  return `${descs[0]} + ${descs.length - 1} más`;
}
