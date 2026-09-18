import { consultar, ejecutar } from '../db.js';

export function obtenerTransacciones(db, filtros) {
  const condiciones = [];
  const params = [];

  if (filtros.mes_id) {
    condiciones.push("t.mes_economico_id = ?");
    params.push(filtros.mes_id);
  }
  if (filtros.categoria_id) {
    condiciones.push("t.categoria_id = ?");
    params.push(filtros.categoria_id);
  }
  if (filtros.cuenta_id) {
    condiciones.push("t.cuenta_id = ?");
    params.push(filtros.cuenta_id);
  }
  if (filtros.importe_min != null) {
    condiciones.push("t.importe >= ?");
    params.push(filtros.importe_min);
  }
  if (filtros.importe_max != null) {
    condiciones.push("t.importe <= ?");
    params.push(filtros.importe_max);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const transacciones = consultar(db, `
    SELECT t.id, t.fecha_valor, t.fecha_operacion, t.concepto, t.importe,
           t.saldo_resultante, t.divisa, t.cuenta_id, t.categoria_id,
           t.origen_categoria, t.mes_economico_id, t.aviso_divisa,
           c.nombre AS categoria_nombre,
           g.nombre AS grupo_nombre,
           cu.nombre AS cuenta_nombre
    FROM transacciones t
    LEFT JOIN categorias c ON t.categoria_id = c.id
    LEFT JOIN grupos g ON c.grupo_id = g.id
    LEFT JOIN cuentas cu ON t.cuenta_id = cu.id
    ${where}
    ORDER BY t.fecha_operacion ASC, t.id ASC
  `, params);

  return { transacciones, total: transacciones.length };
}

export function categorizarManual(db, ids, categoriaId) {
  let actualizadas = 0;

  for (const id of ids) {
    const { changes } = ejecutar(db,
      "UPDATE transacciones SET categoria_id = ?, origen_categoria = 'manual' WHERE id = ?",
      [categoriaId, id]);
    actualizadas += changes;
  }

  return { actualizadas };
}
