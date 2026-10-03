import * as api from '../api.js';
import { renderizarTabla, agregarFilas, obtenerSeleccionados, obtenerCambiosPendientes, hayCambiosPendientes } from '../componentes/tabla.js';
import { crearSelector, obtenerValor } from '../componentes/selector.js';

const TAMANO_PAGINA = 25;
const DEBOUNCE_MS = 400;

/**
 * Renderiza una sección autocontenida de transacciones (filtros por columna +
 * tabla + paginación), filtrada por `tipo`. Cada instancia mantiene su propio
 * estado de filtros y paginación, independiente de otras secciones.
 *
 * @param {HTMLElement} contenedor
 * @param {Object} opciones - {
 *   tipo: 'gasto'|'ahorro_inversion'|'otros',
 *   mesId: number,
 *   titulo: string,
 *   cuentasDisponibles: Array<{id, nombre}>
 * }
 */
export async function renderizarSeccion(contenedor, { tipo, mesId, titulo, cuentasDisponibles = [] }) {
  let filtrosActuales = { mes_id: mesId, tipo };
  let offsetActual = 0;
  let debounceTimer = null;

  contenedor.innerHTML = `
    <h3>${titulo}</h3>
    <div class="acciones-seccion">
      <button type="button" class="btn-excluir-lote secundario">Excluir seleccionadas</button>
      <button type="button" class="btn-incluir-lote secundario">Incluir seleccionadas</button>
      <button type="button" class="btn-guardar-cambios" style="display:none;">Guardar cambios</button>
    </div>
    <div class="tabla-contenedor"></div>
    <button type="button" class="btn-mostrar-mas" style="display:none;">Mostrar más</button>
  `;

  const tablaContenedor = contenedor.querySelector('.tabla-contenedor');
  const btnMostrarMas = contenedor.querySelector('.btn-mostrar-mas');
  const btnGuardarCambios = contenedor.querySelector('.btn-guardar-cambios');
  const btnExcluirLote = contenedor.querySelector('.btn-excluir-lote');
  const btnIncluirLote = contenedor.querySelector('.btn-incluir-lote');

  function construirParams(offset) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtrosActuales)) {
      if (v !== '' && v != null) params.set(k, v);
    }
    params.set('limit', TAMANO_PAGINA);
    params.set('offset', offset);
    return params;
  }

  function opcionesTabla() {
    return {
      onSeleccionar: true,
      categorizable: true,
      onExcluir: manejarExcluir,
      onCambioPendiente: actualizarVisibilidadBotonGuardar,
    };
  }

  function actualizarVisibilidadBotonGuardar() {
    btnGuardarCambios.style.display = hayCambiosPendientes(tablaContenedor) ? 'block' : 'none';
  }

  async function guardarCambiosPendientes() {
    const cambios = obtenerCambiosPendientes(tablaContenedor);
    for (const cambio of cambios) {
      await api.patch('/transacciones/categorizar', { ids: [cambio.id], categoria_id: cambio.categoria_id });
    }
    await cargarPagina(0, { reemplazar: true });
    btnGuardarCambios.style.display = 'none';
  }

  async function manejarExcluir(id, nuevoEstado) {
    await api.patch(`/transacciones/${id}/excluir`, { excluida: nuevoEstado });
    await cargarPagina(0, { reemplazar: true });
  }

  async function excluirSeleccionadasEnLote(excluida) {
    const ids = obtenerSeleccionados(tablaContenedor);
    if (ids.length === 0) return;
    await api.patch('/transacciones/excluir', { ids, excluida });
    await cargarPagina(0, { reemplazar: true });
  }

  async function cargarPagina(offset, { reemplazar }) {
    const resultado = await api.get(`/transacciones?${construirParams(offset)}`);

    if (reemplazar) {
      await renderizarTabla(tablaContenedor, resultado.transacciones, opcionesTabla());
      insertarFilaFiltros();
      btnGuardarCambios.style.display = 'none';
    } else {
      await agregarFilas(tablaContenedor, resultado.transacciones, opcionesTabla());
    }

    offsetActual = offset + resultado.transacciones.length;
    btnMostrarMas.style.display = resultado.hayMas ? 'block' : 'none';
  }

  async function insertarFilaFiltros() {
    const thead = tablaContenedor.querySelector('thead');
    if (!thead) return;

    const fila = document.createElement('tr');
    fila.className = 'fila-filtros-columna';

    const tdCheckbox = document.createElement('td');
    fila.appendChild(tdCheckbox);

    const tdFecha = document.createElement('td');
    tdFecha.innerHTML = `
      <input type="date" class="filtro-fecha-desde" title="Desde">
      <input type="date" class="filtro-fecha-hasta" title="Hasta">
    `;
    fila.appendChild(tdFecha);

    const tdConcepto = document.createElement('td');
    tdConcepto.innerHTML = `<input type="text" class="filtro-concepto" placeholder="Buscar...">`;
    fila.appendChild(tdConcepto);

    const tdImporte = document.createElement('td');
    tdImporte.innerHTML = `
      <input type="number" class="filtro-importe-min" step="0.01" placeholder="Mín">
      <input type="number" class="filtro-importe-max" step="0.01" placeholder="Máx">
    `;
    fila.appendChild(tdImporte);

    const tdCuenta = document.createElement('td');
    const selectCuenta = document.createElement('select');
    selectCuenta.className = 'filtro-cuenta';
    selectCuenta.innerHTML = '<option value="">Todas</option>' +
      cuentasDisponibles.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    tdCuenta.appendChild(selectCuenta);
    fila.appendChild(tdCuenta);

    const tdCategoria = document.createElement('td');
    const selectorCategoria = await crearSelector({ id: `filtro-cat-${tipo}`, incluirVacio: true });
    selectorCategoria.classList.add('filtro-categoria');
    tdCategoria.appendChild(selectorCategoria);
    fila.appendChild(tdCategoria);

    const tdAcciones = document.createElement('td');
    fila.appendChild(tdAcciones);

    thead.appendChild(fila);

    function aplicarFiltros() {
      filtrosActuales = { mes_id: mesId, tipo };

      const concepto = fila.querySelector('.filtro-concepto').value.trim();
      if (concepto) filtrosActuales.concepto = concepto;

      const fechaDesde = fila.querySelector('.filtro-fecha-desde').value;
      if (fechaDesde) filtrosActuales.fecha_desde = fechaDesde;

      const fechaHasta = fila.querySelector('.filtro-fecha-hasta').value;
      if (fechaHasta) filtrosActuales.fecha_hasta = fechaHasta;

      const importeMin = fila.querySelector('.filtro-importe-min').value;
      if (importeMin !== '') filtrosActuales.importe_min = Number(importeMin);

      const importeMax = fila.querySelector('.filtro-importe-max').value;
      if (importeMax !== '') filtrosActuales.importe_max = Number(importeMax);

      const cuentaId = selectCuenta.value;
      if (cuentaId) filtrosActuales.cuenta_id = Number(cuentaId);

      const categoriaId = obtenerValor(selectorCategoria);
      if (categoriaId) filtrosActuales.categoria_id = categoriaId;

      cargarPagina(0, { reemplazar: true });
    }

    function aplicarConDebounce() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(aplicarFiltros, DEBOUNCE_MS);
    }

    fila.querySelector('.filtro-concepto').addEventListener('input', aplicarConDebounce);
    fila.querySelector('.filtro-importe-min').addEventListener('input', aplicarConDebounce);
    fila.querySelector('.filtro-importe-max').addEventListener('input', aplicarConDebounce);
    fila.querySelector('.filtro-fecha-desde').addEventListener('change', aplicarFiltros);
    fila.querySelector('.filtro-fecha-hasta').addEventListener('change', aplicarFiltros);
    selectCuenta.addEventListener('change', aplicarFiltros);
    selectorCategoria.addEventListener('change', aplicarFiltros);
  }

  await cargarPagina(0, { reemplazar: true });

  btnMostrarMas.addEventListener('click', () => cargarPagina(offsetActual, { reemplazar: false }));
  btnGuardarCambios.addEventListener('click', guardarCambiosPendientes);
  btnExcluirLote.addEventListener('click', () => excluirSeleccionadasEnLote(true));
  btnIncluirLote.addEventListener('click', () => excluirSeleccionadasEnLote(false));
}
