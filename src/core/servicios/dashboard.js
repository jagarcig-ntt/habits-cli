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

function sumarAhorroManual(db, mesId) {
  const filas = consultar(db, "SELECT tipo, sum(importe) AS total FROM ahorro_manual WHERE mes_economico_id = ? GROUP BY tipo", [mesId]);
  const resultado = { ahorro: 0, inversion: 0 };
  for (const f of filas) {
    if (f.tipo === 'ahorro') resultado.ahorro = f.total;
    if (f.tipo === 'inversion') resultado.inversion = f.total;
  }
  return resultado;
}

function combinarConAhorroManual(totales, manual) {
  return {
    ...totales,
    ahorro: Math.round((totales.ahorro + manual.ahorro) * 100) / 100,
    inversion: Math.round((totales.inversion + manual.inversion) * 100) / 100,
  };
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
      WHERE t.mes_economico_id = ? AND t.importe != 0 AND t.excluida = 0
    `, [mes.id]);

    const manual = sumarAhorroManual(db, mes.id);
    if (txs.length === 0 && manual.ahorro === 0 && manual.inversion === 0) continue;

    resultado.push({
      mes_id: mes.id,
      nombre: mes.nombre,
      totales: combinarConAhorroManual(calcularTotales(db, txs), manual),
      grupos: agregarPorGrupo(db, txs),
    });
  }

  return {
    vacio: resultado.length === 0,
    meses: resultado,
  };
}

function variacionPorcentual(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / Math.abs(anterior)) * 1000) / 10;
}

export function calcularComparativas(meses) {
  return meses.map((mes, i) => {
    if (i === 0) return { ...mes, comparativa: null };

    const anterior = meses[i - 1].totales;
    const actual = mes.totales;
    return {
      ...mes,
      comparativa: {
        gasto: variacionPorcentual(actual.gasto, anterior.gasto),
        ingreso: variacionPorcentual(actual.ingreso, anterior.ingreso),
      },
    };
  });
}

export function acumuladoAhorroInversionAnual(db, anio) {
  const txTotales = consultar(db, `
    SELECT ti.nombre AS tipo, sum(t.importe) AS total
    FROM transacciones t
    JOIN categorias c ON t.categoria_id = c.id
    JOIN grupos g ON c.grupo_id = g.id
    JOIN tipos ti ON g.tipo_id = ti.id
    JOIN meses_economicos m ON t.mes_economico_id = m.id
    WHERE ti.nombre IN ('ahorro', 'inversión') AND t.excluida = 0 AND t.importe != 0 AND m.nombre LIKE ?
    GROUP BY ti.nombre
  `, [`%${anio}`]);

  const manualTotales = consultar(db, `
    SELECT am.tipo AS tipo, sum(am.importe) AS total
    FROM ahorro_manual am
    JOIN meses_economicos m ON am.mes_economico_id = m.id
    WHERE m.nombre LIKE ?
    GROUP BY am.tipo
  `, [`%${anio}`]);

  let ahorro = 0;
  let inversion = 0;

  for (const f of txTotales) {
    if (f.tipo === 'ahorro') ahorro += f.total;
    if (f.tipo === 'inversión') inversion += f.total;
  }
  for (const f of manualTotales) {
    if (f.tipo === 'ahorro') ahorro += f.total;
    if (f.tipo === 'inversion') inversion += f.total;
  }

  return {
    ahorro: Math.round(ahorro * 100) / 100,
    inversion: Math.round(inversion * 100) / 100,
  };
}

export function ratioAhorroIngreso(totalAhorro, totalIngreso) {
  if (!totalIngreso) return null;
  return Math.round((totalAhorro / totalIngreso) * 1000) / 10;
}

export function topCategoriasGasto(db, anio, limite = 5) {
  const filas = consultar(db, `
    SELECT c.nombre AS nombre, sum(t.importe) AS total
    FROM transacciones t
    JOIN categorias c ON t.categoria_id = c.id
    JOIN grupos g ON c.grupo_id = g.id
    JOIN tipos ti ON g.tipo_id = ti.id
    JOIN meses_economicos m ON t.mes_economico_id = m.id
    WHERE ti.nombre = 'gasto' AND t.excluida = 0 AND t.importe != 0 AND m.nombre LIKE ?
    GROUP BY c.id
    ORDER BY total ASC
    LIMIT ?
  `, [`%${anio}`, limite]);

  return filas.map(f => ({ nombre: f.nombre, total: Math.round(f.total * 100) / 100 }));
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
    WHERE t.mes_economico_id = ? AND t.importe != 0 AND t.excluida = 0
  `, [mesId]);

  const manual = sumarAhorroManual(db, mesId);

  if (txs.length === 0 && manual.ahorro === 0 && manual.inversion === 0) {
    return { vacio: true, totales: { gasto: 0, ingreso: 0, ahorro: 0, inversion: 0 }, grupos: [], sin_categorizar: 0 };
  }

  const sinCat = txs.filter(t => !t.categoria_id).reduce((s, t) => s + t.importe, 0);

  return {
    vacio: false,
    totales: combinarConAhorroManual(calcularTotales(db, txs), manual),
    grupos: agregarPorGrupo(db, txs),
    sin_categorizar: Math.round(sinCat * 100) / 100,
  };
}
