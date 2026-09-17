# 001 — Homics MVP: Plan de implementación

## 1. Estructura de módulos

```
src/
├── core/                          # Backend Node — lógica de negocio + API
│   ├── servidor.js                # Arranque, sirve estáticos y monta rutas API [RNF-01]
│   ├── rutas.js                   # Definición de endpoints HTTP, despacho a controladores [todos los RF]
│   ├── db.js                      # Conexión better-sqlite3, helpers de consulta [§5 constitución]
│   ├── parsers/
│   │   ├── bbva.js                # Parseo XLSX estándar de BBVA [RF-01]
│   │   └── openbank.js            # Parseo HTML-como-XLSX de Openbank [RF-01]
│   ├── servicios/
│   │   ├── extractos.js           # Orquesta carga, parseo, duplicados, asignación mes [RF-01, RF-02, RF-06]
│   │   ├── categorias.js          # CRUD tipo/grupo/categoría, validación de borrado [RF-03]
│   │   ├── reglas.js              # CRUD reglas, aplicación automática, resolución conflictos [RF-04]
│   │   ├── transacciones.js       # Consulta, categorización manual, filtros [RF-05, RF-08, RF-09]
│   │   ├── mesEconomico.js        # Detección de cortes, asignación, corte manual [RF-06]
│   │   └── dashboard.js           # Agregados anuales por tipo/grupo/categoría [RF-07, RF-10]
│   └── semilla.js                 # Inserta tipos, grupos y categorías iniciales [RF-03]
│
├── ui/                            # Frontend — solo presentación [§3 constitución]
│   ├── index.html                 # SPA: contenedor principal, navegación
│   ├── estilos.css                # Estilos globales
│   ├── app.js                     # Enrutador cliente, inicialización
│   ├── api.js                     # Wrapper fetch para comunicación con backend
│   ├── vistas/
│   │   ├── dashboard.js           # Vista dashboard anual [RF-07, RF-10]
│   │   ├── mensual.js             # Vista mes económico: cabecera + listado [RF-08]
│   │   ├── carga.js               # Formulario subida de extractos [RF-01]
│   │   ├── categorias.js          # Gestión categorías y grupos [RF-03]
│   │   └── reglas.js              # Gestión reglas de categorización [RF-04]
│   └── componentes/
│       ├── graficas.js            # Renderizado de gráficas [RF-07, RF-08, RNF-03]
│       ├── tabla.js               # Tabla de transacciones con filtros [RF-08]
│       └── selector.js            # Selector de categoría reutilizable [RF-05]
│
tests/
├── parsers/
│   ├── bbva.test.js               # Tests parseo BBVA [RF-01]
│   └── openbank.test.js           # Tests parseo Openbank [RF-01]
├── servicios/
│   ├── extractos.test.js          # Tests carga + duplicados [RF-01, RF-02]
│   ├── categorias.test.js         # Tests CRUD categorías [RF-03]
│   ├── reglas.test.js             # Tests reglas + conflictos [RF-04]
│   ├── transacciones.test.js      # Tests categorización manual [RF-05]
│   ├── mesEconomico.test.js       # Tests detección de cortes [RF-06]
│   └── dashboard.test.js          # Tests agregados [RF-07]
└── db.test.js                     # Tests conexión y migraciones [§5]

migrations/
├── 001_tablas_base.sql            # cuentas, tipos, grupos, categorías, transacciones
├── 002_reglas.sql                 # reglas de categorización
└── 003_meses_economicos.sql       # meses económicos y cortes
```

## 2. Modelo de datos SQL

### Esquema

