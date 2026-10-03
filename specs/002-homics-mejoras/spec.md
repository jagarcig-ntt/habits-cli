# 002 — Homics: Mejoras de uso diario

## Contexto y objetivo

Tras usar el MVP (spec `001-homics-mvp`) con datos reales durante varios meses, han aparecido fricciones concretas: la cabecera mensual es desproporcionada, no se puede categorizar ni excluir transacciones sin salir de la vista, el listado mensual es demasiado largo para revisar de un vistazo, el ahorro/inversión depende en exceso de reglas automáticas sobre el extracto, y el dashboard anual aporta menos contexto del que podría. Esta spec extiende las vistas de dashboard (RF-07) y mensual (RF-08) del MVP y añade capacidades nuevas de gestión de transacciones y de ahorro manual, sin tocar la carga de extractos, reglas ni mes económico ya construidos.

No incluye el rediseño visual (tema oscuro / look moderno), que queda para una spec `003` independiente.

## Usuarios

- **Administrador del hogar**: mismo usuario único del MVP, ahora con meses de uso real y necesidad de revisar/corregir datos con más agilidad.

## Historias de usuario

- HU-01: Como administrador, quiero ver la cabecera del mes como un resumen compacto de tarjetas, no como un gráfico enorme, para poder centrarme en el listado de transacciones.
- HU-02: Como administrador, quiero cambiar la categoría de una transacción directamente desde la fila de la tabla, sin ir a otra pantalla.
- HU-03: Como administrador, quiero poder excluir una transacción puntual (ej. el ingreso y salida de un préstamo) para que no distorsione los totales del mes, sin perder el registro.
- HU-04: Como administrador, quiero cargar el listado de transacciones del mes poco a poco, no todo de golpe, para no perderme en una lista larga.
- HU-05: Como administrador, quiero anotar manualmente los movimientos de ahorro/inversión de cada mes, además de lo que detectan las reglas automáticas, para llevar un control más fiable.
- HU-06: Como administrador, quiero ver en el dashboard anual el acumulado de ahorro, qué categorías consumen más gasto, y cómo varía cada mes respecto al anterior, para entender mejor la evolución.
- HU-07: Como administrador, quiero cambiar la categoría de varias transacciones (cada una a un valor distinto) y guardarlas todas juntas, sin confirmar fila por fila.
- HU-08: Como administrador, quiero excluir o incluir varias transacciones a la vez, no solo de una en una.
- HU-09: Como administrador, quiero ver el gasto separado del ahorro/inversión en el listado mensual, para no mezclar conceptualmente ambos.
- HU-10: Como administrador, quiero añadir una entrada de ahorro/inversión desde un botón con ventana emergente, no desde una fila de formulario fija en la pantalla.
- HU-11: Como administrador, quiero filtrar directamente desde cada columna de la tabla (fecha, concepto, importe, cuenta, categoría), para encontrar transacciones concretas más rápido.

## Requisitos funcionales

### RF-01 — Cabecera mensual compacta
**Cuando** el usuario accede a la vista de un mes económico, **el sistema** debe sustituir el bloque de gráficas grandes actual por una cabecera compacta de tarjetas resumen.
- Criterio de aceptación: la cabecera muestra tarjetas con: total gasto, total ingreso, total ahorro (automático + manual, ver RF-05), total inversión, y ratio ahorro/ingreso del mes.
- Criterio de aceptación: se conserva una única gráfica pequeña (donut) de distribución por grupo, sin gráfica de barras en esta vista.
- Criterio de aceptación: la cabecera ocupa como máximo una franja visual equivalente a las tarjetas + un donut pequeño, no más del ~25% de la altura visible en un viewport estándar de escritorio.

