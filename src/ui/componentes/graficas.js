const COLORES_TIPO = {
  gasto:     '#ef4444',
  ingreso:   '#22c55e',
  ahorro:    '#3b82f6',
  inversion: '#a855f7',
};

const COLORES_GRUPO = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#6b7280',
];

function obtenerColorGrupo(indice) {
  return COLORES_GRUPO[indice % COLORES_GRUPO.length];
}

/**
 * Gráfica de barras apiladas: gasto/ingreso/ahorro/inversión por mes.
 * @param {HTMLElement} contenedor
 * @param {Array} meses - [{ nombre, totales: { gasto, ingreso, ahorro, inversion } }]
 */
export function barrasPorMes(contenedor, meses) {
  const canvas = document.createElement('canvas');
  contenedor.appendChild(canvas);

  const etiquetas = meses.map(m => m.nombre);
  const datasets = [
    { label: 'Gasto',     data: meses.map(m => Math.abs(m.totales.gasto)),     backgroundColor: COLORES_TIPO.gasto },
    { label: 'Ingreso',   data: meses.map(m => m.totales.ingreso),             backgroundColor: COLORES_TIPO.ingreso },
    { label: 'Ahorro',    data: meses.map(m => Math.abs(m.totales.ahorro)),    backgroundColor: COLORES_TIPO.ahorro },
    { label: 'Inversión', data: meses.map(m => Math.abs(m.totales.inversion)), backgroundColor: COLORES_TIPO.inversion },
  ];

  return new Chart(canvas, {
    type: 'bar',
    data: { labels: etiquetas, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
      },
      scales: {
        x: { stacked: false },
        y: {
          beginAtZero: true,
          ticks: { callback: v => v.toLocaleString('es-ES') + ' €' },
        },
      },
    },
  });
}

/**
 * Gráfica de donut: distribución por grupo.
 * @param {HTMLElement} contenedor
 * @param {Array} grupos - [{ nombre, total }]
 */
export function donutPorGrupo(contenedor, grupos) {
  const canvas = document.createElement('canvas');
  contenedor.appendChild(canvas);

  // Usar valor absoluto para la gráfica
  const datos = grupos.map(g => Math.abs(g.total));
  const etiquetas = grupos.map(g => g.nombre);
  const colores = grupos.map((_, i) => obtenerColorGrupo(i));

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: etiquetas,
      datasets: [{
        data: datos,
        backgroundColor: colores,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const valor = ctx.parsed.toLocaleString('es-ES');
              return ` ${ctx.label}: ${valor} €`;
            },
          },
        },
      },
    },
  });
}

/**
 * Destruye una instancia de Chart si existe.
 */
export function destruir(chart) {
  if (chart) chart.destroy();
}
