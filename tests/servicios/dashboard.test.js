import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { dashboardAnual, dashboardMensual } from '../../src/core/servicios/dashboard.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de dashboard', () => {
  let db;
  let cuentaId;
  let catSuper;
  let catGasolina;
  let catIngreso;
  let mesId;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    cuentaId = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0].id;
    catSuper = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Supermercado'")[0].id;
    catGasolina = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Gasolina'")[0].id;
    catIngreso = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Transferencia cuenta común'")[0].id;

    // Crear mes económico
    ejecutar(db, "INSERT INTO meses_economicos (nombre, fecha_inicio, fecha_fin) VALUES (?, ?, ?)",
      ['Marzo 2026', '2026-02-26', '2026-03-25']);
    mesId = consultar(db, "SELECT id FROM meses_economicos")[0].id;
  });

  afterEach(() => {
    cerrar(db);
  });

  function insertarTx(fechaOp, concepto, importe, categoriaId = null) {
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria, mes_economico_id)
      VALUES (?, ?, ?, ?, 1000, ?, ?, ?, ?)`,
      [fechaOp, fechaOp, concepto, importe, cuentaId, categoriaId, categoriaId ? 'regla' : null, mesId]);
  }

  it('dashboard anual devuelve totales por tipo correctos', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-02', 'Gasolina', -40, catGasolina);
    insertarTx('2026-02-26', 'Traspaso', 1200, catIngreso);

    const resultado = dashboardAnual(db, 2026);

    assert.equal(resultado.vacio, false);
    assert.equal(resultado.meses.length, 1);

    const mes = resultado.meses[0];
    assert.equal(mes.nombre, 'Marzo 2026');
    assert.equal(mes.totales.gasto, -90);
    assert.equal(mes.totales.ingreso, 1200);
    assert.equal(mes.totales.ahorro, 0);
    assert.equal(mes.totales.inversion, 0);
  });

  it('dashboard anual agrupa por grupo con desglose a categoría', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-02', 'Gasolina', -40, catGasolina);

    const resultado = dashboardAnual(db, 2026);
    const mes = resultado.meses[0];

    // Buscar grupo Alimentación
    const alimentacion = mes.grupos.find(g => g.nombre === 'Alimentación');
    assert.ok(alimentacion, 'Debería existir grupo Alimentación');
    assert.equal(alimentacion.total, -50);
    assert.ok(alimentacion.categorias.some(c => c.nombre === 'Supermercado' && c.total === -50));

    // Buscar grupo Transporte
    const transporte = mes.grupos.find(g => g.nombre === 'Transporte');
    assert.ok(transporte, 'Debería existir grupo Transporte');
    assert.equal(transporte.total, -40);
  });

  it('transacciones sin categorizar aparecen como grupo "Sin categorizar"', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-03', 'Desconocido', -20, null);

    const resultado = dashboardAnual(db, 2026);
    const mes = resultado.meses[0];

    const sinCat = mes.grupos.find(g => g.nombre === 'Sin categorizar');
    assert.ok(sinCat, 'Debería existir grupo Sin categorizar');
    assert.equal(sinCat.total, -20);
  });

  it('transacciones con importe cero se excluyen de agregados', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-02', 'Ajuste', 0, catSuper);

    const resultado = dashboardAnual(db, 2026);
    const mes = resultado.meses[0];
    assert.equal(mes.totales.gasto, -50);
  });

  it('estado vacío devuelve vacio: true', () => {
    const resultado = dashboardAnual(db, 2026);
    assert.equal(resultado.vacio, true);
    assert.equal(resultado.meses.length, 0);
  });

  it('dashboard mensual devuelve totales y grupos del mes', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-02', 'Gasolina', -40, catGasolina);
    insertarTx('2026-03-05', 'Desconocido', -10, null);

    const resultado = dashboardMensual(db, mesId);

    assert.equal(resultado.vacio, false);
    assert.equal(resultado.totales.gasto, -90); // solo las categorizadas como gasto
    assert.equal(resultado.sin_categorizar, -10);
    assert.ok(resultado.grupos.length > 0);
  });

  it('dashboard mensual devuelve vacio si mes no tiene transacciones', () => {
    const resultado = dashboardMensual(db, mesId);
    assert.equal(resultado.vacio, true);
  });
});
