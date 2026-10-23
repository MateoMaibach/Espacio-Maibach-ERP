import { describe, expect, it } from "vitest";

import { parseArray } from "./json";

describe("parseArray", () => {
  it("devuelve el array tal cual si ya viene parseado", () => {
    const items = [{ detalle: "a" }];

    expect(parseArray(items)).toBe(items);
  });

  it("parsea texto JSON", () => {
    expect(parseArray('[{"detalle":"a"}]')).toEqual([{ detalle: "a" }]);
  });

  it("devuelve vacio si el JSON no es un array", () => {
    expect(parseArray('{"detalle":"a"}')).toEqual([]);
    expect(parseArray("123")).toEqual([]);
    expect(parseArray("null")).toEqual([]);
  });

  it("devuelve vacio si el texto esta corrupto", () => {
    expect(parseArray("[{")).toEqual([]);
    expect(parseArray("[object Object]")).toEqual([]);
  });

  it("devuelve vacio para null/undefined", () => {
    expect(parseArray(null)).toEqual([]);
    expect(parseArray(undefined)).toEqual([]);
  });
});