```sql
-- Cuentas bancarias conocidas
CREATE TABLE cuentas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL UNIQUE,  -- 'BBVA', 'Openbank'
    formato     TEXT NOT NULL          -- 'xlsx_bbva', 'html_openbank'
);

-- Tipos fijos (no editables)
CREATE TABLE tipos (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE  -- 'gasto', 'ingreso', 'ahorro', 'inversión'
);

-- Grupos (editables, pertenecen a un tipo)
CREATE TABLE grupos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL,
    tipo_id INTEGER NOT NULL REFERENCES tipos(id),
    UNIQUE(nombre, tipo_id)
);

-- Categorías (editables, pertenecen a un grupo)
CREATE TABLE categorias (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos(id),
    UNIQUE(nombre, grupo_id)
);

-- Transacciones importadas
CREATE TABLE transacciones (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_valor       TEXT NOT NULL,      -- 'YYYY-MM-DD'
    fecha_operacion   TEXT NOT NULL,      -- 'YYYY-MM-DD'
    concepto          TEXT NOT NULL,
    importe           REAL NOT NULL,      -- negativo = cargo, positivo = abono
    saldo_resultante  REAL NOT NULL,
    divisa            TEXT NOT NULL DEFAULT 'EUR',
    cuenta_id         INTEGER NOT NULL REFERENCES cuentas(id),
    categoria_id      INTEGER REFERENCES categorias(id),  -- NULL = sin categorizar
    origen_categoria  TEXT DEFAULT NULL,  -- 'regla', 'manual', NULL
    mes_economico_id  INTEGER REFERENCES meses_economicos(id),
    aviso_divisa      INTEGER NOT NULL DEFAULT 0,  -- 1 si divisa != EUR
    creado_en         TEXT NOT NULL DEFAULT (datetime('now')),
    -- Clave de duplicado
    UNIQUE(fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
);

-- Reglas de categorización determinista
CREATE TABLE reglas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patron       TEXT NOT NULL UNIQUE,    -- subcadena, se compara case-insensitive
    categoria_id INTEGER NOT NULL REFERENCES categorias(id)
);

-- Meses económicos
CREATE TABLE meses_economicos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre         TEXT NOT NULL,          -- 'Marzo 2026', 'Febrero 2026'
    fecha_inicio   TEXT NOT NULL,          -- 'YYYY-MM-DD' día del corte
    fecha_fin      TEXT,                   -- 'YYYY-MM-DD' día anterior al siguiente corte (NULL = abierto)
    corte_manual   INTEGER NOT NULL DEFAULT 0  -- 1 si fue definido manualmente
);
```

### Datos de ejemplo

```sql
-- Cuentas
INSERT INTO cuentas (id, nombre, formato) VALUES
(1, 'BBVA',     'xlsx_bbva'),
(2, 'Openbank', 'html_openbank');

-- Mes económico
INSERT INTO meses_economicos (id, nombre, fecha_inicio, fecha_fin) VALUES
(1, 'Marzo 2026', '2026-02-26', '2026-03-25');

-- Transacciones (datos reales de los extractos)
INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id, categoria_id, origen_categoria, mes_economico_id) VALUES
('2026-02-26', '2026-02-27', 'Traspaso desde cuenta',          1200.00, 1214.53, 1, 3,    'regla',  1),  -- Ingreso > Transferencia cuenta común
('2026-02-28', '2026-03-02', 'Transferencia recibida',          350.00, 1494.90, 1, 3,    'regla',  1),  -- Ingreso > Transferencia cuenta común
('2026-03-02', '2026-03-02', 'Frutas y verduras yaneka',        -22.55, 1352.69, 1, 12,   'regla',  1),  -- Gasto > Alimentación > Frutería/Mercado
('2026-03-05', '2026-03-05', 'Adeudo de comunidad de propiet.', -100.00, 1053.91, 1, NULL,  NULL,    1),  -- Sin categorizar
('2026-02-26', '2026-02-26', 'Transferencia inmediata de Jaime', 500.00, 24500.03, 2, 19,  'regla',  1), -- Ahorro > Ahorro mensual común
('2026-03-06', '2026-03-06', 'Transferencia inmediata a favor', -1000.00, 24000.03, 2, 22, 'regla',  1); -- Inversión > Fondo de inversión
```

## 3. Algoritmos en pseudocódigo

### 3.1 Parseo XLSX de BBVA [RF-01]

```
FUNCIÓN parsearBBVA(buffer):
    libro = xlsx.read(buffer)
    hoja = libro.hojas[0]
    filas = hoja.toJSON()

    // Saltar 4 filas de metadatos, fila 5 = cabecera
    cabecera = filas[4]
    VERIFICAR que cabecera contiene ['F.Valor', 'Fecha', 'Concepto', ...]
    SI NO → lanzar ErrorFormato("Cabecera BBVA no reconocida")

    transacciones = []
    PARA CADA fila EN filas[5..fin]:
        SI fila está vacía → CONTINUAR
        transacciones.añadir({
            fechaValor:      parsearFechaDDMMYYYY(fila[0]),   // F.Valor
            fechaOperacion:  parsearFechaDDMMYYYY(fila[1]),   // Fecha
            concepto:        fila[2],                          // Concepto
            movimiento:      fila[3],                          // Movimiento (informativo)
            importe:         fila[4],                          // número directo
            divisa:          fila[5],                          // 'EUR'
            saldoResultante: fila[7],                          // Disponible
        })

    SI transacciones.longitud == 0 → lanzar ErrorFormato("Extracto vacío")
    RETORNAR transacciones
```

