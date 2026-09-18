# 001 — Homics MVP: Tareas

## Fase 1 — Cimientos

- [x] **T-01** Inicializar package.json con scripts `start` y `test`, instalar better-sqlite3 y xlsx como dependencias. [§1, §5]
  Hecho cuando: `npm install` completa sin errores y `package.json` tiene ambas dependencias con scripts definidos.

- [x] **T-02** Crear `src/core/db.js`: conexión a SQLite, función para ejecutar migraciones desde `migrations/`, helper para queries. [§5]
  Hecho cuando: `tests/db.test.js` pasa — conexión en memoria ok, ejecutar migraciones crea tablas, helper devuelve filas.

- [x] **T-03** Crear `migrations/001_tablas_base.sql`: tablas cuentas, tipos, grupos, categorías y transacciones con UNIQUE constraint de duplicados. [RF-02, RF-03]
  Hecho cuando: migración se ejecuta sin errores y las 5 tablas existen con sus columnas, claves y restricciones.

- [x] **T-04** Crear `migrations/002_reglas.sql`: tabla reglas con patrón único y FK a categorías. [RF-04]
  Hecho cuando: migración se ejecuta tras 001 sin errores, tabla reglas existe con UNIQUE en patrón.

- [x] **T-05** Crear `migrations/003_meses_economicos.sql`: tabla meses_economicos con campos fecha_inicio, fecha_fin y corte_manual. Añadir FK mes_economico_id a transacciones. [RF-06]
  Hecho cuando: migración se ejecuta tras 002, tabla existe y transacciones tiene la columna mes_economico_id.

- [x] **T-06** Crear `tests/db.test.js`: conexión en memoria, migraciones en orden, UNIQUE constraint en transacciones lanza error al duplicar. [§4, §5]
  Hecho cuando: `npm test` ejecuta los 3 casos y pasan.

- [x] **T-07** Crear `src/core/semilla.js`: inserta los 4 tipos, los 11 grupos y las ~30 categorías iniciales de la spec. Inserta cuentas BBVA y Openbank. [RF-03]
  Hecho cuando: tras ejecutar semilla, `SELECT count(*) FROM tipos` = 4, `SELECT count(*) FROM grupos` = 11, categorías = ~30, cuentas = 2.

- [x] **T-08** Crear `src/core/servidor.js`: servidor HTTP nativo que sirve ficheros estáticos desde `src/ui/` y delega `/api/*` a rutas. [RNF-01]
  Hecho cuando: `npm start` arranca en un puerto local, `GET /` sirve `index.html`, peticiones a `/api/*` llegan al router.

- [x] **T-09** Crear `src/core/rutas.js`: mini-router que despacha por método+ruta. Implementar `GET /api/tipos` que devuelve la jerarquía tipo>grupo>categoría. [RF-03]
  Hecho cuando: `curl localhost:PORT/api/tipos` devuelve JSON con 4 tipos, cada uno con sus grupos y categorías anidadas.

- [x] **T-10** Crear `src/ui/index.html` mínimo con navegación placeholder y un contenedor principal. [RNF-01]
  Hecho cuando: abrir `localhost:PORT` en el navegador muestra la página con la navegación visible.

## Fase 2 — Parseo e importación

- [x] **T-11** Crear `src/core/parsers/bbva.js`: parsear XLSX estándar de BBVA, saltar metadatos, validar cabecera, extraer transacciones con fechas en formato YYYY-MM-DD. [RF-01]
  Hecho cuando: `tests/parsers/bbva.test.js` pasa — happy path con extracto real, extracto vacío lanza error, fichero corrupto lanza error.

- [x] **T-12** Crear `tests/parsers/bbva.test.js`: happy path con `Extracto-Marzo26-BBVA.xlsx`, extracto vacío, fichero corrupto. [RF-01, §4]
  Hecho cuando: 3 tests pasan, verifican número de transacciones, campos del primer y último registro, y errores esperados.

