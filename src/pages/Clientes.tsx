import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import { getClientes, createCliente, updateCliente, deleteCliente } from "@/services/api";
import LocalidadSelector from "@/components/LocalidadSelector";

interface Cliente {
  id: string;
  nombre: string;
  localidad: string;
  telefono: string;
  dni: string;
  email: string;
  direccion: string;
  estado: string;
  fechaAlta: string;
}

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Activo: { bg: "#d1fae5", color: "#10b981" },
  Moroso: { bg: "#fef3c7", color: "#f59e0b" },
  Inactivo: { bg: "#fee2e2", color: "#ef4444" },
};

const estadoInicial = { nombre: "", dni: "", telefono: "", email: "", direccion: "", localidad: "", estado: "Activo" };

export default function Clientes() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [localidad, setLocalidad] = useState("Todas");
  const [estado, setEstado] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(estadoInicial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(estadoInicial);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [deletingCliente, setDeletingCliente] = useState<Cliente | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    getClientes()
      .then((data) =>
        setClientes(
          data.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            localidad: c.localidad || "",
            telefono: c.telefono || "",
            dni: c.dni || "",
            email: c.email || "",
            direccion: c.direccion || "",
            estado: c.estado || "Activo",
            fechaAlta: c.fechaAlta,
          }))
        )
      )
      .catch(console.error);
  }, []);

  const filtered = clientes.filter((c) => {
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) || c.dni.includes(search);
    const matchLocalidad = localidad === "Todas" || c.localidad === localidad;
    const matchEstado = estado === "Todos" || c.estado === estado;
    return matchSearch && matchLocalidad && matchEstado;
  });

  const localidades = ["Todas", ...Array.from(new Set(clientes.map((c) => c.localidad).filter(Boolean)))];
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

  async function handleCrearCliente() {
    if (!validate()) return;

    const now = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const fechaAlta = `${now.getDate()} ${meses[now.getMonth()]}, ${now.getFullYear()}`;
    const id = `cli_${Date.now()}`;

    try {
      await createCliente({
        id,
        nombre: form.nombre.trim(),
        dni: form.dni.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        direccion: form.direccion.trim(),
        localidad: form.localidad,
        estado: form.estado,
        fechaAlta,
      });
      setClientes((prev) => [
        { id, nombre: form.nombre.trim(), dni: form.dni.trim(), telefono: form.telefono.trim(), email: form.email.trim(), direccion: form.direccion.trim(), localidad: form.localidad, estado: form.estado, fechaAlta },
        ...prev,
      ]);
      setShowModal(false);
      setForm(estadoInicial);
    } catch (e) {
      console.error(e);
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setForm(estadoInicial);
    setErrors({});
  }

  function handleOpenEdit(cliente: Cliente, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingCliente(cliente);
    setEditForm({
      nombre: cliente.nombre,
      dni: cliente.dni,
      telefono: cliente.telefono,
      email: cliente.email,
      direccion: cliente.direccion,
      localidad: cliente.localidad || "Paraná",
      estado: cliente.estado || "Activo",
    });
    setEditErrors({});
    setShowEditModal(true);
  }

  function handleEditFormChange(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
    if (editErrors[field]) setEditErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validateEdit(): boolean {
    const newErrors: Record<string, string> = {};
    if (!editForm.nombre.trim()) newErrors.nombre = "El nombre es obligatorio";
    if (!editForm.dni.trim()) newErrors.dni = "El DNI/CUIT es obligatorio";
    if (!editForm.telefono.trim()) newErrors.telefono = "El teléfono es obligatorio";
    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleGuardarEdicion() {
    if (!validateEdit() || !editingCliente) return;
    try {
      await updateCliente(editingCliente.id, {
        nombre: editForm.nombre.trim(),
        dni: editForm.dni.trim(),
        telefono: editForm.telefono.trim(),
        email: editForm.email.trim(),
        direccion: editForm.direccion.trim(),
        localidad: editForm.localidad,
        estado: editForm.estado,
      });
      setClientes((prev) =>
        prev.map((c) =>
          c.id === editingCliente.id
            ? { ...c, nombre: editForm.nombre.trim(), dni: editForm.dni.trim(), telefono: editForm.telefono.trim(), email: editForm.email.trim(), direccion: editForm.direccion.trim(), localidad: editForm.localidad, estado: editForm.estado }
            : c
        )
      );
      setShowEditModal(false);
      setEditingCliente(null);
    } catch (e) {
      console.error(e);
    }
  }

  function handleOpenDelete(cliente: Cliente, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingCliente(cliente);
    setShowDeleteConfirm(true);
  }

  async function handleConfirmarEliminar() {
    if (!deletingCliente) return;
    try {
      await deleteCliente(deletingCliente.id);
      setClientes((prev) => prev.filter((c) => c.id !== deletingCliente.id));
      setShowDeleteConfirm(false);
      setDeletingCliente(null);
    } catch (e) {
      console.error(e);
    }
  }

  const inputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      errors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
    }`;

  const editInputClass = (field: string) =>
    `w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white ${
      editErrors[field] ? "border-[#ef4444] focus:border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"
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
                {["Nombre", "Localidad", "Teléfono", "DNI/CUIT", "Estado", ""].map((h) => (
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
                  <td className="px-[20px] py-[16px]">
                    <span
                      className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[10px] py-[4px] rounded-[6px]"
                      style={estadoStyle[c.estado]}
                    >
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-[20px] py-[16px]">
                    <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleOpenEdit(c, e)} className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#f1f5f9] transition-colors" title="Editar">
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                      </button>
                      <button onClick={(e) => handleOpenDelete(c, e)} className="size-[28px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors" title="Eliminar">
                        <svg fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-[20px] py-[12px]" style={{ borderTop: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">Mostrando {filtered.length} de {clientes.length} clientes</p>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Cliente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Nuevo Cliente</p>
              <button onClick={handleCloseModal} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nombre completo *</label>
                <input type="text" value={form.nombre} onChange={(e) => handleFormChange("nombre", e.target.value)} placeholder="Ej: García, Roberto" className={inputClass("nombre")} style={{ border: `1px solid ${errors.nombre ? "#ef4444" : "#e2e8f0"}` }} />
                {errors.nombre && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.nombre}</p>}
              </div>

              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">DNI / CUIT *</label>
                  <input type="text" value={form.dni} onChange={(e) => handleFormChange("dni", e.target.value)} placeholder="Ej: 30.412.552" className={inputClass("dni")} style={{ border: `1px solid ${errors.dni ? "#ef4444" : "#e2e8f0"}` }} />
                  {errors.dni && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.dni}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Teléfono *</label>
                  <input type="text" value={form.telefono} onChange={(e) => handleFormChange("telefono", e.target.value)} placeholder="Ej: 343-4552912" className={inputClass("telefono")} style={{ border: `1px solid ${errors.telefono ? "#ef4444" : "#e2e8f0"}` }} />
                  {errors.telefono && <p className="text-[#ef4444] text-[12px] mt-[4px]">{errors.telefono}</p>}
                </div>
              </div>

              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Email</label>
                <input type="email" value={form.email} onChange={(e) => handleFormChange("email", e.target.value)} placeholder="Ej:rgarcia@gmail.com" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>

              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Dirección</label>
                <input type="text" value={form.direccion} onChange={(e) => handleFormChange("direccion", e.target.value)} placeholder="Ej: Calle Los Jacarandás 451" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>

              <LocalidadSelector value={form.localidad} onChange={(v) => handleFormChange("localidad", v)} />
            </div>

            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={handleCloseModal} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleCrearCliente} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Crear Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {showEditModal && editingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowEditModal(false); setEditingCliente(null); }} />
          <div className="relative bg-white rounded-[16px] w-[520px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }}>
            <div className="flex items-center justify-between px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">Editar Cliente</p>
              <button onClick={() => { setShowEditModal(false); setEditingCliente(null); }} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </div>

            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Nombre completo *</label>
                <input type="text" value={editForm.nombre} onChange={(e) => handleEditFormChange("nombre", e.target.value)} placeholder="Ej: García, Roberto" className={editInputClass("nombre")} style={{ border: `1px solid ${editErrors.nombre ? "#ef4444" : "#e2e8f0"}` }} />
                {editErrors.nombre && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editErrors.nombre}</p>}
              </div>

              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">DNI / CUIT *</label>
                  <input type="text" value={editForm.dni} onChange={(e) => handleEditFormChange("dni", e.target.value)} placeholder="Ej: 30.412.552" className={editInputClass("dni")} style={{ border: `1px solid ${editErrors.dni ? "#ef4444" : "#e2e8f0"}` }} />
                  {editErrors.dni && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editErrors.dni}</p>}
                </div>
                <div>
                  <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Teléfono *</label>
                  <input type="text" value={editForm.telefono} onChange={(e) => handleEditFormChange("telefono", e.target.value)} placeholder="Ej: 343-4552912" className={editInputClass("telefono")} style={{ border: `1px solid ${editErrors.telefono ? "#ef4444" : "#e2e8f0"}` }} />
                  {editErrors.telefono && <p className="text-[#ef4444] text-[12px] mt-[4px]">{editErrors.telefono}</p>}
                </div>
              </div>

              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => handleEditFormChange("email", e.target.value)} placeholder="Ej: rgarcia@gmail.com" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>

              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Dirección</label>
                <input type="text" value={editForm.direccion} onChange={(e) => handleEditFormChange("direccion", e.target.value)} placeholder="Ej: Calle Los Jacarandás 451" className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white" />
              </div>

              <LocalidadSelector value={editForm.localidad} onChange={(v) => handleEditFormChange("localidad", v)} />
              <div>
                <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">Estado</label>
                <select value={editForm.estado} onChange={(e) => handleEditFormChange("estado", e.target.value)} className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer">
                  <option value="Activo">Activo</option>
                  <option value="Moroso">Moroso</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => { setShowEditModal(false); setEditingCliente(null); }} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardarEdicion} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {showDeleteConfirm && deletingCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowDeleteConfirm(false); setDeletingCliente(null); }} />
          <div className="relative bg-white rounded-[16px] w-[400px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">Eliminar Cliente</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Estás seguro de que querés eliminar a <span className="font-semibold">{deletingCliente.nombre}</span>? Esta acción eliminará todos sus ficheros y cuotas asociados. No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingCliente(null); }} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleConfirmarEliminar} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
