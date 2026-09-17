-- Cuentas bancarias conocidas
CREATE TABLE cuentas (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL UNIQUE,
    formato TEXT NOT NULL
);

-- Tipos fijos (gasto, ingreso, ahorro, inversión)
CREATE TABLE tipos (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE
);

-- Grupos (pertenecen a un tipo)
CREATE TABLE grupos (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL,
    tipo_id INTEGER NOT NULL REFERENCES tipos(id),
    UNIQUE(nombre, tipo_id)
);

-- Categorías (pertenecen a un grupo)
CREATE TABLE categorias (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre   TEXT NOT NULL,
    grupo_id INTEGER NOT NULL REFERENCES grupos(id),
    UNIQUE(nombre, grupo_id)
);

-- Transacciones importadas
CREATE TABLE transacciones (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_valor       TEXT NOT NULL,
    fecha_operacion   TEXT NOT NULL,
    concepto          TEXT NOT NULL,
    importe           REAL NOT NULL,
    saldo_resultante  REAL NOT NULL,
    divisa            TEXT NOT NULL DEFAULT 'EUR',
    cuenta_id         INTEGER NOT NULL REFERENCES cuentas(id),
    categoria_id      INTEGER REFERENCES categorias(id),
    origen_categoria  TEXT DEFAULT NULL,
    aviso_divisa      INTEGER NOT NULL DEFAULT 0,
    creado_en         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(fecha_valor, fecha_operacion, concepto, importe, saldo_resultante, cuenta_id)
);
