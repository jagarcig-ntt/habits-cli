import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearOpenbank } from '../../src/core/parsers/openbank.js';

const DIR_SAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'samples', 'extractos-tipo');

describe('parsearOpenbank', () => {
  it('parsea extracto real y extrae todas las transacciones', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));
    const txs = parsearOpenbank(buffer);

    assert.ok(txs.length > 0, 'Debería tener transacciones');

    // Primera transacción
    const primera = txs[0];
    assert.equal(primera.fechaOperacion, '2026-03-23');
    assert.equal(primera.fechaValor, '2026-03-21');
    assert.ok(primera.concepto.includes('Fondo de Inversion'));
    assert.equal(primera.importe, -600);
    assert.equal(primera.saldoResultante, 23400.03);
    assert.equal(primera.divisa, 'EUR');
  });

  it('convierte importes europeos correctamente', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));
    const txs = parsearOpenbank(buffer);

    // Buscar la transferencia de -1.000,00
    const tx1000 = txs.find(t => t.importe === -1000);
    assert.ok(tx1000, 'Debería encontrar transacción de -1000');
    assert.equal(tx1000.saldoResultante, 24000.03);

    // Verificar que 500,00 se parsea como 500
    const tx500 = txs.find(t => t.importe === 500);
    assert.ok(tx500, 'Debería encontrar transacción de 500');
  });

  it('parsea correctamente caracteres acentuados (ISO-8859-1)', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));
    const txs = parsearOpenbank(buffer);

    const conAcento = txs.find(t => t.concepto.includes('García'));
    assert.ok(conAcento, 'Debería encontrar concepto con "García" (acento)');
  });

  it('convierte fechas DD/MM/YYYY a YYYY-MM-DD', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-Openbank.xlsx'));
    const txs = parsearOpenbank(buffer);

    for (const tx of txs) {
      assert.match(tx.fechaOperacion, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(tx.fechaValor, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('lanza error con extracto vacío (HTML sin filas de datos)', () => {
    const html = `<table>
      <tr><td>Fecha Operación</td><td>Fecha Valor</td><td>Concepto</td><td>Importe</td><td>Saldo</td></tr>
    </table>`;
    const buffer = Buffer.from(html, 'latin1');

    assert.throws(
      () => parsearOpenbank(buffer),
      (err) => err.message.includes('vacío')
    );
  });

  it('lanza error si la cabecera no es reconocida', () => {
    const html = `<table>
      <tr><td>Columna rara</td><td>Otra</td></tr>
      <tr><td>dato1</td><td>dato2</td></tr>
    </table>`;
    const buffer = Buffer.from(html, 'latin1');

    assert.throws(
      () => parsearOpenbank(buffer),
      (err) => err.message.includes('Cabecera')
    );
  });
});
