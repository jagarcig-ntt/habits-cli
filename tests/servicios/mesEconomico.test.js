import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { calcularMesesEconomicos, asignarMesManual } from '../../src/core/servicios/mesEconomico.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de mes económico', () => {
  let db;
  let cuentaId;
  let catIngreso;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    cuentaId = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0].id;
    catIngreso = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Transferencia cuenta común'")[0].id;
  });

  afterEach(() => {
    cerrar(db);
  });

  function insertarTx(fechaOp, concepto, importe, categoriaId = null) {
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria)
      VALUES (?, ?, ?, ?, 1000, ?, ?, ?)`,
      [fechaOp, fechaOp, concepto, importe, cuentaId, categoriaId, categoriaId ? 'regla' : null]);
  }

  it('detecta corte automático con transferencia >1000 en día 25-28', () => {
    // Transferencia de corte el 26 de febrero
    insertarTx('2026-02-26', 'Traspaso desde cuenta', 1200, catIngreso);
    // Gastos del mes de marzo
    insertarTx('2026-03-01', 'Compra supermercado', -50);
    insertarTx('2026-03-10', 'Farmacia', -10);

    const meses = calcularMesesEconomicos(db);

    assert.equal(meses.length, 1);
    assert.equal(meses[0].fecha_inicio, '2026-02-26');
    assert.equal(meses[0].nombre, 'Marzo 2026');

    // Todas las transacciones asignadas a ese mes
    const txSinMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id IS NULL")[0].n;
    assert.equal(txSinMes, 0, 'Todas las transacciones deberían tener mes asignado');
  });

  it('transferencia complementaria >300 no abre un nuevo mes', () => {
    // Corte principal
    insertarTx('2026-02-26', 'Traspaso principal', 1200, catIngreso);
    // Complementaria
    insertarTx('2026-03-01', 'Traspaso complementario', 350, catIngreso);
    // Gasto
    insertarTx('2026-03-05', 'Compra', -30);

    const meses = calcularMesesEconomicos(db);

    assert.equal(meses.length, 1, 'Solo un mes económico');
    // Las 3 transacciones pertenecen al mismo mes
    const txMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id = ?", [meses[0].id])[0].n;
    assert.equal(txMes, 3);
  });

  it('transferencia extra a final de mes no afecta corte', () => {
    insertarTx('2026-02-26', 'Traspaso principal', 1200, catIngreso);
    insertarTx('2026-03-01', 'Traspaso complementario', 350, catIngreso);
    insertarTx('2026-03-15', 'Refuerzo extra', 200, catIngreso);
    insertarTx('2026-03-10', 'Compra', -40);

    const meses = calcularMesesEconomicos(db);

    assert.equal(meses.length, 1, 'Sigue siendo un solo mes');
    const txMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id = ?", [meses[0].id])[0].n;
    assert.equal(txMes, 4);
  });

  it('sin transferencia en rango no crea mes automáticamente', () => {
    // Solo gastos, sin transferencia de ingreso >1000 en día 25-28
    insertarTx('2026-03-05', 'Compra', -30);
    insertarTx('2026-03-10', 'Otra compra', -20);

    const meses = calcularMesesEconomicos(db);

    assert.equal(meses.length, 0, 'No debería crear mes sin corte');
    const txSinMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id IS NULL")[0].n;
    assert.equal(txSinMes, 2, 'Transacciones sin asignar');
  });

  it('corte manual crea mes económico', () => {
    insertarTx('2026-03-05', 'Compra', -30);
    insertarTx('2026-03-10', 'Otra compra', -20);

    const mes = asignarMesManual(db, '2026-03-01');

    assert.ok(mes.id);
    assert.equal(mes.fecha_inicio, '2026-03-01');
    assert.equal(mes.corte_manual, 1);

    // Recalcular para asignar transacciones
    calcularMesesEconomicos(db);

    const txMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id = ?", [mes.id])[0].n;
    assert.equal(txMes, 2);
  });

  it('dos meses consecutivos se delimitan correctamente', () => {
    // Mes de marzo (corte 26 feb)
    insertarTx('2026-02-26', 'Traspaso feb', 1200, catIngreso);
    insertarTx('2026-03-05', 'Compra marzo', -50);

    // Mes de abril (corte 26 mar)
    insertarTx('2026-03-26', 'Traspaso mar', 1200, catIngreso);
    insertarTx('2026-04-02', 'Compra abril', -30);

    const meses = calcularMesesEconomicos(db);

    assert.equal(meses.length, 2);
    assert.equal(meses[0].nombre, 'Marzo 2026');
    assert.equal(meses[1].nombre, 'Abril 2026');

    // Verificar que fecha_fin del primer mes es un día antes del inicio del segundo
    assert.equal(meses[0].fecha_fin, '2026-03-25');

    // Transacciones asignadas correctamente
    const txMarzo = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id = ?", [meses[0].id])[0].n;
    const txAbril = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id = ?", [meses[1].id])[0].n;
    assert.equal(txMarzo, 2); // traspaso feb + compra marzo
    assert.equal(txAbril, 2); // traspaso mar + compra abril
  });
});
