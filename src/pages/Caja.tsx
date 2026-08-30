import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconPlus } from "@/components/Icons";

const summaryCards = [
  { label: "Efectivo", value: "$450.000", iconBg: "#dbeafe", iconColor: "#3b82f6" },
  { label: "Dólares", value: "US$2.500", iconBg: "#d1fae5", iconColor: "#10b981" },
  { label: "Bancos", value: "$780.000", iconBg: "#ede9fe", iconColor: "#7c3aed" },
  { label: "Cheques en Cartera", value: "$320.000", iconBg: "#fef3c7", iconColor: "#f59e0b" },
];

const movimientos = [
  { fecha: "15 Ago, 2026", concepto: "Cobro Seña...", subCaja: "Efectivo", ingreso: "$150.000", egreso: "-", saldo: "$450.000" },
  { fecha: "15 Ago, 2026", concepto: "Pago Provee...", subCaja: "Bancos", ingreso: "-", egreso: "$85.000", saldo: "$780.000", egresoRed: true },
  { fecha: "14 Ago, 2026", concepto: "Cobro Resta...", subCaja: "Cheques", ingreso: "$320.000", egreso: "-", saldo: "$320.000" },
  { fecha: "14 Ago, 2026", concepto: "Compra de F...", subCaja: "Bancos", ingreso: "-", egreso: "$450.000", saldo: "$865.000", egresoRed: true },
  { fecha: "13 Ago, 2026", concepto: "Depósito Efe...", subCaja: "Bancos", ingreso: "$200.000", egreso: "-", saldo: "$1.315.000" },
  { fecha: "13 Ago, 2026", concepto: "Pago Logísti...", subCaja: "Efectivo", ingreso: "-", egreso: "$35.000", saldo: "$300.000", egresoRed: true },
  { fecha: "12 Ago, 2026", concepto: "Venta Acces...", subCaja: "Efectivo", ingreso: "$48.500", egreso: "-", saldo: "$335.000" },
  { fecha: "11 Ago, 2026", concepto: "Retiro de So...", subCaja: "Efectivo", ingreso: "-", egreso: "$15.000", saldo: "$286.500", egresoRed: true },
];

const donutData = [
  { label: "Bancos (50%)", color: "#0ea5e9", pct: 50 },
  { label: "Efectivo (28%)", color: "#f59e0b", pct: 28 },
  { label: "Cheques (22%)", color: "#10b981", pct: 22 },
];

function DonutChart() {
  const total = 100;
  let cumulative = 0;
  const radius = 60;
  const cx = 80;
  const cy = 80;
  const strokeWidth = 22;

  const arcs = donutData.map((d) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.pct;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = d.pct > 50 ? 1 : 0;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    return { ...d, d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}` };
  });

  return (
    <div className="flex flex-col items-center gap-[16px]">
      <div className="relative">
        <svg width="160" height="160">
          {arcs.map((arc, i) => (
            <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={strokeWidth} />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className="font-['Geist:Bold']" style={{ fontSize: 16, fontWeight: 700, fill: "#0f172a" }}>$1.55M</text>
        </svg>
      </div>
      <div className="flex flex-col gap-[6px]">
        {donutData.map((d, i) => (
          <div key={i} className="flex items-center gap-[8px]">
            <div className="size-[10px] rounded-full" style={{ background: d.color }} />
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Caja() {
  const navigate = useNavigate();
  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Caja" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Caja</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración de flujos de caja y libro diario</p>
          </div>
          <div className="flex items-center gap-[12px]">
            <div className="flex items-center gap-[8px] bg-white px-[12px] py-[8px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
              <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                <path d="M5.33333 1.334V4M10.6667 1.334V4M2 6.667H14M3.33333 2.667H12.6667C13.403 2.667 14 3.264 14 4V13.333C14 14.07 13.403 14.667 12.6667 14.667H3.33333C2.59695 14.667 2 14.07 2 13.333V4C2 3.264 2.59695 2.667 3.33333 2.667Z" stroke="#475569" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
              <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[14px]">Agosto 2026</p>
            </div>
            <button className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
              <IconPlus />
              Nuevo Movimiento
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-[20px]">
          {summaryCards.map((card, i) => (
            <div key={i} className="bg-white flex items-center justify-between p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div>
                <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px]">{card.label}</p>
                <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[22px] mt-[4px]">{card.value}</p>
              </div>
              <div className="flex items-center justify-center size-[40px] rounded-[8px]" style={{ background: card.iconBg }}>
                <div className="size-[20px]" style={{ color: card.iconColor }}>
                  <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
                    <rect x="2" y="4" width="16" height="13" rx="2" stroke={card.iconColor} strokeWidth="1.5" />
                    <path d="M2 8H18" stroke={card.iconColor} strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-[1fr_300px] gap-[24px]">
          {/* Libro Diario */}
          <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mb-[16px]">Libro Diario</p>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Fecha", "Concepto", "Sub-Caja", "Ingreso", "Egreso", "Saldo"].map((h) => (
                    <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] py-[8px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] py-[12px]">{m.fecha}</td>
                    <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] py-[12px]">{m.concepto}</td>
                    <td className="font-['Geist:Regular',sans-serif] text-[#475569] text-[13px] py-[12px]">{m.subCaja}</td>
                    <td className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#10b981] text-[13px] py-[12px]">{m.ingreso !== "-" ? m.ingreso : <span className="text-[#94a3b8]">-</span>}</td>
                    <td className={`font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] py-[12px] ${m.egresoRed ? "text-[#ef4444]" : "text-[#94a3b8]"}`}>{m.egreso}</td>
                    <td className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[13px] py-[12px]">{m.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-[20px]">
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px] mb-[16px]">Resumen Ganancias</p>
              {[
                { label: "Total Ingresos", value: "$718.500", color: "#10b981" },
                { label: "Total Egresos", value: "$585.000", color: "#ef4444" },
                { label: "Ganancia Neta", value: "$133.500", color: "#10b981", highlight: true },
              ].map((r) => (
                <div key={r.label} className={`flex items-center justify-between py-[10px] px-[12px] rounded-[8px] mb-[6px] ${r.highlight ? "bg-[#d1fae5]" : ""}`}>
                  <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{r.label}</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[14px]" style={{ color: r.color }}>{r.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[15px] mb-[16px]">Distribución por Sub-Caja</p>
              <DonutChart />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
