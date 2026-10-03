# 002 — Homics: Mejoras de uso diario — Plan de implementación

Este plan extiende la implementación de `001-homics-mvp`. No se reescribe ningún módulo desde cero: se modifican funciones existentes y se añaden ficheros nuevos allí donde la spec 002 lo requiere. Cada sección indica si el fichero es **nuevo** o **modificado**.

## 1. Estructura de módulos

```
migrations/
└── 004_exclusion_y_ahorro_manual.sql   # NUEVO — columna excluida + tabla ahorro_manual [RF-03, RF-05]

src/core/
├── servicios/
│   ├── transacciones.js                # MODIFICADO — paginación, exclusión [RF-03, RF-04]
│   ├── dashboard.js                    # MODIFICADO — excluir de totales, ahorro manual, top gasto, ratio, comparativa [RF-01, RF-05, RF-06]
│   └── ahorroManual.js                 # NUEVO — CRUD entradas manuales de ahorro/inversión [RF-05]
└── rutas.js                            # MODIFICADO — nuevos endpoints y parámetros [todos los RF]

src/ui/
├── componentes/
│   └── tabla.js                        # MODIFICADO — desplegable inline, botón excluir, fila atenuada [RF-02, RF-03]
├── vistas/
│   ├── mensual.js                      # MODIFICADO — cabecera compacta, sección ahorro manual, "mostrar más" [RF-01, RF-04, RF-05]
│   └── dashboard.js                    # MODIFICADO — top gasto, ratio, comparativa, acumulado ahorro [RF-06]
└── estilos.css                         # MODIFICADO — fila excluida, select inline, botón "mostrar más", tarjetas nuevas [RF-01, RF-03]

tests/
├── db.test.js                          # MODIFICADO — verifica migración 004
├── servicios/
│   ├── transacciones.test.js           # MODIFICADO — exclusión, paginación
│   ├── dashboard.test.js               # MODIFICADO — excluidas fuera de totales, ahorro manual sumado, top gasto, ratio, comparativa
│   └── ahorroManual.test.js            # NUEVO — CRUD entradas manuales
```

## 2. Modelo de datos

### Migración `004_exclusion_y_ahorro_manual.sql`

```sql
-- Exclusión reversible de transacciones [RF-03]
ALTER TABLE transacciones ADD COLUMN excluida INTEGER NOT NULL DEFAULT 0;

-- Entradas manuales de ahorro/inversión, independientes de transacciones bancarias [RF-05]
CREATE TABLE ahorro_manual (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    mes_economico_id  INTEGER NOT NULL REFERENCES meses_economicos(id),
    fecha             TEXT NOT NULL,           -- 'YYYY-MM-DD'
    importe           REAL NOT NULL,           -- puede ser negativo (reintegro)
    tipo              TEXT NOT NULL,           -- 'ahorro' | 'inversion'
    nota              TEXT,
    creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Decisión de diseño (confirmada con el usuario):** `ahorro_manual` no tiene FK a `transacciones`. Es una fuente de datos independiente; el total de ahorro/inversión de un mes suma transacciones bancarias categorizadas (vía reglas o manual, ya soportado en el MVP) **más** estas entradas. Evitar duplicados es responsabilidad del usuario — no se implementa detección de solapamiento.

**Alternativa descartada:** guardar `excluida` en una tabla aparte (`transacciones_excluidas`) en vez de una columna. Se descarta porque duplicaría el patrón ya existente en `transacciones` (`aviso_divisa` ya es un flag booleano en la misma tabla) y complicaría todas las queries de agregados con un JOIN/NOT EXISTS adicional sin beneficio real, dado que la exclusión es un atributo intrínseco de la transacción, no una entidad propia.

### Datos de ejemplo

```sql
-- Transacción excluida (préstamo del coche, Junio 2026)
UPDATE transacciones SET excluida = 1 WHERE id = 42;

