# 001 — Homics MVP

## Contexto y objetivo

Homics es una aplicación web de contabilidad familiar. La familia opera con al menos dos cuentas bancarias (una de gastos comunes y otra de ahorro) alimentadas mediante transferencias manuales desde cuentas personales. El objetivo del MVP es dar visibilidad clara sobre a dónde va el dinero, cuánto se ahorra y cuánto se invierte, permitiendo tomar decisiones económicas informadas mes a mes.

## Usuarios

- **Administrador del hogar**: persona (o pareja) que sube los extractos, categoriza transacciones y consulta los datos. En el MVP se asume un único usuario sin autenticación.

## Historias de usuario

- HU-01: Como administrador, quiero subir extractos bancarios en distintos formatos para centralizar todas las transacciones en un solo sitio.
- HU-02: Como administrador, quiero que las transacciones se categoricen automáticamente según reglas que yo defino, para no repetir trabajo cada mes.
- HU-03: Como administrador, quiero poder corregir o cambiar la categoría de cualquier transacción manualmente.
- HU-04: Como administrador, quiero ver un dashboard anual con gráficas de gasto agregado por categoría para entender de un vistazo cómo se distribuye el dinero.
- HU-05: Como administrador, quiero una vista mensual con resumen gráfico y listado de transacciones para revisar el detalle de cada mes.
- HU-06: Como administrador, quiero que el sistema detecte y descarte transacciones duplicadas al subir extractos solapados.
- HU-07: Como administrador, quiero que el "mes económico" se delimite por las transferencias de ingreso, no por el mes natural.

## Requisitos funcionales

### RF-01 — Carga de extractos bancarios
**Cuando** el usuario sube un fichero de extracto bancario, **el sistema** debe parsear las transacciones y almacenarlas asociadas a la cuenta de origen.
- Criterio de aceptación: soportar XLSX de BBVA (Excel estándar) y XLSX de Openbank (HTML con extensión .xlsx) como formatos mínimos del MVP.
- Criterio de aceptación: cada transacción almacenada debe contener como mínimo: fecha valor, fecha operación, concepto, importe, saldo resultante y cuenta de origen.
- Criterio de aceptación: el usuario debe poder seleccionar a qué banco corresponde el fichero antes de subirlo.
- Criterio de aceptación: un extracto puede contener transacciones de múltiples meses económicos; cada transacción se asigna individualmente al mes que le corresponda por su fecha.
- Criterio de aceptación: solo se soporta EUR. Si se detecta otra divisa, la transacción se importa marcada con un aviso visual para revisión manual.
- Criterio de aceptación: el parseo ocurre en el servidor (Node), no en el navegador.

### RF-02 — Detección de duplicados
**Cuando** se importan transacciones que ya existen en el sistema, **el sistema** debe ignorarlas sin intervención del usuario.
- Criterio de aceptación: la clave de duplicado es la combinación de fecha valor + fecha operación + concepto + importe + saldo resultante + cuenta de origen. Todos los campos deben coincidir para considerar duplicado.
- Criterio de aceptación: subir el mismo extracto dos veces no genera registros duplicados.
- Criterio de aceptación: el sistema informa cuántas transacciones nuevas se insertaron y cuántas se descartaron como duplicadas.

### RF-03 — Categorías de transacción
**El sistema** debe permitir gestionar categorías de transacción organizadas en tres niveles: tipo, grupo y categoría.
- Criterio de aceptación: existen cuatro tipos de alto nivel fijos: gasto, ingreso, ahorro e inversión. No se pueden crear ni eliminar tipos.
- Criterio de aceptación: cada grupo pertenece a un tipo. El usuario puede crear, editar y eliminar grupos.
- Criterio de aceptación: cada categoría pertenece a un grupo. El usuario puede crear, editar y eliminar categorías.
- Criterio de aceptación: no se permite eliminar una categoría ni un grupo que tenga transacciones asociadas. El usuario debe recategorizar primero.
- Criterio de aceptación: se incluye el siguiente conjunto inicial por defecto que el usuario puede modificar:
  - **Gasto > Gastos fijos**: Comunidad, Suministros (luz/gas), Telecomunicaciones (móvil/internet), Seguros, Préstamos.
  - **Gasto > Alimentación**: Supermercado, Frutería/Mercado.
  - **Gasto > Salud**: Farmacia, Pediatra.
  - **Gasto > Hogar**: Hogar, Ropa.
  - **Gasto > Transporte**: Gasolina, Peajes, Transporte público.
  - **Gasto > Familia**: Guardería, Pañales/Bebé, Actividades infantiles.
  - **Gasto > Ocio y restauración**: Restauración, Ocio.
  - **Gasto > Otros**: Compras online, Bizum, Otros gastos.
  - **Ingreso > Ingreso**: Transferencia cuenta común, Transferencia extraordinaria, Otros ingresos.
  - **Ahorro > Ahorro**: Ahorro mensual común, Ahorro extraordinario.
  - **Inversión > Inversión**: Fondo de inversión, Otra inversión.

