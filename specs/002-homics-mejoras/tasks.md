# 002 — Homics: Mejoras de uso diario — Tareas

## Fase 1 — Exclusión y paginación (backend)

- [x] **T-01** Crear `migrations/004_exclusion_y_ahorro_manual.sql`: añade columna `excluida` a `transacciones` (default 0) y crea tabla `ahorro_manual`. [RF-03, RF-05]
  Hecho cuando: la migración se ejecuta tras 003 sin errores; `transacciones` tiene columna `excluida` y existe la tabla `ahorro_manual` con sus columnas.

- [x] **T-02** Ampliar `tests/db.test.js`: verificar migración 004. [RF-03, RF-05, §4]
  Hecho cuando: 2 tests nuevos pasan — columna `excluida` existe con default 0, tabla `ahorro_manual` existe con columnas correctas.

- [x] **T-03** Añadir función `alternarExclusion` en `src/core/servicios/transacciones.js`. [RF-03]
  Hecho cuando: `tests/servicios/transacciones.test.js` pasa — excluir marca `excluida = 1`, incluir revierte a `0`.

- [x] **T-04** Añadir paginación (`limit`/`offset`) a `obtenerTransacciones` en `src/core/servicios/transacciones.js`. [RF-04]
  Hecho cuando: tests pasan — `limit`/`offset` devuelve la página correcta, `hayMas` se calcula bien, una transacción excluida sigue apareciendo en el listado.

- [x] **T-05** Ampliar `tests/servicios/transacciones.test.js`: exclusión y paginación. [RF-03, RF-04, §4]
  Hecho cuando: 4 tests nuevos pasan — excluir/incluir, paginación con `limit`/`offset`, `hayMas` correcto, transacción excluida visible en listado.

- [x] **T-06** Modificar `src/core/servicios/dashboard.js`: excluir transacciones con `excluida = 1` de las queries de totales (mensual y anual). [RF-01, RF-03]
  Hecho cuando: tests pasan — una transacción excluida no cuenta en `totales` del dashboard mensual ni anual.

- [x] **T-07** Ampliar `tests/servicios/dashboard.test.js`: exclusión fuera de totales. [RF-03, §4]
  Hecho cuando: 2 tests nuevos pasan — exclusión no afecta dashboard mensual, exclusión no afecta dashboard anual.

- [x] **T-08** Añadir endpoint `PATCH /api/transacciones/:id/excluir` en `src/core/rutas.js`. [RF-03]
  Hecho cuando: `curl -X PATCH .../api/transacciones/1/excluir -d '{"excluida":true}'` devuelve `{ id, excluida: true }`; 404 si no existe.

- [x] **T-09** Ampliar endpoint `GET /api/transacciones` en `src/core/rutas.js` para aceptar `limit`/`offset`. [RF-04]
  Hecho cuando: `curl ".../api/transacciones?limit=25&offset=25"` devuelve la segunda página con `hayMas` correcto.

## Fase 2 — Categorización inline y exclusión (frontend)

- [x] **T-10** Modificar `src/ui/componentes/tabla.js`: desplegable de categoría inline por fila con botón "confirmar" que solo aparece si el valor cambió. [RF-02]
  Hecho cuando: cambiar el `<select>` de una fila muestra el botón de confirmar; pulsarlo invoca el callback de categorización con un único id.

- [x] **T-11** Modificar `src/ui/componentes/tabla.js`: botón excluir/incluir por fila y clase CSS para fila excluida. [RF-03]
  Hecho cuando: pulsar "Excluir" marca la fila con la clase de atenuado; pulsar "Incluir" la revierte.

- [x] **T-12** Ampliar `src/ui/estilos.css`: estilo de fila excluida (atenuada), select inline en celda, botón "Mostrar más". [RF-02, RF-03, RF-04, RNF-03]
  Hecho cuando: los tres estilos se ven coherentes con la paleta de colores ya existente (variables `--color-*`).

- [x] **T-13** Modificar `src/ui/vistas/mensual.js`: cablear categorización inline y exclusión contra la API (`PATCH /transacciones/categorizar`, `PATCH /transacciones/:id/excluir`). [RF-02, RF-03]
  Hecho cuando: desde el navegador, cambiar la categoría de una fila y confirmar persiste sin recargar la página; excluir una transacción la atenúa y actualiza los totales de la cabecera.

