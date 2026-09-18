import * as api from '../api.js';
import { donutPorGrupo, destruir } from '../componentes/graficas.js';
import { renderizarTabla, obtenerSeleccionados } from '../componentes/tabla.js';
import { crearSelector, obtenerValor } from '../componentes/selector.js';

let chartDonut = null;

function formatearImporte(valor) {
  return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

async function cargarMeses() {
  const datos = await api.get('/meses');
  return datos.meses;
}

async function cargarVistaMes(contenedor, mesId) {
  destruir(chartDonut);
  chartDonut = null;

  const [dashboard, txDatos] = await Promise.all([
    api.get(`/dashboard/mensual/${mesId}`),
    api.get(`/transacciones?mes_id=${mesId}`),
  ]);

  // Cabecera con totales
  let html = `<div class="totales">
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
  </div>`;

  // Gráfica donut
  html += '<div class="graficas"><div class="grafica-contenedor" id="donut-mensual"></div></div>';

  // Filtros
  html += `<div class="filtros">
    <label>Categoría: <span id="filtro-cat-contenedor"></span></label>
    <label>Cuenta:
      <select id="filtro-cuenta">
        <option value="">Todas</option>
      </select>
    </label>
    <label>Importe mín: <input type="number" id="filtro-min" step="0.01" placeholder=""></label>
    <label>Importe máx: <input type="number" id="filtro-max" step="0.01" placeholder=""></label>
    <button type="button" id="btn-filtrar">Filtrar</button>
  </div>`;

  // Categorización en lote
  html += `<div class="filtros">
    <label>Asignar categoría: <span id="cat-lote-contenedor"></span></label>
    <button type="button" id="btn-categorizar">Categorizar seleccionadas</button>
  </div>`;

  // Tabla
  html += '<div id="tabla-contenedor"></div>';

  const seccion = document.getElementById('seccion-mensual');
  seccion.innerHTML = html;

  // Donut
  if (!dashboard.vacio && dashboard.grupos.length > 0) {
    chartDonut = donutPorGrupo(document.getElementById('donut-mensual'), dashboard.grupos);
  }

  // Cargar cuentas en filtro
  const cuentas = [...new Set(txDatos.transacciones.map(t => t.cuenta_nombre))];
  const selectCuenta = document.getElementById('filtro-cuenta');
  for (const nombre of cuentas) {
    const cuentaId = txDatos.transacciones.find(t => t.cuenta_nombre === nombre)?.cuenta_id;
    selectCuenta.innerHTML += `<option value="${cuentaId}">${nombre}</option>`;
  }

  // Selector de categoría para filtro
  const selectorFiltro = await crearSelector({ id: 'filtro-categoria', incluirVacio: true });
  document.getElementById('filtro-cat-contenedor').appendChild(selectorFiltro);

  // Selector de categoría para lote
  const selectorLote = await crearSelector({ id: 'cat-lote', incluirVacio: true });
  document.getElementById('cat-lote-contenedor').appendChild(selectorLote);

  // Renderizar tabla
  const tablaContenedor = document.getElementById('tabla-contenedor');
  renderizarTabla(tablaContenedor, txDatos.transacciones, { onSeleccionar: true });

  // Filtrar
  document.getElementById('btn-filtrar').addEventListener('click', async () => {
    const filtros = { mes_id: mesId };
    const catId = obtenerValor(selectorFiltro);
    if (catId) filtros.categoria_id = catId;
    const cuentaVal = document.getElementById('filtro-cuenta').value;
    if (cuentaVal) filtros.cuenta_id = Number(cuentaVal);
    const min = document.getElementById('filtro-min').value;
    if (min !== '') filtros.importe_min = Number(min);
    const max = document.getElementById('filtro-max').value;
    if (max !== '') filtros.importe_max = Number(max);

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) params.set(k, v);
    const resultado = await api.get(`/transacciones?${params}`);
    renderizarTabla(tablaContenedor, resultado.transacciones, { onSeleccionar: true });
  });

  // Categorizar en lote
  document.getElementById('btn-categorizar').addEventListener('click', async () => {
    const ids = obtenerSeleccionados(tablaContenedor);
    const catId = obtenerValor(selectorLote);
    if (ids.length === 0) return alert('Selecciona al menos una transacción');
    if (!catId) return alert('Selecciona una categoría');

    const resultado = await api.patch('/transacciones/categorizar', { ids, categoria_id: catId });
    alert(`${resultado.actualizadas} transacciones categorizadas`);
    cargarVistaMes(contenedor, mesId);
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
