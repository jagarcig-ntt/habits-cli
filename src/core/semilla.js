import { ejecutar, consultar } from './db.js';

const DATOS = {
  cuentas: [
    { nombre: 'BBVA', formato: 'xlsx_bbva' },
    { nombre: 'Openbank', formato: 'html_openbank' },
  ],
  tipos: [
    {
      nombre: 'gasto',
      grupos: [
        { nombre: 'Gastos fijos', categorias: ['Comunidad', 'Suministros', 'Telecomunicaciones', 'Seguros', 'Préstamos'] },
        { nombre: 'Alimentación', categorias: ['Supermercado', 'Frutería/Mercado'] },
        { nombre: 'Salud', categorias: ['Farmacia', 'Pediatra'] },
        { nombre: 'Hogar', categorias: ['Hogar', 'Ropa'] },
        { nombre: 'Transporte', categorias: ['Gasolina', 'Peajes', 'Transporte público'] },
        { nombre: 'Familia', categorias: ['Guardería', 'Pañales/Bebé', 'Actividades infantiles'] },
        { nombre: 'Ocio y restauración', categorias: ['Restauración', 'Ocio'] },
        { nombre: 'Otros', categorias: ['Compras online', 'Bizum', 'Otros gastos'] },
      ],
    },
    {
      nombre: 'ingreso',
      grupos: [
        { nombre: 'Ingreso', categorias: ['Transferencia cuenta común', 'Transferencia extraordinaria', 'Otros ingresos'] },
      ],
    },
    {
      nombre: 'ahorro',
      grupos: [
        { nombre: 'Ahorro', categorias: ['Ahorro mensual común', 'Ahorro extraordinario'] },
      ],
    },
    {
      nombre: 'inversión',
      grupos: [
        { nombre: 'Inversión', categorias: ['Fondo de inversión', 'Otra inversión'] },
      ],
    },
  ],
};

// Reglas por defecto: patrón → nombre de categoría destino
const REGLAS_DEFECTO = [
  // Ingreso
  { patron: 'traspaso desde cuenta', categoria: 'Transferencia cuenta común' },
  { patron: 'transferencia recibida', categoria: 'Transferencia cuenta común' },
  // Supermercado
  { patron: 'mercadona', categoria: 'Supermercado' },
  { patron: 'ahorramas', categoria: 'Supermercado' },
  { patron: 'mialcampo', categoria: 'Supermercado' },
  { patron: 'el corte ingles', categoria: 'Supermercado' },
  { patron: 'primaprix', categoria: 'Supermercado' },
  // Frutería/Mercado
  { patron: 'yaneka', categoria: 'Frutería/Mercado' },
  { patron: 'frutas y verduras', categoria: 'Frutería/Mercado' },
  // Gasolina
  { patron: 'cedipsa', categoria: 'Gasolina' },
  { patron: 'repsol', categoria: 'Gasolina' },
  { patron: 'e.s.', categoria: 'Gasolina' },
  // Peajes
  { patron: 'autopista', categoria: 'Peajes' },
  { patron: 'castellana de autopistas', categoria: 'Peajes' },
  // Farmacia
  { patron: 'farmacia', categoria: 'Farmacia' },
  { patron: 'fcia', categoria: 'Farmacia' },
  // Comunidad
  { patron: 'comunidad de propietarios', categoria: 'Comunidad' },
  { patron: 'cp reyes catolicos', categoria: 'Comunidad' },
  // Suministros
  { patron: 'octopus energy', categoria: 'Suministros' },
  // Telecomunicaciones
  { patron: 'vodafone', categoria: 'Telecomunicaciones' },
  // Seguros
  { patron: 'mapfre', categoria: 'Seguros' },
  // Transporte público
  { patron: 'metro de madrid', categoria: 'Transporte público' },
  // Bizum
  { patron: 'bizum', categoria: 'Bizum' },
];

export function ejecutarSemilla(db) {
  // Cuentas
  for (const cuenta of DATOS.cuentas) {
    const existe = consultar(db, "SELECT id FROM cuentas WHERE nombre = ?", [cuenta.nombre]);
    if (existe.length === 0) {
      ejecutar(db, "INSERT INTO cuentas (nombre, formato) VALUES (?, ?)", [cuenta.nombre, cuenta.formato]);
    }
  }

  // Tipos, grupos y categorías
  for (const tipo of DATOS.tipos) {
    let tipoRow = consultar(db, "SELECT id FROM tipos WHERE nombre = ?", [tipo.nombre]);
    if (tipoRow.length === 0) {
      ejecutar(db, "INSERT INTO tipos (nombre) VALUES (?)", [tipo.nombre]);
      tipoRow = consultar(db, "SELECT id FROM tipos WHERE nombre = ?", [tipo.nombre]);
    }
    const tipoId = tipoRow[0].id;

    for (const grupo of tipo.grupos) {
      let grupoRow = consultar(db, "SELECT id FROM grupos WHERE nombre = ? AND tipo_id = ?", [grupo.nombre, tipoId]);
      if (grupoRow.length === 0) {
        ejecutar(db, "INSERT INTO grupos (nombre, tipo_id) VALUES (?, ?)", [grupo.nombre, tipoId]);
        grupoRow = consultar(db, "SELECT id FROM grupos WHERE nombre = ? AND tipo_id = ?", [grupo.nombre, tipoId]);
      }
      const grupoId = grupoRow[0].id;

      for (const catNombre of grupo.categorias) {
        const existe = consultar(db, "SELECT id FROM categorias WHERE nombre = ? AND grupo_id = ?", [catNombre, grupoId]);
        if (existe.length === 0) {
          ejecutar(db, "INSERT INTO categorias (nombre, grupo_id) VALUES (?, ?)", [catNombre, grupoId]);
        }
      }
    }
  }

  // Reglas por defecto
  for (const regla of REGLAS_DEFECTO) {
    const existe = consultar(db, "SELECT id FROM reglas WHERE patron = ?", [regla.patron]);
    if (existe.length > 0) continue;

    const cat = consultar(db, "SELECT id FROM categorias WHERE nombre = ?", [regla.categoria]);
    if (cat.length === 0) continue;

    ejecutar(db, "INSERT INTO reglas (patron, categoria_id) VALUES (?, ?)", [regla.patron, cat[0].id]);
  }
}