- [x] **T-14** Modificar `src/ui/vistas/mensual.js`: botón "Mostrar más" con paginación acumulativa (añade filas al `<tbody>` sin sustituir la tabla). [RF-04]
  Hecho cuando: pulsar "Mostrar más" añade 25 filas sin perder la posición de scroll; el botón desaparece cuando no quedan más transacciones.

## Fase 3 — Ahorro manual y cabecera compacta

- [x] **T-15** Crear `src/core/servicios/ahorroManual.js`: CRUD completo (`crearEntrada`, `editarEntrada`, `eliminarEntrada`, `obtenerEntradas`). [RF-05]
  Hecho cuando: `tests/servicios/ahorroManual.test.js` pasa — crear/editar/eliminar/listar funcionan, validación de `tipo` y `mes_economico_id`.

- [x] **T-16** Crear `tests/servicios/ahorroManual.test.js`. [RF-05, §4]
  Hecho cuando: 7 tests pasan — crear entrada de ahorro, crear entrada de inversión, editar, eliminar, listar por mes, `tipo` inválido lanza error, mes inexistente lanza error.

- [x] **T-17** Añadir endpoints `GET/POST/PUT/DELETE /api/ahorro-manual` en `src/core/rutas.js`. [RF-05]
  Hecho cuando: CRUD completo funciona vía curl; 400 en validación, 404 en no encontrado.

- [x] **T-18** Modificar `src/core/servicios/dashboard.js`: sumar entradas de `ahorro_manual` a los totales de ahorro/inversión (mensual y anual). [RF-05]
  Hecho cuando: tests pasan — el total de ahorro de un mes es la suma de transacciones categorizadas más las entradas manuales del mismo mes.

- [x] **T-19** Ampliar `tests/servicios/dashboard.test.js`: suma de ahorro manual. [RF-05, §4]
  Hecho cuando: 1 test nuevo pasa verificando la suma combinada.

- [x] **T-20** Rediseñar la cabecera en `src/ui/vistas/mensual.js`: tarjetas compactas (gasto, ingreso, ahorro, inversión, ratio ahorro/ingreso) + un único donut pequeño, eliminando el bloque de gráficas grande actual. [RF-01]
  Hecho cuando: la cabecera ocupa como máximo ~25% de la altura visible en un viewport estándar de escritorio; no hay gráfica de barras en esta vista.

- [x] **T-21** Añadir sección "Ahorro e inversión" en `src/ui/vistas/mensual.js`: listado de entradas del mes + formulario para crear/editar/eliminar. [RF-05]
  Hecho cuando: desde el navegador se puede añadir, editar y eliminar una entrada manual, y el total de la cabecera se actualiza al instante.

## Fase 4 — Dashboard anual ampliado

- [x] **T-22** Añadir función `topCategoriasGasto` en `src/core/servicios/dashboard.js`. [RF-06]
  Hecho cuando: tests pasan — devuelve máximo 5 categorías ordenadas por gasto descendente para el año dado.

- [x] **T-23** Añadir función `ratioAhorroIngreso` en `src/core/servicios/dashboard.js`. [RF-06]
  Hecho cuando: tests pasan — calcula el porcentaje correcto; devuelve `null` si el ingreso total es 0.

- [x] **T-24** Añadir función `calcularComparativas` en `src/core/servicios/dashboard.js`. [RF-06]
  Hecho cuando: tests pasan — el primer mes con datos tiene comparativa `null`, los siguientes calculan la variación correcta respecto al mes anterior.

- [x] **T-25** Añadir cálculo de acumulado anual de ahorro/inversión en `src/core/servicios/dashboard.js`. [RF-06]
  Hecho cuando: tests pasan — suma transacciones categorizadas más entradas manuales de todos los meses del año.

- [x] **T-26** Ampliar `tests/servicios/dashboard.test.js`: top gasto, ratio, comparativa, acumulado anual. [RF-06, §4]
  Hecho cuando: 6 tests nuevos pasan cubriendo las 4 funciones de T-22 a T-25.

