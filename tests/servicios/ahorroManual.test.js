import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { crearEntrada, editarEntrada, eliminarEntrada, obtenerEntradas } from '../../src/core/servicios/ahorroManual.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de ahorro manual', () => {
  let db;
  let mesId;
  let otroMesId;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    ejecutar(db, "INSERT INTO meses_economicos (nombre, fecha_inicio, fecha_fin) VALUES (?, ?, ?)",
      ['Marzo 2026', '2026-02-26', '2026-03-25']);
    mesId = consultar(db, "SELECT id FROM meses_economicos")[0].id;

    ejecutar(db, "INSERT INTO meses_economicos (nombre, fecha_inicio, fecha_fin) VALUES (?, ?, ?)",
      ['Abril 2026', '2026-03-26', '2026-04-25']);
    otroMesId = consultar(db, "SELECT id FROM meses_economicos WHERE nombre = 'Abril 2026'")[0].id;
  });

  afterEach(() => {
    cerrar(db);
  });

  it('crea una entrada de ahorro', () => {
    const entrada = crearEntrada(db, {
      mes_economico_id: mesId,
      fecha: '2026-03-10',
      importe: 300,
      tipo: 'ahorro',
      nota: 'Aportación extra',
    });

    assert.ok(entrada.id);
    assert.equal(entrada.tipo, 'ahorro');
    assert.equal(entrada.importe, 300);

    const fila = consultar(db, "SELECT * FROM ahorro_manual WHERE id = ?", [entrada.id])[0];
    assert.equal(fila.mes_economico_id, mesId);
    assert.equal(fila.nota, 'Aportación extra');
  });

  it('crea una entrada de inversión', () => {
    const entrada = crearEntrada(db, {
      mes_economico_id: mesId,
      fecha: '2026-03-15',
      importe: 150,
      tipo: 'inversion',
      nota: null,
    });

    assert.equal(entrada.tipo, 'inversion');
    const fila = consultar(db, "SELECT * FROM ahorro_manual WHERE id = ?", [entrada.id])[0];
    assert.equal(fila.tipo, 'inversion');
  });

  it('edita una entrada existente', () => {
    const entrada = crearEntrada(db, { mes_economico_id: mesId, fecha: '2026-03-10', importe: 300, tipo: 'ahorro', nota: 'Original' });

    const editada = editarEntrada(db, entrada.id, { fecha: '2026-03-11', importe: 350, tipo: 'ahorro', nota: 'Actualizada' });

    assert.equal(editada.importe, 350);
    assert.equal(editada.nota, 'Actualizada');
    const fila = consultar(db, "SELECT * FROM ahorro_manual WHERE id = ?", [entrada.id])[0];
    assert.equal(fila.importe, 350);
    assert.equal(fila.fecha, '2026-03-11');
  });

  it('elimina una entrada', () => {
    const entrada = crearEntrada(db, { mes_economico_id: mesId, fecha: '2026-03-10', importe: 300, tipo: 'ahorro' });

    eliminarEntrada(db, entrada.id);

    const fila = consultar(db, "SELECT * FROM ahorro_manual WHERE id = ?", [entrada.id]);
    assert.equal(fila.length, 0);
  });

  it('lista entradas filtradas por mes', () => {
    crearEntrada(db, { mes_economico_id: mesId, fecha: '2026-03-10', importe: 300, tipo: 'ahorro' });
    crearEntrada(db, { mes_economico_id: mesId, fecha: '2026-03-12', importe: 100, tipo: 'inversion' });
    crearEntrada(db, { mes_economico_id: otroMesId, fecha: '2026-04-01', importe: 200, tipo: 'ahorro' });

    const entradasMes1 = obtenerEntradas(db, mesId);
    assert.equal(entradasMes1.length, 2);

    const entradasMes2 = obtenerEntradas(db, otroMesId);
    assert.equal(entradasMes2.length, 1);
  });

  it('crear entrada con tipo inválido lanza error', () => {
    assert.throws(
      () => crearEntrada(db, { mes_economico_id: mesId, fecha: '2026-03-10', importe: 300, tipo: 'ahorros' }),
      (err) => err.code === 'VALIDACION'
    );
  });

  it('crear entrada con mes_economico_id inexistente lanza error', () => {
    assert.throws(
      () => crearEntrada(db, { mes_economico_id: 9999, fecha: '2026-03-10', importe: 300, tipo: 'ahorro' }),
      (err) => err.code === 'NO_ENCONTRADO'
    );
  });
});
