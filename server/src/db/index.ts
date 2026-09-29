import Database from "better-sqlite3"

import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "./schema.js"

import { config } from "dotenv"

import { resolve } from "path"

config({ path: resolve(import.meta.dirname, "../../.env") })

const dbPath = resolve(
  import.meta.dirname,
  "../..",
  process.env.DATABASE_URL || "./data/espacio.db",
)

const sqlite = new Database(dbPath)

sqlite.pragma("journal_mode = WAL")

sqlite.pragma("foreign_keys = ON")

export const db = drizzle(sqlite, { schema })

export { sqlite }

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS cajas (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    color TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    activa INTEGER NOT NULL DEFAULT 1,
    afecta_general INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movimientos (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    sub_caja TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'ARS',
    tipo_cambio INTEGER,
    categoria TEXT,
    comprobante TEXT,
    observaciones TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cierres (
    id TEXT PRIMARY KEY,
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    sub_caja TEXT NOT NULL,
    saldo_inicial INTEGER NOT NULL,
    saldo_final INTEGER NOT NULL,
    saldo_real INTEGER NOT NULL,
    diferencia INTEGER NOT NULL DEFAULT 0,
    fecha TEXT NOT NULL,
    fecha_cierre TEXT NOT NULL,
    observaciones TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bancos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cheques (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    banco TEXT NOT NULL,
    sucursal TEXT,
    numero TEXT NOT NULL,
    recibido_de TEXT,
    destinatario TEXT,
    fecha_emision TEXT,
    fecha_cobro TEXT NOT NULL,
    fecha_pago TEXT,
    fecha_recepcion TEXT,
    entregado_a TEXT,
    fecha_entrega TEXT,
    importe INTEGER NOT NULL,
    estado TEXT NOT NULL,
    cliente_id TEXT REFERENCES clientes(id) ON DELETE SET NULL,
    aplica_pago_proveedor INTEGER NOT NULL DEFAULT 0,
    proveedor_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS equipos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    encargado TEXT NOT NULL,
    empleados TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS instalaciones (
    id TEXT PRIMARY KEY,
    fichero_id TEXT NOT NULL REFERENCES ficheros(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    equipo_id TEXT REFERENCES equipos(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    notas TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS veredas (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    equipo_id TEXT REFERENCES equipos(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    notas TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    razon_social TEXT NOT NULL,
    cuit TEXT,
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    localidad TEXT,
    rubro TEXT,
    estado TEXT NOT NULL DEFAULT 'Activo',
    cbu TEXT,
    alias TEXT,
    notas TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY,
    proveedor_id TEXT NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    descripcion TEXT,
    moneda TEXT NOT NULL DEFAULT 'ARS',
    tipo_cambio INTEGER,
    total INTEGER NOT NULL DEFAULT 0,
    items TEXT NOT NULL DEFAULT '[]',
    estado TEXT NOT NULL DEFAULT 'Pendiente',
    ingreso_estado TEXT NOT NULL DEFAULT 'Pendiente',
    recepciones TEXT NOT NULL DEFAULT '[]',
    observaciones TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ordenes_pago (
    id TEXT PRIMARY KEY,
    numero INTEGER NOT NULL,
    proveedor_id TEXT NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
    fecha TEXT NOT NULL,
    concepto TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Pagada',
    detalles TEXT NOT NULL DEFAULT '[]',
    compras_pagadas TEXT NOT NULL DEFAULT '[]',
    movimiento_ids TEXT NOT NULL DEFAULT '[]',
    observaciones TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS depositos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    direccion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articulos (
    id TEXT PRIMARY KEY,
    codigo TEXT,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'un',
    costo_unitario INTEGER NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stock (
    id TEXT PRIMARY KEY,
    deposito_id TEXT NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
    articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 0,
    costo_promedio INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS stock_deposito_articulo_uq
    ON stock (deposito_id, articulo_id);

  CREATE TABLE IF NOT EXISTS movimientos_stock (
    id TEXT PRIMARY KEY,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE RESTRICT,
    deposito_origen_id TEXT REFERENCES depositos(id) ON DELETE SET NULL,
    deposito_destino_id TEXT REFERENCES depositos(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL,
    costo_unitario INTEGER NOT NULL DEFAULT 0,
    referencia_tipo TEXT,
    referencia_id TEXT,
    motivo TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS remitos (
    id TEXT PRIMARY KEY,
    numero INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    deposito_origen_id TEXT NOT NULL REFERENCES depositos(id) ON DELETE RESTRICT,
    deposito_destino_id TEXT REFERENCES depositos(id) ON DELETE SET NULL,
    destino TEXT,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Emitido',
    valor_total INTEGER NOT NULL DEFAULT 0,
    observaciones TEXT,
    movimiento_ids TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS remito_items (
    id TEXT PRIMARY KEY,
    remito_id TEXT NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
    articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL,
    costo_unitario INTEGER NOT NULL DEFAULT 0,
    subtotal INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS historial_costos (
    id TEXT PRIMARY KEY,
    articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
    costo INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    origen TEXT NOT NULL,
    referencia_id TEXT,
    created_at INTEGER NOT NULL
  );
`)

// Migration: add pago a proveedor columns to cheques if missing

try {
  sqlite.prepare("SELECT aplica_pago_proveedor FROM cheques LIMIT 1").get()
} catch {
  sqlite.exec(
    "ALTER TABLE cheques ADD COLUMN aplica_pago_proveedor INTEGER NOT NULL DEFAULT 0",
  )

  sqlite.exec("ALTER TABLE cheques ADD COLUMN proveedor_id TEXT")
}

const cajasCount = sqlite
  .prepare("SELECT COUNT(*) as count FROM cajas")
  .get() as { count: number }

if (cajasCount.count === 0) {
  const now = Date.now()

  const insertCaja = sqlite.prepare(
    "INSERT INTO cajas (id, nombre, color, orden, activa, afecta_general, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )

  insertCaja.run("caj_1", "Efectivo", "#3b82f6", 1, 1, 1, now)

  insertCaja.run("caj_2", "Bancos", "#7c3aed", 2, 1, 1, now)

  insertCaja.run("caj_3", "Cheques", "#f59e0b", 3, 1, 1, now)

  insertCaja.run("caj_4", "Dólares", "#10b981", 4, 1, 0, now)
}

// Migration: add afecta_general column if missing

try {
  sqlite.prepare("SELECT afecta_general FROM cajas LIMIT 1").get()
} catch {
  sqlite.exec(
    "ALTER TABLE cajas ADD COLUMN afecta_general INTEGER NOT NULL DEFAULT 1",
  )

  sqlite
    .prepare("UPDATE cajas SET afecta_general = 0 WHERE nombre = 'Dólares'")
    .run()
}

// Migration: add fecha column to cierres if missing

try {
  sqlite.prepare("SELECT fecha FROM cierres LIMIT 1").get()
} catch {
  sqlite.exec("ALTER TABLE cierres ADD COLUMN fecha TEXT NOT NULL DEFAULT ''")
}

// Migration: add ingreso_estado column to compras if missing

try {
  sqlite.prepare("SELECT ingreso_estado FROM compras LIMIT 1").get()
} catch {
  sqlite.exec(
    "ALTER TABLE compras ADD COLUMN ingreso_estado TEXT NOT NULL DEFAULT 'Pendiente'",
  )
}

// Migration: add recepciones column to compras if missing

try {
  sqlite.prepare("SELECT recepciones FROM compras LIMIT 1").get()
} catch {
  sqlite.exec(
    "ALTER TABLE compras ADD COLUMN recepciones TEXT NOT NULL DEFAULT '[]'",
  )
}
