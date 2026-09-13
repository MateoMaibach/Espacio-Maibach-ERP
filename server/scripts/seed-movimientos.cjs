const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "espacio.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Delete old seed data
sqlite.prepare("DELETE FROM movimientos WHERE id LIKE 'mov_seed_%'").run();
console.log("Eliminados movimientos seed anteriores");

const now = Date.now();

const movimientos = [
  // Efectivo
  { fecha: "2026-09-01", concepto: "Cobro Seña Piletta López", monto: 150000, tipo: "ingreso", subCaja: "Efectivo", categoria: "Cobro cliente" },
  { fecha: "2026-09-03", concepto: "Pago Logística interna", monto: 35000, tipo: "egreso", subCaja: "Efectivo", categoria: "Logística" },
  { fecha: "2026-09-05", concepto: "Cobro cuota 1/6 García", monto: 80000, tipo: "ingreso", subCaja: "Efectivo", categoria: "Cobro cuota" },
  { fecha: "2026-09-07", concepto: "Compra de insumos varios", monto: 22000, tipo: "egreso", subCaja: "Efectivo", categoria: "Insumos" },
  { fecha: "2026-09-09", concepto: "Venta accesorios piletta", monto: 48500, tipo: "ingreso", subCaja: "Efectivo", categoria: "Otro" },

  // Bancos
  { fecha: "2026-09-02", concepto: "Transferencia Ruiz Hnos.", monto: 320000, tipo: "ingreso", subCaja: "Bancos", categoria: "Transferencia recibida" },
  { fecha: "2026-09-04", concepto: "Pago proveedor fibra", monto: 180000, tipo: "egreso", subCaja: "Bancos", categoria: "Pago proveedor" },
  { fecha: "2026-09-06", concepto: "Débito auto. seguro taller", monto: 45000, tipo: "egreso", subCaja: "Bancos", categoria: "Servicios" },
  { fecha: "2026-09-08", concepto: "Depósito del día", monto: 200000, tipo: "ingreso", subCaja: "Bancos", categoria: "Otro" },

  // Cheques
  { fecha: "2026-09-01", concepto: "Cheque García Roberto", monto: 450000, tipo: "ingreso", subCaja: "Cheques", categoria: "Cobro cliente" },
  { fecha: "2026-09-10", concepto: "Cheque Albornoz Lucía", monto: 600000, tipo: "ingreso", subCaja: "Cheques", categoria: "Cobro cliente" },

  // Dólares
  { fecha: "2026-09-03", concepto: "Cobro seña en USD Martínez", monto: 500, tipo: "ingreso", subCaja: "Dólares", moneda: "USD", tipoCambio: 1200, categoria: "Cobro cliente" },
  { fecha: "2026-09-06", concepto: "Compra material importado", monto: 300, tipo: "egreso", subCaja: "Dólares", moneda: "USD", tipoCambio: 1200, categoria: "Pago proveedor" },

  // Más movimientos
  { fecha: "2026-09-10", concepto: "Cobro seña Fernández", monto: 200000, tipo: "ingreso", subCaja: "Efectivo", categoria: "Seña" },
  { fecha: "2026-09-11", concepto: "Sueldos personal", monto: 280000, tipo: "egreso", subCaja: "Bancos", categoria: "Sueldos" },
  { fecha: "2026-09-11", concepto: "Cobro cuota 2/4 Fernández", monto: 120000, tipo: "ingreso", subCaja: "Bancos", categoria: "Cobro cuota" },
  { fecha: "2026-09-12", concepto: "Pago alquiler depósito", monto: 150000, tipo: "egreso", subCaja: "Bancos", categoria: "Alquiler" },
  { fecha: "2026-09-12", concepto: "Cobro limpieza piscinas", monto: 35000, tipo: "ingreso", subCaja: "Efectivo", categoria: "Cobro cliente" },
  { fecha: "2026-09-13", concepto: "Impuestos municipal", monto: 67000, tipo: "egreso", subCaja: "Bancos", categoria: "Impuestos" },
  { fecha: "2026-09-13", concepto: "Cheque Rodríguez Juan", monto: 320000, tipo: "ingreso", subCaja: "Cheques", categoria: "Cobro cliente" },
];

const insert = sqlite.prepare(`
  INSERT OR IGNORE INTO movimientos (id, fecha, concepto, monto, tipo, sub_caja, moneda, tipo_cambio, categoria, comprobante, observaciones, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = sqlite.transaction((movs) => {
  for (let i = 0; i < movs.length; i++) {
    const m = movs[i];
    const id = `mov_seed_${i + 1}`;
    insert.run(
      id,
      m.fecha,
      m.concepto,
      m.monto,
      m.tipo,
      m.subCaja,
      m.moneda || "ARS",
      m.tipoCambio || null,
      m.categoria || null,
      null,
      null,
      now - (movs.length - i) * 86400000
    );
  }
});

insertMany(movimientos);
console.log(`Insertados ${movimientos.length} movimientos con fechas ISO`);

const total = sqlite.prepare("SELECT COUNT(*) as count FROM movimientos").get();
console.log(`Total movimientos en DB: ${total.count}`);

sqlite.close();
