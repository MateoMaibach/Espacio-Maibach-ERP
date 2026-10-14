import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppLayout from "@/layouts/AppLayout";

import {
  getPeriodoPreview,
  cerrarPeriodo,
  abrirPeriodo,
  getPeriodos,
  type Snapshot,
  type Periodo,
} from "@/services/api";

import { formatMonto, formatMontoCorto } from "@/utils/format";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MESES_CORTOS = [
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

function Card({
  titulo,
  children,
  accion,
}: {
  titulo: string;
  children: React.ReactNode;
  accion?: React.ReactNode;
}) {
  return (
    <div
      className="bg-white p-[20px] rounded-[12px] flex flex-col gap-[14px]"
      style={{ border: "1px solid #e2e8f0" }}
    >
      <div className="flex items-center justify-between">
        <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
          {titulo}
        </p>
        {accion}
      </div>
      {children}
    </div>
  );
}

function Fila({
  label,
  valor,
  color = "#0f172a",
  bold = false,
}: {
  label: string;
  valor: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <p
        className={`font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] ${
          bold ? "font-semibold" : ""
        }`}
      >
        {label}
      </p>
      <p
        className={`font-['Geist:${bold ? "Bold" : "Medium"}',sans-serif] ${
          bold ? "font-bold" : "font-medium"
        } text-[13px]`}
        style={{ color }}
      >
        {valor}
      </p>
    </div>
  );
}

export default function Finanzas() {
  const navigate = useNavigate();

  const hoy = new Date();

  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());

  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [historico, setHistorico] = useState<Snapshot[]>([]);

  const cerrado = periodos.some(
    (p) => p.mes === mes && p.anio === anio && p.estado === "cerrado",
  );

  useEffect(() => {
    let vivo = true;

    setLoading(true);

    Promise.all([getPeriodoPreview(mes, anio), getPeriodos()])
      .then(([pv, ps]) => {
        if (!vivo) return;

        setPreview(pv);

        setPeriodos(ps);

        setError(null);
      })
      .catch((e) => {
        if (vivo) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        }
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });

    return () => {
      vivo = false;
    };
  }, [mes, anio]);

  // Histórico de los meses con datos, para comparar.
  useEffect(() => {
    let vivo = true;

    Promise.all(
      MESES.map((_, i) => {
        const m = i + 1;

        return getPeriodoPreview(m, anio).catch(() => null);
      }),
    )
      .then((todos) => {
        if (vivo) {
          setHistorico(todos.filter(Boolean) as Snapshot[]);
        }
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [anio]);

  const maxHistVentas = useMemo(
    () => Math.max(...historico.map((s) => s.ventas.total), 1),
    [historico],
  );

  async function manejarCierre() {
    const accion = cerrado ? abrirPeriodo : cerrarPeriodo;

    const confirmar = cerrado
      ? `¿Reabrir ${MESES[mes - 1]} ${anio}? Los movimientos del mes volveran a ser editables.`
      : `¿Cerrar ${MESES[mes - 1]} ${anio}? Se guardará una foto de las cifras y el mes quedará bloqueado.`;

    if (!confirm(confirmar)) return;

    setTrabajando(true);

    try {
      await accion(mes, anio);

      const [pv, ps] = await Promise.all([
        getPeriodoPreview(mes, anio),
        getPeriodos(),
      ]);

      setPreview(pv);

      setPeriodos(ps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
    } finally {
      setTrabajando(false);
    }
  }

  const totalCostos = preview?.costes.total ?? 0;

  const lineaCostos = preview
    ? [
        { label: "Costo piscina", valor: preview.costes.costoPiscina },
        { label: "Instalación", valor: preview.costes.costoInstalacion },
        {
          label: "Equipo de filtrado",
          valor: preview.costes.costoEquipoFiltrado,
        },
        { label: "Mano de obra vereda", valor: preview.costes.costoManoObra },
        { label: "Comisión vendedor", valor: preview.costes.comision },
      ].filter((l) => l.valor > 0)
    : [];

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio" }, { label: "Finanzas" }]}>
      <div className="flex flex-col gap-[24px] p-[32px]">
        {/* Selector de mes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[12px]">
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] border border-[#e2e8f0] bg-white cursor-pointer outline-none"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] border border-[#e2e8f0] bg-white cursor-pointer outline-none"
            >
              {[anio - 2, anio - 1, anio, anio + 1].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {cerrado && (
              <span
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[10px] py-[4px] rounded-[6px]"
                style={{ background: "#fef2f2", color: "#ef4444" }}
              >
                Mes cerrado
              </span>
            )}
          </div>

          <button
            onClick={manejarCierre}
            disabled={trabajando}
            className="font-['Geist:Medium',sans-serif] font-medium text-[13px] px-[16px] py-[10px] rounded-[8px] text-white disabled:opacity-50"
            style={{ background: cerrado ? "#f59e0b" : "#0ea5e9" }}
          >
            {trabajando
              ? "Procesando..."
              : cerrado
                ? "Reabrir mes"
                : "Cerrar mes"}
          </button>
        </div>

        {error && (
          <div
            className="rounded-[12px] p-[16px]"
            style={{ background: "#fef2f2", border: "1px solid #ef4444" }}
          >
            <p className="font-['Geist:Medium',sans-serif] text-[#b91c1c] text-[13px]">
              {error}
            </p>
          </div>
        )}

        {preview?.avisos.length ? (
          <div
            className="rounded-[12px] p-[16px] flex flex-col gap-[6px]"
            style={{ background: "#fffbeb", border: "1px solid #f59e0b" }}
          >
            {preview.avisos.map((a) => (
              <p
                key={a}
                className="font-['Geist:Regular',sans-serif] text-[#92400e] text-[13px]"
              >
                {a}
              </p>
            ))}
          </div>
        ) : null}

        {loading || !preview ? (
          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
            Calculando...
          </p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-[16px]">
              {[
                {
                  label: "Ventas",
                  valor: preview.ventas.total,
                  sub: `${preview.ventas.cantidad} ficha(s)`,
                  color: "#0f172a",
                },
                {
                  label: "Costos Totales",
                  valor: totalCostos,
                  sub: preview.ventas.total > 0
                    ? `${Math.round((totalCostos / preview.ventas.total) * 100)}% de las ventas`
                    : "-",
                  color: "#ef4444",
                },
                {
                  label: "Margen Neto",
                  valor: preview.resultado.neto,
                  sub: `${preview.resultado.margenPct}%`,
                  color:
                    preview.resultado.neto >= 0 ? "#10b981" : "#ef4444",
                },
                {
                  label: "Resultado de Caja",
                  valor: preview.caja.gananciaNeta,
                  sub: `${formatMonto(preview.caja.ingresos)} - ${formatMonto(preview.caja.egresos)}`,
                  color:
                    preview.caja.gananciaNeta >= 0 ? "#10b981" : "#ef4444",
                },
              ].map((k) => (
                <div
                  key={k.label}
                  className="bg-white p-[18px] rounded-[12px] flex flex-col gap-[8px]"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  <p className="font-['Geist:Medium',sans-serif] text-[#475569] text-[13px]">
                    {k.label}
                  </p>
                  <p
                    className="font-['Geist:Bold',sans-serif] font-bold text-[22px]"
                    style={{ color: k.color }}
                  >
                    {formatMontoCorto(k.valor)}
                  </p>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                    {k.sub}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-[24px]">
              {/* Resultado del mes */}
              <Card titulo={`Resultado de ${MESES[mes - 1]} ${anio}`}>
                <div className="flex flex-col gap-[8px]">
                  <Fila label="Ventas" valor={formatMonto(preview.ventas.total)} />

                  <div
                    className="flex items-center justify-between pt-[6px] mt-[2px]"
                    style={{ borderTop: "1px solid #e2e8f0" }}
                  >
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">
                      (-) Costos de obra
                    </p>
                    <p
                      className="font-['Geist:Medium',sans-serif] font-medium text-[#ef4444] text-[13px]"
                    >
                      -{formatMonto(totalCostos)}
                    </p>
                  </div>

                  {lineaCostos.map((l) => (
                    <div
                      key={l.label}
                      className="pl-[16px] flex items-center justify-between"
                    >
                      <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">
                        {l.label}
                      </p>
                      <p className="font-['Geist:Regular',sans-serif] text-[#64748b] text-[12px]">
                        {formatMonto(l.valor)}
                      </p>
                    </div>
                  ))}

                  <div
                    className="flex items-center justify-between pt-[10px] mt-[4px]"
                    style={{ borderTop: "1px solid #e2e8f0" }}
                  >
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                      Margen Neto
                    </p>
                    <p
                      className="font-['Geist:Bold',sans-serif] font-bold text-[16px]"
                      style={{
                        color: preview.resultado.neto >= 0 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {formatMonto(preview.resultado.neto)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Egresos por categoría */}
              <Card
                titulo="Egresos por categoría"
                accion={
                  <button
                    onClick={() => navigate("/caja")}
                    className="font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[13px] hover:underline"
                  >
                    Ver Caja
                  </button>
                }
              >
                {preview.egresosPorCategoria.length === 0 ? (
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                    No hay egresos categorizados en este mes.
                  </p>
                ) : (
                  <div className="flex flex-col gap-[12px]">
                    {preview.egresosPorCategoria.map((c) => {
                      const pct =
                        totalCostos > 0 ? (c.total / totalCostos) * 100 : 0;

                      return (
                        <div key={c.categoria} className="flex flex-col gap-[4px]">
                          <div className="flex items-center justify-between">
                            <p className="font-['Geist:Medium',sans-serif] text-[#0f172a] text-[13px]">
                              {c.categoria}
                            </p>
                            <p className="font-['Geist:Medium',sans-serif] text-[#0f172a] text-[13px]">
                              {formatMonto(c.total)}
                            </p>
                          </div>

                          <div
                            className="h-[6px] rounded-full"
                            style={{ background: "#f1f5f9" }}
                          >
                            <div
                              className="h-[6px] rounded-full bg-[#0ea5e9]"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>

                          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">
                            {c.movimientos} movimiento(s) ·{" "}
                            {Math.round((c.total / preview.caja.egresos) * 100)}%
                            de los egresos de caja
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-[24px]">
              <Card titulo="Caja por sub-caja">
                <div className="flex flex-col gap-[8px]">
                  {Object.entries(preview.caja.porSubCaja).map(([nombre, v]) => (
                    <Fila
                      key={nombre}
                      label={nombre}
                      valor={formatMonto(v.total)}
                      color={v.total >= 0 ? "#10b981" : "#ef4444"}
                    />
                  ))}

                  <div
                    className="flex items-center justify-between pt-[8px] mt-[2px]"
                    style={{ borderTop: "1px solid #e2e8f0" }}
                  >
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">
                      Resultado
                    </p>
                    <p
                      className="font-['Geist:Bold',sans-serif] font-bold text-[14px]"
                      style={{
                        color:
                          preview.caja.gananciaNeta >= 0
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {formatMonto(preview.caja.gananciaNeta)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card titulo="Posición de terceros">
                <div className="flex flex-col gap-[8px]">
                  <Fila
                    label="Cuentas a pagar"
                    valor={formatMonto(preview.cuentasAPagar)}
                    color="#ef4444"
                  />

                  <Fila
                    label="Cheques en cartera"
                    valor={formatMonto(preview.carteraCheques)}
                    color="#0ea5e9"
                  />

                  <Fila
                    label={`Cuotas vencidas (${preview.cuotasVencidas})`}
                    valor={formatMonto(preview.montoVencido)}
                    color={preview.montoVencido > 0 ? "#f59e0b" : "#10b981"}
                  />

                  <button
                    onClick={() => navigate("/clientes")}
                    className="mt-[6px] font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[13px] hover:underline text-left"
                  >
                    Ver clientes morosos →
                  </button>
                </div>
              </Card>

              <Card titulo="Histórico mensual">
                <div className="flex flex-col gap-[10px]">
                  {historico.map((h) => (
                    <button
                      key={`${h.mes}-${h.anio}`}
                      onClick={() => setMes(h.mes)}
                      className="flex flex-col gap-[3px] text-left hover:bg-[#f8fafc] rounded-[6px] px-[6px] py-[4px] -mx-[6px] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-['Geist:Medium',sans-serif] text-[#475569] text-[12px]">
                          {MESES_CORTOS[h.mes - 1]}
                          {h.mes === mes && h.anio === anio ? " *" : ""}
                        </p>
                        <p className="font-['Geist:Medium',sans-serif] text-[#0f172a] text-[12px]">
                          {formatMontoCorto(h.ventas.total)}
                        </p>
                      </div>

                      <div
                        className="h-[5px] rounded-full"
                        style={{ background: "#f1f5f9" }}
                      >
                        <div
                          className="h-[5px] rounded-full"
                          style={{
                            width: `${(h.ventas.total / maxHistVentas) * 100}%`,
                            background:
                              h.resultado.neto >= 0 ? "#10b981" : "#ef4444",
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}