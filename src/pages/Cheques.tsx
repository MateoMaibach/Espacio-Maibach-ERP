import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";

const cheques = [
  { banco: "Banco Galicia", nro: "CHQ-002931", emisor: "García, Roberto", fechaEmision: "05/08/2026", fechaCobro: "25/08/2026", monto: "$450.000", estado: "En Cartera" },
  { banco: "Banco Nación", nro: "CHQ-001202", emisor: "Albornoz, Lucía", fechaEmision: "01/08/2026", fechaCobro: "18/08/2026", monto: "$600.000", estado: "Depositado" },
  { banco: "Nuevo Banco de Entre Ríos", nro: "CHQ-004822", emisor: "Rodríguez, Juan", fechaEmision: "10/08/2026", fechaCobro: "30/08/2026", monto: "$320.000", estado: "En Cartera" },
  { banco: "Banco Santander", nro: "CHQ-008912", emisor: "Sánchez, Fernando", fechaEmision: "28/07/2026", fechaCobro: "15/08/2026", monto: "$150.000", estado: "Rechazado" },
  { banco: "Banco Macro", nro: "CHQ-009123", emisor: "Pérez, Estela", fechaEmision: "15/07/2026", fechaCobro: "10/08/2026", monto: "$280.000", estado: "Entregado" },
  { banco: "Banco BBVA", nro: "CHQ-003481", emisor: "Gómez, María", fechaEmision: "20/07/2026", fechaCobro: "22/08/2026", monto: "$390.000", estado: "Depositado" },
  { banco: "Banco Galicia", nro: "CHQ-005612", emisor: "Martínez, Carlos", fechaEmision: "02/08/2026", fechaCobro: "28/08/2026", monto: "$120.000", estado: "En Cartera" },
  { banco: "Banco Nación", nro: "CHQ-007788", emisor: "Busto, Alejandro", fechaEmision: "22/07/2026", fechaCobro: "12/08/2026", monto: "$500.000", estado: "Entregado" },
];

const estadoStyle: Record<string, { bg: string; color: string }> = {
  "En Cartera": { bg: "#dbeafe", color: "#3b82f6" },
  Depositado: { bg: "#d1fae5", color: "#10b981" },
  Rechazado: { bg: "#fee2e2", color: "#ef4444" },
  Entregado: { bg: "#ede9fe", color: "#7c3aed" },
};

const summaryItems = [
  { label: "Total En Cartera", value: "$890.000", color: "#3b82f6" },
  { label: "Total Entregados", value: "$780.000", color: "#7c3aed" },
  { label: "Total Depositados", value: "$990.000", color: "#10b981" },
  { label: "Total Rechazados", value: "$150.000", color: "#ef4444" },
];

export default function Cheques() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [banco, setBanco] = useState("Todos");

  const bancos = ["Todos", ...Array.from(new Set(cheques.map((c) => c.banco)))];
  const estados = ["Todos", "En Cartera", "Depositado", "Entregado", "Rechazado"];

  const filtered = cheques.filter((c) => {
    const matchSearch = c.emisor.toLowerCase().includes(search.toLowerCase()) || c.nro.toLowerCase().includes(search.toLowerCase());
    const matchEstado = estado === "Todos" || c.estado === estado;
    const matchBanco = banco === "Todos" || c.banco === banco;
    return matchSearch && matchEstado && matchBanco;
  });

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Cheques" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Cheques</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración, trazabilidad e histórico de cheques de terceros</p>
          </div>
          <button className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
            <IconPlus />
            Registrar Cheque
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
            <IconSearch color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar emisor o nro de cheque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {estados.map((e) => <option key={e}>Estado: {e}</option>)}
          </select>
          <select
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {bancos.map((b) => <option key={b}>Banco: {b}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[12px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["Banco", "Nro Cheque", "Emisor", "Fecha Emisión", "Fecha Cobro", "Monto", "Estado"].map((h) => (
                  <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} className="hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td className="px-[20px] py-[16px] font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px]">{c.banco}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.nro}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">{c.emisor}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.fechaEmision}</td>
                  <td className={`px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[14px] ${c.estado === "Rechazado" ? "text-[#ef4444] font-semibold" : "text-[#475569]"}`}>{c.fechaCobro}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{c.monto}</td>
                  <td className="px-[20px] py-[16px]">
                    <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]" style={estadoStyle[c.estado]}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-[16px]">
          {summaryItems.map((s, i) => (
            <div key={i} className="bg-white flex items-center justify-between px-[20px] py-[14px] rounded-[10px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{s.label}</p>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[16px]" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
