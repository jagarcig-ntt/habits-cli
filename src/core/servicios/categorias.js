import { consultar, ejecutar } from '../db.js';

function errorConCodigo(mensaje, codigo) {
  const err = new Error(mensaje);
  err.code = codigo;
  return err;
}

// --- Grupos ---

export function crearGrupo(db, nombre, tipoId) {
  const existe = consultar(db, "SELECT id FROM grupos WHERE nombre = ? AND tipo_id = ?", [nombre, tipoId]);
  if (existe.length > 0) {
    throw errorConCodigo(`Ya existe un grupo "${nombre}" en este tipo`, 'DUPLICADO');
  }

  const { lastInsertRowid } = ejecutar(db, "INSERT INTO grupos (nombre, tipo_id) VALUES (?, ?)", [nombre, tipoId]);
  return { id: Number(lastInsertRowid), nombre, tipo_id: tipoId };
}

export function editarGrupo(db, id, nombre) {
  const grupo = consultar(db, "SELECT * FROM grupos WHERE id = ?", [id]);
  if (grupo.length === 0) {
    throw errorConCodigo('Grupo no encontrado', 'NO_ENCONTRADO');
  }

  ejecutar(db, "UPDATE grupos SET nombre = ? WHERE id = ?", [nombre, id]);
  return { id, nombre, tipo_id: grupo[0].tipo_id };
}

export function eliminarGrupo(db, id) {
  // Verificar si alguna categoría del grupo tiene transacciones
  const conTransacciones = consultar(db, `
    SELECT count(*) AS n FROM transacciones t
    JOIN categorias c ON t.categoria_id = c.id
    WHERE c.grupo_id = ?
  `, [id]);

  if (conTransacciones[0].n > 0) {
    throw errorConCodigo('No se puede eliminar: el grupo tiene transacciones asociadas', 'TIENE_DEPENDENCIAS');
  }

  // Eliminar categorías del grupo primero
  ejecutar(db, "DELETE FROM categorias WHERE grupo_id = ?", [id]);
  ejecutar(db, "DELETE FROM grupos WHERE id = ?", [id]);
}

// --- Categorías ---

export function crearCategoria(db, nombre, grupoId) {
  const existe = consultar(db, "SELECT id FROM categorias WHERE nombre = ? AND grupo_id = ?", [nombre, grupoId]);
  if (existe.length > 0) {
    throw errorConCodigo(`Ya existe una categoría "${nombre}" en este grupo`, 'DUPLICADO');
  }

  const { lastInsertRowid } = ejecutar(db, "INSERT INTO categorias (nombre, grupo_id) VALUES (?, ?)", [nombre, grupoId]);
  return { id: Number(lastInsertRowid), nombre, grupo_id: grupoId };
}

export function editarCategoria(db, id, nombre) {
  const cat = consultar(db, "SELECT * FROM categorias WHERE id = ?", [id]);
  if (cat.length === 0) {
    throw errorConCodigo('Categoría no encontrada', 'NO_ENCONTRADO');
  }

  ejecutar(db, "UPDATE categorias SET nombre = ? WHERE id = ?", [nombre, id]);
  return { id, nombre, grupo_id: cat[0].grupo_id };
}

export function eliminarCategoria(db, id) {
  const conTransacciones = consultar(db, "SELECT count(*) AS n FROM transacciones WHERE categoria_id = ?", [id]);

  if (conTransacciones[0].n > 0) {
    throw errorConCodigo('No se puede eliminar: la categoría tiene transacciones asociadas', 'TIENE_DEPENDENCIAS');
  }

  ejecutar(db, "DELETE FROM categorias WHERE id = ?", [id]);
}
