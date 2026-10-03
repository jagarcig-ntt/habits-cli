import * as api from '../api.js';
import { donutPorGrupo, destruir } from '../componentes/graficas.js';
import { renderizarSeccion } from './seccionTransacciones.js';
import { abrirModal, cerrarModal } from '../componentes/modal.js';

let chartDonut = null;

function formatearImporte(valor) {
  return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Construye el formulario de ahorro/inversión usado dentro del modal de T-41,
 * tanto para añadir (sin valores iniciales) como para editar (T-48).
 */
function crearFormularioAhorro(valoresIniciales = {}) {
  const { fecha = '', importe = '', tipo = 'ahorro', nota = '' } = valoresIniciales;

  const formulario = document.createElement('div');
  formulario.className = 'filtros';
  formulario.innerHTML = `
    <label>Fecha: <input type="date" id="modal-ahorro-fecha" value="${fecha}" required></label>
    <label>Importe: <input type="number" id="modal-ahorro-importe" step="0.01" value="${importe}" required></label>
    <label>Tipo:
      <select id="modal-ahorro-tipo">
        <option value="ahorro" ${tipo === 'ahorro' ? 'selected' : ''}>Ahorro</option>
        <option value="inversion" ${tipo === 'inversion' ? 'selected' : ''}>Inversión</option>
      </select>
    </label>
    <label>Nota: <input type="text" id="modal-ahorro-nota" placeholder="Opcional" value="${nota}"></label>
    <button type="button" id="modal-ahorro-guardar">Guardar</button>
  `;
  return formulario;
}

async function cargarMeses() {
  const datos = await api.get('/meses');
  return datos.meses;
}

async function cargarVistaMes(contenedor, mesId) {
  destruir(chartDonut);
  chartDonut = null;

  const [dashboard, txParaCuentas, ahorroDatos] = await Promise.all([
    api.get(`/dashboard/mensual/${mesId}`),
    // Consulta sin paginar, solo para poblar el desplegable de cuentas del filtro.
    api.get(`/transacciones?mes_id=${mesId}&limit=1000&offset=0`),
    api.get(`/ahorro-manual?mes_id=${mesId}`),
  ]);

  // Cabecera compacta: tarjetas + donut pequeño, sin gráfica de barras
  const ratio = dashboard.ratio_ahorro_ingreso;

  let html = `<div class="cabecera-mensual">
    <div class="totales-compacto">
      <div class="total-card gasto">
        <div class="etiqueta">Gasto</div>
        <div class="valor">${formatearImporte(dashboard.totales.gasto)}</div>
      </div>
      <div class="total-card ingreso">
        <div class="etiqueta">Ingreso</div>
        <div class="valor">${formatearImporte(dashboard.totales.ingreso)}</div>
      </div>
      <div class="total-card ahorro">
        <div class="etiqueta">Ahorro</div>
        <div class="valor">${formatearImporte(dashboard.totales.ahorro)}</div>
      </div>
      <div class="total-card inversion">
        <div class="etiqueta">Inversión</div>
        <div class="valor">${formatearImporte(dashboard.totales.inversion)}</div>
      </div>
      <div class="total-card ratio">
        <div class="etiqueta">Ratio ahorro/ingreso</div>
        <div class="valor">${ratio != null ? ratio + ' %' : '—'}</div>
      </div>
    </div>
    <div class="donut-compacto" id="donut-mensual"></div>
  </div>`;

  // Ahorro e inversión (manual)
  html += `<div class="seccion-ahorro">
    <h3>Ahorro e inversión</h3>
    <ul class="lista-editable" id="lista-ahorro-manual">
      ${ahorroDatos.entradas.map(e => `
        <li>
          <span>${e.fecha} — ${e.tipo === 'ahorro' ? 'Ahorro' : 'Inversión'}: ${formatearImporte(e.importe)}${e.nota ? ` <em>(${e.nota})</em>` : ''}</span>
          <span class="acciones">
            <button type="button" class="secundario btn-editar-ahorro" data-id="${e.id}" data-fecha="${e.fecha}" data-importe="${e.importe}" data-tipo="${e.tipo}" data-nota="${e.nota || ''}">Editar</button>
            <button type="button" class="peligro btn-eliminar-ahorro" data-id="${e.id}">Eliminar</button>
          </span>
        </li>`).join('')}
    </ul>
    ${ahorroDatos.entradas.length === 0 ? '<p style="color:#9ca3af; margin-bottom: 0.75rem;">Sin entradas manuales este mes.</p>' : ''}
    <button type="button" id="btn-anadir-ahorro">+ Añadir</button>
  </div>`;

  // Secciones de transacciones por tipo (RF-07)
  html += '<div id="seccion-tx-gasto" class="seccion-tx"></div>';
  html += '<div id="seccion-tx-ahorro-inversion" class="seccion-tx"></div>';
  html += '<div id="seccion-tx-otros" class="seccion-tx"></div>';

  const seccion = document.getElementById('seccion-mensual');
  seccion.innerHTML = html;

  // Donut
  if (!dashboard.vacio && dashboard.grupos.length > 0) {
    chartDonut = donutPorGrupo(document.getElementById('donut-mensual'), dashboard.grupos, { mostrarLeyenda: false });
  }

  // Cuentas disponibles, para el filtro de cuenta de cada sección
  const cuentasDisponibles = [...new Map(
    txParaCuentas.transacciones.map(t => [t.cuenta_id, { id: t.cuenta_id, nombre: t.cuenta_nombre }])
  ).values()];

  // Ahorro e inversión (manual)
  function abrirModalAhorro({ titulo, valoresIniciales, alGuardar }) {
    const formulario = crearFormularioAhorro(valoresIniciales);
    abrirModal(formulario, { titulo });

    formulario.querySelector('#modal-ahorro-fecha').focus();
    formulario.querySelector('#modal-ahorro-guardar').addEventListener('click', async () => {
      const fecha = formulario.querySelector('#modal-ahorro-fecha').value;
      const importe = Number(formulario.querySelector('#modal-ahorro-importe').value);
      const tipo = formulario.querySelector('#modal-ahorro-tipo').value;
      const nota = formulario.querySelector('#modal-ahorro-nota').value || null;

      if (!fecha || Number.isNaN(importe)) return alert('Fecha e importe son obligatorios');

      try {
        await alGuardar({ fecha, importe, tipo, nota });
        cerrarModal();
        cargarVistaMes(contenedor, mesId);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  document.getElementById('btn-anadir-ahorro').addEventListener('click', () => {
    abrirModalAhorro({
      titulo: 'Añadir ahorro/inversión',
      valoresIniciales: {},
      alGuardar: (datos) => api.post('/ahorro-manual', { mes_economico_id: mesId, ...datos }),
    });
  });

  document.querySelectorAll('.btn-editar-ahorro').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalAhorro({
        titulo: 'Editar ahorro/inversión',
        valoresIniciales: {
          fecha: btn.dataset.fecha,
          importe: btn.dataset.importe,
          tipo: btn.dataset.tipo,
          nota: btn.dataset.nota,
        },
        alGuardar: (datos) => api.put(`/ahorro-manual/${btn.dataset.id}`, datos),
      });
    });
  });

  document.querySelectorAll('.btn-eliminar-ahorro').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta entrada de ahorro/inversión?')) return;
      await api.del(`/ahorro-manual/${btn.dataset.id}`);
      cargarVistaMes(contenedor, mesId);
    });
  });

  // Secciones de transacciones por tipo (RF-07): cada una con sus propios
  // filtros, paginación y acciones en lote, independientes entre sí.
  await renderizarSeccion(document.getElementById('seccion-tx-gasto'), {
    tipo: 'gasto', mesId, titulo: 'Gasto', cuentasDisponibles,
  });
  await renderizarSeccion(document.getElementById('seccion-tx-ahorro-inversion'), {
    tipo: 'ahorro_inversion', mesId, titulo: 'Ahorro e inversión', cuentasDisponibles,
  });
  await renderizarSeccion(document.getElementById('seccion-tx-otros'), {
    tipo: 'otros', mesId, titulo: 'Otros', cuentasDisponibles,
  });
}

export async function renderizar(contenedor) {
  contenedor.innerHTML = '<p class="cargando">Cargando...</p>';

  const meses = await cargarMeses();

  if (meses.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <h2>No hay meses económicos</h2>
        <p>Sube extractos y categoriza las transferencias de ingreso para que se detecten automáticamente.</p>
        <p><a href="#/carga">Subir extracto</a></p>
      </div>`;
    return;
  }

  let html = `<div class="selector-periodo">
    <label for="mes-selector">Mes:</label>
    <select id="mes-selector">
      ${meses.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}
    </select>
  </div>
  <div id="seccion-mensual"></div>`;

  contenedor.innerHTML = html;

  const selector = document.getElementById('mes-selector');
  selector.addEventListener('change', () => {
    cargarVistaMes(contenedor, Number(selector.value));
  });

  // Cargar el primer mes
  cargarVistaMes(contenedor, meses[0].id);
}
