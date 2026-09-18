const BASE = '/api';

async function peticion(ruta, opciones = {}) {
  const respuesta = await fetch(BASE + ruta, opciones);
  if (respuesta.status === 204) return null;

  const json = await respuesta.json();
  if (!respuesta.ok) {
    const err = new Error(json.error || 'Error del servidor');
    err.codigo = respuesta.status;
    throw err;
  }
  return json;
}

export function get(ruta) {
  return peticion(ruta);
}

export function post(ruta, cuerpo) {
  return peticion(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

export function put(ruta, cuerpo) {
  return peticion(ruta, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

export function patch(ruta, cuerpo) {
  return peticion(ruta, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

export function del(ruta) {
  return peticion(ruta, { method: 'DELETE' });
}

export function subirFichero(ruta, formData) {
  return peticion(ruta, { method: 'POST', body: formData });
}
