import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import {
  crearGrupo, editarGrupo, eliminarGrupo,
  crearCategoria, editarCategoria, eliminarCategoria,
} from '../../src/core/servicios/categorias.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de categorías', () => {
  let db;
  let tipoGastoId;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);
    tipoGastoId = consultar(db, "SELECT id FROM tipos WHERE nombre = 'gasto'")[0].id;
  });

  afterEach(() => {
    cerrar(db);
  });

  // --- Grupos ---

  it('crea un grupo nuevo', () => {
    const grupo = crearGrupo(db, 'Mascotas', tipoGastoId);
    assert.ok(grupo.id);
    assert.equal(grupo.nombre, 'Mascotas');
    assert.equal(grupo.tipo_id, tipoGastoId);
  });

  it('edita el nombre de un grupo', () => {
    const grupo = crearGrupo(db, 'Mascotas', tipoGastoId);
    const editado = editarGrupo(db, grupo.id, 'Animales');
    assert.equal(editado.nombre, 'Animales');
    assert.equal(editado.id, grupo.id);
  });

  it('elimina un grupo vacío', () => {
    const grupo = crearGrupo(db, 'Mascotas', tipoGastoId);
    eliminarGrupo(db, grupo.id);
    const existe = consultar(db, "SELECT id FROM grupos WHERE id = ?", [grupo.id]);
    assert.equal(existe.length, 0);
  });

  it('error 409 al eliminar grupo con categorías que tienen transacciones', () => {
    const grupo = crearGrupo(db, 'Mascotas', tipoGastoId);
    const cat = crearCategoria(db, 'Veterinario', grupo.id);

    // Insertar una transacción con esa categoría
    ejecutar(db, "INSERT INTO cuentas (nombre, formato) VALUES (?, ?)", ['Test', 'test']);
    const cuentaId = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Test'")[0].id;
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id)
      VALUES ('2026-01-01', '2026-01-01', 'Test', -10, 100, ?, ?)`, [cuentaId, cat.id]);

    assert.throws(
      () => eliminarGrupo(db, grupo.id),
      (err) => err.code === 'TIENE_DEPENDENCIAS'
    );
  });

  it('error 409 al crear grupo duplicado en el mismo tipo', () => {
    assert.throws(
      () => crearGrupo(db, 'Gastos fijos', tipoGastoId),
      (err) => err.code === 'DUPLICADO'
    );
  });

  // --- Categorías ---

  it('crea una categoría nueva', () => {
    const grupoId = consultar(db, "SELECT id FROM grupos WHERE nombre = 'Alimentación'")[0].id;
    const cat = crearCategoria(db, 'Panadería', grupoId);
    assert.ok(cat.id);
    assert.equal(cat.nombre, 'Panadería');
    assert.equal(cat.grupo_id, grupoId);
  });

  it('edita el nombre de una categoría', () => {
    const grupoId = consultar(db, "SELECT id FROM grupos WHERE nombre = 'Alimentación'")[0].id;
    const cat = crearCategoria(db, 'Panadería', grupoId);
    const editada = editarCategoria(db, cat.id, 'Pan y bollería');
    assert.equal(editada.nombre, 'Pan y bollería');
  });

  it('elimina una categoría sin transacciones', () => {
    const grupoId = consultar(db, "SELECT id FROM grupos WHERE nombre = 'Alimentación'")[0].id;
    const cat = crearCategoria(db, 'Panadería', grupoId);
    eliminarCategoria(db, cat.id);
    const existe = consultar(db, "SELECT id FROM categorias WHERE id = ?", [cat.id]);
    assert.equal(existe.length, 0);
  });

  it('error 409 al eliminar categoría con transacciones asociadas', () => {
    const catId = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Supermercado'")[0].id;

    ejecutar(db, "INSERT INTO cuentas (nombre, formato) VALUES (?, ?)", ['Test', 'test']);
    const cuentaId = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Test'")[0].id;
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id)
      VALUES ('2026-01-01', '2026-01-01', 'Compra', -50, 200, ?, ?)`, [cuentaId, catId]);

    assert.throws(
      () => eliminarCategoria(db, catId),
      (err) => err.code === 'TIENE_DEPENDENCIAS'
    );
  });

  it('error 409 al crear categoría duplicada en el mismo grupo', () => {
    const grupoId = consultar(db, "SELECT id FROM grupos WHERE nombre = 'Alimentación'")[0].id;
    assert.throws(
      () => crearCategoria(db, 'Supermercado', grupoId),
      (err) => err.code === 'DUPLICADO'
    );
  });
});
