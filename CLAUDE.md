# CLAUDE.md — Contexto operativo

## Proyecto
Aplicación web de contabilidad familiar. Proyecto en fase inicial.

## Reglas inquebrantables
Lee y cumple `docs/constitution.md` antes de cualquier cambio. Los 6 principios son innegociables.

## Arquitectura
```
Navegador (src/ui/)           Servidor Node (src/core/)
HTML + CSS + JS vanilla  ←→   API HTTP ←→ SQLite (better-sqlite3)
Solo presentación              Lógica, parseo, SQL
```

## Estructura esperada
```
src/core/    → Servidor Node: lógica de negocio, API HTTP, parseo, SQL
src/ui/      → Frontend: HTML + CSS + JS vanilla (solo consume la API)
tests/       → Tests unitarios (espejo de src/core/)
migrations/  → Migraciones SQL numeradas (001_, 002_, …)
specs/       → Specs de features (aprobar antes de implementar)
```

## Flujo de trabajo
1. Antes de implementar una feature, crear o verificar que exista su spec en `specs/`.
2. Escribir lógica en `src/core/`, tests en `tests/`, UI en `src/ui/`.
3. Ejecutar `npm test` y confirmar que pasa antes de dar por terminado.
4. `npm start` arranca el servidor Node que sirve estáticos y API.

## Convenciones
- Idioma: español en todo (código, commits, comentarios, UI).
- Commits: mensajes descriptivos en español, imperativo (`Añade`, `Corrige`, `Elimina`).
- Frontend sin frameworks ni bundlers. JavaScript vanilla con ES Modules.
- Backend Node sin frameworks (http nativo o dependencia mínima).
- SQL directo en `src/core/db.js`, sin ORM.
