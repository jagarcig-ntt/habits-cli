import { consultar, ejecutar } from '../db.js';

const MESES_NOMBRE = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function nombreMes(fechaCorte) {
  // El corte del 26 de febrero corresponde al mes de "Marzo"
  const fecha = new Date(fechaCorte + 'T00:00:00');
  // Sumar un mes para obtener el nombre del mes económico
  fecha.setMonth(fecha.getMonth() + 1);
  return `${MESES_NOMBRE[fecha.getMonth() + 1]} ${fecha.getFullYear()}`;
}

function restarDia(fechaStr) {
  const [anio, mes, dia] = fechaStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia - 1);
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

/**
 * Detecta cortes automáticos y crea/actualiza meses económicos.
 * Luego asigna transacciones sin mes a su mes correspondiente.
 * Retorna la lista de meses económicos.
 */
export function calcularMesesEconomicos(db) {
  // Obtener categorías de tipo ingreso
  const tipoIngreso = consultar(db, "SELECT id FROM tipos WHERE nombre = 'ingreso'");
  if (tipoIngreso.length === 0) return [];

  const categoriasIngreso = consultar(db, `
    SELECT c.id FROM categorias c
    JOIN grupos g ON c.grupo_id = g.id
    WHERE g.tipo_id = ?
  `, [tipoIngreso[0].id]).map(c => c.id);

  if (categoriasIngreso.length === 0) return [];

  // Buscar transferencias >1000 en días 25-28 categorizadas como ingreso
  const placeholders = categoriasIngreso.map(() => '?').join(',');
  const cortes = consultar(db, `
    SELECT id, fecha_operacion, importe FROM transacciones
    WHERE categoria_id IN (${placeholders})
      AND importe > 1000
      AND CAST(strftime('%d', fecha_operacion) AS INTEGER) BETWEEN 25 AND 28
    ORDER BY fecha_operacion ASC
  `, categoriasIngreso);

  // Obtener meses manuales existentes
  const mesesManuales = consultar(db, "SELECT * FROM meses_economicos WHERE corte_manual = 1 ORDER BY fecha_inicio ASC");

  // Combinar cortes automáticos y manuales
  const todosLosCortes = [];

  for (const corte of cortes) {
    todosLosCortes.push({
      fechaInicio: corte.fecha_operacion,
      nombre: nombreMes(corte.fecha_operacion),
      corteManual: 0,
    });
  }

  for (const manual of mesesManuales) {
    // Solo añadir si no hay ya un corte automático en esa fecha
    const yaExiste = todosLosCortes.some(c => c.fechaInicio === manual.fecha_inicio);
    if (!yaExiste) {
      todosLosCortes.push({
        fechaInicio: manual.fecha_inicio,
        nombre: manual.nombre,
        corteManual: 1,
        idExistente: manual.id,
      });
    }
  }

  // Ordenar por fecha
  todosLosCortes.sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  // Crear/actualizar meses en DB
  const meses = [];
  for (let i = 0; i < todosLosCortes.length; i++) {
    const corte = todosLosCortes[i];
    const fechaFin = i < todosLosCortes.length - 1
      ? restarDia(todosLosCortes[i + 1].fechaInicio)
      : null;

    if (corte.idExistente) {
      // Actualizar mes manual existente
      ejecutar(db, "UPDATE meses_economicos SET fecha_fin = ? WHERE id = ?", [fechaFin, corte.idExistente]);
      meses.push({ id: corte.idExistente, nombre: corte.nombre, fecha_inicio: corte.fechaInicio, fecha_fin: fechaFin, corte_manual: corte.corteManual });
    } else {
      // Buscar si ya existe un mes automático con esa fecha_inicio
      const existente = consultar(db, "SELECT id FROM meses_economicos WHERE fecha_inicio = ?", [corte.fechaInicio]);
      if (existente.length > 0) {
        ejecutar(db, "UPDATE meses_economicos SET fecha_fin = ?, nombre = ? WHERE id = ?",
          [fechaFin, corte.nombre, existente[0].id]);
        meses.push({ id: existente[0].id, nombre: corte.nombre, fecha_inicio: corte.fechaInicio, fecha_fin: fechaFin, corte_manual: corte.corteManual });
      } else {
        const { lastInsertRowid } = ejecutar(db,
          "INSERT INTO meses_economicos (nombre, fecha_inicio, fecha_fin, corte_manual) VALUES (?, ?, ?, ?)",
          [corte.nombre, corte.fechaInicio, fechaFin, corte.corteManual]);
        meses.push({ id: Number(lastInsertRowid), nombre: corte.nombre, fecha_inicio: corte.fechaInicio, fecha_fin: fechaFin, corte_manual: corte.corteManual });
      }
    }
  }

  // Asignar transacciones sin mes a su mes correspondiente
  for (const mes of meses) {
    if (mes.fecha_fin) {
      ejecutar(db, `
        UPDATE transacciones SET mes_economico_id = ?
        WHERE mes_economico_id IS NULL
          AND fecha_operacion >= ? AND fecha_operacion <= ?
      `, [mes.id, mes.fecha_inicio, mes.fecha_fin]);
    } else {
      // Mes abierto (último)
      ejecutar(db, `
        UPDATE transacciones SET mes_economico_id = ?
        WHERE mes_economico_id IS NULL
          AND fecha_operacion >= ?
      `, [mes.id, mes.fecha_inicio]);
    }
  }

  return meses;
}

/**
 * Crea un corte manual de mes económico.
 */
export function asignarMesManual(db, fechaInicio) {
  const nombre = nombreMes(fechaInicio);
  const { lastInsertRowid } = ejecutar(db,
    "INSERT INTO meses_economicos (nombre, fecha_inicio, corte_manual) VALUES (?, ?, 1)",
    [nombre, fechaInicio]);
  return { id: Number(lastInsertRowid), nombre, fecha_inicio: fechaInicio, corte_manual: 1 };
}

/**
 * Obtiene meses económicos de un año.
 */
export function obtenerMeses(db, anio) {
  if (anio) {
    return consultar(db, `
      SELECT * FROM meses_economicos
      WHERE fecha_inicio LIKE ? OR fecha_inicio LIKE ?
      ORDER BY fecha_inicio ASC
    `, [`${anio}-%`, `${anio - 1}-%`]);
  }
  return consultar(db, "SELECT * FROM meses_economicos ORDER BY fecha_inicio ASC");
}
