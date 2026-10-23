import { describe, expect, it } from "vitest";

import { mapCuota, mapFichero } from "./clienteDetalle";

const rawFichero = {
  fecha: "05 Ago, 2024",
  vendedor: "Martín Maibach",
  comision: "5%",
  items: JSON.stringify([
    { desc: "Pileta Roma", cant: "1", precio: "$3.900.000" },
  ]),
  total: "$4.850.000",
  costoPiscina: 1950000,
  costoInstalacion: "800000",
  costoEquipoFiltrado: null,
  costoManoObra: undefined,
  manoObraVeredaAplica: 0,
  comisionPct: "5",
  proveedor: "Piletecno SA",
  venta: "$4.850.000",
  comisionMonto: 242500,
  totalCostos: 3642500,
  margenNeto: 1207500,
  margenPct: 24.9,
};

describe("mapFichero", () => {
  it("parsea los articulos guardados como JSON", () => {
    const fichero = mapFichero(rawFichero, []);

    expect(fichero.items).toEqual([
      { desc: "Pileta Roma", cant: "1", precio: "$3.900.000" },
    ]);
  });

  it("no rompe la pagina si los articulos vienen corruptos", () => {
    const fichero = mapFichero({ ...rawFichero, items: "{no es json" }, []);

    expect(fichero.items).toEqual([]);
  });

  it("ignora articulos que no son un arreglo", () => {
    const fichero = mapFichero(
      { ...rawFichero, items: JSON.stringify({ desc: "no es lista" }) },
      [],
    );

    expect(fichero.items).toEqual([]);
  });

  it("convierte montos formateados en vez de dejarlos en 0", () => {
    const fichero = mapFichero(rawFichero, []);

    expect(fichero.venta).toBe(4850000);
    expect(fichero.costoInstalacion).toBe(800000);
  });

  it("usa el total como venta si falta el campo venta", () => {
    const fichero = mapFichero({ ...rawFichero, venta: undefined }, []);

    expect(fichero.venta).toBe(4850000);
  });

  it("trata los costos no numericos como 0", () => {
    const fichero = mapFichero(rawFichero, []);

    expect(fichero.costoEquipoFiltrado).toBe(0);
    expect(fichero.costoManoObra).toBe(0);
  });

  it("normaliza manoObraVeredaAplica a 0 o 1", () => {
    expect(mapFichero(rawFichero, []).manoObraVeredaAplica).toBe(0);

    expect(
      mapFichero({ ...rawFichero, manoObraVeredaAplica: 7 }, [])
        .manoObraVeredaAplica,
    ).toBe(1);
  });

  it("devuelve total $0 si el fichero no trae total ni venta", () => {
    const fichero = mapFichero(
      { ...rawFichero, total: undefined, venta: undefined },
      [],
    );

    expect(fichero.total).toBe("$0");
    expect(fichero.venta).toBe(0);
  });

  it("mapea las cuotas de la API", () => {
    const fichero = mapFichero(rawFichero, [
      {
        id: "cuo_1",
        nroCuota: 1,
        fechaVencimiento: "2026-11-10",
        montoPlanificado: 500000,
        montoPagado: 500000,
        fechaPago: "2026-11-09",
        metodo: "Transferencia",
        comprobante: "TR-1",
        observaciones: "Cuota 1",
        estado: "Pagada",
      },
    ]);

    expect(fichero.cuotas).toHaveLength(1);

    expect(fichero.cuotas[0]).toMatchObject({
      id: "cuo_1",
      nro: 1,
      montoPagado: 500000,
      estado: "Pagada",
    });
  });
});

describe("mapCuota", () => {
  it("completa los campos opcionales ausentes", () => {
    const cuota = mapCuota({
      id: "cuo_2",
      nroCuota: 2,
      fechaVencimiento: "2026-12-10",
      montoPlanificado: 100,
      montoPagado: 0,
      fechaPago: null,
      metodo: null,
      estado: "Pendiente",
    });

    expect(cuota.comprobante).toBe("");
    expect(cuota.observaciones).toBe("");
    expect(cuota.fechaPago).toBeNull();
    expect(cuota.metodo).toBeNull();
    expect(cuota.descripcion).toBeUndefined();
  });
});
