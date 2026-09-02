import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import { proveedores } from "@/data/proveedores";

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Inactivo: { bg: "#e2e8f0", color: "#64748b" },
  Suspendido: { bg: "#fee2e2", color: "#ef4444" },
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
};

const rubros = ["Todos", "Bombas", "Piletas", "Accesorios", "Químicos", "Herramientas"];
const estados = ["Todos", "Activo", "Inactivo", "Suspendido", "Pendiente"];

const summaryItems = [
  { label: "Total Proveedores", value: "8", color: "#0ea5e9" },
  { label: "Activos", value: "5", color: "#10b981" },
  { label: "Pendientes", value: "1", color: "#f59e0b" },
  { label: "Suspendidos / Inactivos", value: "2", color: "#ef4444" },
];

export default function Proveedores() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [rubro, setRubro] = useState("Todos");
  const [estado, setEstado] = useState("Todos");

  const filtered = proveedores.filter((p) => {
    const matchSearch = p.razonSocial.toLowerCase().includes(search.toLowerCase()) || p.cuit.toLowerCase().includes(search.toLowerCase());
    const matchRubro = rubro === "Todos" || p.rubro === rubro;
    const matchEstado = estado === "Todos" || p.estado === estado;
    return matchSearch && matchRubro && matchEstado;
  });

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Proveedores" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Proveedores</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Gestión de proveedores, datos bancarios y seguimiento de compras</p>
          </div>
          <button className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
            <IconPlus />
            Nuevo Proveedor
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
            <IconSearch color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar por razón social o CUIT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
            />
          </div>
          <select
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {rubros.map((r) => <option key={r}>Rubro: {r}</option>)}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {estados.map((e) => <option key={e}>Estado: {e}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[12px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["Razón Social", "CUIT", "Contacto", "Rubro", "Localidad", "Último Pedido", "Estado"].map((h) => (
                  <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/proveedores/${p.id}`)}
                  className="hover:bg-[#f8fafc] transition-colors cursor-pointer"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}
                >
                  <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{p.razonSocial}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{p.cuit}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">{p.contacto}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{p.rubro}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{p.localidad}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{p.ultimoPedido}</td>
                  <td className="px-[20px] py-[16px]">
                    <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]" style={estadoStyle[p.estado]}>
                      {p.estado}
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