- [x] **T-13** Crear `src/core/parsers/openbank.js`: leer HTML como ISO-8859-1, extraer tabla con regex sobre `<tr>/<td>`, parsear importes europeos, validar cabecera. [RF-01]
  Hecho cuando: `tests/parsers/openbank.test.js` pasa — happy path con extracto real, encoding correcto, extracto vacío lanza error.

- [x] **T-14** Crear `tests/parsers/openbank.test.js`: happy path con `Extracto-Marzo26-Openbank.xlsx`, verificar conversión importes europeos, encoding acentos, extracto vacío. [RF-01, §4]
  Hecho cuando: 3 tests pasan, -1.000,00 se convierte a -1000.00, "García" se lee bien, extracto vacío lanza error.

- [x] **T-15** Crear `src/core/servicios/extractos.js`: orquesta selección de parser según banco, inserción con detección de duplicados (UNIQUE constraint), informe nuevas/duplicadas. [RF-01, RF-02]
  Hecho cuando: `tests/servicios/extractos.test.js` pasa — importación ok, doble importación = 0 nuevas, transacciones con mismo día/concepto/importe pero saldo distinto se insertan ambas.

- [x] **T-16** Crear `tests/servicios/extractos.test.js`: importar BBVA, importar dos veces, transacciones legítimas con saldo distinto, divisa no EUR marca aviso. [RF-01, RF-02, §4]
  Hecho cuando: 4 tests pasan.

- [x] **T-17** Añadir endpoint `POST /api/extractos` en rutas.js: recibe multipart (fichero + banco), delega a servicio de extractos, responde con `{ nuevas, duplicadas, avisos }`. [RF-01, RF-02]
  Hecho cuando: `curl -F fichero=@Extracto-Marzo26-BBVA.xlsx -F banco=bbva localhost:PORT/api/extractos` devuelve JSON con nuevas > 0. Segunda llamada devuelve nuevas = 0.

- [x] **T-18** Crear `src/ui/vistas/carga.js`: formulario con selector de banco (BBVA/Openbank), input de fichero, botón subir, muestra resultado (nuevas/duplicadas/avisos). [RF-01]
  Hecho cuando: subir `Extracto-Marzo26-BBVA.xlsx` desde el navegador muestra "X transacciones nuevas, Y duplicadas".

## Fase 3 — Categorización

- [x] **T-19** Crear `src/core/servicios/categorias.js`: CRUD de grupos y categorías, validación de borrado (409 si tiene transacciones asociadas). [RF-03]
  Hecho cuando: `tests/servicios/categorias.test.js` pasa — crear/editar/eliminar grupo y categoría ok, eliminar con transacciones = error 409, duplicado = error 409.

- [x] **T-20** Crear `tests/servicios/categorias.test.js`: semilla correcta, CRUD grupo, CRUD categoría, borrado con dependencias, duplicado. [RF-03, §4]
  Hecho cuando: 6 tests pasan.

- [x] **T-21** Añadir endpoints de categorías y grupos en rutas.js: `GET /api/tipos`, `POST/PUT/DELETE /api/grupos/:id`, `POST/PUT/DELETE /api/categorias/:id`. [RF-03]
  Hecho cuando: CRUD completo funciona vía curl, errores 409 y 404 se devuelven correctamente.

- [x] **T-22** Crear `src/core/servicios/reglas.js`: CRUD de reglas, aplicación automática al crear/editar (subcadena case-insensitive), resolución de conflictos por longitud de patrón, eliminar regla no afecta transacciones existentes. [RF-04]
  Hecho cuando: `tests/servicios/reglas.test.js` pasa — aplicación automática, conflicto gana la más larga, editar reaplica, eliminar conserva categoría, no sobreescribe manual.

- [x] **T-23** Crear `tests/servicios/reglas.test.js`: crear regla y aplicación automática, conflicto de patrones, editar regla, eliminar regla, no sobreescribe manual. [RF-04, §4]
  Hecho cuando: 5 tests pasan.

