import { consultar } from './db.js';
import { importarExtracto } from './servicios/extractos.js';
import { crearGrupo, editarGrupo, eliminarGrupo, crearCategoria, editarCategoria, eliminarCategoria } from './servicios/categorias.js';
import { crearRegla, editarRegla, eliminarRegla, obtenerReglas } from './servicios/reglas.js';
import { obtenerTransacciones, categorizarManual, alternarExclusion, excluirEnLote } from './servicios/transacciones.js';
import { calcularMesesEconomicos, asignarMesManual, obtenerMeses } from './servicios/mesEconomico.js';
import {
  dashboardAnual, dashboardMensual, topCategoriasGasto, ratioAhorroIngreso,
  calcularComparativas, acumuladoAhorroInversionAnual,
} from './servicios/dashboard.js';
import { crearEntrada, editarEntrada, eliminarEntrada, obtenerEntradas } from './servicios/ahorroManual.js';

const rutas = [];

function registrar(metodo, patron, manejador) {
  rutas.push({ metodo, patron, manejador });
}

function buscarRuta(metodo, pathname) {
  for (const ruta of rutas) {
    if (ruta.metodo !== metodo) continue;

    if (typeof ruta.patron === 'string') {
      if (ruta.patron === pathname) return { manejador: ruta.manejador, params: {} };
    } else {
      const match = pathname.match(ruta.patron);
      if (match) return { manejador: ruta.manejador, params: match.groups || {} };
    }
  }
  return null;
}

function responderJson(res, codigo, datos) {
  res.writeHead(codigo, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}

export async function leerCuerpo(req) {
  const partes = [];
  for await (const trozo of req) partes.push(trozo);
  return Buffer.concat(partes);
}

// --- POST /api/extractos --- [RF-01, RF-02]
registrar('POST', '/api/extractos', async (req, res, url, db) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return responderJson(res, 400, { error: 'Se espera multipart/form-data' });
  }

  const boundary = contentType.split('boundary=')[1];
  if (!boundary) {
    return responderJson(res, 400, { error: 'Boundary no encontrado' });
  }

  const cuerpo = await leerCuerpo(req);
  const { campos, fichero } = parsearMultipart(cuerpo, boundary);

  const banco = campos.banco;
  if (!banco) {
    return responderJson(res, 400, { error: 'Campo "banco" requerido (bbva|openbank)' });
  }
  if (!fichero) {
    return responderJson(res, 400, { error: 'Campo "fichero" requerido' });
  }

  try {
    const resultado = importarExtracto(db, fichero, banco);
    responderJson(res, 200, resultado);
  } catch (err) {
    if (err.message.includes('no soportado')) {
      responderJson(res, 400, { error: err.message });
    } else if (err.message.includes('vacío') || err.message.includes('formato') || err.message.includes('Cabecera')) {
      responderJson(res, 422, { error: err.message });
    } else {
      throw err;
    }
  }
});

function parsearMultipart(buffer, boundary) {
  const separador = Buffer.from(`--${boundary}`);
  const partes = [];
  let inicio = 0;

  while (true) {
    const pos = buffer.indexOf(separador, inicio);
    if (pos === -1) break;
    if (inicio > 0) {
      partes.push(buffer.subarray(inicio, pos - 2)); // -2 para quitar \r\n antes del boundary
    }
    inicio = pos + separador.length + 2; // +2 para saltar \r\n después del boundary
    // Verificar si es el cierre --boundary--
    if (buffer[pos + separador.length] === 0x2D && buffer[pos + separador.length + 1] === 0x2D) break;
  }

  const campos = {};
  let fichero = null;

  for (const parte of partes) {
    const finCabeceras = parte.indexOf('\r\n\r\n');
    if (finCabeceras === -1) continue;

    const cabeceras = parte.subarray(0, finCabeceras).toString('utf-8');
    const contenido = parte.subarray(finCabeceras + 4);

    const matchNombre = cabeceras.match(/name="([^"]+)"/);
    if (!matchNombre) continue;
    const nombre = matchNombre[1];

    const esArchivo = cabeceras.includes('filename=');
    if (esArchivo) {
      fichero = contenido;
    } else {
      campos[nombre] = contenido.toString('utf-8').trim();
    }
  }

  return { campos, fichero };
}

