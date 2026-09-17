-- Reglas de categorización determinista
CREATE TABLE reglas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patron       TEXT NOT NULL UNIQUE,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id)
);