- [x] **T-27** Modificar endpoint `GET /api/dashboard/anual` en `src/core/rutas.js` para incluir `top_categorias_gasto`, `ratio_ahorro_ingreso`, `acumulado_ahorro`, `acumulado_inversion` y `comparativa` por mes. [RF-06]
  Hecho cuando: `curl .../api/dashboard/anual?anio=2026` devuelve los 4 campos nuevos con valores correctos.

- [x] **T-28** Modificar endpoint `GET /api/dashboard/mensual/:mes_id` en `src/core/rutas.js` para incluir `ratio_ahorro_ingreso`. [RF-01]
  Hecho cuando: `curl .../api/dashboard/mensual/1` devuelve el campo calculado correctamente.

- [x] **T-29** Añadir bloque "Top categorías de gasto" en `src/ui/vistas/dashboard.js`. [RF-06]
  Hecho cuando: el navegador muestra el ranking de 5 categorías con datos reales del año seleccionado.

- [x] **T-30** Añadir tarjetas de ratio ahorro/ingreso y acumulado ahorro/inversión anual en `src/ui/vistas/dashboard.js`. [RF-06]
  Hecho cuando: ambas tarjetas son visibles con valores correctos, coherentes con el resto de tarjetas de totales.

- [x] **T-31** Añadir indicador de variación mes vs. mes anterior en el desglose mensual de `src/ui/vistas/dashboard.js`. [RF-06]
  Hecho cuando: cada mes del desglose anual muestra su variación de gasto/ingreso (ej. "+8%"), y el primer mes con datos muestra "sin datos previos".

## Fase 5 — Pulido y validación final

- [x] **T-32** Verificar los 6 casos límite de la spec 002. [todos los RF]
  Hecho cuando: cada caso límite probado manualmente con el resultado esperado según la spec.

- [x] **T-33** Prueba end-to-end completa. [todos los RF, RNF]
  Hecho cuando: excluir el préstamo real de Junio del extracto oficial actualiza los totales; añadir una entrada de ahorro manual se refleja en el dashboard mensual y anual; `npm test` pasa al 100%.

## Fase 6 — Ampliación tras revisión: lote, secciones, modal, filtros por columna

- [x] **T-34** Añadir filtro `tipo` (`gasto`\|`ahorro_inversion`\|`otros`) a `obtenerTransacciones` en `src/core/servicios/transacciones.js`. [RF-07]
  Hecho cuando: tests pasan — `tipo=gasto` devuelve solo transacciones de categorías tipo gasto; `tipo=ahorro_inversion` devuelve ahorro e inversión juntas; `tipo=otros` devuelve ingreso y sin categorizar.

- [x] **T-35** Añadir filtros `concepto` (subcadena), `fecha_desde`, `fecha_hasta` a `obtenerTransacciones`. [RF-08]
  Hecho cuando: tests pasan — `concepto` filtra case-insensitive por subcadena; `fecha_desde`/`fecha_hasta` filtran por rango de fecha de operación.

- [x] **T-36** Ampliar `tests/servicios/transacciones.test.js`: filtros `tipo`, `concepto`, `fecha_desde`/`fecha_hasta`. [RF-07, RF-08, §4]
  Hecho cuando: 5 tests nuevos pasan cubriendo los 3 valores de `tipo` y los filtros de concepto/fecha.

- [x] **T-37** Añadir función `excluirEnLote(db, ids, excluida)` en `src/core/servicios/transacciones.js`. [RF-03]
  Hecho cuando: tests pasan — excluye varias transacciones de una vez; incluye varias de una vez; devuelve `{ actualizadas: N }`.

- [x] **T-38** Ampliar `tests/servicios/transacciones.test.js`: `excluirEnLote`. [RF-03, §4]
  Hecho cuando: 2 tests nuevos pasan (excluir en lote, incluir en lote).

- [x] **T-39** Añadir endpoint `PATCH /api/transacciones/excluir` (lote) en `src/core/rutas.js`. [RF-03]
  Hecho cuando: `curl -X PATCH .../api/transacciones/excluir -d '{"ids":[1,2],"excluida":true}'` devuelve `{ actualizadas: 2 }`.

