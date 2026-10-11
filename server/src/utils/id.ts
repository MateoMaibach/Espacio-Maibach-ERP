/**
 * Generador de IDs.
 *
 * Usa Date.now() + sufijo aleatorio: Date.now() solo tiene resolucion de
 * milisegundos y dos registros creados en el mismo ms generarian el mismo
 * id, provocando UNIQUE constraint failed en las columnas PRIMARY KEY.
 */
export function idUnico(prefijo: string): string {
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}