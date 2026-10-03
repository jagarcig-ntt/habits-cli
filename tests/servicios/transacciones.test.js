import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { obtenerTransacciones, categorizarManual, alternarExclusion, excluirEnLote } from '../../src/core/servicios/transacciones.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de transacciones', () => {
  let db;
  let cuentaBbva;
  let cuentaOpen;
  let catSuper;
  let catFruta;
  let catAhorro;
  let catInversion;
  let catIngreso;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    cuentaBbva = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0].id;
    cuentaOpen = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Openbank'")[0].id;
    catSuper = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Supermercado'")[0].id;
    catFruta = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Frutería/Mercado'")[0].id;
    catAhorro = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Ahorro mensual común'")[0].id;
    catInversion = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Fondo de inversión'")[0].id;
    catIngreso = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Transferencia cuenta común'")[0].id;

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

  // --- Exclusión ---

  it('excluir marca excluida = 1', () => {
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'YANEKA'")[0].id;
    const resultado = alternarExclusion(db, txId, true);

    assert.equal(resultado.excluida, 1);
    const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [txId])[0];
    assert.equal(tx.excluida, 1);
  });

  it('incluir revierte excluida a 0', () => {
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'YANEKA'")[0].id;
    alternarExclusion(db, txId, true);
    const resultado = alternarExclusion(db, txId, false);

    assert.equal(resultado.excluida, 0);
    const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [txId])[0];
    assert.equal(tx.excluida, 0);
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

  // --- Paginación ---

  it('limit devuelve solo la primera página', () => {
    const resultado = obtenerTransacciones(db, {}, { limit: 2, offset: 0 });
    assert.equal(resultado.transacciones.length, 2);
    assert.equal(resultado.total, 4);
    assert.equal(resultado.hayMas, true);
  });

  it('offset devuelve la página siguiente', () => {
    const resultado = obtenerTransacciones(db, {}, { limit: 2, offset: 2 });
    assert.equal(resultado.transacciones.length, 2);
    assert.equal(resultado.total, 4);
    assert.equal(resultado.hayMas, false);
  });

  it('sin paginación explícita usa límite por defecto y devuelve hayMas correcto', () => {
    const resultado = obtenerTransacciones(db, {});
    assert.equal(resultado.transacciones.length, 4);
    assert.equal(resultado.total, 4);
    assert.equal(resultado.hayMas, false);
  });

  it('una transacción excluida sigue apareciendo en el listado paginado', () => {
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'YANEKA'")[0].id;
    alternarExclusion(db, txId, true);

    const resultado = obtenerTransacciones(db, {});
    assert.equal(resultado.transacciones.length, 4, 'La excluida debe seguir en el listado');
    assert.ok(resultado.transacciones.some(t => t.id === txId));
  });

  // --- Filtro por tipo ---

  it('filtra por tipo "gasto"', () => {
    const resultado = obtenerTransacciones(db, { tipo: 'gasto' });
    const conceptos = resultado.transacciones.map(t => t.concepto).sort();
    assert.deepEqual(conceptos, ['AHORRAMAS', 'MERCADONA']);
  });

  it('filtra por tipo "ahorro_inversion" incluye ambos tipos', () => {
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES ('2026-03-05', '2026-03-05', 'AHORRO BANCO', 100, 700, ?, ?, 'manual')`, [cuentaBbva, catAhorro]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES ('2026-03-06', '2026-03-06', 'FONDO INVERSION', 50, 750, ?, ?, 'manual')`, [cuentaBbva, catInversion]);

    const resultado = obtenerTransacciones(db, { tipo: 'ahorro_inversion' });
    const conceptos = resultado.transacciones.map(t => t.concepto).sort();
    assert.deepEqual(conceptos, ['AHORRO BANCO', 'FONDO INVERSION']);
  });

  it('filtra por tipo "otros" incluye ingreso y sin categorizar', () => {
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES ('2026-03-05', '2026-03-05', 'TRASPASO INGRESO', 1000, 1000, ?, ?, 'manual')`, [cuentaBbva, catIngreso]);

    const resultado = obtenerTransacciones(db, { tipo: 'otros' });
    const conceptos = resultado.transacciones.map(t => t.concepto).sort();
    // YANEKA y TRANSFERENCIA están sin categorizar; TRASPASO INGRESO es de tipo ingreso
    assert.deepEqual(conceptos, ['TRANSFERENCIA', 'TRASPASO INGRESO', 'YANEKA']);
  });

  // --- Filtros por columna: concepto y fechas ---

  it('filtra por concepto (subcadena case-insensitive)', () => {
    const resultado = obtenerTransacciones(db, { concepto: 'yaneka' });
    assert.equal(resultado.transacciones.length, 1);
    assert.equal(resultado.transacciones[0].concepto, 'YANEKA');
  });

  it('filtra por rango de fechas', () => {
    const resultado = obtenerTransacciones(db, { fecha_desde: '2026-03-02', fecha_hasta: '2026-03-03' });
    const conceptos = resultado.transacciones.map(t => t.concepto).sort();
    assert.deepEqual(conceptos, ['TRANSFERENCIA', 'YANEKA']);
  });

  // --- Exclusión en lote ---

  it('excluirEnLote excluye varias transacciones de una vez', () => {
    const ids = consultar(db, "SELECT id FROM transacciones WHERE concepto IN ('YANEKA', 'TRANSFERENCIA')").map(t => t.id);
    const resultado = excluirEnLote(db, ids, true);

    assert.equal(resultado.actualizadas, 2);
    for (const id of ids) {
      const tx = consultar(db, "SELECT excluida FROM transacciones WHERE id = ?", [id])[0];
      assert.equal(tx.excluida, 1);
    }
  });

  it('excluirEnLote incluye varias transacciones de una vez', () => {
    const ids = consultar(db, "SELECT id FROM transacciones WHERE concepto IN ('YANEKA', 'TRANSFERENCIA')").map(t => t.id);
    excluirEnLote(db, ids, true);
    const resultado = excluirEnLote(db, ids, false);

    assert.equal(resultado.actualizadas, 2);
    for (const id of ids) {
      const tx = consultar(db, "SELECT excluida FROM transacciones WHERE id = ?", [id])[0];
      assert.equal(tx.excluida, 0);
    }
  });
});
