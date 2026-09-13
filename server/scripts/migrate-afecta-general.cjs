const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "espacio.db");
const db = new Database(dbPath);

try {
  db.prepare("SELECT afecta_general FROM cajas LIMIT 1").get();
  console.log("Column afecta_general already exists");
} catch (e) {
  db.exec("ALTER TABLE cajas ADD COLUMN afecta_general INTEGER NOT NULL DEFAULT 1");
  db.prepare("UPDATE cajas SET afecta_general = 0 WHERE nombre = 'Dólares'").run();
  console.log("Migration done: added afecta_general, set Dólares to 0");
}

console.table(db.prepare("SELECT id, nombre, afecta_general FROM cajas").all());
db.close();