function manejarErrorServicio(res, err) {
  if (err.code === 'DUPLICADO') return responderJson(res, 409, { error: err.message });
  if (err.code === 'TIENE_DEPENDENCIAS') return responderJson(res, 409, { error: err.message });
  if (err.code === 'NO_ENCONTRADO') return responderJson(res, 404, { error: err.message });
  if (err.code === 'VALIDACION') return responderJson(res, 400, { error: err.message });
  throw err;
}

async function leerJson(req) {
  const buffer = await leerCuerpo(req);
  return JSON.parse(buffer.toString('utf-8'));
}

// --- POST /api/grupos --- [RF-03]
registrar('POST', '/api/grupos', async (req, res, url, db) => {
  try {
    const { nombre, tipo_id } = await leerJson(req);
    if (!nombre || !tipo_id) return responderJson(res, 400, { error: 'nombre y tipo_id requeridos' });
    const grupo = crearGrupo(db, nombre, tipo_id);
    responderJson(res, 201, grupo);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- PUT /api/grupos/:id --- [RF-03]
registrar('PUT', /^\/api\/grupos\/(?<id>\d+)$/, async (req, res, url, db, params) => {
  try {
    const { nombre } = await leerJson(req);
    if (!nombre) return responderJson(res, 400, { error: 'nombre requerido' });
    const grupo = editarGrupo(db, Number(params.id), nombre);
    responderJson(res, 200, grupo);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- DELETE /api/grupos/:id --- [RF-03]
registrar('DELETE', /^\/api\/grupos\/(?<id>\d+)$/, (req, res, url, db, params) => {
  try {
    eliminarGrupo(db, Number(params.id));
    res.writeHead(204);
    res.end();
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- POST /api/categorias --- [RF-03]
registrar('POST', '/api/categorias', async (req, res, url, db) => {
  try {
    const { nombre, grupo_id } = await leerJson(req);
    if (!nombre || !grupo_id) return responderJson(res, 400, { error: 'nombre y grupo_id requeridos' });
    const cat = crearCategoria(db, nombre, grupo_id);
    responderJson(res, 201, cat);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- PUT /api/categorias/:id --- [RF-03]
registrar('PUT', /^\/api\/categorias\/(?<id>\d+)$/, async (req, res, url, db, params) => {
  try {
    const { nombre } = await leerJson(req);
    if (!nombre) return responderJson(res, 400, { error: 'nombre requerido' });
    const cat = editarCategoria(db, Number(params.id), nombre);
    responderJson(res, 200, cat);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- DELETE /api/categorias/:id --- [RF-03]
registrar('DELETE', /^\/api\/categorias\/(?<id>\d+)$/, (req, res, url, db, params) => {
  try {
    eliminarCategoria(db, Number(params.id));
    res.writeHead(204);
    res.end();
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- GET /api/reglas --- [RF-04]
registrar('GET', '/api/reglas', (req, res, url, db) => {
  const reglas = obtenerReglas(db);
  responderJson(res, 200, { reglas });
});

// --- POST /api/reglas --- [RF-04]
registrar('POST', '/api/reglas', async (req, res, url, db) => {
  try {
    const { patron, categoria_id } = await leerJson(req);
    if (!patron || !categoria_id) return responderJson(res, 400, { error: 'patron y categoria_id requeridos' });
    const regla = crearRegla(db, patron, categoria_id);
    responderJson(res, 201, regla);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- PUT /api/reglas/:id --- [RF-04]
registrar('PUT', /^\/api\/reglas\/(?<id>\d+)$/, async (req, res, url, db, params) => {
  try {
    const { patron, categoria_id } = await leerJson(req);
    if (!patron || !categoria_id) return responderJson(res, 400, { error: 'patron y categoria_id requeridos' });
    const regla = editarRegla(db, Number(params.id), patron, categoria_id);
    responderJson(res, 200, regla);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- DELETE /api/reglas/:id --- [RF-04]
registrar('DELETE', /^\/api\/reglas\/(?<id>\d+)$/, (req, res, url, db, params) => {
  try {
    eliminarRegla(db, Number(params.id));
    res.writeHead(204);
    res.end();
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- GET /api/meses --- [RF-06]
registrar('GET', '/api/meses', (req, res, url, db) => {
  const anio = url.searchParams.get('anio');
  const meses = obtenerMeses(db, anio ? Number(anio) : null);
  responderJson(res, 200, { meses });
});

// --- POST /api/meses/corte-manual --- [RF-06]
registrar('POST', '/api/meses/corte-manual', async (req, res, url, db) => {
  const { fecha_inicio } = await leerJson(req);
  if (!fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) {
    return responderJson(res, 400, { error: 'fecha_inicio requerida en formato YYYY-MM-DD' });
  }

  try {
    const mes = asignarMesManual(db, fecha_inicio);
    calcularMesesEconomicos(db);
    responderJson(res, 201, mes);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      responderJson(res, 409, { error: 'Ya existe un mes con esa fecha de inicio' });
    } else {
      throw err;
    }
  }
});

// --- GET /api/transacciones --- [RF-05, RF-08, RF-04, RF-07]
registrar('GET', '/api/transacciones', (req, res, url, db) => {
  const filtros = {};
  const p = url.searchParams;
  if (p.has('mes_id')) filtros.mes_id = Number(p.get('mes_id'));
  if (p.has('categoria_id')) filtros.categoria_id = Number(p.get('categoria_id'));
  if (p.has('cuenta_id')) filtros.cuenta_id = Number(p.get('cuenta_id'));
  if (p.has('importe_min')) filtros.importe_min = Number(p.get('importe_min'));
  if (p.has('importe_max')) filtros.importe_max = Number(p.get('importe_max'));
  if (p.has('tipo')) filtros.tipo = p.get('tipo');
  if (p.has('concepto')) filtros.concepto = p.get('concepto');
  if (p.has('fecha_desde')) filtros.fecha_desde = p.get('fecha_desde');
  if (p.has('fecha_hasta')) filtros.fecha_hasta = p.get('fecha_hasta');

  const paginacion = {};
  if (p.has('limit')) paginacion.limit = Number(p.get('limit'));
  if (p.has('offset')) paginacion.offset = Number(p.get('offset'));

  const resultado = obtenerTransacciones(db, filtros, paginacion);
  responderJson(res, 200, resultado);
});

// --- PATCH /api/transacciones/categorizar --- [RF-05]
registrar('PATCH', '/api/transacciones/categorizar', async (req, res, url, db) => {
  const { ids, categoria_id } = await leerJson(req);
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return responderJson(res, 400, { error: 'ids requerido (array no vacío)' });
  }
  if (!categoria_id) {
    return responderJson(res, 400, { error: 'categoria_id requerido' });
  }

  const resultado = categorizarManual(db, ids, categoria_id);
  responderJson(res, 200, resultado);
});

// --- PATCH /api/transacciones/excluir (lote) --- [RF-03]
registrar('PATCH', '/api/transacciones/excluir', async (req, res, url, db) => {
  const { ids, excluida } = await leerJson(req);
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return responderJson(res, 400, { error: 'ids requerido (array no vacío)' });
  }
  if (typeof excluida !== 'boolean') {
    return responderJson(res, 400, { error: 'excluida requerido (booleano)' });
  }

  const resultado = excluirEnLote(db, ids, excluida);
  responderJson(res, 200, resultado);
});

// --- PATCH /api/transacciones/:id/excluir --- [RF-03]
registrar('PATCH', /^\/api\/transacciones\/(?<id>\d+)\/excluir$/, async (req, res, url, db, params) => {
  const id = Number(params.id);
  const existe = consultar(db, "SELECT id FROM transacciones WHERE id = ?", [id]);
  if (existe.length === 0) {
    return responderJson(res, 404, { error: 'Transacción no encontrada' });
  }

  const { excluida } = await leerJson(req);
  const resultado = alternarExclusion(db, id, !!excluida);
  responderJson(res, 200, resultado);
});

// --- GET /api/dashboard/anual --- [RF-07, RF-06]
registrar('GET', '/api/dashboard/anual', (req, res, url, db) => {
  const anio = Number(url.searchParams.get('anio')) || new Date().getFullYear();
  const resultado = dashboardAnual(db, anio);

  const acumulado = acumuladoAhorroInversionAnual(db, anio);
  const totalIngresoAnual = resultado.meses.reduce((s, m) => s + m.totales.ingreso, 0);

  responderJson(res, 200, {
    ...resultado,
    meses: calcularComparativas(resultado.meses),
    top_categorias_gasto: topCategoriasGasto(db, anio),
    ratio_ahorro_ingreso: ratioAhorroIngreso(acumulado.ahorro, totalIngresoAnual),
    acumulado_ahorro: acumulado.ahorro,
    acumulado_inversion: acumulado.inversion,
  });
});

// --- GET /api/dashboard/mensual/:mes_id --- [RF-08, RF-01]
registrar('GET', /^\/api\/dashboard\/mensual\/(?<id>\d+)$/, (req, res, url, db, params) => {
  const mesId = Number(params.id);
  const mes = consultar(db, "SELECT id FROM meses_economicos WHERE id = ?", [mesId]);
  if (mes.length === 0) {
    return responderJson(res, 404, { error: 'Mes no encontrado' });
  }
  const resultado = dashboardMensual(db, mesId);
  responderJson(res, 200, {
    ...resultado,
    ratio_ahorro_ingreso: ratioAhorroIngreso(resultado.totales.ahorro, resultado.totales.ingreso),
  });
});

// --- GET /api/ahorro-manual --- [RF-05]
registrar('GET', '/api/ahorro-manual', (req, res, url, db) => {
  const mesId = url.searchParams.get('mes_id');
  if (!mesId) return responderJson(res, 400, { error: 'mes_id requerido' });

  const entradas = obtenerEntradas(db, Number(mesId));
  responderJson(res, 200, { entradas });
});

// --- POST /api/ahorro-manual --- [RF-05]
registrar('POST', '/api/ahorro-manual', async (req, res, url, db) => {
  try {
    const { mes_economico_id, fecha, importe, tipo, nota } = await leerJson(req);
    if (!mes_economico_id || !fecha || importe == null || !tipo) {
      return responderJson(res, 400, { error: 'mes_economico_id, fecha, importe y tipo requeridos' });
    }
    const entrada = crearEntrada(db, { mes_economico_id, fecha, importe, tipo, nota });
    responderJson(res, 201, entrada);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- PUT /api/ahorro-manual/:id --- [RF-05]
registrar('PUT', /^\/api\/ahorro-manual\/(?<id>\d+)$/, async (req, res, url, db, params) => {
  try {
    const { fecha, importe, tipo, nota } = await leerJson(req);
    if (!fecha || importe == null || !tipo) {
      return responderJson(res, 400, { error: 'fecha, importe y tipo requeridos' });
    }
    const entrada = editarEntrada(db, Number(params.id), { fecha, importe, tipo, nota });
    responderJson(res, 200, entrada);
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- DELETE /api/ahorro-manual/:id --- [RF-05]
registrar('DELETE', /^\/api\/ahorro-manual\/(?<id>\d+)$/, (req, res, url, db, params) => {
  try {
    eliminarEntrada(db, Number(params.id));
    res.writeHead(204);
    res.end();
  } catch (err) { manejarErrorServicio(res, err); }
});

// --- GET /api/tipos --- [RF-03]
registrar('GET', '/api/tipos', (req, res, url, db) => {
  const tipos = consultar(db, "SELECT id, nombre FROM tipos ORDER BY id");
  const grupos = consultar(db, "SELECT id, nombre, tipo_id FROM grupos ORDER BY id");
  const categorias = consultar(db, "SELECT id, nombre, grupo_id FROM categorias ORDER BY id");

  const resultado = tipos.map(tipo => ({
    id: tipo.id,
    nombre: tipo.nombre,
    grupos: grupos
      .filter(g => g.tipo_id === tipo.id)
      .map(grupo => ({
        id: grupo.id,
        nombre: grupo.nombre,
        categorias: categorias
          .filter(c => c.grupo_id === grupo.id)
          .map(c => ({ id: c.id, nombre: c.nombre })),
      })),
  }));

  responderJson(res, 200, { tipos: resultado });
});

// --- Despacho principal ---
export async function manejarRutaApi(req, res, url, db) {
  const encontrada = buscarRuta(req.method, url.pathname);
  if (encontrada) {
    try {
      await encontrada.manejador(req, res, url, db, encontrada.params);
    } catch (err) {
      console.error('Error en ruta API:', err);
      responderJson(res, 500, { error: 'Error interno del servidor' });
    }
  } else {
    responderJson(res, 404, { error: 'Ruta no encontrada' });
  }
}

export { registrar, responderJson };