### 3.2 Parseo HTML/XLSX de Openbank [RF-01]

```
FUNCIÓN parsearOpenbank(buffer):
    html = decodificar(buffer, 'iso-8859-1')
    filas = extraerFilasTablaHTML(html)

    // Buscar fila cabecera que contenga 'Fecha Operación'
    indiceCabecera = buscarFila(filas, contiene 'Fecha Operación')
    SI NO encontrada → lanzar ErrorFormato("Cabecera Openbank no reconocida")

    transacciones = []
    PARA CADA fila EN filas[indiceCabecera+1..fin]:
        celdas = filtrarCeldasNoVacias(fila)
        SI celdas.longitud < 5 → CONTINUAR

        transacciones.añadir({
            fechaOperacion:  parsearFechaDDMMYYYY(celdas[0]),
            fechaValor:      parsearFechaDDMMYYYY(celdas[1]),
            concepto:        celdas[2],
            importe:         parsearImporteEuropeo(celdas[3]),  // '−1.000,00' → −1000.00
            saldoResultante: parsearImporteEuropeo(celdas[4]),
            divisa:          'EUR',  // Openbank no incluye columna divisa
        })

    SI transacciones.longitud == 0 → lanzar ErrorFormato("Extracto vacío")
    RETORNAR transacciones
```

### 3.3 Detección de duplicados [RF-02]

```
FUNCIÓN importarTransacciones(transacciones, cuentaId):
    nuevas = 0
    duplicadas = 0

    PARA CADA t EN transacciones:
        INTENTAR:
            INSERT INTO transacciones (fecha_valor, fecha_operacion, concepto,
                importe, saldo_resultante, cuenta_id, divisa, aviso_divisa)
            VALUES (t.fechaValor, t.fechaOperacion, t.concepto,
                t.importe, t.saldoResultante, cuentaId, t.divisa,
                t.divisa != 'EUR' ? 1 : 0)
            // UNIQUE constraint hace el trabajo
            nuevas += 1
        CAPTURAR ConstraintError:
            duplicadas += 1

    // Aplicar reglas a las nuevas sin categoría
    aplicarReglasATransaccionesSinCategorizar()

    // Asignar meses económicos a transacciones sin mes
    asignarMesesEconomicos()

    RETORNAR { nuevas, duplicadas }
```

### 3.4 Asignación de mes económico [RF-06]

```
FUNCIÓN calcularMesesEconomicos():
    // Obtener todas las transferencias de ingreso >1000 EUR en rango día 25-28
    cortes = SELECT * FROM transacciones
             WHERE categoria_id EN (categorías de tipo 'ingreso')
               AND importe > 1000
               AND dia(fecha_operacion) ENTRE 25 Y 28
             ORDER BY fecha_operacion ASC

    meses = []
    PARA CADA corte EN cortes:
        mes = {
            nombre:       nombreMes(corte.fechaOperacion + 1 mes),  // corte 26/feb → "Marzo 2026"
            fechaInicio:  corte.fechaOperacion,
            fechaFin:     NULL  // se rellena con el siguiente corte
        }
        meses.añadir(mes)

    // Cerrar cada mes con el día anterior al inicio del siguiente
    PARA i = 0 HASTA meses.longitud - 2:
        meses[i].fechaFin = meses[i+1].fechaInicio - 1 día

    // Persistir y asignar transacciones
    PARA CADA mes EN meses:
        id = INSERT o UPDATE en meses_economicos
        UPDATE transacciones
            SET mes_economico_id = id
            WHERE fecha_operacion >= mes.fechaInicio
              AND (mes.fechaFin IS NULL OR fecha_operacion <= mes.fechaFin)
              AND mes_economico_id IS NULL

FUNCIÓN asignarMesManual(fechaCorte):
    // El usuario define un corte cuando no se detecta automáticamente
    INSERT INTO meses_economicos (nombre, fecha_inicio, corte_manual)
    VALUES (nombreMes(fechaCorte + 1 mes), fechaCorte, 1)
    // Reasignar transacciones afectadas
```

