import { consultar, ejecutar } from '../db.js';

export function obtenerTransacciones(db, filtros, paginacion = {}) {
  const { limit = 25, offset = 0 } = paginacion;
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
  if (filtros.concepto) {
    condiciones.push("lower(t.concepto) LIKE ?");
    params.push(`%${filtros.concepto.toLowerCase()}%`);
  }
  if (filtros.fecha_desde) {
    condiciones.push("t.fecha_operacion >= ?");
    params.push(filtros.fecha_desde);
  }
  if (filtros.fecha_hasta) {
    condiciones.push("t.fecha_operacion <= ?");
    params.push(filtros.fecha_hasta);
  }
  if (filtros.tipo === 'gasto') {
    condiciones.push("ti.nombre = 'gasto'");
  } else if (filtros.tipo === 'ahorro_inversion') {
    condiciones.push("ti.nombre IN ('ahorro', 'inversión')");
  } else if (filtros.tipo === 'otros') {
    condiciones.push("(ti.nombre = 'ingreso' OR t.categoria_id IS NULL)");
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const joins = `
    LEFT JOIN categorias c ON t.categoria_id = c.id
    LEFT JOIN grupos g ON c.grupo_id = g.id
    LEFT JOIN tipos ti ON g.tipo_id = ti.id
    LEFT JOIN cuentas cu ON t.cuenta_id = cu.id
  `;

  const total = consultar(db, `
    SELECT count(*) AS n FROM transacciones t ${joins} ${where}
  `, params)[0].n;

  const transacciones = consultar(db, `
    SELECT t.id, t.fecha_valor, t.fecha_operacion, t.concepto, t.importe,
           t.saldo_resultante, t.divisa, t.cuenta_id, t.categoria_id,
           t.origen_categoria, t.mes_economico_id, t.aviso_divisa, t.excluida,
           c.nombre AS categoria_nombre,
           g.nombre AS grupo_nombre,
           cu.nombre AS cuenta_nombre
    FROM transacciones t
    ${joins}
    ${where}
    ORDER BY t.fecha_operacion ASC, t.id ASC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return { transacciones, total, hayMas: offset + transacciones.length < total };
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

export function alternarExclusion(db, id, excluida) {
  ejecutar(db, "UPDATE transacciones SET excluida = ? WHERE id = ?", [excluida ? 1 : 0, id]);
  const tx = consultar(db, "SELECT id, excluida FROM transacciones WHERE id = ?", [id]);
  return tx[0];
}

export function excluirEnLote(db, ids, excluida) {
  let actualizadas = 0;

  for (const id of ids) {
    const { changes } = ejecutar(db,
      "UPDATE transacciones SET excluida = ? WHERE id = ?",
      [excluida ? 1 : 0, id]);
    actualizadas += changes;
  }

  return { actualizadas };
}
