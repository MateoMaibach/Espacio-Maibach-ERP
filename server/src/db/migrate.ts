import { db, sqlite } from "./index.js"

async function migrate() {
  console.log("Creando tablas...")

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
  `)

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
  `)

  // Migración para DBs existentes

  const columns = sqlite.prepare("PRAGMA table_info(ficheros)").all() as {
    name: string
  }[]

  const hasPagoInicial = columns.some((c) => c.name === "pago_inicial")

  if (!hasPagoInicial) {
    console.log("Agregando columna pago_inicial...")

    db.run(
      "ALTER TABLE ficheros ADD COLUMN pago_inicial INTEGER NOT NULL DEFAULT 0",
    )
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
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS bancos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `)

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
  `)

  const chequesCols = sqlite.prepare("PRAGMA table_info(cheques)").all() as {
    name: string
  }[]

  if (!chequesCols.some((c) => c.name === "aplica_pago_proveedor")) {
    console.log("Agregando columnas de pago a proveedor a cheques...")

    db.run(
      "ALTER TABLE cheques ADD COLUMN aplica_pago_proveedor INTEGER NOT NULL DEFAULT 0",
    )

    db.run("ALTER TABLE cheques ADD COLUMN proveedor_id TEXT")
  }

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS equipos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      encargado TEXT NOT NULL,
      empleados TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS instalaciones (
      id TEXT PRIMARY KEY,
      fichero_id TEXT NOT NULL REFERENCES ficheros(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      equipo_id TEXT REFERENCES equipos(id) ON DELETE SET NULL,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      notas TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS veredas (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      fecha TEXT NOT NULL,
      equipo_id TEXT REFERENCES equipos(id) ON DELETE SET NULL,
      estado TEXT NOT NULL DEFAULT 'Pendiente',
      notas TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  db.run(/*sql*/ `
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
    )
  `)

  db.run(/*sql*/ `
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
    )
  `)

  db.run(/*sql*/ `
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
    )
  `)

  const comprasCols = sqlite.prepare("PRAGMA table_info(compras)").all() as {
    name: string
  }[]

  if (!comprasCols.some((c) => c.name === "ingreso_estado")) {
    console.log("Agregando columna ingreso_estado a compras...")

    db.run(
      "ALTER TABLE compras ADD COLUMN ingreso_estado TEXT NOT NULL DEFAULT 'Pendiente'",
    )
  }

  if (!comprasCols.some((c) => c.name === "recepciones")) {
    console.log("Agregando columna recepciones a compras...")

    db.run(
      "ALTER TABLE compras ADD COLUMN recepciones TEXT NOT NULL DEFAULT '[]'",
    )
  }

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS depositos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      direccion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS articulos (
      id TEXT PRIMARY KEY,
      codigo TEXT,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'un',
      costo_unitario INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS stock (
      id TEXT PRIMARY KEY,
      deposito_id TEXT NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
      articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
      cantidad INTEGER NOT NULL DEFAULT 0,
      costo_promedio INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `)

  db.run(
    "CREATE UNIQUE INDEX IF NOT EXISTS stock_deposito_articulo_uq ON stock (deposito_id, articulo_id)",
  )

  db.run(/*sql*/ `
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
    )
  `)

  db.run(/*sql*/ `
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
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS remito_items (
      id TEXT PRIMARY KEY,
      remito_id TEXT NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
      articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE RESTRICT,
      cantidad INTEGER NOT NULL,
      costo_unitario INTEGER NOT NULL DEFAULT 0,
      subtotal INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.run(/*sql*/ `
    CREATE TABLE IF NOT EXISTS historial_costos (
      id TEXT PRIMARY KEY,
      articulo_id TEXT NOT NULL REFERENCES articulos(id) ON DELETE CASCADE,
      costo INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      origen TEXT NOT NULL,
      referencia_id TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  console.log("Tablas creadas correctamente.")
}

migrate().catch(console.error)