-- Entrada manual de ahorro
INSERT INTO ahorro_manual (mes_economico_id, fecha, importe, tipo, nota)
VALUES (7, '2026-06-15', 300.00, 'ahorro', 'Aportación extra fuera de la transferencia habitual');
```

## 3. Algoritmos en pseudocódigo

### 3.1 Exclusión de transacción [RF-03]

```
FUNCIÓN alternarExclusion(db, transaccionId, excluida):
    UPDATE transacciones SET excluida = excluida ? 1 : 0 WHERE id = transaccionId
    RETORNAR transacción actualizada
```

### 3.2 Cálculo de totales excluyendo transacciones marcadas [RF-01, RF-03, RF-06]

```
FUNCIÓN calcularTotales(transacciones):
    // Ya existe; solo cambia la query que alimenta esta función:
    // WHERE t.mes_economico_id = ? AND t.importe != 0 AND t.excluida = 0
    ... (lógica de suma por tipo sin cambios)
```

### 3.3 Acumulado de ahorro/inversión: reglas + manual [RF-05]

```
FUNCIÓN calcularAhorroEInversion(db, mesId):
    txAhorro = SELECT sum(importe) FROM transacciones
               WHERE mes_economico_id = mesId AND excluida = 0
                 AND categoria pertenece a tipo 'ahorro'
    txInversion = SELECT sum(importe) FROM transacciones
                  WHERE mes_economico_id = mesId AND excluida = 0
                    AND categoria pertenece a tipo 'inversión'

    manualAhorro = SELECT sum(importe) FROM ahorro_manual
                   WHERE mes_economico_id = mesId AND tipo = 'ahorro'
    manualInversion = SELECT sum(importe) FROM ahorro_manual
                      WHERE mes_economico_id = mesId AND tipo = 'inversion'

    RETORNAR {
        ahorro: (txAhorro ?? 0) + (manualAhorro ?? 0),
        inversion: (txInversion ?? 0) + (manualInversion ?? 0)
    }
```

### 3.4 Top categorías de gasto del año [RF-06]

```
FUNCIÓN topCategoriasGasto(db, anio, limite = 5):
    categorias = SELECT c.nombre, sum(t.importe) AS total
                 FROM transacciones t
                 JOIN categorias c ON t.categoria_id = c.id
                 JOIN grupos g ON c.grupo_id = g.id
                 JOIN tipos ti ON g.tipo_id = ti.id
                 JOIN meses_economicos m ON t.mes_economico_id = m.id
                 WHERE ti.nombre = 'gasto' AND t.excluida = 0
                   AND m.nombre termina en anio
                 GROUP BY c.id
                 ORDER BY total ASC   -- más negativo primero (más gasto)
                 LIMIT limite
    RETORNAR categorias
```

### 3.5 Ratio ahorro/ingreso [RF-06]

```
FUNCIÓN ratioAhorroIngreso(totalAhorro, totalIngreso):
    SI totalIngreso == 0 → RETORNAR null
    RETORNAR redondear((totalAhorro / totalIngreso) * 100, 1)
```

### 3.6 Comparativa mes vs. mes anterior [RF-06]

```
FUNCIÓN calcularComparativas(mesesOrdenadosPorFecha):
    PARA i = 0 HASTA meses.longitud - 1:
        SI i == 0:
            meses[i].comparativa = null  // "sin datos previos"
        SINO:
            anterior = meses[i - 1].totales
            actual = meses[i].totales
            meses[i].comparativa = {
                gasto: variacionPorcentual(actual.gasto, anterior.gasto),
                ingreso: variacionPorcentual(actual.ingreso, anterior.ingreso)
            }
    RETORNAR meses

FUNCIÓN variacionPorcentual(actual, anterior):
    SI anterior == 0 → RETORNAR null
    RETORNAR redondear(((actual - anterior) / abs(anterior)) * 100, 1)
