import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"

export const clientes = sqliteTable("clientes", {
  id: text("id").primaryKey(),

  nombre: text("nombre").notNull(),

  cuit: text("cuit"),

  email: text("email"),

  telefono: text("telefono"),

  direccion: text("direccion"),

  localidad: text("localidad"),

  dni: text("dni"),

  estado: text("estado").notNull().default("Activo"),

  vendedor: text("vendedor").notNull().default("Martín Maibach"),

  metodoPago: text("metodo_pago"),

  notas: text("notas"),

  fechaAlta: text("fecha_alta").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const ficheros = sqliteTable("ficheros", {
  id: text("id").primaryKey(),

  clienteId: text("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "cascade" }),

  fecha: text("fecha").notNull(),

  vendedor: text("vendedor").notNull(),

  comision: text("comision"),

  items: text("items").notNull().default("[]"),

  total: text("total").notNull().default("$0"),

  costos: text("costos"),

  tipoCobro: text("tipo_cobro").notNull().default("libre"),

  cantCuotas: integer("cant_cuotas").notNull().default(0),

  pagoInicial: integer("pago_inicial").notNull().default(0),

  estado: text("estado").notNull().default("pendiente"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const cuotas = sqliteTable("cuotas", {
  id: text("id").primaryKey(),

  ficheroId: text("fichero_id")
    .notNull()
    .references(() => ficheros.id, { onDelete: "cascade" }),

  nroCuota: integer("nro_cuota").notNull(),

  fechaVencimiento: text("fecha_vencimiento").notNull(),

  montoPlanificado: integer("monto_planificado").notNull(),

  montoPagado: integer("monto_pagado").notNull().default(0),

  estado: text("estado").notNull().default("Pendiente"),

  fechaPago: text("fecha_pago"),

  metodo: text("metodo"),

  comprobante: text("comprobante"),

  observaciones: text("observaciones"),

  descripcion: text("descripcion"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const cajas = sqliteTable("cajas", {
  id: text("id").primaryKey(),

  nombre: text("nombre").notNull(),

  color: text("color").notNull(),

  orden: integer("orden").notNull().default(0),

  activa: integer("activa").notNull().default(1),

  afectaGeneral: integer("afecta_general").notNull().default(1),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const movimientos = sqliteTable("movimientos", {
  id: text("id").primaryKey(),

  fecha: text("fecha").notNull(),

  concepto: text("concepto").notNull(),

  monto: integer("monto").notNull(),

  tipo: text("tipo").notNull(),

  subCaja: text("sub_caja").notNull(),

  moneda: text("moneda").notNull().default("ARS"),

  tipoCambio: integer("tipo_cambio"),

  categoria: text("categoria"),

  comprobante: text("comprobante"),

  observaciones: text("observaciones"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const cierres = sqliteTable("cierres", {
  id: text("id").primaryKey(),

  mes: integer("mes").notNull(),

  anio: integer("anio").notNull(),

  subCaja: text("sub_caja").notNull(),

  saldoInicial: integer("saldo_inicial").notNull(),

  saldoFinal: integer("saldo_final").notNull(),

  saldoReal: integer("saldo_real").notNull(),

  diferencia: integer("diferencia").notNull().default(0),

  fecha: text("fecha").notNull(),

  fechaCierre: text("fecha_cierre").notNull(),

  observaciones: text("observaciones"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const bancos = sqliteTable("bancos", {
  id: text("id").primaryKey(),

  nombre: text("nombre").notNull().unique(),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const equipos = sqliteTable("equipos", {
  id: text("id").primaryKey(),

  nombre: text("nombre").notNull(),

  encargado: text("encargado").notNull(),

  empleados: text("empleados").notNull().default("[]"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const instalaciones = sqliteTable("instalaciones", {
  id: text("id").primaryKey(),

  ficheroId: text("fichero_id")
    .notNull()
    .references(() => ficheros.id, { onDelete: "cascade" }),

  fecha: text("fecha").notNull(),

  equipoId: text("equipo_id").references(() => equipos.id, {
    onDelete: "set null",
  }),

  estado: text("estado").notNull().default("Pendiente"),

  notas: text("notas"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const veredas = sqliteTable("veredas", {
  id: text("id").primaryKey(),

  clienteId: text("cliente_id")
    .notNull()
    .references(() => clientes.id, { onDelete: "cascade" }),

  fecha: text("fecha").notNull(),

  equipoId: text("equipo_id").references(() => equipos.id, {
    onDelete: "set null",
  }),

  estado: text("estado").notNull().default("Pendiente"),

  notas: text("notas"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const proveedores = sqliteTable("proveedores", {
  id: text("id").primaryKey(),

  razonSocial: text("razon_social").notNull(),

  cuit: text("cuit"),

  contacto: text("contacto"),

  email: text("email"),

  telefono: text("telefono"),

  direccion: text("direccion"),

  localidad: text("localidad"),

  rubro: text("rubro"),

  estado: text("estado").notNull().default("Activo"),

  cbu: text("cbu"),

  alias: text("alias"),

  notas: text("notas"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const compras = sqliteTable("compras", {
  id: text("id").primaryKey(),

  proveedorId: text("proveedor_id")
    .notNull()
    .references(() => proveedores.id, { onDelete: "cascade" }),

  fecha: text("fecha").notNull(),

  descripcion: text("descripcion"),

  moneda: text("moneda").notNull().default("ARS"),

  tipoCambio: integer("tipo_cambio"),

  total: integer("total").notNull().default(0),

  items: text("items").notNull().default("[]"),

  estado: text("estado").notNull().default("Pendiente"),

  ingresoEstado: text("ingreso_estado").notNull().default("Pendiente"),

  recepciones: text("recepciones").notNull().default("[]"),

  observaciones: text("observaciones"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const ordenesPago = sqliteTable("ordenes_pago", {
  id: text("id").primaryKey(),

  numero: integer("numero").notNull(),

  proveedorId: text("proveedor_id")
    .notNull()
    .references(() => proveedores.id, { onDelete: "restrict" }),

  fecha: text("fecha").notNull(),

  concepto: text("concepto").notNull(),

  estado: text("estado").notNull().default("Pagada"),

  detalles: text("detalles").notNull().default("[]"),

  comprasPagadas: text("compras_pagadas").notNull().default("[]"),

  movimientoIds: text("movimiento_ids").notNull().default("[]"),

  observaciones: text("observaciones"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const cheques = sqliteTable("cheques", {
  id: text("id").primaryKey(),

  tipo: text("tipo").notNull(),

  banco: text("banco").notNull(),

  sucursal: text("sucursal"),

  numero: text("numero").notNull(),

  recibidoDe: text("recibido_de"),

  destinatario: text("destinatario"),

  fechaEmision: text("fecha_emision"),

  fechaCobro: text("fecha_cobro").notNull(),

  fechaPago: text("fecha_pago"),

  fechaRecepcion: text("fecha_recepcion"),

  entregadoA: text("entregado_a"),

  fechaEntrega: text("fecha_entrega"),

  importe: integer("importe").notNull(),

  estado: text("estado").notNull(),

  clienteId: text("cliente_id").references(() => clientes.id, {
    onDelete: "set null",
  }),

  aplicaPagoProveedor: integer("aplica_pago_proveedor").notNull().default(0),

  proveedorId: text("proveedor_id"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const depositos = sqliteTable("depositos", {
  id: text("id").primaryKey(),

  nombre: text("nombre").notNull().unique(),

  direccion: text("direccion"),

  activo: integer("activo").notNull().default(1),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const articulos = sqliteTable("articulos", {
  id: text("id").primaryKey(),

  codigo: text("codigo"),

  nombre: text("nombre").notNull(),

  unidad: text("unidad").notNull().default("un"),

  costoUnitario: integer("costo_unitario").notNull().default(0),

  activo: integer("activo").notNull().default(1),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const stock = sqliteTable(
  "stock",
  {
    id: text("id").primaryKey(),

    depositoId: text("deposito_id")
      .notNull()
      .references(() => depositos.id, { onDelete: "cascade" }),

    articuloId: text("articulo_id")
      .notNull()
      .references(() => articulos.id, { onDelete: "cascade" }),

    cantidad: integer("cantidad").notNull().default(0),

    costoPromedio: integer("costo_promedio").notNull().default(0),

    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("stock_deposito_articulo_uq").on(t.depositoId, t.articuloId)],
)

export const movimientosStock = sqliteTable("movimientos_stock", {
  id: text("id").primaryKey(),

  fecha: text("fecha").notNull(),

  tipo: text("tipo").notNull(),

  articuloId: text("articulo_id")
    .notNull()
    .references(() => articulos.id, { onDelete: "restrict" }),

  depositoOrigenId: text("deposito_origen_id").references(() => depositos.id, {
    onDelete: "set null",
  }),

  depositoDestinoId: text("deposito_destino_id").references(
    () => depositos.id,
    { onDelete: "set null" },
  ),

  cantidad: integer("cantidad").notNull(),

  costoUnitario: integer("costo_unitario").notNull().default(0),

  referenciaTipo: text("referencia_tipo"),

  referenciaId: text("referencia_id"),

  motivo: text("motivo"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const remitos = sqliteTable("remitos", {
  id: text("id").primaryKey(),

  numero: integer("numero").notNull(),

  tipo: text("tipo").notNull(),

  depositoOrigenId: text("deposito_origen_id")
    .notNull()
    .references(() => depositos.id, { onDelete: "restrict" }),

  depositoDestinoId: text("deposito_destino_id").references(
    () => depositos.id,
    { onDelete: "set null" },
  ),

  destino: text("destino"),

  fecha: text("fecha").notNull(),

  estado: text("estado").notNull().default("Emitido"),

  valorTotal: integer("valor_total").notNull().default(0),

  observaciones: text("observaciones"),

  movimientoIds: text("movimiento_ids").notNull().default("[]"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})

export const remitoItems = sqliteTable("remito_items", {
  id: text("id").primaryKey(),

  remitoId: text("remito_id")
    .notNull()
    .references(() => remitos.id, { onDelete: "cascade" }),

  articuloId: text("articulo_id")
    .notNull()
    .references(() => articulos.id, { onDelete: "restrict" }),

  cantidad: integer("cantidad").notNull(),

  costoUnitario: integer("costo_unitario").notNull().default(0),

  subtotal: integer("subtotal").notNull().default(0),
})

export const historialCostos = sqliteTable("historial_costos", {
  id: text("id").primaryKey(),

  articuloId: text("articulo_id")
    .notNull()
    .references(() => articulos.id, { onDelete: "cascade" }),

  costo: integer("costo").notNull(),

  fecha: text("fecha").notNull(),

  origen: text("origen").notNull(),

  referenciaId: text("referencia_id"),

  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
})
