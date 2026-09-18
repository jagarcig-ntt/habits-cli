import { consultar, ejecutar } from '../db.js';
import { calcularMesesEconomicos } from './mesEconomico.js';

function errorConCodigo(mensaje, codigo) {
  const err = new Error(mensaje);
  err.code = codigo;
  return err;
}

/**
 * Aplica todas las reglas a transacciones sin categorizar.
 * Reglas ordenadas por longitud de patrón descendente (la más larga gana).
 * No toca transacciones con origen_categoria = 'manual'.
 */
export function aplicarReglasASinCategorizar(db) {
  const reglas = consultar(db, "SELECT * FROM reglas ORDER BY length(patron) DESC");
  const sinCategorizar = consultar(db, "SELECT id, concepto FROM transacciones WHERE categoria_id IS NULL");

  let total = 0;
  for (const tx of sinCategorizar) {
    const conceptoLower = tx.concepto.toLowerCase();
    for (const regla of reglas) {
      if (conceptoLower.includes(regla.patron.toLowerCase())) {
        ejecutar(db, "UPDATE transacciones SET categoria_id = ?, origen_categoria = 'regla' WHERE id = ?",
          [regla.categoria_id, tx.id]);
        total++;
        break;
      }
    }
  }
  return total;
}

/**
 * Aplica una regla específica a transacciones que coincidan:
 * - Sin categorizar (categoria_id IS NULL)
 * - Categorizadas por reglas más cortas (origen_categoria = 'regla')
 * No toca transacciones con origen_categoria = 'manual'.
 * Respeta que no exista otra regla más larga que también coincida.
 */
function aplicarReglaEspecifica(db, regla) {
  const candidatas = consultar(db,
    "SELECT id, concepto FROM transacciones WHERE categoria_id IS NULL OR origen_categoria = 'regla'");
  const reglasLargas = consultar(db,
    "SELECT patron, categoria_id FROM reglas WHERE id != ? AND length(patron) > ? ORDER BY length(patron) DESC",
    [regla.id, regla.patron.length]);

  let aplicadas = 0;
  for (const tx of candidatas) {
    const conceptoLower = tx.concepto.toLowerCase();
    if (!conceptoLower.includes(regla.patron.toLowerCase())) continue;

    // Verificar que no hay una regla más larga que también coincida
    const hayMasLarga = reglasLargas.some(r => conceptoLower.includes(r.patron.toLowerCase()));
    if (hayMasLarga) continue;

    ejecutar(db, "UPDATE transacciones SET categoria_id = ?, origen_categoria = 'regla' WHERE id = ?",
      [regla.categoria_id, tx.id]);
    aplicadas++;
  }
  return aplicadas;
}

export function crearRegla(db, patron, categoriaId) {
  const existe = consultar(db, "SELECT id FROM reglas WHERE patron = ?", [patron]);
  if (existe.length > 0) {
    throw errorConCodigo(`Ya existe una regla con patrón "${patron}"`, 'DUPLICADO');
  }

  const { lastInsertRowid } = ejecutar(db, "INSERT INTO reglas (patron, categoria_id) VALUES (?, ?)", [patron, categoriaId]);
  const regla = { id: Number(lastInsertRowid), patron, categoria_id: categoriaId };

  const aplicadas = aplicarReglaEspecifica(db, regla);
  if (aplicadas > 0) calcularMesesEconomicos(db);
  return { ...regla, aplicadas };
}

export function editarRegla(db, id, patron, categoriaId) {
  const reglaExistente = consultar(db, "SELECT * FROM reglas WHERE id = ?", [id]);
  if (reglaExistente.length === 0) {
    throw errorConCodigo('Regla no encontrada', 'NO_ENCONTRADO');
  }

  // Verificar duplicado de patrón (excluyendo la propia regla)
  const duplicado = consultar(db, "SELECT id FROM reglas WHERE patron = ? AND id != ?", [patron, id]);
  if (duplicado.length > 0) {
    throw errorConCodigo(`Ya existe una regla con patrón "${patron}"`, 'DUPLICADO');
  }

  ejecutar(db, "UPDATE reglas SET patron = ?, categoria_id = ? WHERE id = ?", [patron, categoriaId, id]);
  const regla = { id, patron, categoria_id: categoriaId };

  const aplicadas = aplicarReglaEspecifica(db, regla);
  if (aplicadas > 0) calcularMesesEconomicos(db);
  return { ...regla, aplicadas };
}

export function eliminarRegla(db, id) {
  const regla = consultar(db, "SELECT * FROM reglas WHERE id = ?", [id]);
  if (regla.length === 0) {
    throw errorConCodigo('Regla no encontrada', 'NO_ENCONTRADO');
  }

  ejecutar(db, "DELETE FROM reglas WHERE id = ?", [id]);
  // No se tocan las transacciones ya categorizadas
}

export function obtenerReglas(db) {
  return consultar(db, `
    SELECT r.id, r.patron, r.categoria_id,
           c.nombre AS categoria_nombre,
           g.nombre AS grupo_nombre
    FROM reglas r
    JOIN categorias c ON r.categoria_id = c.id
    JOIN grupos g ON c.grupo_id = g.id
    ORDER BY r.patron
  `);
}