```

### 3.7 Paginación del listado mensual [RF-04]

```
FUNCIÓN obtenerTransacciones(db, filtros, { limit = 25, offset = 0 }):
    // Misma query de filtros ya existente, añadiendo:
    // ORDER BY t.fecha_operacion ASC, t.id ASC
    // LIMIT limit OFFSET offset
    total = SELECT count(*) FROM transacciones WHERE <mismos filtros, sin LIMIT>
    RETORNAR { transacciones, total, hayMas: offset + transacciones.longitud < total }
```

## 4. Contrato de la API HTTP (nuevo y modificado)

### 4.1 Transacciones — modificados [RF-02, RF-03, RF-04]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/transacciones?mes_id=&categoria_id=&cuenta_id=&importe_min=&importe_max=&limit=&offset=` | — | `{ transacciones: [...incl. excluida], total: N, hayMas: bool }` | 400 parámetros inválidos |
| PATCH | `/api/transacciones/categorizar` | `{ ids: [1], categoria_id: 5 }` | `{ actualizadas: N }` | *(sin cambios — reutilizado para categorización inline con `ids: [id]`)* |
| PATCH | `/api/transacciones/:id/excluir` | `{ excluida: true }` | `{ id, excluida }` | 404 no existe |

### 4.2 Ahorro manual — nuevo [RF-05]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/ahorro-manual?mes_id=` | — | `{ entradas: [{ id, fecha, importe, tipo, nota }] }` | — |
| POST | `/api/ahorro-manual` | `{ mes_economico_id, fecha, importe, tipo, nota }` | `201 { id, ... }` | 400 validación (tipo inválido, mes no existe) |
| PUT | `/api/ahorro-manual/:id` | `{ fecha, importe, tipo, nota }` | `{ id, ... }` | 404 no existe |
| DELETE | `/api/ahorro-manual/:id` | — | `204` | 404 no existe |

### 4.3 Dashboard — respuesta ampliada [RF-01, RF-06]

| Método | Ruta | Cambios en la respuesta |
|--------|------|--------------------------|
| GET | `/api/dashboard/anual?anio=` | Añade `top_categorias_gasto: [{ nombre, total }]`, `ratio_ahorro_ingreso: N\|null`, `acumulado_ahorro: N`, `acumulado_inversion: N`. Cada mes en `meses[]` añade `comparativa: { gasto, ingreso } \| null`. |
| GET | `/api/dashboard/mensual/:mes_id` | Añade `ratio_ahorro_ingreso: N\|null`. Los totales `ahorro` e `inversion` ya incluyen entradas manuales (RF-05). |

## 5. Decisiones técnicas justificadas

### 5.1 Confirmación de categorización inline

**Elegido: botón "✓" por fila, visible solo cuando el valor del `<select>` cambia respecto al original.**
Evita el guardado accidental al hacer clic fuera del desplegable (blur) y no añade estado de "modo edición" complejo. Reutiliza el endpoint `PATCH /api/transacciones/categorizar` ya existente con un array de un solo id — cero endpoints nuevos para esta parte.

**Descartado: guardar automáticamente en el evento `change` del select.**
Un clic accidental o una navegación por teclado dispararía escrituras no deseadas sin posibilidad de cancelar.

> [RF-02]

### 5.2 Paginación: "Mostrar más" con acumulación en cliente

**Elegido: cada clic en "Mostrar más" pide la siguiente página (`offset += 25`) y añade filas al `<tbody>` existente**, sin sustituir la tabla completa.
Conserva la posición de scroll y el estado de los desplegables ya abiertos en filas previas. Consistente con la decisión ya tomada en la spec.

**Descartado: recargar toda la tabla con `limit` creciente en cada clic.**
Más simple de programar pero repite trabajo de red y de renderizado innecesariamente a partir de listados largos.

> [RF-04, RNF-02]

### 5.3 Almacenamiento de exclusión como columna vs. tabla aparte

Ver §2 — columna `excluida` en `transacciones`, consistente con el patrón ya usado por `aviso_divisa`.

> [RF-03, §5 constitución]

## 6. Estrategia de tests

Framework: `node:test` (sin cambios respecto al MVP).

### 6.1 Base de datos [§5]

