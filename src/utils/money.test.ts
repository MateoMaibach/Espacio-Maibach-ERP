import { describe, expect, it } from "vitest";

import { formatMonto, formatMontoCorto, parseMonto } from "./money";

describe("parseMonto", () => {
  it("acepta numeros y descarta los no finitos", () => {
    expect(parseMonto(1950000)).toBe(1950000);
    expect(parseMonto(100.5)).toBe(100.5);
    expect(parseMonto(Number.NaN)).toBe(0);
    expect(parseMonto(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("interpreta el formato es-AR con puntos de miles", () => {
    expect(parseMonto("$1.950.000")).toBe(1950000);
    expect(parseMonto("1.950.000")).toBe(1950000);
  });

  it("no infla los decimales x100", () => {
    expect(parseMonto("$1.950.000,50")).toBe(1950000.5);
    expect(parseMonto("100,50")).toBe(100.5);
  });

  it("interpreta el formato en-US", () => {
    expect(parseMonto("1,950,000.50")).toBe(1950000.5);
    expect(parseMonto("1234.56")).toBe(1234.56);
  });

  it("un separador con 3 digitos detras es de miles", () => {
    expect(parseMonto("1,234")).toBe(1234);
    expect(parseMonto("1.234")).toBe(1234);
  });

  it("un separador con 1 o 2 digitos detras es decimal", () => {
    expect(parseMonto("0.5")).toBe(0.5);
    expect(parseMonto("0,5")).toBe(0.5);
  });

  it("devuelve 0 para lo que no se puede leer", () => {
    expect(parseMonto("")).toBe(0);
    expect(parseMonto("   ")).toBe(0);
    expect(parseMonto("abc")).toBe(0);
    expect(parseMonto(null)).toBe(0);
    expect(parseMonto(undefined)).toBe(0);
    expect(parseMonto({})).toBe(0);
  });

  it("conserva el signo", () => {
    expect(parseMonto("-500")).toBe(-500);
    expect(parseMonto("-$1.500")).toBe(-1500);
  });
});

describe("formatMonto", () => {
  it("formatea pesos con separador de miles", () => {
    expect(formatMonto(1950000)).toBe("$1.950.000");
  });

  it("antepone la moneda cuando no es ARS", () => {
    expect(formatMonto(1500, "USD")).toBe("USD 1.500");
  });

  it("no propaga NaN", () => {
    expect(formatMonto(Number.NaN)).toBe("$0");
  });
});

describe("formatMontoCorto", () => {
  it("abrevia millones con un decimal", () => {
    expect(formatMontoCorto(1500000)).toBe("$1,5M");
  });

  it("abrevia miles sin decimales", () => {
    expect(formatMontoCorto(850000)).toBe("$850k");
  });

  it("muestra el monto completo por debajo de mil", () => {
    expect(formatMontoCorto(500)).toBe("$500");
  });

  it("usa el valor absoluto para decidir la escala", () => {
    expect(formatMontoCorto(-2500000)).toBe("$-2,5M");
  });
});
