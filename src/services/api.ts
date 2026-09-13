const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

// --- Clientes ---
export function getClientes() {
  return request<any[]>("/clientes");
}

export function getCliente(id: string) {
  return request<any>(`/clientes/${id}`);
}

export function createCliente(data: {
  id: string;
  nombre: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  localidad?: string;
  dni?: string;
  estado?: string;
  vendedor?: string;
  fechaAlta: string;
}) {
  return request<{ ok: true }>("/clientes", { method: "POST", body: JSON.stringify(data) });
}

export function updateCliente(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/clientes/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteCliente(id: string) {
  return request<{ ok: true }>(`/clientes/${id}`, { method: "DELETE" });
}

// --- Ficheros ---
export function saveFichero(clienteId: string, data: {
  fecha: string;
  vendedor: string;
  comision?: string;
  items?: any[];
  total?: string;
  costos?: any;
  tipoCobro?: string;
  cantCuotas?: number;
}) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero`, { method: "POST", body: JSON.stringify(data) });
}

export function deleteFichero(clienteId: string) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero`, { method: "DELETE" });
}

// --- Pago Inicial ---
export function registrarPagoInicial(clienteId: string, data: { monto: number; metodo?: string; comprobante?: string; observaciones?: string }) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/pago-inicial`, { method: "POST", body: JSON.stringify(data) });
}

// --- Cuotas ---
export function generarPlanCuotas(clienteId: string, cantCuotas: number, fechaPrimerVto: string) {
  return request<{ ok: true; cuotasGeneradas: number }>(`/clientes/${clienteId}/fichero/cuotas/generar`, {
    method: "POST",
    body: JSON.stringify({ cantCuotas, fechaPrimerVto }),
  });
}

export function agregarCargo(clienteId: string, data: { fechaVencimiento: string; monto: number; descripcion?: string }) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas`, { method: "POST", body: JSON.stringify(data) });
}

export function editarCuota(clienteId: string, cuotaId: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas/${cuotaId}`, { method: "PUT", body: JSON.stringify(data) });
}

export function registrarCobro(clienteId: string, cuotaId: string, data: { monto: number; metodo?: string; comprobante?: string; observaciones?: string }) {
  return request<{ ok: true; nuevoEstado: string; montoPagado: number }>(`/clientes/${clienteId}/fichero/cuotas/${cuotaId}/cobrar`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function eliminarCuota(clienteId: string, cuotaId: string) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas/${cuotaId}`, { method: "DELETE" });
}

// --- Caja ---
export interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  tipo: "ingreso" | "egreso";
  subCaja: "Efectivo" | "Bancos" | "Cheques" | "Dólares";
  moneda: string;
  tipoCambio: number | null;
  categoria: string | null;
  comprobante: string | null;
  observaciones: string | null;
  createdAt: Date;
}

export interface Cierre {
  id: string;
  mes: number;
  anio: number;
  subCaja: string;
  saldoInicial: number;
  saldoFinal: number;
  saldoReal: number;
  diferencia: number;
  fecha: string;
  fechaCierre: string;
  observaciones: string | null;
  createdAt: Date;
}

export interface CierrePreview {
  saldoInicial: number;
  saldoFinal: number;
  saldoEsperado: number;
}

export interface ResumenCaja {
  subCajas: Record<string, { total: number; ingresos: number; egresos: number }>;
  totalIngresos: number;
  totalEgresos: number;
  gananciaNeta: number;
}

export function getMovimientos(mes: number, anio: number, subCaja?: string) {
  const params = new URLSearchParams({ mes: String(mes), anio: String(anio) });
  if (subCaja && subCaja !== "Todas") params.set("subCaja", subCaja);
  return request<Movimiento[]>(`/caja/movimientos?${params}`);
}

export function createMovimiento(data: {
  fecha?: string;
  concepto: string;
  monto: number;
  tipo: "ingreso" | "egreso";
  subCaja: string;
  moneda?: string;
  tipoCambio?: number;
  categoria?: string;
  comprobante?: string;
  observaciones?: string;
}) {
  return request<{ ok: true; id: string }>("/caja/movimientos", { method: "POST", body: JSON.stringify(data) });
}

export function updateMovimiento(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/caja/movimientos/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteMovimiento(id: string) {
  return request<{ ok: true }>(`/caja/movimientos/${id}`, { method: "DELETE" });
}

export function getCierres(_mes: number, _anio: number) {
  return request<Cierre[]>(`/caja/cierres`);
}

export function getCierresPreview(mes: number, anio: number, subCaja: string) {
  return request<CierrePreview>(`/caja/cierres/preview?mes=${mes}&anio=${anio}&subCaja=${encodeURIComponent(subCaja)}`);
}

export function realizarCierre(data: { mes: number; anio: number; subCaja: string; saldoReal: number; observaciones?: string; fecha?: string }) {
  return request<{ ok: true; id: string; diferencia: number }>("/caja/cierres", { method: "POST", body: JSON.stringify(data) });
}

export function getResumenCaja(mes: number, anio: number) {
  return request<ResumenCaja>(`/caja/resumen?mes=${mes}&anio=${anio}`);
}

// --- Cajas ---
export interface CajaItem {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  activa: number;
  afectaGeneral: number;
  createdAt: Date;
}

export function getCajas() {
  return request<CajaItem[]>("/cajas");
}

export function getCajasActivas() {
  return request<CajaItem[]>("/caja/cajas");
}

export function createCaja(data: { nombre: string; color: string; orden?: number }) {
  return request<{ ok: true; id: string }>("/cajas", { method: "POST", body: JSON.stringify(data) });
}

export function updateCaja(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/cajas/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteCaja(id: string) {
  return request<{ ok: true }>(`/cajas/${id}`, { method: "DELETE" });
}