### 3.5 Resolución de reglas de categorización [RF-04]

```
FUNCIÓN aplicarReglasATransaccionesSinCategorizar():
    sinCategorizar = SELECT * FROM transacciones WHERE categoria_id IS NULL
    reglas = SELECT * FROM reglas ORDER BY length(patron) DESC  // más larga primero

    PARA CADA transaccion EN sinCategorizar:
        PARA CADA regla EN reglas:
            SI transaccion.concepto.minusculas().contiene(regla.patron.minusculas()):
                UPDATE transacciones
                    SET categoria_id = regla.categoria_id,
                        origen_categoria = 'regla'
                    WHERE id = transaccion.id
                ROMPER  // primera coincidencia = patrón más largo = gana

FUNCIÓN alCrearOEditarRegla(regla):
    // Guardar regla
    INSERT o UPDATE en reglas

    // Aplicar a transacciones sin categorizar que coincidan
    UPDATE transacciones
        SET categoria_id = regla.categoria_id,
            origen_categoria = 'regla'
        WHERE categoria_id IS NULL
          AND lower(concepto) LIKE '%' || lower(regla.patron) || '%'
          // Verificar que no hay otra regla más larga que también coincida
          AND NOT EXISTS (
              SELECT 1 FROM reglas r2
              WHERE r2.id != regla.id
                AND length(r2.patron) > length(regla.patron)
                AND lower(transacciones.concepto) LIKE '%' || lower(r2.patron) || '%'
          )
```

## 4. Contrato de la API HTTP

Todas las rutas bajo prefijo `/api`. Cuerpo y respuesta en JSON salvo la subida de ficheros (multipart/form-data).

### 4.1 Extractos [RF-01, RF-02]

| Método | Ruta | Cuerpo | Respuesta 200 | Errores |
|--------|------|--------|---------------|---------|
| POST | `/api/extractos` | `multipart: fichero + banco ("bbva"\|"openbank")` | `{ nuevas: N, duplicadas: N, avisos: [...] }` | 400 formato no reconocido, 422 extracto vacío |

### 4.2 Transacciones [RF-05, RF-08, RF-09]

| Método | Ruta | Cuerpo | Respuesta 200 | Errores |
|--------|------|--------|---------------|---------|
| GET | `/api/transacciones?mes_id=&categoria_id=&cuenta_id=&importe_min=&importe_max=` | — | `{ transacciones: [...], total: N }` | 400 parámetros inválidos |
| PATCH | `/api/transacciones/categorizar` | `{ ids: [1,2,3], categoria_id: 5 }` | `{ actualizadas: N }` | 400 ids vacíos, 404 categoría no existe |

### 4.3 Categorías [RF-03]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/tipos` | — | `{ tipos: [{ id, nombre, grupos: [{ id, nombre, categorias: [...] }] }] }` | — |
| POST | `/api/grupos` | `{ nombre, tipo_id }` | `201 { id, nombre, tipo_id }` | 400 validación, 409 duplicado |
| PUT | `/api/grupos/:id` | `{ nombre }` | `{ id, nombre, tipo_id }` | 404 no existe |
| DELETE | `/api/grupos/:id` | — | `204` | 409 tiene transacciones asociadas |
| POST | `/api/categorias` | `{ nombre, grupo_id }` | `201 { id, nombre, grupo_id }` | 400 validación, 409 duplicado |
| PUT | `/api/categorias/:id` | `{ nombre }` | `{ id, nombre, grupo_id }` | 404 no existe |
| DELETE | `/api/categorias/:id` | — | `204` | 409 tiene transacciones asociadas |

### 4.4 Reglas [RF-04]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/reglas` | — | `{ reglas: [{ id, patron, categoria_id, categoria_nombre, grupo_nombre }] }` | — |
| POST | `/api/reglas` | `{ patron, categoria_id }` | `201 { id, patron, categoria_id, aplicadas: N }` | 400 patrón vacío, 409 patrón duplicado |
| PUT | `/api/reglas/:id` | `{ patron, categoria_id }` | `{ id, patron, categoria_id, aplicadas: N }` | 404 no existe |
| DELETE | `/api/reglas/:id` | — | `204` | 404 no existe |

