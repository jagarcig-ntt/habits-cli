import * as api from '../api.js';
import { crearSelector, obtenerValor } from '../componentes/selector.js';

async function cargar(contenedor) {
  const datos = await api.get('/reglas');

  let html = `<h2>Reglas de categorización</h2>
    <div id="msg-reglas"></div>
    <div id="form-regla" class="filtros" style="margin-bottom: 1.5rem;">
      <label>Patrón: <input type="text" id="input-patron" placeholder="ej. mercadona"></label>
      <label>Categoría: <span id="selector-regla-contenedor"></span></label>
      <button id="btn-crear-regla">Crear regla</button>
    </div>`;

  if (datos.reglas.length === 0) {
    html += '<p style="color: #9ca3af;">No hay reglas definidas.</p>';
  } else {
    html += '<ul class="lista-editable">';
    for (const regla of datos.reglas) {
      html += `<li>
        <span><code>${regla.patron}</code> → ${regla.grupo_nombre} > ${regla.categoria_nombre}</span>
        <span class="acciones">
          <button class="secundario btn-editar-regla" data-id="${regla.id}" data-patron="${regla.patron}" data-cat="${regla.categoria_id}">Editar</button>
          <button class="peligro btn-eliminar-regla" data-id="${regla.id}">Eliminar</button>
        </span>
      </li>`;
    }
    html += '</ul>';
  }

  contenedor.innerHTML = html;

  const msg = document.getElementById('msg-reglas');
  function mostrarMsg(texto, clase) {
    msg.innerHTML = `<p class="${clase}">${texto}</p>`;
    setTimeout(() => { msg.innerHTML = ''; }, 4000);
  }

  // Selector de categoría para crear
  const selector = await crearSelector({ id: 'cat-regla', incluirVacio: true });
  document.getElementById('selector-regla-contenedor').appendChild(selector);

  // Crear regla
  document.getElementById('btn-crear-regla').addEventListener('click', async () => {
    const patron = document.getElementById('input-patron').value.trim();
    const categoriaId = obtenerValor(selector);
    if (!patron) return mostrarMsg('El patrón no puede estar vacío', 'error');
    if (!categoriaId) return mostrarMsg('Selecciona una categoría', 'error');

    try {
      const resultado = await api.post('/reglas', { patron, categoria_id: categoriaId });
      mostrarMsg(`Regla creada. ${resultado.aplicadas} transacciones categorizadas.`, 'exito');
      cargar(contenedor);
    } catch (err) { mostrarMsg(err.message, 'error'); }
  });

  // Editar regla
  contenedor.querySelectorAll('.btn-editar-regla').forEach(btn => {
    btn.addEventListener('click', async () => {
      const patron = prompt('Patrón:', btn.dataset.patron);
      if (!patron) return;

      // Crear selector temporal para elegir categoría
      const catId = prompt('ID de categoría (actual: ' + btn.dataset.cat + '):', btn.dataset.cat);
      if (!catId) return;

      try {
        const resultado = await api.put(`/reglas/${btn.dataset.id}`, { patron, categoria_id: Number(catId) });
        mostrarMsg(`Regla editada. ${resultado.aplicadas} transacciones categorizadas.`, 'exito');
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Eliminar regla
  contenedor.querySelectorAll('.btn-eliminar-regla').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta regla? Las transacciones ya categorizadas no se verán afectadas.')) return;
      try {
        await api.del(`/reglas/${btn.dataset.id}`);
        mostrarMsg('Regla eliminada.', 'exito');
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });
}

export function renderizar(contenedor) {
  contenedor.innerHTML = '<p class="cargando">Cargando reglas...</p>';
  cargar(contenedor);
}
