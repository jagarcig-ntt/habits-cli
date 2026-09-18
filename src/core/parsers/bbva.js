import XLSX from 'xlsx';

const COLUMNAS_ESPERADAS = ['F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Divisa', 'Observaciones'];

function convertirFecha(fechaDDMMYYYY) {
  const partes = fechaDDMMYYYY.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function buscarFilaCabecera(filas) {
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const fila = filas[i];
    if (fila && fila.includes('F.Valor') && fila.includes('Concepto')) {
      return i;
    }
  }
  return -1;
}

export function parsearBBVA(buffer) {
  let libro;
  try {
    libro = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new Error('Error de formato: el fichero no es un XLSX válido');
  }

  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null });

  const indiceCabecera = buscarFilaCabecera(filas);
  if (indiceCabecera === -1) {
    throw new Error('Cabecera BBVA no reconocida: no se encontraron las columnas esperadas');
  }

  const transacciones = [];

  for (let i = indiceCabecera + 1; i < filas.length; i++) {
    const fila = filas[i];
    if (!fila || !fila[0]) continue;

    const fechaValor = convertirFecha(String(fila[0]));
    const fechaOperacion = convertirFecha(String(fila[1]));
    if (!fechaValor || !fechaOperacion) continue;

    transacciones.push({
      fechaValor,
      fechaOperacion,
      concepto: String(fila[2] || ''),
      importe: Number(fila[4]) || 0,
      divisa: String(fila[5] || 'EUR'),
      saldoResultante: Number(fila[6]) || 0,
    });
  }

  if (transacciones.length === 0) {
    throw new Error('Extracto vacío: no se encontraron transacciones');
  }

  return transacciones;
}