### 4.5 Meses económicos [RF-06]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/meses?anio=2026` | — | `{ meses: [{ id, nombre, fecha_inicio, fecha_fin, corte_manual }] }` | — |
| POST | `/api/meses/corte-manual` | `{ fecha_inicio }` | `201 { id, nombre, fecha_inicio }` | 400 fecha inválida, 409 solapa con mes existente |

### 4.6 Dashboard [RF-07, RF-10]

| Método | Ruta | Cuerpo | Respuesta | Errores |
|--------|------|--------|-----------|---------|
| GET | `/api/dashboard/anual?anio=2026` | — | `{ vacio: false, meses: [{ mes_id, nombre, totales: { gasto, ingreso, ahorro, inversion }, grupos: [{ nombre, total, categorias: [...] }] }] }` | — |
| GET | `/api/dashboard/mensual/:mes_id` | — | `{ vacio: false, totales: { gasto, ingreso, ahorro, inversion }, grupos: [...], sin_categorizar: N }` | 404 mes no existe |

### Códigos de error globales

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Recurso creado |
| 204 | Eliminado sin contenido |
| 400 | Petición mal formada / validación |
| 404 | Recurso no encontrado |
| 409 | Conflicto (duplicado o tiene dependencias) |
| 422 | Entidad no procesable (extracto vacío, formato corrupto) |
| 500 | Error interno del servidor |

## 5. Decisiones técnicas justificadas

### 5.1 Librería de parseo XLSX

**Elegida: SheetJS (xlsx).**
Parsea XLSX binario (BBVA) y permite leer como JSON. Es la librería estándar de facto, sin dependencias nativas, funciona en Node.

**Descartada: ExcelJS.**
Más pesada, API orientada a escritura de Excel, no solo lectura. Añade complejidad innecesaria para solo parsear.

> Para Openbank (HTML disfrazado), no se necesita librería extra: se lee como texto y se parsea con un parser HTML ligero del propio Node o regex simple sobre `<tr>/<td>`. [RF-01]

### 5.2 Servidor HTTP

**Elegido: módulo `node:http` nativo.**
Cero dependencias. Para una API local con ~15 endpoints y un único usuario es más que suficiente. Se implementa un mini-router en `rutas.js` (<100 líneas).

**Descartado: Express/Fastify.**
Frameworks completos que violan el espíritu de §1 (stack mínimo). Express añade ~30 dependencias transitivas.

> [§1 constitución, RNF-01]

### 5.3 Librería de gráficas en el frontend

**Elegida: Chart.js (vía CDN o copia local).**
Ligera (~60KB min+gzip), sin dependencias, API simple para barras, donuts y líneas. Cubre todos los tipos de gráfica del MVP. Es una sola dependencia frontend.

**Descartada: D3.js.**
Mucho más potente pero con curva de aprendizaje alta y requiere construir cada gráfica desde cero. Excesivo para el MVP.

**Descartada: gráficas con CSS/SVG puro.**
Viable para barras simples pero costoso para donuts y tooltips interactivos. No justifica el esfuerzo.

> [RNF-03, RF-07, RF-08]

### 5.4 Comunicación frontend ↔ backend

**Elegido: JSON sobre HTTP (fetch nativo).**
El frontend usa `fetch()` del navegador para hablar con la API. Sin WebSockets, sin GraphQL. Request-response simple.

**Descartado: WebSockets.**
No hay necesidad de comunicación bidireccional ni push. La app es consulta-respuesta pura.

> [§3 constitución]

### 5.5 Parseo HTML de Openbank

**Elegido: parser HTML simple con regex sobre `<tr>` y `<td>`.**
El HTML de Openbank es una tabla plana y predecible. Un parser de ~30 líneas con regex o `split` es suficiente y evita añadir una dependencia.

**Descartado: cheerio / jsdom.**
Dependencias pesadas (jsdom trae medio navegador). Innecesario para extraer filas de una tabla HTML simple.

> [§1 constitución, RF-01]

### 5.6 Framework de testing

**Elegido: `node:test` (módulo nativo de Node 18+).**
Cero dependencias. Incluye runner, assertions, describe/it, y soporte para mocks. Cumple §1.

**Descartado: Jest.**
Pesado (~70 dependencias transitivas), requiere configuración, transpilación implícita. Viola §1.

**Descartado: Vitest.**
Orientado a proyectos con bundler. Excesivo para vanilla JS.

> [§1 constitución, §4 constitución]

### 5.7 Servir estáticos del frontend

