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
  return request<{ ok: true }>("/clientes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCliente(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCliente(id: string) {
  return request<{ ok: true }>(`/clientes/${id}`, { method: "DELETE" });
}

// --- Ficheros ---

export function saveFichero(
  clienteId: string,
  data: {
    fecha: string;

    vendedor: string;

    comision?: string;

    items?: any[];

    total?: string;

    costos?: any;

    tipoCobro?: string;

    cantCuotas?: number;
  },
) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteFichero(clienteId: string) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero`, {
    method: "DELETE",
  });
}

// --- Pago Inicial ---

export function registrarPagoInicial(
  clienteId: string,
  data: {
    monto: number;
    metodo?: string;
    comprobante?: string;
    observaciones?: string;
  },
) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/pago-inicial`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Cuotas ---

export function generarPlanCuotas(clienteId: string, cantCuotas: number, fechaPrimerVto: string) {
  return request<{ ok: true; cuotasGeneradas: number }>(
    `/clientes/${clienteId}/fichero/cuotas/generar`,
    {
      method: "POST",

      body: JSON.stringify({ cantCuotas, fechaPrimerVto }),
    },
  );
}

export function agregarCargo(
  clienteId: string,
  data: { fechaVencimiento: string; monto: number; descripcion?: string },
) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function editarCuota(clienteId: string, cuotaId: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas/${cuotaId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function registrarCobro(
  clienteId: string,
  cuotaId: string,
  data: {
    monto: number;
    metodo?: string;
    comprobante?: string;
    observaciones?: string;
  },
) {
  return request<{ ok: true; nuevoEstado: string; montoPagado: number }>(
    `/clientes/${clienteId}/fichero/cuotas/${cuotaId}/cobrar`,
    {
      method: "POST",

      body: JSON.stringify(data),
    },
  );
}

export function eliminarCuota(clienteId: string, cuotaId: string) {
  return request<{ ok: true }>(`/clientes/${clienteId}/fichero/cuotas/${cuotaId}`, {
    method: "DELETE",
  });
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
  return request<{ ok: true; id: string }>("/caja/movimientos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMovimiento(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/caja/movimientos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteMovimiento(id: string) {
  return request<{ ok: true }>(`/caja/movimientos/${id}`, { method: "DELETE" });
}

export function getCierres(_mes: number, _anio: number) {
  return request<Cierre[]>(`/caja/cierres`);
}

export function getCierresPreview(mes: number, anio: number, subCaja: string) {
  return request<CierrePreview>(
    `/caja/cierres/preview?mes=${mes}&anio=${anio}&subCaja=${encodeURIComponent(subCaja)}`,
  );
}

export function realizarCierre(data: {
  mes: number;
  anio: number;
  subCaja: string;
  saldoReal: number;
  observaciones?: string;
  fecha?: string;
}) {
  return request<{ ok: true; id: string; diferencia: number }>("/caja/cierres", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
  return request<{ ok: true; id: string }>("/cajas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCaja(id: string, data: Record<string, any>) {
  return request<{ ok: true }>(`/cajas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCaja(id: string) {
  return request<{ ok: true }>(`/cajas/${id}`, { method: "DELETE" });
}

// --- Cheques ---

export type ChequeTipo = "emitido" | "recibido";

export interface Cheque {
  id: string;

  tipo: ChequeTipo;

  banco: string;

  sucursal: string | null;

  numero: string;

  recibidoDe: string | null;

  destinatario: string | null;

  fechaEmision: string | null;

  fechaCobro: string;

  fechaPago: string | null;

  fechaRecepcion: string | null;

  entregadoA: string | null;

  fechaEntrega: string | null;

  importe: number;

  estado: string;

  clienteId: string | null;

  clienteNombre: string | null;

  aplicaPagoProveedor: number;

  proveedorId: string | null;

  createdAt: Date;
}

export interface ChequeInput {
  tipo: ChequeTipo;

  banco: string;

  sucursal?: string;

  numero: string;

  recibidoDe?: string;

  destinatario?: string;

  fechaEmision?: string;

  fechaCobro: string;

  fechaPago?: string;

  fechaRecepcion?: string;

  entregadoA?: string;

  fechaEntrega?: string;

  importe: number;

  estado?: string;

  clienteId?: string | null;

  aplicaPagoProveedor?: number;

  proveedorId?: string | null;
}

export function getCheques(tipo?: ChequeTipo) {
  const params = tipo ? `?tipo=${tipo}` : "";

  return request<Cheque[]>(`/cheques${params}`);
}

export function getCheque(id: string) {
  return request<Cheque>(`/cheques/${id}`);
}

export function createCheque(data: ChequeInput) {
  return request<{ ok: true; id: string }>("/cheques", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCheque(id: string, data: Partial<ChequeInput>) {
  return request<{ ok: true }>(`/cheques/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCheque(id: string) {
  return request<{ ok: true }>(`/cheques/${id}`, { method: "DELETE" });
}

// --- Bancos ---

export interface Banco {
  id: string;

  nombre: string;

  createdAt: Date;
}

export function getBancos() {
  return request<Banco[]>("/bancos");
}

export function createBanco(data: { nombre: string }) {
  return request<{ ok: true; id: string }>("/bancos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBanco(id: string, data: { nombre?: string }) {
  return request<{ ok: true }>(`/bancos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteBanco(id: string) {
  return request<{ ok: true }>(`/bancos/${id}`, { method: "DELETE" });
}

// --- Calendario: Equipos ---

export interface Equipo {
  id: string;

  nombre: string;

  encargado: string;

  empleados: string[];

  createdAt: Date;
}

export function getEquipos() {
  return request<Equipo[]>("/equipos");
}

export function createEquipo(data: { nombre: string; encargado: string; empleados?: string[] }) {
  return request<{ ok: true; id: string }>("/equipos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEquipo(
  id: string,
  data: { nombre?: string; encargado?: string; empleados?: string[] },
) {
  return request<{ ok: true }>(`/equipos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteEquipo(id: string) {
  return request<{ ok: true }>(`/equipos/${id}`, { method: "DELETE" });
}

// --- Calendario: Instalaciones ---

export type InstalacionEstado = "Pendiente" | "Confirmada" | "En Proceso" | "Completada";

export type VeredaEstado = "Pendiente" | "En Proceso" | "Completada";

export interface Instalacion {
  id: string;

  ficheroId: string;

  fecha: string;

  equipoId: string | null;

  estado: InstalacionEstado;

  notas: string | null;

  createdAt: Date;

  clienteId: string;

  clienteNombre: string;

  clienteDireccion: string | null;

  ficheroItems: {
    desc?: string;
    cant?: string;
    precio?: string;
    precioUnitario?: string;
  }[];

  ficheroTotal: string;

  ficheroFecha: string;

  equipoNombre: string | null;

  equipoEncargado: string | null;
}

export interface Vereda {
  id: string;

  clienteId: string;

  fecha: string;

  equipoId: string | null;

  estado: VeredaEstado;

  notas: string | null;

  createdAt: Date;

  clienteNombre: string;

  clienteDireccion: string | null;

  equipoNombre: string | null;

  equipoEncargado: string | null;
}

export interface VentaDisponible {
  ficheroId: string;

  clienteId: string;

  clienteNombre: string;

  clienteDireccion: string | null;

  fechaVenta: string;

  items: {
    desc?: string;
    cant?: string;
    precio?: string;
    precioUnitario?: string;
  }[];

  total: string;

  estado: string;

  instalacionId: string | null;
}

function rangoParams(desde?: string, hasta?: string) {
  const params = new URLSearchParams();

  if (desde) params.set("desde", desde);

  if (hasta) params.set("hasta", hasta);

  const q = params.toString();

  return q ? `?${q}` : "";
}

export function getInstalaciones(desde?: string, hasta?: string) {
  return request<Instalacion[]>(`/instalaciones${rangoParams(desde, hasta)}`);
}

export function getVentasParaInstalacion() {
  return request<VentaDisponible[]>("/instalaciones/ventas");
}

export function createInstalacion(data: {
  ficheroId: string;
  fecha: string;
  equipoId?: string | null;
  estado?: InstalacionEstado;
  notas?: string;
}) {
  return request<{ ok: true; id: string }>("/instalaciones", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateInstalacion(
  id: string,
  data: Partial<{
    ficheroId: string;
    fecha: string;
    equipoId: string | null;
    estado: InstalacionEstado;
    notas: string;
  }>,
) {
  return request<{ ok: true }>(`/instalaciones/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteInstalacion(id: string) {
  return request<{ ok: true }>(`/instalaciones/${id}`, { method: "DELETE" });
}

// --- Calendario: Veredas ---

export function getVeredas(desde?: string, hasta?: string) {
  return request<Vereda[]>(`/veredas${rangoParams(desde, hasta)}`);
}

export function createVereda(data: {
  clienteId: string;
  fecha: string;
  equipoId?: string | null;
  estado?: VeredaEstado;
  notas?: string;
}) {
  return request<{ ok: true; id: string }>("/veredas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateVereda(
  id: string,
  data: Partial<{
    clienteId: string;
    fecha: string;
    equipoId: string | null;
    estado: VeredaEstado;
    notas: string;
  }>,
) {
  return request<{ ok: true }>(`/veredas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteVereda(id: string) {
  return request<{ ok: true }>(`/veredas/${id}`, { method: "DELETE" });
}

// --- Monedas ---

export function getMonedasCaja() {
  return request<string[]>("/caja/monedas");
}

// --- Proveedores ---

export type ProveedorEstado = "Activo" | "Inactivo" | "Suspendido" | "Pendiente";

export interface SaldoMoneda {
  comprado: number;

  pagado: number;

  saldo: number;
}

export interface Proveedor {
  id: string;

  razonSocial: string;

  cuit: string | null;

  contacto: string | null;

  email: string | null;

  telefono: string | null;

  direccion: string | null;

  localidad: string | null;

  rubro: string | null;

  estado: ProveedorEstado;

  cbu: string | null;

  alias: string | null;

  notas: string | null;

  createdAt: Date;

  saldos: Record<string, SaldoMoneda>;

  ultimaCompra: string | null;
}

export interface ProveedorInput {
  razonSocial: string;

  cuit?: string;

  contacto?: string;

  email?: string;

  telefono?: string;

  direccion?: string;

  localidad?: string;

  rubro?: string;

  estado?: ProveedorEstado;

  cbu?: string;

  alias?: string;

  notas?: string;
}

export function getProveedores() {
  return request<Proveedor[]>("/proveedores");
}

export function getProveedor(id: string) {
  return request<Proveedor>(`/proveedores/${id}`);
}

export function createProveedor(data: ProveedorInput) {
  return request<{ ok: true; id: string }>("/proveedores", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProveedor(id: string, data: Partial<ProveedorInput>) {
  return request<{ ok: true }>(`/proveedores/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteProveedor(id: string) {
  return request<{ ok: true }>(`/proveedores/${id}`, { method: "DELETE" });
}

// --- Compras ---

export type CompraEstado = "Pendiente" | "En Tránsito" | "Recibido";

export type IngresoEstado = "Pendiente" | "Parcial" | "Recibido";

export interface RecepcionLinea {
  itemIndex: number;

  articuloId: string;

  articuloNombre: string;

  cantidad: number;
}

export interface RecepcionCompra {
  id: string;

  fecha: string;

  depositoId: string;

  depositoNombre: string;

  lineas: RecepcionLinea[];

  movimientoIds: string[];
}

export interface PendienteItem {
  itemIndex: number;

  detalle: string | null;

  cantidad: number;

  recibido: number;

  pendiente: number;

  precioUnitario: number;
}

export interface CompraItem {
  detalle: string;

  cantidad: number;

  precioUnitario: number;
}

export interface Compra {
  id: string;

  proveedorId: string;

  fecha: string;

  descripcion: string | null;

  moneda: string;

  tipoCambio: number | null;

  total: number;

  items: CompraItem[] | string;

  estado: CompraEstado;

  ingresoEstado: IngresoEstado;

  recepciones: RecepcionCompra[] | string;

  observaciones: string | null;

  createdAt: Date;
}

export interface CompraInput {
  fecha: string;

  descripcion?: string;

  moneda: string;

  tipoCambio?: number;

  items: CompraItem[];

  estado: CompraEstado;

  observaciones?: string;
}

export function getCompras(proveedorId: string) {
  return request<Compra[]>(`/proveedores/${proveedorId}/compras`);
}

export function createCompra(proveedorId: string, data: CompraInput) {
  return request<{ ok: true; id: string; total: number }>(`/proveedores/${proveedorId}/compras`, {
    method: "POST",

    body: JSON.stringify(data),
  });
}

export function updateCompra(id: string, data: Partial<CompraInput>) {
  return request<{ ok: true; total: number }>(`/compras/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteCompra(id: string) {
  return request<{ ok: true }>(`/compras/${id}`, { method: "DELETE" });
}

export function getRecepciones(compraId: string) {
  return request<{
    recepciones: RecepcionCompra[];
    pendientes: PendienteItem[];
    ingresoEstado: IngresoEstado;
  }>(`/compras/${compraId}/recepciones`);
}

export function createRecepcion(
  compraId: string,
  data: {
    depositoId: string;

    fecha?: string;

    lineas: { itemIndex: number; articuloId: string; cantidad: number }[];
  },
) {
  return request<{
    ok: true;
    id: string;
    movimientos: string[];
    ingresoEstado: IngresoEstado;
    pendientes: PendienteItem[];
  }>(`/compras/${compraId}/recepciones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Órdenes de Pago ---

export type OrdenPagoEstado = "Pagada" | "Anulada";

export interface OrdenPagoDetalle {
  subCaja: string;

  moneda: string;

  tipoCambio: number | null;

  monto: number;

  chequeId: string | null;

  chequeAnterior?: Record<string, unknown> | null;
}

export interface OrdenPagoCompraLink {
  compraId: string;

  monto: number;
}

export interface OrdenPago {
  id: string;

  numero: number;

  etiqueta: string;

  proveedorId: string;

  fecha: string;

  concepto: string;

  estado: OrdenPagoEstado;

  detalles: OrdenPagoDetalle[];

  comprasPagadas: OrdenPagoCompraLink[];

  movimientoIds: string[];

  observaciones: string | null;

  createdAt: Date;
}

export interface OrdenPagoInput {
  fecha: string;

  concepto: string;

  detalles: Omit<OrdenPagoDetalle, "chequeAnterior">[];

  comprasPagadas?: OrdenPagoCompraLink[];

  observaciones?: string;
}

export function getOrdenesPago(proveedorId: string) {
  return request<OrdenPago[]>(`/proveedores/${proveedorId}/ordenes-pago`);
}

export function getOrdenPago(id: string) {
  return request<OrdenPago>(`/ordenes-pago/${id}`);
}

export function createOrdenPago(proveedorId: string, data: OrdenPagoInput) {
  return request<{ ok: true; id: string; numero: string; movimientos: number }>(
    `/proveedores/${proveedorId}/ordenes-pago`,
    {
      method: "POST",

      body: JSON.stringify(data),
    },
  );
}

export function anularOrdenPago(id: string) {
  return request<{ ok: true; movimientosEliminados: number }>(`/ordenes-pago/${id}/anular`, {
    method: "POST",
  });
}

// --- Depósitos ---

export interface Deposito {
  id: string;

  nombre: string;

  direccion: string | null;

  activo: number;

  createdAt: Date;

  articulosConStock?: number;
}

export function getDepositos() {
  return request<Deposito[]>("/depositos");
}

export function createDeposito(data: { nombre: string; direccion?: string }) {
  return request<{ ok: true; id: string }>("/depositos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDeposito(
  id: string,
  data: Partial<{ nombre: string; direccion: string | null; activo: number }>,
) {
  return request<{ ok: true }>(`/depositos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteDeposito(id: string) {
  return request<{ ok: true }>(`/depositos/${id}`, { method: "DELETE" });
}

// --- Artículos ---

export interface Articulo {
  id: string;

  codigo: string | null;

  nombre: string;

  unidad: string;

  costoUnitario: number;

  activo: number;

  createdAt: Date;

  depositos?: number;
}

export interface HistorialCosto {
  id: string;

  articuloId: string;

  costo: number;

  fecha: string;

  origen: string;

  referenciaId: string | null;

  costoAnterior: number | null;

  variacion: number | null;
}

export function getArticulos(params?: { q?: string; activo?: 0 | 1 }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.activo !== undefined) qs.set("activo", String(params.activo));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<Articulo[]>(`/articulos${suffix}`);
}

export function getArticulo(id: string) {
  return request<Articulo>(`/articulos/${id}`);
}

export function createArticulo(data: {
  codigo?: string;

  nombre: string;

  unidad?: string;

  costoUnitario?: number;
}) {
  return request<{ ok: true; id: string }>("/articulos", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateArticulo(
  id: string,
  data: Partial<{
    codigo: string | null;
    nombre: string;
    unidad: string;
    costoUnitario: number;
    activo: number;
  }>,
) {
  return request<{ ok: true }>(`/articulos/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function updateCostoArticulo(id: string, costoUnitario: number) {
  return request<{ ok: true; costo: number }>(`/articulos/${id}/costo`, {
    method: "PUT",
    body: JSON.stringify({ costoUnitario }),
  });
}

export function getHistorialCostos(id: string) {
  return request<{ articulo: Articulo; historial: HistorialCosto[] }>(
    `/articulos/${id}/historial-costos`,
  );
}

export function deleteArticulo(id: string) {
  return request<{ ok: true }>(`/articulos/${id}`, { method: "DELETE" });
}

// --- Stock ---

export interface Existencia {
  id: string;

  depositoId: string;

  articuloId: string;

  cantidad: number;

  costoPromedio: number;

  articuloNombre: string;

  codigo: string | null;

  unidad: string;

  depositoNombre: string;

  valor: number;
}

export interface MovimientoStock {
  id: string;

  fecha: string;

  tipo: "ingreso" | "egreso" | "transferencia" | "ajuste";

  articuloId: string;

  depositoOrigenId: string | null;

  depositoDestinoId: string | null;

  cantidad: number;

  costoUnitario: number;

  referenciaTipo: string | null;

  referenciaId: string | null;

  motivo: string | null;

  articuloNombre: string;

  unidad: string;

  depositoOrigen: string | null;

  depositoDestino: string | null;

  valor: number;

  saldo: number | null;
}

export interface LineaMovimiento {
  articuloId: string;

  cantidad: number;

  costoUnitario?: number;
}

export function getExistencias(params?: { depositoId?: string; articuloId?: string }) {
  const qs = new URLSearchParams();
  if (params?.depositoId) qs.set("depositoId", params.depositoId);
  if (params?.articuloId) qs.set("articuloId", params.articuloId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<{
    rows: Existencia[];
    totalArticulos: number;
    valorTotal: number;
    conStockNegativo: number;
  }>(`/stock${suffix}`);
}

export function getMovimientosStock(params?: {
  desde?: string;

  hasta?: string;

  depositoId?: string;

  articuloId?: string;

  tipo?: string;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<MovimientoStock[]>(`/stock/movimientos${suffix}`);
}

export function createIngresoInicial(data: {
  depositoId: string;

  fecha?: string;

  lineas: LineaMovimiento[];
}) {
  return request<{ ok: true; movimientos: string[] }>("/stock/ingresos-iniciales", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createAjuste(data: {
  depositoId: string;

  fecha?: string;

  motivo: string;

  lineas: LineaMovimiento[];
}) {
  return request<{ ok: true; movimientos: string[] }>("/stock/ajustes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getReporteStockNegativo() {
  return request<{
    rows: (Existencia & { ultimoMovimiento: MovimientoStock | null })[];
    totalUnidades: number;
    valorTotal: number;
  }>("/stock/reportes/negativos");
}

export function getReporteValorizacion(depositoId?: string) {
  const suffix = depositoId ? `?depositoId=${depositoId}` : "";
  return request<{
    rows: (Existencia & { depositoNombre: string })[];
    resumen: {
      depositoId: string;
      depositoNombre: string;
      articulos: number;
      valor: number;
    }[];
    total: number;
  }>(`/stock/reportes/valorizacion${suffix}`);
}

export function getReporteCostos() {
  return request<
    (Articulo & {
      costoActual: number;

      costoAnterior: number | null;

      variacion: number | null;

      registros: number;
    })[]
  >("/stock/reportes/costos");
}

// --- Logística / Remitos ---

export type RemitoTipo = "salida" | "transferencia";

export type RemitoEstado = "Emitido" | "Anulado";

export interface RemitoItem {
  id?: string;

  articuloId: string;

  cantidad: number;

  costoUnitario: number;

  subtotal?: number;

  articuloNombre?: string;

  unidad?: string;

  codigo?: string | null;
}

export interface Remito {
  id: string;

  numero: number;

  etiqueta?: string;

  tipo: RemitoTipo;

  depositoOrigenId: string;

  depositoDestinoId: string | null;

  depositoOrigen?: string;

  depositoDestino?: string | null;

  destino: string | null;

  fecha: string;

  estado: RemitoEstado;

  valorTotal: number;

  observaciones: string | null;

  movimientoIds: string | string[];

  articulos?: number;

  items?: RemitoItem[];

  createdAt: Date;
}

export function getRemitos(params?: {
  tipo?: RemitoTipo;

  depositoId?: string;

  desde?: string;

  hasta?: string;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v) qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<Remito[]>(`/remitos${suffix}`);
}

export function getRemito(id: string) {
  return request<Remito>(`/remitos/${id}`);
}

export function createRemito(data: {
  tipo: RemitoTipo;

  depositoOrigenId: string;

  depositoDestinoId?: string;

  destino?: string;

  fecha?: string;

  observaciones?: string;

  lineas: { articuloId: string; cantidad: number }[];
}) {
  return request<{ ok: true; id: string; numero: number; etiqueta: string; movimientos: string[] }>(
    "/remitos",
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function anularRemito(id: string) {
  return request<{ ok: true; estado: RemitoEstado }>(`/remitos/${id}/anular`, {
    method: "POST",
  });
}
