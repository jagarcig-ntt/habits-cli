/**
 * Componente modal genérico, sin lógica de negocio ni caso de uso concreto.
 * Un único modal activo a la vez.
 */

function manejarEscape(e) {
  if (e.key === 'Escape') cerrarModal();
}

/**
 * Abre un modal mostrando `contenido` (un nodo DOM) dentro de una caja centrada.
 * @param {HTMLElement} contenido
 * @param {Object} opciones - { titulo, onCerrar }
 * @returns {HTMLElement} el overlay creado
 */
export function abrirModal(contenido, opciones = {}) {
  cerrarModal();

  const { titulo = '', onCerrar } = opciones;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const caja = document.createElement('div');
  caja.className = 'modal-caja';

  const cabecera = document.createElement('div');
  cabecera.className = 'modal-cabecera';

  const h3 = document.createElement('h3');
  h3.textContent = titulo;

  const btnCerrar = document.createElement('button');
  btnCerrar.type = 'button';
  btnCerrar.className = 'modal-cerrar';
  btnCerrar.textContent = '×';
  btnCerrar.setAttribute('aria-label', 'Cerrar');
  btnCerrar.addEventListener('click', () => cerrarModal());

  cabecera.appendChild(h3);
  cabecera.appendChild(btnCerrar);

  caja.appendChild(cabecera);
  caja.appendChild(contenido);
  overlay.appendChild(caja);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrarModal();
  });

  document.addEventListener('keydown', manejarEscape);
  overlay._onCerrar = onCerrar || null;

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Cierra el modal activo, si lo hay. No hace nada si no hay ninguno abierto.
 */
export function cerrarModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  document.removeEventListener('keydown', manejarEscape);
  if (typeof overlay._onCerrar === 'function') overlay._onCerrar();
  overlay.remove();
}