### RF-04 — Reglas de categorización determinista
**Cuando** se importa una transacción cuyo concepto coincide con una regla definida por el usuario, **el sistema** debe asignar automáticamente la categoría correspondiente.
- Criterio de aceptación: una regla se define como una asociación entre un patrón de texto y una categoría. La coincidencia es por subcadena, case-insensitive (ej. patrón "mercadona" coincide con "MERCADONA VALDEBERNARDO").
- Criterio de aceptación: si dos reglas coinciden con el mismo concepto, gana la regla con el patrón más largo (más específica).
- Criterio de aceptación: el usuario puede crear, editar y eliminar reglas.
- Criterio de aceptación: al crear o editar una regla, el sistema aplica automáticamente la nueva regla a todas las transacciones sin categorizar que coincidan.
- Criterio de aceptación: eliminar una regla no afecta a transacciones ya categorizadas por ella; conservan su categoría.

### RF-05 — Categorización manual
**Cuando** el usuario selecciona una o varias transacciones en la vista mensual, **el sistema** debe permitir asignar o cambiar su categoría manualmente.
- Criterio de aceptación: la categoría manual prevalece sobre la asignada por regla determinista.
- Criterio de aceptación: se permite categorización en lote (seleccionar varias transacciones y asignar la misma categoría).

### RF-06 — Mes económico
**Cuando** el sistema delimita periodos mensuales, **debe** basarse en las transferencias de ingreso recurrentes en lugar del mes natural.
- Criterio de aceptación: el inicio de un mes económico se determina por la primera transferencia >1.000 EUR categorizada como ingreso dentro del rango día 25-28 del mes natural. Esta transferencia marca el corte.
- Criterio de aceptación: la segunda transferencia habitual (>300 EUR, rango día 1-3 del mes natural siguiente) pertenece al mismo mes económico. No abre un nuevo periodo.
- Criterio de aceptación: cualquier transferencia de ingreso adicional dentro del mismo mes económico (ej. refuerzo a final de mes) se suma sin afectar el corte.
- Criterio de aceptación: si no se detecta transferencia de inicio en el rango esperado, el sistema permite al usuario definir la fecha de corte manualmente.
- Criterio de aceptación: todas las vistas (dashboard y mensual) utilizan el mes económico como unidad temporal.

### RF-07 — Dashboard anual
**Cuando** el usuario accede al dashboard anual, **el sistema** debe mostrar un resumen visual del año seleccionado.
- Criterio de aceptación: incluye gráficas de gasto agregado por grupo por defecto, con posibilidad de desglosar a categoría detalle.
- Criterio de aceptación: muestra totales de gasto, ingreso, ahorro e inversión por mes económico.
- Criterio de aceptación: el usuario puede seleccionar el año a visualizar.
- Criterio de aceptación: las transacciones sin categorizar aparecen agrupadas como "Sin categorizar" con color distintivo.

### RF-08 — Vista mensual
**Cuando** el usuario accede a la vista de un mes económico, **el sistema** debe mostrar un resumen gráfico en la cabecera y el listado completo de transacciones debajo.
- Criterio de aceptación: la cabecera muestra un resumen visual con totales por tipo (gasto, ingreso, ahorro, inversión) y desglose por grupo/categoría.
- Criterio de aceptación: el listado muestra todas las transacciones del mes ordenadas por fecha de operación, con concepto, importe, cuenta y categoría.
- Criterio de aceptación: el usuario puede filtrar transacciones por categoría, cuenta bancaria y rango de importe.
- Criterio de aceptación: las transacciones sin categorizar son visualmente distinguibles en el listado.

