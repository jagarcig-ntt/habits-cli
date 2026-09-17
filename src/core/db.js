import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Crea y devuelve una conexión a SQLite.
 * Usa ':memory:' para tests o una ruta en disco para producción.
 */
export function crearConexion(ruta = ':memory:') {
  const db = new Database(ruta);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Ejecuta todas las migraciones .sql del directorio dado, en orden alfabético.
 */
export function ejecutarMigraciones(db, dirMigraciones) {
  const ficheros = readdirSync(dirMigraciones)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const fichero of ficheros) {
    const sql = readFileSync(join(dirMigraciones, fichero), 'utf-8');
    db.exec(sql);
  }
}

/**
 * Ejecuta una consulta SELECT y devuelve un array de objetos (filas).
 */
export function consultar(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

/**
 * Ejecuta una sentencia INSERT/UPDATE/DELETE y devuelve { changes, lastInsertRowid }.
 */
export function ejecutar(db, sql, params = []) {
  const resultado = db.prepare(sql).run(...params);
  return { changes: resultado.changes, lastInsertRowid: resultado.lastInsertRowid };
}

/**
 * Cierra la conexión a la base de datos.
 */
export function cerrar(db) {
  if (db) db.close();
}