**`tests/db.test.js`** — añadir:
- Migración 004 añade columna `excluida` a `transacciones` con valor por defecto 0.
- Migración 004 crea tabla `ahorro_manual` con sus columnas.

### 6.2 Servicio de transacciones [RF-02, RF-03, RF-04]

**`tests/servicios/transacciones.test.js`** — añadir:
- Excluir una transacción marca `excluida = 1`; incluirla de nuevo la vuelve a `0`.
- `obtenerTransacciones` con `limit`/`offset` devuelve la página correcta y `hayMas` calculado bien.
- Una transacción excluida sigue apareciendo en `obtenerTransacciones` (no se filtra del listado, solo de los totales).
- Categorizar una transacción excluida no cambia su estado de exclusión.

### 6.3 Servicio de dashboard [RF-01, RF-05, RF-06]

**`tests/servicios/dashboard.test.js`** — añadir:
- Una transacción excluida no se cuenta en `totales` del dashboard mensual ni anual.
- El ahorro/inversión de un mes suma transacciones categorizadas + entradas de `ahorro_manual` del mismo mes.
- `topCategoriasGasto` devuelve máximo 5 categorías ordenadas por gasto descendente.
- `ratioAhorroIngreso` calcula el porcentaje correcto; devuelve `null` si el ingreso es 0.
- La comparativa del primer mes con datos es `null`; el segundo mes calcula variación correcta respecto al primero.
- El acumulado anual de ahorro/inversión suma todos los meses del año (transacciones + manual).

### 6.4 Servicio de ahorro manual [RF-05]

**`tests/servicios/ahorroManual.test.js`** (nuevo):
- Crear entrada manual de ahorro asociada a un mes económico.
- Crear entrada manual de inversión.
- Editar una entrada existente (cambiar importe/nota).
- Eliminar una entrada.
- Listar entradas filtradas por mes.
- Crear entrada con `tipo` inválido (ni "ahorro" ni "inversion") lanza error de validación.
- Crear entrada con `mes_economico_id` inexistente lanza error.

## 6-bis. Ampliación tras revisión del usuario (RF-02/03 lote, RF-05 modal, RF-07, RF-08)

Esta sección documenta el diseño técnico de los 5 cambios pedidos tras revisar la app funcionando. Se integra en las fases existentes como una nueva **Fase 6**.

### Estructura de módulos (ampliación)

```
src/core/
├── servicios/
│   └── transacciones.js          # MODIFICADO — filtro por tipo, concepto (texto), rango de fechas; exclusión en lote [RF-03, RF-07, RF-08]
└── rutas.js                      # MODIFICADO — nuevos parámetros en GET /transacciones, nuevo PATCH /transacciones/excluir [RF-03, RF-07, RF-08]

src/ui/
├── componentes/
│   ├── modal.js                  # NUEVO — overlay genérico reutilizable (abrir/cerrar, cierre con Escape/click fuera) [RF-05]
│   └── tabla.js                  # MODIFICADO — cambios de categoría quedan "pendientes" (ya no se guardan al confirmar fila a fila) [RF-02]
└── vistas/
    ├── seccionTransacciones.js   # NUEVO — una sección completa (filtros por columna + tabla + paginación + lote), parametrizada por tipo [RF-07, RF-08]
    └── mensual.js                 # MODIFICADO — instancia 3 secciones (Gasto / Ahorro+Inversión / Otros), modal de ahorro manual [RF-05, RF-07]
```

**Decisión de diseño:** se extrae `seccionTransacciones.js` como módulo propio en vez de triplicar la lógica de tabla+filtros+paginación dentro de `mensual.js`. Cada sección (Gasto, Ahorro+Inversión, Otros) es una instancia independiente de esta función con su propio estado de filtros, página y selección — ninguna comparte estado con las demás, tal como exige RF-07.

### Modelo de datos

Sin cambios de esquema. Los filtros nuevos (`tipo`, `concepto`, `fecha_desde`, `fecha_hasta`) operan sobre columnas y relaciones ya existentes.

### Algoritmos en pseudocódigo

