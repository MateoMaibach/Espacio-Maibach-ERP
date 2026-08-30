import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";

const statCards = [
  {
    label: "Ventas del Mes",
    value: "$4.850.000",
    delta: "+12.4% vs mes pasado",
    deltaColor: "#10B981",
    icon: (
      <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
        <path d="M17.5 13.3333V16.6667C17.5 16.8877 17.4122 17.0996 17.2559 17.2559C17.0996 17.4122 16.8877 17.5 16.6667 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 4.16667 2.5H15C15.221 2.5 15.433 2.5878 15.5893 2.74408C15.7455 2.90036 15.8333 3.11232 15.8333 3.33333V5.83333M2.5 4.16667C2.5 4.60869 2.67559 5.03262 2.98816 5.34518C3.30072 5.65774 3.72464 5.83333 4.16667 5.83333H16.6667C16.8877 5.83333 17.0996 5.92113 17.2559 6.07741C17.4122 6.23369 17.5 6.44565 17.5 6.66667V10M17.5 10H15C14.558 10 14.134 10.1756 13.8215 10.4882C13.5089 10.8007 13.3333 11.2246 13.3333 11.6667C13.3333 12.1087 13.5089 12.5326 13.8215 12.8452C14.134 13.1577 14.558 13.3333 15 13.3333H17.5M17.5 10C17.721 10 17.933 10.0878 18.0893 10.2441C18.2455 10.4004 18.3333 10.6123 18.3333 10.8333V12.5C18.3333 12.721 18.2455 12.933 18.0893 13.0893C17.933 13.2455 17.721 13.3333 17.5 13.3333" stroke="#475569" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    ),
    iconBg: "#f0fdf4",
    border: "1px solid #e2e8f0",
  },
  {
    label: "Pedidos Activos",
    value: "12",
    delta: "+2 instalaciones activas",
    deltaColor: "#10B981",
    icon: (
      <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
        <path d="M18.334 10.8332V5.834H13.3336M18.334 5.834L11.2501 12.9162L7.0831 8.7502L1.666 14.166" stroke="#475569" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    ),
    iconBg: "#f0fdf4",
    border: "1px solid #e2e8f0",
  },
  {
    label: "Clientes Morosos",
    value: "3 Clientes",
    delta: "Atención requiere atención",
    deltaColor: "#F59E0B",
    icon: (
      <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
        <path d="M9.99998 6.74945V9.74945M9.99998 12.7495H10.0075M16.2978 13.4996L10.2978 2.99962C10.167 2.76878 9.97725 2.57676 9.74799 2.44317C9.51873 2.30958 9.25814 2.2392 8.9928 2.2392C8.72746 2.2392 8.46686 2.30958 8.2376 2.44317C8.00834 2.57676 7.81862 2.76878 7.6878 2.99962L1.6878 13.4996C1.55556 13.7286 1.48622 13.9885 1.4868 14.253C1.48739 14.5175 1.55788 14.7771 1.69113 15.0055C1.82438 15.2339 2.01566 15.4231 2.24557 15.5537C2.47548 15.6844 2.73585 15.752 3.0003 15.7496H15.0003C15.2635 15.7494 15.5219 15.6798 15.7498 15.5481C15.9776 15.4163 16.1667 15.2269 16.2982 14.999C16.4297 14.771 16.4988 14.5124 16.4988 14.2492C16.4987 13.9861 16.4294 13.7275 16.2978 13.4996Z" stroke="#F59E0B" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    ),
    iconBg: "#fffbeb",
    border: "1px solid #F59E0B",
    highlight: true,
  },
  {
    label: "Caja Disponible",
    value: "$1.230.500",
    delta: "+8.2% en cuentas",
    deltaColor: "#10B981",
    icon: (
      <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
        <path d="M1.666 8.33314H18.334M3.3328 4.166H16.6672C17.5877 4.166 18.334 4.91228 18.334 5.83286V14.1671C18.334 15.0877 17.5877 15.834 16.6672 15.834H3.3328C2.41225 15.834 1.666 15.0877 1.666 14.1671V5.83286C1.666 4.91228 2.41225 4.166 3.3328 4.166Z" stroke="#475569" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    ),
    iconBg: "#f0f9ff",
    border: "1px solid #e2e8f0",
  },
];

const chartData = [
  { month: "Mar", value: 2100000, label: "$2.1M" },
  { month: "Abr", value: 2500000, label: "$2.5M" },
  { month: "May", value: 3200000, label: "$3.2M" },
  { month: "Jun", value: 3800000, label: "$3.8M" },
  { month: "Jul", value: 4100000, label: "$4.1M" },
  { month: "Ago", value: 4800000, label: "$4.8M" },
];

const maxVal = Math.max(...chartData.map((d) => d.value));