### RF-02 — Categorización inline desde la tabla
**Cuando** el usuario está en el listado de transacciones de un mes, **el sistema** debe permitir cambiar la categoría de una transacción directamente desde su fila.
- Criterio de aceptación: cada fila de la tabla incluye un desplegable de categoría (misma jerarquía tipo > grupo > categoría del selector existente) inicializado con la categoría actual (o "Sin categorizar").
- Criterio de aceptación: cambiar el valor del desplegable no aplica el cambio inmediatamente; requiere una confirmación explícita (botón de confirmar en la fila, o guardado al perder el foco — a definir en plan).
- Criterio de aceptación: al confirmar, la transacción queda marcada como categorización manual (`origen_categoria = 'manual'`), igual que en RF-05 del MVP.
- Criterio de aceptación: la categorización en lote existente (selección múltiple + categoría) se mantiene disponible además de la inline.
- Criterio de aceptación: cambiar el desplegable de varias filas (cada una a una categoría distinta si se desea) no persiste nada hasta que el usuario pulse un botón "Guardar cambios" visible mientras haya ediciones pendientes; al pulsarlo, todas las filas modificadas se guardan en una sola operación y cada una queda marcada como categorización manual.
- Criterio de aceptación: si el usuario navega a otro mes o recarga sin guardar, los cambios pendientes se pierden sin avisar (no se persiste estado entre vistas).

### RF-03 — Exclusión de transacciones
**Cuando** el usuario decide que una transacción no debe contarse en los totales (ej. entrada y salida de un préstamo), **el sistema** debe permitir excluirla sin eliminar el registro.
- Criterio de aceptación: cada fila de la tabla tiene una acción "Excluir" / "Incluir" que alterna un estado `excluida` en la transacción.
- Criterio de aceptación: las transacciones excluidas no se cuentan en los totales del dashboard mensual ni anual (RF-07 y RF-08 del MVP), ni en las nuevas métricas de RF-06.
- Criterio de aceptación: las transacciones excluidas permanecen visibles en el listado mensual, visualmente atenuadas (ej. opacidad reducida o tachado), para que el usuario recuerde que existen y pueda revertir la exclusión.
- Criterio de aceptación: excluir una transacción es independiente de su categoría; se puede excluir una transacción categorizada o sin categorizar, y se puede recategorizar una transacción excluida sin que deje de estar excluida.
- Criterio de aceptación: el usuario puede seleccionar varias transacciones (misma casilla de selección usada para la categorización en lote) y excluirlas o incluirlas todas con un único botón ("Excluir seleccionadas" / "Incluir seleccionadas"), aplicándose inmediatamente (sin estado "pendiente", a diferencia de RF-02).

### RF-04 — Carga incremental del listado mensual
**Cuando** el listado de transacciones de un mes supera un umbral de filas, **el sistema** debe cargarlas de forma incremental en vez de mostrarlas todas de golpe.
- Criterio de aceptación: el listado muestra inicialmente las primeras 25 transacciones (ordenadas por fecha de operación, igual que en RF-08 del MVP).
- Criterio de aceptación: un botón "Mostrar más" al final del listado añade las siguientes 25 transacciones sin recargar la página ni perder el scroll.
- Criterio de aceptación: el botón desaparece cuando ya no quedan más transacciones por cargar.
- Criterio de aceptación: aplicar un filtro (categoría, cuenta, importe) reinicia la paginación a las primeras 25 del resultado filtrado.

