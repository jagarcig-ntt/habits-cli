function convertirFecha(fechaDDMMYYYY) {
  const partes = fechaDDMMYYYY.split('/');
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function parsearImporteEuropeo(texto) {
  // '−1.000,00' o '-1.000,00' → -1000.00
  const limpio = texto
    .replace(/\u2212/g, '-')   // guion largo Unicode → guion ASCII
    .replace(/\s/g, '')        // espacios
    .replace(/\./g, '')        // separador de miles
    .replace(',', '.');        // coma decimal → punto
  return Number(limpio);
}

function extraerFilas(html) {
  const filaRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const celdaRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const resultado = [];

  let matchFila;
  while ((matchFila = filaRegex.exec(html)) !== null) {
    const celdas = [];
    let matchCelda;
    while ((matchCelda = celdaRegex.exec(matchFila[1])) !== null) {
      const texto = matchCelda[1].replace(/<[^>]*>/g, '').trim();
      if (texto.length > 0) celdas.push(texto);
    }
    if (celdas.length > 0) resultado.push(celdas);
  }

  return resultado;
}

export function parsearOpenbank(buffer) {
  const html = buffer.toString('latin1');
  const filas = extraerFilas(html);

  // Buscar fila cabecera
  const indiceCabecera = filas.findIndex(f =>
    f.some(c => c.includes('Fecha Operación'))
  );

  if (indiceCabecera === -1) {
    throw new Error('Cabecera Openbank no reconocida: no se encontró "Fecha Operación"');
  }

  const transacciones = [];

  for (let i = indiceCabecera + 1; i < filas.length; i++) {
    const celdas = filas[i];
    if (celdas.length < 5) continue;

    const fechaOperacion = convertirFecha(celdas[0]);
    const fechaValor = convertirFecha(celdas[1]);
    if (!fechaOperacion || !fechaValor) continue;

    const importe = parsearImporteEuropeo(celdas[3]);
    const saldoResultante = parsearImporteEuropeo(celdas[4]);
    if (isNaN(importe) || isNaN(saldoResultante)) continue;

    transacciones.push({
      fechaOperacion,
      fechaValor,
      concepto: celdas[2],
      importe,
      saldoResultante,
      divisa: 'EUR',
    });
  }

  if (transacciones.length === 0) {
    throw new Error('Extracto vacío: no se encontraron transacciones');
  }

  return transacciones;
}
