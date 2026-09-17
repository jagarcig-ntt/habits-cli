import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearConexion, ejecutarMigraciones, consultar, cerrar } from '../src/core/db.js';
import { ejecutarSemilla } from '../src/core/semilla.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

describe('semilla.js', () => {
  let db;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);
  });

  afterEach(() => {
    cerrar(db);
  });

  it('inserta las 2 cuentas bancarias', () => {
    const cuentas = consultar(db, "SELECT * FROM cuentas ORDER BY id");
    assert.equal(cuentas.length, 2);
    assert.equal(cuentas[0].nombre, 'BBVA');
    assert.equal(cuentas[0].formato, 'xlsx_bbva');
    assert.equal(cuentas[1].nombre, 'Openbank');
    assert.equal(cuentas[1].formato, 'html_openbank');
  });

  it('inserta los 4 tipos fijos', () => {
    const tipos = consultar(db, "SELECT * FROM tipos ORDER BY id");
    assert.equal(tipos.length, 4);
    const nombres = tipos.map(t => t.nombre);
    assert.deepEqual(nombres, ['gasto', 'ingreso', 'ahorro', 'inversión']);
  });

  it('inserta los 11 grupos', () => {
    const grupos = consultar(db, "SELECT * FROM grupos ORDER BY id");
    assert.equal(grupos.length, 11);

    // 8 grupos de gasto
    const tipoGasto = consultar(db, "SELECT id FROM tipos WHERE nombre = 'gasto'")[0];
    const gruposGasto = grupos.filter(g => g.tipo_id === tipoGasto.id);
    assert.equal(gruposGasto.length, 8);
  });

  it('inserta las 29 categorías', () => {
    const categorias = consultar(db, "SELECT * FROM categorias");
    assert.equal(categorias.length, 29);
  });

  it('las categorías de Gastos fijos son correctas', () => {
    const grupo = consultar(db, `
      SELECT g.id FROM grupos g
      JOIN tipos t ON g.tipo_id = t.id
      WHERE g.nombre = 'Gastos fijos' AND t.nombre = 'gasto'
    `)[0];
    const cats = consultar(db, "SELECT nombre FROM categorias WHERE grupo_id = ? ORDER BY id", [grupo.id]);
    const nombres = cats.map(c => c.nombre);
    assert.deepEqual(nombres, ['Comunidad', 'Suministros', 'Telecomunicaciones', 'Seguros', 'Préstamos']);
  });

  it('ejecutar semilla dos veces no duplica datos', () => {
    ejecutarSemilla(db);
    const tipos = consultar(db, "SELECT * FROM tipos");
    assert.equal(tipos.length, 4);
    const categorias = consultar(db, "SELECT * FROM categorias");
    assert.equal(categorias.length, 29);
  });
});
