-- Meses económicos
CREATE TABLE meses_economicos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre       TEXT NOT NULL,
    fecha_inicio TEXT NOT NULL,
    fecha_fin    TEXT,
    corte_manual INTEGER NOT NULL DEFAULT 0
);

-- Añadir referencia a mes económico en transacciones
ALTER TABLE transacciones ADD COLUMN mes_economico_id INTEGER REFERENCES meses_economicos(id);
