import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { obtenerTransacciones, categorizarManual } from '../../src/core/servicios/transacciones.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de transacciones', () => {
  let db;
  let cuentaBbva;
  let cuentaOpen;
  let catSuper;
  let catFruta;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    cuentaBbva = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0].id;
    cuentaOpen = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Openbank'")[0].id;
    catSuper = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Supermercado'")[0].id;
    catFruta = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Frutería/Mercado'")[0].id;

    // Transacciones de prueba
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES ('2026-03-01', '2026-03-01', 'MERCADONA', -50, 200, ?, ?, 'regla')`, [cuentaBbva, catSuper]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-02', '2026-03-02', 'YANEKA', -15, 185, ?)`, [cuentaBbva]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-03', '2026-03-03', 'TRANSFERENCIA', 500, 685, ?)`, [cuentaOpen]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES ('2026-03-04', '2026-03-04', 'AHORRAMAS', -25, 660, ?, ?, 'regla')`, [cuentaBbva, catSuper]);
  });

  afterEach(() => {
    cerrar(db);
  });

  // --- Categorización manual ---

  it('categorización manual individual', () => {
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'YANEKA'")[0].id;
    const resultado = categorizarManual(db, [txId], catFruta);

    assert.equal(resultado.actualizadas, 1);
    const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [txId])[0];
    assert.equal(tx.categoria_id, catFruta);
    assert.equal(tx.origen_categoria, 'manual');
  });

  it('categorización en lote', () => {
    const ids = consultar(db, "SELECT id FROM transacciones WHERE concepto IN ('YANEKA', 'TRANSFERENCIA')").map(t => t.id);
    const resultado = categorizarManual(db, ids, catFruta);

    assert.equal(resultado.actualizadas, 2);
    for (const id of ids) {
      const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [id])[0];
      assert.equal(tx.categoria_id, catFruta);
      assert.equal(tx.origen_categoria, 'manual');
    }
  });

  it('categorización manual prevalece sobre regla', () => {
    // La tx MERCADONA ya tiene categoria por regla
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'MERCADONA'")[0].id;
    categorizarManual(db, [txId], catFruta);

    const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [txId])[0];
    assert.equal(tx.categoria_id, catFruta, 'Manual debe prevalecer');
    assert.equal(tx.origen_categoria, 'manual');
  });

  // --- Filtros ---

  it('filtra por cuenta', () => {
    const resultado = obtenerTransacciones(db, { cuenta_id: cuentaOpen });
    assert.equal(resultado.transacciones.length, 1);
    assert.equal(resultado.transacciones[0].concepto, 'TRANSFERENCIA');
  });

  it('filtra por categoría', () => {
    const resultado = obtenerTransacciones(db, { categoria_id: catSuper });
    assert.equal(resultado.transacciones.length, 2); // MERCADONA + AHORRAMAS
  });

  it('filtra por rango de importe', () => {
    const resultado = obtenerTransacciones(db, { importe_min: -30, importe_max: -10 });
    assert.equal(resultado.transacciones.length, 2); // YANEKA (-15) + AHORRAMAS (-25)
  });

  it('sin filtros devuelve todas', () => {
    const resultado = obtenerTransacciones(db, {});
    assert.equal(resultado.transacciones.length, 4);
    assert.equal(resultado.total, 4);
  });

  it('transacciones ordenadas por fecha de operación', () => {
    const resultado = obtenerTransacciones(db, {});
    const fechas = resultado.transacciones.map(t => t.fecha_operacion);
    const ordenadas = [...fechas].sort();
    assert.deepEqual(fechas, ordenadas);
  });
});
