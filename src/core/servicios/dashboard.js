import { consultar } from '../db.js';

function agregarPorGrupo(db, transacciones) {
  const grupos = {};

  for (const tx of transacciones) {
    if (tx.grupo_nombre) {
      if (!grupos[tx.grupo_nombre]) {
        grupos[tx.grupo_nombre] = { nombre: tx.grupo_nombre, total: 0, categorias: {} };
      }
      grupos[tx.grupo_nombre].total += tx.importe;

      const catNombre = tx.categoria_nombre;
      if (!grupos[tx.grupo_nombre].categorias[catNombre]) {
        grupos[tx.grupo_nombre].categorias[catNombre] = { nombre: catNombre, total: 0 };
      }
      grupos[tx.grupo_nombre].categorias[catNombre].total += tx.importe;
    } else {
      if (!grupos['Sin categorizar']) {
        grupos['Sin categorizar'] = { nombre: 'Sin categorizar', total: 0, categorias: {} };
      }
      grupos['Sin categorizar'].total += tx.importe;
    }
  }

  // Convertir categorias de objeto a array
  return Object.values(grupos).map(g => ({
    nombre: g.nombre,
    total: Math.round(g.total * 100) / 100,
    categorias: Object.values(g.categorias).map(c => ({
      nombre: c.nombre,
      total: Math.round(c.total * 100) / 100,
    })),
  }));
}

function calcularTotales(db, transacciones) {
  const totales = { gasto: 0, ingreso: 0, ahorro: 0, inversion: 0 };

  for (const tx of transacciones) {
    if (!tx.tipo_nombre) continue;
    const tipo = tx.tipo_nombre === 'inversión' ? 'inversion' : tx.tipo_nombre;
    if (tipo in totales) {
      totales[tipo] += tx.importe;
    }
  }

  // Redondear
  for (const k of Object.keys(totales)) {
    totales[k] = Math.round(totales[k] * 100) / 100;
  }
  return totales;
}

export function dashboardAnual(db, anio) {
  const meses = consultar(db, `
    SELECT * FROM meses_economicos
    WHERE substr(fecha_inicio, 1, 4) = ? OR substr(fecha_inicio, 1, 4) = ?
    ORDER BY fecha_inicio ASC
  `, [String(anio - 1), String(anio)]);

  // Filtrar meses cuyo nombre corresponda al año pedido
  const mesesDelAnio = meses.filter(m => m.nombre.endsWith(String(anio)));

  if (mesesDelAnio.length === 0) {
    // Verificar si hay transacciones sin mes del año
    const txSinMes = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE mes_economico_id IS NULL")[0].n;
    if (txSinMes === 0) {
      return { vacio: true, meses: [] };
    }
  }

  const resultado = [];

  for (const mes of mesesDelAnio) {
    const txs = consultar(db, `
      SELECT t.importe, t.categoria_id,
             c.nombre AS categoria_nombre,
             g.nombre AS grupo_nombre,
             ti.nombre AS tipo_nombre
      FROM transacciones t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      LEFT JOIN grupos g ON c.grupo_id = g.id
      LEFT JOIN tipos ti ON g.tipo_id = ti.id
      WHERE t.mes_economico_id = ? AND t.importe != 0
    `, [mes.id]);

    if (txs.length === 0) continue;

    resultado.push({
      mes_id: mes.id,
      nombre: mes.nombre,
      totales: calcularTotales(db, txs),
      grupos: agregarPorGrupo(db, txs),
    });
  }

  return {
    vacio: resultado.length === 0,
    meses: resultado,
  };
}

export function dashboardMensual(db, mesId) {
  const txs = consultar(db, `
    SELECT t.importe, t.categoria_id,
           c.nombre AS categoria_nombre,
           g.nombre AS grupo_nombre,
           ti.nombre AS tipo_nombre
    FROM transacciones t
    LEFT JOIN categorias c ON t.categoria_id = c.id
    LEFT JOIN grupos g ON c.grupo_id = g.id
    LEFT JOIN tipos ti ON g.tipo_id = ti.id
    WHERE t.mes_economico_id = ? AND t.importe != 0
  `, [mesId]);

  if (txs.length === 0) {
    return { vacio: true, totales: { gasto: 0, ingreso: 0, ahorro: 0, inversion: 0 }, grupos: [], sin_categorizar: 0 };
  }

  const sinCat = txs.filter(t => !t.categoria_id).reduce((s, t) => s + t.importe, 0);

  return {
    vacio: false,
    totales: calcularTotales(db, txs),
    grupos: agregarPorGrupo(db, txs),
    sin_categorizar: Math.round(sinCat * 100) / 100,
  };
}
