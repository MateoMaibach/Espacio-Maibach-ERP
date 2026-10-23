/**
 * Unidad del dinero en el front.
 *
 * El server habla pesos; aca solo se formatea y se parsea lo que el usuario
 * tipea. `parseMonto` replica la semantica de `aCentavos`
 * (server/src/services/money.ts) para que el mismo texto no signifique dos
 * cosas distintas segun donde se interprete.
 */

/** "$1.234.567" con prefijo segun la moneda. */
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

/**
 * Texto -> pesos.
 *
 * Acepta `1950000`, `"$1.950.000"`, `"$1.950.000,50"`, `"1,950,000.50"`.
 * Devuelve 0 si no se puede leer.
 *
 * La version anterior (`parseCurrencyInput`) borraba todo lo no-digito antes
 * de interpretar, asi que `"$1.950.000,50"` daba 195000050: una inflacion de
 * x100, y `"100,50"` daba 10050 en vez de 100.50.
 */
export function parseMonto(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;

  if (typeof valor !== "string") return 0;

  const limpio = valor.replace(/[^\d.,-]/g, "");

  if (!limpio) return 0;

  const n = Number(separarDecimales(limpio));

  return Number.isFinite(n) ? n : 0;
}

/**
 * Resuelve cual de `.` o `,` es el separador decimal.
 *
 * Es el ULTIMO que aparece, salvo que este seguido de exactamente 3 digitos:
 * en ese caso es de miles.
 *
 *   "1.950.000"    -> 1950000
 *   "1,234"        -> 1234
 *   "1.950.000,50" -> 1950000.50
 *   "1,950,000.50" -> 1950000.50
 */
function separarDecimales(valor: string): string {
  const ultimaComa = valor.lastIndexOf(",");
  const ultimoPunto = valor.lastIndexOf(".");

  if (ultimaComa === -1 && ultimoPunto === -1) return valor;

  const sep = Math.max(ultimaComa, ultimoPunto) === ultimoPunto ? "." : ",";
  const otro = sep === "." ? "," : ".";

  const fin = valor.lastIndexOf(sep);

  if (valor.length - fin - 1 === 3) {
    return valor.replace(/[.,]/g, "");
  }

  const entero = valor.slice(0, fin).split(otro).join("");

  return entero + "." + valor.slice(fin + 1);
}
