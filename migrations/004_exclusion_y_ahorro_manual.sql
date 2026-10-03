-- Exclusión reversible de transacciones (ej. préstamos que entran y salen)
ALTER TABLE transacciones ADD COLUMN excluida INTEGER NOT NULL DEFAULT 0;

-- Entradas manuales de ahorro/inversión, independientes de transacciones bancarias
CREATE TABLE ahorro_manual (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    mes_economico_id  INTEGER NOT NULL REFERENCES meses_economicos(id),
    fecha             TEXT NOT NULL,
    importe           REAL NOT NULL,
    tipo              TEXT NOT NULL,
    nota              TEXT,
    creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
);
