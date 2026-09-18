import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { parsearBBVA } from '../../src/core/parsers/bbva.js';

const DIR_SAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'samples', 'extractos-tipo');

function crearXlsxDesdeFilas(filas) {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(filas);
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

describe('parsearBBVA', () => {
  it('parsea extracto real y extrae todas las transacciones', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));
    const txs = parsearBBVA(buffer);

    assert.equal(txs.length, 19);

    const primera = txs[0];
    assert.equal(primera.fechaValor, '2026-03-26');
    assert.equal(primera.fechaOperacion, '2026-03-26');
    assert.equal(primera.concepto, 'Recambios getafe         getafe       es');
    assert.equal(primera.importe, -25.66);
    assert.equal(primera.saldoResultante, 137.07);
    assert.equal(primera.divisa, 'EUR');

    const ultima = txs[txs.length - 1];
    assert.equal(ultima.fechaValor, '2026-03-21');
    assert.equal(ultima.fechaOperacion, '2026-03-23');
    assert.equal(ultima.concepto, 'Transferencia recibida');
    assert.equal(ultima.importe, 600);
    assert.equal(ultima.saldoResultante, 629.38);
  });

  it('parsea extracto multimes correctamente', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-BBVA-MarzoFebrero2026.xlsx'));
    const txs = parsearBBVA(buffer);

    assert.ok(txs.length > 0, 'Debería tener transacciones');
    const meses = new Set(txs.map(t => t.fechaOperacion.substring(5, 7)));
    assert.ok(meses.has('02') || meses.has('03'), 'Debería tener transacciones de feb o mar');
  });

  it('convierte fechas DD/MM/YYYY a YYYY-MM-DD', () => {
    const buffer = readFileSync(join(DIR_SAMPLES, 'Extracto-Marzo26-BBVA.xlsx'));
    const txs = parsearBBVA(buffer);

    for (const tx of txs) {
      assert.match(tx.fechaValor, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(tx.fechaOperacion, /^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('lanza error con extracto vacío', () => {
    const buffer = crearXlsxDesdeFilas([
      [null],
      [null, null, 'Últimos movimientos'],
      [null, null, 'Fecha de generación'],
      [null],
      ['F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Divisa', 'Observaciones'],
    ]);

    assert.throws(
      () => parsearBBVA(buffer),
      (err) => err.message.includes('vacío')
    );
  });

  it('lanza error con fichero corrupto', () => {
    const buffer = Buffer.from('esto no es un xlsx');

    assert.throws(
      () => parsearBBVA(buffer),
      (err) => err.message.includes('formato') || err.message.includes('Cabecera')
    );
  });

  it('lanza error si la cabecera no es reconocida', () => {
    const buffer = crearXlsxDesdeFilas([
      ['Columna rara', 'Otra columna'],
      ['dato1', 'dato2'],
    ]);

    assert.throws(
      () => parsearBBVA(buffer),
      (err) => err.message.includes('Cabecera')
    );
  });
});
