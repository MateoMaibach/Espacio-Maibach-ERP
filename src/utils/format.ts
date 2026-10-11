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
]

/** $1.234.567 — con prefijo segun la moneda. */
export function formatMonto(valor: number, moneda = "ARS"): string {
  const n = Number.isFinite(valor) ? valor : 0;

  if (moneda === "ARS") return `$${n.toLocaleString("es-AR")}`;

  return `${moneda} ${n.toLocaleString("es-AR")}`;
}

/** Compacto para ejes y tarjetas: $1,2M / $850k */
export function formatMontoCorto(valor: number): string {
  const n = Math.abs(valor);

  if (n >= 1_000_000) {
    return `$${(valor / 1_000_000).toLocaleString("es-AR", {
      maximumFractionDigits: 1,
    })}M`;
  }

  if (n >= 1_000) {
    return `$${(valor / 1_000).toLocaleString("es-AR", {
      maximumFractionDigits: 0,
    })}k`;
  }

  return `$${valor.toLocaleString("es-AR")}`;
}

/** "2026-10-11" -> "11/10/2026". Las fechas del server llegan en ISO. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";

  const [a, m, d] = iso.split("-");

  if (!a || !m || !d) return iso;

  return `${d}/${m}/${a}`;
}

/** "en 3 dias", "hoy", "hace 2 dias" a partir de los dias de diferencia. */
export function formatDias(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return "—";

  if (dias === 0) return "hoy";

  if (dias === 1) return "mañana";

  if (dias === -1) return "ayer";

  return dias > 0 ? `en ${dias} días` : `hace ${Math.abs(dias)} días`;
}

/** "DD/MM/YYYY" o "DD Mon, YYYY" -> Date UTC del día, sin corrimiento de zona. */
export function parseFechaServidor(raw: string | null | undefined): Date | null {
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);

  if (iso?.[1] && iso[2] && iso[3]) {
    return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  }

  const ddmm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);

  if (ddmm?.[1] && ddmm[2] && ddmm[3]) {
    return new Date(Date.UTC(+ddmm[3], +ddmm[2] - 1, +ddmm[1]));
  }

  const ddMon = /^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/.exec(raw);

  const dia = ddMon?.[1];
  const mesTexto = ddMon?.[2];
  const anio = ddMon?.[3];

  if (dia && mesTexto && anio) {
    const idx = MESES.findIndex((m) => m.toLowerCase() === mesTexto.toLowerCase());

    if (idx >= 0) {
      return new Date(Date.UTC(+anio, idx, +dia));
    }
  }

  return null;
}
