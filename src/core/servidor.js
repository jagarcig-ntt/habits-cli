import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConexion, ejecutarMigraciones } from './db.js';
import { ejecutarSemilla } from './semilla.js';
import { manejarRutaApi } from './rutas.js';

const DIR_RAIZ = join(fileURLToPath(import.meta.url), '..', '..', '..');
const DIR_UI = join(DIR_RAIZ, 'src', 'ui');
const DIR_MIGRACIONES = join(DIR_RAIZ, 'migrations');
const PUERTO = process.env.PORT || 3000;

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// Inicializar base de datos
const db = crearConexion(join(DIR_RAIZ, 'homics.db'));
ejecutarMigraciones(db, DIR_MIGRACIONES);
ejecutarSemilla(db);

function servirEstatico(ruta, res) {
  const rutaFichero = ruta === '/' ? '/index.html' : ruta;
  const rutaCompleta = join(DIR_UI, rutaFichero);

  if (!rutaCompleta.startsWith(DIR_UI) || !existsSync(rutaCompleta)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('No encontrado');
    return;
  }

  const ext = extname(rutaCompleta);
  const tipo = TIPOS_MIME[ext] || 'application/octet-stream';

  try {
    const contenido = readFileSync(rutaCompleta);
    res.writeHead(200, { 'content-type': tipo });
    res.end(contenido);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Error interno');
  }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);

  if (url.pathname.startsWith('/api/')) {
    await manejarRutaApi(req, res, url, db);
  } else {
    servirEstatico(url.pathname, res);
  }
});

servidor.listen(PUERTO, () => {
  console.log(`Homics arrancado en http://localhost:${PUERTO}`);
});
