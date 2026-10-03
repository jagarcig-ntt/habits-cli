import { consultar, ejecutar } from '../db.js';

const TIPOS_VALIDOS = ['ahorro', 'inversion'];

function errorConCodigo(mensaje, codigo) {
  const err = new Error(mensaje);
  err.code = codigo;
  return err;
}

function validarTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw errorConCodigo(`Tipo inválido: "${tipo}" (debe ser "ahorro" o "inversion")`, 'VALIDACION');
  }
}

export function crearEntrada(db, { mes_economico_id, fecha, importe, tipo, nota = null }) {
  validarTipo(tipo);

  const mes = consultar(db, "SELECT id FROM meses_economicos WHERE id = ?", [mes_economico_id]);
  if (mes.length === 0) {
    throw errorConCodigo(`Mes económico no encontrado: ${mes_economico_id}`, 'NO_ENCONTRADO');
  }

  const { lastInsertRowid } = ejecutar(db,
    "INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo, nota) VALUES (?, ?, ?, ?, ?)",
    [mes_economico_id, fecha, importe, tipo, nota]);

  return { id: Number(lastInsertRowid), mes_economico_id, fecha, importe, tipo, nota };
}

export function editarEntrada(db, id, { fecha, importe, tipo, nota = null }) {
  const existe = consultar(db, "SELECT * FROM ahorro_manual WHERE id = ?", [id]);
  if (existe.length === 0) {
    throw errorConCodigo('Entrada de ahorro manual no encontrada', 'NO_ENCONTRADO');
  }

  validarTipo(tipo);

  ejecutar(db, "UPDATE ahorro_manual SET fecha = ?, importe = ?, tipo = ?, nota = ? WHERE id = ?",
    [fecha, importe, tipo, nota, id]);

  return { id, mes_economico_id: existe[0].mes_economico_id, fecha, importe, tipo, nota };
}

export function eliminarEntrada(db, id) {
  const existe = consultar(db, "SELECT id FROM ahorro_manual WHERE id = ?", [id]);
  if (existe.length === 0) {
    throw errorConCodigo('Entrada de ahorro manual no encontrada', 'NO_ENCONTRADO');
  }

  ejecutar(db, "DELETE FROM ahorro_manual WHERE id = ?", [id]);
}

export function obtenerEntradas(db, mesId) {
  return consultar(db, "SELECT * FROM ahorro_manual WHERE mes_economico_id = ? ORDER BY fecha ASC, id ASC", [mesId]);
}
