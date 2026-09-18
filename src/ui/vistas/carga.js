export function renderizar(contenedor) {
  contenedor.innerHTML = `
    <h2>Subir extracto bancario</h2>
    <form id="formulario-carga">
      <label for="banco">Banco:</label>
      <select id="banco" name="banco" required>
        <option value="bbva">BBVA</option>
        <option value="openbank">Openbank</option>
      </select>

      <label for="fichero">Fichero:</label>
      <input type="file" id="fichero" name="fichero" accept=".xlsx,.xls" required>

      <button type="submit">Subir extracto</button>
    </form>
    <div id="resultado-carga"></div>
  `;

  const formulario = document.getElementById('formulario-carga');
  const divResultado = document.getElementById('resultado-carga');

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    divResultado.innerHTML = '<p class="cargando">Importando...</p>';

    const datos = new FormData();
    datos.append('banco', document.getElementById('banco').value);
    datos.append('fichero', document.getElementById('fichero').files[0]);

    try {
      const respuesta = await fetch('/api/extractos', { method: 'POST', body: datos });
      const json = await respuesta.json();

      if (!respuesta.ok) {
        divResultado.innerHTML = `<p class="error">Error: ${json.error}</p>`;
        return;
      }

      let html = `<p class="exito">${json.nuevas} transacciones nuevas, ${json.duplicadas} duplicadas</p>`;
      if (json.avisos && json.avisos.length > 0) {
        html += '<ul class="avisos">' + json.avisos.map(a => `<li>${a}</li>`).join('') + '</ul>';
      }
      divResultado.innerHTML = html;
    } catch {
      divResultado.innerHTML = '<p class="error">Error de conexión con el servidor</p>';
    }
  });
}
