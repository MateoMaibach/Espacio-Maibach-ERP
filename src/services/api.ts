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