#### Filtro por tipo/concepto/fechas en `obtenerTransacciones` [RF-07, RF-08]

```
FUNCIÓN obtenerTransacciones(db, filtros, paginacion):
    // Añadir JOIN hasta tipos (antes solo llegaba a grupos):
    // LEFT JOIN tipos ti ON g.tipo_id = ti.id

    SI filtros.tipo == 'gasto':
        condicion += "ti.nombre = 'gasto'"
    SI filtros.tipo == 'ahorro_inversion':
        condicion += "ti.nombre IN ('ahorro', 'inversión')"
    SI filtros.tipo == 'otros':
        condicion += "(ti.nombre = 'ingreso' OR t.categoria_id IS NULL)"

    SI filtros.concepto:
        condicion += "lower(t.concepto) LIKE '%' || lower(filtros.concepto) || '%'"
    SI filtros.fecha_desde:
        condicion += "t.fecha_operacion >= filtros.fecha_desde"
    SI filtros.fecha_hasta:
        condicion += "t.fecha_operacion <= filtros.fecha_hasta"

    // Resto igual que antes (limit/offset/total/hayMas)
```

#### Exclusión en lote [RF-03]

```
FUNCIÓN excluirEnLote(db, ids, excluida):
    actualizadas = 0
    PARA CADA id EN ids:
        ejecutar(db, "UPDATE transacciones SET excluida = ? WHERE id = ?", [excluida, id])
        actualizadas += 1
    RETORNAR { actualizadas }
```

#### Guardado en lote de categorización con valores distintos por fila [RF-02]

```
// Cliente (tabla.js): cada fila con cambio de categoría se marca "pendiente"
// en memoria (Map id → categoria_id), NO se llama a la API al pulsar "✓".
// El botón "✓" por fila pasa a significar "marcar como pendiente", no "guardar".

FUNCIÓN guardarCambiosPendientes(pendientes):  // mensual.js / seccionTransacciones.js
    PARA CADA [id, categoriaId] EN pendientes:
        PATCH /api/transacciones/categorizar { ids: [id], categoria_id: categoriaId }
    limpiar mapa de pendientes
    recargar sección
```

### Contrato de la API HTTP (ampliación)

| Método | Ruta | Cambios |
|--------|------|---------|
| GET | `/api/transacciones?...&tipo=&concepto=&fecha_desde=&fecha_hasta=` | Nuevos parámetros de filtro: `tipo` (`gasto`\|`ahorro_inversion`\|`otros`), `concepto` (texto, subcadena), `fecha_desde`/`fecha_hasta` (rango) |
| PATCH | `/api/transacciones/excluir` | **Nuevo.** Cuerpo `{ ids: [1,2,3], excluida: true }` → `{ actualizadas: N }`. Excluye/incluye varias transacciones en una sola petición. |

**`PATCH /api/transacciones/categorizar` no cambia** — el guardado en lote con categorías distintas por fila reutiliza este mismo endpoint con una petición por fila modificada (ver decisión técnica más abajo), no se crea un endpoint de guardado masivo con pares `{id, categoria_id}` distintos.

### Decisiones técnicas justificadas (ampliación)

#### Guardado en lote de categorización: N peticiones individuales vs. endpoint de lote heterogéneo

**Elegido: reutilizar `PATCH /transacciones/categorizar` con una petición por fila modificada.**
Cada fila puede llevar una categoría distinta, así que no se puede expresar en una sola llamada al endpoint actual (que asigna **una** categoría a **varios** ids). Crear un endpoint nuevo que acepte pares `{id, categoria_id}` heterogéneos añadiría una ruta y una función de servicio nuevas para un volumen de datos pequeño (como mucho ~25, el tamaño de página).

**Descartado: endpoint `PATCH /transacciones/categorizar-lote` con array de pares `{id, categoria_id}`.**
Más eficiente en una red lenta, pero viola el principio de dependencias/complejidad mínima para un beneficio marginal dado el volumen real (decenas de filas, red local).