**Elegido: el propio servidor Node sirve `src/ui/` como ficheros estáticos.**
Unas pocas líneas en `servidor.js` para resolver rutas de fichero y servir con el content-type correcto. Sin dependencia extra.

**Descartado: `serve` como dependencia.**
Añade una dependencia para algo trivial (~20 líneas de código).

> [§1 constitución, RNF-01]

## 6. Estrategia de tests

Framework: `node:test` nativo. Ejecutar con `npm test` → `node --test tests/**/*.test.js`.

### 6.1 Parsers [RF-01]

**`tests/parsers/bbva.test.js`**
- Happy path: parsear `samples/extractos-tipo/Extracto-Marzo26-BBVA.xlsx`, verificar número de transacciones, campos del primero y último registro.
- Cabecera desplazada: fichero BBVA con filas extra de metadatos → debe encontrar la cabecera igualmente o lanzar error.
- Extracto vacío: fichero XLSX válido sin filas de datos → ErrorFormato.
- Fichero corrupto: buffer aleatorio con extensión .xlsx → ErrorFormato.

**`tests/parsers/openbank.test.js`**
- Happy path: parsear `samples/extractos-tipo/Extracto-Marzo26-Openbank.xlsx`, verificar campos, importes europeos convertidos correctamente (-1.000,00 → -1000.00).
- Encoding: verificar que caracteres acentuados (García, Inversión) se parsean correctamente (ISO-8859-1).
- Extracto vacío: HTML con cabecera pero sin filas de datos → ErrorFormato.

### 6.2 Servicio de extractos [RF-01, RF-02]

**`tests/servicios/extractos.test.js`**
- Importar extracto BBVA → N transacciones insertadas, 0 duplicadas.
- Importar mismo extracto dos veces → 0 nuevas, N duplicadas en la segunda.
- Importar extracto con transacciones legítimas de mismo día/concepto/importe pero saldo distinto → ambas se insertan.
- Importar extracto multimes → transacciones asignadas a meses económicos diferentes.
- Divisa no EUR → transacción importada con aviso_divisa = 1.

### 6.3 Servicio de categorías [RF-03]

**`tests/servicios/categorias.test.js`**
- Semilla: verificar que arranque crea los 4 tipos, los grupos y las categorías por defecto.
- CRUD grupo: crear, editar nombre, eliminar grupo vacío → ok.
- CRUD categoría: crear, editar, eliminar categoría vacía → ok.
- Eliminar categoría con transacciones → error 409.
- Eliminar grupo con categorías que tienen transacciones → error 409.
- Crear categoría con nombre duplicado en mismo grupo → error 409.

### 6.4 Servicio de reglas [RF-04]

**`tests/servicios/reglas.test.js`**
- Crear regla "mercadona" → se aplica a transacciones sin categorizar cuyo concepto contiene "mercadona" (case-insensitive).
- Conflicto de reglas: "mercadona" y "mercadona valdebernardo" existen, transacción "MERCADONA VALDEBERNARDO" → gana la más larga.
- Editar regla → se reaplica a transacciones sin categorizar.
- Eliminar regla → transacciones ya categorizadas conservan su categoría.
- Regla no sobreescribe categorización manual: transacción con origen_categoria='manual' no se ve afectada.

### 6.5 Servicio de transacciones [RF-05, RF-09]

**`tests/servicios/transacciones.test.js`**
- Categorización manual individual → categoria_id actualizado, origen_categoria='manual'.
- Categorización en lote (3 ids) → las 3 actualizadas.
- Categorización manual prevalece sobre regla: aplicar regla después no sobreescribe.
- Filtros: por categoría, por cuenta, por rango de importe → resultados correctos.

### 6.6 Servicio de mes económico [RF-06]

**`tests/servicios/mesEconomico.test.js`**
- Detección automática: insertar transferencia >1.000 EUR el día 26 → se crea mes económico con corte en esa fecha.
- Transferencia complementaria >300 EUR el día 1 → pertenece al mismo mes, no abre otro.
- Transferencia extra a final de mes → no afecta corte.
- Sin transferencia en rango → mes no se crea automáticamente.
- Corte manual → mes creado con corte_manual=1.
- Extracto multimes: transacciones repartidas correctamente entre meses.

### 6.7 Servicio de dashboard [RF-07, RF-10]

