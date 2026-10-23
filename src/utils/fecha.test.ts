import { describe, expect, it } from "vitest";

import {
  formatDias,
  formatFecha,
  formatFechaLarga,
  parseFechaServidor,
  toISODate,
} from "./fecha";

describe("toISODate", () => {
  it("paddea mes y dia", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("formatFecha", () => {
  it("pasa de ISO a dd/mm/aaaa", () => {
    expect(formatFecha("2026-10-11")).toBe("11/10/2026");
  });

  it("devuelve guion para vacio", () => {
    expect(formatFecha("")).toBe("—");
    expect(formatFecha(null)).toBe("—");
    expect(formatFecha(undefined)).toBe("—");
  });

  it("devuelve el original si no es ISO", () => {
    expect(formatFecha("raro")).toBe("raro");
  });
});

describe("formatFechaLarga", () => {
  it("usa el mes en letras", () => {
    expect(formatFechaLarga("2026-10-11")).toBe("11 Oct, 2026");
    expect(formatFechaLarga("2026-01-01")).toBe("01 Ene, 2026");
  });

  it("devuelve vacio para vacio", () => {
    expect(formatFechaLarga("")).toBe("");
  });
});

describe("formatDias", () => {
  it("describe el dia relativo", () => {
    expect(formatDias(0)).toBe("hoy");
    expect(formatDias(1)).toBe("mañana");
    expect(formatDias(-1)).toBe("ayer");
    expect(formatDias(3)).toBe("en 3 días");
    expect(formatDias(-2)).toBe("hace 2 días");
  });

  it("devuelve guion para null/undefined", () => {
    expect(formatDias(null)).toBe("—");
    expect(formatDias(undefined)).toBe("—");
  });
});

describe("parseFechaServidor", () => {
  it("parsea ISO", () => {
    const d = parseFechaServidor("2026-10-11");

    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(9);
    expect(d?.getUTCDate()).toBe(11);
  });

  it("parsea dd/mm/aaaa", () => {
    expect(parseFechaServidor("11/10/2026")?.getUTCDate()).toBe(11);
  });

  it("parsea 'DD Mon, YYYY'", () => {
    const d = parseFechaServidor("11 Oct, 2026");

    expect(d?.getUTCMonth()).toBe(9);
    expect(d?.getUTCDate()).toBe(11);
  });

  it("usa UTC para no correrse de dia", () => {
    const d = parseFechaServidor("2026-01-01");

    expect(d?.getUTCDate()).toBe(1);
    expect(d?.getUTCHours()).toBe(0);
  });

  it("devuelve null si no se puede leer", () => {
    expect(parseFechaServidor("")).toBeNull();
    expect(parseFechaServidor(null)).toBeNull();
    expect(parseFechaServidor("32/13/2026")).toBeNull();
    expect(parseFechaServidor("hola")).toBeNull();
  });
});