> [RF-02, §1 constitución]

#### Exclusión en lote: sí se crea endpoint de lote

**Elegido: `PATCH /transacciones/excluir` nuevo, aceptando `{ ids, excluida }`.**
A diferencia de la categorización, aquí **todas** las filas seleccionadas reciben el **mismo** valor (excluir o incluir), igual que ya ocurre con `categorizar` (una categoría para varios ids). Es el mismo patrón ya existente, solo que para el campo `excluida`.

**Descartado: N peticiones a `PATCH /transacciones/:id/excluir`.**
Rompería la consistencia con el patrón ya usado para categorización en lote, sin ninguna ventaja al ser un caso igual de homogéneo.

> [RF-03]

#### Modal genérico vs. modal específico de ahorro manual

**Elegido: componente `modal.js` genérico** (recibe un nodo DOM de contenido y lo muestra en overlay), reutilizado por el formulario de ahorro manual (crear y editar con el mismo modal).
Evita construir un modal ad-hoc ligado a los campos de ahorro; cualquier formulario corto futuro puede reutilizarlo.

**Descartado: modal específico embebido en `mensual.js`.**
Acoplaría la mecánica de apertura/cierre (overlay, Escape, click fuera) a un caso de uso concreto, dificultando su reutilización.

> [RF-05]

#### Secciones por tipo: filtrado en servidor vs. filtrado en cliente

**Elegido: el servidor filtra por `tipo` vía SQL** (nuevo parámetro en `obtenerTransacciones`), cada sección hace su propia petición paginada.
Consistente con cómo ya funciona la paginación (RF-04): cada sección pagina sobre su propio subconjunto real, no sobre una lista completa descargada y filtrada en el cliente.

**Descartado: traer todas las transacciones del mes una vez y repartirlas en 3 arrays en el cliente.**
Rompería la paginación por sección (RF-07 exige paginación independiente por sección) y obligaría a traer todo el mes de golpe, contradiciendo RF-04.

> [RF-07, RF-08, RNF-02]

### Estrategia de tests (ampliación)

**`tests/servicios/transacciones.test.js`** — añadir:
- `obtenerTransacciones` con `filtros.tipo = 'gasto'` devuelve solo transacciones de categorías de tipo gasto.
- `filtros.tipo = 'ahorro_inversion'` devuelve transacciones de ahorro **e** inversión juntas.
- `filtros.tipo = 'otros'` devuelve transacciones de ingreso **y** sin categorizar.
- `filtros.concepto` filtra por subcadena case-insensitive del concepto.
- `filtros.fecha_desde`/`fecha_hasta` filtran por rango de fecha de operación.
- Nueva función `excluirEnLote`: excluye varias transacciones de una vez; incluye varias de una vez.

## 7. Orden de implementación

### Fase 1 — Exclusión y paginación (backend)
- `migrations/004_exclusion_y_ahorro_manual.sql`
- `src/core/servicios/transacciones.js`: función de alternar exclusión, paginación en `obtenerTransacciones`
- `src/core/servicios/dashboard.js`: excluir `excluida = 1` de las queries de totales
- Endpoints: `PATCH /api/transacciones/:id/excluir`, `GET /api/transacciones` con `limit`/`offset`
- Tests: `db.test.js`, `transacciones.test.js` (exclusión + paginación), `dashboard.test.js` (exclusión fuera de totales)

**Entregable verificable:** vía curl, excluir una transacción y comprobar que desaparece de los totales del dashboard mensual pero sigue en `GET /api/transacciones`. Pedir `?limit=25&offset=25` devuelve la segunda página.

**Cubre:** RF-03, RF-04 (backend)

### Fase 2 — Categorización inline y exclusión (frontend)
- `src/ui/componentes/tabla.js`: desplegable de categoría por fila + botón confirmar, botón excluir/incluir, clase visual para filas excluidas
- `src/ui/vistas/mensual.js`: cablear "Mostrar más", cablear categorización inline (reutiliza `PATCH /transacciones/categorizar`), cablear exclusión
- `src/ui/estilos.css`: estilos de fila excluida, select inline, botón "Mostrar más"

