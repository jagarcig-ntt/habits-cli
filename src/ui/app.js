const contenedor = document.getElementById('contenedor');
const enlaces = document.querySelectorAll('nav a');

const vistas = {
  '/dashboard':  () => import('./vistas/dashboard.js'),
  '/mensual':    () => import('./vistas/mensual.js'),
  '/carga':      () => import('./vistas/carga.js'),
  '/categorias': () => import('./vistas/categorias.js'),
  '/reglas':     () => import('./vistas/reglas.js'),
};

function marcarEnlaceActivo(ruta) {
  enlaces.forEach(a => {
    const href = a.getAttribute('href').slice(1); // quitar #
    a.classList.toggle('activo', href === ruta);
  });
}

async function navegar() {
  const ruta = location.hash.slice(1) || '/dashboard';
  marcarEnlaceActivo(ruta);

  const cargador = vistas[ruta];
  if (cargador) {
    try {
      const modulo = await cargador();
      modulo.renderizar(contenedor);
    } catch (err) {
      contenedor.innerHTML = `<p class="error">Error al cargar la vista: ${err.message}</p>`;
    }
  } else {
    contenedor.innerHTML = '<p class="error">Vista no encontrada</p>';
  }
}

window.addEventListener('hashchange', navegar);
navegar();
