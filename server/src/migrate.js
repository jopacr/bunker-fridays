import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "./db.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate() {
  await pool.query("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, ts TIMESTAMPTZ DEFAULT now())");
  const done = new Set((await pool.query("SELECT name FROM _migrations")).rows.map((r) => r.name));
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    console.log("migrating", f);
    await pool.query(readFileSync(join(dir, f), "utf8"));
    await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [f]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().then(() => { console.log("migrations complete"); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
