import { crearSelector, obtenerValor } from './selector.js';

function formatearImporte(importe) {
  return importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function construirFilaHtml(tx, { conSeleccion, conExclusion }) {
  const sinCat = !tx.categoria_id;
  const clases = [sinCat ? 'sin-categorizar' : '', tx.excluida ? 'excluida' : ''].filter(Boolean).join(' ');
  const clasesImporte = tx.importe < 0 ? 'importe negativo' : 'importe positivo';
  const categoria = sinCat ? 'Sin categorizar' : `${tx.grupo_nombre} > ${tx.categoria_nombre}`;

  return `<tr class="${clases}" data-id="${tx.id}">
    ${conSeleccion ? `<td><input type="checkbox" class="check-tx" value="${tx.id}"></td>` : ''}
    <td>${tx.fecha_operacion}</td>
    <td>${tx.concepto}</td>
    <td class="${clasesImporte}">${formatearImporte(tx.importe)}</td>
    <td>${tx.cuenta_nombre || ''}</td>
    <td class="celda-categoria">${categoria}</td>
    ${conExclusion ? `<td><button type="button" class="btn-excluir" data-id="${tx.id}">${tx.excluida ? 'Incluir' : 'Excluir'}</button></td>` : ''}
  </tr>`;
}

/**
 * Activa el desplegable de categoría inline en una fila. Al pulsar "✓" NO se
 * persiste nada: la fila queda marcada como "pendiente" (data-categoria-pendiente
 * + clase CSS) para que un guardado en lote posterior (fuera de este componente)
 * la recoja vía obtenerCambiosPendientes().
 */
async function activarCategorizacionInline(contenedor, tx, onCambioPendiente) {
  const fila = contenedor.querySelector(`tr[data-id="${tx.id}"]`);
  const celdaCategoria = fila.querySelector('.celda-categoria');
  const valorInicial = tx.categoria_id ? String(tx.categoria_id) : '';

  const selector = await crearSelector({ id: `cat-inline-${tx.id}`, valor: tx.categoria_id || '', incluirVacio: true });
  selector.classList.add('select-inline');

  const btnConfirmar = document.createElement('button');
  btnConfirmar.type = 'button';
  btnConfirmar.textContent = '✓';
  btnConfirmar.classList.add('btn-confirmar-inline');
  btnConfirmar.style.display = 'none';

  selector.addEventListener('change', () => {
    btnConfirmar.style.display = (selector.value && selector.value !== valorInicial) ? 'inline-block' : 'none';
  });

  btnConfirmar.addEventListener('click', () => {
    const catId = obtenerValor(selector);
    if (!catId) return;

    fila.dataset.categoriaPendiente = catId;
    fila.classList.add('fila-pendiente');
    btnConfirmar.style.display = 'none';

    if (typeof onCambioPendiente === 'function') onCambioPendiente();
  });

  celdaCategoria.innerHTML = '';
  celdaCategoria.appendChild(selector);
  celdaCategoria.appendChild(btnConfirmar);
}

function activarExclusion(contenedor, tx, onExcluir) {
  const boton = contenedor.querySelector(`tr[data-id="${tx.id}"] .btn-excluir`);
  if (!boton) return;

  boton.addEventListener('click', () => {
    const fila = boton.closest('tr');
    const id = Number(boton.dataset.id);
    const nuevoEstado = !fila.classList.contains('excluida');

    fila.classList.toggle('excluida', nuevoEstado);
    boton.textContent = nuevoEstado ? 'Incluir' : 'Excluir';

    onExcluir(id, nuevoEstado);
  });
}

async function activarFilas(contenedor, transacciones, opciones) {
  const conSeleccion = !!opciones.onSeleccionar;
  const conCategorizacionInline = !!opciones.categorizable;
  const conExclusion = typeof opciones.onExcluir === 'function';

  if (conSeleccion) {
    const checkTodas = contenedor.querySelector('#seleccionar-todas');
    if (checkTodas?.checked) {
      transacciones.forEach(tx => {
        const check = contenedor.querySelector(`tr[data-id="${tx.id}"] .check-tx`);
        if (check) check.checked = true;
      });
    }
  }

  if (conCategorizacionInline) {
    for (const tx of transacciones) {
      await activarCategorizacionInline(contenedor, tx, opciones.onCambioPendiente);
    }
  }

  if (conExclusion) {
    for (const tx of transacciones) {
      activarExclusion(contenedor, tx, opciones.onExcluir);
    }
  }
}

/**
 * Renderiza una tabla de transacciones desde cero (sustituye el contenido del contenedor).
 * @param {HTMLElement} contenedor
 * @param {Array} transacciones
 * @param {Object} opciones - { onSeleccionar: bool } lote, { categorizable: bool } activa el
 *                             desplegable inline (los cambios quedan pendientes, no se guardan
 *                             aquí — ver obtenerCambiosPendientes), { onCambioPendiente: fn() }
 *                             notifica cada vez que se marca una fila como pendiente,
 *                             { onExcluir: fn(id, nuevoEstado) } excluir/incluir
 */
export async function renderizarTabla(contenedor, transacciones, opciones = {}) {
  const conSeleccion = !!opciones.onSeleccionar;
  const conExclusion = typeof opciones.onExcluir === 'function';

  const filasHtml = transacciones.map(tx => construirFilaHtml(tx, { conSeleccion, conExclusion })).join('');

  contenedor.innerHTML = `<table>
    <thead><tr>
      ${conSeleccion ? '<th><input type="checkbox" id="seleccionar-todas"></th>' : ''}
      <th>Fecha</th>
      <th>Concepto</th>
      <th>Importe</th>
      <th>Cuenta</th>
      <th>Categoría</th>
      ${conExclusion ? '<th>Acciones</th>' : ''}
    </tr></thead>
    <tbody>${filasHtml}</tbody>
  </table>`;

  if (conSeleccion) {
    const checkTodas = contenedor.querySelector('#seleccionar-todas');
    // Se consultan las casillas en el momento del click (no una lista estática) para que
    // "Mostrar más" (agregarFilas) también quede cubierto por "seleccionar todas".
    checkTodas.addEventListener('change', () => {
      contenedor.querySelectorAll('.check-tx').forEach(c => { c.checked = checkTodas.checked; });
    });
  }

  await activarFilas(contenedor, transacciones, opciones);
}

/**
 * Añade filas al final de una tabla ya renderizada, sin sustituir el contenido existente.
 * Preserva la posición de scroll y el estado de filas ya renderizadas.
 */
export async function agregarFilas(contenedor, transacciones, opciones = {}) {
  const conSeleccion = !!opciones.onSeleccionar;
  const conExclusion = typeof opciones.onExcluir === 'function';

  const tbody = contenedor.querySelector('tbody');
  const filasHtml = transacciones.map(tx => construirFilaHtml(tx, { conSeleccion, conExclusion })).join('');
  tbody.insertAdjacentHTML('beforeend', filasHtml);

  await activarFilas(contenedor, transacciones, opciones);
}

/**
 * Obtiene los IDs de transacciones seleccionadas.
 */
export function obtenerSeleccionados(contenedor) {
  return [...contenedor.querySelectorAll('.check-tx:checked')].map(c => Number(c.value));
}

/**
 * Obtiene los cambios de categoría pendientes de guardar (marcados con el botón "✓").
 * @returns {Array<{id: number, categoria_id: number}>}
 */
export function obtenerCambiosPendientes(contenedor) {
  return [...contenedor.querySelectorAll('tr[data-categoria-pendiente]')].map(fila => ({
    id: Number(fila.dataset.id),
    categoria_id: Number(fila.dataset.categoriaPendiente),
  }));
}

/**
 * Indica si hay al menos un cambio de categoría pendiente de guardar.
 */
export function hayCambiosPendientes(contenedor) {
  return contenedor.querySelector('tr[data-categoria-pendiente]') !== null;
}
