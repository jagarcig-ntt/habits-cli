import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../src/core/db.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_MIGRACIONES_TEST = join(import.meta.dirname, '_migraciones_tmp');
const DIR_RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR_MIGRACIONES_REAL = join(DIR_RAIZ, 'migrations');

describe('db.js', () => {
  let db;

  beforeEach(() => {
    db = crearConexion(':memory:');
    mkdirSync(DIR_MIGRACIONES_TEST, { recursive: true });
  });

  afterEach(() => {
    cerrar(db);
    rmSync(DIR_MIGRACIONES_TEST, { recursive: true, force: true });
  });

  it('crea conexión en memoria sin errores', () => {
    assert.ok(db, 'La conexión debería existir');
    const resultado = consultar(db, "SELECT 1 AS valor");
    assert.equal(resultado[0].valor, 1);
  });

  it('ejecuta migraciones en orden y crea tablas', () => {
    writeFileSync(
      join(DIR_MIGRACIONES_TEST, '001_prueba.sql'),
      `CREATE TABLE prueba (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
      );`
    );
    writeFileSync(
      join(DIR_MIGRACIONES_TEST, '002_prueba2.sql'),
      `CREATE TABLE prueba2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prueba_id INTEGER NOT NULL REFERENCES prueba(id)
      );`
    );

    ejecutarMigraciones(db, DIR_MIGRACIONES_TEST);

    const tablas = consultar(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const nombres = tablas.map(t => t.name);
    assert.ok(nombres.includes('prueba'), 'Debería existir tabla prueba');
    assert.ok(nombres.includes('prueba2'), 'Debería existir tabla prueba2');
  });

  it('helper consultar devuelve filas correctamente', () => {
    ejecutar(db, "CREATE TABLE test (id INTEGER PRIMARY KEY, valor TEXT)");
    ejecutar(db, "INSERT INTO test (valor) VALUES (?)", ['hola']);
    ejecutar(db, "INSERT INTO test (valor) VALUES (?)", ['mundo']);

    const filas = consultar(db, "SELECT * FROM test ORDER BY id");
    assert.equal(filas.length, 2);
    assert.equal(filas[0].valor, 'hola');
    assert.equal(filas[1].valor, 'mundo');
  });

  it('helper ejecutar devuelve info del cambio', () => {
    ejecutar(db, "CREATE TABLE test (id INTEGER PRIMARY KEY, valor TEXT)");
    const info = ejecutar(db, "INSERT INTO test (valor) VALUES (?)", ['dato']);
    assert.equal(info.changes, 1);
    assert.ok(info.lastInsertRowid > 0);
  });

  it('migración 001 crea las 5 tablas base con columnas correctas', () => {
    ejecutarMigraciones(db, DIR_MIGRACIONES_REAL);

    const tablas = consultar(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const nombres = tablas.map(t => t.name);
    const esperadas = ['categorias', 'cuentas', 'grupos', 'tipos', 'transacciones'];
    for (const tabla of esperadas) {
      assert.ok(nombres.includes(tabla), `Debería existir tabla '${tabla}'`);
    }

    // Verificar UNIQUE constraint de duplicados en transacciones
    ejecutar(db, "INSERT INTO cuentas (nombre, formato) VALUES (?, ?)", ['BBVA', 'xlsx_bbva']);
    ejecutar(db, "INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id) VALUES (?, ?, ?, ?, ?, ?)",
      ['2026-03-01', '2026-03-01', 'Test', -10.00, 100.00, 1]);
    assert.throws(
      () => ejecutar(db, "INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id) VALUES (?, ?, ?, ?, ?, ?)",
        ['2026-03-01', '2026-03-01', 'Test', -10.00, 100.00, 1]),
      (err) => err.message.includes('UNIQUE constraint failed')
    );
  });

  it('migración 002 crea tabla reglas con UNIQUE en patrón y FK a categorías', () => {
    ejecutarMigraciones(db, DIR_MIGRACIONES_REAL);

    const tablas = consultar(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    assert.ok(tablas.map(t => t.name).includes('reglas'), 'Debería existir tabla reglas');

    // Insertar datos base para FK
    ejecutar(db, "INSERT INTO tipos (nombre) VALUES (?)", ['gasto']);
    ejecutar(db, "INSERT INTO grupos (nombre, tipo_id) VALUES (?, ?)", ['Alimentación', 1]);
    ejecutar(db, "INSERT INTO categorias (nombre, grupo_id) VALUES (?, ?)", ['Supermercado', 1]);

    ejecutar(db, "INSERT INTO reglas (patron, categoria_id) VALUES (?, ?)", ['mercadona', 1]);
    assert.throws(
      () => ejecutar(db, "INSERT INTO reglas (patron, categoria_id) VALUES (?, ?)", ['mercadona', 1]),
      (err) => err.message.includes('UNIQUE constraint failed')
    );
  });

  it('migración 003 crea tabla meses_economicos y añade mes_economico_id a transacciones', () => {
    ejecutarMigraciones(db, DIR_MIGRACIONES_REAL);

    const tablas = consultar(db, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    assert.ok(tablas.map(t => t.name).includes('meses_economicos'), 'Debería existir tabla meses_economicos');

    // Verificar columnas de meses_economicos
    const columnas = consultar(db, "PRAGMA table_info(meses_economicos)");
    const nombres = columnas.map(c => c.name);
    for (const col of ['id', 'nombre', 'fecha_inicio', 'fecha_fin', 'corte_manual']) {
      assert.ok(nombres.includes(col), `meses_economicos debería tener columna '${col}'`);
    }

    // Verificar que transacciones tiene mes_economico_id
    const colsTx = consultar(db, "PRAGMA table_info(transacciones)");
    assert.ok(colsTx.map(c => c.name).includes('mes_economico_id'), 'transacciones debería tener columna mes_economico_id');
  });

  it('UNIQUE constraint lanza error al duplicar', () => {
    writeFileSync(
      join(DIR_MIGRACIONES_TEST, '001_unica.sql'),
      `CREATE TABLE unica (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT NOT NULL UNIQUE
      );`
    );
    ejecutarMigraciones(db, DIR_MIGRACIONES_TEST);

    ejecutar(db, "INSERT INTO unica (clave) VALUES (?)", ['abc']);
    assert.throws(
      () => ejecutar(db, "INSERT INTO unica (clave) VALUES (?)", ['abc']),
      (err) => err.message.includes('UNIQUE constraint failed')
    );
  });
});