- [x] **T-40** Ampliar endpoint `GET /api/transacciones` en `src/core/rutas.js` para aceptar `tipo`, `concepto`, `fecha_desde`, `fecha_hasta`. [RF-07, RF-08]
  Hecho cuando: `curl ".../api/transacciones?mes_id=1&tipo=gasto"` devuelve solo transacciones de tipo gasto; `curl "...&concepto=mercadona"` filtra por texto.

- [x] **T-41** Crear `src/ui/componentes/modal.js`: componente genérico de overlay (abrir con contenido, cerrar con botón/Escape/click fuera). [RF-05]
  Hecho cuando: el modal se abre y cierra correctamente en el navegador; no depende de ningún caso de uso concreto.

- [x] **T-42** Modificar `src/ui/componentes/tabla.js`: el botón "✓" de categorización inline marca la fila como "pendiente" en vez de guardar inmediatamente; exponer función para leer los cambios pendientes (`obtenerCambiosPendientes`). [RF-02]
  Hecho cuando: cambiar el desplegable de una fila y pulsar "✓" la marca visualmente como pendiente sin llamar a la API; `obtenerCambiosPendientes(contenedor)` devuelve `[{id, categoria_id}]` de las filas marcadas.

- [x] **T-43** Crear `src/ui/vistas/seccionTransacciones.js`: sección autocontenida con fila de filtros por columna (concepto, fechas, importe, cuenta, categoría), tabla y paginación "Mostrar más", parametrizada por `tipo`. [RF-07, RF-08, RF-04]
  Hecho cuando: instanciada con un `tipo` y `mesId`, la sección carga y pagina solo las transacciones de ese tipo, con sus propios filtros por columna independientes de otras instancias.

- [x] **T-44** Añadir a `seccionTransacciones.js`: botón "Guardar cambios" que aparece solo con ediciones pendientes y persiste todas las filas modificadas con una petición por fila. [RF-02]
  Hecho cuando: cambiar la categoría de 3 filas distintas y pulsar "Guardar cambios" una vez persiste las 3; el botón desaparece tras guardar o si no hay pendientes.

- [x] **T-45** Añadir a `seccionTransacciones.js`: botones "Excluir seleccionadas" / "Incluir seleccionadas" usando las casillas de selección existentes y el endpoint de lote de T-39. [RF-03]
  Hecho cuando: seleccionar varias transacciones y pulsar "Excluir seleccionadas" las excluye todas con una sola petición; los totales de la cabecera se actualizan tras la acción.

- [x] **T-46** Modificar `src/ui/vistas/mensual.js`: sustituir la tabla única por 3 instancias de `seccionTransacciones.js` (Gasto / Ahorro e inversión / Otros), cada una con su propio título de sección. [RF-07]
  Hecho cuando: el listado mensual muestra 3 secciones visualmente diferenciadas; recategorizar una transacción de "Otros" a "Ahorro" la mueve de sección tras guardar.

- [x] **T-47** Modificar `src/ui/vistas/mensual.js`: el botón "+ Añadir" de la sección de ahorro manual abre el modal de T-41 con el formulario (fecha, importe, tipo, nota) en vez de la fila de campos fija. [RF-05]
  Hecho cuando: pulsar "+ Añadir" abre el modal; guardar crea la entrada y cierra el modal; cancelar/cerrar no crea nada.

- [x] **T-48** Modificar `src/ui/vistas/mensual.js`: el botón "Editar" de una entrada de ahorro manual abre el mismo modal precargado con sus valores actuales, en vez de `prompt()` encadenados. [RF-05]
  Hecho cuando: pulsar "Editar" abre el modal con los 4 campos ya rellenos; guardar persiste los cambios y cierra el modal.

- [x] **T-49** Verificación manual en navegador de toda la Fase 6. [RF-02, RF-03, RF-05, RF-07, RF-08]
  Hecho cuando: guardado en lote con categorías distintas, exclusión en lote, 3 secciones, filtros por columna y modal (crear/editar) funcionan correctamente con datos reales, sin errores de consola.

- [x] **T-50** `npm test` pasa al 100% tras toda la Fase 6. [§4]
  Hecho cuando: la suite completa pasa sin fallos.