const proximas = [
  { cliente: "García, Roberto", producto: "Pileta Modelo Roma 6x3", fecha: "15 Ago, 2024", estado: "Confirmada" },
  { cliente: "Albornoz, Lucía", producto: "Pileta Modelo Ibiza 7x3.5", fecha: "18 Ago, 2024", estado: "Confirmada" },
  { cliente: "Rodríguez, Juan", producto: "Pileta Modelo Venecia 5x2.5", fecha: "22 Ago, 2024", estado: "Pendiente" },
];

const chequesData = [
  { banco: "Banco Galicia", numero: "CHQ-002931", monto: "$450.000", vencimiento: "En 2 días (14 Ago)" },
  { banco: "Nuevo Banco de Entre Ríos", numero: "CHQ-004822", monto: "$320.000", vencimiento: "En 5 días (17 Ago)" },
  { banco: "Banco Nación", numero: "CHQ-001202", monto: "$600.000", vencimiento: "En 8 días (20 Ago)" },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio" }, { label: "Dashboard" }]}>
      <div className="flex flex-col gap-[24px] p-[32px]">
        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-[20px]">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-white flex flex-col gap-[12px] p-[20px] rounded-[12px]"
              style={{ border: card.border }}
            >
              <div className="flex items-center justify-between">
                <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[14px]">{card.label}</p>
                <div className="flex items-center justify-center size-[36px] rounded-[8px]" style={{ background: card.iconBg }}>
                  {card.icon}
                </div>
              </div>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[28px]">
                {card.value}
              </p>
              <p className="font-['Geist:Regular',sans-serif] font-normal text-[13px]" style={{ color: card.deltaColor }}>
                ↑ {card.delta}
              </p>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-[1fr_320px] gap-[24px]">
          {/* Chart */}
          <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-start justify-between mb-[8px]">
              <div>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Ventas Últimos 6 Meses</p>
                <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[13px] mt-[4px]">Facturación mensual en pesos argentinos</p>
              </div>
              <div className="flex items-center gap-[6px]">
                <div className="size-[8px] rounded-full bg-[#0ea5e9]" />
                <p className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">Ventas ($)</p>
              </div>
            </div>
            <div className="flex items-end gap-[16px] h-[200px] mt-[24px]">
              {chartData.map((d, i) => {
                const heightPct = (d.value / maxVal) * 100;
                return (
                  <div key={i} className="flex flex-col items-center gap-[8px] flex-1">
                    <p className="font-['Geist:Regular',sans-serif] text-[11px] text-[#475569]">{d.label}</p>
                    <div
                      className="w-full rounded-t-[4px] bg-[#0ea5e9]"
                      style={{ height: `${heightPct * 1.6}px` }}
                    />
                    <p className="font-['Geist:Regular',sans-serif] text-[12px] text-[#475569]">{d.month}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Próximas Instalaciones */}
          <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between mb-[16px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Próximas Instalaciones</p>
              <button
                onClick={() => navigate("/calendario")}
                className="font-['Geist:Medium',sans-serif] font-medium text-[#0ea5e9] text-[13px] hover:underline"
              >
                Ver Agenda
              </button>
            </div>
            <div className="flex flex-col gap-[12px]">
              {proximas.map((p, i) => (
                <div key={i} className="flex items-start justify-between p-[12px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
                  <div>
                    <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{p.cliente}</p>
                    <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[12px] mt-[2px]">{p.producto}</p>
                    <p className="font-['Geist:Regular',sans-serif] font-normal text-[#94a3b8] text-[12px] mt-[2px]">{p.fecha}</p>
                  </div>
                  <span
                    className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[8px] py-[3px] rounded-[6px]"
                    style={
                      p.estado === "Confirmada"
                        ? { background: "#d1fae5", color: "#10b981" }
                        : { background: "#fef3c7", color: "#f59e0b" }
                    }
                  >
                    {p.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cheques */}
        <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
          <div className="flex items-center justify-between mb-[4px]">
            <div>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Alertas de Cheques a Vencer</p>
              <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[13px] mt-[2px]">Cheques en cartera próximos a ser depositados</p>
            </div>
            <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[11px] px-[10px] py-[4px] rounded-[6px] bg-[#fef2f2] text-[#ef4444]">Crítico</span>
          </div>
          <table className="w-full mt-[16px]">
            <thead>
              <tr>
                {["Banco", "Número", "Monto", "Vencimiento", "Estado"].map((h) => (
                  <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px] border-b border-[#e2e8f0]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chequesData.map((c, i) => (
                <tr key={i} className="border-b border-[#f1f5f9] last:border-0">
                  <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[14px]">{c.banco}</td>
                  <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] py-[14px]">{c.numero}</td>
                  <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px] py-[14px]">{c.monto}</td>
                  <td className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#f59e0b] text-[14px] py-[14px]">{c.vencimiento}</td>
                  <td className="py-[14px]">
                    <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px] bg-[#fef3c7] text-[#f59e0b]">Pendiente</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
