import { db, sqlite } from "./index.js";

async function migrate() {
  console.log("Creando tablas...");

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      cuit TEXT,
      email TEXT,
      telefono TEXT,
      direccion TEXT,
      localidad TEXT,
      dni TEXT,
      estado TEXT NOT NULL DEFAULT 'Activo',
      vendedor TEXT NOT NULL DEFAULT 'Martín Maibach',
      metodo_pago TEXT,
      notas TEXT,
      fecha_alta TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS ficheros (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      vendedor TEXT NOT NULL,
      comision TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total TEXT NOT NULL DEFAULT '$0',
      costos TEXT,
      tipo_cobro TEXT NOT NULL DEFAULT 'libre',
      cant_cuotas INTEGER NOT NULL DEFAULT 0,
      pago_inicial INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at INTEGER NOT NULL
    )
  `);

  // Migración para DBs existentes
  const columns = sqlite.prepare("PRAGMA table_info(ficheros)").all() as { name: string }[];
  const hasPagoInicial = columns.some((c) => c.name === "pago_inicial");
  if (!hasPagoInicial) {
    console.log("Agregando columna pago_inicial...");
    db.run("ALTER TABLE ficheros ADD COLUMN pago_inicial INTEGER NOT NULL DEFAULT 0");
  }

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS cuotas (
      id TEXT PRIMARY KEY,
      fichero_id TEXT NOT NULL REFERENCES ficheros(id) ON DELETE CASCADE,
      nro_cuota INTEGER NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      monto_planificado INTEGER NOT NULL,
      monto_pagado INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      fecha_pago TEXT,
      metodo TEXT,
      comprobante TEXT,
      observaciones TEXT,
      descripcion TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS bancos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(/*sql*/ `
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
    )
  `);

  const chequesCols = sqlite.prepare("PRAGMA table_info(cheques)").all() as { name: string }[];
  if (!chequesCols.some((c) => c.name === "aplica_pago_proveedor")) {
    console.log("Agregando columnas de pago a proveedor a cheques...");
    db.run("ALTER TABLE cheques ADD COLUMN aplica_pago_proveedor INTEGER NOT NULL DEFAULT 0");
    db.run("ALTER TABLE cheques ADD COLUMN proveedor_id TEXT");
  }

  console.log("Tablas creadas correctamente.");
}

migrate().catch(console.error);
