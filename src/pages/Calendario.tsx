import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import ClienteSelector from "@/components/ClienteSelector";
import {
  getInstalaciones,
  getVeredas,
  getEquipos,
  getVentasParaInstalacion,
  getClientes,
  createInstalacion,
  updateInstalacion,
  deleteInstalacion,
  createVereda,
  updateVereda,
  deleteVereda,
  createEquipo,
  updateEquipo,
  deleteEquipo,
  type Instalacion,
  type Vereda,
  type Equipo,
  type VentaDisponible,
  type InstalacionEstado,
  type VeredaEstado,
} from "@/services/api";

// --- Helpers de fechas ---
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function startOfWeek(d: Date): Date {
  const c = new Date(d);
  const dow = (c.getDay() + 6) % 7; // 0 = lunes
  c.setDate(c.getDate() - dow);
  c.setHours(0, 0, 0, 0);
  return c;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mesLargo(d: Date): string {
  return capitalize(d.toLocaleDateString("es-AR", { month: "long" }));
}

const HOY = new Date();

// --- Configuración de estados ---
type EstadoStyle = { bg: string; border: string; badgeBg: string; badgeColor: string; chip: string };

const instEstadoConfig: Record<InstalacionEstado, EstadoStyle> = {
  Pendiente: { bg: "#fef3c7", border: "#f59e0b", badgeBg: "white", badgeColor: "#f59e0b", chip: "#f59e0b" },
  Confirmada: { bg: "#d1fae5", border: "#10b981", badgeBg: "white", badgeColor: "#10b981", chip: "#10b981" },
  "En Proceso": { bg: "#e0f2fe", border: "#0ea5e9", badgeBg: "white", badgeColor: "#0ea5e9", chip: "#0ea5e9" },
  Completada: { bg: "#ede9fe", border: "#8b5cf6", badgeBg: "white", badgeColor: "#8b5cf6", chip: "#8b5cf6" },
};

const verEstadoConfig: Record<VeredaEstado, EstadoStyle> = {
  Pendiente: { bg: "#fef3c7", border: "#f59e0b", badgeBg: "white", badgeColor: "#f59e0b", chip: "#f59e0b" },
  "En Proceso": { bg: "#e0f2fe", border: "#0ea5e9", badgeBg: "white", badgeColor: "#0ea5e9", chip: "#0ea5e9" },
  Completada: { bg: "#d1fae5", border: "#10b981", badgeBg: "white", badgeColor: "#10b981", chip: "#10b981" },
};

const INST_ESTADOS: InstalacionEstado[] = ["Pendiente", "Confirmada", "En Proceso", "Completada"];
const VER_ESTADOS: VeredaEstado[] = ["Pendiente", "En Proceso", "Completada"];

// --- Formularios ---
interface InstForm {
  ficheroId: string;
  fecha: string;
  equipoId: string;
  estado: InstalacionEstado;
  notas: string;
}

interface VerForm {
  clienteId: string;
  fecha: string;
  equipoId: string;
  estado: VeredaEstado;
  notas: string;
}

interface EqForm {
  nombre: string;
  encargado: string;
  empleados: string[];
}

const instFormInicial: InstForm = { ficheroId: "", fecha: "", equipoId: "", estado: "Pendiente", notas: "" };
const verFormInicial: VerForm = { clienteId: "", fecha: "", equipoId: "", estado: "Pendiente", notas: "" };
const eqFormInicial: EqForm = { nombre: "", encargado: "", empleados: [] };

type Borrado = { tipo: "instalacion" | "vereda" | "equipo"; id: string; label: string } | null;

// --- Modal shell ---
function Modal({ titulo, onClose, children, footer, width = 520 }: { titulo: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #e2e8f0", width }}>
        <div className="flex items-center justify-between px-[24px] py-[20px] sticky top-0 bg-white z-10" style={{ borderBottom: "1px solid #e2e8f0" }}>
          <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[18px]">{titulo}</p>
          <button onClick={onClose} className="flex items-center justify-center size-[32px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
              <path d="M12 4L4 12M4 4L12 12" stroke="#64748b" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>
        <div className="px-[24px] py-[20px] flex flex-col gap-[16px]">{children}</div>
        <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px] sticky bottom-0 bg-white" style={{ borderTop: "1px solid #e2e8f0" }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[13px] mb-[6px] block">{label}</label>
      {children}
      {error && <p className="text-[#ef4444] text-[12px] mt-[4px]">{error}</p>}
    </div>
  );
}