### RF-05 — Registro manual de ahorro e inversión por mes
**Cuando** el usuario quiere anotar un movimiento de ahorro o inversión que no proviene de una regla automática sobre el extracto, **el sistema** debe permitir añadirlo manualmente dentro del mes económico correspondiente.
- Criterio de aceptación: la vista mensual incluye una sección "Ahorro e inversión" separada del listado de transacciones bancarias, con el listado de entradas ya creadas y un botón "+ Añadir" que abre una ventana modal con el formulario: fecha, importe (puede ser negativo, ej. un reintegro), tipo (ahorro o inversión) y una nota descriptiva opcional.
- Criterio de aceptación: editar una entrada existente abre el mismo componente modal, precargado con sus valores actuales, en vez de una secuencia de cuadros de diálogo del navegador.
- Criterio de aceptación: las entradas manuales son independientes de las transacciones importadas del extracto; no están vinculadas a ninguna transacción bancaria.
- Criterio de aceptación: el total de ahorro y de inversión mostrado en la cabecera mensual (RF-01) y en el dashboard anual es la suma de: transacciones bancarias categorizadas como Ahorro/Inversión (vía reglas o manualmente, como ya soporta el MVP) **más** las entradas manuales de esta sección. Evitar contar dos veces el mismo movimiento es responsabilidad del usuario: si una transferencia ya fue categorizada por regla como Ahorro, no debe volver a anotarse aquí.
- Criterio de aceptación: las entradas manuales se pueden editar y eliminar.
- Criterio de aceptación: el dashboard anual muestra el acumulado de ahorro e inversión del año (transacciones + entradas manuales) como cifra destacada.

### RF-06 — Dashboard anual ampliado
**Cuando** el usuario accede al dashboard anual, **el sistema** debe mostrar información adicional de contexto financiero, más allá de los totales y gráficas ya existentes en RF-07 del MVP.
- Criterio de aceptación: se añade un bloque "Top categorías de gasto" con el ranking de las 5 categorías con mayor gasto acumulado en el año seleccionado.
- Criterio de aceptación: se añade el ratio ahorro/ingreso del año (ahorro total / ingreso total, en porcentaje).
- Criterio de aceptación: cada mes en el desglose anual muestra la variación de gasto e ingreso respecto al mes económico inmediatamente anterior (ej. "+8% gasto vs. mes anterior"), cuando exista un mes anterior con datos.
- Criterio de aceptación: se muestra el acumulado de ahorro/inversión del año como cifra destacada (ver también RF-05).

### RF-07 — Secciones diferenciadas en el listado mensual
**Cuando** el usuario consulta el listado de transacciones de un mes, **el sistema** debe agrupar las transacciones en secciones por tipo en vez de una única tabla mezclada.
- Criterio de aceptación: el listado se divide en 3 secciones visualmente diferenciadas: "Gasto", "Ahorro e inversión" (transacciones bancarias categorizadas como ahorro o inversión; no debe confundirse con la sección de entradas manuales de RF-05) y "Otros" (transacciones de tipo ingreso y transacciones sin categorizar).
- Criterio de aceptación: cada sección mantiene de forma independiente sus propios filtros (RF-08), paginación (RF-04) y acciones en lote (RF-02, RF-03).
- Criterio de aceptación: una transacción recategorizada de un tipo a otro (ej. de "sin categorizar" a "Ahorro") se mueve a la sección correspondiente tras guardar el cambio.

### RF-08 — Filtros por columna
**Cuando** el usuario consulta el listado de transacciones de un mes, **el sistema** debe permitir filtrar directamente desde cada columna de la tabla.
- Criterio de aceptación: debajo de la cabecera de la tabla hay una fila de controles de filtro: texto libre para Concepto, rango de fechas para Fecha, rango numérico para Importe, desplegable para Cuenta y desplegable jerárquico para Categoría.
- Criterio de aceptación: esta fila de filtros sustituye a los filtros genéricos situados actualmente encima de la tabla.
- Criterio de aceptación: los filtros se combinan entre sí (AND) y se aplican dentro de cada sección de RF-07 de forma independiente.
- Criterio de aceptación: aplicar cualquier filtro de columna reinicia la paginación a la primera página del resultado filtrado (mismo comportamiento que RF-04).

## Requisitos no funcionales

- **RNF-01 — Consistencia con el MVP**: estos cambios reutilizan la arquitectura, el stack y las convenciones ya definidas en `docs/constitution.md`. No se introducen frameworks nuevos.
- **RNF-02 — Rendimiento de carga incremental**: cargar un bloque adicional de 25 transacciones (RF-04) debe completarse en menos de 500ms con la base de datos local.

