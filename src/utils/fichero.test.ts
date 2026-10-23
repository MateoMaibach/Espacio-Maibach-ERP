import { describe, expect, it } from "vitest";

import { calcularResumenCobros, calcularTotalesFichero } from "./fichero";

const formBase = {
  items: [] as { cant: string; precioUnitario: string }[],
  comisionPct: "",
  costoPiscina: "",
  costoInstalacion: "",
  equipoFiltrado: "",
  manoObraVereda: false,
  costoManoObra: "",
};

describe("calcularTotalesFichero", () => {
  it("multiplica cantidad por precio en cada item", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [
        { cant: "2", precioUnitario: "100.000" },
        { cant: "1", precioUnitario: "50.000" },
      ],
    });

    expect(r.itemsSubtotales).toEqual([200000, 50000]);
    expect(r.importeTotal).toBe(250000);
  });

  it("no infla los decimales del precio", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "1.950.000,50" }],
    });

    expect(r.importeTotal).toBe(1950000.5);
  });

  it("calcula la comision como porcentaje del total", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "1.000.000" }],
      comisionPct: "10",
    });

    expect(r.comision).toBe(100000);
    expect(r.totalCostos).toBe(100000);
  });

  it("suma todos los costos mas la comision", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "1.000.000" }],
      comisionPct: "5",
      costoPiscina: "300.000",
      costoInstalacion: "200.000",
      equipoFiltrado: "50.000",
    });

    expect(r.totalCostos).toBe(600000);
    expect(r.margenNeto).toBe(400000);
    expect(r.margenPct).toBeCloseTo(40);
  });

  it("ignora la mano de obra si el check esta apagado", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "100" }],
      costoManoObra: "500",
      manoObraVereda: false,
    });

    expect(r.costoManoObra).toBe(0);
    expect(r.totalCostos).toBe(0);
  });

  it("incluye la mano de obra si el check esta prendido", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "1000" }],
      costoManoObra: "500",
      manoObraVereda: true,
    });

    expect(r.costoManoObra).toBe(500);
    expect(r.margenNeto).toBe(500);
  });

  it("no divide por cero cuando no hay venta", () => {
    const r = calcularTotalesFichero(formBase);

    expect(r.importeTotal).toBe(0);
    expect(r.margenPct).toBe(0);
    expect(Number.isNaN(r.margenPct)).toBe(false);
  });

  it("puede dar margen negativo", () => {
    const r = calcularTotalesFichero({
      ...formBase,
      items: [{ cant: "1", precioUnitario: "100" }],
      costoPiscina: "150",
    });

    expect(r.margenNeto).toBe(-50);
    expect(r.margenPct).toBeCloseTo(-50);
  });
});

describe("calcularResumenCobros", () => {
  const cuotas = [
    { nro: 0, montoPlanificado: 300000, montoPagado: 300000 },
    { nro: 1, montoPlanificado: 350000, montoPagado: 350000 },
    { nro: 2, montoPlanificado: 350000, montoPagado: 0 },
  ];

  it("lee el total del fichero desde texto formateado", () => {
    expect(calcularResumenCobros("$1.000.000", cuotas).ficheroTotal).toBe(1000000);
  });

  it("suma solo las cuotas del plan para el saldo a financiar", () => {
    const r = calcularResumenCobros("$1.000.000", cuotas);

    expect(r.tienePagoInicial).toBe(true);
    expect(r.pagoInicialMonto).toBe(300000);
    expect(r.totalCostoCobros).toBe(700000);
    expect(r.saldoParaCuotas).toBe(700000);
  });

  it("cuenta el pago inicial como ingreso", () => {
    expect(calcularResumenCobros("$1.000.000", cuotas).totalIngresos).toBe(650000);
  });

  it("calcula saldo pendiente y porcentaje pagado", () => {
    const r = calcularResumenCobros("$1.000.000", cuotas);

    expect(r.saldoPendienteTotal).toBe(350000);
    expect(r.porcentajePagado).toBeCloseTo(65);
    expect(r.estaPagado).toBe(false);
  });

  it("marca pagado cuando no queda saldo", () => {
    const pagado = cuotas.map((c) => ({ ...c, montoPagado: c.montoPlanificado }));
    const r = calcularResumenCobros("$1.000.000", pagado);

    expect(r.saldoPendienteTotal).toBe(0);
    expect(r.estaPagado).toBe(true);
  });

  it("un fichero sin total no figura como pagado", () => {
    const r = calcularResumenCobros("", []);

    expect(r.ficheroTotal).toBe(0);
    expect(r.estaPagado).toBe(false);
    expect(r.porcentajePagado).toBe(0);
  });

  it("no explota si el total viene como numero", () => {
    expect(calcularResumenCobros(1950000, []).ficheroTotal).toBe(1950000);
  });
});