- [x] **T-24** Añadir endpoints de reglas en rutas.js: `GET /api/reglas`, `POST/PUT/DELETE /api/reglas/:id`. Respuesta incluye `aplicadas: N` en POST y PUT. [RF-04]
  Hecho cuando: crear regla "yaneka" vía curl devuelve `aplicadas: N` con N > 0 si hay transacciones sin categorizar que coincidan.

- [x] **T-25** Crear `src/core/servicios/transacciones.js`: consulta con filtros (mes_id, categoria_id, cuenta_id, importe_min, importe_max), categorización manual individual y en lote, marca origen_categoria='manual'. [RF-05, RF-08, RF-09]
  Hecho cuando: `tests/servicios/transacciones.test.js` pasa — categorización individual, lote, manual prevalece sobre regla, filtros devuelven resultados correctos.

- [x] **T-26** Crear `tests/servicios/transacciones.test.js`: categorización individual, lote, manual prevalece, filtros por categoría/cuenta/importe. [RF-05, §4]
  Hecho cuando: 4 tests pasan.

- [x] **T-27** Añadir endpoints de transacciones en rutas.js: `GET /api/transacciones` con query params de filtro, `PATCH /api/transacciones/categorizar` con body `{ ids, categoria_id }`. [RF-05, RF-08]
  Hecho cuando: GET con filtros devuelve resultados correctos, PATCH actualiza categorías y devuelve `{ actualizadas: N }`.

## Fase 4 — Mes económico

- [x] **T-28** Crear `src/core/servicios/mesEconomico.js`: detección automática de cortes (primera transferencia ingreso >1.000 EUR en día 25-28), cierre de meses, asignación de transacciones a mes_economico_id. [RF-06]
  Hecho cuando: `tests/servicios/mesEconomico.test.js` pasa — detección automática, complementaria >300 no abre mes, extra no afecta corte, sin transferencia no crea mes.

- [x] **T-29** Crear `tests/servicios/mesEconomico.test.js`: detección automática, transferencia complementaria, transferencia extra, sin transferencia en rango, corte manual, extracto multimes. [RF-06, §4]
  Hecho cuando: 6 tests pasan.

- [x] **T-30** Añadir endpoints de meses en rutas.js: `GET /api/meses?anio=`, `POST /api/meses/corte-manual`. [RF-06]
  Hecho cuando: GET devuelve meses detectados para 2026, POST crea corte manual y devuelve 201.

- [x] **T-31** Integrar mes económico con importación: tras importar extracto, ejecutar asignación automática de meses a transacciones sin mes. [RF-01, RF-06]
  Hecho cuando: importar extracto multimes (Extracto-BBVA-MarzoFebrero2026.xlsx) asigna transacciones a meses económicos distintos automáticamente.

## Fase 5 — Dashboard y vistas

- [x] **T-32** Crear `src/core/servicios/dashboard.js`: agregado anual por tipo y grupo, desglose a categoría, "Sin categorizar" como grupo virtual, excluir importe cero, estado vacío. [RF-07, RF-10]
  Hecho cuando: `tests/servicios/dashboard.test.js` pasa — totales correctos, sin categorizar aparece, importe cero excluido, vacío devuelve `vacio: true`.

- [x] **T-33** Crear `tests/servicios/dashboard.test.js`: dashboard con datos, sin categorizar, importe cero, estado vacío. [RF-07, RF-10, §4]
  Hecho cuando: 4 tests pasan.

- [x] **T-34** Añadir endpoints de dashboard en rutas.js: `GET /api/dashboard/anual?anio=`, `GET /api/dashboard/mensual/:mes_id`. [RF-07, RF-08]
  Hecho cuando: ambos endpoints devuelven JSON con estructura correcta (totales, grupos, categorías).

- [x] **T-35** Crear `src/ui/estilos.css`: estilos base, layout de navegación, contenedor principal, variables de color por tipo (gasto/ingreso/ahorro/inversión). [RNF-03]
  Hecho cuando: la app tiene aspecto limpio y coherente con colores distintivos por tipo.

