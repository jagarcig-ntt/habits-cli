import * as api from '../api.js';
import { invalidarCache } from '../componentes/selector.js';

async function cargar(contenedor) {
  const datos = await api.get('/tipos');

  let html = '<h2>Categorías</h2><div id="msg-cat"></div>';

  for (const tipo of datos.tipos) {
    html += `<h3 style="margin: 1.5rem 0 0.5rem; text-transform: capitalize;">${tipo.nombre}</h3>`;
    html += `<ul class="lista-editable">`;

    for (const grupo of tipo.grupos) {
      html += `<li>
        <strong>${grupo.nombre}</strong>
        <span class="acciones">
          <button class="secundario btn-editar-grupo" data-id="${grupo.id}" data-nombre="${grupo.nombre}">Editar</button>
          <button class="peligro btn-eliminar-grupo" data-id="${grupo.id}">Eliminar</button>
        </span>
      </li>`;

      for (const cat of grupo.categorias) {
        html += `<li style="padding-left: 2rem;">
          ${cat.nombre}
          <span class="acciones">
            <button class="secundario btn-editar-cat" data-id="${cat.id}" data-nombre="${cat.nombre}">Editar</button>
            <button class="peligro btn-eliminar-cat" data-id="${cat.id}">Eliminar</button>
          </span>
        </li>`;
      }

      html += `<li style="padding-left: 2rem;">
        <button class="btn-nueva-cat" data-grupo-id="${grupo.id}">+ Categoría</button>
      </li>`;
    }

    html += `</ul>
      <button class="btn-nuevo-grupo" data-tipo-id="${tipo.id}" style="margin-top: 0.5rem;">+ Grupo</button>`;
  }

  contenedor.innerHTML = html;

  const msg = document.getElementById('msg-cat');

  function mostrarMsg(texto, clase) {
    msg.innerHTML = `<p class="${clase}">${texto}</p>`;
    setTimeout(() => { msg.innerHTML = ''; }, 3000);
  }

  // Editar grupo
  contenedor.querySelectorAll('.btn-editar-grupo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nombre = prompt('Nuevo nombre del grupo:', btn.dataset.nombre);
      if (!nombre || nombre === btn.dataset.nombre) return;
      try {
        await api.put(`/grupos/${btn.dataset.id}`, { nombre });
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Eliminar grupo
  contenedor.querySelectorAll('.btn-eliminar-grupo').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este grupo y todas sus categorías?')) return;
      try {
        await api.del(`/grupos/${btn.dataset.id}`);
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Editar categoría
  contenedor.querySelectorAll('.btn-editar-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nombre = prompt('Nuevo nombre de la categoría:', btn.dataset.nombre);
      if (!nombre || nombre === btn.dataset.nombre) return;
      try {
        await api.put(`/categorias/${btn.dataset.id}`, { nombre });
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Eliminar categoría
  contenedor.querySelectorAll('.btn-eliminar-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta categoría?')) return;
      try {
        await api.del(`/categorias/${btn.dataset.id}`);
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Nueva categoría
  contenedor.querySelectorAll('.btn-nueva-cat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nombre = prompt('Nombre de la nueva categoría:');
      if (!nombre) return;
      try {
        await api.post('/categorias', { nombre, grupo_id: Number(btn.dataset.grupoId) });
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });

  // Nuevo grupo
  contenedor.querySelectorAll('.btn-nuevo-grupo').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nombre = prompt('Nombre del nuevo grupo:');
      if (!nombre) return;
      try {
        await api.post('/grupos', { nombre, tipo_id: Number(btn.dataset.tipoId) });
        invalidarCache();
        cargar(contenedor);
      } catch (err) { mostrarMsg(err.message, 'error'); }
    });
  });
}

export function renderizar(contenedor) {
  contenedor.innerHTML = '<p class="cargando">Cargando categorías...</p>';
  cargar(contenedor);
}
