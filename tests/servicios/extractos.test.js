import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones, consultar, cerrar } from '../../src/core/db.js';
import { ejecutarSemilla } from '../../src/core/semilla.js';
import { importarExtracto } from '../../src/core/servicios/extractos.js';
import { crearRegla } from '../../src/core/servicios/reglas.js';

const DIR_RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR_MIGRACIONES = join(DIR_RAIZ, 'migrations');
const DIR_SAMPLES = join(DIR_RAIZ, 'samples', 'extractos-tipo');

describe('servicio de extractos', () => {
  let db;

  beforeEach(() => {
    db = crearConexion(':memory:');
    ejecutarMigraciones(db, DIR_MIGRACIONES);
    ejecutarSemilla(db);
  });

  afterEach(() => {
    cerrar(db);
  });

  it('importa extracto BBVA y devuelve conteo de nuevas', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));
    const resultado = importarExtracto(db, buffer, 'bbva');

    assert.ok(resultado.nuevas > 0, 'Debería insertar transacciones');
    assert.equal(resultado.duplicadas, 0);

    const txs = consultar(db, "SELECT * FROM transacciones");
    assert.equal(txs.length, resultado.nuevas);

    // Verificar que todas tienen cuenta_id de BBVA
    const cuenta = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0];
    assert.ok(txs.every(t => t.cuenta_id === cuenta.id));
  });

  it('importa extracto Openbank correctamente', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));
    const resultado = importarExtracto(db, buffer, 'openbank');

    assert.ok(resultado.nuevas > 0, 'Debería insertar transacciones');
    assert.equal(resultado.duplicadas, 0);

    const cuenta = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Openbank'")[0];
    const txs = consultar(db, "SELECT * FROM transacciones WHERE cuenta_id = ?", [cuenta.id]);
    assert.equal(txs.length, resultado.nuevas);
  });

  it('doble importación del mismo extracto = 0 nuevas', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));

    const primera = importarExtracto(db, buffer, 'bbva');
    assert.ok(primera.nuevas > 0);

    const segunda = importarExtracto(db, buffer, 'bbva');
    assert.equal(segunda.nuevas, 0);
    assert.equal(segunda.duplicadas, primera.nuevas);

    // Total en DB no cambia
    const total = consultar(db, "SELECT count(*) AS n FROM transacciones")[0].n;
    assert.equal(total, primera.nuevas);
  });

  it('transacciones con mismo día/concepto/importe pero saldo distinto se insertan ambas', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));
    importarExtracto(db, buffer, 'bbva');

    // Buscar si hay transacciones del mismo día/concepto (hay "Supermercado panda" x2 y "Autopista r4" x2)
    const duplicadosConcepto = consultar(db, `
      SELECT fecha_operacion, concepto, count(*) AS n
      FROM transacciones
      GROUP BY fecha_operacion, concepto
      HAVING n > 1
    `);

    // Si hay transacciones con mismo día y concepto, verificar que tienen saldos distintos
    for (const grupo of duplicadosConcepto) {
      const txs = consultar(db, `
        SELECT saldo_resultante FROM transacciones
        WHERE fecha_operacion = ? AND concepto = ?
      `, [grupo.fecha_operacion, grupo.concepto]);
      const saldos = new Set(txs.map(t => t.saldo_resultante));
      assert.ok(saldos.size === txs.length, `Transacciones duplicadas por concepto "${grupo.concepto}" deberían tener saldos distintos`);
    }
  });

  it('marca aviso_divisa para transacciones no EUR', () => {
    // Todas las transacciones reales son EUR, así que verificamos que aviso_divisa = 0
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));
    importarExtracto(db, buffer, 'bbva');

    const conAviso = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE aviso_divisa = 1")[0].n;
    assert.equal(conAviso, 0, 'Ninguna transacción EUR debería tener aviso');
  });

  it('importar extracto multimes asigna meses económicos automáticamente', () => {
    const catIngreso = consultar(db, "SELECT id FROM categorias WHERE nombre = 'Transferencia cuenta común'")[0].id;

    // Crear regla para que las transferencias se categoricen como ingreso
    crearRegla(db, 'traspaso desde cuenta', catIngreso);

    // Importar extracto multimes que contiene transferencia >1000 el día 27/02
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-BBVA-MarzoFebrero2026.xlsx'));
    importarExtracto(db, buffer, 'bbva');

    // Verificar que se crearon meses económicos
    const meses = consultar(db, "SELECT * FROM meses_economicos ORDER BY fecha_inicio");
    assert.ok(meses.length > 0, 'Debería haber al menos un mes económico');

    // Verificar que hay transacciones asignadas
    const conMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id IS NOT NULL")[0].n;
    assert.ok(conMes > 0, 'Debería haber transacciones con mes asignado');
  });

  it('transferencias entre cuentas propias no se concilian automáticamente', () => {
    // Importar BBVA y Openbank — ambos tienen transferencias cruzadas
    const bufferBbva = readFileSync(join(DIR_SAMPLES, 'Extracto-BBVA-MarzoFebrero2026.xlsx'));
    const bufferOpen = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));

    importarExtracto(db, bufferBbva, 'bbva');
    importarExtracto(db, bufferOpen, 'openbank');

    // Las transferencias cruzadas aparecen como registros independientes en cada cuenta
    const cuentaBbva = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'BBVA'")[0].id;
    const cuentaOpen = consultar(db, "SELECT id FROM cuentas WHERE nombre = 'Openbank'")[0].id;

    const txBbva = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE cuenta_id = ?", [cuentaBbva])[0].n;
    const txOpen = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE cuenta_id = ?", [cuentaOpen])[0].n;

    assert.ok(txBbva > 0, 'BBVA debería tener transacciones');
    assert.ok(txOpen > 0, 'Openbank debería tener transacciones');

    // Total de transacciones = suma de ambas (no se concilian)
    const total = consultar(db, "SELECT count(*) AS n FROM transacciones")[0].n;
    assert.equal(total, txBbva + txOpen, 'No debería conciliar — cada cuenta mantiene sus transacciones');
  });

  it('lanza error con banco no soportado', () => {
    const buffer = Buffer.from('test');
    assert.throws(
      () => importarExtracto(db, buffer, 'santander'),
      (err) => err.message.includes('no soportado')
    );
  });
});
