function formatearImporte(importe) {
  return importe.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Renderiza una tabla de transacciones.
 * @param {HTMLElement} contenedor
 * @param {Array} transacciones
 * @param {Object} opciones - { onSeleccionar: fn(ids) } opcional para categorización en lote
 */
export function renderizarTabla(contenedor, transacciones, opciones = {}) {
  const conSeleccion = typeof opciones.onSeleccionar === 'function';

  let html = `<table>
    <thead><tr>
      ${conSeleccion ? '<th><input type="checkbox" id="seleccionar-todas"></th>' : ''}
      <th>Fecha</th>
      <th>Concepto</th>
      <th>Importe</th>
      <th>Cuenta</th>
      <th>Categoría</th>
    </tr></thead>
    <tbody>`;

  for (const tx of transacciones) {
    const sinCat = !tx.categoria_id;
    const clasesFila = sinCat ? 'class="sin-categorizar"' : '';
    const clasesImporte = tx.importe < 0 ? 'importe negativo' : 'importe positivo';
    const categoria = sinCat ? 'Sin categorizar' : `${tx.grupo_nombre} > ${tx.categoria_nombre}`;

    html += `<tr ${clasesFila} data-id="${tx.id}">
      ${conSeleccion ? `<td><input type="checkbox" class="check-tx" value="${tx.id}"></td>` : ''}
      <td>${tx.fecha_operacion}</td>
      <td>${tx.concepto}</td>
      <td class="${clasesImporte}">${formatearImporte(tx.importe)}</td>
      <td>${tx.cuenta_nombre || ''}</td>
      <td>${categoria}</td>
    </tr>`;
  }

  html += '</tbody></table>';
  contenedor.innerHTML = html;

  // Seleccionar/deseleccionar todas
  if (conSeleccion) {
    const checkTodas = contenedor.querySelector('#seleccionar-todas');
    const checksIndividuales = contenedor.querySelectorAll('.check-tx');

    checkTodas.addEventListener('change', () => {
      checksIndividuales.forEach(c => { c.checked = checkTodas.checked; });
    });
  }
}

/**
 * Obtiene los IDs de transacciones seleccionadas.
 */
export function obtenerSeleccionados(contenedor) {
  return [...contenedor.querySelectorAll('.check-tx:checked')].map(c => Number(c.value));
}