### RF-09 — Transferencias internas entre cuentas propias
**Cuando** se importan extractos de ambas cuentas (BBVA y Openbank), **el sistema** no concilia automáticamente movimientos entre cuentas propias.
- Criterio de aceptación: el usuario categoriza las transferencias internas manualmente o mediante reglas (ej. "Fondo de Inversion" → categoría Inversión > Fondo de inversión).

### RF-10 — Estado vacío
**Cuando** no hay transacciones en el sistema, **el sistema** debe mostrar una pantalla de inicio con un mensaje orientativo y acceso directo a la carga de extractos.
- Criterio de aceptación: no se muestran gráficas vacías ni tablas sin filas.

## Requisitos no funcionales

- **RNF-01 — Uso local**: la aplicación funciona enteramente en local mediante un servidor Node (`npm start`). Sin servidor remoto ni conexión a internet tras la instalación de dependencias.
- **RNF-02 — Rendimiento**: la carga de un extracto de hasta 500 transacciones debe completarse en menos de 3 segundos.
- **RNF-03 — Claridad visual**: las gráficas deben ser legibles y distinguir categorías por color. Priorizar la comprensión rápida sobre la densidad de datos.

## Casos límite

- Un extracto vacío o con formato corrupto: el sistema informa del error sin importar transacciones parciales.
- Transacciones con importe cero: se importan pero se excluyen de los cálculos agregados del dashboard.
- Mes económico sin transferencia de ingreso detectada (ej. primer mes de uso sin histórico): se permite corte manual.
- Dos transferencias de ingreso muy próximas en fechas (ej. la >1.000 EUR el 26 y la >300 EUR el 1): ambas pertenecen al mismo mes económico, no se abre un segundo periodo.
- Extracto Openbank con variación de layout HTML: el sistema informa del error de parseo sin datos parciales.
- Extracto con transacciones en divisa distinta de EUR: se importan marcadas con aviso visual; se excluyen de los cálculos agregados.
- Dos transacciones legítimas con misma fecha y concepto e importe (ej. dos compras seguidas en el mismo sitio): no se descartan como duplicadas porque el saldo resultante es distinto.
- Transferencia entre cuentas propias aparece como gasto en un extracto e ingreso en el otro: no se concilia automáticamente; el usuario categoriza manualmente.

## Fuera de alcance (MVP)

- Autenticación y multiusuario.
- Sincronización automática con APIs bancarias (Open Banking / PSD2).
- Conciliación automática de transferencias entre cuentas propias.
- Exclusión de transferencias internas de los totales del dashboard (evitar doble contabilización).
- Presupuestos o alertas de gasto.
- Exportación de datos.
- Aplicación móvil o PWA.
- Soporte de bancos adicionales más allá de BBVA y Openbank.
- Soporte de divisas distintas de EUR.
- Predicciones o proyecciones financieras.

## Criterios de finalización

El MVP se considera terminado cuando:
1. Se pueden subir extractos de BBVA (XLSX) y Openbank (XLSX/HTML) sin duplicados.
2. Las transacciones se categorizan por reglas y se pueden recategorizar manualmente.
3. El dashboard anual muestra gráficas de gasto agregado por grupo con datos reales.
4. La vista mensual muestra resumen gráfico, listado filtrable ordenado por fecha de operación y opera sobre el mes económico.
5. Todos los tests pasan al 100%.

## Formatos de extractos (referencia)

Los ficheros de ejemplo se encuentran en `samples/extractos-tipo/`.

**BBVA** — XLSX estándar (Excel).
- Cabecera: 4 filas de metadatos, luego fila de columnas.
- Columnas: F.Valor, Fecha, Concepto, Movimiento, Importe, Divisa, Disponible, Divisa, Observaciones.
- Importe: número con punto decimal (negativo = cargo).

**Openbank** — Fichero HTML con extensión .xlsx.
- Cabecera: metadatos de cuenta (número, titular, saldo), luego tabla de movimientos.
- Columnas: Fecha Operación, Fecha Valor, Concepto, Importe, Saldo.
- Importe: formato europeo con punto de miles y coma decimal (ej. -1.000,00).

## Dudas abiertas

Sin dudas abiertas. Todos los hallazgos de QA han sido resueltos.