**Entregable verificable:** desde el navegador, cambiar la categoría de una fila y confirmar sin recargar la página; excluir una transacción y verla atenuada; pulsar "Mostrar más" y ver más filas sin perder el scroll.

**Cubre:** RF-02, RF-03, RF-04 (frontend)

### Fase 3 — Ahorro manual y cabecera compacta
- `src/core/servicios/ahorroManual.js`: CRUD completo
- Endpoints: `GET/POST/PUT/DELETE /api/ahorro-manual`
- `src/core/servicios/dashboard.js`: sumar `ahorro_manual` a los totales de ahorro/inversión
- `src/ui/vistas/mensual.js`: nueva cabecera compacta de tarjetas (sustituye el bloque de gráficas grande), sección "Ahorro e inversión" con formulario CRUD
- Tests: `ahorroManual.test.js`, `dashboard.test.js` (suma ahorro manual)

**Entregable verificable:** añadir una entrada manual de ahorro desde el navegador y ver cómo el total de ahorro de la cabecera mensual se actualiza. La cabecera ya no muestra el gráfico grande anterior.

**Cubre:** RF-01, RF-05

### Fase 4 — Dashboard anual ampliado
- `src/core/servicios/dashboard.js`: `topCategoriasGasto`, `ratioAhorroIngreso`, `calcularComparativas`, acumulado anual
- `src/ui/vistas/dashboard.js`: bloque top 5 categorías de gasto, tarjeta de ratio ahorro/ingreso, indicador de variación por mes, tarjeta de acumulado ahorro/inversión anual
- Tests: `dashboard.test.js` (top gasto, ratio, comparativa, acumulado)

**Entregable verificable:** el dashboard anual muestra las 5 categorías con más gasto del año, el ratio ahorro/ingreso, la variación de cada mes respecto al anterior, y el acumulado de ahorro/inversión del año.

**Cubre:** RF-06

### Fase 5 — Pulido y validación final
- Verificar los 6 casos límite de la spec 002.
- `npm test` pasa al 100%.
- Prueba end-to-end manual: excluir una transacción real (ej. el préstamo de coche del extracto oficial), añadir una entrada de ahorro manual, verificar que el dashboard anual y mensual reflejan ambos cambios correctamente.

**Cubre:** todos los RF de 002 (versión original, antes de la ampliación tras revisión)

### Fase 6 — Ampliación tras revisión: lote, secciones, modal, filtros por columna

- `src/core/servicios/transacciones.js`: filtros `tipo`, `concepto`, `fecha_desde`/`fecha_hasta`; función `excluirEnLote`
- Endpoints: `GET /transacciones` con parámetros nuevos, `PATCH /transacciones/excluir` nuevo
- `src/ui/componentes/modal.js`: componente genérico nuevo
- `src/ui/componentes/tabla.js`: cambios de categoría pasan a estado "pendiente" en vez de guardar al confirmar fila a fila; exponer función para leer los pendientes
- `src/ui/vistas/seccionTransacciones.js`: nueva sección autocontenida (filtros por columna + tabla + paginación + lote), parametrizada por `tipo`
- `src/ui/vistas/mensual.js`: instanciar 3 secciones (Gasto / Ahorro+Inversión / Otros); sustituir el formulario de ahorro manual inline por modal (crear y editar)
- Tests: `transacciones.test.js` (filtro por tipo, concepto, fechas; `excluirEnLote`)

**Entregable verificable:** desde el navegador, cambiar la categoría de 3 filas distintas a categorías diferentes, pulsar "Guardar cambios" una vez y ver las 3 persistidas; seleccionar varias transacciones y excluirlas con un solo clic; ver el listado mensual dividido en 3 secciones con filtros propios por columna; añadir y editar una entrada de ahorro manual desde un modal.

**Cubre:** RF-02, RF-03, RF-05, RF-07, RF-08 (criterios ampliados)
