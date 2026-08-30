import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";

const clientes = [
  { id: 1, nombre: "García, Roberto", localidad: "Paraná", telefono: "343-4552912", dni: "30.412.552", ultimoPedido: "05/08/2024", estado: "Activo" },
  { id: 2, nombre: "Rodríguez, Juan", localidad: "Santa Fe", telefono: "342-5129381", dni: "28.914.512", ultimoPedido: "02/08/2024", estado: "Moroso" },
  { id: 3, nombre: "Albornoz, Lucía", localidad: "Rosario", telefono: "341-6921029", dni: "34.102.931", ultimoPedido: "28/07/2024", estado: "Activo" },
  { id: 4, nombre: "Martínez, Carlos", localidad: "Paraná", telefono: "343-4012931", dni: "32.193.123", ultimoPedido: "15/07/2024", estado: "Activo" },
  { id: 5, nombre: "Gómez, María", localidad: "Santo Tomé", telefono: "342-4912039", dni: "27.491.029", ultimoPedido: "10/06/2024", estado: "Inactivo" },
  { id: 6, nombre: "Busto, Alejandro", localidad: "Paraná", telefono: "343-5201931", dni: "33.910.293", ultimoPedido: "01/06/2024", estado: "Activo" },
  { id: 7, nombre: "Pérez, Estela", localidad: "Rosario", telefono: "341-5910293", dni: "29.102.941", ultimoPedido: "15/05/2024", estado: "Inactivo" },
  { id: 8, nombre: "Sánchez, Fernando", localidad: "Oro Verde", telefono: "343-4920193", dni: "31.948.102", ultimoPedido: "02/05/2024", estado: "Moroso" },
];

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Moroso: { bg: "#fef3c7", color: "#f59e0b" },
  Inactivo: { bg: "#fee2e2", color: "#ef4444" },
};

export default function Clientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [localidad, setLocalidad] = useState("Todas");
  const [estado, setEstado] = useState("Todos");

  const filtered = clientes.filter((c) => {
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) || c.dni.includes(search);
    const matchLocalidad = localidad === "Todas" || c.localidad === localidad;
    const matchEstado = estado === "Todos" || c.estado === estado;
    return matchSearch && matchLocalidad && matchEstado;
  });

  const localidades = ["Todas", ...Array.from(new Set(clientes.map((c) => c.localidad)))];
  const estados = ["Todos", "Activo", "Moroso", "Inactivo"];

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Clientes" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Clientes</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración y ficha de contactos de piletas</p>
          </div>
          <button className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
            <IconPlus />
            Nuevo Cliente
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
            <IconSearch color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
            />
          </div>
          <select
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {localidades.map((l) => <option key={l}>Localidad: {l}</option>)}
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
                {["Nombre", "Localidad", "Teléfono", "DNI/CUIT", "Último Pedido", "Estado"].map((h) => (
                  <th key={h} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="cursor-pointer hover:bg-[#f8fafc] transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}
                >
                  <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{c.nombre}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.localidad}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.telefono}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.dni}</td>
                  <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.ultimoPedido}</td>
                  <td className="px-[20px] py-[16px]">
                    <span
                      className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px]"
                      style={estadoStyle[c.estado]}
                    >
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-[20px] py-[12px]" style={{ borderTop: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">Mostrando {filtered.length} de 128 clientes</p>
            <div className="flex items-center gap-[4px]">
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>Anterior</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-white bg-[#0ea5e9]">1</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>2</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
