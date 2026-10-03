import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { dashboardAnual, dashboardMensual, topCategoriasGasto, ratioAhorroIngreso, calcularComparativas, acumuladoAhorroInversionAnual } from '../../src/core/servicios/dashboard.js';

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

  // --- Exclusión ---

  it('transacción excluida no cuenta en el dashboard mensual', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-10', 'Prestamo coche', -22400, catSuper);
    ejecutar(db, "UPDATE transacciones SET excluida = 1 WHERE concepto = 'Prestamo coche'");

    const resultado = dashboardMensual(db, mesId);
    assert.equal(resultado.totales.gasto, -50, 'La transacción excluida no debe sumarse');
  });

  it('transacción excluida no cuenta en el dashboard anual', () => {
    insertarTx('2026-03-01', 'Mercadona', -50, catSuper);
    insertarTx('2026-03-10', 'Prestamo coche', -22400, catSuper);
    ejecutar(db, "UPDATE transacciones SET excluida = 1 WHERE concepto = 'Prestamo coche'");

    const resultado = dashboardAnual(db, 2026);
    const mes = resultado.meses[0];
    assert.equal(mes.totales.gasto, -50, 'La transacción excluida no debe sumarse');
  });

  // --- Ratio ahorro/ingreso ---

  it('ratioAhorroIngreso calcula el porcentaje correcto', () => {
    assert.equal(ratioAhorroIngreso(300, 1500), 20);
    assert.equal(ratioAhorroIngreso(150, 1200), 12.5);
  });

  it('ratioAhorroIngreso devuelve null si el ingreso es 0', () => {
    assert.equal(ratioAhorroIngreso(300, 0), null);
  });

  // --- Comparativa mes vs anterior ---

  it('calcularComparativas: el primer mes tiene comparativa null', () => {
    const meses = [
      { nombre: 'Marzo 2026', totales: { gasto: -100, ingreso: 1000 } },
      { nombre: 'Abril 2026', totales: { gasto: -150, ingreso: 1200 } },
    ];
    const resultado = calcularComparativas(meses);
    assert.equal(resultado[0].comparativa, null);
  });

  it('calcularComparativas calcula la variación correcta respecto al mes anterior', () => {
    const meses = [
      { nombre: 'Marzo 2026', totales: { gasto: -100, ingreso: 1000 } },
      { nombre: 'Abril 2026', totales: { gasto: -150, ingreso: 1200 } },
    ];
    const resultado = calcularComparativas(meses);
    assert.equal(resultado[1].comparativa.gasto, -50);
    assert.equal(resultado[1].comparativa.ingreso, 20);
  });

  it('calcularComparativas devuelve null si el mes anterior tiene valor 0', () => {
    const meses = [
      { nombre: 'Marzo 2026', totales: { gasto: 0, ingreso: 0 } },
      { nombre: 'Abril 2026', totales: { gasto: -150, ingreso: 1200 } },
    ];
    const resultado = calcularComparativas(meses);
    assert.equal(resultado[1].comparativa.gasto, null);
    assert.equal(resultado[1].comparativa.ingreso, null);
  });

  // --- Acumulado anual de ahorro/inversión ---

  it('acumuladoAhorroInversionAnual suma transacciones y entradas manuales de todos los meses del año', () => {
    const catAhorro = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Ahorro mensual común'")[0].id;
    const catInversion = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Fondo de inversión'")[0].id;

    // Segundo mes económico del mismo año
    ejecutar(db, "INSERT INTO meses_economicos (nombre, fecha_inicio, fecha_fin) VALUES (?, ?, ?)",
      ['Abril 2026', '2026-03-26', '2026-04-25']);
    const otroMesId = consultar(db, "SELECT id FROM meses_economicos WHERE nombre = 'Abril 2026'")[0].id;

    // Marzo: 200 ahorro (regla) + 300 ahorro (manual) + 100 inversión (regla)
    insertarTx('2026-03-05', 'Ahorro banco', 200, catAhorro);
    insertarTx('2026-03-06', 'Fondo BBVA', 100, catInversion);
    ejecutar(db, "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo) VALUES (?, ?, ?, ?)",
      [mesId, '2026-03-10', 300, 'ahorro']);

    // Abril: 150 ahorro (regla) + 50 inversión (manual)
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria, mes_economico_id)
      VALUES ('2026-04-01', '2026-04-01', 'Ahorro abril', 150, 1000, ?, ?, 'regla', ?)`, [cuentaId, catAhorro, otroMesId]);
    ejecutar(db, "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo) VALUES (?, ?, ?, ?)",
      [otroMesId, '2026-04-05', 50, 'inversion']);

    const resultado = acumuladoAhorroInversionAnual(db, 2026);

    assert.equal(resultado.ahorro, 650, '200 + 300 (marzo) + 150 (abril)');
    assert.equal(resultado.inversion, 150, '100 (marzo) + 50 (abril)');
  });

  // --- Ahorro manual ---

  it('el ahorro/inversión del mes suma transacciones categorizadas más entradas manuales', () => {
    const catAhorro = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Ahorro mensual común'")[0].id;
    const catInversion = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Fondo de inversión'")[0].id;

    insertarTx('2026-03-05', 'Ahorro banco', 200, catAhorro);
    insertarTx('2026-03-06', 'Fondo BBVA', 100, catInversion);

    ejecutar(db, "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo, nota) VALUES (?, ?, ?, ?, ?)",
      [mesId, '2026-03-10', 300, 'ahorro', 'Aportación extra']);
    ejecutar(db, "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo, nota) VALUES (?, ?, ?, ?, ?)",
      [mesId, '2026-03-12', 50, 'inversion', null]);

    const mensual = dashboardMensual(db, mesId);
    assert.equal(mensual.totales.ahorro, 500, '200 (regla) + 300 (manual)');
    assert.equal(mensual.totales.inversion, 150, '100 (regla) + 50 (manual)');

    const anual = dashboardAnual(db, 2026);
    const mes = anual.meses[0];
    assert.equal(mes.totales.ahorro, 500);
    assert.equal(mes.totales.inversion, 150);
  });

  // --- Top categorías de gasto ---

  it('topCategoriasGasto devuelve máximo 5 categorías ordenadas por gasto descendente', () => {
    const catFarmacia = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Farmacia'")[0].id;
    const catPeajes = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Peajes'")[0].id;
    const catGuarderia = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Guardería'")[0].id;
    const catRestauracion = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Restauración'")[0].id;

    insertarTx('2026-03-01', 'Super', -500, catSuper);
    insertarTx('2026-03-02', 'Gasolina', -400, catGasolina);
    insertarTx('2026-03-03', 'Farmacia', -300, catFarmacia);
    insertarTx('2026-03-04', 'Peajes', -200, catPeajes);
    insertarTx('2026-03-05', 'Guarderia', -100, catGuarderia);
    insertarTx('2026-03-06', 'Restauracion', -50, catRestauracion); // 6ª, debe quedar fuera

    const top = topCategoriasGasto(db, 2026);

    assert.equal(top.length, 5);
    assert.equal(top[0].nombre, 'Supermercado');
    assert.equal(top[0].total, -500);
    assert.ok(!top.some(c => c.nombre === 'Restauración'), 'La 6ª categoría no debería aparecer');
  });

  it('topCategoriasGasto ignora transacciones que no son de tipo gasto', () => {
    insertarTx('2026-03-01', 'Super', -500, catSuper);
    insertarTx('2026-02-26', 'Traspaso', 1200, catIngreso);

    const top = topCategoriasGasto(db, 2026);
    assert.equal(top.length, 1);
    assert.equal(top[0].nombre, 'Supermercado');
  });

  it('topCategoriasGasto ignora transacciones excluidas', () => {
    insertarTx('2026-03-01', 'Super', -500, catSuper);
    insertarTx('2026-03-02', 'Prestamo', -9000, catGasolina);
    ejecutar(db, "UPDATE transacciones SET excluida = 1 WHERE concepto = 'Prestamo'");

    const top = topCategoriasGasto(db, 2026);
    assert.equal(top.length, 1);
    assert.equal(top[0].nombre, 'Supermercado');
  });

  it('un mes con solo entradas manuales de ahorro no se considera vacío', () => {
    ejecutar(db, "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo) VALUES (?, ?, ?, ?)",
      [mesId, '2026-03-10', 300, 'ahorro']);

    const mensual = dashboardMensual(db, mesId);
    assert.equal(mensual.vacio, false);
    assert.equal(mensual.totales.ahorro, 300);

    const anual = dashboardAnual(db, 2026);
    assert.equal(anual.vacio, false);
    assert.equal(anual.meses.length, 1);
  });
});
