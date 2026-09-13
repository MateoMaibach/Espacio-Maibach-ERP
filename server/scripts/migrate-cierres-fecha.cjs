const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "espacio.db");
const db = new Database(dbPath);

try {
  db.prepare("SELECT fecha FROM cierres LIMIT 1").get();
  console.log("Column fecha already exists in cierres");
} catch (e) {
  db.exec("ALTER TABLE cierres ADD COLUMN fecha TEXT NOT NULL DEFAULT ''");
  console.log("Migration done: added fecha column to cierres");
}

console.log("Cierres table structure:");
console.log(db.prepare("PRAGMA table_info(cierres)").all().map(c => c.name).join(", "));
db.close();