export default function Calendario() {
  const navigate = useNavigate();

  const [view, setView] = useState<"Mes" | "Semana">("Semana");
  const [anchor, setAnchor] = useState<Date>(new Date());

  const [instalaciones, setInstalaciones] = useState<Instalacion[]>([]);
  const [veredas, setVeredas] = useState<Vereda[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [ventas, setVentas] = useState<VentaDisponible[]>([]);
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);

  const [showInst, setShowInst] = useState(false);
  const [editInst, setEditInst] = useState<Instalacion | null>(null);
  const [instForm, setInstForm] = useState<InstForm>(instFormInicial);
  const [instErrors, setInstErrors] = useState<Record<string, string>>({});
  const [instApiError, setInstApiError] = useState("");

  const [showVer, setShowVer] = useState(false);
  const [editVer, setEditVer] = useState<Vereda | null>(null);
  const [verForm, setVerForm] = useState<VerForm>(verFormInicial);
  const [verErrors, setVerErrors] = useState<Record<string, string>>({});
  const [verApiError, setVerApiError] = useState("");

  const [showEq, setShowEq] = useState(false);
  const [editEq, setEditEq] = useState<Equipo | null>(null);
  const [eqForm, setEqForm] = useState<EqForm>(eqFormInicial);
  const [eqErrors, setEqErrors] = useState<Record<string, string>>({});
  const [eqApiError, setEqApiError] = useState("");
  const [nuevoEmpleado, setNuevoEmpleado] = useState("");

  const [borrado, setBorrado] = useState<Borrado>(null);

  // --- Período visible ---
  const { dias, desde, hasta, label } = useMemo(() => {
    if (view === "Semana") {
      const inicio = startOfWeek(anchor);
      const arr = Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
      const d1 = arr[0]!;
      const d7 = arr[6]!;
      const mismoMes = d1.getMonth() === d7.getMonth() && d1.getFullYear() === d7.getFullYear();
      const texto = mismoMes
        ? `Del ${d1.getDate()} al ${d7.getDate()} de ${mesLargo(d1)} de ${d1.getFullYear()}`
        : `Del ${d1.getDate()} ${mesLargo(d1)} al ${d7.getDate()} ${mesLargo(d7)} de ${d7.getFullYear()}`;
      return { dias: arr, desde: toISODate(arr[0]!), hasta: toISODate(arr[6]!), label: texto };
    }
    const primero = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const inicio = startOfWeek(primero);
    const ultimo = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const fin = addDays(startOfWeek(ultimo), 6);
    const totalDias = Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1;
    const arr = Array.from({ length: totalDias }, (_, i) => addDays(inicio, i));
    return {
      dias: arr,
      desde: toISODate(arr[0]!),
      hasta: toISODate(arr[arr.length - 1]!),
      label: `${mesLargo(anchor)} ${anchor.getFullYear()}`,
    };
  }, [view, anchor]);

  // --- Carga de datos del período ---
  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    Promise.all([getInstalaciones(desde, hasta), getVeredas(desde, hasta)])
      .then(([inst, ver]) => {
        if (cancelado) return;
        setInstalaciones(inst);
        setVeredas(ver);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [desde, hasta]);

  // --- Carga de datos fijos ---
  useEffect(() => {
    getEquipos()
      .then(setEquipos)
      .catch(console.error);
    getClientes()
      .then((data) => setClientes(data.map((c) => ({ id: c.id as string, nombre: c.nombre as string }))))
      .catch(console.error);
    getVentasParaInstalacion()
      .then(setVentas)
      .catch(console.error);
  }, []);

  async function recargar() {
    try {
      const [inst, ver, vts] = await Promise.all([getInstalaciones(desde, hasta), getVeredas(desde, hasta), getVentasParaInstalacion()]);
      setInstalaciones(inst);
      setVeredas(ver);
      setVentas(vts);
    } catch (e) {
      console.error(e);
    }
  }

  async function recargarEquipos() {
    try {
      setEquipos(await getEquipos());
      await recargar();
    } catch (e) {
      console.error(e);
    }
  }

  function navegar(dir: number) {
    setAnchor((prev) => (view === "Semana" ? addDays(prev, dir * 7) : new Date(prev.getFullYear(), prev.getMonth() + dir, 1)));
  }

  // --- Índices por fecha ---
  const instPorFecha = useMemo(() => {
    const m = new Map<string, Instalacion[]>();
    for (const i of instalaciones) {
      const arr = m.get(i.fecha) ?? [];
      arr.push(i);
      m.set(i.fecha, arr);
    }
    return m;
  }, [instalaciones]);

  const verPorFecha = useMemo(() => {
    const m = new Map<string, Vereda[]>();
    for (const v of veredas) {
      const arr = m.get(v.fecha) ?? [];
      arr.push(v);
      m.set(v.fecha, arr);
    }
    return m;
  }, [veredas]);

  const hoyISO = toISODate(HOY);

  // --- Instalaciones: abrir/guardar ---
  function abrirInstalacion(fecha?: string, item?: Instalacion) {
    setEditInst(item ?? null);
    setInstForm(
      item
        ? { ficheroId: item.ficheroId, fecha: item.fecha, equipoId: item.equipoId ?? "", estado: item.estado, notas: item.notas ?? "" }
        : { ...instFormInicial, fecha: fecha ?? hoyISO }
    );
    setInstErrors({});
    setInstApiError("");
    setShowInst(true);
  }

  function cerrarInstalacion() {
    setShowInst(false);
    setEditInst(null);
    setInstForm(instFormInicial);
    setInstErrors({});
    setInstApiError("");
  }

  async function guardarInstalacion() {
    const errs: Record<string, string> = {};
    if (!editInst && !instForm.ficheroId) errs.ficheroId = "Seleccioná una venta";
    if (!instForm.fecha) errs.fecha = "La fecha es obligatoria";
    setInstErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setInstApiError("");
    try {
      if (editInst) {
        await updateInstalacion(editInst.id, {
          ficheroId: instForm.ficheroId,
          fecha: instForm.fecha,
          equipoId: instForm.equipoId || null,
          estado: instForm.estado,
          notas: instForm.notas,
        });
      } else {
        await createInstalacion({
          ficheroId: instForm.ficheroId,
          fecha: instForm.fecha,
          equipoId: instForm.equipoId || null,
          estado: instForm.estado,
          notas: instForm.notas,
        });
      }
      cerrarInstalacion();
      await recargar();
    } catch (e) {
      setInstApiError(e instanceof Error ? e.message : "Error al guardar la instalación");
    }
  }

  // --- Veredas: abrir/guardar ---
  function abrirVereda(fecha?: string, item?: Vereda) {
    setEditVer(item ?? null);
    setVerForm(
      item
        ? { clienteId: item.clienteId, fecha: item.fecha, equipoId: item.equipoId ?? "", estado: item.estado, notas: item.notas ?? "" }
        : { ...verFormInicial, fecha: fecha ?? hoyISO }
    );
    setVerErrors({});
    setVerApiError("");
    setShowVer(true);
  }

  function cerrarVereda() {
    setShowVer(false);
    setEditVer(null);
    setVerForm(verFormInicial);
    setVerErrors({});
    setVerApiError("");
  }

  async function guardarVereda() {
    const errs: Record<string, string> = {};
    if (!verForm.clienteId) errs.clienteId = "Seleccioná un cliente";
    if (!verForm.fecha) errs.fecha = "La fecha es obligatoria";
    setVerErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setVerApiError("");
    try {
      if (editVer) {
        await updateVereda(editVer.id, {
          clienteId: verForm.clienteId,
          fecha: verForm.fecha,
          equipoId: verForm.equipoId || null,
          estado: verForm.estado,
          notas: verForm.notas,
        });
      } else {
        await createVereda({
          clienteId: verForm.clienteId,
          fecha: verForm.fecha,
          equipoId: verForm.equipoId || null,
          estado: verForm.estado,
          notas: verForm.notas,
        });
      }
      cerrarVereda();
      await recargar();
    } catch (e) {
      setVerApiError(e instanceof Error ? e.message : "Error al guardar la vereda");
    }
  }

  // --- Equipos: abrir/guardar ---
  function abrirEquipo(item?: Equipo) {
    setEditEq(item ?? null);
    setEqForm(item ? { nombre: item.nombre, encargado: item.encargado, empleados: [...item.empleados] } : { ...eqFormInicial });
    setEqErrors({});
    setEqApiError("");
    setNuevoEmpleado("");
    setShowEq(true);
  }

  function cerrarEquipo() {
    setShowEq(false);
    setEditEq(null);
    setEqForm(eqFormInicial);
    setEqErrors({});
    setEqApiError("");
    setNuevoEmpleado("");
  }

  function agregarEmpleado() {
    const nombre = nuevoEmpleado.trim();
    if (!nombre) return;
    if (eqForm.empleados.includes(nombre)) {
      setNuevoEmpleado("");
      return;
    }
    setEqForm((prev) => ({ ...prev, empleados: [...prev.empleados, nombre] }));
    setNuevoEmpleado("");
  }

  async function guardarEquipo() {
    const errs: Record<string, string> = {};
    if (!eqForm.nombre.trim()) errs.nombre = "El nombre es obligatorio";
    if (!eqForm.encargado.trim()) errs.encargado = "El encargado es obligatorio";
    setEqErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setEqApiError("");
    try {
      if (editEq) {
        await updateEquipo(editEq.id, { nombre: eqForm.nombre.trim(), encargado: eqForm.encargado.trim(), empleados: eqForm.empleados });
      } else {
        await createEquipo({ nombre: eqForm.nombre.trim(), encargado: eqForm.encargado.trim(), empleados: eqForm.empleados });
      }
      cerrarEquipo();
      await recargarEquipos();
    } catch (e) {
      setEqApiError(e instanceof Error ? e.message : "Error al guardar el equipo");
    }
  }

  // --- Borrado ---
  async function confirmarBorrado() {
    if (!borrado) return;
    const b = borrado;
    try {
      if (b.tipo === "instalacion") await deleteInstalacion(b.id);
      else if (b.tipo === "vereda") await deleteVereda(b.id);
      else await deleteEquipo(b.id);
      setBorrado(null);
      if (b.tipo === "equipo") await recargarEquipos();
      else await recargar();
    } catch (e) {
      console.error(e);
    }
  }

  // --- Selectores ---
  const equipoSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none border border-[#e2e8f0] bg-white cursor-pointer focus:border-[#0ea5e9] transition-colors"
    >
      <option value="">Sin equipo asignado</option>
      {equipos.map((eq) => (
        <option key={eq.id} value={eq.id}>
          {eq.nombre} — {eq.encargado}
        </option>
      ))}
    </select>
  );

  const ventasDisponibles = ventas.filter((v) => !v.instalacionId || (editInst !== null && v.instalacionId === editInst.id));

  const inputBase = "w-full font-['Geist:Regular',sans-serif] text-[14px] text-[#0f172a] px-[12px] py-[9px] rounded-[8px] outline-none transition-colors bg-white border";

  // --- Estilos de celda ---
  function estiloDia(iso: string, fueraDeMes: boolean): React.CSSProperties {
    return {
      border: `1px solid ${iso === hoyISO ? "#0ea5e9" : "#e2e8f0"}`,
      background: iso === hoyISO ? "#f0f9ff" : fueraDeMes ? "#fafafa" : "white",
      opacity: fueraDeMes ? 0.55 : 1,
    };
  }

  const cellLabelClass = "font-['Geist:SemiBold',sans-serif] font-semibold text-[13px]";

  const diasSemanaHeader = dias.slice(0, view === "Semana" ? 7 : 7);

  return (
    <AppLayout breadcrumbs={[{ label: "Inicio", onClick: () => navigate("/") }, { label: "Calendario" }]}>
      <div className="p-[32px] flex flex-col gap-[24px]">
        {/* Title Row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[24px]">Calendario</p>
            <p className="font-['Geist:Regular',sans-serif] font-normal text-[#475569] text-[14px] mt-[4px]">Programación de instalaciones de piletas vendidas y construcción de veredas</p>
          </div>
          <div className="flex items-center gap-[12px]">
            {/* View switch */}
            <div className="bg-[#e2e8f0] flex items-start p-[3px] rounded-[10px]">
              {(["Mes", "Semana"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-[11px] py-[5px] rounded-[8px] text-[12px] ${view === v ? "bg-white font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a]" : "font-['Geist:Medium',sans-serif] font-medium text-[#475569]"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* Navigation */}
            <div className="flex items-center gap-[4px]">
              <button onClick={() => navegar(-1)} className="bg-white flex items-center p-[8px] rounded-[6px]" style={{ border: "1px solid #e2e8f0" }} title="Anterior">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M10 12L6 8L10 4" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
              <div className="bg-white px-[16px] py-[8px] rounded-[6px] min-w-[240px] text-center" style={{ border: "1px solid #e2e8f0" }}>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">{label}</p>
              </div>
              <button onClick={() => navegar(1)} className="bg-white flex items-center p-[8px] rounded-[6px]" style={{ border: "1px solid #e2e8f0" }} title="Siguiente">
                <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
                  <path d="M6 12L10 8L6 4" stroke="#475569" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
              <button
                onClick={() => setAnchor(new Date())}
                className="bg-white px-[12px] py-[8px] rounded-[6px] font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#475569] hover:bg-[#f8fafc] transition-colors"
                style={{ border: "1px solid #e2e8f0" }}
              >
                Hoy
              </button>
            </div>
            <button
              onClick={() => abrirInstalacion()}
              className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] px-[14px] py-[9px] rounded-[8px]"
            >
              <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
                <path d="M8 3V13M3 8H13" stroke="white" strokeLinecap="round" strokeWidth="2" />
              </svg>
              Instalación
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex gap-[24px] items-start">
          {/* Main Calendar */}
          <div className="flex flex-col gap-[24px] flex-1 min-w-0">
            {/* Instalaciones */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between mb-[16px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Instalaciones (Piletas)</p>
                <div className="flex items-center gap-[12px]">
                  {INST_ESTADOS.map((e) => (
                    <div key={e} className="flex items-center gap-[4px]">
                      <div className="size-[8px] rounded-full" style={{ background: instEstadoConfig[e].chip }} />
                      <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{e}</p>
                    </div>
                  ))}
                  {cargando && <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Cargando…</p>}
                </div>
              </div>

              {view === "Semana" ? (
                <>
                  {/* Week header */}
                  <div className="grid gap-[12px] mb-[12px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {diasSemanaHeader.map((d) => {
                      const iso = toISODate(d);
                      return (
                        <div key={iso} className={`flex items-center justify-center p-[8px] rounded-[8px] ${iso === hoyISO ? "bg-[#e0f2fe]" : "bg-[#f8fafc]"}`}>
                          <p className={`text-[13px] ${iso === hoyISO ? "text-[#0ea5e9]" : "text-[#475569]"} font-['Geist:SemiBold',sans-serif] font-semibold`}>
                            {capitalize(d.toLocaleDateString("es-AR", { weekday: "long" }))} {d.getDate()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {/* Grid */}
                  <div className="grid gap-[12px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {dias.map((d) => {
                      const iso = toISODate(d);
                      const eventos = instPorFecha.get(iso) ?? [];
                      return (
                        <div key={iso} className="flex flex-col gap-[10px]">
                          {eventos.map((i) => {
                            const cfg = instEstadoConfig[i.estado] ?? instEstadoConfig.Pendiente;
                            return (
                              <button
                                key={i.id}
                                onClick={() => abrirInstalacion(undefined, i)}
                                className="text-left flex flex-col gap-[4px] p-[10px] rounded-[8px] transition-transform hover:-translate-y-[1px]"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              >
                                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] truncate">{i.clienteNombre}</p>
                                <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] truncate">{i.ficheroItems.map((it) => it.desc).filter(Boolean).join(" + ") || i.ficheroTotal}</p>
                                {i.equipoNombre && <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] truncate">Equipo: {i.equipoNombre}</p>}
                                <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] px-[6px] py-[2px] rounded-[4px] self-start" style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
                                  {i.estado}
                                </span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => abrirInstalacion(iso)}
                            className="flex items-center justify-center p-[14px] rounded-[8px] hover:bg-[#f8fafc] transition-colors"
                            style={{ border: "1px dashed #e2e8f0" }}
                          >
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Disponible</p>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Month header */}
                  <div className="grid gap-[8px] mb-[8px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {Array.from({ length: 7 }, (_, i) => addDays(new Date(2024, 0, 1), i)).map((d) => (
                      <div key={d.getDay()} className="bg-[#f8fafc] flex items-center justify-center p-[8px] rounded-[8px]">
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[12px]">{capitalize(d.toLocaleDateString("es-AR", { weekday: "long" })).slice(0, 3)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Month grid */}
                  <div className="grid gap-[8px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {dias.map((d) => {
                      const iso = toISODate(d);
                      const eventos = instPorFecha.get(iso) ?? [];
                      const fueraDeMes = d.getMonth() !== anchor.getMonth();
                      return (
                        <div
                          key={iso}
                          onClick={() => abrirInstalacion(iso)}
                          className="flex flex-col gap-[4px] p-[6px] rounded-[8px] min-h-[92px] cursor-pointer transition-colors hover:bg-[#f8fafc]"
                          style={estiloDia(iso, fueraDeMes)}
                        >
                          <p className={`${cellLabelClass} self-end ${iso === hoyISO ? "text-[#0ea5e9]" : fueraDeMes ? "text-[#94a3b8]" : "text-[#475569]"}`}>{d.getDate()}</p>
                          {eventos.slice(0, 2).map((i) => {
                            const cfg = instEstadoConfig[i.estado] ?? instEstadoConfig.Pendiente;
                            return (
                              <button
                                key={i.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirInstalacion(undefined, i);
                                }}
                                className="text-left flex items-center gap-[4px] px-[6px] py-[3px] rounded-[4px] truncate"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              >
                                <span className="font-['Geist:Medium',sans-serif] text-[#0f172a] text-[11px] truncate">{i.clienteNombre}</span>
                              </button>
                            );
                          })}
                          {eventos.length > 2 && <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px]">+{eventos.length - 2} más</p>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Veredas */}
            <div className="bg-white p-[20px] rounded-[12px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between mb-[16px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px]">Hormigón &amp; Veredas</p>
                <div className="flex items-center gap-[12px]">
                  {VER_ESTADOS.map((e) => (
                    <div key={e} className="flex items-center gap-[4px]">
                      <div className="size-[8px] rounded-full" style={{ background: verEstadoConfig[e].chip }} />
                      <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">{e}</p>
                    </div>
                  ))}
                  <button
                    onClick={() => abrirVereda()}
                    className="flex items-center gap-[6px] bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors text-white font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] px-[12px] py-[7px] rounded-[8px]"
                  >
                    Nueva Vereda
                  </button>
                </div>
              </div>

              {view === "Semana" ? (
                <>
                  {/* Week header */}
                  <div className="grid gap-[12px] mb-[12px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {diasSemanaHeader.map((d) => {
                      const iso = toISODate(d);
                      return (
                        <div key={iso} className={`flex items-center justify-center p-[8px] rounded-[8px] ${iso === hoyISO ? "bg-[#e0f2fe]" : "bg-[#f8fafc]"}`}>
                          <p className={`text-[13px] ${iso === hoyISO ? "text-[#0ea5e9]" : "text-[#475569]"} font-['Geist:SemiBold',sans-serif] font-semibold`}>
                            {capitalize(d.toLocaleDateString("es-AR", { weekday: "long" }))} {d.getDate()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid gap-[12px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {dias.map((d) => {
                      const iso = toISODate(d);
                      const eventos = verPorFecha.get(iso) ?? [];
                      return (
                        <div key={iso} className="flex flex-col gap-[10px]">
                          {eventos.map((v) => {
                            const cfg = verEstadoConfig[v.estado] ?? verEstadoConfig.Pendiente;
                            return (
                              <button
                                key={v.id}
                                onClick={() => abrirVereda(undefined, v)}
                                className="text-left flex flex-col gap-[4px] p-[10px] rounded-[8px] transition-transform hover:-translate-y-[1px]"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              >
                                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px] truncate">{v.clienteNombre}</p>
                                <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] truncate">{v.clienteDireccion || "Sin dirección"}</p>
                                {v.equipoNombre && <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px] truncate">Equipo: {v.equipoNombre}</p>}
                                <span className="font-['Geist:SemiBold',sans-serif] font-semibold text-[10px] px-[6px] py-[2px] rounded-[4px] self-start" style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
                                  {v.estado}
                                </span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => abrirVereda(iso)}
                            className="flex items-center justify-center p-[12px] rounded-[8px] hover:bg-[#f8fafc] transition-colors"
                            style={{ border: "1px dashed #e2e8f0" }}
                          >
                            <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px]">Sin vereda</p>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Month header */}
                  <div className="grid gap-[8px] mb-[8px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {Array.from({ length: 7 }, (_, i) => addDays(new Date(2024, 0, 1), i)).map((d) => (
                      <div key={d.getDay()} className="bg-[#f8fafc] flex items-center justify-center p-[8px] rounded-[8px]">
                        <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#475569] text-[12px]">{capitalize(d.toLocaleDateString("es-AR", { weekday: "long" })).slice(0, 3)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Month grid */}
                  <div className="grid gap-[8px]" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                    {dias.map((d) => {
                      const iso = toISODate(d);
                      const eventos = verPorFecha.get(iso) ?? [];
                      const fueraDeMes = d.getMonth() !== anchor.getMonth();
                      return (
                        <div
                          key={iso}
                          onClick={() => abrirVereda(iso)}
                          className="flex flex-col gap-[4px] p-[6px] rounded-[8px] min-h-[92px] cursor-pointer transition-colors hover:bg-[#f8fafc]"
                          style={estiloDia(iso, fueraDeMes)}
                        >
                          <p className={`${cellLabelClass} self-end ${iso === hoyISO ? "text-[#0ea5e9]" : fueraDeMes ? "text-[#94a3b8]" : "text-[#475569]"}`}>{d.getDate()}</p>
                          {eventos.slice(0, 2).map((v) => {
                            const cfg = verEstadoConfig[v.estado] ?? verEstadoConfig.Pendiente;
                            return (
                              <button
                                key={v.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirVereda(undefined, v);
                                }}
                                className="text-left flex items-center gap-[4px] px-[6px] py-[3px] rounded-[4px] truncate"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                              >
                                <span className="font-['Geist:Medium',sans-serif] text-[#0f172a] text-[11px] truncate">{v.clienteNombre}</span>
                              </button>
                            );
                          })}
                          {eventos.length > 2 && <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[10px]">+{eventos.length - 2} más</p>}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="bg-white p-[24px] rounded-[12px] shrink-0 w-[340px]" style={{ border: "1px solid #e2e8f0" }}>
            <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[16px] mb-[20px]">Resumen del Período</p>
            <div className="flex flex-col gap-[12px] mb-[20px]">
              {[
                { label: "Instalaciones", value: instalaciones.length, color: "#0ea5e9" },
                { label: "Veredas", value: veredas.length, color: "#10b981" },
                { label: "Equipos", value: equipos.length, color: "#8b5cf6" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between p-[16px] rounded-[10px]" style={{ border: "1px solid #e2e8f0" }}>
                  <p className="font-['Geist:Medium',sans-serif] font-medium text-[#475569] text-[14px]">{m.label}</p>
                  <p className="font-['Geist:Bold',sans-serif] font-bold text-[20px]" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className="h-px bg-[#e2e8f0] mb-[20px]" />
            <div className="flex items-center justify-between mb-[12px]">
              <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[14px]">Logística &amp; Equipos</p>
              <button
                onClick={() => abrirEquipo()}
                className="flex items-center gap-[4px] text-[#0ea5e9] hover:text-[#0284c7] font-['Geist:SemiBold',sans-serif] font-semibold text-[12px] transition-colors"
              >
                <svg fill="none" height="12" viewBox="0 0 16 16" width="12">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
                Nuevo
              </button>
            </div>
            <div className="flex flex-col gap-[12px]">
              {equipos.length === 0 ? (
                <div className="bg-[#f8fafc] flex flex-col gap-[6px] p-[14px] rounded-[8px]" style={{ border: "1px dashed #e2e8f0" }}>
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Sin equipos cargados. Creá un equipo para asignarlo a instalaciones y veredas.</p>
                </div>
              ) : (
                equipos.map((eq) => (
                  <div key={eq.id} className="bg-[#f8fafc] flex flex-col gap-[4px] p-[12px] rounded-[8px] group" style={{ border: "1px solid #e2e8f0" }}>
                    <div className="flex items-start justify-between gap-[8px]">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{eq.nombre}</p>
                      <div className="flex items-center gap-[4px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => abrirEquipo(eq)} className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-white transition-colors" title="Editar">
                          <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                            <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setBorrado({ tipo: "equipo", id: eq.id, label: eq.nombre })}
                          className="size-[26px] flex items-center justify-center rounded-[6px] hover:bg-[#fee2e2] transition-colors"
                          title="Eliminar"
                        >
                          <svg fill="none" height="13" viewBox="0 0 16 16" width="13">
                            <path d="M2 4H14M5 4V2H11V4M6 7V12M10 7V12M3 4L4 14H12L13 4" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Encargado: {eq.encargado}</p>
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[12px]">Empleados: {eq.empleados.length > 0 ? eq.empleados.join(", ") : "—"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Instalación */}
      {showInst && (
        <Modal
          titulo={editInst ? "Editar Instalación" : "Nueva Instalación"}
          onClose={cerrarInstalacion}
          footer={
            <>
              <button onClick={cerrarInstalacion} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                Cancelar
              </button>
              <button onClick={guardarInstalacion} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">
                {editInst ? "Guardar Cambios" : "Programar Instalación"}
              </button>
            </>
          }
        >
          {!editInst && (
            <Field label="Venta (pileta vendida) *" error={instErrors.ficheroId}>
              <div className="flex flex-col gap-[8px] max-h-[240px] overflow-y-auto pr-[2px]">
                {ventasDisponibles.length === 0 && (
                  <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[13px]">
                    No hay ventas disponibles para programar. Todas las piletas vendidas ya tienen una instalación asignada.
                  </p>
                )}
                {ventasDisponibles.map((v) => (
                  <button
                    key={v.ficheroId}
                    onClick={() => {
                      setInstForm((prev) => ({ ...prev, ficheroId: v.ficheroId }));
                      setInstErrors((prev) => ({ ...prev, ficheroId: "" }));
                    }}
                    className="text-left flex flex-col gap-[3px] p-[12px] rounded-[8px] transition-colors"
                    style={{ border: `1px solid ${instForm.ficheroId === v.ficheroId ? "#0ea5e9" : "#e2e8f0"}`, background: instForm.ficheroId === v.ficheroId ? "#f0f9ff" : "white" }}
                  >
                    <div className="flex items-center justify-between gap-[8px]">
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{v.clienteNombre}</p>
                      <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{v.total}</p>
                    </div>
                    <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px]">{v.clienteDireccion || "Sin dirección"}</p>
                    <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] truncate">
                      {v.items.map((it) => it.desc).filter(Boolean).join(" + ") || "Sin artículos"} · Vendida el {v.fechaVenta}
                    </p>
                  </button>
                ))}
              </div>
            </Field>
          )}

          {editInst && (
            <div className="bg-[#f8fafc] flex flex-col gap-[3px] p-[12px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
              <div className="flex items-center justify-between gap-[8px]">
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{editInst.clienteNombre}</p>
                <p className="font-['Geist:SemiBold',sans-serif] font-semibold text-[#0f172a] text-[13px]">{editInst.ficheroTotal}</p>
              </div>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[11px]">{editInst.clienteDireccion || "Sin dirección"}</p>
              <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[11px] truncate">
                {editInst.ficheroItems.map((it) => it.desc).filter(Boolean).join(" + ") || "Sin artículos"}
              </p>
            </div>
          )}

          <Field label="Fecha de instalación *" error={instErrors.fecha}>
            <input
              type="date"
              value={instForm.fecha}
              onChange={(e) => {
                setInstForm((prev) => ({ ...prev, fecha: e.target.value }));
                setInstErrors((prev) => ({ ...prev, fecha: "" }));
              }}
              className={`${inputBase} ${instErrors.fecha ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
            />
          </Field>

          <Field label="Equipo asignado">
            {equipoSelect(instForm.equipoId, (v) => setInstForm((prev) => ({ ...prev, equipoId: v })))}
            {equipos.length === 0 && <p className="text-[#94a3b8] text-[12px] mt-[4px]">No hay equipos cargados. Creá uno desde el panel lateral.</p>}
          </Field>

          <Field label="Estado">
            <select
              value={instForm.estado}
              onChange={(e) => setInstForm((prev) => ({ ...prev, estado: e.target.value as InstalacionEstado }))}
              className={`${inputBase} border-[#e2e8f0] bg-white cursor-pointer focus:border-[#0ea5e9]`}
            >
              {INST_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notas">
            <textarea
              value={instForm.notas}
              onChange={(e) => setInstForm((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Ej: Acceso por calle lateral, confirmar con el cliente..."
              rows={2}
              className={`${inputBase} border-[#e2e8f0] focus:border-[#0ea5e9] resize-none`}
            />
          </Field>

          {instApiError && <p className="text-[#ef4444] text-[13px]">{instApiError}</p>}

          {editInst && (
            <button
              onClick={() => setBorrado({ tipo: "instalacion", id: editInst.id, label: editInst.clienteNombre })}
              className="self-start font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#ef4444] hover:text-[#dc2626] transition-colors"
            >
              Eliminar instalación
            </button>
          )}
        </Modal>
      )}

      {/* Modal Vereda */}
      {showVer && (
        <Modal
          titulo={editVer ? "Editar Vereda" : "Nueva Vereda"}
          onClose={cerrarVereda}
          footer={
            <>
              <button onClick={cerrarVereda} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                Cancelar
              </button>
              <button onClick={guardarVereda} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">
                {editVer ? "Guardar Cambios" : "Programar Vereda"}
              </button>
            </>
          }
        >
          <Field label="Cliente *" error={verErrors.clienteId}>
            <ClienteSelector
              clientes={clientes}
              value={verForm.clienteId}
              onChange={(id) => {
                setVerForm((prev) => ({ ...prev, clienteId: id }));
                setVerErrors((prev) => ({ ...prev, clienteId: "" }));
              }}
              inputClass={`${inputBase} ${verErrors.clienteId ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
            />
          </Field>

          <Field label="Fecha de construcción *" error={verErrors.fecha}>
            <input
              type="date"
              value={verForm.fecha}
              onChange={(e) => {
                setVerForm((prev) => ({ ...prev, fecha: e.target.value }));
                setVerErrors((prev) => ({ ...prev, fecha: "" }));
              }}
              className={`${inputBase} ${verErrors.fecha ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
            />
          </Field>

          <Field label="Equipo asignado">{equipoSelect(verForm.equipoId, (v) => setVerForm((prev) => ({ ...prev, equipoId: v })))}</Field>

          <Field label="Estado">
            <select
              value={verForm.estado}
              onChange={(e) => setVerForm((prev) => ({ ...prev, estado: e.target.value as VeredaEstado }))}
              className={`${inputBase} border-[#e2e8f0] bg-white cursor-pointer focus:border-[#0ea5e9]`}
            >
              {VER_ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notas">
            <textarea
              value={verForm.notas}
              onChange={(e) => setVerForm((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Ej: Medir 3 m de ancho, hormigón cargado en la mañana..."
              rows={2}
              className={`${inputBase} border-[#e2e8f0] focus:border-[#0ea5e9] resize-none`}
            />
          </Field>

          {verApiError && <p className="text-[#ef4444] text-[13px]">{verApiError}</p>}

          {editVer && (
            <button
              onClick={() => setBorrado({ tipo: "vereda", id: editVer.id, label: editVer.clienteNombre })}
              className="self-start font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#ef4444] hover:text-[#dc2626] transition-colors"
            >
              Eliminar vereda
            </button>
          )}
        </Modal>
      )}

      {/* Modal Equipo */}
      {showEq && (
        <Modal
          titulo={editEq ? "Editar Equipo" : "Nuevo Equipo de Instalación"}
          onClose={cerrarEquipo}
          footer={
            <>
              <button onClick={cerrarEquipo} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                Cancelar
              </button>
              <button onClick={guardarEquipo} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#0ea5e9] hover:bg-[#0284c7] transition-colors px-[16px] py-[10px] rounded-[8px]">
                {editEq ? "Guardar Cambios" : "Crear Equipo"}
              </button>
            </>
          }
        >
          <Field label="Nombre del equipo *" error={eqErrors.nombre}>
            <input
              type="text"
              value={eqForm.nombre}
              onChange={(e) => {
                setEqForm((prev) => ({ ...prev, nombre: e.target.value }));
                setEqErrors((prev) => ({ ...prev, nombre: "" }));
              }}
              placeholder="Ej: Equipo de Excavación"
              className={`${inputBase} ${eqErrors.nombre ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
            />
          </Field>

          <Field label="Encargado *" error={eqErrors.encargado}>
            <input
              type="text"
              value={eqForm.encargado}
              onChange={(e) => {
                setEqForm((prev) => ({ ...prev, encargado: e.target.value }));
                setEqErrors((prev) => ({ ...prev, encargado: "" }));
              }}
              placeholder="Ej: Albornoz, Hugo"
              className={`${inputBase} ${eqErrors.encargado ? "border-[#ef4444]" : "border-[#e2e8f0] focus:border-[#0ea5e9]"}`}
            />
          </Field>

          <Field label="Empleados">
            <div className="flex flex-col gap-[8px]">
              {eqForm.empleados.map((emp) => (
                <div key={emp} className="flex items-center justify-between bg-[#f8fafc] px-[12px] py-[7px] rounded-[8px]" style={{ border: "1px solid #e2e8f0" }}>
                  <p className="font-['Geist:Regular',sans-serif] text-[#0f172a] text-[13px]">{emp}</p>
                  <button
                    onClick={() => setEqForm((prev) => ({ ...prev, empleados: prev.empleados.filter((x) => x !== emp) }))}
                    className="text-[#94a3b8] hover:text-[#ef4444] transition-colors text-[16px] leading-none"
                    title="Quitar"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-[8px]">
                <input
                  type="text"
                  value={nuevoEmpleado}
                  onChange={(e) => setNuevoEmpleado(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarEmpleado();
                    }
                  }}
                  placeholder="Nombre del empleado"
                  className={`${inputBase} border-[#e2e8f0] focus:border-[#0ea5e9]`}
                />
                <button
                  onClick={agregarEmpleado}
                  className="font-['Geist:SemiBold',sans-serif] font-semibold text-[13px] text-[#0ea5e9] hover:text-[#0284c7] transition-colors px-[12px] py-[9px] rounded-[8px] whitespace-nowrap"
                  style={{ border: "1px solid #e2e8f0" }}
                >
                  Agregar
                </button>
              </div>
              {eqForm.empleados.length === 0 && <p className="font-['Geist:Regular',sans-serif] text-[#94a3b8] text-[12px]">Sin empleados cargados en este equipo.</p>}
            </div>
          </Field>

          {eqApiError && <p className="text-[#ef4444] text-[13px]">{eqApiError}</p>}

          {editEq && (
            <button
              onClick={() => setBorrado({ tipo: "equipo", id: editEq.id, label: editEq.nombre })}
              className="self-start font-['Geist:Medium',sans-serif] font-medium text-[13px] text-[#ef4444] hover:text-[#dc2626] transition-colors"
            >
              Eliminar equipo
            </button>
          )}
        </Modal>
      )}

      {/* Modal Confirmar Eliminar */}
      {borrado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBorrado(null)} />
          <div className="relative bg-white rounded-[16px] w-[400px]" style={{ border: "1px solid #e2e8f0" }}>
            <div className="px-[24px] py-[20px] flex flex-col gap-[12px]">
              <p className="font-['Geist:Bold',sans-serif] font-bold text-[#0f172a] text-[16px]">
                Eliminar {borrado.tipo === "equipo" ? "Equipo" : borrado.tipo === "vereda" ? "Vereda" : "Instalación"}
              </p>
              <p className="font-['Geist:Regular',sans-serif] text-[#475569] text-[14px]">
                ¿Estás seguro de que querés eliminar{" "}
                <span className="font-semibold">{borrado.tipo === "equipo" ? `el equipo "${borrado.label}"` : borrado.label}</span>?{" "}
                {borrado.tipo === "equipo" ? "Se desasignará de las instalaciones y veredas. " : ""}No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-end gap-[12px] px-[24px] py-[20px]" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setBorrado(null)} className="font-['Geist:Medium',sans-serif] font-medium text-[14px] text-[#475569] px-[16px] py-[10px] rounded-[8px] hover:bg-[#f1f5f9] transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarBorrado} className="font-['Geist:SemiBold',sans-serif] font-semibold text-[14px] text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors px-[16px] py-[10px] rounded-[8px]">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
