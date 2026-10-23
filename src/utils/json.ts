/**
 * Lee una columna JSON que puede venir como array ya parseado (Drizzle la
 * devuelve asi cuando la columna es `mode: "json"`) o como texto.
 *
 * Nunca tira: si el contenido esta corrupto devuelve [], para que una fila
 * vieja no rompa el render de toda la tabla.
 */
export function parseArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];

  try {
    const parsed = JSON.parse(String(raw));

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
