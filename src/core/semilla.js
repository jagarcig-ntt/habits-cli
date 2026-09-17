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
}
