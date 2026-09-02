import { useState } from "react";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import ClienteFicheroModal from "@/components/ClienteFicheroModal";

interface Cliente {
  id: number;
  nombre: string;
  localidad: string;
  telefono: string;
  dni: string;
  email: string;
  direccion: string;
  ultimoPedido: string;
  estado: string;
  fechaAlta: string;
}

const clientesIniciales: Cliente[] = [
  { id: 1, nombre: "García, Roberto", localidad: "Paraná", telefono: "343-4552912", dni: "30.412.552", email: "rgarcia@gmail.com", direccion: "Calle Los Jacarandás 451", ultimoPedido: "05/08/2024", estado: "Activo", fechaAlta: "12 Ene, 2024" },
  { id: 2, nombre: "Rodríguez, Juan", localidad: "Santa Fe", telefono: "342-5129381", dni: "28.914.512", email: "", direccion: "", ultimoPedido: "02/08/2024", estado: "Moroso", fechaAlta: "20 Mar, 2024" },
  { id: 3, nombre: "Fernández, María", localidad: "Rosario", telefono: "341-5558923", dni: "27.654.321", email: "mfernandez@gmail.com", direccion: "Av. Libertador 1250", ultimoPedido: "15/06/2024", estado: "Activo", fechaAlta: "10 Jun, 2024" },
  { id: 4, nombre: "Martínez, Carlos", localidad: "Paraná", telefono: "343-4012931", dni: "32.193.123", email: "", direccion: "", ultimoPedido: "15/07/2024", estado: "Activo", fechaAlta: "18 Abr, 2024" },
  { id: 5, nombre: "Gómez, María", localidad: "Santo Tomé", telefono: "342-4912039", dni: "27.491.029", email: "", direccion: "", ultimoPedido: "10/06/2024", estado: "Inactivo", fechaAlta: "01 Dic, 2023" },
  { id: 6, nombre: "Busto, Alejandro", localidad: "Paraná", telefono: "343-5201931", dni: "33.910.293", email: "", direccion: "", ultimoPedido: "01/06/2024", estado: "Activo", fechaAlta: "22 May, 2024" },
  { id: 7, nombre: "Pérez, Estela", localidad: "Rosario", telefono: "341-5910293", dni: "29.102.941", email: "", direccion: "", ultimoPedido: "15/05/2024", estado: "Inactivo", fechaAlta: "10 Sep, 2023" },
  { id: 8, nombre: "Sánchez, Fernando", localidad: "Oro Verde", telefono: "343-4920193", dni: "31.948.102", email: "", direccion: "", ultimoPedido: "02/05/2024", estado: "Moroso", fechaAlta: "14 Jul, 2024" },
];

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Moroso: { bg: "#fef3c7", color: "#f59e0b" },
  Inactivo: { bg: "#fee2e2", color: "#ef4444" },
};

const localidadesOptions = ["Paraná", "Santa Fe", "Rosario", "Santo Tomé", "Oro Verde"];

const estadoInicial = { nombre: "", dni: "", telefono: "", email: "", direccion: "", localidad: "Paraná", estado: "Activo" };

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>(clientesIniciales);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [localidad, setLocalidad] = useState("Todas");
  const [estado, setEstado] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(estadoInicial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filtered = clientes.filter((c) => {
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) || c.dni.includes(search);
    const matchLocalidad = localidad === "Todas" || c.localidad === localidad;
    const matchEstado = estado === "Todos" || c.estado === estado;
    return matchSearch && matchLocalidad && matchEstado;
  });

  const localidades = ["Todas", ...Array.from(new Set(clientes.map((c) => c.localidad)))];
  const estados = ["Todos", "Activo", "Moroso", "Inactivo"];

  function handleFormChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!form.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!form.dni.trim()) newErrors.dni = "El DNI/CUIT es obligatorio";
    if (!form.telefono.trim()) newErrors.telefono = "El teléfono es obligatorio";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleCrearCliente() {
    if (!validate()) return;

    const now = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const fechaAlta = `${now.getDate()} ${meses[now.getMonth()]}, ${now.getFullYear()}`;

    const nuevoCliente: Cliente = {
      id: Date.now(),
      nombre: form.nombre.trim(),
      dni: form.dni.trim(),
      telefono: form.telefono.trim(),
      email: form.email.trim(),
      direccion: form.direccion.trim(),
      localidad: form.localidad,
      estado: form.estado,
      ultimoPedido: "-",
      fechaAlta,
    };

    setClientes((prev) => [nuevoCliente, ...prev]);
    setShowModal(false);
    setForm(estadoInicial);
  }

  function handleCloseModal() {
    setShowModal(false);
    setForm(estadoInicial);
    setErrors({});
  }

  const inputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      errors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  return (
    <AppLayout breadcrumbs={[{ label: "Clientes" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Clientes</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración y ficha de contactos de piletas</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]"
          >
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
                  onClick={() => setSelectedClientId(String(c.id))}
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
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">Mostrando {filtered.length} de {clientes.length} clientes</p>
            <div className="flex items-center gap-[4px]">
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>Anterior</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-white bg-[#0ea5e9]">1</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>2</button>
              <button className="px-[10px] py-[6px] rounded-[6px] font-['Geist:Regular',sans-serif] text-[13px] text-[#475569] bg-white hover:bg-[#f8fafc]" style={{ border: "1px solid #e2e8f0" }}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Nuevo Cliente</p>
              <button
                onClick={handleCloseModal}
                className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              {/* Nombre */}
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => handleFormChange("nombre", e.target.value)}
                  placeholder="Ej: García, Roberto"
                  className={inputClass("nombre")}
                  style={{ border: `1px solid ${errors.nombre ? "#ef4444" : "#e2e8f0"}` }}
                />
                {errors.nombre && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.nombre}</p>}
              </div>

              {/* DNI y Teléfono en fila */}
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                    DNI / CUIT *
                  </label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={(e) => handleFormChange("dni", e.target.value)}
                    placeholder="Ej: 30.412.552"
                    className={inputClass("dni")}
                    style={{ border: `1px solid ${errors.dni ? "#ef4444" : "#e2e8f0"}` }}
                  />
                  {errors.dni && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.dni}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) => handleFormChange("telefono", e.target.value)}
                    placeholder="Ej: 343-4552912"
                    className={inputClass("telefono")}
                    style={{ border: `1px solid ${errors.telefono ? "#ef4444" : "#e2e8f0"}` }}
                  />
                  {errors.telefono && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.telefono}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  placeholder="Ej:rgarcia@gmail.com"
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => handleFormChange("direccion", e.target.value)}
                  placeholder="Ej: Calle Los Jacarandás 451"
                  className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white"
                />
              </div>

              {/* Localidad y Estado en fila */}
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                    Localidad
                  </label>
                  <select
                    value={form.localidad}
                    onChange={(e) => handleFormChange("localidad", e.target.value)}
                    className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer"
                  >
                    {localidadesOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">
                    Estado
                  </label>
                  <select
                    value={form.estado}
                    onChange={(e) => handleFormChange("estado", e.target.value)}
                    className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Moroso">Moroso</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={handleCloseModal}
                className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrearCliente}
                className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]"
              >
                Crear Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedClientId && (
        <ClienteFicheroModal
          clienteId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      )}
    </AppLayout>
  );
}
