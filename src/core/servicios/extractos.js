import { consultar, ejecutar } from '../db.js';
import { parsearBBVA } from '../parsers/bbva.js';
import { parsearOpenbank } from '../parsers/openbank.js';
import { calcularMesesEconomicos } from './mesEconomico.js';
import { aplicarReglasASinCategorizar } from './reglas.js';

const PARSERS = {
  bbva: parsearBBVA,
  openbank: parsearOpenbank,
};

export function importarExtracto(db, buffer, banco) {
  const parser = PARSERS[banco];
  if (!parser) {
    throw new Error(`Banco no soportado: "${banco}"`);
  }

  const cuenta = consultar(db, "SELECT id FROM cuentas WHERE lower(nombre) = ?", [banco.toLowerCase()]);
  if (cuenta.length === 0) {
    throw new Error(`Cuenta no encontrada para banco: "${banco}"`);
  }
  const cuentaId = cuenta[0].id;

  const transacciones = parser(buffer);

  let nuevas = 0;
  let duplicadas = 0;
  const avisos = [];

  const stmt = db.prepare(`
    INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, divisa, cuenta_id, aviso_divisa)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tx of transacciones) {
    const avisoDivisa = tx.divisa !== 'EUR' ? 1 : 0;
    if (avisoDivisa) {
      avisos.push(`Divisa ${tx.divisa} en transacción "${tx.concepto}" del ${tx.fechaOperacion}`);
    }

    try {
      stmt.run(
        tx.fechaValor,
        tx.fechaOperacion,
        tx.concepto,
        tx.importe,
        tx.saldoResultante,
        tx.divisa,
        cuentaId,
        avisoDivisa,
      );
      nuevas++;
    } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        duplicadas++;
      } else {
        throw err;
      }
    }
  }

  if (nuevas > 0) {
    // Aplicar reglas a transacciones nuevas sin categorizar
    aplicarReglasASinCategorizar(db);
    // Asignar meses económicos
    calcularMesesEconomicos(db);
  }

  return { nuevas, duplicadas, avisos };
}
