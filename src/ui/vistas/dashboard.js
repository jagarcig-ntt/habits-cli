import * as api from '../api.js';
import { barrasPorMes, donutPorGrupo, destruir } from '../componentes/graficas.js';

let chartBarras = null;
let chartDonut = null;

function formatearImporte(valor) {
  return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function renderizarTopGasto(top) {
  if (!top || top.length === 0) {
    return '<p style="color:#9ca3af;">Sin datos de gasto este año.</p>';
  }

  const maxAbs = Math.abs(top[0].total) || 1;

  return `<ol class="top-gasto-lista">
    ${top.map(c => {
      const pct = Math.round((Math.abs(c.total) / maxAbs) * 100);
      return `<li>
        <span class="top-gasto-nombre">${c.nombre}</span>
        <div class="top-gasto-barra-contenedor"><div class="top-gasto-barra" style="width: ${pct}%"></div></div>
        <span class="top-gasto-valor">${formatearImporte(c.total)}</span>
      </li>`;
    }).join('')}
  </ol>`;
}

function renderizarVariacion(valorCrudo, tipo) {
  if (valorCrudo == null) return '<span class="variacion sin-datos">sin datos previos</span>';

  // El gasto se almacena en negativo: invertimos el signo solo para mostrar
  // "+X%" cuando el gasto sube (peor), igual que hace "+X%" cuando el ingreso sube (mejor).
  const valor = tipo === 'gasto' ? -valorCrudo : valorCrudo;
  const favorable = tipo === 'gasto' ? valor <= 0 : valor >= 0;
  const signo = valor > 0 ? '+' : '';
  const clase = favorable ? 'variacion-favorable' : 'variacion-desfavorable';

  return `<span class="variacion ${clase}">${signo}${valor} %</span>`;
}

function renderizarDesgloseMensual(meses) {
  return `<table>
    <thead><tr><th>Mes</th><th>Gasto</th><th>Ingreso</th></tr></thead>
    <tbody>
      ${meses.map(m => `<tr>
        <td>${m.nombre}</td>
        <td>${formatearImporte(m.totales.gasto)} ${renderizarVariacion(m.comparativa?.gasto ?? null, 'gasto')}</td>
        <td>${formatearImporte(m.totales.ingreso)} ${renderizarVariacion(m.comparativa?.ingreso ?? null, 'ingreso')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function totalesGlobales(meses) {
  const t = { gasto: 0, ingreso: 0, ahorro: 0, inversion: 0 };
  for (const m of meses) {
    t.gasto += m.totales.gasto;
    t.ingreso += m.totales.ingreso;
    t.ahorro += m.totales.ahorro;
    t.inversion += m.totales.inversion;
  }
  return t;
}

function gruposGlobales(meses) {
  const map = {};
  for (const m of meses) {
    for (const g of m.grupos) {
      if (!map[g.nombre]) map[g.nombre] = { nombre: g.nombre, total: 0 };
      map[g.nombre].total += g.total;
    }
  }
  return Object.values(map).sort((a, b) => a.total - b.total);
}

async function cargar(contenedor, anio) {
  destruir(chartBarras);
  destruir(chartDonut);
  chartBarras = null;
  chartDonut = null;

  const datos = await api.get(`/dashboard/anual?anio=${anio}`);

  if (datos.vacio) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <h2>No hay transacciones para ${anio}</h2>
        <p>Sube tu primer extracto para ver el dashboard.</p>
        <p><a href="#/carga">Subir extracto</a></p>
      </div>`;
    return;
  }

  const totales = totalesGlobales(datos.meses);
  // Ahorro e inversión anuales: usar la fuente única del backend (incluye entradas manuales),
  // en vez de la suma local, para no duplicar la misma cifra de dos formas distintas.
  totales.ahorro = datos.acumulado_ahorro;
  totales.inversion = datos.acumulado_inversion;
  const grupos = gruposGlobales(datos.meses);

  contenedor.innerHTML = `
    <div class="selector-periodo">
      <label for="anio">Año:</label>
      <select id="anio">
        ${generarOpcionesAnio(anio)}
      </select>
    </div>

    <div class="totales">
      <div class="total-card gasto">
        <div class="etiqueta">Gasto</div>
        <div class="valor">${formatearImporte(totales.gasto)}</div>
      </div>
      <div class="total-card ingreso">
        <div class="etiqueta">Ingreso</div>
        <div class="valor">${formatearImporte(totales.ingreso)}</div>
      </div>
      <div class="total-card ahorro">
        <div class="etiqueta">Ahorro</div>
        <div class="valor">${formatearImporte(totales.ahorro)}</div>
      </div>
      <div class="total-card inversion">
        <div class="etiqueta">Inversión</div>
        <div class="valor">${formatearImporte(totales.inversion)}</div>
      </div>
      <div class="total-card ratio">
        <div class="etiqueta">Ratio ahorro/ingreso</div>
        <div class="valor">${datos.ratio_ahorro_ingreso != null ? datos.ratio_ahorro_ingreso + ' %' : '—'}</div>
      </div>
    </div>

    <div class="graficas">
      <div class="grafica-contenedor" id="grafica-barras"></div>
      <div class="grafica-contenedor" id="grafica-donut"></div>
    </div>

    <div class="grafica-contenedor">
      <h3>Top categorías de gasto</h3>
      ${renderizarTopGasto(datos.top_categorias_gasto)}
    </div>

    <div class="grafica-contenedor">
      <h3>Desglose mensual</h3>
      ${renderizarDesgloseMensual(datos.meses)}
    </div>`;

  chartBarras = barrasPorMes(document.getElementById('grafica-barras'), datos.meses);
  chartDonut = donutPorGrupo(document.getElementById('grafica-donut'), grupos);

  document.getElementById('anio').addEventListener('change', (e) => {
    cargar(contenedor, Number(e.target.value));
  });
}

function generarOpcionesAnio(anioActual) {
  const actual = new Date().getFullYear();
  let html = '';
  for (let a = actual; a >= actual - 5; a--) {
    html += `<option value="${a}" ${a === anioActual ? 'selected' : ''}>${a}</option>`;
  }
  return html;
}

export function renderizar(contenedor) {
  const anio = new Date().getFullYear();
  contenedor.innerHTML = '<p class="cargando">Cargando dashboard...</p>';
  cargar(contenedor, anio);
}