- [x] **T-36** Crear `src/ui/app.js` y `src/ui/api.js`: enrutador cliente (hash-based), wrapper fetch con manejo de errores, inicialización de la app. [RNF-01]
  Hecho cuando: navegar entre `#/dashboard`, `#/mensual`, `#/carga`, `#/categorias`, `#/reglas` carga la vista correspondiente.

- [x] **T-37** Crear `src/ui/componentes/graficas.js`: wrapper de Chart.js para gráficas de barras (dashboard anual por mes) y donut (distribución por grupo). Colores por tipo/grupo. [RF-07, RF-08, RNF-03]
  Hecho cuando: se pueden renderizar ambos tipos de gráfica con datos de prueba, colores distinguen categorías.

- [x] **T-38** Crear `src/ui/componentes/tabla.js`: tabla de transacciones con columnas fecha, concepto, importe, cuenta, categoría. Transacciones sin categorizar visualmente distinguibles. [RF-08]
  Hecho cuando: tabla renderiza transacciones, filas sin categorizar tienen estilo distinto.

- [x] **T-39** Crear `src/ui/componentes/selector.js`: selector de categoría reutilizable con jerarquía tipo>grupo>categoría en desplegable agrupado. [RF-05]
  Hecho cuando: selector muestra categorías agrupadas, seleccionar una devuelve su id.

- [x] **T-40** Crear `src/ui/vistas/dashboard.js`: vista dashboard anual con selector de año, gráfica de barras por mes y donut por grupo, totales por tipo. Estado vacío con enlace a carga. [RF-07, RF-10]
  Hecho cuando: dashboard muestra gráficas reales con datos importados, cambiar año actualiza las gráficas, sin datos muestra estado vacío con enlace.

- [x] **T-41** Crear `src/ui/vistas/mensual.js`: cabecera con resumen gráfico por tipo y grupo, listado de transacciones con filtros (categoría, cuenta, rango importe), categorización manual individual y en lote. [RF-05, RF-08]
  Hecho cuando: vista mensual muestra cabecera + listado, filtros funcionan, seleccionar transacciones y asignar categoría actualiza la vista.

- [x] **T-42** Crear `src/ui/vistas/categorias.js`: listado jerárquico tipo>grupo>categoría, crear/editar/eliminar grupos y categorías con feedback de errores (409 si tiene dependencias). [RF-03]
  Hecho cuando: CRUD completo funciona desde el navegador, eliminar con dependencias muestra error claro.

- [x] **T-43** Crear `src/ui/vistas/reglas.js`: listado de reglas con patrón y categoría asignada, crear/editar/eliminar reglas, muestra número de transacciones aplicadas al crear/editar. [RF-04]
  Hecho cuando: CRUD completo funciona desde el navegador, crear regla muestra "X transacciones categorizadas".

## Fase 6 — Pulido y validación

- [x] **T-44** Verificar todos los casos límite de la spec: extracto vacío/corrupto, importe cero, divisa no EUR, transferencias entre cuentas, extracto multimes. [todos los RF]
  Hecho cuando: cada caso límite probado manualmente con resultado esperado según spec.

- [x] **T-45** Prueba end-to-end completa: subir los 4 extractos de `samples/extractos-tipo/`, categorizar con reglas y manual, verificar dashboard anual y vista mensual con datos reales. [todos los RF, RNF]
  Hecho cuando: dashboard muestra gráficas con datos reales de los 4 extractos, vista mensual filtrable, `npm test` pasa al 100%.

## Post-MVP

- [x] **T-46** Añadir reglas por defecto en `src/core/semilla.js` basadas en los conceptos habituales de los extractos reales. Deben cubrir al menos: ingresos (traspaso/transferencia), supermercados, frutería, gasolina, peajes, farmacia, comunidad, suministros, telecomunicaciones, seguros, transporte público. [RF-04]
  Hecho cuando: `tests/semilla.test.js` verifica que las reglas se crean con la semilla, y al importar un extracto real las transacciones se categorizan automáticamente sin intervención.
