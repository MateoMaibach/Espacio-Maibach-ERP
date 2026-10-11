import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AppLayout from "@/layouts/AppLayout";
import {
  getDashboard,
  type Dashboard,
  type DashboardCheque,
  type DashboardMoroso,
} from "@/services/api";
import {
  formatDias,
  formatFecha,
  formatMonto,
  formatMontoCorto,
} from "@/utils/format";

function IconVentas() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M2.5 4.16667C2.5 2.97543 3.47543 2 4.66667 2H15C15.221 2 15.433 2.0878 15.5893 2.2448C15.7455 2.4018 15.8333 2.6138 15.8333 2.83333V4.16667"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M2.5 4.16667C2.5 3.75543 2.82464 3.39994 3.2164 3.29956C3.58985 3.2042 3.97557 3.16399 4.36385 3.18069C6.10304 3.26884 7.78913 3.60539 9.34232 4.16447C9.62826 4.23565 9.62826 4.76435 9.34232 4.83553C7.78913 5.39461 6.10304 5.73116 4.36385 5.81931C3.7183 5.85034 3.10346 6.03236 2.5562 6.36461C2.51527 6.38461 2.5 6.43163 2.5 6.47461V15.8333C2.5 16.2754 2.72464 16.6754 3.04816 16.8986C3.37167 17.1219 3.77167 17.2452 4.21365 17.2452H15.7864C16.2283 17.2452 16.6283 17.1219 16.9518 16.8986C17.2754 16.6754 17.5 16.2754 17.5 15.8333V4.16667C17.5 3.75543 17.1754 3.39994 16.7836 3.29956"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconCobrar() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M1.666 8.33314H18.334M3.3328 4.166H16.6672C17.5877 4.166 18.334 4.91228 18.334 5.83286V14.1671C18.334 15.0877 17.5877 15.834 16.6672 15.834H3.3328C2.41225 15.834 1.666 15.0877 1.666 14.1671V5.83286C1.666 4.91228 2.41225 4.166 3.3328 4.166Z"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconAlerta() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M9.99998 6.74945V9.74945M9.99998 12.7495H10.0075M16.2978 13.4996L10.2978 2.99962C10.167 2.76878 9.97725 2.57676 9.74799 2.44317C9.51873 2.30958 9.25814 2.2392 8.9928 2.2392C8.72746 2.2392 8.46686 2.30958 8.2376 2.44317C8.00834 2.57676 7.81862 2.76878 7.6878 2.99962L1.6878 13.4996C1.55556 13.7286 1.48622 13.9885 1.4868 14.253C1.48739 14.5175 1.55788 14.7771 1.69113 15.0055C1.82438 15.2339 2.01566 15.4231 2.24557 15.5537C2.47548 15.6844 2.73585 15.752 3.0003 15.7496H15.0003C15.2635 15.7494 15.5219 15.6798 15.7498 15.5481C15.9776 15.4163 16.1667 15.2269 16.2982 14.999C16.4297 14.771 16.4988 14.5124 16.4988 14.2492C16.4987 13.9861 16.4294 13.7275 16.2978 13.4996Z"
        stroke="#F59E0B"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconCaja() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M17.5 13.3333V16.6667C17.5 16.8877 17.4122 17.0996 17.2559 17.2559C17.0996 17.4122 16.8877 17.5 16.6667 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H15C15.221 2.5 15.433 2.5878 15.5893 2.74408C15.7455 2.90036 15.8333 3.11232 15.8333 3.33333V5.83333M2.5 4.16667C2.5 4.60869 2.67559 5.03262 2.98816 5.34518C3.30072 5.65774 3.72464 5.83333 4.16667 5.83333H16.6667C16.8877 5.83333 17.0996 5.92113 17.2559 6.07741C17.4122 6.23369 17.5 6.44565 17.5 6.66667V10M17.5 10H15C14.558 10 14.134 10.1756 13.8215 10.4882C13.5089 10.8007 13.3333 11.2246 13.3333 11.6667C13.3333 12.1087 13.5089 12.5326 13.8215 12.8452C14.134 13.1577 14.558 13.3333 15 13.3333H17.5M17.5 10C17.721 10 17.933 10.0878 18.0893 10.2441C18.2455 10.4004 18.3333 10.6123 18.3333 10.8333V12.5C18.3333 12.721 18.2455 12.933 18.0893 13.0893C17.933 13.2455 17.721 13.3333 17.5 13.3333"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconProveedor() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M2.5 7.5L10 2.5L17.5 7.5V16.6667C17.5 17.2209 17.0538 17.6667 16.5 17.6667H3.5C2.94516 17.6667 2.5 17.2209 2.5 16.6667V7.5Z"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconStock() {
  return (
    <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
      <path
        d="M10 2.08333L17.5 6.25V15.8333L10 20L2.5 15.8333V6.25L10 2.08333Z"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M2.5 6.25L10 10.4167L17.5 6.25M10 10.4167V20"
        stroke="#475569"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const ESTADO_AGENDA: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
  Confirmada: { bg: "#dbeafe", color: "#3b82f6" },
  "En Proceso": { bg: "#ede9fe", color: "#7c3aed" },
  Completada: { bg: "#d1fae5", color: "#10b981" },
};

interface StatCard {
  key: string;
  label: string;
  value: string;
  delta: string;
  deltaColor: string;
  icon: React.ReactNode;
  iconBg: string;
  border: string;
  onClick?: () => void;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;

    getDashboard()
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch((e) => {
        if (vivo) {
          setError(
            e instanceof Error ? e.message : "Error al cargar el dashboard",
          );
        }
      })
      .finally(() => {
        if (vivo) setLoading(false);
      });

    return () => {
      vivo = false;
    };
  }, []);

  if (loading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Inicio" }, { label: "Dashboard" }]}>
        <div className="p-[32px]">
          <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
            Cargando dashboard...
          </p>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout breadcrumbs={[{ label: "Inicio" }, { label: "Dashboard" }]}>
        <div className="p-[32px]">
          <div
            className="bg-[#fef2f2] rounded-[12px] p-[20px]"
            style={{ border: "1px solid #ef4444" }}
          >
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#b91c1c] text-[15px]">
              No se pudo cargar el dashboard
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#7f1d1d] text-[13px] mt-[6px]">
              {error}
            </p>
            <p className="font-['Geist:Regular',sans-serif] text-[#991b1b] text-[12px] mt-[10px]">
              Verificá que el backend esté corriendo en el puerto 3001.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { kpis, serieVentas, morosos, chequesAVencer, agenda, contadores } = data;

  const maxSerie = Math.max(...serieVentas.map((s) => s.total), 1);

  const variacion = kpis.variacionVentas;
  const variacionTexto =
    variacion === null
      ? "sin base de comparación"
      : `${variacion > 0 ? "+" : ""}${variacion}% vs mes anterior`;

  const cards: StatCard[] = [
    {
      key: "ventas",
      label: "Ventas del Mes",
      value: formatMonto(kpis.ventasMes),
      delta: variacionTexto,
      deltaColor:
        variacion === null
          ? "#94a3b8"
          : variacion >= 0
            ? "#10B981"
            : "#ef4444",
      icon: <IconVentas />,
      iconBg: "#f0fdf4",
      border: "1px solid #e2e8f0",
    },
    {
      key: "cobrar",
      label: "Por Cobrar",
      value: formatMonto(kpis.porCobrar),
      delta: `${formatMonto(kpis.montoVencido)} vencido · ${kpis.clientesActivos} clientes activos`,
      deltaColor: kpis.montoVencido > 0 ? "#F59E0B" : "#64748b",
      icon: <IconCobrar />,
      iconBg: "#f0f9ff",
      border: "1px solid #e2e8f0",
      onClick: () => navigate("/clientes"),
    },
    {
      key: "morosos",
      label: "Cuotas Vencidas",
      value: `${kpis.cuotasVencidas}`,
      delta:
        kpis.cuotasVencidas > 0
          ? `${morosos.length} clientes con atraso`
          : "Sin cuotas atrasadas",
      deltaColor: kpis.cuotasVencidas > 0 ? "#F59E0B" : "#10B981",
      icon: <IconAlerta />,
      iconBg: "#fffbeb",
      border: kpis.cuotasVencidas > 0 ? "1px solid #F59E0B" : "1px solid #e2e8f0",
      onClick: () => navigate("/clientes"),
    },
    {
      key: "caja",
      label: "Resultado de Caja",
      value: formatMonto(kpis.gananciaNeta),
      delta: `${formatMonto(kpis.cajaIngresos)} ingresos · ${formatMonto(kpis.cajaEgresos)} egresos`,
      deltaColor: kpis.gananciaNeta >= 0 ? "#10B981" : "#ef4444",
      icon: <IconCaja />,
      iconBg: "#f0fdf4",
      border: "1px solid #e2e8f0",
      onClick: () => navigate("/caja"),
    },
    {
      key: "proveedores",
      label: "Cuentas a Pagar",
      value: formatMonto(kpis.cuentasAPagar),
      delta: `${kpis.proveedoresConSaldo} proveedores con saldo`,
      deltaColor: kpis.cuentasAPagar > 0 ? "#ef4444" : "#10B981",
      icon: <IconProveedor />,
      iconBg: "#fef2f2",
      border: "1px solid #e2e8f0",
      onClick: () => navigate("/proveedores"),
    },
    {
      key: "stock",
      label: "Valor de Stock",
      value: formatMontoCorto(kpis.valorStock),
      delta:
        kpis.itemsStockNegativo > 0
          ? `${kpis.itemsStockNegativo} artículos en negativo`
          : `${kpis.articulosActivos} artículos · ${kpis.depositosActivos} depósitos`,
      deltaColor: kpis.itemsStockNegativo > 0 ? "#ef4444" : "#64748b",
      icon: <IconStock />,
      iconBg: "#f5f3ff",
      border: "1px solid #e2e8f0",
      onClick: () => navigate("/stock"),
    },
  ];

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio" }, { label: "Dashboard" }]}>
      <div className="flex flex-col gap-[24px] p-[32px]">
        {/* Stat Cards */}
        <div className="grid grid-cols-6 gap-[16px]">
          {cards.map((card) => (
            <div
              key={card.key}
              onClick={card.onClick}
              className="bg-white flex flex-col gap-[12px] p-[18px] rounded-[12px]"
              style={{
                border: card.border,
                cursor: card.onClick ? "pointer" : "default",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px]">
                  {card.label}
                </p>
                <div
                  className="flex items-center justify-center size-[32px] rounded-[8px] shrink-0"
                  style={{ background: card.iconBg }}
                >
                  {card.icon}
                </div>
              </div>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[22px]">
                {card.value}
              </p>
              <p
                className="font-['Geist:Regular',sans-serif] font-normal text-[12px] leading-[1.35]"
                style={{ color: card.deltaColor }}
              >
                {card.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Gráfico + Agenda */}
        <div className="grid grid-cols-[1fr_360px] gap-[24px]">
          <div
            className="bg-white p-[20px] rounded-[12px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-start justify-between mb-[8px]">
              <div>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                  Facturación Últimos 6 Meses
                </p>
                <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[13px] mt-[4px]">
                  Total de los ficheros-commercial de cada mes
                </p>
              </div>
              <div className="flex items-center gap-[6px]">
                <div className="size-[8px] rounded-full bg-[#0ea5e9]" />
                <p className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">
                  Facturado ($)
                </p>
              </div>
            </div>

            <div className="flex items-end gap-[16px] h-[220px] mt-[24px]">
              {serieVentas.map((s) => {
                const pct = (s.total / maxSerie) * 100;

                return (
                  <div
                    key={s.clave}
                    className="flex flex-col items-center gap-[8px] flex-1"
                  >
                    <p className="font-['Geist:Regular',sans-serif] text-[11px] text-[#475569]">
                      {formatMontoCorto(s.total)}
                    </p>
                    <div
                      className="w-full rounded-t-[4px] bg-[#0ea5e9] min-h-[2px]"
                      style={{ height: `${Math.max(pct * 1.7, 2)}px` }}
                    />
                    <p className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">
                      {s.mes}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Agenda */}
          <div
            className="bg-white p-[20px] rounded-[12px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center justify-between mb-[16px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                Próximos Trabajos
              </p>
              <button
                onClick={() => navigate("/calendario")}
                className="font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[13px] hover:underline"
              >
                Ver Agenda
              </button>
            </div>

            <div className="flex flex-col gap-[10px]">
              {agenda.length === 0 ? (
                <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                  No hay instalaciones ni veredas pendientes.
                </p>
              ) : (
                agenda.map((a) => (
                  <div
                    key={`${a.tipo}-${a.id}`}
                    className="flex items-start justify-between gap-[8px] p-[12px] rounded-[8px]"
                    style={{ border: "1px solid #e2e8f0" }}
                  >
                    <div className="min-w-0">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">
                        {a.tipo === "instalacion" ? "Instalación" : "Vereda"}
                      </p>
                      <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px] mt-[2px]">
                        {formatFecha(a.fecha)}
                        {a.equipo ? ` · ${a.equipo}` : ""}
                      </p>
                    </div>
                    <span
                      className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px] shrink-0"
                      style={
                        ESTADO_AGENDA[a.estado] ?? {
                          bg: "#e2e8f0",
                          color: "#64748b",
                        }
                      }
                    >
                      {a.estado}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-[10px] mt-[16px] pt-[14px]" style={{ borderTop: "1px solid #f1f5f9" }}>
              <span className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">
                Inst. pendientes: {contadores.instalacionesPendientes}
              </span>
              <span className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">
                Confirmadas: {contadores.instalacionesConfirmadas}
              </span>
              <span className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">
                Veredas: {contadores.veredasPendientes}
              </span>
            </div>
          </div>
        </div>

        {/* Morosos + Cheques */}
        <div className="grid grid-cols-2 gap-[24px]">
          <div
            className="bg-white p-[20px] rounded-[12px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-start justify-between mb-[4px]">
              <div>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                  Clientes con Cuotas Vencidas
                </p>
                <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[13px] mt-[2px]">
                  {kpis.cuotasVencidas} cuotas por {formatMonto(kpis.montoVencido)}
                </p>
              </div>
              <span
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[10px] py-[4px] rounded-[6px] text-[12px]"
                style={
                  morosos.length > 0
                    ? { background: "#fef2f2", color: "#ef4444" }
                    : { background: "#d1fae5", color: "#10b981" }
                }
              >
                {morosos.length > 0 ? `${morosos.length} clientes` : "Al día"}
              </span>
            </div>

            <table className="w-full mt-[16px]">
              <thead>
                <tr>
                  {["Cliente", "Cuotas", "Monto vencido"].map((h) => (
                    <th
                      key={h}
                      className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px] border-b border-[#e2e8f0]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {morosos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] py-[16px] text-center"
                    >
                      Ningún cliente tiene cuotas vencidas.
                    </td>
                  </tr>
                ) : (
                  morosos.map((m: DashboardMoroso) => (
                    <tr
                      key={m.clienteId}
                      className="border-b border-[#f1f5f9] last:border-0 cursor-pointer hover:bg-[#f8fafc]"
                      onClick={() => navigate(`/clientes/${m.clienteId}`)}
                    >
                      <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[12px]">
                        {m.cliente}
                      </td>
                      <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] py-[12px]">
                        {m.cuotas}
                      </td>
                      <td className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#ef4444] text-[14px] py-[12px]">
                        {formatMonto(m.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            className="bg-white p-[20px] rounded-[12px]"
            style={{ border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-start justify-between mb-[4px]">
              <div>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                  Cheques a Vencer
                </p>
                <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[13px] mt-[2px]">
                  Próximos 7 días · cartera {formatMonto(kpis.carteraCheques)}
                </p>
              </div>
              <span
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[10px] py-[4px] rounded-[6px] text-[12px]"
                style={
                  chequesAVencer.length > 0
                    ? { background: "#fef2f2", color: "#ef4444" }
                    : { background: "#d1fae5", color: "#10b981" }
                }
              >
                {chequesAVencer.length > 0
                  ? `${chequesAVencer.length} próximos`
                  : "Sin vencimientos"}
              </span>
            </div>

            <table className="w-full mt-[16px]">
              <thead>
                <tr>
                  {["Banco", "Número", "Monto", "Vence", "Tipo"].map((h) => (
                    <th
                      key={h}
                      className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px] border-b border-[#e2e8f0]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chequesAVencer.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px] py-[16px] text-center"
                    >
                      Ningún cheque vence en los próximos 7 días.
                    </td>
                  </tr>
                ) : (
                  chequesAVencer.map((c: DashboardCheque) => (
                    <tr
                      key={c.id}
                      className="border-b border-[#f1f5f9] last:border-0 cursor-pointer hover:bg-[#f8fafc]"
                      onClick={() => navigate("/cheques")}
                    >
                      <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[12px]">
                        {c.banco}
                      </td>
                      <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] py-[12px]">
                        {c.numero}
                      </td>
                      <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[12px]">
                        {formatMonto(c.importe)}
                      </td>
                      <td className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#f59e0b] text-[13px] py-[12px]">
                        {formatDias(c.diasParaCobro)}
                      </td>
                      <td className="py-[12px]">
                        <span
                          className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px]"
                          style={
                            c.tipo === "recibido"
                              ? { background: "#d1fae5", color: "#10b981" }
                              : { background: "#fef3c7", color: "#f59e0b" }
                          }
                        >
                          {c.tipo === "recibido" ? "Recibido" : "Emitido"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
