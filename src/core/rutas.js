import { consultar } from './db.js';

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
