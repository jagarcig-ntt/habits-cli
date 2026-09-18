import * as api from '../api.js';

let cacheTipos = null;

async function cargarTipos() {
  if (!cacheTipos) {
    const datos = await api.get('/tipos');
    cacheTipos = datos.tipos;
  }
  return cacheTipos;
}

/**
 * Invalida la caché para forzar recarga tras crear/editar categorías.
 */
export function invalidarCache() {
  cacheTipos = null;
}

/**
 * Crea un <select> con categorías agrupadas por tipo > grupo.
 * @param {Object} opciones - { id, valor, incluirVacio }
 * @returns {HTMLSelectElement}
 */
export async function crearSelector(opciones = {}) {
  const { id = 'selector-categoria', valor = '', incluirVacio = true } = opciones;
  const tipos = await cargarTipos();

  const select = document.createElement('select');
  select.id = id;
  select.name = id;

  if (incluirVacio) {
    const opVacia = document.createElement('option');
    opVacia.value = '';
    opVacia.textContent = '-- Seleccionar categoría --';
    select.appendChild(opVacia);
  }

  for (const tipo of tipos) {
    for (const grupo of tipo.grupos) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = `${tipo.nombre} > ${grupo.nombre}`;

      for (const cat of grupo.categorias) {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        if (String(cat.id) === String(valor)) option.selected = true;
        optgroup.appendChild(option);
      }

      select.appendChild(optgroup);
    }
  }

  return select;
}

/**
 * Obtiene el valor seleccionado de un selector.
 */
export function obtenerValor(selector) {
  return selector.value ? Number(selector.value) : null;
}
