import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
});

export const ficheros = sqliteTable("ficheros", {
  id: text("id").primaryKey(),
  clienteId: text("cliente_id").notNull().references(() => clientes.id, { onDelete: "cascade" }),
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
});

export const cuotas = sqliteTable("cuotas", {
  id: text("id").primaryKey(),
  ficheroId: text("fichero_id").notNull().references(() => ficheros.id, { onDelete: "cascade" }),
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
});
