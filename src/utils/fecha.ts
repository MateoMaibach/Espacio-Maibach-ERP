const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Date local -> "2026-10-11", el formato que acepta la API. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-10-11" -> "11/10/2026". Devuelve el original si no es parseable. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";

  const [a, m, d] = iso.split("-");

  if (!a || !m || !d) return iso;

  return `${d}/${m}/${a}`;
}

/** "2026-10-11" -> "11 Oct, 2026". Para tablas donde entra el mes en letras. */
export function formatFechaLarga(iso: string | null | undefined): string {
  if (!iso) return "";

  const [a, m, d] = iso.split("-");

  if (!a || !m || !d) return iso;

  const mes = MESES[parseInt(m, 10) - 1] ?? m;

  return `${d} ${mes}, ${a}`;
}

/** "en 3 dias", "hoy", "hace 2 dias" a partir de los dias de diferencia. */
export function formatDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "—";

  if (dias === 0) return "hoy";

  if (dias === 1) return "mañana";

  if (dias === -1) return "ayer";

  return dias > 0 ? `en ${dias} días` : `hace ${Math.abs(dias)} días`;
}

/**
 * Arma la fecha en UTC y verifica que no se haya desbordado.
 *
 * `new Date(Date.UTC(2026, 12, 32))` no tira: rueda a 2027-02-01. Sin esta
 * verificacion, "32/13/2026" se aceptaba como una fecha valida y el dia
 * terminaba corrido. Es el mismo criterio que `parseMesAnio` en el server.
 */
function fechaUTC(anio: number, mes: number, dia: number): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const d = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null;
  }

  return d;
}

/** "DD/MM/YYYY" o "DD Mon, YYYY" -> Date UTC del dia, sin corrimiento de zona. */
export function parseFechaServidor(raw: string | null | undefined): Date | null {
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);

  if (iso?.[1] && iso[2] && iso[3]) {
    return fechaUTC(+iso[1], +iso[2], +iso[3]);
  }

  const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);

  if (ddmm?.[1] && ddmm[2] && ddmm[3]) {
    return fechaUTC(+ddmm[3], +ddmm[2], +ddmm[1]);
  }

  const ddMon = /^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/.exec(raw);

  const dia = ddMon?.[1];
  const mesTexto = ddMon?.[2];
  const anio = ddMon?.[3];

  if (dia && mesTexto && anio) {
    const idx = MESES.findIndex((m) => m.toLowerCase() === mesTexto.toLowerCase());

    if (idx >= 0) {
      return fechaUTC(+anio, idx + 1, +dia);
    }
  }

  return null;
}
