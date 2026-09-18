import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, ejecutar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { crearRegla, editarRegla, eliminarRegla, obtenerReglas } from '../../src/core/servicios/reglas.js';

const DIR_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

describe('servicio de reglas', () => {
  let db;
  let catSuper;   // Supermercado
  let catFruta;   // Frutería/Mercado
  let cuentaId;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);

    // Limpiar reglas de la semilla para tests aislados
    ejecutar(db, "DELETE FROM reglas");

    catSuper = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Supermercado'")[0].id;
    catFruta = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Frutería/Mercado'")[0].id;

    // Cuenta de prueba y transacciones sin categorizar
    ejecutar(db, "INSERT INTO cuentas (nombre, formato) VALUES (?, ?)", ['Test', 'test']);
    cuentaId = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Test'")[0].id;

    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-01', '2026-03-01', 'MERCADONA GETAFE', -50, 200, ?)`, [cuentaId]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-02', '2026-03-02', 'MERCADONA VALDEBERNARDO', -30, 170, ?)`, [cuentaId]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-03', '2026-03-03', 'FRUTAS Y VERDURAS YANEKA', -15, 155, ?)`, [cuentaId]);
    ejecutar(db, `INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
      VALUES ('2026-03-04', '2026-03-04', 'FARMACIA CALLE MADRID', -8, 147, ?)`, [cuentaId]);
  });

  afterEach(() => {
    cerrar(db);
  });

  it('crear regla aplica automáticamente a transacciones sin categorizar', () => {
    const resultado = crearRegla(db, 'mercadona', catSuper);

    assert.ok(resultado.id);
    assert.equal(resultado.aplicadas, 2); // MERCADONA GETAFE + MERCADONA VALDEBERNARDO

    const txs = consultar(db, "SELECT * FROM transacciones WHERE categoria_id = ? ORDER BY id", [catSuper]);
    assert.equal(txs.length, 2);
    assert.equal(txs[0].origen_categoria, 'regla');
  });

  it('coincidencia es case-insensitive por subcadena', () => {
    crearRegla(db, 'yaneka', catFruta);

    const tx = consultar(db, "SELECT * FROM transacciones WHERE concepto LIKE '%YANEKA%'")[0];
    assert.equal(tx.categoria_id, catFruta);
    assert.equal(tx.origen_categoria, 'regla');
  });

  it('conflicto de reglas: gana el patrón más largo', () => {
    crearRegla(db, 'mercadona', catSuper);
    crearRegla(db, 'mercadona valdebernardo', catFruta);

    // MERCADONA VALDEBERNARDO debería tener catFruta (patrón más largo)
    const tx = consultar(db, "SELECT * FROM transacciones WHERE concepto = 'MERCADONA VALDEBERNARDO'")[0];
    assert.equal(tx.categoria_id, catFruta);

    // MERCADONA GETAFE sigue con catSuper
    const tx2 = consultar(db, "SELECT * FROM transacciones WHERE concepto = 'MERCADONA GETAFE'")[0];
    assert.equal(tx2.categoria_id, catSuper);
  });

  it('editar regla reaplica a transacciones sin categorizar', () => {
    const regla = crearRegla(db, 'farmacia', catSuper);

    // Farmacia categorizada como supermercado
    const antes = consultar(db, "SELECT * FROM transacciones WHERE concepto LIKE '%FARMACIA%'")[0];
    assert.equal(antes.categoria_id, catSuper);

    // Descategorizar manualmente para simular "sin categorizar"
    ejecutar(db, "UPDATE transacciones SET categoria_id = NULL, origen_categoria = NULL WHERE concepto LIKE '%FARMACIA%'");

    const catFarmacia = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Farmacia'")[0].id;
    const editada = editarRegla(db, regla.id, 'farmacia', catFarmacia);

    assert.equal(editada.aplicadas, 1);
    const despues = consultar(db, "SELECT * FROM transacciones WHERE concepto LIKE '%FARMACIA%'")[0];
    assert.equal(despues.categoria_id, catFarmacia);
  });

  it('eliminar regla no afecta transacciones ya categorizadas', () => {
    const regla = crearRegla(db, 'yaneka', catFruta);

    const antes = consultar(db, "SELECT * FROM transacciones WHERE concepto LIKE '%YANEKA%'")[0];
    assert.equal(antes.categoria_id, catFruta);

    eliminarRegla(db, regla.id);

    const despues = consultar(db, "SELECT * FROM transacciones WHERE concepto LIKE '%YANEKA%'")[0];
    assert.equal(despues.categoria_id, catFruta, 'Debería conservar la categoría');
  });

  it('regla no sobreescribe categorización manual', () => {
    // Categorizar manualmente primero
    const txId = consultar(db, "SELECT id FROM transacciones WHERE concepto = 'MERCADONA GETAFE'")[0].id;
    ejecutar(db, "UPDATE transacciones SET categoria_id = ?, origen_categoria = 'manual' WHERE id = ?", [catFruta, txId]);

    // Crear regla que coincidiría
    crearRegla(db, 'mercadona', catSuper);

    // La manual no debe cambiar
    const tx = consultar(db, "SELECT * FROM transacciones WHERE id = ?", [txId])[0];
    assert.equal(tx.categoria_id, catFruta, 'Manual debe prevalecer');
    assert.equal(tx.origen_categoria, 'manual');
  });

  it('obtenerReglas devuelve listado con nombres de categoría y grupo', () => {
    crearRegla(db, 'mercadona', catSuper);
    crearRegla(db, 'yaneka', catFruta);

    const reglas = obtenerReglas(db);
    assert.equal(reglas.length, 2);
    assert.ok(reglas[0].categoria_nombre);
    assert.ok(reglas[0].grupo_nombre);
  });

  it('error al crear regla con patrón duplicado', () => {
    crearRegla(db, 'mercadona', catSuper);

    assert.throws(
      () => crearRegla(db, 'mercadona', catFruta),
      (err) => err.code === 'DUPLICADO'
    );
  });
});
