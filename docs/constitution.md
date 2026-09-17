# Constitución del proyecto

1. **Stack mínimo** — Frontend: HTML, CSS vanilla y JavaScript (ES Modules), sin frameworks, transpiladores ni bundlers. Backend: servidor Node local que sirve los estáticos y expone una API HTTP. Un único `package.json` con dependencias contadas con los dedos de una mano (si se necesitan más, se actualiza este principio).
2. **Spec antes que código** — Toda feature tiene un fichero `specs/<feature>/spec.md` aprobado antes de escribir la primera línea. Si no hay spec, no hay PR.
3. **Lógica ≠ Interfaz** — La separación es física: la lógica de negocio vive en el servidor (`src/core/`) y no toca el DOM. La interfaz vive en `src/ui/` y solo consume la API — no contiene cálculos, reglas de negocio ni acceso a datos.
4. **Tests obligatorios** — Cada módulo en `src/core/` tiene un test unitario en `tests/`. No se mergea código sin que `npm test` pase al 100 %.
5. **Datos en SQLite** — Una única base de datos SQLite local vía better-sqlite3 (nativo en Node). Sin ORM: consultas SQL explícitas en `src/core/db.js`. Migraciones numeradas en `migrations/`.
6. **Código y mensajes en español** — Variables, funciones, commits, comentarios, documentación y mensajes de UI: todo en castellano.