## Casos límite

- Excluir la única transacción de ingreso de un mes: el total de ingreso del mes pasa a 0; no debe romper el cálculo del mes económico (RF-06 del MVP), que ya se calculó antes de excluir.
- Recategorizar inline una transacción que tenía `origen_categoria = 'regla'`: pasa a `'manual'`, igual que el comportamiento ya definido en RF-05 del MVP.
- Añadir una entrada manual de ahorro con importe negativo mayor que el acumulado: se permite; el sistema no valida saldos, solo registra el movimiento.
- Aplicar un filtro cuando ya se han cargado varias páginas con "Mostrar más": la vista se reinicia a la primera página del nuevo resultado filtrado (criterio ya cubierto en RF-04).
- Mes económico sin ninguna transacción de gasto o ingreso pero con entradas manuales de ahorro: el mes deja de considerarse "vacío" a efectos de RF-10 del MVP si tiene al menos una entrada manual.
- Comparativa mes vs. mes anterior en el primer mes económico con datos (no hay mes anterior): no se muestra variación, se indica "sin datos previos" en vez de un porcentaje.
- Guardar cambios pendientes cuando una de las filas modificadas fue excluida mientras tanto por otra acción: se guarda igualmente su nueva categoría; exclusión y categorización son estados independientes (ya cubierto por RF-03).
- Pulsar "Guardar cambios" sin ninguna edición pendiente: el botón no debe ser visible/activo en ese estado (no hay nada que guardar).
- Recategorizar una transacción hacia o desde "Ahorro"/"Inversión" mientras hay cambios pendientes sin guardar en otras filas: cada fila se guarda de forma independiente al confirmar el lote; no se bloquea el movimiento entre secciones de RF-07.
- Aplicar un filtro de columna que no devuelve resultados en una sección: la sección muestra su estado vacío sin afectar a las demás secciones.

## Fuera de alcance

- Rediseño visual completo (tema oscuro, tipografías, paleta moderna) — spec `003` independiente.
- Vincular una entrada manual de ahorro a una transacción bancaria concreta.
- Detección automática de préstamos o movimientos atípicos para sugerir exclusión.
- Eliminación permanente de transacciones (solo exclusión reversible).
- Edición de campos de la transacción bancaria en sí (fecha, importe, concepto) — solo categoría y estado de exclusión.
- Presupuestos, alertas o proyecciones (ya fuera de alcance en el MVP).

## Criterios de finalización

Esta iteración se considera terminada cuando:
1. La vista mensual muestra la cabecera compacta de tarjetas (RF-01) en vez del bloque de gráficas grande actual.
2. Se puede categorizar y excluir una transacción directamente desde su fila en la tabla (RF-02, RF-03), y los totales reflejan la exclusión.
3. Se pueden categorizar varias filas con valores distintos y guardarlas juntas con un botón, y excluir/incluir varias transacciones seleccionadas a la vez (RF-02, RF-03 ampliados).
4. El listado mensual carga de forma incremental con "Mostrar más" (RF-04), y está dividido en las 3 secciones de RF-07.
5. Existe una sección de ahorro/inversión manual por mes gestionada desde un modal (crear y editar), y su acumulado aparece en el dashboard anual (RF-05).
6. El dashboard anual muestra top categorías de gasto, ratio ahorro/ingreso, comparativa mes vs. anterior y acumulado de ahorro/inversión (RF-06).
7. La tabla de transacciones tiene filtros por columna (RF-08), sustituyendo a los filtros genéricos previos.
8. Todos los tests pasan al 100%.

## Dudas abiertas

Sin dudas abiertas. Todas las decisiones de producto (exclusión reversible y visible, coexistencia de reglas y entradas manuales sin vínculo, paginación por botón, contenido ampliado del dashboard, guardado en lote con cambios pendientes, secciones Gasto/Ahorro+Inversión/Otros, modal único para ahorro manual, filtros por columna) fueron confirmadas por el usuario.
