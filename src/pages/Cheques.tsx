import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import { IconSearch, IconPlus } from "@/components/Icons";
import ClienteSelector from "@/components/ClienteSelector";
import { proveedores } from "@/data/proveedores";
import {
  getCheques,
  createCheque,
  updateCheque,
  deleteCheque,
  getClientes,
  getBancos,
  type Cheque,
  type ChequeTipo,
  type ChequeInput,
  type Banco,
} from "@/services/api";

const ESTADOS_POR_TIPO: Record<ChequeTipo, string[]> = {
  emitido: ["Pendiente", "Pagado", "Rechazado"],
  recibido: ["En Cartera", "Depositado", "Entregado", "Rechazado"],
};

const estadoStyle: Record<string, { bg: string; color: string }> = {
  Pendiente: { bg: "#fef3c7", color: "#f59e0b" },
  Pagado: { bg: "#d1fae5", color: "#10b981" },
  "En Cartera": { bg: "#dbeafe", color: "#3b82f6" },
  Depositado: { bg: "#d1fae5", color: "#10b981" },
  Entregado: { bg: "#ede9fe", color: "#7c3aed" },
  Rechazado: { bg: "#fee2e2", color: "#ef4444" },
};

function formatCurrency(value: number): string {
  return `$${value.toLocaleString("es-AR")}`;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "-";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  const [y, m, d] = [parts[0] || "", parts[1] || "", parts[2] || ""];
  return `${d}/${m}/${y}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface ClienteOption {
  id: string;
  nombre: string;
}

interface ChequeForm {
  banco: string;
  sucursal: string;
  numero: string;
  recibidoDe: string;
  destinatario: string;
  fechaEmision: string;
  fechaCobro: string;
  fechaPago: string;
  fechaRecepcion: string;
  entregadoA: string;
  fechaEntrega: string;
  importe: string;
  estado: string;
  clienteId: string;
  aplicaPagoProveedor: boolean;
  proveedorId: string;
}

const formInicial: ChequeForm = {
  banco: "",
  sucursal: "",
  numero: "",
  recibidoDe: "",
  destinatario: "",
  fechaEmision: "",
  fechaCobro: "",
  fechaPago: "",
  fechaRecepcion: "",
  entregadoA: "",
  fechaEntrega: "",
  importe: "",
  estado: "",
  clienteId: "",
  aplicaPagoProveedor: false,
  proveedorId: "",
};

const inputClass =
  "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] focus:border-[#0ea5e9] transition-colors bg-white";
const labelClass = "font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

export default function Cheques() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<ChequeTipo>("emitido");
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [filtroBanco, setFiltroBanco] = useState("Todos");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cheque | null>(null);
  const [form, setForm] = useState<ChequeForm>(formInicial);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [chequesData, clientesData, bancosData] = await Promise.all([getCheques(), getClientes(), getBancos()]);
      setCheques(chequesData);
      setClientes((clientesData || []).map((c: any) => ({ id: c.id, nombre: c.nombre })));
      setBancos(bancosData);
    } catch (err) {
      console.error(err);
      alert("Error al cargar los cheques");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function cambiarTab(nuevo: ChequeTipo) {
    setTipo(nuevo);
    setSearch("");
    setFiltroEstado("Todos");
    setFiltroBanco("Todos");
  }

  const delTab = cheques.filter((c) => c.tipo === tipo);
  const nombresBancosCat = bancos.map((b) => b.nombre);
  const bancosFiltro = ["Todos", ...Array.from(new Set([...nombresBancosCat, ...delTab.map((c) => c.banco)]))];
  const opcionesBancoForm = form.banco && !nombresBancosCat.includes(form.banco) ? [...nombresBancosCat, form.banco] : nombresBancosCat;
  const estados = ["Todos", ...ESTADOS_POR_TIPO[tipo]];

  const filtered = delTab.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.numero.toLowerCase().includes(q) ||
      c.banco.toLowerCase().includes(q) ||
      (c.destinatario || "").toLowerCase().includes(q) ||
      (c.recibidoDe || "").toLowerCase().includes(q) ||
      (c.entregadoA || "").toLowerCase().includes(q) ||
      (c.clienteNombre || "").toLowerCase().includes(q);
    const matchEstado = filtroEstado === "Todos" || c.estado === filtroEstado;
    const matchBanco = filtroBanco === "Todos" || c.banco === filtroBanco;
    return matchSearch && matchEstado && matchBanco;
  });

  const resumenItems = (() => {
    const items = ESTADOS_POR_TIPO[tipo].map((e) => ({
      label: `Total ${e}`,
      value: delTab.filter((c) => c.estado === e).reduce((acc, c) => acc + c.importe, 0),
      color: estadoStyle[e]?.color || "#475569",
    }));
    if (items.length < 4) {
      items.push({
        label: "Total General",
        value: delTab.reduce((acc, c) => acc + c.importe, 0),
        color: "#0f172a",
      });
    }
    return items;
  })();

  function handleNuevo() {
    const hoy = toISODate(new Date());
    setEditing(null);
    setForm({
      ...formInicial,
      estado: ESTADOS_POR_TIPO[tipo][0] || "",
      fechaCobro: hoy,
      ...(tipo === "emitido" ? { fechaEmision: hoy } : { fechaRecepcion: hoy }),
    });
    setShowModal(true);
  }

  function handleEditar(c: Cheque) {
    setEditing(c);
    setForm({
      banco: c.banco,
      sucursal: c.sucursal || "",
      numero: c.numero,
      recibidoDe: c.recibidoDe || "",
      destinatario: c.destinatario || "",
      fechaEmision: c.fechaEmision || "",
      fechaCobro: c.fechaCobro,
      fechaPago: c.fechaPago || "",
      fechaRecepcion: c.fechaRecepcion || "",
      entregadoA: c.entregadoA || "",
      fechaEntrega: c.fechaEntrega || "",
      importe: String(c.importe),
      estado: c.estado,
      clienteId: c.clienteId || "",
      aplicaPagoProveedor: c.aplicaPagoProveedor === 1,
      proveedorId: c.proveedorId || "",
    });
    setShowModal(true);
  }

  function toggleAplicaPago(checked: boolean) {
    setForm((p) => ({ ...p, aplicaPagoProveedor: checked, proveedorId: checked ? p.proveedorId : "" }));
  }

  function changeProveedor(id: string) {
    const prov = proveedores.find((pr) => pr.id === id);
    setForm((p) => ({ ...p, proveedorId: id, destinatario: prov ? prov.razonSocial : p.destinatario }));
  }

  async function handleGuardar() {
    const banco = form.banco.trim();
    const numero = form.numero.trim();
    const importe = Number(form.importe);

    if (!banco) return alert("El banco es obligatorio");
    if (!numero) return alert("El número de cheque es obligatorio");
    if (!form.fechaCobro) return alert("La fecha de cobro es obligatoria");
    if (!Number.isFinite(importe) || importe <= 0) return alert("El importe debe ser un número mayor a 0");
    if (!form.estado) return alert("El estado es obligatorio");

    if (tipo === "emitido") {
      if (!form.destinatario.trim()) return alert("El destinatario es obligatorio");
      if (!form.fechaEmision) return alert("La fecha de emisión es obligatoria");
      if (form.aplicaPagoProveedor && !form.proveedorId) return alert("Debe elegir el proveedor cuando el cheque aplica a un pago a proveedores");
    } else {
      if (!form.recibidoDe.trim()) return alert("El campo \"Recibido de\" es obligatorio");
      if (!form.fechaRecepcion) return alert("La fecha de recepción es obligatoria");
    }

    const base: ChequeInput = {
      tipo,
      banco,
      sucursal: form.sucursal.trim(),
      numero,
      fechaCobro: form.fechaCobro,
      importe,
      estado: form.estado,
      clienteId: form.clienteId || null,
    };

    const data: ChequeInput =
      tipo === "emitido"
        ? {
            ...base,
            destinatario: form.destinatario.trim(),
            fechaEmision: form.fechaEmision,
            fechaPago: form.fechaPago || undefined,
            aplicaPagoProveedor: form.aplicaPagoProveedor ? 1 : 0,
            proveedorId: form.aplicaPagoProveedor ? form.proveedorId : null,
          }
        : {
            ...base,
            recibidoDe: form.recibidoDe.trim(),
            fechaRecepcion: form.fechaRecepcion,
            entregadoA: form.entregadoA.trim() || undefined,
            fechaEntrega: form.entregadoA.trim() ? form.fechaEntrega || undefined : undefined,
          };

    try {
      if (editing) await updateCheque(editing.id, data);
      else await createCheque(data);
      setShowModal(false);
      cargarDatos();
    } catch (err: any) {
      alert(err.message || "Error al guardar el cheque");
    }
  }

  async function handleEliminar(id: string) {
    try {
      await deleteCheque(id);
      setDeleteConfirm(null);
      cargarDatos();
    } catch (err: any) {
      alert(err.message || "Error al eliminar el cheque");
    }
  }

  const colSpan = tipo === "emitido" ? 9 : 10;
  const isEmitido = tipo === "emitido";

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Cheques" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Cheques</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Administración, trazabilidad e histórico de cheques emitidos y recibidos</p>
          </div>
          <button onClick={handleNuevo} className="flex items-center gap-[8px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] px-[16px] py-[10px] rounded-[8px]">
            <IconPlus />
            Registrar Cheque
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-[8px]">
          {(["emitido", "recibido"] as const).map((t) => (
            <button
              key={t}
              onClick={() => cambiarTab(t)}
              className={`font-['Geist:Medium',sans-serif] font-medium text-[14px] px-[20px] py-[9px] rounded-[8px] transition-colors ${
                tipo === t
                  ? "bg-[#0ea5e9] text-white"
                  : "bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]"
              }`}
            >
              {t === "emitido" ? "Emitidos" : "Recibidos"}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-[12px]">
          <div className="flex-1 flex items-center gap-[8px] bg-white px-[12px] py-[9px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
            <IconSearch color="#94a3b8" />
            <input
              type="text"
              placeholder={isEmitido ? "Buscar nro, destinatario o cliente..." : "Buscar nro, recibido de o cliente..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] outline-none placeholder:text-[#94a3b8] bg-transparent"
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {estados.map((e) => (
              <option key={e} value={e}>
                Estado: {e}
              </option>
            ))}
          </select>
          <select
            value={filtroBanco}
            onChange={(e) => setFiltroBanco(e.target.value)}
            className="bg-white font-['Geist:Regular',sans-serif] text-[14px] text-[#475569] px-[12px] py-[9px] rounded-[8px] outline-none cursor-pointer"
            style={{ border: "1px solid #e2e8f0" }}
          >
            {bancosFiltro.map((b) => (
              <option key={b} value={b}>
                Banco: {b}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[12px] overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {(isEmitido
                  ? ["Banco", "Nro Cheque", "Destinatario", "Fecha Emisión", "Fecha Cobro", "Fecha Pago", "Importe", "Estado", ""]
                  : ["Recibido de", "Banco", "Sucursal", "Nro Cheque", "Fecha Recepción", "Fecha Cobro", "Entregado a", "Importe", "Estado", ""]
                ).map((h, i) => (
                  <th key={i} className="text-left font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] px-[20px] py-[14px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-[20px] py-[32px] text-center font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                    Cargando cheques...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-[20px] py-[32px] text-center font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[14px]">
                    No hay cheques {isEmitido ? "emitidos" : "recibidos"} registrados
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const esRechazado = c.estado === "Rechazado";
                  return (
                    <tr key={c.id} className="group hover:bg-[#f8fafc] transition-colors" style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      {isEmitido ? (
                        <>
                          <td className="px-[20px] py-[16px] font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px]">{c.banco}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.numero}</td>
                          <td className="px-[20px] py-[16px]">
                            <div className="flex flex-col">
                              <span className="font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">{c.destinatario}</span>
                              {c.aplicaPagoProveedor === 1 && (
                                <span className="font-['Geist:Regular',sans-serif] text-[#f59e0b] text-[11px]">
                                  Proveedor: {proveedores.find((pr) => pr.id === c.proveedorId)?.razonSocial || c.proveedorId}
                                </span>
                              )}
                              {c.clienteNombre && <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">Cliente: {c.clienteNombre}</span>}
                            </div>
                          </td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{formatFecha(c.fechaEmision)}</td>
                          <td className={`px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[14px] ${esRechazado ? "text-[#ef4444] font-semibold" : "text-[#475569]"}`}>{formatFecha(c.fechaCobro)}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{formatFecha(c.fechaPago)}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{formatCurrency(c.importe)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-[20px] py-[16px]">
                            <div className="flex flex-col">
                              <span className="font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px]">{c.recibidoDe}</span>
                              {c.clienteNombre && <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">Cliente: {c.clienteNombre}</span>}
                            </div>
                          </td>
                          <td className="px-[20px] py-[16px] font-['Geist:Medium',sans-serif] font-medium text-[#0f172a] text-[14px]">{c.banco}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.sucursal || "-"}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{c.numero}</td>
                          <td className="px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{formatFecha(c.fechaRecepcion)}</td>
                          <td className={`px-[20px] py-[16px] font-['Geist:Regular',sans-serif] text-[14px] ${esRechazado ? "text-[#ef4444] font-semibold" : "text-[#475569]"}`}>{formatFecha(c.fechaCobro)}</td>
                          <td className="px-[20px] py-[16px]">
                            <div className="flex flex-col">
                              <span className="font-['Geist:Regular',sans-serif] text-[#0f172a] text-[14px]">{c.entregadoA || "-"}</span>
                              {c.entregadoA && c.fechaEntrega && <span className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">{formatFecha(c.fechaEntrega)}</span>}
                            </div>
                          </td>
                          <td className="px-[20px] py-[16px] font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{formatCurrency(c.importe)}</td>
                        </>
                      )}
                      <td className="px-[20px] py-[16px]">
                        <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[8px] py-[3px] rounded-[6px]" style={estadoStyle[c.estado] || { bg: "#f1f5f9", color: "#475569" }}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-[20px] py-[16px]">
                        <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditar(c)} className="p-[4px] rounded-[4px] hover:bg-[#e2e8f0] transition-colors" title="Editar">
                            <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M10.5 1.5L12.5 3.5L4 12H2V10L10.5 1.5Z" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                          <button onClick={() => setDeleteConfirm(c.id)} className="p-[4px] rounded-[4px] hover:bg-[#fee2e2] transition-colors" title="Eliminar">
                            <svg fill="none" height="14" viewBox="0 0 14 14" width="14"><path d="M2 4H12M5 4V2H9V4M6 6.5V10.5M8 6.5V10.5M3 4L4 12H10L11 4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-[16px]">
          {resumenItems.map((s, i) => (
            <div key={i} className="bg-white flex items-center justify-between px-[20px] py-[14px] rounded-[10px]" style={{ border: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">{s.label}</p>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[16px]" style={{ color: s.color }}>{formatCurrency(s.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Nuevo/Editar Cheque */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-[12px] w-[600px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-[24px] py-[20px]" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">
                {editing ? "Editar Cheque" : "Nuevo Cheque"} {isEmitido ? "Emitido" : "Recibido"}
              </p>
            </div>
            <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">
              {isEmitido ? (
                <>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Banco *">
                      <select value={form.banco} onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))} className={inputClass + " cursor-pointer"}>
                        <option value="">{opcionesBancoForm.length ? "Seleccionar banco..." : "Sin bancos — gestionalos en Caja"}</option>
                        {opcionesBancoForm.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Número de cheque *">
                      <input type="text" value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Ej: CHQ-002931" className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Destinatario *">
                      <input type="text" value={form.destinatario} onChange={(e) => setForm((p) => ({ ...p, destinatario: e.target.value }))} placeholder="A quién se emite" className={inputClass} />
                    </Field>
                    <Field label="Cliente (opcional)">
                      <ClienteSelector clientes={clientes} value={form.clienteId} onChange={(id) => setForm((p) => ({ ...p, clienteId: id }))} inputClass={inputClass} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-[8px] p-[10px] rounded-[8px] bg-[#f8fafc]">
                    <input
                      type="checkbox"
                      id="aplicaPagoProveedor"
                      checked={form.aplicaPagoProveedor}
                      onChange={(e) => toggleAplicaPago(e.target.checked)}
                      className="size-[16px] accent-[#0ea5e9] cursor-pointer"
                    />
                    <label htmlFor="aplicaPagoProveedor" className="font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#0f172a] cursor-pointer">
                      Aplica a un pago a proveedores
                    </label>
                  </div>
                  {form.aplicaPagoProveedor && (
                    <Field label="Proveedor *">
                      <select value={form.proveedorId} onChange={(e) => changeProveedor(e.target.value)} className={inputClass + " cursor-pointer"}>
                        <option value="">Seleccionar proveedor...</option>
                        {proveedores.map((pr) => (
                          <option key={pr.id} value={pr.id}>{pr.razonSocial}</option>
                        ))}
                      </select>
                    </Field>
                  )}
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Fecha de emisión *">
                      <input type="date" value={form.fechaEmision} onChange={(e) => setForm((p) => ({ ...p, fechaEmision: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Fecha de cobro *">
                      <input type="date" value={form.fechaCobro} onChange={(e) => setForm((p) => ({ ...p, fechaCobro: e.target.value }))} className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Fecha de pago / débito bancario (opcional)">
                      <input type="date" value={form.fechaPago} onChange={(e) => setForm((p) => ({ ...p, fechaPago: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Importe *">
                      <input type="number" value={form.importe} onChange={(e) => setForm((p) => ({ ...p, importe: e.target.value }))} placeholder="0" min="0" className={inputClass} />
                    </Field>
                  </div>
                  <Field label="Estado *">
                    <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className={inputClass + " cursor-pointer"}>
                      {ESTADOS_POR_TIPO.emitido.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Recibido de *">
                      <input type="text" value={form.recibidoDe} onChange={(e) => setForm((p) => ({ ...p, recibidoDe: e.target.value }))} placeholder="Quién entrega el cheque" className={inputClass} />
                    </Field>
                    <Field label="Cliente (opcional)">
                      <ClienteSelector clientes={clientes} value={form.clienteId} onChange={(id) => setForm((p) => ({ ...p, clienteId: id }))} inputClass={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Banco *">
                      <select value={form.banco} onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))} className={inputClass + " cursor-pointer"}>
                        <option value="">{opcionesBancoForm.length ? "Seleccionar banco..." : "Sin bancos — gestionalos en Caja"}</option>
                        {opcionesBancoForm.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Sucursal (opcional)">
                      <input type="text" value={form.sucursal} onChange={(e) => setForm((p) => ({ ...p, sucursal: e.target.value }))} placeholder="Ej: Centro" className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Número de cheque *">
                      <input type="text" value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Ej: CHQ-002931" className={inputClass} />
                    </Field>
                    <Field label="Importe *">
                      <input type="number" value={form.importe} onChange={(e) => setForm((p) => ({ ...p, importe: e.target.value }))} placeholder="0" min="0" className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Fecha de recepción *">
                      <input type="date" value={form.fechaRecepcion} onChange={(e) => setForm((p) => ({ ...p, fechaRecepcion: e.target.value }))} className={inputClass} />
                    </Field>
                    <Field label="Fecha de cobro *">
                      <input type="date" value={form.fechaCobro} onChange={(e) => setForm((p) => ({ ...p, fechaCobro: e.target.value }))} className={inputClass} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-[12px]">
                    <Field label="Entregado a (opcional)">
                      <input type="text" value={form.entregadoA} onChange={(e) => setForm((p) => ({ ...p, entregadoA: e.target.value }))} placeholder="Persona o entidad" className={inputClass} />
                    </Field>
                    {form.entregadoA.trim() && (
                      <Field label="Fecha de entrega">
                        <input type="date" value={form.fechaEntrega} onChange={(e) => setForm((p) => ({ ...p, fechaEntrega: e.target.value }))} className={inputClass} />
                      </Field>
                    )}
                  </div>
                  <Field label="Estado *">
                    <select value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} className={inputClass + " cursor-pointer"}>
                      {ESTADOS_POR_TIPO.recibido.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setShowModal(false)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={handleGuardar} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">
                {editing ? "Guardar Cambios" : "Crear Cheque"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-[12px] w-[400px] p-[24px]" style={{ border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px] mb-[8px]">Eliminar Cheque</p>
            <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px] mb-[20px]">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <div className="flex items-center justify-end gap-[12px]">
              <button onClick={() => setDeleteConfirm(null)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">Cancelar</button>
              <button onClick={() => handleEliminar(deleteConfirm)} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