**`tests/servicios/dashboard.test.js`**
- Dashboard anual con datos → totales por tipo correctos, desglose por grupo correcto.
- Transacciones sin categorizar → aparecen como grupo "Sin categorizar" con su total.
- Transacciones con importe cero → excluidas de agregados.
- Estado vacío (sin transacciones) → respuesta con `vacio: true`.

### 6.8 Base de datos [§5]

**`tests/db.test.js`**
- Conexión a base de datos en memoria → ok.
- Ejecutar migraciones en orden → tablas creadas correctamente.
- UNIQUE constraint en transacciones → INSERT duplicado lanza error.

## 7. Orden de implementación

### Fase 1 — Cimientos
Servidor, base de datos, migraciones y semilla.

- `src/core/db.js` — conexión y helpers
- `migrations/001_tablas_base.sql` — tablas cuentas, tipos, grupos, categorías, transacciones
- `migrations/002_reglas.sql` — tabla reglas
- `migrations/003_meses_economicos.sql` — tabla meses_economicos
- `src/core/semilla.js` — datos iniciales (tipos, grupos, categorías por defecto)
- `src/core/servidor.js` — servidor HTTP mínimo que sirve estáticos y responde en `/api`
- `src/core/rutas.js` — esqueleto de rutas
- Tests: `db.test.js`

**Entregable verificable:** `npm start` arranca el servidor, `GET /api/tipos` devuelve la jerarquía de categorías. Tests pasan.

**Cubre:** §5, RNF-01, RF-03 (parcial)

### Fase 2 — Parseo e importación
Parsers, carga de extractos y detección de duplicados.

- `src/core/parsers/bbva.js`
- `src/core/parsers/openbank.js`
- `src/core/servicios/extractos.js`
- Endpoint `POST /api/extractos`
- `src/ui/vistas/carga.js` — formulario mínimo de subida
- Tests: `bbva.test.js`, `openbank.test.js`, `extractos.test.js`

**Entregable verificable:** subir los ficheros de `samples/extractos-tipo/` desde el navegador. Ver en consola/API las transacciones importadas. Subir dos veces → 0 nuevas.

**Cubre:** RF-01, RF-02, RNF-02

### Fase 3 — Categorización
CRUD de categorías, reglas y categorización manual.

- `src/core/servicios/categorias.js`
- `src/core/servicios/reglas.js`
- `src/core/servicios/transacciones.js` (categorización manual + filtros)
- Endpoints de categorías, reglas y transacciones
- Tests: `categorias.test.js`, `reglas.test.js`, `transacciones.test.js`

**Entregable verificable:** crear regla "yaneka" → Frutería. Ver transacciones recategorizadas vía API. Cambiar categoría manualmente. Verificar que manual prevalece sobre regla.

**Cubre:** RF-03, RF-04, RF-05, RF-09

### Fase 4 — Mes económico
Detección automática de cortes, asignación y corte manual.

- `src/core/servicios/mesEconomico.js`
- Endpoints de meses económicos
- Tests: `mesEconomico.test.js`

**Entregable verificable:** con datos importados en fase 2, `GET /api/meses?anio=2026` devuelve meses económicos detectados automáticamente. Las transacciones tienen `mes_economico_id` asignado.

**Cubre:** RF-06

### Fase 5 — Vistas y dashboard
Frontend completo: dashboard anual, vista mensual, gestión de categorías/reglas.

- `src/ui/index.html`, `src/ui/estilos.css`, `src/ui/app.js`, `src/ui/api.js`
- `src/ui/vistas/dashboard.js`
- `src/ui/vistas/mensual.js`
- `src/ui/vistas/categorias.js`
- `src/ui/vistas/reglas.js`
- `src/ui/componentes/graficas.js`, `tabla.js`, `selector.js`
- `src/core/servicios/dashboard.js`
- Tests: `dashboard.test.js`

**Entregable verificable:** navegador muestra dashboard anual con gráficas reales por grupo, vista mensual con cabecera + listado filtrable, gestión de categorías y reglas. Estado vacío funcional.

**Cubre:** RF-07, RF-08, RF-10, RNF-03

### Fase 6 — Pulido y validación final
Revisión de todos los criterios de finalización.

- Verificar todos los casos límite de la spec.
- `npm test` pasa al 100%.
- Prueba end-to-end manual: subir extractos reales → categorizar → ver dashboard.

**Cubre:** todos los RF, RNF, §4 constitución
