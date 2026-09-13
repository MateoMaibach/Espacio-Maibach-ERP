import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(import.meta.dirname, "../../.env") });

const dbPath = resolve(import.meta.dirname, "../..", process.env.DATABASE_URL || "./data/espacio.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };

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
`);

const cajasCount = sqlite.prepare("SELECT COUNT(*) as count FROM cajas").get() as { count: number };
if (cajasCount.count === 0) {
  const now = Date.now();
  const insertCaja = sqlite.prepare("INSERT INTO cajas (id, nombre, color, orden, activa, afecta_general, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertCaja.run("caj_1", "Efectivo", "#3b82f6", 1, 1, 1, now);
  insertCaja.run("caj_2", "Bancos", "#7c3aed", 2, 1, 1, now);
  insertCaja.run("caj_3", "Cheques", "#f59e0b", 3, 1, 1, now);
  insertCaja.run("caj_4", "Dólares", "#10b981", 4, 1, 0, now);
}

// Migration: add afecta_general column if missing
try {
  sqlite.prepare("SELECT afecta_general FROM cajas LIMIT 1").get();
} catch {
  sqlite.exec("ALTER TABLE cajas ADD COLUMN afecta_general INTEGER NOT NULL DEFAULT 1");
  sqlite.prepare("UPDATE cajas SET afecta_general = 0 WHERE nombre = 'Dólares'").run();
}

// Migration: add fecha column to cierres if missing
try {
  sqlite.prepare("SELECT fecha FROM cierres LIMIT 1").get();
} catch {
  sqlite.exec("ALTER TABLE cierres ADD COLUMN fecha TEXT NOT NULL DEFAULT ''");
}
